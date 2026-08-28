'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { LiveTelemetryCharts } from '@/components/monitoring/live-telemetry-charts';
import { AlertTraceabilityTree } from '@/components/monitoring/alert-traceability-tree';
import { IncidentDetailDrawer } from '@/components/monitoring/incident-detail-drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw, Radio } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { MetricTelemetrySnapshot, IncidentEntity } from '@ironloom/shared';

export default function MonitoringPage() {
  const { activeProject } = useAuth();
  const [selectedEnvironment, setSelectedEnvironment] = useState<'dev' | 'staging' | 'prod'>(
    'prod',
  );
  const [telemetry, setTelemetry] = useState<MetricTelemetrySnapshot | null>(null);
  const [incidents, setIncidents] = useState<IncidentEntity[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentEntity | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isRemediating, setIsRemediating] = useState(false);

  const projectId = activeProject?.id || '00000000-0000-0000-0000-000000000002';

  const fetchTelemetry = async () => {
    try {
      const snap = await apiClient.get<MetricTelemetrySnapshot>(
        `/devops/telemetry?projectId=${projectId}&environment=${selectedEnvironment}`,
      );
      setTelemetry(snap);
    } catch {
      // Ignored for testing
    }
  };

  const fetchIncidents = async () => {
    try {
      const list = await apiClient.get<IncidentEntity[]>(
        `/devops/incidents?projectId=${projectId}`,
      );
      setIncidents(list);
      if (list.length > 0 && !selectedIncident) {
        setSelectedIncident(list[0]);
      }
    } catch {
      // Ignored for testing
    }
  };

  useEffect(() => {
    fetchTelemetry();
    fetchIncidents();

    // 3-second live telemetry polling loop
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [projectId, selectedEnvironment]);

  const handleSimulateAnomaly = async (type: 'error_spike' | 'latency_spike' | 'memory_leak') => {
    setIsSimulating(true);
    try {
      let title = 'Simulated Error Spike Anomaly';
      let summary = 'HTTP 500 error rate breached 6.2%';
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'high';
      let errorRate = 6.2;
      let latency = 65;
      let memory = 50.0;

      if (type === 'latency_spike') {
        title = 'Simulated P95 Latency SLA Breach';
        summary = 'P95 latency spiked to 850ms';
        severity = 'high';
        errorRate = 0.05;
        latency = 850;
      } else if (type === 'memory_leak') {
        title = 'Simulated Memory Leak Anomaly';
        summary = 'Container RSS memory breached 92%';
        severity = 'critical';
        memory = 92.0;
      }

      const created = await apiClient.post<IncidentEntity>('/devops/incidents', {
        projectId,
        title,
        summary,
        environment: selectedEnvironment,
        severity,
        source: 'monitoring',
        telemetrySnapshot: {
          timestamp: new Date().toISOString(),
          cpuUsagePercent: 55.0,
          memoryUsagePercent: memory,
          errorRatePercent: errorRate,
          latencyP95Ms: latency,
          requestCount: 15400,
          activeInstances: 3,
        },
      });

      await fetchIncidents();
      setSelectedIncident(created);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRemediateIncident = async (incidentId: string) => {
    setIsRemediating(true);
    try {
      await apiClient.post(`/devops/incidents/${incidentId}/remediate`, {});
      await fetchIncidents();
    } finally {
      setIsRemediating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-emerald-400" />
              SRE Live Monitoring & Telemetry Observability
            </h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1">
              <Radio className="h-3 w-3 animate-pulse" />
              Realtime 3s Poll
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Prometheus metric dashboards, explainable anomaly detection rules, and closed-loop
            self-healing hotfix orchestration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchTelemetry();
              fetchIncidents();
            }}
            className="text-xs border-border gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Live Metric Charts & Anomaly Simulator */}
      <LiveTelemetryCharts
        telemetry={telemetry}
        selectedEnvironment={selectedEnvironment}
        onEnvironmentChange={setSelectedEnvironment}
        onSimulateAnomaly={handleSimulateAnomaly}
        isSimulating={isSimulating}
      />

      {/* Closed-Loop Lineage Visualizer */}
      <AlertTraceabilityTree
        activeIncident={selectedIncident}
        onRemediate={handleRemediateIncident}
        isRemediating={isRemediating}
      />

      {/* Incidents List & Diagnostic Drawer */}
      <IncidentDetailDrawer
        incidents={incidents}
        selectedIncident={selectedIncident}
        onSelectIncident={setSelectedIncident}
        onRemediate={handleRemediateIncident}
        isRemediating={isRemediating}
      />
    </div>
  );
}
