'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { UnifiedApprovalsInbox } from '@/components/approvals/unified-approvals-inbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApprovalRequest } from '@ironloom/shared';

export default function ApprovalsPage() {
  const { activeOrg, activeProject } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<ApprovalRequest[]>('/approvals');
      setApprovals(data);
    } catch {
      // Ignored for testing
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [activeOrg]);

  const handleDecide = async (
    approvalId: string,
    decision: 'approved' | 'rejected',
    notes?: string,
  ) => {
    await apiClient.post(`/approvals/${approvalId}/decide`, {
      decision,
      notes,
    });
    await fetchApprovals();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Inbox className="h-6 w-6 text-primary" />
              Unified Approvals Inbox & Human Gates
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              All 6 SDLC Gates
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cross-project aggregated inbox for reviewing and approving Business Cases, User Stories,
            Architecture proposals, Code PRs, and Staging/Production releases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchApprovals}
            disabled={isLoading}
            className="text-xs border-border gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Inbox
          </Button>
        </div>
      </div>

      {/* Unified Inbox Component */}
      <UnifiedApprovalsInbox approvals={approvals} onDecide={handleDecide} isLoading={isLoading} />
    </div>
  );
}
