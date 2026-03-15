'use client';

import React, { useState, useEffect } from 'react';
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
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectOption as SelectOptionType } from '@/components/ui/select';
import { useVoucherStore } from '@/stores/useVoucherStore';

// 模拟数据生成器
const generateMockData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const actualRevenue = [85, 92, 88, 95, 102, 110];
  const actualExpenses = [65, 70, 68, 75, 80, 85];
  const forecastRevenue = [115, 120, 125, 130, 135, 140];
  const forecastExpenses = [90, 92, 95, 98, 100, 102];

  return months.map((month, i) => ({
    month,
    revenue: actualRevenue[i],
    expenses: actualExpenses[i],
    forecastRevenue: forecastRevenue[i],
    forecastExpenses: forecastExpenses[i]
  }));
};

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const { ledgerEntries, vouchers } = useVoucherStore();
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    // 模拟从 IndexedDB 获取数据
    const mockData = generateMockData();
    setData(mockData);
  }, []);

  // 计算关键指标
  const cashOnHand = 1240500;
  const revenue = 89400;
  const netPosition = 450200; // AR - AP
  const burnRate = 0.65; // 本月支出进度

  // 智能通知
  const notifications = [
    {
      id: 1,
      title: 'Anomalies Detected',
      description: '3 vouchers need review',
      severity: 'high' as const,
      action: 'Review Now'
    },
    {
      id: 2,
      title: 'Auto-Mapping Learned',
      description: 'New matching rules created',
      severity: 'medium' as const,
      action: 'View Rules'
    },
    {
      id: 3,
      title: 'Upcoming Payment',
      description: 'Vendor A due tomorrow',
      severity: 'low' as const,
      action: 'Process'
    }
  ];

  // 账龄分析数据
  const agingData = [
    { category: '0-30d', current: 85, overdue: 15 },
    { category: '31-60d', current: 75, overdue: 25 },
    { category: '61-90d', current: 60, overdue: 40 },
    { category: '>90d', current: 40, overdue: 60 }
  ];

  // 过滤凭证列表
  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = !searchQuery ||
      v.voucherNo.includes(searchQuery) ||
      v.summary.includes(searchQuery);
    const matchesStatus = selectedStatus === 'all' || v.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Powered Dashboard</h1>
          <p className="text-slate-500 mt-1">Real-time financial intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">MTD</Badge>
          <Badge variant="outline" className="px-3 py-1">Mar 2026</Badge>
        </div>
      </div>

      {/* 顶层核心卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 现金余额 */}
        <Card className="border-slate-200 hover:border-blue-300 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">CASH ON HAND</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                  ${cashOnHand.toLocaleString()}
                </h3>
                <p className="text-sm text-green-600 mt-1">+12%</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 净头寸 */}
        <Card className="border-slate-200 hover:border-purple-300 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">NET POSITION (AR-AP)</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                  ${netPosition.toLocaleString()}
                </h3>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, netPosition / 5000)}%` }}
                  ></div>
                </div>
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
                <p className="text-sm font-medium text-slate-500">MTD REVENUE</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                  ${revenue.toLocaleString()}
                </h3>
                <p className="text-sm text-slate-500 mt-1">Compared to $89,400</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 燃烧率 */}
        <Card className="border-slate-200 hover:border-orange-300 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">BURN RATE</p>
                <p className="text-sm text-slate-500 mt-1">
                  Showing of current month's spending pace
                </p>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full"
                    style={{ width: `${burnRate * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="p-3 bg-orange-50 rounded-full">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 中间智能对撞区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 现金流预测 */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Cash Flow Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorForecastRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorForecastExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" tickFormatter={(value) => `$${value}K`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
                    labelStyle={{ color: '#64748b' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                    name="Expenses"
                  />
                  <Area
                    type="monotone"
                    dataKey="forecastRevenue"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorForecastRevenue)"
                    name="AI Prediction (Revenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="forecastExpenses"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorForecastExpenses)"
                    name="AI Prediction (Expenses)"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 智能通知 */}
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">
              Intelligence Feed
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
                    {notification.severity}
                  </Badge>
                </div>
                <p className="text-sm text-slate-300">{notification.description}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                >
                  {notification.action}
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
              AR Aging Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="category" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
                    labelStyle={{ color: '#64748b' }}
                  />
                  <Legend />
                  <Bar dataKey="current" name="Current" fill="#3b82f6" />
                  <Bar dataKey="overdue" name="Overdue" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 快速操作 */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => window.location.href = '/voucher-entry-page'}
            >
              <Plus className="w-4 h-4 mr-2" />
              Smart Entry
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowVoucherDialog(true)}
            >
              <List className="w-4 h-4 mr-2" />
              View Vouchers
            </Button>
            <Button variant="outline" className="w-full">
              <Building2 className="w-4 h-4 mr-2" />
              Aging Analysis
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
              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'draft', label: '草稿' },
                  { value: 'review', label: '审核中' },
                  { value: 'posted', label: '已记账' },
                  { value: 'reversed', label: '已冲销' }
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <Input
                type="date"
                placeholder="开始日期"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
              <span className="text-slate-400">至</span>
              <Input
                type="date"
                placeholder="结束日期"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
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
                        <td className="p-3 border-b text-right font-mono">{debitTotal.toFixed(2)}</td>
                        <td className="p-3 border-b text-right font-mono">{creditTotal.toFixed(2)}</td>
                        <td className="p-3 border-b text-center">
                          <Button variant="ghost" size="sm">
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