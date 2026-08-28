'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Inbox,
  Sparkles,
  ShieldCheck,
  GitPullRequest,
  FileText,
  Layers,
  Cpu,
  Rocket,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { ApprovalRequest } from '@ironloom/shared';

interface UnifiedApprovalsInboxProps {
  approvals: ApprovalRequest[];
  onDecide: (
    approvalId: string,
    decision: 'approved' | 'rejected',
    notes?: string,
  ) => Promise<void>;
  isLoading?: boolean;
}

export function UnifiedApprovalsInbox({
  approvals,
  onDecide,
  isLoading = false,
}: UnifiedApprovalsInboxProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'decided'>('pending');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getGateBadge = (nodeName: string) => {
    switch (nodeName) {
      case 'gate_business_case':
        return {
          label: 'Gate 1: Business Case',
          icon: FileText,
          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
        };
      case 'gate_epics':
        return {
          label: 'Gate 2: Epics Breakdown',
          icon: Layers,
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        };
      case 'gate_requirements':
        return {
          label: 'Gate 3: User Stories',
          icon: FileText,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        };
      case 'gate_architecture':
        return {
          label: 'Gate 4: Architecture',
          icon: Cpu,
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        };
      case 'gate_pr_human_review':
        return {
          label: 'Gate 5: PR Code Review',
          icon: GitPullRequest,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        };
      case 'gate_prod_deploy':
        return {
          label: 'Gate 6: Prod Deployment',
          icon: Rocket,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        };
      default:
        return {
          label: nodeName.replace('gate_', '').replace('_', ' '),
          icon: ShieldCheck,
          color: 'text-primary bg-primary/10 border-primary/20',
        };
    }
  };

  const filteredApprovals = approvals.filter((a) => {
    if (selectedFilter === 'pending' && a.status !== 'pending') return false;
    if (selectedFilter === 'decided' && a.status === 'pending') return false;
    if (selectedType !== 'all' && !a.nodeName.includes(selectedType)) return false;
    return true;
  });

  const handleDecision = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setIsSubmitting(true);
    try {
      await onDecide(approvalId, decision, decisionNotes || undefined);
      setActiveDecisionId(null);
      setDecisionNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={selectedFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setSelectedFilter('pending')}
            className="text-xs"
          >
            Pending Action ({approvals.filter((a) => a.status === 'pending').length})
          </Button>
          <Button
            size="sm"
            variant={selectedFilter === 'decided' ? 'default' : 'outline'}
            onClick={() => setSelectedFilter('decided')}
            className="text-xs"
          >
            Decided History ({approvals.filter((a) => a.status !== 'pending').length})
          </Button>
          <Button
            size="sm"
            variant={selectedFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedFilter('all')}
            className="text-xs"
          >
            All ({approvals.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Filter approvals by SDLC Gate"
            className="px-3 py-1.5 rounded-md bg-accent/40 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All SDLC Gates</option>
            <option value="business_case">Gate 1: Business Case</option>
            <option value="epics">Gate 2: Epics</option>
            <option value="requirements">Gate 3: User Stories</option>
            <option value="architecture">Gate 4: Architecture</option>
            <option value="pr_human_review">Gate 5: Code Review</option>
            <option value="prod_deploy">Gate 6: Prod Deploy</option>
          </select>
        </div>
      </div>

      {/* Approvals Queue */}
      <div className="space-y-4">
        {filteredApprovals.length > 0 ? (
          filteredApprovals.map((req) => {
            const gate = getGateBadge(req.nodeName);
            const GateIcon = gate.icon;
            const isPending = req.status === 'pending';

            return (
              <Card
                key={req.id}
                className={`border-border/80 bg-card/60 backdrop-blur-sm transition-all ${
                  isPending ? 'ring-1 ring-amber-500/20' : 'opacity-70'
                }`}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Badge
                        className={`text-[10px] font-bold uppercase flex items-center gap-1.5 ${gate.color}`}
                      >
                        <GateIcon className="h-3.5 w-3.5" />
                        {gate.label}
                      </Badge>

                      <Badge
                        className={
                          req.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]'
                            : req.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px]'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]'
                        }
                      >
                        {req.status.toUpperCase()}
                      </Badge>

                      {req.autoApproved && (
                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">
                          POLICY AUTO-APPROVED
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(req.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Review Details Payload */}
                  <div className="rounded-lg bg-accent/20 p-3 border border-border/50 text-xs space-y-2">
                    <div className="font-semibold text-foreground">Payload Context:</div>
                    <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {JSON.stringify(req.payloadToReview || {}, null, 2)}
                    </pre>
                  </div>

                  {/* Decision Controls */}
                  {isPending && (
                    <div className="space-y-3 pt-2 border-t border-border/50">
                      {activeDecisionId === req.id ? (
                        <div className="space-y-2 p-3 rounded-lg bg-black/40 border border-primary/30">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-primary" />
                            Optional Reviewer Notes / Guidance:
                          </label>
                          <textarea
                            value={decisionNotes}
                            onChange={(e) => setDecisionNotes(e.target.value)}
                            placeholder="Add approval context or rejection feedback for the agent swarms..."
                            rows={2}
                            className="w-full px-3 py-1.5 rounded bg-accent/40 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveDecisionId(null)}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDecision(req.id, 'rejected')}
                              disabled={isSubmitting}
                              className="bg-red-600 hover:bg-red-500 text-white text-xs gap-1"
                            >
                              <X className="h-3.5 w-3.5" /> Confirm Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDecision(req.id, 'approved')}
                              disabled={isSubmitting}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1"
                            >
                              <Check className="h-3.5 w-3.5" /> Confirm Approve
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveDecisionId(req.id)}
                            className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setActiveDecisionId(req.id)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve Gate
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {req.notes && (
                    <div className="text-[11px] text-muted-foreground italic border-t border-border/40 pt-2">
                      Reviewer Note: "{req.notes}"
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="p-12 text-center border border-dashed border-border/70 rounded-xl space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-foreground text-sm">Approvals Inbox is Clear</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No pending approval requests require your review under the selected filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
