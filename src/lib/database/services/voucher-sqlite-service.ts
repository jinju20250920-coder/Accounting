import type { Voucher, VoucherEntry } from '../../../types';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';

// ── Row types (what SQLite returns) ──

export interface VoucherRow {
  id: string;
  voucherNo: string;
  date: string;
  status: string;
  summary: string | null;
  creator: string | null;
  reviewer: string | null;
  poster: string | null;
  reverseVoucherId: string | null;
  referenceNumber: string | null;
  attachmentCount: number | null;
  voucherType: string | null;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

export interface VoucherEntryRow {
  id: string;
  voucherId: string;
  subjectCode: string;
  subjectName: string;
  direction: string;
  debit: number;
  credit: number;
  summary: string | null;
  customerName: string | null;
  supplierName: string | null;
  auxiliary: string | null; // JSON string
  recRefNo: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  projectCode: string | null;
  projectName: string | null;
  currencyCode: string | null;
  currencyName: string | null;
  exchangeRate: number | null;
  originalAmount: number | null;
  date: string;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
  sourceEntryId: string | null;
  sourceVoucherDate: string | null;
}

// ── Query service interface ──

export interface VoucherQueryService {
  queryAllAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T[]>;
  querySingleAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T | null>;
}

// ── Mapper: DB row → domain type ──

function text(value: string | null | undefined, fallback = ''): string {
  return value ?? fallback;
}

export function mapVoucherEntryRow(row: VoucherEntryRow): VoucherEntry {
  return {
    id: row.id,
    voucherId: row.voucherId,
    date: row.date,
    summary: text(row.summary),
    subjectCode: text(row.subjectCode),
    subjectName: text(row.subjectName),
    debit: row.debit || 0,
    credit: row.credit || 0,
    deptCode: text(row.departmentCode),
    projectCode: text(row.projectCode),
    customerName: text(row.customerName),
    supplierName: text(row.supplierName),
    currencyCode: text(row.currencyCode),
    currencyName: text(row.currencyName),
    exchangeRate: row.exchangeRate || 0,
    originalAmount: row.originalAmount || 0,
    recRefNo: text(row.recRefNo),
    auxiliary: row.auxiliary ? JSON.parse(row.auxiliary) : {},
    accountSetId: row.accountSetId,
    sourceEntryId: text(row.sourceEntryId) || undefined,
    sourceVoucherDate: text(row.sourceVoucherDate) || undefined,
  };
}

export function mapVoucherRow(row: VoucherRow, entries: VoucherEntryRow[]): Voucher {
  return {
    id: row.id,
    voucherNo: row.voucherNo,
    date: row.date,
    summary: text(row.summary),
    status: (row.status as Voucher['status']) || 'draft',
    voucherType: (row.voucherType as Voucher['voucherType']) || 'general',
    createdBy: text(row.creator),
    createTime: text(row.createTime),
    updateTime: text(row.updateTime),
    accountSetId: row.accountSetId,
    entries: entries.map(mapVoucherEntryRow),
  };
}

// ── SQL constants ──

const VOUCHER_INSERT_SQL = `
  INSERT OR REPLACE INTO vouchers (
    id, voucherNo, date, status, summary, creator, reviewer, poster,
    reverseVoucherId, referenceNumber, attachmentCount, accountSetId,
    createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const ENTRY_INSERT_SQL = `
  INSERT INTO entries (
    id, voucherId, subjectCode, subjectName, direction, debit, credit,
    summary, customerName, supplierName, auxiliary, recRefNo,
    departmentCode, departmentName, projectCode, projectName,
    currencyCode, currencyName, exchangeRate, originalAmount, date, accountSetId,
    createTime, updateTime, sourceEntryId, sourceVoucherDate
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// ── Write operations (use db.prepare directly for transactions) ──

export function buildVoucherInsertParams(voucher: Voucher, accountSetId: string): SqliteBindable[] {
  const now = new Date().toISOString();
  return [
    voucher.id || '',
    voucher.voucherNo || '',
    voucher.date || new Date().toISOString().split('T')[0],
    voucher.status || 'draft',
    voucher.summary || '',
    voucher.createdBy || 'user',
    '', // reviewer
    '', // poster
    '', // reverseVoucherId
    '', // referenceNumber
    0,  // attachmentCount
    accountSetId,
    voucher.createTime || now,
    voucher.updateTime || now,
  ];
}

export function buildEntryInsertParams(entry: VoucherEntry, voucherId: string, accountSetId: string): SqliteBindable[] {
  const now = new Date().toISOString();
  return [
    entry.id,
    voucherId,
    entry.subjectCode || '',
    entry.subjectName || '',
    entry.debit > 0 ? 'debit' : 'credit',
    entry.debit || 0,
    entry.credit || 0,
    entry.summary || '',
    entry.customerName || '',
    entry.supplierName || '',
    JSON.stringify(entry.auxiliary || {}),
    entry.recRefNo || '',
    entry.deptCode || '',
    '', // departmentName — not on VoucherEntry type, stored in auxiliary
    entry.projectCode || '',
    '', // projectName — not on VoucherEntry type, stored in auxiliary
    entry.currencyCode || '',
    entry.currencyName || '',
    entry.exchangeRate || 0,
    entry.originalAmount || 0,
    entry.date || new Date().toISOString().split('T')[0],
    accountSetId,
    now,
    now,
    entry.sourceEntryId || '',
    entry.sourceVoucherDate || '',
  ];
}

export async function saveVoucherRecord(input: {
  db: SqliteDatabaseLike;
  voucher: Voucher;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const { db, voucher, accountSetId, persist } = input;

  // Upsert voucher header
  const voucherStmt = db.prepare(VOUCHER_INSERT_SQL);
  try {
    voucherStmt.run(buildVoucherInsertParams(voucher, accountSetId));
  } finally {
    voucherStmt.free();
  }

  // Delete existing entries
  const deleteStmt = db.prepare(`DELETE FROM entries WHERE voucherId = ? AND accountSetId = ?`);
  try {
    deleteStmt.run([voucher.id, accountSetId]);
  } finally {
    deleteStmt.free();
  }

  // Insert new entries
  for (const entry of voucher.entries) {
    const entryStmt = db.prepare(ENTRY_INSERT_SQL);
    try {
      entryStmt.run(buildEntryInsertParams(entry, voucher.id, accountSetId));
    } finally {
      entryStmt.free();
    }
  }

  await persist();
}

export async function updateVoucherStatusRecord(input: {
  db: SqliteDatabaseLike;
  id: string;
  status: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const stmt = input.db.prepare(`
    UPDATE vouchers SET status = ?, updateTime = ? WHERE id = ? AND accountSetId = ?
  `);
  try {
    stmt.run([input.status, new Date().toISOString(), input.id, input.accountSetId]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteVoucherRecord(input: {
  db: SqliteDatabaseLike;
  id: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  // Delete entries first
  const deleteEntries = input.db.prepare(`DELETE FROM entries WHERE voucherId = ? AND accountSetId = ?`);
  try {
    deleteEntries.run([input.id, input.accountSetId]);
  } finally {
    deleteEntries.free();
  }

  // Delete voucher
  const deleteVoucher = input.db.prepare(`DELETE FROM vouchers WHERE id = ? AND accountSetId = ?`);
  try {
    deleteVoucher.run([input.id, input.accountSetId]);
  } finally {
    deleteVoucher.free();
  }

  await input.persist();
}

// ── Read operations (use query service) ──

async function fetchEntries(
  service: VoucherQueryService,
  accountSetId: string,
  voucherId: string,
): Promise<VoucherEntryRow[]> {
  return service.queryAllAsync<VoucherEntryRow>(
    `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
    [voucherId, accountSetId],
  );
}

async function hydrateVoucher(
  service: VoucherQueryService,
  accountSetId: string,
  row: VoucherRow,
): Promise<Voucher> {
  const entries = await fetchEntries(service, accountSetId, row.id);
  return mapVoucherRow(row, entries);
}

export async function getVoucherById(
  service: VoucherQueryService,
  accountSetId: string,
  id: string,
): Promise<Voucher | undefined> {
  const row = await service.querySingleAsync<VoucherRow>(
    `SELECT * FROM vouchers WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  if (!row) return undefined;
  return hydrateVoucher(service, accountSetId, row);
}

export async function listVouchers(
  service: VoucherQueryService,
  accountSetId: string,
): Promise<Voucher[]> {
  const rows = await service.queryAllAsync<VoucherRow>(
    `SELECT * FROM vouchers WHERE accountSetId = ? ORDER BY date DESC`,
    [accountSetId],
  );
  return Promise.all(rows.map(r => hydrateVoucher(service, accountSetId, r)));
}

export async function listVouchersByDateRange(
  service: VoucherQueryService,
  accountSetId: string,
  startDate: string,
  endDate: string,
): Promise<Voucher[]> {
  const rows = await service.queryAllAsync<VoucherRow>(
    `SELECT * FROM vouchers WHERE accountSetId = ? AND date >= ? AND date <= ? ORDER BY date DESC`,
    [accountSetId, startDate, endDate],
  );
  return Promise.all(rows.map(r => hydrateVoucher(service, accountSetId, r)));
}

export async function listVouchersByStatus(
  service: VoucherQueryService,
  accountSetId: string,
  status: string,
): Promise<Voucher[]> {
  const rows = await service.queryAllAsync<VoucherRow>(
    `SELECT * FROM vouchers WHERE accountSetId = ? AND status = ? ORDER BY date DESC`,
    [accountSetId, status],
  );
  return Promise.all(rows.map(r => hydrateVoucher(service, accountSetId, r)));
}
