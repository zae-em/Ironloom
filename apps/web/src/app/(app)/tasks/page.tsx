'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckSquare, Sparkles, RefreshCw } from 'lucide-react';
import { KanbanBoard, KanbanTask } from '@/components/tasks/kanban-board';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export default function TasksPage() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTasksFromApprovedStories = async () => {
    setIsLoading(true);
    try {
      const projects = await apiClient.get<any[]>('/projects').catch(() => []);
      const activeProjId = projects[0]?.id || '00000000-0000-0000-0000-000000000001';

      const stories = await apiClient
        .get<any[]>(`/projects/${activeProjId}/sdlc/user-stories`)
        .catch(() => []);

      if (stories && stories.length > 0) {
        const mappedTasks: KanbanTask[] = stories.map((s, idx) => {
          let status: KanbanTask['status'] = 'backlog';
          if (s.status === 'approved') status = idx % 2 === 0 ? 'in_progress' : 'done';
          else if (s.status === 'in_review') status = 'in_review';

          return {
            id: s.id,
            title: s.title,
            description: `As a ${s.asA}, I want ${s.iWant} so that ${s.soThat}`,
            status,
            priority: idx % 3 === 0 ? 'critical' : idx % 2 === 0 ? 'high' : 'medium',
            storyId: s.id,
            assignee: idx % 2 === 0 ? 'Developer Agent' : 'Human Engineer',
            sizing: idx % 2 === 0 ? 'M' : 'S',
          };
        });
        setTasks(mappedTasks);
      }
    } catch {
      toast.error('Failed to load user stories for task board');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasksFromApprovedStories();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Engineering Tasks & Sprint Execution
            </h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
              Kanban Workflow
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Sprint board automatically populated from approved user stories with manual status
            overrides.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadTasksFromApprovedStories}
          className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Sync from Stories
        </Button>
      </div>

      <KanbanBoard initialTasks={tasks} />
    </div>
  );
}
