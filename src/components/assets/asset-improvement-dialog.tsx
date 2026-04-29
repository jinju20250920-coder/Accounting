'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Info } from 'lucide-react';
import type { FixedAsset } from '@/types';
import { AssetVoucherPreviewDialog, AssetVoucherPreviewData, AssetVoucherPreviewEntry } from './asset-voucher-preview-dialog';

type ChangeType = 'appreciation' | 'depreciation' | 'reclassify';

interface AssetChangeDialogProps {
  asset: FixedAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  appreciation: { label: '增值', icon: TrendingUp, description: '资产价值增加' },
  depreciation: { label: '减值', icon: TrendingDown, description: '资产价值减少' },
  reclassify: { label: '重分类', icon: RefreshCw, description: '变更分类信息' },
};

export function AssetChangeDialog({
  asset,
  open,
  onOpenChange,
  onSuccess,
}: AssetChangeDialogProps) {
  const { improveAsset, updateAsset } = useFixedAssetStore();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [changeType, setChangeType] = useState<ChangeType>('appreciation');
  const [changeDate, setChangeDate] = useState(new Date().toISOString().split('T')[0]);
  const [changeAmount, setChangeAmount] = useState(0);
  const [extendedMonths, setExtendedMonths] = useState(0);
  const [reason, setReason] = useState('');

  // 减值方式
  const [impairmentMethod, setImpairmentMethod] = useState<'provision' | 'direct_reduction'>('provision');

  // 凭证预览
  const [showPreview, setShowPreview] = useState(false);
  const [previewVouchers, setPreviewVouchers] = useState<AssetVoucherPreviewData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 重分类字段
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDepartmentCode, setNewDepartmentCode] = useState('');

  // 计算变动后的值 - 必须在所有条件返回之前
  const preview = useMemo(() => {
    if (!asset) {
      return { origChange: 0, depChange: 0, newOrigBal: 0, newDepBal: 0, newNetBal: 0 };
    }
    if (changeType === 'reclassify') {
      return {
        origChange: 0,
        depChange: 0,
        newOrigBal: asset.originalValue,
        newDepBal: asset.accumulatedDepreciation,
        newNetBal: asset.netValue,
      };
    }

    const amount = changeType === 'appreciation' ? Math.abs(changeAmount) : -Math.abs(changeAmount);
    const newOrigBal = asset.originalValue + amount;
    const newDepBal = asset.accumulatedDepreciation;
    const newNetBal = newOrigBal - newDepBal;

    return {
      origChange: amount,
      depChange: 0,
      newOrigBal,
      newDepBal,
      newNetBal,
    };
  }, [changeType, changeAmount, asset]);

  // 提前返回必须在所有 hooks 之后
  if (!asset) return null;

  // 预览凭证
  const handlePreview = () => {
    if (changeType === 'reclassify') {
      // 重分类不生成凭证，直接提交
      handleSubmit();
      return;
    }

    // 验证输入
    if (changeAmount === 0 && extendedMonths === 0) {
      showToast('error', '请输入变动金额或延长使用年限');
      return;
    }
    if (!reason.trim()) {
      showToast('error', '请输入变动原因');
      return;
    }

    const settings = useSettingsStore.getState().getAssetFinancialSettings();
    let entries: AssetVoucherPreviewEntry[] = [];

    if (changeType === 'appreciation') {
      entries = [
        {
          summary: `${asset.assetName}增值`,
          subjectCode: asset.assetSubjectCode || '1501',
          subjectName: asset.assetSubjectName || '固定资产',
          debit: Math.abs(changeAmount),
          credit: 0,
        },
        {
          summary: `支付${asset.assetName}增值费用`,
          subjectCode: '1002',
          subjectName: '银行存款',
          debit: 0,
          credit: Math.abs(changeAmount),
        },
      ];
    } else if (changeType === 'depreciation') {
      if (impairmentMethod === 'provision') {
        entries = [
          {
            summary: `${asset.assetName}计提减值准备`,
            subjectCode: settings.impairmentLossSubjectCode,
            subjectName: '资产减值损失',
            debit: Math.abs(changeAmount),
            credit: 0,
          },
          {
            summary: `${asset.assetName}减值准备`,
            subjectCode: settings.impairmentProvisionSubjectCode,
            subjectName: '固定资产减值准备',
            debit: 0,
            credit: Math.abs(changeAmount),
          },
        ];
      } else {
        entries = [
          {
            summary: `${asset.assetName}减值损失`,
            subjectCode: settings.lossSubjectCode,
            subjectName: '营业外支出',
            debit: Math.abs(changeAmount),
            credit: 0,
          },
          {
            summary: `${asset.assetName}减值`,
            subjectCode: asset.assetSubjectCode || '1501',
            subjectName: asset.assetSubjectName || '固定资产',
            debit: 0,
            credit: Math.abs(changeAmount),
          },
        ];
      }
    }

    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    setPreviewVouchers([{
      voucherDate: changeDate,
      entries,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    }]);
    setShowPreview(true);
  };

  // 确认凭证并提交
  const handleConfirmVouchers = async (updatedVouchers: AssetVoucherPreviewData[]) => {
    setIsProcessing(true);
    try {
      const amount = changeType === 'appreciation' ? Math.abs(changeAmount) : -Math.abs(changeAmount);
      await improveAsset(asset.id, {
        date: updatedVouchers[0].voucherDate,
        addedValue: amount,
        extendedMonths,
        reason,
      });
      showToast('success', changeType === 'appreciation' ? '资产增值成功' : '资产减值成功');

      setShowPreview(false);
      onOpenChange(false);
      onSuccess?.();

      // 重置表单
      setChangeAmount(0);
      setExtendedMonths(0);
      setReason('');
    } catch (error: any) {
      showToast('error', error.message || '操作失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (changeType === 'reclassify') {
      if (!newCategoryId && !newDepartmentCode) {
        showToast('error', '请选择要变更的分类或部门');
        return;
      }
    } else {
      if (changeAmount === 0 && extendedMonths === 0) {
        showToast('error', '请输入变动金额或延长使用年限');
        return;
      }
    }

    if (!reason.trim()) {
      showToast('error', '请输入变动原因');
      return;
    }

    setLoading(true);
    try {
      if (changeType === 'reclassify') {
        // 重分类：仅更新分类信息
        await updateAsset(asset.id, {
          categoryId: newCategoryId || asset.categoryId,
          departmentCode: newDepartmentCode || asset.departmentCode,
        });
        showToast('success', '资产重分类成功');
      } else {
        // 增值/减值：调用 improveAsset
        const amount = changeType === 'appreciation' ? Math.abs(changeAmount) : -Math.abs(changeAmount);
        await improveAsset(asset.id, {
          date: changeDate,
          addedValue: amount,
          extendedMonths,
          reason,
        });
        showToast('success', changeType === 'appreciation' ? '资产增值成功' : '资产减值成功');
      }

      onOpenChange(false);
      onSuccess?.();

      // 重置表单
      setChangeAmount(0);
      setExtendedMonths(0);
      setReason('');
      setNewCategoryId('');
      setNewDepartmentCode('');
    } catch (error: any) {
      showToast('error', error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (val: number | null | undefined) =>
    (val ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>资产变动（增值 / 减值 / 重分类）</DialogTitle>
          </DialogHeader>

          <div className="flex">
          {/* 左侧：变动配置 (60%) */}
          <div className="w-3/5 p-6 border-r space-y-5">
            {/* 1. 选择变动类型 */}
            <div className="space-y-2">
              <Label required>选择变动类型</Label>
              <div className="flex gap-3">
                {(Object.keys(CHANGE_TYPE_CONFIG) as ChangeType[]).map((type) => {
                  const cfg = CHANGE_TYPE_CONFIG[type];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setChangeType(type)}
                      className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                        changeType === type
                          ? type === 'appreciation'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : type === 'depreciation'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-slate-500 bg-slate-50 text-slate-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-center mb-1"><Icon className="h-4 w-4" /></div>
                      <div className="font-medium text-sm">{cfg.label}</div>
                      <div className="text-xs text-slate-500">{cfg.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. 基本信息 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label required>变动日期</Label>
                <Input
                  type="date"
                  value={changeDate}
                  onChange={(e) => setChangeDate(e.target.value)}
                  className="w-48"
                />
              </div>

              {changeType !== 'reclassify' && (
                <>
                  <div className="space-y-2">
                    <Label required>变动金额</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={changeAmount || ''}
                        onChange={(e) => setChangeAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-40"
                      />
                      <span className="text-sm text-slate-500">元</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {changeType === 'appreciation' ? '正数表示增值' : '正数表示减值金额'}
                    </p>
                  </div>

                  {/* 减值方式选择 */}
                  {changeType === 'depreciation' && (
                    <div className="space-y-2">
                      <Label>减值方式</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={impairmentMethod === 'provision'}
                            onChange={() => setImpairmentMethod('provision')}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">计提减值准备</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={impairmentMethod === 'direct_reduction'}
                            onChange={() => setImpairmentMethod('direct_reduction')}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">直接减少原值</span>
                        </label>
                      </div>
                      <p className="text-xs text-slate-500">
                        {impairmentMethod === 'provision'
                          ? '计提减值准备：借记资产减值损失，贷记固定资产减值准备'
                          : '直接减少原值：借记营业外支出，贷记固定资产'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>延长使用年限</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={extendedMonths || ''}
                        onChange={(e) => setExtendedMonths(parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24"
                      />
                      <span className="text-sm text-slate-500">个月</span>
                    </div>
                  </div>
                </>
              )}

              {changeType === 'reclassify' && (
                <div className="p-4 bg-amber-50 rounded-lg text-sm text-amber-700">
                  <Info className="h-4 w-4 inline mr-2" />
                  重分类仅变更分类信息，不影响金额和折旧
                </div>
              )}

              <div className="space-y-2">
                <Label required>变动原因</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请输入变动原因和内容说明..."
                  rows={3}
                  maxLength={200}
                  className="resize-none"
                />
                <div className="text-right text-xs text-slate-400">{reason.length}/200</div>
              </div>
            </div>
          </div>

          {/* 右侧：当前信息与变动预览 (40%) */}
          <div className="w-2/5 p-6 bg-slate-50 space-y-5">
            {/* 3. 资产当前信息 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">资产当前信息</div>
              <div className="bg-white rounded-lg p-3 text-sm space-y-1.5 border">
                <div className="flex justify-between">
                  <span className="text-slate-500">资产编码</span>
                  <span className="font-medium">{asset.assetCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">资产名称</span>
                  <span>{asset.assetName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">当前原值</span>
                  <span>¥{formatMoney(asset.originalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">累计折旧</span>
                  <span>¥{formatMoney(asset.accumulatedDepreciation)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">净值</span>
                  <span>¥{formatMoney(asset.netValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">使用年限</span>
                  <span>{asset.usefulLifeMonths} 个月 ({asset.usefulLifeYears}年)</span>
                </div>
              </div>
            </div>

            {/* 4. 变动后预览 */}
            {changeType !== 'reclassify' && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">变动后预览</div>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2 text-left font-medium text-slate-600">项目</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">变动金额</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">变动后</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-3 py-2">原值</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {preview.origChange !== 0 ? (
                            <span className={preview.origChange > 0 ? 'text-green-600' : 'text-red-500'}>
                              {preview.origChange > 0 ? '+' : ''}¥{formatMoney(Math.abs(preview.origChange))}
                            </span>
                          ) : (
                            <span className="text-slate-300">--</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">¥{formatMoney(preview.newOrigBal)}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-3 py-2">累计折旧</td>
                        <td className="px-3 py-2 text-right text-slate-300">--</td>
                        <td className="px-3 py-2 text-right font-mono">¥{formatMoney(preview.newDepBal)}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-3 py-2">净值</td>
                        <td className="px-3 py-2 text-right text-slate-300">--</td>
                        <td className="px-3 py-2 text-right font-mono">¥{formatMoney(preview.newNetBal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 说明 */}
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex items-start gap-1">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>增值后：原值增加，未来折旧额将相应增加</span>
              </div>
              <div className="flex items-start gap-1">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>减值后：原值减少，未来折旧额将相应减少</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handlePreview}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {changeType === 'reclassify' ? '确认变动' : '预览凭证'}
              </Button>
            </div>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      {/* 凭证预览对话框 */}
      <AssetVoucherPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        vouchers={previewVouchers}
        onConfirm={handleConfirmVouchers}
        isProcessing={isProcessing}
        title={changeType === 'appreciation' ? '资产增值凭证预览' : '资产减值凭证预览'}
      />
    </>
  );
}

export default AssetChangeDialog;
