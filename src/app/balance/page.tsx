'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Printer,
  X,
  ArrowLeft
} from 'lucide-react';
import { useVoucherStore } from '@/stores';
import { useSubjectStore } from '@/stores';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/accounting';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import * as XLSX from 'xlsx';

interface SubjectBalanceRow {
  subjectCode: string;
  subjectName: string;
  direction: 'debit' | 'credit';
  openingDebit: number;
  openingCredit: number;
  debitTotal: number;
  creditTotal: number;
  closingDebit: number;
  closingCredit: number;
}

export default function BalancePage() {
  const { vouchers, calculateSubjectBalances, initialize: initVouchers } = useVoucherStore();
  const { subjects, getSubjectByCode, initializeSubjects } = useSubjectStore();
  const router = useRouter();
  const [dataLoaded, setDataLoaded] = useState(false);

  // 确保数据已从数据库加载
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          initVouchers(),
          initializeSubjects(),
        ]);
      } catch (e) {
        console.error('Balance page init failed:', e);
      }
      setDataLoaded(true);
    };
    loadData();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [startMonth, setStartMonth] = useState<string>(() => `${new Date().getFullYear()}-01`); // 开始月份：当年1月
  const [endMonth, setEndMonth] = useState<string>(() => new Date().toISOString().slice(0, 7)); // 结束月份：YYYY-MM
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<{
    code: string;
    name: string;
    direction: 'debit' | 'credit';
  } | null>(null);

  // 确保开始月份不晚于结束月份
  const handleStartMonthChange = (value: string) => {
    setStartMonth(value);
    if (value && endMonth && value > endMonth) {
      setEndMonth(value);
    }
  };

  const handleEndMonthChange = (value: string) => {
    setEndMonth(value);
    if (value && startMonth && value < startMonth) {
      setStartMonth(value);
    }
  };

  // 调试日志
  useEffect(() => {
    if (dataLoaded) {
      console.log('[BalancePage] vouchers:', vouchers.length, 'subjects:', subjects.length);
      console.log('[BalancePage] posted vouchers:', vouchers.filter(v => v.status === 'posted').length);
      if (vouchers.length > 0) {
        const v = vouchers[0];
        console.log('[BalancePage] first voucher:', v.voucherNo, 'status:', v.status, 'entries:', v.entries?.length);
        if (v.entries?.[0]) {
          console.log('[BalancePage] first entry subjectCode:', v.entries[0].subjectCode);
          console.log('[BalancePage] subject found:', !!getSubjectByCode(v.entries[0].subjectCode));
        }
      }
    }
  }, [dataLoaded, vouchers.length, subjects.length]);

  // 计算科目余额
  const subjectBalances = useMemo(() => {
    // 按科目汇总借贷发生额
    const balanceMap = new Map<string, SubjectBalanceRow>();

    // 遍历所有已记账的凭证，并过滤月份范围
    vouchers.forEach(voucher => {
      if (voucher.status === 'posted') {
        // 月份范围过滤
        const voucherMonth = voucher.date.slice(0, 7);
        const matchesMonthRange = (!startMonth || !endMonth) ||
          (voucherMonth >= startMonth && voucherMonth <= endMonth);

        if (matchesMonthRange) {
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
              // 初始化期初余额（当前系统暂未录入期初余额，默认为0）
              const openingDebit = 0;
              const openingCredit = 0;

              balanceMap.set(entry.subjectCode, {
                subjectCode: entry.subjectCode,
                subjectName: entry.subjectName,
                direction: subject.direction,
                openingDebit,
                openingCredit,
                debitTotal: debitAmount,
                creditTotal: creditAmount,
                closingDebit: 0,
                closingCredit: 0
              });
            }
          });
        }
      }
    });

    // 计算期末余额
    balanceMap.forEach((balance, code) => {
      // 计算期末余额
      let closingDebit = 0;
      let closingCredit = 0;

      if (balance.direction === 'debit') {
        // 借方科目：余额 = 期初借方 + 借方 - 贷方
        const closingBalance = balance.openingDebit - balance.openingCredit + balance.debitTotal - balance.creditTotal;
        if (closingBalance >= 0) {
          closingDebit = closingBalance;
          closingCredit = 0;
        } else {
          closingDebit = 0;
          closingCredit = Math.abs(closingBalance);
        }
      } else {
        // 贷方科目：余额 = 期初贷方 + 贷方 - 借方
        const closingBalance = balance.openingCredit - balance.openingDebit + balance.creditTotal - balance.debitTotal;
        if (closingBalance >= 0) {
          closingDebit = 0;
          closingCredit = closingBalance;
        } else {
          closingDebit = Math.abs(closingBalance);
          closingCredit = 0;
        }
      }

      balance.closingDebit = closingDebit;
      balance.closingCredit = closingCredit;
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
    const totalOpeningDebit = subjectBalances.reduce((sum, b) => sum + b.openingDebit, 0);
    const totalOpeningCredit = subjectBalances.reduce((sum, b) => sum + b.openingCredit, 0);
    const totalClosingDebit = subjectBalances.reduce((sum, b) => sum + b.closingDebit, 0);
    const totalClosingCredit = subjectBalances.reduce((sum, b) => sum + b.closingCredit, 0);

    return {
      totalDebit,
      totalCredit,
      totalOpeningDebit,
      totalOpeningCredit,
      totalClosingDebit,
      totalClosingCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  }, [subjectBalances]);

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 格式化金额但不带货币符号（用于明细账和导出）
  const formatMoneyWithoutSymbol = (amount: number): string => {
    if (amount === 0) return '0.00';
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return amount < 0 ? `(${formatted})` : formatted;
  };

  // 计算明细账数据
  const ledgerEntries = useMemo(() => {
    if (!selectedSubject) return [];

    const subjectCode = selectedSubject.code;
    const direction = selectedSubject.direction;

    // 收集该科目的所有分录，按日期排序
    const entries: Array<{
      id: string;
      date: string;
      voucherNo: string;
      summary: string;
      debit: number;
      credit: number;
      balance: number;
      balanceDisplay: string;
    }> = [];

    // 过滤月份范围
    const filteredVouchers = vouchers.filter(voucher => {
      if (voucher.status !== 'posted') return false;
      const voucherMonth = voucher.date.slice(0, 7);
      return voucherMonth >= startMonth && voucherMonth <= endMonth;
    });

    // 按日期和凭证号排序
    const sortedVouchers = [...filteredVouchers].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.voucherNo || '').localeCompare(b.voucherNo || '');
    });

    // 计算余额
    let runningBalance = 0;

    sortedVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.subjectCode === subjectCode) {
          const debit = entry.debit || 0;
          const credit = entry.credit || 0;

          // 计算余额
          if (direction === 'debit') {
            // 借方科目：借方增加，贷方减少
            runningBalance += debit - credit;
          } else {
            // 贷方科目：贷方增加，借方减少
            runningBalance += credit - debit;
          }

          entries.push({
            id: entry.id,
            date: entry.date,
            voucherNo: voucher.voucherNo || '',
            summary: entry.summary || '',
            debit,
            credit,
            balance: runningBalance,
            balanceDisplay: runningBalance.toFixed(2)
          });
        }
      });
    });

    return entries;
  }, [selectedSubject, vouchers, startMonth, endMonth]);

  // 点击科目行显示明细账
  const handleSubjectClick = (subjectCode: string, subjectName: string, direction: 'debit' | 'credit') => {
    setSelectedSubject({ code: subjectCode, name: subjectName, direction });
    setShowLedgerDialog(true);
  };

  // 关闭明细账弹窗
  const handleCloseLedgerDialog = () => {
    setShowLedgerDialog(false);
    setSelectedSubject(null);
  };

  // 导出明细账到Excel
  const handleExportLedger = () => {
    if (!selectedSubject || ledgerEntries.length === 0) return;

    try {
      const exportData = ledgerEntries.map(entry => ({
        '日期': entry.date,
        '凭证号': entry.voucherNo,
        '摘要': entry.summary,
        '借方': entry.debit > 0 ? formatMoneyWithoutSymbol(entry.debit) : '',
        '贷方': entry.credit > 0 ? formatMoneyWithoutSymbol(entry.credit) : '',
        '余额': formatMoneyWithoutSymbol(entry.balance)
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${selectedSubject.name}_明细账`);

      const fileName = `${selectedSubject.name}_明细账_${startMonth}_至_${endMonth}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('导出明细账失败:', error);
    }
  };

  // 打印明细账
  const handlePrintLedger = () => {
    const content = document.querySelector('.ledger-dialog-content');
    if (content) {
      const printStyle = document.createElement('style');
      printStyle.innerHTML = `
        @media print {
          body * {
            visibility: hidden;
          }
          .ledger-dialog-content, .ledger-dialog-content * {
            visibility: visible;
          }
          .ledger-dialog-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 1cm;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
          }
          @page {
            margin: 1.5cm;
          }
          table {
            font-size: 10pt;
          }
        }
      `;
      document.head.appendChild(printStyle);
      window.print();
      setTimeout(() => {
        document.head.removeChild(printStyle);
      }, 100);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">科目余额表</h1>
          <p className="text-slate-600 mt-1">查询各科目的期初余额、本期发生额和期末余额</p>
        </div>
        <div className="flex gap-2 items-center">
          <ChineseMonthPicker
            value={startMonth}
            onChange={(v) => handleStartMonthChange(v)}
            className="w-36"
          />
          <span className="text-slate-400">至</span>
          <ChineseMonthPicker
            value={endMonth}
            onChange={(v) => handleEndMonthChange(v)}
            className="w-36"
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
                  {formatCurrency(stats.totalClosingDebit)}
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
                  {formatCurrency(stats.totalClosingCredit)}
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
          {!dataLoaded ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-slate-300" />
              <p>加载中...</p>
            </div>
          ) : filteredBalances.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无科目余额数据</p>
              <p className="text-sm mt-2">
                {vouchers.length === 0
                  ? '请先录入凭证'
                  : vouchers.every(v => v.status !== 'posted')
                    ? '凭证尚未记账，请先过账凭证'
                    : '当前月份范围内无数据，请调整月份筛选'}
              </p>
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
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      期初借方
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      期初贷方
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      本期借方
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      本期贷方
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      期末借方
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      期末贷方
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
                        <button
                          onClick={() => handleSubjectClick(balance.subjectCode, balance.subjectName, balance.direction)}
                          className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                        >
                          {balance.subjectCode}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <button
                          onClick={() => handleSubjectClick(balance.subjectCode, balance.subjectName, balance.direction)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {balance.subjectName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {balance.openingDebit > 0 ? formatCurrency(balance.openingDebit) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {balance.openingCredit > 0 ? formatCurrency(balance.openingCredit) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-blue-600">
                        {balance.debitTotal > 0 ? formatCurrency(balance.debitTotal) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-green-600">
                        {balance.creditTotal > 0 ? formatCurrency(balance.creditTotal) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                        {balance.closingDebit > 0 ? formatCurrency(balance.closingDebit) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                        {balance.closingCredit > 0 ? formatCurrency(balance.closingCredit) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* 合计行 */}
                <tfoot className="bg-slate-100 font-semibold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3">
                      合计
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(stats.totalOpeningDebit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(stats.totalOpeningCredit)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      {formatCurrency(stats.totalDebit)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatCurrency(stats.totalCredit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(stats.totalClosingDebit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(stats.totalClosingCredit)}
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
          <p>• <strong>期初借方/贷方</strong>：本期期初的科目借方或贷方余额，当前系统暂未录入期初余额，默认为0</p>
          <p>• <strong>本期借方/贷方</strong>：本期已记账凭证中该科目的借方或贷方发生额合计</p>
          <p>• <strong>期末借方/贷方</strong>：根据科目方向计算的期末余额，借方科目余额显示在借方列，贷方科目余额显示在贷方列</p>
          <p>• <strong>借贷平衡</strong>：所有科目的借方合计应等于贷方合计，系统会自动验证平衡状态</p>
          <p>• <strong>数据来源</strong>：数据来源于已记账（状态为"记账"）的凭证</p>
        </CardContent>
      </Card>

      {/* 明细账弹窗 */}
      <Dialog open={showLedgerDialog} onOpenChange={(open) => {
        if (!open) handleCloseLedgerDialog();
        setShowLedgerDialog(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col ledger-dialog-content">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <DialogTitle className="text-lg">
                {selectedSubject?.name} 明细账 ({selectedSubject?.code})
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-1">
                期间：{startMonth} 至 {endMonth}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportLedger()}
              >
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrintLedger()}
              >
                <Printer className="h-4 w-4 mr-2" />
                打印
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseLedgerDialog}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* 打印标题区域（仅打印时显示） */}
          <div className="print-header hidden print:block">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold">{selectedSubject?.name} 明细账</h2>
              <p className="text-sm text-slate-600 mt-1">
                账套：演示公司 | 期间：{startMonth} 至 {endMonth}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {ledgerEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>该科目在此期间无发生额</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border border-slate-200">日期</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border border-slate-200">凭证号</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border border-slate-200">摘要</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-slate-700 border border-slate-200">借方</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-slate-700 border border-slate-200">贷方</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-slate-700 border border-slate-200">
                      {selectedSubject?.direction === 'debit' ? '借方余额' : '贷方余额'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry, index) => (
                    <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-2 text-sm border border-slate-200">{entry.date}</td>
                      <td className="px-4 py-2 text-sm font-mono border border-slate-200">{entry.voucherNo}</td>
                      <td className="px-4 py-2 text-sm border border-slate-200">{entry.summary}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono border border-slate-200">
                        {entry.debit > 0 ? (
                          <span className="text-blue-600">{formatMoneyWithoutSymbol(entry.debit)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono border border-slate-200">
                        {entry.credit > 0 ? (
                          <span className="text-green-600">{formatMoneyWithoutSymbol(entry.credit)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-mono font-semibold border border-slate-200">
                        {formatMoneyWithoutSymbol(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button variant="outline" onClick={handleCloseLedgerDialog}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
