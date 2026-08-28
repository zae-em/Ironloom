'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { ApprovalPolicy } from '@ironloom/shared';

interface ApprovalPoliciesViewProps {
  policies: ApprovalPolicy[];
  onCreatePolicy: (policy: any) => Promise<void>;
  onTogglePolicy: (id: string, enabled: boolean) => Promise<void>;
  onDeletePolicy: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function ApprovalPoliciesView({
  policies,
  onCreatePolicy,
  onTogglePolicy,
  onDeletePolicy,
  isLoading = false,
}: ApprovalPoliciesViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [actionType, setActionType] = useState<ApprovalPolicy['actionType']>('staging_promote');
  const [environmentPattern, setEnvironmentPattern] = useState('staging');
  const [autoApproveSmoke, setAutoApproveSmoke] = useState(true);
  const [autoApproveProdIncidents, setAutoApproveProdIncidents] = useState(false);
  const [maxErrorRate, setMaxErrorRate] = useState(1.0);
  const [maxLatency, setMaxLatency] = useState(300);

  const handleSubmitNewPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onCreatePolicy({
      name,
      description,
      actionType,
      environmentPattern,
      ruleDefinition: {
        autoApproveStagingIfSmokePassed: autoApproveSmoke,
        autoApproveProdIfNoActiveIncidents: autoApproveProdIncidents,
        maxErrorRateThresholdPercent: maxErrorRate,
        maxLatencyThresholdMs: maxLatency,
      },
      enabled: true,
    });

    setIsCreating(false);
    setName('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Configurable Auto-Approval Policies
          </h3>
          <p className="text-xs text-muted-foreground">
            Define plain-English gate criteria for automated promotion vs mandatory human sign-off.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreating(!isCreating)}
          className="bg-primary hover:bg-primary/90 text-xs gap-1.5 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          {isCreating ? 'Cancel' : 'Create Policy Rule'}
        </Button>
      </div>

      {/* New Policy Form Drawer */}
      {isCreating && (
        <Card className="border-primary/40 bg-card/90 shadow-xl animate-in slide-in-from-top duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Define New Autonomous Gate Policy
            </CardTitle>
            <CardDescription className="text-xs">
              Rules are evaluated at each workflow promotion gate before pausing for human approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitNewPolicy} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Policy Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Staging Smoke Test Auto-Approval"
                    className="w-full px-3 py-2 rounded-md bg-accent/40 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Target Environment Pattern
                  </label>
                  <input
                    type="text"
                    value={environmentPattern}
                    onChange={(e) => setEnvironmentPattern(e.target.value)}
                    placeholder="staging or prod or *"
                    className="w-full px-3 py-2 rounded-md bg-accent/40 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Description / Human Intent
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain why this rule applies and what risks it balances..."
                  className="w-full px-3 py-2 rounded-md bg-accent/40 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Thresholds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-accent/20 border border-border/50">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-foreground font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoApproveSmoke}
                      onChange={(e) => setAutoApproveSmoke(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Auto-approve if smoke tests pass with 0 exit code</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-foreground font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoApproveProdIncidents}
                      onChange={(e) => setAutoApproveProdIncidents(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Auto-approve Production if 0 active incidents exist</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Max Error Rate Threshold:</span>
                    <span className="font-mono font-bold text-foreground">{maxErrorRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={maxErrorRate}
                    onChange={(e) => setMaxErrorRate(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Max P95 Latency SLA:</span>
                    <span className="font-mono font-bold text-foreground">{maxLatency}ms</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="25"
                    value={maxLatency}
                    onChange={(e) => setMaxLatency(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreating(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !name.trim()}
                  className="text-xs bg-primary hover:bg-primary/90"
                >
                  Save Policy Rule
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Policy List Cards */}
      <div className="space-y-3">
        {policies.length > 0 ? (
          policies.map((p) => (
            <Card
              key={p.id}
              className={`border-border/80 bg-card/60 backdrop-blur-sm transition-colors ${
                !p.enabled ? 'opacity-60 bg-card/30' : ''
              }`}
            >
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={
                        p.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30 text-[10px]'
                      }
                    >
                      {p.enabled ? 'ACTIVE POLICY' : 'DISABLED'}
                    </Badge>
                    <span className="font-bold text-sm text-foreground">{p.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Target: {p.environmentPattern || '*'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>

                  <div className="flex items-center gap-3 text-[11px] text-foreground font-mono flex-wrap pt-1">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Smoke Test Gate:{' '}
                      {p.ruleDefinition?.autoApproveStagingIfSmokePassed ? 'Auto' : 'Manual'}
                    </span>
                    <span>•</span>
                    <span>
                      Max Error Rate: {p.ruleDefinition?.maxErrorRateThresholdPercent ?? 1.0}%
                    </span>
                    <span>•</span>
                    <span>Max Latency: {p.ruleDefinition?.maxLatencyThresholdMs ?? 300}ms</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTogglePolicy(p.id, !p.enabled)}
                    className="text-xs gap-1.5"
                  >
                    {p.enabled ? (
                      <>
                        <ToggleRight className="h-4 w-4 text-emerald-400" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        Disabled
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeletePolicy(p.id)}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="p-8 text-center border border-dashed border-border/70 rounded-lg text-xs text-muted-foreground">
            No approval policies configured yet. Click "Create Policy Rule" above to create one.
          </div>
        )}
      </div>
    </div>
  );
}
