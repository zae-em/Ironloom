import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly vectorDimension = 768; // nomic-embed-text standard dimension

  private isOllamaOnline: boolean | null = null;
  private lastHealthCheckTime = 0;
  private readonly healthCheckIntervalMs = 15000;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generates a 768-dimensional embedding vector for text using Ollama nomic-embed-text
   * or a deterministic semantic fallback vector if Ollama is offline.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const defaultProvider = this.configService.get<string>('aiGateway.defaultProvider');
    if (defaultProvider === 'mock' || process.env.AI_DEFAULT_PROVIDER === 'mock') {
      return this.generateDeterministicVector(text, this.vectorDimension);
    }

    const baseUrl = this.configService.get<string>(
      'aiGateway.ollama.baseUrl',
      'http://localhost:11434',
    );
    const now = Date.now();

    // If Ollama was recently verified offline, skip network roundtrip
    if (
      this.isOllamaOnline === false &&
      now - this.lastHealthCheckTime < this.healthCheckIntervalMs
    ) {
      return this.generateDeterministicVector(text, this.vectorDimension);
    }

    try {
      const response = await axios.post(
        `${baseUrl}/api/embeddings`,
        {
          model: 'nomic-embed-text',
          prompt: text,
        },
        { timeout: 500 },
      );

      if (response.data?.embedding && Array.isArray(response.data.embedding)) {
        this.isOllamaOnline = true;
        this.lastHealthCheckTime = now;
        return response.data.embedding;
      }
    } catch {
      this.isOllamaOnline = false;
      this.lastHealthCheckTime = now;
    }

    // High-quality deterministic word n-gram bag-of-words vector projection
    return this.generateDeterministicVector(text, this.vectorDimension);
  }

  /**
   * Compute cosine similarity between two vectors (-1.0 to 1.0)
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private generateDeterministicVector(text: string, dimensions: number): number[] {
    const vector = new Array(dimensions).fill(0);
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      vector[0] = 1.0;
      return vector;
    }

    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1.0;

      // Also hash character bigrams for subword semantic capture
      for (let i = 0; i < word.length - 1; i++) {
        const bgHash = word.charCodeAt(i) * 31 + word.charCodeAt(i + 1);
        const bgIndex = Math.abs(bgHash) % dimensions;
        vector[bgIndex] += 0.5;
      }
    }

    // Normalize vector to unit length
    let norm = 0;
    for (let i = 0; i < dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(norm);
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }
}
