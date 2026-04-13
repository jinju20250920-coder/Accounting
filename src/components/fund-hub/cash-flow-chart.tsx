'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface CashFlowChartProps {
  transactions: any[];
  periodRange: { start: string; end: string };
  period: string;
}

interface DayData {
  date: string;
  income: number;
  expense: number;
  net: number;
  cumulative: number;
}

function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(1)}万`;
  }
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function CashFlowChart({ transactions, periodRange, period }: CashFlowChartProps) {
  // Aggregate by day
  const dailyData = useMemo((): DayData[] => {
    const dayMap = new Map<string, { income: number; expense: number }>();

    // Initialize all days in range
    const start = new Date(periodRange.start);
    const end = new Date(periodRange.end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      dayMap.set(key, { income: 0, expense: 0 });
    }

    for (const tx of transactions) {
      const existing = dayMap.get(tx.date);
      if (existing) {
        if (tx.debit && tx.debit > 0) existing.income += tx.debit;
        if (tx.credit && tx.credit > 0) existing.expense += tx.credit;
      }
    }

    const result: DayData[] = [];
    let cumulative = 0;
    const sorted = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [date, { income, expense }] of sorted) {
      cumulative += income - expense;
      result.push({ date, income, expense, net: income - expense, cumulative });
    }
    return result;
  }, [transactions, periodRange]);

  // Sample data for display (max ~30 bars visible)
  const displayData = useMemo(() => {
    if (dailyData.length <= 30) return dailyData;
    // Sample: take every Nth point
    const step = Math.ceil(dailyData.length / 30);
    return dailyData.filter((_, i) => i % step === 0 || i === dailyData.length - 1);
  }, [dailyData]);

  const maxValue = useMemo(() => {
    if (displayData.length === 0) return 1;
    return Math.max(
      ...displayData.map(d => d.income),
      ...displayData.map(d => d.expense),
      1
    );
  }, [displayData]);

  const maxCumulative = useMemo(() => {
    if (displayData.length === 0) return { min: 0, max: 1 };
    const values = displayData.map(d => d.cumulative);
    return { min: Math.min(...values, 0), max: Math.max(...values, 1) };
  }, [displayData]);

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  };

  if (dailyData.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">收支趋势</span>
          </div>
          <div className="text-center py-8 text-slate-400 text-sm">暂无数据</div>
        </CardContent>
      </Card>
    );
  }

  const chartHeight = 160;
  const barWidth = displayData.length > 15 ? 12 : displayData.length > 8 ? 18 : 28;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">收支趋势（金额）</span>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> 流入金额
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /> 流出金额
            </span>
            <span className="flex items-center gap-1">
              <span className="w-6 h-0.5 bg-blue-600 inline-block" /> 累计净额
            </span>
          </div>
        </div>

        {/* Chart area */}
        <div className="relative" style={{ height: chartHeight }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-[9px] text-slate-400">
            <span>{formatMoney(maxValue)}</span>
            <span>0</span>
          </div>

          {/* Bars */}
          <div className="ml-14 flex items-end gap-[2px]" style={{ height: chartHeight - 24 }}>
            {displayData.map((day, idx) => {
              const incomeH = (day.income / maxValue) * (chartHeight - 24);
              const expenseH = (day.expense / maxValue) * (chartHeight - 24);
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col justify-end items-center relative group"
                  style={{ minWidth: barWidth }}
                >
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[9px] rounded px-2 py-1 whitespace-nowrap z-10">
                    {formatDate(day.date)} 入{formatMoney(day.income)} 出{formatMoney(day.expense)} 净{formatMoney(day.net)}
                  </div>
                  {/* Bars side by side */}
                  <div className="flex items-end gap-[1px] w-full">
                    <div
                      className="flex-1 bg-green-400 rounded-t-sm transition-all"
                      style={{ height: Math.max(incomeH, day.income > 0 ? 2 : 0) }}
                    />
                    <div
                      className="flex-1 bg-red-300 rounded-t-sm transition-all"
                      style={{ height: Math.max(expenseH, day.expense > 0 ? 2 : 0) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cumulative line overlay */}
          <svg
            className="absolute left-14 top-0 pointer-events-none"
            style={{ width: `calc(100% - 56px)`, height: chartHeight - 24 }}
            preserveAspectRatio="none"
          >
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="1.5"
              strokeDasharray="4,2"
              points={displayData.map((day, i) => {
                const x = (i / Math.max(displayData.length - 1, 1)) * 100;
                const range = maxCumulative.max - maxCumulative.min || 1;
                const y = 100 - ((day.cumulative - maxCumulative.min) / range) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
            />
          </svg>

          {/* X-axis labels */}
          <div className="ml-14 flex mt-1">
            {displayData.map((day, idx) => (
              <div key={day.date} className="flex-1 text-center text-[8px] text-slate-400" style={{ minWidth: barWidth }}>
                {displayData.length <= 15 || idx % Math.ceil(displayData.length / 10) === 0
                  ? formatDate(day.date)
                  : ''}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
