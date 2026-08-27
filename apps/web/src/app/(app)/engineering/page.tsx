'use client';

import * as React from 'react';
import {
  CodeFileChange,
  PullRequestEntity,
  CodeReviewVerdict,
  TestRunEntity,
  UserStory,
} from '@ironloom/shared';
import { CodeDiffViewer } from '../../../components/engineering/code-diff-viewer';
import { PrListView } from '../../../components/engineering/pr-list-view';
import { QaTestResultsView } from '../../../components/engineering/qa-test-results-view';
import { SandboxExecutionAudit } from '../../../components/engineering/sandbox-execution-audit';
import { apiClient } from '../../../lib/api-client';
import { cn } from '../../../lib/utils';
import {
  GitPullRequest,
  ShieldCheck,
  Cpu,
  FileCode,
  Sparkles,
  Layers,
  CheckCircle2,
  RefreshCw,
  Plus,
} from 'lucide-react';

// Representative 5-domain mock fixtures matching Prompt 7
const BENCHMARK_PRS: {
  pr: PullRequestEntity;
  files: CodeFileChange[];
  userStory: UserStory;
  codeReview: CodeReviewVerdict;
  testRun: TestRunEntity;
}[] = [
  {
    pr: {
      id: 'pr-101',
      prNumber: 101,
      title: 'feat: Multi-Currency Idempotent Payment Processor',
      body: 'Implements idempotent payment processing with fraud anomaly detection.',
      branchName: 'feat/story-fintech-01',
      baseBranch: 'main',
      url: 'https://github.com/zae-em/ironloom/pull/101',
      userStoryId: '11111111-1111-1111-1111-111111111111',
      status: 'open',
      reviewStatus: 'approved',
      ciStatus: 'passed',
      sandboxExecutionId: 'sbx-fintech-881',
      filesChanged: ['src/services/payment.service.ts'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    files: [
      {
        path: 'src/services/payment.service.ts',
        action: 'create',
        content: `export interface PaymentRequest {\n  idempotencyKey: string;\n  amount: number;\n  currency: 'USD' | 'EUR' | 'JPY';\n  merchantId: string;\n}\n\nexport class PaymentService {\n  private processedKeys = new Set<string>();\n\n  async processPayment(req: PaymentRequest) {\n    if (this.processedKeys.has(req.idempotencyKey)) {\n      return { status: 'cached', receiptId: 'rcpt_' + req.idempotencyKey };\n    }\n    this.processedKeys.add(req.idempotencyKey);\n    return { status: 'success', receiptId: 'rcpt_' + req.idempotencyKey, amount: req.amount };\n  }\n}\n`,
      },
    ],
    userStory: {
      id: '11111111-1111-1111-1111-111111111111',
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      epicId: '22222222-2222-2222-2222-222222222222',
      title: 'Multi-Currency Idempotent Payment Processor',
      asA: 'Merchant',
      iWant: 'To process multi-currency payments with idempotency keys',
      soThat: 'Double-charging customers is completely prevented',
      status: 'approved',
      acceptanceCriteria: [
        {
          id: 'ac-1',
          userStoryId: '11111111-1111-1111-1111-111111111111',
          scenarioTitle: 'Idempotency Verification',
          givenText: 'A payment charge request with idempotency key',
          whenText: 'The payment processor receives the charge',
          thenText: 'It must verify key uniqueness before executing payment',
        },
      ],
      createdAt: new Date().toISOString(),
    },
    codeReview: {
      prNumber: 101,
      verdict: 'approved',
      summary: 'Code review approved. Clean typed domain handler with idempotency protection.',
      comments: [
        {
          file: 'src/services/payment.service.ts',
          line: 9,
          comment: 'Deterministic in-memory key caching fulfills all acceptance criteria.',
          severity: 'suggestion',
        },
      ],
      reviewedAt: new Date().toISOString(),
    },
    testRun: {
      id: 'tr-101',
      prNumber: 101,
      passedCount: 3,
      failedCount: 0,
      skippedCount: 0,
      durationMs: 420,
      coveragePercent: 98.5,
      rawLog:
        'PASS test/services/payment.spec.ts\n  ✓ should check idempotency key (12ms)\n  ✓ should cache duplicate keys (8ms)\n  ✓ should process valid currencies (14ms)\nTest Suites: 1 passed, 1 total\nSnapshots:   0 total\nTime:        0.42s',
      sandboxExecutionId: 'sbx-fintech-881',
      status: 'passed',
      executedAt: new Date().toISOString(),
    },
  },
  {
    pr: {
      id: 'pr-102',
      prNumber: 102,
      title: 'feat: DICOM Medical Image Parser & HIPAA Anonymizer',
      body: 'Strips patient PHI fields according to HIPAA Safe Harbor guidelines.',
      branchName: 'feat/story-healthcare-02',
      baseBranch: 'main',
      url: 'https://github.com/zae-em/ironloom/pull/102',
      userStoryId: '33333333-3333-3333-3333-333333333333',
      status: 'open',
      reviewStatus: 'approved',
      ciStatus: 'passed',
      sandboxExecutionId: 'sbx-health-992',
      filesChanged: ['src/services/dicom.service.ts'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    files: [
      {
        path: 'src/services/dicom.service.ts',
        action: 'create',
        content: `export class DicomAnonymizerService {\n  anonymizeHeader(header: Record<string, string>) {\n    const sanitized = { ...header };\n    delete sanitized['PatientName'];\n    delete sanitized['PatientID'];\n    delete sanitized['PatientBirthDate'];\n    return { anonymized: true, header: sanitized };\n  }\n}\n`,
      },
    ],
    userStory: {
      id: '33333333-3333-3333-3333-333333333333',
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      epicId: '22222222-2222-2222-2222-222222222222',
      title: 'DICOM Medical Image Parser & PHI Anonymizer',
      asA: 'Radiologist',
      iWant: 'To strip patient PHI fields from DICOM metadata',
      soThat: 'Medical imaging data adheres strictly to HIPAA Safe Harbor regulations',
      status: 'approved',
      acceptanceCriteria: [
        {
          id: 'ac-2',
          userStoryId: '33333333-3333-3333-3333-333333333333',
          scenarioTitle: 'PHI Stripping',
          givenText: 'A raw DICOM header with patient identifiers',
          whenText: 'Anonymizer is triggered',
          thenText: 'PatientName, PatientID, and BirthDate are safely deleted',
        },
      ],
      createdAt: new Date().toISOString(),
    },
    codeReview: {
      prNumber: 102,
      verdict: 'approved',
      summary: 'Strict HIPAA compliance adherence. Approved.',
      comments: [
        {
          file: 'src/services/dicom.service.ts',
          line: 3,
          comment: 'HIPAA Safe Harbor fields are completely stripped.',
          severity: 'suggestion',
        },
      ],
      reviewedAt: new Date().toISOString(),
    },
    testRun: {
      id: 'tr-102',
      prNumber: 102,
      passedCount: 3,
      failedCount: 0,
      skippedCount: 0,
      durationMs: 380,
      coveragePercent: 99.0,
      rawLog:
        'PASS test/services/dicom.spec.ts\n  ✓ should strip patient name (10ms)\n  ✓ should remove patient ID (6ms)\n  ✓ should preserve imaging modality tags (8ms)\nTest Suites: 1 passed, 1 total\nSnapshots:   0 total\nTime:        0.38s',
      sandboxExecutionId: 'sbx-health-992',
      status: 'passed',
      executedAt: new Date().toISOString(),
    },
  },
];

export default function EngineeringHubPage() {
  const [activeTab, setActiveTab] = React.useState<'workspace' | 'qa' | 'sandbox'>('workspace');
  const [selectedPrNumber, setSelectedPrNumber] = React.useState<number>(101);
  const [selectedSandboxId, setSelectedSandboxId] = React.useState<string | null>(null);

  const activeBenchmark = React.useMemo(() => {
    return BENCHMARK_PRS.find((b) => b.pr.prNumber === selectedPrNumber) || BENCHMARK_PRS[0];
  }, [selectedPrNumber]);

  const handlePostComment = async (file: string, line: number, comment: string) => {
    try {
      await apiClient.post('/mcp/execute', {
        toolName: 'github_post_comment',
        input: {
          owner: 'zae-em',
          repo: 'ironloom',
          issueNumber: activeBenchmark.pr.prNumber,
          body: `**[Inline Review - ${file}:${line}]** ${comment}`,
        },
      });
    } catch {
      // Local fallback
    }
  };

  const handleApprovePr = async (prNumber: number, notes?: string) => {
    try {
      await apiClient.post('/mcp/execute', {
        toolName: 'github_post_comment',
        input: {
          owner: 'zae-em',
          repo: 'ironloom',
          issueNumber: prNumber,
          body: `### ✅ Pull Request Approved for Merge\n\n${notes || 'Approved by human reviewer via IRONLOOM Engineering Console.'}`,
        },
      });
      activeBenchmark.pr.status = 'merged';
    } catch {}
  };

  const handleRequestChanges = async (prNumber: number, notes: string) => {
    try {
      await apiClient.post('/mcp/execute', {
        toolName: 'github_post_comment',
        input: {
          owner: 'zae-em',
          repo: 'ironloom',
          issueNumber: prNumber,
          body: `### ⚠️ Changes Requested\n\n${notes}`,
        },
      });
      activeBenchmark.pr.reviewStatus = 'changes_requested';
    } catch {}
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <span>Autonomous Engineering Hub</span>
            <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
              Phase 4
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review agent-authored code diffs, verify automated test runs, and audit zero-trust
            sandbox execution
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center rounded-xl border border-border bg-card/80 p-1 backdrop-blur-md shadow-sm">
          <button
            onClick={() => setActiveTab('workspace')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors',
              activeTab === 'workspace'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <GitPullRequest className="h-4 w-4" />
            <span>Code Workspace & PRs</span>
          </button>
          <button
            onClick={() => setActiveTab('qa')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors',
              activeTab === 'qa'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Testing & QA Suite</span>
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors',
              activeTab === 'sandbox'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Cpu className="h-4 w-4" />
            <span>Sandbox Audit</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content Panes */}
      {activeTab === 'workspace' && (
        <div className="flex flex-col gap-6">
          <PrListView
            pullRequests={BENCHMARK_PRS.map((b) => b.pr)}
            activePrNumber={selectedPrNumber}
            onSelectPr={(pr) => setSelectedPrNumber(pr.prNumber)}
            onApprovePr={handleApprovePr}
            onRequestChanges={handleRequestChanges}
            codeReviews={BENCHMARK_PRS.map((b) => b.codeReview)}
            testRuns={BENCHMARK_PRS.map((b) => b.testRun)}
            qaRetryCount={0}
            maxQaRetries={3}
          />

          <CodeDiffViewer
            pullRequest={activeBenchmark.pr}
            files={activeBenchmark.files}
            reviewVerdict={activeBenchmark.codeReview}
            userStory={activeBenchmark.userStory}
            onPostComment={handlePostComment}
          />
        </div>
      )}

      {activeTab === 'qa' && (
        <QaTestResultsView
          testRuns={BENCHMARK_PRS.map((b) => b.testRun)}
          activePrNumber={selectedPrNumber}
          onSelectSandboxRun={(sbxId) => {
            setSelectedSandboxId(sbxId);
            setActiveTab('sandbox');
          }}
        />
      )}

      {activeTab === 'sandbox' && <SandboxExecutionAudit selectedSandboxId={selectedSandboxId} />}
    </div>
  );
}
