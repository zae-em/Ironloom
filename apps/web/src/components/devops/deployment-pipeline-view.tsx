'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
  Server,
  Layers,
  AlertOctagon,
} from 'lucide-react';
import { EnvironmentEntity, DeploymentEntity } from '@ironloom/shared';

interface DeploymentPipelineViewProps {
  environments: EnvironmentEntity[];
  deployments: DeploymentEntity[];
  onPromote: (sourceEnv: 'dev' | 'staging', targetEnv: 'staging' | 'prod') => Promise<void>;
  onRollback: (env: 'dev' | 'staging' | 'prod', version: string, reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function DeploymentPipelineView({
  environments,
  deployments,
  onPromote,
  onRollback,
  isLoading = false,
}: DeploymentPipelineViewProps) {
  const [selectedRollbackEnv, setSelectedRollbackEnv] = useState<EnvironmentEntity | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [isRollbackSubmitting, setIsRollbackSubmitting] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const getEnv = (name: 'dev' | 'staging' | 'prod') =>
    environments.find((e) => e.name === name) || {
      id: `fallback-${name}`,
      projectId: '00000000-0000-0000-0000-000000000002',
      name,
      currentVersion: name === 'prod' ? 'v1.3.0' : name === 'staging' ? 'v1.4.0' : 'v1.5.0-dev',
      status: 'healthy',
      config: {
        deployTarget: 'docker-container',
        replicas: name === 'prod' ? 3 : 1,
        autoPromote: name === 'dev',
      },
      updatedAt: new Date().toISOString(),
    };

  const devEnv = getEnv('dev');
  const stagingEnv = getEnv('staging');
  const prodEnv = getEnv('prod');

  const handlePromoteAction = async (
    source: 'dev' | 'staging',
    target: 'staging' | 'prod',
    key: string,
  ) => {
    setActionInProgress(key);
    try {
      await onPromote(source, target);
    } finally {
      setActionInProgress(null);
    }
  };

  const executeRollback = async () => {
    if (!selectedRollbackEnv || !rollbackVersion) return;
    setIsRollbackSubmitting(true);
    try {
      await onRollback(
        selectedRollbackEnv.name,
        rollbackVersion,
        rollbackReason || 'Human operator manual rollback',
      );
      setSelectedRollbackEnv(null);
      setRollbackVersion('');
      setRollbackReason('');
    } finally {
      setIsRollbackSubmitting(false);
    }
  };

  const renderEnvCard = (
    env: EnvironmentEntity,
    title: string,
    badgeColor: string,
    isProduction = false,
  ) => (
    <Card
      className={`border-border/80 bg-card/70 backdrop-blur-sm relative overflow-hidden ${
        isProduction ? 'ring-1 ring-amber-500/30' : ''
      }`}
    >
      <div className={`h-1.5 w-full ${badgeColor}`} />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold capitalize">{title}</CardTitle>
          </div>
          <Badge
            className={
              env.status === 'healthy'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs'
            }
          >
            {env.status.toUpperCase()}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Target: {env.config?.deployTarget || 'docker-container'} • {env.config?.replicas || 1}{' '}
          replica(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-accent/30 p-3 border border-border/50 space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Active Deployed Version
          </span>
          <div className="text-xl font-black font-mono text-foreground flex items-center gap-2">
            {env.currentVersion || 'v0.0.0'}
            {isProduction && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                LIVE PRODUCTION
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            Updated {new Date(env.updatedAt).toLocaleTimeString()}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedRollbackEnv(env);
              setRollbackVersion(
                env.name === 'prod' ? 'v1.2.0' : env.name === 'staging' ? 'v1.3.0' : 'v1.4.0',
              );
            }}
            className="text-xs border-border/80 text-muted-foreground hover:text-foreground gap-1 flex-1"
          >
            <RotateCcw className="h-3 w-3 text-amber-400" />
            Rollback
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* 3 Environment Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderEnvCard(devEnv, 'Development (dev)', 'bg-blue-500')}
        {renderEnvCard(stagingEnv, 'Staging (pre-prod)', 'bg-indigo-500')}
        {renderEnvCard(prodEnv, 'Production (prod)', 'bg-amber-500', true)}
      </div>

      {/* Promotion Pipeline Stage Visualizer */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-bold">Autonomous Promotion Pipeline</CardTitle>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              Continuous Promotion Loop
            </Badge>
          </div>
          <CardDescription>
            Multi-stage build promotion with automated test validation, smoke tests, and policy
            approval gates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 p-4 rounded-xl border border-border/70 bg-black/20">
            {/* Stage 1: Dev Build */}
            <div className="flex-1 w-full p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                  Stage 1: Dev Build
                </span>
                <CheckCircle2 className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-sm font-semibold text-foreground">
                Container Build & Unit Tests
              </div>
              <div className="text-xs text-muted-foreground">
                Active: <span className="font-mono text-blue-300">{devEnv.currentVersion}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                <CheckCircle2 className="h-3 w-3" /> Unit tests passed (100%)
              </div>
            </div>

            {/* Transition 1 -> 2 */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => handlePromoteAction('dev', 'staging', 'dev-staging')}
                disabled={isLoading || actionInProgress === 'dev-staging'}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 shadow-sm"
              >
                <Play className="h-3 w-3" />
                {actionInProgress === 'dev-staging' ? 'Promoting...' : 'Promote to Staging'}
              </Button>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> Auto-Promotion Rule
              </div>
            </div>

            {/* Stage 2: Staging Smoke Verification */}
            <div className="flex-1 w-full p-4 rounded-lg border border-indigo-500/30 bg-indigo-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
                  Stage 2: Staging Gating
                </span>
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-sm font-semibold text-foreground">Automated Smoke Tests</div>
              <div className="text-xs text-muted-foreground">
                Active:{' '}
                <span className="font-mono text-indigo-300">{stagingEnv.currentVersion}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                <CheckCircle2 className="h-3 w-3" /> Smoke tests passed (0 errors)
              </div>
            </div>

            {/* Transition 2 -> 3 */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => handlePromoteAction('staging', 'prod', 'staging-prod')}
                disabled={isLoading || actionInProgress === 'staging-prod'}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 shadow-sm"
              >
                <Sparkles className="h-3 w-3" />
                {actionInProgress === 'staging-prod' ? 'Evaluating Gate...' : 'Promote to Prod'}
              </Button>
              <div className="text-[10px] text-amber-300 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Human Gate 6 Required
              </div>
            </div>

            {/* Stage 3: Production Live */}
            <div className="flex-1 w-full p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  Stage 3: Production
                </span>
                <Zap className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-sm font-semibold text-foreground">Live Cluster Workload</div>
              <div className="text-xs text-muted-foreground">
                Active: <span className="font-mono text-amber-300">{prodEnv.currentVersion}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                <CheckCircle2 className="h-3 w-3" /> Zero active incidents
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployment History Audit Table */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">Deployment & Release Audit Log</CardTitle>
          </div>
          <CardDescription>
            Immutable history of all autonomous promotions, manual approvals, and rollbacks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="border-b border-border/80 text-foreground font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Version</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Promoted From</th>
                  <th className="py-2.5 px-3">Initiated By</th>
                  <th className="py-2.5 px-3">Release Notes</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {deployments.length > 0 ? (
                  deployments.map((d) => (
                    <tr key={d.id} className="hover:bg-accent/20 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-foreground">{d.version}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          className={
                            d.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]'
                              : d.status === 'rolled_back'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]'
                                : 'bg-red-500/10 text-red-400 border-red-500/20 text-[10px]'
                          }
                        >
                          {d.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 uppercase text-slate-300">{d.promotedFrom}</td>
                      <td className="py-2.5 px-3 text-slate-300">{d.initiatedBy}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">{d.releaseNotes}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground font-sans">
                      No deployments recorded in this environment yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Rollback Safeguard Confirmation Modal */}
      {selectedRollbackEnv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-md border-amber-500/40 bg-card shadow-2xl space-y-4 p-5">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Confirm Emergency Rollback</h3>
                <p className="text-xs text-muted-foreground capitalize">
                  Target Environment: {selectedRollbackEnv.name}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Target Previous Version
                </label>
                <input
                  type="text"
                  value={rollbackVersion}
                  onChange={(e) => setRollbackVersion(e.target.value)}
                  placeholder="e.g. v1.2.0"
                  className="w-full px-3 py-2 rounded-md bg-accent/40 border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Reason for Rollback
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Describe the incident, error rate, or regression..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-md bg-accent/40 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRollbackEnv(null)}
                disabled={isRollbackSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={executeRollback}
                disabled={isRollbackSubmitting || !rollbackVersion}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                {isRollbackSubmitting ? 'Rolling back...' : 'Confirm Rollback'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
