'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  CheckSquare,
  Bot,
  Activity,
  Plus,
  ArrowUpRight,
  Cpu,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Coins,
  History,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

export default function DashboardPage() {
  const { activeOrg, activeProject } = useAuth();

  const [businessCases, setBusinessCases] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [architectureProposals, setArchitectureProposals] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const projects = await apiClient.get<any[]>('/projects').catch(() => []);
        const activeProjId =
          projects[0]?.id || activeProject?.id || '00000000-0000-0000-0000-000000000001';

        const [bcList, epicsList, storiesList, archList, logsList] = await Promise.all([
          apiClient.get<any[]>(`/projects/${activeProjId}/sdlc/business-cases`).catch(() => []),
          apiClient.get<any[]>(`/projects/${activeProjId}/sdlc/epics`).catch(() => []),
          apiClient.get<any[]>(`/projects/${activeProjId}/sdlc/user-stories`).catch(() => []),
          apiClient
            .get<any[]>(`/projects/${activeProjId}/sdlc/architecture-proposals`)
            .catch(() => []),
          apiClient.get<any[]>(`/projects/${activeProjId}/sdlc/audit-logs`).catch(() => []),
        ]);

        setBusinessCases(bcList);
        setEpics(epicsList);
        setUserStories(storiesList);
        setArchitectureProposals(archList);
        setRecentLogs(logsList);
      } catch {
        // Fallback gracefully
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [activeProject]);

  // Backlog counts
  const approvedStoriesCount = userStories.filter((s) => s.status === 'approved').length;
  const inReviewStoriesCount = userStories.filter((s) => s.status === 'in_review').length;
  const draftStoriesCount = userStories.filter((s) => s.status === 'draft').length;

  // Requirement Coverage: % of epics with at least 1 approved user story
  const epicsWithApprovedStories = epics.filter((epic) =>
    userStories.some((s) => s.epicId === epic.id && s.status === 'approved'),
  ).length;

  const requirementCoveragePct =
    epics.length > 0
      ? Math.round((epicsWithApprovedStories / epics.length) * 100)
      : businessCases.length > 0
        ? 50
        : 0;

  const totalCost = recentLogs.reduce((acc, log) => acc + (Number(log.cost_usd) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Project Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {activeProject?.name || 'Autonomous Drone Navigation System'}
            </h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
              Active Workspace
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {activeProject?.description ||
              'Collaborating AI software engineering operating system with multi-agent consensus and human approval gates.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/requirements">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/20"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Open Requirements Workspace
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Backlog Size */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Backlog Breakdown</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {userStories.length}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">User Stories</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-emerald-400">{approvedStoriesCount} Approved</span> •{' '}
            <span className="text-amber-400">{inReviewStoriesCount} In Review</span>
          </div>
        </Card>

        {/* Metric 2: Requirement Coverage */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Requirement Coverage</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {requirementCoveragePct}%
          </div>
          <div className="text-[11px] text-slate-400">
            {epicsWithApprovedStories} of {epics.length || 0} Epics covered with approved criteria
          </div>
        </Card>

        {/* Metric 3: Architecture Proposals */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Architecture Blueprint</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            v{architectureProposals[0]?.version || 1}
          </div>
          <div className="text-[11px] text-purple-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            {architectureProposals[0]?.components?.length || 4} components defined
          </div>
        </Card>

        {/* Metric 4: AI Gateway Cost */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Agent Cost Accounting</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">${totalCost.toFixed(5)}</div>
          <div className="text-[11px] text-emerald-400 font-mono">
            Local Ollama $0.00 / token primary
          </div>
        </Card>
      </div>

      {/* Core Operational Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Requirements Pipeline Summary */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-800 bg-slate-950/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  SDLC Requirements & Epics Backlog
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Business Analyst and Product Manager agent synthesized artifacts
                </CardDescription>
              </div>

              <Link href="/requirements">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  View Tree <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {epics.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <p className="text-xs text-slate-400">No epics generated yet.</p>
                  <Link href="/requirements">
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                    >
                      Submit Idea to BA Agent
                    </Button>
                  </Link>
                </div>
              ) : (
                epics.slice(0, 4).map((epic, idx) => (
                  <div
                    key={epic.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-indigo-400 font-bold">
                          EPIC-{idx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-white">{epic.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{epic.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">
                        {epic.sizing}
                      </span>
                      <Badge className="bg-slate-800 text-slate-300 text-[10px]">
                        {epic.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Live Activity & Agent Stream */}
        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-800 bg-slate-950/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  Live Agent Activity
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Real-time audit log stream
                </CardDescription>
              </div>

              <Link href="/agents">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Roster <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {recentLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No agent execution events logged yet.
                </div>
              ) : (
                recentLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-indigo-300 truncate max-w-[140px]">
                        {log.actor_id}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono">{log.action}</div>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-mono">
                      <span>{log.model || 'llama3.1'}</span>
                      <span className="text-emerald-400 font-semibold">
                        ${Number(log.cost_usd || 0).toFixed(5)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
