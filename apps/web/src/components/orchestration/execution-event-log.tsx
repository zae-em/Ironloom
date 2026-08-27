'use client';

import * as React from 'react';
import { WorkflowRun, ApprovalRequest } from '@ironloom/shared';
import { cn } from '../../lib/utils';
import {
  ListFilter,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface ExecutionEventLogProps {
  workflowRun: WorkflowRun;
  approvals: ApprovalRequest[];
}

type EventFilterType = 'all' | 'nodes' | 'approvals' | 'mcp';

interface TimelineEvent {
  id: string;
  type: 'node' | 'approval' | 'mcp' | 'system';
  title: string;
  description: string;
  status: 'success' | 'warning' | 'danger' | 'info';
  timestamp: string;
  rawPayload?: any;
}

export function ExecutionEventLog({ workflowRun, approvals }: ExecutionEventLogProps) {
  const [filter, setFilter] = React.useState<EventFilterType>('all');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const state = workflowRun.statePayload || ({} as any);

  // Compile timeline events from history, approvals, and MCP tool calls
  const events: TimelineEvent[] = React.useMemo(() => {
    const list: TimelineEvent[] = [];

    // 1. History Node Transitions
    for (const h of state.history || []) {
      list.push({
        id: `hist_${h.node}_${h.timestamp}`,
        type: 'node',
        title: `Node Transition: ${h.node}`,
        description: h.summary || 'Node executed.',
        status: h.summary?.toLowerCase().includes('reject')
          ? 'danger'
          : h.summary?.toLowerCase().includes('approve')
            ? 'success'
            : 'info',
        timestamp: h.timestamp,
        rawPayload: h,
      });
    }

    // 2. Approvals
    for (const a of approvals || []) {
      list.push({
        id: `app_${a.id}`,
        type: 'approval',
        title: `Approval Request: ${a.nodeName}`,
        description:
          a.status === 'pending'
            ? 'Waiting for human review decision.'
            : `Decision: ${a.status.toUpperCase()} ${a.notes ? `• Notes: "${a.notes}"` : ''}`,
        status:
          a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'warning',
        timestamp: a.decidedAt || a.createdAt,
        rawPayload: a,
      });
    }

    // 3. MCP Tool Calls
    for (const m of state.mcpToolCalls || []) {
      list.push({
        id: `mcp_${m.id}`,
        type: 'mcp',
        title: `MCP Action: ${m.toolName}`,
        description: `Server: ${m.serverType.toUpperCase()} • Latency: ${m.latencyMs}ms • Status: ${m.status}`,
        status: m.status === 'success' ? 'success' : 'danger',
        timestamp: m.timestamp,
        rawPayload: m,
      });
    }

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.history, state.mcpToolCalls, approvals]);

  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'nodes') return e.type === 'node';
    if (filter === 'approvals') return e.type === 'approval';
    if (filter === 'mcp') return e.type === 'mcp';
    return true;
  });

  const copyEventJson = (event: TimelineEvent) => {
    navigator.clipboard.writeText(JSON.stringify(event.rawPayload, null, 2));
    setCopiedId(event.id);
    toast.success('Event JSON copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5 backdrop-blur-md">
      {/* Event Log Header & Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Live Orchestration Event Log
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time audit trail of state transitions, human reviews, and MCP connectors.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1 text-xs">
          {(['all', 'nodes', 'approvals', 'mcp'] as EventFilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors',
                filter === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Events Timeline */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No events match the selected filter.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3.5 text-xs transition-all hover:border-border"
            >
              {/* Event Type Icon */}
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5',
                  evt.status === 'success' && 'bg-emerald-500/15 text-emerald-400',
                  evt.status === 'warning' && 'bg-amber-500/15 text-amber-400',
                  evt.status === 'danger' && 'bg-destructive/15 text-destructive',
                  evt.status === 'info' && 'bg-blue-500/15 text-blue-400',
                )}
              >
                {evt.type === 'mcp' ? (
                  <Send className="h-3.5 w-3.5" />
                ) : evt.type === 'approval' ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : evt.status === 'success' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Event Content */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{evt.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">{evt.description}</p>
              </div>

              {/* Copy JSON Button */}
              {evt.rawPayload && (
                <button
                  onClick={() => copyEventJson(evt)}
                  title="Copy event payload JSON"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {copiedId === evt.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
