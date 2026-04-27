'use client';

import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Calendar,
  Plus,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Database,
  Users,
  Settings,
  ChevronRight
} from 'lucide-react';
import { usePeriodManagementStore, PeriodTemplate } from '@/stores/usePeriodManagementStore';
import { useAccountSetStore, type AccountingPeriod } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';

export function PeriodManagement() {
  const { showToast } = useToast();
  const {
    activeTab,
    selectPeriod,
    setActiveTab,
    closePeriod,
    reopenPeriod,
    setCurrentPeriod,
    getCurrentPeriod,
    closeCurrentPeriod,
    createPeriod
  } = usePeriodManagementStore();

  // 直接从账套 store 订阅期间数据（响应式）
  const accountingPeriods = useAccountSetStore(
    useShallow((s) => s.accountSets.find(a => a.id === s.currentAccountSetId)?.accountingPeriods || [])
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  // 新建期间对话框状态
  const [showCreatePeriodDialog, setShowCreatePeriodDialog] = useState(false);
  const [newPeriodMonth, setNewPeriodMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleCreatePeriod = () => {
    const [yearStr, monthStr] = newPeriodMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const periodId = `${year}${String(month).padStart(2, '0')}`;

    if (accountingPeriods.some(p => p.id === periodId)) {
      showToast('warning', `${year}年${month}月期间已存在`);
      return;
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    createPeriod({
      name: `${year}年${month}月`,
      year,
      month,
      startDate,
      endDate,
      status: 'open',
      statusColor: 'blue',
      voucherCount: 0,
      lastVoucherNo: `记-${year}${String(month).padStart(2, '0')}-000`,
      isCurrent: !accountingPeriods.some(p => p.isCurrent),
      canEdit: true,
      canClose: true,
      canReopen: false
    });

    setShowCreatePeriodDialog(false);
    showToast('success', `已创建 ${year}年${month}月期间`);
  };

  const getStatusBadge = (status: AccountingPeriod['status']) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">未开账</Badge>;
      case 'open':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">进行中</Badge>;
      case 'closed':
        return <Badge variant="default" className="bg-green-100 text-green-800">已结转</Badge>;
      case 'locked':
        return <Badge variant="destructive">已锁定</Badge>;
    }
  };

  const getStatusColor = (color: AccountingPeriod['statusColor']) => {
    switch (color) {
      case 'blue': return 'border-blue-200 bg-blue-50';
      case 'green': return 'border-green-200 bg-green-50';
      case 'red': return 'border-red-200 bg-red-50';
      case 'gray': return 'border-gray-200 bg-gray-50';
    }
  };

  // 统计数据
  const stats = useMemo(() => {
    const totalPeriods = accountingPeriods.length;
    const openPeriods = accountingPeriods.filter(p => p.status === 'open').length;
    const closedPeriods = accountingPeriods.filter(p => p.status === 'closed').length;
    const totalVouchers = accountingPeriods.reduce((sum, p) => sum + p.voucherCount, 0);

    return { totalPeriods, openPeriods, closedPeriods, totalVouchers };
  }, [accountingPeriods]);

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">会计期间</p>
                <p className="text-2xl font-bold">{stats.totalPeriods}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">进行中</p>
                <p className="text-2xl font-bold text-blue-600">{stats.openPeriods}</p>
              </div>
              <Play className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已结转</p>
                <p className="text-2xl font-bold text-green-600">{stats.closedPeriods}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">凭证总数</p>
                <p className="text-2xl font-bold">{stats.totalVouchers.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 标签页 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'periods' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('periods')}
              >
                期间管理
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('settings')}
              >
                期间设置
              </Button>
            </div>
            <Button onClick={() => setShowCreatePeriodDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建期间
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 期间管理 */}
      {activeTab === 'periods' && (
        <Card>
          <CardHeader>
            <CardTitle>会计期间列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {accountingPeriods.map((period) => (
                <div
                  key={period.id}
                  className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-all ${getStatusColor(period.statusColor)} ${selectedPeriod === period.id ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => selectPeriod(period.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{period.name}</h3>
                        {getStatusBadge(period.status)}
                        {period.isCurrent && (
                          <Badge variant="default" className="bg-yellow-100 text-yellow-800">当前期间</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">起止日期:</span>
                          <span className="ml-2">{period.startDate} ~ {period.endDate}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">凭证数量:</span>
                          <span className="ml-2 font-medium">{period.voucherCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">最后凭证:</span>
                          <span className="ml-2 font-mono text-xs">{period.lastVoucherNo}</span>
                        </div>
                        {period.closingBalance && (
                          <div>
                            <span className="text-muted-foreground">期末余额:</span>
                            <span className="ml-2 font-medium text-green-600">
                              ¥{period.closingBalance.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {period.canEdit && (
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {period.canClose && (
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          closePeriod(period.id);
                        }}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {period.canReopen && (
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          reopenPeriod(period.id);
                        }}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {!period.isCurrent && (
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPeriod(period.id);
                        }}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 状态信息 */}
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {period.status === 'open' && (
                        <span className="text-blue-600">
                          <Clock className="h-3 w-3 inline mr-1" />
                          可以录入凭证
                        </span>
                      )}
                      {period.status === 'closed' && (
                        <span className="text-green-600">
                          <CheckCircle className="h-3 w-3 inline mr-1" />
                          已结转，不可修改
                        </span>
                      )}
                      {period.status === 'locked' && (
                        <span className="text-red-600">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          年度已锁定
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 期间设置 */}
      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>期间设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 当前期间信息 */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">当前期间</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {getCurrentPeriod()?.name || '未设置'}
                  </p>
                </div>
                {getCurrentPeriod() && (
                  <Badge className="bg-blue-100 text-blue-700">
                    {getCurrentPeriod()?.status === 'open' ? '已开启' : '已关闭'}
                  </Badge>
                )}
              </div>
            </div>

            {/* 期间规则 */}
            <div className="space-y-4">
              <h4 className="font-medium text-slate-900">期间规则</h4>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">结账后自动锁定</p>
                  <p className="text-xs text-slate-500">关闭期间后自动锁定，防止修改已结账数据</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showToast('info', '此功能将在后续版本中实现')}
                >
                  已启用
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">反结账需审批</p>
                  <p className="text-xs text-slate-500">重新开启已关闭期间时需要确认操作</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showToast('info', '此功能将在后续版本中实现')}
                >
                  已禁用
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">跨年自动结转</p>
                  <p className="text-xs text-slate-500">年末自动结转损益并创建新年度期间</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showToast('info', '此功能将在后续版本中实现')}
                >
                  已禁用
                </Button>
              </div>
            </div>

            {/* 操作说明 */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-medium text-amber-800 mb-2">操作说明</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• 在"期间管理"中新建或管理会计期间</li>
                <li>• 关闭期间后将无法录入该期间的凭证</li>
                <li>• 重新开启期间需要确认操作</li>
                <li>• 当前期间标识正在使用的会计期间</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 快速操作 */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={closeCurrentPeriod}>
          <Calendar className="h-4 w-4 mr-2" />
          期间结转
        </Button>
        <Button variant="outline">
          <Copy className="h-4 w-4 mr-2" />
          复制期间
        </Button>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          导出期间数据
        </Button>
      </div>

      {/* 当前期间状态提示 */}
      {getCurrentPeriod() && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Play className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-800 mb-1">
                  当前期间: {getCurrentPeriod()?.name}
                </h4>
                <p className="text-sm text-blue-700">
                  可以正常录入凭证。本期已录入 {getCurrentPeriod()?.voucherCount} 张凭证。
                </p>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={closeCurrentPeriod}>
                    结转本期
                  </Button>
                  <Button variant="ghost" size="sm">
                    期间统计
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 新建期间对话框 */}
      <Dialog open={showCreatePeriodDialog} onOpenChange={setShowCreatePeriodDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建会计期间</DialogTitle>
            <DialogDescription>选择要创建的会计期间年月</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ChineseMonthPicker
              value={newPeriodMonth}
              onChange={setNewPeriodMonth}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePeriodDialog(false)}>取消</Button>
            <Button onClick={handleCreatePeriod}>确认创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
