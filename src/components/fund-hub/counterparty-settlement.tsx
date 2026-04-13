'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';
import { getCurrentService } from '@/lib/database';
import { waitForDbInit } from '@/hooks/useDatabaseSync';

interface CounterpartySettlementProps {
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

interface PartnerBalance {
  name: string;
  receivable: number;
  payable: number;
  net: number;
}

export function CounterpartySettlement({ cutoffDate, partners, clearingStore }: CounterpartySettlementProps) {
  const [tab, setTab] = useState<'receivable' | 'payable'>('receivable');
  const [partnerBalances, setPartnerBalances] = useState<PartnerBalance[]>([]);

  useEffect(() => {
    async function loadBalances() {
      try {
        await waitForDbInit();
        const service = getCurrentService();
        const balances: PartnerBalance[] = [];
        for (const partner of partners) {
          if (partner.frozen) continue;
          try {
            const bal = await service.calculatePartnerBalance(partner.name);
            if (Math.abs(bal) > 0.01) {
              balances.push({
                name: partner.name,
                // debitSum - creditSum: 负数=应付（供应商欠方），正数=应收（客户欠方）
                // 但实际数据方向相反：负数=应收，正数=应付
                receivable: bal < 0 ? Math.round(Math.abs(bal) * 100) / 100 : 0,
                payable: bal > 0 ? Math.round(bal * 100) / 100 : 0,
                net: Math.round(bal * 100) / 100,
              });
            }
          } catch {
            // Skip partners with no data
          }
        }
        setPartnerBalances(balances);
      } catch (err) {
        console.error('Failed to load partner balances:', err);
      }
    }
    loadBalances();
  }, [partners, cutoffDate]);

  const topReceivables = useMemo(() => {
    return partnerBalances
      .filter(p => p.receivable > 0)
      .sort((a, b) => b.receivable - a.receivable)
      .slice(0, 5);
  }, [partnerBalances]);

  const topPayables = useMemo(() => {
    return partnerBalances
      .filter(p => p.payable > 0)
      .sort((a, b) => b.payable - a.payable)
      .slice(0, 5);
  }, [partnerBalances]);

  const totalReceivable = topReceivables.reduce((s, p) => s + p.receivable, 0);
  const totalPayable = topPayables.reduce((s, p) => s + p.payable, 0);

  const displayData = tab === 'receivable' ? topReceivables : topPayables;
  const total = tab === 'receivable' ? totalReceivable : totalPayable;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">往来单位结算</span>
          </div>
          <div className="flex rounded-md border border-slate-200 overflow-hidden">
            <button
              onClick={() => setTab('receivable')}
              className={`px-2 py-0.5 text-[10px] ${tab === 'receivable' ? 'bg-green-50 text-green-700 font-medium' : 'text-slate-500'}`}
            >
              应收
            </button>
            <button
              onClick={() => setTab('payable')}
              className={`px-2 py-0.5 text-[10px] ${tab === 'payable' ? 'bg-red-50 text-red-600 font-medium' : 'text-slate-500'}`}
            >
              应付
            </button>
          </div>
        </div>

        {displayData.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">暂无{tab === 'receivable' ? '应收' : '应付'}数据</div>
        ) : (
          <div className="space-y-2">
            {/* Total */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 rounded-md">
              <span className="text-xs text-slate-600">Top 5 合计</span>
              <span className={`text-sm font-bold ${tab === 'receivable' ? 'text-green-700' : 'text-red-600'}`}>
                {formatMoney(total)}
              </span>
            </div>

            {/* Bar list */}
            {displayData.map((item, idx) => {
              const amount = tab === 'receivable' ? item.receivable : item.payable;
              const pct = total > 0 ? (amount / total) * 100 : 0;
              const barColor = tab === 'receivable' ? 'bg-green-400' : 'bg-red-400';

              return (
                <div key={idx} className="flex items-center gap-2 group">
                  <span className="text-[10px] text-slate-400 w-4 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-slate-700 truncate max-w-[120px]">{item.name}</span>
                      <span className={`text-xs font-medium ${tab === 'receivable' ? 'text-green-700' : 'text-red-600'}`}>
                        {formatMoney(amount)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
