'use client';

import { create } from 'zustand';
import { getCurrentService } from '@/lib/database';
import { sqliteService } from '@/lib/database/sqlite-service';
import {
  calculatePayrollItem,
  summarizePayrollResults,
  validatePayrollInput,
  type PayrollBatch,
  type PayrollCalculationConfig,
  type PayrollCalculationConfigRecord,
  type PayrollInput,
  type PayrollItem,
} from '@/lib/payroll';
import {
  buildPayrollAccrualVoucherPreview,
  previewToVoucherEntries,
  type PayrollVoucherEntryPreview,
} from '@/lib/payroll-voucher';
import type { Voucher } from '@/types';
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
  addManualItems: (period: string, inputs: PayrollInput[]) => Promise<void>;
  addManualItem: (period: string, input: PayrollInput) => Promise<void>;
  updateItem: (itemId: string, input: PayrollInput) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  copyPreviousPeriod: (period: string, mode: 'replace' | 'append') => Promise<void>;
  createAccrualVoucher: (batchId: string, entries: PayrollVoucherEntryPreview[]) => Promise<Voucher>;
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

function previousPeriod(period: string): string {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return period;
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function payrollVoucherDate(period: string): string {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return new Date().toISOString().slice(0, 10);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearText}-${monthText}-${String(lastDay).padStart(2, '0')}`;
}

async function generatePayrollVoucherNo(date: string): Promise<string> {
  const yearMonth = date.substring(0, 7).replace('-', '');
  const vouchers = await getCurrentService().getAllVouchers();
  const maxSeq = vouchers
    .filter((voucher) => voucher.voucherNo.startsWith(`记-${yearMonth}-`))
    .map((voucher) => Number(voucher.voucherNo.match(/-(\d{3})$/)?.[1] || 0))
    .reduce((max, seq) => Math.max(max, seq), 0);
  return `记-${yearMonth}-${String(maxSeq + 1).padStart(3, '0')}`;
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

function assertEditableBatch(batch: PayrollBatch | null): asserts batch is PayrollBatch {
  if (!batch) throw new Error('未找到工资批次');
  if (batch.status === 'confirmed') throw new Error('已确认批次，请先退回草稿后修改');
}

function buildCalculatedBatch(
  batch: PayrollBatch,
  items: PayrollItem[],
  config: PayrollCalculationConfig,
): PayrollBatch {
  const summary = summarizePayrollResults(items.map((item) => item.calculationResult));
  return {
    ...batch,
    status: 'calculated',
    employeeCount: summary.employeeCount,
    grossTotal: summary.grossTotal,
    employerCostTotal: summary.employerCostTotal,
    taxTotal: summary.taxTotal,
    netTotal: summary.netTotal,
    calculationConfigSnapshot: config,
    updatedAt: new Date().toISOString(),
    confirmedAt: undefined,
  };
}

type EditablePayrollRow = { input: PayrollInput; id?: string; createdAt?: string };

async function persistCalculatedItems(
  batch: PayrollBatch,
  rows: EditablePayrollRow[],
  config: PayrollCalculationConfig,
): Promise<{ batch: PayrollBatch; items: PayrollItem[] }> {
  const accountSetId = requireAccountSetId();
  const now = new Date().toISOString();
  const items = rows.map<PayrollItem>((row) => ({
    id: row.id || generateId('payitem'),
    batchId: batch.id,
    accountSetId,
    payrollPeriod: batch.payrollPeriod,
    employeeCode: row.input.employeeCode,
    employeeName: row.input.employeeName,
    departmentName: row.input.departmentName,
    inputData: row.input,
    calculationResult: calculatePayrollItem(row.input, config, monthFromPeriod(batch.payrollPeriod)),
    validationStatus: 'valid',
    validationMessages: [],
    createdAt: row.createdAt || now,
    updatedAt: now,
  }));
  const updated = buildCalculatedBatch(batch, items, config);
  await sqliteService.savePayrollBatch(updated, items);
  return { batch: updated, items };
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

  addManualItems: async (period, inputs) => {
    const accountSetId = requireAccountSetId();
    const configRecord = get().config || await sqliteService.getPayrollCalculationConfig(period);
    if (!configRecord) throw new Error('请先保存社保、公积金及个税计算设置');
    if (inputs.length === 0) throw new Error('请至少填写一行工资明细');

    const currentBatch = get().selectedBatch;
    if (currentBatch) assertEditableBatch(currentBatch);
    const employeeCodes = get().items.map((item) => item.employeeCode);
    inputs.forEach((input, index) => {
      const validationErrors = validatePayrollInput(input, employeeCodes);
      if (validationErrors.length) throw new Error(`第 ${index + 1} 行：${validationErrors.join('；')}`);
      employeeCodes.push(input.employeeCode);
    });

    const now = new Date().toISOString();
    const batch: PayrollBatch = currentBatch || {
      id: generateId('paybatch'),
      accountSetId,
      payrollPeriod: period,
      batchName: `${period} 手工维护批次`,
      status: 'draft',
      employeeCount: 0,
      grossTotal: 0,
      employerCostTotal: 0,
      taxTotal: 0,
      netTotal: 0,
      calculationConfigSnapshot: configRecord.config,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await persistCalculatedItems(
      batch,
      [
        ...get().items.map((item) => ({ id: item.id, createdAt: item.createdAt, input: item.inputData })),
        ...inputs.map((input) => ({ input })),
      ],
      configRecord.config,
    );
    set((state) => ({
      batches: [saved.batch, ...state.batches.filter((item) => item.id !== saved.batch.id)],
      selectedBatch: saved.batch,
      items: saved.items,
      error: null,
    }));
  },

  addManualItem: async (period, input) => {
    await get().addManualItems(period, [input]);
  },

  updateItem: async (itemId, input) => {
    const batch = get().selectedBatch;
    assertEditableBatch(batch);
    const configRecord = get().config;
    if (!configRecord) throw new Error('请先保存社保、公积金及个税计算设置');
    if (!get().items.some((item) => item.id === itemId)) throw new Error('未找到工资明细');

    const validationErrors = validatePayrollInput(
      input,
      get().items.filter((item) => item.id !== itemId).map((item) => item.employeeCode),
    );
    if (validationErrors.length) throw new Error(validationErrors.join('；'));

    const rows = get().items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      input: item.id === itemId ? input : item.inputData,
    }));
    const saved = await persistCalculatedItems(batch, rows, configRecord.config);
    set((state) => ({
      batches: state.batches.map((item) => item.id === saved.batch.id ? saved.batch : item),
      selectedBatch: saved.batch,
      items: saved.items,
      error: null,
    }));
  },

  deleteItem: async (itemId) => {
    const batch = get().selectedBatch;
    assertEditableBatch(batch);
    const configRecord = get().config;
    if (!configRecord) throw new Error('请先保存社保、公积金及个税计算设置');
    if (!get().items.some((item) => item.id === itemId)) throw new Error('未找到工资明细');

    const rows = get().items
      .filter((item) => item.id !== itemId)
      .map((item) => ({ id: item.id, createdAt: item.createdAt, input: item.inputData }));
    const saved = await persistCalculatedItems(batch, rows, configRecord.config);
    set((state) => ({
      batches: state.batches.map((item) => item.id === saved.batch.id ? saved.batch : item),
      selectedBatch: saved.batch,
      items: saved.items,
      error: null,
    }));
  },

  copyPreviousPeriod: async (period, mode) => {
    const accountSetId = requireAccountSetId();
    const sourcePeriod = previousPeriod(period);
    const previousBatches = await sqliteService.getPayrollBatches(sourcePeriod);
    const sourceBatch = previousBatches[0];
    if (!sourceBatch) throw new Error(`未找到 ${sourcePeriod} 的工资批次`);

    const sourceItems = await sqliteService.getPayrollItems(sourceBatch.id);
    if (sourceItems.length === 0) throw new Error(`${sourcePeriod} 工资批次没有可复制的明细`);

    const configRecord = get().config || await sqliteService.getPayrollCalculationConfig(period);
    const config = configRecord?.config || sourceBatch.calculationConfigSnapshot;
    const currentBatch = get().selectedBatch;
    if (currentBatch) assertEditableBatch(currentBatch);

    const copiedInputs = sourceItems.map((item) => ({ ...item.inputData }));
    const existingRows = mode === 'append' ? get().items.map((item) => item.inputData) : [];
    const existingCodes = new Set(existingRows.map((row) => row.employeeCode.trim()).filter(Boolean));
    const rowsToCopy = mode === 'append'
      ? copiedInputs.filter((row) => !existingCodes.has(row.employeeCode.trim()))
      : copiedInputs;
    if (rowsToCopy.length === 0) throw new Error('本月已有相同工号的工资明细，没有可追加的上月数据');

    const now = new Date().toISOString();
    const batch: PayrollBatch = currentBatch || {
      id: generateId('paybatch'),
      accountSetId,
      payrollPeriod: period,
      batchName: `${period} 复制上月工资`,
      status: 'draft',
      employeeCount: 0,
      grossTotal: 0,
      employerCostTotal: 0,
      taxTotal: 0,
      netTotal: 0,
      calculationConfigSnapshot: config,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await persistCalculatedItems(
      batch,
      [...existingRows, ...rowsToCopy].map((input) => ({ input })),
      config,
    );
    set((state) => ({
      batches: [saved.batch, ...state.batches.filter((item) => item.id !== saved.batch.id)],
      selectedBatch: saved.batch,
      items: saved.items,
      error: null,
    }));
  },

  createAccrualVoucher: async (batchId, entries) => {
    const accountSetId = requireAccountSetId();
    const batch = get().batches.find((item) => item.id === batchId);
    if (!batch) throw new Error('未找到工资批次');
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const previewEntries = entries.length > 0
      ? entries
      : buildPayrollAccrualVoucherPreview(get().items, batch.payrollPeriod, [], currentAccountSet || undefined);
    if (previewEntries.length === 0) throw new Error('没有可生成凭证的工资分录');

    const totalDebit = previewEntries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = previewEntries.reduce((sum, entry) => sum + entry.credit, 0);
    if (Math.abs(totalDebit - totalCredit) >= 0.01) throw new Error('工资计提凭证借贷不平衡');

    const now = new Date().toISOString();
    const date = payrollVoucherDate(batch.payrollPeriod);
    const voucherId = generateId('payvoucher');
    const voucherNo = await generatePayrollVoucherNo(date);
    const voucher: Voucher = {
      id: voucherId,
      voucherNo,
      date,
      summary: `${batch.payrollPeriod} 工资计提`,
      entries: previewToVoucherEntries(previewEntries, voucherId, date),
      status: 'draft',
      voucherType: 'general',
      createdBy: 'system',
      createTime: now,
      updateTime: now,
      accountSetId,
    };
    await getCurrentService().saveVoucher(voucher);
    return voucher;
  },

  clearError: () => set({ error: null }),
}));
