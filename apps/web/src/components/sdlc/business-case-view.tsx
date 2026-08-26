'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit3,
  Save,
  Sparkles,
  Loader2,
  Users,
  Target,
  BarChart3,
  ShieldAlert,
  HelpCircle,
  FileText,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { RAGContextPanel } from './rag-context-panel';

interface BusinessCase {
  id: string;
  orgId: string;
  projectId: string;
  rawIdea: string;
  problemStatement: string;
  goals: string[];
  targetUsers: string[];
  successMetrics: string[];
  assumptions: string[];
  risks: string[];
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface BusinessCaseViewProps {
  businessCase: BusinessCase;
  onUpdate: (updated: BusinessCase) => void;
  onEpicsGenerated?: (epics: any[]) => void;
  onViewLineage?: () => void;
}

export function BusinessCaseView({
  businessCase,
  onUpdate,
  onEpicsGenerated,
  onViewLineage,
}: BusinessCaseViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingEpics, setIsGeneratingEpics] = useState(false);

  // Form state for inline editing
  const [problemStatement, setProblemStatement] = useState(businessCase.problemStatement || '');
  const [goalsText, setGoalsText] = useState((businessCase.goals || []).join('\n'));
  const [usersText, setUsersText] = useState((businessCase.targetUsers || []).join('\n'));
  const [metricsText, setMetricsText] = useState((businessCase.successMetrics || []).join('\n'));
  const [assumptionsText, setAssumptionsText] = useState(
    (businessCase.assumptions || []).join('\n'),
  );
  const [risksText, setRisksText] = useState((businessCase.risks || []).join('\n'));

  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      const updatedPayload = {
        problemStatement,
        goals: goalsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        targetUsers: usersText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        successMetrics: metricsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        assumptions: assumptionsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        risks: risksText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const res = await apiClient.patch<BusinessCase>(
        `/sdlc/business-cases/${businessCase.id}`,
        updatedPayload,
      );

      toast.success('Business Case updated successfully');
      onUpdate(res);
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (status: 'approved' | 'rejected' | 'in_review') => {
    try {
      const res = await apiClient.patch<BusinessCase>(
        `/sdlc/business-cases/${businessCase.id}/status`,
        { status },
      );
      toast.success(`Business Case marked as ${status.replace('_', ' ')}`);
      onUpdate(res);

      if (status === 'approved') {
        // Prompt or automatically trigger PM Agent
        triggerEpicGeneration();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update review status');
    }
  };

  const triggerEpicGeneration = async () => {
    setIsGeneratingEpics(true);
    try {
      const epics = await apiClient.post<any[]>(
        `/sdlc/business-cases/${businessCase.id}/generate-epics`,
      );
      toast.success(`Product Manager Agent generated ${epics.length} epics!`);
      if (onEpicsGenerated) {
        onEpicsGenerated(epics);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate epics');
    } finally {
      setIsGeneratingEpics(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </Badge>
        );
      case 'in_review':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> In Review
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rejected
          </Badge>
        );
      default:
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/30">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Business Case v{businessCase.version || 1}
              </span>
              {getStatusBadge(businessCase.status)}
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Executive Business Definition
            </h2>
            <p className="text-xs text-slate-400">
              Formulated by Business Analyst Agent from submitted project narrative
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onViewLineage && (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewLineage}
                className="border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                Lineage Graph
              </Button>
            )}

            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="border-slate-700 hover:bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Save Fields
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Inline Edit
              </Button>
            )}

            {/* Human Gate Action Controls */}
            {businessCase.status !== 'approved' && (
              <Button
                size="sm"
                onClick={() => handleStatusChange('approved')}
                disabled={isGeneratingEpics}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/20"
              >
                {isGeneratingEpics ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Generating Epics...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Approve & Run PM Agent
                  </>
                )}
              </Button>
            )}

            {businessCase.status === 'approved' && (
              <Button
                size="sm"
                onClick={triggerEpicGeneration}
                disabled={isGeneratingEpics}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20"
              >
                {isGeneratingEpics ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Decomposing into Epics...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-200" />
                    Re-run PM Agent (Epics)
                  </>
                )}
              </Button>
            )}

            {businessCase.status !== 'rejected' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('rejected')}
                className="border-rose-900/40 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Reject
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* RAG Context Panel */}
          <RAGContextPanel />

          {/* Raw Idea Origin Box */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Original Prompt Input
            </span>
            <p className="text-xs text-slate-300 font-mono italic leading-relaxed">
              "{businessCase.rawIdea}"
            </p>
          </div>

          {/* Section 1: Problem Statement */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <Target className="w-4 h-4 text-indigo-400" />
              <span>Core Problem Statement</span>
            </div>
            {isEditing ? (
              <textarea
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                {businessCase.problemStatement}
              </div>
            )}
          </div>

          {/* Section 2: Goals & Target Users (Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Goals */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>Primary Goals</span>
              </div>
              {isEditing ? (
                <div>
                  <textarea
                    value={goalsText}
                    onChange={(e) => setGoalsText(e.target.value)}
                    rows={4}
                    placeholder="Enter one goal per line"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">1 goal per line</span>
                </div>
              ) : (
                <ul className="space-y-2 p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300">
                  {(businessCase.goals || []).map((goal, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Target Users */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Target Users & Personas</span>
              </div>
              {isEditing ? (
                <div>
                  <textarea
                    value={usersText}
                    onChange={(e) => setUsersText(e.target.value)}
                    rows={4}
                    placeholder="Enter one persona per line"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">1 persona per line</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                  {(businessCase.targetUsers || []).map((user, idx) => (
                    <Badge
                      key={idx}
                      className="bg-blue-500/10 text-blue-300 border-blue-500/30 text-xs py-1 px-2.5"
                    >
                      {user}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Success Metrics, Assumptions & Risks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Success Metrics */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs uppercase tracking-wider">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Success Metrics</span>
              </div>
              {isEditing ? (
                <textarea
                  value={metricsText}
                  onChange={(e) => setMetricsText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono"
                />
              ) : (
                <ul className="space-y-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                  {(businessCase.successMetrics || []).map((m, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Assumptions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>Assumptions</span>
              </div>
              {isEditing ? (
                <textarea
                  value={assumptionsText}
                  onChange={(e) => setAssumptionsText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono"
                />
              ) : (
                <ul className="space-y-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                  {(businessCase.assumptions || []).map((a, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Risks */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Risks & Mitigations</span>
              </div>
              {isEditing ? (
                <textarea
                  value={risksText}
                  onChange={(e) => setRisksText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono"
                />
              ) : (
                <ul className="space-y-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                  {(businessCase.risks || []).map((r, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
