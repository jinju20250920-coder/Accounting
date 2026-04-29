'use client';

import { useState, useEffect } from 'react';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
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
  AlertTriangle,
  Printer,
  Calculator,
  FileText,
  BookOpen,
} from 'lucide-react';
import { AssetCodeRuleDialog } from '@/components/asset-code-rule-dialog';
import { AssetCategoryDialog } from '@/components/assets/asset-category-dialog';
import { CodeRuleManager, generateCode, type CodeRule } from '@/lib/code-generator';
import { AssetQRLabel, AssetQRLabelPrint, AssetQRLabelBatch } from '@/components/assets/asset-qr-label';
import { AssetDisposalDialog } from '@/components/assets/asset-disposal-dialog';
import { AssetChangeDialog } from '@/components/assets/asset-improvement-dialog';
import { AssetTimelineLedger } from '@/components/assets/asset-change-record-list';
import { parseFixedAssetsExcel, exportFixedAssetsToExcel, generateAssetImportTemplate } from '@/lib/excel-utils';
import { getDepreciationMethodName, calculateEstimatedMonthlyDepreciation } from '@/lib/depreciation';
import type { FixedAsset, AssetCategory } from '@/types';

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

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
  }, [asset, open, existingCodes]);

  // 当选择分类时，自动填充默认值
  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      setFormData(prev => ({
        ...prev,
        categoryId,
        categoryName: category.name,
        usefulLifeYears: category.defaultUsefulLifeYears,
        depreciationMethod: category.defaultDepreciationMethod,
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
      accountingStatus: asset?.acquisitionVoucherId || asset?.acquisitionVoucherNo
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

    // 计算折旧开始日期（取得日期下月1日）
    const acquisitionDate = new Date(formData.acquisitionDate);
    const depreciationStartDate = new Date(acquisitionDate.getFullYear(), acquisitionDate.getMonth() + 1, 1);
    const depreciationStartStr = depreciationStartDate.toISOString().split('T')[0];

    // 计算折旧结束日期
    const depreciationEndDate = new Date(depreciationStartDate);
    depreciationEndDate.setMonth(depreciationEndDate.getMonth() + usefulLifeMonths);
    depreciationEndDate.setDate(0); // 月末
    const depreciationEndStr = depreciationEndDate.toISOString().split('T')[0];

    // 保存时重新生成编码（确保不跳号，消耗编号）
    const manager = CodeRuleManager.getInstance();
    const rule = manager.getRuleByType('fixed_asset');
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

    // 确定入账状态：已入账的资产保持已入账状态，新增资产为待入账
    const accountingStatus = asset?.acquisitionVoucherId || asset?.acquisitionVoucherNo
      ? 'accounted'
      : 'pending';

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

  // 计算折旧预览
  const monthlyDepreciation = calculateEstimatedMonthlyDepreciation(
    formData.originalValue || 0,
    formData.salvageValue || 0,
    formData.depreciationMethod || 'straight_line',
    formData.usefulLifeYears || 5,
    (formData.usefulLifeYears || 5) * 12
  );

  const formatMoney = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '0.00';
    return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c.enabled).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                  <Label>残值</Label>
                  <Input
                    type="number"
                    value={formData.salvageValue || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      salvageValue: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="0.00"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label required>购置日期</Label>
                  <ChineseDatePicker
                    value={formData.acquisitionDate || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, acquisitionDate: v }))}
                  />
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
                          return `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2, '0')}-01`;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">折旧结束</span>
                      <span className="font-medium text-slate-700">
                        {(() => {
                          const d = new Date(formData.acquisitionDate);
                          const endDate = new Date(d.getFullYear(), d.getMonth() + 1 + (formData.usefulLifeYears || 5) * 12, 0);
                          return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">折旧月数</span>
                      <span className="font-medium">{(formData.usefulLifeYears || 0) * 12} 个月</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">应计折旧额</span>
                      <span className="font-medium">¥{formatMoney((formData.originalValue || 0) - (formData.salvageValue || 0))}</span>
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
              {formData.acquisitionType !== 'opening_balance' && formData.acquisitionType !== 'invoice' && !asset?.acquisitionVoucherId && (
                <div className="space-y-1.5">
                  <Label className="text-xs">入账状态</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700">未入账</Badge>
                    <span className="text-xs text-slate-500">
                      保存后需在清单中点击"入账"生成取得凭证
                    </span>
                  </div>
                </div>
              )}
              {asset?.acquisitionVoucherNo && (
                <div className="space-y-1.5">
                  <Label className="text-xs">取得凭证</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-100 text-green-700">已入账</Badge>
                    <span className="text-xs text-slate-600">
                      {asset.acquisitionVoucherNo}
                    </span>
                  </div>
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
                  <Input
                    value={formData.supplierName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                    placeholder="请输入供应商"
                    autoComplete="off"
                  />
                </div>
              )}
              {/* 内部转入显示往来单位 */}
              {formData.acquisitionType === 'internal_transfer' && (
                <div className="space-y-1.5">
                  <Label>转入单位</Label>
                  <Input
                    value={formData.supplierName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                    placeholder="请输入转入单位"
                    autoComplete="off"
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
                <Input
                  value={formData.departmentName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, departmentName: e.target.value }))}
                  placeholder="请输入使用部门"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>项目核算</Label>
                <Input
                  value={formData.projectName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                  placeholder="请输入项目名称"
                  autoComplete="off"
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
  const [showDisposalDialog, setShowDisposalDialog] = useState(false);
  const [showImprovementDialog, setShowImprovementDialog] = useState(false);
  const [showQRLabelDialog, setShowQRLabelDialog] = useState(false);
  const [showBatchLabelDialog, setShowBatchLabelDialog] = useState(false);
  const [showChangeRecordDialog, setShowChangeRecordDialog] = useState(false);
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

  const handleAccountAsset = async (asset: FixedAsset) => {
    // 检查全局设置是否要求部门必填
    if (requireDepartment && !asset.departmentCode && !asset.departmentName) {
      showToast('error', '入账时必须填写部门编号');
      return;
    }

    try {
      const result = await generateAcquisitionVoucher(asset.id);
      if (result) {
        showToast('success', `入账成功，取得凭证 ${result.voucherNo} 已生成`);
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
        expenseSubjectCode: item.expenseSubjectCode || '660204',
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

  const formatMoney = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00';
    return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 统计数据
  const totalOriginalValue = assets.reduce((sum, a) => sum + a.originalValue, 0);
  const totalDepreciation = assets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);
  const totalNetValue = assets.reduce((sum, a) => sum + a.netValue, 0);
  const activeCount = assets.filter(a => a.status === 'active').length;

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
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">资产数量</div>
            <div className="text-2xl font-bold">{assets.length} <span className="text-sm font-normal text-slate-400">在用 {activeCount}</span></div>
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
                  <th className="text-center p-4 font-medium text-sm">剩余月份</th>
                  <th className="text-left p-4 font-medium text-sm">状态</th>
                  <th className="text-center p-4 font-medium text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="text-center p-8 text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center p-8 text-slate-500">
                      暂无资产数据
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    // 计算剩余折旧月份
                    const totalMonths = asset.usefulLifeMonths ?? (asset.usefulLifeYears ?? 5) * 12;
                    const depreciated = asset.depreciatedMonths ?? 0;
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
                                title="改造"
                                className="text-blue-500 hover:text-blue-700"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowImprovementDialog(true);
                                }}
                              >
                                <TrendingUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="处置"
                                className="text-amber-500 hover:text-amber-700"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowDisposalDialog(true);
                                }}
                              >
                                <AlertTriangle className="h-4 w-4" />
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
                            title="变动记录"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowChangeRecordDialog(true);
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

      {/* 资产处置对话框 */}
      <AssetDisposalDialog
        asset={selectedAsset}
        open={showDisposalDialog}
        onOpenChange={setShowDisposalDialog}
        onSuccess={() => {
          initialize();
          setSelectedAsset(null);
        }}
      />

      {/* 资产改造对话框 */}
      <AssetChangeDialog
        asset={selectedAsset}
        open={showImprovementDialog}
        onOpenChange={setShowImprovementDialog}
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
                <div className="flex items-center gap-4 p-3 border-2 border-dashed border-slate-300 rounded">
                  <AssetQRLabel asset={selectedAsset} size={100} showBatch={selectedAsset.quantity > 1} />
                  <div className="text-sm space-y-1">
                    <div className="font-bold text-slate-900">
                      {selectedAsset.quantity > 1
                        ? `${selectedAsset.assetCode} 1/${selectedAsset.quantity}`
                        : selectedAsset.assetCode}
                    </div>
                    <div className="text-slate-700">{selectedAsset.assetName}</div>
                    {selectedAsset.specification && (
                      <div className="text-slate-500 text-xs">规格: {selectedAsset.specification}</div>
                    )}
                    <div className="text-slate-500 text-xs">入账: {selectedAsset.acquisitionDate}</div>
                    {selectedAsset.quantity > 1 && (
                      <div className="text-slate-500 text-xs">
                        数量: {selectedAsset.quantity}{selectedAsset.unit || '台'}
                      </div>
                    )}
                    {selectedAsset.departmentName && (
                      <div className="text-slate-500 text-xs">部门: {selectedAsset.departmentName}</div>
                    )}
                    {selectedAsset.assignedUser && (
                      <div className="text-slate-500 text-xs">使用人: {selectedAsset.assignedUser}</div>
                    )}
                  </div>
                </div>
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
    </div>
  );
}
