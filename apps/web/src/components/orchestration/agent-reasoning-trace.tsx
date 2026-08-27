'use client';

import * as React from 'react';
import { WorkflowRun, WorkflowNodeName, WorkflowDecision } from '@ironloom/shared';
import { cn } from '../../lib/utils';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import {
  BrainCircuit,
  Pause,
  Play,
  RotateCcw,
  Edit3,
  FastForward,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode,
  Send,
  Database,
} from 'lucide-react';

interface AgentReasoningTraceProps {
  workflowRun: WorkflowRun;
  onRefreshRun: () => void;
}

export function AgentReasoningTrace({ workflowRun, onRefreshRun }: AgentReasoningTraceProps) {
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({});
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editJsonState, setEditJsonState] = React.useState('');
  const [editReason, setEditReason] = React.useState('');
  const [isActionLoading, setIsActionLoading] = React.useState(false);

  const state = workflowRun.statePayload || ({} as any);
  const history = state.history || [];

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handlePause = async () => {
    setIsActionLoading(true);
    try {
      await apiClient.post(`/workflows/${workflowRun.id}/pause`);
      toast.success('Workflow paused successfully.');
      onRefreshRun();
    } catch (err: any) {
      toast.error(`Failed to pause workflow: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    setIsActionLoading(true);
    try {
      await apiClient.post(`/workflows/${workflowRun.id}/resume`);
      toast.success('Workflow resumed successfully.');
      onRefreshRun();
    } catch (err: any) {
      toast.error(`Failed to resume workflow: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOverrideNode = async (targetNode: WorkflowNodeName) => {
    const reason = window.prompt(
      `Enter reason for manually skipping/routing to node '${targetNode}':`,
    );
    if (!reason) return;

    setIsActionLoading(true);
    try {
      await apiClient.post(`/workflows/${workflowRun.id}/override-node`, {
        targetNode,
        reason,
      });
      toast.success(`Workflow overridden to ${targetNode}.`);
      onRefreshRun();
    } catch (err: any) {
      toast.error(`Failed to override node: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const openEditModal = () => {
    setEditJsonState(JSON.stringify(state, null, 2));
    setEditReason('Admin manual state patch');
    setIsEditModalOpen(true);
  };

  const handleSaveEditedState = async () => {
    setIsActionLoading(true);
    try {
      const parsedState = JSON.parse(editJsonState);
      await apiClient.post(`/workflows/${workflowRun.id}/edit-state`, {
        statePayload: parsedState,
        reason: editReason || 'Manual state modification',
      });
      toast.success('Workflow state updated successfully.');
      setIsEditModalOpen(false);
      onRefreshRun();
    } catch (err: any) {
      toast.error(`Failed to update state: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card/40 p-5 backdrop-blur-md">
      {/* Top Header & Admin Intervention Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Agent Swarm Reasoning & Execution Trace
            </h3>
            <p className="text-xs text-muted-foreground">
              Cognitive trail of agents, decisions, RAG context, and MCP tool interactions.
            </p>
          </div>
        </div>

        {/* Admin Intervention Controls */}
        <div className="flex items-center gap-2">
          {workflowRun.status === 'running' && (
            <button
              onClick={handlePause}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          )}

          {(workflowRun.status === 'paused_manual' || workflowRun.status === 'running') && (
            <button
              onClick={handleResume}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </button>
          )}

          <button
            onClick={openEditModal}
            disabled={isActionLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit State (JSON)
          </button>
        </div>
      </div>

      {/* Reasoning Trail List */}
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No reasoning trace history recorded yet.
          </div>
        ) : (
          history.map((item: any, idx: number) => {
            const isExpanded = Boolean(expandedNodes[item.node + idx]);
            const isCurrent = workflowRun.currentNode === item.node;

            return (
              <div
                key={idx}
                className={cn(
                  'rounded-xl border transition-all',
                  isCurrent
                    ? 'border-primary/50 bg-primary/5 shadow-sm'
                    : 'border-border/60 bg-card/60',
                )}
              >
                <div
                  onClick={() => toggleExpand(item.node + idx)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-card border border-border text-primary font-mono text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground capitalize">
                        {item.node.replace(/_/g, ' ')}
                      </span>
                      <p className="text-xs text-muted-foreground font-medium">{item.summary}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/40 p-4 space-y-3 bg-muted/10 text-xs">
                    {item.outputSnippet && (
                      <div>
                        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                          Output Snippet:
                        </span>
                        <div className="bg-card p-3 rounded-lg border border-border/60 font-mono text-xs text-foreground/90 whitespace-pre-wrap">
                          {item.outputSnippet}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                      <span className="text-muted-foreground">Admin Actions for this step:</span>
                      <button
                        onClick={() => handleOverrideNode(item.node)}
                        className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-accent transition-colors"
                      >
                        <FastForward className="h-3 w-3" /> Re-run from this node
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit State JSON Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="flex w-full max-w-2xl flex-col rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-primary" /> Admin Manual Workflow State Override
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Reason for State Patch:
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Describe reason for intervention..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Workflow State Payload (JSON):
              </label>
              <textarea
                value={editJsonState}
                onChange={(e) => setEditJsonState(e.target.value)}
                rows={14}
                className="w-full rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedState}
                disabled={isActionLoading}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                Save & Patch State
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
