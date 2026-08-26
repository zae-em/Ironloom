'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  X,
  ArrowUp,
  ArrowDown,
  FileText,
  Bookmark,
  CheckSquare,
  Sparkles,
  GitCommit,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface TraceabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  storyId?: string | null;
  businessCaseId?: string | null;
}

export function TraceabilityDrawer({
  isOpen,
  onClose,
  storyId,
  businessCaseId,
}: TraceabilityDrawerProps) {
  const [activeTab, setActiveTab] = useState<'upstream' | 'downstream'>(
    storyId ? 'upstream' : 'downstream',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [upstreamData, setUpstreamData] = useState<any>(null);
  const [downstreamData, setDownstreamData] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (storyId) {
      fetchUpstreamTrace(storyId);
    } else if (businessCaseId) {
      fetchDownstreamTrace(businessCaseId);
    }
  }, [isOpen, storyId, businessCaseId]);

  const fetchUpstreamTrace = async (id: string) => {
    setIsLoading(true);
    setActiveTab('upstream');
    try {
      const data = await apiClient.get<any>(`/sdlc/traceability/story/${id}`);
      setUpstreamData(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load upstream lineage');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDownstreamTrace = async (id: string) => {
    setIsLoading(true);
    setActiveTab('downstream');
    try {
      const data = await apiClient.get<any>(`/sdlc/traceability/business-case/${id}`);
      setDownstreamData(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load downstream lineage');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Bi-Directional Traceability Lineage
              </h3>
              <p className="text-xs text-slate-400">
                Verifiable origin & downstream requirement propagation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
          <Button
            size="sm"
            variant={activeTab === 'upstream' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('upstream');
              if (storyId) fetchUpstreamTrace(storyId);
            }}
            className={`text-xs h-8 ${
              activeTab === 'upstream'
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5 mr-1.5" /> Upstream Lineage (Story → Idea)
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'downstream' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('downstream');
              if (businessCaseId || upstreamData?.businessCase?.id) {
                fetchDownstreamTrace(businessCaseId || upstreamData.businessCase.id);
              }
            }}
            className={`text-xs h-8 ${
              activeTab === 'downstream'
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5 mr-1.5" /> Downstream Tree (Idea → Architecture)
          </Button>
        </div>

        {/* Body Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">Traversing relational graph nodes...</span>
            </div>
          ) : activeTab === 'upstream' && upstreamData ? (
            <div className="space-y-6">
              <div className="relative pl-6 border-l-2 border-indigo-500/40 space-y-6">
                {/* Node 1: Current Story */}
                <div className="relative group">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-purple-500 border-2 border-slate-900" />
                  <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">
                        Origin Node: User Story
                      </span>
                      <Badge className="bg-purple-500/10 text-purple-300 text-[10px]">
                        {upstreamData.story.status}
                      </Badge>
                    </div>
                    <h4 className="text-sm font-bold text-white">{upstreamData.story.title}</h4>
                    <p className="text-xs text-slate-300">
                      As a <span className="text-purple-300 font-medium">{upstreamData.story.asA}</span>, I want{' '}
                      <span className="text-purple-300 font-medium">{upstreamData.story.iWant}</span> so that{' '}
                      <span className="text-purple-300 font-medium">{upstreamData.story.soThat}</span>
                    </p>
                  </div>
                </div>

                {/* Node 2: Parent Epic */}
                <div className="relative group">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-slate-900" />
                  <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-blue-400 font-bold uppercase">
                        Parent Node: Epic
                      </span>
                      <span className="text-[10px] font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded">
                        {upstreamData.epic.sizing} • {upstreamData.epic.priority}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{upstreamData.epic.title}</h4>
                    <p className="text-xs text-slate-400">{upstreamData.epic.description}</p>
                  </div>
                </div>

                {/* Node 3: Business Case */}
                <div className="relative group">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-indigo-500 border-2 border-slate-900" />
                  <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">
                        Root Scope: Business Case v{upstreamData.businessCase.version}
                      </span>
                      <Badge className="bg-indigo-500/10 text-indigo-300 text-[10px]">
                        {upstreamData.businessCase.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400 font-semibold">Problem: </span>
                      {upstreamData.businessCase.problemStatement}
                    </div>
                  </div>
                </div>

                {/* Node 4: Raw Idea Origin */}
                <div className="relative group">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900" />
                  <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 to-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Initial Raw Idea Prompt
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-mono italic leading-relaxed">
                      "{upstreamData.businessCase.rawIdea}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'downstream' && downstreamData ? (
            <div className="space-y-6">
              {/* Root Business Case */}
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">
                    Root: Business Case
                  </span>
                  <Badge className="bg-emerald-500/10 text-emerald-400 text-[10px]">
                    {downstreamData.businessCase.status}
                  </Badge>
                </div>
                <h4 className="text-sm font-bold text-white">
                  {downstreamData.businessCase.problemStatement}
                </h4>
              </div>

              {/* Epics & Stories Tree */}
              <div className="space-y-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Downstream Epics & Generated Stories ({downstreamData.epics?.length || 0})
                </span>

                {(downstreamData.epics || []).map((epic: any, idx: number) => (
                  <div key={epic.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-blue-400 font-bold">EPIC-{idx + 1}</span>
                        <h5 className="text-xs font-bold text-slate-200">{epic.title}</h5>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{epic.sizing}</span>
                    </div>

                    <div className="pl-3 border-l border-slate-800 space-y-2">
                      {(epic.userStories || []).map((story: any, sIdx: number) => (
                        <div key={story.id} className="p-2.5 rounded bg-slate-900 text-xs text-slate-300 flex items-center justify-between">
                          <span className="truncate pr-2">US-{idx + 1}.{sIdx + 1}: {story.title}</span>
                          <Badge className="bg-slate-800 text-[10px] text-slate-400">
                            {story.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Architecture Proposals */}
              {downstreamData.architectureProposals && downstreamData.architectureProposals.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 block flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" /> Synthesized Architecture Proposals ({downstreamData.architectureProposals.length})
                  </span>

                  {downstreamData.architectureProposals.map((prop: any) => (
                    <div key={prop.id} className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-200">
                          Architecture Proposal v{prop.version}: {prop.title}
                        </span>
                        <Badge className="bg-purple-500/10 text-purple-300 text-[10px]">
                          {prop.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">{prop.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              No lineage data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
