import type { PayrollBatch, PayrollCalculationConfigRecord, PayrollItem } from '../../payroll';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';
import type { SimpleQueryService } from './dept-project-currency-sqlite-service';

export interface PayrollQueryService extends SimpleQueryService {
  runAsync(sql: string, params?: SqliteBindable[]): Promise<void>;
}

export type ClonePayrollTaxRuleSetFn = (input: unknown) => PayrollCalculationConfigRecord['config']['taxRules'];

// ════════════════════════════════════════════
// Payroll Batches
// ════════════════════════════════════════════

interface PayrollBatchRow {
  id: string;
  accountSetId: string;
  payrollPeriod: string;
  batchName: string;
  status: PayrollBatch['status'];
  sourceFileName: string | null;
  employeeCount: number;
  grossTotal: number;
  employerCostTotal: number;
  taxTotal: number;
  netTotal: number;
  calculationConfigSnapshot: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  accrualVoucherId: string | null;
  accrualVoucherNo: string | null;
}

function mapPayrollBatchRow(row: PayrollBatchRow): PayrollBatch {
  return {
    id: row.id,
    accountSetId: row.accountSetId,
    payrollPeriod: row.payrollPeriod,
    batchName: row.batchName,
    status: row.status,
    sourceFileName: row.sourceFileName || undefined,
    employeeCount: row.employeeCount,
    grossTotal: row.grossTotal,
    employerCostTotal: row.employerCostTotal,
    taxTotal: row.taxTotal,
    netTotal: row.netTotal,
    calculationConfigSnapshot: JSON.parse(row.calculationConfigSnapshot),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    confirmedAt: row.confirmedAt || undefined,
    accrualVoucherId: row.accrualVoucherId || undefined,
    accrualVoucherNo: row.accrualVoucherNo || undefined,
  };
}

export async function listPayrollBatches(
  service: SimpleQueryService,
  accountSetId: string,
  period?: string,
): Promise<PayrollBatch[]> {
  const params = period ? [accountSetId, period] : [accountSetId];
  const sql = period
    ? `SELECT * FROM payroll_batches WHERE accountSetId = ? AND payrollPeriod = ? ORDER BY updatedAt DESC`
    : `SELECT * FROM payroll_batches WHERE accountSetId = ? ORDER BY payrollPeriod DESC, updatedAt DESC`;
  const results = await service.queryAllAsync<PayrollBatchRow>(sql, params);
  return results.map(mapPayrollBatchRow);
}

export async function getPayrollBatchByVoucherId(
  service: SimpleQueryService,
  accountSetId: string,
  voucherId: string,
): Promise<PayrollBatch | null> {
  const row = await service.querySingleAsync<PayrollBatchRow>(
    `SELECT * FROM payroll_batches WHERE accountSetId = ? AND accrualVoucherId = ? LIMIT 1`,
    [accountSetId, voucherId],
  );
  return row ? mapPayrollBatchRow(row) : null;
}

// ════════════════════════════════════════════
// Payroll Items
// ════════════════════════════════════════════

interface PayrollItemRow {
  id: string;
  batchId: string;
  accountSetId: string;
  payrollPeriod: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  inputData: string;
  calculationResult: string;
  validationStatus: string;
  validationMessages: string;
  createdAt: string;
  updatedAt: string;
}

export async function listPayrollItems(
  service: SimpleQueryService,
  accountSetId: string,
  batchId: string,
): Promise<PayrollItem[]> {
  const results = await service.queryAllAsync<PayrollItemRow>(
    `SELECT * FROM payroll_items WHERE accountSetId = ? AND batchId = ? ORDER BY employeeCode`,
    [accountSetId, batchId],
  );
  return results.map(row => ({
    id: row.id,
    batchId: row.batchId,
    accountSetId: row.accountSetId,
    payrollPeriod: row.payrollPeriod,
    employeeCode: row.employeeCode,
    employeeName: row.employeeName,
    departmentName: row.departmentName || undefined,
    inputData: JSON.parse(row.inputData),
    calculationResult: JSON.parse(row.calculationResult),
    validationStatus: row.validationStatus,
    validationMessages: JSON.parse(row.validationMessages),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })) as PayrollItem[];
}

// ════════════════════════════════════════════
// Payroll Calculation Config
// ════════════════════════════════════════════

interface PayrollConfigRow {
  id: string;
  accountSetId: string;
  effectivePeriod: string;
  socialInsuranceConfig: string;
  housingFundConfig: string;
  individualTaxConfig: string;
  policyLabel: string;
  policyEffectiveDate: string;
  createdAt: string;
  updatedAt: string;
}

export async function savePayrollCalculationConfigRecord(input: {
  db: SqliteDatabaseLike;
  record: PayrollCalculationConfigRecord;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const individualTaxConfig = {
    ...input.record.config.individualTax,
    __taxRules: input.record.config.taxRules,
  };
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO payroll_calculation_configs
     (id, accountSetId, effectivePeriod, socialInsuranceConfig, housingFundConfig,
      individualTaxConfig, policyLabel, policyEffectiveDate, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  try {
    stmt.run([
      input.record.id,
      input.accountSetId,
      input.record.effectivePeriod,
      JSON.stringify(input.record.config.socialInsurance),
      JSON.stringify(input.record.config.housingFund),
      JSON.stringify(individualTaxConfig),
      input.record.policyLabel,
      input.record.policyEffectiveDate,
      input.record.createdAt,
      input.record.updatedAt,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function getPayrollCalculationConfigQuery(
  service: SimpleQueryService,
  accountSetId: string,
  period: string,
  cloneTaxRules: ClonePayrollTaxRuleSetFn,
): Promise<PayrollCalculationConfigRecord | null> {
  const row = await service.querySingleAsync<PayrollConfigRow>(
    `SELECT * FROM payroll_calculation_configs
     WHERE accountSetId = ? AND effectivePeriod <= ?
     ORDER BY effectivePeriod DESC LIMIT 1`,
    [accountSetId, period],
  );
  if (!row) return null;
  const parsedIndividualTaxConfig = JSON.parse(row.individualTaxConfig) as Record<string, unknown>;
  const { __taxRules, ...individualTax } = parsedIndividualTaxConfig;
  return {
    id: row.id,
    accountSetId: row.accountSetId,
    effectivePeriod: row.effectivePeriod,
    config: {
      socialInsurance: JSON.parse(row.socialInsuranceConfig),
      housingFund: JSON.parse(row.housingFundConfig),
      individualTax: individualTax as unknown as PayrollCalculationConfigRecord['config']['individualTax'],
      taxRules: cloneTaxRules(__taxRules),
    },
    policyLabel: row.policyLabel,
    policyEffectiveDate: row.policyEffectiveDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ════════════════════════════════════════════
// Payroll Batch Write Operations
// ════════════════════════════════════════════

export async function savePayrollBatchRecord(input: {
  db: SqliteDatabaseLike;
  batch: PayrollBatch;
  items: PayrollItem[];
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO payroll_batches
     (id, accountSetId, payrollPeriod, batchName, status, sourceFileName, employeeCount,
      grossTotal, employerCostTotal, taxTotal, netTotal, calculationConfigSnapshot,
      createdAt, updatedAt, confirmedAt, accrualVoucherId, accrualVoucherNo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  try {
    stmt.run([
      input.batch.id,
      input.accountSetId,
      input.batch.payrollPeriod,
      input.batch.batchName,
      input.batch.status,
      input.batch.sourceFileName || null,
      input.batch.employeeCount,
      input.batch.grossTotal,
      input.batch.employerCostTotal,
      input.batch.taxTotal,
      input.batch.netTotal,
      JSON.stringify(input.batch.calculationConfigSnapshot),
      input.batch.createdAt,
      input.batch.updatedAt,
      input.batch.confirmedAt || null,
      input.batch.accrualVoucherId || null,
      input.batch.accrualVoucherNo || null,
    ]);
  } finally {
    stmt.free();
  }

  const deleteStmt = input.db.prepare(
    `DELETE FROM payroll_items WHERE batchId = ? AND accountSetId = ?`,
  );
  try {
    deleteStmt.run([input.batch.id, input.accountSetId]);
  } finally {
    deleteStmt.free();
  }

  for (const item of input.items) {
    const itemStmt = input.db.prepare(
      `INSERT INTO payroll_items
       (id, batchId, accountSetId, payrollPeriod, employeeCode, employeeName, departmentName,
        inputData, calculationResult, validationStatus, validationMessages, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    try {
      itemStmt.run([
        item.id,
        input.batch.id,
        input.accountSetId,
        input.batch.payrollPeriod,
        item.employeeCode,
        item.employeeName,
        item.departmentName || null,
        JSON.stringify(item.inputData),
        JSON.stringify(item.calculationResult),
        item.validationStatus,
        JSON.stringify(item.validationMessages),
        item.createdAt,
        item.updatedAt,
      ]);
    } finally {
      itemStmt.free();
    }
  }
  await input.persist();
}

export async function updatePayrollBatchStatusRecord(input: {
  db: SqliteDatabaseLike;
  batchId: string;
  status: PayrollBatch['status'];
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const confirmedAt = input.status === 'confirmed' ? new Date().toISOString() : null;
  const stmt = input.db.prepare(
    `UPDATE payroll_batches SET status = ?, confirmedAt = ?, updatedAt = ?
     WHERE id = ? AND accountSetId = ?`,
  );
  try {
    stmt.run([input.status, confirmedAt, new Date().toISOString(), input.batchId, input.accountSetId]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deletePayrollBatchRecord(input: {
  service: PayrollQueryService;
  db: SqliteDatabaseLike;
  batchId: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const batch = await input.service.querySingleAsync<{ status: PayrollBatch['status'] }>(
    `SELECT status FROM payroll_batches WHERE id = ? AND accountSetId = ?`,
    [input.batchId, input.accountSetId],
  );
  if (batch?.status === 'confirmed') {
    throw new Error('已确认工资批次不能删除');
  }
  const deleteItems = input.db.prepare(
    `DELETE FROM payroll_items WHERE batchId = ? AND accountSetId = ?`,
  );
  try {
    deleteItems.run([input.batchId, input.accountSetId]);
  } finally {
    deleteItems.free();
  }
  const deleteBatch = input.db.prepare(
    `DELETE FROM payroll_batches WHERE id = ? AND accountSetId = ? AND status <> 'confirmed'`,
  );
  try {
    deleteBatch.run([input.batchId, input.accountSetId]);
  } finally {
    deleteBatch.free();
  }
  await input.persist();
}

export async function updatePayrollBatchVoucherRecord(input: {
  db: SqliteDatabaseLike;
  batchId: string;
  voucherId: string;
  voucherNo: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const stmt = input.db.prepare(
    `UPDATE payroll_batches
     SET accrualVoucherId = ?, accrualVoucherNo = ?, updatedAt = ?
     WHERE id = ? AND accountSetId = ?`,
  );
  try {
    stmt.run([input.voucherId, input.voucherNo, new Date().toISOString(), input.batchId, input.accountSetId]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function clearPayrollBatchVoucherByVoucherIdRecord(input: {
  service: SimpleQueryService;
  db: SqliteDatabaseLike;
  voucherId: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<boolean> {
  const existing = await input.service.querySingleAsync<{ id: string }>(
    `SELECT id FROM payroll_batches WHERE accountSetId = ? AND accrualVoucherId = ? LIMIT 1`,
    [input.accountSetId, input.voucherId],
  );
  if (!existing) return false;

  const stmt = input.db.prepare(
    `UPDATE payroll_batches
     SET accrualVoucherId = NULL, accrualVoucherNo = NULL, updatedAt = ?
     WHERE accountSetId = ? AND accrualVoucherId = ?`,
  );
  try {
    stmt.run([new Date().toISOString(), input.accountSetId, input.voucherId]);
  } finally {
    stmt.free();
  }
  await input.persist();
  return true;
}
