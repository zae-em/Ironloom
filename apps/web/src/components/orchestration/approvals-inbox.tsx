'use client';

import * as React from 'react';
import { ApprovalRequest, WorkflowRun } from '@ironloom/shared';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  FileCode,
  Compass,
  AlertTriangle,
} from 'lucide-react';

interface ApprovalsInboxProps {
  approvals: ApprovalRequest[];
  workflowRun?: WorkflowRun;
  onDecisionSubmitted: () => void;
  activeApprovalModal?: ApprovalRequest | null;
  onCloseModal?: () => void;
}

export function ApprovalsInbox({
  approvals,
  workflowRun,
  onDecisionSubmitted,
  activeApprovalModal,
  onCloseModal,
}: ApprovalsInboxProps) {
  const [selectedApproval, setSelectedApproval] = React.useState<ApprovalRequest | null>(
    activeApprovalModal || null,
  );
  const [decisionType, setDecisionType] = React.useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (activeApprovalModal) {
      setSelectedApproval(activeApprovalModal);
    }
  }, [activeApprovalModal]);

  const handleOpenDecision = (approval: ApprovalRequest, decision: 'approved' | 'rejected') => {
    setSelectedApproval(approval);
    setDecisionType(decision);
    setReviewNotes(decision === 'approved' ? 'Approved by human reviewer' : 'Revisions requested');
  };

  const handleSubmitDecision = async () => {
    if (!selectedApproval) return;

    setIsSubmitting(true);
    try {
      await apiClient.post(`/approvals/${selectedApproval.id}/decide`, {
        decision: decisionType,
        notes: reviewNotes,
      });

      toast.success(
        `Successfully ${decisionType === 'approved' ? 'approved' : 'rejected'} gate ${selectedApproval.nodeName}.`,
      );
      setSelectedApproval(null);
      if (onCloseModal) onCloseModal();
      onDecisionSubmitted();
    } catch (err: any) {
      toast.error(`Failed to submit decision: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const decidedApprovals = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card/40 p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Human Review & Approvals Inbox</span>
              {pendingApprovals.length > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-amber-950">
                  {pendingApprovals.length} Pending
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              Review and approve agent outputs before downstream steps execute.
            </p>
          </div>
        </div>
      </div>

      {/* Pending Approvals List */}
      <div className="space-y-4">
        {pendingApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400/60 mb-2" />
            <span className="text-sm font-semibold text-foreground">
              All Clear! No Pending Reviews
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              The multi-agent swarm is either running or completed.
            </p>
          </div>
        ) : (
          pendingApprovals.map((req) => {
            const payload = req.payloadToReview || {};

            return (
              <div
                key={req.id}
                className="rounded-xl border border-amber-500/50 bg-amber-950/20 p-5 shadow-lg space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-black text-amber-950 uppercase">
                      {req.nodeName.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-amber-200/80 font-mono">
                      Workflow Run: {req.workflowRunId.substring(0, 8)}...
                    </span>
                  </div>
                  <span className="text-xs text-amber-300 font-mono">
                    Requested: {new Date(req.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Structured Payload Preview */}
                <div className="rounded-lg border border-border/80 bg-card p-4 text-xs space-y-2">
                  {payload.type === 'business_case' && payload.businessCase && (
                    <div>
                      <span className="font-bold text-foreground block mb-1">
                        Problem Statement:
                      </span>
                      <p className="text-muted-foreground">
                        {payload.businessCase.problemStatement}
                      </p>
                    </div>
                  )}

                  {payload.type === 'epics' && payload.epics && (
                    <div>
                      <span className="font-bold text-foreground block mb-1">
                        Epics Generated ({payload.epics.length}):
                      </span>
                      <div className="space-y-1">
                        {payload.epics.map((e: any) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between text-muted-foreground"
                          >
                            <span>• {e.title}</span>
                            <span className="font-semibold text-primary font-mono text-[10px]">
                              [{e.sizing}]
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {payload.type === 'architecture_proposal' && payload.architectureProposal && (
                    <div>
                      <span className="font-bold text-foreground block mb-1">
                        Architecture: {payload.architectureProposal.title}
                      </span>
                      <p className="text-muted-foreground line-clamp-2">
                        {payload.architectureProposal.summary}
                      </p>
                    </div>
                  )}

                  {payload.type === 'user_stories' && payload.userStories && (
                    <div>
                      <span className="font-bold text-foreground block mb-1">
                        User Stories ({payload.userStories.length}):
                      </span>
                      <p className="text-muted-foreground">
                        {payload.userStories
                          .slice(0, 3)
                          .map((s: any) => s.title)
                          .join(' • ')}
                        ...
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleOpenDecision(req, 'rejected')}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <XCircle className="h-4 w-4" /> Reject & Request Revisions
                  </button>
                  <button
                    onClick={() => handleOpenDecision(req, 'approved')}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-5 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-400 transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve & Advance
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Decision Feedback Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="flex w-full max-w-lg flex-col rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                {decisionType === 'approved' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span>
                  Confirm {decisionType === 'approved' ? 'Approval' : 'Rejection'} for{' '}
                  <span className="capitalize">{selectedApproval.nodeName.replace(/_/g, ' ')}</span>
                </span>
              </h3>
              <button
                onClick={() => {
                  setSelectedApproval(null);
                  if (onCloseModal) onCloseModal();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                {decisionType === 'approved'
                  ? 'Reviewer Approval Notes (Optional):'
                  : 'Rejection Feedback & Required Changes (Will be injected into agent prompt):'}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={
                  decisionType === 'approved'
                    ? 'Looks solid, proceeding to next agent...'
                    : 'Explain what changes the agent must make...'
                }
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => {
                  setSelectedApproval(null);
                  if (onCloseModal) onCloseModal();
                }}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDecision}
                disabled={isSubmitting}
                className={cn(
                  'rounded-lg px-5 py-2 text-xs font-bold transition-colors',
                  decisionType === 'approved'
                    ? 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                    : 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                )}
              >
                {isSubmitting
                  ? 'Submitting...'
                  : `Submit ${decisionType === 'approved' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
