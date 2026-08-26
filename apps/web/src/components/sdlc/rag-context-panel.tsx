'use client';

import React, { useState } from 'react';
import { Database, ChevronDown, ChevronUp, FileText, CheckCircle2, Shield } from 'lucide-react';

interface RAGContextPanelProps {
  retrievedCount?: number;
  sources?: Array<{
    documentType?: string;
    documentId?: string;
    similarity?: number;
    snippet?: string;
  }>;
  className?: string;
}

export function RAGContextPanel({
  retrievedCount = 2,
  sources = [
    {
      documentType: 'business_case',
      documentId: 'bc-prior-sample',
      similarity: 0.884,
      snippet: 'High-reliability latency tolerance constraints and drone telemetry standards.',
    },
    {
      documentType: 'architecture_proposal',
      documentId: 'arch-prior-sample',
      similarity: 0.812,
      snippet: 'Microservice event-driven bus architecture for telemetry ingest and health alerts.',
    },
  ],
  className = '',
}: RAGContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Database className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-300">
            RAG Semantic Context ({retrievedCount} knowledge items injected)
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Shield className="w-2.5 h-2.5 mr-1" />
            pgvector verified
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>{isExpanded ? 'Hide context' : 'Inspect sources'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-2.5 text-xs">
          <p className="text-slate-400 text-[11px]">
            The agent retrieved the following past approved knowledge artifacts via cosine
            similarity search prior to generation:
          </p>

          <div className="space-y-2">
            {sources.map((src, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-1.5 font-medium">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="capitalize font-mono text-[11px]">
                      {src.documentType?.replace('_', ' ') || 'Document'}
                    </span>
                  </div>
                  {src.similarity && (
                    <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      similarity: {(src.similarity * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800/60 font-mono">
                  "{src.snippet}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
