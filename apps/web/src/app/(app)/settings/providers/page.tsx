'use client';

import * as React from 'react';
import { useAuth } from '../../../../components/providers/auth-provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
import { apiClient } from '../../../../lib/api-client';
import { ProviderSettings, AiProviderName } from '@ironloom/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Key,
  Activity,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { CostDashboard } from '../../../../components/analytics/cost-dashboard';

export default function ProviderSettingsPage() {
  const { activeOrg, userRole } = useAuth();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  const [groqKeyInput, setGroqKeyInput] = React.useState('');
  const [primaryProvider, setPrimaryProvider] = React.useState<AiProviderName>('ollama');

  // 1. Fetch Org Provider Settings
  const { data: settings, isLoading: isSettingsLoading } = useQuery<ProviderSettings>({
    queryKey: ['provider-settings', activeOrg?.id],
    queryFn: () =>
      apiClient.get(`/organizations/${activeOrg?.id}/provider-settings`, { orgId: activeOrg?.id }),
    enabled: Boolean(activeOrg?.id),
  });

  React.useEffect(() => {
    if (settings) {
      setPrimaryProvider(settings.defaultProvider);
    }
  }, [settings]);

  // 2. Live Health Check from AI Gateway
  const {
    data: healthData,
    refetch: refetchHealth,
    isFetching: isCheckingHealth,
  } = useQuery<{
    status: string;
    providers: Record<string, boolean>;
  }>({
    queryKey: ['gateway-health'],
    queryFn: () => apiClient.get('/gateway/health'),
    refetchInterval: 15000,
  });

  // 3. Live Redis Quota Status from AI Gateway
  const { data: quotaData, refetch: refetchQuotas } = useQuery<{
    quotas: Record<
      string,
      {
        provider: string;
        isAvailable: boolean;
        remainingRPM: number;
        remainingTPM: number;
        estimatedResetMs: number;
      }
    >;
  }>({
    queryKey: ['gateway-quotas'],
    queryFn: () => apiClient.get('/gateway/quotas'),
    refetchInterval: 10000,
  });

  // 4. Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: { defaultProvider?: AiProviderName; groqApiKey?: string }) =>
      apiClient.post(`/organizations/${activeOrg?.id}/provider-settings`, data, {
        orgId: activeOrg?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-settings', activeOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ['gateway-health'] });
      setGroqKeyInput('');
      toast.success('AI Provider settings updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update provider settings');
    },
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      defaultProvider: primaryProvider,
      groqApiKey: groqKeyInput || undefined,
    });
  };

  const isOllamaHealthy = healthData?.providers?.ollama ?? false;
  const isGroqHealthy = (healthData?.providers?.groq ?? true) || settings?.hasGroqApiKey;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Gateway & LLM Providers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure zero-licensing-cost local LLMs (Ollama) and free-tier hosted providers (Groq)
            with automatic failover.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchHealth();
            refetchQuotas();
            toast.info('Refreshed live provider telemetry');
          }}
          isLoading={isCheckingHealth}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Check Live Status
        </Button>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Provider 1: Ollama */}
        <Card className={primaryProvider === 'ollama' ? 'border-primary/60 shadow-md' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 font-black text-sm">
                  🦙
                </div>
                <div>
                  <CardTitle className="text-base">Ollama (Local LLM)</CardTitle>
                  <CardDescription className="text-xs">Zero-Cost Private Execution</CardDescription>
                </div>
              </div>
              <Badge variant={isOllamaHealthy ? 'success' : 'outline'} className="text-[10px]">
                {isOllamaHealthy ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Online
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" /> Standby / Docker
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
              <span>Endpoint:</span>
              <span className="font-mono text-foreground">
                {settings?.ollamaBaseUrl || 'http://localhost:11434'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
              <span>Default Model:</span>
              <span className="font-mono text-foreground">llama3.1 / qwen2.5</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
              <span>Pricing:</span>
              <span className="font-semibold text-emerald-400">$0.00 / token (100% Free)</span>
            </div>
            <div className="flex items-center justify-between py-1 text-muted-foreground">
              <span>Failover Behavior:</span>
              <span>Fails over to Groq on timeout</span>
            </div>
          </CardContent>
        </Card>

        {/* Provider 2: Groq */}
        <Card className={primaryProvider === 'groq' ? 'border-primary/60 shadow-md' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 font-bold text-sm">
                  ⚡
                </div>
                <div>
                  <CardTitle className="text-base">Groq (Hosted Free Tier)</CardTitle>
                  <CardDescription className="text-xs">Ultra-Fast LPU Inference</CardDescription>
                </div>
              </div>
              <Badge variant={isGroqHealthy ? 'success' : 'warning'} className="text-[10px]">
                {isGroqHealthy ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Operational
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" /> Key Required
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
              <span>Default Model:</span>
              <span className="font-mono text-foreground">llama-3.3-70b-versatile</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
              <span>API Key Status:</span>
              <span className="font-mono text-foreground">
                {settings?.hasGroqApiKey ? '•••••••••••••••• (Configured)' : 'Not Configured'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
              <span>Free Tier Limits:</span>
              <span className="font-mono text-foreground">30 RPM / 6,000 TPM</span>
            </div>
            <div className="flex items-center justify-between py-1 text-muted-foreground">
              <span>Cost Accounting:</span>
              <span>Logged to PostgreSQL Audit Trail</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Redis Quota & Rate Limit Counters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Real-Time Rate Limits & Quotas
            (Redis-Backed)
          </CardTitle>
          <CardDescription className="text-xs">
            Pre-emptive quota awareness routes agent requests away before a 429 occurs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
              <div className="flex justify-between font-semibold">
                <span>Groq Remaining RPM</span>
                <span className="font-mono text-primary">
                  {quotaData?.quotas?.groq?.remainingRPM ?? 30} / 30 RPM
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((quotaData?.quotas?.groq?.remainingRPM ?? 30) / 30) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
              <div className="flex justify-between font-semibold">
                <span>Groq Remaining TPM</span>
                <span className="font-mono text-primary">
                  {quotaData?.quotas?.groq?.remainingTPM ?? 6000} / 6000 TPM
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((quotaData?.quotas?.groq?.remainingTPM ?? 6000) / 6000) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Gateway Cost Control & Spend Caps Dashboard */}
      <CostDashboard />

      {/* Provider Priority & API Key Form (Admin/Owner) */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> Provider Routing & API Key Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Configure primary execution provider and save encrypted API keys for this
              organization.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSaveSettings}>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Primary Routing Provider
                </label>
                <select
                  value={primaryProvider}
                  onChange={(e) => setPrimaryProvider(e.target.value as AiProviderName)}
                  className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ollama">Ollama (Local Zero-Cost Primary, Groq Secondary)</option>
                  <option value="groq">Groq (Hosted Free-Tier Primary, Ollama Secondary)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Update Groq API Key (Free Tier)
                </label>
                <Input
                  type="password"
                  placeholder="gsk_••••••••••••••••••••••••••••••••••••"
                  value={groqKeyInput}
                  onChange={(e) => setGroqKeyInput(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Get a permanently free API key at{' '}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    console.groq.com/keys
                  </a>
                  . Secrets are handled exclusively via the backend.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end pt-2">
              <Button type="submit" isLoading={updateSettingsMutation.isPending}>
                Save Provider Settings
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
