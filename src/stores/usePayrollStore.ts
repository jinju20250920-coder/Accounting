'use client';

import { create } from 'zustand';
import { sqliteService } from '@/lib/database/sqlite-service';
import {
  calculatePayrollItem,
  summarizePayrollResults,
  type PayrollBatch,
  type PayrollCalculationConfig,
  type PayrollCalculationConfigRecord,
  type PayrollInput,
  type PayrollItem,
} from '@/lib/payroll';
import { useAccountSetStore } from './useAccountSetStore';

interface PayrollStore {
  batches: PayrollBatch[];
  selectedBatch: PayrollBatch | null;
  items: PayrollItem[];
  config: PayrollCalculationConfigRecord | null;
  loading: boolean;
  error: string | null;
  loadPeriod: (period: string) => Promise<void>;
  loadBatch: (batchId: string) => Promise<void>;
  saveConfig: (period: string, config: PayrollCalculationConfig) => Promise<void>;
  importDraft: (period: string, fileName: string, rows: PayrollInput[]) => Promise<PayrollBatch>;
  recalculateBatch: (batchId: string) => Promise<void>;
  confirmBatch: (batchId: string) => Promise<void>;
  revertBatchToDraft: (batchId: string) => Promise<void>;
  deleteDraftBatch: (batchId: string) => Promise<void>;
  clearError: () => void;
}

const generateId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

function requireAccountSetId(): string {
  const accountSetId = useAccountSetStore.getState().currentAccountSetId;
  if (!accountSetId) throw new Error('请先选择账套');
  sqliteService.setAccountSetId(accountSetId);
  return accountSetId;
}

function monthFromPeriod(period: string): number {
  const month = Number(period.split('-')[1]);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
}

function createItems(
  accountSetId: string,
  batchId: string,
  period: string,
  inputs: PayrollInput[],
  config: PayrollCalculationConfig,
): PayrollItem[] {
  const now = new Date().toISOString();
  return inputs.map((input) => ({
    id: generateId('payitem'),
    batchId,
    accountSetId,
    payrollPeriod: period,
    employeeCode: input.employeeCode,
    employeeName: input.employeeName,
    departmentName: input.departmentName,
    inputData: input,
    calculationResult: calculatePayrollItem(input, config, monthFromPeriod(period)),
    validationStatus: 'valid',
    validationMessages: [],
    createdAt: now,
    updatedAt: now,
  }));
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  batches: [],
  selectedBatch: null,
  items: [],
  config: null,
  loading: false,
  error: null,

  loadPeriod: async (period) => {
    try {
      set({ loading: true, error: null });
      requireAccountSetId();
      const [batches, config] = await Promise.all([
        sqliteService.getPayrollBatches(period),
        sqliteService.getPayrollCalculationConfig(period),
      ]);
      const selectedBatch = batches[0] || null;
      const items = selectedBatch ? await sqliteService.getPayrollItems(selectedBatch.id) : [];
      set({ batches, config, selectedBatch, items, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '加载工资数据失败' });
    }
  },

  loadBatch: async (batchId) => {
    try {
      const batch = get().batches.find((item) => item.id === batchId) || null;
      const items = await sqliteService.getPayrollItems(batchId);
      set({ selectedBatch: batch, items, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载工资明细失败' });
    }
  },

  saveConfig: async (period, config) => {
    const accountSetId = requireAccountSetId();
    const now = new Date().toISOString();
    const existing = get().config;
    const record: PayrollCalculationConfigRecord = {
      id: existing?.id || generateId('payconfig'),
      accountSetId,
      effectivePeriod: period,
      config,
      policyLabel: config.individualTax.policyLabel,
      policyEffectiveDate: config.individualTax.policyEffectiveDate,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await sqliteService.savePayrollCalculationConfig(record);
    set({ config: record, error: null });
  },

  importDraft: async (period, fileName, rows) => {
    const accountSetId = requireAccountSetId();
    const configRecord = get().config || await sqliteService.getPayrollCalculationConfig(period);
    if (!configRecord) throw new Error('请先保存社保、公积金及个税计算设置');
    if (rows.length === 0) throw new Error('没有可导入的工资明细');

    const now = new Date().toISOString();
    const batchId = generateId('paybatch');
    const items = createItems(accountSetId, batchId, period, rows, configRecord.config);
    const summary = summarizePayrollResults(items.map((item) => item.calculationResult));
    const batch: PayrollBatch = {
      id: batchId,
      accountSetId,
      payrollPeriod: period,
      batchName: `${period} 工资批次`,
      status: 'calculated',
      sourceFileName: fileName,
      employeeCount: summary.employeeCount,
      grossTotal: summary.grossTotal,
      employerCostTotal: summary.employerCostTotal,
      taxTotal: summary.taxTotal,
      netTotal: summary.netTotal,
      calculationConfigSnapshot: configRecord.config,
      createdAt: now,
      updatedAt: now,
    };
    await sqliteService.savePayrollBatch(batch, items);
    set((state) => ({
      batches: [batch, ...state.batches.filter((item) => item.id !== batch.id)],
      selectedBatch: batch,
      items,
      error: null,
    }));
    return batch;
  },

  recalculateBatch: async (batchId) => {
    const accountSetId = requireAccountSetId();
    const batch = get().batches.find((item) => item.id === batchId);
    const configRecord = get().config;
    if (!batch || !configRecord) throw new Error('请先选择工资批次并保存计算设置');
    const existingItems = await sqliteService.getPayrollItems(batchId);
    const items = createItems(accountSetId, batchId, batch.payrollPeriod, existingItems.map((item) => item.inputData), configRecord.config);
    const summary = summarizePayrollResults(items.map((item) => item.calculationResult));
    const updated: PayrollBatch = {
      ...batch,
      status: 'calculated',
      employeeCount: summary.employeeCount,
      grossTotal: summary.grossTotal,
      employerCostTotal: summary.employerCostTotal,
      taxTotal: summary.taxTotal,
      netTotal: summary.netTotal,
      calculationConfigSnapshot: configRecord.config,
      updatedAt: new Date().toISOString(),
      confirmedAt: undefined,
    };
    await sqliteService.savePayrollBatch(updated, items);
    set((state) => ({
      batches: state.batches.map((item) => item.id === batchId ? updated : item),
      selectedBatch: updated,
      items,
      error: null,
    }));
  },

  confirmBatch: async (batchId) => {
    const batch = get().batches.find((item) => item.id === batchId);
    if (!batch) throw new Error('未找到工资批次');
    if (get().items.some((item) => item.validationStatus !== 'valid')) {
      throw new Error('工资明细仍有校验错误，不能确认');
    }
    await sqliteService.updatePayrollBatchStatus(batchId, 'confirmed');
    const confirmed = { ...batch, status: 'confirmed' as const, confirmedAt: new Date().toISOString() };
    set((state) => ({
      batches: state.batches.map((item) => item.id === batchId ? confirmed : item),
      selectedBatch: confirmed,
      error: null,
    }));
  },

  revertBatchToDraft: async (batchId) => {
    await sqliteService.updatePayrollBatchStatus(batchId, 'draft');
    set((state) => {
      const draft = state.batches.find((item) => item.id === batchId);
      const updated = draft ? { ...draft, status: 'draft' as const, confirmedAt: undefined } : null;
      return {
        batches: state.batches.map((item) => item.id === batchId && updated ? updated : item),
        selectedBatch: state.selectedBatch?.id === batchId ? updated : state.selectedBatch,
        error: null,
      };
    });
  },

  deleteDraftBatch: async (batchId) => {
    const batch = get().batches.find((item) => item.id === batchId);
    if (batch?.status === 'confirmed') throw new Error('已确认工资批次不能删除');
    await sqliteService.deletePayrollBatch(batchId);
    const batches = get().batches.filter((item) => item.id !== batchId);
    const selectedBatch = batches[0] || null;
    const items = selectedBatch ? await sqliteService.getPayrollItems(selectedBatch.id) : [];
    set({ batches, selectedBatch, items, error: null });
  },

  clearError: () => set({ error: null }),
}));
