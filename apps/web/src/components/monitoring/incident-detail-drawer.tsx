'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  ShieldAlert,
  Sparkles,
  Layers,
  Terminal,
} from 'lucide-react';
import { IncidentEntity } from '@ironloom/shared';

interface IncidentDetailDrawerProps {
  incidents: IncidentEntity[];
  onSelectIncident: (incident: IncidentEntity) => void;
  selectedIncident: IncidentEntity | null;
  onRemediate: (incidentId: string) => void;
  isRemediating?: boolean;
}

export function IncidentDetailDrawer({
  incidents,
  onSelectIncident,
  selectedIncident,
  onRemediate,
  isRemediating = false,
}: IncidentDetailDrawerProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Incidents List (Left 1 Col) */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              Active & Historic Incidents
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {incidents.length} Records
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Detected automatically via Prometheus anomaly rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[480px] overflow-y-auto">
          {incidents.length > 0 ? (
            incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className={`p-3 rounded-lg border cursor-pointer transition-all space-y-1.5 ${
                  selectedIncident?.id === inc.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border/60 bg-accent/10 hover:bg-accent/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge
                    className={
                      inc.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px]'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]'
                    }
                  >
                    {inc.severity.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(inc.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs font-semibold text-foreground line-clamp-1">
                  {inc.title}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{inc.summary}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
                  <Badge variant="outline" className="text-[9px]">
                    Status: {inc.status}
                  </Badge>
                  <span>•</span>
                  <span>Source: {inc.source}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Zero incidents recorded. Trigger the Chaos Simulator above to test self-healing!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Incident Detail Drawer (Right 2 Cols) */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              SRE Incident Telemetry & Diagnostic Report
            </CardTitle>
            {selectedIncident && selectedIncident.status !== 'resolved' && (
              <Button
                size="sm"
                onClick={() => onRemediate(selectedIncident.id)}
                disabled={isRemediating}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isRemediating ? 'Remediating...' : 'Spawn Hotfix Workflow'}
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            Automated root-cause analysis and diagnostic telemetry snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedIncident ? (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-lg bg-accent/20 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">{selectedIncident.title}</h4>
                  <Badge
                    className={
                      selectedIncident.status === 'resolved'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }
                  >
                    STATUS: {selectedIncident.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{selectedIncident.summary}</p>
              </div>

              {/* Diagnostic Metrics Snapshot */}
              {selectedIncident.metricsSnapshot && (
                <div className="p-3 rounded-lg bg-black/40 border border-border/50 space-y-2 font-mono">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Captured Telemetry State
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Error Rate:</span>
                      <span className="font-bold text-red-400">
                        {selectedIncident.metricsSnapshot.errorRatePercent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">P95 Latency:</span>
                      <span className="font-bold text-amber-400">
                        {selectedIncident.metricsSnapshot.latencyP95Ms}ms
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">CPU Load:</span>
                      <span className="font-bold text-blue-400">
                        {selectedIncident.metricsSnapshot.cpuUsagePercent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Memory RSS:</span>
                      <span className="font-bold text-purple-400">
                        {selectedIncident.metricsSnapshot.memoryUsagePercent}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-foreground">Incident Timeline</span>
                <div className="border-l-2 border-primary/40 pl-4 space-y-3 font-mono text-[11px]">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">
                      {new Date(selectedIncident.createdAt).toLocaleTimeString()}
                    </span>
                    <p className="text-foreground">
                      Anomaly threshold breached. Incident created by Monitoring Agent.
                    </p>
                  </div>
                  {selectedIncident.status === 'resolved' && selectedIncident.resolvedAt && (
                    <div className="space-y-0.5 text-emerald-400">
                      <span>{new Date(selectedIncident.resolvedAt).toLocaleTimeString()}</span>
                      <p>Remediation hotfix deployment verified. Incident closed.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-muted-foreground">
              Select an incident from the left list to view diagnostic logs and telemetry details.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
