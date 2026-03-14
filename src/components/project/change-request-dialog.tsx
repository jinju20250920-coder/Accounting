'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/useProjectStore';
import { ChangeRequest } from '@/stores/useProjectStore';
import { CheckCircle, XCircle, AlertTriangle, FileQuestion } from 'lucide-react';

interface ChangeRequestDialogProps {
  change?: ChangeRequest;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ChangeRequestDialog({ change, open = false, onOpenChange }: ChangeRequestDialogProps) {
  const { submitChange, reviewChange, implementChange } = useProjectStore();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'functional' as ChangeRequest['type'],
    priority: 'medium' as ChangeRequest['priority'],
    applicant: '',
    reviewer: '',
    estimatedEffort: '',
    impact: {
      technical: 'medium' as ChangeRequest['impact']['technical'],
      business: 'medium' as ChangeRequest['impact']['business'],
      schedule: 'medium' as ChangeRequest['impact']['schedule']
    },
    relatedTasks: [] as string[],
    relatedDocs: [] as string[]
  });

  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (change) {
      setFormData({
        title: change.title,
        description: change.description,
        type: change.type,
        priority: change.priority,
        applicant: change.applicant,
        reviewer: change.reviewer,
        estimatedEffort: change.estimatedEffort.toString(),
        impact: change.impact,
        relatedTasks: change.relatedTasks,
        relatedDocs: change.relatedDocs
      });
      setDecision(null);
      setComments('');
    } else {
      // 重置表单
      setFormData({
        title: '',
        description: '',
        type: 'functional',
        priority: 'medium',
        applicant: '',
        reviewer: '',
        estimatedEffort: '',
        impact: {
          technical: 'medium',
          business: 'medium',
          schedule: 'medium'
        },
        relatedTasks: [],
        relatedDocs: []
      });
      setDecision(null);
      setComments('');
    }
  }, [change, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const changeData = {
        ...formData,
        estimatedEffort: parseInt(formData.estimatedEffort)
      };

      if (change) {
        // 现有变更请求，需要审核
        if (decision) {
          reviewChange(change.id, decision, comments);
        }
        if (change.status === 'approved') {
          implementChange(change.id);
        }
      } else {
        // 新建变更请求
        submitChange(changeData);
      }

      // 重置表单并关闭对话框
      setFormData({
        title: '',
        description: '',
        type: 'functional',
        priority: 'medium',
        applicant: '',
        reviewer: '',
        estimatedEffort: '',
        impact: {
          technical: 'medium',
          business: 'medium',
          schedule: 'medium'
        },
        relatedTasks: [],
        relatedDocs: []
      });
      setDecision(null);
      setComments('');

      onOpenChange?.(false);
    } catch (error) {
      console.error('Failed to save change request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeOptions = () => [
    { value: 'functional', label: '功能变更', icon: '🚀' },
    { value: 'non-functional', label: '非功能变更', icon: '⚙️' },
    { value: 'emergency', label: '紧急变更', icon: '🚨' },
    { value: 'documentation', label: '文档变更', icon: '📄' }
  ];

  const getPriorityOptions = () => [
    { value: 'low', label: '低优先级', color: 'bg-green-100 text-green-700' },
    { value: 'medium', label: '中优先级', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'high', label: '高优先级', color: 'bg-red-100 text-red-700' }
  ];

  const getImpactOptions = (type: 'technical' | 'business' | 'schedule') => [
    { value: 'low', label: '低', color: 'text-green-600' },
    { value: 'medium', label: '中', color: 'text-yellow-600' },
    { value: 'high', label: '高', color: 'text-red-600' }
  ];

  const canReview = change && change.status === 'in_review';
  const canImplement = change && change.status === 'approved';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {change ? '处理变更请求' : '提交变更申请'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本信息 */}
          <div className="space-y-2">
            <Label htmlFor="title">变更标题 *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="输入变更标题"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">变更描述 *</Label>
            <Textarea
              id="description"
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="详细描述变更内容和原因"
            />
          </div>

          {/* 变更类型和优先级 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>变更类型</Label>
              <div className="flex flex-wrap gap-2">
                {getTypeOptions().map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.type === option.value ? "default" : "outline"}
                    className="text-xs h-10"
                    onClick={() => setFormData({ ...formData, type: option.value as ChangeRequest['type'] })}
                  >
                    <span className="mr-1">{option.icon}</span>
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
                    className={`text-xs ${formData.priority === option.value ? option.color : ''}`}
                    onClick={() => setFormData({ ...formData, priority: option.value as ChangeRequest['priority'] })}
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
              <Label htmlFor="applicant">申请人 *</Label>
              <Input
                id="applicant"
                required
                value={formData.applicant}
                onChange={(e) => setFormData({ ...formData, applicant: e.target.value })}
                placeholder="输入申请人姓名"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reviewer">审核人</Label>
              <Input
                id="reviewer"
                value={formData.reviewer}
                onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
                placeholder="输入审核人姓名"
              />
            </div>
          </div>

          {/* 工作量预估 */}
          <div className="space-y-2">
            <Label htmlFor="estimatedEffort">预估工作量（小时） *</Label>
            <Input
              id="estimatedEffort"
              type="number"
              min="0"
              required
              value={formData.estimatedEffort}
              onChange={(e) => setFormData({ ...formData, estimatedEffort: e.target.value })}
              placeholder="例如：32"
            />
          </div>

          {/* 影响评估 */}
          <div className="space-y-2">
            <Label>影响评估</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">技术影响</Label>
                <div className="flex flex-wrap gap-2">
                  {getImpactOptions('technical').map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      className={`text-xs ${formData.impact.technical === option.value ? option.color : ''}`}
                      onClick={() => setFormData({
                        ...formData,
                        impact: { ...formData.impact, technical: option.value as any }
                      })}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">业务影响</Label>
                <div className="flex flex-wrap gap-2">
                  {getImpactOptions('business').map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      className={`text-xs ${formData.impact.business === option.value ? option.color : ''}`}
                      onClick={() => setFormData({
                        ...formData,
                        impact: { ...formData.impact, business: option.value as any }
                      })}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">进度影响</Label>
                <div className="flex flex-wrap gap-2">
                  {getImpactOptions('schedule').map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      className={`text-xs ${formData.impact.schedule === option.value ? option.color : ''}`}
                      onClick={() => setFormData({
                        ...formData,
                        impact: { ...formData.impact, schedule: option.value as any }
                      })}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 相关资源 */}
          <div className="space-y-2">
            <Label>相关任务</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                暂无关联任务
              </Badge>
              <Button type="button" variant="ghost" size="sm" className="text-xs">
                + 添加关联
              </Button>
            </div>
          </div>

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

          {/* 审核决策 */}
          {canReview && (
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium">审核决策</h4>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={`flex-1 ${
                      decision === 'approved' ? 'bg-green-100 text-green-700' : ''
                    }`}
                    onClick={() => setDecision('approved')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    批准
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={`flex-1 ${
                      decision === 'rejected' ? 'bg-red-100 text-red-700' : ''
                    }`}
                    onClick={() => setDecision('rejected')}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    拒绝
                  </Button>
                </div>

                {(decision === 'approved' || decision === 'rejected') && (
                  <div className="space-y-2">
                    <Label>审核意见</Label>
                    <Textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="请输入审核意见..."
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
            >
              取消
            </Button>
            {canReview && (
              <Button
                type="submit"
                disabled={isSubmitting || (!decision && !canImplement)}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? '处理中...' : decision === 'approved' ? '批准' : decision === 'rejected' ? '拒绝' : '保存'}
              </Button>
            )}
            {canImplement && (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? '实施中...' : '实施变更'}
              </Button>
            )}
            {!change && !canReview && !canImplement && (
              <Button
                type="submit"
                disabled={isSubmitting || !formData.title || !formData.description || !formData.applicant || !formData.estimatedEffort}
              >
                {isSubmitting ? '提交中...' : '提交申请'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}