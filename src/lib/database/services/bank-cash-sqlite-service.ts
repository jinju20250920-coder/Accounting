import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';
import type { SimpleQueryService } from './dept-project-currency-sqlite-service';

// ════════════════════════════════════════════
// Bank Opening Balance
// ════════════════════════════════════════════

export async function getBankOpeningBalanceQuery(
  service: SimpleQueryService,
  tenantId: string,
  accountSetId: string,
  accountNumber: string,
  periodStart: string,
): Promise<number | null> {
  interface BalanceRow { balance: number }
  const result = await service.querySingleAsync<BalanceRow>(
    `SELECT balance FROM bank_opening_balances WHERE tenantId = ? AND accountSetId = ? AND accountNumber = ? AND periodStart = ?`,
    [tenantId, accountSetId, accountNumber, periodStart],
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
  tenantId: string,
  accountSetId: string,
  accountNumber: string,
  periodStart: string,
): Promise<BankOpeningBalanceDetail | null> {
  // Try strict equality first (covers manuals saved with the exact queried period).
  let result = await service.querySingleAsync<BankOpeningBalanceDetail>(
    `SELECT balance, foreignBalance, exchangeRate FROM bank_opening_balances WHERE tenantId = ? AND accountSetId = ? AND accountNumber = ? AND periodStart = ?`,
    [tenantId, accountSetId, accountNumber, periodStart],
  );
  if (result) return result;

  // Fallback 1: latest manual at or before the queried period (handles setup
  // saving manuals at the account-set start month while the cash console is
  // viewed in a later month).
  result = await service.querySingleAsync<BankOpeningBalanceDetail>(
    `SELECT balance, foreignBalance, exchangeRate FROM bank_opening_balances
     WHERE tenantId = ? AND accountSetId = ? AND accountNumber = ? AND substr(periodStart, 1, 7) <= substr(?, 1, 7)
     ORDER BY periodStart DESC LIMIT 1`,
    [tenantId, accountSetId, accountNumber, periodStart],
  );
  if (result) return result;

  // Fallback 2: latest manual regardless of period (handles period misalignment
  // where the manual was saved for a later month than the queried one).
  result = await service.querySingleAsync<BankOpeningBalanceDetail>(
    `SELECT balance, foreignBalance, exchangeRate FROM bank_opening_balances
     WHERE tenantId = ? AND accountSetId = ? AND accountNumber = ?
     ORDER BY periodStart DESC LIMIT 1`,
    [tenantId, accountSetId, accountNumber],
  );
  return result ?? null;
}

export interface BankOpeningBalanceRow {
  accountNumber: string;
  periodStart: string;
  balance: number;
  foreignBalance?: number | null;
  exchangeRate?: number | null;
}

export async function getAllBankOpeningBalancesQuery(
  service: SimpleQueryService,
  tenantId: string,
  accountSetId: string,
): Promise<BankOpeningBalanceRow[]> {
  return await service.queryAllAsync<BankOpeningBalanceRow>(
    `SELECT accountNumber, periodStart, balance, foreignBalance, exchangeRate FROM bank_opening_balances WHERE tenantId = ? AND accountSetId = ?`,
    [tenantId, accountSetId],
  ) || [];
}

export async function saveBankOpeningBalanceRecord(input: {
  db: SqliteDatabaseLike;
  tenantId: string;
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
    INSERT OR REPLACE INTO bank_opening_balances (id, tenantId, accountSetId, accountNumber, periodStart, balance, foreignBalance, exchangeRate, generateVoucher, createdBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    stmt.run([
      id,
      input.tenantId,
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

export async function deleteBankOpeningBalanceRecord(input: {
  db: SqliteDatabaseLike;
  tenantId: string;
  accountSetId: string;
  accountNumber: string;
  periodStart?: string;
}): Promise<void> {
  const stmt = input.db.prepare(
    input.periodStart
      ? `DELETE FROM bank_opening_balances WHERE tenantId = ? AND accountSetId = ? AND accountNumber = ? AND periodStart = ?`
      : `DELETE FROM bank_opening_balances WHERE tenantId = ? AND accountSetId = ? AND accountNumber = ?`,
  );
  try {
    stmt.run(
      input.periodStart
        ? [input.tenantId, input.accountSetId, input.accountNumber, input.periodStart]
        : [input.tenantId, input.accountSetId, input.accountNumber],
    );
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
  tenantId: string,
  accountSetId: string,
  ourAccount: string,
  periodStart: string,
  periodEnd: string,
): Promise<CashOverviewResult> {
  const accountFilter = ourAccount ? `AND ourAccount = ?` : '';

  interface SumsRow { totalCredit: number; totalDebit: number }
  interface BalanceRow { balance: number }

  const openingParams: SqliteBindable[] = ourAccount
    ? [tenantId, accountSetId, ourAccount, periodStart]
    : [tenantId, accountSetId, periodStart];
  const openingResult = await service.querySingleAsync<SumsRow>(
    `SELECT COALESCE(SUM(credit), 0) as totalCredit, COALESCE(SUM(debit), 0) as totalDebit FROM bankTransactions WHERE tenantId = ? AND accountSetId = ? ${accountFilter} AND date < ?`,
    openingParams,
  );

  const periodParams: SqliteBindable[] = ourAccount
    ? [tenantId, accountSetId, ourAccount, periodStart, periodEnd]
    : [tenantId, accountSetId, periodStart, periodEnd];
  const periodResult = await service.querySingleAsync<SumsRow>(
    `SELECT COALESCE(SUM(credit), 0) as totalCredit, COALESCE(SUM(debit), 0) as totalDebit FROM bankTransactions WHERE tenantId = ? AND accountSetId = ? ${accountFilter} AND date >= ? AND date <= ?`,
    periodParams,
  );

  const lastBalanceResult = await service.querySingleAsync<BalanceRow>(
    `SELECT balance FROM bankTransactions WHERE tenantId = ? AND accountSetId = ? ${accountFilter} AND date >= ? AND date <= ? AND balance IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1`,
    periodParams,
  );

  let openingBalance: number | null = null;
  if (ourAccount) {
    // Pick the latest manual opening balance at or before the queried period —
    // setup saves it for the enable month (e.g. '2026-04'), but the cash console
    // may be viewed in a later month (e.g. '2026-06'). Strict equality misses
    // that case. We then layer in any transactions between the manual period
    // and the queried period so the opening stays correct after imports.
    interface ManualRow { balance: number; periodStart: string }
    let manualBalance = await service.querySingleAsync<ManualRow>(
      `SELECT balance, periodStart FROM bank_opening_balances WHERE tenantId = ? AND accountSetId = ? AND accountNumber = ? AND substr(periodStart, 1, 7) <= substr(?, 1, 7) ORDER BY periodStart DESC LIMIT 1`,
      [tenantId, accountSetId, ourAccount, periodStart],
    );
    // Fallback: if no manual matches the period filter, use the latest manual
    // for this account regardless of period (handles period misalignment).
    if (!manualBalance) {
      manualBalance = await service.querySingleAsync<ManualRow>(
        `SELECT balance, periodStart FROM bank_opening_balances WHERE tenantId = ? AND accountSetId = ? AND accountNumber = ? ORDER BY periodStart DESC LIMIT 1`,
        [tenantId, accountSetId, ourAccount],
      );
    }
    if (manualBalance?.balance != null) {
      const manualPeriodStart = manualBalance.periodStart.length >= 7
        ? `${manualBalance.periodStart.substring(0, 7)}-01`
        : manualBalance.periodStart;
      // Only add delta if manual's period is before queried period.
      if (manualPeriodStart < periodStart) {
        const sinceResult = await service.querySingleAsync<SumsRow>(
          `SELECT COALESCE(SUM(credit), 0) as totalCredit, COALESCE(SUM(debit), 0) as totalDebit FROM bankTransactions WHERE tenantId = ? AND accountSetId = ? AND ourAccount = ? AND date >= ? AND date < ?`,
          [tenantId, accountSetId, ourAccount, manualPeriodStart, periodStart],
        );
        const sinceCredit = sinceResult?.totalCredit || 0;
        const sinceDebit = sinceResult?.totalDebit || 0;
        openingBalance = Math.round((manualBalance.balance + sinceCredit - sinceDebit) * 100) / 100;
      } else {
        openingBalance = Math.round(manualBalance.balance * 100) / 100;
      }
    }
  } else {
    // "全部账户" aggregation: sum the latest manual opening per bank (at or
    // before the queried period) plus transactions between each bank's manual
    // period and the queried periodStart. Transactions before any manual
    // opening are intentionally excluded (manual opening replaces them).
    interface BankManualRow { accountNumber: string; balance: number; periodStart: string }
    let bankManuals = await service.queryAllAsync<BankManualRow>(
      `SELECT b.accountNumber, b.balance, b.periodStart
       FROM bank_opening_balances b
       INNER JOIN (
         SELECT accountNumber, MAX(periodStart) as maxPeriod
         FROM bank_opening_balances
         WHERE tenantId = ? AND accountSetId = ? AND substr(periodStart, 1, 7) <= substr(?, 1, 7)
         GROUP BY accountNumber
       ) m ON b.accountNumber = m.accountNumber AND b.periodStart = m.maxPeriod
       WHERE b.tenantId = ? AND b.accountSetId = ?`,
      [tenantId, accountSetId, periodStart, tenantId, accountSetId],
    );
    // Fallback: if no manuals match the period filter (e.g., manuals were saved
    // for a later period than the queried one), use the latest manual per account
    // regardless of period. This ensures the cards show actual opening balances
    // instead of 0 when the manual's period doesn't align with the queried period.
    if (bankManuals.length === 0) {
      bankManuals = await service.queryAllAsync<BankManualRow>(
        `SELECT b.accountNumber, b.balance, b.periodStart
         FROM bank_opening_balances b
         INNER JOIN (
           SELECT accountNumber, MAX(periodStart) as maxPeriod
           FROM bank_opening_balances
           WHERE tenantId = ? AND accountSetId = ?
           GROUP BY accountNumber
         ) m ON b.accountNumber = m.accountNumber AND b.periodStart = m.maxPeriod
         WHERE b.tenantId = ? AND b.accountSetId = ?`,
        [tenantId, accountSetId, tenantId, accountSetId],
      );
    }
    if (bankManuals.length > 0) {
      let totalOpening = 0;
      const coveredAccounts = new Set<string>();
      for (const m of bankManuals) {
        totalOpening += m.balance || 0;
        coveredAccounts.add(m.accountNumber);
        const manualPeriodStart = m.periodStart.length >= 7
          ? `${m.periodStart.substring(0, 7)}-01`
          : m.periodStart;
        // Only add delta if manual's period is before queried period.
        // If manual's period is at or after queried period, the manual IS the opening.
        if (manualPeriodStart < periodStart) {
          const sinceResult = await service.querySingleAsync<SumsRow>(
            `SELECT COALESCE(SUM(credit), 0) as totalCredit, COALESCE(SUM(debit), 0) as totalDebit FROM bankTransactions WHERE tenantId = ? AND accountSetId = ? AND ourAccount = ? AND date >= ? AND date < ?`,
            [tenantId, accountSetId, m.accountNumber, manualPeriodStart, periodStart],
          );
          totalOpening += (sinceResult?.totalCredit || 0) - (sinceResult?.totalDebit || 0);
        }
      }
      // For banks without any manual opening, fall back to transactions before periodStart.
      if (coveredAccounts.size > 0) {
        const uncoveredResult = await service.querySingleAsync<SumsRow>(
          `SELECT COALESCE(SUM(credit), 0) as totalCredit, COALESCE(SUM(debit), 0) as totalDebit FROM bankTransactions WHERE tenantId = ? AND accountSetId = ? AND date < ? AND ourAccount NOT IN (${bankManuals.map(() => '?').join(',')})`,
          [tenantId, accountSetId, periodStart, ...bankManuals.map(m => m.accountNumber)],
        );
        totalOpening += (uncoveredResult?.totalCredit || 0) - (uncoveredResult?.totalDebit || 0);
      }
      openingBalance = Math.round(totalOpening * 100) / 100;
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
  tenantId: string,
  accountSetId: string,
  ourAccount: string,
  periodStart: string,
  periodEnd: string,
  options?: JournalEntriesOptions,
): Promise<JournalEntriesResult> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const params: SqliteBindable[] = [tenantId, accountSetId, periodStart, periodEnd];
  let whereClause = `WHERE tenantId = ? AND accountSetId = ? AND date >= ? AND date <= ?`;

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
  tenantId: string,
  accountSetId: string,
  ourAccount: string,
  periodStart: string,
  periodEnd: string,
): Promise<Record<string, number>> {
  const params: SqliteBindable[] = [tenantId, accountSetId, periodStart, periodEnd];
  let whereClause = `WHERE tenantId = ? AND accountSetId = ? AND date >= ? AND date <= ?`;
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
