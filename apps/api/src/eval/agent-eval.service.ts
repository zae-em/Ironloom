import { Injectable, Logger } from '@nestjs/common';
import {
  BusinessCase,
  Epic,
  UserStory,
  ArchitectureProposal,
} from '@ironloom/shared';

export interface EvalFixture {
  id: string;
  domain: string;
  rawIdea: string;
  expectedTopics: string[];
  minimumEpics: number;
  minimumStoriesPerEpic: number;
  requireGherkin: boolean;
  minimumComponents: number;
}

export interface EvalScorecard {
  fixtureId: string;
  domain: string;
  businessCaseScore: number;
  epicsScore: number;
  storiesScore: number;
  architectureScore: number;
  overallScore: number;
  passed: boolean;
  details: {
    businessCaseNotes: string[];
    epicsNotes: string[];
    storiesNotes: string[];
    architectureNotes: string[];
  };
}

@Injectable()
export class AgentEvalService {
  private readonly logger = new Logger(AgentEvalService.name);

  evaluateBusinessCase(bc: BusinessCase, fixture: EvalFixture): { score: number; notes: string[] } {
    let score = 0;
    const notes: string[] = [];

    // Problem Statement checks (0.25)
    if (bc.problemStatement && bc.problemStatement.length > 20) {
      score += 0.15;
      const lowerPs = bc.problemStatement.toLowerCase();
      const topicMatches = fixture.expectedTopics.filter((t) => lowerPs.includes(t.toLowerCase())).length;
      if (topicMatches > 0) {
        score += 0.1;
        notes.push(`Problem statement covers ${topicMatches} expected domain keywords.`);
      } else {
        notes.push('Problem statement has low keyword overlap with prompt domain.');
      }
    } else {
      notes.push('Problem statement is missing or too short.');
    }

    // Goals (0.25)
    if (bc.goals && bc.goals.length >= 2) {
      score += 0.25;
    } else {
      notes.push('Business case should define at least 2 concrete goals.');
    }

    // Target Users (0.15)
    if (bc.targetUsers && bc.targetUsers.length >= 1) {
      score += 0.15;
    } else {
      notes.push('Target users list is empty.');
    }

    // Success Metrics (0.20)
    if (bc.successMetrics && bc.successMetrics.length >= 2) {
      score += 0.20;
    } else {
      notes.push('Success metrics should include at least 2 measurable criteria.');
    }

    // Risks & Assumptions (0.15)
    if (bc.risks && bc.risks.length >= 1 && bc.assumptions && bc.assumptions.length >= 1) {
      score += 0.15;
    } else {
      notes.push('Risks or assumptions are missing.');
    }

    return { score: Number(score.toFixed(2)), notes };
  }

  evaluateEpics(epics: Epic[], fixture: EvalFixture): { score: number; notes: string[] } {
    let score = 0;
    const notes: string[] = [];

    if (!epics || epics.length === 0) {
      return { score: 0, notes: ['No epics generated.'] };
    }

    // Epic count check (0.35)
    if (epics.length >= fixture.minimumEpics) {
      score += 0.35;
      notes.push(`Generated ${epics.length} epics (meets target >= ${fixture.minimumEpics}).`);
    } else {
      score += 0.15;
      notes.push(`Generated ${epics.length} epics (below target ${fixture.minimumEpics}).`);
    }

    // Sizing validation (0.35)
    const validSizes = ['XS', 'S', 'M', 'L', 'XL'];
    const validSizingCount = epics.filter((e) => validSizes.includes(e.sizing)).length;
    if (validSizingCount === epics.length) {
      score += 0.35;
    } else {
      score += 0.15;
      notes.push('Some epics lack valid T-shirt sizing.');
    }

    // Rationale & Description richness (0.30)
    const detailedEpics = epics.filter((e) => e.description && e.description.length > 20).length;
    if (detailedEpics === epics.length) {
      score += 0.30;
    } else {
      score += 0.15;
      notes.push('Some epics have brief or missing descriptions.');
    }

    return { score: Number(score.toFixed(2)), notes };
  }

  evaluateStories(stories: UserStory[], fixture: EvalFixture): { score: number; notes: string[] } {
    let score = 0;
    const notes: string[] = [];

    if (!stories || stories.length === 0) {
      return { score: 0, notes: ['No user stories generated.'] };
    }

    // Story volume (0.30)
    score += Math.min(0.30, (stories.length / (fixture.minimumEpics * fixture.minimumStoriesPerEpic)) * 0.30);

    // Persona format check (0.30)
    const properFormatCount = stories.filter(
      (s) => s.asA && s.iWant && s.soThat && s.asA.length > 2 && s.iWant.length > 2,
    ).length;
    score += (properFormatCount / stories.length) * 0.30;

    // Gherkin Acceptance Criteria syntax conformity (0.40)
    let gherkinCompliantCount = 0;
    for (const s of stories) {
      if (s.acceptanceCriteria && s.acceptanceCriteria.length > 0) {
        const hasGherkin = s.acceptanceCriteria.some((c) => {
          const lower = ((c.givenText || '') + (c.whenText || '') + (c.thenText || '')).toLowerCase();
          return lower.length > 10;
        });
        if (hasGherkin) gherkinCompliantCount++;
      }
    }

    const gherkinRatio = gherkinCompliantCount / stories.length;
    score += gherkinRatio * 0.40;
    if (gherkinRatio < 0.8) {
      notes.push(`Gherkin acceptance criteria compliance is ${(gherkinRatio * 100).toFixed(0)}%.`);
    } else {
      notes.push(`High Gherkin criteria compliance: ${(gherkinRatio * 100).toFixed(0)}%.`);
    }

    return { score: Number(score.toFixed(2)), notes };
  }

  evaluateArchitecture(proposal: ArchitectureProposal, fixture: EvalFixture): { score: number; notes: string[] } {
    let score = 0;
    const notes: string[] = [];

    if (!proposal) {
      return { score: 0, notes: ['No architecture proposal generated.'] };
    }

    // Components check (0.30)
    if (proposal.components && proposal.components.length >= fixture.minimumComponents) {
      score += 0.30;
      notes.push(`Components count (${proposal.components.length}) meets minimum requirement.`);
    } else {
      score += 0.15;
      notes.push(`Components count (${proposal.components?.length || 0}) below minimum.`);
    }

    // Tech stack choices (0.20)
    if (proposal.techStack && proposal.techStack.length >= 3) {
      score += 0.20;
    } else {
      score += 0.10;
      notes.push('Tech stack list has fewer than 3 entries.');
    }

    // Data model schema entities (0.25)
    if (proposal.dataModel?.entities && proposal.dataModel.entities.length >= 2) {
      score += 0.25;
      notes.push(`Data model contains ${proposal.dataModel.entities.length} relational entities.`);
    } else {
      score += 0.10;
      notes.push('Data model entities count is low.');
    }

    // Mermaid diagram syntax check (0.25)
    if (proposal.diagramMermaid && (proposal.diagramMermaid.includes('graph TD') || proposal.diagramMermaid.includes('graph LR') || proposal.diagramMermaid.includes('flowchart'))) {
      score += 0.25;
      notes.push('Valid Mermaid graph syntax present.');
    } else {
      score += 0.05;
      notes.push('Mermaid diagram missing or non-standard syntax.');
    }

    return { score: Number(score.toFixed(2)), notes };
  }

  evaluateFullPipeline(params: {
    fixture: EvalFixture;
    businessCase: BusinessCase;
    epics: Epic[];
    stories: UserStory[];
    architecture: ArchitectureProposal;
    passThreshold?: number;
  }): EvalScorecard {
    const { fixture, businessCase, epics, stories, architecture, passThreshold = 0.80 } = params;

    const bcResult = this.evaluateBusinessCase(businessCase, fixture);
    const epicsResult = this.evaluateEpics(epics, fixture);
    const storiesResult = this.evaluateStories(stories, fixture);
    const archResult = this.evaluateArchitecture(architecture, fixture);

    // Weighted overall score: 25% BC, 25% Epics, 25% Stories, 25% Architecture
    const overallScore = Number(
      (
        bcResult.score * 0.25 +
        epicsResult.score * 0.25 +
        storiesResult.score * 0.25 +
        archResult.score * 0.25
      ).toFixed(2),
    );

    return {
      fixtureId: fixture.id,
      domain: fixture.domain,
      businessCaseScore: bcResult.score,
      epicsScore: epicsResult.score,
      storiesScore: storiesResult.score,
      architectureScore: archResult.score,
      overallScore,
      passed: overallScore >= passThreshold,
      details: {
        businessCaseNotes: bcResult.notes,
        epicsNotes: epicsResult.notes,
        storiesNotes: storiesResult.notes,
        architectureNotes: archResult.notes,
      },
    };
  }
}
