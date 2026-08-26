'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  FileText,
  Cpu,
  Plus,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  RefreshCw,
  GitCommit,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { IdeaSubmissionModal } from '@/components/sdlc/idea-submission-modal';
import { BusinessCaseView } from '@/components/sdlc/business-case-view';
import { RequirementTree, Epic, UserStory } from '@/components/sdlc/requirement-tree';
import {
  ArchitectureProposalView,
  ArchitectureProposal,
} from '@/components/sdlc/architecture-proposal-view';
import { TraceabilityDrawer } from '@/components/sdlc/traceability-drawer';

export default function RequirementsPage() {
  const [activeTab, setActiveTab] = useState<'tree' | 'business_case' | 'architecture'>('tree');
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [isTraceabilityOpen, setIsTraceabilityOpen] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string>('00000000-0000-0000-0000-000000000001');
  const [isLoading, setIsLoading] = useState(true);

  const [businessCases, setBusinessCases] = useState<any[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [architectureProposals, setArchitectureProposals] = useState<ArchitectureProposal[]>([]);

  // Load project SDLC entities
  const loadSdlcData = async () => {
    setIsLoading(true);
    try {
      // First get projects list to bind to active project
      const projectsRes = await apiClient.get<any[]>('/projects').catch(() => []);
      const activeProjId = projectsRes[0]?.id || projectId;
      setProjectId(activeProjId);

      const [bcList, epicsList, storiesList, archList] = await Promise.all([
        apiClient.get<any[]>(`/projects/${activeProjId}/sdlc/business-cases`).catch(() => []),
        apiClient.get<Epic[]>(`/projects/${activeProjId}/sdlc/epics`).catch(() => []),
        apiClient.get<UserStory[]>(`/projects/${activeProjId}/sdlc/user-stories`).catch(() => []),
        apiClient
          .get<ArchitectureProposal[]>(`/projects/${activeProjId}/sdlc/architecture-proposals`)
          .catch(() => []),
      ]);

      setBusinessCases(bcList);
      setEpics(epicsList);
      setUserStories(storiesList);
      setArchitectureProposals(archList);
    } catch (err: any) {
      toast.error('Failed to load project requirements data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSdlcData();
  }, []);

  const currentBusinessCase = businessCases[0] || null;

  const handleIdeaSuccess = (newBusinessCase: any) => {
    setBusinessCases([newBusinessCase, ...businessCases]);
    setActiveTab('business_case');
    loadSdlcData();
  };

  const handleOpenStoryLineage = (storyId: string) => {
    setSelectedStoryId(storyId);
    setIsTraceabilityOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Core SDLC Requirements & Engineering Blueprint
            </h1>
            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs">
              AI Collaborating Agents
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Autonomous Business Analyst, Product Manager, Requirements Engineer & System Architect
            pipeline with human approval gates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSdlcData}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsIdeaModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Submit New Idea
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <Button
          variant={activeTab === 'tree' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('tree')}
          className={`text-xs h-8 ${
            activeTab === 'tree'
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5 mr-1.5" />
          Requirements Tree & Gherkin Criteria ({epics.length} Epics, {userStories.length} Stories)
        </Button>

        <Button
          variant={activeTab === 'business_case' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('business_case')}
          className={`text-xs h-8 ${
            activeTab === 'business_case'
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          Business Case View {currentBusinessCase && `(v${currentBusinessCase.version})`}
        </Button>

        <Button
          variant={activeTab === 'architecture' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('architecture')}
          className={`text-xs h-8 ${
            activeTab === 'architecture'
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 mr-1.5" />
          Architecture Blueprint ({architectureProposals.length} Revisions)
        </Button>
      </div>

      {/* Tab Contents */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-900/40 border border-slate-800 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">Loading SDLC artifacts & RAG state...</span>
        </div>
      ) : activeTab === 'tree' ? (
        <RequirementTree
          epics={epics}
          userStories={userStories}
          onSelectStory={handleOpenStoryLineage}
          onRefreshData={loadSdlcData}
        />
      ) : activeTab === 'business_case' ? (
        currentBusinessCase ? (
          <BusinessCaseView
            businessCase={currentBusinessCase}
            onUpdate={(updated) => {
              setBusinessCases(businessCases.map((bc) => (bc.id === updated.id ? updated : bc)));
            }}
            onEpicsGenerated={() => {
              loadSdlcData();
              setActiveTab('tree');
            }}
            onViewLineage={() => setIsTraceabilityOpen(true)}
          />
        ) : (
          <Card className="bg-slate-900 border-slate-800 p-8 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-200">No Business Case Formulated Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Submit a raw software idea to trigger the Business Analyst Agent and synthesize your
              business case.
            </p>
            <Button
              onClick={() => setIsIdeaModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Submit Raw Idea
            </Button>
          </Card>
        )
      ) : (
        <ArchitectureProposalView
          proposals={architectureProposals}
          projectId={projectId}
          onRefresh={loadSdlcData}
        />
      )}

      {/* Idea Submission Modal */}
      <IdeaSubmissionModal
        isOpen={isIdeaModalOpen}
        onClose={() => setIsIdeaModalOpen(false)}
        projectId={projectId}
        onSuccess={handleIdeaSuccess}
      />

      {/* Traceability Drawer */}
      <TraceabilityDrawer
        isOpen={isTraceabilityOpen}
        onClose={() => setIsTraceabilityOpen(false)}
        storyId={selectedStoryId}
        businessCaseId={currentBusinessCase?.id}
      />
    </div>
  );
}
