'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Play, ArrowRight, Shield } from 'lucide-react';
import { usePeriodManagementStore } from '@/stores/usePeriodManagementStore';
import { useAccountSetStore, type AccountingPeriod } from '@/stores/useAccountSetStore';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { MonthlyClosingWizard } from './monthly-closing-wizard';
import { getCurrentAccountingPeriod, sortAccountingPeriodsDesc } from '@/lib/accounting-period-switch';

interface CurrentPeriodIndicatorProps {
  compact?: boolean;
}

function getPeriodMonth(period: AccountingPeriod) {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function getStatusLabel(status: AccountingPeriod['status']) {
  switch (status) {
    case 'draft':
      return '未开账';
    case 'open':
      return '进行中';
    case 'closed':
      return '已结转';
    case 'locked':
      return '已锁定';
  }
}

function getStatusIcon(status: AccountingPeriod['status']) {
  switch (status) {
    case 'open':
      return <Play className="h-4 w-4 text-blue-500" />;
    case 'closed':
      return <Clock className="h-4 w-4 text-green-500" />;
    case 'locked':
      return <Clock className="h-4 w-4 text-red-500" />;
    default:
      return <Calendar className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusBadge(status: AccountingPeriod['status']) {
  switch (status) {
    case 'draft':
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">未开账</Badge>;
    case 'open':
      return <Badge variant="default" className="bg-blue-100 text-blue-800">进行中</Badge>;
    case 'closed':
      return <Badge variant="default" className="bg-green-100 text-green-800">已结转</Badge>;
    case 'locked':
      return <Badge variant="destructive">已锁定</Badge>;
  }
}

export function CurrentPeriodIndicator({ compact = false }: CurrentPeriodIndicatorProps) {
  const { createNextPeriod, setCurrentPeriod: switchPeriod } = usePeriodManagementStore();
  const accountSet = useAccountSetStore((state) =>
    state.accountSets.find(s => s.id === state.currentAccountSetId) || null
  );
  const vouchers = useVoucherStore((state) => state.vouchers);
  const [showMonthlyWizard, setShowMonthlyWizard] = useState(false);

  const allPeriods = useMemo(
    () => sortAccountingPeriodsDesc(accountSet?.accountingPeriods || []),
    [accountSet?.accountingPeriods],
  );
  const currentPeriod = useMemo(
    () => getCurrentAccountingPeriod(allPeriods) || null,
    [allPeriods],
  );

  const voucherCount = useMemo(() => {
    if (!currentPeriod) return 0;
    const periodMonth = getPeriodMonth(currentPeriod);
    return vouchers.filter(voucher => voucher.date?.substring(0, 7) === periodMonth).length;
  }, [vouchers, currentPeriod]);

  const lastVoucherNo = useMemo(() => {
    if (!currentPeriod || voucherCount === 0) return '无';

    const periodMonth = getPeriodMonth(currentPeriod);
    const periodVouchers = vouchers.filter(voucher => voucher.date?.substring(0, 7) === periodMonth);
    const sorted = [...periodVouchers].sort((a, b) => {
      if (a.date !== b.date) {
        return (a.date || '').localeCompare(b.date || '');
      }
      return (a.voucherNo || '').localeCompare(b.voucherNo || '');
    });

    return sorted[sorted.length - 1]?.voucherNo || '无';
  }, [vouchers, currentPeriod, voucherCount]);

  if (!currentPeriod) {
    return null;
  }

  const periodSelector = (
    <select
      value={currentPeriod.id}
      onChange={event => switchPeriod(event.target.value)}
      className={compact
        ? 'text-sm font-medium text-blue-900 bg-transparent border-none outline-none cursor-pointer'
        : 'text-sm font-medium text-blue-900 bg-blue-100 border border-blue-300 rounded-md px-2 py-0.5 outline-none cursor-pointer hover:bg-blue-200'
      }
      aria-label="切换账期"
    >
      {allPeriods.filter(p => p.status === 'open').map(period => (
        <option key={period.id} value={period.id}>
          {period.name}
        </option>
      ))}
    </select>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
        {getStatusIcon(currentPeriod.status)}
        {periodSelector}
        {getStatusBadge(currentPeriod.status)}
        <span className="text-xs text-blue-700">凭证数: {voucherCount}</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full">
            {getStatusIcon(currentPeriod.status)}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-blue-900">当前会计期间</span>
              {periodSelector}
              {getStatusBadge(currentPeriod.status)}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-blue-700">
                <Calendar className="h-4 w-4 inline mr-1" />
                {currentPeriod.startDate} 至 {currentPeriod.endDate}
              </span>
              <span className="text-blue-700">
                已录入 {voucherCount} 张凭证
              </span>
              <span className="text-blue-600 font-mono text-xs">
                最后凭证: {lastVoucherNo}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentPeriod.canClose && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowMonthlyWizard(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Shield className="h-4 w-4 mr-1" />
              月结向导
            </Button>
          )}

          {currentPeriod.canClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={createNextPeriod}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              开新期间
            </Button>
          )}
        </div>
      </div>

      <MonthlyClosingWizard
        open={showMonthlyWizard}
        onOpenChange={setShowMonthlyWizard}
        period={currentPeriod}
      />
    </div>
  );
}
