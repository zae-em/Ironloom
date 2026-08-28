'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  Flame,
  Radio,
  Zap,
  Gauge,
  Cpu,
  HardDrive,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { MetricTelemetrySnapshot } from '@ironloom/shared';

interface LiveTelemetryChartsProps {
  telemetry: MetricTelemetrySnapshot | null;
  selectedEnvironment: 'dev' | 'staging' | 'prod';
  onEnvironmentChange: (env: 'dev' | 'staging' | 'prod') => void;
  onSimulateAnomaly: (type: 'error_spike' | 'latency_spike' | 'memory_leak') => void;
  isSimulating?: boolean;
}

export function LiveTelemetryCharts({
  telemetry,
  selectedEnvironment,
  onEnvironmentChange,
  onSimulateAnomaly,
  isSimulating = false,
}: LiveTelemetryChartsProps) {
  // Sparkline history for simulated live tick visualization
  const [history, setHistory] = useState<MetricTelemetrySnapshot[]>([]);

  useEffect(() => {
    if (telemetry) {
      setHistory((prev) => {
        const next = [...prev, telemetry];
        return next.slice(-20); // Keep last 20 data points
      });
    }
  }, [telemetry]);

  const currentSnapshot = telemetry || {
    timestamp: new Date().toISOString(),
    cpuUsagePercent: 38.5,
    memoryUsagePercent: 52.4,
    errorRatePercent: 0.04,
    latencyP95Ms: 48,
    requestCount: 14250,
    activeInstances: 3,
  };

  const getMetricColor = (type: 'error' | 'latency' | 'cpu' | 'memory', val: number) => {
    switch (type) {
      case 'error':
        return val > 1.0 ? 'text-red-400' : 'text-emerald-400';
      case 'latency':
        return val > 300 ? 'text-red-400' : val > 150 ? 'text-amber-400' : 'text-emerald-400';
      case 'cpu':
        return val > 80 ? 'text-red-400' : val > 65 ? 'text-amber-400' : 'text-blue-400';
      case 'memory':
        return val > 85 ? 'text-red-400' : val > 70 ? 'text-amber-400' : 'text-purple-400';
    }
  };

  // Helper to render SVG time-series sparkline
  const renderSparkline = (
    data: number[],
    strokeColor: string,
    fillColor: string,
    min = 0,
    max = 100,
  ) => {
    if (data.length < 2) return null;
    const width = 280;
    const height = 48;
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const normalizedY = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
      const y = height - normalizedY * (height - 8) - 4;
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(' L ')}`;
    const areaData = `${pathData} L ${width},${height} L 0comma${height} Z`.replace('0comma', '0,');

    return (
      <svg className="w-full h-12 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <path d={areaData} fill={fillColor} opacity={0.2} />
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Environment Selector Strip & Anomaly Simulator Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5 text-emerald-400 animate-pulse" />
          <div>
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Telemetry Feed Active</span>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                Prometheus / Vector
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Sampling continuous performance metrics at 3-second intervals.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold uppercase">Cluster:</span>
          {(['dev', 'staging', 'prod'] as const).map((env) => (
            <Button
              key={env}
              size="sm"
              variant={selectedEnvironment === env ? 'default' : 'outline'}
              onClick={() => onEnvironmentChange(env)}
              className={`text-xs uppercase font-mono px-3 py-1 ${
                selectedEnvironment === env && env === 'prod'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : ''
              }`}
            >
              {env}
            </Button>
          ))}
        </div>
      </div>

      {/* 4 Live Metric Chart Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Error Rate */}
        <Card className="border-border/80 bg-card/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              HTTP Error Rate (5xx)
            </span>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-3xl font-black font-mono ${getMetricColor(
                'error',
                currentSnapshot.errorRatePercent,
              )}`}
            >
              {currentSnapshot.errorRatePercent.toFixed(2)}%
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">SLA: &lt;1.0%</span>
          </div>
          <div className="pt-2">
            {renderSparkline(
              history.map((h) => h.errorRatePercent),
              '#ef4444',
              '#ef4444',
              0,
              5,
            )}
          </div>
        </Card>

        {/* Metric 2: P95 Latency */}
        <Card className="border-border/80 bg-card/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              P95 Request Latency
            </span>
            <Activity className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-3xl font-black font-mono ${getMetricColor(
                'latency',
                currentSnapshot.latencyP95Ms,
              )}`}
            >
              {currentSnapshot.latencyP95Ms}
              <span className="text-sm font-sans font-normal text-muted-foreground">ms</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">SLA: &lt;250ms</span>
          </div>
          <div className="pt-2">
            {renderSparkline(
              history.map((h) => h.latencyP95Ms),
              '#f59e0b',
              '#f59e0b',
              0,
              1000,
            )}
          </div>
        </Card>

        {/* Metric 3: CPU Usage */}
        <Card className="border-border/80 bg-card/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Cluster CPU Load
            </span>
            <Cpu className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-3xl font-black font-mono ${getMetricColor(
                'cpu',
                currentSnapshot.cpuUsagePercent,
              )}`}
            >
              {currentSnapshot.cpuUsagePercent.toFixed(1)}%
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {currentSnapshot.activeInstances} Nodes
            </span>
          </div>
          <div className="pt-2">
            {renderSparkline(
              history.map((h) => h.cpuUsagePercent),
              '#3b82f6',
              '#3b82f6',
              0,
              100,
            )}
          </div>
        </Card>

        {/* Metric 4: Memory Usage */}
        <Card className="border-border/80 bg-card/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Container Memory RSS
            </span>
            <HardDrive className="h-4 w-4 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-3xl font-black font-mono ${getMetricColor(
                'memory',
                currentSnapshot.memoryUsagePercent,
              )}`}
            >
              {currentSnapshot.memoryUsagePercent.toFixed(1)}%
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Limit: 85%</span>
          </div>
          <div className="pt-2">
            {renderSparkline(
              history.map((h) => h.memoryUsagePercent),
              '#a855f7',
              '#a855f7',
              0,
              100,
            )}
          </div>
        </Card>
      </div>

      {/* Interactive Anomaly Simulator Bar */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <Flame className="h-4 w-4" />
            Chaos & Anomaly Injection Simulator
          </div>
          <p className="text-xs text-muted-foreground">
            Trigger simulated telemetry degradation to observe SRE Monitoring Agent detection,
            automated incident logging, and self-healing hotfix orchestration.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSimulateAnomaly('error_spike')}
            disabled={isSimulating}
            className="text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
          >
            Spike Errors (6.5%)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSimulateAnomaly('latency_spike')}
            disabled={isSimulating}
            className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          >
            Latency Spike (850ms)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSimulateAnomaly('memory_leak')}
            disabled={isSimulating}
            className="text-xs border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
          >
            Memory Leak (92%)
          </Button>
        </div>
      </div>
    </div>
  );
}
