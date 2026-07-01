'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/useProjectStore';
import type { Task } from '@/stores/useProjectStore';
import { TaskCard } from './task-card';
import { TaskDialog } from './task-dialog';
import { Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function KanbanBoard() {
  const {
    tasks,
    moveTask,
    searchQuery,
    setSearchQuery,
    getTasksByStatus
  } = useProjectStore();

  const filteredTasks = useMemo(() => ({
    todo: getTasksByStatus('todo'),
    in_progress: getTasksByStatus('in_progress'),
    in_review: getTasksByStatus('in_review'),
    done: getTasksByStatus('done'),
    blocked: getTasksByStatus('blocked')
  }), [tasks, getTasksByStatus]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    moveTask(taskId, newStatus as Task['status']);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      todo: {
        title: '待开始',
        color: 'bg-gray-100',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-700'
      },
      in_progress: {
        title: '进行中',
        color: 'bg-blue-100',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-700'
      },
      in_review: {
        title: '审核中',
        color: 'bg-yellow-100',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-700'
      },
      done: {
        title: '已完成',
        color: 'bg-green-100',
        borderColor: 'border-green-200',
        textColor: 'text-green-700'
      },
      blocked: {
        title: '阻塞',
        color: 'bg-red-100',
        borderColor: 'border-red-200',
        textColor: 'text-red-700'
      }
    };
    return configs[status as keyof typeof configs];
  };

  const statusKeys = ['todo', 'in_progress', 'in_review', 'done', 'blocked'] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">任务看板</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="搜索任务..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog>
              <Button onClick={() => {}}>
                <Plus className="mr-2 h-4 w-4" />
                新建任务
              </Button>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>创建新任务</DialogTitle>
              </DialogHeader>
              <TaskDialog />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {statusKeys.map((status) => (
          <div
            key={status}
            className="rounded-lg border"
            onDrop={(e) => handleDrop(e, status)}
            onDragOver={handleDragOver}
          >
            <CardHeader
              className={`${getStatusConfig(status).color} ${getStatusConfig(status).borderColor} rounded-t-lg`}
            >
              <CardTitle className="flex items-center justify-between text-sm">
                <span className={getStatusConfig(status).textColor}>
                  {getStatusConfig(status).title}
                </span>
                <Badge
                  variant="secondary"
                  className={getStatusConfig(status).textColor}
                >
                  {filteredTasks[status].length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {filteredTasks[status].map((task: Task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="cursor-move"
                >
                  <TaskCard task={task} />
                </div>
              ))}
              {filteredTasks[status].length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-sm">暂无任务</p>
                </div>
              )}
            </CardContent>
          </div>
        ))}
      </div>
    </div>
  );
}