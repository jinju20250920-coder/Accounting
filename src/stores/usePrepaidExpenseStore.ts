'use client';

import { create } from 'zustand';
import { getCurrentManager } from '@/lib/database';
import { useAccountSetStore } from './useAccountSetStore';
import { calculatePeriodAmount } from '@/lib/amortization';
import type {
  PrepaidExpense,
  AmortizationRecord,
  BatchAmortizationResult,
  PrepaidExpenseType,
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

  // 查询
  getActiveExpenses: () => PrepaidExpense[];
  getAmortizationHistory: (expenseId: string) => AmortizationRecord[];
  getExpensesByType: (type: PrepaidExpenseType) => PrepaidExpense[];

  // 导入导出
  importFromExcel: (expenses: Partial<PrepaidExpense>[]) => Promise<{ success: number; errors: string[] }>;
  exportToExcel: () => PrepaidExpense[];

  // 凭证生成
  generateAmortizationVoucher: (recordIds: string[], voucherDate: string) => Promise<{ voucherId: string; voucherNo: string } | null>;

  // 状态管理
  setSelectedExpenseId: (id: string | null) => void;
  clearError: () => void;
  initialize: () => Promise<void>;
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

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

    // 检查编码是否重复
    if (state.expenses.some(e => e.expenseCode === expenseData.expenseCode)) {
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
      id: generateId(),
      periodAmount,
      amortizedAmount: expenseData.amortizedAmount || 0,
      remainingAmount: expenseData.originalAmount - (expenseData.amortizedAmount || 0),
      amortizedPeriods: expenseData.amortizedPeriods || 0,
      status: expenseData.status || 'active',
      accountSetId: currentAccountSet?.id,
      createTime: now,
      updateTime: now,
    };

    try {
      const db = await getCurrentManager().getDatabase();
      const stmt = db.prepare(
        `INSERT INTO prepaidExpenses (
          id, expenseCode, expenseName, expenseType, originalAmount,
          amortizedAmount, remainingAmount, amortizationMethod, amortizationPeriods,
          amortizedPeriods, periodAmount, paymentDate, startDate, endDate,
          lastAmortizationDate, status, prepaidSubjectCode, prepaidSubjectName,
          expenseSubjectCode, expenseSubjectName, supplierName, invoiceNo, contractNo,
          departmentCode, departmentName, notes, accountSetId, createTime, updateTime
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      stmt.run([
        newExpense.id, newExpense.expenseCode, newExpense.expenseName,
        newExpense.expenseType, newExpense.originalAmount,
        newExpense.amortizedAmount, newExpense.remainingAmount,
        newExpense.amortizationMethod, newExpense.amortizationPeriods,
        newExpense.amortizedPeriods, newExpense.periodAmount,
        newExpense.paymentDate, newExpense.startDate, newExpense.endDate,
        newExpense.lastAmortizationDate, newExpense.status,
        newExpense.prepaidSubjectCode, newExpense.prepaidSubjectName,
        newExpense.expenseSubjectCode, newExpense.expenseSubjectName,
        newExpense.supplierName, newExpense.invoiceNo, newExpense.contractNo,
        newExpense.departmentCode, newExpense.departmentName,
        newExpense.notes, newExpense.accountSetId, newExpense.createTime, newExpense.updateTime,
      ]);
      stmt.free();

      set((state) => ({
        expenses: [...state.expenses, newExpense],
        error: null,
      }));

      return newExpense;
    } catch (error: any) {
      set({ error: error.message || '添加待摊费用失败' });
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
        updatedExpense.expenseName, updatedExpense.expenseType, updatedExpense.originalAmount,
        updatedExpense.amortizedAmount, updatedExpense.remainingAmount,
        updatedExpense.amortizationMethod, updatedExpense.amortizationPeriods,
        updatedExpense.amortizedPeriods, updatedExpense.periodAmount,
        updatedExpense.paymentDate, updatedExpense.startDate, updatedExpense.endDate,
        updatedExpense.lastAmortizationDate, updatedExpense.status,
        updatedExpense.prepaidSubjectCode, updatedExpense.prepaidSubjectName,
        updatedExpense.expenseSubjectCode, updatedExpense.expenseSubjectName,
        updatedExpense.supplierName, updatedExpense.invoiceNo, updatedExpense.contractNo,
        updatedExpense.departmentCode, updatedExpense.departmentName,
        updatedExpense.notes, updatedExpense.updateTime, id,
      ]);
      stmt.free();

      set((state) => ({
        expenses: state.expenses.map(e => e.id === id ? updatedExpense : e),
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '更新待摊费用失败' });
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
    } catch (error: any) {
      set({ error: error.message || '删除待摊费用失败' });
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
    if (!expense || expense.status !== 'active') return 0;
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

      if (expense.status !== 'active') {
        errors.push({ entityId: expenseId, entityName: expense.expenseName, error: '待摊费用状态不是在用' });
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
          record.unitsThisPeriod, record.voucherId, record.voucherNo,
          record.status, record.notes,
          record.accountSetId, record.createTime, record.updateTime,
        ]);
        stmt.free();
      }

      set((state) => ({
        amortizationRecords: [...state.amortizationRecords, ...records],
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '保存摊销记录失败' });
      throw error;
    }
  },

  // 记账摊销记录
  postAmortizationRecords: async (recordIds) => {
    const state = get();
    const records = state.amortizationRecords.filter(r => recordIds.includes(r.id));

    try {
      const db = await getCurrentManager().getDatabase();

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
              status: newPeriods >= e.amortizationPeriods ? 'fully_amortized' as const : 'active' as const,
              updateTime: new Date().toISOString(),
            };
          }
          return e;
        }),
        error: null,
      }));
    } catch (error: any) {
      set({ error: error.message || '记账失败' });
      throw error;
    }
  },

  // 获取在用待摊费用
  getActiveExpenses: () => {
    return get().expenses.filter(e => e.status === 'active');
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
          status: 'active',
          prepaidSubjectCode: item.prepaidSubjectCode || '1811',
          expenseSubjectCode: item.expenseSubjectCode || '660205',
          supplierName: item.supplierName,
          invoiceNo: item.invoiceNo,
          departmentCode: item.departmentCode,
          notes: item.notes,
        });

        success++;
      } catch (error: any) {
        errors.push(`行 ${importedExpenses.indexOf(item) + 1}: ${error.message}`);
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
      const expenses: PrepaidExpense[] = expensesResult[0]?.values?.map((row: any[]) => ({
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
      const amortizationRecords: AmortizationRecord[] = recordsResult[0]?.values?.map((row: any[]) => ({
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
    } catch (error: any) {
      console.error('初始化待摊费用Store失败:', error);
      set({ loading: false, error: error.message || '初始化失败' });
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
      const db = await getCurrentManager().getDatabase();
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
          `INSERT INTO voucherEntries (id, voucherId, date, summary, subjectCode, subjectName, debit, credit, accountSetId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([entryId, voucherId, voucherDate, '待摊费用摊销', expense.code, expense.name, expense.amount, 0, accountSetId]);
        stmt.free();
      }

      // 创建分录 - 贷方：待摊科目（按科目分组）
      for (const [, prepaid] of prepaidMap) {
        const entryId = generateId();
        stmt = db.prepare(
          `INSERT INTO voucherEntries (id, voucherId, date, summary, subjectCode, subjectName, debit, credit, accountSetId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([entryId, voucherId, voucherDate, '待摊费用摊销', prepaid.code, prepaid.name, 0, prepaid.amount, accountSetId]);
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
    } catch (error: any) {
      set({ error: error.message || '生成摊销凭证失败' });
      throw error;
    }
  },
}));
