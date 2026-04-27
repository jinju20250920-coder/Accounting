'use client';

import { create } from 'zustand';
import { getCurrentManager } from '@/lib/database';
import { useAccountSetStore } from './useAccountSetStore';
import {
  calculateDepreciation,
  getDepreciationMethodName,
  parseDepreciationMethod,
} from '@/lib/depreciation';
import type {
  FixedAsset,
  DepreciationRecord,
  AssetCategory,
  DepreciationResult,
  BatchDepreciationResult,
  AssetFilter,
  DepreciationMethod,
} from '@/types';

interface FixedAssetStore {
  // 状态
  assets: FixedAsset[];
  depreciationRecords: DepreciationRecord[];
  categories: AssetCategory[];
  loading: boolean;
  error: string | null;
  selectedAssetId: string | null;
  filter: AssetFilter;

  // CRUD - 资产
  addAsset: (asset: Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'>) => Promise<FixedAsset>;
  createFromInvoice: (card: Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'>) => Promise<FixedAsset>;
  updateAsset: (id: string, updates: Partial<FixedAsset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  getAssetById: (id: string) => FixedAsset | undefined;
  getAssetByCode: (code: string) => FixedAsset | undefined;

  // CRUD - 分类
  addCategory: (category: Omit<AssetCategory, 'id' | 'createTime' | 'updateTime'>) => Promise<AssetCategory>;
  updateCategory: (id: string, updates: Partial<AssetCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // 折旧
  calculateDepreciationForAsset: (assetId: string, asOfDate: string, unitsThisPeriod?: number) => DepreciationResult | null;
  batchCalculateDepreciation: (assetIds: string[], period: string, unitsMap?: Record<string, number>) => BatchDepreciationResult;
  saveDepreciationRecords: (records: DepreciationRecord[]) => Promise<void>;
  postDepreciationRecords: (recordIds: string[]) => Promise<void>;

  // 查询
  getFilteredAssets: () => FixedAsset[];
  getActiveAssets: () => FixedAsset[];
  getDepreciationHistory: (assetId: string) => DepreciationRecord[];

  // 导入导出
  importAssetsFromExcel: (assets: Partial<FixedAsset>[]) => Promise<{ success: number; errors: string[] }>;
  exportAssetsToExcel: (filter?: AssetFilter) => FixedAsset[];

  // 凭证生成
  generateDepreciationVoucher: (recordIds: string[], voucherDate: string) => Promise<{ voucherId: string; voucherNo: string } | null>;

  // 状态管理
  setSelectedAssetId: (id: string | null) => void;
  setFilter: (filter: Partial<AssetFilter>) => void;
  clearError: () => void;
  initialize: () => Promise<void>;
  initializeDefaultCategories: () => Promise<void>;
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 默认资产分类
const DEFAULT_CATEGORIES: Omit<AssetCategory, 'id' | 'createTime' | 'updateTime' | 'accountSetId'>[] = [
  {
    code: 'ELECTRONIC',
    name: '电子设备',
    assetType: 'fixed',
    defaultUsefulLifeYears: 3,
    defaultDepreciationMethod: 'straight_line',
    defaultSalvageRate: 0.05,
    assetSubjectCode: '1501',
    depreciationSubjectCode: '1502',
    expenseSubjectCode: '660204',
    description: '包括电脑、打印机、复印机、投影仪等办公电子设备',
    sortOrder: 1,
    enabled: true,
  },
  {
    code: 'VEHICLE',
    name: '运输工具',
    assetType: 'fixed',
    defaultUsefulLifeYears: 4,
    defaultDepreciationMethod: 'straight_line',
    defaultSalvageRate: 0.05,
    assetSubjectCode: '1501',
    depreciationSubjectCode: '1502',
    expenseSubjectCode: '660204',
    description: '包括公司车辆、货车、摩托车等交通工具',
    sortOrder: 2,
    enabled: true,
  },
  {
    code: 'FURNITURE',
    name: '办公家具',
    assetType: 'fixed',
    defaultUsefulLifeYears: 5,
    defaultDepreciationMethod: 'straight_line',
    defaultSalvageRate: 0.05,
    assetSubjectCode: '1501',
    depreciationSubjectCode: '1502',
    expenseSubjectCode: '660204',
    description: '包括办公桌椅、文件柜、会议桌等家具',
    sortOrder: 3,
    enabled: true,
  },
  {
    code: 'MACHINERY',
    name: '机器设备',
    assetType: 'fixed',
    defaultUsefulLifeYears: 10,
    defaultDepreciationMethod: 'straight_line',
    defaultSalvageRate: 0.05,
    assetSubjectCode: '1501',
    depreciationSubjectCode: '1502',
    expenseSubjectCode: '410502',
    description: '包括生产设备、机器工具、仪器仪表等',
    sortOrder: 4,
    enabled: true,
  },
  {
    code: 'BUILDING',
    name: '房屋建筑物',
    assetType: 'fixed',
    defaultUsefulLifeYears: 20,
    defaultDepreciationMethod: 'straight_line',
    defaultSalvageRate: 0.05,
    assetSubjectCode: '1501',
    depreciationSubjectCode: '1502',
    expenseSubjectCode: '660204',
    description: '包括厂房、办公楼、仓库等建筑物',
    sortOrder: 5,
    enabled: true,
  },
];

export const useFixedAssetStore = create<FixedAssetStore>((set, get) => ({
  // 初始状态
  assets: [],
  depreciationRecords: [],
  categories: [],
  loading: false,
  error: null,
  selectedAssetId: null,
  filter: {},

  // 添加资产
  addAsset: async (assetData) => {
    const state = get();
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();

    if (!currentAccountSet?.id) {
      const error = '请先选择账套';
      set({ error });
      throw new Error(error);
    }

    // 检查编码是否重复
    if (assetData.assetCode && state.assets.some(a => a.assetCode === assetData.assetCode)) {
      const error = '资产编码已存在';
      set({ error });
      throw new Error(error);
    }

    const now = new Date().toISOString();
    const newAsset: FixedAsset = {
      ...assetData,
      id: generateId(),
      depreciableValue: assetData.originalValue - (assetData.salvageValue || 0),
      netValue: assetData.originalValue - (assetData.accumulatedDepreciation || 0),
      status: assetData.status || 'active',
      accountSetId: currentAccountSet?.id,
      createTime: now,
      updateTime: now,
    };

    try {
      // 保存到数据库
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      // 同步账套ID
      if (currentAccountSet?.id) {
        sqliteService.setAccountSetId(currentAccountSet.id);
      }
      const db = await sqliteService.getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const stmt = db.prepare(
        `INSERT INTO fixedAssets (
          id, assetCode, assetName, categoryId, categoryName, specification, unit, quantity,
          originalValue, salvageValue, depreciableValue, accumulatedDepreciation, netValue,
          depreciationMethod, usefulLifeYears, usefulLifeMonths, totalUnits, unitsUsed,
          acquisitionDate, depreciationStartDate, lastDepreciationDate, disposalDate,
          status, location, departmentCode, departmentName,
          assetSubjectCode, assetSubjectName, depreciationSubjectCode, depreciationSubjectName,
          expenseSubjectCode, expenseSubjectName, supplierName, invoiceNo, notes,
          accountSetId, createTime, updateTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        newAsset.id, newAsset.assetCode, newAsset.assetName, newAsset.categoryId, newAsset.categoryName,
        newAsset.specification, newAsset.unit, newAsset.quantity,
        newAsset.originalValue, newAsset.salvageValue, newAsset.depreciableValue,
        newAsset.accumulatedDepreciation, newAsset.netValue,
        newAsset.depreciationMethod, newAsset.usefulLifeYears, newAsset.usefulLifeMonths,
        newAsset.totalUnits, newAsset.unitsUsed,
        newAsset.acquisitionDate, newAsset.depreciationStartDate, newAsset.lastDepreciationDate,
        newAsset.disposalDate, newAsset.status, newAsset.location,
        newAsset.departmentCode, newAsset.departmentName,
        newAsset.assetSubjectCode, newAsset.assetSubjectName,
        newAsset.depreciationSubjectCode, newAsset.depreciationSubjectName,
        newAsset.expenseSubjectCode, newAsset.expenseSubjectName,
        newAsset.supplierName, newAsset.invoiceNo, newAsset.notes,
        newAsset.accountSetId, newAsset.createTime, newAsset.updateTime,
      ]);
      stmt.free();

      set((state) => ({
        assets: [...state.assets, newAsset],
        error: null,
      }));

      return newAsset;
    } catch (error: any) {
      console.error('添加资产失败:', error);
      const errorMsg = error?.message || error?.toString() || '添加资产失败';
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  // 从发票创建资产（委托给 addAsset）
  createFromInvoice: async (card) => {
    return get().addAsset(card);
  },

  // 更新资产
  updateAsset: async (id, updates) => {
    const state = get();
    const asset = state.assets.find(a => a.id === id);
    if (!asset) {
      set({ error: '资产不存在' });
      return;
    }

    const now = new Date().toISOString();
    const updatedAsset: FixedAsset = {
      ...asset,
      ...updates,
      updateTime: now,
    };

    // 重新计算净值
    if (updates.originalValue !== undefined || updates.accumulatedDepreciation !== undefined) {
      updatedAsset.netValue = updatedAsset.originalValue - updatedAsset.accumulatedDepreciation;
      updatedAsset.depreciableValue = updatedAsset.originalValue - updatedAsset.salvageValue;
    }

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      if (currentAccountSet?.id) {
        sqliteService.setAccountSetId(currentAccountSet.id);
      }
      const db = await sqliteService.getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const stmt = db.prepare(
        `UPDATE fixedAssets SET
          assetName=?, categoryId=?, categoryName=?, specification=?, unit=?, quantity=?,
          originalValue=?, salvageValue=?, depreciableValue=?, accumulatedDepreciation=?, netValue=?,
          depreciationMethod=?, usefulLifeYears=?, usefulLifeMonths=?, totalUnits=?, unitsUsed=?,
          acquisitionDate=?, depreciationStartDate=?, lastDepreciationDate=?, disposalDate=?,
          status=?, location=?, departmentCode=?, departmentName=?,
          assetSubjectCode=?, assetSubjectName=?, depreciationSubjectCode=?, depreciationSubjectName=?,
          expenseSubjectCode=?, expenseSubjectName=?, supplierName=?, invoiceNo=?, notes=?,
          updateTime=?
        WHERE id=?`
      );
      stmt.run([
        updatedAsset.assetName, updatedAsset.categoryId, updatedAsset.categoryName,
        updatedAsset.specification, updatedAsset.unit, updatedAsset.quantity,
        updatedAsset.originalValue, updatedAsset.salvageValue, updatedAsset.depreciableValue,
        updatedAsset.accumulatedDepreciation, updatedAsset.netValue,
        updatedAsset.depreciationMethod, updatedAsset.usefulLifeYears, updatedAsset.usefulLifeMonths,
        updatedAsset.totalUnits, updatedAsset.unitsUsed,
        updatedAsset.acquisitionDate, updatedAsset.depreciationStartDate,
        updatedAsset.lastDepreciationDate, updatedAsset.disposalDate,
        updatedAsset.status, updatedAsset.location,
        updatedAsset.departmentCode, updatedAsset.departmentName,
        updatedAsset.assetSubjectCode, updatedAsset.assetSubjectName,
        updatedAsset.depreciationSubjectCode, updatedAsset.depreciationSubjectName,
        updatedAsset.expenseSubjectCode, updatedAsset.expenseSubjectName,
        updatedAsset.supplierName, updatedAsset.invoiceNo, updatedAsset.notes,
        updatedAsset.updateTime, id,
      ]);
      stmt.free();

      set((state) => ({
        assets: state.assets.map(a => a.id === id ? updatedAsset : a),
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '更新资产失败' });
      throw error;
    }
  },

  // 删除资产
  deleteAsset: async (id) => {
    const state = get();
    const asset = state.assets.find(a => a.id === id);
    if (!asset) {
      set({ error: '资产不存在' });
      return;
    }

    // 检查是否有未记账的折旧记录
    const hasUnpostedRecords = state.depreciationRecords.some(
      r => r.assetId === id && r.status === 'draft'
    );
    if (hasUnpostedRecords) {
      set({ error: '该资产有未记账的折旧记录，无法删除' });
      return;
    }

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      if (currentAccountSet?.id) {
        sqliteService.setAccountSetId(currentAccountSet.id);
      }
      const db = await sqliteService.getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      // 删除折旧记录
      const stmt1 = db.prepare('DELETE FROM depreciationRecords WHERE assetId = ?');
      stmt1.run([id]);
      stmt1.free();
      // 删除资产
      const stmt2 = db.prepare('DELETE FROM fixedAssets WHERE id = ?');
      stmt2.run([id]);
      stmt2.free();

      set((state) => ({
        assets: state.assets.filter(a => a.id !== id),
        depreciationRecords: state.depreciationRecords.filter(r => r.assetId !== id),
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '删除资产失败' });
      throw error;
    }
  },

  // 按ID获取资产
  getAssetById: (id) => {
    return get().assets.find(a => a.id === id);
  },

  // 按编码获取资产
  getAssetByCode: (code) => {
    return get().assets.find(a => a.assetCode === code);
  },

  // 添加分类
  addCategory: async (categoryData) => {
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();
    const now = new Date().toISOString();

    const newCategory: AssetCategory = {
      ...categoryData,
      id: generateId(),
      accountSetId: currentAccountSet?.id,
      createTime: now,
      updateTime: now,
    };

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      const stmt = db.prepare(
        `INSERT INTO assetCategories (
          id, code, name, assetType, defaultUsefulLifeYears, defaultDepreciationMethod,
          defaultSalvageRate, assetSubjectCode, depreciationSubjectCode, expenseSubjectCode,
          description, sortOrder, enabled, accountSetId, createTime, updateTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        newCategory.id,
        newCategory.code,
        newCategory.name,
        newCategory.assetType,
        newCategory.defaultUsefulLifeYears ?? 5,
        newCategory.defaultDepreciationMethod ?? 'straight_line',
        newCategory.defaultSalvageRate ?? 0.05,
        newCategory.assetSubjectCode ?? '1501',
        newCategory.depreciationSubjectCode ?? '1502',
        newCategory.expenseSubjectCode ?? '660204',
        newCategory.description ?? '',
        newCategory.sortOrder ?? 0,
        newCategory.enabled ? 1 : 0,
        newCategory.accountSetId ?? '',
        newCategory.createTime,
        newCategory.updateTime,
      ]);
      stmt.free();

      set((state) => ({
        categories: [...state.categories, newCategory],
        error: null,
      }));

      return newCategory;
    } catch (error: any) {
      set({ error: error.message || '添加分类失败' });
      throw error;
    }
  },

  // 更新分类
  updateCategory: async (id, updates) => {
    const state = get();
    const category = state.categories.find(c => c.id === id);
    if (!category) {
      set({ error: '分类不存在' });
      return;
    }

    const now = new Date().toISOString();
    const updatedCategory: AssetCategory = {
      ...category,
      ...updates,
      updateTime: now,
    };

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      const stmt = db.prepare(
        `UPDATE assetCategories SET
          name=?, assetType=?, defaultUsefulLifeYears=?, defaultDepreciationMethod=?,
          defaultSalvageRate=?, assetSubjectCode=?, depreciationSubjectCode=?, expenseSubjectCode=?,
          description=?, sortOrder=?, enabled=?, updateTime=?
        WHERE id=?`
      );
      stmt.run([
        updatedCategory.name, updatedCategory.assetType,
        updatedCategory.defaultUsefulLifeYears, updatedCategory.defaultDepreciationMethod,
        updatedCategory.defaultSalvageRate, updatedCategory.assetSubjectCode,
        updatedCategory.depreciationSubjectCode, updatedCategory.expenseSubjectCode,
        updatedCategory.description, updatedCategory.sortOrder,
        updatedCategory.enabled ? 1 : 0, updatedCategory.updateTime, id,
      ]);
      stmt.free();

      set((state) => ({
        categories: state.categories.map(c => c.id === id ? updatedCategory : c),
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '更新分类失败' });
      throw error;
    }
  },

  // 删除分类
  deleteCategory: async (id) => {
    const state = get();
    const hasAssets = state.assets.some(a => a.categoryId === id);
    if (hasAssets) {
      set({ error: '该分类下有资产，无法删除' });
      return;
    }

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      const stmt = db.prepare('DELETE FROM assetCategories WHERE id = ?');
      stmt.run([id]);
      stmt.free();

      set((state) => ({
        categories: state.categories.filter(c => c.id !== id),
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '删除分类失败' });
      throw error;
    }
  },

  // 计算单个资产的折旧
  calculateDepreciationForAsset: (assetId, asOfDate, unitsThisPeriod) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset || asset.status !== 'active') return null;

    const result = calculateDepreciation(
      asset.depreciationMethod,
      {
        method: asset.depreciationMethod,
        originalValue: asset.originalValue,
        salvageValue: asset.salvageValue,
        usefulLifeYears: asset.usefulLifeYears,
        usefulLifeMonths: asset.usefulLifeMonths,
        acquisitionDate: asset.acquisitionDate,
        depreciationStartDate: asset.depreciationStartDate || asset.acquisitionDate,
        accumulatedDepreciation: asset.accumulatedDepreciation,
        totalUnits: asset.totalUnits,
        unitsUsed: asset.unitsUsed,
        asOfDate,
      },
      unitsThisPeriod
    );

    return result;
  },

  // 批量计算折旧
  batchCalculateDepreciation: (assetIds, period, unitsMap) => {
    const state = get();
    const records: DepreciationRecord[] = [];
    const errors: Array<{ assetId: string; assetName: string; error: string }> = [];
    let totalDepreciation = 0;

    for (const assetId of assetIds) {
      const asset = state.assets.find(a => a.id === assetId);
      if (!asset) {
        errors.push({ assetId, assetName: '未知', error: '资产不存在' });
        continue;
      }

      if (asset.status !== 'active') {
        errors.push({ assetId, assetName: asset.assetName, error: '资产状态不是在用' });
        continue;
      }

      const result = calculateDepreciation(
        asset.depreciationMethod,
        {
          method: asset.depreciationMethod,
          originalValue: asset.originalValue,
          salvageValue: asset.salvageValue,
          usefulLifeYears: asset.usefulLifeYears,
          usefulLifeMonths: asset.usefulLifeMonths,
          acquisitionDate: asset.acquisitionDate,
          depreciationStartDate: asset.depreciationStartDate || asset.acquisitionDate,
          accumulatedDepreciation: asset.accumulatedDepreciation,
          totalUnits: asset.totalUnits,
          unitsUsed: asset.unitsUsed,
          asOfDate: `${period}-01`,
        },
        unitsMap?.[assetId]
      );

      if (result.isFullyDepreciated || result.periodDepreciation <= 0) {
        continue;
      }

      const record: DepreciationRecord = {
        id: generateId(),
        assetId: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        period,
        depreciationDate: `${period}-01`,
        periodDepreciation: result.periodDepreciation,
        accumulatedDepreciation: result.accumulatedDepreciation,
        netValueAfter: result.netValue,
        status: 'draft',
        accountSetId: asset.accountSetId,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      };

      records.push(record);
      totalDepreciation += result.periodDepreciation;
    }

    return {
      records,
      totalDepreciation,
      assetCount: records.length,
      period,
      errors,
    };
  },

  // 保存折旧记录
  saveDepreciationRecords: async (records) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();

      for (const record of records) {
        const stmt = db.prepare(
          `INSERT INTO depreciationRecords (
            id, assetId, assetCode, assetName, period, depreciationDate,
            periodDepreciation, accumulatedDepreciation, netValueAfter,
            unitsThisPeriod, unitDepreciationRate, voucherId, voucherNo,
            status, notes, accountSetId, createTime, updateTime
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        );
        stmt.run([
          record.id, record.assetId, record.assetCode, record.assetName,
          record.period, record.depreciationDate,
          record.periodDepreciation, record.accumulatedDepreciation, record.netValueAfter,
          record.unitsThisPeriod, record.unitDepreciationRate,
          record.voucherId, record.voucherNo, record.status, record.notes,
          record.accountSetId, record.createTime, record.updateTime,
        ]);
        stmt.free();
      }

      set((state) => ({
        depreciationRecords: [...state.depreciationRecords, ...records],
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '保存折旧记录失败' });
      throw error;
    }
  },

  // 记账折旧记录
  postDepreciationRecords: async (recordIds) => {
    const state = get();
    const records = state.depreciationRecords.filter(r => recordIds.includes(r.id));

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();

      for (const record of records) {
        // 更新折旧记录状态
        const stmt1 = db.prepare(
          'UPDATE depreciationRecords SET status = ?, updateTime = ? WHERE id = ?'
        );
        stmt1.run(['posted', new Date().toISOString(), record.id]);
        stmt1.free();

        // 更新资产的累计折旧
        const asset = state.assets.find(a => a.id === record.assetId);
        if (asset) {
          const newAccumulated = asset.accumulatedDepreciation + record.periodDepreciation;
          const newNetValue = asset.originalValue - newAccumulated;

          const stmt2 = db.prepare(
            `UPDATE fixedAssets SET
              accumulatedDepreciation = ?, netValue = ?, lastDepreciationDate = ?, updateTime = ?
            WHERE id = ?`
          );
          stmt2.run([newAccumulated, newNetValue, record.depreciationDate, new Date().toISOString(), asset.id]);
          stmt2.free();
        }
      }

      // 更新本地状态
      set((state) => ({
        depreciationRecords: state.depreciationRecords.map(r =>
          recordIds.includes(r.id) ? { ...r, status: 'posted' as const } : r
        ),
        assets: state.assets.map(a => {
          const relatedRecord = records.find(r => r.assetId === a.id);
          if (relatedRecord) {
            return {
              ...a,
              accumulatedDepreciation: a.accumulatedDepreciation + relatedRecord.periodDepreciation,
              netValue: a.originalValue - (a.accumulatedDepreciation + relatedRecord.periodDepreciation),
              lastDepreciationDate: relatedRecord.depreciationDate,
              updateTime: new Date().toISOString(),
            };
          }
          return a;
        }),
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '记账失败' });
      throw error;
    }
  },

  // 获取筛选后的资产
  getFilteredAssets: () => {
    const state = get();
    let filtered = state.assets;

    if (state.filter.category) {
      filtered = filtered.filter(a => a.categoryId === state.filter.category);
    }

    if (state.filter.status) {
      filtered = filtered.filter(a => a.status === state.filter.status);
    }

    if (state.filter.searchQuery) {
      const query = state.filter.searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.assetCode.toLowerCase().includes(query) ||
        a.assetName.toLowerCase().includes(query)
      );
    }

    return filtered;
  },

  // 获取在用资产
  getActiveAssets: () => {
    return get().assets.filter(a => a.status === 'active');
  },

  // 获取折旧历史
  getDepreciationHistory: (assetId) => {
    return get().depreciationRecords
      .filter(r => r.assetId === assetId)
      .sort((a, b) => a.period.localeCompare(b.period));
  },

  // 从Excel导入资产
  importAssetsFromExcel: async (importedAssets) => {
    const state = get();
    const errors: string[] = [];
    let success = 0;

    for (const item of importedAssets) {
      try {
        // 验证必填字段
        if (!item.assetName || !item.originalValue || !item.acquisitionDate) {
          errors.push(`行 ${importedAssets.indexOf(item) + 1}: 缺少必填字段`);
          continue;
        }

        // 检查编码是否重复
        if (item.assetCode && state.assets.some(a => a.assetCode === item.assetCode)) {
          errors.push(`行 ${importedAssets.indexOf(item) + 1}: 资产编码 ${item.assetCode} 已存在`);
          continue;
        }

        // 解析折旧方法
        const method: DepreciationMethod = item.depreciationMethod
          ? parseDepreciationMethod(item.depreciationMethod)
          : 'straight_line';

        // 查找分类
        const category = item.categoryName
          ? state.categories.find(c => c.name === item.categoryName)
          : undefined;

        // 创建资产
        await get().addAsset({
          assetCode: item.assetCode || `FA-${Date.now()}`,
          assetName: item.assetName,
          categoryId: category?.id,
          categoryName: category?.name,
          specification: item.specification,
          quantity: 1,
          originalValue: item.originalValue,
          salvageValue: item.salvageValue || 0,
          depreciableValue: item.originalValue - (item.salvageValue || 0),
          accumulatedDepreciation: 0,
          netValue: item.originalValue,
          depreciationMethod: method,
          usefulLifeYears: item.usefulLifeYears || category?.defaultUsefulLifeYears || 5,
          usefulLifeMonths: (item.usefulLifeYears || category?.defaultUsefulLifeYears || 5) * 12,
          acquisitionDate: item.acquisitionDate,
          departmentCode: item.departmentCode,
          expenseSubjectCode: item.expenseSubjectCode || category?.expenseSubjectCode || '660204',
          assetSubjectCode: category?.assetSubjectCode || '1501',
          depreciationSubjectCode: category?.depreciationSubjectCode || '1502',
          supplierName: item.supplierName,
          invoiceNo: item.invoiceNo,
          notes: item.notes,
        } as any);

        success++;
      } catch (error: any) {
        errors.push(`行 ${importedAssets.indexOf(item) + 1}: ${error.message}`);
      }
    }

    return { success, errors };
  },

  // 导出资产到Excel
  exportAssetsToExcel: (filter) => {
    const state = get();
    let assets = state.assets;

    if (filter) {
      if (filter.category) {
        assets = assets.filter(a => a.categoryId === filter.category);
      }
      if (filter.status) {
        assets = assets.filter(a => a.status === filter.status);
      }
    }

    return assets;
  },

  // 设置选中的资产ID
  setSelectedAssetId: (id) => {
    set({ selectedAssetId: id });
  },

  // 设置筛选条件
  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 初始化
  initialize: async () => {
    set({ loading: true, error: null });

    try {
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const accountSetId = currentAccountSet?.id;

      // 如果没有当前账套，设置空数据
      if (!accountSetId) {
        console.log('No current account set, setting empty data');
        set({
          assets: [],
          depreciationRecords: [],
          categories: [],
          loading: false,
        });
        return;
      }

      // 设置账套ID并获取数据库
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      sqliteService.setAccountSetId(currentAccountSet.id);

      // 使用 sqliteService.getDatabase() 获取数据库（带完整初始化和降级逻辑）
      const db = await sqliteService.getDatabase();

      if (!db) {
        console.error('数据库初始化失败');
        set({
          assets: [],
          depreciationRecords: [],
          categories: [],
          loading: false,
          error: '数据库初始化失败'
        });
        return;
      }

      // 加载分类
      const categoriesResult = db.exec(
        'SELECT * FROM assetCategories WHERE accountSetId = ? OR accountSetId IS NULL ORDER BY sortOrder',
        [accountSetId]
      );
      const categories: AssetCategory[] = categoriesResult[0]?.values?.map((row: any[]) => ({
        id: row[0],
        code: row[1],
        name: row[2],
        assetType: row[3],
        defaultUsefulLifeYears: row[4],
        defaultDepreciationMethod: row[5],
        defaultSalvageRate: row[6],
        assetSubjectCode: row[7],
        depreciationSubjectCode: row[8],
        expenseSubjectCode: row[9],
        description: row[10],
        sortOrder: row[11],
        enabled: row[12] === 1,
        accountSetId: row[13],
        createTime: row[14],
        updateTime: row[15],
      })) || [];

      // 加载资产
      const assetsResult = db.exec(
        'SELECT * FROM fixedAssets WHERE accountSetId = ? OR accountSetId IS NULL ORDER BY createTime DESC',
        [accountSetId]
      );
      const assets: FixedAsset[] = assetsResult[0]?.values?.map((row: any[]) => ({
        id: row[0],
        assetCode: row[1],
        assetName: row[2],
        categoryId: row[3],
        categoryName: row[4],
        specification: row[5],
        unit: row[6],
        quantity: row[7],
        originalValue: row[8],
        salvageValue: row[9],
        depreciableValue: row[10],
        accumulatedDepreciation: row[11],
        netValue: row[12],
        depreciationMethod: row[13],
        usefulLifeYears: row[14],
        usefulLifeMonths: row[15],
        totalUnits: row[16],
        unitsUsed: row[17],
        acquisitionDate: row[18],
        depreciationStartDate: row[19],
        lastDepreciationDate: row[20],
        disposalDate: row[21],
        status: row[22],
        location: row[23],
        departmentCode: row[24],
        departmentName: row[25],
        assetSubjectCode: row[26],
        assetSubjectName: row[27],
        depreciationSubjectCode: row[28],
        depreciationSubjectName: row[29],
        expenseSubjectCode: row[30],
        expenseSubjectName: row[31],
        supplierName: row[32],
        invoiceNo: row[33],
        notes: row[34],
        accountSetId: row[35],
        createTime: row[36],
        updateTime: row[37],
      })) || [];

      // 加载折旧记录
      const recordsResult = db.exec(
        'SELECT * FROM depreciationRecords WHERE accountSetId = ? OR accountSetId IS NULL ORDER BY period DESC',
        [accountSetId]
      );
      const depreciationRecords: DepreciationRecord[] = recordsResult[0]?.values?.map((row: any[]) => ({
        id: row[0],
        assetId: row[1],
        assetCode: row[2],
        assetName: row[3],
        period: row[4],
        depreciationDate: row[5],
        periodDepreciation: row[6],
        accumulatedDepreciation: row[7],
        netValueAfter: row[8],
        unitsThisPeriod: row[9],
        unitDepreciationRate: row[10],
        voucherId: row[11],
        voucherNo: row[12],
        status: row[13],
        notes: row[14],
        accountSetId: row[15],
        createTime: row[16],
        updateTime: row[17],
      })) || [];

      set({
        categories,
        assets,
        depreciationRecords,
        loading: false,
      });

      // 如果没有分类，初始化默认分类
      if (categories.length === 0) {
        await get().initializeDefaultCategories();
      }
    } catch (error: any) {
      console.error('初始化固定资产Store失败:', error);
      set({ loading: false, error: error.message || '初始化失败' });
    }
  },

  // 初始化默认分类
  initializeDefaultCategories: async () => {
    console.log('开始初始化默认分类...');
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();

    if (!currentAccountSet?.id) {
      console.warn('没有当前账套，跳过初始化默认分类');
      return;
    }

    try {
      // 使用与 initialize() 相同的方法获取数据库实例
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();

      if (!db) {
        console.error('无法获取数据库实例');
        return;
      }

      for (const category of DEFAULT_CATEGORIES) {
        // 检查分类是否已存在
        const existingResult = db.exec(
          'SELECT id FROM assetCategories WHERE code = ? AND accountSetId = ?',
          [category.code, currentAccountSet.id]
        );

        if (existingResult[0]?.values?.length > 0) {
          console.log('分类已存在，跳过:', category.code);
          continue;
        }

        try {
          console.log('正在添加分类:', category.code);
          await get().addCategory(category);
        } catch (error) {
          // 忽略唯一约束错误（分类可能已存在）
          if (String(error).includes('UNIQUE constraint')) {
            console.log('分类已存在:', category.code);
          } else {
            console.error('添加默认分类失败:', category.code, error);
          }
        }
      }
    } catch (error) {
      console.error('初始化默认分类时出错:', error);
    }

    console.log('默认分类初始化完成');
  },

  // 生成折旧凭证
  generateDepreciationVoucher: async (recordIds, voucherDate) => {
    const state = get();
    const records = state.depreciationRecords.filter(r => recordIds.includes(r.id));

    if (records.length === 0) {
      set({ error: '没有找到折旧记录' });
      return null;
    }

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const accountSetId = currentAccountSet?.id;

      // 生成凭证号
      const yearMonth = voucherDate.substring(0, 7).replace('-', '');
      const vouchersResult = db.exec(
        'SELECT voucherNo FROM vouchers WHERE voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1',
        [`记-${yearMonth}-%`]
      );
      let lastSeq = 0;
      if (vouchersResult[0]?.values?.length > 0) {
        const match = (vouchersResult[0].values[0][0] as string).match(/-(\d{3})$/);
        if (match) {
          lastSeq = parseInt(match[1], 10);
        }
      }
      const newSeq = lastSeq + 1;
      const voucherNo = `记-${yearMonth}-${String(newSeq).padStart(3, '0')}`;

      // 按费用科目分组汇总折旧金额
      const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

      for (const record of records) {
        const asset = state.assets.find(a => a.id === record.assetId);
        if (!asset) continue;

        const expenseCode = asset.expenseSubjectCode || '660204';
        const expenseName = asset.expenseSubjectName || '管理费用-折旧费';

        const existing = expenseMap.get(expenseCode);
        if (existing) {
          existing.amount += record.periodDepreciation;
        } else {
          expenseMap.set(expenseCode, {
            code: expenseCode,
            name: expenseName,
            amount: record.periodDepreciation,
          });
        }
      }

      // 计算总折旧额
      const totalDepreciation = records.reduce((sum, r) => sum + r.periodDepreciation, 0);

      // 生成凭证ID
      const voucherId = generateId();
      const now = new Date().toISOString();

      // 创建凭证
      const stmtVoucher = db.prepare(
        `INSERT INTO vouchers (id, voucherNo, date, status, summary, creator, accountSetId, createTime, updateTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmtVoucher.run([voucherId, voucherNo, voucherDate, 'draft', '固定资产折旧', 'system', accountSetId, now, now]);
      stmtVoucher.free();

      // 创建分录 - 借方：费用科目（按科目分组）
      for (const [, expense] of expenseMap) {
        const entryId = generateId();
        const stmtEntry = db.prepare(
          `INSERT INTO voucherEntries (id, voucherId, date, summary, subjectCode, subjectName, debit, credit, accountSetId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmtEntry.run([entryId, voucherId, voucherDate, '固定资产折旧', expense.code, expense.name, expense.amount, 0, accountSetId]);
        stmtEntry.free();
      }

      // 创建分录 - 贷方：累计折旧
      const creditEntryId = generateId();
      const stmtCredit = db.prepare(
        `INSERT INTO voucherEntries (id, voucherId, date, summary, subjectCode, subjectName, debit, credit, accountSetId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmtCredit.run([creditEntryId, voucherId, voucherDate, '固定资产折旧', '1502', '累计折旧', 0, totalDepreciation, accountSetId]);
      stmtCredit.free();

      // 更新折旧记录，关联凭证
      for (const record of records) {
        const stmtUpdate = db.prepare(
          'UPDATE depreciationRecords SET voucherId = ?, voucherNo = ?, updateTime = ? WHERE id = ?'
        );
        stmtUpdate.run([voucherId, voucherNo, now, record.id]);
        stmtUpdate.free();
      }

      // 更新本地状态
      set((state) => ({
        depreciationRecords: state.depreciationRecords.map(r =>
          recordIds.includes(r.id) ? { ...r, voucherId, voucherNo } : r
        ),
        error: null,
      }));

      return { voucherId, voucherNo };
    } catch (error: any) {
      set({ error: error.message || '生成折旧凭证失败' });
      throw error;
    }
  },
}));
