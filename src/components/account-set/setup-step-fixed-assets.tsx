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
  Edit,
  Save,
} from 'lucide-react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { loadOpeningBalanceLockKeys } from '@/lib/opening-balance-rules';
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

interface SavedAsset extends AssetRow {
  id: string;
  assetCode: string;
}

const ASSET_IMPORT_HEADERS = [
  { key: 'assetName' as const, label: '资产名称', required: true },
  { key: 'categoryName' as const, label: '分类', required: false },
  { key: 'originalValue' as const, label: '原值', required: true },
  { key: 'salvageValue' as const, label: '残值', required: false },
  { key: 'accumulatedDepreciation' as const, label: '累计折旧金额', required: false },
  { key: 'acquisitionDate' as const, label: '开始折旧日期', required: false },
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
  salvageValue: 0,
  accumulatedDepreciation: 0,
  acquisitionDate: '',
  depreciationMethod: 'straight_line',
  usefulLifeYears: 10,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SetupStepFixedAssets({ accountSetId }: SetupStepFixedAssetsProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { categories, initialize, initializeDefaultCategories } = useFixedAssetStore();
  const [assets, setAssets] = useState<SavedAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AssetRow>(emptyAssetRow);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AssetRow>(emptyAssetRow);
  const [lockedAssetKeys, setLockedAssetKeys] = useState<Set<string>>(new Set());

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
      const storeAssets = useFixedAssetStore.getState().assets;
      if (storeAssets.length > 0) {
        setAssets(storeAssets.map(a => ({
          id: a.id,
          assetCode: a.assetCode,
          assetName: a.assetName,
          categoryId: a.categoryId || '',
          categoryName: a.categoryName || '',
          originalValue: a.originalValue,
          salvageValue: a.salvageValue || 0,
          accumulatedDepreciation: a.accumulatedDepreciation,
          acquisitionDate: a.acquisitionDate || '',
          depreciationMethod: a.depreciationMethod || 'straight_line',
          usefulLifeYears: a.usefulLifeYears || 10,
        })));
      }
      const lockKeys = await loadOpeningBalanceLockKeys(accountSetId, { sqliteService });
      setLockedAssetKeys(lockKeys.assetKeys);
    };
    initializeAssetData();
  }, [initialize, initializeDefaultCategories, accountSetId]);

  const totalOriginal = assets.reduce((sum, asset) => sum + asset.originalValue, 0);
  const totalDepreciation = assets.reduce((sum, asset) => sum + asset.accumulatedDepreciation, 0);

  const updateForm = <K extends keyof AssetRow>(field: K, value: AssetRow[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateEditForm = <K extends keyof AssetRow>(field: K, value: AssetRow[K]) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
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

  const handleEditCategoryChange = (categoryId: string) => {
    const category = fixedAssetCategories.find(item => item.id === categoryId);
    setEditForm(prev => ({
      ...prev,
      categoryId,
      categoryName: category?.name || '',
      usefulLifeYears: category?.defaultUsefulLifeYears || prev.usefulLifeYears,
      depreciationMethod: category?.defaultDepreciationMethod || prev.depreciationMethod,
    }));
  };

  const saveAssetToDb = async (row: AssetRow, index: number): Promise<SavedAsset> => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const voucherDate = accountSet?.enableDate ? `${accountSet.enableDate}-01` : new Date().toISOString().substring(0, 10);
    const now = new Date().toISOString();
    const payload = buildFixedAssetSetupPayload({
      row,
      index,
      accountSetId,
      fallbackDate: voucherDate,
      now,
    });
    await sqliteService.saveFixedAsset(payload);
    return {
      id: payload.id,
      assetCode: payload.assetCode,
      assetName: payload.assetName,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      originalValue: payload.originalValue,
      salvageValue: payload.salvageValue,
      accumulatedDepreciation: payload.accumulatedDepreciation,
      acquisitionDate: payload.acquisitionDate,
      depreciationMethod: payload.depreciationMethod,
      usefulLifeYears: payload.usefulLifeYears,
    };
  };

  const handleAdd = async () => {
    if (!form.assetName.trim() || form.originalValue <= 0) {
      showToast('warning', '请填写资产名称和原值');
      return;
    }

    const newRow: AssetRow = {
      ...form,
      assetName: form.assetName.trim(),
      categoryName: form.categoryName.trim(),
      originalValue: Math.round(form.originalValue * 100) / 100,
      salvageValue: Math.round((form.salvageValue || 0) * 100) / 100,
      accumulatedDepreciation: Math.round(form.accumulatedDepreciation * 100) / 100,
    };

    setSaving(true);
    try {
      const saved = await saveAssetToDb(newRow, assets.length);
      setAssets(prev => [...prev, saved]);
      setForm(emptyAssetRow);
      showToast('success', '已添加资产卡片');
    } catch (error: unknown) {
      showToast('error', `保存失败：${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (asset: SavedAsset) => {
    setEditingId(asset.id);
    setEditForm({
      assetName: asset.assetName,
      categoryId: asset.categoryId,
      categoryName: asset.categoryName,
      originalValue: asset.originalValue,
      salvageValue: asset.salvageValue || 0,
      accumulatedDepreciation: asset.accumulatedDepreciation,
      acquisitionDate: asset.acquisitionDate,
      depreciationMethod: asset.depreciationMethod,
      usefulLifeYears: asset.usefulLifeYears,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyAssetRow);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const index = assets.findIndex(a => a.id === editingId);
    if (index < 0) return;

    if (!editForm.assetName.trim() || editForm.originalValue <= 0) {
      showToast('warning', '请填写资产名称和原值');
      return;
    }

    try {
      const payload = buildFixedAssetSetupPayload({
        row: {
          ...editForm,
          assetName: editForm.assetName.trim(),
          categoryName: editForm.categoryName.trim(),
          originalValue: Math.round(editForm.originalValue * 100) / 100,
          salvageValue: Math.round((editForm.salvageValue || 0) * 100) / 100,
          accumulatedDepreciation: Math.round(editForm.accumulatedDepreciation * 100) / 100,
        },
        index,
        accountSetId,
        fallbackDate: editForm.acquisitionDate || new Date().toISOString().substring(0, 10),
        now: new Date().toISOString(),
      });
      await sqliteService.saveFixedAsset(payload);

      setAssets(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          assetName: payload.assetName,
          categoryId: payload.categoryId,
          categoryName: payload.categoryName,
          originalValue: payload.originalValue,
          salvageValue: payload.salvageValue,
          accumulatedDepreciation: payload.accumulatedDepreciation,
          acquisitionDate: payload.acquisitionDate,
          depreciationMethod: payload.depreciationMethod,
          usefulLifeYears: payload.usefulLifeYears,
        };
        return next;
      });

      showToast('success', '已更新资产卡片');
      setEditingId(null);
      setEditForm(emptyAssetRow);
    } catch (error: unknown) {
      showToast('error', `更新失败：${getErrorMessage(error)}`);
    }
  };

  const removeAsset = async (id: string) => {
    try {
      const db = await sqliteService.getDatabase();
      if (db) {
        const stmt = db.prepare('DELETE FROM fixedAssets WHERE id = ?');
        try {
          stmt.run([id]);
        } finally {
          stmt.free();
        }
      }
      setAssets(prev => prev.filter(a => a.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditForm(emptyAssetRow);
      }
    } catch (error: unknown) {
      showToast('error', `删除失败：${getErrorMessage(error)}`);
    }
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
          salvageValue: Math.round(Number(row.salvageValue || 0) * 100) / 100,
          accumulatedDepreciation: Math.round(Number(row.accumulatedDepreciation || 0) * 100) / 100,
          acquisitionDate: String(row.acquisitionDate || '').trim(),
          depreciationMethod: String(row.depreciationMethod || category?.defaultDepreciationMethod || 'straight_line').trim(),
          usefulLifeYears: Number(row.usefulLifeYears) || category?.defaultUsefulLifeYears || 10,
        });
      }

      if (imported.length === 0) {
        showToast('warning', '未找到有效数据');
      } else {
        setSaving(true);
        const savedRows: SavedAsset[] = [];
        for (const [i, row] of imported.entries()) {
          try {
            const saved = await saveAssetToDb(row, assets.length + i);
            savedRows.push(saved);
          } catch {
            skipped++;
          }
        }
        if (savedRows.length > 0) {
          setAssets(prev => [...prev, ...savedRows]);
        }
        if (skipped > 0) showToast('warning', `导入 ${savedRows.length} 条，跳过 ${skipped} 条`);
        else showToast('success', `成功导入 ${savedRows.length} 条固定资产`);
        setSaving(false);
      }
    } catch (error: unknown) {
      showToast('error', `导入失败：${getErrorMessage(error)}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    exportTemplate<AssetRow>(
      '固定资产导入模板',
      { assetName: '办公电脑', categoryId: '', categoryName: '电子设备', originalValue: 10000, salvageValue: 500, accumulatedDepreciation: 2000, acquisitionDate: '2026-01-01', depreciationMethod: '直线法', usefulLifeYears: 5 },
      ASSET_IMPORT_HEADERS,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">固定资产卡片</h2>
        <p className="text-sm text-slate-500 mt-1">
          录入期初固定资产卡片信息。点击添加即保存
        </p>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
        <div className="flex-1 text-center">
          <p className="text-sm text-slate-500">原值合计</p>
          <p className="text-lg font-semibold text-slate-900">{totalOriginal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-sm text-slate-500">累计折旧金额</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 items-end gap-3">
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
            <Input type="number" value={form.originalValue || ''} onChange={(event) => {
              const v = parseFloat(event.target.value) || 0;
              setForm(prev => ({
                ...prev,
                originalValue: v,
                salvageValue: prev.salvageValue === 0 ? Math.round(v * 0.05 * 100) / 100 : prev.salvageValue,
              }));
            }} placeholder="10000" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">残值率 (%)</Label>
            <Input
              type="number"
              value={(() => {
                const original = form.originalValue || 0;
                const salvage = form.salvageValue || 0;
                if (original > 0) return Math.round((salvage / original) * 10000) / 100;
                return 0;
              })()}
              onChange={(event) => {
                const rate = parseFloat(event.target.value) || 0;
                const original = form.originalValue || 0;
                const salvage = Math.round(original * rate * 100) / 10000;
                updateForm('salvageValue', salvage);
              }}
              placeholder="0"
              className="h-9 text-sm"
              autoComplete="off"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">残值金额 (¥)</Label>
            <Input type="number" value={form.salvageValue || ''} onChange={(event) => updateForm('salvageValue', parseFloat(event.target.value) || 0)} placeholder="0.00" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">累计折旧金额</Label>
            <Input type="number" value={form.accumulatedDepreciation || ''} onChange={(event) => updateForm('accumulatedDepreciation', parseFloat(event.target.value) || 0)} placeholder="0.00" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">开始折旧日期</Label>
            <ChineseDatePicker value={form.acquisitionDate} onChange={(value) => updateForm('acquisitionDate', value)} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">年限</Label>
            <Input type="number" value={form.usefulLifeYears || ''} onChange={(event) => updateForm('usefulLifeYears', parseInt(event.target.value, 10) || 10)} placeholder="10" className="h-9 text-sm" autoComplete="off" />
          </div>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Label className="text-xs text-slate-500">折旧方法</Label>
            <select value={form.depreciationMethod} onChange={(event) => updateForm('depreciationMethod', event.target.value)} className="h-9 w-full rounded-md border px-3 text-sm">
              {DEPRECIATION_METHODS.map(method => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving || !form.assetName || form.originalValue <= 0}>
            <Plus className="h-4 w-4 mr-1" /> 添加
          </Button>
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
      </div>

      {assets.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">资产名称</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">分类</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">原值</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">残值</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">累计折旧金额</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">账面价值</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-36">开始折旧日期</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-16">年限</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">折旧方法</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const isPosted = lockedAssetKeys.has(asset.assetName);
                if (editingId === asset.id) {
                  return (
                    <tr key={asset.id} className="border-t bg-blue-50/40">
                      <td className="px-2 py-1">
                        <Input value={editForm.assetName} onChange={(e) => updateEditForm('assetName', e.target.value)} className="h-8 text-sm" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={editForm.categoryId}
                          onChange={(e) => handleEditCategoryChange(e.target.value)}
                          className="h-8 w-full text-sm rounded-md border px-2"
                        >
                          <option value="">无</option>
                          {fixedAssetCategories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" value={editForm.originalValue || ''} onChange={(e) => updateEditForm('originalValue', parseFloat(e.target.value) || 0)} disabled={isPosted} className="h-8 text-sm text-right disabled:bg-slate-100" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <div className="space-y-1">
                          <Input
                            type="number"
                            value={(() => {
                              const original = editForm.originalValue || 0;
                              const salvage = editForm.salvageValue || 0;
                              if (original > 0) return Math.round((salvage / original) * 10000) / 100;
                              return 0;
                            })()}
                            onChange={(e) => {
                              const rate = parseFloat(e.target.value) || 0;
                              const original = editForm.originalValue || 0;
                              const salvage = Math.round(original * rate * 100) / 10000;
                              updateEditForm('salvageValue', salvage);
                            }}
                            className="h-8 text-sm text-right"
                            autoComplete="off"
                          />
                          <Input
                            type="number"
                            value={editForm.salvageValue || ''}
                            onChange={(e) => updateEditForm('salvageValue', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm text-right"
                            autoComplete="off"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" value={editForm.accumulatedDepreciation || ''} onChange={(e) => updateEditForm('accumulatedDepreciation', parseFloat(e.target.value) || 0)} disabled={isPosted} className="h-8 text-sm text-right disabled:bg-slate-100" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1 text-right text-xs text-slate-500">
                        {Math.round((editForm.originalValue - editForm.accumulatedDepreciation) * 100) / 100}
                      </td>
                      <td className="px-2 py-1">
                        <ChineseDatePicker
                          value={editForm.acquisitionDate}
                          onChange={(v) => updateEditForm('acquisitionDate', v)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" value={editForm.usefulLifeYears || ''} onChange={(e) => updateEditForm('usefulLifeYears', parseInt(e.target.value, 10) || 10)} className="h-8 text-sm text-right" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={editForm.depreciationMethod}
                          onChange={(e) => updateEditForm('depreciationMethod', e.target.value)}
                          className="h-8 w-full text-sm rounded-md border px-2"
                        >
                          {DEPRECIATION_METHODS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={saveEdit} className="h-7 w-7 p-0 text-green-600 hover:text-green-700">
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 w-7 p-0 text-slate-500">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={asset.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{asset.assetName}</td>
                    <td className="px-3 py-2 text-slate-600">{asset.categoryName || '-'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{asset.originalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{(asset.salvageValue || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{asset.accumulatedDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right font-medium text-blue-700">{(asset.originalValue - asset.accumulatedDepreciation).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-slate-600">{asset.acquisitionDate || '-'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{asset.usefulLifeYears}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {DEPRECIATION_METHODS.find(m => m.value === asset.depreciationMethod)?.label || asset.depreciationMethod}
                    </td>
                    <td className="px-3 py-1">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(asset)} className="h-7 w-7 p-0">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => !isPosted && removeAsset(asset.id)}
                          disabled={isPosted}
                          title={isPosted ? '已入账期初凭证，无法删除。如需调整请先冲销期初凭证' : '删除'}
                          className={`h-7 w-7 p-0 ${isPosted ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700'}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
    </div>
  );
}
