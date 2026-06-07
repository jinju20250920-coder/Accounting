import type { SqliteDatabaseLike } from './fixed-asset-sqlite-service';
import type { SimpleQueryService } from './dept-project-currency-sqlite-service';

// ════════════════════════════════════════════
// Export — typed query-based
// ════════════════════════════════════════════

const EXPORT_TABLES = [
  'vouchers', 'entries', 'subjects', 'departments', 'projects', 'currencies',
  'fxRates', 'partners', 'voucherTemplates', 'commonSummaries', 'userPreferences',
  'auditLogs', 'recRelations', 'fxRevaluationRuns', 'fxRevaluationRunLines',
] as const;

export type ExportDataKey = (typeof EXPORT_TABLES)[number];
export type ExportData = Record<ExportDataKey, Record<string, unknown>[]>;

export async function exportAccountSetData(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<ExportData> {
  const data: Partial<ExportData> = {};
  for (const table of EXPORT_TABLES) {
    data[table] = await service.queryAllAsync(
      `SELECT * FROM ${table} WHERE accountSetId = ?`,
      [accountSetId],
    );
  }
  return data as ExportData;
}

// ════════════════════════════════════════════
// Import — raw SQL for FX revaluation tables
// ════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function importFxRevaluationRunsRecord(input: {
  db: SqliteDatabaseLike;
  runs: Record<string, any>[];
  accountSetId: string;
}): Promise<void> {
  for (const run of input.runs) {
    const stmt = input.db.prepare(`
      INSERT OR REPLACE INTO fxRevaluationRuns (
        id, accountSetId, period, baseCurrency, status, scope, revaluationDate,
        createdBy, notes, createTime, updateTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    try {
      stmt.run([
        run.id,
        (run.accountSetId as string) || input.accountSetId,
        run.period,
        run.baseCurrency || 'CNY',
        run.status,
        run.scope || null,
        run.revaluationDate || null,
        run.createdBy || null,
        run.notes || null,
        run.createTime || new Date().toISOString(),
        run.updateTime || new Date().toISOString(),
      ]);
    } finally {
      stmt.free();
    }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function importFxRevaluationRunLinesRecord(input: {
  db: SqliteDatabaseLike;
  lines: Record<string, any>[];
  accountSetId: string;
}): Promise<void> {
  for (const line of input.lines) {
    const stmt = input.db.prepare(`
      INSERT OR REPLACE INTO fxRevaluationRunLines (
        id, runId, accountSetId, sourceType, sourceId, sourceNo, currencyCode,
        baseCurrency, originalAmount, originalRate, revaluedAmount, gainLossAmount,
        rateDate, createTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    try {
      stmt.run([
        line.id,
        line.runId,
        (line.accountSetId as string) || input.accountSetId,
        line.sourceType,
        line.sourceId,
        line.sourceNo || null,
        line.currencyCode,
        line.baseCurrency || 'CNY',
        line.originalAmount,
        line.originalRate ?? null,
        line.revaluedAmount,
        line.gainLossAmount,
        line.rateDate || null,
        line.createTime || new Date().toISOString(),
      ]);
    } finally {
      stmt.free();
    }
  }
}

// ════════════════════════════════════════════
// Data integrity check
// ════════════════════════════════════════════

const COUNT_TABLES = [
  'vouchers', 'entries', 'subjects', 'departments', 'projects', 'currencies',
  'partners', 'voucherTemplates', 'commonSummaries', 'userPreferences',
  'auditLogs', 'recRelations',
] as const;

export type IntegrityCounts = Record<(typeof COUNT_TABLES)[number], number>;

export async function checkDataIntegrityQuery(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<IntegrityCounts> {
  const counts: Partial<IntegrityCounts> = {};
  for (const table of COUNT_TABLES) {
    interface CountRow { count: number }
    const result = await service.queryAllAsync<CountRow>(
      `SELECT * FROM ${table} WHERE accountSetId = ?`,
      [accountSetId],
    );
    counts[table] = result.length;
  }
  return counts as IntegrityCounts;
}

// ════════════════════════════════════════════
// Clear all data for an account set
// ════════════════════════════════════════════

const CLEAR_TABLES = [
  'entries', 'vouchers', 'subjects', 'departments', 'projects', 'currencies',
  'fxRates', 'fxRevaluationRuns', 'fxRevaluationRunLines', 'partners',
  'voucherTemplates', 'commonSummaries', 'userPreferences',
  'auditLogs', 'recRelations', 'bankTransactions', 'bank_account_bindings',
];

export async function clearAllDataRecord(db: SqliteDatabaseLike, accountSetId: string): Promise<void> {
  for (const table of CLEAR_TABLES) {
    const stmt = db.prepare(`DELETE FROM ${table} WHERE accountSetId = ?`);
    try {
      stmt.run([accountSetId]);
    } finally {
      stmt.free();
    }
  }
}
