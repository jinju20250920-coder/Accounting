'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { getCurrentService } from '@/lib/database';
import { waitForDbInit } from '@/hooks/useDatabaseSync';

interface DueDateCalendarProps {
  cutoffDate: string;
  partners: any[];
}

function formatMoney(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface DueItem {
  id: string;
  type: 'receivable' | 'payable';
  partnerName: string;
  amount: number;
  remaining: number;
  dueDate: string;
  daysUntilDue: number;
  voucherNo: string;
  summary: string;
  paymentTermDays: number;
}

export function DueDateCalendar({ cutoffDate, partners }: DueDateCalendarProps) {
  const [dueItems, setDueItems] = useState<DueItem[]>([]);

  // Build partner name → paymentTermDays map
  const partnerTermMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of partners) {
      map.set(p.name, p.paymentTermDays ?? 30);
    }
    return map;
  }, [partners]);

  useEffect(() => {
    async function loadDueItems() {
      try {
        await waitForDbInit();
        const service = getCurrentService();
        const items: DueItem[] = [];
        const partnerNames = partners.filter(p => !p.frozen).map(p => p.name);

        for (const name of partnerNames.slice(0, 50)) {
          try {
            const outstanding = await service.getOutstandingItems({ partnerName: name });
            const termDays = partnerTermMap.get(name) ?? 30;

            for (const item of outstanding) {
              if (item.remainingAmount <= 0.01) continue;

              // Due date = entry date + payment term days
              const entryDate = new Date(item.date);
              const dueDateObj = new Date(entryDate);
              dueDateObj.setDate(dueDateObj.getDate() + termDays);
              const dueDate = dueDateObj.toISOString().split('T')[0];

              const cutoff = new Date(cutoffDate);
              const daysUntilDue = Math.ceil((dueDateObj.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));

              // Direction: match counterparty-settlement logic
              // calculatePartnerBalance returns debitSum - creditSum
              // For this item, direction === 'debit' means debit entry (partner account on debit side)
              // In actual data: debit direction → 应付, credit direction → 应收 (reversed from theory)
              const isReceivable = item.direction === 'credit';

              items.push({
                id: item.entryId,
                type: isReceivable ? 'receivable' : 'payable',
                partnerName: item.partnerName || name,
                amount: item.amount,
                remaining: item.remainingAmount,
                dueDate,
                daysUntilDue,
                voucherNo: item.voucherNo,
                summary: item.summary,
                paymentTermDays: termDays,
              });
            }
          } catch {
            // Skip
          }
        }

        setDueItems(items);
      } catch (err) {
        console.error('Failed to load due items:', err);
      }
    }
    loadDueItems();
  }, [cutoffDate, partners, partnerTermMap]);

  const summary = useMemo(() => {
    const overdue = dueItems.filter(i => i.daysUntilDue < 0);
    const todayDue = dueItems.filter(i => i.daysUntilDue === 0);
    const thisWeek = dueItems.filter(i => i.daysUntilDue > 0 && i.daysUntilDue <= 7);

    return {
      overdue: { count: overdue.length, amount: overdue.reduce((s, i) => s + i.remaining, 0) },
      today: { count: todayDue.length, amount: todayDue.reduce((s, i) => s + i.remaining, 0) },
      thisWeek: { count: thisWeek.length, amount: thisWeek.reduce((s, i) => s + i.remaining, 0) },
    };
  }, [dueItems]);

  // Show top overdue + upcoming items
  const displayItems = useMemo(() => {
    return dueItems
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 10);
  }, [dueItems]);

  const getDueLabel = (days: number) => {
    if (days < 0) return `逾期${Math.abs(days)}天`;
    if (days === 0) return '今天到期';
    if (days <= 7) return `${days}天后`;
    return `${days}天后`;
  };

  const getDueStyle = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-50';
    if (days === 0) return 'text-amber-600 bg-amber-50';
    if (days <= 7) return 'text-blue-600 bg-blue-50';
    return 'text-slate-500 bg-slate-50';
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">到期日历</span>
          </div>
        </div>

        {/* Summary badges */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-red-50 rounded-md px-2 py-1.5 text-center">
            <div className="text-[10px] text-red-500">已逾期</div>
            <div className="text-xs font-bold text-red-700">{summary.overdue.count}笔</div>
            <div className="text-[10px] text-red-600">{formatMoney(summary.overdue.amount)}</div>
          </div>
          <div className="bg-amber-50 rounded-md px-2 py-1.5 text-center">
            <div className="text-[10px] text-amber-500">今天到期</div>
            <div className="text-xs font-bold text-amber-700">{summary.today.count}笔</div>
            <div className="text-[10px] text-amber-600">{formatMoney(summary.today.amount)}</div>
          </div>
          <div className="bg-blue-50 rounded-md px-2 py-1.5 text-center">
            <div className="text-[10px] text-blue-500">本周到期</div>
            <div className="text-xs font-bold text-blue-700">{summary.thisWeek.count}笔</div>
            <div className="text-[10px] text-blue-600">{formatMoney(summary.thisWeek.amount)}</div>
          </div>
        </div>

        {/* Due items list */}
        {displayItems.length === 0 ? (
          <div className="text-center py-4 text-slate-400 text-xs">暂无待结算项目</div>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {displayItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50"
              >
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${getDueStyle(item.daysUntilDue)}`}>
                  {getDueLabel(item.daysUntilDue)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-700 truncate">{item.partnerName}</span>
                    <span className={`text-[9px] ${item.type === 'receivable' ? 'text-green-600' : 'text-red-500'}`}>
                      {item.type === 'receivable' ? '应收' : '应付'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{item.summary || item.voucherNo}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-medium text-slate-700">{formatMoney(item.remaining)}</div>
                  <div className="text-[9px] text-slate-400">账期{item.paymentTermDays}天</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
