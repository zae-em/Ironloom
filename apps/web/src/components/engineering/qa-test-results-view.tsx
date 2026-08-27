'use client';

import * as React from 'react';
import { TestRunEntity } from '@ironloom/shared';
import { cn } from '../../lib/utils';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Activity,
  Terminal,
  Cpu,
  Layers,
} from 'lucide-react';

interface QaTestResultsViewProps {
  testRuns: TestRunEntity[];
  activePrNumber?: number | null;
  onSelectSandboxRun?: (sandboxId: string) => void;
}

export function QaTestResultsView({
  testRuns,
  activePrNumber,
  onSelectSandboxRun,
}: QaTestResultsViewProps) {
  const [selectedRunId, setSelectedRunId] = React.useState<string>(testRuns[0]?.id || '');
  const [logSearchQuery, setLogSearchQuery] = React.useState('');
  const [showRawLogs, setShowRawLogs] = React.useState(true);
  const [selectedFailure, setSelectedFailure] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (activePrNumber) {
      const match = testRuns.find((t) => t.prNumber === activePrNumber);
      if (match) setSelectedRunId(match.id);
    } else if (testRuns.length > 0 && !selectedRunId) {
      setSelectedRunId(testRuns[0].id);
    }
  }, [testRuns, activePrNumber, selectedRunId]);

  const activeRun = React.useMemo(() => {
    return testRuns.find((t) => t.id === selectedRunId) || testRuns[0];
  }, [testRuns, selectedRunId]);

  // Filter raw log lines by search query
  const filteredLogLines = React.useMemo(() => {
    if (!activeRun?.rawLog) return [];
    const lines = activeRun.rawLog.split('\n');
    if (!logSearchQuery.trim()) return lines;
    return lines.filter((l) => l.toLowerCase().includes(logSearchQuery.toLowerCase()));
  }, [activeRun, logSearchQuery]);

  // Aggregate stats across all test runs
  const totalPassed = testRuns.reduce((acc, t) => acc + (t.passedCount || 0), 0);
  const totalFailed = testRuns.reduce((acc, t) => acc + (t.failedCount || 0), 0);
  const avgCoverage =
    testRuns.length > 0
      ? (testRuns.reduce((acc, t) => acc + (t.coveragePercent || 0), 0) / testRuns.length).toFixed(
          1,
        )
      : '0.0';

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-md">
      {/* Top Header: Aggregated QA Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Automated QA & Test Execution Suite</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                {testRuns.length} Test Runs
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Autonomous verification synthesizing tests, executing in isolated sandbox, and
              auditing code coverage
            </p>
          </div>
        </div>

        {/* Aggregate KPI Badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="font-bold text-foreground">{totalPassed} Passed</span>
          </div>
          {totalFailed > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="font-bold text-destructive">{totalFailed} Failed</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">{avgCoverage}% Avg Cov</span>
          </div>
        </div>
      </div>

      {/* Coverage Trends Over Time (Visual Bar Chart) */}
      <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary" />
            Coverage Trend Over PR Implementations
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {testRuns.length} data points
          </span>
        </div>

        <div className="flex items-end gap-3 h-24 pt-4 px-2 overflow-x-auto">
          {testRuns.slice(-8).map((run, idx) => {
            const heightPct = Math.max(run.coveragePercent, 15);
            const isSelected = run.id === selectedRunId;

            return (
              <div
                key={run.id || idx}
                onClick={() => setSelectedRunId(run.id)}
                className="flex flex-1 flex-col items-center gap-1 min-w-[50px] cursor-pointer group"
              >
                <span className="text-[10px] font-mono font-bold text-zinc-400 group-hover:text-foreground">
                  {run.coveragePercent}%
                </span>
                <div className="w-full h-14 bg-zinc-800/60 rounded-t flex items-end overflow-hidden">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={cn(
                      'w-full rounded-t transition-all',
                      run.status === 'passed'
                        ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:brightness-125'
                        : 'bg-gradient-to-t from-red-600 to-red-400 group-hover:brightness-125',
                      isSelected && 'ring-2 ring-primary brightness-125',
                    )}
                  />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground truncate w-full text-center">
                  PR #{run.prNumber}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Test Run Detail & Execution Logs */}
      {activeRun ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4">
          {/* Detail Card Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                  activeRun.status === 'passed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-destructive/20 text-destructive border border-destructive/30',
                )}
              >
                {activeRun.status.toUpperCase()}
              </span>
              <span className="font-bold text-foreground text-sm">
                Test Run for PR #{activeRun.prNumber}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span>{activeRun.passedCount} Passed</span>
              <span>•</span>
              <span>{activeRun.failedCount} Failed</span>
              <span>•</span>
              <span>{activeRun.coveragePercent}% Coverage</span>
              <span>•</span>
              <span>{activeRun.durationMs}ms</span>
            </div>
          </div>

          {/* Sandbox Traceability Link */}
          {activeRun.sandboxExecutionId && (
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Cpu className="h-4 w-4 text-primary" />
                <span>Isolated Sandbox ID:</span>
                <code className="font-mono text-foreground font-semibold">
                  {activeRun.sandboxExecutionId}
                </code>
              </div>
              {onSelectSandboxRun && (
                <button
                  onClick={() => onSelectSandboxRun(activeRun.sandboxExecutionId)}
                  className="text-primary hover:underline font-semibold text-[11px]"
                >
                  View Sandbox Audit →
                </button>
              )}
            </div>
          )}

          {/* Searchable Raw Log Terminal */}
          <div className="flex flex-col rounded-lg border border-border bg-zinc-950 overflow-hidden">
            {/* Terminal Header & Search */}
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs">
              <button
                onClick={() => setShowRawLogs((v) => !v)}
                className="flex items-center gap-1.5 font-mono text-zinc-300 font-semibold hover:text-white"
              >
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <span>Sandbox Test Logs ({filteredLogLines.length} lines)</span>
                {showRawLogs ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {showRawLogs && (
                <div className="relative flex items-center w-60">
                  <Search className="absolute left-2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="w-full rounded bg-zinc-800/80 pl-7 pr-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>

            {/* Log Lines Output */}
            {showRawLogs && (
              <div className="max-h-[320px] overflow-y-auto p-3 font-mono text-xs text-zinc-300 space-y-1">
                {filteredLogLines.length === 0 ? (
                  <span className="text-zinc-500 italic">No matching log lines found.</span>
                ) : (
                  filteredLogLines.map((line, i) => {
                    const isPass = line.includes('PASS') || line.includes('passed');
                    const isFail =
                      line.includes('FAIL') || line.includes('failed') || line.includes('Error');

                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex items-start gap-2 whitespace-pre-wrap break-all',
                          isPass && 'text-emerald-400',
                          isFail && 'text-red-400 bg-red-950/20 px-1 rounded',
                        )}
                      >
                        <span className="select-none text-zinc-600 text-[10px] w-6 text-right shrink-0">
                          {i + 1}
                        </span>
                        <span>{line}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No test execution runs recorded yet.
        </div>
      )}
    </div>
  );
}
