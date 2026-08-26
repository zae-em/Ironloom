import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RAGService } from '../src/rag/rag.service';
import { EmbeddingService } from '../src/rag/embedding.service';
import { SupabaseService } from '../src/database/supabase.service';

describe('RAG Pipeline & Vector Search Integration Tests', () => {
  let ragService: RAGService;

  const ORG_ALPHA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_BETA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const PROJ_ALPHA = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  const PROJ_BETA = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              aiGateway: { ollama: { baseUrl: 'http://localhost:11434' } },
              supabase: { url: 'http://localhost:54321', serviceRoleKey: 'test_key' },
            }),
          ],
        }),
      ],
      providers: [EmbeddingService, RAGService, SupabaseService],
    }).compile();

    ragService = module.get<RAGService>(RAGService);
    ragService.clearInMemoryVectors();
  });

  it('should chunk, embed, and retrieve relevant documents based on semantic similarity', async () => {
    // 1. Ingest Alpha documents
    await ragService.ingestDocument({
      orgId: ORG_ALPHA,
      projectId: PROJ_ALPHA,
      documentType: 'business_case',
      documentId: 'bc-1',
      content: 'Autonomous drone guidance systems require ultra-low latency telemetry and obstacle detection algorithms.',
    });

    await ragService.ingestDocument({
      orgId: ORG_ALPHA,
      projectId: PROJ_ALPHA,
      documentType: 'coding_standard',
      documentId: 'cs-1',
      content: 'All TypeScript services must use strict type checking and Zod schema validation for external inputs.',
    });

    // 2. Query for drone guidance
    const results = await ragService.retrieveContext({
      orgId: ORG_ALPHA,
      projectId: PROJ_ALPHA,
      query: 'obstacle detection and drone telemetry',
      topK: 2,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.documentId).toBe('bc-1');
    expect(results[0].similarity).toBeGreaterThan(0.2);

    // Format for prompt injection check
    const promptContext = ragService.formatContextForPrompt(results);
    expect(promptContext).toContain('BUSINESS_CASE');
    expect(promptContext).toContain('Autonomous drone guidance');
  });

  it('should enforce multi-tenant isolation in RAG retrieval (Org A cannot see Org B vectors)', async () => {
    // 1. Ingest Org Alpha secret
    await ragService.ingestDocument({
      orgId: ORG_ALPHA,
      projectId: PROJ_ALPHA,
      documentType: 'architecture_proposal',
      documentId: 'alpha-arch-1',
      content: 'Confidential Alpha Robotics quantum sensor architecture design.',
    });

    // 2. Ingest Org Beta secret
    await ragService.ingestDocument({
      orgId: ORG_BETA,
      projectId: PROJ_BETA,
      documentType: 'architecture_proposal',
      documentId: 'beta-arch-1',
      content: 'Proprietary Beta Labs neural synapse hardware interface specifications.',
    });

    // 3. User from Org Alpha searches for neural synapse hardware
    const alphaResults = await ragService.retrieveContext({
      orgId: ORG_ALPHA,
      projectId: PROJ_ALPHA,
      query: 'neural synapse hardware interface specifications',
      topK: 5,
    });

    // Should NOT contain Beta Labs document
    const hasBetaDoc = alphaResults.some((r) => r.chunk.documentId === 'beta-arch-1');
    expect(hasBetaDoc).toBe(false);

    // 4. User from Org Beta searches for their document
    const betaResults = await ragService.retrieveContext({
      orgId: ORG_BETA,
      projectId: PROJ_BETA,
      query: 'neural synapse hardware interface specifications',
      topK: 5,
    });

    expect(betaResults.length).toBeGreaterThan(0);
    expect(betaResults[0].chunk.documentId).toBe('beta-arch-1');
  });
});
