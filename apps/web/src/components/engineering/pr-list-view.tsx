'use client';

import * as React from 'react';
import { PullRequestEntity, CodeReviewVerdict, TestRunEntity } from '@ironloom/shared';
import { cn } from '../../lib/utils';
import {
  GitPullRequest,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Check,
  X,
  History,
} from 'lucide-react';

interface PrListViewProps {
  pullRequests: PullRequestEntity[];
  activePrNumber?: number | null;
  onSelectPr: (pr: PullRequestEntity) => void;
  onApprovePr?: (prNumber: number, notes?: string) => Promise<void>;
  onRequestChanges?: (prNumber: number, notes: string) => Promise<void>;
  codeReviews?: CodeReviewVerdict[];
  testRuns?: TestRunEntity[];
  qaRetryCount?: number;
  maxQaRetries?: number;
}

export function PrListView({
  pullRequests,
  activePrNumber,
  onSelectPr,
  onApprovePr,
  onRequestChanges,
  codeReviews = [],
  testRuns = [],
  qaRetryCount = 0,
  maxQaRetries = 3,
}: PrListViewProps) {
  const [actionNotes, setActionNotes] = React.useState('');
  const [selectedPrForAction, setSelectedPrForAction] = React.useState<PullRequestEntity | null>(
    null,
  );
  const [actionType, setActionType] = React.useState<'approve' | 'request_changes' | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showRetryHistory, setShowRetryHistory] = React.useState(false);

  const handleDecision = async () => {
    if (!selectedPrForAction || !actionType) return;
    setIsSubmitting(true);
    try {
      if (actionType === 'approve' && onApprovePr) {
        await onApprovePr(selectedPrForAction.prNumber, actionNotes);
      } else if (actionType === 'request_changes' && onRequestChanges) {
        await onRequestChanges(selectedPrForAction.prNumber, actionNotes);
      }
      setSelectedPrForAction(null);
      setActionType(null);
      setActionNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-md">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <GitPullRequest className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Agent-Authored Pull Requests ({pullRequests.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Autonomous git branches created, reviewed, and tested by multi-agent swarm
            </p>
          </div>
        </div>

        {/* Retry Loop Indicator */}
        {qaRetryCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRetryHistory((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/20 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-900/30 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              <span>
                QA Loop: {qaRetryCount} / {maxQaRetries} Retries
              </span>
              {showRetryHistory ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Collapsible QA Failure Retry Loop Details */}
      {showRetryHistory && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
            <span>Autonomous Failure/Retry History</span>
          </div>
          <p className="text-zinc-300">
            When QA tests or static analysis report issues, IRONLOOM automatically loops back to the
            Developer Agent with diagnostics to repair code before requiring human intervention.
          </p>
          <div className="space-y-1.5 pt-1">
            {testRuns.map((run, i) => (
              <div
                key={run.id || i}
                className="flex items-center justify-between rounded bg-zinc-900/80 px-2.5 py-1.5 border border-zinc-800 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  {run.status === 'passed' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className="font-semibold text-foreground">
                    Test Run #{i + 1} for PR #{run.prNumber}
                  </span>
                  <span className="text-muted-foreground">
                    ({run.passedCount} passed, {run.failedCount} failed)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{run.coveragePercent}% coverage</span>
                  <span>•</span>
                  <span>{run.durationMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PR Cards Grid */}
      <div className="space-y-2.5">
        {pullRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            No agent pull requests open yet. Start a workflow to autonomously generate code
            branches.
          </div>
        ) : (
          pullRequests.map((pr) => {
            const isSelected = activePrNumber === pr.prNumber;
            const review = codeReviews.find((r) => r.prNumber === pr.prNumber);
            const latestTest = testRuns.find((t) => t.prNumber === pr.prNumber);

            return (
              <div
                key={pr.id || pr.prNumber}
                onClick={() => onSelectPr(pr)}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border p-3.5 transition-all cursor-pointer',
                  isSelected
                    ? 'border-primary/50 bg-primary/10 shadow-md ring-1 ring-primary/30'
                    : 'border-border bg-card/60 hover:border-border/80 hover:bg-card',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-foreground text-sm">
                      #{pr.prNumber}
                    </span>
                    <span className="font-semibold text-foreground text-sm">{pr.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        pr.status === 'open' &&
                          'bg-blue-500/20 text-blue-300 border border-blue-500/30',
                        pr.status === 'merged' &&
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
                        pr.status === 'closed' && 'bg-zinc-500/20 text-zinc-400',
                      )}
                    >
                      {pr.status}
                    </span>

                    {/* CI Status Badge */}
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        latestTest?.status === 'passed' &&
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
                        latestTest?.status === 'failed' &&
                          'bg-red-500/20 text-red-300 border border-red-500/30',
                        !latestTest && 'bg-zinc-500/20 text-zinc-400',
                      )}
                    >
                      {latestTest?.status === 'passed' ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span>CI Passed ({latestTest.coveragePercent}%)</span>
                        </>
                      ) : latestTest?.status === 'failed' ? (
                        <>
                          <AlertCircle className="h-3 w-3 text-destructive" />
                          <span>CI Failed</span>
                        </>
                      ) : (
                        <span>CI Pending</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Branch & Lineage Info */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-mono text-foreground text-[11px]">
                      <GitBranch className="h-3 w-3 text-primary" />
                      {pr.branchName}
                    </span>
                    <span>•</span>
                    <span>{pr.filesChanged?.length || 1} files changed</span>
                    <span>•</span>
                    <span>
                      Story:{' '}
                      <code className="font-mono text-foreground text-[11px]">
                        {pr.userStoryId?.slice(0, 8) || 'story-01'}
                      </code>
                    </span>
                  </div>

                  {/* Agent Sequence Pipeline */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-medium text-zinc-400">Pipeline:</span>
                    <span className="rounded bg-primary/20 px-1.5 py-0.2 text-primary font-semibold">
                      Dev
                    </span>
                    <span>→</span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.2 font-semibold',
                        review?.verdict === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      Review ({review?.verdict || 'done'})
                    </span>
                    <span>→</span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.2 font-semibold',
                        latestTest?.status === 'passed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      QA ({latestTest?.status || 'done'})
                    </span>
                  </div>
                </div>

                {/* PR Actions Bar */}
                {pr.status === 'open' && (
                  <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-2.5 mt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPrForAction(pr);
                        setActionType('request_changes');
                      }}
                      className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      <span>Request Changes</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPrForAction(pr);
                        setActionType('approve');
                      }}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve PR</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Decision Modal / Card if action selected */}
      {selectedPrForAction && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="flex flex-col gap-3 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h4 className="text-base font-bold text-foreground">
              {actionType === 'approve' ? 'Approve & Merge PR' : 'Request Changes on PR'} #
              {selectedPrForAction.prNumber}
            </h4>
            <p className="text-xs text-muted-foreground">
              {actionType === 'approve'
                ? 'Approving will post the decision to GitHub and advance the autonomous workflow to merge and complete.'
                : 'Requesting changes will loop back to the Developer Agent with your review feedback to author an automatic bugfix.'}
            </p>
            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder={
                actionType === 'approve'
                  ? 'Optional approval notes...'
                  : 'Explain the required changes or bugfix...'
              }
              rows={3}
              className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedPrForAction(null);
                  setActionType(null);
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting || (actionType === 'request_changes' && !actionNotes.trim())}
                onClick={handleDecision}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-colors disabled:opacity-50',
                  actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-destructive hover:bg-destructive/90',
                )}
              >
                {isSubmitting
                  ? 'Submitting...'
                  : actionType === 'approve'
                    ? 'Confirm Approval'
                    : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
