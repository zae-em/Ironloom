'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  FileText,
  Bookmark,
  CheckSquare,
  Loader2,
  FolderOpen,
  Folder,
  Tag,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export interface AcceptanceCriterion {
  id: string;
  userStoryId: string;
  scenarioTitle: string;
  givenText: string;
  whenText: string;
  thenText: string;
}

export interface UserStory {
  id: string;
  orgId: string;
  projectId: string;
  epicId: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  acceptanceCriteria: AcceptanceCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface Epic {
  id: string;
  orgId: string;
  projectId: string;
  businessCaseId: string;
  title: string;
  description: string;
  rationale: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  sizing: 'XS' | 'S' | 'M' | 'L' | 'XL';
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

interface RequirementTreeProps {
  businessCaseTitle?: string;
  epics: Epic[];
  userStories: UserStory[];
  onSelectStory?: (storyId: string) => void;
  onRefreshData?: () => void;
}

export function RequirementTree({
  businessCaseTitle = 'Business Case Requirements Root',
  epics,
  userStories,
  onSelectStory,
  onRefreshData,
}: RequirementTreeProps) {
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({});
  const [expandedStories, setExpandedStories] = useState<Record<string, boolean>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const toggleEpic = (epicId: string) => {
    setExpandedEpics((prev) => ({ ...prev, [epicId]: !prev[epicId] }));
  };

  const toggleStory = (storyId: string) => {
    setExpandedStories((prev) => ({ ...prev, [storyId]: !prev[storyId] }));
  };

  const expandAll = () => {
    const epicsMap: Record<string, boolean> = {};
    epics.forEach((e) => (epicsMap[e.id] = true));
    setExpandedEpics(epicsMap);

    const storiesMap: Record<string, boolean> = {};
    userStories.forEach((s) => (storiesMap[s.id] = true));
    setExpandedStories(storiesMap);
  };

  const collapseAll = () => {
    setExpandedEpics({});
    setExpandedStories({});
  };

  const handleEpicStatusChange = async (
    epicId: string,
    status: 'approved' | 'rejected' | 'in_review',
  ) => {
    setLoadingAction(`epic-status-${epicId}`);
    try {
      await apiClient.patch(`/sdlc/epics/${epicId}/status`, { status });
      toast.success(`Epic marked as ${status.replace('_', ' ')}`);
      if (status === 'approved') {
        // Automatically generate stories
        await handleGenerateStories(epicId);
      } else if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update epic status');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGenerateStories = async (epicId: string) => {
    setLoadingAction(`generate-stories-${epicId}`);
    try {
      const generated = await apiClient.post<UserStory[]>(`/sdlc/epics/${epicId}/generate-stories`);
      toast.success(`Requirements Engineer generated ${generated.length} user stories!`);
      // Auto-expand this epic
      setExpandedEpics((prev) => ({ ...prev, [epicId]: true }));
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate user stories');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStoryStatusChange = async (
    storyId: string,
    status: 'approved' | 'rejected' | 'in_review',
  ) => {
    setLoadingAction(`story-status-${storyId}`);
    try {
      await apiClient.patch(`/sdlc/user-stories/${storyId}/status`, { status });
      toast.success(`User Story marked as ${status.replace('_', ' ')}`);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user story status');
    } finally {
      setLoadingAction(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">
            Critical
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
            Medium
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-[10px]">
            Low
          </Badge>
        );
    }
  };

  const getSizingBadge = (sizing: string) => {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
        {sizing}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <Clock className="w-3 h-3" /> In Review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded border border-slate-500/20">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Requirements Breakdown Tree
          </span>
          <Badge className="bg-slate-800 text-slate-400 text-xs ml-2">
            {epics.length} Epics • {userStories.length} User Stories
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300 text-xs h-7 px-2.5"
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300 text-xs h-7 px-2.5"
          >
            Collapse All
          </Button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="space-y-3">
        {epics.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
            <Bookmark className="w-8 h-8 text-slate-600 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-300">No Epics Generated Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Approve the Business Case to run the Product Manager Agent and populate this tree.
            </p>
          </div>
        ) : (
          epics.map((epic, epicIdx) => {
            const isEpicExpanded = !!expandedEpics[epic.id];
            const epicStories = userStories.filter((s) => s.epicId === epic.id);
            const isGeneratingThisEpic = loadingAction === `generate-stories-${epic.id}`;

            return (
              <div
                key={epic.id}
                className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden transition-all duration-200"
              >
                {/* Epic Node Header */}
                <div
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors ${
                    isEpicExpanded ? 'bg-slate-800/40 border-b border-slate-800' : ''
                  }`}
                  onClick={() => toggleEpic(epic.id)}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      type="button"
                      className="mt-0.5 p-1 rounded hover:bg-slate-800 text-slate-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEpic(epic.id);
                      }}
                    >
                      {isEpicExpanded ? (
                        <ChevronDown className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[11px] font-mono text-indigo-400 font-semibold uppercase">
                          EPIC-{epicIdx + 1}
                        </span>
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          {epic.title}
                        </h3>
                        {getPriorityBadge(epic.priority)}
                        {getSizingBadge(epic.sizing)}
                        {getStatusBadge(epic.status)}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                        {epic.description}
                      </p>
                      {epic.rationale && (
                        <p className="text-[11px] text-slate-500 italic">
                          Rationale: {epic.rationale}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for Epic */}
                  <div
                    className="flex items-center gap-2 self-end md:self-center shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {epic.status !== 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEpicStatusChange(epic.id, 'approved')}
                        disabled={isGeneratingThisEpic}
                        className="border-emerald-700/50 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 text-xs h-7 px-2.5"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                        Approve & Generate Stories
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleGenerateStories(epic.id)}
                      disabled={isGeneratingThisEpic}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7 px-2.5 font-medium shadow-md shadow-indigo-600/20"
                    >
                      {isGeneratingThisEpic ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1 text-indigo-200" />
                      )}
                      Run RE Agent
                    </Button>
                  </div>
                </div>

                {/* Expanded Stories Container */}
                {isEpicExpanded && (
                  <div className="p-4 bg-slate-950/40 space-y-3 border-t border-slate-800/60">
                    <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                      <span className="font-semibold uppercase tracking-wider text-[10px] text-indigo-300">
                        User Stories in EPIC-{epicIdx + 1} ({epicStories.length})
                      </span>
                    </div>

                    {epicStories.length === 0 ? (
                      <div className="p-4 text-center rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
                        <p className="text-xs text-slate-400">
                          No user stories created yet for this epic.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateStories(epic.id)}
                          disabled={isGeneratingThisEpic}
                          className="bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs h-7"
                        >
                          <Sparkles className="w-3 h-3 mr-1" /> Run Requirements Engineer Agent
                        </Button>
                      </div>
                    ) : (
                      epicStories.map((story, storyIdx) => {
                        const isStoryExpanded = !!expandedStories[story.id];
                        const criteria = story.acceptanceCriteria || [];

                        return (
                          <div
                            key={story.id}
                            className="rounded-lg border border-slate-800/90 bg-slate-900/90 overflow-hidden"
                          >
                            {/* Story Row */}
                            <div
                              className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors cursor-pointer"
                              onClick={() => toggleStory(story.id)}
                            >
                              <div className="flex items-start gap-2.5 flex-1">
                                <button
                                  type="button"
                                  className="mt-0.5 p-1 rounded hover:bg-slate-800 text-slate-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleStory(story.id);
                                  }}
                                >
                                  {isStoryExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                </button>

                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-mono text-purple-400 font-bold">
                                      US-{epicIdx + 1}.{storyIdx + 1}
                                    </span>
                                    <h4 className="text-xs font-bold text-slate-100">
                                      {story.title}
                                    </h4>
                                    {getStatusBadge(story.status)}
                                    <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded">
                                      {criteria.length} Gherkin criteria
                                    </span>
                                  </div>

                                  <div className="text-xs text-slate-300 font-sans space-y-0.5">
                                    <div>
                                      <span className="text-slate-500 font-semibold">As a</span>{' '}
                                      {story.asA},{' '}
                                      <span className="text-slate-500 font-semibold">I want</span>{' '}
                                      {story.iWant},{' '}
                                      <span className="text-slate-500 font-semibold">so that</span>{' '}
                                      {story.soThat}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Story Controls */}
                              <div
                                className="flex items-center gap-2 self-end md:self-center shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {onSelectStory && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onSelectStory(story.id)}
                                    className="border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-[11px] h-6 px-2"
                                  >
                                    <Layers className="w-3 h-3 mr-1 text-indigo-400" />
                                    Traceability
                                  </Button>
                                )}

                                {story.status !== 'approved' ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleStoryStatusChange(story.id, 'approved')}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] h-6 px-2 font-medium"
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStoryStatusChange(story.id, 'in_review')}
                                    className="border-amber-700/40 text-amber-300 hover:bg-amber-950/30 text-[11px] h-6 px-2"
                                  >
                                    Review
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Gherkin Acceptance Criteria Details */}
                            {isStoryExpanded && (
                              <div className="p-3 bg-slate-950/70 border-t border-slate-800 space-y-2 text-xs">
                                <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px]">
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Acceptance Criteria (Gherkin Scenarios)</span>
                                </div>

                                {criteria.length === 0 ? (
                                  <p className="text-slate-500 text-[11px] italic">
                                    No criteria specified.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {criteria.map((c, critIdx) => (
                                      <div
                                        key={c.id || critIdx}
                                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1 font-mono text-[11px]"
                                      >
                                        <div className="font-semibold text-indigo-300">
                                          Scenario {critIdx + 1}: {c.scenarioTitle}
                                        </div>
                                        <div className="text-slate-300 pl-2 space-y-0.5">
                                          <div>
                                            <span className="text-emerald-400 font-bold">
                                              Given
                                            </span>{' '}
                                            {c.givenText}
                                          </div>
                                          <div>
                                            <span className="text-blue-400 font-bold">When</span>{' '}
                                            {c.whenText}
                                          </div>
                                          <div>
                                            <span className="text-purple-400 font-bold">Then</span>{' '}
                                            {c.thenText}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
