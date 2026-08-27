'use client';

import * as React from 'react';
import {
  CodeFileChange,
  PullRequestEntity,
  CodeReviewVerdict,
  CodeReviewComment,
  UserStory,
} from '@ironloom/shared';
import { cn } from '../../lib/utils';
import {
  FileCode,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Info,
  MessageSquare,
  Send,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Columns,
  AlignJustify,
  Check,
  ShieldAlert,
} from 'lucide-react';

interface CodeDiffViewerProps {
  pullRequest: PullRequestEntity;
  files: CodeFileChange[];
  reviewVerdict?: CodeReviewVerdict | null;
  userStory?: UserStory | null;
  onPostComment?: (file: string, line: number, comment: string) => Promise<void>;
}

export function CodeDiffViewer({
  pullRequest,
  files,
  reviewVerdict,
  userStory,
  onPostComment,
}: CodeDiffViewerProps) {
  const [selectedFilePath, setSelectedFilePath] = React.useState<string>(files[0]?.path || '');
  const [viewMode, setViewMode] = React.useState<'side-by-side' | 'unified'>('side-by-side');
  const [showStoryDetails, setShowStoryDetails] = React.useState(true);
  const [activeCommentLine, setActiveCommentLine] = React.useState<number | null>(null);
  const [newCommentText, setNewCommentText] = React.useState('');
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [localComments, setLocalComments] = React.useState<CodeReviewComment[]>(
    reviewVerdict?.comments || [],
  );

  React.useEffect(() => {
    if (files.length > 0 && !selectedFilePath) {
      setSelectedFilePath(files[0].path);
    }
  }, [files, selectedFilePath]);

  React.useEffect(() => {
    if (reviewVerdict?.comments) {
      setLocalComments(reviewVerdict.comments);
    }
  }, [reviewVerdict]);

  const selectedFile = React.useMemo(() => {
    return (
      files.find((f) => f.path === selectedFilePath) ||
      files[0] || {
        path: 'src/index.ts',
        action: 'create' as const,
        content: '// No files generated yet',
      }
    );
  }, [files, selectedFilePath]);

  const fileComments = React.useMemo(() => {
    return localComments.filter(
      (c) => c.file === selectedFile.path || selectedFile.path.endsWith(c.file),
    );
  }, [localComments, selectedFile]);

  // Compute diff lines for rendering
  const diffLines = React.useMemo(() => {
    const prevLines = (selectedFile.previousContent || '').split('\n');
    const newLines = (selectedFile.content || '').split('\n');

    if (selectedFile.action === 'create') {
      return newLines.map((line, idx) => ({
        type: 'added' as const,
        oldLineNumber: null,
        newLineNumber: idx + 1,
        oldText: '',
        newText: line,
      }));
    }

    if (selectedFile.action === 'delete') {
      return prevLines.map((line, idx) => ({
        type: 'removed' as const,
        oldLineNumber: idx + 1,
        newLineNumber: null,
        oldText: line,
        newText: '',
      }));
    }

    // Default line mapping
    const max = Math.max(prevLines.length, newLines.length);
    const result = [];
    for (let i = 0; i < max; i++) {
      const oldText = prevLines[i] ?? '';
      const newText = newLines[i] ?? '';
      const type =
        oldText === newText
          ? ('unchanged' as const)
          : !oldText
            ? ('added' as const)
            : !newText
              ? ('removed' as const)
              : ('modified' as const);

      result.push({
        type,
        oldLineNumber: i < prevLines.length ? i + 1 : null,
        newLineNumber: i < newLines.length ? i + 1 : null,
        oldText,
        newText,
      });
    }
    return result;
  }, [selectedFile]);

  const handleAddComment = async (lineNum: number) => {
    if (!newCommentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      if (onPostComment) {
        await onPostComment(selectedFile.path, lineNum, newCommentText);
      }
      const newComment: CodeReviewComment = {
        file: selectedFile.path,
        line: lineNum,
        comment: newCommentText,
        severity: 'suggestion',
      };
      setLocalComments((prev) => [...prev, newComment]);
      setNewCommentText('');
      setActiveCommentLine(null);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-md">
      {/* Top Header: Traceability & PR Details */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <GitPullRequest className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm tracking-tight">
                  PR #{pullRequest.prNumber}: {pullRequest.title}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    pullRequest.status === 'open' &&
                      'bg-blue-500/20 text-blue-400 border border-blue-500/30',
                    pullRequest.status === 'merged' &&
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
                    pullRequest.status === 'closed' && 'bg-zinc-500/20 text-zinc-400',
                  )}
                >
                  {pullRequest.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Branch: <code className="font-mono text-primary">{pullRequest.branchName}</code> →{' '}
                <code className="font-mono text-muted-foreground">{pullRequest.baseBranch}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 transition-colors',
                  viewMode === 'side-by-side'
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Side-by-Side Diff"
              >
                <Columns className="h-3.5 w-3.5" />
                <span className="text-[11px]">Split</span>
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 transition-colors',
                  viewMode === 'unified'
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Unified Diff"
              >
                <AlignJustify className="h-3.5 w-3.5" />
                <span className="text-[11px]">Unified</span>
              </button>
            </div>

            {pullRequest.url && (
              <a
                href={pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>GitHub PR</span>
              </a>
            )}
          </div>
        </div>

        {/* Upstream Lineage & Traceability Badge */}
        {userStory && (
          <div className="mt-1 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs">
            <button
              onClick={() => setShowStoryDetails((v) => !v)}
              className="flex w-full items-center justify-between font-semibold text-primary"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Traceability: Implements User Story &quot;{userStory.title}&quot;</span>
              </div>
              {showStoryDetails ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            {showStoryDetails && (
              <div className="mt-2 space-y-1.5 border-t border-primary/15 pt-2 text-muted-foreground">
                <p className="text-xs">
                  <strong className="text-foreground">As a:</strong> {userStory.asA} •{' '}
                  <strong className="text-foreground">I want:</strong> {userStory.iWant} •{' '}
                  <strong className="text-foreground">So that:</strong> {userStory.soThat}
                </p>
                {userStory.acceptanceCriteria && userStory.acceptanceCriteria.length > 0 && (
                  <div className="mt-1">
                    <span className="font-semibold text-foreground text-[11px]">
                      Acceptance Criteria:
                    </span>
                    <ul className="mt-1 space-y-1">
                      {userStory.acceptanceCriteria.map((ac: any, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px]">
                          <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            {typeof ac === 'string'
                              ? ac
                              : `${ac.scenarioTitle || 'Scenario'}: Given ${ac.givenText} When ${ac.whenText} Then ${ac.thenText}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Diff Area: File Tree & Diff Viewer */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[460px]">
        {/* Left Column: File Tree */}
        <div className="md:col-span-1 flex flex-col rounded-lg border border-border bg-card/60 p-2.5">
          <span className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Changed Files ({files.length})
          </span>
          <div className="mt-2 space-y-1 overflow-y-auto">
            {files.map((file) => {
              const isSelected = selectedFilePath === file.path;
              const commentsForThisFile = localComments.filter(
                (c) => c.file === file.path || file.path.endsWith(c.file),
              );

              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFilePath(file.path)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-mono transition-colors',
                    isSelected
                      ? 'bg-primary/20 text-primary border border-primary/30 font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{file.path}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {commentsForThisFile.length > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                        <MessageSquare className="h-2.5 w-2.5" />
                        {commentsForThisFile.length}
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded px-1 py-0.2 text-[9px] font-bold uppercase',
                        file.action === 'create' && 'bg-emerald-500/20 text-emerald-300',
                        file.action === 'modify' && 'bg-blue-500/20 text-blue-300',
                        file.action === 'delete' && 'bg-destructive/20 text-destructive',
                      )}
                    >
                      {file.action === 'create' ? '+' : file.action === 'modify' ? 'M' : '-'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Code Diff */}
        <div className="md:col-span-3 flex flex-col rounded-lg border border-border bg-card/80 overflow-hidden">
          {/* File Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-xs">
            <span className="font-mono font-semibold text-foreground flex items-center gap-1.5">
              <FileCode className="h-4 w-4 text-primary" />
              {selectedFile.path}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {diffLines.length} lines • Action: {selectedFile.action}
            </span>
          </div>

          {/* Diff Code Container */}
          <div className="flex-1 overflow-x-auto overflow-y-auto font-mono text-xs max-h-[600px] p-2 bg-zinc-950/90 text-zinc-200">
            {viewMode === 'side-by-side' ? (
              <table className="w-full border-collapse">
                <tbody>
                  {diffLines.map((line, idx) => {
                    const comment = fileComments.find(
                      (c) => c.line === line.newLineNumber || c.line === idx + 1,
                    );
                    const isCommentingOnThisLine =
                      activeCommentLine === (line.newLineNumber || idx + 1);

                    return (
                      <React.Fragment key={idx}>
                        <tr
                          className={cn(
                            'group hover:bg-zinc-800/40 transition-colors',
                            line.type === 'added' && 'bg-emerald-950/30 text-emerald-200',
                            line.type === 'removed' && 'bg-red-950/30 text-red-200',
                          )}
                        >
                          {/* Old Line Number & Content */}
                          <td className="w-10 select-none px-2 py-0.5 text-right text-[11px] text-zinc-600 border-r border-zinc-800">
                            {line.oldLineNumber || ''}
                          </td>
                          <td className="w-1/2 px-2 py-0.5 whitespace-pre-wrap break-all border-r border-zinc-800">
                            {line.oldText}
                          </td>

                          {/* New Line Number & Content */}
                          <td className="w-10 select-none px-2 py-0.5 text-right text-[11px] text-zinc-600 border-r border-zinc-800 relative">
                            {line.newLineNumber || ''}
                            {/* Inline Comment Trigger Button */}
                            <button
                              onClick={() =>
                                setActiveCommentLine(
                                  activeCommentLine === (line.newLineNumber || idx + 1)
                                    ? null
                                    : line.newLineNumber || idx + 1,
                                )
                              }
                              title="Add inline review comment"
                              className="absolute right-0.5 top-0.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded bg-primary text-primary-foreground text-[9px]"
                            >
                              +
                            </button>
                          </td>
                          <td className="w-1/2 px-2 py-0.5 whitespace-pre-wrap break-all">
                            {line.newText}
                          </td>
                        </tr>

                        {/* Render Attached Review Comments */}
                        {comment && (
                          <tr>
                            <td colSpan={4} className="p-2 bg-zinc-900 border-y border-zinc-700">
                              <div className="flex items-start gap-2.5 rounded-md border border-amber-500/40 bg-amber-950/30 p-2.5 text-xs text-amber-200">
                                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-amber-300">
                                      🤖 Code Reviewer Agent ({comment.severity.toUpperCase()})
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                      Line {comment.line}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-zinc-200">{comment.comment}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Inline Human Comment Form */}
                        {isCommentingOnThisLine && (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-2.5 bg-zinc-900 border-y border-primary/40"
                            >
                              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                                <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                                  Add Human Review Comment (Line {line.newLineNumber || idx + 1})
                                </span>
                                <textarea
                                  value={newCommentText}
                                  onChange={(e) => setNewCommentText(e.target.value)}
                                  placeholder="Type feedback to sync to GitHub PR..."
                                  rows={2}
                                  className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setActiveCommentLine(null)}
                                    className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={isSubmittingComment || !newCommentText.trim()}
                                    onClick={() => handleAddComment(line.newLineNumber || idx + 1)}
                                    className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>{isSubmittingComment ? 'Posting...' : 'Post to PR'}</span>
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* Unified Diff View */
              <div className="space-y-0.5">
                {diffLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center gap-2 px-2 py-0.5',
                      line.type === 'added' && 'bg-emerald-950/30 text-emerald-200',
                      line.type === 'removed' && 'bg-red-950/30 text-red-200',
                    )}
                  >
                    <span className="w-8 select-none text-right text-[11px] text-zinc-600">
                      {line.newLineNumber || line.oldLineNumber}
                    </span>
                    <span className="select-none w-3 text-center">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span className="whitespace-pre-wrap break-all flex-1">
                      {line.type === 'removed' ? line.oldText : line.newText}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
