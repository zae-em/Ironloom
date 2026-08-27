'use client';

import * as React from 'react';
import { WorkflowNodeName, WorkflowRun, ApprovalRequest } from '@ironloom/shared';
import { cn } from '../../lib/utils';
import {
  X,
  Bot,
  ShieldCheck,
  Send,
  Sparkles,
  ExternalLink,
  Code2,
  Clock,
  DollarSign,
  Cpu,
  Layers,
} from 'lucide-react';

interface NodeDetailDrawerProps {
  nodeName: WorkflowNodeName | null;
  workflowRun: WorkflowRun;
  approvals: ApprovalRequest[];
  onClose: () => void;
  onOpenApprovalModal?: (approval: ApprovalRequest) => void;
}

export function NodeDetailDrawer({
  nodeName,
  workflowRun,
  approvals,
  onClose,
  onOpenApprovalModal,
}: NodeDetailDrawerProps) {
  if (!nodeName) return null;

  const state = workflowRun.statePayload || ({} as any);
  const nodeHistory = state.history?.find((h: any) => h.node === nodeName);
  const pendingApproval = approvals.find((a) => a.nodeName === nodeName);
  const mcpCalls = (state.mcpToolCalls || []).filter((call: any) => {
    if (nodeName === 'mcp_sync_node') return true;
    if (nodeName === 'ba_node' && call.toolName?.includes('slack')) return true;
    return false;
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-card/95 p-6 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-200 overflow-y-auto">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground capitalize">
              {nodeName.replace(/_/g, ' ')}
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              Status: {workflowRun.currentNode === nodeName ? workflowRun.status : 'History Record'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 space-y-6 text-sm">
        {/* Pending Approval Callout */}
        {pendingApproval && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-amber-300">
                <ShieldCheck className="h-4 w-4" /> Human Approval Required
              </span>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 uppercase">
                {pendingApproval.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-amber-200/90">
              This node has completed execution and is paused awaiting human approval or revisions.
            </p>
            {pendingApproval.status === 'pending' && onOpenApprovalModal && (
              <button
                onClick={() => onOpenApprovalModal(pendingApproval)}
                className="mt-3 w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 transition-colors"
              >
                Review & Decide Approval
              </button>
            )}
          </div>
        )}

        {/* Execution Summary / History */}
        {nodeHistory && (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Execution Log
            </h4>
            <p className="text-xs text-foreground font-medium">{nodeHistory.summary}</p>
            {nodeHistory.outputSnippet && (
              <p className="mt-2 text-xs text-muted-foreground bg-card p-2 rounded border border-border/50 font-mono">
                {nodeHistory.outputSnippet}
              </p>
            )}
            <span className="mt-2 block text-[10px] text-muted-foreground">
              Timestamp: {new Date(nodeHistory.timestamp).toLocaleString()}
            </span>
          </div>
        )}

        {/* MCP Tool Calls Section */}
        {mcpCalls.length > 0 && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
              <Send className="h-4 w-4" /> MCP External Tool Executions ({mcpCalls.length})
            </div>

            {mcpCalls.map((call: any, idx: number) => (
              <div
                key={idx}
                className="rounded-lg border border-purple-500/20 bg-card p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-foreground">{call.toolName}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase',
                      call.status === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/20 text-red-300',
                    )}
                  >
                    {call.status}
                  </span>
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Server:{' '}
                  <span className="font-semibold text-foreground uppercase">{call.serverType}</span>{' '}
                  • Latency: {call.latencyMs}ms
                </div>
                <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto text-muted-foreground max-h-32">
                  {JSON.stringify(call.output, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* Node Specific State Payload Previews */}
        {nodeName === 'ba_node' && state.businessCase && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Formulated Business Case
            </h4>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
              <span className="font-bold text-foreground">Problem Statement:</span>
              <p className="text-muted-foreground">{state.businessCase.problemStatement}</p>
              <span className="font-bold text-foreground mt-2 block">Success Metrics:</span>
              <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                {state.businessCase.successMetrics?.map((m: string, i: number) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {nodeName === 'pm_node' && state.epics?.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Synthesized Epics ({state.epics.length})
            </h4>
            <div className="space-y-2">
              {state.epics.map((epic: any) => (
                <div key={epic.id} className="rounded-lg border border-border bg-card p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-foreground">{epic.title}</span>
                    <span className="rounded bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                      {epic.sizing}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px] line-clamp-2">
                    {epic.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {nodeName === 'architect_node' && state.architectureProposal && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Architecture Proposal Blueprint
            </h4>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
              <span className="font-bold text-foreground">{state.architectureProposal.title}</span>
              <p className="text-muted-foreground">{state.architectureProposal.summary}</p>
              <span className="font-bold text-foreground mt-2 block">
                Components ({state.architectureProposal.components?.length || 0}):
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {state.architectureProposal.components?.map((c: any, i: number) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-muted/40 border border-border/40 text-[11px]"
                  >
                    <span className="font-semibold text-foreground block">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">{c.techStack}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
