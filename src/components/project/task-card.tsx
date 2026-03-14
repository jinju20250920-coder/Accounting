'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useProjectStore } from '@/stores/useProjectStore';
import { Task } from '@/stores/useProjectStore';
import { Edit, Trash2, Clock, User, Calendar, CheckCircle } from 'lucide-react';
import { TaskDialog } from './task-dialog';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const { moveTask, deleteTask } = useProjectStore();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      feature: '功能',
      bug: 'Bug',
      refactor: '重构',
      test: '测试',
      docs: '文档'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'in_progress':
        return <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />;
      case 'in_review':
        return <div className="h-4 w-4 rounded-full bg-yellow-500" />;
      case 'done':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'blocked':
        return <div className="h-4 w-4 rounded-full bg-red-500" />;
      default:
        return null;
    }
  };

  const getProgress = () => {
    if (!task.estimatedHours) return 0;
    return Math.min(((task.actualHours || 0) / task.estimatedHours) * 100, 100);
  };

  const handleStatusChange = (newStatus: Task['status']) => {
    moveTask(task.id, newStatus);
  };

  const handleDelete = () => {
    if (confirm('确定要删除这个任务吗？')) {
      deleteTask(task.id);
    }
  };

  return (
    <Card className="relative hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(task.status)}
            <CardTitle className="text-sm font-medium leading-none">
              {task.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Badge
              variant="secondary"
              className="text-xs"
              style={{ backgroundColor: `${getPriorityColor(task.priority)}20` }}
            >
              {getTypeLabel(task.type)}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs"
            >
              {getPriorityColor(task.priority).replace('bg-', 'text-')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>

        {/* 进度条 */}
        {task.estimatedHours && task.actualHours && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>进度</span>
              <span>{Math.round(getProgress())}%</span>
            </div>
            <Progress value={getProgress()} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{task.actualHours}h / {task.estimatedHours}h</span>
            </div>
          </div>
        )}

        {/* 截止日期 */}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(task.dueDate).toLocaleDateString('zh-CN')}
            </span>
          </div>
        )}

        {/* 负责人 */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{task.assignee}</span>
        </div>

        {/* 相关文档数 */}
        {task.relatedDocs.length > 0 && (
          <div className="text-xs text-muted-foreground">
            关联文档: {task.relatedDocs.length} 个
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => handleStatusChange('done')}
              title="标记完成"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleDelete}
              title="删除任务"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <TaskDialog task={task} />
        </div>
      </CardContent>
    </Card>
  );
}