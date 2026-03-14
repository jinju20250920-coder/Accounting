'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Calculator,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  FileText,
  BarChart3,
  Save,
  RefreshCw,
  Plus
} from 'lucide-react';

interface InitialBalance {
  id: string;
  code: string;
  name: string;
  level: number;
  direction: 'debit' | 'credit';
  openingBalance: number;
  currentDebit: number;
  currentCredit: number;
  closingBalance: number;
  hasChildren: boolean;
  children?: InitialBalance[];
}

interface BalanceSummary {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
}

export function InitialBalanceSetup() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showOnlyUnbalanced, setShowOnlyUnbalanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 模拟科目余额数据
  const initialBalances: InitialBalance[] = useMemo(() => [
    {
      id: '1',
      code: '1',
      name: '资产',
      level: 1,
      direction: 'debit',
      openingBalance: 3000000,
      currentDebit: 500000,
      currentCredit: 0,
      closingBalance: 3500000,
      hasChildren: true,
      children: [
        {
          id: '1001',
          code: '1001',
          name: '库存现金',
          level: 2,
          direction: 'debit',
          openingBalance: 60000,
          currentDebit: 10000,
          currentCredit: 0,
          closingBalance: 70000,
          hasChildren: false
        },
        {
          id: '1002',
          code: '1002',
          name: '银行存款',
          level: 2,
          direction: 'debit',
          openingBalance: 500000,
          currentDebit: 100000,
          currentCredit: 50000,
          closingBalance: 550000,
          hasChildren: false
        },
        {
          id: '1122',
          code: '1122',
          name: '应收账款',
          level: 2,
          direction: 'debit',
          openingBalance: 800000,
          currentDebit: 200000,
          currentCredit: 0,
          closingBalance: 1000000,
          hasChildren: false
        },
        {
          id: '1501',
          code: '1501',
          name: '固定资产',
          level: 2,
          direction: 'debit',
          openingBalance: 1640000,
          currentDebit: 190000,
          currentCredit: 0,
          closingBalance: 1830000,
          hasChildren: false
        }
      ]
    },
    {
      id: '2',
      code: '2',
      name: '负债',
      level: 1,
      direction: 'credit',
      openingBalance: 1100000,
      currentDebit: 0,
      currentCredit: 300000,
      closingBalance: 1400000,
      hasChildren: true,
      children: [
        {
          id: '2001',
          code: '2001',
          name: '短期借款',
          level: 2,
          direction: 'credit',
          openingBalance: 300000,
          currentDebit: 0,
          currentCredit: 100000,
          closingBalance: 400000,
          hasChildren: false
        },
        {
          id: '2202',
          code: '2202',
          name: '应付账款',
          level: 2,
          direction: 'credit',
          openingBalance: 500000,
          currentDebit: 0,
          currentCredit: 150000,
          closingBalance: 650000,
          hasChildren: false
        },
        {
          id: '2211',
          code: '2211',
          name: '应付职工薪酬',
          level: 2,
          direction: 'credit',
          openingBalance: 300000,
          currentDebit: 0,
          currentCredit: 50000,
          closingBalance: 350000,
          hasChildren: false
        }
      ]
    },
    {
      id: '3',
      code: '3',
      name: '所有者权益',
      level: 1,
      direction: 'credit',
      openingBalance: 1900000,
      currentDebit: 0,
      currentCredit: 200000,
      closingBalance: 2100000,
      hasChildren: true,
      children: [
        {
          id: '3001',
          code: '3001',
          name: '实收资本',
          level: 2,
          direction: 'credit',
          openingBalance: 1500000,
          currentDebit: 0,
          currentCredit: 0,
          closingBalance: 1500000,
          hasChildren: false
        },
        {
          id: '3002',
          code: '3002',
          name: '未分配利润',
          level: 2,
          direction: 'credit',
          openingBalance: 400000,
          currentDebit: 0,
          currentCredit: 200000,
          closingBalance: 600000,
          hasChildren: false
        }
      ]
    }
  ], []);

  // 计算汇总数据
  const calculateSummary = (): BalanceSummary => {
    let totalDebit = 0;
    let totalCredit = 0;

    const calculateItem = (item: InitialBalance) => {
      totalDebit += item.closingBalance > 0 ? item.closingBalance : 0;
      totalCredit += item.closingBalance < 0 ? Math.abs(item.closingBalance) : 0;

      if (item.children) {
        item.children.forEach(calculateItem);
      }
    };

    initialBalances.forEach(calculateItem);

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    const difference = totalDebit - totalCredit;

    return { totalDebit, totalCredit, isBalanced, difference };
  };

  const summary = calculateSummary();

  // 过滤数据
  const filteredBalances = useMemo(() => {
    let filtered = [...initialBalances];

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 只显示不平衡的
    if (showOnlyUnbalanced) {
      filtered = filtered.filter(item => {
        const itemTotalDebit = item.closingBalance > 0 ? item.closingBalance : 0;
        const itemTotalCredit = item.closingBalance < 0 ? Math.abs(item.closingBalance) : 0;
        return Math.abs(itemTotalDebit - itemTotalCredit) > 0.01;
      });
    }

    return filtered;
  }, [initialBalances, searchTerm, showOnlyUnbalanced]);

  // 展开/折叠
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // 渲染科目行
  const renderBalanceItem = (item: InitialBalance, parent?: InitialBalance) => {
    const isExpanded = expandedItems.has(item.id);
    const indent = (item.level - 1) * 24;

    return (
      <React.Fragment key={item.id}>
        <div
          className={`flex items-center justify-between p-3 border-b hover:bg-gray-50 cursor-pointer ${item.hasChildren ? 'font-medium' : ''}`}
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => item.hasChildren && toggleExpand(item.id)}
        >
          <div className="flex items-center gap-3 flex-1">
            {item.hasChildren && (
              <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                {isExpanded ? (
                  <span className="text-xs">▼</span>
                ) : (
                  <span className="text-xs">▶</span>
                )}
              </Button>
            )}
            <span className="font-mono text-sm w-16">{item.code}</span>
            <span className="flex-1">{item.name}</span>
            <Badge variant="outline" className="text-xs">
              {item.direction === 'debit' ? '借方' : '贷方'}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            {/* 期初余额 */}
            <div className="text-right w-32">
              <span className="text-sm text-muted-foreground">期初:</span>
              <span className={`ml-1 ${item.openingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {item.openingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {/* 本期发生额 */}
            <div className="text-right w-32">
              <span className="text-sm text-muted-foreground">本期:</span>
              <span className="ml-1">
                <span className={`text-xs ${item.currentDebit > 0 ? 'text-green-600' : ''}`}>
                  {item.currentDebit > 0 ? '+' : ''}{item.currentDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-gray-400 mx-1">|</span>
                <span className={`text-xs ${item.currentCredit > 0 ? 'text-red-600' : ''}`}>
                  {item.currentCredit > 0 ? '+' : ''}{item.currentCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </span>
              </span>
            </div>
            {/* 期末余额 */}
            <div className={`text-right w-32 font-medium ${item.closingBalance > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {item.closingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* 子科目 */}
        {item.hasChildren && isExpanded && item.children?.map(child =>
          renderBalanceItem(child, item)
        )}
      </React.Fragment>
    );
  };

  // 格式化金额
  const formatMoney = (amount: number) => {
    return amount.toLocaleString('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    // 模拟保存
    setTimeout(() => {
      setIsSaving(false);
      alert('期初余额已保存');
    }, 1500);
  };

  const handleImport = () => {
    // 模拟导入
    alert('正在导入期初余额...');
  };

  const handleExport = () => {
    // 模拟导出
    alert('已导出期初余额Excel');
  };

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总借方余额</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatMoney(summary.totalDebit)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总贷方余额</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatMoney(summary.totalCredit)}
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
                <p className="text-sm text-muted-foreground">平衡状态</p>
                <p className={`text-2xl font-bold ${summary.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.isBalanced ? '已平衡' : '不平衡'}
                </p>
              </div>
              {summary.isBalanced ? (
                <CheckCircle className="h-8 w-8 text-green-200" />
              ) : (
                <AlertCircle className="h-8 w-8 text-red-200" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">差额</p>
                <p className={`text-2xl font-bold ${summary.difference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatMoney(summary.difference)}
                </p>
              </div>
              <Calculator className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索科目代码或名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={showOnlyUnbalanced ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowOnlyUnbalanced(!showOnlyUnbalanced)}
              >
                <Filter className="h-4 w-4 mr-2" />
                只显示不平衡
              </Button>
              <Button variant="outline" size="sm" onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                导入Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !summary.isBalanced}>
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                保存
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 期初余额表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>科目余额表</span>
            {summary.isBalanced ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                已平衡
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                不平衡 - {formatMoney(summary.difference)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {filteredBalances.map(item => renderBalanceItem(item))}

            {/* 合计行 */}
            <div className="flex items-center justify-between p-3 border-t-2 font-bold">
              <span>合计</span>
              <div className="flex items-center gap-4">
                <span>{formatMoney(summary.totalDebit)}</span>
                <span>{formatMoney(summary.totalCredit)}</span>
                <span className={summary.isBalanced ? 'text-green-600' : 'text-red-600'}>
                  {formatMoney(summary.totalDebit - summary.totalCredit)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 平衡检查提示 */}
      {!summary.isBalanced && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-800 mb-1">借贷不平衡</h4>
                <p className="text-sm text-red-700">
                  当前期初余额借贷不平衡，差额为 {formatMoney(summary.difference)}。请检查科目余额是否正确，确保借贷方金额相等。
                </p>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm">
                    自动调整
                  </Button>
                  <Button variant="ghost" size="sm">
                    查看明细
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作说明 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">使用说明</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 期初余额录入完成后必须借贷平衡才能保存</li>
                <li>• 支持导入Excel文件批量录入期初余额</li>
                <li>• 可以展开查看明细科目，修改具体科目余额</li>
                <li>• 建议先录入总账科目余额，再录入明细科目</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}