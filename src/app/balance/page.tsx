'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Printer
} from 'lucide-react';
import { useVoucherStore } from '@/stores';
import { useSubjectStore } from '@/stores';

interface SubjectBalanceRow {
  subjectCode: string;
  subjectName: string;
  direction: 'debit' | 'credit';
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
}

export default function BalancePage() {
  const { vouchers, calculateSubjectBalances } = useVoucherStore();
  const { subjects, getSubjectByCode } = useSubjectStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('2026-03');

  // 计算科目余额
  const subjectBalances = useMemo(() => {
    // 按科目汇总借贷发生额
    const balanceMap = new Map<string, SubjectBalanceRow>();

    // 遍历所有已记账的凭证
    vouchers.forEach(voucher => {
      if (voucher.status === 'posted') {
        voucher.entries.forEach(entry => {
          const subject = getSubjectByCode(entry.subjectCode);
          if (!subject) return;

          const existing = balanceMap.get(entry.subjectCode);
          const debitAmount = entry.debit || 0;
          const creditAmount = entry.credit || 0;

          if (existing) {
            existing.debitTotal += debitAmount;
            existing.creditTotal += creditAmount;
          } else {
            balanceMap.set(entry.subjectCode, {
              subjectCode: entry.subjectCode,
              subjectName: entry.subjectName,
              direction: subject.direction,
              openingBalance: 0,
              debitTotal: debitAmount,
              creditTotal: creditAmount,
              closingBalance: 0
            });
          }
        });
      }
    });

    // 计算期末余额
    balanceMap.forEach((balance, code) => {
      if (balance.direction === 'debit') {
        // 借方科目：余额 = 期初 + 借方 - 贷方
        balance.closingBalance = balance.openingBalance + balance.debitTotal - balance.creditTotal;
      } else {
        // 贷方科目：余额 = 期初 + 贷方 - 借方
        balance.closingBalance = balance.openingBalance + balance.creditTotal - balance.debitTotal;
      }
    });

    return Array.from(balanceMap.values());
  }, [vouchers, getSubjectByCode]);

  // 过滤后的科目余额
  const filteredBalances = useMemo(() => {
    if (!searchQuery.trim()) return subjectBalances;
    const query = searchQuery.toLowerCase();
    return subjectBalances.filter(b =>
      b.subjectCode.toLowerCase().includes(query) ||
      b.subjectName.toLowerCase().includes(query)
    );
  }, [subjectBalances, searchQuery]);

  // 统计数据
  const stats = useMemo(() => {
    const totalDebit = subjectBalances.reduce((sum, b) => sum + b.debitTotal, 0);
    const totalCredit = subjectBalances.reduce((sum, b) => sum + b.creditTotal, 0);
    const debitClosing = subjectBalances.reduce((sum, b) =>
      b.direction === 'debit' && b.closingBalance > 0 ? sum + b.closingBalance : sum, 0);
    const creditClosing = subjectBalances.reduce((sum, b) =>
      b.direction === 'credit' && b.closingBalance > 0 ? sum + b.closingBalance : sum, 0);

    return {
      totalDebit,
      totalCredit,
      debitClosing,
      creditClosing,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  }, [subjectBalances]);

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">科目余额表</h1>
          <p className="text-slate-600 mt-1">查询各科目的期初余额、本期发生额和期末余额</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="month"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-40"
          />
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

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">本期借方合计</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(stats.totalDebit)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">本期贷方合计</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalCredit)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">期末借方余额</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(stats.debitClosing)}
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">期末贷方余额</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.creditClosing)}
                </p>
              </div>
              <FileText className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 平衡状态 */}
      {!stats.isBalanced && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-700">
              <RefreshCw className="h-5 w-5" />
              <span>
                借贷不平衡！借方合计与贷方合计相差 {formatCurrency(Math.abs(stats.totalDebit - stats.totalCredit))}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作栏 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索科目代码或名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Badge variant={stats.isBalanced ? 'default' : 'destructive'}>
              {stats.isBalanced ? '借贷平衡' : '借贷不平衡'}
            </Badge>
            <Badge variant="outline">
              科目数: {filteredBalances.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 科目余额表 */}
      <Card>
        <CardHeader>
          <CardTitle>科目余额明细</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBalances.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无科目余额数据</p>
              <p className="text-sm mt-2">请先录入凭证并记账</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      科目代码
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      科目名称
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      方向
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      期初余额
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      本期借方
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      本期贷方
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      期末余额
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBalances.map((balance, index) => (
                    <tr
                      key={balance.subjectCode}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm">{balance.subjectCode}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{balance.subjectName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={balance.direction === 'debit' ? 'default' : 'secondary'}>
                          {balance.direction === 'debit' ? '借' : '贷'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatCurrency(balance.openingBalance)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-blue-600">
                        {formatCurrency(balance.debitTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-green-600">
                        {formatCurrency(balance.creditTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                        {formatCurrency(Math.abs(balance.closingBalance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* 合计行 */}
                <tfoot className="bg-slate-100 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-4 py-3">
                      合计
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(0)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      {formatCurrency(stats.totalDebit)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatCurrency(stats.totalCredit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(stats.isBalanced ? 0 : Math.abs(stats.totalDebit - stats.totalCredit))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>• <strong>期初余额</strong>：本期期初的科目余额，当前系统暂未录入期初余额，默认为0</p>
          <p>• <strong>本期借方/贷方</strong>：本期已记账凭证中该科目的借方或贷方发生额合计</p>
          <p>• <strong>期末余额</strong>：根据科目方向计算的期末余额，借方科目=期初+借方-贷方，贷方科目=期初+贷方-借方</p>
          <p>• <strong>借贷平衡</strong>：所有科目的借方合计应等于贷方合计，系统会自动验证平衡状态</p>
          <p>• <strong>数据来源</strong>：数据来源于已记账（状态为"记账"）的凭证</p>
        </CardContent>
      </Card>
    </div>
  );
}
