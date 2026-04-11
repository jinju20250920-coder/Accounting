'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProjectStore } from '@/stores/useProjectStore';
import { Milestone } from '@/stores/useProjectStore';
import { Flag, Target, Calendar } from 'lucide-react';

interface MilestoneDialogProps {
  milestone?: Milestone;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MilestoneDialog({ milestone, open = false, onOpenChange }: MilestoneDialogProps) {
  const { addMilestone, updateMilestone } = useProjectStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetDate: '',
    status: 'planned' as Milestone['status'],
    progress: 0,
    tasks: [] as string[],
    criteria: [] as string[]
  });

  const [criteriaInput, setCriteriaInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (milestone) {
      setFormData({
        name: milestone.name,
        description: milestone.description,
        targetDate: milestone.targetDate.split('T')[0],
        status: milestone.status,
        progress: milestone.progress,
        tasks: milestone.tasks,
        criteria: milestone.criteria
      });
      setCriteriaInput('');
    } else {
      // 重置表单
      setFormData({
        name: '',
        description: '',
        targetDate: '',
        status: 'planned',
        progress: 0,
        tasks: [],
        criteria: []
      });
      setCriteriaInput('');
    }
  }, [milestone, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const milestoneData = {
        ...formData,
        targetDate: `${formData.targetDate}T00:00:00Z`
      };

      if (milestone) {
        // 更新里程碑
        updateMilestone(milestone.id, milestoneData);
      } else {
        // 新建里程碑
        addMilestone(milestoneData);
      }

      // 重置表单并关闭对话框
      setFormData({
        name: '',
        description: '',
        targetDate: '',
        status: 'planned',
        progress: 0,
        tasks: [],
        criteria: []
      });
      setCriteriaInput('');

      onOpenChange?.(false);
    } catch (error) {
      console.error('Failed to save milestone:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCriteria = () => {
    if (criteriaInput.trim() && !formData.criteria.includes(criteriaInput.trim())) {
      setFormData({
        ...formData,
        criteria: [...formData.criteria, criteriaInput.trim()]
      });
      setCriteriaInput('');
    }
  };

  const handleRemoveCriteria = (criteriaToRemove: string) => {
    setFormData({
      ...formData,
      criteria: formData.criteria.filter(criterion => criterion !== criteriaToRemove)
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCriteria();
    }
  };

  const getStatusOptions = () => [
    { value: 'planned', label: '计划中', icon: '⏳', color: 'bg-gray-100 text-gray-700' },
    { value: 'in_progress', label: '进行中', icon: '🔄', color: 'bg-blue-100 text-blue-700' },
    { value: 'completed', label: '已完成', icon: '✅', color: 'bg-green-100 text-green-700' },
    { value: 'delayed', label: '已延期', icon: '⚠️', color: 'bg-orange-100 text-orange-700' },
    { value: 'cancelled', label: '已取消', icon: '❌', color: 'bg-red-100 text-red-700' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {milestone ? '编辑里程碑' : '创建新里程碑'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本信息 */}
          <div className="space-y-2">
            <Label htmlFor="name">里程碑名称 *</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入里程碑名称"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述 *</Label>
            <Textarea
              id="description"
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="详细描述里程碑内容"
            />
          </div>

          {/* 状态和目标日期 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>状态 *</Label>
              <div className="grid grid-cols-3 gap-2">
                {getStatusOptions().map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.status === option.value ? "default" : "outline"}
                    className={`text-xs h-10 ${formData.status === option.value ? option.color : ''}`}
                    onClick={() => setFormData({ ...formData, status: option.value as Milestone['status'] })}
                  >
                    <span className="mr-1">{option.icon}</span>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetDate">目标日期 *</Label>
              <ChineseDatePicker
                value={formData.targetDate}
                onChange={(v) => setFormData({ ...formData, targetDate: v })}
              />
            </div>
          </div>

          {/* 进度条 */}
          {formData.status === 'in_progress' && (
            <div className="space-y-2">
              <Label htmlFor="progress">进度百分比 (%)</Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12 text-right">
                  {formData.progress}%
                </span>
              </div>
            </div>
          )}

          {/* 验收标准 */}
          <div className="space-y-2">
            <Label>验收标准</Label>
            <div className="flex gap-2">
              <Input
                value={criteriaInput}
                onChange={(e) => setCriteriaInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入验收标准后按回车添加"
                className="flex-1"
              />
              <Button type="button" onClick={handleAddCriteria}>
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.criteria.map((criterion, index) => (
                <div key={index} className="bg-gray-100 rounded-md px-3 py-1 flex items-center gap-2">
                  <span className="text-sm">{criterion}</span>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => handleRemoveCriteria(criterion)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 相关任务 */}
          <div className="space-y-2">
            <Label>相关任务</Label>
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">里程碑下包含的任务：</p>
              <div className="space-y-1">
                {formData.tasks.length > 0 ? (
                  formData.tasks.map((taskId, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Flag className="h-3 w-3 text-blue-500" />
                      <span>任务 {index + 1}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">暂无关联任务</p>
                )}
              </div>
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
              disabled={isSubmitting || !formData.name || !formData.description || !formData.targetDate}
            >
              {isSubmitting ? '保存中...' : (milestone ? '更新里程碑' : '创建里程碑')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}