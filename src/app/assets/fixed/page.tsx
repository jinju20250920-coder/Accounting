'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useDepartmentStore } from '@/stores/useDepartmentStore';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useFinancialProjectStore } from '@/stores/useFinancialProjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/toast';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Upload,
  Package,
  AlertCircle,
  Settings,
  History,
  QrCode,
  TrendingUp,
  Printer,
  Calculator,
  FileText,
  BookOpen,
} from 'lucide-react';
import { AssetCodeRuleDialog } from '@/components/asset-code-rule-dialog';
import { AssetCategoryDialog } from '@/components/assets/asset-category-dialog';
import { CodeRuleManager, generateCode, type CodeRule } from '@/lib/code-generator';
import { AssetQRLabel, AssetQRLabelPrint, AssetQRLabelBatch } from '@/components/assets/asset-qr-label';
import { AssetChangeDialog } from '@/components/assets/asset-improvement-dialog';
import { AssetTimelineLedger } from '@/components/assets/asset-change-record-list';
import { IntangibleTimelineLedger } from '@/components/assets/intangible-change-record-list';
import { DepreciationDialog } from '@/components/assets/depreciation-dialog';
import { parseFixedAssetsExcel, exportFixedAssetsToExcel, generateAssetImportTemplate } from '@/lib/excel-utils';
import { getDepreciationMethodName, calculateEstimatedMonthlyDepreciation, getDepreciationStartRule, calculateMonthsBetween } from '@/lib/depreciation';
import { getAcquisitionVoucherEntries } from '@/lib/asset-acquisition-rule';
import { validateAccountingPeriod } from '@/lib/accounting';
import { getAssetDatePeriod } from '@/lib/asset-date';
import { formatNumber, refreshVoucherStore, generateId } from '@/lib/utils';
import type { FixedAsset, AssetCategory } from '@/types';

// 资产卡片对话框组件
function AssetCardDialog({
  open,
  onOpenChange,
  asset,
  categories,
  existingCodes,
  onSave,
  requireDepartment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: FixedAsset | null;
  categories: AssetCategory[];
  existingCodes: string[];
  onSave: (data: Partial<FixedAsset>) => Promise<FixedAsset | undefined | void>;
  requireDepartment: boolean;
}) {
  const { showToast } = useToast();

  // 获取部门、供应商、项目数据
  const departments = useDepartmentStore((s) => s.departments);
  const partners = usePartnerStore((s) => s.partners);
  const projects = useFinancialProjectStore((s) => s.projects);

  // 构建可搜索选项
  const departmentOptions = departments
    .filter(d => !d.frozen)
    .map(d => ({ value: d.code, label: d.name, code: d.code }));

  const supplierOptions = partners
    .filter(p => p.isSupplier)
    .map(p => ({ value: p.name, label: p.name, code: p.code }));

  const projectOptions = projects
    .filter(p => !p.frozen)
    .map(p => ({ value: p.name, label: p.name, code: p.code }));

  const [formData, setFormData] = useState<Partial<FixedAsset>>({
    assetCode: '',
    assetName: '',
    categoryId: '',
    specification: '',
    quantity: 1,
    unit: '台',
    originalValue: 0,
    salvageValue: 0,
    depreciationMethod: 'straight_line',
    usefulLifeYears: 5,
    acquisitionDate: new Date().toISOString().split('T')[0],
    location: '',
    departmentCode: '',
    supplierName: '',
    invoiceNo: '',
    notes: '',
    serialNumber: '',
    assignedUser: '',
    acquisitionType: 'purchase',
    accountingStatus: 'accounted',
  });

  useEffect(() => {
    if (asset) {
      setFormData(asset);
    } else {
      // 新增时预览编码（不消耗编号，避免取消时跳号）
      const manager = CodeRuleManager.getInstance();
      const rule = manager.getRuleByType('fixed_asset');
      let autoCode = '';
      if (rule.autoIncrement) {
        const result = generateCode(rule, existingCodes);
        autoCode = result.code;
        // 不调用 manager.setRule()，仅预览
      }

      setFormData({
        assetCode: autoCode,
        assetName: '',
        categoryId: '',
        specification: '',
        quantity: 1,
        unit: '台',
        originalValue: 0,
        salvageValue: 0,
        depreciationMethod: 'straight_line',
        usefulLifeYears: 5,
        acquisitionDate: new Date().toISOString().split('T')[0],
        location: '',
        departmentCode: '',
        supplierName: '',
        invoiceNo: '',
        notes: '',
        serialNumber: '',
        assignedUser: '',
        acquisitionType: 'purchase',
        accountingStatus: 'pending',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, open]);

  // 当选择分类时，自动填充默认值并更新编码
  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      // 根据分类确定编码规则类型
      const isIntangible = category.assetType === 'intangible';
      const manager = CodeRuleManager.getInstance();
      const ruleType = isIntangible ? 'intangible_asset' : 'fixed_asset';
      const rule = manager.getRuleByType(ruleType);

      let autoCode = formData.assetCode;
      if (rule.autoIncrement) {
        const result = generateCode(rule, existingCodes);
        autoCode = result.code;
      }

      setFormData(prev => ({
        ...prev,
        categoryId,
        categoryName: category.name,
        usefulLifeYears: category.defaultUsefulLifeYears,
        depreciationMethod: category.defaultDepreciationMethod,
        assetCode: autoCode,
      }));
    }
  };

  // 当取得方式变化时，更新表单（不改变已入账资产的状态）
  const handleAcquisitionTypeChange = (acquisitionType: string) => {
    const isOpening = acquisitionType === 'opening_balance';
    setFormData(prev => ({
      ...prev,
      acquisitionType: acquisitionType as FixedAsset['acquisitionType'],
      isOpeningBalance: isOpening,
      // 已入账资产保持已入账状态，新增资产设为待入账
      accountingStatus: asset?.accountingStatus === 'accounted'
        || asset?.acquisitionVoucherId
        || asset?.acquisitionVoucherNo
        ? 'accounted'
        : 'pending',
    }));
  };

  const handleSubmit = async () => {
    // 部门必填校验（全局设置）
    if (requireDepartment && !formData.departmentCode && !formData.departmentName) {
      showToast('error', '请填写部门编号');
      return;
    }

    if (!formData.assetName) {
      showToast('error', '请输入资产名称');
      return;
    }
    if (!formData.originalValue || formData.originalValue <= 0) {
      showToast('error', '请输入有效的原值');
      return;
    }
    if (!formData.acquisitionDate) {
      showToast('error', '请选择购置日期');
      return;
    }
    if (!formData.categoryId) {
      showToast('error', '请选择资产分类');
      return;
    }
    if (!formData.usefulLifeYears || formData.usefulLifeYears <= 0) {
      showToast('error', '请输入有效的使用年限');
      return;
    }

    const usefulLifeMonths = (formData.usefulLifeYears || 5) * 12;
    const quantity = formData.quantity || 1;

    // 计算折旧开始日期：若用户/setup 已显式录入则优先；否则按规则从购置日期推算
    const acquisitionDate = new Date(formData.acquisitionDate);
    const category = categories.find(c => c.id === formData.categoryId);
    const isIntangible = category?.assetType === 'intangible';
    const startRule = category?.depreciationStartRule
      || (isIntangible ? 'current_month' : 'next_month');

    let depreciationStartDate: Date;
    if (formData.depreciationStartDate) {
      // 已显式录入（例如 setup 期初录入或编辑时手动指定），直接采用
      const parsed = new Date(formData.depreciationStartDate);
      if (!isNaN(parsed.getTime())) {
        depreciationStartDate = parsed;
      } else {
        depreciationStartDate = isIntangible
          ? new Date(acquisitionDate.getFullYear(), acquisitionDate.getMonth(), 1)
          : new Date(acquisitionDate.getFullYear(), acquisitionDate.getMonth() + 1, 1);
      }
    } else if (startRule === 'current_month') {
      depreciationStartDate = new Date(acquisitionDate.getFullYear(), acquisitionDate.getMonth(), 1);
    } else {
      depreciationStartDate = new Date(acquisitionDate.getFullYear(), acquisitionDate.getMonth() + 1, 1);
    }
    // 用本地日期格式化（避免 toISOString 时区错位，月初/月末会变成前一天）
    const formatLocalDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const depreciationStartStr = formatLocalDate(depreciationStartDate);

    // 计算折旧结束日期（月末）
    const depreciationEndDate = new Date(depreciationStartDate);
    depreciationEndDate.setMonth(depreciationEndDate.getMonth() + usefulLifeMonths);
    depreciationEndDate.setDate(0); // 月末
    const depreciationEndStr = formatLocalDate(depreciationEndDate);

    // 保存时重新生成编码（确保不跳号，消耗编号）
    const manager = CodeRuleManager.getInstance();
    const ruleType = isIntangible ? 'intangible_asset' : 'fixed_asset';
    const rule = manager.getRuleByType(ruleType);
    let assetCode = '';
    if (rule.autoIncrement) {
      const result = generateCode(rule, existingCodes);
      assetCode = result.code;
      manager.setRule(result.updatedRule);
    } else if (formData.assetCode) {
      assetCode = formData.assetCode;
    } else {
      showToast('error', '请输入资产编码');
      return;
    }

    // 确定入账状态：优先用表单选择，其次保留原有状态，再次按是否已生成取得凭证判断
    const accountingStatus = formData.accountingStatus
      || (asset?.accountingStatus === 'accounted'
        || asset?.acquisitionVoucherId
        || asset?.acquisitionVoucherNo
        ? 'accounted'
        : 'pending');

    try {
      const savedAsset = await onSave({
        ...formData,
        assetCode,
        usefulLifeMonths,
        quantity,
        remainingQuantity: asset?.remainingQuantity ?? quantity,
        unitPrice: (formData.originalValue || 0) / quantity,
        depreciationStartDate: depreciationStartStr,
        depreciationEndDate: depreciationEndStr,
        accountingStatus,
        isOpeningBalance: formData.acquisitionType === 'opening_balance',
        depreciatedMonths: asset?.depreciatedMonths,
        remainingDepreciationMonths: asset?.remainingDepreciationMonths,
      });

      if (!asset?.acquisitionVoucherId && formData.acquisitionType !== 'opening_balance' && formData.acquisitionType !== 'invoice') {
        showToast('success', '资产已保存，请在清单中点击"入账"生成取得凭证');
      } else {
        showToast('success', '资产已保存');
      }
    } catch (error: any) {
      showToast('error', error.message || '保存失败');
    }
  };

  // 计算折旧预览：与折旧引擎保持一致
  // 直线法: 月折旧 = (原值 - 残值 - 已折旧) / 剩余月数
  // 其中剩余月数 = 总月数 - 已过月数（从折旧开始日到当前期间）
  const initialAccDep = formData.initialAccumulatedDepreciation || 0;
  const originalValue = formData.originalValue || 0;
  const salvageValue = formData.salvageValue || 0;
  const totalMonths = (formData.usefulLifeYears || 5) * 12;
  const depreciableValue = originalValue - salvageValue;
  const remainingDepreciable = Math.max(0, depreciableValue - initialAccDep);

  // 当前期间
  const currentPeriodStr = useMemo(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const p = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (p) return `${p.year}-${String(p.month).padStart(2, '0')}`;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // 已过月数（从折旧开始日到当前期间）
  const monthsElapsed = useMemo(() => {
    if (!formData.acquisitionDate) return 0;
    const d = new Date(formData.acquisitionDate);
    const cat = categories.find(c => c.id === formData.categoryId);
    const isIntangible = cat?.assetType === 'intangible';
    const start = new Date(d.getFullYear(), d.getMonth() + (isIntangible ? 0 : 1), 1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    return calculateMonthsBetween(startStr, `${currentPeriodStr}-01`);
  }, [formData.acquisitionDate, formData.categoryId, currentPeriodStr, categories]);

  const remainingMonths = Math.max(0, totalMonths - monthsElapsed);

  // 月折旧：直线法用剩余应折旧/剩余月数；其他方法仍走原函数（基于原值）
  const monthlyDepreciation = (() => {
    const method = formData.depreciationMethod || 'straight_line';
    if (method === 'straight_line') {
      return remainingMonths > 0 ? Math.round((remainingDepreciable / remainingMonths) * 100) / 100 : 0;
    }
    return calculateEstimatedMonthlyDepreciation(
      originalValue,
      salvageValue,
      method,
      formData.usefulLifeYears || 5,
      totalMonths
    );
  })();

  const formatMoney = formatNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {asset ? '编辑资产' : '新增资产'}
            {!asset && (
              <span className="text-sm font-normal text-slate-500">
                快速录入固定资产，系统将自动计算初始折旧计划
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* SECTION 1 & 2: 核心信息 + 财务与折旧 */}
          <div className="grid grid-cols-2 gap-6">
            {/* SECTION 1: 资产核心 */}
            <div className="space-y-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                资产核心
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label required>资产名称</Label>
                  <Input
                    value={formData.assetName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, assetName: e.target.value }))}
                    placeholder="请输入资产名称"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label required>资产分类</Label>
                  <Select
                    value={formData.categoryId || ''}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类">
                        {formData.categoryId ? categories.find(c => c.id === formData.categoryId)?.name : '选择分类'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c.enabled).map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.assetType === 'intangible' ? '无形' : '固定'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>资产编码</Label>
                  <Input
                    value={formData.assetCode || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, assetCode: e.target.value }))}
                    placeholder="自动生成或手动输入"
                    className="font-mono text-sm"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>规格型号</Label>
                  <Input
                    value={formData.specification || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, specification: e.target.value }))}
                    placeholder="请输入规格型号"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>计量单位</Label>
                  <Select
                    value={formData.unit || '台'}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="台">台</SelectItem>
                      <SelectItem value="把">把</SelectItem>
                      <SelectItem value="套">套</SelectItem>
                      <SelectItem value="个">个</SelectItem>
                      <SelectItem value="辆">辆</SelectItem>
                      <SelectItem value="件">件</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>数量</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.quantity || 1}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      quantity: parseInt(e.target.value) || 1
                    }))}
                    placeholder="1"
                    autoComplete="off"
                  />
                  {/* 编辑模式显示当前数量 */}
                  {asset && formData.remainingQuantity !== undefined && formData.remainingQuantity !== formData.quantity && (
                    <p className="text-xs text-orange-600">
                      当前数量: {formData.remainingQuantity} {formData.unit}
                    </p>
                  )}
                </div>
                {/* 单价展示 */}
                <div className="space-y-1.5">
                  <Label className="text-slate-500">单价</Label>
                  <div className="px-3 py-2 bg-slate-50 border rounded text-sm text-slate-600">
                    {(formData.originalValue && formData.quantity) ? (
                      <span>
                        ¥{formatMoney(formData.originalValue / formData.quantity)}
                        <span className="text-slate-400 ml-1">/ {formData.unit || '台'}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">输入原值和数量后计算</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: 财务与折旧 */}
            <div className="space-y-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                财务与折旧
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label required>原值 (CNY)</Label>
                  <Input
                    type="number"
                    value={formData.originalValue || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      originalValue: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="0.00"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label required>使用年限（年）</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.usefulLifeYears || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      usefulLifeYears: parseInt(e.target.value) || 5
                    }))}
                    placeholder="5"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>折旧方法</Label>
                  <Select
                    value={formData.depreciationMethod || 'straight_line'}
                    onValueChange={(v) => setFormData(prev => ({
                      ...prev,
                      depreciationMethod: v as any
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">直线法</SelectItem>
                      <SelectItem value="double_declining">双倍余额递减法</SelectItem>
                      <SelectItem value="sum_of_years">年数总和法</SelectItem>
                      <SelectItem value="units_of_production">工作量法</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label required>购置日期</Label>
                  <ChineseDatePicker
                    value={formData.acquisitionDate || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, acquisitionDate: v }))}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>残值</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-400">残值率</div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={(() => {
                            const original = formData.originalValue || 0;
                            const salvage = formData.salvageValue || 0;
                            if (original > 0) {
                              return Math.round((salvage / original) * 10000) / 100;
                            }
                            return 0;
                          })()}
                          onChange={(e) => {
                            const rate = parseFloat(e.target.value) || 0;
                            const original = formData.originalValue || 0;
                            const salvage = Math.round(original * rate * 100) / 10000;
                            setFormData(prev => ({ ...prev, salvageValue: salvage }));
                          }}
                          placeholder="0"
                          autoComplete="off"
                          className="pr-7"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-400">残值金额</div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={formData.salvageValue || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            salvageValue: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="0.00"
                          autoComplete="off"
                          className="pr-7"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 折旧时间信息 */}
              {formData.acquisitionDate && formData.usefulLifeYears > 0 && (
                <div className="mt-3 p-3 bg-slate-50 border rounded-lg">
                  <div className="flex items-center gap-2 text-slate-600 text-xs font-medium mb-2">
                    <Calculator className="h-3.5 w-3.5" />
                    折旧时间
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">折旧开始</span>
                      <span className="font-medium text-slate-700">
                        {(() => {
                          const d = new Date(formData.acquisitionDate);
                          const cat = categories.find(c => c.id === formData.categoryId);
                          const isIntangible = cat?.assetType === 'intangible';
                          const startRule = cat?.depreciationStartRule
                            || (isIntangible ? 'current_month' : 'next_month');
                          // 优先用户/setup 显式录入；否则按规则从购置日期推算
                          // 用 JS Date 让 12月 → 次年1月 自动溢出（避免字符串拼接产生 13 月）
                          let start: Date;
                          if (formData.depreciationStartDate) {
                            const parsed = new Date(formData.depreciationStartDate);
                            if (!isNaN(parsed.getTime())) start = parsed;
                            else start = new Date(d.getFullYear(), d.getMonth() + (startRule === 'current_month' ? 0 : 1), 1);
                          } else {
                            start = new Date(d.getFullYear(), d.getMonth() + (startRule === 'current_month' ? 0 : 1), 1);
                          }
                          return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">折旧结束</span>
                      <span className="font-medium text-slate-700">
                        {(() => {
                          const d = new Date(formData.acquisitionDate);
                          const cat = categories.find(c => c.id === formData.categoryId);
                          const isIntangible = cat?.assetType === 'intangible';
                          const startMonthOffset = isIntangible ? 0 : 1;
                          const endDate = new Date(d.getFullYear(), d.getMonth() + startMonthOffset + (formData.usefulLifeYears || 5) * 12, 0);
                          return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">折旧月数</span>
                      <span className="font-medium">{(formData.usefulLifeYears || 0) * 12} 个月</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">已计提月份</span>
                      <span className="font-medium text-slate-500">{monthsElapsed} 个月</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">剩余月数</span>
                      <span className="font-medium text-slate-500">{remainingMonths} 个月</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">应计折旧额</span>
                      <span className="font-medium">¥{formatMoney((formData.originalValue || 0) - (formData.salvageValue || 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">已折旧（期初）</span>
                      <span className="font-medium text-slate-500">¥{formatMoney(formData.initialAccumulatedDepreciation || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">剩余应折旧</span>
                      <span className="font-medium text-blue-700">¥{formatMoney(remainingDepreciable)}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between">
                    <span className="text-blue-700 font-medium text-sm">预计月折旧额</span>
                    <span className="text-blue-700 font-bold">¥{formatMoney(monthlyDepreciation)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: 管理与物流 */}
          <div className="border-t pt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              管理与物流
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>取得方式</Label>
                <Select
                  value={formData.acquisitionType || 'purchase'}
                  onValueChange={handleAcquisitionTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">购入</SelectItem>
                    <SelectItem value="invoice">发票取得</SelectItem>
                    <SelectItem value="shareholder_input">股东投入</SelectItem>
                    <SelectItem value="surplus">盘盈</SelectItem>
                    <SelectItem value="internal_transfer">内部转入</SelectItem>
                    <SelectItem value="opening_balance">期初导入</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {asset?.acquisitionVoucherNo ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">取得凭证</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-100 text-green-700">已入账</Badge>
                    <span className="text-xs text-slate-600">
                      {asset.acquisitionVoucherNo}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">入账状态</Label>
                  <Select
                    value={formData.accountingStatus || 'pending'}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, accountingStatus: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
                          未入账
                        </span>
                      </SelectItem>
                      <SelectItem value="accounted">
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                          已入账（手工标记）
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.accountingStatus === 'pending' && (
                    <div className="text-xs text-slate-500">
                      保存后可在清单中点击"入账"生成取得凭证
                    </div>
                  )}
                </div>
              )}
              {formData.acquisitionType === 'opening_balance' && (
                <div className="space-y-1.5">
                  <Label>初始累计折旧</Label>
                  <Input
                    type="number"
                    value={formData.initialAccumulatedDepreciation || 0}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      initialAccumulatedDepreciation: parseFloat(e.target.value) || 0,
                      accumulatedDepreciation: parseFloat(e.target.value) || 0,
                    }))}
                    placeholder="0.00"
                    autoComplete="off"
                  />
                </div>
              )}
              {/* 购入/发票取得显示供应商 */}
              {(formData.acquisitionType === 'purchase' || formData.acquisitionType === 'invoice') && (
                <div className="space-y-1.5">
                  <Label>供应商</Label>
                  <SearchableSelect
                    value={formData.supplierName || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, supplierName: value }))}
                    options={supplierOptions}
                    placeholder="搜索供应商"
                    emptyText="无匹配供应商"
                  />
                </div>
              )}
              {/* 内部转入显示往来单位 */}
              {formData.acquisitionType === 'internal_transfer' && (
                <div className="space-y-1.5">
                  <Label>转入单位</Label>
                  <SearchableSelect
                    value={formData.supplierName || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, supplierName: value }))}
                    options={supplierOptions}
                    placeholder="搜索转入单位"
                    emptyText="无匹配单位"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>存放地点</Label>
                <Input
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="请输入存放地点"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>使用部门</Label>
                <SearchableSelect
                  value={formData.departmentCode || ''}
                  onChange={(value, option) => setFormData(prev => ({
                    ...prev,
                    departmentCode: value,
                    departmentName: option?.label || '',
                  }))}
                  options={departmentOptions}
                  placeholder="搜索部门"
                  emptyText="无匹配部门"
                />
              </div>
              <div className="space-y-1.5">
                <Label>项目核算</Label>
                <SearchableSelect
                  value={formData.projectName || ''}
                  onChange={(value) => setFormData(prev => ({ ...prev, projectName: value }))}
                  options={projectOptions}
                  placeholder="搜索项目"
                  emptyText="无匹配项目"
                />
              </div>
              <div className="space-y-1.5">
                <Label>序列号</Label>
                <Input
                  value={formData.serialNumber || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                  placeholder="高价值资产填写"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>使用人</Label>
                <Input
                  value={formData.assignedUser || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedUser: e.target.value }))}
                  placeholder="资产使用人"
                  autoComplete="off"
                />
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>备注</Label>
                <Input
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="请输入备注信息..."
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>保存资产</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 确认删除对话框
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="py-4 text-sm text-slate-600">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="destructive" onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FixedAssetsPage() {
  const {
    assets,
    categories,
    depreciationRecords,
    loading,
    addAsset,
    updateAsset,
    deleteAsset,
    generateAcquisitionVoucher,
    initialize,
    setFilter,
    getFilteredAssets,
    importAssetsFromExcel,
    requireDepartment,
  } = useFixedAssetStore();

  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCodeRuleDialog, setShowCodeRuleDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [showQRLabelDialog, setShowQRLabelDialog] = useState(false);
  const [showBatchLabelDialog, setShowBatchLabelDialog] = useState(false);
  const [showChangeRecordDialog, setShowChangeRecordDialog] = useState(false);
  const [showIntangibleLedger, setShowIntangibleLedger] = useState(false);
  const [selectedIntangibleAsset, setSelectedIntangibleAsset] = useState<any>(null);
  const [showDepreciationDialog, setShowDepreciationDialog] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [accountingAsset, setAccountingAsset] = useState<FixedAsset | null>(null);
  const [accountingDate, setAccountingDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`;
  });
  const [importing, setImporting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [codeRule, setCodeRule] = useState<CodeRule | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 加载编码规则
  useEffect(() => {
    const loadCodeRules = async () => {
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      if (currentAccountSet?.id) {
        const manager = CodeRuleManager.getInstance();
        await manager.loadFromDB(currentAccountSet.id);
        const rule = manager.getRuleByType('fixed_asset');
        setCodeRule(rule);
      }
    };
    loadCodeRules();
  }, [initialize]);

  // 编码规则对话框关闭后刷新
  useEffect(() => {
    if (!showCodeRuleDialog) {
      const manager = CodeRuleManager.getInstance();
      const rule = manager.getRuleByType('fixed_asset');
      setCodeRule(rule);
    }
  }, [showCodeRuleDialog]);

  // 应用筛选
  useEffect(() => {
    setFilter({
      searchQuery,
      status: statusFilter === 'all' ? undefined : statusFilter,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
    });
  }, [searchQuery, statusFilter, categoryFilter, setFilter]);

  const filteredAssets = getFilteredAssets();

  const handleSave = async (data: Partial<FixedAsset>) => {
    try {
      if (selectedAsset) {
        await updateAsset(selectedAsset.id, data);
        showToast('success', '资产更新成功');
      } else {
        const newAsset = await addAsset(data as any);
        showToast('success', '资产添加成功');
        // 保存编码规则到数据库（更新 lastNumber）
        const accountSetStore = useAccountSetStore.getState();
        const currentAccountSet = accountSetStore.getCurrentAccountSet();
        if (currentAccountSet?.id) {
          const manager = CodeRuleManager.getInstance();
          await manager.saveToDB(currentAccountSet.id);
        }
        return newAsset;
      }
      setShowAddDialog(false);
      setSelectedAsset(null);
    } catch (error: any) {
      showToast('error', error.message || '操作失败');
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;
    try {
      await deleteAsset(selectedAsset.id);
      showToast('success', '资产删除成功');
      setSelectedAsset(null);
    } catch (error: any) {
      showToast('error', error.message || '删除失败');
    }
  };

  const handleAccountAsset = (asset: FixedAsset) => {
    // 检查全局设置是否要求部门必填
    if (requireDepartment && !asset.departmentCode && !asset.departmentName) {
      showToast('error', '入账时必须填写部门编号');
      return;
    }
    // 打开入账确认对话框
    setAccountingAsset(asset);
    // 默认使用购置日期所在期间的最后一天
    if (asset.acquisitionDate) {
      const dateStr = asset.acquisitionDate.substring(0, 10);
      const [year, month] = dateStr.substring(0, 7).split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      setAccountingDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else {
      // 如果没有购置日期，使用当前账期的最后一天
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const currentPeriod = accountSet?.accountingPeriods?.find(p => p.isCurrent);
      if (currentPeriod) {
        setAccountingDate(currentPeriod.endDate);
      }
    }
    setShowAccountDialog(true);
  };

  // 入账凭证预览
  const acquisitionVoucherPreview = useMemo(() => {
    if (!accountingAsset) return null;

    const category = categories.find(c => c.id === accountingAsset.categoryId);
    const assetSubjectCode = category?.assetSubjectCode || accountingAsset.assetSubjectCode || '';
    const assetSubjectName = category?.name || accountingAsset.assetSubjectName || accountingAsset.assetName;

    const entries = getAcquisitionVoucherEntries(
      accountingAsset.acquisitionType || 'purchase',
      accountingAsset.originalValue,
      assetSubjectCode,
      assetSubjectName
    );

    if (!entries) return null;

    return {
      summary: `取得固定资产-${accountingAsset.assetName}`,
      entries: [
        {
          subjectCode: entries.debitSubject,
          subjectName: entries.debitName,
          debit: entries.amount,
          credit: 0,
        },
        {
          subjectCode: entries.creditSubject,
          subjectName: entries.creditName,
          debit: 0,
          credit: entries.amount,
        },
      ],
    };
  }, [accountingAsset, categories]);

  const handleConfirmAccount = async () => {
    if (!accountingAsset) return;

    // 校验入账日期是否在当前开放账期内
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const validation = validateAccountingPeriod(accountingDate, accountSet);
    if (!validation.valid) {
      showToast('error', validation.error!);
      return;
    }

    try {
      const result = await generateAcquisitionVoucher(accountingAsset.id, accountingDate);
      if (result) {
        showToast('success', `入账成功，取得凭证 ${result.voucherNo} 已生成`);
        setShowAccountDialog(false);
        setAccountingAsset(null);
        initialize();
        await refreshVoucherStore();
      } else {
        showToast('warning', '入账失败，请检查取得规则配置');
      }
    } catch (error: any) {
      showToast('error', error.message || '入账失败');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const handleBatchAccount = async () => {
    const pendingAssets = filteredAssets.filter(a => selectedIds.has(a.id) && a.accountingStatus === 'pending');
    if (pendingAssets.length === 0) {
      showToast('warning', '未选择可入账的资产');
      return;
    }

    // 检查全局设置是否要求部门必填
    if (requireDepartment) {
      const missingDepartment = pendingAssets.find(asset => !asset.departmentCode && !asset.departmentName);
      if (missingDepartment) {
        showToast('error', `资产 ${missingDepartment.assetCode} 需要填写部门编号`);
        return;
      }
    }

    const results = await Promise.allSettled(pendingAssets.map(a => generateAcquisitionVoucher(a.id)));
    const success = results.filter(r => r.status === 'fulfilled' && r.value).length;
    showToast('success', `批量入账完成：${success}/${pendingAssets.length} 成功`);
    setSelectedIds(new Set());
    if (success > 0) {
      await refreshVoucherStore();
    }
  };

  const handleBatchDelete = async () => {
    const pendingAssets = filteredAssets.filter(a => selectedIds.has(a.id) && a.accountingStatus === 'pending');
    if (pendingAssets.length === 0) {
      showToast('warning', '未选择可删除的资产（仅未入账状态可删除）');
      return;
    }
    const results = await Promise.allSettled(pendingAssets.map(a => deleteAsset(a.id)));
    const success = results.filter(r => r.status === 'fulfilled').length;
    showToast('success', `批量删除完成：${success}/${pendingAssets.length} 成功`);
    setSelectedIds(new Set());
  };

  // 导入处理
  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const result = await parseFixedAssetsExcel(file);

      if (result.errors.length > 0) {
        showToast('warning', `解析完成，有 ${result.errors.length} 个错误`);
      }

      // 转换解析数据并导入
      const importData = result.data.map(item => ({
        assetCode: item.assetCode || `FA-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        assetName: item.assetName!,
        categoryName: item.categoryName,
        originalValue: item.originalValue!,
        salvageValue: item.salvageValue || 0,
        depreciationMethod: (item.depreciationMethod || 'straight_line') as 'straight_line' | 'double_declining' | 'sum_of_years' | 'units_of_production',
        usefulLifeYears: item.usefulLifeYears || 5,
        usefulLifeMonths: (item.usefulLifeYears || 5) * 12,
        acquisitionDate: item.acquisitionDate!,
        departmentCode: item.departmentCode,
        notes: item.notes,
      }));

      const importResult = await importAssetsFromExcel(importData);
      showToast('success', `成功导入 ${importResult.success} 条资产${importResult.errors.length > 0 ? `，${importResult.errors.length} 条失败` : ''}`);
      setShowImportDialog(false);
    } catch (error: any) {
      showToast('error', error.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 导出处理
  const handleExport = () => {
    if (filteredAssets.length === 0) {
      showToast('warning', '没有可导出的数据');
      return;
    }
    exportFixedAssetsToExcel(filteredAssets);
    showToast('success', `成功导出 ${filteredAssets.length} 条资产`);
  };

  // 下载导入模板
  const handleDownloadTemplate = () => {
    generateAssetImportTemplate('fixed');
    showToast('success', '模板下载成功');
  };

  const getStatusBadge = (status: string, accountingStatus?: string) => {
    // 优先显示入账状态
    if (accountingStatus === 'pending') {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-700">未入账</Badge>;
    }

    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: '在用', variant: 'default' },
      disposed: { label: '已处置', variant: 'secondary' },
      fully_depreciated: { label: '已提足', variant: 'outline' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatMoney = formatNumber;

  // 统计数据
  const totalOriginalValue = assets.reduce((sum, a) => sum + (a.originalValue ?? 0), 0);
  const totalDepreciation = assets.reduce((sum, a) => sum + (a.accumulatedDepreciation ?? 0), 0);
  const totalNetValue = assets.reduce((sum, a) => sum + (a.netValue ?? 0), 0);
  const activeCount = assets.filter(a => a.status === 'active').length;

  // 本月折旧统计 - 基于当前账期而非系统日期
  const currentPeriod = useMemo(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) {
      return `${currentPeriodData.year}-${String(currentPeriodData.month).padStart(2, '0')}`;
    }
    // 回退到系统日期
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [assets]); // 依赖 assets 变化时重新计算（账套切换时 assets 会变化

  const depreciationStats = useMemo(() => {
    const activeAssets = assets.filter(a => a.status === 'active');
    const depreciatedIdsThisMonth = new Set(
      depreciationRecords
        .filter(r => r.period === currentPeriod && r.status !== 'draft')
        .map(r => r.assetId)
    );

    // 创建分类Map避免重复查找
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    let toDepreciate = 0;  // 待计提
    let depreciated = 0;   // 已计提
    let notRequired = 0;   // 无需计提（已提足或本月新增按规则不计提）

    activeAssets.forEach(asset => {
      if (depreciatedIdsThisMonth.has(asset.id)) {
        depreciated++;
      } else {
        // 检查是否已提足折旧
        const originalValue = asset.originalValue ?? 0;
        const salvageValue = asset.salvageValue ?? 0;
        const accumulatedDepreciation = asset.accumulatedDepreciation ?? 0;
        const depreciableValue = originalValue - salvageValue;

        if (accumulatedDepreciation >= depreciableValue) {
          notRequired++;
        } else {
          // 检查购置月份与当前账期的关系
          const acquisitionMonth = getAssetDatePeriod(asset.acquisitionDate);

          // 购置月份在当前账期之后，资产在当前账期还不存在
          if (acquisitionMonth && acquisitionMonth > currentPeriod) {
            notRequired++;
            return;
          }

          // 检查折旧起始规则
          const category = categoryMap.get(asset.categoryId || '');
          const rule = category?.depreciationStartRule || getDepreciationStartRule(category?.assetType || 'fixed');

          if (rule === 'next_month' && acquisitionMonth === currentPeriod) {
            // 固定资产规则：当月新增不计提
            notRequired++;
          } else {
            toDepreciate++;
          }
        }
      }
    });

    return { toDepreciate, depreciated, notRequired };
  }, [assets, depreciationRecords, categories, currentPeriod]);

  // 本月折旧金额统计
  const monthlyDepreciationAmounts = useMemo(() => {
    const activeAssets = assets.filter(a => a.status === 'active');
    const depreciatedRecordsThisMonth = depreciationRecords.filter(
      r => r.period === currentPeriod && r.status !== 'draft'
    );

    // 本月已提折旧金额
    const depreciatedAmount = depreciatedRecordsThisMonth.reduce((sum, r) => sum + r.periodDepreciation, 0);

    // 创建分类Map避免重复查找
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    // 计算本月应提折旧金额
    let shouldDepreciateAmount = 0;
    activeAssets.forEach(asset => {
      // 检查是否已提足折旧
      const originalValue = asset.originalValue ?? 0;
      const salvageValue = asset.salvageValue ?? 0;
      const accumulatedDepreciation = asset.accumulatedDepreciation ?? 0;
      const depreciableValue = originalValue - salvageValue;

      if (accumulatedDepreciation < depreciableValue) {
        // 检查入账日期
        const acquisitionAccountingMonth = getAssetDatePeriod(asset.acquisitionAccountingDate);
        const acquisitionMonth = acquisitionAccountingMonth || getAssetDatePeriod(asset.acquisitionDate);

        // 入账月份在当前账期之后，不计提
        if (acquisitionMonth && acquisitionMonth > currentPeriod) {
          return;
        }

        // 检查折旧起始规则
        const category = categoryMap.get(asset.categoryId || '');
        const rule = category?.depreciationStartRule || getDepreciationStartRule(category?.assetType || 'fixed');

        // 本月入账且规则是下月计提（固定资产），不计提
        if (rule === 'next_month' && acquisitionMonth === currentPeriod) {
          return;
        }

        // 计算月折旧额
        const monthlyDep = calculateEstimatedMonthlyDepreciation(
          originalValue,
          salvageValue,
          asset.depreciationMethod || 'straight_line',
          asset.usefulLifeYears || 5,
          (asset.usefulLifeYears || 5) * 12
        );
        shouldDepreciateAmount += monthlyDep;
      }
    });

    // 本月未提折旧金额
    const notDepreciatedAmount = Math.max(0, shouldDepreciateAmount - depreciatedAmount);

    return {
      shouldDepreciate: shouldDepreciateAmount,
      depreciated: depreciatedAmount,
      notDepreciated: notDepreciatedAmount,
    };
  }, [assets, depreciationRecords, categories, currentPeriod]);

  // 获取单个资产的本月折旧状态
  const getAssetDepreciationStatus = (asset: FixedAsset): 'depreciated' | 'to_depreciate' | 'not_required' => {
    const depreciatedThisMonth = depreciationRecords.find(
      r => r.assetId === asset.id && r.period === currentPeriod && r.status !== 'draft'
    );
    if (depreciatedThisMonth) return 'depreciated';

    // 检查是否已提足折旧
    const originalValue = asset.originalValue ?? 0;
    const salvageValue = asset.salvageValue ?? 0;
    const accumulatedDepreciation = asset.accumulatedDepreciation ?? 0;
    const depreciableValue = originalValue - salvageValue;

    if (accumulatedDepreciation >= depreciableValue) return 'not_required';

    // 使用入账日期来判断是否本月入账（而非购置日期）
    const acquisitionAccountingMonth = getAssetDatePeriod(asset.acquisitionAccountingDate);
    const acquisitionMonth = acquisitionAccountingMonth || getAssetDatePeriod(asset.acquisitionDate);

    // 入账月份在当前账期之后，资产在当前账期还不存在
    if (acquisitionMonth && acquisitionMonth > currentPeriod) {
      return 'not_required';
    }

    // 检查折旧起始规则
    const category = categories.find(c => c.id === asset.categoryId);
    const rule = category?.depreciationStartRule || getDepreciationStartRule(category?.assetType || 'fixed');

    // 本月入账的资产
    if (acquisitionMonth === currentPeriod) {
      // 固定资产规则：当月入账，下月开始计提
      if (rule === 'next_month') {
        return 'not_required';
      }
      // 无形资产规则：当月入账，当月开始摊销
      // rule === 'current_month' → 需要计提
    }

    // 入账月份在当前账期之前，本月应该计提
    return 'to_depreciate';
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            固定资产管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">管理企业固定资产卡片和折旧</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button variant="outline" size="sm" className="text-green-600" onClick={handleBatchAccount}>
                <BookOpen className="h-4 w-4 mr-2" />
                批量入账 ({selectedIds.size})
              </Button>
              <Button variant="outline" size="sm" className="text-red-600" onClick={handleBatchDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                批量删除 ({selectedIds.size})
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowCategoryDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            核算规则
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDepreciationDialog(true)}>
            <Calculator className="h-4 w-4 mr-2" />
            折旧计算
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowBatchLabelDialog(true)}>
            <Printer className="h-4 w-4 mr-2" />
            批量打印标签
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCodeRuleDialog(true)}>
            <QrCode className="h-4 w-4 mr-2" />
            编码设置
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            导入
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button onClick={() => {
            setSelectedAsset(null);
            setShowAddDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            新增资产
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-5 gap-4">
        {/* 资产数量卡片（合并折旧状态） */}
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">资产数量</div>
            <div className="text-2xl font-bold">{assets.length} <span className="text-sm font-normal text-slate-400">在用 {activeCount}</span></div>
            <div className="flex items-center gap-3 mt-2 pt-2 border-t">
              <div className="text-center">
                <div className="text-sm font-bold text-yellow-700">{depreciationStats.toDepreciate}</div>
                <div className="text-xs text-yellow-600">待计提</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-green-600">{depreciationStats.depreciated}</div>
                <div className="text-xs text-slate-500">已计提</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-slate-400">{depreciationStats.notRequired}</div>
                <div className="text-xs text-slate-400">无需计提</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">原值合计</div>
            <div className="text-2xl font-bold">¥{formatMoney(totalOriginalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">累计折旧</div>
            <div className="text-2xl font-bold text-orange-600">¥{formatMoney(totalDepreciation)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">净值合计</div>
            <div className="text-2xl font-bold text-blue-600">¥{formatMoney(totalNetValue)}</div>
          </CardContent>
        </Card>
        {/* 本月折旧金额卡片 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="text-sm text-blue-700">本月折旧金额</div>
            <div className="flex items-center gap-4 mt-1">
              <div>
                <div className="text-xs text-blue-600">应提</div>
                <div className="text-lg font-bold text-blue-800">¥{formatMoney(monthlyDepreciationAmounts.shouldDepreciate)}</div>
              </div>
              <div>
                <div className="text-xs text-green-600">已提</div>
                <div className="text-lg font-bold text-green-700">¥{formatMoney(monthlyDepreciationAmounts.depreciated)}</div>
              </div>
              <div>
                <div className="text-xs text-orange-600">未提</div>
                <div className="text-lg font-bold text-orange-700">¥{formatMoney(monthlyDepreciationAmounts.notDepreciated)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索资产编码或名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">在用</SelectItem>
                <SelectItem value="disposed">已处置</SelectItem>
                <SelectItem value="fully_depreciated">已提足</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 资产列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="w-10 p-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredAssets.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="text-left p-4 font-medium text-sm">资产编码</th>
                  <th className="text-left p-4 font-medium text-sm">资产名称</th>
                  <th className="text-left p-4 font-medium text-sm">类型</th>
                  <th className="text-center p-4 font-medium text-sm">数量</th>
                  <th className="text-right p-4 font-medium text-sm">原值</th>
                  <th className="text-right p-4 font-medium text-sm">累计折旧</th>
                  <th className="text-right p-4 font-medium text-sm">净值</th>
                  <th className="text-center p-4 font-medium text-sm">本月折旧</th>
                  <th className="text-center p-4 font-medium text-sm">剩余月份</th>
                  <th className="text-left p-4 font-medium text-sm">状态</th>
                  <th className="text-center p-4 font-medium text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="text-center p-8 text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center p-8 text-slate-500">
                      暂无资产数据
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    // 计算剩余折旧月份：从折旧开始日期到当前期间动态算
                    const totalMonths = asset.usefulLifeMonths ?? (asset.usefulLifeYears ?? 5) * 12;
                    const depreciated = (() => {
                      if (asset.depreciationStartDate) {
                        const start = new Date(asset.depreciationStartDate);
                        const [y, m] = currentPeriod.split('-').map(Number);
                        // 当前期间相对折旧开始已过的整月数（含本月）
                        const monthsPassed = (y * 12 + (m - 1)) - (start.getFullYear() * 12 + start.getMonth());
                        return Math.max(0, Math.min(totalMonths, monthsPassed));
                      }
                      return asset.depreciatedMonths ?? 0;
                    })();
                    const remainingMonths = asset.status !== 'active' ? '-' : Math.max(0, totalMonths - depreciated);

                    return (
                    <tr key={asset.id} className="border-b hover:bg-slate-50">
                      <td className="w-10 p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(asset.id)}
                          onChange={() => toggleSelect(asset.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="p-4 text-sm font-mono">{asset.assetCode}</td>
                      <td className="p-4 text-sm font-medium">{asset.assetName}</td>
                      <td className="p-4 text-sm text-slate-600">{asset.categoryName || '-'}</td>
                      <td className="p-4 text-sm text-center">
                        {asset.remainingQuantity !== undefined && asset.remainingQuantity < (asset.quantity || 1) ? (
                          <span className="text-orange-600">
                            {asset.remainingQuantity}/{asset.quantity || 1}{asset.unit || '台'}
                          </span>
                        ) : (
                          <span>
                            {asset.quantity || 1}{asset.unit || '台'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-right">¥{formatMoney(asset.originalValue)}</td>
                      <td className="p-4 text-sm text-right text-orange-600">¥{formatMoney(asset.accumulatedDepreciation)}</td>
                      <td className="p-4 text-sm text-right font-medium">¥{formatMoney(asset.netValue)}</td>
                      <td className="p-4 text-sm text-center">
                        {(() => {
                          const depStatus = getAssetDepreciationStatus(asset);
                          if (depStatus === 'depreciated') {
                            return <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">已计提</Badge>;
                          } else if (depStatus === 'to_depreciate') {
                            return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 text-xs">待计提</Badge>;
                          } else {
                            return <Badge variant="outline" className="bg-slate-100 text-slate-500 text-xs">无需</Badge>;
                          }
                        })()}
                      </td>
                      <td className="p-4 text-sm text-center">
                        {typeof remainingMonths === 'number' ? (
                          <span className={remainingMonths <= 12 ? 'text-orange-600' : 'text-slate-600'}>
                            {remainingMonths}月
                          </span>
                        ) : remainingMonths}
                      </td>
                      <td className="p-4">{getStatusBadge(asset.status, asset.accountingStatus)}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="编辑"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowAddDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {asset.accountingStatus === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="入账取得成本"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleAccountAsset(asset)}
                            >
                              <BookOpen className="h-4 w-4" />
                            </Button>
                          )}
                          {asset.status === 'active' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="变动"
                                className="text-blue-500 hover:text-blue-700"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowChangeDialog(true);
                                }}
                              >
                                <TrendingUp className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="标签"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowQRLabelDialog(true);
                            }}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={categories.find(c => c.id === asset.categoryId)?.assetType === 'intangible' ? '时序账' : '变动记录'}
                            onClick={() => {
                              const isIntangible = categories.find(c => c.id === asset.categoryId)?.assetType === 'intangible';
                              if (isIntangible) {
                                setSelectedIntangibleAsset(asset);
                                setShowIntangibleLedger(true);
                              } else {
                                setSelectedAsset(asset);
                                setShowChangeRecordDialog(true);
                              }
                            }}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          {asset.accountingStatus === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              title="删除"
                              onClick={() => {
                                setSelectedAsset(asset);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 资产卡片对话框 */}
      <AssetCardDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        asset={selectedAsset}
        categories={categories}
        existingCodes={assets.map(a => a.assetCode).filter(Boolean)}
        onSave={handleSave}
        requireDepartment={requireDepartment}
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认删除"
        message={`确定要删除资产 "${selectedAsset?.assetName}" 吗？此操作不可撤销。`}
        onConfirm={handleDelete}
      />

      {/* 导入对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>导入固定资产</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-slate-600">
              请上传包含固定资产数据的 Excel 文件。文件格式要求：
              <ul className="list-disc list-inside mt-2 text-xs">
                <li>资产编码、资产名称、原值、购置日期为必填</li>
                <li>折旧方法可选：直线法、双倍余额递减法、年数总和法、工作量法</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                下载导入模板
              </Button>
            </div>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImport(file);
                  }
                }}
                className="hidden"
                id="import-file"
                disabled={importing}
              />
              <label
                htmlFor="import-file"
                className={`cursor-pointer ${importing ? 'opacity-50' : ''}`}
              >
                <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">
                  {importing ? '正在导入...' : '点击选择文件或拖拽文件到此处'}
                </p>
                <p className="text-xs text-slate-400 mt-1">支持 .xlsx, .xls 格式</p>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量打印标签对话框 */}
      <AssetQRLabelBatch
        assets={assets.filter(a => a.status === 'active')}
        trigger={null}
        open={showBatchLabelDialog}
        onOpenChange={setShowBatchLabelDialog}
      />

      {/* 入账确认对话框 */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>确认入账</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {accountingAsset && (
              <>
                <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">资产编码</span>
                    <span className="font-mono">{accountingAsset.assetCode}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">资产名称</span>
                    <span className="font-medium">{accountingAsset.assetName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">原值</span>
                    <span className="font-medium">¥{formatMoney(accountingAsset.originalValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">购置日期</span>
                    <span>{accountingAsset.acquisitionDate}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label required>入账日期</Label>
                  <ChineseDatePicker
                    value={accountingDate}
                    onChange={setAccountingDate}
                  />
                  <p className="text-xs text-slate-500">
                    凭证将使用此日期生成，请确认是否入账到当前账期
                  </p>
                </div>

                {/* 凭证预览 */}
                {acquisitionVoucherPreview && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-3 py-2 border-b flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">凭证预览</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium">科目</th>
                          <th className="text-right p-2 font-medium w-24">借方</th>
                          <th className="text-right p-2 font-medium w-24">贷方</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acquisitionVoucherPreview.entries.map((entry, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            <td className="p-2">
                              <span className="font-mono text-xs text-slate-500">{entry.subjectCode}</span>
                              <span className="ml-1">{entry.subjectName}</span>
                            </td>
                            <td className="p-2 text-right">
                              {entry.debit > 0 ? `¥${formatMoney(entry.debit)}` : ''}
                            </td>
                            <td className="p-2 text-right">
                              {entry.credit > 0 ? `¥${formatMoney(entry.credit)}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      摘要: {acquisitionVoucherPreview.summary}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccountDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmAccount}>
              <BookOpen className="h-4 w-4 mr-2" />
              确认入账
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 核算规则设置对话框 */}
      <AssetCategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
      />

      {/* 编码规则设置对话框 */}
      <AssetCodeRuleDialog
        open={showCodeRuleDialog}
        onOpenChange={setShowCodeRuleDialog}
        defaultType="fixed_asset"
        existingCodes={{
          fixed_asset: assets.map(a => a.assetCode).filter(Boolean),
          intangible_asset: [],
          prepaid_expense: [],
        }}
        onSave={() => {
          const manager = CodeRuleManager.getInstance();
          setCodeRule(manager.getRuleByType('fixed_asset'));
        }}
      />

      {/* 资产变动对话框（含增值、减值、重组、处置） */}
      <AssetChangeDialog
        asset={selectedAsset}
        open={showChangeDialog}
        onOpenChange={setShowChangeDialog}
        onSuccess={() => {
          initialize();
          setSelectedAsset(null);
        }}
      />

      {/* QR标签对话框 - 支持打印 */}
      <Dialog open={showQRLabelDialog} onOpenChange={setShowQRLabelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>资产标签</DialogTitle>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white border rounded-lg">
                <AssetQRLabel
                  asset={selectedAsset}
                  showBatch={selectedAsset.quantity > 1}
                  batchIndex={1}
                />
              </div>
              <div className="flex justify-end gap-2">
                <AssetQRLabelPrint asset={selectedAsset} showBatch={selectedAsset.quantity > 1} trigger={
                  <Button variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    打印标签
                  </Button>
                } />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 时序账对话框 */}
      <AssetTimelineLedger
        open={showChangeRecordDialog}
        onOpenChange={setShowChangeRecordDialog}
        assetId={selectedAsset?.id}
      />

      {/* 无形资产时序账 */}
      <IntangibleTimelineLedger
        open={showIntangibleLedger}
        onOpenChange={setShowIntangibleLedger}
        assetId={selectedIntangibleAsset?.id}
      />

      {/* 折旧计算对话框 */}
      <DepreciationDialog
        open={showDepreciationDialog}
        onOpenChange={setShowDepreciationDialog}
        categories={categories}
      />
    </div>
  );
}
