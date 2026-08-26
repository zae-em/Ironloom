'use client';

import React from 'react';
import {
  History,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Cpu,
  Coins,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface AuditLogItem {
  id: string;
  actor_id: string;
  action: string;
  model: string | null;
  provider: string | null;
  cost_usd: number;
  latency_ms: number;
  status: string;
  created_at: string;
}

interface AgentAuditTableProps {
  logs: AuditLogItem[];
  isLoading?: boolean;
}

export function AgentAuditTable({ logs, isLoading = false }: AgentAuditTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'fallback_success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {status === 'fallback_success' ? 'Fallback Success' : 'Success'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-2.5 h-2.5" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Agent Execution & Cost Audit Trail
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {logs.length} logged runs
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Timestamp</th>
              <th className="py-2.5 px-4 font-semibold">Agent Actor</th>
              <th className="py-2.5 px-4 font-semibold">Action</th>
              <th className="py-2.5 px-4 font-semibold">Model / Provider</th>
              <th className="py-2.5 px-4 font-semibold">Latency</th>
              <th className="py-2.5 px-4 font-semibold">Cost</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">
                  Loading agent execution history...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">
                  No agent invocations recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors font-mono text-[11px]">
                  <td className="py-2.5 px-4 text-slate-400">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-4 text-indigo-300 font-semibold">
                    {log.actor_id}
                  </td>
                  <td className="py-2.5 px-4 text-slate-200">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 text-[10px]">
                      {log.model || 'default'} ({log.provider || 'auto'})
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">
                    {log.latency_ms} ms
                  </td>
                  <td className="py-2.5 px-4 text-emerald-400 font-semibold">
                    ${Number(log.cost_usd || 0).toFixed(5)}
                  </td>
                  <td className="py-2.5 px-4">
                    {getStatusBadge(log.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
