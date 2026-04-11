'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/useProjectStore';
import { Task } from '@/stores/useProjectStore';

interface TaskDialogProps {
  task?: Task;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TaskDialog({ task, open = false, onOpenChange }: TaskDialogProps) {
  const { addTask, updateTask } = useProjectStore();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'feature' as Task['type'],
    priority: 'medium' as Task['priority'],
    assignee: '',
    reporter: '',
    estimatedHours: '',
    dueDate: '',
    dependencies: [] as string[],
    relatedDocs: [] as string[],
    relatedTests: [] as string[]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description,
        type: task.type,
        priority: task.priority,
        assignee: task.assignee,
        reporter: task.reporter,
        estimatedHours: task.estimatedHours?.toString() || '',
        dueDate: task.dueDate?.split('T')[0] || '',
        dependencies: task.dependencies,
        relatedDocs: task.relatedDocs,
        relatedTests: task.relatedTests
      });
    } else {
      // 重置表单
      setFormData({
        title: '',
        description: '',
        type: 'feature',
        priority: 'medium',
        assignee: '',
        reporter: '',
        estimatedHours: '',
        dueDate: '',
        dependencies: [],
        relatedDocs: [],
        relatedTests: []
      });
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const taskData = {
        ...formData,
        estimatedHours: formData.estimatedHours ? parseInt(formData.estimatedHours) : undefined,
        dueDate: formData.dueDate ? `${formData.dueDate}T00:00:00Z` : undefined
      };

      if (task) {
        // 更新任务
        updateTask(task.id, taskData);
      } else {
        // 新建任务
        addTask({
          ...taskData,
          status: 'todo',
          reporter: formData.reporter || '当前用户'
        });
      }

      // 重置表单并关闭对话框
      setFormData({
        title: '',
        description: '',
        type: 'feature',
        priority: 'medium',
        assignee: '',
        reporter: '',
        estimatedHours: '',
        dueDate: '',
        dependencies: [],
        relatedDocs: [],
        relatedTests: []
      });

      onOpenChange?.(false);
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeOptions = () => [
    { value: 'feature', label: '功能', color: 'bg-blue-100 text-blue-700' },
    { value: 'bug', label: 'Bug', color: 'bg-red-100 text-red-700' },
    { value: 'refactor', label: '重构', color: 'bg-purple-100 text-purple-700' },
    { value: 'test', label: '测试', color: 'bg-green-100 text-green-700' },
    { value: 'docs', label: '文档', color: 'bg-gray-100 text-gray-700' }
  ];

  const getPriorityOptions = () => [
    { value: 'low', label: '低', color: 'bg-green-100 text-green-700' },
    { value: 'medium', label: '中', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'high', label: '高', color: 'bg-orange-100 text-orange-700' },
    { value: 'critical', label: '紧急', color: 'bg-red-100 text-red-700' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? '编辑任务' : '创建新任务'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本信息 */}
          <div className="space-y-2">
            <Label htmlFor="title">任务标题 *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="输入任务标题"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">任务描述 *</Label>
            <Textarea
              id="description"
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="详细描述任务内容"
            />
          </div>

          {/* 任务类型和优先级 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>任务类型</Label>
              <div className="flex flex-wrap gap-2">
                {getTypeOptions().map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.type === option.value ? "default" : "outline"}
                    className={`text-xs ${
                      formData.type === option.value ? option.color : ''
                    }`}
                    onClick={() => setFormData({ ...formData, type: option.value as Task['type'] })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>优先级</Label>
              <div className="flex flex-wrap gap-2">
                {getPriorityOptions().map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.priority === option.value ? "default" : "outline"}
                    className={`text-xs ${
                      formData.priority === option.value ? option.color : ''
                    }`}
                    onClick={() => setFormData({ ...formData, priority: option.value as Task['priority'] })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 人员信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignee">负责人 *</Label>
              <Input
                id="assignee"
                required
                value={formData.assignee}
                onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                placeholder="输入负责人姓名"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reporter">报告人</Label>
              <Input
                id="reporter"
                value={formData.reporter}
                onChange={(e) => setFormData({ ...formData, reporter: e.target.value })}
                placeholder="输入报告人姓名"
              />
            </div>
          </div>

          {/* 时间信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">预计工时（小时）</Label>
              <Input
                id="estimatedHours"
                type="number"
                min="0"
                step="0.5"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                placeholder="例如：8"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">截止日期</Label>
              <ChineseDatePicker
                value={formData.dueDate}
                onChange={(v) => setFormData({ ...formData, dueDate: v })}
              />
            </div>
          </div>

          {/* 相关资源 */}
          <div className="space-y-2">
            <Label>相关文档</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                暂无关联文档
              </Badge>
              <Button type="button" variant="ghost" size="sm" className="text-xs">
                + 添加关联
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>依赖任务</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                暂无依赖任务
              </Badge>
              <Button type="button" variant="ghost" size="sm" className="text-xs">
                + 添加依赖
              </Button>
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.title || !formData.description || !formData.assignee}
            >
              {isSubmitting ? '保存中...' : (task ? '更新任务' : '创建任务')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}