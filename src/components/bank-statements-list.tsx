'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Search,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { getCurrentService } from '@/lib/database';
import { waitForDbInit } from '@/hooks/useDatabaseSync';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BankTransaction, Voucher } from '@/types';

/** 格式化日期为中文：2026-04-10 → 2026年04月10日 */
const fmtDate = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
};

type DateMode = 'month' | 'day';

export function BankStatementsList() {
  const [allTransactions, setAllTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [dateMode, setDateMode] = useState<DateMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dayRange, setDayRange] = useState({ from: '', to: '' });
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [voucherDetail, setVoucherDetail] = useState<Voucher | null>(null);
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);

  useEffect(() => { loadTransactions(); }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      await waitForDbInit();
      const service = getCurrentService();
      const all = await service.getAllBankTransactions();
      setAllTransactions(all.filter(tx => tx.status === 'voucher_generated'));
    } catch (error) {
      console.error('加载银行流水失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /** 点击凭证号时加载并弹出凭证明细 */
  const handleViewVoucher = async (voucherId: string) => {
    try {
      const service = getCurrentService();
      const voucher = await service.getVoucher(voucherId);
      if (voucher) {
        setVoucherDetail(voucher);
        setShowVoucherDialog(true);
      }
    } catch (error) {
      console.error('加载凭证失败:', error);
    }
  };

  // 日期范围计算
  const dateRange = useMemo(() => {
    if (dateMode === 'month' && selectedMonth) {
      return { from: `${selectedMonth}-01`, to: `${selectedMonth}-31` };
    }
    return dayRange;
  }, [dateMode, selectedMonth, dayRange]);

  // 提取银行账号列表
  const bankAccounts = useMemo(
    () => [...new Set(allTransactions.map(tx => tx.ourAccount).filter(Boolean))],
    [allTransactions]
  );

  /** 银行账号 → 显示名（开户机构 + 账号后4位） */
  const bankDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of allTransactions) {
      if (!tx.ourAccount || map.has(tx.ourAccount)) continue;
      const last4 = tx.ourAccount.slice(-4);
      const branch = tx.ourBranch || '';
      const display = branch ? `${branch} ...${last4}` : `...${last4}`;
      map.set(tx.ourAccount, display);
    }
    return map;
  }, [allTransactions]);

  // ====== 汇总表数据 ======
  const summaryData = useMemo(() => {
    const from = dateRange.from;
    const to = dateRange.to;

    // 按银行分组
    const groups = new Map<string, { txs: BankTransaction[] }>();
    for (const tx of allTransactions) {
      const key = tx.ourAccount || '未知';
      if (!groups.has(key)) groups.set(key, { txs: [] });
      groups.get(key)!.txs.push(tx);
    }

    const rows: { account: string; opening: number; income: number; expense: number; closing: number }[] = [];

    for (const [account, { txs }] of groups) {
      // 按日期排序
      const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

      // 期初余额：筛选起始日期之前最后一笔的 balance
      let opening = 0;
      const beforeRange = sorted.filter(tx => tx.date < from);
      if (beforeRange.length > 0) {
        const lastBefore = beforeRange[beforeRange.length - 1];
        opening = lastBefore.balance || 0;
      }

      // 本期数据
      const inRange = sorted.filter(tx => {
        if (from && tx.date < from) return false;
        if (to && tx.date > to) return false;
        return true;
      });

      const income = inRange.reduce((s, t) => s + (t.credit || 0), 0);
      const expense = inRange.reduce((s, t) => s + (t.debit || 0), 0);

      // 期末余额：筛选范围内最后一笔的 balance，或期初
      let closing = opening;
      if (inRange.length > 0) {
        closing = inRange[inRange.length - 1].balance || (opening + income - expense);
      }

      rows.push({ account, opening, income, expense, closing });
    }

    // 合计行
    const totals = rows.reduce(
      (acc, r) => ({
        opening: acc.opening + r.opening,
        income: acc.income + r.income,
        expense: acc.expense + r.expense,
        closing: acc.closing + r.closing,
      }),
      { opening: 0, income: 0, expense: 0, closing: 0 }
    );

    return { rows, totals };
  }, [allTransactions, dateRange]);

  // ====== 明细过滤 ======
  const filtered = useMemo(() => {
    return allTransactions
      .filter(tx => {
        if (selectedAccount !== 'all' && tx.ourAccount !== selectedAccount) return false;
        if (dateRange.from && tx.date < dateRange.from) return false;
        if (dateRange.to && tx.date > dateRange.to) return false;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const text = [tx.summary, tx.notes, tx.counterpartyName, tx.matchedSubjectName, tx.generatedVoucherNo]
            .filter(Boolean).join(' ').toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'date') {
          const cmp = a.date.localeCompare(b.date);
          return sortDir === 'asc' ? cmp : -cmp;
        }
        const amtA = a.debit || a.credit || 0;
        const amtB = b.debit || b.credit || 0;
        return sortDir === 'asc' ? amtA - amtB : amtB - amtA;
      });
  }, [allTransactions, selectedAccount, dateRange, searchTerm, sortField, sortDir]);

  const totalDebit = filtered.reduce((s, t) => s + (t.debit || 0), 0);
  const totalCredit = filtered.reduce((s, t) => s + (t.credit || 0), 0);

  const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2 });

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== 银行账户汇总表 ===== */}
      {summaryData.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg">
            <thead className="bg-slate-50">
              <tr className="text-slate-600">
                <th className="text-left py-2 px-3 font-medium border-b">银行账户</th>
                <th className="text-right py-2 px-3 font-medium border-b">期初余额</th>
                <th className="text-right py-2 px-3 font-medium border-b">本期收入</th>
                <th className="text-right py-2 px-3 font-medium border-b">本期支出</th>
                <th className="text-right py-2 px-3 font-medium border-b">期末余额</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.rows.map(row => (
                <tr key={row.account} className="border-b hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedAccount(prev => prev === row.account ? 'all' : row.account)}
                >
                  <td className="py-2 px-3 text-xs font-medium">
                    {bankDisplayMap.get(row.account) || row.account}
                    {selectedAccount === row.account && (
                      <span className="ml-1 text-blue-500">&#9650;</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-xs text-slate-600">¥{fmt(row.opening)}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs text-green-700">¥{fmt(row.income)}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs text-red-700">¥{fmt(row.expense)}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs font-medium">¥{fmt(row.closing)}</td>
                </tr>
              ))}
              {/* 合计行 */}
              <tr className="bg-slate-50 font-medium text-xs">
                <td className="py-2 px-3">合计</td>
                <td className="py-2 px-3 text-right font-mono text-slate-600">¥{fmt(summaryData.totals.opening)}</td>
                <td className="py-2 px-3 text-right font-mono text-green-700">¥{fmt(summaryData.totals.income)}</td>
                <td className="py-2 px-3 text-right font-mono text-red-700">¥{fmt(summaryData.totals.expense)}</td>
                <td className="py-2 px-3 text-right font-mono">¥{fmt(summaryData.totals.closing)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ===== 筛选栏 ===== */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="all">全部银行</option>
          {bankAccounts.map(acc => (
            <option key={acc} value={acc}>{bankDisplayMap.get(acc) || acc}</option>
          ))}
        </select>

        {/* 日期模式切换 */}
        <div className="flex items-center gap-1 text-sm border rounded-md overflow-hidden">
          <button
            className={`px-3 py-1.5 ${dateMode === 'month' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setDateMode('month')}
          >
            按月
          </button>
          <button
            className={`px-3 py-1.5 ${dateMode === 'day' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setDateMode('day')}
          >
            按日
          </button>
        </div>

        {/* 日期选择器 */}
        {dateMode === 'month' ? (
          <ChineseMonthPicker
            value={selectedMonth}
            onChange={setSelectedMonth}
            className="text-sm"
          />
        ) : (
          <div className="flex items-center gap-1 text-sm">
            <ChineseDatePicker
              value={dayRange.from}
              onChange={v => setDayRange(prev => ({ ...prev, from: v }))}
              className="text-sm"
            />
            <span className="text-slate-400">~</span>
            <ChineseDatePicker
              value={dayRange.to}
              onChange={v => setDayRange(prev => ({ ...prev, to: v }))}
              className="text-sm"
            />
          </div>
        )}

        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索摘要、对方户名、凭证号..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* ===== 明细表格 ===== */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>暂无已入账流水记录</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b">
                <th className="text-left py-2 px-2 font-medium">
                  <button className="flex items-center gap-1" onClick={() => toggleSort('date')}>
                    日期 <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 px-2 font-medium">摘要</th>
                <th className="text-left py-2 px-2 font-medium">对方户名</th>
                <th className="text-left py-2 px-2 font-medium">对方账号</th>
                <th className="text-right py-2 px-2 font-medium">收款</th>
                <th className="text-right py-2 px-2 font-medium">付款</th>
                <th className="text-right py-2 px-2 font-medium">余额</th>
                <th className="text-left py-2 px-2 font-medium">匹配科目</th>
                <th className="text-left py-2 px-2 font-medium">备注</th>
                <th className="text-left py-2 px-2 font-medium">凭证号</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-2 text-xs whitespace-nowrap">{fmtDate(tx.date)}</td>
                  <td className="py-2 px-2 max-w-[180px] truncate" title={tx.summary}>
                    {tx.summary || '-'}
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-600">{tx.counterpartyName || '-'}</td>
                  <td className="py-2 px-2 text-xs text-slate-400 font-mono">{tx.counterpartyAccount || '-'}</td>
                  <td className="py-2 px-2 text-right">
                    {tx.credit ? <span className="text-green-700 font-medium">¥{fmt(tx.credit)}</span> : ''}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {tx.debit ? <span className="text-red-700 font-medium">¥{fmt(tx.debit)}</span> : ''}
                  </td>
                  <td className="py-2 px-2 text-right text-xs text-slate-500">
                    {tx.balance != null ? `¥${fmt(tx.balance)}` : '-'}
                  </td>
                  <td className="py-2 px-2 text-xs">
                    {tx.matchedSubject
                      ? <><span className="font-mono text-blue-600">{tx.matchedSubject}</span> <span className="text-slate-500">{tx.matchedSubjectName}</span></>
                      : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-500 max-w-[200px] truncate" title={tx.notes}>
                    {tx.notes || '-'}
                  </td>
                  <td className="py-2 px-2 text-xs">
                    {tx.generatedVoucherNo ? (
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => handleViewVoucher(tx.voucherId)}
                      >
                        {tx.generatedVoucherNo}
                      </button>
                    ) : <span className="text-slate-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-medium text-sm">
                <td colSpan={4} className="py-2 px-2 text-right text-slate-500">合计</td>
                <td className="py-2 px-2 text-right text-green-700">¥{fmt(totalCredit)}</td>
                <td className="py-2 px-2 text-right text-red-700">¥{fmt(totalDebit)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 凭证明细弹窗 */}
      <Dialog open={showVoucherDialog} onOpenChange={setShowVoucherDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>凭证明细</DialogTitle>
          </DialogHeader>
          {voucherDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">凭证号：</span>
                  <span className="font-mono font-medium">{voucherDetail.voucherNo}</span>
                </div>
                <div>
                  <span className="text-slate-500">日期：</span>
                  <span className="font-medium">{voucherDetail.date}</span>
                </div>
                <div>
                  <span className="text-slate-500">类型：</span>
                  <Badge variant="outline">{voucherDetail.voucherType === 'payment' ? '付款' : voucherDetail.voucherType === 'receipt' ? '收款' : voucherDetail.voucherType || '-'}</Badge>
                </div>
              </div>
              {voucherDetail.summary && (
                <div className="text-sm">
                  <span className="text-slate-500">摘要：</span>
                  {voucherDetail.summary}
                </div>
              )}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2 border-b">摘要</th>
                      <th className="text-left p-2 border-b">科目</th>
                      <th className="text-right p-2 border-b">借方</th>
                      <th className="text-right p-2 border-b">贷方</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucherDetail.entries?.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="p-2 border-b text-xs">{entry.summary || '-'}</td>
                        <td className="p-2 border-b text-xs">
                          <span className="font-mono">{entry.subjectCode}</span> {entry.subjectName}
                        </td>
                        <td className="p-2 border-b text-right font-mono">
                          {entry.debit > 0 ? entry.debit.toFixed(2) : ''}
                        </td>
                        <td className="p-2 border-b text-right font-mono">
                          {entry.credit > 0 ? entry.credit.toFixed(2) : ''}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-medium text-xs">
                      <td className="p-2" colSpan={2}>合计</td>
                      <td className="p-2 text-right font-mono text-blue-600">
                        {voucherDetail.entries?.reduce((s, e) => s + (e.debit || 0), 0).toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-mono text-blue-600">
                        {voucherDetail.entries?.reduce((s, e) => s + (e.credit || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
