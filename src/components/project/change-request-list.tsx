'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/useProjectStore';
import { ChangeRequest } from '@/stores/useProjectStore';
import { ChangeRequestDialog } from './change-request-dialog';
import {
  FileQuestion,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  User,
  Calendar
} from 'lucide-react';

export function ChangeRequestList() {
  const {
    changes,
    getChangeByStatus
  } = useProjectStore();

  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);

  // 按状态分组
  const pendingChanges = getChangeByStatus('pending');
  const inReviewChanges = getChangeByStatus('in_review');
  const approvedChanges = getChangeByStatus('approved');
  const rejectedChanges = getChangeByStatus('rejected');
  const implementedChanges = getChangeByStatus('implemented');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'in_review':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'implemented':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: '待处理',
      in_review: '审核中',
      approved: '已批准',
      rejected: '已拒绝',
      implemented: '已实施'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      functional: '功能变更',
      'non-functional': '非功能变更',
      emergency: '紧急变更',
      documentation: '文档变更'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getImpactColor = (impact: string) => {
    const colors = {
      low: 'text-green-600',
      medium: 'text-yellow-600',
      high: 'text-red-600'
    };
    return colors[impact as keyof typeof colors] || 'text-gray-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">需求变更管理</h2>
        <ChangeRequestDialog />
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingChanges.length}</div>
            <p className="text-xs text-muted-foreground">等待处理</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">审核中</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inReviewChanges.length}</div>
            <p className="text-xs text-muted-foreground">正在审核</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已批准</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedChanges.length}</div>
            <p className="text-xs text-muted-foreground">等待实施</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已实施</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{implementedChanges.length}</div>
            <p className="text-xs text-muted-foreground">已完成</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总变更</CardTitle>
            <FileQuestion className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{changes.length}</div>
            <p className="text-xs text-muted-foreground">所有变更</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending">待处理 ({pendingChanges.length})</TabsTrigger>
          <TabsTrigger value="in_review">审核中 ({inReviewChanges.length})</TabsTrigger>
          <TabsTrigger value="approved">已批准 ({approvedChanges.length})</TabsTrigger>
          <TabsTrigger value="rejected">已拒绝 ({rejectedChanges.length})</TabsTrigger>
          <TabsTrigger value="implemented">已实施 ({implementedChanges.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <ChangeRequestListContent
            changes={pendingChanges}
            title="待处理的变更请求"
          />
        </TabsContent>

        <TabsContent value="in_review" className="space-y-4">
          <ChangeRequestListContent
            changes={inReviewChanges}
            title="审核中的变更请求"
          />
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <ChangeRequestListContent
            changes={approvedChanges}
            title="已批准的变更请求"
          />
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <ChangeRequestListContent
            changes={rejectedChanges}
            title="已拒绝的变更请求"
          />
        </TabsContent>

        <TabsContent value="implemented" className="space-y-4">
          <ChangeRequestListContent
            changes={implementedChanges}
            title="已实施的变更请求"
          />
        </TabsContent>
      </Tabs>

      {/* 变更详情弹窗 */}
      {selectedChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{selectedChange.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChange(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                {/* 基本信息 */}
                <div className="flex items-center gap-4 text-sm">
                  {getStatusIcon(selectedChange.status)}
                  <Badge>{getStatusLabel(selectedChange.status)}</Badge>
                  <Badge variant="outline">{getTypeLabel(selectedChange.type)}</Badge>
                  <Badge className={getPriorityColor(selectedChange.priority)}>
                    {selectedChange.priority === 'low' && '低优先级'}
                    {selectedChange.priority === 'medium' && '中优先级'}
                    {selectedChange.priority === 'high' && '高优先级'}
                  </Badge>
                </div>

                {/* 变更描述 */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">变更描述</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedChange.description}
                  </p>
                </div>

                {/* 影响评估 */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">影响评估</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">技术影响：</span>
                      <span className={getImpactColor(selectedChange.impact.technical)}>
                        {selectedChange.impact.technical === 'low' && '低'}
                        {selectedChange.impact.technical === 'medium' && '中'}
                        {selectedChange.impact.technical === 'high' && '高'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">业务影响：</span>
                      <span className={getImpactColor(selectedChange.impact.business)}>
                        {selectedChange.impact.business === 'low' && '低'}
                        {selectedChange.impact.business === 'medium' && '中'}
                        {selectedChange.impact.business === 'high' && '高'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">进度影响：</span>
                      <span className={getImpactColor(selectedChange.impact.schedule)}>
                        {selectedChange.impact.schedule === 'low' && '低'}
                        {selectedChange.impact.schedule === 'medium' && '中'}
                        {selectedChange.impact.schedule === 'high' && '高'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 预估和实际工作量 */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">工作量</h4>
                  <div className="flex gap-4 text-sm">
                    <span>预估工作量：{selectedChange.estimatedEffort} 小时</span>
                    {selectedChange.actualEffort && (
                      <span>实际工作量：{selectedChange.actualEffort} 小时</span>
                    )}
                  </div>
                </div>

                {/* 相关信息 */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">相关人员</h4>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>申请人：{selectedChange.applicant}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>审核人：{selectedChange.reviewer}</span>
                    </div>
                  </div>
                </div>

                {/* 时间信息 */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">时间记录</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>提交时间：{formatDate(selectedChange.submitDate)}</span>
                    </div>
                    {selectedChange.decisionDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>审核时间：{formatDate(selectedChange.decisionDate)}</span>
                      </div>
                    )}
                    {selectedChange.implementationDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>实施时间：{formatDate(selectedChange.implementationDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 相关任务和文档 */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">关联资源</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">相关任务：</span>
                      {selectedChange.relatedTasks.length > 0 ? (
                        <span>{selectedChange.relatedTasks.length} 个</span>
                      ) : (
                        <span className="text-muted-foreground">无</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">相关文档：</span>
                      {selectedChange.relatedDocs.length > 0 ? (
                        <span>{selectedChange.relatedDocs.length} 个</span>
                      ) : (
                        <span className="text-muted-foreground">无</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              {selectedChange.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t">
                  <ChangeRequestDialog change={selectedChange} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChangeRequestListContentProps {
  changes: ChangeRequest[];
  title: string;
}

function ChangeRequestListContent({ changes, title }: ChangeRequestListContentProps) {
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);

  if (changes.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <FileQuestion className="mx-auto h-12 w-12 mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">暂无{title}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {changes.map((change) => (
            <div
              key={change.id}
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => setSelectedChange(change)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{change.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {change.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant="outline" className="text-xs">
                    {change.type === 'functional' && '功能'}
                    {change.type === 'non-functional' && '非功能'}
                    {change.type === 'emergency' && '紧急'}
                    {change.type === 'documentation' && '文档'}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      change.priority === 'low' ? 'bg-green-100 text-green-700' :
                      change.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}
                  >
                    {change.priority === 'low' && '低'}
                    {change.priority === 'medium' && '中'}
                    {change.priority === 'high' && '高'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>申请人：{change.applicant}</span>
                <span>预估：{change.estimatedEffort}小时</span>
                <span>{new Date(change.submitDate).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}