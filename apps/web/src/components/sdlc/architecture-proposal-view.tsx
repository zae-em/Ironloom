'use client';

import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  Database,
  Code2,
  Server,
  Network,
  Loader2,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { RAGContextPanel } from './rag-context-panel';

export interface ArchitectureComponent {
  name: string;
  description: string;
  techChoice: string;
  justification: string;
}

export interface TechStackItem {
  category: string;
  technology: string;
  purpose: string;
}

export interface DataEntityField {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

export interface DataEntity {
  name: string;
  description: string;
  fields: DataEntityField[];
}

export interface DataModelSpec {
  entities: DataEntity[];
  relationships: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}

export interface ArchitectureProposal {
  id: string;
  orgId: string;
  projectId: string;
  version: number;
  title: string;
  summary: string;
  components: ArchitectureComponent[];
  techStack: TechStackItem[];
  dataModel: DataModelSpec;
  diagramMermaid: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

interface ArchitectureProposalViewProps {
  proposals: ArchitectureProposal[];
  projectId: string;
  onRefresh?: () => void;
}

export function ArchitectureProposalView({
  proposals,
  projectId,
  onRefresh,
}: ArchitectureProposalViewProps) {
  const [selectedVersion, setSelectedVersion] = useState<number>(
    proposals.length > 0 ? Math.max(...proposals.map((p) => p.version)) : 1,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMermaid, setCopiedMermaid] = useState(false);

  const currentProposal = proposals.find((p) => p.version === selectedVersion) || proposals[0];

  const handleGenerateArchitecture = async () => {
    setIsGenerating(true);
    try {
      const created = await apiClient.post<ArchitectureProposal>(
        `/projects/${projectId}/sdlc/generate-architecture`,
      );
      toast.success(`System Architect Agent synthesized Proposal v${created.version}!`);
      setSelectedVersion(created.version);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate architecture proposal');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStatusChange = async (status: 'approved' | 'rejected' | 'in_review') => {
    if (!currentProposal) return;
    try {
      await apiClient.patch(`/sdlc/architecture-proposals/${currentProposal.id}/status`, {
        status,
      });
      toast.success(`Architecture Proposal marked as ${status.replace('_', ' ')}`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update review status');
    }
  };

  const copyMermaid = () => {
    if (!currentProposal?.diagramMermaid) return;
    navigator.clipboard.writeText(currentProposal.diagramMermaid);
    setCopiedMermaid(true);
    toast.success('Mermaid diagram code copied to clipboard');
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
          </Badge>
        );
      case 'in_review':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
            <Clock className="w-3 h-3 mr-1" /> In Review
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30">
            <XCircle className="w-3 h-3 mr-1" /> Rejected
          </Badge>
        );
      default:
        return <Badge className="bg-slate-800 text-slate-400">Draft</Badge>;
    }
  };

  if (!currentProposal) {
    return (
      <Card className="bg-slate-900 border-slate-800 p-8 text-center space-y-4">
        <Cpu className="w-10 h-10 text-indigo-400 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">No Architecture Proposals Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Once user stories and acceptance criteria are approved, invoke the System Architect
            Agent to synthesize a complete technical blueprint.
          </p>
        </div>
        <Button
          onClick={handleGenerateArchitecture}
          disabled={isGenerating}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Synthesizing Architecture...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Run System Architect Agent
            </>
          )}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Version Switcher */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/30">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4" /> System Architecture Proposal
              </span>
              {getStatusBadge(currentProposal.status)}

              {/* Version Picker */}
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-xs text-slate-400 font-mono">Version:</span>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-purple-300 font-mono text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {proposals.map((p) => (
                    <option key={p.id} value={p.version}>
                      v{p.version} ({new Date(p.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">{currentProposal.title}</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              {currentProposal.summary}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              size="sm"
              onClick={handleGenerateArchitecture}
              disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-lg shadow-purple-600/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Generating Revision...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-200" />
                  Generate New Revision (v{Math.max(...proposals.map((p) => p.version), 0) + 1})
                </>
              )}
            </Button>

            {currentProposal.status !== 'approved' && (
              <Button
                size="sm"
                onClick={() => handleStatusChange('approved')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve Architecture
              </Button>
            )}

            {currentProposal.status !== 'rejected' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('rejected')}
                className="border-rose-900/40 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 text-xs"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* RAG Context Panel */}
          <RAGContextPanel />

          {/* Section 1: Modular Components */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <Server className="w-4 h-4 text-purple-400" />
              <span>Modular Components & Service Architecture</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(currentProposal.components || []).map((comp, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{comp.name}</h4>
                      <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[10px] font-mono">
                        {comp.techChoice}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{comp.description}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 italic">
                    <span className="text-slate-500 font-semibold not-italic">Justification: </span>
                    {comp.justification}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Technology Stack */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <Code2 className="w-4 h-4 text-blue-400" />
              <span>Technology Choices & Ecosystem</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(currentProposal.techStack || []).map((tech, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1"
                >
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {tech.category}
                  </span>
                  <div className="text-xs font-bold text-slate-100">{tech.technology}</div>
                  <p className="text-[11px] text-slate-400">{tech.purpose}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Entity-Relationship Data Model */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Entity Data Model & Schema Definitions</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(currentProposal.dataModel?.entities || []).map((entity, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white font-mono">{entity.name}</h4>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {entity.fields?.length || 0} fields
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{entity.description}</p>

                  <div className="border border-slate-800/80 rounded-lg overflow-hidden text-[11px] font-mono">
                    <div className="bg-slate-900 px-3 py-1.5 text-slate-400 text-[10px] font-semibold uppercase grid grid-cols-3">
                      <span>Column</span>
                      <span>Type</span>
                      <span>Nullable</span>
                    </div>
                    <div className="divide-y divide-slate-800/60 bg-slate-950">
                      {(entity.fields || []).map((field, fIdx) => (
                        <div key={fIdx} className="px-3 py-1.5 grid grid-cols-3 text-slate-300">
                          <span className="text-indigo-300">{field.name}</span>
                          <span className="text-emerald-400">{field.type}</span>
                          <span className="text-slate-500">{field.nullable ? 'YES' : 'NO'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Mermaid Diagram Spec */}
          {currentProposal.diagramMermaid && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                  <Network className="w-4 h-4 text-indigo-400" />
                  <span>Architecture Topology (Mermaid Graph)</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyMermaid}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs h-7"
                >
                  {copiedMermaid ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Diagram Code
                    </>
                  )}
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                <pre className="font-mono text-xs text-indigo-300 leading-relaxed">
                  {currentProposal.diagramMermaid}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
