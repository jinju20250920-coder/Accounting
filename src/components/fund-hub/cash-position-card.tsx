'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, Building2, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import type { BankTransaction, Subject } from '@/types';

interface CashPositionCardProps {
  transactions: BankTransaction[];
  periodTransactions: BankTransaction[];
  cutoffDate: string;
  periodLabel: string;
  subjects: Subject[];
}

function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CashPositionCard({
  transactions,
  periodTransactions,
  cutoffDate,
  periodLabel,
  subjects,
}: CashPositionCardProps) {

  // Per-bank latest balance
  const bankPositions = useMemo(() => {
    const bankMap = new Map<string, { account: string; branch: string; lastBalance: number; lastDate: string }>();

    // Process in date order (transactions are DESC, so reverse)
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    for (const tx of sorted) {
      const key = tx.ourAccount || 'unknown';
      const existing = bankMap.get(key);
      if (!existing || tx.date >= existing.lastDate) {
        bankMap.set(key, {
          account: tx.ourAccount || '',
          branch: tx.ourBranch || '未知银行',
          lastBalance: tx.balance ?? 0,
          lastDate: tx.date,
        });
      }
    }

    return Array.from(bankMap.values()).sort((a, b) => b.lastBalance - a.lastBalance);
  }, [transactions]);

  const totalBalance = useMemo(() => {
    return bankPositions.reduce((sum, b) => sum + b.lastBalance, 0);
  }, [bankPositions]);

  // Period income/expense
  const periodStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of periodTransactions) {
      if (tx.debit && tx.debit > 0) income += tx.debit;
      if (tx.credit && tx.credit > 0) expense += tx.credit;
    }
    return { income, expense, net: income - expense };
  }, [periodTransactions]);

  // Get bank display name
  const getBankDisplay = (branch: string, account: string) => {
    const last4 = account ? account.slice(-4) : '';
    return last4 ? `${branch} ${last4}` : branch;
  };

  // Net flow indicator
  const isPositive = periodStats.net >= 0;

  return (
    <>
      {/* Total Balance */}
      <Card className="col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-slate-500">现金头寸</span>
          </div>
          <div className="text-xl font-bold text-slate-800">
            {formatMoney(totalBalance)}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {isPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
              {periodLabel}净{isPositive ? '流入' : '流出'} {formatMoney(Math.abs(periodStats.net))}
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 mb-1">{bankPositions.length} 个账户</div>
            {bankPositions.slice(0, 3).map((bank, idx) => (
              <div key={idx} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  <span className="text-[11px] text-slate-600 truncate max-w-[120px]">
                    {getBankDisplay(bank.branch, bank.account)}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-700">
                  {formatMoney(bank.lastBalance)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Period Income */}
      <Card className="col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs text-slate-500">{periodLabel}流入</span>
          </div>
          <div className="text-xl font-bold text-green-700">
            {formatMoney(periodStats.income)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {periodTransactions.filter(tx => tx.debit && tx.debit > 0).length} 笔收入
          </div>
        </CardContent>
      </Card>

      {/* Period Expense */}
      <Card className="col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-xs text-slate-500">{periodLabel}流出</span>
          </div>
          <div className="text-xl font-bold text-red-600">
            {formatMoney(periodStats.expense)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {periodTransactions.filter(tx => tx.credit && tx.credit > 0).length} 笔支出
          </div>
        </CardContent>
      </Card>

      {/* Net Flow */}
      <Card className="col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-slate-500">净流量</span>
          </div>
          <div className={`text-xl font-bold ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{formatMoney(periodStats.net)}
          </div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isPositive ? 'bg-green-500' : 'bg-red-400'}`}
              style={{
                width: periodStats.income + periodStats.expense > 0
                  ? `${Math.abs(periodStats.net) / (periodStats.income + periodStats.expense) * 100}%`
                  : '0%'
              }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            收支比 {periodStats.expense > 0 ? (periodStats.income / periodStats.expense).toFixed(2) : '∞'}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
