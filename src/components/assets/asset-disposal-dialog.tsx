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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { FixedAsset } from '@/types';

interface AssetDisposalDialogProps {
  asset: FixedAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AssetDisposalDialog({
  asset,
  open,
  onOpenChange,
  onSuccess,
}: AssetDisposalDialogProps) {
  const { disposeAsset, calculatePartialDisposal } = useFixedAssetStore();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [disposalType, setDisposalType] = useState<'scrapped' | 'sold' | 'lost'>('scrapped');
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState(1);
  const [disposalIncome, setDisposalIncome] = useState(0);
  const [disposalExpense, setDisposalExpense] = useState(0);
  const [reason, setReason] = useState('');

  if (!asset) return null;

  const disposalCalc = calculatePartialDisposal(asset.id, quantity);
  const isPartialDisposal = quantity < asset.remainingQuantity;
  const maxQuantity = asset.remainingQuantity;

  const handleSubmit = async () => {
    if (!disposalCalc) {
      showToast('error', '处置数量无效');
      return;
    }

    if (quantity <= 0 || quantity > maxQuantity) {
      showToast('error', `处置数量必须在 1 到 ${maxQuantity} 之间`);
      return;
    }

    setLoading(true);
    try {
      await disposeAsset(asset.id, {
        date: disposalDate,
        type: disposalType,
        quantity,
        disposalIncome,
        disposalExpense,
        reason,
      });

      showToast('success', `资产处置成功${isPartialDisposal ? `（部分处置 ${quantity} ${asset.unit || '件'}）` : ''}`);
      onOpenChange(false);
      onSuccess?.();

      // 重置表单
      setQuantity(1);
      setDisposalIncome(0);
      setDisposalExpense(0);
      setReason('');
    } catch (error: any) {
      showToast('error', error.message || '处置失败');
    } finally {
      setLoading(false);
    }
  };

  const disposalTypeOptions = [
    { value: 'scrapped', label: '报废', description: '资产报废清理' },
    { value: 'sold', label: '出售', description: '资产对外出售' },
    { value: 'lost', label: '盘亏', description: '资产盘亏损失' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            资产处置
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
              <span className="text-slate-500">在库数量</span>
              <span>{asset.remainingQuantity} {asset.unit || '件'}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">账面净值</span>
              <span className="font-medium text-blue-600">
                ¥{asset.netValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 处置类型 */}
          <div className="space-y-2">
            <Label required>处置类型</Label>
            <Select value={disposalType} onValueChange={(v) => setDisposalType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {disposalTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 处置日期 */}
          <div className="space-y-2">
            <Label required>处置日期</Label>
            <Input
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
            />
          </div>

          {/* 处置数量 */}
          {asset.remainingQuantity > 1 && (
            <div className="space-y-2">
              <Label required>处置数量</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={maxQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <span className="text-sm text-slate-500">
                  / {maxQuantity} {asset.unit || '件'}
                </span>
                {isPartialDisposal && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                    部分处置
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 处置金额预览 */}
          {disposalCalc && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">处置原值</span>
                <span>¥{disposalCalc.disposedOriginalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">处置累计折旧</span>
                <span>¥{disposalCalc.disposedAccumulatedDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-1 mt-1">
                <span className="text-slate-700">处置净值</span>
                <span className="text-blue-600">¥{disposalCalc.disposedNetValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* 清理收入（出售时） */}
          {disposalType === 'sold' && (
            <div className="space-y-2">
              <Label>出售收入</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={disposalIncome}
                onChange={(e) => setDisposalIncome(parseFloat(e.target.value) || 0)}
                placeholder="出售所得金额"
              />
            </div>
          )}

          {/* 清理费用 */}
          <div className="space-y-2">
            <Label>清理费用</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={disposalExpense}
              onChange={(e) => setDisposalExpense(parseFloat(e.target.value) || 0)}
              placeholder="处置过程中发生的费用"
            />
          </div>

          {/* 处置原因 */}
          <div className="space-y-2">
            <Label>处置原因</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入处置原因（可选）"
              rows={2}
            />
          </div>

          {/* 损益预览 */}
          {disposalCalc && (disposalIncome > 0 || disposalExpense > 0) && (
            <div className="p-3 bg-slate-100 rounded-lg text-sm">
              <div className="flex justify-between font-medium">
                <span>预计损益</span>
                <span className={disposalIncome - disposalExpense - disposalCalc.disposedNetValue >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ¥{(disposalIncome - disposalExpense - disposalCalc.disposedNetValue).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  {disposalIncome - disposalExpense - disposalCalc.disposedNetValue >= 0 ? ' (收益)' : ' (损失)'}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading} variant="destructive">
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            确认处置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssetDisposalDialog;
