'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface BalanceSheetItem {
  code: string;
  name: string;
  level: number;
  amount: number;
  isDebit: boolean; // true for assets, false for liabilities and equity
  percentage?: number;
  parentCode?: string;
  children?: BalanceSheetItem[];
}

interface BalanceSheetData {
  assets: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  equity: BalanceSheetItem[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export function BalanceSheet() {
  const [date, setDate] = useState('2026-03-31');
  const [showPercentage, setShowPercentage] = useState(true);
  const [expandAll, setExpandAll] = useState(false);

  // 模拟资产负债表数据
  const balanceSheetData: BalanceSheetData = useMemo(() => {
    return {
      assets: [
        {
          code: '1',
          name: '流动资产',
          level: 1,
          amount: 1800000,
          isDebit: true,
          children: [
            { code: '1001', name: '货币资金', level: 2, amount: 310000, isDebit: true },
            { code: '1122', name: '应收账款', level: 2, amount: 450000, isDebit: true },
            { code: '1131', name: '预付款项', level: 2, amount: 200000, isDebit: true },
            { code: '1201', name: '存货', level: 2, amount: 840000, isDebit: true }
          ]
        },
        {
          code: '2',
          name: '非流动资产',
          level: 1,
          amount: 1200000,
          isDebit: true,
          children: [
            { code: '1501', name: '固定资产', level: 2, amount: 1000000, isDebit: true },
            { code: '1502', name: '累计折旧', level: 2, amount: -200000, isDebit: true },
            { code: '1701', name: '无形资产', level: 2, amount: 400000, isDebit: true }
          ]
        }
      ],
      liabilities: [
        {
          code: '2',
          name: '流动负债',
          level: 1,
          amount: 650000,
          isDebit: false,
          children: [
            { code: '2202', name: '应付账款', level: 2, amount: 300000, isDebit: false },
            { code: '2211', name: '应付职工薪酬', level: 2, amount: 150000, isDebit: false },
            { code: '2221', name: '应交税费', level: 2, amount: 200000, isDebit: false }
          ]
        },
        {
          code: '3',
          name: '非流动负债',
          level: 1,
          amount: 450000,
          isDebit: false,
          children: [
            { code: '2501', name: '长期借款', level: 2, amount: 450000, isDebit: false }
          ]
        }
      ],
      equity: [
        {
          code: '4',
          name: '所有者权益',
          level: 1,
          amount: 1900000,
          isDebit: false,
          children: [
            { code: '3001', name: '实收资本', level: 2, amount: 1500000, isDebit: false },
            { code: '3002', name: '资本公积', level: 2, amount: 200000, isDebit: false },
            { code: '3101', name: '盈余公积', level: 2, amount: 100000, isDebit: false },
            { code: '3103', name: '未分配利润', level: 2, amount: 100000, isDebit: false }
          ]
        }
      ],
      totalAssets: 3000000,
      totalLiabilities: 1100000,
      totalEquity: 1900000,
      isBalanced: true
    };
  }, []);

  // 渲染项目
  const renderItem = (item: BalanceSheetItem, parent?: BalanceSheetItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const indent = (item.level - 1) * 24;
    const totalAmount = parent ? parent.amount : balanceSheetData.totalAssets;
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
            <div className={`text-right ${item.amount < 0 ? 'text-red-600' : ''}`}>
              ¥{item.amount.toLocaleString('zh-CN')}
            </div>
          </div>
        </div>

        {/* 子项目 */}
        {hasChildren && (
          <div className="border-l border-gray-200 ml-4">
            {item.children!.map(child => renderItem(child, item))}
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

  return (
    <div className="space-y-6">
      {/* 报表标题和操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>资产负债表</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  报表日期: {date}
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant={balanceSheetData.isBalanced ? 'default' : 'destructive'}>
                    {balanceSheetData.isBalanced ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {balanceSheetData.isBalanced ? '平衡' : '不平衡'}
                  </Badge>
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
                导出PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 资产负债表主体 */}
      <div className="grid grid-cols-1 gap-8">
        {/* 资产部分 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-700">
              <DollarSign className="h-5 w-5" />
              资产
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {balanceSheetData.assets.map(item => renderItem(item))}
              <div className="flex items-center justify-between p-3 border-t-2 border-green-700 bg-green-50">
                <span className="font-bold">资产总计</span>
                <span className="font-bold text-green-700">
                  {formatMoney(balanceSheetData.totalAssets)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 负债和权益部分 */}
        <div className="space-y-4">
          {/* 负债部分 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <TrendingDown className="h-5 w-5" />
                负债
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {balanceSheetData.liabilities.map(item => renderItem(item))}
                <div className="flex items-center justify-between p-3 border-t-2 border-red-700 bg-red-50">
                  <span className="font-bold">负债合计</span>
                  <span className="font-bold text-red-700">
                    {formatMoney(balanceSheetData.totalLiabilities)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 权益部分 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <TrendingUp className="h-5 w-5" />
                所有者权益
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {balanceSheetData.equity.map(item => renderItem(item))}
                <div className="flex items-center justify-between p-3 border-t-2 border-blue-700 bg-blue-50">
                  <span className="font-bold">权益合计</span>
                  <span className="font-bold text-blue-700">
                    {formatMoney(balanceSheetData.totalEquity)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 平衡检查 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {balanceSheetData.isBalanced ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                平衡检查: {balanceSheetData.isBalanced ? '已平衡' : '不平衡'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              资产总计 {formatMoney(balanceSheetData.totalAssets)} =
              负债总计 {formatMoney(balanceSheetData.totalLiabilities)} +
              权益总计 {formatMoney(balanceSheetData.totalEquity)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 分析指标 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">资产负债率</p>
                <p className="text-2xl font-bold text-red-600">
                  {((balanceSheetData.totalLiabilities / balanceSheetData.totalAssets) * 100).toFixed(1)}%
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">权益比率</p>
                <p className="text-2xl font-bold text-blue-600">
                  {((balanceSheetData.totalEquity / balanceSheetData.totalAssets) * 100).toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">流动比率</p>
                <p className="text-2xl font-bold text-green-600">
                  {(balanceSheetData.assets[0].amount / balanceSheetData.liabilities[0].amount).toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}