'use client';

import React, { useState } from 'react';
import { Bot, Cpu, Sparkles, Server, Zap, Sliders, DollarSign, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  preferredProvider: 'ollama' | 'groq' | 'mock' | 'auto';
  model: string;
  temperature: number;
  maxTokens: number;
  costProfile: string;
}

interface AgentConfigModalProps {
  agent: AgentConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAgent: AgentConfig) => void;
}

export function AgentConfigModal({ agent, isOpen, onClose, onSave }: AgentConfigModalProps) {
  if (!agent) return null;

  const [provider, setProvider] = useState<'ollama' | 'groq' | 'mock' | 'auto'>(
    agent.preferredProvider || 'auto',
  );
  const [model, setModel] = useState(agent.model || 'llama3.1');
  const [temperature, setTemperature] = useState(agent.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens || 2048);

  const handleProviderSelect = (p: 'ollama' | 'groq' | 'mock' | 'auto') => {
    setProvider(p);
    if (p === 'ollama') setModel('llama3.1');
    else if (p === 'groq') setModel('llama-3.3-70b-versatile');
    else if (p === 'mock') setModel('mock-llm-v1');
    else setModel('llama3.1');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AgentConfig = {
      ...agent,
      preferredProvider: provider,
      model,
      temperature: Number(temperature),
      maxTokens: Number(maxTokens),
      costProfile:
        provider === 'ollama'
          ? 'Zero Cost (Local)'
          : provider === 'groq'
            ? 'Hosted Fast ($0.05 / 1M)'
            : 'Automatic Fallback',
    };

    onSave(updated);
    toast.success(`Updated LLM routing configuration for ${agent.name}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/30">
          <div className="flex items-center gap-2 text-indigo-400 mb-1">
            <Sliders className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Per-Agent LLM Routing
            </span>
          </div>
          <DialogTitle className="text-base font-bold text-white">
            Configure {agent.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Control model choice and provider fallback chains for this specialized agent.
          </DialogDescription>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Primary LLM Provider</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleProviderSelect('ollama')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  provider === 'ollama'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  {provider === 'ollama' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-200">Ollama (Local)</div>
                <div className="text-[10px] text-emerald-400 font-mono">$0.00 / token</div>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('groq')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  provider === 'groq'
                    ? 'bg-indigo-500/10 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  {provider === 'groq' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <div className="text-xs font-bold text-slate-200">Groq Cloud</div>
                <div className="text-[10px] text-indigo-300 font-mono">High Precision</div>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('auto')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  provider === 'auto'
                    ? 'bg-purple-500/10 border-purple-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  {provider === 'auto' && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <div className="text-xs font-bold text-slate-200">Auto Failover</div>
                <div className="text-[10px] text-purple-300 font-mono">Ollama → Groq</div>
              </button>
            </div>
          </div>

          {/* Model Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Model Identifier</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Temperature & Max Tokens */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Temperature</span>
                <span className="text-[11px] font-mono text-indigo-400">{temperature}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Max Output Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
            💡 <span className="font-semibold text-slate-300">Cost Optimization Principle:</span>{' '}
            Assign zero-cost local Ollama models to exploratory analysis and high-performance hosted
            models (Groq) to Architecture & Security reviews.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              Save Configuration
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
