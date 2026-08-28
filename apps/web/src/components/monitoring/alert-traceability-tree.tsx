'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  GitPullRequest,
  Layers,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Bot,
  UserCheck,
} from 'lucide-react';
import { IncidentEntity } from '@ironloom/shared';

interface AlertTraceabilityTreeProps {
  activeIncident: IncidentEntity | null;
  onRemediate?: (incidentId: string) => void;
  isRemediating?: boolean;
}

export function AlertTraceabilityTree({
  activeIncident,
  onRemediate,
  isRemediating = false,
}: AlertTraceabilityTreeProps) {
  // If no active incident is passed, use an illustrative sample trace showing the entire closed loop
  const incident = activeIncident || {
    id: 'inc-sample-1',
    projectId: '00000000-0000-0000-0000-000000000002',
    title: 'HTTP 500 Error Spike in /api/v1/auth/login',
    summary: 'Error rate spiked to 6.2%, breaching 1.0% threshold SLA.',
    severity: 'critical',
    status: 'investigating',
    source: 'monitoring',
    linkedTaskId: 'task-hotfix-101',
    linkedUserStoryId: 'story-hotfix-202',
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  };

  const steps = [
    {
      title: '1. Telemetry Alert',
      agent: 'Monitoring Agent',
      desc: 'Anomaly detected: HTTP 500 rate > 5.0%',
      icon: AlertTriangle,
      status: 'completed',
      color: 'text-red-400 border-red-500/30 bg-red-500/10',
    },
    {
      title: '2. Incident Record',
      agent: 'SRE System',
      desc: incident.title,
      icon: ShieldAlert,
      status: 'completed',
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    },
    {
      title: '3. Remediation Task',
      agent: 'Product Manager Agent',
      desc: 'Hotfix user story & acceptance criteria generated',
      icon: Bot,
      status: incident.status === 'open' ? 'pending' : 'completed',
      color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    },
    {
      title: '4. Code Hotfix & PR',
      agent: 'Developer & Reviewer Agent',
      desc: 'PR created: hotfix/auth-error-spike-patch',
      icon: GitPullRequest,
      status: incident.status === 'resolved' ? 'completed' : 'in_progress',
      color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    },
    {
      title: '5. Staging Smoke Test',
      agent: 'QA & DevOps Agent',
      desc: 'Smoke tests run in isolated sandbox (0 errors)',
      icon: ShieldCheck,
      status: incident.status === 'resolved' ? 'completed' : 'pending',
      color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
    },
    {
      title: '6. Production Deploy',
      agent: 'DevOps Agent + Human Gate',
      desc: 'Zero-downtime hotfix rollout deployed',
      icon: Rocket,
      status: incident.status === 'resolved' ? 'completed' : 'pending',
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    },
  ];

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">
              Closed-Loop Self-Healing Traceability Lineage
            </CardTitle>
          </div>
          {incident.status !== 'resolved' && onRemediate && (
            <Button
              size="sm"
              onClick={() => onRemediate(incident.id)}
              disabled={isRemediating}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isRemediating ? 'Running Self-Healing Loop...' : 'Trigger Self-Healing Loop'}
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">
          Visual lineage tracing from telemetry anomaly detection to code hotfix, QA verification,
          and production rollout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Horizontal Stepper */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex flex-col justify-between space-y-2 relative transition-all ${
                  step.status === 'completed'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : step.status === 'in_progress'
                      ? 'border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/30'
                      : 'border-border/40 bg-card/40 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {step.title}
                  </span>
                  <div className={`p-1.5 rounded-md border ${step.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-foreground leading-tight">
                    {step.agent}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{step.desc}</p>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-border/40">
                  <Badge
                    variant="outline"
                    className={`text-[9px] uppercase ${
                      step.status === 'completed'
                        ? 'text-emerald-400 border-emerald-500/30'
                        : step.status === 'in_progress'
                          ? 'text-amber-400 border-amber-500/30 animate-pulse'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {step.status}
                  </Badge>
                  {idx < steps.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground hidden lg:block" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
