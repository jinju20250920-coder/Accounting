'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Plus,
  Trash2,
  Upload,
  Download,
} from 'lucide-react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';
import { importFromExcel, exportTemplate } from '@/lib/excel-utils';

interface SetupStepFixedAssetsProps {
  accountSetId: string;
}

interface AssetRow {
  assetName: string;
  categoryName: string;
  originalValue: number;
  accumulatedDepreciation: number;
  acquisitionDate: string;
  depreciationMethod: string;
  usefulLifeYears: number;
}

const ASSET_IMPORT_HEADERS = [
  { key: 'assetName' as const, label: '资产名称', required: true },
  { key: 'categoryName' as const, label: '分类', required: false },
  { key: 'originalValue' as const, label: '原值', required: true },
  { key: 'accumulatedDepreciation' as const, label: '累计折旧', required: false },
  { key: 'acquisitionDate' as const, label: '购置日期', required: false },
  { key: 'depreciationMethod' as const, label: '折旧方法', required: false },
  { key: 'usefulLifeYears' as const, label: '使用年限', required: false },
];

const DEPRECIATION_METHODS = [
  { value: 'straight-line', label: '直线法' },
  { value: 'double-declining', label: '双倍余额递减法' },
  { value: 'sum-of-years', label: '年数总和法' },
  { value: 'units-of-production', label: '工作量法' },
];

export function SetupStepFixedAssets({ accountSetId }: SetupStepFixedAssetsProps) {
  const { showToast } = useToast();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form state for inline add
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newValue, setNewValue] = useState<number>(0);
  const [newDep, setNewDep] = useState<number>(0);
  const [newDate, setNewDate] = useState('');
  const [newMethod, setNewMethod] = useState('straight-line');
  const [newYears, setNewYears] = useState<number>(10);

  useEffect(() => {
    if (sqliteService.accountSetId !== accountSetId) {
      sqliteService.setAccountSetId(accountSetId);
    }
  }, [accountSetId]);

  const totalOriginal = assets.reduce((s, a) => s + a.originalValue, 0);
  const totalDepreciation = assets.reduce((s, a) => s + a.accumulatedDepreciation, 0);

  const handleAdd = () => {
    if (!newName.trim() || newValue <= 0) {
      showToast('warning', '请填写资产名称和原值');
      return;
    }

    setAssets(prev => [...prev, {
      assetName: newName.trim(),
      categoryName: newCategory.trim(),
      originalValue: newValue,
      accumulatedDepreciation: newDep,
      acquisitionDate: newDate,
      depreciationMethod: newMethod,
      usefulLifeYears: newYears,
    }]);

    setNewName('');
    setNewCategory('');
    setNewValue(0);
    setNewDep(0);
    setNewDate('');
    setNewMethod('straight-line');
    setNewYears(10);
  };

  const removeAsset = (index: number) => {
    setAssets(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel<AssetRow>(file, ASSET_IMPORT_HEADERS);
      const newAssets: AssetRow[] = [];
      let skipped = 0;

      for (const row of rawData) {
        if (!row.assetName || !row.originalValue) { skipped++; continue; }
        newAssets.push({
          assetName: String(row.assetName).trim(),
          categoryName: String(row.categoryName || '').trim(),
          originalValue: Math.round(Number(row.originalValue) * 100) / 100,
          accumulatedDepreciation: Math.round(Number(row.accumulatedDepreciation || 0) * 100) / 100,
          acquisitionDate: String(row.acquisitionDate || '').trim(),
          depreciationMethod: String(row.depreciationMethod || 'straight-line').trim(),
          usefulLifeYears: Number(row.usefulLifeYears) || 10,
        });
      }

      if (newAssets.length > 0) setAssets(prev => [...prev, ...newAssets]);
      if (skipped > 0) showToast('warning', `导入 ${newAssets.length} 条，跳过 ${skipped} 条`);
      else if (newAssets.length > 0) showToast('success', `成功导入 ${newAssets.length} 条固定资产`);
      else showToast('warning', '未找到有效数据');
    } catch (error: any) {
      showToast('error', `导入失败：${error.message}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    exportTemplate<AssetRow>(
      '固定资产导入模板',
      { assetName: '办公电脑', categoryName: '电子设备', originalValue: 10000, accumulatedDepreciation: 2000, acquisitionDate: '2025-01-01', depreciationMethod: '直线法', usefulLifeYears: 5 },
      ASSET_IMPORT_HEADERS
    );
  };

  const handleSave = async () => {
    if (assets.length === 0) {
      showToast('warning', '暂无资产数据');
      return;
    }

    setSaving(true);
    try {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const voucherDate = accountSet?.enableDate ? `${accountSet.enableDate}-01` : new Date().toISOString().substring(0, 10);
      const now = new Date().toISOString();

      for (const [idx, e] of assets.entries()) {
        const usefulLifeMonths = e.usefulLifeYears * 12;
        const salvageValue = Math.round(e.originalValue * 0.05 * 100) / 100;

        await sqliteService.saveFixedAsset({
          assetCode: `FA${String(idx + 1).padStart(4, '0')}`,
          assetName: e.assetName,
          categoryName: e.categoryName || '通用设备',
          unit: '台',
          quantity: 1,
          remainingQuantity: 1,
          unitPrice: e.originalValue,
          originalValue: e.originalValue,
          salvageValue,
          depreciableValue: Math.round((e.originalValue - salvageValue) * 100) / 100,
          accumulatedDepreciation: e.accumulatedDepreciation,
          netValue: Math.round((e.originalValue - e.accumulatedDepreciation) * 100) / 100,
          depreciationMethod: e.depreciationMethod || 'straight-line',
          usefulLifeYears: e.usefulLifeYears,
          usefulLifeMonths,
          remainingDepreciationMonths: usefulLifeMonths,
          acquisitionDate: e.acquisitionDate || voucherDate,
          status: 'active',
          accountingStatus: 'accounted',
          acquisitionType: 'opening_balance',
          isOpeningBalance: true,
          initialAccumulatedDepreciation: e.accumulatedDepreciation,
          createTime: now,
          updateTime: now,
        });
      }

      showToast('success', `已保存 ${assets.length} 条固定资产卡片`);
    } catch (error: any) {
      showToast('error', `保存失败：${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">固定资产卡片</h2>
        <p className="text-sm text-slate-500 mt-1">
          录入期初固定资产卡片信息。保存后自动创建资产卡片
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
        <div className="flex-1 text-center">
          <p className="text-sm text-slate-500">原值合计</p>
          <p className="text-lg font-semibold text-slate-900">{totalOriginal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-sm text-slate-500">累计折旧</p>
          <p className="text-lg font-semibold text-slate-600">{totalDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-sm text-slate-500">净值合计</p>
          <p className="text-lg font-semibold text-blue-700">{(totalOriginal - totalDepreciation).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="text-sm text-slate-400">{assets.length} 条</div>
      </div>

      {/* Inline add */}
      <div className="border rounded-lg p-4 bg-slate-50">
        <Label className="text-sm font-medium mb-3 block">新增资产</Label>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36">
            <Label className="text-xs text-slate-500">资产名称 *</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="办公电脑" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-24">
            <Label className="text-xs text-slate-500">分类</Label>
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="电子设备" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-24">
            <Label className="text-xs text-slate-500">原值 *</Label>
            <Input type="number" value={newValue || ''} onChange={(e) => setNewValue(parseFloat(e.target.value) || 0)} placeholder="10000" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-24">
            <Label className="text-xs text-slate-500">累计折旧</Label>
            <Input type="number" value={newDep || ''} onChange={(e) => setNewDep(parseFloat(e.target.value) || 0)} placeholder="0" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-28">
            <Label className="text-xs text-slate-500">购置日期</Label>
            <Input value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder="YYYY-MM-DD" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-20">
            <Label className="text-xs text-slate-500">年限</Label>
            <Input type="number" value={newYears || ''} onChange={(e) => setNewYears(parseInt(e.target.value) || 10)} placeholder="10" className="h-8 text-sm" autoComplete="off" />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newName || newValue <= 0}>
            <Plus className="h-4 w-4 mr-1" /> 添加
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> 导入Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4 mr-1" /> 下载模板
        </Button>
        {assets.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setAssets([])} className="text-red-500 hover:text-red-700 ml-auto">
            <Trash2 className="h-4 w-4 mr-1" /> 清空
          </Button>
        )}
      </div>

      {/* Asset list */}
      {assets.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">资产名称</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">分类</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">原值</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">累计折旧</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">购置日期</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-16">年限</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{a.assetName}</td>
                  <td className="px-3 py-2 text-slate-600">{a.categoryName || '-'}</td>
                  <td className="px-3 py-2 text-right">{a.originalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{a.accumulatedDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-slate-600">{a.acquisitionDate || '-'}</td>
                  <td className="px-3 py-2 text-right">{a.usefulLifeYears}年</td>
                  <td className="px-3 py-1">
                    <Button variant="ghost" size="sm" onClick={() => removeAsset(i)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无固定资产</p>
          <p className="text-sm">点击"添加"或"导入Excel"批量录入</p>
        </div>
      )}

      {/* Save */}
      {assets.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? '保存中...' : `保存 ${assets.length} 条资产卡片`}
          </Button>
        </div>
      )}
    </div>
  );
}
