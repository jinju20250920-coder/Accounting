'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Play, ArrowRight } from 'lucide-react';
import { usePeriodManagementStore } from '@/stores/usePeriodManagementStore';
import { useAccountSetStore, type AccountingPeriod } from '@/stores/useAccountSetStore';

interface CurrentPeriodIndicatorProps {
  compact?: boolean;
}

export function CurrentPeriodIndicator({ compact = false }: CurrentPeriodIndicatorProps) {
  const { closeCurrentPeriod, createNextPeriod } = usePeriodManagementStore();
  const [currentPeriod, setCurrentPeriod] = useState<AccountingPeriod | null>(null);

  // 只在客户端获取期间数据
  useEffect(() => {
    const fetchPeriod = () => {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      if (accountSet?.accountingPeriods) {
        const period = accountSet.accountingPeriods.find(p => p.isCurrent);
        setCurrentPeriod(period || null);
      }
    };
    fetchPeriod();
  }, []);

  if (!currentPeriod) {
    return null;
  }

  const getStatusIcon = (status: AccountingPeriod['status']) => {
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
  };

  const getStatusBadge = (status: AccountingPeriod['status']) => {
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
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
        {getStatusIcon(currentPeriod.status)}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-900">当前账期: {currentPeriod.name}</span>
          {getStatusBadge(currentPeriod.status)}
          <span className="text-xs text-blue-700">凭证数: {currentPeriod.voucherCount}</span>
        </div>
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
              {getStatusBadge(currentPeriod.status)}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-blue-700">
                <Calendar className="h-4 w-4 inline mr-1" />
                {currentPeriod.startDate} 至 {currentPeriod.endDate}
              </span>
              <span className="text-blue-700">
                已录入 {currentPeriod.voucherCount} 张凭证
              </span>
              <span className="text-blue-600 font-mono text-xs">
                最后凭证: {currentPeriod.lastVoucherNo}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentPeriod.canClose && (
            <Button
              variant="default"
              size="sm"
              onClick={closeCurrentPeriod}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Clock className="h-4 w-4 mr-1" />
              结转本期
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
    </div>
  );
}
