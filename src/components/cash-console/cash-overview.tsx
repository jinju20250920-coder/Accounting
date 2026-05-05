'use client';

import { useState, useEffect } from 'react';
import { sqliteService } from '@/lib/database';
import { formatMoney } from '@/lib/accounting';
import { TrendingUp, TrendingDown, Wallet, Scale } from 'lucide-react';

interface CashOverviewProps {
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  refreshKey?: number;
}

interface OverviewData {
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  lastBankBalance: number | null;
}

export function CashOverview({ accountNumber, periodStart, periodEnd, refreshKey }: CashOverviewProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, [accountNumber, periodStart, periodEnd, refreshKey]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const result = await sqliteService.getCashOverview(accountNumber, periodStart, periodEnd);
      setData(result);
    } catch (e) {
      console.error('Failed to load cash overview', e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => formatMoney(n);

  const reconciliationDiff = data?.lastBankBalance != null
    ? Math.round((data.closingBalance - data.lastBankBalance) * 100) / 100
    : null;

  const isReconciled = reconciliationDiff !== null && Math.abs(reconciliationDiff) < 0.01;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
            <div className="h-4 w-20 bg-slate-100 rounded mb-2" />
            <div className="h-8 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: '期初余额',
      value: fmt(data.openingBalance),
      icon: Wallet,
      color: 'text-slate-800',
    },
    {
      label: '本月收入',
      value: `+${fmt(data.totalCredit)}`,
      icon: TrendingUp,
      color: 'text-green-600',
    },
    {
      label: '本月支出',
      value: `-${fmt(data.totalDebit)}`,
      icon: TrendingDown,
      color: 'text-red-600',
    },
    {
      label: '当前余额',
      value: fmt(data.closingBalance),
      icon: Scale,
      color: 'text-blue-600',
      recon: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-500">{card.label}</span>
            <card.icon className="h-4 w-4 text-slate-300" />
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          {card.recon && reconciliationDiff !== null && (
            <div className={`mt-2 text-xs flex items-center gap-1 ${isReconciled ? 'text-green-600' : 'text-amber-600'}`}>
              {isReconciled ? (
                <><Scale className="h-3 w-3" /> 与银行对账: 平</>
              ) : (
                <><Scale className="h-3 w-3" /> 差 {fmt(Math.abs(reconciliationDiff))}</>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}