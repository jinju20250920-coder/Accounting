'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

interface AccountingPeriod {
  id: string;
  name: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'open' | 'closed' | 'locked';
  statusColor: 'gray' | 'blue' | 'green' | 'red';
  voucherCount: number;
  lastVoucherNo: string;
  closingBalance?: number;
  isCurrent: boolean;
  canEdit: boolean;
  canClose: boolean;
  canReopen: boolean;
}

interface PeriodTemplate {
  id: string;
  name: string;
  months: number[];
  description: string;
}

export function PeriodManagement() {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'periods' | 'templates' | 'settings'>('periods');

  // 模拟会计期间数据
  const accountingPeriods: AccountingPeriod[] = useMemo(() => [
    {
      id: '1',
      name: '2026年3月',
      year: 2026,
      month: 3,
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      status: 'open',
      statusColor: 'blue',
      voucherCount: 45,
      lastVoucherNo: '记-202603-045',
      isCurrent: true,
      canEdit: true,
      canClose: true,
      canReopen: false
    },
    {
      id: '2',
      name: '2026年2月',
      year: 2026,
      month: 2,
      startDate: '2026-02-01',
      endDate: '2026-02-29',
      status: 'closed',
      statusColor: 'green',
      voucherCount: 38,
      lastVoucherNo: '记-202602-038',
      closingBalance: 2500000,
      isCurrent: false,
      canEdit: false,
      canClose: false,
      canReopen: true
    },
    {
      id: '3',
      name: '2026年1月',
      year: 2026,
      month: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      status: 'closed',
      statusColor: 'green',
      voucherCount: 42,
      lastVoucherNo: '记-202601-042',
      closingBalance: 2400000,
      isCurrent: false,
      canEdit: false,
      canClose: false,
      canReopen: true
    },
    {
      id: '4',
      name: '2025年12月',
      year: 2025,
      month: 12,
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      status: 'locked',
      statusColor: 'red',
      voucherCount: 56,
      lastVoucherNo: '记-202512-056',
      closingBalance: 2350000,
      isCurrent: false,
      canEdit: false,
      canClose: false,
      canReopen: false
    }
  ], []);

  // 期间模板
  const periodTemplates: PeriodTemplate[] = [
    {
      id: '1',
      name: '自然年度',
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      description: '按自然年度划分，每年12个会计期间'
    },
    {
      id: '2',
      name: '财年4月制',
      months: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3],
      description: '财年开始于4月，结束于次年3月'
    },
    {
      id: '3',
      name: '季度期间',
      months: [1, 4, 7, 10],
      description: '按季度划分，每年4个会计期间'
    }
  ];

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

  const formatMonthName = (month: number) => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    return months[month - 1];
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
                variant={activeTab === 'templates' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('templates')}
              >
                期间模板
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('settings')}
              >
                期间设置
              </Button>
            </div>
            <Button>
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
                  onClick={() => setSelectedPeriod(period.id)}
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
                        <Button variant="ghost" size="sm">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {period.canReopen && (
                        <Button variant="ghost" size="sm">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
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

      {/* 期间模板 */}
      {activeTab === 'templates' && (
        <Card>
          <CardHeader>
            <CardTitle>会计期间模板</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {periodTemplates.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">包含期间:</span>
                      <Badge variant="outline" className="text-xs">
                        {template.months.length} 个月
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        应用
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">使用说明</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 选择适合企业会计制度的期间模板</li>
                <li>• 可以自定义期间的起止日期</li>
                <li>• 年度结转后自动锁定上年期间</li>
                <li>• 支持跨年期间的连续性管理</li>
              </ul>
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
            {/* 当前期间设置 */}
            <div className="space-y-4">
              <h4 className="font-medium">当前期间设置</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">会计年度</label>
                  <Input defaultValue="2026" className="w-full" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">当前期间</label>
                  <select className="w-full p-2 border rounded">
                    <option>2026年3月</option>
                    <option>2026年2月</option>
                    <option>2026年1月</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 期间管理设置 */}
            <div className="space-y-4">
              <h4 className="font-medium">期间管理设置</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-sm">自动期间结转</p>
                    <p className="text-xs text-muted-foreground">到期末自动进行期间结转</p>
                  </div>
                  <Button variant="outline" size="sm">
                    启用
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-sm">期间锁定</p>
                    <p className="text-xs text-muted-foreground">结转后自动锁定期间</p>
                  </div>
                  <Button variant="outline" size="sm">
                    启用
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-sm">跨期间凭证</p>
                    <p className="text-xs text-muted-foreground">允许录入跨期间的凭证</p>
                  </div>
                  <Button variant="outline" size="sm">
                    禁用
                  </Button>
                </div>
              </div>
            </div>

            {/* 保存设置 */}
            <div className="flex justify-end gap-2">
              <Button variant="outline">重置</Button>
              <Button>保存设置</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 快速操作 */}
      <div className="flex gap-2">
        <Button variant="outline">
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
      {accountingPeriods.find(p => p.isCurrent) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Play className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-800 mb-1">
                  当前期间: {accountingPeriods.find(p => p.isCurrent)?.name}
                </h4>
                <p className="text-sm text-blue-700">
                  可以正常录入凭证。本期已录入 {accountingPeriods.find(p => p.isCurrent)?.voucherCount} 张凭证。
                </p>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm">
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
    </div>
  );
}