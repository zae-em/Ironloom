import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { EmbeddingService } from '../../rag/embedding.service';
import { WorkflowDecision } from '@ironloom/shared';
import { v4 as uuidv4 } from 'uuid';

export interface StoredDecisionRecord extends WorkflowDecision {
  embedding?: number[];
}

@Injectable()
export class WorkflowDecisionService {
  private readonly logger = new Logger(WorkflowDecisionService.name);
  private readonly memoryDecisions = new Map<string, StoredDecisionRecord>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Records a cross-agent architectural or business decision with vector embedding.
   */
  async recordDecision(params: {
    orgId: string;
    projectId: string;
    workflowRunId: string;
    nodeName: any;
    decisionType: string;
    summary: string;
    payload?: Record<string, any>;
  }): Promise<WorkflowDecision> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const textToEmbed = `[${params.nodeName}] (${params.decisionType}): ${params.summary}`;
    const embedding = await this.embeddingService.generateEmbedding(textToEmbed);

    const record: StoredDecisionRecord = {
      id,
      orgId: params.orgId,
      projectId: params.projectId,
      workflowRunId: params.workflowRunId,
      nodeName: params.nodeName,
      decisionType: params.decisionType,
      summary: params.summary,
      payload: params.payload || {},
      embedding,
      createdAt: now,
    };

    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        await admin.from('workflow_decisions').insert({
          id: record.id,
          org_id: record.orgId,
          project_id: record.projectId,
          workflow_run_id: record.workflowRunId,
          node_name: record.nodeName,
          decision_type: record.decisionType,
          summary: record.summary,
          payload: record.payload,
          embedding: record.embedding,
          created_at: record.createdAt,
        });
      } catch {}
    }

    this.memoryDecisions.set(id, record);
    this.logger.debug(`Workflow decision recorded: ${id} [${params.decisionType}]`);
    return {
      id: record.id,
      orgId: record.orgId,
      projectId: record.projectId,
      workflowRunId: record.workflowRunId,
      nodeName: record.nodeName,
      decisionType: record.decisionType,
      summary: record.summary,
      payload: record.payload,
      createdAt: record.createdAt,
    };
  }

  /**
   * Semantically searches prior workflow decisions for the project.
   */
  async searchRelevantDecisions(params: {
    orgId: string;
    projectId: string;
    query: string;
    topK?: number;
  }): Promise<Array<{ decision: WorkflowDecision; similarity: number }>> {
    const { orgId, projectId, query, topK = 3 } = params;
    const queryVector = await this.embeddingService.generateEmbedding(query);

    const candidates = Array.from(this.memoryDecisions.values()).filter(
      (d) => d.orgId === orgId && d.projectId === projectId && d.embedding,
    );

    const scored = candidates.map((d) => {
      const sim = this.embeddingService.cosineSimilarity(queryVector, d.embedding!);
      return {
        decision: {
          id: d.id,
          orgId: d.orgId,
          projectId: d.projectId,
          workflowRunId: d.workflowRunId,
          nodeName: d.nodeName,
          decisionType: d.decisionType,
          summary: d.summary,
          payload: d.payload,
          createdAt: d.createdAt,
        },
        similarity: sim,
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  formatDecisionsForPrompt(
    results: Array<{ decision: WorkflowDecision; similarity: number }>,
  ): string {
    if (results.length === 0) return 'No prior workflow decisions recorded.';
    return results
      .map(
        (r, idx) =>
          `[Decision ${idx + 1}] (${r.decision.nodeName} - ${r.decision.decisionType}): ${r.decision.summary}`,
      )
      .join('\n');
  }
}
