'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import type { AssetChangeRecord } from '@/types';

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  acquisition: { label: '取得', color: 'bg-blue-50 text-blue-600' },
  depreciation: { label: '折旧', color: 'bg-green-50 text-green-600' },
  improvement: { label: '改造', color: 'bg-purple-50 text-purple-600' },
  revaluation: { label: '重估', color: 'bg-amber-50 text-amber-600' },
  reclassify: { label: '重分类', color: 'bg-slate-50 text-slate-600' },
  disposal: { label: '处置', color: 'bg-red-50 text-red-500' },
  transfer: { label: '调拨', color: 'bg-amber-50 text-amber-600' },
  status_change: { label: '状态变更', color: 'bg-slate-50 text-slate-500' },
};

interface AssetTimelineLedgerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId?: string;
}

export function AssetTimelineLedger({ open, onOpenChange, assetId: initialAssetId }: AssetTimelineLedgerProps) {
  const { assets, getAssetChangeRecords } = useFixedAssetStore();
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAssetId || '');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedChangeType, setSelectedChangeType] = useState<string>('');
  const [records, setRecords] = useState<AssetChangeRecord[]>([]);

  useEffect(() => {
    if (initialAssetId) setSelectedAssetId(initialAssetId);
  }, [initialAssetId]);

  useEffect(() => {
    if (!open || !selectedAssetId) {
      setRecords([]);
      return;
    }
    getAssetChangeRecords(selectedAssetId).then(setRecords);
  }, [open, selectedAssetId, getAssetChangeRecords]);

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
        depChange: asset.accumulatedDepreciation,
        origBal: asset.originalValue,
        depBal: asset.accumulatedDepreciation,
        netBal: asset.netValue,
        voucherNo: asset.acquisitionVoucherNo,
      }];
    }

    let runOrigBal = 0;
    let runDepBal = 0;

    return filteredRecords.map((r) => {
      // 优先使用记录中的变动金额，否则从 changeType 推断
      let origChange = r.originalValueChange ?? null;
      let depChange = r.depreciationChange ?? null;

      // 对于旧数据（没有时序账字段），从 changeType 推断变动
      if (origChange === null || depChange === null) {
        switch (r.changeType) {
          case 'acquisition':
            // 取得：从 afterValue 解析原值
            origChange = origChange ?? (parseFloat(r.afterValue) || 0);
            depChange = depChange ?? 0;
            break;
          case 'depreciation':
            // 折旧：从 afterValue - beforeValue 计算变动
            origChange = origChange ?? 0;
            depChange = depChange ?? ((parseFloat(r.afterValue) - parseFloat(r.beforeValue)) || 0);
            break;
          case 'improvement':
            // 改造：从 afterValue - beforeValue 计算原值变动
            origChange = origChange ?? ((parseFloat(r.afterValue) - parseFloat(r.beforeValue)) || 0);
            depChange = depChange ?? 0;
            break;
          case 'disposal':
            // 处置：从 beforeValue 解析处置的原值和折旧
            origChange = origChange ?? -(parseFloat(r.beforeValue) || 0);
            depChange = depChange ?? 0;
            break;
          default:
            origChange = origChange ?? 0;
            depChange = depChange ?? 0;
        }
      }

      if (r.originalValueBalance !== undefined && r.originalValueBalance !== null) {
        runOrigBal = r.originalValueBalance;
        runDepBal = r.accumulatedDepreciationBalance ?? 0;
      } else {
        runOrigBal += origChange;
        runDepBal += depChange;
      }

      const netBal = r.netValueBalance ?? (runOrigBal - runDepBal);

      return {
        ...r,
        origChange,
        depChange,
        origBal: runOrigBal,
        depBal: runDepBal,
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
          <DialogTitle>固定资产时序账清单（时间流水）</DialogTitle>
        </DialogHeader>

        {selectedAsset && (
          <div className="text-sm text-slate-500 mb-2">
            {selectedAsset.assetCode} — {selectedAsset.assetName}
            <span className="ml-4">原值: ¥{(selectedAsset.originalValue ?? 0).toLocaleString()}</span>
            <span className="ml-4">累计折旧: ¥{(selectedAsset.accumulatedDepreciation ?? 0).toLocaleString()}</span>
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
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-20">事件类型</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">原值变动</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">折旧变动</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">原值余额</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">累计折旧</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">净值</th>
              </tr>
            </thead>
            <tbody>
              {timelineRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                    {selectedAssetId ? '暂无变动记录' : '请选择资产'}
                  </td>
                </tr>
              ) : (
                timelineRows.map((row) => {
                  const cfg = CHANGE_TYPE_CONFIG[row.changeType] || { label: row.changeType, color: 'bg-slate-50 text-slate-500' };
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
                      <td className="px-3 py-2 text-right font-mono">{formatAmount(row.depChange, true)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{row.origBal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{row.depBal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{row.netBal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
