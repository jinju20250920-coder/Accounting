'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp } from 'lucide-react';
import type { FixedAsset } from '@/types';

interface AssetImprovementDialogProps {
  asset: FixedAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AssetImprovementDialog({
  asset,
  open,
  onOpenChange,
  onSuccess,
}: AssetImprovementDialogProps) {
  const { improveAsset } = useFixedAssetStore();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [improvementDate, setImprovementDate] = useState(new Date().toISOString().split('T')[0]);
  const [addedValue, setAddedValue] = useState(0);
  const [extendedMonths, setExtendedMonths] = useState(0);
  const [reason, setReason] = useState('');

  if (!asset) return null;

  // 计算改造后的新值
  const newOriginalValue = asset.originalValue + addedValue;
  const newUsefulLifeMonths = asset.usefulLifeMonths + extendedMonths;
  const newDepreciableValue = newOriginalValue - asset.salvageValue;

  // 计算新的月折旧额（直线法）
  const remainingMonths = newUsefulLifeMonths - (asset.depreciatedMonths || 0);
  const newMonthlyDepreciation = remainingMonths > 0 ? newDepreciableValue / remainingMonths : 0;

  const handleSubmit = async () => {
    if (addedValue <= 0 && extendedMonths <= 0) {
      showToast('error', '请输入增加原值或延长使用年限');
      return;
    }

    setLoading(true);
    try {
      await improveAsset(asset.id, {
        date: improvementDate,
        addedValue,
        extendedMonths,
        reason,
      });

      showToast('success', '资产改造成功');
      onOpenChange(false);
      onSuccess?.();

      // 重置表单
      setAddedValue(0);
      setExtendedMonths(0);
      setReason('');
    } catch (error: any) {
      showToast('error', error.message || '改造失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            资产改造
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 资产信息 */}
          <div className="p-3 bg-slate-50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">资产编码</span>
              <span className="font-medium">{asset.assetCode}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">资产名称</span>
              <span>{asset.assetName}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">当前原值</span>
              <span>¥{(asset.originalValue ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">使用年限</span>
              <span>{asset.usefulLifeMonths} 个月（{asset.usefulLifeYears} 年）</span>
            </div>
          </div>

          {/* 改造日期 */}
          <div className="space-y-2">
            <Label required>改造日期</Label>
            <Input
              type="date"
              value={improvementDate}
              onChange={(e) => setImprovementDate(e.target.value)}
            />
          </div>

          {/* 增加原值 */}
          <div className="space-y-2">
            <Label>增加原值</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={addedValue}
                onChange={(e) => setAddedValue(parseFloat(e.target.value) || 0)}
                placeholder="改造增加的原值金额"
                className="flex-1"
              />
              <span className="text-sm text-slate-500">元</span>
            </div>
            <p className="text-xs text-slate-500">
              金额较大且显著延长资产寿命的改造支出
            </p>
          </div>

          {/* 延长使用年限 */}
          <div className="space-y-2">
            <Label>延长使用年限</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="1"
                value={extendedMonths}
                onChange={(e) => setExtendedMonths(parseInt(e.target.value) || 0)}
                placeholder="延长月数"
                className="w-32"
              />
              <span className="text-sm text-slate-500">个月</span>
            </div>
          </div>

          {/* 改造后预览 */}
          {(addedValue > 0 || extendedMonths > 0) && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-2">
              <div className="font-medium text-blue-700 mb-2">改造后</div>
              {addedValue > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600">新原值</span>
                    <span className="font-medium">¥{newOriginalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">应计折旧额</span>
                    <span>¥{newDepreciableValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
              {extendedMonths > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">新使用年限</span>
                  <span>{newUsefulLifeMonths} 个月（{(newUsefulLifeMonths / 12).toFixed(1)} 年）</span>
                </div>
              )}
              {remainingMonths > 0 && newMonthlyDepreciation > 0 && (
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-slate-700 font-medium">新月折旧额</span>
                  <span className="text-blue-600 font-medium">
                    ¥{newMonthlyDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 改造原因 */}
          <div className="space-y-2">
            <Label>改造原因</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入改造原因和内容说明"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading || (addedValue <= 0 && extendedMonths <= 0)}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            确认改造
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssetImprovementDialog;
