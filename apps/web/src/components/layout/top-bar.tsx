'use client';

import * as React from 'react';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../providers/theme-provider';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';
import { apiClient } from '../../lib/api-client';
import { Building2, FolderGit2, Plus, Moon, Sun, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';

export function TopBar() {
  const {
    activeOrg,
    organizations,
    setActiveOrgId,
    activeProject,
    projects,
    setActiveProjectId,
    refreshUserData,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();

  // Dropdown states
  const [orgMenuOpen, setOrgMenuOpen] = React.useState(false);
  const [projMenuOpen, setProjMenuOpen] = React.useState(false);

  // Modal states
  const [createOrgOpen, setCreateOrgOpen] = React.useState(false);
  const [createProjOpen, setCreateProjOpen] = React.useState(false);

  // Form states
  const [newOrgName, setNewOrgName] = React.useState('');
  const [newOrgSlug, setNewOrgSlug] = React.useState('');
  const [isCreatingOrg, setIsCreatingOrg] = React.useState(false);

  const [newProjName, setNewProjName] = React.useState('');
  const [newProjDesc, setNewProjDesc] = React.useState('');
  const [isCreatingProj, setIsCreatingProj] = React.useState(false);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgSlug) return;
    setIsCreatingOrg(true);
    try {
      const created = await apiClient.post<any>('/organizations', {
        name: newOrgName,
        slug: newOrgSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      });
      toast.success(`Organization "${created.name}" created!`);
      setCreateOrgOpen(false);
      setNewOrgName('');
      setNewOrgSlug('');
      await refreshUserData();
      setActiveOrgId(created.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleCreateProj = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName || !activeOrg) return;
    setIsCreatingProj(true);
    try {
      const created = await apiClient.post<any>(`/organizations/${activeOrg.id}/projects`, {
        name: newProjName,
        description: newProjDesc,
      });
      toast.success(`Project "${created.name}" created!`);
      setCreateProjOpen(false);
      setNewProjName('');
      setNewProjDesc('');
      await refreshUserData();
      setActiveProjectId(created.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    } finally {
      setIsCreatingProj(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
        {/* Left: Organization & Project Selectors */}
        <div className="flex items-center gap-3">
          {/* Org Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setOrgMenuOpen(!orgMenuOpen);
                setProjMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
            >
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-[130px] truncate">{activeOrg?.name || 'Select Org'}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>

            {orgMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setOrgMenuOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Organizations
                </div>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => setActiveOrgId(org.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-accent transition-colors"
                  >
                    <span className="truncate">{org.name}</span>
                    {org.id === activeOrg?.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
                <div className="my-1 border-t border-border" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOrgMenuOpen(false);
                    setCreateOrgOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Organization</span>
                </button>
              </div>
            )}
          </div>

          <span className="text-muted-foreground/40">/</span>

          {/* Project Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setProjMenuOpen(!projMenuOpen);
                setOrgMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
            >
              <FolderGit2 className="h-3.5 w-3.5 text-indigo-400" />
              <span className="max-w-[150px] truncate">{activeProject?.name || 'Select Project'}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>

            {projMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border border-border bg-card p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setProjMenuOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Projects in {activeOrg?.name}
                </div>
                {projects.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-muted-foreground italic">No projects yet</div>
                ) : (
                  projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => setActiveProjectId(proj.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-accent transition-colors"
                    >
                      <span className="truncate">{proj.name}</span>
                      {proj.id === activeProject?.id && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))
                )}
                <div className="my-1 border-t border-border" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProjMenuOpen(false);
                    setCreateProjOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Project</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Theme Toggle & Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Create Organization Modal */}
      <Dialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        title="Create New Organization"
        description="Organizations isolate software engineering teams, repositories, and AI agent workloads."
      >
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Organization Name</label>
            <Input
              placeholder="e.g. Acme Robotics"
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value);
                setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
              }}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Slug</label>
            <Input
              placeholder="e.g. acme-robotics"
              value={newOrgSlug}
              onChange={(e) => setNewOrgSlug(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOrgOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreatingOrg}>
              Create Organization
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Create Project Modal */}
      <Dialog
        open={createProjOpen}
        onOpenChange={setCreateProjOpen}
        title={`New Project in ${activeOrg?.name || 'Org'}`}
        description="Initialize an AI-governed software repository workspace."
      >
        <form onSubmit={handleCreateProj} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Project Name</label>
            <Input
              placeholder="e.g. Real-Time Telemetry Pipeline"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Description (Optional)</label>
            <Input
              placeholder="High-throughput stream processing service"
              value={newProjDesc}
              onChange={(e) => setNewProjDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateProjOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreatingProj}>
              Create Project
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
