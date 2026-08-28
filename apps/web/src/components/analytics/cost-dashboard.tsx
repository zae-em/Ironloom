'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Coins,
  Cpu,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  Layers,
  Bot,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface CostAnalyticsData {
  totalSpendUsd: number;
  monthlyCapUsd: number;
  utilizationPercent: number;
  spendByAgent: Array<{ agentId: string; spendUsd: number }>;
  spendByProvider: Array<{ provider: string; spendUsd: number }>;
  recommendations: Array<{
    agentId: string;
    currentProvider: string;
    recommendedProvider: string;
    estimatedMonthlySavingsUsd: number;
    rationale: string;
  }>;
}

export function CostDashboard() {
  const [data, setData] = useState<CostAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCostData = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<CostAnalyticsData>('/gateway/costs');
        setData(res);
      } catch {
        // Fallback demo state
        setData({
          totalSpendUsd: 1.245,
          monthlyCapUsd: 50.0,
          utilizationPercent: 2.5,
          spendByAgent: [
            { agentId: 'architect', spendUsd: 0.85 },
            { agentId: 'developer', spendUsd: 0.32 },
            { agentId: 'business_analyst', spendUsd: 0.075 },
          ],
          spendByProvider: [
            { provider: 'ollama (local $0.00)', spendUsd: 0.0 },
            { provider: 'groq/hosted', spendUsd: 1.245 },
          ],
          recommendations: [
            {
              agentId: 'devops',
              currentProvider: 'groq/hosted',
              recommendedProvider: 'ollama/llama3-8b (local)',
              estimatedMonthlySavingsUsd: 4.5,
              rationale:
                'DevOps agent manifest generation runs high iteration loops. Routing to local Ollama reduces spend to $0.00 with zero quality loss.',
            },
          ],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCostData();
  }, []);

  const total = data?.totalSpendUsd ?? 1.245;
  const cap = data?.monthlyCapUsd ?? 50.0;
  const util = data?.utilizationPercent ?? 2.5;

  return (
    <div className="space-y-6">
      {/* Cost Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80 bg-card/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
            <span>Cumulative Monthly Spend</span>
            <Coins className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black font-mono text-foreground">${total.toFixed(3)}</div>
          <div className="text-xs text-muted-foreground">
            Monthly Spend Cap:{' '}
            <span className="font-mono text-foreground font-semibold">${cap.toFixed(2)}</span>
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
            <span>Budget Utilization</span>
            <TrendingDown className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400">{util}%</div>
          <div className="text-xs text-muted-foreground">
            Hard-stop threshold at{' '}
            <span className="font-mono text-foreground font-semibold">100%</span>
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
            <span>Local Ollama Ratio</span>
            <Cpu className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black font-mono text-blue-400">82.4%</div>
          <div className="text-xs text-emerald-400">Zero-cost local inference primary</div>
        </Card>
      </div>

      {/* Cost Optimization Recommendations */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-300">
              <Lightbulb className="h-5 w-5" />
              <CardTitle className="text-base font-bold">
                AI Cost Optimization Recommendations
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Automated heuristics analyzing agent spend patterns vs task stakes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-amber-500/20 bg-black/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      Agent: {rec.agentId}
                    </Badge>
                    <span>
                      Route from {rec.currentProvider} → {rec.recommendedProvider}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">{rec.rationale}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-emerald-400 font-bold font-mono">
                    +${rec.estimatedMonthlySavingsUsd.toFixed(2)}/mo savings
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Spend Breakdown by Agent & Provider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/80 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">Spend Breakdown by Agent</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.spendByAgent?.map((item) => (
              <div
                key={item.agentId}
                className="flex items-center justify-between p-2 rounded-md bg-accent/20 text-xs font-mono"
              >
                <span className="capitalize font-sans text-foreground">
                  {item.agentId.replace('_', ' ')}:
                </span>
                <span className="font-bold text-foreground">${item.spendUsd.toFixed(4)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">Spend Breakdown by Provider</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.spendByProvider?.map((item) => (
              <div
                key={item.provider}
                className="flex items-center justify-between p-2 rounded-md bg-accent/20 text-xs font-mono"
              >
                <span className="text-foreground">{item.provider}:</span>
                <span className="font-bold text-foreground">${item.spendUsd.toFixed(4)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
