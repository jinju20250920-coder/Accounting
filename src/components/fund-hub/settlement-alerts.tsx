'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, ArrowUpCircle, ArrowDownCircle, Zap } from 'lucide-react';

interface SettlementAlertsProps {
  transactions: any[];
  cutoffDate: string;
}

function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Alert {
  type: 'large_out' | 'large_in' | 'balance_low' | 'unusual';
  severity: 'warning' | 'info' | 'danger';
  title: string;
  description: string;
  amount?: number;
  date: string;
}

export function SettlementAlerts({ transactions, cutoffDate }: SettlementAlertsProps) {
  const alerts = useMemo((): Alert[] => {
    const result: Alert[] = [];
    if (transactions.length === 0) return result;

    // Recent transactions (last 7 days before cutoff)
    const cutoff = new Date(cutoffDate);
    const weekAgo = new Date(cutoff);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const recent = transactions.filter(tx => tx.date >= weekAgoStr);

    // Calculate average transaction amount for "large" threshold
    const allAmounts = transactions
      .map(tx => Math.max(tx.debit || 0, tx.credit || 0))
      .filter(a => a > 0);
    const avg = allAmounts.length > 0
      ? allAmounts.reduce((s, a) => s + a, 0) / allAmounts.length
      : 0;
    const largeThreshold = Math.max(avg * 3, 50000); // 3x average or at least 50K

    for (const tx of recent) {
      const outAmount = tx.credit || 0;
      const inAmount = tx.debit || 0;

      // Large outgoing
      if (outAmount >= largeThreshold) {
        result.push({
          type: 'large_out',
          severity: 'warning',
          title: '大额支出',
          description: `${tx.counterpartyName || tx.summary || '未知'} ${tx.summary || ''}`,
          amount: outAmount,
          date: tx.date,
        });
      }

      // Large incoming
      if (inAmount >= largeThreshold) {
        result.push({
          type: 'large_in',
          severity: 'info',
          title: '大额收入',
          description: `${tx.counterpartyName || tx.summary || '未知'} ${tx.summary || ''}`,
          amount: inAmount,
          date: tx.date,
        });
      }
    }

    // Check for low balance
    const perBank = new Map<string, { branch: string; balance: number }>();
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    for (const tx of sorted) {
      if (tx.balance !== undefined && tx.balance !== null) {
        perBank.set(tx.ourAccount || 'unknown', {
          branch: tx.ourBranch || '未知',
          balance: tx.balance,
        });
      }
    }
    for (const [, bank] of perBank) {
      if (bank.balance < 10000 && bank.balance >= 0) {
        result.push({
          type: 'balance_low',
          severity: 'danger',
          title: '余额偏低',
          description: `${bank.branch} 余额低于 10,000`,
          amount: bank.balance,
          date: cutoffDate,
        });
      }
    }

    // Sort by severity then date
    const severityOrder = { danger: 0, warning: 1, info: 2 };
    result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.date.localeCompare(a.date));

    return result.slice(0, 8); // Max 8 alerts
  }, [transactions, cutoffDate]);

  const severityStyles = {
    danger: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  const severityIcons = {
    danger: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
    warning: <Zap className="h-3.5 w-3.5 text-amber-500" />,
    info: <ArrowUpCircle className="h-3.5 w-3.5 text-blue-500" />,
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">结算预警</span>
            {alerts.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                {alerts.length}
              </span>
            )}
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">暂无预警</div>
        ) : (
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 px-2.5 py-2 rounded-md border ${severityStyles[alert.severity]}`}
              >
                <div className="flex-shrink-0 mt-0.5">{severityIcons[alert.severity]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{alert.title}</span>
                    {alert.amount !== undefined && (
                      <span className="text-xs font-medium">{formatMoney(alert.amount)}</span>
                    )}
                  </div>
                  <div className="text-[10px] opacity-80 truncate">{alert.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
