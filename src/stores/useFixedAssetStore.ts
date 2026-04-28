'use client';

import { create } from 'zustand';
import { useSubjectStore } from './useSubjectStore';
import { getCurrentManager } from '@/lib/database';
import { useAccountSetStore } from './useAccountSetStore';
import {
  calculateDepreciation,
  getDepreciationMethodName,
  parseDepreciationMethod,
} from '@/lib/depreciation';
import { CodeRuleManager, generateCode } from '@/lib/code-generator';
import type {
  FixedAsset,
  DepreciationRecord,
  AssetCategory,
  DepreciationResult,
  BatchDepreciationResult,
  AssetFilter,
  DepreciationMethod,
  AssetImprovement,
  AssetDisposal,
  AssetChangeRecord,
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
  subjectSplitEnabled: boolean;
  subSubjectSeparator: '' | '.' | '_';

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
  generateAcquisitionVoucher: (assetId: string, voucherDate?: string) => Promise<{ voucherId: string; voucherNo: string } | null>;

  // 资产生命周期管理
  improveAsset: (assetId: string, improvement: Omit<AssetImprovement, 'id' | 'createTime'>) => Promise<void>;
  disposeAsset: (assetId: string, disposal: Omit<AssetDisposal, 'id' | 'createTime' | 'disposedOriginalValue' | 'disposedAccumulatedDepreciation' | 'disposedNetValue' | 'netGainLoss'>) => Promise<void>;
  convertFromCIP: (cipData: { assetName: string; originalValue: number; acquisitionDate: string; cipSubjectCode: string; usefulLifeMonths: number; depreciationMethod: DepreciationMethod }) => Promise<FixedAsset>;

  // 变动记录
  getAssetChangeRecords: (assetId: string) => AssetChangeRecord[];
  logAssetChange: (record: Omit<AssetChangeRecord, 'id' | 'createTime'>) => Promise<void>;

  // 校验
  shouldDepreciateThisMonth: (assetId: string, period: string) => boolean;
  calculatePartialDisposal: (assetId: string, disposeQty: number) => { disposedOriginalValue: number; disposedAccumulatedDepreciation: number; disposedNetValue: number } | null;

  // 状态管理
  setSelectedAssetId: (id: string | null) => void;
  setFilter: (filter: Partial<AssetFilter>) => void;
  setSubjectSplitEnabled: (enabled: boolean) => void;
  setSubSubjectSeparator: (separator: '' | '.' | '_') => void;
  clearError: () => void;
  initialize: () => Promise<void>;
  initializeDefaultCategories: () => Promise<void>;
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 生成下一个子科目编码
function generateNextSubCode(
  subjects: { code: string }[],
  parentCode: string,
  separator: '' | '.' | '_',
): string {
  const suffixLen = 2;

  const regex = new RegExp(`^${escapeRegex(parentCode)}${escapeRegex(separator)}(\\d+)$`);
  const existingNums = subjects
    .filter(s => regex.test(s.code))
    .map(s => parseInt(s.code.match(regex)![1], 10));

  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
  return `${parentCode}${separator}${String(nextNum).padStart(suffixLen, '0')}`;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 为分类创建子科目（科目拆分明细模式）
async function createSubSubjectsForCategory(category: AssetCategory) {
  const subjectStore = useSubjectStore.getState();
  const subjects = subjectStore.subjects;
  const separator = useFixedAssetStore.getState().subSubjectSeparator;

  const subSubjectConfigs = [
    { parentCode: category.assetSubjectCode, name: category.name },
    { parentCode: category.depreciationSubjectCode, name: `${category.name}累计折旧` },
  ];

  for (const config of subSubjectConfigs) {
    if (!config.parentCode) continue;
    const subCode = generateNextSubCode(subjects, config.parentCode, separator);
    // 检查子科目是否已存在
    if (subjects.some(s => s.code === subCode)) continue;
    // 查找父科目
    const parent = subjects.find(s => s.code === config.parentCode);
    if (!parent) continue;

    await subjectStore.addSubject({
      code: subCode,
      name: config.name,
      direction: parent.direction,
      parentId: parent.id,
      level: (parent.level || 1) + 1,
    } as any);
  }
}

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
  subjectSplitEnabled: false,
  subSubjectSeparator: '',
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

    // 自动生成编码（如果未提供且规则为自动编码）
    let assetCode = assetData.assetCode;
    const codeManager = CodeRuleManager.getInstance();
    const rule = codeManager.getRuleByType('fixed_asset');

    if (!assetCode && rule.autoIncrement) {
      const existingCodes = state.assets.map(a => a.assetCode).filter(Boolean);
      const result = generateCode(rule, existingCodes);
      assetCode = result.code;
      // 更新规则状态
      codeManager.setRule(result.updatedRule);
    }

    // 如果没有编码且不是自动编码模式，提示用户输入
    if (!assetCode) {
      const error = '请输入资产编码';
      set({ error });
      throw new Error(error);
    }

    // 检查编码是否重复
    if (state.assets.some(a => a.assetCode === assetCode)) {
      const error = '资产编码已存在';
      set({ error });
      throw new Error(error);
    }

    const now = new Date().toISOString();
    // 将 undefined/空字符串 转为 null，避免 SQL.js 报错和外键约束失败
    const safeValue = <T,>(v: T | undefined): T | null => (v === undefined || v === '') ? null : v;

    // 生成唯一ID
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

    // 计算单价和默认值
    const quantity = assetData.quantity || 1;
    const unitPrice = assetData.unitPrice || (assetData.originalValue / quantity);

    const newAsset: FixedAsset = {
      ...assetData,
      id,
      assetCode,
      quantity,
      remainingQuantity: assetData.remainingQuantity || quantity,
      unitPrice,
      unit: assetData.unit || '台',
      acquisitionType: assetData.acquisitionType || 'purchase',
      depreciableValue: assetData.originalValue - (assetData.salvageValue || 0),
      netValue: assetData.originalValue - (assetData.accumulatedDepreciation || 0),
      depreciatedMonths: assetData.depreciatedMonths || 0,
      improvementHistory: assetData.improvementHistory || [],
      disposalHistory: assetData.disposalHistory || [],
      status: assetData.status || 'active',
      accountingStatus: assetData.accountingStatus || 'pending',
      accountSetId: currentAccountSet?.id,
      createTime: now,
      updateTime: now,
    };

    try {
      // 保存到数据库
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      sqliteService.setAccountSetId(currentAccountSet.id);
      const db = await sqliteService.getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }
      const stmt = db.prepare(
        `INSERT INTO fixedAssets (
          id, assetCode, assetName, categoryId, categoryName, specification, unit, quantity,
          remainingQuantity, unitPrice,
          originalValue, salvageValue, depreciableValue, accumulatedDepreciation, netValue,
          depreciationMethod, usefulLifeYears, usefulLifeMonths, originalUsefulLifeMonths, depreciatedMonths,
          totalUnits, unitsUsed,
          acquisitionDate, depreciationStartDate, lastDepreciationDate, disposalDate,
          status, location, departmentCode, departmentName,
          assetSubjectCode, assetSubjectName, depreciationSubjectCode, depreciationSubjectName,
          expenseSubjectCode, expenseSubjectName,
          cipSubjectCode, cipSubjectName, disposalSubjectCode, disposalSubjectName,
          acquisitionType, sourceInvoiceId, sourceVoucherId,
          serialNumber, assignedUser,
          improvementHistory, disposalHistory,
          supplierName, invoiceNo, notes,
          accountingStatus, acquisitionVoucherId, acquisitionVoucherNo,
          isOpeningBalance, initialAccumulatedDepreciation,
          creditSubjectCode, creditSubjectName,
          projectCode, projectName,
          assetType, depreciationEndDate, remainingDepreciationMonths,
          accountSetId, createTime, updateTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        newAsset.id, newAsset.assetCode, newAsset.assetName,
        safeValue(newAsset.categoryId), safeValue(newAsset.categoryName),
        safeValue(newAsset.specification), safeValue(newAsset.unit), safeValue(newAsset.quantity),
        safeValue(newAsset.remainingQuantity), safeValue(newAsset.unitPrice),
        newAsset.originalValue, safeValue(newAsset.salvageValue), newAsset.depreciableValue,
        safeValue(newAsset.accumulatedDepreciation), newAsset.netValue,
        safeValue(newAsset.depreciationMethod), safeValue(newAsset.usefulLifeYears), safeValue(newAsset.usefulLifeMonths),
        safeValue(newAsset.originalUsefulLifeMonths), safeValue(newAsset.depreciatedMonths),
        safeValue(newAsset.totalUnits), safeValue(newAsset.unitsUsed),
        safeValue(newAsset.acquisitionDate), safeValue(newAsset.depreciationStartDate), safeValue(newAsset.lastDepreciationDate),
        safeValue(newAsset.disposalDate), newAsset.status, safeValue(newAsset.location),
        safeValue(newAsset.departmentCode), safeValue(newAsset.departmentName),
        safeValue(newAsset.assetSubjectCode), safeValue(newAsset.assetSubjectName),
        safeValue(newAsset.depreciationSubjectCode), safeValue(newAsset.depreciationSubjectName),
        safeValue(newAsset.expenseSubjectCode), safeValue(newAsset.expenseSubjectName),
        safeValue(newAsset.cipSubjectCode), safeValue(newAsset.cipSubjectName),
        safeValue(newAsset.disposalSubjectCode), safeValue(newAsset.disposalSubjectName),
        safeValue(newAsset.acquisitionType), safeValue(newAsset.sourceInvoiceId), safeValue(newAsset.sourceVoucherId),
        safeValue(newAsset.serialNumber), safeValue(newAsset.assignedUser),
        JSON.stringify(newAsset.improvementHistory || []), JSON.stringify(newAsset.disposalHistory || []),
        safeValue(newAsset.supplierName), safeValue(newAsset.invoiceNo), safeValue(newAsset.notes),
        safeValue(newAsset.accountingStatus), safeValue(newAsset.acquisitionVoucherId), safeValue(newAsset.acquisitionVoucherNo),
        safeValue(newAsset.isOpeningBalance ? 1 : 0), safeValue(newAsset.initialAccumulatedDepreciation),
        safeValue(newAsset.creditSubjectCode), safeValue(newAsset.creditSubjectName),
        safeValue(newAsset.projectCode), safeValue(newAsset.projectName),
        safeValue(newAsset.assetType), safeValue(newAsset.depreciationEndDate), safeValue(newAsset.remainingDepreciationMonths),
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
      // 将 undefined/空字符串 转为 null，避免 SQL.js 报错和外键约束失败
      const safeValue = <T,>(v: T | undefined): T | null => (v === undefined || v === '') ? null : v;
      const stmt = db.prepare(
        `UPDATE fixedAssets SET
          assetName=?, categoryId=?, categoryName=?, specification=?, unit=?, quantity=?,
          remainingQuantity=?, unitPrice=?,
          originalValue=?, salvageValue=?, depreciableValue=?, accumulatedDepreciation=?, netValue=?,
          depreciationMethod=?, usefulLifeYears=?, usefulLifeMonths=?, originalUsefulLifeMonths=?, depreciatedMonths=?,
          totalUnits=?, unitsUsed=?,
          acquisitionDate=?, depreciationStartDate=?, lastDepreciationDate=?, disposalDate=?,
          status=?, location=?, departmentCode=?, departmentName=?,
          assetSubjectCode=?, assetSubjectName=?, depreciationSubjectCode=?, depreciationSubjectName=?,
          expenseSubjectCode=?, expenseSubjectName=?,
          cipSubjectCode=?, cipSubjectName=?, disposalSubjectCode=?, disposalSubjectName=?,
          acquisitionType=?, sourceInvoiceId=?, sourceVoucherId=?,
          serialNumber=?, assignedUser=?,
          improvementHistory=?, disposalHistory=?,
          supplierName=?, invoiceNo=?, notes=?,
          updateTime=?
        WHERE id=?`
      );
      stmt.run([
        updatedAsset.assetName, safeValue(updatedAsset.categoryId), safeValue(updatedAsset.categoryName),
        safeValue(updatedAsset.specification), safeValue(updatedAsset.unit), safeValue(updatedAsset.quantity),
        safeValue(updatedAsset.remainingQuantity), safeValue(updatedAsset.unitPrice),
        updatedAsset.originalValue, safeValue(updatedAsset.salvageValue), updatedAsset.depreciableValue,
        safeValue(updatedAsset.accumulatedDepreciation), updatedAsset.netValue,
        safeValue(updatedAsset.depreciationMethod), safeValue(updatedAsset.usefulLifeYears), safeValue(updatedAsset.usefulLifeMonths),
        safeValue(updatedAsset.originalUsefulLifeMonths), safeValue(updatedAsset.depreciatedMonths),
        safeValue(updatedAsset.totalUnits), safeValue(updatedAsset.unitsUsed),
        safeValue(updatedAsset.acquisitionDate), safeValue(updatedAsset.depreciationStartDate),
        safeValue(updatedAsset.lastDepreciationDate), safeValue(updatedAsset.disposalDate),
        updatedAsset.status, safeValue(updatedAsset.location),
        safeValue(updatedAsset.departmentCode), safeValue(updatedAsset.departmentName),
        safeValue(updatedAsset.assetSubjectCode), safeValue(updatedAsset.assetSubjectName),
        safeValue(updatedAsset.depreciationSubjectCode), safeValue(updatedAsset.depreciationSubjectName),
        safeValue(updatedAsset.expenseSubjectCode), safeValue(updatedAsset.expenseSubjectName),
        safeValue(updatedAsset.cipSubjectCode), safeValue(updatedAsset.cipSubjectName),
        safeValue(updatedAsset.disposalSubjectCode), safeValue(updatedAsset.disposalSubjectName),
        safeValue(updatedAsset.acquisitionType), safeValue(updatedAsset.sourceInvoiceId), safeValue(updatedAsset.sourceVoucherId),
        safeValue(updatedAsset.serialNumber), safeValue(updatedAsset.assignedUser),
        JSON.stringify(updatedAsset.improvementHistory || []), JSON.stringify(updatedAsset.disposalHistory || []),
        safeValue(updatedAsset.supplierName), safeValue(updatedAsset.invoiceNo), safeValue(updatedAsset.notes),
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

      // 科目拆分明细：自动创建子科目
      if (get().subjectSplitEnabled) {
        await createSubSubjectsForCategory(newCategory);
      }

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
      // 将 undefined/空字符串 转为 null，避免 SQL.js 报错和外键约束失败
      const safeValue = <T,>(v: T | undefined): T | null => (v === undefined || v === '') ? null : v;

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
          safeValue(record.unitsThisPeriod), safeValue(record.unitDepreciationRate),
          safeValue(record.voucherId), safeValue(record.voucherNo), record.status, safeValue(record.notes),
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

  // 设置科目拆分明细开关
  setSubjectSplitEnabled: (enabled) => {
    set({ subjectSplitEnabled: enabled });
  },

  // 设置子科目分隔符
  setSubSubjectSeparator: (separator) => {
    set({ subSubjectSeparator: separator });
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
        unit: row[6] || '台',
        quantity: row[7] || 1,
        remainingQuantity: row[38] || row[7] || 1, // 新字段，兼容旧数据
        unitPrice: row[39] || (row[8] / (row[7] || 1)),
        originalValue: row[8],
        salvageValue: row[9],
        depreciableValue: row[10],
        accumulatedDepreciation: row[11],
        netValue: row[12],
        depreciationMethod: row[13],
        usefulLifeYears: row[14],
        usefulLifeMonths: row[15],
        originalUsefulLifeMonths: row[40] || row[15],
        depreciatedMonths: row[41] || 0,
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
        cipSubjectCode: row[42],
        cipSubjectName: row[43],
        disposalSubjectCode: row[44],
        disposalSubjectName: row[45],
        acquisitionType: row[46] || 'purchase',
        sourceInvoiceId: row[47],
        sourceVoucherId: row[48],
        serialNumber: row[49],
        assignedUser: row[50],
        improvementHistory: JSON.parse(row[51] || '[]'),
        disposalHistory: JSON.parse(row[52] || '[]'),
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
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const accountSetId = currentAccountSet?.id;

      if (!accountSetId) {
        set({ error: '请先选择账套' });
        return null;
      }

      sqliteService.setAccountSetId(accountSetId);
      const db = await sqliteService.getDatabase();
      if (!db) {
        set({ error: '数据库未初始化' });
        return null;
      }

      // 生成凭证号
      const yearMonth = voucherDate.substring(0, 7).replace('-', '');
      const vouchersResult = db.exec(
        'SELECT voucherNo FROM vouchers WHERE accountSetId = ? AND voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1',
        [accountSetId, `记-${yearMonth}-%`]
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
          `INSERT INTO entries (
            id, voucherId, subjectCode, subjectName, direction, debit, credit,
            summary, customerName, supplierName, auxiliary, recRefNo,
            departmentCode, departmentName, projectCode, projectName,
            currencyCode, exchangeRate, originalAmount, date, accountSetId,
            createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmtEntry.run([
          entryId, voucherId, expense.code, expense.name, 'debit', expense.amount, 0,
          '固定资产折旧', '', '', '{}', '',
          '', '', '', '',
          '', 0, 0, voucherDate, accountSetId,
          now, now
        ]);
        stmtEntry.free();
      }

      // 创建分录 - 贷方：累计折旧
      const creditEntryId = generateId();
      const stmtCredit = db.prepare(
        `INSERT INTO entries (
          id, voucherId, subjectCode, subjectName, direction, debit, credit,
          summary, customerName, supplierName, auxiliary, recRefNo,
          departmentCode, departmentName, projectCode, projectName,
          currencyCode, exchangeRate, originalAmount, date, accountSetId,
          createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmtCredit.run([
        creditEntryId, voucherId, '1502', '累计折旧', 'credit', 0, totalDepreciation,
        '固定资产折旧', '', '', '{}', '',
        '', '', '', '',
        '', 0, 0, voucherDate, accountSetId,
        now, now
      ]);
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

  // 生成取得凭证
  generateAcquisitionVoucher: async (assetId, voucherDate) => {
    const state = get();
    const asset = state.assets.find(a => a.id === assetId);

    if (!asset) {
      set({ error: '资产不存在' });
      return null;
    }

    if (asset.acquisitionType === 'opening_balance' || asset.acquisitionType === 'invoice') {
      return null;
    }

    try {
      const { getRuleByAcquisitionType } = await import('@/lib/asset-acquisition-rule');
      const rule = getRuleByAcquisitionType(asset.acquisitionType);

      if (!rule || !rule.creditSubjectCode) {
        return null;
      }

      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const { getCurrentService } = await import('@/lib/database');
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const accountSetId = currentAccountSet?.id;

      if (!accountSetId) {
        set({ error: '请先选择账套' });
        return null;
      }

      sqliteService.setAccountSetId(accountSetId);

      const vouchDate = voucherDate || asset.acquisitionDate;
      const now = new Date().toISOString();
      const voucherId = generateId();
      const summary = `取得固定资产-${asset.assetName}`;

      const debitSubjectCode = asset.assetSubjectCode || rule.debitSubjectCode;
      const debitSubjectName = asset.assetSubjectName || rule.debitSubjectName;

      // 生成凭证号
      const db = await sqliteService.getDatabase();
      if (!db) {
        set({ error: '数据库未初始化' });
        return null;
      }
      const yearMonth = vouchDate.substring(0, 7).replace('-', '');
      const vouchersResult = db.exec(
        'SELECT voucherNo FROM vouchers WHERE accountSetId = ? AND voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1',
        [accountSetId, `记-${yearMonth}-%`]
      );
      let nextNum = 1;
      if (vouchersResult.length > 0 && vouchersResult[0].values.length > 0) {
        const lastNo = (vouchersResult[0].values[0] as string)[0];
        const match = lastNo.match(/记-\d{6}-(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      const voucherNo = `记-${yearMonth}-${String(nextNum).padStart(3, '0')}`;

      // 通过 sqliteService.saveVoucher 保存凭证和分录
      const newVoucher = {
        id: voucherId,
        voucherNo,
        date: vouchDate,
        summary,
        entries: [
          {
            id: generateId(),
            voucherId,
            date: vouchDate,
            summary,
            subjectCode: debitSubjectCode,
            subjectName: debitSubjectName,
            debit: asset.originalValue,
            credit: 0,
          },
          {
            id: generateId(),
            voucherId,
            date: vouchDate,
            summary,
            subjectCode: rule.creditSubjectCode,
            subjectName: rule.creditSubjectName,
            debit: 0,
            credit: asset.originalValue,
          },
        ],
        status: 'posted' as const,
        voucherType: 'general' as const,
        createdBy: 'system',
        createTime: now,
        updateTime: now,
      };

      await getCurrentService().saveVoucher(newVoucher);

      // 同步到 useVoucherStore 状态，使凭证列表立即可见
      const { useVoucherStore } = await import('@/stores/useVoucherStore');
      useVoucherStore.setState((prev) => ({
        vouchers: [...prev.vouchers, newVoucher],
      }));

      // 更新资产的凭证信息
      await get().updateAsset(assetId, {
        acquisitionVoucherId: voucherId,
        acquisitionVoucherNo: voucherNo,
        accountingStatus: 'accounted',
      });

      // 记录变动：取得成本入账
      const accountSetStore2 = useAccountSetStore.getState();
      await get().logAssetChange({
        assetId,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        accountSetId: accountSetStore2.getCurrentAccountSet()?.id || '',
        changeType: 'acquisition',
        changeDate: vouchDate,
        period: vouchDate.substring(0, 7),
        fieldName: 'accountingStatus',
        beforeValue: 'pending',
        afterValue: 'accounted',
        voucherId,
        voucherNo,
        reason: `取得成本入账，原值 ¥${asset.originalValue.toLocaleString()}`,
      });

      return { voucherId, voucherNo };
    } catch (error: any) {
      set({ error: error.message || '生成取得凭证失败' });
      throw error;
    }
  },

  // 当月新增不折旧校验
  shouldDepreciateThisMonth: (assetId, period) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset) return false;

    // 未入账资产禁止折旧
    if (asset.accountingStatus === 'pending') return false;

    // 获取取得期间的年月（YYYY-MM）
    const acquisitionPeriod = asset.acquisitionDate.substring(0, 7);
    // 当月新增，下月开始折旧
    return period > acquisitionPeriod;
  },

  // 部分处置计算
  calculatePartialDisposal: (assetId, disposeQty) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset || asset.quantity < 1) return null;

    if (disposeQty <= 0 || disposeQty > asset.remainingQuantity) {
      return null;
    }

    // 按比例计算处置金额
    const ratio = disposeQty / asset.quantity;
    return {
      disposedOriginalValue: asset.originalValue * ratio,
      disposedAccumulatedDepreciation: asset.accumulatedDepreciation * ratio,
      disposedNetValue: asset.netValue * ratio,
    };
  },

  // 资产改造
  improveAsset: async (assetId, improvement) => {
    const state = get();
    const asset = state.assets.find(a => a.id === assetId);
    if (!asset) {
      set({ error: '资产不存在' });
      return;
    }

    const now = new Date().toISOString();
    const improvementRecord: AssetImprovement = {
      ...improvement,
      id: generateId(),
      createTime: now,
    };

    // 计算新的原值和使用年限
    const newOriginalValue = asset.originalValue + improvement.addedValue;
    const newUsefulLifeMonths = asset.usefulLifeMonths + improvement.extendedMonths;

    // 重新计算应计折旧额
    const newDepreciableValue = newOriginalValue - asset.salvageValue;

    const updatedAsset: FixedAsset = {
      ...asset,
      originalValue: newOriginalValue,
      depreciableValue: newDepreciableValue,
      netValue: newOriginalValue - asset.accumulatedDepreciation,
      usefulLifeMonths: newUsefulLifeMonths,
      originalUsefulLifeMonths: asset.originalUsefulLifeMonths || asset.usefulLifeMonths,
      improvementHistory: [...(asset.improvementHistory || []), improvementRecord],
      updateTime: now,
    };

    try {
      await get().updateAsset(assetId, updatedAsset);

      // 记录变动
      await get().logAssetChange({
        assetId,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        accountSetId: asset.accountSetId || '',
        changeType: 'improvement',
        changeDate: improvement.date,
        period: improvement.date.substring(0, 7),
        fieldName: 'originalValue',
        beforeValue: String(asset.originalValue),
        afterValue: String(newOriginalValue),
        voucherId: improvement.voucherId,
        voucherNo: improvement.voucherNo,
        reason: improvement.reason,
      });
    } catch (error: any) {
      set({ error: error.message || '资产改造失败' });
      throw error;
    }
  },

  // 资产处置
  disposeAsset: async (assetId, disposal) => {
    const state = get();
    const asset = state.assets.find(a => a.id === assetId);
    if (!asset) {
      set({ error: '资产不存在' });
      return;
    }

    // 计算处置金额
    const disposalCalc = get().calculatePartialDisposal(assetId, disposal.quantity);
    if (!disposalCalc) {
      set({ error: '处置数量无效' });
      return;
    }

    const now = new Date().toISOString();
    const netGainLoss = disposal.disposalIncome - disposal.disposalExpense - disposalCalc.disposedNetValue;

    const disposalRecord: AssetDisposal = {
      ...disposal,
      id: generateId(),
      disposedOriginalValue: disposalCalc.disposedOriginalValue,
      disposedAccumulatedDepreciation: disposalCalc.disposedAccumulatedDepreciation,
      disposedNetValue: disposalCalc.disposedNetValue,
      netGainLoss,
      createTime: now,
    };

    // 更新资产
    const newRemainingQty = asset.remainingQuantity - disposal.quantity;
    const ratio = disposal.quantity / asset.quantity;
    const updatedAsset: FixedAsset = {
      ...asset,
      remainingQuantity: newRemainingQty,
      originalValue: asset.originalValue - disposalCalc.disposedOriginalValue,
      accumulatedDepreciation: asset.accumulatedDepreciation - disposalCalc.disposedAccumulatedDepreciation,
      netValue: asset.netValue - disposalCalc.disposedNetValue,
      depreciableValue: asset.depreciableValue - disposalCalc.disposedOriginalValue,
      disposalHistory: [...(asset.disposalHistory || []), disposalRecord],
      disposalDate: newRemainingQty === 0 ? disposal.date : asset.disposalDate,
      status: newRemainingQty === 0 ? 'disposed' : asset.status,
      updateTime: now,
    };

    try {
      await get().updateAsset(assetId, updatedAsset);

      // 记录变动
      await get().logAssetChange({
        assetId,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        accountSetId: asset.accountSetId || '',
        changeType: 'disposal',
        changeDate: disposal.date,
        period: disposal.date.substring(0, 7),
        fieldName: 'status',
        beforeValue: asset.status,
        afterValue: updatedAsset.status,
        voucherId: disposal.voucherIds?.[0],
        voucherNo: disposal.voucherNos?.[0],
        reason: disposal.reason,
      });
    } catch (error: any) {
      set({ error: error.message || '资产处置失败' });
      throw error;
    }
  },

  // 在建转固
  convertFromCIP: async (cipData) => {
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();

    if (!currentAccountSet?.id) {
      set({ error: '请先选择账套' });
      throw new Error('请先选择账套');
    }

    const newAsset = await get().addAsset({
      assetCode: '', // 自动生成
      assetName: cipData.assetName,
      quantity: 1,
      remainingQuantity: 1,
      unit: '套',
      unitPrice: cipData.originalValue,
      originalValue: cipData.originalValue,
      salvageValue: 0,
      depreciableValue: cipData.originalValue,
      accumulatedDepreciation: 0,
      netValue: cipData.originalValue,
      depreciationMethod: cipData.depreciationMethod,
      usefulLifeYears: Math.floor(cipData.usefulLifeMonths / 12),
      usefulLifeMonths: cipData.usefulLifeMonths,
      acquisitionDate: cipData.acquisitionDate,
      acquisitionType: 'cip_conversion',
      cipSubjectCode: cipData.cipSubjectCode,
      assetSubjectCode: '1501',
      depreciationSubjectCode: '1502',
      expenseSubjectCode: '660204',
      status: 'active',
      accountSetId: currentAccountSet.id,
    } as any);

    return newAsset;
  },

  // 获取资产变动记录
  getAssetChangeRecords: (assetId) => {
    // 从内存中获取（如果已加载）
    return [];
  },

  // 记录资产变动
  logAssetChange: async (record) => {
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

      const now = new Date().toISOString();
      const id = generateId();

      const stmt = db.prepare(
        `INSERT INTO assetChangeRecords (
          id, assetId, assetCode, assetName, accountSetId, changeType, changeDate, period,
          fieldName, beforeValue, afterValue, voucherId, voucherNo, reason, operatorId, createTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        id, record.assetId, record.assetCode, record.assetName, record.accountSetId,
        record.changeType, record.changeDate, record.period,
        record.fieldName, record.beforeValue || '', record.afterValue || '',
        record.voucherId || '', record.voucherNo || '', record.reason || '', record.operatorId || '',
        now,
      ]);
      stmt.free();
    } catch (error: any) {
      console.warn('记录资产变动失败:', error);
    }
  },
}));
