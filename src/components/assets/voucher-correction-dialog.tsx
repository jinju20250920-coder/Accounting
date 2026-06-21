'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Info, AlertTriangle, Loader2 } from 'lucide-react';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useIntangibleAssetStore } from '@/stores/useIntangibleAssetStore';
import { usePrepaidExpenseStore } from '@/stores/usePrepaidExpenseStore';
import { usePeriodManagementStore } from '@/stores/usePeriodManagementStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { getCurrentService } from '@/lib/database';
import type { Voucher, VoucherEntry } from '@/types';

interface VoucherCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetType?: 'fixed' | 'intangible' | 'prepaid';
  record: {
    id: string;
    changeType: string;
    changeDate: string;
    voucherId?: string;
    voucherNo?: string;
    assetId: string;
    assetCode: string;
    assetName: string;
    originalValueChange?: number;
    depreciationChange?: number;
    amortizationChange?: number;
  } | null;
  onSuccess?: () => void;
}

export function VoucherCorrectionDialog({
  open,
  onOpenChange,
  assetType = 'fixed',
  record,
  onSuccess,
}: VoucherCorrectionDialogProps) {
  const [originalVoucher, setOriginalVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [createBlueVoucher, setCreateBlueVoucher] = useState(true);
  const [step, setStep] = useState<'preview' | 'success'>('preview');
  const [redVoucherNo, setRedVoucherNo] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [reversalDate, setReversalDate] = useState<string>('');

  const { logAssetChange } = useFixedAssetStore();
  const { logIntangibleChange } = useIntangibleAssetStore();
  const { logPrepaidChange } = usePrepaidExpenseStore();
  const { getCurrentPeriod } = usePeriodManagementStore();
  const { getCurrentAccountSet } = useAccountSetStore();

  const depreciationLabel = assetType === 'fixed' ? '折旧' : '摊销';
  const assetTypeLabel = assetType === 'fixed' ? '固定资产' : assetType === 'intangible' ? '无形资产' : '待摊费用';

  const today = new Date().toISOString().split('T')[0];
  const effectiveDate = reversalDate || originalVoucher?.date || today;
  const originalMonth = originalVoucher?.date?.substring(0, 7) ?? '';
  const reversalMonth = effectiveDate.substring(0, 7);
  const monthMismatch = !!originalMonth && originalMonth !== reversalMonth;
  const targetPeriodClosed = usePeriodManagementStore((s) => s.isPeriodClosed(reversalMonth));

  // 加载原凭证
  useEffect(() => {
    if (open && record?.voucherId) {
      setLoading(true);
      setError('');
      setStep('preview');

      getCurrentService().getVoucher(record.voucherId).then((voucher) => {
        if (voucher) {
          setOriginalVoucher(voucher);
        } else {
          setError('未找到原凭证');
        }
        setLoading(false);
      }).catch((err) => {
        setError('加载凭证失败: ' + err.message);
        setLoading(false);
      });
    }
  }, [open, record?.voucherId]);

  // 检查当前期间
  const currentPeriod = getCurrentPeriod();
  const currentAccountSet = getCurrentAccountSet();
  const isPeriodClosed = currentPeriod?.status === 'closed';

  // 生成红字凭证
  const handleGenerateRedVoucher = async () => {
    if (!originalVoucher || !record) return;

    // 双重校验目标期间关账状态
    if (usePeriodManagementStore.getState().isPeriodClosed(effectiveDate.substring(0, 7))) {
      setError(`${effectiveDate.substring(0, 7)} 已关账，请先到「期间管理」反结账后再操作`);
      return;
    }

    setGenerating(true);
    setError('');

    try {
      // 生成红字凭证分录（金额取负）
      const redEntries: VoucherEntry[] = originalVoucher.entries.map((entry) => ({
        ...entry,
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        voucherId: '',
        debit: entry.debit ? -entry.debit : 0,
        credit: entry.credit ? -entry.credit : 0,
        summary: `冲销${originalVoucher.voucherNo} - ${entry.summary || '固定资产业务'}`,
      }));

      // 生成凭证字号（按红冲月份）
      const yearMonth = effectiveDate.substring(0, 7).replace('-', '');
      const allVouchers = await getCurrentService().getAllVouchers();
      const currentMonthVouchers = allVouchers.filter((v: Voucher) =>
        v.voucherNo.startsWith(`记-${yearMonth}-`)
      );
      const maxSeq = currentMonthVouchers.length > 0
        ? Math.max(...currentMonthVouchers.map((v: Voucher) => {
            const match = v.voucherNo.match(/-(\d{3})$/);
            return match ? parseInt(match[1], 10) : 0;
          }))
        : 0;
      const newVoucherNo = `记-${yearMonth}-${String(maxSeq + 1).padStart(3, '0')}`;

      // 创建红字凭证
      const redVoucher: Voucher = {
        id: `voucher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        voucherNo: newVoucherNo,
        date: effectiveDate,
        summary: `冲销${originalVoucher.voucherNo} - ${record.assetName}（${depreciationLabel}）`,
        entries: redEntries,
        status: 'posted',
        voucherType: 'general',
        createdBy: 'user',
        createTime: new Date().toISOString(),
        accountSetId: currentAccountSet?.id,
      };

      // 保存红字凭证
      await getCurrentService().saveVoucher(redVoucher);

      // 更新账套的最后凭证号
      if (currentAccountSet?.id) {
        const { useAccountSetStore } = await import('@/stores/useAccountSetStore');
        useAccountSetStore.getState().updateAccountSet(currentAccountSet.id, {
          lastVoucherNo: maxSeq + 1,
          lastVoucherFullNo: newVoucherNo,
        });
      }

      // 记录冲销变动（按资产类型分发到对应时序账表）
      const changePayload = {
        assetId: record.assetId,
        assetCode: record.assetCode,
        assetName: record.assetName,
        accountSetId: currentAccountSet?.id || '',
        changeType: 'status_change' as const,
        changeDate: effectiveDate,
        period: effectiveDate.substring(0, 7),
        fieldName: 'voucher_reversal',
        beforeValue: originalVoucher.voucherNo,
        afterValue: newVoucherNo,
        originalValueChange: -(record.originalValueChange || 0),
        voucherId: redVoucher.id,
        voucherNo: newVoucherNo,
        reason: `冲销凭证 ${originalVoucher.voucherNo}`,
      };

      if (assetType === 'intangible') {
        await logIntangibleChange({
          ...changePayload,
          amortizationChange: -(record.amortizationChange ?? record.depreciationChange ?? 0),
        });
      } else if (assetType === 'prepaid') {
        await logPrepaidChange({
          ...changePayload,
          amortizationChange: -(record.amortizationChange ?? record.depreciationChange ?? 0),
        });
      } else {
        await logAssetChange({
          ...changePayload,
          depreciationChange: -(record.depreciationChange ?? 0),
        });
      }

      setRedVoucherNo(newVoucherNo);
      setStep('success');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setError('生成红字凭证失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  };

  // 跳转到凭证录入页面
  const handleGoToVoucherEntry = () => {
    onOpenChange(false);
    // 导航到凭证录入页面，携带预填充信息
    const params = new URLSearchParams({
      assetId: record?.assetId || '',
      assetCode: record?.assetCode || '',
      assetName: record?.assetName || '',
      changeType: record?.changeType || '',
      originalVoucherNo: originalVoucher?.voucherNo || '',
      redVoucherNo,
    });
    window.location.href = `/voucher-entry-page?${params.toString()}`;
  };

  // 格式化金额
  const formatAmount = (val: number | undefined) => {
    if (val === undefined || val === null) return '0.00';
    return Math.abs(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assetTypeLabel}凭证修正向导</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            加载中...
          </div>
        ) : step === 'preview' ? (
          <>
            {/* 说明区 */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">修正说明</div>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>生成红字凭证：冲销原凭证的全部分录（金额取负）</li>
                  <li>引导您录入正确的蓝字凭证</li>
                  <li>更新{assetTypeLabel}的时序账记录</li>
                </ol>
              </AlertDescription>
            </Alert>

            {isPeriodClosed && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  当前会计期间已结账，无法生成凭证。请先反结账后再操作。
                </AlertDescription>
              </Alert>
            )}

            {/* 红字凭证日期选择 */}
            <div className="space-y-2">
              <Label required className="text-sm font-medium text-slate-700">
                红字凭证日期
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
                  disabled={!originalVoucher || generating}
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
                  disabled={generating}
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

            {/* 原凭证信息 */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-slate-700">原凭证信息</h3>
              {originalVoucher ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-sm grid grid-cols-2 gap-2">
                    <div><span className="text-slate-500">凭证字号：</span>{originalVoucher.voucherNo}</div>
                    <div><span className="text-slate-500">凭证日期：</span>{originalVoucher.date}</div>
                    <div className="col-span-2"><span className="text-slate-500">摘　　要：</span>{originalVoucher.summary || '-'}</div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t bg-slate-50/50">
                        <th className="px-4 py-2 text-left font-medium">科目</th>
                        <th className="px-4 py-2 text-right font-medium w-28">借方</th>
                        <th className="px-4 py-2 text-right font-medium w-28">贷方</th>
                      </tr>
                    </thead>
                    <tbody>
                      {originalVoucher.entries.map((entry, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">
                            <span className="font-mono text-slate-600">{entry.subjectCode}</span>
                            <span className="ml-2">{entry.subjectName}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {entry.debit ? formatAmount(entry.debit) : ''}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {entry.credit ? formatAmount(entry.credit) : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-slate-50/50 font-medium">
                        <td className="px-4 py-2">合计</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {formatAmount(originalVoucher.entries.reduce((s, e) => s + (e.debit || 0), 0))}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {formatAmount(originalVoucher.entries.reduce((s, e) => s + (e.credit || 0), 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-slate-500">未找到原凭证信息</div>
              )}
            </div>

            {/* 红字凭证预览 */}
            {originalVoucher && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-slate-700">红字冲销凭证（自动生成）</h3>
                <div className="border rounded-lg overflow-hidden border-red-200 bg-red-50/30">
                  <div className="bg-red-50 px-4 py-2 text-sm grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">凭证字号：</span>
                      <span className="text-red-600">自动生成</span>
                    </div>
                    <div>
                      <span className="text-slate-500">凭证日期：</span>
                      {effectiveDate}{reversalDate === today ? '（今天）' : reversalDate === originalVoucher?.date ? '（原日期）' : ''}
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">摘　　要：</span>
                      冲销{originalVoucher.voucherNo} - {record.assetName}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-red-200">
                        <th className="px-4 py-2 text-left font-medium">科目</th>
                        <th className="px-4 py-2 text-right font-medium w-28">借方</th>
                        <th className="px-4 py-2 text-right font-medium w-28">贷方</th>
                      </tr>
                    </thead>
                    <tbody>
                      {originalVoucher.entries.map((entry, idx) => (
                        <tr key={idx} className="border-t border-red-200">
                          <td className="px-4 py-2">
                            <span className="font-mono text-slate-600">{entry.subjectCode}</span>
                            <span className="ml-2">{entry.subjectName}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-red-600">
                            {entry.debit ? `-${formatAmount(entry.debit)}` : ''}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-red-600">
                            {entry.credit ? `-${formatAmount(entry.credit)}` : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-red-200 font-medium">
                        <td className="px-4 py-2">合计</td>
                        <td className="px-4 py-2 text-right font-mono text-red-600">
                          -{formatAmount(originalVoucher.entries.reduce((s, e) => s + (e.debit || 0), 0))}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-red-600">
                          -{formatAmount(originalVoucher.entries.reduce((s, e) => s + (e.credit || 0), 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 选项 */}
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={createBlueVoucher}
                onCheckedChange={(checked) => setCreateBlueVoucher(checked as boolean)}
              />
              <label className="text-sm cursor-pointer" onClick={() => setCreateBlueVoucher(!createBlueVoucher)}>
                生成红字凭证后，立即录入正确的蓝字凭证
              </label>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handleGenerateRedVoucher}
                disabled={generating || isPeriodClosed || targetPeriodClosed || !originalVoucher}
                className="bg-red-600 hover:bg-red-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    生成中...
                  </>
                ) : (
                  '确认生成红字凭证'
                )}
              </Button>
            </div>
          </>
        ) : (
          /* 成功页面 */
          <>
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">红字冲销凭证已生成</h3>
              <p className="text-sm text-slate-500">
                凭证字号：<span className="font-medium text-slate-700">{redVoucherNo}</span>
              </p>
            </div>

            {createBlueVoucher ? (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  稍后处理
                </Button>
                <Button onClick={handleGoToVoucherEntry}>
                  录入正确的蓝字凭证
                </Button>
              </div>
            ) : (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button onClick={() => onOpenChange(false)}>
                  完成
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
