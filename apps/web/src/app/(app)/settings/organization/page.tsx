'use client';

import * as React from 'react';
import { useAuth } from '../../../../components/providers/auth-provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
import { Dialog } from '../../../../components/ui/dialog';
import { apiClient } from '../../../../lib/api-client';
import { OrganizationMemberWithUser, OrganizationInvite, OrgRole } from '@ironloom/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Shield, Trash2, Mail, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function OrganizationSettingsPage() {
  const { activeOrg, userRole, user } = useAuth();
  const queryClient = useQueryClient();

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  // Modal & Invite States
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<OrgRole>('member');
  const [generatedInvite, setGeneratedInvite] = React.useState<OrganizationInvite | null>(null);
  const [hasCopied, setHasCopied] = React.useState(false);

  // 1. Fetch Members Query
  const { data: members = [], isLoading: isMembersLoading } = useQuery<
    OrganizationMemberWithUser[]
  >({
    queryKey: ['org-members', activeOrg?.id],
    queryFn: () =>
      apiClient.get(`/organizations/${activeOrg?.id}/members`, { orgId: activeOrg?.id }),
    enabled: Boolean(activeOrg?.id),
  });

  // 2. Fetch Invites Query (Admin only)
  const { data: invites = [] } = useQuery<OrganizationInvite[]>({
    queryKey: ['org-invites', activeOrg?.id],
    queryFn: () =>
      apiClient.get(`/organizations/${activeOrg?.id}/invites`, { orgId: activeOrg?.id }),
    enabled: Boolean(activeOrg?.id && isOwnerOrAdmin),
  });

  // 3. Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: OrgRole }) =>
      apiClient.post<OrganizationInvite>(`/organizations/${activeOrg?.id}/invites`, data, {
        orgId: activeOrg?.id,
      }),
    onSuccess: (newInvite) => {
      setGeneratedInvite(newInvite);
      queryClient.invalidateQueries({ queryKey: ['org-members', activeOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ['org-invites', activeOrg?.id] });
      toast.success(`Invite generated for ${newInvite.email}!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to generate invitation');
    },
  });

  // 4. Update Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      apiClient.patch(
        `/organizations/${activeOrg?.id}/members/${userId}`,
        { role },
        {
          orgId: activeOrg?.id,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', activeOrg?.id] });
      toast.success('Member role updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update role');
    },
  });

  // 5. Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/organizations/${activeOrg?.id}/members/${userId}`, {
        orgId: activeOrg?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', activeOrg?.id] });
      toast.success('Member removed');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove member');
    },
  });

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const copyInviteLink = () => {
    if (!generatedInvite) return;
    const url = `${window.location.origin}/signup?invite=${generatedInvite.token}`;
    navigator.clipboard.writeText(url);
    setHasCopied(true);
    toast.success('Invite link copied to clipboard!');
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Team & Workspace Members
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage organization members and role permissions for <strong>{activeOrg?.name}</strong>.
          </p>
        </div>

        {isOwnerOrAdmin && (
          <Button onClick={() => setInviteOpen(true)} size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Teammate
          </Button>
        )}
      </div>

      {/* Members List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Active Members ({members.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Users with access to this workspace and its AI agent execution runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMembersLoading ? (
            <div className="space-y-2 py-4">
              <div className="h-10 w-full animate-pulse bg-muted/40 rounded-lg" />
              <div className="h-10 w-full animate-pulse bg-muted/40 rounded-lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Access Level</th>
                    {isOwnerOrAdmin && <th className="pb-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {members.map((member) => {
                    const isSelf = member.userId === user?.userId;
                    return (
                      <tr key={member.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-xs uppercase">
                              {member.user?.email?.[0] || 'U'}
                            </div>
                            <div>
                              <span className="font-medium text-foreground block">
                                {member.user?.name || member.user?.email?.split('@')[0]}
                                {isSelf && (
                                  <span className="ml-1 text-[10px] text-muted-foreground">
                                    (You)
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {member.user?.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              member.role === 'owner'
                                ? 'default'
                                : member.role === 'admin'
                                  ? 'secondary'
                                  : 'outline'
                            }
                            className="capitalize text-[10px]"
                          >
                            <Shield className="mr-1 h-3 w-3" />
                            {member.role}
                          </Badge>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {member.role === 'owner'
                            ? 'Full Administrator & Billing'
                            : member.role === 'admin'
                              ? 'Manage Members & Projects'
                              : 'Collaborate on Projects'}
                        </td>
                        {isOwnerOrAdmin && (
                          <td className="py-3 text-right">
                            {!isSelf && member.role !== 'owner' && (
                              <div className="flex items-center justify-end gap-2">
                                <select
                                  value={member.role}
                                  onChange={(e) =>
                                    updateRoleMutation.mutate({
                                      userId: member.userId,
                                      role: e.target.value as OrgRole,
                                    })
                                  }
                                  className="rounded border border-border bg-card px-2 py-1 text-[11px] font-medium"
                                >
                                  <option value="member">Member</option>
                                  <option value="admin">Admin</option>
                                  <option value="owner">Owner</option>
                                </select>
                                <button
                                  onClick={() => removeMemberMutation.mutate(member.userId)}
                                  className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Remove member"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setGeneratedInvite(null);
            setInviteEmail('');
          }
        }}
        title={`Invite Teammate to ${activeOrg?.name}`}
        description="Invited members will receive an invite record and token with role-based permissions."
      >
        {generatedInvite ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-400">
              <p className="font-semibold mb-1">Invitation Record Created!</p>
              <p className="text-[11px] text-muted-foreground mb-2">
                (Note: Actual email delivery is stubbed for Prompt 12 hardening. Share the secure
                direct link below).
              </p>
              <div className="flex items-center gap-2 mt-2">
                <input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/signup?token=${generatedInvite.token}`}
                  className="flex-1 rounded border border-border bg-background px-2.5 py-1 text-[11px] font-mono text-foreground"
                />
                <Button size="sm" onClick={copyInviteLink}>
                  {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setInviteOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendInvite} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Teammate Email
              </label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="member">Member (Execute Agents & View Projects)</option>
                <option value="admin">Admin (Manage Members & Provider Keys)</option>
                <option value="owner">Owner (Full Control)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={inviteMutation.isPending}>
                <Mail className="mr-2 h-3.5 w-3.5" />
                Generate Invitation
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
