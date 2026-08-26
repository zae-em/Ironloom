'use client';

import * as React from 'react';
import { useAuth } from '../providers/auth-provider';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { apiClient } from '../../lib/api-client';
import { Building2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, organizations, isLoading, refreshUserData, setActiveOrgId } = useAuth();
  const [orgName, setOrgName] = React.useState('');
  const [orgSlug, setOrgSlug] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  // If initial load in progress
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground font-mono">Initializing IRONLOOM OS...</p>
        </div>
      </div>
    );
  }

  // If authenticated but user has 0 organizations, show mandatory Onboarding Screen
  if (user && organizations.length === 0) {
    const handleInitialOrgCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!orgName || !orgSlug) return;
      setIsCreating(true);
      try {
        const created = await apiClient.post<any>('/organizations', {
          name: orgName,
          slug: orgSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        });
        toast.success(`Organization "${created.name}" created!`);
        await refreshUserData();
        setActiveOrgId(created.id);
      } catch (err: any) {
        toast.error(err.message || 'Failed to create organization');
      } finally {
        setIsCreating(false);
      }
    };

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Welcome to IRONLOOM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            To start collaborating with autonomous AI engineering agents, create your primary
            organization workspace.
          </p>

          <form onSubmit={handleInitialOrgCreate} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Organization Name
              </label>
              <Input
                placeholder="e.g. Acme Software Labs"
                value={orgName}
                onChange={(e) => {
                  setOrgName(e.target.value);
                  setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                }}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Workspace Slug
              </label>
              <Input
                placeholder="e.g. acme-software-labs"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full mt-2" isLoading={isCreating}>
              <Sparkles className="mr-2 h-4 w-4" />
              Create Organization & Continue
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col pl-64">
        <TopBar />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
