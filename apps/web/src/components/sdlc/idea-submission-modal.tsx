'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  BrainCircuit,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface IdeaSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  onSuccess: (businessCase: any) => void;
}

const AGENT_STEPS = [
  { id: '1', label: 'Domain analysis & RAG knowledge retrieval', icon: BrainCircuit },
  { id: '2', label: 'Synthesizing problem statement & business goals', icon: Lightbulb },
  { id: '3', label: 'Formulating target personas & success metrics', icon: CheckCircle2 },
  { id: '4', label: 'Risk assessment & structured entity persistence', icon: ShieldAlert },
];

export function IdeaSubmissionModal({
  isOpen,
  onClose,
  projectId,
  projectName = 'Current Project',
  onSuccess,
}: IdeaSubmissionModalProps) {
  const [rawIdea, setRawIdea] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let stepTimer: NodeJS.Timeout;

    if (isSubmitting) {
      setElapsedSeconds(0);
      setCurrentStepIndex(0);

      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      stepTimer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev < AGENT_STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 3500);
    }

    return () => {
      clearInterval(timer);
      clearInterval(stepTimer);
    };
  }, [isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawIdea.trim()) {
      toast.error('Please enter a software idea description');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<any>(`/projects/${projectId}/sdlc/idea`, { rawIdea });

      toast.success('Business Analyst Agent generated structured business case!');
      setRawIdea('');
      onSuccess(response);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to analyze idea. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sampleIdeas = [
    'Build an autonomous drone fleet coordination system with obstacle avoidance telemetry under 100ms latency.',
    'Create an enterprise AI coding assistant operating system with multi-agent consensus and human approval gates.',
    'Develop a real-time anomaly detection engine for high-frequency algorithmic trading order streams.',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-2.5 text-indigo-400 mb-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">
              Business Analyst Agent
            </span>
          </div>
          <DialogTitle className="text-xl font-bold text-white tracking-tight">
            Submit Software Idea for {projectName}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400 mt-1">
            Provide a raw, unstructured idea or requirements narrative. The Business Analyst Agent
            will perform RAG context retrieval and structure it into a formal Business Case.
          </DialogDescription>
        </div>

        {isSubmitting ? (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <Sparkles className="w-4 h-4 text-indigo-400 absolute inset-0 m-auto" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Business Analyst Agent is Analyzing Idea
                  </h4>
                  <p className="text-xs text-slate-400">
                    Querying semantic vectors & structuring problem space
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-mono text-indigo-300">
                <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>{elapsedSeconds}s elapsed</span>
              </div>
            </div>

            {/* Step Progress Checklist */}
            <div className="space-y-3">
              {AGENT_STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isCurrent = idx === currentStepIndex;
                const isDone = idx < currentStepIndex;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                      isCurrent
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200'
                        : isDone
                          ? 'bg-slate-800/40 border-slate-800 text-slate-300'
                          : 'bg-slate-900/30 border-transparent text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isCurrent
                            ? 'bg-indigo-500 text-white animate-pulse'
                            : 'bg-slate-800 text-slate-600'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <StepIcon
                      className={`w-4 h-4 ${isCurrent ? 'text-indigo-400' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}
                    />
                    <span className="text-xs font-medium">{step.label}</span>
                    {isCurrent && (
                      <Loader2 className="w-3.5 h-3.5 ml-auto text-indigo-400 animate-spin" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Raw Idea / Problem Description
              </label>
              <textarea
                value={rawIdea}
                onChange={(e) => setRawIdea(e.target.value)}
                placeholder="Describe your software idea, target audience, core challenges, and desired capabilities in natural language..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none font-sans"
                required
              />
            </div>

            {/* Quick Prompts */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-medium">Or try an example prompt:</span>
              <div className="flex flex-col gap-1.5">
                {sampleIdeas.map((idea, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRawIdea(idea)}
                    className="text-left text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300 hover:text-white hover:border-indigo-500/40 hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate pr-2">{idea}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-700 hover:bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 shadow-lg shadow-indigo-600/20"
              >
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Analyze with BA Agent
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
