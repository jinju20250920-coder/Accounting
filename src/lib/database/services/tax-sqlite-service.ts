import type { TaxItem, TaxFiling, TaxHoliday } from '../../../types';
import type { SqliteDatabaseLike, SqliteBindable } from './fixed-asset-sqlite-service';
import type { SimpleQueryService } from './dept-project-currency-sqlite-service';

// ════════════════════════════════════════════
// Row interfaces
// ════════════════════════════════════════════

export interface TaxItemRow {
  id: string;
  tenantId: string;
  accountSetId: string;
  taxName: string;
  taxType: string;
  deadlineType: string;
  deadlineDays: number;
  graceDays: number;
  applicableTaxpayerType: string;
  isBuiltIn: number;
  isEnabled: number;
  sortOrder: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxFilingRow {
  id: string;
  tenantId: string;
  accountSetId: string;
  taxItemId: string;
  taxName: string;
  taxPeriod: string;
  periodLabel: string;
  deadline: string;
  isFiled: number;
  filedDate: string | null;
  taxableAmount: number | null;
  paidAmount: number | null;
  linkedVoucherId: string | null;
  linkedVoucherNo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxHolidayRow {
  id: string;
  date: string;
  name: string;
  type: string;
  isBuiltIn: number;
}

// ════════════════════════════════════════════
// Mapper functions
// ════════════════════════════════════════════

export function mapTaxItemRow(r: TaxItemRow): TaxItem {
  return {
    id: r.id,
    tenantId: r.tenantId,
    accountSetId: r.accountSetId,
    taxName: r.taxName,
    taxType: r.taxType as TaxItem['taxType'],
    deadlineType: r.deadlineType as TaxItem['deadlineType'],
    deadlineDays: r.deadlineDays,
    graceDays: r.graceDays,
    applicableTaxpayerType: r.applicableTaxpayerType as TaxItem['applicableTaxpayerType'],
    isBuiltIn: !!r.isBuiltIn,
    isEnabled: !!r.isEnabled,
    sortOrder: r.sortOrder,
    description: r.description ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function mapTaxFilingRow(r: TaxFilingRow): TaxFiling {
  return {
    id: r.id,
    tenantId: r.tenantId,
    accountSetId: r.accountSetId,
    taxItemId: r.taxItemId,
    taxName: r.taxName,
    taxPeriod: r.taxPeriod,
    periodLabel: r.periodLabel,
    deadline: r.deadline,
    isFiled: !!r.isFiled,
    filedDate: r.filedDate ?? undefined,
    taxableAmount: r.taxableAmount ?? undefined,
    paidAmount: r.paidAmount ?? undefined,
    linkedVoucherId: r.linkedVoucherId ?? undefined,
    linkedVoucherNo: r.linkedVoucherNo ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function mapTaxHolidayRow(r: TaxHolidayRow): TaxHoliday {
  return {
    id: r.id,
    date: r.date,
    name: r.name,
    type: r.type as TaxHoliday['type'],
    isBuiltIn: !!r.isBuiltIn,
  };
}

// ════════════════════════════════════════════
// tax_items
// ════════════════════════════════════════════

export async function listTaxItems(
  service: SimpleQueryService,
  tenantId: string,
  accountSetId: string
): Promise<TaxItem[]> {
  const rows = await service.queryAllAsync<TaxItemRow>(
    `SELECT * FROM tax_items WHERE tenantId = ? AND accountSetId = ? ORDER BY sortOrder ASC`,
    [tenantId, accountSetId]
  );
  return rows.map(mapTaxItemRow);
}

export async function saveTaxItem(input: {
  db: SqliteDatabaseLike;
  item: TaxItem;
  persist: () => Promise<void>;
}): Promise<void> {
  const i = input.item;
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO tax_items
     (id, tenantId, accountSetId, taxName, taxType, deadlineType, deadlineDays, graceDays,
      applicableTaxpayerType, isBuiltIn, isEnabled, sortOrder, description, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  try {
    stmt.run([
      i.id,
      i.tenantId,
      i.accountSetId,
      i.taxName,
      i.taxType,
      i.deadlineType,
      i.deadlineDays,
      i.graceDays,
      i.applicableTaxpayerType,
      i.isBuiltIn ? 1 : 0,
      i.isEnabled ? 1 : 0,
      i.sortOrder,
      i.description ?? null,
      i.createdAt,
      i.updatedAt,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteTaxItem(input: {
  db: SqliteDatabaseLike;
  tenantId: string;
  accountSetId: string;
  id: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const stmt = input.db.prepare(
    `DELETE FROM tax_items WHERE id = ? AND tenantId = ? AND accountSetId = ?`
  );
  try {
    stmt.run([input.id, input.tenantId, input.accountSetId]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

// ════════════════════════════════════════════
// tax_filings
// ════════════════════════════════════════════

export async function listTaxFilings(
  service: SimpleQueryService,
  tenantId: string,
  accountSetId: string,
  opts?: { taxPeriod?: string }
): Promise<TaxFiling[]> {
  const params: SqliteBindable[] = [tenantId, accountSetId];
  let periodClause = '';
  if (opts?.taxPeriod) {
    periodClause = ' AND taxPeriod = ?';
    params.push(opts.taxPeriod);
  }
  const rows = await service.queryAllAsync<TaxFilingRow>(
    `SELECT * FROM tax_filings WHERE tenantId = ? AND accountSetId = ?${periodClause} ORDER BY deadline DESC`,
    params
  );
  return rows.map(mapTaxFilingRow);
}

export async function getTaxFiling(
  service: SimpleQueryService,
  tenantId: string,
  accountSetId: string,
  taxItemId: string,
  taxPeriod: string
): Promise<TaxFiling | null> {
  const row = await service.querySingleAsync<TaxFilingRow>(
    `SELECT * FROM tax_filings WHERE tenantId = ? AND accountSetId = ? AND taxItemId = ? AND taxPeriod = ?`,
    [tenantId, accountSetId, taxItemId, taxPeriod]
  );
  return row ? mapTaxFilingRow(row) : null;
}

export async function saveTaxFiling(input: {
  db: SqliteDatabaseLike;
  filing: TaxFiling;
  persist: () => Promise<void>;
}): Promise<void> {
  const f = input.filing;
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO tax_filings
     (id, tenantId, accountSetId, taxItemId, taxName, taxPeriod, periodLabel, deadline,
      isFiled, filedDate, taxableAmount, paidAmount, linkedVoucherId, linkedVoucherNo, notes, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  try {
    stmt.run([
      f.id,
      f.tenantId,
      f.accountSetId,
      f.taxItemId,
      f.taxName,
      f.taxPeriod,
      f.periodLabel,
      f.deadline,
      f.isFiled ? 1 : 0,
      f.filedDate ?? null,
      f.taxableAmount ?? null,
      f.paidAmount ?? null,
      f.linkedVoucherId ?? null,
      f.linkedVoucherNo ?? null,
      f.notes ?? null,
      f.createdAt,
      f.updatedAt,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

// ════════════════════════════════════════════
// tax_holidays (global, no tenant columns)
// ════════════════════════════════════════════

export async function listTaxHolidays(service: SimpleQueryService): Promise<TaxHoliday[]> {
  const rows = await service.queryAllAsync<TaxHolidayRow>(
    `SELECT * FROM tax_holidays ORDER BY date ASC`
  );
  return rows.map(mapTaxHolidayRow);
}

export async function saveTaxHoliday(input: {
  db: SqliteDatabaseLike;
  holiday: TaxHoliday;
  persist: () => Promise<void>;
}): Promise<void> {
  const h = input.holiday;
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO tax_holidays (id, date, name, type, isBuiltIn) VALUES (?,?,?,?,?)`
  );
  try {
    stmt.run([h.id, h.date, h.name, h.type, h.isBuiltIn ? 1 : 0]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteTaxHoliday(input: {
  db: SqliteDatabaseLike;
  id: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const stmt = input.db.prepare(`DELETE FROM tax_holidays WHERE id = ?`);
  try {
    stmt.run([input.id]);
  } finally {
    stmt.free();
  }
  await input.persist();
}
