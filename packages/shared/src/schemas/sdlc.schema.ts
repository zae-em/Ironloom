import { z } from 'zod';

// Review Workflow Status for Human-in-the-Loop Approval Gates
export const ReviewStatusSchema = z.enum(['draft', 'in_review', 'approved', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// 1. Business Analyst Schema
export const BusinessCaseSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid(),
  rawIdea: z.string().min(1),
  problemStatement: z.string().min(1),
  goals: z.array(z.string()).default([]),
  targetUsers: z.array(z.string()).default([]),
  successMetrics: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  status: ReviewStatusSchema.default('draft'),
  version: z.number().int().default(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type BusinessCase = z.infer<typeof BusinessCaseSchema>;

export const CreateBusinessCaseDtoSchema = z.object({
  rawIdea: z.string().min(10, 'Idea description must be at least 10 characters'),
  projectId: z.string().uuid(),
});
export type CreateBusinessCaseDto = z.input<typeof CreateBusinessCaseDtoSchema>;

export const BusinessCaseOutputSchema = z.object({
  problemStatement: z.string(),
  goals: z.array(z.string()),
  targetUsers: z.array(z.string()),
  successMetrics: z.array(z.string()),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
});
export type BusinessCaseOutput = z.infer<typeof BusinessCaseOutputSchema>;

// 2. Product Manager Schema (Epics & Prioritized Backlog)
export const EpicPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type EpicPriority = z.infer<typeof EpicPrioritySchema>;

export const EpicSizingSchema = z.enum(['XS', 'S', 'M', 'L', 'XL']);
export type EpicSizing = z.infer<typeof EpicSizingSchema>;

export const EpicSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid(),
  businessCaseId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  priority: EpicPrioritySchema.default('medium'),
  sizing: EpicSizingSchema.default('M'),
  status: ReviewStatusSchema.default('draft'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Epic = z.infer<typeof EpicSchema>;

export const CreateEpicDtoSchema = z.object({
  businessCaseId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  priority: EpicPrioritySchema.optional().default('medium'),
  sizing: EpicSizingSchema.optional().default('M'),
});
export type CreateEpicDto = z.input<typeof CreateEpicDtoSchema>;

export const EpicsOutputSchema = z.object({
  epics: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      rationale: z.string(),
      priority: EpicPrioritySchema,
      sizing: EpicSizingSchema,
    }),
  ),
});
export type EpicsOutput = z.infer<typeof EpicsOutputSchema>;

// 3. Requirements Engineer Schema (User Stories & Gherkin Acceptance Criteria)
export const AcceptanceCriterionSchema = z.object({
  id: z.string().uuid(),
  userStoryId: z.string().uuid(),
  scenarioTitle: z.string().min(1),
  givenText: z.string().min(1),
  whenText: z.string().min(1),
  thenText: z.string().min(1),
  createdAt: z.string().optional(),
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

export const UserStorySchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid(),
  epicId: z.string().uuid(),
  title: z.string().min(1),
  asA: z.string().min(1),
  iWant: z.string().min(1),
  soThat: z.string().min(1),
  status: ReviewStatusSchema.default('draft'),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type UserStory = z.infer<typeof UserStorySchema>;

export const UserStoriesOutputSchema = z.object({
  stories: z.array(
    z.object({
      title: z.string(),
      asA: z.string(),
      iWant: z.string(),
      soThat: z.string(),
      acceptanceCriteria: z.array(
        z.object({
          scenarioTitle: z.string(),
          givenText: z.string(),
          whenText: z.string(),
          thenText: z.string(),
        }),
      ),
    }),
  ),
});
export type UserStoriesOutput = z.infer<typeof UserStoriesOutputSchema>;

// 4. System Architect Schema (Components, Tech Choices, Data Models, Diagrams)
export const ArchitectureComponentSchema = z.object({
  name: z.string(),
  description: z.string(),
  techChoice: z.string(),
  justification: z.string(),
});
export type ArchitectureComponent = z.infer<typeof ArchitectureComponentSchema>;

export const TechStackItemSchema = z.object({
  category: z.string(),
  technology: z.string(),
  justification: z.string(),
});
export type TechStackItem = z.infer<typeof TechStackItemSchema>;

export const DataModelEntitySchema = z.object({
  name: z.string(),
  fields: z.array(z.string()),
  description: z.string(),
});
export type DataModelEntity = z.infer<typeof DataModelEntitySchema>;

export const ArchitectureProposalSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid(),
  version: z.number().int().default(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  components: z.array(ArchitectureComponentSchema).default([]),
  techStack: z.array(TechStackItemSchema).default([]),
  dataModel: z
    .object({
      entities: z.array(DataModelEntitySchema).default([]),
      relationships: z.array(z.string()).default([]),
    })
    .default({ entities: [], relationships: [] }),
  diagramMermaid: z.string().default(''),
  status: ReviewStatusSchema.default('draft'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ArchitectureProposal = z.infer<typeof ArchitectureProposalSchema>;

export const ArchitectureOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  components: z.array(ArchitectureComponentSchema),
  techStack: z.array(TechStackItemSchema),
  dataModel: z.object({
    entities: z.array(DataModelEntitySchema),
    relationships: z.array(z.string()),
  }),
  diagramMermaid: z.string(),
});
export type ArchitectureOutput = z.infer<typeof ArchitectureOutputSchema>;

// 5. RAG Retrieval & Ingestion Schemas
export const RAGDocumentTypeSchema = z.enum([
  'business_case',
  'requirement',
  'user_story',
  'architecture_proposal',
  'coding_standard',
]);
export type RAGDocumentType = z.infer<typeof RAGDocumentTypeSchema>;

export const RAGChunkSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  documentType: RAGDocumentTypeSchema,
  documentId: z.string(),
  chunkIndex: z.number().int(),
  content: z.string(),
  metadata: z.record(z.any()).default({}),
  createdAt: z.string().optional(),
});
export type RAGChunk = z.infer<typeof RAGChunkSchema>;

export const RAGSearchResultSchema = z.object({
  chunk: RAGChunkSchema,
  similarity: z.number(),
});
export type RAGSearchResult = z.infer<typeof RAGSearchResultSchema>;

// 6. Traceability Graph Schema
export const TraceabilityGraphSchema = z.object({
  projectId: z.string().uuid(),
  businessCase: BusinessCaseSchema.optional(),
  epics: z.array(
    EpicSchema.extend({
      userStories: z.array(UserStorySchema).default([]),
    }),
  ).default([]),
  architectureProposals: z.array(ArchitectureProposalSchema).default([]),
});
export type TraceabilityGraph = z.infer<typeof TraceabilityGraphSchema>;
