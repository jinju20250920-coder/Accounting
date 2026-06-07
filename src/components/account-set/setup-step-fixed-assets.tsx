'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Building2,
  Plus,
  Trash2,
  Upload,
  Download,
} from 'lucide-react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useToast } from '@/components/ui/toast';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { importFromExcel, exportTemplate } from '@/lib/excel-utils';
import {
  buildFixedAssetSetupPayload,
  type FixedAssetSetupRow,
} from '@/lib/fixed-asset-setup-payload';
import { getFixedAssetSetupCategories } from '@/lib/fixed-asset-setup-categories';

interface SetupStepFixedAssetsProps {
  accountSetId: string;
}

type AssetRow = FixedAssetSetupRow;

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
  { value: 'straight_line', label: '直线法' },
  { value: 'double_declining', label: '双倍余额递减法' },
  { value: 'sum_of_years', label: '年数总和法' },
  { value: 'units_of_production', label: '工作量法' },
];

const emptyAssetRow: AssetRow = {
  assetName: '',
  categoryId: '',
  categoryName: '',
  originalValue: 0,
  accumulatedDepreciation: 0,
  acquisitionDate: '',
  depreciationMethod: 'straight_line',
  usefulLifeYears: 10,
};

export function SetupStepFixedAssets({ accountSetId }: SetupStepFixedAssetsProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { categories, initialize, initializeDefaultCategories } = useFixedAssetStore();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AssetRow>(emptyAssetRow);

  const fixedAssetCategories = useMemo(
    () => getFixedAssetSetupCategories(categories),
    [categories],
  );

  useEffect(() => {
    if (sqliteService.accountSetId !== accountSetId) {
      sqliteService.setAccountSetId(accountSetId);
    }
  }, [accountSetId]);

  useEffect(() => {
    const initializeAssetData = async () => {
      await initialize();
      const latestCategories = useFixedAssetStore.getState().categories;
      if (latestCategories.length === 0) {
        await initializeDefaultCategories();
        await initialize();
      }
    };
    initializeAssetData();
  }, [initialize, initializeDefaultCategories]);

  const totalOriginal = assets.reduce((sum, asset) => sum + asset.originalValue, 0);
  const totalDepreciation = assets.reduce((sum, asset) => sum + asset.accumulatedDepreciation, 0);

  const updateForm = <K extends keyof AssetRow>(field: K, value: AssetRow[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = fixedAssetCategories.find(item => item.id === categoryId);
    setForm(prev => ({
      ...prev,
      categoryId,
      categoryName: category?.name || '',
      usefulLifeYears: category?.defaultUsefulLifeYears || prev.usefulLifeYears,
      depreciationMethod: category?.defaultDepreciationMethod || prev.depreciationMethod,
    }));
  };

  const handleAdd = () => {
    if (!form.assetName.trim() || form.originalValue <= 0) {
      showToast('warning', '请填写资产名称和原值');
      return;
    }

    setAssets(prev => [...prev, {
      ...form,
      assetName: form.assetName.trim(),
      categoryName: form.categoryName.trim(),
      originalValue: Math.round(form.originalValue * 100) / 100,
      accumulatedDepreciation: Math.round(form.accumulatedDepreciation * 100) / 100,
    }]);
    setForm(emptyAssetRow);
  };

  const removeAsset = (index: number) => {
    setAssets(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel<AssetRow>(file, ASSET_IMPORT_HEADERS);
      const imported: AssetRow[] = [];
      let skipped = 0;

      for (const row of rawData) {
        if (!row.assetName || !row.originalValue) {
          skipped++;
          continue;
        }
        const categoryName = String(row.categoryName || '').trim();
        const category = fixedAssetCategories.find(item => item.name === categoryName);
        imported.push({
          assetName: String(row.assetName).trim(),
          categoryId: category?.id || '',
          categoryName: category?.name || categoryName,
          originalValue: Math.round(Number(row.originalValue) * 100) / 100,
          accumulatedDepreciation: Math.round(Number(row.accumulatedDepreciation || 0) * 100) / 100,
          acquisitionDate: String(row.acquisitionDate || '').trim(),
          depreciationMethod: String(row.depreciationMethod || category?.defaultDepreciationMethod || 'straight_line').trim(),
          usefulLifeYears: Number(row.usefulLifeYears) || category?.defaultUsefulLifeYears || 10,
        });
      }

      if (imported.length > 0) setAssets(prev => [...prev, ...imported]);
      if (skipped > 0) showToast('warning', `导入 ${imported.length} 条，跳过 ${skipped} 条`);
      else if (imported.length > 0) showToast('success', `成功导入 ${imported.length} 条固定资产`);
      else showToast('warning', '未找到有效数据');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToast('error', `导入失败：${message}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    exportTemplate<AssetRow>(
      '固定资产导入模板',
      { assetName: '办公电脑', categoryId: '', categoryName: '电子设备', originalValue: 10000, accumulatedDepreciation: 2000, acquisitionDate: '2026-01-01', depreciationMethod: '直线法', usefulLifeYears: 5 },
      ASSET_IMPORT_HEADERS,
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

      for (const [index, row] of assets.entries()) {
        await sqliteService.saveFixedAsset(buildFixedAssetSetupPayload({
          row,
          index,
          accountSetId,
          fallbackDate: voucherDate,
          now,
        }));
      }

      showToast('success', `已保存 ${assets.length} 条固定资产卡片`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToast('error', `保存失败：${message}`);
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

      <div className="border rounded-lg p-4 bg-slate-50">
        <Label className="text-sm font-medium mb-3 block">新增资产</Label>
        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 items-end gap-3">
          <div>
            <Label className="text-xs text-slate-500">资产名称 *</Label>
            <Input value={form.assetName} onChange={(event) => updateForm('assetName', event.target.value)} placeholder="办公电脑" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">分类</Label>
            <select value={form.categoryId} onChange={(event) => handleCategoryChange(event.target.value)} className="h-9 w-full rounded-md border px-3 text-sm">
              <option value="">选择分类</option>
              {fixedAssetCategories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">原值 *</Label>
            <Input type="number" value={form.originalValue || ''} onChange={(event) => updateForm('originalValue', parseFloat(event.target.value) || 0)} placeholder="10000" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">累计折旧</Label>
            <Input type="number" value={form.accumulatedDepreciation || ''} onChange={(event) => updateForm('accumulatedDepreciation', parseFloat(event.target.value) || 0)} placeholder="0" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">购置日期</Label>
            <ChineseDatePicker value={form.acquisitionDate} onChange={(value) => updateForm('acquisitionDate', value)} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">年限</Label>
            <Input type="number" value={form.usefulLifeYears || ''} onChange={(event) => updateForm('usefulLifeYears', parseInt(event.target.value, 10) || 10)} placeholder="10" className="h-9 text-sm" autoComplete="off" />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!form.assetName || form.originalValue <= 0}>
            <Plus className="h-4 w-4 mr-1" /> 添加
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-slate-500">折旧方法</Label>
            <select value={form.depreciationMethod} onChange={(event) => updateForm('depreciationMethod', event.target.value)} className="h-9 w-full rounded-md border px-3 text-sm">
              {DEPRECIATION_METHODS.map(method => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

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

      {assets.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">资产名称</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">分类</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">原值</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">累计折旧</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">购置日期</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-16">年限</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, index) => (
                <tr key={`${asset.assetName}-${index}`} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{asset.assetName}</td>
                  <td className="px-3 py-2 text-slate-600">{asset.categoryName || '-'}</td>
                  <td className="px-3 py-2 text-right">{asset.originalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{asset.accumulatedDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-slate-600">{asset.acquisitionDate || '-'}</td>
                  <td className="px-3 py-2 text-right">{asset.usefulLifeYears}年</td>
                  <td className="px-3 py-1">
                    <Button variant="ghost" size="sm" onClick={() => removeAsset(index)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
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
          <p className="text-sm">点击添加或导入 Excel 批量录入</p>
        </div>
      )}

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
