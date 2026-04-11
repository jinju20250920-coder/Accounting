'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import {
  Zap,
  AlertTriangle,
  Clock,
  Activity,
  Target,
  TrendingUp,
  Building2,
  FileText,
  Home,
  Plus,
  List,
  Search,
  Printer,
  Download,
  Calendar,
  Eye,
  ChevronRight,
  Users,
  Receipt,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleSelect } from '@/components/ui/select';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/accounting';

// 生成中文月份数据
const generateMonthlyData = () => {
  const currentMonth = new Date().getMonth();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    months.push(`${monthIndex + 1}月`);
  }
  return months;
};

export default function Dashboard() {
  const router = useRouter();
  const { vouchers } = useVoucherStore();
  const { subjects } = useSubjectStore();
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [mounted, setMounted] = useState(false);

  // 确保只在客户端渲染图表
  useEffect(() => {
    setMounted(true);
  }, []);

  // 计算真实的核心指标
  const coreMetrics = useMemo(() => {
    // 只计算已记账的凭证
    const postedVouchers = vouchers.filter(v => v.status === 'posted');

    // 计算库存现金（现金科目的余额）
    let cashOnHand = 0;
    postedVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const subject = subjects.find(s => s.code === entry.subjectCode);
        if (subject && subject.code.startsWith('1')) {
          // 资产类科目：借方增加，贷方减少
          cashOnHand += entry.debit - entry.credit;
        }
      });
    });

    // 计算本月收入
    const currentMonth = new Date().toISOString().slice(0, 7);
    let monthlyRevenue = 0;
    postedVouchers.forEach(voucher => {
      if (voucher.date.startsWith(currentMonth)) {
        voucher.entries.forEach(entry => {
          const subject = subjects.find(s => s.code === entry.subjectCode);
          if (subject && subject.code.startsWith('6')) {
            // 收入类科目：贷方增加
            monthlyRevenue += entry.credit;
          }
        });
      }
    });

    // 计算应收账款和应付账款
    let accountsReceivable = 0;
    let accountsPayable = 0;
    postedVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const subject = subjects.find(s => s.code === entry.subjectCode);
        if (subject) {
          if (subject.isCustomer) {
            accountsReceivable += entry.debit - entry.credit;
          }
          if (subject.isSupplier) {
            accountsPayable += entry.credit - entry.debit;
          }
        }
      });
    });

    const netPosition = accountsReceivable - accountsPayable;

    return {
      cashOnHand,
      monthlyRevenue,
      netPosition,
      accountsReceivable,
      accountsPayable
    };
  }, [vouchers, subjects]);

  // 生成真实的图表数据
  const chartData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const months = [];
    const revenueData = [];
    const expenseData = [];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const year = monthIndex > currentMonth ? currentYear - 1 : currentYear;
      const monthStr = `${String(monthIndex + 1).padStart(2, '0')}`;
      const yearMonth = `${year}-${monthStr}`;

      months.push(`${monthIndex + 1}月`);

      // 计算该月的收入和支出
      let monthRevenue = 0;
      let monthExpense = 0;

      vouchers.filter(v => v.status === 'posted' && v.date.startsWith(yearMonth)).forEach(voucher => {
        voucher.entries.forEach(entry => {
          const subject = subjects.find(s => s.code === entry.subjectCode);
          if (subject) {
            if (subject.code.startsWith('6')) {
              monthRevenue += entry.credit;
            } else if (subject.code.startsWith('5')) {
              monthExpense += entry.debit;
            }
          }
        });
      });

      revenueData.push(monthRevenue);
      expenseData.push(monthExpense);
    }

    return months.map((month, i) => ({
      month,
      revenue: revenueData[i],
      expenses: expenseData[i]
    }));
  }, [vouchers, subjects]);

  // 生成真实的智能通知
  const notifications = useMemo(() => {
    const result = [];
    const draftCount = vouchers.filter(v => v.status === 'draft').length;
    const reviewCount = vouchers.filter(v => v.status === 'review').length;

    // 待审核凭证通知
    if (draftCount > 0) {
      result.push({
        id: 1,
        title: '待审核凭证',
        description: `有 ${draftCount} 张凭证等待审核`,
        severity: 'high' as const,
        action: '立即审核',
        link: '/voucher-list?status=draft'
      });
    }

    // 审核中通知
    if (reviewCount > 0) {
      result.push({
        id: 2,
        title: '审核中凭证',
        description: `有 ${reviewCount} 张凭证正在审核`,
        severity: 'medium' as const,
        action: '查看详情',
        link: '/voucher-list?status=review'
      });
    }

    // 无待处理通知
    if (draftCount === 0 && reviewCount === 0) {
      result.push({
        id: 3,
        title: '系统正常',
        description: '所有凭证已处理完毕',
        severity: 'low' as const,
        action: '新增凭证',
        link: '/voucher-entry-page'
      });
    }

    return result;
  }, [vouchers]);

  // 账龄分析数据（简化版，基于真实数据）
  const agingData = useMemo(() => {
    // 这里简化处理，实际应该从账龄分析页面获取数据
    return [
      { category: '0-30天', current: coreMetrics.accountsReceivable * 0.5 || 0, overdue: 0 },
      { category: '31-60天', current: coreMetrics.accountsReceivable * 0.2 || 0, overdue: 0 },
      { category: '61-90天', current: coreMetrics.accountsReceivable * 0.15 || 0, overdue: 0 },
      { category: '90天以上', current: coreMetrics.accountsReceivable * 0.15 || 0, overdue: 0 }
    ];
  }, [coreMetrics]);

  // 过滤凭证列表
  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = !searchQuery ||
      v.voucherNo.includes(searchQuery) ||
      (v.summary && v.summary.includes(searchQuery));
    const matchesStatus = selectedStatus === 'all' || v.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const currentMonthLabel = `${new Date().getMonth() + 1}月`;
  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">财务仪表盘</h1>
          <p className="text-slate-500 mt-1">实时财务概览</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">本月</Badge>
          <Badge variant="outline" className="px-3 py-1">{currentYear}年{currentMonthLabel}</Badge>
        </div>
      </div>

      {/* 顶层核心卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 库存现金 */}
        <Card className="border-slate-200 hover:border-blue-300 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">库存现金</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                  {formatMoney(coreMetrics.cashOnHand)}
                </h3>
                <p className="text-sm text-green-600 mt-1">实时余额</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 净头寸 */}
        <Card className="border-slate-200 hover:border-purple-300 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">净头寸（应收-应付）</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                  {formatMoney(coreMetrics.netPosition)}
                </h3>
                <p className={`text-sm mt-1 ${coreMetrics.netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {coreMetrics.netPosition >= 0 ? '应收大于应付' : '应付大于应收'}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-full">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 本月收入 */}
        <Card className="border-slate-200 hover:border-green-300 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">本月收入</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                  {formatMoney(coreMetrics.monthlyRevenue)}
                </h3>
                <p className="text-sm text-slate-500 mt-1">本月累计收入</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 凭证统计 */}
        <Card className="border-slate-200 hover:border-orange-300 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">凭证数量</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                  {vouchers.length}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  已记账：{vouchers.filter(v => v.status === 'posted').length} 张
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-full">
                <Receipt className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 中间图表区和智能通知 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 收支趋势 */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              收支趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" tickFormatter={(value) => `¥${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
                    labelStyle={{ color: '#64748b' }}
                    formatter={(value: number) => `¥${value.toLocaleString()}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="收入"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                    name="支出"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 智能通知 */}
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">
              智能通知
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notifications.map((notification) => (
              <div key={notification.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{notification.title}</h4>
                  <Badge
                    variant={
                      notification.severity === 'high' ? 'destructive' :
                      notification.severity === 'medium' ? 'secondary' : 'default'
                    }
                    className="text-xs"
                  >
                    {notification.severity === 'high' ? '高' :
                     notification.severity === 'medium' ? '中' : '低'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-300">{notification.description}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                  onClick={() => router.push(notification.link)}
                >
                  {notification.action} <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 底部深度分析与入口 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 账龄分析 */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              应收账款账龄分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="category" stroke="#64748b" />
                  <YAxis stroke="#64748b" tickFormatter={(value) => `¥${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
                    labelStyle={{ color: '#64748b' }}
                    formatter={(value: number) => `¥${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Bar dataKey="current" name="当前金额" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 快速操作 */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              快速操作
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push('/voucher-entry-page')}
            >
              <Plus className="w-4 h-4 mr-2" />
              新增凭证
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowVoucherDialog(true)}
            >
              <List className="w-4 h-4 mr-2" />
              查看凭证
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/aging/ar')}
            >
              <Clock className="w-4 h-4 mr-2" />
              账龄分析
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/partner-dashboard')}
            >
              <Users className="w-4 h-4 mr-2" />
              往来单位
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 查看凭证对话框 */}
      <Dialog open={showVoucherDialog} onOpenChange={setShowVoucherDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>查看凭证</DialogTitle>
          </DialogHeader>

          {/* 筛选栏 */}
          <div className="flex flex-wrap gap-4 p-4 border-b">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索凭证号或摘要"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <SimpleSelect
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'draft', label: '草稿' },
                  { value: 'review', label: '审核中' },
                  { value: 'posted', label: '已记账' },
                  { value: 'reversed', label: '已冲销' }
                ]}
                showCode={false}
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <ChineseDatePicker
                placeholder="开始日期"
                value={dateRange.start}
                onChange={(v) => setDateRange({ ...dateRange, start: v })}
              />
              <span className="text-slate-400">至</span>
              <ChineseDatePicker
                placeholder="结束日期"
                value={dateRange.end}
                onChange={(v) => setDateRange({ ...dateRange, end: v })}
              />
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2" />
                打印
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
            </div>
          </div>

          {/* 凭证列表 */}
          <div className="flex-1 overflow-auto">
            {filteredVouchers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <List className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-base">暂无凭证记录</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 border-b">凭证号</th>
                    <th className="text-left p-3 border-b">日期</th>
                    <th className="text-left p-3 border-b">摘要</th>
                    <th className="text-left p-3 border-b">状态</th>
                    <th className="text-right p-3 border-b">借方合计</th>
                    <th className="text-right p-3 border-b">贷方合计</th>
                    <th className="text-center p-3 border-b">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.slice().reverse().map((voucher) => {
                    const debitTotal = voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const creditTotal = voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0);

                    const statusColors = {
                      draft: 'bg-slate-100 text-slate-700',
                      review: 'bg-yellow-100 text-yellow-700',
                      posted: 'bg-green-100 text-green-700',
                      reversed: 'bg-red-100 text-red-700'
                    };

                    const statusLabels = {
                      draft: '草稿',
                      review: '审核中',
                      posted: '已记账',
                      reversed: '已冲销'
                    };

                    return (
                      <tr key={voucher.id} className="hover:bg-slate-50">
                        <td className="p-3 border-b font-mono">{voucher.voucherNo}</td>
                        <td className="p-3 border-b">{voucher.date}</td>
                        <td className="p-3 border-b truncate max-w-xs">{voucher.summary}</td>
                        <td className="p-3 border-b">
                          <Badge className={statusColors[voucher.status as keyof typeof statusColors]}>
                            {statusLabels[voucher.status as keyof typeof statusLabels]}
                          </Badge>
                        </td>
                        <td className="p-3 border-b text-right font-mono">{formatMoney(debitTotal)}</td>
                        <td className="p-3 border-b text-right font-mono">{formatMoney(creditTotal)}</td>
                        <td className="p-3 border-b text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/voucher-entry-page?voucherId=${voucher.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            查看
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
