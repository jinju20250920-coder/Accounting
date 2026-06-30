'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, AlertTriangle } from 'lucide-react';
import { calculateAgingData, type AgingConfig, type AgingMode } from '@/lib/accounting';
import { useVoucherStore } from '@/stores/useVoucherStore';

interface AgingDistributionProps {
  cutoffDate: string;
  partners: any[];
  clearingStore: any;
}

function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const BUCKET_COLORS = [
  { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50', label: '30天内' },
  { bg: 'bg-yellow-500', text: 'text-yellow-700', light: 'bg-yellow-50', label: '31-90天' },
  { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50', label: '91-180天' },
  { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50', label: '181-365天' },
  { bg: 'bg-red-800', text: 'text-red-900', light: 'bg-red-100', label: '365天+' },
];

export function AgingDistribution({ cutoffDate, partners, clearingStore }: AgingDistributionProps) {
  const [tab, setTab] = useState<'ar' | 'ap'>('ar');

  const voucherStore = useVoucherStore();

  const { buckets, totalAmount } = useMemo(() => {
    // Use voucherStore which has vouchers with entries already loaded
    const postedVouchers = voucherStore.vouchers.filter(
      (v: any) => v.status === 'posted' && v.date <= cutoffDate
    );
    const allEntries = postedVouchers.flatMap((v: any) => v.entries || []);

    const config: AgingConfig = {
      mode: 'month' as AgingMode,
      asOfDate: cutoffDate,
      showWriteOff: false,
      overdueThreshold: 30,
    };

    const recRelations = clearingStore.recRelations || [];
    const agingPartners = partners
      .filter((p: any) => !p.frozen)
      .map((p: any) => ({ code: p.code, name: p.name, isCustomer: p.isCustomer, isSupplier: p.isSupplier }));

    const isAR = tab === 'ar';
    const agingResults = calculateAgingData(allEntries, config, agingPartners, recRelations, isAR);

    // Aggregate buckets
    const agg = [0, 0, 0, 0, 0];
    let total = 0;
    for (const r of agingResults) {
      total += r.totalAmount;
      agg[0] += r.buckets.current;
      agg[1] += r.buckets.overdue1;
      agg[2] += r.buckets.overdue2;
      agg[3] += r.buckets.overdue3;
      agg[4] += r.buckets.overdue6;
    }

    return { buckets: agg, totalAmount: total };
  }, [cutoffDate, partners, clearingStore.recRelations, tab, voucherStore.vouchers]);

  const hasOverdue = buckets[1] + buckets[2] + buckets[3] + buckets[4] > 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">账龄分布</span>
          </div>
          <div className="flex rounded-md border border-slate-200 overflow-hidden">
            <button
              onClick={() => setTab('ar')}
              className={`px-2 py-0.5 text-[10px] ${tab === 'ar' ? 'bg-green-50 text-green-700 font-medium' : 'text-slate-500'}`}
            >
              应收
            </button>
            <button
              onClick={() => setTab('ap')}
              className={`px-2 py-0.5 text-[10px] ${tab === 'ap' ? 'bg-red-50 text-red-600 font-medium' : 'text-slate-500'}`}
            >
              应付
            </button>
          </div>
        </div>

        {totalAmount === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">暂无账龄数据</div>
        ) : (
          <div className="space-y-2.5">
            {/* Stacked bar */}
            <div className="h-6 flex rounded-full overflow-hidden bg-slate-100">
              {buckets.map((amount, idx) => {
                if (amount === 0) return null;
                const pct = (amount / totalAmount) * 100;
                return (
                  <div
                    key={idx}
                    className={`${BUCKET_COLORS[idx].bg} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${BUCKET_COLORS[idx].label}: ${formatMoney(amount)}`}
                  />
                );
              })}
            </div>

            {/* Bucket details */}
            {BUCKET_COLORS.map((bucket, idx) => {
              const amount = buckets[idx];
              if (amount === 0) return null;
              const pct = (amount / totalAmount) * 100;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm ${bucket.bg} flex-shrink-0`} />
                  <span className="text-xs text-slate-600 w-16">{bucket.label}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bucket.bg}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${bucket.text} w-20 text-right`}>
                    {formatMoney(amount)}
                  </span>
                  <span className="text-[10px] text-slate-400 w-10 text-right">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}

            {/* Overdue warning */}
            {hasOverdue && (
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] text-amber-700">
                  逾期合计 {formatMoney(buckets[1] + buckets[2] + buckets[3] + buckets[4])}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
