import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { SupabaseService } from '../database/supabase.service';
import { RAGChunk, RAGDocumentType, RAGSearchResult } from '@ironloom/shared';
import { v4 as uuidv4 } from 'uuid';

interface StoredEmbeddingRecord {
  id: string;
  orgId: string;
  projectId?: string;
  documentType: RAGDocumentType;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: string;
}

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);
  private readonly inMemoryVectors: StoredEmbeddingRecord[] = [];

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Ingest, chunk, and embed a document into the RAG vector store.
   */
  async ingestDocument(params: {
    orgId: string;
    projectId?: string;
    documentType: RAGDocumentType;
    documentId: string;
    content: string;
    metadata?: Record<string, any>;
    chunkSize?: number;
    chunkOverlap?: number;
  }): Promise<RAGChunk[]> {
    const {
      orgId,
      projectId,
      documentType,
      documentId,
      content,
      metadata = {},
      chunkSize = 600,
      chunkOverlap = 100,
    } = params;

    // 1. Chunk content into overlapping slices
    const chunks = this.chunkText(content, chunkSize, chunkOverlap);
    const createdChunks: RAGChunk[] = [];
    const admin = this.supabaseService.getAdminClient();

    // 2. Remove previous embeddings for this document ID to prevent duplicate index entries
    this.removeInMemoryEmbeddings(documentId);
    try {
      await admin.from('document_embeddings').delete().eq('document_id', documentId);
    } catch {}

    // 3. Generate vectors and persist each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const chunkId = uuidv4();
      const now = new Date().toISOString();

      const embeddingVector = await this.embeddingService.generateEmbedding(chunkText);

      const record: StoredEmbeddingRecord = {
        id: chunkId,
        orgId,
        projectId,
        documentType,
        documentId,
        chunkIndex: i,
        content: chunkText,
        embedding: embeddingVector,
        metadata: { ...metadata, totalChunks: chunks.length },
        createdAt: now,
      };

      // Store in memory
      this.inMemoryVectors.push(record);

      // Attempt DB insert
      try {
        await admin.from('document_embeddings').insert({
          id: record.id,
          org_id: record.orgId,
          project_id: record.projectId || null,
          document_type: record.documentType,
          document_id: record.documentId,
          chunk_index: record.chunkIndex,
          content: record.content,
          embedding: record.embedding,
          metadata: record.metadata,
          created_at: record.createdAt,
        });
      } catch (err: any) {
        this.logger.debug(`RAG db insert fallback: ${err.message}`);
      }

      createdChunks.push({
        id: chunkId,
        orgId,
        projectId,
        documentType,
        documentId,
        chunkIndex: i,
        content: chunkText,
        metadata: record.metadata,
        createdAt: now,
      });
    }

    this.logger.log(
      `Ingested ${chunks.length} RAG vector chunks for [${documentType}:${documentId}] in project ${projectId || 'global'}`,
    );

    return createdChunks;
  }

  /**
   * Vector similarity search scoped to organization and project.
   */
  async retrieveContext(params: {
    orgId: string;
    projectId?: string;
    query: string;
    documentTypes?: RAGDocumentType[];
    topK?: number;
    minSimilarity?: number;
  }): Promise<RAGSearchResult[]> {
    const {
      orgId,
      projectId,
      query,
      documentTypes,
      topK = 3,
      minSimilarity = 0.15,
    } = params;

    if (!query || query.trim().length === 0) return [];

    const queryVector = await this.embeddingService.generateEmbedding(query);

    // Filter candidate records by orgId and (projectId or null/global)
    const candidates = this.inMemoryVectors.filter((item) => {
      if (item.orgId !== orgId) return false;
      if (projectId && item.projectId && item.projectId !== projectId) return false;
      if (documentTypes && documentTypes.length > 0 && !documentTypes.includes(item.documentType)) {
        return false;
      }
      return true;
    });

    // Score candidates with cosine similarity
    const scored: RAGSearchResult[] = candidates
      .map((item) => {
        const similarity = this.embeddingService.cosineSimilarity(queryVector, item.embedding);
        return {
          chunk: {
            id: item.id,
            orgId: item.orgId,
            projectId: item.projectId,
            documentType: item.documentType,
            documentId: item.documentId,
            chunkIndex: item.chunkIndex,
            content: item.content,
            metadata: item.metadata,
            createdAt: item.createdAt,
          },
          similarity,
        };
      })
      .filter((res) => res.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return scored;
  }

  /**
   * Format retrieved chunks into a prompt-ready markdown string.
   */
  formatContextForPrompt(results: RAGSearchResult[]): string {
    if (!results || results.length === 0) return 'None available.';

    return results
      .map((r, i) => {
        const type = r.chunk.documentType.toUpperCase();
        return `[Source ${i + 1} - ${type} (Relevance: ${(r.similarity * 100).toFixed(0)}%)]\n${r.chunk.content}`;
      })
      .join('\n\n---\n\n');
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const cleanText = text.trim();
    if (cleanText.length <= chunkSize) return [cleanText];

    const chunks: string[] = [];
    let start = 0;

    while (start < cleanText.length) {
      let end = start + chunkSize;
      if (end >= cleanText.length) {
        chunks.push(cleanText.substring(start));
        break;
      }

      // Try breaking on punctuation or whitespace near end
      const lastPunctuation = cleanText.lastIndexOf('. ', end);
      const lastNewline = cleanText.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPunctuation, lastNewline);

      if (breakPoint > start + chunkSize / 2) {
        end = breakPoint + 1;
      }

      chunks.push(cleanText.substring(start, end).trim());
      start = end - overlap;
    }

    return chunks.filter((c) => c.length > 0);
  }

  private removeInMemoryEmbeddings(documentId: string): void {
    const idxsToRemove: number[] = [];
    for (let i = 0; i < this.inMemoryVectors.length; i++) {
      if (this.inMemoryVectors[i].documentId === documentId) {
        idxsToRemove.push(i);
      }
    }
    for (let i = idxsToRemove.length - 1; i >= 0; i--) {
      this.inMemoryVectors.splice(idxsToRemove[i], 1);
    }
  }

  getInMemoryVectorCount(): number {
    return this.inMemoryVectors.length;
  }

  clearInMemoryVectors(): void {
    this.inMemoryVectors.length = 0;
  }
}
