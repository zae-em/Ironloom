'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  Cpu,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Activity,
  Layers,
  Lock,
} from 'lucide-react';

export interface SandboxExecutionRecord {
  id: string;
  command: string;
  exitCode: number;
  durationMs: number;
  memoryQuotaMb: number;
  cpuQuota: number;
  networkPolicy: 'none' | 'registry_only' | 'full';
  timedOut: boolean;
  oomKilled: boolean;
  networkViolations: string[];
  stdoutSnippet: string;
  stderrSnippet: string;
  executedAt: string;
}

interface SandboxExecutionAuditProps {
  executions?: SandboxExecutionRecord[];
  selectedSandboxId?: string | null;
}

const MOCK_EXECUTIONS: SandboxExecutionRecord[] = [
  {
    id: 'sbx-9842a1b',
    command: 'npm run test && npm run build',
    exitCode: 0,
    durationMs: 3420,
    memoryQuotaMb: 512,
    cpuQuota: 1.0,
    networkPolicy: 'none',
    timedOut: false,
    oomKilled: false,
    networkViolations: [],
    stdoutSnippet:
      'PASS test/services/payment.spec.ts (100% assertions met)\nBuild completed successfully.',
    stderrSnippet: '',
    executedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'sbx-7719f4e',
    command: 'eslint src/**/*.ts',
    exitCode: 0,
    durationMs: 820,
    memoryQuotaMb: 512,
    cpuQuota: 1.0,
    networkPolicy: 'none',
    timedOut: false,
    oomKilled: false,
    networkViolations: [],
    stdoutSnippet: '0 errors, 0 warnings. Static analysis cleanly passed.',
    stderrSnippet: '',
    executedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'sbx-3312c9d',
    command: 'curl -s https://api.github.com/zen',
    exitCode: 1,
    durationMs: 120,
    memoryQuotaMb: 512,
    cpuQuota: 1.0,
    networkPolicy: 'none',
    timedOut: false,
    oomKilled: false,
    networkViolations: ['BLOCKED egress attempt to api.github.com:443 (networkPolicy: none)'],
    stdoutSnippet: '',
    stderrSnippet: '[Sandbox Firewall] Network egress blocked by strict zero-trust sandbox policy.',
    executedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
];

export function SandboxExecutionAudit({
  executions = MOCK_EXECUTIONS,
  selectedSandboxId,
}: SandboxExecutionAuditProps) {
  const [activeExecId, setActiveExecId] = React.useState<string>(
    selectedSandboxId || executions[0]?.id || '',
  );

  React.useEffect(() => {
    if (selectedSandboxId) {
      setActiveExecId(selectedSandboxId);
    }
  }, [selectedSandboxId]);

  const activeExecution = React.useMemo(() => {
    return executions.find((e) => e.id === activeExecId) || executions[0];
  }, [executions, activeExecId]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-md">
      {/* Top Header: Security Isolation Guarantee Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Zero-Trust Sandbox Execution Audit Log</span>
              <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300">
                <Lock className="h-3 w-3" /> Egress Isolated
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time audit telemetry tracking resource limits, timeouts, and network firewall
              policies
            </p>
          </div>
        </div>
      </div>

      {/* Grid: List of Executions & Detail Pane */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Column: Executions List */}
        <div className="md:col-span-1 flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-2.5 max-h-[480px] overflow-y-auto">
          <span className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Recent Sandbox Tasks ({executions.length})
          </span>
          {executions.map((exec) => {
            const isSelected = exec.id === activeExecId;
            const hasViolations =
              exec.networkViolations.length > 0 || exec.oomKilled || exec.timedOut;

            return (
              <button
                key={exec.id}
                onClick={() => setActiveExecId(exec.id)}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg border p-2.5 text-left transition-all',
                  isSelected
                    ? 'border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/30'
                    : 'border-border bg-card hover:bg-muted/40',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-foreground">{exec.id}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.2 text-[9px] font-bold uppercase',
                      exec.exitCode === 0 && !hasViolations
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-destructive/20 text-destructive',
                    )}
                  >
                    {exec.exitCode === 0 && !hasViolations ? 'PASSED' : 'ENFORCED'}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground truncate">
                  $ {exec.command}
                </p>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{exec.durationMs}ms</span>
                  <span>{exec.memoryQuotaMb}MB Limit</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Execution Telemetry Detail */}
        {activeExecution && (
          <div className="md:col-span-2 flex flex-col gap-3 rounded-lg border border-border bg-card/80 p-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div>
                <span className="text-xs font-bold text-foreground font-mono">
                  Execution ID: {activeExecution.id}
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">
                  Command: $ {activeExecution.command}
                </span>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                  activeExecution.exitCode === 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-destructive/20 text-destructive border border-destructive/30',
                )}
              >
                Exit Code: {activeExecution.exitCode}
              </span>
            </div>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <span className="text-[10px] text-muted-foreground block">Duration</span>
                <span className="font-mono font-bold text-foreground">
                  {activeExecution.durationMs}ms
                </span>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <span className="text-[10px] text-muted-foreground block">Memory Quota</span>
                <span className="font-mono font-bold text-foreground">
                  {activeExecution.memoryQuotaMb} MB
                </span>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <span className="text-[10px] text-muted-foreground block">CPU Quota</span>
                <span className="font-mono font-bold text-foreground">
                  {activeExecution.cpuQuota} Core
                </span>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <span className="text-[10px] text-muted-foreground block">Network Policy</span>
                <span className="font-mono font-bold text-foreground uppercase">
                  {activeExecution.networkPolicy}
                </span>
              </div>
            </div>

            {/* Enforcement Events Alert */}
            {activeExecution.networkViolations.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-red-300">Security Enforcement Triggered:</span>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px] text-red-200">
                    {activeExecution.networkViolations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Stdout / Stderr Terminal */}
            <div className="flex flex-col rounded-lg border border-border bg-zinc-950 overflow-hidden font-mono text-xs">
              <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-zinc-300">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <span>Captured Sandbox Output</span>
              </div>
              <div className="p-3 text-zinc-200 space-y-1 max-h-[180px] overflow-y-auto">
                {activeExecution.stdoutSnippet && (
                  <div className="text-emerald-400 whitespace-pre-wrap">
                    {activeExecution.stdoutSnippet}
                  </div>
                )}
                {activeExecution.stderrSnippet && (
                  <div className="text-red-400 whitespace-pre-wrap">
                    {activeExecution.stderrSnippet}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
