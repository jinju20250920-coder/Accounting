'use client';

import { create } from 'zustand';
import { getCurrentManager } from '@/lib/database';
import { useAccountSetStore } from './useAccountSetStore';
import { calculatePeriodAmount } from '@/lib/amortization';
import { generateId, getErrorMessage } from '@/lib/utils';
import type { SqliteBindable } from '@/lib/database/services/fixed-asset-sqlite-service';
import type {
  PrepaidExpense,
  AmortizationRecord,
  BatchAmortizationResult,
  PrepaidExpenseType,
  AmortizationStatus,
  PrepaidChangeRecord,
} from '@/types';

interface PrepaidExpenseStore {
  // 状态
  expenses: PrepaidExpense[];
  amortizationRecords: AmortizationRecord[];
  loading: boolean;
  error: string | null;
  selectedExpenseId: string | null;

  // CRUD
  addExpense: (expense: Omit<PrepaidExpense, 'id' | 'createTime' | 'updateTime'>) => Promise<PrepaidExpense>;
  updateExpense: (id: string, updates: Partial<PrepaidExpense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getExpenseById: (id: string) => PrepaidExpense | undefined;
  getExpenseByCode: (code: string) => PrepaidExpense | undefined;

  // 摊销
  calculatePeriodAmortization: (expenseId: string) => number;
  batchCalculateAmortization: (expenseIds: string[], period: string) => BatchAmortizationResult;
  saveAmortizationRecords: (records: AmortizationRecord[]) => Promise<void>;
  postAmortizationRecords: (recordIds: string[]) => Promise<void>;
  reverseAmortizationByVoucherId: (originalVoucherId: string) => Promise<void>;

  // 时序账
  logPrepaidChange: (record: Omit<PrepaidChangeRecord, 'id' | 'createTime'>) => Promise<void>;
  getPrepaidChangeRecords: (expenseId: string) => Promise<PrepaidChangeRecord[]>;
  clearPrepaidChangeRecords: (expenseId: string) => Promise<void>;

  // 查询
  getActiveExpenses: () => PrepaidExpense[];
  getAmortizationHistory: (expenseId: string) => AmortizationRecord[];
  getExpensesByType: (type: PrepaidExpenseType) => PrepaidExpense[];

  // 导入导出
  importFromExcel: (expenses: Partial<PrepaidExpense>[]) => Promise<{ success: number; errors: string[] }>;
  exportToExcel: () => PrepaidExpense[];

  // 凭证生成
  generateAmortizationVoucher: (recordIds: string[], voucherDate: string) => Promise<{ voucherId: string; voucherNo: string } | null>;

  // 更正摊销（红字冲销）
  correctAmortizationRecord: (recordId: string, voucherDate: string) => Promise<{ voucherId: string; voucherNo: string } | null>;

  // 状态管理
  setSelectedExpenseId: (id: string | null) => void;
  clearError: () => void;
  initialize: () => Promise<void>;
}

export const usePrepaidExpenseStore = create<PrepaidExpenseStore>((set, get) => ({
  // 初始状态
  expenses: [],
  amortizationRecords: [],
  loading: false,
  error: null,
  selectedExpenseId: null,

  // 添加待摊费用
  addExpense: async (expenseData) => {
    const state = get();
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();

    if (!currentAccountSet?.id) {
      const error = '请先选择账套';
      set({ error });
      throw new Error(error);
    }

    // 自动生成编码（如果未提供且规则为自动编码）
    let expenseCode = expenseData.expenseCode;
    const { CodeRuleManager, generateCode } = await import('@/lib/code-generator');
    const codeManager = CodeRuleManager.getInstance();
    const rule = codeManager.getRuleByType('prepaid_expense');

    if (!expenseCode && rule.autoIncrement) {
      const existingCodes = state.expenses.map(e => e.expenseCode).filter(Boolean);
      const result = generateCode(rule, existingCodes);
      expenseCode = result.code;
      codeManager.setRule(result.updatedRule);
    }

    if (!expenseCode) {
      const error = '请输入费用编码';
      set({ error });
      throw new Error(error);
    }

    // 检查编码是否重复
    if (state.expenses.some(e => e.expenseCode === expenseCode)) {
      const error = '费用编码已存在';
      set({ error });
      throw new Error(error);
    }

    const now = new Date().toISOString();

    // 计算每期金额
    const periodAmount = calculatePeriodAmount(
      expenseData.originalAmount,
      expenseData.amortizationPeriods
    );

    const newExpense: PrepaidExpense = {
      ...expenseData,
      expenseCode,
      id: generateId(),
      periodAmount,
      amortizedAmount: expenseData.amortizedAmount || 0,
      remainingAmount: expenseData.originalAmount - (expenseData.amortizedAmount || 0),
      amortizedPeriods: expenseData.amortizedPeriods || 0,
      status: expenseData.status || 'not_started',
      accountSetId: currentAccountSet?.id,
      createTime: now,
      updateTime: now,
    };

    try {
      const db = await getCurrentManager().getDatabase();
      // 将 undefined 转为 null，避免 SQL.js 报错
      const safeValue = <T,>(v: T | undefined): T | null => v ?? null;
      const stmt = db.prepare(
        `INSERT INTO prepaidExpenses (
          id, expenseCode, expenseName, expenseType, originalAmount,
          amortizedAmount, remainingAmount, amortizationMethod, amortizationPeriods,
          amortizedPeriods, periodAmount, paymentDate, startDate, endDate,
          lastAmortizationDate, status, prepaidSubjectCode, prepaidSubjectName,
          expenseSubjectCode, expenseSubjectName, supplierName, invoiceNo, contractNo,
          departmentCode, departmentName, notes, accountSetId, createTime, updateTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        newExpense.id, newExpense.expenseCode, newExpense.expenseName,
        safeValue(newExpense.expenseType), newExpense.originalAmount,
        newExpense.amortizedAmount, newExpense.remainingAmount,
        safeValue(newExpense.amortizationMethod), newExpense.amortizationPeriods,
        newExpense.amortizedPeriods, newExpense.periodAmount,
        safeValue(newExpense.paymentDate), safeValue(newExpense.startDate), safeValue(newExpense.endDate),
        safeValue(newExpense.lastAmortizationDate), newExpense.status,
        safeValue(newExpense.prepaidSubjectCode), safeValue(newExpense.prepaidSubjectName),
        safeValue(newExpense.expenseSubjectCode), safeValue(newExpense.expenseSubjectName),
        safeValue(newExpense.supplierName), safeValue(newExpense.invoiceNo), safeValue(newExpense.contractNo),
        safeValue(newExpense.departmentCode), safeValue(newExpense.departmentName),
        safeValue(newExpense.notes), newExpense.accountSetId, newExpense.createTime, newExpense.updateTime,
      ]);
      stmt.free();

      set((state) => ({
        expenses: [...state.expenses, newExpense],
        error: null,
      }));

      return newExpense;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '添加待摊费用失败' });
      throw error;
    }
  },

  // 更新待摊费用
  updateExpense: async (id, updates) => {
    const state = get();
    const expense = state.expenses.find(e => e.id === id);
    if (!expense) {
      set({ error: '待摊费用不存在' });
      return;
    }

    const now = new Date().toISOString();
    const updatedExpense: PrepaidExpense = {
      ...expense,
      ...updates,
      updateTime: now,
    };

    // 重新计算相关字段
    if (updates.originalAmount !== undefined || updates.amortizedAmount !== undefined) {
      updatedExpense.remainingAmount = updatedExpense.originalAmount - updatedExpense.amortizedAmount;
    }

    if (updates.originalAmount !== undefined || updates.amortizationPeriods !== undefined) {
      updatedExpense.periodAmount = calculatePeriodAmount(
        updatedExpense.originalAmount,
        updatedExpense.amortizationPeriods
      );
    }

    try {
      const db = await getCurrentManager().getDatabase();
      // 将 undefined 转为 null，避免 SQL.js 报错
      const safeValue = <T,>(v: T | undefined): T | null => v ?? null;
      const stmt = db.prepare(
        `UPDATE prepaidExpenses SET
          expenseName=?, expenseType=?, originalAmount=?,
          amortizedAmount=?, remainingAmount=?, amortizationMethod=?,
          amortizationPeriods=?, amortizedPeriods=?, periodAmount=?,
          paymentDate=?, startDate=?, endDate=?,
          lastAmortizationDate=?, status=?,
          prepaidSubjectCode=?, prepaidSubjectName=?,
          expenseSubjectCode=?, expenseSubjectName=?,
          supplierName=?, invoiceNo=?, contractNo=?,
          departmentCode=?, departmentName=?, notes=?, updateTime=?
        WHERE id=?`
      );
      stmt.run([
        updatedExpense.expenseName, safeValue(updatedExpense.expenseType), updatedExpense.originalAmount,
        updatedExpense.amortizedAmount, updatedExpense.remainingAmount,
        safeValue(updatedExpense.amortizationMethod), updatedExpense.amortizationPeriods,
        updatedExpense.amortizedPeriods, updatedExpense.periodAmount,
        safeValue(updatedExpense.paymentDate), safeValue(updatedExpense.startDate), safeValue(updatedExpense.endDate),
        safeValue(updatedExpense.lastAmortizationDate), updatedExpense.status,
        safeValue(updatedExpense.prepaidSubjectCode), safeValue(updatedExpense.prepaidSubjectName),
        safeValue(updatedExpense.expenseSubjectCode), safeValue(updatedExpense.expenseSubjectName),
        safeValue(updatedExpense.supplierName), safeValue(updatedExpense.invoiceNo), safeValue(updatedExpense.contractNo),
        safeValue(updatedExpense.departmentCode), safeValue(updatedExpense.departmentName),
        safeValue(updatedExpense.notes), updatedExpense.updateTime, id,
      ]);
      stmt.free();

      set((state) => ({
        expenses: state.expenses.map(e => e.id === id ? updatedExpense : e),
        error: null,
      }));
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '更新待摊费用失败' });
      throw error;
    }
  },

  // 删除待摊费用
  deleteExpense: async (id) => {
    const state = get();
    const expense = state.expenses.find(e => e.id === id);
    if (!expense) {
      set({ error: '待摊费用不存在' });
      return;
    }

    // 检查是否有未记账的摊销记录
    const hasUnpostedRecords = state.amortizationRecords.some(
      r => r.entityId === id && r.entityType === 'prepaid' && r.status === 'draft'
    );
    if (hasUnpostedRecords) {
      set({ error: '该待摊费用有未记账的摊销记录，无法删除' });
      return;
    }

    try {
      const db = await getCurrentManager().getDatabase();
      // 删除摊销记录
      let stmt = db.prepare('DELETE FROM amortizationRecords WHERE entityId = ? AND entityType = ?');
      stmt.run([id, 'prepaid']);
      stmt.free();
      // 删除待摊费用
      stmt = db.prepare('DELETE FROM prepaidExpenses WHERE id = ?');
      stmt.run([id]);
      stmt.free();

      set((state) => ({
        expenses: state.expenses.filter(e => e.id !== id),
        amortizationRecords: state.amortizationRecords.filter(
          r => !(r.entityId === id && r.entityType === 'prepaid')
        ),
        error: null,
      }));
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '删除待摊费用失败' });
      throw error;
    }
  },

  // 按ID获取待摊费用
  getExpenseById: (id) => {
    return get().expenses.find(e => e.id === id);
  },

  // 按编码获取待摊费用
  getExpenseByCode: (code) => {
    return get().expenses.find(e => e.expenseCode === code);
  },

  // 计算本期摊销额
  calculatePeriodAmortization: (expenseId) => {
    const expense = get().expenses.find(e => e.id === expenseId);
    if (!expense || (expense.status !== 'active' && expense.status !== 'not_started')) return 0;
    return expense.periodAmount;
  },

  // 批量计算摊销
  batchCalculateAmortization: (expenseIds, period) => {
    const state = get();
    const records: AmortizationRecord[] = [];
    const errors: Array<{ entityId: string; entityName: string; error: string }> = [];
    let totalAmortization = 0;

    for (const expenseId of expenseIds) {
      const expense = state.expenses.find(e => e.id === expenseId);
      if (!expense) {
        errors.push({ entityId: expenseId, entityName: '未知', error: '待摊费用不存在' });
        continue;
      }

      if (expense.status !== 'active' && expense.status !== 'not_started') {
        errors.push({ entityId: expenseId, entityName: expense.expenseName, error: '待摊费用状态不可摊销' });
        continue;
      }

      // 检查是否已摊销完毕
      if (expense.amortizedPeriods >= expense.amortizationPeriods) {
        continue;
      }

      const periodAmortization = expense.periodAmount;
      if (periodAmortization <= 0) continue;

      const newAccumulated = expense.amortizedAmount + periodAmortization;
      const newRemaining = expense.originalAmount - newAccumulated;

      const record: AmortizationRecord = {
        id: generateId(),
        entityType: 'prepaid',
        entityId: expense.id,
        entityCode: expense.expenseCode,
        entityName: expense.expenseName,
        period,
        amortizationDate: `${period}-01`,
        periodAmortization,
        accumulatedAmortization: newAccumulated,
        remainingAmount: Math.max(0, newRemaining),
        status: 'draft',
        accountSetId: expense.accountSetId,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      };

      records.push(record);
      totalAmortization += periodAmortization;
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
            id, entityType, entityId, entityCode, entityName,
            period, amortizationDate, periodAmortization, accumulatedAmortization, remainingAmount,
            unitsThisPeriod, voucherId, voucherNo, status, notes,
            accountSetId, createTime, updateTime
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        );
        stmt.run([
          record.id, record.entityType, record.entityId, record.entityCode, record.entityName,
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
          'UPDATE amortizationRecords SET status = ?, updateTime = ? WHERE id = ?'
        );
        stmt.run(['posted', new Date().toISOString(), record.id]);
        stmt.free();

        // 更新待摊费用的累计摊销
        const expense = state.expenses.find(e => e.id === record.entityId);
        if (expense && record.entityType === 'prepaid') {
          const newAmortized = expense.amortizedAmount + record.periodAmortization;
          const newRemaining = expense.originalAmount - newAmortized;
          const newPeriods = expense.amortizedPeriods + 1;
          const isCompleted = newPeriods >= expense.amortizationPeriods;

          stmt = db.prepare(
            `UPDATE prepaidExpenses SET
              amortizedAmount = ?, remainingAmount = ?, amortizedPeriods = ?,
              lastAmortizationDate = ?, status = ?, updateTime = ?
            WHERE id = ?`
          );
          stmt.run([
            newAmortized, newRemaining, newPeriods,
            record.amortizationDate, isCompleted ? 'fully_amortized' : 'active',
            new Date().toISOString(), expense.id,
          ]);
          stmt.free();

          // 写入时序账
          await get().logPrepaidChange({
            assetId: expense.id,
            assetCode: expense.expenseCode,
            assetName: expense.expenseName,
            accountSetId,
            changeType: 'amortization',
            changeDate: record.amortizationDate,
            period: record.period,
            fieldName: 'amortization',
            amortizationChange: record.periodAmortization,
            accumulatedAmortizationBalance: newAmortized,
            netValueBalance: newRemaining,
            originalValueBalance: expense.originalAmount,
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
        expenses: state.expenses.map(e => {
          const relatedRecord = records.find(r => r.entityId === e.id && r.entityType === 'prepaid');
          if (relatedRecord) {
            const newAmortized = e.amortizedAmount + relatedRecord.periodAmortization;
            const newPeriods = e.amortizedPeriods + 1;
            return {
              ...e,
              amortizedAmount: newAmortized,
              remainingAmount: e.originalAmount - newAmortized,
              amortizedPeriods: newPeriods,
              lastAmortizationDate: relatedRecord.amortizationDate,
              status: newPeriods >= e.amortizationPeriods ? 'fully_amortized' as const : newPeriods > 0 ? 'active' as const : 'not_started' as const,
              updateTime: new Date().toISOString(),
            };
          }
          return e;
        }),
        error: null,
      }));
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '记账失败' });
      throw error;
    }
  },

  // 获取在用待摊费用
  getActiveExpenses: () => {
    return get().expenses.filter(e => e.status === 'active' || e.status === 'not_started');
  },

  // 时序账：记录变动
  logPrepaidChange: async (record) => {
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
        `INSERT INTO prepaidChangeRecords (
          id, assetId, assetCode, assetName, accountSetId, changeType, changeDate, period,
          fieldName, beforeValue, afterValue,
          originalValueChange, amortizationChange, originalValueBalance,
          accumulatedAmortizationBalance, netValueBalance,
          voucherId, voucherNo, reason, operatorId, createTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        id, record.assetId, record.assetCode, record.assetName, record.accountSetId,
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
      console.warn('记录待摊费用时序账失败:', error);
    }
  },

  // 时序账：查询
  getPrepaidChangeRecords: async (expenseId) => {
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
         FROM prepaidChangeRecords WHERE assetId = ? ORDER BY changeDate ASC, createTime ASC`,
        [expenseId]
      );
      return result[0]?.values?.map((row: SqliteBindable[]) => ({
        id: String(row[0] ?? ''),
        assetId: String(row[1] ?? ''),
        assetCode: String(row[2] ?? ''),
        assetName: String(row[3] ?? ''),
        accountSetId: String(row[4] ?? ''),
        changeType: String(row[5] ?? '') as PrepaidChangeRecord['changeType'],
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
      console.warn('查询待摊费用时序账失败:', error);
      return [];
    }
  },

  // 时序账：清空
  clearPrepaidChangeRecords: async (expenseId) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      if (accountSetStore.getCurrentAccountSet()?.id) {
        sqliteService.setAccountSetId(accountSetStore.getCurrentAccountSet()!.id);
      }
      const db = await sqliteService.getDatabase();
      if (!db) throw new Error('数据库未初始化');
      const stmt = db.prepare(`DELETE FROM prepaidChangeRecords WHERE assetId = ?`);
      stmt.run([expenseId]);
      stmt.free();
    } catch (error) {
      console.warn('清空待摊费用时序账失败:', error);
      throw error;
    }
  },

  // 红冲联动：按原凭证 ID 回退待摊费用摊销
  reverseAmortizationByVoucherId: async (originalVoucherId) => {
    try {
      const db = await getCurrentManager().getDatabase();
      const accountSetId = useAccountSetStore.getState().getCurrentAccountSet()?.id || '';

      // 1. 查关联的摊销记录（含 period/voucherNo 用于时序账回填）
      const result = db.exec(
        `SELECT id, entityId, period, periodAmortization, voucherNo
         FROM amortizationRecords
         WHERE voucherId = ? AND entityType = 'prepaid'
         AND (accountSetId = ? OR accountSetId IS NULL)`,
        [originalVoucherId, accountSetId]
      );
      const rows: SqliteBindable[][] = result[0]?.values ?? [];
      if (rows.length === 0) return;

      const today = new Date().toISOString().slice(0, 10);
      const currentPeriod = today.substring(0, 7);

      // 2. 回退每条记录对应的费用余额 + 写反向时序账
      for (const row of rows) {
        const recordId = String(row[0] ?? '');
        const entityId = String(row[1] ?? '');
        const period = String(row[2] ?? '');
        const delta = Number(row[3] ?? 0);
        const origVoucherNo = String(row[4] ?? '');
        const expenseResult = db.exec(
          `SELECT expenseCode, expenseName, originalAmount, amortizedAmount, amortizedPeriods
           FROM prepaidExpenses WHERE id = ?`,
          [entityId]
        );
        const expenseRow = expenseResult[0]?.values?.[0];
        if (expenseRow) {
          const expenseCode = String(expenseRow[0] ?? '');
          const expenseName = String(expenseRow[1] ?? '');
          const originalAmount = Number(expenseRow[2] ?? 0);
          const newAmortized = Number(expenseRow[3] ?? 0) - delta;
          const newPeriods = Number(expenseRow[4] ?? 0) - 1;
          const newRemaining = originalAmount - newAmortized;
          const newStatus = newPeriods <= 0 ? 'not_started' : 'active';
          const stmt = db.prepare(
            `UPDATE prepaidExpenses SET
              amortizedAmount = ?, remainingAmount = ?, amortizedPeriods = ?,
              lastAmortizationDate = '', status = ?, updateTime = ?
             WHERE id = ?`
          );
          stmt.run([
            newAmortized, newRemaining, newPeriods,
            newStatus, new Date().toISOString(), entityId,
          ]);
          stmt.free();

          // 写反向时序账行
          await get().logPrepaidChange({
            assetId: entityId,
            assetCode: expenseCode,
            assetName: expenseName,
            accountSetId,
            changeType: 'voucher_reversal',
            changeDate: today,
            period: currentPeriod,
            fieldName: 'voucher_reversal',
            amortizationChange: -delta,
            accumulatedAmortizationBalance: newAmortized,
            netValueBalance: newRemaining,
            originalValueBalance: originalAmount,
            voucherId: originalVoucherId,
            voucherNo: origVoucherNo,
            reason: `红冲 ${origVoucherNo || originalVoucherId}（原期间 ${period}）`,
          });
        }
        // 回退摊销记录状态
        const revStmt = db.prepare(
          `UPDATE amortizationRecords SET status = 'draft', voucherId = '', voucherNo = '', updateTime = ? WHERE id = ?`
        );
        revStmt.run([new Date().toISOString(), recordId]);
        revStmt.free();
      }

      // 3. 同步本地 state
      await get().initialize();
    } catch (error: unknown) {
      console.warn('红冲联动待摊费用失败:', error);
      throw error;
    }
  },

  // 获取摊销历史
  getAmortizationHistory: (expenseId) => {
    return get().amortizationRecords
      .filter(r => r.entityId === expenseId && r.entityType === 'prepaid')
      .sort((a, b) => a.period.localeCompare(b.period));
  },

  // 按类型获取待摊费用
  getExpensesByType: (type) => {
    return get().expenses.filter(e => e.expenseType === type);
  },

  // 从Excel导入
  importFromExcel: async (importedExpenses) => {
    const state = get();
    const errors: string[] = [];
    let success = 0;

    for (const item of importedExpenses) {
      try {
        if (!item.expenseName || !item.originalAmount || !item.startDate || !item.endDate) {
          errors.push(`行 ${importedExpenses.indexOf(item) + 1}: 缺少必填字段`);
          continue;
        }

        if (item.expenseCode && state.expenses.some(e => e.expenseCode === item.expenseCode)) {
          errors.push(`行 ${importedExpenses.indexOf(item) + 1}: 费用编码 ${item.expenseCode} 已存在`);
          continue;
        }

        // 计算摊销期数（按月）
        const startDate = new Date(item.startDate);
        const endDate = new Date(item.endDate);
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          (endDate.getMonth() - startDate.getMonth()) + 1;

        const amortizationPeriods = item.amortizationPeriods || monthsDiff;
        await get().addExpense({
          expenseCode: item.expenseCode || `PE-${Date.now()}`,
          expenseName: item.expenseName,
          expenseType: (item.expenseType as PrepaidExpenseType) || 'other',
          originalAmount: item.originalAmount,
          amortizedAmount: 0,
          remainingAmount: item.originalAmount,
          amortizationMethod: 'straight_line',
          amortizationPeriods,
          amortizedPeriods: 0,
          periodAmount: calculatePeriodAmount(item.originalAmount, amortizationPeriods),
          paymentDate: item.paymentDate || item.startDate,
          startDate: item.startDate,
          endDate: item.endDate,
          status: 'not_started',
          prepaidSubjectCode: item.prepaidSubjectCode || '1811',
          expenseSubjectCode: item.expenseSubjectCode || '660205',
          supplierName: item.supplierName,
          invoiceNo: item.invoiceNo,
          departmentCode: item.departmentCode,
          notes: item.notes,
        });

        success++;
      } catch (error: unknown) {
        errors.push(`行 ${importedExpenses.indexOf(item) + 1}: ${getErrorMessage(error)}`);
      }
    }

    return { success, errors };
  },

  // 导出到Excel
  exportToExcel: () => {
    return get().expenses;
  },

  // 设置选中的待摊费用ID
  setSelectedExpenseId: (id) => {
    set({ selectedExpenseId: id });
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
          expenses: [],
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
          expenses: [],
          amortizationRecords: [],
          loading: false,
          error: '数据库初始化失败'
        });
        return;
      }

      // 加载待摊费用
      const expensesResult = db.exec(
        'SELECT * FROM prepaidExpenses WHERE accountSetId = ? OR accountSetId IS NULL ORDER BY createTime DESC',
        [accountSetId]
      );
      const expenses: PrepaidExpense[] = expensesResult[0]?.values?.map((row: Array<string | number | Uint8Array | null>) => ({
        id: row[0],
        expenseCode: row[1],
        expenseName: row[2],
        expenseType: row[3],
        originalAmount: row[4],
        amortizedAmount: row[5],
        remainingAmount: row[6],
        amortizationMethod: row[7],
        amortizationPeriods: row[8],
        amortizedPeriods: row[9],
        periodAmount: row[10],
        paymentDate: row[11],
        startDate: row[12],
        endDate: row[13],
        lastAmortizationDate: row[14],
        status: row[15],
        prepaidSubjectCode: row[16],
        prepaidSubjectName: row[17],
        expenseSubjectCode: row[18],
        expenseSubjectName: row[19],
        supplierName: row[20],
        invoiceNo: row[21],
        contractNo: row[22],
        departmentCode: row[23],
        departmentName: row[24],
        notes: row[25],
        accountSetId: row[26],
        createTime: row[27],
        updateTime: row[28],
      })) || [];

      // 加载摊销记录
      const recordsResult = db.exec(
        `SELECT * FROM amortizationRecords
         WHERE (accountSetId = ? OR accountSetId IS NULL) AND entityType = 'prepaid'
         ORDER BY period DESC`,
        [accountSetId]
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
        expenses,
        amortizationRecords,
        loading: false,
      });
    } catch (error: unknown) {
      console.error('初始化待摊费用Store失败:', error);
      set({ loading: false, error: getErrorMessage(error) || '初始化失败' });
    }
  },

  // 生成摊销凭证（待摊费用）
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

      // 按费用科目和待摊科目分组汇总摊销金额
      const expenseMap = new Map<string, { code: string; name: string; amount: number }>();
      const prepaidMap = new Map<string, { code: string; name: string; amount: number }>();

      for (const record of records) {
        const expense = state.expenses.find(e => e.id === record.entityId);
        if (!expense) continue;

        const expenseCode = expense.expenseSubjectCode || '660205';
        const expenseName = expense.expenseSubjectName || '管理费用-摊销费';
        const prepaidCode = expense.prepaidSubjectCode || '1811';
        const prepaidName = expense.prepaidSubjectName || '待摊费用';

        // 费用科目（借方）
        const existingExpense = expenseMap.get(expenseCode);
        if (existingExpense) {
          existingExpense.amount += record.periodAmortization;
        } else {
          expenseMap.set(expenseCode, {
            code: expenseCode,
            name: expenseName,
            amount: record.periodAmortization,
          });
        }

        // 待摊科目（贷方）
        const existingPrepaid = prepaidMap.get(prepaidCode);
        if (existingPrepaid) {
          existingPrepaid.amount += record.periodAmortization;
        } else {
          prepaidMap.set(prepaidCode, {
            code: prepaidCode,
            name: prepaidName,
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
        `INSERT INTO vouchers (id, voucherNo, date, status, summary, creator, accountSetId, createTime, updateTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([voucherId, voucherNo, voucherDate, 'draft', '待摊费用摊销', 'system', accountSetId, now, now]);
      stmt.free();

      // 创建分录 - 借方：费用科目（按科目分组）
      for (const [, expense] of expenseMap) {
        const entryId = generateId();
        stmt = db.prepare(
          `INSERT INTO entries (
            id, voucherId, subjectCode, subjectName, direction, debit, credit,
            summary, customerName, supplierName, auxiliary, recRefNo,
            departmentCode, departmentName, projectCode, projectName,
            currencyCode, exchangeRate, originalAmount, date, accountSetId,
            createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([
          entryId, voucherId, expense.code, expense.name, 'debit', expense.amount, 0,
          '待摊费用摊销', '', '', '{}', '',
          '', '', '', '',
          '', 0, 0, voucherDate, accountSetId,
          now, now
        ]);
        stmt.free();
      }

      // 创建分录 - 贷方：待摊科目（按科目分组）
      for (const [, prepaid] of prepaidMap) {
        const entryId = generateId();
        stmt = db.prepare(
          `INSERT INTO entries (
            id, voucherId, subjectCode, subjectName, direction, debit, credit,
            summary, customerName, supplierName, auxiliary, recRefNo,
            departmentCode, departmentName, projectCode, projectName,
            currencyCode, exchangeRate, originalAmount, date, accountSetId,
            createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([
          entryId, voucherId, prepaid.code, prepaid.name, 'credit', 0, prepaid.amount,
          '待摊费用摊销', '', '', '{}', '',
          '', '', '', '',
          '', 0, 0, voucherDate, accountSetId,
          now, now
        ]);
        stmt.free();
      }

      // 更新摊销记录，关联凭证
      for (const record of records) {
        stmt = db.prepare(
          'UPDATE amortizationRecords SET voucherId = ?, voucherNo = ?, updateTime = ? WHERE id = ?'
        );
        stmt.run([voucherId, voucherNo, now, record.id]);
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

  // 更正摊销（红字冲销）：生成负数摊销记录 + 红字凭证，回退费用累计
  correctAmortizationRecord: async (recordId, voucherDate) => {
    const state = get();
    const record = state.amortizationRecords.find(r => r.id === recordId);
    if (!record) {
      set({ error: '摊销记录不存在' });
      return null;
    }
    if (record.status !== 'posted') {
      set({ error: '只能更正已记账的摊销记录' });
      return null;
    }

    const expense = state.expenses.find(e => e.id === record.entityId);
    if (!expense) {
      set({ error: '对应的待摊费用不存在' });
      return null;
    }

    // 校验入账日期是否在当前账期内
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();
    const currentPeriod = currentAccountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriod) {
      const voucherPeriod = voucherDate.substring(0, 7);
      const currentPeriodStr = `${currentPeriod.year}-${String(currentPeriod.month).padStart(2, '0')}`;
      if (voucherPeriod !== currentPeriodStr) {
        set({ error: `更正入账日期必须在当前账期（${currentPeriodStr}）内` });
        return null;
      }
    }

    // 校验该记录是否已被更正（已有指向它的红字冲销记录）
    const hasCorrection = state.amortizationRecords.some(
      r => r.entityId === record.entityId && r.entityType === 'prepaid'
        && r.periodAmortization < 0 && r.notes?.includes(record.id)
    );
    if (hasCorrection) {
      set({ error: '该摊销记录已被更正，不可重复更正' });
      return null;
    }

    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetId = currentAccountSet?.id;
      if (!accountSetId) { set({ error: '请先选择账套' }); return null; }

      sqliteService.setAccountSetId(accountSetId);
      const db = await sqliteService.getDatabase();
      if (!db) { set({ error: '数据库未初始化' }); return null; }

      const now = new Date().toISOString();

      // 1. 生成红字凭证号
      const yearMonth = voucherDate.substring(0, 7).replace('-', '');
      const vouchersResult = db.exec(
        'SELECT voucherNo FROM vouchers WHERE accountSetId = ? AND voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1',
        [accountSetId, `记-${yearMonth}-%`]
      );
      let lastSeq = 0;
      if (vouchersResult[0]?.values?.length > 0) {
        const match = (vouchersResult[0].values[0][0] as string).match(/-(\d{3})$/);
        if (match) lastSeq = parseInt(match[1], 10);
      }
      const voucherNo = `记-${yearMonth}-${String(lastSeq + 1).padStart(3, '0')}`;
      const voucherId = generateId();

      // 2. 创建红字凭证（借贷反转，金额为负）
      const expenseCode = expense.expenseSubjectCode || '660205';
      const expenseName = expense.expenseSubjectName || '管理费用-摊销费';
      const prepaidCode = expense.prepaidSubjectCode || '1811';
      const prepaidName = expense.prepaidSubjectName || '待摊费用';
      const amount = record.periodAmortization;

      let stmt = db.prepare(
        `INSERT INTO vouchers (id, voucherNo, date, status, summary, creator, accountSetId, createTime, updateTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([voucherId, voucherNo, voucherDate, 'posted', `更正摊销-红字冲销`, 'system', accountSetId, now, now]);
      stmt.free();

      // 红字分录：贷方费用科目（冲销原借方）
      const entryId1 = generateId();
      stmt = db.prepare(
        `INSERT INTO entries (
          id, voucherId, subjectCode, subjectName, direction, debit, credit,
          summary, customerName, supplierName, auxiliary, recRefNo,
          departmentCode, departmentName, projectCode, projectName,
          currencyCode, exchangeRate, originalAmount, date, accountSetId,
          createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([
        entryId1, voucherId, expenseCode, expenseName, 'credit', 0, amount,
        `更正摊销-红字冲销`, '', '', '{}', '',
        '', '', '', '',
        '', 0, 0, voucherDate, accountSetId, now, now
      ]);
      stmt.free();

      // 红字分录：借方待摊科目（冲销原贷方）
      const entryId2 = generateId();
      stmt = db.prepare(
        `INSERT INTO entries (
          id, voucherId, subjectCode, subjectName, direction, debit, credit,
          summary, customerName, supplierName, auxiliary, recRefNo,
          departmentCode, departmentName, projectCode, projectName,
          currencyCode, exchangeRate, originalAmount, date, accountSetId,
          createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([
        entryId2, voucherId, prepaidCode, prepaidName, 'debit', amount, 0,
        `更正摊销-红字冲销`, '', '', '{}', '',
        '', '', '', '',
        '', 0, 0, voucherDate, accountSetId, now, now
      ]);
      stmt.free();

      // 3. 创建负数摊销记录
      const correctionRecord: AmortizationRecord = {
        id: generateId(),
        entityType: 'prepaid',
        entityId: expense.id,
        entityCode: expense.expenseCode,
        entityName: expense.expenseName,
        period: voucherDate.substring(0, 7),
        amortizationDate: voucherDate,
        periodAmortization: -amount,
        accumulatedAmortization: expense.amortizedAmount - amount,
        remainingAmount: expense.remainingAmount + amount,
        status: 'posted',
        voucherId,
        voucherNo,
        notes: `更正：冲销 ${record.period} 期摊销 ¥${amount.toFixed(2)} [原记录:${record.id}]`,
        accountSetId: expense.accountSetId,
        createTime: now,
        updateTime: now,
      };

      stmt = db.prepare(
        `INSERT INTO amortizationRecords (
          id, entityType, entityId, entityCode, entityName,
          period, amortizationDate, periodAmortization, accumulatedAmortization, remainingAmount,
          unitsThisPeriod, voucherId, voucherNo, status, notes,
          accountSetId, createTime, updateTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        correctionRecord.id, correctionRecord.entityType, correctionRecord.entityId,
        correctionRecord.entityCode, correctionRecord.entityName,
        correctionRecord.period, correctionRecord.amortizationDate,
        correctionRecord.periodAmortization, correctionRecord.accumulatedAmortization,
        correctionRecord.remainingAmount,
        null, correctionRecord.voucherId, correctionRecord.voucherNo,
        correctionRecord.status, correctionRecord.notes,
        correctionRecord.accountSetId, correctionRecord.createTime, correctionRecord.updateTime,
      ]);
      stmt.free();

      // 4. 回退待摊费用累计
      const newAmortized = expense.amortizedAmount - amount;
      const newRemaining = expense.originalAmount - newAmortized;
      const newPeriods = Math.max(0, expense.amortizedPeriods - 1);
      const newStatus = newPeriods <= 0 ? 'not_started' : (newPeriods >= expense.amortizationPeriods ? 'fully_amortized' : 'active');

      stmt = db.prepare(
        `UPDATE prepaidExpenses SET
          amortizedAmount = ?, remainingAmount = ?, amortizedPeriods = ?,
          status = ?, updateTime = ?
        WHERE id = ?`
      );
      stmt.run([newAmortized, newRemaining, newPeriods, newStatus, now, expense.id]);
      stmt.free();

      // 5. 更新本地状态
      set((state) => ({
        amortizationRecords: [...state.amortizationRecords, correctionRecord],
        expenses: state.expenses.map(e =>
          e.id === expense.id ? {
            ...e,
            amortizedAmount: newAmortized,
            remainingAmount: newRemaining,
            amortizedPeriods: newPeriods,
            status: newStatus as AmortizationStatus,
            updateTime: now,
          } : e
        ),
        error: null,
      }));

      return { voucherId, voucherNo };
    } catch (error: unknown) {
      set({ error: getErrorMessage(error) || '更正摊销失败' });
      throw error;
    }
  },
}));
