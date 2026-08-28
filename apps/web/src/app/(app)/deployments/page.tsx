'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { DeploymentPipelineView } from '@/components/devops/deployment-pipeline-view';
import { ApprovalPoliciesView } from '@/components/devops/approval-policies-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Rocket, ShieldCheck, Layers } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { EnvironmentEntity, DeploymentEntity, ApprovalPolicy } from '@ironloom/shared';

export default function DeploymentsPage() {
  const { activeProject, activeOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<'pipeline' | 'policies'>('pipeline');
  const [environments, setEnvironments] = useState<EnvironmentEntity[]>([]);
  const [deployments, setDeployments] = useState<DeploymentEntity[]>([]);
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const projectId = activeProject?.id || '00000000-0000-0000-0000-000000000002';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [envList, depList, polList] = await Promise.all([
        apiClient
          .get<EnvironmentEntity[]>(`/devops/environments?projectId=${projectId}`)
          .catch(() => []),
        apiClient
          .get<DeploymentEntity[]>(`/devops/deployments?projectId=${projectId}`)
          .catch(() => []),
        apiClient.get<ApprovalPolicy[]>('/devops/policies').catch(() => []),
      ]);

      setEnvironments(envList);
      setDeployments(depList);
      setPolicies(polList);
    } catch {
      // Ignored for testing
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handlePromote = async (sourceEnv: 'dev' | 'staging', targetEnv: 'staging' | 'prod') => {
    await apiClient.post(`/devops/projects/${projectId}/promote`, {
      environment: sourceEnv,
      targetEnvironment: targetEnv,
      version: targetEnv === 'prod' ? 'v1.4.0' : 'v1.5.0-rc1',
      notes: `Manual promotion from ${sourceEnv.toUpperCase()} to ${targetEnv.toUpperCase()}`,
    });
    await loadData();
  };

  const handleRollback = async (
    env: 'dev' | 'staging' | 'prod',
    version: string,
    reason: string,
  ) => {
    await apiClient.post(`/devops/projects/${projectId}/rollback`, {
      environment: env,
      targetVersion: version,
      reason,
    });
    await loadData();
  };

  const handleCreatePolicy = async (policyDto: any) => {
    await apiClient.post('/devops/policies', policyDto);
    await loadData();
  };

  const handleTogglePolicy = async (id: string, enabled: boolean) => {
    await apiClient.put(`/devops/policies/${id}`, { enabled });
    await loadData();
  };

  const handleDeletePolicy = async (id: string) => {
    await apiClient.delete(`/devops/policies/${id}`);
    await loadData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              Continuous Delivery & Multi-Environment Deployments
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Phase 5</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage multi-tier environments (Dev → Staging → Production), trigger gated promotions,
            execute instant rollbacks, and manage auto-approval policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs border-border gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Environments
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <Button
          variant={activeTab === 'pipeline' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('pipeline')}
          className="text-xs gap-1.5"
        >
          <Layers className="h-3.5 w-3.5" />
          Promotion Pipeline & Environments
        </Button>
        <Button
          variant={activeTab === 'policies' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('policies')}
          className="text-xs gap-1.5"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Approval Policies ({policies.length})
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'pipeline' ? (
        <DeploymentPipelineView
          environments={environments}
          deployments={deployments}
          onPromote={handlePromote}
          onRollback={handleRollback}
          isLoading={isLoading}
        />
      ) : (
        <ApprovalPoliciesView
          policies={policies}
          onCreatePolicy={handleCreatePolicy}
          onTogglePolicy={handleTogglePolicy}
          onDeletePolicy={handleDeletePolicy}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
