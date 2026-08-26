'use client';

import React, { useState } from 'react';
import {
  Plus,
  MoreVertical,
  CheckCircle2,
  Clock,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Tag,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

export type TaskStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'critical' | 'high' | 'medium' | 'low';
  storyId?: string;
  assignee?: string;
  sizing?: string;
}

interface KanbanBoardProps {
  initialTasks?: KanbanTask[];
  onTaskMove?: (taskId: string, newStatus: TaskStatus) => void;
}

const COLUMNS: Array<{ id: TaskStatus; label: string; color: string; badgeColor: string }> = [
  { id: 'backlog', label: 'Backlog', color: 'border-slate-800', badgeColor: 'bg-slate-800 text-slate-300' },
  { id: 'in_progress', label: 'In Progress', color: 'border-blue-900/40', badgeColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/30' },
  { id: 'in_review', label: 'Review / QA', color: 'border-amber-900/40', badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' },
  { id: 'done', label: 'Done', color: 'border-emerald-900/40', badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' },
];

export function KanbanBoard({ initialTasks = [], onTaskMove }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<KanbanTask[]>(
    initialTasks.length > 0
      ? initialTasks
      : [
          {
            id: 'task-1',
            title: 'Implement obstacle avoidance vector calculation algorithm',
            description: 'Implement real-time collision prediction math under 100ms budget.',
            status: 'in_progress',
            priority: 'critical',
            sizing: 'M',
            assignee: 'Alice (Lead Dev)',
          },
          {
            id: 'task-2',
            title: 'Telemetry websocket ingestion gateway service',
            description: 'Setup streaming Redis pub/sub queue for incoming drone telemetry packets.',
            status: 'backlog',
            priority: 'high',
            sizing: 'L',
            assignee: 'DevOps Agent',
          },
          {
            id: 'task-3',
            title: 'Gherkin end-to-end acceptance test harness',
            description: 'Automate scenario verification for operator warning alerts.',
            status: 'in_review',
            priority: 'medium',
            sizing: 'S',
            assignee: 'QA Agent',
          },
          {
            id: 'task-4',
            title: 'PostgreSQL SDLC schema migrations with RLS policies',
            description: 'Enforce tenant-level isolation on business cases and requirement tables.',
            status: 'done',
            priority: 'critical',
            sizing: 'S',
            assignee: 'System Architect',
          },
        ],
  );

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [newStatus, setNewStatus] = useState<TaskStatus>('backlog');

  const moveTask = (taskId: string, targetStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)),
    );
    if (onTaskMove) onTaskMove(taskId, targetStatus);
    toast.success(`Task moved to ${targetStatus.replace('_', ' ')}`);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: KanbanTask = {
      id: `task-${Date.now()}`,
      title: newTitle,
      description: newDescription,
      status: newStatus,
      priority: newPriority,
      sizing: 'M',
      assignee: 'Human Engineer',
    };

    setTasks((prev) => [newTask, ...prev]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDescription('');
    toast.success('Task created successfully');
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Critical</span>;
      case 'high':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">High</span>;
      case 'medium':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Medium</span>;
      default:
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Low</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Board Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">SDLC Operational Task Board</h2>
          <p className="text-xs text-slate-400">
            Sprint backlog automatically populated from approved user stories
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Create Task
        </Button>
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((column) => {
          const colTasks = tasks.filter((t) => t.status === column.id);

          return (
            <div
              key={column.id}
              className="rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col min-h-[520px]"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 rounded-t-xl">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {column.label}
                </span>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${column.badgeColor}`}>
                  {colTasks.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="p-3 flex-1 space-y-3 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg text-slate-600 text-xs">
                    Empty column
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-indigo-500/40 transition-all duration-200 shadow-md space-y-2.5 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {getPriorityBadge(task.priority)}
                        {task.sizing && (
                          <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">
                            {task.sizing}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-slate-100 leading-snug">
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-500" />
                          <span className="truncate max-w-[100px]">{task.assignee || 'Unassigned'}</span>
                        </div>

                        {/* Quick Move Arrows */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {column.id !== 'backlog' && (
                            <button
                              type="button"
                              onClick={() => {
                                const idx = COLUMNS.findIndex((c) => c.id === column.id);
                                if (idx > 0) moveTask(task.id, COLUMNS[idx - 1].id);
                              }}
                              title="Move left"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}

                          {column.id !== 'done' && (
                            <button
                              type="button"
                              onClick={() => {
                                const idx = COLUMNS.findIndex((c) => c.id === column.id);
                                if (idx < COLUMNS.length - 1) moveTask(task.id, COLUMNS[idx + 1].id);
                              }}
                              title="Move right"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              Create SDLC Task
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Add a manual engineering task or override to the sprint board.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Task Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Optimize Redis payload serialization"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                placeholder="Details, technical acceptance criteria, or PR notes..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e: any) => setNewPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Initial Column</label>
                <select
                  value={newStatus}
                  onChange={(e: any) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="backlog">Backlog</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">Review / QA</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
              >
                Create Task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
