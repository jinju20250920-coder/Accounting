'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { useTaxStore } from '@/stores/useTaxStore';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { VoucherSearchPopover } from '@/components/voucher-search-popover';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { deriveFilingStatus, calculateDaysRemaining, getUrgencyConfig } from '@/lib/tax-deadlines';
import type { TaxFilingStatus, TaxFiling } from '@/types';

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待申报' },
  { value: 'filed', label: '已申报' },
  { value: 'overdue', label: '已逾期' },
];

const STATUS_LABELS: Record<TaxFilingStatus, string> = {
  pending: '待申报',
  filed: '已申报',
  overdue: '已逾期',
};

/** 受控金额输入：本地 draft 缓冲键入，blur 时提交；store 值变更时同步回填。
 *  不能用 defaultValue —— markFiled / 保存金额会让 store 改值，导致同一挂载实例的
 *  defaultValue 变化，触发 Base UI "uncontrolled FieldControl default value changed" 警告。 */
function AmountInput({
  amount,
  onCommit,
}: {
  amount: number | undefined;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string>(amount != null ? String(amount) : '');

  useEffect(() => {
    setDraft(amount != null ? String(amount) : '');
  }, [amount]);

  return (
    <Input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
      placeholder="0.00"
      className="w-24 h-8 text-right text-xs"
      autoComplete="off"
    />
  );
}

export function TaxFilingsTab() {
  const router = useRouter();
  const taxFilings = useTaxStore(s => s.taxFilings);
  const taxItems = useTaxStore(s => s.taxItems);
  const markFiled = useTaxStore(s => s.markFiled);
  const unmarkFiled = useTaxStore(s => s.unmarkFiled);
  const updateFilingAmounts = useTaxStore(s => s.updateFilingAmounts);
  const linkVoucher = useTaxStore(s => s.linkVoucher);
  const hasVoucherPermission = usePermission('voucher');
  const { toast } = useToast();

  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taxFilter, setTaxFilter] = useState<string>('all');

  // Compute tax options
  const taxOptions = useMemo(() => {
    const uniqueTaxes = Array.from(
      new Set(taxFilings.map(f => f.taxItemId))
    ).map(id => taxItems.find(item => item.id === id)).filter(Boolean);
    return uniqueTaxes;
  }, [taxFilings, taxItems]);

  // Filter filings
  const filteredFilings = useMemo(() => {
    return taxFilings.filter(f => {
      // Status filter
      const status = deriveFilingStatus(f, new Date());
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      // Tax filter
      if (taxFilter !== 'all' && f.taxItemId !== taxFilter) return false;

      // Period filter
      if (periodFilter && f.taxPeriod !== periodFilter) return false;

      return true;
    });
  }, [taxFilings, statusFilter, taxFilter, periodFilter]);

  const handleMarkFiled = async (filing: TaxFiling, checked: boolean) => {
    if (!hasVoucherPermission) {
      toast({ type: 'error', title: '无权限修改申报状态' });
      return;
    }

    try {
      if (checked) {
        const taxableAmount = filing.taxableAmount ?? 0;
        const paidAmount = filing.paidAmount ?? 0;
        await markFiled(filing.taxItemId, filing.taxPeriod, {
          filedDate: new Date().toISOString().slice(0, 10),
          taxableAmount,
          paidAmount,
        });
        toast({ type: 'success', title: '已标记为已申报' });
      } else {
        await unmarkFiled(filing.taxItemId, filing.taxPeriod);
        toast({ type: 'success', title: '已取消申报标记' });
      }
    } catch (err) {
      toast({ type: 'error', title: '操作失败' });
    }
  };

  const handleAmountBlur = async (
    filing: TaxFiling,
    field: 'taxableAmount' | 'paidAmount',
    value: string
  ) => {
    const numValue = Math.round((parseFloat(value) || 0) * 100) / 100;
    const patch: { taxableAmount?: number; paidAmount?: number } = {};
    patch[field] = numValue;

    try {
      await updateFilingAmounts(filing.taxItemId, filing.taxPeriod, patch);
    } catch (err) {
      toast({ type: 'error', title: '保存金额失败' });
    }
  };

  const handleVoucherSelect = async (
    filing: TaxFiling,
    voucherId: string,
    voucherNo: string
  ) => {
    if (!hasVoucherPermission) {
      toast({ type: 'error', title: '无权限关联凭证' });
      return;
    }

    try {
      await linkVoucher(filing.taxItemId, filing.taxPeriod, voucherId, voucherNo);
      toast({ type: 'success', title: '已关联凭证' });
    } catch (err) {
      toast({ type: 'error', title: '关联凭证失败' });
    }
  };

  const handleVoucherClear = async (filing: TaxFiling) => {
    if (!hasVoucherPermission) {
      toast({ type: 'error', title: '无权限取消关联' });
      return;
    }

    try {
      await linkVoucher(filing.taxItemId, filing.taxPeriod, '', '');
      toast({ type: 'success', title: '已取消关联' });
    } catch (err) {
      toast({ type: 'error', title: '取消关联失败' });
    }
  };

  const handleVoucherClick = (filing: TaxFiling) => {
    if (filing.linkedVoucherId) {
      router.push(`/voucher-list?id=${filing.linkedVoucherId}`);
    }
  };

  const getStatusBadge = (filing: TaxFiling) => {
    const status = deriveFilingStatus(filing, new Date());
    if (status === 'filed') {
      return <Badge className="bg-green-50 text-green-600">{STATUS_LABELS[status]}</Badge>;
    }
    if (status === 'overdue') {
      return <Badge className="bg-red-50 text-red-600">{STATUS_LABELS[status]}</Badge>;
    }
    // Pending - use urgency
    const daysRemaining = calculateDaysRemaining(filing.deadline, new Date());
    const urgency = daysRemaining < 0 ? 'urgent' : daysRemaining <= 7 ? 'high' : daysRemaining <= 15 ? 'medium' : 'low';
    const config = getUrgencyConfig(urgency);
    return (
      <Badge className={config.color}>
        {config.icon} {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <ChineseMonthPicker
          value={periodFilter}
          onChange={setPeriodFilter}
          placeholder="税款所属期"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={taxFilter} onValueChange={setTaxFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部税种</SelectItem>
            {taxOptions.map(item => (
              <SelectItem key={item.id} value={item.id}>
                {item.taxName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium">税种</th>
              <th className="px-4 py-2 text-left font-medium">税款所属期</th>
              <th className="px-4 py-2 text-left font-medium">截止日</th>
              <th className="px-4 py-2 text-left font-medium">状态</th>
              <th className="px-4 py-2 text-right font-medium">应纳税额</th>
              <th className="px-4 py-2 text-right font-medium">实缴额</th>
              <th className="px-4 py-2 text-left font-medium">关联凭证</th>
              <th className="px-4 py-2 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredFilings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  暂无申报记录
                </td>
              </tr>
            )}
            {filteredFilings.map(filing => {
              const isFiled = deriveFilingStatus(filing, new Date()) === 'filed';
              return (
                <tr
                  key={filing.id}
                  className={isFiled ? 'bg-slate-50' : ''}
                >
                  <td className="px-4 py-2">{filing.taxName}</td>
                  <td className="px-4 py-2">{filing.periodLabel}</td>
                  <td className="px-4 py-2">{filing.deadline}</td>
                  <td className="px-4 py-2">{getStatusBadge(filing)}</td>
                  <td className="px-4 py-2 text-right">
                    <AmountInput
                      amount={filing.taxableAmount}
                      onCommit={(v) => handleAmountBlur(filing, 'taxableAmount', v)}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <AmountInput
                      amount={filing.paidAmount}
                      onCommit={(v) => handleAmountBlur(filing, 'paidAmount', v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <VoucherSearchPopover
                      value={
                        filing.linkedVoucherId && filing.linkedVoucherNo
                          ? { voucherId: filing.linkedVoucherId, voucherNo: filing.linkedVoucherNo }
                          : null
                      }
                      onSelect={(vid, vno) => handleVoucherSelect(filing, vid, vno)}
                      onClear={() => handleVoucherClear(filing)}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    {hasVoucherPermission && (
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFiled}
                          onChange={(e) => handleMarkFiled(filing, e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-xs">标记已申报</span>
                      </label>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
