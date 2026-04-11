'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Search,
  Loader2,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { getCurrentService } from '@/lib/database';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { useRouter } from 'next/navigation';
import type { BankTransaction } from '@/types';

/** 格式化日期为中文：2026-04-10 → 2026年04月10日 */
const fmtDate = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
};

export function BankStatementsList() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const service = getCurrentService();
      const all = await service.getAllBankTransactions();
      // 只显示已入账的流水
      setTransactions(all.filter((tx: any) => tx.status === 'voucher_generated'));
    } catch (error) {
      console.error('加载银行流水失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 提取银行账号列表（从流水中去重）
  const bankAccounts = [...new Set(
    transactions.map(tx => tx.ourAccount).filter(Boolean)
  )];

  // 过滤 + 搜索 + 排序
  const filtered = transactions
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
      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-slate-50 rounded">
          <p className="text-xs text-slate-500">已入账流水</p>
          <p className="text-lg font-bold">{filtered.length}</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded">
          <p className="text-xs text-slate-500">收款合计</p>
          <p className="text-lg font-bold text-green-700">¥{fmt(totalCredit)}</p>
        </div>
        <div className="text-center p-3 bg-red-50 rounded">
          <p className="text-xs text-slate-500">付款合计</p>
          <p className="text-lg font-bold text-red-700">¥{fmt(totalDebit)}</p>
        </div>
      </div>

      {/* 筛选栏：银行账号 + 日期范围 + 搜索 */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="all">全部银行账号</option>
          {bankAccounts.map(acc => (
            <option key={acc} value={acc}>{acc}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-sm">
          <ChineseDatePicker
            value={dateRange.from}
            onChange={v => setDateRange(prev => ({ ...prev, from: v }))}
            className="text-sm"
          />
          <span className="text-slate-400">~</span>
          <ChineseDatePicker
            value={dateRange.to}
            onChange={v => setDateRange(prev => ({ ...prev, to: v }))}
            className="text-sm"
          />
        </div>
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

      {/* 表格 */}
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
                <th className="text-right py-2 px-2 font-medium">收款</th>
                <th className="text-right py-2 px-2 font-medium">付款</th>
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
                  <td className="py-2 px-2 text-right">
                    {tx.credit ? <span className="text-green-700 font-medium">¥{fmt(tx.credit)}</span> : ''}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {tx.debit ? <span className="text-red-700 font-medium">¥{fmt(tx.debit)}</span> : ''}
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
                        className="text-blue-600 hover:underline flex items-center gap-0.5"
                        onClick={() => router.push('/voucher-list')}
                      >
                        {tx.generatedVoucherNo}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : <span className="text-slate-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-medium text-sm">
                <td colSpan={3} className="py-2 px-2 text-right text-slate-500">合计</td>
                <td className="py-2 px-2 text-right text-green-700">¥{fmt(totalCredit)}</td>
                <td className="py-2 px-2 text-right text-red-700">¥{fmt(totalDebit)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
