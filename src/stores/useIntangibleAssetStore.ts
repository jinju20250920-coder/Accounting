'use client';

/**
 * @deprecated 无形资产功能已合并到固定资产管理
 * 无形资产现在作为固定资产的一种分类处理
 * 通过 AssetCategory.assetNature = 'intangible' 区分
 * 通过 AssetCategory.depreciationStartRule = 'current_month' 设置摊销规则
 *
 * 此 Store 保留用于数据迁移和向后兼容
 * 新功能请使用 useFixedAssetStore
 */

import { create } from 'zustand';
import { getCurrentManager } from '@/lib/database';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from './useAccountSetStore';
import { getErrorMessage } from '@/lib/utils';
import type { SqliteBindable } from '@/lib/database/services/fixed-asset-sqlite-service';
import {
  calculateAmortization,
  getAmortizationMethodName,
  parseAmortizationMethod,
} from '@/lib/amortization';
import type {
  IntangibleAsset,
  AmortizationRecord,
  AmortizationResult,
  BatchAmortizationResult,
  AmortizationMethod,
  IntangibleAssetType,
  IntangibleChangeRecord,
} from '@/types';

interface IntangibleAssetStore {
  // 状态
  assets: IntangibleAsset[];
  amortizationRecords: AmortizationRecord[];
  loading: boolean;
  error: string | null;
  selectedAssetId: string | null;

  // CRUD
  addAsset: (asset: Omit<IntangibleAsset, 'id' | 'createTime' | 'updateTime'>) => Promise<IntangibleAsset>;
  updateAsset: (id: string, updates: Partial<IntangibleAsset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  getAssetById: (id: string) => IntangibleAsset | undefined;
  getAssetByCode: (code: string) => IntangibleAsset | undefined;

  // 摊销
  calculateAmortizationForAsset: (assetId: string, asOfDate: string, unitsThisPeriod?: number) => AmortizationResult | null;
  batchCalculateAmortization: (assetIds: string[], period: string, unitsMap?: Record<string, number>) => BatchAmortizationResult;
  saveAmortizationRecords: (records: AmortizationRecord[]) => Promise<void>;
  postAmortizationRecords: (recordIds: string[]) => Promise<void>;
  reverseAmortizationByVoucherId: (originalVoucherId: string) => Promise<void>;

  // 时序账
  logIntangibleChange: (record: Omit<IntangibleChangeRecord, 'id' | 'createTime'>) => Promise<void>;
  getIntangibleChangeRecords: (assetId: string) => Promise<IntangibleChangeRecord[]>;
  clearIntangibleChangeRecords: (assetId: string) => Promise<void>;

  // 查询
  getActiveAssets: () => IntangibleAsset[];
  getAmortizationHistory: (assetId: string) => AmortizationRecord[];
  getAssetsByType: (type: IntangibleAssetType) => IntangibleAsset[];

  // 导入导出
  importFromExcel: (assets: Partial<IntangibleAsset>[]) => Promise<{ success: number; errors: string[] }>;
  exportToExcel: () => IntangibleAsset[];

  // 凭证生成
  generateAmortizationVoucher: (recordIds: string[], voucherDate: string) => Promise<{ voucherId: string; voucherNo: string } | null>;

  // 状态管理
  setSelectedAssetId: (id: string | null) => void;
  clearError: () => void;
  initialize: () => Promise<void>;
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

export const useIntangibleAssetStore = create<IntangibleAssetStore>((set, get) => ({
  // 初始状态
  assets: [],
  amortizationRecords: [],
  loading: false,
  error: null,
  selectedAssetId: null,

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
    const { CodeRuleManager, generateCode } = await import('@/lib/code-generator');
    const codeManager = CodeRuleManager.getInstance();
    const rule = codeManager.getRuleByType('intangible_asset');

    if (!assetCode && rule.autoIncrement) {
      const existingCodes = state.assets.map(a => a.assetCode).filter(Boolean);
      const result = generateCode(rule, existingCodes);
      assetCode = result.code;
      codeManager.setRule(result.updatedRule);
    }

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
    const newAsset: IntangibleAsset = {
      ...assetData,
      assetCode,
      id: generateId(),
      netValue: assetData.originalValue - (assetData.accumulatedAmortization || 0),
      status: assetData.status || 'active',
      accountSetId: currentAccountSet?.id,
      createTime: now,
      updateTime: now,
    };

    try {
      const db = await getCurrentManager().getDatabase();
      // 将 undefined 转为 null，避免 SQL.js 报错
      const safeValue = <T,>(v: T | undefined): T | null => v ?? null;
      const stmt = db.prepare(
        `INSERT INTO intangibleAssets (
          id, tenantId, assetCode, assetName, assetType, originalValue, residualValue,
          accumulatedAmortization, netValue, amortizationMethod, usefulLifeYears, usefulLifeMonths,
          totalUnits, unitsUsed, acquisitionDate, amortizationStartDate, lastAmortizationDate, expiryDate,
          status, assetSubjectCode, assetSubjectName, amortizationSubjectCode, amortizationSubjectName,
          expenseSubjectCode, expenseSubjectName, registrationNo, legalLifeYears,
          departmentCode, departmentName, notes, accountSetId, createTime, updateTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        newAsset.id, sqliteService.tenantId, newAsset.assetCode, newAsset.assetName, safeValue(newAsset.assetType),
        newAsset.originalValue, safeValue(newAsset.residualValue),
        safeValue(newAsset.accumulatedAmortization), newAsset.netValue,
        safeValue(newAsset.amortizationMethod), safeValue(newAsset.usefulLifeYears), safeValue(newAsset.usefulLifeMonths),
        safeValue(newAsset.totalUnits), safeValue(newAsset.unitsUsed),
        safeValue(newAsset.acquisitionDate), safeValue(newAsset.amortizationStartDate),
        safeValue(newAsset.lastAmortizationDate), safeValue(newAsset.expiryDate),
        newAsset.status, safeValue(newAsset.assetSubjectCode), safeValue(newAsset.assetSubjectName),
        safeValue(newAsset.amortizationSubjectCode), safeValue(newAsset.amortizationSubjectName),
        safeValue(newAsset.expenseSubjectCode), safeValue(newAsset.expenseSubjectName),
        safeValue(newAsset.registrationNo), safeValue(newAsset.legalLifeYears),
        safeValue(newAsset.departmentCode), safeValue(newAsset.departmentName),
        safeValue(newAsset.notes), newAsset.accountSetId, newAsset.createTime, newAsset.updateTime,
      ]);
      stmt.free();

      set((state) => ({
        assets: [...state.assets, newAsset],
        error: null,
      }));

      return newAsset;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '添加资产失败' });
      throw error;
    }
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
    const updatedAsset: IntangibleAsset = {
      ...asset,
      ...updates,
      updateTime: now,
    };

    // 重新计算净值
    if (updates.originalValue !== undefined || updates.accumulatedAmortization !== undefined) {
      updatedAsset.netValue = updatedAsset.originalValue - updatedAsset.accumulatedAmortization;
    }

    try {
      const db = await getCurrentManager().getDatabase();
      // 将 undefined 转为 null，避免 SQL.js 报错
      const safeValue = <T,>(v: T | undefined): T | null => v ?? null;
      const stmt = db.prepare(
        `UPDATE intangibleAssets SET
          assetName=?, assetType=?, originalValue=?, residualValue=?,
          accumulatedAmortization=?, netValue=?, amortizationMethod=?,
          usefulLifeYears=?, usefulLifeMonths=?, totalUnits=?, unitsUsed=?,
          acquisitionDate=?, amortizationStartDate=?, lastAmortizationDate=?, expiryDate=?,
          status=?, assetSubjectCode=?, assetSubjectName=?,
          amortizationSubjectCode=?, amortizationSubjectName=?,
          expenseSubjectCode=?, expenseSubjectName=?,
          registrationNo=?, legalLifeYears=?,
          departmentCode=?, departmentName=?, notes=?, updateTime=?
        WHERE id=? AND tenantId=? AND accountSetId=?`
      );
      stmt.run([
        updatedAsset.assetName, safeValue(updatedAsset.assetType),
        updatedAsset.originalValue, safeValue(updatedAsset.residualValue),
        safeValue(updatedAsset.accumulatedAmortization), updatedAsset.netValue,
        safeValue(updatedAsset.amortizationMethod),
        safeValue(updatedAsset.usefulLifeYears), safeValue(updatedAsset.usefulLifeMonths),
        safeValue(updatedAsset.totalUnits), safeValue(updatedAsset.unitsUsed),
        safeValue(updatedAsset.acquisitionDate), safeValue(updatedAsset.amortizationStartDate),
        safeValue(updatedAsset.lastAmortizationDate), safeValue(updatedAsset.expiryDate),
        updatedAsset.status, safeValue(updatedAsset.assetSubjectCode), safeValue(updatedAsset.assetSubjectName),
        safeValue(updatedAsset.amortizationSubjectCode), safeValue(updatedAsset.amortizationSubjectName),
        safeValue(updatedAsset.expenseSubjectCode), safeValue(updatedAsset.expenseSubjectName),
        safeValue(updatedAsset.registrationNo), safeValue(updatedAsset.legalLifeYears),
        safeValue(updatedAsset.departmentCode), safeValue(updatedAsset.departmentName),
        safeValue(updatedAsset.notes), updatedAsset.updateTime, id, sqliteService.tenantId, updatedAsset.accountSetId ?? '',
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

    // 检查是否有未记账的摊销记录
    const hasUnpostedRecords = state.amortizationRecords.some(
      r => r.entityId === id && r.entityType === 'intangible' && r.status === 'draft'
    );
    if (hasUnpostedRecords) {
      set({ error: '该资产有未记账的摊销记录，无法删除' });
      return;
    }

    try {
      const db = await getCurrentManager().getDatabase();
      // 删除摊销记录
      let stmt = db.prepare('DELETE FROM amortizationRecords WHERE entityId = ? AND entityType = ? AND tenantId = ? AND accountSetId = ?');
      stmt.run([id, 'intangible', sqliteService.tenantId, asset.accountSetId ?? '']);
      stmt.free();
      // 删除资产
      stmt = db.prepare('DELETE FROM intangibleAssets WHERE id = ? AND tenantId = ? AND accountSetId = ?');
      stmt.run([id, sqliteService.tenantId, asset.accountSetId ?? '']);
      stmt.free();

      set((state) => ({
        assets: state.assets.filter(a => a.id !== id),
        amortizationRecords: state.amortizationRecords.filter(
          r => !(r.entityId === id && r.entityType === 'intangible')
        ),
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

  // 计算单个资产的摊销
  calculateAmortizationForAsset: (assetId, asOfDate, unitsThisPeriod) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset || asset.status !== 'active') return null;

    const result = calculateAmortization(
      asset.amortizationMethod,
      {
        method: asset.amortizationMethod,
        originalValue: asset.originalValue,
        residualValue: asset.residualValue,
        usefulLifeMonths: asset.usefulLifeMonths,
        acquisitionDate: asset.acquisitionDate,
        amortizationStartDate: asset.amortizationStartDate || asset.acquisitionDate,
        amortizedAmount: asset.accumulatedAmortization,
        totalUnits: asset.totalUnits,
        unitsUsed: asset.unitsUsed,
        asOfDate,
      },
      unitsThisPeriod
    );

    return result;
  },

  // 批量计算摊销
  batchCalculateAmortization: (assetIds, period, unitsMap) => {
    const state = get();
    const records: AmortizationRecord[] = [];
    const errors: Array<{ entityId: string; entityName: string; error: string }> = [];
    let totalAmortization = 0;

    for (const assetId of assetIds) {
      const asset = state.assets.find(a => a.id === assetId);
      if (!asset) {
        errors.push({ entityId: assetId, entityName: '未知', error: '资产不存在' });
        continue;
      }

      if (asset.status !== 'active') {
        errors.push({ entityId: assetId, entityName: asset.assetName, error: '资产状态不是在用' });
        continue;
      }

      const result = calculateAmortization(
        asset.amortizationMethod,
        {
          method: asset.amortizationMethod,
          originalValue: asset.originalValue,
          residualValue: asset.residualValue,
          usefulLifeMonths: asset.usefulLifeMonths,
          acquisitionDate: asset.acquisitionDate,
          amortizationStartDate: asset.amortizationStartDate || asset.acquisitionDate,
          amortizedAmount: asset.accumulatedAmortization,
          totalUnits: asset.totalUnits,
          unitsUsed: asset.unitsUsed,
          asOfDate: `${period}-01`,
        },
        unitsMap?.[assetId]
      );

      if (result.isFullyAmortized || result.periodAmortization <= 0) {
        continue;
      }

      const record: AmortizationRecord = {
        id: generateId(),
        entityType: 'intangible',
        entityId: asset.id,
        entityCode: asset.assetCode,
        entityName: asset.assetName,
        period,
        amortizationDate: `${period}-01`,
        periodAmortization: result.periodAmortization,
        accumulatedAmortization: result.accumulatedAmortization,
        remainingAmount: result.remainingAmount,
        status: 'draft',
        accountSetId: asset.accountSetId,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      };

      records.push(record);
      totalAmortization += result.periodAmortization;
    }

    return {
      records,
      totalAmortization,
      entityCount: records.length,
      period,
      errors,
    };
  },

  // 保存摊销记录
  saveAmortizationRecords: async (records) => {
    try {
      const db = await getCurrentManager().getDatabase();
      // 将 undefined 转为 null，避免 SQL.js 报错
      const safeValue = <T,>(v: T | undefined): T | null => v ?? null;

      for (const record of records) {
        const stmt = db.prepare(
          `INSERT INTO amortizationRecords (
            id, tenantId, entityType, entityId, entityCode, entityName,
            period, amortizationDate, periodAmortization, accumulatedAmortization, remainingAmount,
            unitsThisPeriod, voucherId, voucherNo, status, notes,
            accountSetId, createTime, updateTime
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        );
        stmt.run([
          record.id, sqliteService.tenantId, record.entityType, record.entityId, record.entityCode, record.entityName,
          record.period, record.amortizationDate,
          record.periodAmortization, record.accumulatedAmortization, record.remainingAmount,
          safeValue(record.unitsThisPeriod), safeValue(record.voucherId), safeValue(record.voucherNo),
          record.status, safeValue(record.notes),
          record.accountSetId, record.createTime, record.updateTime,
        ]);
        stmt.free();
      }

      set((state) => ({
        amortizationRecords: [...state.amortizationRecords, ...records],
        error: null,
      }));
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '保存摊销记录失败' });
      throw error;
    }
  },

  // 记账摊销记录
  postAmortizationRecords: async (recordIds) => {
    const state = get();
    const records = state.amortizationRecords.filter(r => recordIds.includes(r.id));

    try {
      const db = await getCurrentManager().getDatabase();
      const accountSetId = useAccountSetStore.getState().getCurrentAccountSet()?.id || '';

      for (const record of records) {
        // 更新摊销记录状态
        let stmt = db.prepare(
          'UPDATE amortizationRecords SET status = ?, updateTime = ? WHERE id = ? AND tenantId = ? AND accountSetId = ?'
        );
        stmt.run(['posted', new Date().toISOString(), record.id, sqliteService.tenantId, record.accountSetId ?? '']);
        stmt.free();

        // 更新资产的累计摊销
        const asset = state.assets.find(a => a.id === record.entityId);
        if (asset && record.entityType === 'intangible') {
          const newAccumulated = asset.accumulatedAmortization + record.periodAmortization;
          const newNetValue = asset.originalValue - newAccumulated;

          stmt = db.prepare(
            `UPDATE intangibleAssets SET
              accumulatedAmortization = ?, netValue = ?, lastAmortizationDate = ?, updateTime = ?
            WHERE id = ? AND tenantId = ? AND accountSetId = ?`
          );
          stmt.run([newAccumulated, newNetValue, record.amortizationDate, new Date().toISOString(), asset.id, sqliteService.tenantId, asset.accountSetId ?? '']);
          stmt.free();

          // 写入时序账
          await get().logIntangibleChange({
            assetId: asset.id,
            assetCode: asset.assetCode,
            assetName: asset.assetName,
            accountSetId,
            changeType: 'amortization',
            changeDate: record.amortizationDate,
            period: record.period,
            fieldName: 'amortization',
            amortizationChange: record.periodAmortization,
            accumulatedAmortizationBalance: newAccumulated,
            netValueBalance: newNetValue,
            originalValueBalance: asset.originalValue,
            voucherId: record.voucherId,
            voucherNo: record.voucherNo,
            reason: `${record.period} 摊销`,
          });
        }
      }

      // 更新本地状态
      set((state) => ({
        amortizationRecords: state.amortizationRecords.map(r =>
          recordIds.includes(r.id) ? { ...r, status: 'posted' as const } : r
        ),
        assets: state.assets.map(a => {
          const relatedRecord = records.find(r => r.entityId === a.id && r.entityType === 'intangible');
          if (relatedRecord) {
            return {
              ...a,
              accumulatedAmortization: a.accumulatedAmortization + relatedRecord.periodAmortization,
              netValue: a.originalValue - (a.accumulatedAmortization + relatedRecord.periodAmortization),
              lastAmortizationDate: relatedRecord.amortizationDate,
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

  // 获取在用资产
  getActiveAssets: () => {
    return get().assets.filter(a => a.status === 'active');
  },

  // 时序账：记录变动
  logIntangibleChange: async (record) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      if (currentAccountSet?.id) {
        sqliteService.setAccountSetId(currentAccountSet.id);
      }
      const db = await sqliteService.getDatabase();
      if (!db) throw new Error('数据库未初始化');

      const id = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const stmt = db.prepare(
        `INSERT INTO intangibleChangeRecords (
          id, tenantId, assetId, assetCode, assetName, accountSetId, changeType, changeDate, period,
          fieldName, beforeValue, afterValue,
          originalValueChange, amortizationChange, originalValueBalance,
          accumulatedAmortizationBalance, netValueBalance,
          voucherId, voucherNo, reason, operatorId, createTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        id, sqliteService.tenantId, record.assetId, record.assetCode, record.assetName, record.accountSetId,
        record.changeType, record.changeDate, record.period,
        record.fieldName, record.beforeValue || '', record.afterValue || '',
        record.originalValueChange ?? null, record.amortizationChange ?? null,
        record.originalValueBalance ?? null, record.accumulatedAmortizationBalance ?? null,
        record.netValueBalance ?? null,
        record.voucherId || '', record.voucherNo || '', record.reason || '', record.operatorId || '',
        now,
      ]);
      stmt.free();
    } catch (error: unknown) {
      console.warn('记录无形资产时序账失败:', error);
    }
  },

  // 时序账：查询
  getIntangibleChangeRecords: async (assetId) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      if (!db) return [];
      const result = db.exec(
        `SELECT id, assetId, assetCode, assetName, accountSetId, changeType, changeDate, period,
                fieldName, beforeValue, afterValue,
                originalValueChange, amortizationChange, originalValueBalance,
                accumulatedAmortizationBalance, netValueBalance,
                voucherId, voucherNo, reason, operatorId, createTime
         FROM intangibleChangeRecords WHERE assetId = ? AND tenantId = ? ORDER BY changeDate ASC, createTime ASC`,
        [assetId, sqliteService.tenantId]
      );
      return result[0]?.values?.map((row: SqliteBindable[]) => ({
        id: String(row[0] ?? ''),
        assetId: String(row[1] ?? ''),
        assetCode: String(row[2] ?? ''),
        assetName: String(row[3] ?? ''),
        accountSetId: String(row[4] ?? ''),
        changeType: String(row[5] ?? '') as IntangibleChangeRecord['changeType'],
        changeDate: String(row[6] ?? ''),
        period: String(row[7] ?? ''),
        fieldName: String(row[8] ?? ''),
        beforeValue: row[9] ? String(row[9]) : '',
        afterValue: row[10] ? String(row[10]) : '',
        originalValueChange: row[11] != null ? Number(row[11]) : undefined,
        amortizationChange: row[12] != null ? Number(row[12]) : undefined,
        originalValueBalance: row[13] != null ? Number(row[13]) : undefined,
        accumulatedAmortizationBalance: row[14] != null ? Number(row[14]) : undefined,
        netValueBalance: row[15] != null ? Number(row[15]) : undefined,
        voucherId: row[16] ? String(row[16]) : undefined,
        voucherNo: row[17] ? String(row[17]) : undefined,
        reason: row[18] ? String(row[18]) : undefined,
        operatorId: row[19] ? String(row[19]) : undefined,
        createTime: String(row[20] ?? ''),
      })) ?? [];
    } catch (error) {
      console.warn('查询无形资产时序账失败:', error);
      return [];
    }
  },

  // 时序账：清空
  clearIntangibleChangeRecords: async (assetId) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      if (accountSetStore.getCurrentAccountSet()?.id) {
        sqliteService.setAccountSetId(accountSetStore.getCurrentAccountSet()!.id);
      }
      const db = await sqliteService.getDatabase();
      if (!db) throw new Error('数据库未初始化');
      const stmt = db.prepare(`DELETE FROM intangibleChangeRecords WHERE assetId = ? AND tenantId = ?`);
      stmt.run([assetId, sqliteService.tenantId]);
      stmt.free();
    } catch (error) {
      console.warn('清空无形资产时序账失败:', error);
      throw error;
    }
  },

  // 红冲联动：按原凭证 ID 回退无形资产摊销
  reverseAmortizationByVoucherId: async (originalVoucherId) => {
    try {
      const db = await getCurrentManager().getDatabase();
      const accountSetId = useAccountSetStore.getState().getCurrentAccountSet()?.id || '';

      // 1. 查关联的摊销记录（含 period/voucherNo 用于时序账回填）
      const result = db.exec(
        `SELECT id, entityId, period, periodAmortization, voucherNo
         FROM amortizationRecords
         WHERE voucherId = ? AND entityType = 'intangible' AND tenantId = ?
         AND (accountSetId = ? OR accountSetId IS NULL)`,
        [originalVoucherId, sqliteService.tenantId, accountSetId]
      );
      const rows: SqliteBindable[][] = result[0]?.values ?? [];
      if (rows.length === 0) return;

      const today = new Date().toISOString().slice(0, 10);
      const currentPeriod = today.substring(0, 7);

      // 2. 回退每条记录对应的资产余额 + 写反向时序账
      for (const row of rows) {
        const recordId = String(row[0] ?? '');
        const entityId = String(row[1] ?? '');
        const period = String(row[2] ?? '');
        const delta = Number(row[3] ?? 0);
        const origVoucherNo = String(row[4] ?? '');
        const assetResult = db.exec(
          `SELECT assetCode, assetName, originalValue, accumulatedAmortization FROM intangibleAssets WHERE id = ? AND tenantId = ?`,
          [entityId, sqliteService.tenantId]
        );
        const assetRow = assetResult[0]?.values?.[0];
        if (assetRow) {
          const assetCode = String(assetRow[0] ?? '');
          const assetName = String(assetRow[1] ?? '');
          const originalValue = Number(assetRow[2] ?? 0);
          const newAccumulated = Number(assetRow[3] ?? 0) - delta;
          const newNet = originalValue - newAccumulated;
          const stmt = db.prepare(
            `UPDATE intangibleAssets SET accumulatedAmortization = ?, netValue = ?, updateTime = ? WHERE id = ? AND tenantId = ?`
          );
          stmt.run([newAccumulated, newNet, new Date().toISOString(), entityId, sqliteService.tenantId]);
          stmt.free();

          // 写反向时序账行
          await get().logIntangibleChange({
            assetId: entityId,
            assetCode,
            assetName,
            accountSetId,
            changeType: 'voucher_reversal',
            changeDate: today,
            period: currentPeriod,
            fieldName: 'voucher_reversal',
            amortizationChange: -delta,
            accumulatedAmortizationBalance: newAccumulated,
            netValueBalance: newNet,
            originalValueBalance: originalValue,
            voucherId: originalVoucherId,
            voucherNo: origVoucherNo,
            reason: `红冲 ${origVoucherNo || originalVoucherId}（原期间 ${period}）`,
          });
        }
        // 回退摊销记录状态
        const revStmt = db.prepare(
          `UPDATE amortizationRecords SET status = 'draft', voucherId = '', voucherNo = '', updateTime = ? WHERE id = ? AND tenantId = ?`
        );
        revStmt.run([new Date().toISOString(), recordId, sqliteService.tenantId]);
        revStmt.free();
      }

      // 3. 同步本地 state
      await get().initialize();
    } catch (error: unknown) {
      console.warn('红冲联动无形资产失败:', error);
      throw error;
    }
  },

  // 获取摊销历史
  getAmortizationHistory: (assetId) => {
    return get().amortizationRecords
      .filter(r => r.entityId === assetId && r.entityType === 'intangible')
      .sort((a, b) => a.period.localeCompare(b.period));
  },

  // 按类型获取资产
  getAssetsByType: (type) => {
    return get().assets.filter(a => a.assetType === type);
  },

  // 从Excel导入
  importFromExcel: async (importedAssets) => {
    const state = get();
    const errors: string[] = [];
    let success = 0;

    for (const item of importedAssets) {
      try {
        if (!item.assetName || !item.originalValue || !item.acquisitionDate) {
          errors.push(`行 ${importedAssets.indexOf(item) + 1}: 缺少必填字段`);
          continue;
        }

        if (item.assetCode && state.assets.some(a => a.assetCode === item.assetCode)) {
          errors.push(`行 ${importedAssets.indexOf(item) + 1}: 资产编码 ${item.assetCode} 已存在`);
          continue;
        }

        const method: AmortizationMethod = item.amortizationMethod
          ? parseAmortizationMethod(item.amortizationMethod)
          : 'straight_line';

        await get().addAsset({
          assetCode: item.assetCode || `IA-${Date.now()}`,
          assetName: item.assetName,
          assetType: (item.assetType as IntangibleAssetType) || 'other',
          originalValue: item.originalValue,
          residualValue: item.residualValue || 0,
          accumulatedAmortization: 0,
          netValue: item.originalValue,
          amortizationMethod: method,
          usefulLifeYears: item.usefulLifeYears || 10,
          usefulLifeMonths: (item.usefulLifeYears || 10) * 12,
          acquisitionDate: item.acquisitionDate,
          registrationNo: item.registrationNo,
          departmentCode: item.departmentCode,
          expenseSubjectCode: item.expenseSubjectCode || '660205',
          assetSubjectCode: '1701',
          amortizationSubjectCode: '1702',
          notes: item.notes,
          status: 'active',
        });

        success++;
      } catch (error: unknown) {
        errors.push(`行 ${importedAssets.indexOf(item) + 1}: ${getErrorMessage(error)}`);
      }
    }

    return { success, errors };
  },

  // 导出到Excel
  exportToExcel: () => {
    return get().assets;
  },

  // 设置选中的资产ID
  setSelectedAssetId: (id) => {
    set({ selectedAssetId: id });
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
          amortizationRecords: [],
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
          amortizationRecords: [],
          loading: false,
          error: '数据库初始化失败'
        });
        return;
      }

      // 加载资产
      const assetsResult = db.exec(
        'SELECT * FROM intangibleAssets WHERE tenantId = ? AND (accountSetId = ? OR accountSetId IS NULL) ORDER BY createTime DESC',
        [sqliteService.tenantId, accountSetId]
      );
      const assets: IntangibleAsset[] = assetsResult[0]?.values?.map((row: Array<string | number | Uint8Array | null>) => ({
        id: row[0],
        assetCode: row[1],
        assetName: row[2],
        assetType: row[3],
        originalValue: row[4],
        residualValue: row[5],
        accumulatedAmortization: row[6],
        netValue: row[7],
        amortizationMethod: row[8],
        usefulLifeYears: row[9],
        usefulLifeMonths: row[10],
        totalUnits: row[11],
        unitsUsed: row[12],
        acquisitionDate: row[13],
        amortizationStartDate: row[14],
        lastAmortizationDate: row[15],
        expiryDate: row[16],
        status: row[17],
        assetSubjectCode: row[18],
        assetSubjectName: row[19],
        amortizationSubjectCode: row[20],
        amortizationSubjectName: row[21],
        expenseSubjectCode: row[22],
        expenseSubjectName: row[23],
        registrationNo: row[24],
        legalLifeYears: row[25],
        departmentCode: row[26],
        departmentName: row[27],
        notes: row[28],
        accountSetId: row[29],
        createTime: row[30],
        updateTime: row[31],
      })) || [];

      // 加载摊销记录
      const recordsResult = db.exec(
        `SELECT * FROM amortizationRecords
         WHERE tenantId = ? AND (accountSetId = ? OR accountSetId IS NULL) AND entityType = 'intangible'
         ORDER BY period DESC`,
        [sqliteService.tenantId, accountSetId]
      );
      const amortizationRecords: AmortizationRecord[] = recordsResult[0]?.values?.map((row: Array<string | number | Uint8Array | null>) => ({
        id: row[0],
        entityType: row[1],
        entityId: row[2],
        entityCode: row[3],
        entityName: row[4],
        period: row[5],
        amortizationDate: row[6],
        periodAmortization: row[7],
        accumulatedAmortization: row[8],
        remainingAmount: row[9],
        unitsThisPeriod: row[10],
        voucherId: row[11],
        voucherNo: row[12],
        status: row[13],
        notes: row[14],
        accountSetId: row[15],
        createTime: row[16],
        updateTime: row[17],
      })) || [];

      set({
        assets,
        amortizationRecords,
        loading: false,
      });
    } catch (error: unknown) {
      console.error('初始化无形资产Store失败:', error);
      set({ loading: false, error: getErrorMessage(error) || '初始化失败' });
    }
  },

  // 生成摊销凭证（无形资产）
  generateAmortizationVoucher: async (recordIds, voucherDate) => {
    const state = get();
    const records = state.amortizationRecords.filter(r => recordIds.includes(r.id));

    if (records.length === 0) {
      set({ error: '没有找到摊销记录' });
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
        'SELECT voucherNo FROM vouchers WHERE tenantId = ? AND accountSetId = ? AND voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1',
        [sqliteService.tenantId, accountSetId, `记-${yearMonth}-%`]
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

      // 按费用科目分组汇总摊销金额
      const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

      for (const record of records) {
        const asset = state.assets.find(a => a.id === record.entityId);
        if (!asset) continue;

        const expenseCode = asset.expenseSubjectCode || '660205';
        const expenseName = asset.expenseSubjectName || '管理费用-摊销费';

        const existing = expenseMap.get(expenseCode);
        if (existing) {
          existing.amount += record.periodAmortization;
        } else {
          expenseMap.set(expenseCode, {
            code: expenseCode,
            name: expenseName,
            amount: record.periodAmortization,
          });
        }
      }

      // 计算总摊销额
      const totalAmortization = records.reduce((sum, r) => sum + r.periodAmortization, 0);

      // 生成凭证ID
      const voucherId = generateId();
      const now = new Date().toISOString();

      // 创建凭证
      let stmt = db.prepare(
        `INSERT INTO vouchers (id, tenantId, voucherNo, date, status, summary, creator, accountSetId, createTime, updateTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([voucherId, sqliteService.tenantId, voucherNo, voucherDate, 'draft', '无形资产摊销', 'system', accountSetId, now, now]);
      stmt.free();

      // 创建分录 - 借方：费用科目（按科目分组）
      for (const [, expense] of expenseMap) {
        const entryId = generateId();
        stmt = db.prepare(
          `INSERT INTO entries (
            id, tenantId, voucherId, subjectCode, subjectName, direction, debit, credit,
            summary, customerName, supplierName, auxiliary, recRefNo,
            departmentCode, departmentName, projectCode, projectName,
            currencyCode, exchangeRate, originalAmount, date, accountSetId,
            createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([
          entryId, sqliteService.tenantId, voucherId, expense.code, expense.name, 'debit', expense.amount, 0,
          '无形资产摊销', '', '', '{}', '',
          '', '', '', '',
          '', 0, 0, voucherDate, accountSetId,
          now, now
        ]);
        stmt.free();
      }

      // 创建分录 - 贷方：累计摊销
      const creditEntryId = generateId();
      stmt = db.prepare(
        `INSERT INTO entries (
          id, tenantId, voucherId, subjectCode, subjectName, direction, debit, credit,
          summary, customerName, supplierName, auxiliary, recRefNo,
          departmentCode, departmentName, projectCode, projectName,
          currencyCode, exchangeRate, originalAmount, date, accountSetId,
          createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([
        creditEntryId, sqliteService.tenantId, voucherId, '1702', '累计摊销', 'credit', 0, totalAmortization,
        '无形资产摊销', '', '', '{}', '',
        '', '', '', '',
        '', 0, 0, voucherDate, accountSetId,
        now, now
      ]);
      stmt.free();

      // 更新摊销记录，关联凭证
      for (const record of records) {
        stmt = db.prepare(
          'UPDATE amortizationRecords SET voucherId = ?, voucherNo = ?, updateTime = ? WHERE id = ? AND tenantId = ? AND accountSetId = ?'
        );
        stmt.run([voucherId, voucherNo, now, record.id, sqliteService.tenantId, record.accountSetId ?? '']);
        stmt.free();
      }

      // 更新本地状态
      set((state) => ({
        amortizationRecords: state.amortizationRecords.map(r =>
          recordIds.includes(r.id) ? { ...r, voucherId, voucherNo } : r
        ),
        error: null,
      }));

      return { voucherId, voucherNo };
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '生成摊销凭证失败' });
      throw error;
    }
  },
}));
