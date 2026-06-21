'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIntangibleAssetStore } from '@/stores/useIntangibleAssetStore';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { VoucherCorrectionDialog } from './voucher-correction-dialog';
import type { IntangibleChangeRecord } from '@/types';

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  acquisition: { label: '取得', color: 'bg-blue-50 text-blue-600' },
  amortization: { label: '摊销', color: 'bg-green-50 text-green-600' },
  disposal: { label: '处置', color: 'bg-red-50 text-red-500' },
  status_change: { label: '状态变更', color: 'bg-slate-50 text-slate-500' },
  voucher_reversal: { label: '红冲', color: 'bg-rose-50 text-rose-600' },
};

interface IntangibleTimelineLedgerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId?: string;
}

export function IntangibleTimelineLedger({ open, onOpenChange, assetId: initialAssetId }: IntangibleTimelineLedgerProps) {
  const { assets: legacyAssets, getIntangibleChangeRecords } = useIntangibleAssetStore();
  const { assets: fixedAssets, categories } = useFixedAssetStore();
  // 合并：旧表 intangibleAssets + 新模式（fixedAssets 中 assetType='intangible' 的资产）
  const assets = useMemo(() => {
    const merged = [...legacyAssets.map(a => ({
      id: a.id,
      assetCode: a.assetCode,
      assetName: a.assetName,
      accountSetId: a.accountSetId || '',
      originalValue: a.originalValue,
      accumulatedAmortization: a.accumulatedAmortization,
      netValue: a.netValue,
      acquisitionDate: a.acquisitionDate,
    }))];
    for (const fa of fixedAssets) {
      const isIntangible = categories.find(c => c.id === fa.categoryId)?.assetType === 'intangible';
      if (isIntangible && !merged.find(m => m.id === fa.id)) {
        merged.push({
          id: fa.id,
          assetCode: fa.assetCode,
          assetName: fa.assetName,
          accountSetId: fa.accountSetId || '',
          originalValue: fa.originalValue,
          accumulatedAmortization: fa.accumulatedDepreciation,
          netValue: fa.netValue,
          acquisitionDate: fa.acquisitionDate,
        });
      }
    }
    return merged;
  }, [legacyAssets, fixedAssets, categories]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAssetId || '');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedChangeType, setSelectedChangeType] = useState<string>('');
  const [records, setRecords] = useState<IntangibleChangeRecord[]>([]);
  const [correctionRecord, setCorrectionRecord] = useState<any>(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  useEffect(() => {
    if (initialAssetId) setSelectedAssetId(initialAssetId);
  }, [initialAssetId]);

  useEffect(() => {
    if (!open || !selectedAssetId) {
      setRecords([]);
      return;
    }
    getIntangibleChangeRecords(selectedAssetId).then(setRecords);
  }, [open, selectedAssetId, getIntangibleChangeRecords]);

  const refreshRecords = () => {
    if (selectedAssetId) {
      getIntangibleChangeRecords(selectedAssetId).then(setRecords);
    }
  };

  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (selectedPeriod) {
      result = result.filter(r => r.period.startsWith(selectedPeriod));
    }
    if (selectedChangeType) {
      result = result.filter(r => r.changeType === selectedChangeType);
    }
    result.sort((a, b) => a.changeDate.localeCompare(b.changeDate) || a.createTime.localeCompare(b.createTime));
    return result;
  }, [records, selectedPeriod, selectedChangeType]);

  const timelineRows = useMemo(() => {
    if (!selectedAssetId) return [];

    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return [];

    // 如果没有变动记录，从资产当前状态创建一个"期初余额"行
    if (filteredRecords.length === 0) {
      return [{
        id: 'opening',
        assetId: selectedAssetId,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        accountSetId: asset.accountSetId || '',
        changeType: 'acquisition' as const,
        changeDate: asset.acquisitionDate,
        period: asset.acquisitionDate.substring(0, 7),
        fieldName: 'originalValue',
        beforeValue: '',
        afterValue: String(asset.originalValue),
        origChange: asset.originalValue,
        amortChange: asset.accumulatedAmortization,
        origBal: asset.originalValue,
        amortBal: asset.accumulatedAmortization,
        netBal: asset.netValue,
        voucherNo: undefined,
        voucherId: undefined,
      }];
    }

    let runOrigBal = 0;
    let runAmortBal = 0;

    return filteredRecords.map((r) => {
      const origChange = r.originalValueChange ?? 0;
      const amortChange = r.amortizationChange ?? 0;

      if (r.originalValueBalance !== undefined && r.originalValueBalance !== null) {
        runOrigBal = r.originalValueBalance;
        runAmortBal = r.accumulatedAmortizationBalance ?? 0;
      } else {
        runOrigBal += origChange;
        runAmortBal += amortChange;
      }

      const netBal = r.netValueBalance ?? (runOrigBal - runAmortBal);

      return {
        ...r,
        origChange,
        amortChange,
        origBal: runOrigBal,
        amortBal: runAmortBal,
        netBal,
      };
    });
  }, [filteredRecords, selectedAssetId, assets]);

  const periods = useMemo(() => {
    const set = new Set(records.map(r => r.period));
    return Array.from(set).sort();
  }, [records]);

  const formatAmount = (val: number, showSign = false) => {
    if (val === 0) return <span className="text-slate-300">0</span>;
    const str = Math.abs(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const prefix = showSign ? (val > 0 ? '+' : '-') : '';
    const color = val > 0 ? 'text-green-600' : 'text-red-500';
    return <span className={color}>{prefix}{str}</span>;
  };

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>无形资产时序账清单（时间流水）</DialogTitle>
        </DialogHeader>

        {selectedAsset && (
          <div className="text-sm text-slate-500 mb-2">
            {selectedAsset.assetCode} — {selectedAsset.assetName}
            <span className="ml-4">原值: ¥{(selectedAsset.originalValue ?? 0).toLocaleString()}</span>
            <span className="ml-4">累计摊销: ¥{(selectedAsset.accumulatedAmortization ?? 0).toLocaleString()}</span>
            <span className="ml-4">净值: ¥{(selectedAsset.netValue ?? 0).toLocaleString()}</span>
          </div>
        )}

        {/* 筛选栏 */}
        <div className="flex gap-3 mb-4">
          <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="选择资产" />
            </SelectTrigger>
            <SelectContent>
              {assets.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.assetCode} {a.assetName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPeriod} onValueChange={v => setSelectedPeriod(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="全部期间" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部期间</SelectItem>
              {periods.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedChangeType} onValueChange={v => setSelectedChangeType(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部类型</SelectItem>
              {Object.entries(CHANGE_TYPE_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 时序账表格 */}
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">日期</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">事件类型</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">原值变动</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">摊销变动</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">原值余额</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">累计摊销</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">净值</th>
                <th className="px-3 py-2 text-center font-medium text-slate-600 w-16">操作</th>
              </tr>
            </thead>
            <tbody>
              {timelineRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    {selectedAssetId ? '暂无变动记录' : '请选择资产'}
                  </td>
                </tr>
              ) : (
                timelineRows.map((row) => {
                  const cfg = CHANGE_TYPE_CONFIG[row.changeType] || { label: row.changeType, color: 'bg-slate-50 text-slate-500' };
                  const hasVoucher = !!row.voucherId || !!row.voucherNo;
                  const isReversal = row.fieldName === 'voucher_reversal' || row.changeType === 'voucher_reversal';
                  return (
                    <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-700">{row.changeDate.substring(5)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className={`text-xs ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                        {row.voucherNo && (
                          <span className="ml-1 text-xs text-blue-500">{row.voucherNo}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatAmount(row.origChange, true)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatAmount(row.amortChange, true)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{row.origBal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{row.amortBal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{row.netBal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-center">
                        {hasVoucher && !isReversal ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setCorrectionRecord(row);
                              setShowCorrectionDialog(true);
                            }}
                          >
                            修正
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>

      <VoucherCorrectionDialog
        open={showCorrectionDialog}
        onOpenChange={setShowCorrectionDialog}
        assetType="intangible"
        record={correctionRecord}
        onSuccess={refreshRecords}
      />
    </Dialog>
  );
}
