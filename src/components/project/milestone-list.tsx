'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useProjectStore } from '@/stores/useProjectStore';
import { Milestone } from '@/stores/useProjectStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MilestoneDialog } from './milestone-dialog';
import {
  Flag,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Edit,
  Target,
  CalendarDays,
  Users
} from 'lucide-react';

export function MilestoneList() {
  const {
    milestones,
    updateMilestoneProgress
  } = useProjectStore();

  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // 按状态分组
  const plannedMilestones = milestones.filter(m => m.status === 'planned');
  const inProgressMilestones = milestones.filter(m => m.status === 'in_progress');
  const completedMilestones = milestones.filter(m => m.status === 'completed');
  const delayedMilestones = milestones.filter(m => m.status === 'delayed');
  const cancelledMilestones = milestones.filter(m => m.status === 'cancelled');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'in_progress':
        return <Target className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'delayed':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      planned: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      delayed: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      planned: '计划中',
      in_progress: '进行中',
      completed: '已完成',
      delayed: '已延期',
      cancelled: '已取消'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const calculateDaysUntil = (dateString: string) => {
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">里程碑管理</h2>
        <MilestoneDialog />
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">计划中</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plannedMilestones.length}</div>
            <p className="text-xs text-muted-foreground">等待开始</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">进行中</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressMilestones.length}</div>
            <p className="text-xs text-muted-foreground">正在实施</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已完成</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedMilestones.length}</div>
            <p className="text-xs text-muted-foreground">达成目标</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已延期</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{delayedMilestones.length}</div>
            <p className="text-xs text-muted-foreground">需要关注</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总里程碑</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{milestones.length}</div>
            <p className="text-xs text-muted-foreground">所有里程碑</p>
          </CardContent>
        </Card>
      </div>

      {/* 里程碑时间线 */}
      <Card>
        <CardHeader>
          <CardTitle>里程碑时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {milestones
              .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
              .map((milestone, index) => (
                <div key={milestone.id} className="relative">
                  {/* 时间线连接线 */}
                  {index < milestones.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-200"></div>
                  )}

                  <div className="flex gap-4">
                    {/* 里程碑标记 */}
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        milestone.status === 'completed' ? 'bg-green-100 text-green-700' :
                        milestone.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        milestone.status === 'delayed' ? 'bg-orange-100 text-orange-700' :
                        milestone.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {getStatusIcon(milestone.status)}
                      </div>
                      <div className="w-0.5 h-16 bg-gray-200"></div>
                    </div>

                    {/* 里程碑内容 */}
                    <Card className="flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{milestone.name}</h3>
                              <Badge className={getStatusColor(milestone.status)}>
                                {getStatusLabel(milestone.status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {milestone.description}
                            </p>

                            {/* 进度条 */}
                            {milestone.status === 'in_progress' && (
                              <div className="space-y-1 mb-3">
                                <div className="flex justify-between text-sm">
                                  <span>进度</span>
                                  <span>{milestone.progress}%</span>
                                </div>
                                <Progress value={milestone.progress} className="h-2" />
                              </div>
                            )}

                            {/* 时间信息 */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>目标日期：{formatDate(milestone.targetDate)}</span>
                              </div>
                              {milestone.actualDate && (
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  <span>完成日期：{formatDate(milestone.actualDate)}</span>
                                </div>
                              )}
                              {milestone.status !== 'completed' && milestone.status !== 'cancelled' && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    还有 {calculateDaysUntil(milestone.targetDate)} 天
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* 里程碑标准 */}
                            <div className="mt-3">
                              <h4 className="text-sm font-medium mb-2">验收标准</h4>
                              <ul className="text-sm text-muted-foreground space-y-1">
                                {milestone.criteria.map((criterion, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-1">•</span>
                                    <span>{criterion}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* 任务数量 */}
                            {milestone.tasks.length > 0 && (
                              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span>包含 {milestone.tasks.length} 个任务</span>
                              </div>
                            )}
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex gap-2 ml-4">
                            <Dialog>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedMilestone(milestone)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>编辑里程碑</DialogTitle>
                                </DialogHeader>
                                <MilestoneDialog milestone={milestone} />
                              </DialogContent>
                            </Dialog>

                            {milestone.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const newProgress = prompt('输入新的进度百分比（0-100）：', milestone.progress.toString());
                                  if (newProgress && !isNaN(parseInt(newProgress))) {
                                    updateMilestoneProgress(milestone.id, Math.min(100, Math.max(0, parseInt(newProgress))));
                                  }
                                }}
                              >
                                更新进度
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* 里程碑详情弹窗 */}
      {selectedMilestone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{selectedMilestone.name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMilestone(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge className={getStatusColor(selectedMilestone.status)}>
                    {getStatusLabel(selectedMilestone.status)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    进度：{selectedMilestone.progress}%
                  </span>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">描述</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedMilestone.description}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">时间信息</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">目标日期：</span>
                      <span>{formatDate(selectedMilestone.targetDate)}</span>
                    </div>
                    {selectedMilestone.actualDate && (
                      <div>
                        <span className="text-muted-foreground">完成日期：</span>
                        <span>{formatDate(selectedMilestone.actualDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">验收标准</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    {selectedMilestone.criteria.map((criterion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">相关任务</h4>
                  <div className="text-sm text-muted-foreground">
                    {selectedMilestone.tasks.length > 0 ? (
                      <ul className="space-y-1">
                        {selectedMilestone.tasks.map((taskId, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>任务 {index + 1}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">暂无关联任务</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}