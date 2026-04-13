'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { getCurrentService } from '@/lib/database';
import { waitForDbInit } from '@/hooks/useDatabaseSync';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useClearingStore } from '@/stores/useClearingStore';
import { useSubjectStore } from '@/stores';
import { CashPositionCard } from './cash-position-card';
import { CashFlowChart } from './cash-flow-chart';
import { BankSummaryTable } from './bank-summary-table';
import { CounterpartySettlement } from './counterparty-settlement';
import { AgingDistribution } from './aging-distribution';
import { SettlementAlerts } from './settlement-alerts';
import { DueDateCalendar } from './due-date-calendar';

type TimePeriod = '7d' | '30d' | '90d' | 'year';

export function SettlementDashboard() {
  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const partnerStore = usePartnerStore();
  const clearingStore = useClearingStore();
  const subjectStore = useSubjectStore();

  // Load data
  useEffect(() => {
    partnerStore.initializePartners();
    clearingStore.ensureInitialized();
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      await waitForDbInit();
      const service = getCurrentService();
      const all = await service.getAllBankTransactions();
      setTransactions(all);
    } catch (err) {
      console.error('Failed to load bank transactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Filter transactions by cutoff date
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => tx.date <= cutoffDate);
  }, [transactions, cutoffDate]);

  // Period date range
  const periodRange = useMemo(() => {
    const end = new Date(cutoffDate);
    let start = new Date(end);
    switch (period) {
      case '7d': start.setDate(start.getDate() - 7); break;
      case '30d': start.setDate(start.getDate() - 30); break;
      case '90d': start.setDate(start.getDate() - 90); break;
      case 'year': start.setFullYear(start.getFullYear() - 1); break;
    }
    return {
      start: start.toISOString().split('T')[0],
      end: cutoffDate,
    };
  }, [cutoffDate, period]);

  const periodTransactions = useMemo(() => {
    return filteredTransactions.filter(tx => tx.date >= periodRange.start);
  }, [filteredTransactions, periodRange]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case '7d': return '近7天';
      case '30d': return '近30天';
      case '90d': return '近90天';
      case 'year': return '近1年';
    }
  }, [period]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <h1 className="text-lg font-semibold">资金结算中心</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">截止日期</span>
          <ChineseDatePicker
            value={cutoffDate}
            onChange={setCutoffDate}
            className="w-[140px]"
          />
          <div className="flex rounded-md border border-slate-200 overflow-hidden">
            {(['7d', '30d', '90d', 'year'] as TimePeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p === '7d' ? '7天' : p === '30d' ? '30天' : p === '90d' ? '90天' : '1年'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : (
        <>
          {/* Row 1: Cash Position Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            <CashPositionCard
              transactions={filteredTransactions}
              periodTransactions={periodTransactions}
              cutoffDate={cutoffDate}
              periodLabel={periodLabel}
              subjects={subjectStore.subjects}
            />
          </div>

          {/* Row 2: Bank Summary Table + Bar Chart */}
          <BankSummaryTable
            transactions={filteredTransactions}
            periodTransactions={periodTransactions}
            periodRange={periodRange}
            periodLabel={periodLabel}
            cutoffDate={cutoffDate}
          />

          {/* Row 3: Cash Flow Trend */}
          <CashFlowChart
            transactions={periodTransactions}
            periodRange={periodRange}
            period={period}
          />

          {/* Row 4: Counterparty + Aging */}
          <div className="grid grid-cols-2 gap-4">
            <CounterpartySettlement
              cutoffDate={cutoffDate}
              partners={partnerStore.partners}
              clearingStore={clearingStore}
            />
            <AgingDistribution
              cutoffDate={cutoffDate}
              partners={partnerStore.partners}
              clearingStore={clearingStore}
            />
          </div>

          {/* Row 5: Alerts + Due Dates */}
          <div className="grid grid-cols-2 gap-4">
            <SettlementAlerts
              transactions={filteredTransactions}
              cutoffDate={cutoffDate}
            />
            <DueDateCalendar
              cutoffDate={cutoffDate}
              partners={partnerStore.partners}
            />
          </div>
        </>
      )}
    </div>
  );
}
