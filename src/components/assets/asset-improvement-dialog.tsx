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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Trash2, Info, AlertTriangle, Split, Merge } from 'lucide-react';
import { formatNumber, getMonthEndDate, getDefaultAssetTypeSubjectConfig } from '@/lib/utils';
import { ACCOUNT_CODES } from '@/lib/accounting';
import type { FixedAsset, AssetCategory } from '@/types';
import { AssetVoucherPreviewDialog, AssetVoucherPreviewData, AssetVoucherPreviewEntry } from './asset-voucher-preview-dialog';

type ChangeType = 'appreciation' | 'depreciation' | 'restructure' | 'disposal';

// 资产重组子类型
type RestructureSubType = 'reclassify' | 'split' | 'merge';

// 拆分方式
type SplitMethod = 'average' | 'percentage';

// 增值方式（与取得方式完全一致，用于确定贷方科目）
type AppreciationType = 'purchase' | 'invoice' | 'shareholder_input' | 'surplus' | 'internal_transfer' | 'other';

interface AssetChangeDialogProps {
  asset: FixedAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  categories?: AssetCategory[];
  allAssets?: FixedAsset[];
}

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string; color: string }> = {
  appreciation: { label: '增值', icon: TrendingUp, description: '资产价值增加', color: 'green' },
  depreciation: { label: '减值', icon: TrendingDown, description: '资产价值减少', color: 'red' },
  restructure: { label: '重组', icon: RefreshCw, description: '重分类/拆分/合并', color: 'purple' },
  disposal: { label: '处置', icon: Trash2, description: '资产报废/出售', color: 'orange' },
};

const RESTRUCTURE_SUB_TYPES: Record<RestructureSubType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  reclassify: { label: '重分类', icon: RefreshCw, description: '变更分类或部门' },
  split: { label: '拆分', icon: Split, description: '拆分为多个资产' },
  merge: { label: '合并', icon: Merge, description: '合并多个资产' },
};

const DISPOSAL_TYPES = [
  { value: 'sold', label: '出售', description: '资产出售变现' },
  { value: 'scrapped', label: '报废', description: '资产报废清理' },
  { value: 'lost', label: '盘亏', description: '资产盘亏损失' },
];

export function AssetChangeDialog({
  asset,
  open,
  onOpenChange,
  onSuccess,
  categories = [],
  allAssets = [],
}: AssetChangeDialogProps) {
  const { improveAsset, updateAsset, disposeAsset, calculatePartialDisposal, getDisposalVoucherPreview, splitAsset, mergeAssets } = useFixedAssetStore();
  const { showToast } = useToast();

  // 获取当前账期（从 accountingPeriods 中找 isCurrent: true 的期间）
  const currentAccountSet = useAccountSetStore((s) => s.getCurrentAccountSet());
  const currentPeriodInfo = currentAccountSet?.accountingPeriods?.find(p => p.isCurrent);
  const defaultChangeDate = currentPeriodInfo
    ? getMonthEndDate(currentPeriodInfo.year, currentPeriodInfo.month)
    : new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [changeType, setChangeType] = useState<ChangeType>('appreciation');
  const [changeDate, setChangeDate] = useState(defaultChangeDate);
  const [changeAmount, setChangeAmount] = useState(0);
  const [extendedMonths, setExtendedMonths] = useState(0);
  const [reason, setReason] = useState('');

  // 增值方式
  const [appreciationType, setAppreciationType] = useState<AppreciationType>('purchase');

  // 减值方式
  const [impairmentMethod, setImpairmentMethod] = useState<'provision' | 'direct_reduction'>('provision');

  // 处置相关字段
  const [disposalType, setDisposalType] = useState<'scrapped' | 'sold' | 'lost'>('sold');
  const [disposalQuantity, setDisposalQuantity] = useState(1);
  const [disposalIncome, setDisposalIncome] = useState(0);
  const [disposalExpense, setDisposalExpense] = useState(0);

  // 重组相关字段
  const [restructureSubType, setRestructureSubType] = useState<RestructureSubType>('reclassify');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDepartmentCode, setNewDepartmentCode] = useState('');

  // 拆分相关字段
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('average');
  const [splitCount, setSplitCount] = useState(2);
  const [splitPercentages, setSplitPercentages] = useState<number[]>([50, 50]);

  // 合并相关字段
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [mergedDepartmentCode, setMergedDepartmentCode] = useState('');
  const [mergedCategoryId, setMergedCategoryId] = useState('');

  // 凭证预览
  const [showPreview, setShowPreview] = useState(false);
  const [previewVouchers, setPreviewVouchers] = useState<AssetVoucherPreviewData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 计算处置数据
  const disposalCalc = useMemo(() => {
    if (!asset || changeType !== 'disposal') return null;
    return calculatePartialDisposal(asset.id, disposalQuantity);
  }, [asset, changeType, disposalQuantity, calculatePartialDisposal]);

  // 计算拆分预览
  const splitPreview = useMemo(() => {
    if (!asset || changeType !== 'restructure' || restructureSubType !== 'split') return null;

    const results: { name: string; percentage: number; originalValue: number; accumulatedDepreciation: number }[] = [];

    if (splitMethod === 'average') {
      const perPercentage = 100 / splitCount;
      for (let i = 0; i < splitCount; i++) {
        const pct = i === splitCount - 1 ? 100 - perPercentage * (splitCount - 1) : perPercentage;
        results.push({
          name: `${asset.assetName}-${i + 1}`,
          percentage: pct,
          originalValue: asset.originalValue * pct / 100,
          accumulatedDepreciation: asset.accumulatedDepreciation * pct / 100,
        });
      }
    } else {
      const totalPct = splitPercentages.reduce((a, b) => a + b, 0);
      if (Math.abs(totalPct - 100) > 0.01) return null;

      splitPercentages.forEach((pct, i) => {
        results.push({
          name: `${asset.assetName}-${i + 1}`,
          percentage: pct,
          originalValue: asset.originalValue * pct / 100,
          accumulatedDepreciation: asset.accumulatedDepreciation * pct / 100,
        });
      });
    }

    return results;
  }, [asset, changeType, restructureSubType, splitMethod, splitCount, splitPercentages]);

  // 计算合并预览
  const mergePreview = useMemo(() => {
    if (changeType !== 'restructure' || restructureSubType !== 'merge' || selectedAssetIds.length < 2) return null;

    const selectedAssets = allAssets.filter(a => selectedAssetIds.includes(a.id));
    if (selectedAssets.length !== selectedAssetIds.length) return null;

    const totalOriginalValue = selectedAssets.reduce((sum, a) => sum + a.originalValue, 0);
    const totalAccumulatedDepreciation = selectedAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);

    return {
      assets: selectedAssets,
      totalOriginalValue,
      totalAccumulatedDepreciation,
      totalNetValue: totalOriginalValue - totalAccumulatedDepreciation,
    };
  }, [changeType, restructureSubType, selectedAssetIds, allAssets]);

  // 计算变动后的值
  const preview = useMemo(() => {
    if (!asset) {
      return { origChange: 0, depChange: 0, newOrigBal: 0, newDepBal: 0, newNetBal: 0 };
    }
    if (changeType === 'restructure' || changeType === 'disposal') {
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

  // 可合并的资产列表（排除当前资产和已处置资产）
  const mergeableAssets = useMemo(() => {
    if (!asset) return [];
    return allAssets.filter(a =>
      a.id !== asset.id &&
      a.accountingStatus !== 'disposed' &&
      a.assetSubjectCode === asset.assetSubjectCode
    );
  }, [allAssets, asset]);

  // 提前返回必须在所有 hooks 之后
  if (!asset) return null;

  const maxQuantity = asset.remainingQuantity || asset.quantity || 1;
  const isPartialDisposal = disposalQuantity < maxQuantity;

  // 预览凭证
  const handlePreview = () => {
    if (changeType === 'restructure') {
      handleSubmit();
      return;
    }

    // 验证输入
    if (changeType !== 'disposal' && changeAmount === 0 && extendedMonths === 0) {
      showToast('error', '请输入变动金额或延长使用年限');
      return;
    }

    if (changeType === 'disposal') {
      if (disposalQuantity <= 0 || disposalQuantity > maxQuantity) {
        showToast('error', `处置数量必须在 1 到 ${maxQuantity} 之间`);
        return;
      }
      if (!disposalCalc) {
        showToast('error', '无法计算处置数据');
        return;
      }
    }

    if (!reason.trim()) {
      showToast('error', '请输入变动原因');
      return;
    }

    const settings = useSettingsStore.getState().getAssetFinancialSettings();
    let entries: AssetVoucherPreviewEntry[] = [];
    let title = '凭证预览';

    if (changeType === 'appreciation') {
      title = '资产增值凭证预览';
      entries = [
        {
          summary: `${asset.assetName}增值`,
          subjectCode: asset.assetSubjectCode || ACCOUNT_CODES.FIXED_ASSET,
          subjectName: asset.assetSubjectName || '固定资产',
          debit: Math.abs(changeAmount),
          credit: 0,
        },
        {
          summary: `支付${asset.assetName}增值费用`,
          subjectCode: ACCOUNT_CODES.BANK,
          subjectName: '银行存款',
          debit: 0,
          credit: Math.abs(changeAmount),
        },
      ];
    } else if (changeType === 'depreciation') {
      title = '资产减值凭证预览';
      // 根据资产分类确定科目
      const category = categories.find(c => c.id === asset.categoryId);
      const isIntangible = category?.assetType === 'intangible';
      const assetType: 'fixed' | 'intangible' = isIntangible ? 'intangible' : 'fixed';

      // 从按资产类型的配置中获取科目
      const typeConfig = settings.subjectConfigs?.find(c => c.assetType === assetType)
        || getDefaultAssetTypeSubjectConfig(assetType);

      const defaultAssetSubjectCode = isIntangible ? ACCOUNT_CODES.INTANGIBLE_ASSET : ACCOUNT_CODES.FIXED_ASSET;
      const defaultAssetSubjectName = isIntangible ? '无形资产' : '固定资产';

      if (impairmentMethod === 'provision') {
        entries = [
          {
            summary: `${asset.assetName}计提减值准备`,
            subjectCode: typeConfig.impairmentLossSubjectCode,
            subjectName: '资产减值损失',
            debit: Math.abs(changeAmount),
            credit: 0,
          },
          {
            summary: `${asset.assetName}减值准备`,
            subjectCode: typeConfig.impairmentProvisionSubjectCode,
            subjectName: isIntangible ? '无形资产减值准备' : '固定资产减值准备',
            debit: 0,
            credit: Math.abs(changeAmount),
          },
        ];
      } else {
        entries = [
          {
            summary: `${asset.assetName}减值损失`,
            subjectCode: typeConfig.lossSubjectCode,
            subjectName: '营业外支出',
            debit: Math.abs(changeAmount),
            credit: 0,
          },
          {
            summary: `${asset.assetName}减值`,
            subjectCode: asset.assetSubjectCode || defaultAssetSubjectCode,
            subjectName: asset.assetSubjectName || defaultAssetSubjectName,
            debit: 0,
            credit: Math.abs(changeAmount),
          },
        ];
      }
    } else if (changeType === 'disposal') {
      title = '资产处置凭证预览';
      const vouchers = getDisposalVoucherPreview(asset.id, {
        date: changeDate,
        type: disposalType,
        quantity: disposalQuantity,
        disposalIncome,
        disposalExpense,
        reason,
      });
      if (vouchers.length === 0) {
        showToast('error', '无法生成凭证预览');
        return;
      }
      setPreviewVouchers(vouchers);
      setShowPreview(true);
      return;
    }

    const amount = Math.abs(changeAmount);
    setPreviewVouchers([{
      voucherDate: changeDate,
      entries,
      totalDebit: amount,
      totalCredit: amount,
      isBalanced: true,
    }]);
    setShowPreview(true);
  };

  // 确认凭证并提交
  const handleConfirmVouchers = async (updatedVouchers: AssetVoucherPreviewData[]) => {
    setIsProcessing(true);
    try {
      if (changeType === 'disposal') {
        await disposeAsset(asset.id, {
          date: updatedVouchers[0].voucherDate,
          type: disposalType,
          quantity: disposalQuantity,
          disposalIncome,
          disposalExpense,
          reason,
        });
        showToast('success', `资产处置成功${isPartialDisposal ? `（部分处置 ${disposalQuantity} ${asset.unit || '件'}）` : ''}`);
      } else {
        const amount = changeType === 'appreciation' ? Math.abs(changeAmount) : -Math.abs(changeAmount);
        await improveAsset(asset.id, {
          date: updatedVouchers[0].voucherDate,
          addedValue: amount,
          extendedMonths,
          reason,
        });
        showToast('success', changeType === 'appreciation' ? '资产增值成功' : '资产减值成功');
      }

      setShowPreview(false);
      onOpenChange(false);
      onSuccess?.();
      resetForm();
    } catch (error: any) {
      showToast('error', error.message || '操作失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    // 重分类验证
    if (changeType === 'restructure' && restructureSubType === 'reclassify') {
      if (!newCategoryId && !newDepartmentCode) {
        showToast('error', '请选择要变更的分类或部门');
        return;
      }
    }

    // 拆分验证
    if (changeType === 'restructure' && restructureSubType === 'split') {
      if (splitMethod === 'percentage') {
        const totalPct = splitPercentages.reduce((a, b) => a + b, 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          showToast('error', '拆分百分比之和必须等于100%');
          return;
        }
      }
      if (splitCount < 2) {
        showToast('error', '拆分数量至少为2');
        return;
      }
    }

    // 合并验证
    if (changeType === 'restructure' && restructureSubType === 'merge') {
      if (selectedAssetIds.length < 2) {
        showToast('error', '请至少选择2个资产进行合并');
        return;
      }
      if (!mergedDepartmentCode) {
        showToast('error', '请选择合并后的部门');
        return;
      }
    }

    if (!reason.trim()) {
      showToast('error', '请输入变动原因');
      return;
    }

    setLoading(true);
    try {
      if (changeType === 'restructure') {
        if (restructureSubType === 'reclassify') {
          await updateAsset(asset.id, {
            categoryId: newCategoryId || asset.categoryId,
            departmentCode: newDepartmentCode || asset.departmentCode,
          });
          showToast('success', '资产重分类成功');
        } else if (restructureSubType === 'split') {
          await splitAsset(asset.id, {
            date: changeDate,
            method: splitMethod,
            count: splitMethod === 'average' ? splitCount : splitPercentages.length,
            percentages: splitMethod === 'percentage' ? splitPercentages : undefined,
            reason,
          });
          showToast('success', `资产拆分成功，已生成 ${splitMethod === 'average' ? splitCount : splitPercentages.length} 个新资产`);
        } else if (restructureSubType === 'merge') {
          await mergeAssets(selectedAssetIds, {
            date: changeDate,
            departmentCode: mergedDepartmentCode,
            categoryId: mergedCategoryId,
            reason,
          });
          showToast('success', '资产合并成功');
        }
      } else if (changeType === 'disposal') {
        await disposeAsset(asset.id, {
          date: changeDate,
          type: disposalType,
          quantity: disposalQuantity,
          disposalIncome,
          disposalExpense,
          reason,
        });
        showToast('success', `资产处置成功${isPartialDisposal ? `（部分处置 ${disposalQuantity} ${asset.unit || '件'}）` : ''}`);
      } else {
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
      resetForm();
    } catch (error: any) {
      showToast('error', error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setChangeAmount(0);
    setExtendedMonths(0);
    setReason('');
    setNewCategoryId('');
    setNewDepartmentCode('');
    setDisposalQuantity(1);
    setDisposalIncome(0);
    setDisposalExpense(0);
    setRestructureSubType('reclassify');
    setSplitMethod('average');
    setSplitCount(2);
    setSplitPercentages([50, 50]);
    setSelectedAssetIds([]);
    setMergedDepartmentCode('');
    setMergedCategoryId('');
  };

  const getTypeColorClass = (type: ChangeType) => {
    const colors: Record<ChangeType, string> = {
      appreciation: 'border-green-500 bg-green-50 text-green-700',
      depreciation: 'border-red-500 bg-red-50 text-red-700',
      restructure: 'border-purple-500 bg-purple-50 text-purple-700',
      disposal: 'border-orange-500 bg-orange-50 text-orange-700',
    };
    return colors[type];
  };

  const getRestructureColorClass = (subType: RestructureSubType) => {
    const colors: Record<RestructureSubType, string> = {
      reclassify: 'border-slate-400 bg-slate-50 text-slate-700',
      split: 'border-blue-400 bg-blue-50 text-blue-700',
      merge: 'border-indigo-400 bg-indigo-50 text-indigo-700',
    };
    return colors[subType];
  };

  // 更新拆分百分比数组
  const updateSplitPercentage = (index: number, value: number) => {
    const newPercentages = [...splitPercentages];
    newPercentages[index] = value;
    // 如果只有2行，第二行自动计算为 100 - 第一行
    if (newPercentages.length === 2 && index === 0) {
      newPercentages[1] = Math.max(0, 100 - value);
    }
    setSplitPercentages(newPercentages);
  };

  // 添加拆分项
  const addSplitItem = () => {
    setSplitPercentages([...splitPercentages, 0]);
  };

  // 删除拆分项
  const removeSplitItem = (index: number) => {
    if (splitPercentages.length <= 2) return;
    const newPercentages = splitPercentages.filter((_, i) => i !== index);
    setSplitPercentages(newPercentages);
  };

  // 切换资产选择（合并用）
  const toggleAssetSelection = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    } else {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-6 py-4 pr-12 border-b sticky top-0 bg-white z-10">
            <DialogTitle>资产变动</DialogTitle>
          </DialogHeader>

          <div className="flex">
            {/* 左侧：变动配置 (60%) */}
            <div className="w-3/5 p-6 border-r space-y-5">
              {/* 1. 选择变动类型 */}
              <div className="space-y-2">
                <Label required>选择变动类型</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(CHANGE_TYPE_CONFIG) as ChangeType[]).map((type) => {
                    const cfg = CHANGE_TYPE_CONFIG[type];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setChangeType(type)}
                        className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                          changeType === type
                            ? getTypeColorClass(type)
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex justify-center mb-1"><Icon className="h-4 w-4" /></div>
                        <div className="font-medium text-sm">{cfg.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. 基本信息 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label required>变动日期</Label>
                  <ChineseDatePicker
                    value={changeDate}
                    onChange={setChangeDate}
                  />
                </div>

                {/* 增值/减值字段 */}
                {changeType !== 'restructure' && changeType !== 'disposal' && (
                  <>
                    {/* 增值方式选择 */}
                    {changeType === 'appreciation' && (
                      <div className="space-y-2">
                        <Label required>增值方式</Label>
                        <Select
                          value={appreciationType}
                          onValueChange={(v) => setAppreciationType(v as AppreciationType)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="purchase">购入</SelectItem>
                            <SelectItem value="invoice">发票取得</SelectItem>
                            <SelectItem value="shareholder_input">股东投入</SelectItem>
                            <SelectItem value="surplus">盘盈</SelectItem>
                            <SelectItem value="internal_transfer">内部转入</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

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

                {/* 处置字段 */}
                {changeType === 'disposal' && (
                  <>
                    <div className="space-y-2">
                      <Label required>处置方式</Label>
                      <Select value={disposalType} onValueChange={(v) => setDisposalType(v as 'scrapped' | 'sold' | 'lost')}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DISPOSAL_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label} - {t.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label required>处置数量</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={maxQuantity}
                          value={disposalQuantity}
                          onChange={(e) => setDisposalQuantity(parseInt(e.target.value) || 1)}
                          className="w-24"
                        />
                        <span className="text-sm text-slate-500">
                          {asset.unit || '件'}（最大 {maxQuantity}）
                        </span>
                      </div>
                      {isPartialDisposal && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          部分处置，剩余 {maxQuantity - disposalQuantity} {asset.unit || '件'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>处置收入</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={disposalIncome || ''}
                          onChange={(e) => setDisposalIncome(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-40"
                        />
                        <span className="text-sm text-slate-500">元</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>处置费用</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={disposalExpense || ''}
                          onChange={(e) => setDisposalExpense(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-40"
                        />
                        <span className="text-sm text-slate-500">元</span>
                      </div>
                    </div>

                    {/* 处置计算预览 */}
                    {disposalCalc && (
                      <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg space-y-2">
                        <div className="text-xs font-medium text-orange-700">处置计算</div>
                        <div className="text-xs text-orange-600 space-y-1">
                          <div className="flex justify-between">
                            <span>处置原值</span>
                            <span>¥{formatNumber(disposalCalc.disposedOriginalValue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>处置累计折旧</span>
                            <span>¥{formatNumber(disposalCalc.disposedAccumulatedDepreciation)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>处置净值</span>
                            <span>¥{formatNumber(disposalCalc.disposedNetValue)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>预计损益</span>
                            <span className={disposalIncome - disposalExpense - disposalCalc.disposedNetValue >= 0 ? 'text-green-600' : 'text-red-600'}>
                              ¥{formatNumber(disposalIncome - disposalExpense - disposalCalc.disposedNetValue)}
                              {disposalIncome - disposalExpense - disposalCalc.disposedNetValue >= 0 ? '（收益）' : '（损失）'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 重组字段 */}
                {changeType === 'restructure' && (
                  <>
                    {/* 重组子类型选择 */}
                    <div className="space-y-2">
                      <Label required>重组方式</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(RESTRUCTURE_SUB_TYPES) as RestructureSubType[]).map((subType) => {
                          const cfg = RESTRUCTURE_SUB_TYPES[subType];
                          const Icon = cfg.icon;
                          return (
                            <button
                              key={subType}
                              type="button"
                              onClick={() => setRestructureSubType(subType)}
                              className={`p-2 rounded-lg border-2 text-center transition-all ${
                                restructureSubType === subType
                                  ? getRestructureColorClass(subType)
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex justify-center mb-1"><Icon className="h-4 w-4" /></div>
                              <div className="font-medium text-xs">{cfg.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 重分类表单 */}
                    {restructureSubType === 'reclassify' && (
                      <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
                        <Info className="h-4 w-4 inline mr-2" />
                        重分类仅变更分类信息，不影响金额和折旧
                      </div>
                    )}

                    {/* 拆分表单 */}
                    {restructureSubType === 'split' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label required>拆分方式</Label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={splitMethod === 'average'}
                                onChange={() => setSplitMethod('average')}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">平均拆分</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={splitMethod === 'percentage'}
                                onChange={() => setSplitMethod('percentage')}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">按百分比拆分</span>
                            </label>
                          </div>
                        </div>

                        {splitMethod === 'average' ? (
                          <div className="space-y-2">
                            <Label required>拆分数量</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={2}
                                max={10}
                                value={splitCount}
                                onChange={(e) => setSplitCount(parseInt(e.target.value) || 2)}
                                className="w-24"
                              />
                              <span className="text-sm text-slate-500">份</span>
                            </div>
                            <p className="text-xs text-slate-500">每份占比 {100 / splitCount}%</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label required>拆分比例</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addSplitItem}
                                disabled={splitPercentages.length >= 10}
                              >
                                添加
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {splitPercentages.map((pct, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-sm text-slate-500 w-16">第 {i + 1} 份</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    value={pct || ''}
                                    onChange={(e) => updateSplitPercentage(i, parseFloat(e.target.value) || 0)}
                                    className="w-24"
                                    autoComplete="off"
                                  />
                                  <span className="text-sm text-slate-500">%</span>
                                  {splitPercentages.length > 2 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeSplitItem(i)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      删除
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="text-xs text-slate-500">
                              当前合计: {splitPercentages.reduce((a, b) => a + b, 0).toFixed(2)}%
                              {Math.abs(splitPercentages.reduce((a, b) => a + b, 0) - 100) > 0.01 && (
                                <span className="text-red-500 ml-2">（需等于100%）</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 合并表单 */}
                    {restructureSubType === 'merge' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label required>选择要合并的资产</Label>
                          <div className="border rounded-lg max-h-48 overflow-y-auto">
                            {mergeableAssets.length === 0 ? (
                              <div className="p-4 text-sm text-slate-500 text-center">
                                没有可合并的资产（需相同科目）
                              </div>
                            ) : (
                              <div className="divide-y">
                                {mergeableAssets.map(a => (
                                  <label
                                    key={a.id}
                                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={selectedAssetIds.includes(a.id)}
                                      onCheckedChange={() => toggleAssetSelection(a.id)}
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium">{a.assetCode} - {a.assetName}</div>
                                      <div className="text-xs text-slate-500">
                                        原值: ¥{formatNumber(a.originalValue)} | 净值: ¥{formatNumber(a.netValue)}
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            已选择 {selectedAssetIds.length} 个资产（含当前资产共 {selectedAssetIds.length + 1} 个）
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label required>合并后部门</Label>
                          <Select value={mergedDepartmentCode} onValueChange={setMergedDepartmentCode}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="选择部门" />
                            </SelectTrigger>
                            <SelectContent>
                              {/* 部门选项需要从store获取 */}
                              <SelectItem value="admin">行政部</SelectItem>
                              <SelectItem value="finance">财务部</SelectItem>
                              <SelectItem value="sales">销售部</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </>
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
              {/* 资产当前信息 */}
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
                    <span>¥{formatNumber(asset.originalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">累计折旧</span>
                    <span>¥{formatNumber(asset.accumulatedDepreciation)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">净值</span>
                    <span>¥{formatNumber(asset.netValue)}</span>
                  </div>
                  {changeType === 'disposal' && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">在库数量</span>
                      <span>{maxQuantity} {asset.unit || '件'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 变动后预览 */}
              {(changeType === 'appreciation' || changeType === 'depreciation') && (
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
                                {preview.origChange > 0 ? '+' : ''}¥{formatNumber(Math.abs(preview.origChange))}
                              </span>
                            ) : (
                              <span className="text-slate-300">--</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">¥{formatNumber(preview.newOrigBal)}</td>
                        </tr>
                        <tr className="border-t">
                          <td className="px-3 py-2">净值</td>
                          <td className="px-3 py-2 text-right text-slate-300">--</td>
                          <td className="px-3 py-2 text-right font-mono">¥{formatNumber(preview.newNetBal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 拆分预览 */}
              {changeType === 'restructure' && restructureSubType === 'split' && splitPreview && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">拆分预览</div>
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="px-3 py-2 text-left font-medium text-slate-600">新资产</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">比例</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">原值</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">折旧</th>
                        </tr>
                      </thead>
                      <tbody>
                        {splitPreview.map((item, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{item.name}</td>
                            <td className="px-3 py-2 text-right">{item.percentage.toFixed(1)}%</td>
                            <td className="px-3 py-2 text-right font-mono">¥{formatNumber(item.originalValue)}</td>
                            <td className="px-3 py-2 text-right font-mono">¥{formatNumber(item.accumulatedDepreciation)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 合并预览 */}
              {changeType === 'restructure' && restructureSubType === 'merge' && mergePreview && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">合并预览</div>
                  <div className="bg-white rounded-lg p-3 text-sm space-y-1.5 border">
                    <div className="flex justify-between">
                      <span className="text-slate-500">合并资产数</span>
                      <span>{mergePreview.assets.length + 1} 个</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">合并后原值</span>
                      <span className="font-medium">¥{formatNumber(mergePreview.totalOriginalValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">合并后折旧</span>
                      <span>¥{formatNumber(mergePreview.totalAccumulatedDepreciation)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">合并后净值</span>
                      <span>¥{formatNumber(mergePreview.totalNetValue)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    包含: {mergePreview.assets.map(a => a.assetCode).join(', ')} 及当前资产
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button
                  className={`flex-1 ${changeType === 'disposal' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                  onClick={handlePreview}
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {changeType === 'restructure' ? '确认变动' : '预览凭证'}
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
        title={
          changeType === 'appreciation' ? '资产增值凭证预览' :
          changeType === 'depreciation' ? '资产减值凭证预览' :
          '资产处置凭证预览'
        }
      />
    </>
  );
}

export default AssetChangeDialog;
