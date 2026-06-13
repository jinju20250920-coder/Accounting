import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';
import type { SimpleQueryService } from './dept-project-currency-sqlite-service';

// ════════════════════════════════════════════
// Bank Opening Balance
// ════════════════════════════════════════════

export async function getBankOpeningBalanceQuery(
  service: SimpleQueryService,
  accountSetId: string,
  accountNumber: string,
  periodStart: string,
): Promise<number | null> {
  interface BalanceRow { balance: number }
  const result = await service.querySingleAsync<BalanceRow>(
    `SELECT balance FROM bank_opening_balances WHERE accountSetId = ? AND accountNumber = ? AND periodStart = ?`,
    [accountSetId, accountNumber, periodStart],
  );
  return result?.balance ?? null;
}

export interface BankOpeningBalanceDetail {
  balance: number;
  foreignBalance: number | null;
  exchangeRate: number | null;
}

export async function getBankOpeningBalanceDetailQuery(
  service: SimpleQueryService,
  accountSetId: string,
  accountNumber: string,
  periodStart: string,
): Promise<BankOpeningBalanceDetail | null> {
  const result = await service.querySingleAsync<BankOpeningBalanceDetail>(
    `SELECT balance, foreignBalance, exchangeRate FROM bank_opening_balances WHERE accountSetId = ? AND accountNumber = ? AND periodStart = ?`,
    [accountSetId, accountNumber, periodStart],
  );
  return result ?? null;
}

export interface BankOpeningBalanceRow {
  accountNumber: string;
  periodStart: string;
  balance: number;
}

export async function getAllBankOpeningBalancesQuery(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<BankOpeningBalanceRow[]> {
  return await service.queryAllAsync<BankOpeningBalanceRow>(
    `SELECT accountNumber, periodStart, balance FROM bank_opening_balances WHERE accountSetId = ?`,
    [accountSetId],
  ) || [];
}

export async function saveBankOpeningBalanceRecord(input: {
  db: SqliteDatabaseLike;
  accountSetId: string;
  accountNumber: string;
  periodStart: string;
  balance: number;
  foreignBalance?: number | null;
  exchangeRate?: number | null;
  generateVoucher?: boolean;
  createdBy?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const id = `${input.accountSetId}-${input.accountNumber}-${input.periodStart}`;
  const stmt = input.db.prepare(`
    INSERT OR REPLACE INTO bank_opening_balances (id, accountSetId, accountNumber, periodStart, balance, foreignBalance, exchangeRate, generateVoucher, createdBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    stmt.run([
      id,
      input.accountSetId,
      input.accountNumber,
      input.periodStart,
      input.balance,
      input.foreignBalance ?? null,
      input.exchangeRate ?? null,
      input.generateVoucher ? 1 : 0,
      input.createdBy || null,
      now,
      now,
    ]);
  } finally {
    stmt.free();
  }
}

// ════════════════════════════════════════════
// Cash Overview
// ════════════════════════════════════════════

export interface CashOverviewResult {
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  lastBankBalance: number | null;
}

export async function getCashOverviewQuery(
  service: SimpleQueryService,
  accountSetId: string,
  ourAccount: string,
  periodStart: string,
  periodEnd: string,
): Promise<CashOverviewResult> {
  const accountFilter = ourAccount ? `AND ourAccount = ?` : '';

  interface SumsRow { totalCredit: number; totalDebit: number }
  interface BalanceRow { balance: number }

  const openingParams: SqliteBindable[] = ourAccount
    ? [accountSetId, ourAccount, periodStart]
    : [accountSetId, periodStart];
  const openingResult = await service.querySingleAsync<SumsRow>(
    `SELECT COALESCE(SUM(credit), 0) as totalCredit, COALESCE(SUM(debit), 0) as totalDebit FROM bankTransactions WHERE accountSetId = ? ${accountFilter} AND date < ?`,
    openingParams,
  );

  const periodParams: SqliteBindable[] = ourAccount
    ? [accountSetId, ourAccount, periodStart, periodEnd]
    : [accountSetId, periodStart, periodEnd];
  const periodResult = await service.querySingleAsync<SumsRow>(
    `SELECT COALESCE(SUM(credit), 0) as totalCredit, COALESCE(SUM(debit), 0) as totalDebit FROM bankTransactions WHERE accountSetId = ? ${accountFilter} AND date >= ? AND date <= ?`,
    periodParams,
  );

  const lastBalanceResult = await service.querySingleAsync<BalanceRow>(
    `SELECT balance FROM bankTransactions WHERE accountSetId = ? ${accountFilter} AND date >= ? AND date <= ? AND balance IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1`,
    periodParams,
  );

  let openingBalance: number | null = null;
  if (ourAccount) {
    const manualBalance = await service.querySingleAsync<BalanceRow>(
      `SELECT balance FROM bank_opening_balances WHERE accountSetId = ? AND accountNumber = ? AND substr(periodStart, 1, 7) = substr(?, 1, 7) ORDER BY periodStart DESC LIMIT 1`,
      [accountSetId, ourAccount, periodStart],
    );
    if (manualBalance?.balance != null) {
      openingBalance = manualBalance.balance;
    }
  }

  if (openingBalance === null) {
    const openingCredit = openingResult?.totalCredit || 0;
    const openingDebit = openingResult?.totalDebit || 0;
    openingBalance = Math.round((openingCredit - openingDebit) * 100) / 100;
  }

  const totalCredit = periodResult?.totalCredit || 0;
  const totalDebit = periodResult?.totalDebit || 0;
  const closingBalance = Math.round((openingBalance + totalCredit - totalDebit) * 100) / 100;

  return {
    openingBalance,
    totalCredit,
    totalDebit,
    closingBalance,
    lastBankBalance: lastBalanceResult?.balance ?? null,
  };
}

// ════════════════════════════════════════════
// Journal Entries (paginated)
// ════════════════════════════════════════════

export interface JournalEntriesOptions {
  statusFilter?: string;
  page?: number;
  pageSize?: number;
}

export interface JournalEntriesResult {
  entries: Record<string, unknown>[];
  total: number;
}

export async function getJournalEntriesQuery(
  service: SimpleQueryService,
  accountSetId: string,
  ourAccount: string,
  periodStart: string,
  periodEnd: string,
  options?: JournalEntriesOptions,
): Promise<JournalEntriesResult> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const params: SqliteBindable[] = [accountSetId, periodStart, periodEnd];
  let whereClause = `WHERE accountSetId = ? AND date >= ? AND date <= ?`;

  if (ourAccount) {
    whereClause += ` AND ourAccount = ?`;
    params.push(ourAccount);
  }
  if (options?.statusFilter) {
    whereClause += ` AND status = ?`;
    params.push(options.statusFilter);
  }

  interface CountRow { total: number }
  const countResult = await service.querySingleAsync<CountRow>(
    `SELECT COUNT(*) as total FROM bankTransactions ${whereClause}`,
    params,
  );

  const entries = await service.queryAllAsync<Record<string, unknown>>(
    `SELECT * FROM bankTransactions ${whereClause} ORDER BY date ASC, id ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    entries: entries || [],
    total: countResult?.total || 0,
  };
}

// ════════════════════════════════════════════
// Transaction Status Counts
// ════════════════════════════════════════════

export async function getTransactionStatusCountsQuery(
  service: SimpleQueryService,
  accountSetId: string,
  ourAccount: string,
  periodStart: string,
  periodEnd: string,
): Promise<Record<string, number>> {
  const params: SqliteBindable[] = [accountSetId, periodStart, periodEnd];
  let whereClause = `WHERE accountSetId = ? AND date >= ? AND date <= ?`;
  if (ourAccount) {
    whereClause += ` AND ourAccount = ?`;
    params.push(ourAccount);
  }

  interface StatusRow { status: string; count: number }
  const rows = await service.queryAllAsync<StatusRow>(
    `SELECT status, COUNT(*) as count FROM bankTransactions ${whereClause} GROUP BY status`,
    params,
  );

  const counts: Record<string, number> = { pending: 0, matched: 0, voucher_generated: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}
