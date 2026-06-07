import type { BankTransaction } from '../../../types';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';

export interface BankTransactionRow {
  id: string;
  date: string;
  transactionTime: string | null;
  voucherType: string | null;
  voucherNo: string | null;
  debit: number | string | null;
  credit: number | string | null;
  balance: number | string | null;
  cashRemitFlag: string | null;
  counterpartyName: string | null;
  counterpartyAccount: string | null;
  summary: string;
  notes: string | null;
  transactionSerialNo: string | null;
  enterpriseSerialNo: string | null;
  ourAccount: string | null;
  ourAccountName: string | null;
  ourBranch: string | null;
  rowNumber: number | string | null;
  status: 'pending' | 'matched' | 'unmatched' | 'error' | 'voucher_generated' | string | null;
  matchedSubject: string | null;
  matchedSubjectName: string | null;
  confidence: number | string | null;
  bankAccountId: string | null;
  importBatchId: string | null;
  voucherId: string | null;
  generatedVoucherNo: string | null;
  exchangeRate: number | string | null;
  originalAmount: number | string | null;
  source: string | null;
  accountSetId: string;
  createTime: string;
  updateTime: string;
}

export interface BankTransactionRecord extends BankTransaction {
  accountSetId: string;
  createTime: string;
  updateTime: string;
  bankAccountId?: string;
  exchangeRate?: number | null;
  originalAmount?: number | null;
  source?: string;
}

export interface BankTransactionSaveInput {
  id: string;
  date: string;
  summary: string;
  rowNumber: number;
  transactionTime?: string;
  voucherType?: string;
  voucherNo?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  cashRemitFlag?: string;
  counterpartyName?: string;
  counterpartyAccount?: string;
  notes?: string;
  transactionSerialNo?: string;
  enterpriseSerialNo?: string;
  ourAccount?: string;
  ourAccountName?: string;
  ourBranch?: string;
  status?: BankTransaction['status'];
  matchedSubject?: string;
  matchedSubjectName?: string;
  confidence?: number;
  bankAccountId?: string;
  importBatchId?: string;
  voucherId?: string;
  generatedVoucherNo?: string;
  amount?: number;
  type?: BankTransaction['type'];
  description?: string;
  exchangeRate?: number | null;
  originalAmount?: number | null;
  source?: string;
  accountSetId?: string;
  createTime?: string;
  updateTime?: string;
}

export type BankTransactionUpdateInput = Partial<BankTransactionSaveInput>;

export interface BankTransactionInsert {
  sql: string;
  params: SqliteBindable[];
}

export interface BankTransactionQueryService {
  queryAllAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T[]>;
  querySingleAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T | null>;
  runAsync(sql: string, params?: SqliteBindable[]): Promise<void>;
}

const BANK_TRANSACTION_INSERT_SQL = `
  INSERT OR REPLACE INTO bankTransactions (
    id, date, transactionTime, voucherType, voucherNo, debit, credit, balance,
    cashRemitFlag, counterpartyName, counterpartyAccount, summary, notes,
    transactionSerialNo, enterpriseSerialNo, ourAccount, ourAccountName, ourBranch,
    rowNumber, status, matchedSubject, matchedSubjectName, confidence,
    bankAccountId, importBatchId, voucherId, generatedVoucherNo,
    exchangeRate, originalAmount,
    source,
    accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function text(value: string | undefined | null, fallback = ''): string {
  return value ?? fallback;
}

function optionalText(value: string | undefined | null): string | undefined {
  return value == null || value === '' ? undefined : value;
}

function numberValue(value: number | string | undefined | null, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  return typeof value === 'number' ? value : Number(value);
}

function nullableNumber(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'number' ? value : Number(value);
}

function normalizeStatus(
  value: BankTransactionSaveInput['status'] | undefined | null,
): BankTransactionRecord['status'] {
  return value ?? 'pending';
}

function normalizeSource(value: string | undefined | null): string {
  return value && value.trim() ? value : 'import';
}

export function buildBankTransactionInsert(
  transaction: BankTransactionSaveInput,
  accountSetId: string,
  now = new Date().toISOString(),
): BankTransactionInsert {
  const resolvedAccountSetId = transaction.accountSetId || accountSetId;
  return {
    sql: BANK_TRANSACTION_INSERT_SQL,
    params: [
      transaction.id,
      text(transaction.date),
      text(transaction.transactionTime),
      text(transaction.voucherType),
      text(transaction.voucherNo),
      numberValue(transaction.debit),
      numberValue(transaction.credit),
      numberValue(transaction.balance),
      text(transaction.cashRemitFlag),
      text(transaction.counterpartyName),
      text(transaction.counterpartyAccount),
      text(transaction.summary),
      text(transaction.notes),
      text(transaction.transactionSerialNo),
      text(transaction.enterpriseSerialNo),
      text(transaction.ourAccount),
      text(transaction.ourAccountName),
      text(transaction.ourBranch),
      numberValue(transaction.rowNumber),
      normalizeStatus(transaction.status),
      text(transaction.matchedSubject),
      text(transaction.matchedSubjectName),
      numberValue(transaction.confidence),
      text(transaction.bankAccountId),
      text(transaction.importBatchId),
      text(transaction.voucherId),
      text(transaction.generatedVoucherNo),
      nullableNumber(transaction.exchangeRate),
      nullableNumber(transaction.originalAmount),
      normalizeSource(transaction.source),
      resolvedAccountSetId,
      transaction.createTime || now,
      transaction.updateTime || now,
    ],
  };
}

export function mapBankTransactionRow(row: BankTransactionRow): BankTransactionRecord {
  return {
    id: row.id,
    date: row.date,
    transactionTime: optionalText(row.transactionTime),
    voucherType: optionalText(row.voucherType),
    voucherNo: optionalText(row.voucherNo),
    debit: numberValue(row.debit),
    credit: numberValue(row.credit),
    balance: numberValue(row.balance),
    cashRemitFlag: optionalText(row.cashRemitFlag),
    counterpartyName: optionalText(row.counterpartyName),
    counterpartyAccount: optionalText(row.counterpartyAccount),
    summary: row.summary,
    notes: optionalText(row.notes),
    transactionSerialNo: optionalText(row.transactionSerialNo),
    enterpriseSerialNo: optionalText(row.enterpriseSerialNo),
    ourAccount: optionalText(row.ourAccount),
    ourAccountName: optionalText(row.ourAccountName),
    ourBranch: optionalText(row.ourBranch),
    rowNumber: numberValue(row.rowNumber),
    status: row.status ? (row.status as BankTransactionRecord['status']) : undefined,
    matchedSubject: optionalText(row.matchedSubject),
    matchedSubjectName: optionalText(row.matchedSubjectName),
    confidence: row.confidence === null || row.confidence === undefined || row.confidence === '' ? undefined : numberValue(row.confidence),
    description: undefined,
    amount: undefined,
    type: undefined,
    generatedVoucherNo: optionalText(row.generatedVoucherNo),
    voucherId: optionalText(row.voucherId),
    importBatchId: optionalText(row.importBatchId),
    bankAccountId: optionalText(row.bankAccountId),
    exchangeRate: nullableNumber(row.exchangeRate),
    originalAmount: nullableNumber(row.originalAmount),
    source: optionalText(row.source),
    accountSetId: row.accountSetId,
    createTime: row.createTime,
    updateTime: row.updateTime,
  };
}

export async function saveBankTransactionRecord(input: {
  db: SqliteDatabaseLike;
  accountSetId: string;
  transaction: BankTransactionSaveInput;
  persist: () => Promise<void>;
}): Promise<void> {
  const insert = buildBankTransactionInsert(input.transaction, input.accountSetId);
  const stmt = input.db.prepare(insert.sql);
  try {
    stmt.run(insert.params);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function saveBankTransactionsRecord(input: {
  db: SqliteDatabaseLike;
  accountSetId: string;
  transactions: BankTransactionSaveInput[];
  persist: () => Promise<void>;
}): Promise<void> {
  for (const transaction of input.transactions) {
    await saveBankTransactionRecord({
      db: input.db,
      accountSetId: input.accountSetId,
      transaction,
      persist: async () => {},
    });
  }
  await input.persist();
}

export async function getBankTransactionRecord(
  service: Pick<BankTransactionQueryService, 'querySingleAsync'>,
  accountSetId: string,
  id: string,
): Promise<BankTransactionRecord | undefined> {
  const row = await service.querySingleAsync<BankTransactionRow>(
    `SELECT * FROM bankTransactions WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  return row ? mapBankTransactionRow(row) : undefined;
}

export async function listBankTransactionsRecord(
  service: Pick<BankTransactionQueryService, 'queryAllAsync'>,
  accountSetId: string,
): Promise<BankTransactionRecord[]> {
  const rows = await service.queryAllAsync<BankTransactionRow>(
    `SELECT * FROM bankTransactions WHERE accountSetId = ? ORDER BY date DESC, rowNumber ASC`,
    [accountSetId],
  );
  return rows.map(mapBankTransactionRow);
}

export async function listBankTransactionsByStatusRecord(
  service: Pick<BankTransactionQueryService, 'queryAllAsync'>,
  accountSetId: string,
  status: 'pending' | 'matched' | 'voucher_generated',
): Promise<BankTransactionRecord[]> {
  const rows = await service.queryAllAsync<BankTransactionRow>(
    `SELECT * FROM bankTransactions WHERE accountSetId = ? AND status = ? ORDER BY date DESC`,
    [accountSetId, status],
  );
  return rows.map(mapBankTransactionRow);
}

export async function listBankTransactionsByDateRangeRecord(
  service: Pick<BankTransactionQueryService, 'queryAllAsync'>,
  accountSetId: string,
  startDate: string,
  endDate: string,
): Promise<BankTransactionRecord[]> {
  const rows = await service.queryAllAsync<BankTransactionRow>(
    `SELECT * FROM bankTransactions WHERE accountSetId = ? AND date >= ? AND date <= ? ORDER BY date DESC`,
    [accountSetId, startDate, endDate],
  );
  return rows.map(mapBankTransactionRow);
}

export async function listBankTransactionsByBatchRecord(
  service: Pick<BankTransactionQueryService, 'queryAllAsync'>,
  accountSetId: string,
  batchId: string,
): Promise<BankTransactionRecord[]> {
  const rows = await service.queryAllAsync<BankTransactionRow>(
    `SELECT * FROM bankTransactions WHERE accountSetId = ? AND importBatchId = ? ORDER BY rowNumber ASC`,
    [accountSetId, batchId],
  );
  return rows.map(mapBankTransactionRow);
}

export async function findPostedBankTransactionRecord(
  service: Pick<BankTransactionQueryService, 'queryAllAsync'>,
  accountSetId: string,
  date: string,
  voucherNo: string,
  transactionSerialNo: string,
): Promise<BankTransactionRecord | null> {
  const rows = await service.queryAllAsync<BankTransactionRow>(
    `SELECT * FROM bankTransactions WHERE accountSetId = ? AND date = ? AND voucherNo = ? AND transactionSerialNo = ? AND status = 'voucher_generated' LIMIT 1`,
    [accountSetId, date, voucherNo, transactionSerialNo],
  );
  return rows.length > 0 ? mapBankTransactionRow(rows[0]) : null;
}

export async function existsBankTransactionRecord(
  service: Pick<BankTransactionQueryService, 'queryAllAsync'>,
  accountSetId: string,
  date: string,
  voucherNo: string,
  transactionSerialNo: string,
): Promise<boolean> {
  const rows = await service.queryAllAsync<Pick<BankTransactionRow, 'id'>>(
    `SELECT id FROM bankTransactions WHERE accountSetId = ? AND date = ? AND voucherNo = ? AND transactionSerialNo = ? LIMIT 1`,
    [accountSetId, date, voucherNo, transactionSerialNo],
  );
  return rows.length > 0;
}

export async function deleteBankTransactionRecord(
  service: Pick<BankTransactionQueryService, 'runAsync'>,
  accountSetId: string,
  id: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(`DELETE FROM bankTransactions WHERE id = ? AND accountSetId = ?`, [id, accountSetId]);
  await persist();
}

export async function deleteBankTransactionsByBatchRecord(
  service: Pick<BankTransactionQueryService, 'runAsync'>,
  accountSetId: string,
  batchId: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(`DELETE FROM bankTransactions WHERE importBatchId = ? AND accountSetId = ?`, [batchId, accountSetId]);
  await persist();
}

export async function clearBankTransactionsRecord(
  service: Pick<BankTransactionQueryService, 'runAsync'>,
  accountSetId: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(`DELETE FROM bankTransactions WHERE accountSetId = ? AND status != 'voucher_generated'`, [accountSetId]);
  await persist();
}

export function buildBankTransactionUpdate(
  updates: BankTransactionUpdateInput,
  accountSetId: string,
  id: string,
  now = new Date().toISOString(),
): BankTransactionInsert {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  const params: SqliteBindable[] = [];
  const setClauses = entries.map(([key, value]) => {
    params.push(typeof value === 'number' || typeof value === 'string' ? value : value === null ? null : (value as SqliteBindable));
    return `${key} = ?`;
  });
  params.push(now, id, accountSetId);

  return {
    sql: `UPDATE bankTransactions SET ${setClauses.length > 0 ? `${setClauses.join(', ')}, ` : ''}updateTime = ? WHERE id = ? AND accountSetId = ?`,
    params,
  };
}

export async function updateBankTransactionRecord(input: {
  db: SqliteDatabaseLike;
  accountSetId: string;
  id: string;
  updates: BankTransactionUpdateInput;
  persist: () => Promise<void>;
}): Promise<void> {
  const update = buildBankTransactionUpdate(input.updates, input.accountSetId, input.id);
  const stmt = input.db.prepare(update.sql);
  try {
    stmt.run(update.params);
  } finally {
    stmt.free();
  }
  await input.persist();
}
