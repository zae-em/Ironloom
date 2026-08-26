'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Shield,
  Play,
  Sliders,
  Server,
  Zap,
  Cpu,
  RefreshCw,
  Clock,
  DollarSign,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AgentConfigModal, AgentConfig } from '@/components/agents/agent-config-modal';
import { AgentAuditTable, AuditLogItem } from '@/components/agents/agent-audit-table';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'business-analyst',
    name: 'Business Analyst Agent',
    role: 'Domain Analyst',
    description:
      'Synthesizes unstructured ideas into structured business cases with goals and metrics.',
    preferredProvider: 'ollama',
    model: 'llama3.1',
    temperature: 0.6,
    maxTokens: 2048,
    costProfile: 'Zero Cost (Local Ollama)',
  },
  {
    id: 'product-manager',
    name: 'Product Manager Agent',
    role: 'Product Strategist',
    description:
      'Decomposes business cases into prioritized Epics with rationale and T-shirt sizing.',
    preferredProvider: 'ollama',
    model: 'llama3.1',
    temperature: 0.7,
    maxTokens: 2048,
    costProfile: 'Zero Cost (Local Ollama)',
  },
  {
    id: 'requirements-engineer',
    name: 'Requirements Engineer Agent',
    role: 'Specification Author',
    description:
      'Formulates user stories with testable Gherkin acceptance criteria (Given/When/Then).',
    preferredProvider: 'groq',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.5,
    maxTokens: 3000,
    costProfile: 'Hosted Fast ($0.05 / 1M)',
  },
  {
    id: 'system-architect',
    name: 'System Architect Agent',
    role: 'Chief Architect',
    description:
      'Synthesizes versioned system architecture proposals, data models, and Mermaid diagrams.',
    preferredProvider: 'groq',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4,
    maxTokens: 4096,
    costProfile: 'Hosted High-Precision ($0.05 / 1M)',
  },
  {
    id: 'lead-developer',
    name: 'Lead Developer Agent',
    role: 'Code Synthesis',
    description: 'Implements production TypeScript/Node.js code following architectural patterns.',
    preferredProvider: 'ollama',
    model: 'qwen2.5-coder',
    temperature: 0.2,
    maxTokens: 4096,
    costProfile: 'Zero Cost (Local Ollama)',
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer Agent',
    role: 'Security & Quality Auditor',
    description:
      'Analyzes pull requests for AST safety, OWASP vulnerabilities, and design principles.',
    preferredProvider: 'groq',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    maxTokens: 2048,
    costProfile: 'Hosted High-Precision ($0.05 / 1M)',
  },
  {
    id: 'qa-engineer',
    name: 'QA Engineer Agent',
    role: 'Test Generator',
    description: 'Generates unit, integration, and Playwright regression test suites.',
    preferredProvider: 'ollama',
    model: 'llama3.1',
    temperature: 0.4,
    maxTokens: 2048,
    costProfile: 'Zero Cost (Local Ollama)',
  },
  {
    id: 'devops-engineer',
    name: 'DevOps & SRE Agent',
    role: 'Infrastructure & Deployment',
    description:
      'Configures Docker containers, GitHub CI/CD workflows, and environment orchestration.',
    preferredProvider: 'ollama',
    model: 'llama3.1',
    temperature: 0.3,
    maxTokens: 2048,
    costProfile: 'Zero Cost (Local Ollama)',
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>(DEFAULT_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const loadAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const projects = await apiClient.get<any[]>('/projects').catch(() => []);
      const activeProjId = projects[0]?.id || '00000000-0000-0000-0000-000000000001';

      const logs = await apiClient
        .get<AuditLogItem[]>(`/projects/${activeProjId}/sdlc/audit-logs`)
        .catch(() => []);

      setAuditLogs(logs);
    } catch {
      toast.error('Failed to load agent audit logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const handleOpenConfig = (agent: AgentConfig) => {
    setSelectedAgent(agent);
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = (updated: AgentConfig) => {
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleInvokeManual = (agentName: string) => {
    toast.info(`Invoking ${agentName} on current project backlog...`);
  };

  const getProviderIcon = (p: string) => {
    switch (p) {
      case 'ollama':
        return <Server className="w-3 h-3 text-emerald-400" />;
      case 'groq':
        return <Zap className="w-3 h-3 text-indigo-400" />;
      default:
        return <Cpu className="w-3 h-3 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Specialized AI Agent Roster & LLM Routing
            </h1>
            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs">
              8 Active Agents
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Configure per-agent LLM providers to reserve high-quality hosted models for architecture
            while running local Ollama for zero-cost analysis.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAuditLogs}
          className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          Refresh Run History
        </Button>
      </div>

      {/* Agent Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <Card
            key={agent.id}
            className="bg-slate-900 border-slate-800 flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-200 shadow-md group"
          >
            <CardHeader className="p-4 pb-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Bot className="h-4 w-4" />
                </div>
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ready
                </span>
              </div>

              <div>
                <CardTitle className="text-xs font-bold text-white tracking-tight">
                  {agent.name}
                </CardTitle>
                <span className="text-[10px] font-mono text-indigo-300 uppercase">
                  {agent.role}
                </span>
              </div>

              <CardDescription className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                {agent.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-3">
              {/* Routing Info */}
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-500 font-semibold">Provider:</span>
                  <span className="flex items-center gap-1 font-mono uppercase text-indigo-300">
                    {getProviderIcon(agent.preferredProvider)}
                    {agent.preferredProvider}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-500 font-semibold">Model:</span>
                  <span className="font-mono text-slate-300 text-[10px] truncate max-w-[120px]">
                    {agent.model}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenConfig(agent)}
                  className="h-7 px-2 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <Sliders className="w-3 h-3 mr-1" /> Configure
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInvokeManual(agent.name)}
                  className="h-7 px-2 text-[11px] border-slate-800 bg-slate-950 text-indigo-300 hover:bg-slate-800"
                >
                  <Play className="w-3 h-3 mr-1" /> Run
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Audit Trail Table */}
      <AgentAuditTable logs={auditLogs} isLoading={isLoadingLogs} />

      {/* Configuration Modal */}
      <AgentConfigModal
        agent={selectedAgent}
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
