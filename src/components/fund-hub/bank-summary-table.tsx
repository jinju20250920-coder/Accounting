'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';

interface BankTransactionRow {
  date: string;
  ourAccount?: string;
  ourBranch?: string;
  balance?: number | null;
  debit?: number;
  credit?: number;
  summary?: string;
  counterpartyName?: string;
}

interface BankSummaryTableProps {
  transactions: BankTransactionRow[];
  periodTransactions: BankTransactionRow[];
  periodRange: { start: string; end: string };
  periodLabel: string;
  cutoffDate: string;
}

interface BankSummary {
  account: string;
  branch: string;
  openingBalance: number;
  currentBalance: number;
  income: number;
  expense: number;
}

function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoneyShort(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(1)}万`;
  }
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function BankSummaryTable({
  transactions,
  periodTransactions,
  periodRange,
  periodLabel,
  cutoffDate,
}: BankSummaryTableProps) {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  // Per-bank summary data
  const bankSummaries = useMemo((): BankSummary[] => {
    const bankMap = new Map<string, BankSummary>();

    // All transactions sorted by date
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    // Transactions before period start (for opening balance)
    const beforePeriod = sorted.filter(tx => tx.date < periodRange.start);
    // Transactions in period
    const inPeriod = sorted.filter(tx => tx.date >= periodRange.start && tx.date <= periodRange.end);

    // Calculate opening balance per bank (last balance before period start)
    const openingMap = new Map<string, number>();
    for (const tx of beforePeriod) {
      const key = tx.ourAccount || 'unknown';
      if (tx.balance !== undefined && tx.balance !== null) {
        openingMap.set(key, tx.balance);
      }
    }

    // Calculate period income/expense per bank
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    for (const tx of inPeriod) {
      const key = tx.ourAccount || 'unknown';
      incomeMap.set(key, (incomeMap.get(key) || 0) + (tx.debit || 0));
      expenseMap.set(key, (expenseMap.get(key) || 0) + (tx.credit || 0));
    }

    // Current balance per bank (last balance up to cutoff)
    const currentMap = new Map<string, { balance: number; date: string }>();
    for (const tx of sorted) {
      const key = tx.ourAccount || 'unknown';
      if (tx.balance !== undefined && tx.balance !== null) {
        const existing = currentMap.get(key);
        if (!existing || tx.date >= existing.date) {
          currentMap.set(key, { balance: tx.balance, date: tx.date });
        }
      }
    }

    // Collect all bank keys
    const allKeys = new Set([
      ...openingMap.keys(),
      ...incomeMap.keys(),
      ...expenseMap.keys(),
      ...currentMap.keys(),
    ]);

    for (const key of allKeys) {
      // Find branch name from transactions
      const branchTx = sorted.find(tx => (tx.ourAccount || 'unknown') === key && tx.ourBranch);
      const branch = branchTx?.ourBranch || '未知银行';

      const opening = openingMap.get(key) ?? 0;
      const current = currentMap.get(key)?.balance ?? 0;
      const income = incomeMap.get(key) ?? 0;
      const expense = expenseMap.get(key) ?? 0;

      bankMap.set(key, { account: key, branch, openingBalance: opening, currentBalance: current, income, expense });
    }

    return Array.from(bankMap.values()).sort((a, b) => b.currentBalance - a.currentBalance);
  }, [transactions, periodRange]);

  // Totals
  const totals = useMemo(() => {
    return bankSummaries.reduce(
      (acc, b) => ({
        opening: acc.opening + b.openingBalance,
        current: acc.current + b.currentBalance,
        income: acc.income + b.income,
        expense: acc.expense + b.expense,
      }),
      { opening: 0, current: 0, income: 0, expense: 0 }
    );
  }, [bankSummaries]);

  // Bar chart max value
  const chartMax = useMemo(() => {
    if (bankSummaries.length === 0) return 1;
    return Math.max(...bankSummaries.map(b => Math.max(b.income, b.expense)), 1);
  }, [bankSummaries]);

  // Selected bank transactions
  const selectedTransactions = useMemo(() => {
    if (!selectedBank) return [];
    return transactions
      .filter(tx => (tx.ourAccount || 'unknown') === selectedBank && tx.date >= periodRange.start && tx.date <= periodRange.end)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, selectedBank, periodRange]);

  const getBankDisplay = (branch: string, account: string) => {
    const last4 = account && account.length >= 4 ? account.slice(-4) : '';
    return last4 ? `${branch}(${last4})` : branch;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600 w-10"></th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">银行名称</th>
                  <th className="text-right px-3 py-2.5 font-medium text-slate-600">{periodLabel}期初</th>
                  <th className="text-right px-3 py-2.5 font-medium text-slate-600">当前结余</th>
                  <th className="text-right px-3 py-2.5 font-medium text-slate-600">收入金额</th>
                  <th className="text-right px-3 py-2.5 font-medium text-slate-600">支出金额</th>
                </tr>
              </thead>
              <tbody>
                {bankSummaries.map((bank) => {
                  const isSelected = selectedBank === bank.account;
                  return (
                    <React.Fragment key={bank.account}>
                      <tr
                        className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedBank(isSelected ? null : bank.account)}
                      >
                        <td className="px-3 py-2">
                          {isSelected ? (
                            <ChevronDown className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-700 font-medium">
                              {getBankDisplay(bank.branch, bank.account)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {formatMoney(bank.openingBalance)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">
                          {formatMoney(bank.currentBalance)}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">
                          {bank.income > 0 ? formatMoney(bank.income) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-red-500">
                          {bank.expense > 0 ? formatMoney(bank.expense) : '-'}
                        </td>
                      </tr>

                      {/* Expanded transaction detail */}
                      {isSelected && (
                        <tr>
                          <td colSpan={6} className="px-0 py-0">
                            <div className="bg-slate-50 border-y border-slate-200">
                              {/* Mini bar chart for this bank */}
                              <div className="px-4 py-3 border-b border-slate-200">
                                <div className="flex items-center gap-4 mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
                                    <span className="text-[10px] text-slate-500">收入</span>
                                    <span className="text-xs font-medium text-green-600">{formatMoney(bank.income)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />
                                    <span className="text-[10px] text-slate-500">支出</span>
                                    <span className="text-xs font-medium text-red-500">{formatMoney(bank.expense)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Transaction list */}
                              <div className="max-h-[200px] overflow-y-auto">
                                {selectedTransactions.length === 0 ? (
                                  <div className="text-center py-4 text-slate-400 text-xs">暂无交易明细</div>
                                ) : (
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="bg-slate-100">
                                        <th className="text-left px-4 py-1.5 font-medium text-slate-500">日期</th>
                                        <th className="text-left px-2 py-1.5 font-medium text-slate-500">摘要</th>
                                        <th className="text-left px-2 py-1.5 font-medium text-slate-500">对方户名</th>
                                        <th className="text-right px-2 py-1.5 font-medium text-slate-500">收入</th>
                                        <th className="text-right px-2 py-1.5 font-medium text-slate-500">支出</th>
                                        <th className="text-right px-4 py-1.5 font-medium text-slate-500">余额</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedTransactions.map((tx, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 hover:bg-white">
                                          <td className="px-4 py-1.5 text-slate-600">{tx.date}</td>
                                          <td className="px-2 py-1.5 text-slate-700 truncate max-w-[180px]">{tx.summary || '-'}</td>
                                          <td className="px-2 py-1.5 text-slate-600 truncate max-w-[120px]">{tx.counterpartyName || '-'}</td>
                                          <td className="px-2 py-1.5 text-right text-green-600">
                                            {tx.debit > 0 ? formatMoney(tx.debit) : '-'}
                                          </td>
                                          <td className="px-2 py-1.5 text-right text-red-500">
                                            {tx.credit > 0 ? formatMoney(tx.credit) : '-'}
                                          </td>
                                          <td className="px-4 py-1.5 text-right text-slate-700">
                                            {tx.balance !== undefined && tx.balance !== null ? formatMoney(tx.balance) : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Totals row */}
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-medium">
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-slate-800">合计</td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(totals.opening)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-800 font-bold">{formatMoney(totals.current)}</td>
                  <td className="px-3 py-2.5 text-right text-green-600">{formatMoney(totals.income)}</td>
                  <td className="px-3 py-2.5 text-right text-red-500">{formatMoney(totals.expense)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Per-bank bar chart */}
      {bankSummaries.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700">各银行收支对比</span>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> 收入
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" /> 支出
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              {bankSummaries.map((bank) => {
                const incomePct = chartMax > 0 ? (bank.income / chartMax) * 100 : 0;
                const expensePct = chartMax > 0 ? (bank.expense / chartMax) * 100 : 0;
                return (
                  <div key={bank.account} className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-600 w-28 truncate flex-shrink-0" title={getBankDisplay(bank.branch, bank.account)}>
                      {getBankDisplay(bank.branch, bank.account)}
                    </span>
                    <div className="flex-1 space-y-0.5">
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.max(incomePct, bank.income > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full transition-all"
                          style={{ width: `${Math.max(expensePct, bank.expense > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right flex-shrink-0">
                      <div className="text-[10px] text-green-600">{bank.income > 0 ? formatMoneyShort(bank.income) : '-'}</div>
                      <div className="text-[10px] text-red-500">{bank.expense > 0 ? formatMoneyShort(bank.expense) : '-'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
