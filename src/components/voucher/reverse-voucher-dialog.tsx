'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { usePeriodManagementStore } from '@/stores/usePeriodManagementStore';
import { useToast } from '@/hooks/use-toast';
import type { Voucher } from '@/types';

interface ReverseVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalVoucher: Voucher | null;
  onConfirm: (reversalDate: string) => Promise<void>;
}

export function ReverseVoucherDialog({
  open,
  onOpenChange,
  originalVoucher,
  onConfirm,
}: ReverseVoucherDialogProps) {
  const today = new Date().toISOString().split('T')[0];
  const [reversalDate, setReversalDate] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // 每次打开时，默认用原凭证日期
  const effectiveDate = reversalDate || originalVoucher?.date || today;

  const originalMonth = originalVoucher?.date ? originalVoucher.date.substring(0, 7) : '';
  const reversalMonth = effectiveDate.substring(0, 7);
  const monthMismatch = !!originalMonth && originalMonth !== reversalMonth;
  const targetPeriodClosed = usePeriodManagementStore((s) => s.isPeriodClosed(reversalMonth));

  const totalDebit = originalVoucher
    ? originalVoucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0)
    : 0;

  const handleConfirm = async () => {
    if (!originalVoucher) return;
    // 双重校验（防 UI 状态过期）
    if (usePeriodManagementStore.getState().isPeriodClosed(effectiveDate.substring(0, 7))) {
      setError(`${effectiveDate.substring(0, 7)} 已关账，请先到「期间管理」反结账后再操作`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(effectiveDate);
      onOpenChange(false);
      showToast('success', '红冲凭证已生成');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '红冲失败';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (submitting) return;
    if (!open) {
      setError(null);
      setReversalDate('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg space-y-5">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900">
            确认红冲凭证
          </DialogTitle>
        </DialogHeader>

        {originalVoucher && (
          <div className="rounded-lg bg-slate-50/70 p-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">凭证号</dt>
              <dd className="text-right font-medium text-slate-900">{originalVoucher.voucherNo}</dd>
              <dt className="text-muted-foreground">原日期</dt>
              <dd className="text-right font-medium text-slate-900">{originalVoucher.date}</dd>
              <dt className="text-muted-foreground">摘要</dt>
              <dd className="text-right font-medium text-slate-900 truncate">
                {originalVoucher.summary || '—'}
              </dd>
              <dt className="text-muted-foreground">金额</dt>
              <dd className="text-right font-medium text-slate-900 tabular-nums">
                ¥{totalDebit.toFixed(2)}
              </dd>
            </dl>
          </div>
        )}

        <div className="space-y-2">
          <Label required className="text-sm font-medium text-slate-700">
            红冲凭证日期
          </Label>
          <div className="flex items-center gap-2">
            <ChineseDatePicker
              value={effectiveDate}
              onChange={setReversalDate}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="h-9 px-3 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              title={originalVoucher ? `用原日期：${originalVoucher.date}` : '用原日期'}
              onClick={() => originalVoucher && setReversalDate(originalVoucher.date)}
              disabled={!originalVoucher || submitting}
            >
              用原日期
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="h-9 px-3 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              title={`用今天：${today}`}
              onClick={() => setReversalDate(today)}
              disabled={submitting}
            >
              用今天
            </Button>
          </div>
        </div>

        {monthMismatch && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>红冲月份与原凭证不一致</AlertTitle>
            <AlertDescription>
              原凭证在 {originalMonth}，红冲在 {reversalMonth}。这会让 {originalMonth} 的发生额保留原值，仅 {reversalMonth} 出现冲抵。若需保持月度报表整洁，建议改回原凭证月份。
            </AlertDescription>
          </Alert>
        )}

        {targetPeriodClosed && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{reversalMonth} 已关账</AlertTitle>
            <AlertDescription>
              不能在已关账期间入账。请选择其他开放期间，或先到「期间管理」反结账后再操作。
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-slate-100">
          <Button
            variant="outline"
            type="button"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            type="button"
            disabled={submitting || targetPeriodClosed || !originalVoucher}
            onClick={handleConfirm}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            确认红冲
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
