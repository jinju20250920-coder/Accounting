'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Filter,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  Circle,
  AlertTriangle
} from 'lucide-react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';

interface TrialBalanceItem {
  code: string;
  name: string;
  level: number;
  isLeaf: boolean;
  children?: TrialBalanceItem[];
  parentCode?: string;
  beginningDebit: number;
  beginningCredit: number;
  currentDebit: number;
  currentCredit: number;
  endingDebit: number;
  endingCredit: number;
  isBalanced: boolean;
}

export function TrialBalance() {
  const store = useVoucherStore();
  const { vouchers, calculateSubjectBalances } = store;
  const { subjects } = useSubjectStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showOnlyUnbalanced, setShowOnlyUnbalanced] = useState(false);

  // 从真实数据计算科目余额
  const subjectBalances = useMemo(() => {
    const balances = new Map<string, { opening: number; currentDebit: number; currentCredit: number }>();

    // 初始化所有科目的期初余额为0
    subjects.forEach(subject => {
      balances.set(subject.code, {
        opening: 0,
        currentDebit: 0,
        currentCredit: 0
      });
    });

    // 计算本期发生额
    vouchers.forEach(voucher => {
      if (voucher.status === 'posted' || voucher.status === 'reversed') {
        const multiplier = voucher.status === 'reversed' ? -1 : 1;
        voucher.entries.forEach(entry => {
          const balance = balances.get(entry.subjectCode);
          if (balance) {
            balance.currentDebit += (entry.debit || 0) * multiplier;
            balance.currentCredit += (entry.credit || 0) * multiplier;
          }
        });
      }
    });

    // 构建试算平衡表数据
    const trialBalanceData: TrialBalanceItem[] = subjects.map(subject => {
      const balance = balances.get(subject.code)!;
      // 根据科目方向计算期末余额
      const endingDebit = subject.direction === 'debit'
        ? balance.opening + balance.currentDebit - balance.currentCredit
        : 0;
      const endingCredit = subject.direction === 'credit'
        ? balance.opening + balance.currentCredit - balance.currentDebit
        : 0;

      return {
        code: subject.code,
        name: subject.name,
        level: subject.level,
        isLeaf: true, // 简化处理，实际应根据是否有子科目判断
        beginningDebit: subject.direction === 'debit' ? balance.opening : 0,
        beginningCredit: subject.direction === 'credit' ? balance.opening : 0,
        currentDebit: balance.currentDebit,
        currentCredit: balance.currentCredit,
        endingDebit: Math.max(0, endingDebit),
        endingCredit: Math.max(0, endingCredit),
        isBalanced: Math.abs(endingDebit - endingCredit) < 0.01
      };
    });

    return trialBalanceData;
  }, [vouchers, subjects]);

  // 构建树形结构
  const buildTree = (items: TrialBalanceItem[]): TrialBalanceItem[] => {
    const map = new Map<string, TrialBalanceItem>();
    const roots: TrialBalanceItem[] = [];

    items.forEach(item => {
      map.set(item.code, { ...item, children: [] });
    });

    items.forEach(item => {
      const node = map.get(item.code)!;
      if (item.parentCode && map.has(item.parentCode)) {
        const parent = map.get(item.parentCode)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const subjectTree = useMemo(() => buildTree(subjectBalances), [subjectBalances]);

  // 计算汇总数据
  const calculateTotals = (items: TrialBalanceItem[]) => {
    let totalBeginningDebit = 0;
    let totalBeginningCredit = 0;
    let totalCurrentDebit = 0;
    let totalCurrentCredit = 0;
    let totalEndingDebit = 0;
    let totalEndingCredit = 0;

    items.forEach(item => {
      totalBeginningDebit += item.beginningDebit;
      totalBeginningCredit += item.beginningCredit;
      totalCurrentDebit += item.currentDebit;
      totalCurrentCredit += item.currentCredit;
      totalEndingDebit += item.endingDebit;
      totalEndingCredit += item.endingCredit;

      if (item.children) {
        const childTotals = calculateTotals(item.children);
        totalBeginningDebit += childTotals.beginningDebit;
        totalBeginningCredit += childTotals.beginningCredit;
        totalCurrentDebit += childTotals.currentDebit;
        totalCurrentCredit += childTotals.currentCredit;
        totalEndingDebit += childTotals.endingDebit;
        totalEndingCredit += childTotals.endingCredit;
      }
    });

    return { beginningDebit: totalBeginningDebit, beginningCredit: totalBeginningCredit, currentDebit: totalCurrentDebit, currentCredit: totalCurrentCredit, endingDebit: totalEndingDebit, endingCredit: totalEndingCredit };
  };

  const totals = calculateTotals(subjectTree);

  // 过滤和搜索
  const filteredSubjects = useMemo(() => {
    let filtered = [...subjectBalances];

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 只显示不平衡的
    if (showOnlyUnbalanced) {
      filtered = filtered.filter(item => !item.isBalanced);
    }

    return filtered;
  }, [subjects, searchTerm, showOnlyUnbalanced]);

  // 展开/折叠
  const toggleExpand = (code: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedItems(newExpanded);
  };

  // 渲染科目行
  const renderSubject = (item: TrialBalanceItem, isLeaf = true) => {
    const isExpanded = expandedItems.has(item.code);
    const indentStyle = { paddingLeft: `${(item.level - 1) * 20}px` };

    return (
      <React.Fragment key={item.code}>
        <tr
          className={`border-b hover:bg-gray-50 cursor-pointer ${!isLeaf ? 'font-medium' : ''}`}
          style={indentStyle}
          onClick={() => !isLeaf && toggleExpand(item.code)}
        >
          <td className="p-2">
            <div className="flex items-center gap-2">
              {!isLeaf && (
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
              <div className="flex items-center gap-2">
                {item.isBalanced ? (
                  <Circle className="h-3 w-3 text-green-500 fill-green-500" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                )}
                <span className="font-mono text-sm">{item.code}</span>
                <span>{item.name}</span>
              </div>
              {!isLeaf && (
                <Badge variant="outline" className="text-xs">
                  {item.children?.length || 0} 项
                </Badge>
              )}
            </div>
          </td>

          {/* 期初余额 */}
          <td className="p-2 text-right">
            {formatMoney(item.beginningDebit)}
          </td>
          <td className="p-2 text-right">
            {formatMoney(item.beginningCredit)}
          </td>

          {/* 本期发生额 */}
          <td className="p-2 text-right">
            {formatMoney(item.currentDebit)}
          </td>
          <td className="p-2 text-right">
            {formatMoney(item.currentCredit)}
          </td>

          {/* 期末余额 */}
          <td className={`p-2 text-right ${item.endingDebit > 0 ? 'font-medium' : ''}`}>
            {formatMoney(item.endingDebit)}
          </td>
          <td className={`p-2 text-right ${item.endingCredit > 0 ? 'font-medium' : ''}`}>
            {formatMoney(item.endingCredit)}
          </td>
        </tr>

        {/* 子科目 */}
        {!isLeaf && isExpanded && item.children?.map(child =>
          renderSubject(child, true)
        )}
      </React.Fragment>
    );
  };

  // 格式化金额
  const formatMoney = (amount: number) => {
    if (amount === 0) return '-';
    return amount.toLocaleString('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2
    });
  };

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索科目代码或名称"
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
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                打印
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 科目余额表 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 text-sm font-medium">科目名称</th>
              <th className="text-right p-2 text-sm font-medium">期初借方</th>
              <th className="text-right p-2 text-sm font-medium">期初贷方</th>
              <th className="text-right p-2 text-sm font-medium">本期借方</th>
              <th className="text-right p-2 text-sm font-medium">本期贷方</th>
              <th className="text-right p-2 text-sm font-medium">期末借方</th>
              <th className="text-right p-2 text-sm font-medium">期末贷方</th>
            </tr>
          </thead>
          <tbody>
            {subjectTree.map(item => renderSubject(item))}
          </tbody>
          {/* 合计行 */}
          <tfoot className="bg-gray-100">
            <tr className="border-t-2 font-bold">
              <td className="p-2">合计</td>
              <td className="p-2 text-right">
                {formatMoney(totals.beginningDebit)}
              </td>
              <td className="p-2 text-right">
                {formatMoney(totals.beginningCredit)}
              </td>
              <td className="p-2 text-right">
                {formatMoney(totals.currentDebit)}
              </td>
              <td className="p-2 text-right">
                {formatMoney(totals.currentCredit)}
              </td>
              <td className="p-2 text-right">
                {formatMoney(totals.endingDebit)}
              </td>
              <td className="p-2 text-right">
                {formatMoney(totals.endingCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 平衡检查 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Circle className="h-5 w-5 text-green-500" />
              <span className="font-medium">试算平衡检查</span>
            </div>
            <div className="text-sm text-muted-foreground">
              借方总计: {formatMoney(totals.endingDebit)} |
              贷方总计: {formatMoney(totals.endingCredit)} |
              差额: {formatMoney(Math.abs(totals.endingDebit - totals.endingCredit))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}