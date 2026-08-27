'use client';

import * as React from 'react';
import { WorkflowNodeName, WorkflowRun, ApprovalRequest } from '@ironloom/shared';
import { cn } from '../../lib/utils';
import { getSupabase } from '../../lib/supabase';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  FileCode,
  Compass,
  Cpu,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Send,
  Zap,
} from 'lucide-react';

interface WorkflowGraphProps {
  workflowRun: WorkflowRun;
  approvals: ApprovalRequest[];
  onSelectNode: (nodeName: WorkflowNodeName) => void;
  selectedNode?: WorkflowNodeName | null;
  onOpenApprovalModal?: (approval: ApprovalRequest) => void;
}

interface NodeMeta {
  id: WorkflowNodeName;
  label: string;
  role: string;
  type: 'start' | 'agent' | 'gate' | 'mcp' | 'end';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const GRAPH_NODES: NodeMeta[] = [
  {
    id: 'start',
    label: 'Start Trigger',
    role: 'System',
    type: 'start',
    icon: Play,
    description: 'Raw idea ingestion',
  },
  {
    id: 'ba_node',
    label: 'Business Analyst',
    role: 'BA Agent',
    type: 'agent',
    icon: Sparkles,
    description: 'Formulates structured business case',
  },
  {
    id: 'gate_business_case',
    label: 'Gate: Business Case',
    role: 'Human Review',
    type: 'gate',
    icon: ShieldCheck,
    description: 'Approve or reject problem & goals',
  },
  {
    id: 'pm_node',
    label: 'Product Manager',
    role: 'PM Agent',
    type: 'agent',
    icon: Layers,
    description: 'Breaks down business case into epics',
  },
  {
    id: 'gate_epics',
    label: 'Gate: Epics Backlog',
    role: 'Human Review',
    type: 'gate',
    icon: ShieldCheck,
    description: 'Approve or reject prioritized epics',
  },
  {
    id: 'requirements_node',
    label: 'Requirements Engineer',
    role: 'RE Agent',
    type: 'agent',
    icon: FileCode,
    description: 'Synthesizes user stories & Gherkin',
  },
  {
    id: 'gate_requirements',
    label: 'Gate: User Stories',
    role: 'Human Review',
    type: 'gate',
    icon: ShieldCheck,
    description: 'Approve or reject acceptance criteria',
  },
  {
    id: 'architect_node',
    label: 'System Architect',
    role: 'Architect Agent',
    type: 'agent',
    icon: Compass,
    description: 'Synthesizes system architecture blueprint',
  },
  {
    id: 'gate_architecture',
    label: 'Gate: Architecture',
    role: 'Human Review',
    type: 'gate',
    icon: ShieldCheck,
    description: 'Approve or reject system design',
  },
  {
    id: 'mcp_sync_node',
    label: 'MCP External Sync',
    role: 'Tool Dispatcher',
    type: 'mcp',
    icon: Send,
    description: 'Syncs GitHub, Jira & notifies Slack',
  },
  {
    id: 'dev_stub_node',
    label: 'Developer Agent',
    role: 'Dev Agent (P7)',
    type: 'agent',
    icon: Cpu,
    description: 'Code implementation placeholder',
  },
  {
    id: 'qa_stub_node',
    label: 'QA Engineer Agent',
    role: 'QA Agent (P9)',
    type: 'agent',
    icon: ShieldCheck,
    description: 'Test execution placeholder',
  },
  {
    id: 'completed',
    label: 'Swarm Completed',
    role: 'System',
    type: 'end',
    icon: CheckCircle2,
    description: 'Artifacts generated and synced',
  },
];

export function WorkflowGraph({
  workflowRun,
  approvals,
  onSelectNode,
  selectedNode,
  onOpenApprovalModal,
}: WorkflowGraphProps) {
  const [liveRun, setLiveRun] = React.useState<WorkflowRun>(workflowRun);

  React.useEffect(() => {
    setLiveRun(workflowRun);
  }, [workflowRun]);

  // Realtime Supabase Subscription on workflow_runs
  React.useEffect(() => {
    try {
      const supabase = getSupabase();
      const channel = supabase
        .channel(`workflow_run_${liveRun.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'workflow_runs',
            filter: `id=eq.${liveRun.id}`,
          },
          (payload: any) => {
            if (payload.new) {
              setLiveRun((prev) => ({
                ...prev,
                currentNode:
                  payload.new.current_node || payload.new.currentNode || prev.currentNode,
                status: payload.new.status || prev.status,
                statePayload:
                  payload.new.state_payload || payload.new.statePayload || prev.statePayload,
                updatedAt: payload.new.updated_at || new Date().toISOString(),
              }));
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {}
  }, [liveRun.id]);

  const historyNodeNames = React.useMemo(() => {
    const history = liveRun.statePayload?.history || [];
    return new Set(history.map((h) => h.node));
  }, [liveRun.statePayload]);

  const getNodeState = (nodeId: WorkflowNodeName) => {
    if (liveRun.currentNode === nodeId) {
      if (liveRun.status === 'paused_approval') return 'paused_approval';
      if (liveRun.status === 'paused_manual') return 'paused_manual';
      if (liveRun.status === 'completed') return 'completed';
      if (liveRun.status === 'failed') return 'failed';
      return 'running';
    }
    if (historyNodeNames.has(nodeId)) {
      return 'completed';
    }
    return 'idle';
  };

  const isRejectedLoopback = Boolean(
    liveRun.statePayload?.rejectedAtNode && liveRun.statePayload?.reviewerNotes,
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5 backdrop-blur-md">
      {/* Graph Header / Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>{liveRun.name}</span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
                  liveRun.status === 'running' && 'bg-blue-500/20 text-blue-400 animate-pulse',
                  liveRun.status === 'paused_approval' &&
                    'bg-amber-500/20 text-amber-400 border border-amber-500/40',
                  liveRun.status === 'paused_manual' && 'bg-zinc-500/20 text-zinc-300',
                  liveRun.status === 'completed' &&
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
                  liveRun.status === 'failed' && 'bg-destructive/20 text-destructive',
                )}
              >
                {liveRun.status.replace('_', ' ')}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Current Node:{' '}
              <span className="font-mono text-foreground font-semibold">{liveRun.currentNode}</span>{' '}
              • Iterations: {liveRun.statePayload?.iterationCount || 0}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span> Running
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span> Approval Gate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40"></span> Idle
          </span>
        </div>
      </div>

      {/* Rejection Loopback Warning Banner if active */}
      {isRejectedLoopback && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-200">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-red-300">Human Reviewer Feedback Loopback Active:</span>
            <p className="mt-0.5 text-red-200/90 italic">
              &quot;{liveRun.statePayload.reviewerNotes}&quot;
            </p>
            <span className="text-[10px] text-red-400 mt-1 block">
              Routing back to {liveRun.currentNode} to regenerate assets incorporating feedback.
            </span>
          </div>
        </div>
      )}

      {/* Visual Graph Layout Grid */}
      <div className="relative overflow-x-auto py-6 px-2">
        <div className="flex items-center gap-2 min-w-[1280px]">
          {GRAPH_NODES.map((node, idx) => {
            const state = getNodeState(node.id);
            const isSelected = selectedNode === node.id;
            const Icon = node.icon;
            const isGate = node.type === 'gate';
            const isMcp = node.type === 'mcp';
            const pendingApproval = approvals.find(
              (a) => a.nodeName === node.id && a.status === 'pending',
            );

            return (
              <React.Fragment key={node.id}>
                {/* Node Card */}
                <div
                  onClick={() => onSelectNode(node.id)}
                  className={cn(
                    'relative flex flex-col justify-between w-48 min-h-[110px] p-3 rounded-xl border transition-all cursor-pointer select-none',
                    // Background & Border States
                    state === 'completed' &&
                      'bg-emerald-950/20 border-emerald-500/40 text-foreground hover:border-emerald-400',
                    state === 'running' &&
                      'bg-blue-950/30 border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30',
                    state === 'paused_approval' &&
                      'bg-amber-950/30 border-amber-500 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/50 animate-pulse',
                    state === 'paused_manual' && 'bg-zinc-900/50 border-zinc-500 text-zinc-300',
                    state === 'failed' && 'bg-red-950/30 border-red-500 text-destructive',
                    state === 'idle' &&
                      'bg-muted/20 border-border text-muted-foreground opacity-60 hover:opacity-100 hover:border-border/80',
                    isSelected && 'ring-2 ring-primary border-primary shadow-lg',
                  )}
                >
                  {/* Top: Role & Type Badge */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                        isGate
                          ? 'bg-amber-500/20 text-amber-300'
                          : isMcp
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-primary/15 text-primary',
                      )}
                    >
                      {node.role}
                    </span>

                    {/* Status Dot */}
                    {state === 'completed' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {state === 'running' && (
                      <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                    )}
                    {state === 'paused_approval' && <Clock className="h-4 w-4 text-amber-400" />}
                    {state === 'failed' && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>

                  {/* Middle: Node Title */}
                  <div className="flex items-center gap-2 my-1">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-card border border-border/60">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-foreground leading-tight line-clamp-1">
                      {node.label}
                    </span>
                  </div>

                  {/* Bottom: Description or Action */}
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate text-[10px]">{node.description}</span>
                    {pendingApproval && onOpenApprovalModal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenApprovalModal(pendingApproval);
                        }}
                        className="ml-1 shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 hover:bg-amber-400 transition-colors"
                      >
                        Decide
                      </button>
                    )}
                  </div>
                </div>

                {/* Connector Arrow */}
                {idx < GRAPH_NODES.length - 1 && (
                  <div className="flex items-center justify-center px-1 text-muted-foreground/50">
                    <div
                      className={cn(
                        'h-0.5 w-4 transition-colors',
                        state === 'completed' ? 'bg-emerald-500/60' : 'bg-border',
                      )}
                    />
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rotate-45 border-t-2 border-r-2 transition-colors -ml-1',
                        state === 'completed' ? 'border-emerald-500/60' : 'border-border',
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
