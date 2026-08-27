'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkflowRun, StartWorkflowDto } from '@ironloom/shared';
import { apiClient } from '../../../lib/api-client';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import {
  GitBranch,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  ArrowRight,
  Zap,
  Layers,
} from 'lucide-react';

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [isStartModalOpen, setIsStartModalOpen] = React.useState(false);
  const [workflowName, setWorkflowName] = React.useState('Autonomous SDLC Pipeline Run');
  const [rawIdea, setRawIdea] = React.useState('');

  const activeProjectId =
    typeof window !== 'undefined'
      ? localStorage.getItem('ironloom_active_project') || '11111111-1111-1111-1111-111111111111'
      : '11111111-1111-1111-1111-111111111111';

  const {
    data: workflowRuns = [],
    isLoading,
    refetch,
  } = useQuery<WorkflowRun[]>({
    queryKey: ['workflows', activeProjectId],
    queryFn: () => apiClient.get(`/projects/${activeProjectId}/workflows`),
    refetchInterval: 4000,
  });

  const startMutation = useMutation({
    mutationFn: (dto: StartWorkflowDto) =>
      apiClient.post(`/projects/${activeProjectId}/workflows/start`, dto),
    onSuccess: (newRun: any) => {
      toast.success('Autonomous Multi-Agent Workflow initiated!');
      setIsStartModalOpen(false);
      setRawIdea('');
      queryClient.invalidateQueries({ queryKey: ['workflows', activeProjectId] });
      if (newRun?.id) {
        window.location.href = `/workflows/${newRun.id}`;
      }
    },
    onError: (err: any) => {
      toast.error(`Failed to start workflow: ${err.message}`);
    },
  });

  const handleStartWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawIdea.trim()) {
      toast.error('Please provide an initial idea prompt.');
      return;
    }
    startMutation.mutate({
      name: workflowName || 'Autonomous SDLC Pipeline Run',
      rawIdea: rawIdea.trim(),
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <GitBranch className="h-7 w-7 text-primary" />
            <span>Autonomous Agent Workflows</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orchestrate BA, PM, Requirements, and Architect swarms with human-in-the-loop approval
            gates.
          </p>
        </div>

        <button
          onClick={() => setIsStartModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Start New Autonomous Workflow
        </button>
      </div>

      {/* Workflow Runs List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground tracking-tight">
            Workflow Runs ({workflowRuns.length})
          </h2>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
            <span className="text-xs text-muted-foreground">Loading workflow runs...</span>
          </div>
        ) : workflowRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/20 p-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-bold text-foreground">No Workflows Launched Yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Submit a raw product idea to trigger the autonomous multi-agent SDLC swarm.
            </p>
            <button
              onClick={() => setIsStartModalOpen(true)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Start First Workflow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {workflowRuns.map((run) => (
              <a
                key={run.id}
                href={`/workflows/${run.id}`}
                className="group flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-xl border border-border bg-card/60 p-5 shadow-sm hover:border-primary/50 hover:bg-card/90 transition-all backdrop-blur-md"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs',
                      run.status === 'running' && 'bg-blue-500/20 text-blue-400 animate-pulse',
                      run.status === 'paused_approval' &&
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30',
                      run.status === 'completed' && 'bg-emerald-500/20 text-emerald-400',
                      run.status === 'failed' && 'bg-red-500/20 text-red-400',
                    )}
                  >
                    {run.status === 'running' ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : run.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : run.status === 'paused_approval' ? (
                      <Clock className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                      <span>{run.name}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          run.status === 'running' && 'bg-blue-500/10 text-blue-400',
                          run.status === 'paused_approval' && 'bg-amber-500/10 text-amber-400',
                          run.status === 'completed' && 'bg-emerald-500/10 text-emerald-400',
                          run.status === 'failed' && 'bg-red-500/10 text-red-400',
                        )}
                      >
                        {run.status.replace('_', ' ')}
                      </span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      Current Stage:{' '}
                      <span className="font-mono text-foreground font-semibold">
                        {run.currentNode}
                      </span>{' '}
                      • Started: {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Open Workflow View <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Start New Workflow Modal */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleStartWorkflow}
            className="flex w-full max-w-xl flex-col rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" /> Start Autonomous SDLC Swarm
              </h3>
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Workflow Run Name:
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. NextGen Microservices Telemetry Engine"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Raw Idea / Product Vision Prompt:
              </label>
              <textarea
                value={rawIdea}
                onChange={(e) => setRawIdea(e.target.value)}
                rows={5}
                required
                className="w-full rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Describe your product idea in plain English (e.g. Build an automated multi-tenant IoT fleet management system with sub-second alert streaming...)"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={startMutation.isPending}
                className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
              >
                {startMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Launching Swarm...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Launch Swarm Pipeline
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
