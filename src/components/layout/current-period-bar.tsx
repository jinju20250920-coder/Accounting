'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CurrentPeriodIndicator } from '@/components/account-set/current-period-indicator';
import { useTaxStore } from '@/stores/useTaxStore';
import { getCurrentTaxDeadlines } from '@/lib/tax-deadlines';
import { Calendar } from 'lucide-react';

function TaxCountdownChip() {
  // 订阅原始 state（稳定引用），用 useMemo 计算 alerts。
  // 绝不能在 selector 里调 getCurrentAlerts()（每次返回新数组 → getSnapshot 死循环）。
  const taxItems = useTaxStore((s) => s.taxItems);
  const taxFilings = useTaxStore((s) => s.taxFilings);
  const holidays = useTaxStore((s) => s.holidays);
  const alerts = useMemo(
    () => getCurrentTaxDeadlines(taxItems, holidays, taxFilings, new Date()),
    [taxItems, taxFilings, holidays],
  );
  const router = useRouter();
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60 * 60 * 1000); // 每小时刷新
    return () => clearInterval(id);
  }, []);

  const nearest = alerts
    .filter((a) => a.status !== 'filed')
    .sort((a, b) => a.daysRemaining - b.daysRemaining)[0];

  if (!nearest) return null;

  const isOverdue = nearest.daysRemaining < 0;
  const colorClass = isOverdue
    ? 'bg-red-50 text-red-600 border-red-200'
    : nearest.daysRemaining <= 7
      ? 'bg-orange-50 text-orange-600 border-orange-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <button
      type="button"
      onClick={() => router.push('/tax')}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${colorClass}`}
      title="查看税务管理"
    >
      <Calendar className="h-3 w-3" />
      {isOverdue
        ? `${nearest.taxItem.taxName}已逾期 ${Math.abs(nearest.daysRemaining)}天`
        : `距${nearest.taxItem.taxName}申报还有${nearest.daysRemaining}天`}
      <span className="text-slate-400">· 截止 {nearest.deadline}</span>
    </button>
  );
}

export function CurrentPeriodBar() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <CurrentPeriodIndicator compact={true} />
        <TaxCountdownChip />
      </div>
    </div>
  );
}
