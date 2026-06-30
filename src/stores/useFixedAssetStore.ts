'use client';

import { create } from 'zustand';
import { useSubjectStore } from './useSubjectStore';
import { useSettingsStore } from './useSettingsStore';
import { getCurrentService, getCurrentManager } from '@/lib/database';
import { useAccountSetStore } from './useAccountSetStore';
import {
  calculateDepreciation,
  getDepreciationMethodName,
  parseDepreciationMethod,
} from '@/lib/depreciation';
import { CodeRuleManager, generateCode } from '@/lib/code-generator';
import { ACCOUNT_CODES } from '@/lib/accounting';
import { getDefaultAssetTypeSubjectConfig, refreshVoucherStore, getErrorMessage } from '@/lib/utils';
import { getAssetDatePeriod, normalizeAssetDate } from '@/lib/asset-date';
import type { SqliteBindable } from '@/lib/database/services/fixed-asset-sqlite-service';
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
  AssetFinancialSettings,
} from '@/types';
import type {
  AssetVoucherPreviewData,
  AssetVoucherPreviewEntry,
} from '@/components/assets/asset-voucher-preview-dialog';

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
  requireDepartment: boolean; // 入账时部门是否必填（全局设置）

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

  // 凭证预览
  getDisposalVoucherPreview: (assetId: string, disposal: { date: string; type: string; quantity: number; disposalIncome: number; disposalExpense: number; reason: string }) => AssetVoucherPreviewData[];
  getImprovementVoucherPreview: (assetId: string, improvement: { date: string; type: string; amount: number }) => AssetVoucherPreviewData[];

  // 资产生命周期管理
  improveAsset: (assetId: string, improvement: Omit<AssetImprovement, 'id' | 'createTime'>) => Promise<void>;
  disposeAsset: (assetId: string, disposal: Omit<AssetDisposal, 'id' | 'createTime' | 'disposedOriginalValue' | 'disposedAccumulatedDepreciation' | 'disposedNetValue' | 'netGainLoss'>) => Promise<void>;
  convertFromCIP: (cipData: { assetName: string; originalValue: number; acquisitionDate: string; cipSubjectCode: string; usefulLifeMonths: number; depreciationMethod: DepreciationMethod }) => Promise<FixedAsset>;

  // 资产拆分与合并
  splitAsset: (assetId: string, options: { date: string; method: 'average' | 'percentage'; count: number; percentages?: number[]; reason: string }) => Promise<FixedAsset[]>;
  mergeAssets: (assetIds: string[], options: { date: string; departmentCode: string; categoryId?: string; reason: string }) => Promise<FixedAsset>;

  // 变动记录
  getAssetChangeRecords: (assetId: string) => Promise<AssetChangeRecord[]>;
  logAssetChange: (record: Omit<AssetChangeRecord, 'id' | 'createTime'>) => Promise<void>;
  clearAssetChangeRecords: (assetId: string) => Promise<void>;
  reverseAssetChangesByVoucherId: (
    originalVoucherId: string,
    reversedVoucherId: string,
    reversedVoucherNo: string,
    reversalDate: string
  ) => Promise<void>;

  // 校验
  shouldDepreciateThisMonth: (assetId: string, period: string) => boolean;
  calculatePartialDisposal: (assetId: string, disposeQty: number) => { disposedOriginalValue: number; disposedAccumulatedDepreciation: number; disposedNetValue: number } | null;

  // 状态管理
  setSelectedAssetId: (id: string | null) => void;
  setFilter: (filter: Partial<AssetFilter>) => void;
  setSubjectSplitEnabled: (enabled: boolean) => void;
  setSubSubjectSeparator: (separator: '' | '.' | '_') => void;
  setRequireDepartment: (required: boolean) => void;
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

// 生成处置凭证预览数据
function generateDisposalPreviewData(
  asset: FixedAsset,
  disposal: { disposedOriginalValue: number; disposedAccumulatedDepreciation: number; disposedNetValue: number; disposalIncome: number; disposalExpense: number; netGainLoss: number },
  date: string,
  settings: AssetFinancialSettings,
  assetType: 'fixed' | 'intangible' = 'fixed'
): AssetVoucherPreviewData[] {
  // 获取对应资产类型的科目配置
  const typeConfig = settings.subjectConfigs?.find(c => c.assetType === assetType)
    || getDefaultAssetTypeSubjectConfig(assetType);

  const clearingSubjectName = assetType === 'fixed' ? '固定资产清理' : '无形资产清理';

  const vouchers: AssetVoucherPreviewData[] = [];
  const entries: AssetVoucherPreviewEntry[] = [
    {
      summary: `${asset.assetName}处置转入清理`,
      subjectCode: typeConfig.clearingSubjectCode,
      subjectName: clearingSubjectName,
      debit: disposal.disposedNetValue,
      credit: 0,
    },
    {
      summary: `${asset.assetName}处置结转累计折旧`,
      subjectCode: asset.depreciationSubjectCode || ACCOUNT_CODES.ACCUMULATED_DEPRECIATION,
      subjectName: asset.depreciationSubjectName || '累计折旧',
      debit: disposal.disposedAccumulatedDepreciation,
      credit: 0,
    },
    {
      summary: `${asset.assetName}处置减少`,
      subjectCode: asset.assetSubjectCode || (assetType === 'fixed' ? ACCOUNT_CODES.FIXED_ASSET : ACCOUNT_CODES.INTANGIBLE_ASSET),
      subjectName: asset.assetSubjectName || (assetType === 'fixed' ? '固定资产' : '无形资产'),
      debit: 0,
      credit: disposal.disposedOriginalValue,
    },
  ];

  if (disposal.disposalIncome > 0) {
    entries.push({
      summary: `${asset.assetName}处置收入`,
      subjectCode: ACCOUNT_CODES.BANK,
      subjectName: '银行存款',
      debit: disposal.disposalIncome,
      credit: 0,
    });
    entries.push({
      summary: `${asset.assetName}处置收入`,
      subjectCode: typeConfig.clearingSubjectCode,
      subjectName: clearingSubjectName,
      debit: 0,
      credit: disposal.disposalIncome,
    });
  }

  if (disposal.disposalExpense > 0) {
    entries.push({
      summary: `${asset.assetName}处置费用`,
      subjectCode: typeConfig.clearingSubjectCode,
      subjectName: clearingSubjectName,
      debit: disposal.disposalExpense,
      credit: 0,
    });
    entries.push({
      summary: `支付${asset.assetName}处置费用`,
      subjectCode: ACCOUNT_CODES.BANK,
      subjectName: '银行存款',
      debit: 0,
      credit: disposal.disposalExpense,
    });
  }

  if (disposal.netGainLoss !== 0) {
    if (disposal.netGainLoss > 0) {
      entries.push({
        summary: `${asset.assetName}处置净收益`,
        subjectCode: typeConfig.clearingSubjectCode,
        subjectName: clearingSubjectName,
        debit: 0,
        credit: disposal.netGainLoss,
      });
      entries.push({
        summary: `${asset.assetName}处置收益`,
        subjectCode: typeConfig.gainSubjectCode,
        subjectName: '营业外收入',
        debit: 0,
        credit: disposal.netGainLoss,
      });
    } else {
      const lossAmount = Math.abs(disposal.netGainLoss);
      entries.push({
        summary: `${asset.assetName}处置损失`,
        subjectCode: typeConfig.lossSubjectCode,
        subjectName: '营业外支出',
        debit: lossAmount,
        credit: 0,
      });
      entries.push({
        summary: `${asset.assetName}处置净损失`,
        subjectCode: typeConfig.clearingSubjectCode,
        subjectName: clearingSubjectName,
        debit: 0,
        credit: lossAmount,
      });
    }
  }

  let totalDebit = 0, totalCredit = 0;
  for (const e of entries) {
    totalDebit += e.debit;
    totalCredit += e.credit;
  }
  vouchers.push({ voucherDate: date, entries, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 });

  return vouchers;
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
    depreciationStartRule: 'next_month',
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
    depreciationStartRule: 'next_month',
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
    depreciationStartRule: 'next_month',
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
    depreciationStartRule: 'next_month',
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
    depreciationStartRule: 'next_month',
    assetSubjectCode: '1501',
    depreciationSubjectCode: '1502',
    expenseSubjectCode: '660204',
    description: '包括厂房、办公楼、仓库等建筑物',
    sortOrder: 5,
    enabled: true,
  },
  {
    code: 'INTANGIBLE',
    name: '无形资产',
    assetType: 'intangible',
    defaultUsefulLifeYears: 10,
    defaultDepreciationMethod: 'straight_line',
    defaultSalvageRate: 0,
    depreciationStartRule: 'current_month',
    assetSubjectCode: '1701',
    depreciationSubjectCode: '1702',
    expenseSubjectCode: '660204',
    description: '企业拥有或控制的没有实物形态的可辨认非货币性资产，如软件、专利权、商标权等',
    sortOrder: 6,
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
  requireDepartment: false,
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
    } catch (error: unknown) {
      console.error('添加资产失败:', error);
      const errorMsg = getErrorMessage(error) || '添加资产失败';
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
          accountingStatus=?, acquisitionVoucherId=?, acquisitionVoucherNo=?, acquisitionAccountingDate=?,
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
        safeValue(updatedAsset.accountingStatus), safeValue(updatedAsset.acquisitionVoucherId), safeValue(updatedAsset.acquisitionVoucherNo), safeValue(updatedAsset.acquisitionAccountingDate),
        updatedAsset.updateTime, id,
      ]);
      stmt.free();

      set((state) => ({
        assets: state.assets.map(a => a.id === id ? updatedAsset : a),
        error: null,
      }));
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '更新资产失败' });
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '删除资产失败' });
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '添加分类失败' });
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '更新分类失败' });
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '删除分类失败' });
      throw error;
    }
  },

  // 计算单个资产的折旧
  calculateDepreciationForAsset: (assetId, asOfDate, unitsThisPeriod) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset || asset.status !== 'active') return null;

    // 获取分类的折旧起始规则
    const category = get().categories.find(c => c.id === asset.categoryId);
    const depreciationStartRule = category?.depreciationStartRule || 'next_month';

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
        depreciationStartRule,
      },
      undefined, // period
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

      // 检查该期间是否应该计提折旧
      if (!get().shouldDepreciateThisMonth(assetId, period)) {
        continue;
      }

      // 获取分类的折旧起始规则
      const category = state.categories.find(c => c.id === asset.categoryId);
      const depreciationStartRule = category?.depreciationStartRule ||
        (category?.assetType === 'intangible' ? 'current_month' : 'next_month');

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
          depreciationStartRule,
        },
        period,
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '保存折旧记录失败' });
      throw error;
    }
  },

  // 记账折旧记录
  postDepreciationRecords: async (recordIds) => {
    const state = get();
    const records = state.depreciationRecords.filter(r => recordIds.includes(r.id));

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      const accountSetId = accountSetStore.getCurrentAccountSet()?.id || '';
      const db = await sqliteService.getDatabase();

      for (const record of records) {
        const stmt1 = db.prepare(
          'UPDATE depreciationRecords SET status = ?, updateTime = ? WHERE id = ?'
        );
        stmt1.run(['posted', new Date().toISOString(), record.id]);
        stmt1.free();

        const asset = state.assets.find(a => a.id === record.assetId);
        if (asset) {
          const newAccumulated = asset.accumulatedDepreciation + record.periodDepreciation;
          const newNetValue = asset.originalValue - newAccumulated;

          // 时序账日期优先用关联凭证的实际日期，回退到 record.depreciationDate（period-01）
          let changeDate = record.depreciationDate;
          let lastDepDate = record.depreciationDate;
          if (record.voucherId) {
            try {
              const linked = await sqliteService.getVoucher(record.voucherId);
              if (linked?.date) {
                changeDate = linked.date;
                lastDepDate = linked.date;
              }
            } catch {
              // 凭证查不到时静默回退到默认日期
            }
          }

          const stmt2 = db.prepare(
            `UPDATE fixedAssets SET
              accumulatedDepreciation = ?, netValue = ?, lastDepreciationDate = ?, updateTime = ?
            WHERE id = ?`
          );
          stmt2.run([newAccumulated, newNetValue, lastDepDate, new Date().toISOString(), asset.id]);
          stmt2.free();

          await get().logAssetChange({
            assetId: asset.id,
            assetCode: asset.assetCode,
            assetName: asset.assetName,
            accountSetId,
            changeType: 'depreciation',
            changeDate,
            period: record.period,
            fieldName: 'accumulatedDepreciation',
            beforeValue: String(asset.accumulatedDepreciation),
            afterValue: String(newAccumulated),
            originalValueChange: 0,
            depreciationChange: record.periodDepreciation,
            originalValueBalance: asset.originalValue,
            accumulatedDepreciationBalance: newAccumulated,
            netValueBalance: newNetValue,
            voucherId: record.voucherId,
            voucherNo: record.voucherNo,
            reason: `${record.period}折旧`,
          });

          // 无形资产双写：同时写入 intangibleChangeRecords
          const assetCategory = state.categories.find(c => c.id === asset.categoryId);
          if (assetCategory?.assetType === 'intangible') {
            try {
              const icrId = `icr-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
              const icrStmt = db.prepare(
                `INSERT INTO intangibleChangeRecords (
                  id, assetId, assetCode, assetName, accountSetId, changeType, changeDate, period,
                  fieldName, beforeValue, afterValue,
                  originalValueChange, amortizationChange, originalValueBalance,
                  accumulatedAmortizationBalance, netValueBalance,
                  voucherId, voucherNo, reason, operatorId, createTime
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
              );
              icrStmt.run([
                icrId, asset.id, asset.assetCode, asset.assetName, accountSetId,
                'amortization', changeDate, record.period,
                'amortization', String(asset.accumulatedDepreciation), String(newAccumulated),
                0, record.periodDepreciation,
                asset.originalValue, newAccumulated, newNetValue,
                record.voucherId || '', record.voucherNo || '', `${record.period}摊销`, '',
                new Date().toISOString(),
              ]);
              icrStmt.free();
            } catch (icrError) {
              console.warn('写入无形资产时序账失败:', icrError);
            }
          }
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '记账失败' });
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
      } catch (error: unknown) {
        errors.push(`行 ${importedAssets.indexOf(item) + 1}: ${getErrorMessage(error)}`);
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

  // 设置入账时部门必填
  setRequireDepartment: (required) => {
    set({ requireDepartment: required });
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
        unit: row[6] ?? '台',
        quantity: row[7] ?? 1,
        remainingQuantity: row[38] ?? row[7] ?? 1,
        unitPrice: row[39] ?? (row[8] / (row[7] ?? 1)),
        originalValue: row[8] ?? 0,
        salvageValue: row[9] ?? 0,
        depreciableValue: row[10] ?? 0,
        accumulatedDepreciation: row[11] ?? 0,
        netValue: row[12] ?? 0,
        depreciationMethod: row[13] ?? 'straight_line',
        usefulLifeYears: row[14] ?? 5,
        usefulLifeMonths: row[15] ?? 60,
        originalUsefulLifeMonths: row[43] ?? row[15] ?? 60,
        depreciatedMonths: row[44] ?? 0,
        totalUnits: row[16],
        unitsUsed: row[17],
        acquisitionDate: normalizeAssetDate(row[18]) || '',
        depreciationStartDate: normalizeAssetDate(row[19]),
        lastDepreciationDate: normalizeAssetDate(row[20]),
        disposalDate: normalizeAssetDate(row[21]),
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
        cipSubjectCode: row[49],
        cipSubjectName: row[50],
        disposalSubjectCode: row[51],
        disposalSubjectName: row[52],
        acquisitionType: row[40] || 'purchase',
        sourceInvoiceId: row[41],
        sourceVoucherId: row[42],
        serialNumber: row[45],
        assignedUser: row[46],
        improvementHistory: JSON.parse(row[47] || '[]'),
        disposalHistory: JSON.parse(row[48] || '[]'),
        supplierName: row[32],
        invoiceNo: row[33],
        notes: row[34],
        accountSetId: row[35],
        createTime: row[36],
        updateTime: row[37],
        assetType: row[53],
        accountingStatus: row[54] || 'accounted',
        acquisitionVoucherId: row[55],
        acquisitionVoucherNo: row[56],
        acquisitionAccountingDate: normalizeAssetDate(row[57]),
        isOpeningBalance: row[58] === 1,
        initialAccumulatedDepreciation: row[59] ?? 0,
        creditSubjectCode: row[60],
        creditSubjectName: row[61],
        projectCode: row[62],
        projectName: row[63],
        depreciationEndDate: row[64],
        remainingDepreciationMonths: row[65],
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

      // 自动修复：分类数据中的 assetType（历史数据可能不正确）
      // 在 set() 之前修复，确保 UI 显示正确的数据
      let fixedCategories = categories;
      // 按名称或代码查找无形资产分类（兼容不同的命名方式）
      const intangibleCategoryByCode = categories.find(c => c.code === 'INTANGIBLE');
      const intangibleCategoryByName = categories.find(c => c.name === '无形资产');
      const intangibleCategory = intangibleCategoryByCode || intangibleCategoryByName;

      if (intangibleCategory && intangibleCategory.assetType !== 'intangible') {
        const updateStmt = db.prepare(`UPDATE assetCategories SET assetType = ? WHERE id = ?`);
        updateStmt.run(['intangible', intangibleCategory.id]);
        updateStmt.free();
        // 修复内存中的数据
        fixedCategories = categories.map(c =>
          c.id === intangibleCategory.id ? { ...c, assetType: 'intangible' } : c
        );
      }

      set({
        categories: fixedCategories,
        assets,
        depreciationRecords,
        loading: false,
      });

      // 如果没有分类，初始化默认分类
      if (categories.length === 0) {
        await get().initializeDefaultCategories();
      }

      // 自动修复：检查已生成取得凭证但状态仍为 pending 的资产
      const pendingAssets = assets.filter(a => a.accountingStatus === 'pending');
      if (pendingAssets.length > 0) {
        // 检查凭证表中是否有这些资产的取得凭证
        for (const asset of pendingAssets) {
          // 查找摘要包含资产名称的取得凭证
          const voucherResult = db.exec(
            `SELECT id, voucherNo FROM vouchers WHERE accountSetId = ? AND summary LIKE ? LIMIT 1`,
            [accountSetId, `取得固定资产-${asset.assetName}%`]
          );
          if (voucherResult[0]?.values?.length > 0) {
            const voucherId = voucherResult[0].values[0][0] as string;
            const voucherNo = voucherResult[0].values[0][1] as string;
            console.log(`发现资产 ${asset.assetCode} 已有取得凭证 ${voucherNo}，修复状态`);

            // 更新资产状态
            const updateStmt = db.prepare(
              `UPDATE fixedAssets SET accountingStatus = 'accounted', acquisitionVoucherId = ?, acquisitionVoucherNo = ? WHERE id = ?`
            );
            updateStmt.run([voucherId, voucherNo, asset.id]);
            updateStmt.free();

            // 更新内存中的数据
            set(state => ({
              assets: state.assets.map(a =>
                a.id === asset.id
                  ? { ...a, accountingStatus: 'accounted', acquisitionVoucherId: voucherId, acquisitionVoucherNo: voucherNo }
                  : a
              ),
            }));
          }
        }
      }

      // 自动修复：无形资产的折旧开始日期应为入账当月而非下月
      // 使用修复后的分类数据
      const intangibleCategoryIds = fixedCategories
        .filter(c => c.assetType === 'intangible' || c.code === 'INTANGIBLE')
        .map(c => c.id);

      if (intangibleCategoryIds.length > 0) {
        const intangibleAssets = assets.filter(a =>
          intangibleCategoryIds.includes(a.categoryId || '') &&
          a.acquisitionAccountingDate &&
          a.depreciationStartDate
        );

        for (const asset of intangibleAssets) {
          // 正确的折旧开始日期应该是入账当月1日
          const correctStartDate = normalizeAssetDate(asset.acquisitionAccountingDate)!.substring(0, 8) + '01';

          if (asset.depreciationStartDate !== correctStartDate) {
            // 更新数据库
            const updateStmt = db.prepare(
              `UPDATE fixedAssets SET depreciationStartDate = ? WHERE id = ?`
            );
            updateStmt.run([correctStartDate, asset.id]);
            updateStmt.free();

            // 更新内存中的数据
            set(state => ({
              assets: state.assets.map(a =>
                a.id === asset.id
                  ? { ...a, depreciationStartDate: correctStartDate }
                  : a
              ),
            }));
          }
        }

        // 修复 acquisitionAccountingDate：从变动记录中获取正确的入账日期
        for (const asset of intangibleAssets) {
          // 查询该资产的取得变动记录
          const changeResult = db.exec(
            `SELECT changeDate FROM assetChangeRecords WHERE assetId = ? AND changeType = 'acquisition' ORDER BY createTime ASC LIMIT 1`,
            [asset.id]
          );
          if (changeResult[0]?.values?.length > 0) {
            const recordDate = changeResult[0].values[0][0];
            const correctAccountingDate = normalizeAssetDate(recordDate);
            if (correctAccountingDate && asset.acquisitionAccountingDate !== correctAccountingDate) {
              console.log(`修复资产 ${asset.assetCode} 的入账日期: ${asset.acquisitionAccountingDate} -> ${correctAccountingDate}`);
              const updateStmt = db.prepare(`UPDATE fixedAssets SET acquisitionAccountingDate = ? WHERE id = ?`);
              updateStmt.run([correctAccountingDate, asset.id]);
              updateStmt.free();
              // 更新内存中的数据
              set(state => ({
                assets: state.assets.map(a =>
                  a.id === asset.id
                    ? { ...a, acquisitionAccountingDate: correctAccountingDate }
                    : a
                ),
              }));
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error('初始化固定资产Store失败:', error);
      set({ loading: false, error: getErrorMessage(error) || '初始化失败' });
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

      // 预先构建资产ID到资产对象的映射，避免N+1查找
      const assetMap = new Map(state.assets.map(a => [a.id, a]));

      for (const record of records) {
        const asset = assetMap.get(record.assetId);
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '生成折旧凭证失败' });
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
      const { useSubjectStore } = await import('@/stores/useSubjectStore');
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
      const creditSubjectCode = rule.creditSubjectCode;
      const creditSubjectName = rule.creditSubjectName;

      // 校验科目是否存在
      const subjectStore = useSubjectStore.getState();
      const subjects = subjectStore.subjects;

      const debitSubject = subjects.find(s => s.code === debitSubjectCode);
      if (!debitSubject) {
        set({ error: `借方科目 ${debitSubjectCode} 不存在，请先添加该科目` });
        return null;
      }

      const creditSubject = subjects.find(s => s.code === creditSubjectCode);
      if (!creditSubject) {
        set({ error: `贷方科目 ${creditSubjectCode} 不存在，请先添加该科目` });
        return null;
      }

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
            subjectName: debitSubject.name,
            debit: asset.originalValue,
            credit: 0,
          },
          {
            id: generateId(),
            voucherId,
            date: vouchDate,
            summary,
            subjectCode: creditSubjectCode,
            subjectName: creditSubject.name,
            debit: 0,
            credit: asset.originalValue,
          },
        ],
        status: 'posted' as const,
        voucherType: 'general' as const,
        createdBy: 'system',
        createTime: now,
        updateTime: now,
        accountSetId,
      };

      await getCurrentService().saveVoucher(newVoucher);

      const { useVoucherStore } = await import('@/stores/useVoucherStore');
      useVoucherStore.setState((prev) => ({
        vouchers: [...prev.vouchers, newVoucher],
      }));

      // 计算折旧开始日期：固定资产下月开始，无形资产当月开始
      const category = get().categories.find(c => c.id === asset.categoryId);
      // 优先使用分类规则，如果没有则根据资产类型判断
      let rule_type = category?.depreciationStartRule;
      if (!rule_type) {
        rule_type = category?.assetType === 'intangible' ? 'current_month' : 'next_month';
      }
      const vouchDateObj = new Date(vouchDate);
      let depreciationStartDate: string;

      if (rule_type === 'current_month') {
        // 无形资产：入账当月开始
        depreciationStartDate = vouchDate.substring(0, 8) + '01';
      } else {
        // 固定资产：入账下月开始
        const nextMonth = new Date(vouchDateObj.getFullYear(), vouchDateObj.getMonth() + 1, 1);
        depreciationStartDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      }

      await get().updateAsset(assetId, {
        acquisitionVoucherId: voucherId,
        acquisitionVoucherNo: voucherNo,
        acquisitionAccountingDate: vouchDate,
        depreciationStartDate,
        accountingStatus: 'accounted',
      });

      await get().logAssetChange({
        assetId,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        accountSetId,
        changeType: 'acquisition',
        changeDate: vouchDate,
        period: vouchDate.substring(0, 7),
        fieldName: 'accountingStatus',
        beforeValue: 'pending',
        afterValue: 'accounted',
        originalValueChange: asset.originalValue,
        depreciationChange: 0,
        originalValueBalance: asset.originalValue,
        accumulatedDepreciationBalance: 0,
        netValueBalance: asset.originalValue,
        voucherId,
        voucherNo,
        reason: `取得成本入账，原值 ¥${(asset.originalValue ?? 0).toLocaleString()}`,
      });

      return { voucherId, voucherNo };
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '生成取得凭证失败' });
      throw error;
    }
  },

  // 获取处置凭证预览数据
  getDisposalVoucherPreview: (assetId, disposal) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset) return [];

    const settings = useSettingsStore.getState().getAssetFinancialSettings();
    const disposalCalc = get().calculatePartialDisposal(assetId, disposal.quantity);
    if (!disposalCalc) return [];

    // 根据资产分类确定资产类型
    const category = get().categories.find(c => c.id === asset.categoryId);
    const assetType: 'fixed' | 'intangible' = category?.assetType === 'intangible' ? 'intangible' : 'fixed';

    const netGainLoss = disposal.disposalIncome - disposal.disposalExpense - disposalCalc.disposedNetValue;

    return generateDisposalPreviewData(
      asset,
      { ...disposalCalc, disposalIncome: disposal.disposalIncome, disposalExpense: disposal.disposalExpense, netGainLoss },
      disposal.date,
      settings,
      assetType
    );
  },

  // 获取增值凭证预览数据
  getImprovementVoucherPreview: (assetId, improvement) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset) return [];

    const entries: AssetVoucherPreviewEntry[] = [
      {
        summary: `${asset.assetName}增值`,
        subjectCode: asset.assetSubjectCode || ACCOUNT_CODES.FIXED_ASSET,
        subjectName: asset.assetSubjectName || '固定资产',
        debit: improvement.amount,
        credit: 0,
      },
      {
        summary: `支付${asset.assetName}增值费用`,
        subjectCode: ACCOUNT_CODES.BANK,
        subjectName: '银行存款',
        debit: 0,
        credit: improvement.amount,
      },
    ];

    const totalDebit = improvement.amount;
    const totalCredit = improvement.amount;

    return [{ voucherDate: improvement.date, entries, totalDebit, totalCredit, isBalanced: true }];
  },

  // 折旧时间校验
  shouldDepreciateThisMonth: (assetId, period) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset) return false;

    // 未入账资产禁止折旧
    if (asset.accountingStatus === 'pending') return false;

    // 已处置资产禁止折旧
    if (asset.status === 'disposed') return false;

    // 已提足折旧禁止折旧
    const depreciableValue = asset.originalValue - asset.salvageValue;
    if (asset.accumulatedDepreciation >= depreciableValue) return false;

    // 检查该资产在本期间是否已有非草稿状态的折旧记录
    const existingRecord = get().depreciationRecords.find(
      r => r.assetId === assetId && r.period === period && r.status !== 'draft'
    );
    if (existingRecord) return false;

    // 获取分类的折旧起始规则
    const category = get().categories.find(c => c.id === asset.categoryId);
    const rule = category?.depreciationStartRule ||
      (category?.assetType === 'intangible' ? 'current_month' : 'next_month');

    // 使用入账日期判断（优先使用 acquisitionAccountingDate）
    const accountingPeriod = getAssetDatePeriod(asset.acquisitionAccountingDate) ||
      getAssetDatePeriod(asset.acquisitionDate);

    // 入账日期在当前账期之后，不计提
    if (accountingPeriod && period < accountingPeriod) return false;

    // 本月入账但规则是下月计提（固定资产），本月不计提
    if (accountingPeriod === period && rule === 'next_month') return false;

    // 折旧开始日期检查
    if (asset.depreciationStartDate) {
      const depreciationStartPeriod = asset.depreciationStartDate.substring(0, 7);
      if (period < depreciationStartPeriod) return false;
    }

    // 折旧结束日期检查
    if (asset.depreciationEndDate) {
      const depreciationEndPeriod = asset.depreciationEndDate.substring(0, 7);
      if (period > depreciationEndPeriod) return false;
    }

    // 使用年限是否已满
    const [acqYear, acqMonth] = (accountingPeriod || getAssetDatePeriod(asset.acquisitionDate) || period).split('-').map(Number);
    const [curYear, curMonth] = period.split('-').map(Number);
    const monthsSinceAcquisition = (curYear - acqYear) * 12 + (curMonth - acqMonth);
    // 无形资产当月计提，固定资产下月计提，所以已计提月数计算方式不同
    const monthsOfDepreciation = rule === 'current_month' ? monthsSinceAcquisition : monthsSinceAcquisition - 1;
    if (monthsOfDepreciation >= asset.usefulLifeMonths) return false;

    return true;
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '资产改造失败' });
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
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '资产处置失败' });
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
  getAssetChangeRecords: async (assetId) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      if (!db) return [];

      const result = db.exec(
        `SELECT id, assetId, assetCode, assetName, accountSetId, changeType, changeDate, period,
                fieldName, beforeValue, afterValue,
                originalValueChange, depreciationChange, originalValueBalance,
                accumulatedDepreciationBalance, netValueBalance,
                voucherId, voucherNo, reason, operatorId, createTime
         FROM assetChangeRecords WHERE assetId = ? ORDER BY changeDate ASC, createTime ASC`,
        [assetId]
      );

      return result[0]?.values?.map((row: any[]) => ({
        id: row[0],
        assetId: row[1],
        assetCode: row[2],
        assetName: row[3],
        accountSetId: row[4],
        changeType: row[5],
        changeDate: row[6],
        period: row[7],
        fieldName: row[8],
        beforeValue: row[9] || '',
        afterValue: row[10] || '',
        originalValueChange: row[11],
        depreciationChange: row[12],
        originalValueBalance: row[13],
        accumulatedDepreciationBalance: row[14],
        netValueBalance: row[15],
        voucherId: row[16] || undefined,
        voucherNo: row[17] || undefined,
        reason: row[18] || undefined,
        operatorId: row[19] || undefined,
        createTime: row[20],
      })) || [];
    } catch (error) {
      console.warn('获取资产变动记录失败:', error);
      return [];
    }
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
          fieldName, beforeValue, afterValue,
          originalValueChange, depreciationChange, originalValueBalance,
          accumulatedDepreciationBalance, netValueBalance,
          voucherId, voucherNo, reason, operatorId, createTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        id, record.assetId, record.assetCode, record.assetName, record.accountSetId,
        record.changeType, record.changeDate, record.period,
        record.fieldName, record.beforeValue || '', record.afterValue || '',
        record.originalValueChange ?? null, record.depreciationChange ?? null,
        record.originalValueBalance ?? null, record.accumulatedDepreciationBalance ?? null,
        record.netValueBalance ?? null,
        record.voucherId || '', record.voucherNo || '', record.reason || '', record.operatorId || '',
        now,
      ]);
      stmt.free();
    } catch (error: unknown) {
      console.warn('记录资产变动失败:', error);
    }
  },

  // 清空资产的变动记录
  clearAssetChangeRecords: async (assetId) => {
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

      const stmt = db.prepare(`DELETE FROM assetChangeRecords WHERE assetId = ?`);
      stmt.run([assetId]);
      stmt.free();
      console.log('已清空资产变动记录:', assetId);
    } catch (error: unknown) {
      console.warn('清空资产变动记录失败:', error);
      throw error;
    }
  },

  // 红冲联动：按原凭证 ID 反转所有相关资产变动
  reverseAssetChangesByVoucherId: async (originalVoucherId, reversedVoucherId, reversedVoucherNo, reversalDate) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      const accountSetId = accountSetStore.getCurrentAccountSet()?.id || '';
      if (accountSetId) sqliteService.setAccountSetId(accountSetId);
      const db = await sqliteService.getDatabase();
      if (!db) throw new Error('数据库未初始化');

      // 1. 查原凭证关联的所有资产变动（排除已有的红冲反向行，避免重复抵消）
      const result = db.exec(
        `SELECT id, assetId, assetCode, assetName, accountSetId, changeType, changeDate, period,
                fieldName, beforeValue, afterValue,
                originalValueChange, depreciationChange, originalValueBalance,
                accumulatedDepreciationBalance, netValueBalance,
                voucherId, voucherNo, reason, operatorId, createTime
         FROM assetChangeRecords
         WHERE voucherId = ? AND accountSetId = ? AND fieldName != 'voucher_reversal'`,
        [originalVoucherId, accountSetId]
      );

      const rows: SqliteBindable[][] = result[0]?.values ?? [];
      if (rows.length === 0) return;

      const period = reversalDate.substring(0, 7);

      // 2. 为每条变动写一条抵消记录，并回退 fixedAssets 余额
      for (const row of rows) {
        const assetId = String(row[1] ?? '');
        const assetCode = String(row[2] ?? '');
        const assetName = String(row[3] ?? '');
        const deltaOrig = Number(row[11] ?? 0);
        const deltaDep = Number(row[12] ?? 0);
        const origBal = row[13] as number | null;
        const accDepBal = row[14] as number | null;
        const netBal = row[15] as number | null;
        const origVoucherNo = String(row[17] ?? '');

        // 写抵消变动行
        await get().logAssetChange({
          assetId,
          assetCode,
          assetName,
          accountSetId,
          changeType: 'status_change',
          changeDate: reversalDate,
          period,
          fieldName: 'voucher_reversal',
          beforeValue: origVoucherNo || originalVoucherId,
          afterValue: reversedVoucherNo,
          originalValueChange: -deltaOrig,
          depreciationChange: -deltaDep,
          originalValueBalance: origBal ?? undefined,
          accumulatedDepreciationBalance: accDepBal ?? undefined,
          netValueBalance: netBal ?? undefined,
          voucherId: reversedVoucherId,
          voucherNo: reversedVoucherNo,
          reason: `红冲 ${origVoucherNo || originalVoucherId}`,
        });

        // 回退 fixedAssets 余额
        const assetResult = db.exec(
          `SELECT originalValue, accumulatedDepreciation, categoryId FROM fixedAssets WHERE id = ?`,
          [assetId]
        );
        const assetRow = assetResult[0]?.values?.[0];
        if (assetRow) {
          const newOrig = Number(assetRow[0]) - deltaOrig;
          const newAccDep = Number(assetRow[1]) - deltaDep;
          const newNet = newOrig - newAccDep;
          const stmt = db.prepare(
            `UPDATE fixedAssets SET originalValue = ?, accumulatedDepreciation = ?, netValue = ?, updateTime = ? WHERE id = ?`
          );
          stmt.run([newOrig, newAccDep, newNet, new Date().toISOString(), assetId]);
          stmt.free();

          // 无形资产双写到 intangibleChangeRecords
          const categoryId = String(assetRow[2] ?? '');
          const isIntangible = get().categories.find(c => c.id === categoryId)?.assetType === 'intangible';
          if (isIntangible) {
            try {
              const icrId = `icr-rev-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
              const icrStmt = db.prepare(
                `INSERT INTO intangibleChangeRecords (
                  id, assetId, assetCode, assetName, accountSetId, changeType, changeDate, period,
                  fieldName, beforeValue, afterValue,
                  originalValueChange, amortizationChange, originalValueBalance,
                  accumulatedAmortizationBalance, netValueBalance,
                  voucherId, voucherNo, reason, operatorId, createTime
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
              );
              icrStmt.run([
                icrId, assetId, assetCode, assetName, accountSetId,
                'voucher_reversal', reversalDate, period,
                'voucher_reversal', origVoucherNo || originalVoucherId, reversedVoucherNo,
                -deltaOrig, -deltaDep,
                newOrig, newAccDep, newNet,
                reversedVoucherId, reversedVoucherNo,
                `红冲 ${origVoucherNo || originalVoucherId}`, '',
                new Date().toISOString(),
              ]);
              icrStmt.free();
            } catch (icrError) {
              console.warn('红冲写入无形资产时序账失败:', icrError);
            }
          }
        }
      }

      // 3. 把关联的折旧记录回退到 draft，并清掉 voucherId/voucherNo
      const depStmt = db.prepare(
        `UPDATE depreciationRecords SET status = 'draft', voucherId = '', voucherNo = '', updateTime = ?
         WHERE voucherId = ? AND accountSetId = ?`
      );
      depStmt.run([new Date().toISOString(), originalVoucherId, accountSetId]);
      depStmt.free();

      // 4. 同步本地 state（资产余额 + 折旧记录状态）
      await get().initialize();
      set((state) => ({
        depreciationRecords: state.depreciationRecords.map(r =>
          r.voucherId === originalVoucherId
            ? { ...r, status: 'draft' as const, voucherId: undefined, voucherNo: undefined }
            : r
        ),
      }));
    } catch (error: unknown) {
      console.warn('红冲联动固定资产失败:', error);
      throw error;
    }
  },

  // 拆分资产
  splitAsset: async (assetId, options) => {
    const state = get();
    const asset = state.assets.find(a => a.id === assetId);
    if (!asset) {
      throw new Error('资产不存在');
    }

    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();
    if (!currentAccountSet?.id) {
      throw new Error('请先选择账套');
    }

    const { date, method, count, percentages, reason } = options;
    const newAssets: FixedAsset[] = [];

    // 验证变动日期不能晚于当前账期
    const currentPeriodInfo = currentAccountSet.accountingPeriods?.find(p => p.isCurrent);
    const currentPeriodMonth = currentPeriodInfo ? `${currentPeriodInfo.year}-${String(currentPeriodInfo.month).padStart(2, '0')}` : new Date().toISOString().substring(0, 7);
    const changePeriod = date.substring(0, 7);
    if (changePeriod > currentPeriodMonth) {
      throw new Error(`变动日期 ${changePeriod} 晚于当前账期 ${currentPeriodMonth}，无法操作`);
    }

    // 计算拆分比例
    let splitRatios: number[];
    if (method === 'average') {
      const avgPct = 100 / count;
      splitRatios = Array(count).fill(avgPct);
      // 修正最后一个，确保总和为100
      splitRatios[count - 1] = 100 - avgPct * (count - 1);
    } else {
      splitRatios = percentages || [];
    }

    // 验证比例总和
    const totalPct = splitRatios.reduce((a, b) => a + b, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new Error('拆分比例之和必须等于100%');
    }

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      sqliteService.setAccountSetId(currentAccountSet.id);
      const db = await sqliteService.getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }

      const now = new Date().toISOString();
      const manager = CodeRuleManager.getInstance();
      const rule = manager.getRuleByType('fixed_asset');

      // 获取现有所有资产编码，用于避免重复
      const existingCodesResult = db.exec('SELECT assetCode FROM fixedAssets WHERE accountSetId = ?', [currentAccountSet.id]);
      const existingCodes = new Set(existingCodesResult[0]?.values?.map((row: any) => row[0] as string) || []);

      // 辅助函数：创建凭证分录
      const createEntry = (subjectCode: string, subjectName: string, direction: 'debit' | 'credit', debit: number, credit: number, summary: string) => {
        const entryId = generateId();
        const stmt = db.prepare(
          `INSERT INTO entries (id, voucherId, subjectCode, subjectName, direction, debit, credit, summary, date, accountSetId, createTime, updateTime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([entryId, voucherId, subjectCode, subjectName, direction, debit, credit, summary, date, currentAccountSet.id, now, now]);
        stmt.free();
      };

      // 创建新资产
      for (let i = 0; i < splitRatios.length; i++) {
        const ratio = splitRatios[i] / 100;
        const newId = generateId();

        // 使用原资产编码加后缀的方式确保唯一性
        let newCode = `${asset.assetCode}-${i + 1}`;
        // 如果后缀方式也冲突，则使用时间戳
        if (existingCodes.has(newCode)) {
          newCode = `${asset.assetCode}-${Date.now()}-${i + 1}`;
        }
        existingCodes.add(newCode);

        const newAsset: FixedAsset = {
          ...asset,
          id: newId,
          assetCode: newCode,
          assetName: `${asset.assetName}-${i + 1}`,
          originalValue: Math.round(asset.originalValue * ratio * 100) / 100,
          accumulatedDepreciation: Math.round(asset.accumulatedDepreciation * ratio * 100) / 100,
          netValue: Math.round((asset.originalValue - asset.accumulatedDepreciation) * ratio * 100) / 100,
          depreciableValue: Math.round(asset.depreciableValue * ratio * 100) / 100,
          salvageValue: Math.round(asset.salvageValue * ratio * 100) / 100,
          quantity: 1,
          remainingQuantity: 1,
          createTime: now,
          updateTime: now,
        };

        // 保存到数据库
        const stmt = db.prepare(
          `INSERT INTO fixedAssets (
            id, assetCode, assetName, categoryId, categoryName, specification, unit, quantity,
            originalValue, salvageValue, depreciableValue, accumulatedDepreciation, netValue,
            depreciationMethod, usefulLifeYears, usefulLifeMonths,
            totalUnits, unitsUsed, acquisitionDate, depreciationStartDate,
            status, location, departmentCode, departmentName,
            assetSubjectCode, assetSubjectName, depreciationSubjectCode, depreciationSubjectName,
            expenseSubjectCode, expenseSubjectName, supplierName, invoiceNo, notes,
            accountSetId, createTime, updateTime
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        );
        stmt.run([
          newAsset.id, newAsset.assetCode, newAsset.assetName, newAsset.categoryId || '', newAsset.categoryName || '',
          newAsset.specification || '', newAsset.unit || '台', newAsset.quantity,
          newAsset.originalValue, newAsset.salvageValue, newAsset.depreciableValue,
          newAsset.accumulatedDepreciation, newAsset.netValue,
          newAsset.depreciationMethod, newAsset.usefulLifeYears, newAsset.usefulLifeMonths,
          newAsset.totalUnits || 0, newAsset.unitsUsed || 0, newAsset.acquisitionDate, newAsset.depreciationStartDate || '',
          newAsset.status || 'active', newAsset.location || '', newAsset.departmentCode || '', newAsset.departmentName || '',
          newAsset.assetSubjectCode || '', newAsset.assetSubjectName || '',
          newAsset.depreciationSubjectCode || '', newAsset.depreciationSubjectName || '',
          newAsset.expenseSubjectCode || '', newAsset.expenseSubjectName || '',
          newAsset.supplierName || '', newAsset.invoiceNo || '', newAsset.notes || '',
          currentAccountSet.id, now, now,
        ]);
        stmt.free();

        newAssets.push(newAsset);
      }

      // 标记原资产为已处置
      const updateStmt = db.prepare(
        `UPDATE fixedAssets SET status = 'disposed', accountingStatus = 'disposed', updateTime = ? WHERE id = ?`
      );
      updateStmt.run([now, assetId]);
      updateStmt.free();

      // 记录变动
      await get().logAssetChange({
        assetId: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        accountSetId: currentAccountSet.id,
        changeType: 'split',
        changeDate: date,
        period: date.substring(0, 7),
        fieldName: '资产拆分',
        beforeValue: `原值: ${asset.originalValue}`,
        afterValue: `拆分为 ${count} 个资产`,
        reason,
      });

      // 生成拆分凭证：原资产处置转入清理，新资产入账
      const yearMonth = date.substring(0, 7).replace('-', '');
      const vouchersResult = db.exec(
        'SELECT voucherNo FROM vouchers WHERE accountSetId = ? AND voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1',
        [currentAccountSet.id, `记-${yearMonth}-%`]
      );
      let lastSeq = 0;
      if (vouchersResult[0]?.values?.length > 0) {
        const match = (vouchersResult[0].values[0][0] as string).match(/-(\d{3})$/);
        if (match) {
          lastSeq = parseInt(match[1], 10);
        }
      }
      const voucherNo = `记-${yearMonth}-${String(lastSeq + 1).padStart(3, '0')}`;
      const voucherId = generateId();

      // 创建凭证
      const stmtVoucher = db.prepare(
        `INSERT INTO vouchers (id, voucherNo, date, status, summary, creator, accountSetId, createTime, updateTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmtVoucher.run([voucherId, voucherNo, date, 'posted', `${asset.assetName}拆分`, 'system', currentAccountSet.id, now, now]);
      stmtVoucher.free();

      // 创建分录
      const assetSubjectCode = asset.assetSubjectCode || '1501';
      const assetSubjectName = asset.assetSubjectName || '固定资产';
      createEntry('1606', '固定资产清理', 'debit', asset.netValue, 0, `${asset.assetName}拆分转入清理`);
      createEntry('1502', '累计折旧', 'debit', asset.accumulatedDepreciation, 0, `${asset.assetName}拆分冲销折旧`);
      createEntry(assetSubjectCode, assetSubjectName, 'credit', 0, asset.originalValue, `${asset.assetName}拆分转出`);
      createEntry(assetSubjectCode, assetSubjectName, 'debit', asset.originalValue, 0, '拆分后新资产入账');
      createEntry('1502', '累计折旧', 'credit', 0, asset.accumulatedDepreciation, '拆分后新资产折旧');
      createEntry('1606', '固定资产清理', 'credit', 0, asset.netValue, '拆分后新资产净值');

      // 更新变动记录，关联凭证
      const stmtUpdateChange = db.prepare(
        'UPDATE assetChangeRecords SET voucherId = ?, voucherNo = ? WHERE assetId = ? AND changeType = ? AND changeDate = ?'
      );
      stmtUpdateChange.run([voucherId, voucherNo, asset.id, 'split', date]);
      stmtUpdateChange.free();

      // 刷新资产列表
      await get().initialize();

      // 刷新凭证 store
      await refreshVoucherStore();

      return newAssets;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '资产拆分失败' });
      throw error;
    }
  },

  // 合并资产
  mergeAssets: async (assetIds, options) => {
    const state = get();
    const assetsToMerge = state.assets.filter(a => assetIds.includes(a.id));

    if (assetsToMerge.length !== assetIds.length) {
      throw new Error('部分资产不存在');
    }

    if (assetsToMerge.length < 2) {
      throw new Error('至少需要2个资产才能合并');
    }

    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();
    if (!currentAccountSet?.id) {
      throw new Error('请先选择账套');
    }

    const { date, departmentCode, categoryId, reason } = options;

    // 计算合并后的值（单次遍历）
    let totalOriginalValue = 0;
    let totalAccumulatedDepreciation = 0;
    let totalQuantity = 0;
    for (const a of assetsToMerge) {
      totalOriginalValue += a.originalValue;
      totalAccumulatedDepreciation += a.accumulatedDepreciation;
      totalQuantity += a.quantity || 1;
    }
    const totalNetValue = totalOriginalValue - totalAccumulatedDepreciation;

    // 使用第一个资产作为模板
    const templateAsset = assetsToMerge[0];

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      sqliteService.setAccountSetId(currentAccountSet.id);
      const db = await sqliteService.getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }

      const now = new Date().toISOString();
      const manager = CodeRuleManager.getInstance();
      const rule = manager.getRuleByType('fixed_asset');
      const newId = generateId();
      const newCode = rule ? generateCode(rule).code : `FA${Date.now()}`;

      const mergedAsset: FixedAsset = {
        ...templateAsset,
        id: newId,
        assetCode: newCode,
        assetName: `${templateAsset.assetName}（合并）`,
        originalValue: totalOriginalValue,
        accumulatedDepreciation: totalAccumulatedDepreciation,
        netValue: totalNetValue,
        depreciableValue: totalOriginalValue - (templateAsset.salvageValue || 0),
        quantity: totalQuantity,
        remainingQuantity: totalQuantity,
        departmentCode,
        categoryId: categoryId || templateAsset.categoryId,
        createTime: now,
        updateTime: now,
      };

      // 保存新资产
      const stmt = db.prepare(
        `INSERT INTO fixedAssets (
          id, assetCode, assetName, categoryId, specification, unit, quantity, remainingQuantity,
          originalValue, salvageValue, depreciableValue, accumulatedDepreciation, netValue,
          depreciationMethod, usefulLifeYears, usefulLifeMonths, acquisitionDate, acquisitionType,
          location, departmentCode, departmentName, supplierName, invoiceNo, notes, serialNumber,
          assignedUser, status, accountingStatus, assetSubjectCode, assetSubjectName,
          depreciationSubjectCode, depreciationSubjectName, expenseSubjectCode, expenseSubjectName,
          accountSetId, createTime, updateTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        mergedAsset.id, mergedAsset.assetCode, mergedAsset.assetName, mergedAsset.categoryId,
        mergedAsset.specification || '', mergedAsset.unit || '台', mergedAsset.quantity, mergedAsset.remainingQuantity,
        mergedAsset.originalValue, mergedAsset.salvageValue || 0, mergedAsset.depreciableValue,
        mergedAsset.accumulatedDepreciation, mergedAsset.netValue,
        mergedAsset.depreciationMethod, mergedAsset.usefulLifeYears, mergedAsset.usefulLifeMonths,
        mergedAsset.acquisitionDate, mergedAsset.acquisitionType || 'purchase',
        mergedAsset.location || '', mergedAsset.departmentCode || '', mergedAsset.departmentName || '',
        mergedAsset.supplierName || '', mergedAsset.invoiceNo || '', mergedAsset.notes || '',
        mergedAsset.serialNumber || '', mergedAsset.assignedUser || '',
        mergedAsset.status || 'active', mergedAsset.accountingStatus || 'pending',
        mergedAsset.assetSubjectCode || '', mergedAsset.assetSubjectName || '',
        mergedAsset.depreciationSubjectCode || '', mergedAsset.depreciationSubjectName || '',
        mergedAsset.expenseSubjectCode || '', mergedAsset.expenseSubjectName || '',
        currentAccountSet.id, now, now,
      ]);
      stmt.free();

      // 标记原资产为已处置
      const updateStmt = db.prepare(
        `UPDATE fixedAssets SET status = 'disposed', accountingStatus = 'disposed', updateTime = ? WHERE id = ?`
      );
      for (const id of assetIds) {
        updateStmt.run([now, id]);
      }
      updateStmt.free();

      // 记录变动
      await get().logAssetChange({
        assetId: mergedAsset.id,
        assetCode: mergedAsset.assetCode,
        assetName: mergedAsset.assetName,
        accountSetId: currentAccountSet.id,
        changeType: 'merge',
        changeDate: date,
        period: date.substring(0, 7),
        fieldName: '资产合并',
        beforeValue: `合并前: ${assetsToMerge.map(a => a.assetCode).join(', ')}`,
        afterValue: `合并后原值: ${totalOriginalValue}`,
        reason,
      });

      // 刷新资产列表
      await get().initialize();

      return mergedAsset;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '资产合并失败' });
      throw error;
    }
  },
}));
