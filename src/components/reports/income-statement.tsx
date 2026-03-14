'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart,
  Target
} from 'lucide-react';

interface IncomeStatementItem {
  code: string;
  name: string;
  level: number;
  amount: number;
  isDebit: boolean; // true for expenses, false for revenue
  percentage?: number;
  parentCode?: string;
  children?: IncomeStatementItem[];
}

interface IncomeStatementData {
  revenue: IncomeStatementItem[];
  expenses: IncomeStatementItem[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  grossProfitMargin: number;
  operatingMargin: number;
  netProfitMargin: number;
}

export function IncomeStatement() {
  const [date, setDate] = useState('2026-03-31');
  const [showPercentage, setShowPercentage] = useState(true);
  const [expandAll, setExpandAll] = useState(false);

  // 模拟损益表数据
  const incomeStatementData: IncomeStatementData = useMemo(() => {
    const revenueItems: IncomeStatementItem[] = [
      {
        code: '6',
        name: '营业收入',
        level: 1,
        amount: 8500000,
        isDebit: false,
        children: [
          { code: '6001', name: '主营业务收入', level: 2, amount: 7500000, isDebit: false },
          { code: '6051', name: '其他业务收入', level: 2, amount: 1000000, isDebit: false }
        ]
      },
      {
        code: '6111', name: '公允价值变动收益', level: 2, amount: 200000, isDebit: false },
      {
        code: '6301', name: '投资收益', level: 2, amount: 300000, isDebit: false },
      {
        code: '6403', name: '营业外收入', level: 2, amount: 200000, isDebit: false }
    ];

    const expenseItems: IncomeStatementItem[] = [
      {
        code: '1',
        name: '营业成本',
        level: 1,
        amount: 5200000,
        isDebit: true,
        children: [
          { code: '6001', name: '主营业务成本', level: 2, amount: 5000000, isDebit: true },
          { code: '6051', name: '其他业务成本', level: 2, amount: 200000, isDebit: true }
        ]
      },
      {
        code: '6601', name: '销售费用', level: 1, amount: 1200000, isDebit: true, children: [
          { code: '660101', name: '销售人员薪酬', level: 2, amount: 600000, isDebit: true },
          { code: '660102', name: '广告宣传费', level: 2, amount: 400000, isDebit: true },
          { code: '660103', name: '差旅费', level: 2, amount: 200000, isDebit: true }
        ]
      },
      {
        code: '6602', name: '管理费用', level: 1, amount: 800000, isDebit: true, children: [
          { code: '660201', name: '管理人员薪酬', level: 2, amount: 500000, isDebit: true },
          { code: '660202', name: '办公费', level: 2, amount: 200000, isDebit: true },
          { code: '660203', name: '折旧费', level: 2, amount: 100000, isDebit: true }
        ]
      },
      {
        code: '6603', name: '财务费用', level: 1, amount: 300000, isDebit: true, children: [
          { code: '660301', name: '利息支出', level: 2, amount: 200000, isDebit: true },
          { code: '660302', name: '手续费', level: 2, amount: 100000, isDebit: true }
        ]
      },
      {
        code: '6701', name: '资产减值损失', level: 2, amount: 100000, isDebit: true },
      {
        code: '6711', name: '营业外支出', level: 2, amount: 100000, isDebit: true },
      {
        code: '6801', name: '所得税费用', level: 2, amount: 400000, isDebit: true }
    ];

    const totalRevenue = revenueItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const totalExpenses = expenseItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const netIncome = totalRevenue - totalExpenses;
    const grossProfitMargin = ((totalRevenue - 5200000) / totalRevenue * 100);
    const operatingMargin = ((totalRevenue - 5200000 - 1200000 - 800000 - 300000) / totalRevenue * 100);
    const netProfitMargin = (netIncome / totalRevenue * 100);

    return {
      revenue: revenueItems,
      expenses: expenseItems,
      totalRevenue,
      totalExpenses,
      netIncome,
      grossProfitMargin,
      operatingMargin,
      netProfitMargin
    };
  }, []);

  // 计算汇总金额
  const calculateTotal = (items: IncomeStatementItem[], type: 'revenue' | 'expense') => {
    return items.reduce((sum, item) => {
      const itemSum = item.children ? calculateTotal(item.children, type) : Math.abs(item.amount);
      return sum + itemSum;
    }, 0);
  };

  // 渲染项目
  const renderItem = (item: IncomeStatementItem, isRevenue = false) => {
    const hasChildren = item.children && item.children.length > 0;
    const indent = (item.level - 1) * 24;
    const totalAmount = isRevenue ? incomeStatementData.totalRevenue : incomeStatementData.totalExpenses;
    const percentage = showPercentage ? Math.abs(item.amount / totalAmount * 100) : undefined;

    return (
      <div key={item.code}>
        <div
          className={`flex items-center justify-between p-3 border-b hover:bg-gray-50 cursor-pointer ${hasChildren ? 'font-medium' : ''}`}
          style={{ paddingLeft: `${indent}px` }}
        >
          <div className="flex items-center gap-3 flex-1">
            {hasChildren && (
              <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                <span className="text-xs">▼</span>
              </Button>
            )}
            <span className="font-mono text-sm w-16">{item.code}</span>
            <span className="flex-1">{item.name}</span>
            {percentage && (
              <Badge variant="outline" className="text-xs">
                {percentage.toFixed(1)}%
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className={`text-right ${item.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
              ¥{Math.abs(item.amount).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>

        {/* 子项目 */}
        {hasChildren && (
          <div className="border-l border-gray-200 ml-4">
            {item.children!.map(child => renderItem(child, isRevenue))}
          </div>
        )}
      </div>
    );
  };

  // 格式化金额
  const formatMoney = (amount: number) => {
    return amount.toLocaleString('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0
    });
  };

  // 格式化百分比
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* 报表标题和操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>损益表</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  期间: 2026年1月1日 - {date}
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant="default">期间损益</Badge>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                筛选
              </Button>
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                打印
              </Button>
              <Button size="sm">
                <Download className="h-4 w-4 mr-2" />
                导出Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 损益表主体 */}
      <div className="grid grid-cols-1 gap-8">
        {/* 收入部分 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-700">
              <TrendingUp className="h-5 w-5" />
              收入
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {incomeStatementData.revenue.map(item => renderItem(item, true))}
              <div className="flex items-center justify-between p-3 border-t-2 border-green-700 bg-green-50">
                <span className="font-bold">收入总计</span>
                <span className="font-bold text-green-700">
                  {formatMoney(incomeStatementData.totalRevenue)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 成本费用部分 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700">
              <TrendingDown className="h-5 w-5" />
              成本与费用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {incomeStatementData.expenses.map(item => renderItem(item, false))}
              <div className="flex items-center justify-between p-3 border-t-2 border-red-700 bg-red-50">
                <span className="font-bold">成本费用总计</span>
                <span className="font-bold text-red-700">
                  {formatMoney(incomeStatementData.totalExpenses)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 利润表单行 */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">营业收入</p>
              <p className="text-2xl font-bold text-green-600">
                {formatMoney(incomeStatementData.totalRevenue)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">总成本</p>
              <p className="text-2xl font-bold text-red-600">
                {formatMoney(incomeStatementData.totalExpenses)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">营业利润</p>
              <p className={`text-2xl font-bold ${incomeStatementData.netIncome > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(incomeStatementData.totalRevenue - incomeStatementData.totalExpenses + 1000000)} {/* 减去其他费用 */}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">净利润</p>
              <p className={`text-2xl font-bold ${incomeStatementData.netIncome > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(incomeStatementData.netIncome)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 利润率分析 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">毛利率</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatPercentage(incomeStatementData.grossProfitMargin)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">营业利润率</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatPercentage(incomeStatementData.operatingMargin)}
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">净利率</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatPercentage(incomeStatementData.netProfitMargin)}
                </p>
              </div>
              <PieChart className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 同比分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            同比分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">收入增长</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">营业收入</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">+12.5%</span>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">主营业务收入</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">+15.2%</span>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">其他业务收入</span>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 font-medium">-5.8%</span>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">成本控制</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">营业成本率</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">-2.3%</span>
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">销售费用率</span>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 font-medium">+1.8%</span>
                    <TrendingUp className="h-4 w-4 text-red-600" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">管理费用率</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">-0.5%</span>
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}