'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkflowRun, ApprovalRequest, WorkflowNodeName } from '@ironloom/shared';
import { apiClient } from '../../../../lib/api-client';
import { cn } from '../../../../lib/utils';
import { WorkflowGraph } from '../../../../components/orchestration/workflow-graph';
import { NodeDetailDrawer } from '../../../../components/orchestration/node-detail-drawer';
import { AgentReasoningTrace } from '../../../../components/orchestration/agent-reasoning-trace';
import { ExecutionEventLog } from '../../../../components/orchestration/execution-event-log';
import { ApprovalsInbox } from '../../../../components/orchestration/approvals-inbox';
import { GitBranch, BrainCircuit, Activity, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';

type TabType = 'graph' | 'trace' | 'events' | 'approvals';

export default function WorkflowDetailPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState<TabType>('graph');
  const [selectedNode, setSelectedNode] = React.useState<WorkflowNodeName | null>(null);
  const [activeApprovalModal, setActiveApprovalModal] = React.useState<ApprovalRequest | null>(
    null,
  );

  const activeProjectId =
    typeof window !== 'undefined'
      ? localStorage.getItem('ironloom_active_project') || '11111111-1111-1111-1111-111111111111'
      : '11111111-1111-1111-1111-111111111111';

  // Fetch Workflow Run
  const {
    data: workflowRun,
    isLoading: isRunLoading,
    refetch: refetchRun,
  } = useQuery<WorkflowRun>({
    queryKey: ['workflow', workflowId],
    queryFn: () => apiClient.get(`/workflows/${workflowId}`),
    refetchInterval: 3000,
  });

  // Fetch Approvals for project
  const { data: approvals = [], refetch: refetchApprovals } = useQuery<ApprovalRequest[]>({
    queryKey: ['approvals', activeProjectId],
    queryFn: () => apiClient.get(`/projects/${activeProjectId}/approvals`),
    refetchInterval: 3000,
  });

  const handleRefresh = () => {
    refetchRun();
    refetchApprovals();
  };

  if (isRunLoading || !workflowRun) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
        <span className="text-xs text-muted-foreground">Loading workflow execution state...</span>
      </div>
    );
  }

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb & Workflow Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-4">
          <a
            href="/workflows"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <span>{workflowRun.name}</span>
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Run ID: {workflowRun.id} • Created: {new Date(workflowRun.startedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card/60 p-1 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('graph')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
              activeTab === 'graph'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <GitBranch className="h-3.5 w-3.5" /> Workflow Graph
          </button>
          <button
            onClick={() => setActiveTab('trace')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
              activeTab === 'trace'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BrainCircuit className="h-3.5 w-3.5" /> Reasoning Trace
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
              activeTab === 'events'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Activity className="h-3.5 w-3.5" /> Live Event Log
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
              activeTab === 'approvals'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Approvals
            {pendingApprovalsCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-black text-amber-950">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="space-y-6">
        {activeTab === 'graph' && (
          <div className="space-y-6">
            <WorkflowGraph
              workflowRun={workflowRun}
              approvals={approvals}
              onSelectNode={(node) => setSelectedNode(node)}
              selectedNode={selectedNode}
              onOpenApprovalModal={(approval) => {
                setActiveApprovalModal(approval);
                setActiveTab('approvals');
              }}
            />

            <ApprovalsInbox
              approvals={approvals}
              workflowRun={workflowRun}
              onDecisionSubmitted={handleRefresh}
            />
          </div>
        )}

        {activeTab === 'trace' && (
          <AgentReasoningTrace workflowRun={workflowRun} onRefreshRun={handleRefresh} />
        )}

        {activeTab === 'events' && (
          <ExecutionEventLog workflowRun={workflowRun} approvals={approvals} />
        )}

        {activeTab === 'approvals' && (
          <ApprovalsInbox
            approvals={approvals}
            workflowRun={workflowRun}
            onDecisionSubmitted={handleRefresh}
            activeApprovalModal={activeApprovalModal}
            onCloseModal={() => setActiveApprovalModal(null)}
          />
        )}
      </div>

      {/* Slide-over Node Detail Inspector */}
      {selectedNode && (
        <NodeDetailDrawer
          nodeName={selectedNode}
          workflowRun={workflowRun}
          approvals={approvals}
          onClose={() => setSelectedNode(null)}
          onOpenApprovalModal={(approval) => {
            setSelectedNode(null);
            setActiveApprovalModal(approval);
            setActiveTab('approvals');
          }}
        />
      )}
    </div>
  );
}
