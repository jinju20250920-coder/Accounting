import type {
  FxRate,
  FxRevaluationRun,
  FxRevaluationRunLine,
  VoucherTemplate,
} from '../../../types';
import type { SqliteDatabaseLike } from './fixed-asset-sqlite-service';
import type { SimpleQueryService } from './dept-project-currency-sqlite-service';

// ════════════════════════════════════════════
// Voucher Template
// ════════════════════════════════════════════

export interface VoucherTemplateRow {
  id: string;
  name: string;
  description: string | null;
  entries: string | null;
  validations: string | null;
  variables: string | null;
  isSystem: number | null;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

const TEMPLATE_INSERT_SQL = `
  INSERT OR REPLACE INTO voucherTemplates (
    id, name, description, entries, validations, variables,
    isSystem, accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function mapVoucherTemplateRow(row: VoucherTemplateRow): VoucherTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    entries: parseJson(row.entries, []),
    validations: parseJson(row.validations, []),
    variables: parseJson(row.variables, []),
    isSystem: Boolean(row.isSystem),
    createTime: row.createTime || '',
    updateTime: row.updateTime || '',
    accountSetId: row.accountSetId,
  };
}

export async function saveVoucherTemplatesRecord(input: {
  db: SqliteDatabaseLike;
  templates: VoucherTemplate[];
  accountSetId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  for (const template of input.templates) {
    const stmt = input.db.prepare(TEMPLATE_INSERT_SQL);
    try {
      stmt.run([
        template.id,
        template.name,
        template.description || '',
        JSON.stringify(template.entries || []),
        JSON.stringify(template.validations || []),
        JSON.stringify(template.variables || []),
        template.isSystem !== undefined ? Number(template.isSystem) : 0,
        input.accountSetId,
        template.createTime || now,
        template.updateTime || now,
      ]);
    } finally {
      stmt.free();
    }
  }
}

export async function listVoucherTemplates(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<VoucherTemplate[]> {
  const rows = await service.queryAllAsync<VoucherTemplateRow>(
    `SELECT * FROM voucherTemplates WHERE accountSetId = ?`,
    [accountSetId],
  );
  return rows.map(mapVoucherTemplateRow);
}

export async function findVoucherTemplateById(
  service: SimpleQueryService,
  accountSetId: string,
  id: string,
): Promise<VoucherTemplate | undefined> {
  const row = await service.querySingleAsync<VoucherTemplateRow>(
    `SELECT * FROM voucherTemplates WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  return row ? mapVoucherTemplateRow(row) : undefined;
}

// ════════════════════════════════════════════
// FX Rate
// ════════════════════════════════════════════

export interface FxRateRow {
  id: string;
  accountSetId: string;
  rateDate: string;
  currencyCode: string;
  baseCurrency: string | null;
  middleRate: number;
  source: string | null;
  createdBy: string | null;
  createTime: string | null;
  updateTime: string | null;
}

export function mapFxRateRow(row: FxRateRow): FxRate {
  return {
    id: row.id,
    accountSetId: row.accountSetId,
    rateDate: row.rateDate,
    currencyCode: row.currencyCode,
    baseCurrency: row.baseCurrency || 'CNY',
    middleRate: row.middleRate,
    source: row.source || undefined,
    createdBy: row.createdBy || undefined,
    createTime: row.createTime || '',
    updateTime: row.updateTime || '',
  };
}

export async function saveFxRatesRecord(input: {
  db: SqliteDatabaseLike;
  rates: FxRate[];
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  for (const rate of input.rates) {
    const stmt = input.db.prepare(`
      INSERT OR REPLACE INTO fxRates
        (id, accountSetId, rateDate, currencyCode, baseCurrency, middleRate, source, createdBy, createTime, updateTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    try {
      stmt.run([
        rate.id,
        rate.accountSetId || input.accountSetId,
        rate.rateDate,
        rate.currencyCode,
        rate.baseCurrency || 'CNY',
        rate.middleRate,
        rate.source || null,
        rate.createdBy || null,
        rate.createTime || now,
        rate.updateTime || now,
      ]);
    } finally {
      stmt.free();
    }
  }
  await input.persist();
}

export async function listFxRates(
  service: SimpleQueryService,
  accountSetId: string,
  rateDate?: string,
): Promise<FxRate[]> {
  if (rateDate) {
    const exactRows = await service.queryAllAsync<FxRateRow>(
      `SELECT * FROM fxRates WHERE accountSetId = ? AND rateDate = ? ORDER BY currencyCode`,
      [accountSetId, rateDate],
    );
    if (exactRows.length > 0) {
      return exactRows.map(mapFxRateRow);
    }
    // Fallback: most recent rate on or before this date per currency
    const allRows = await service.queryAllAsync<FxRateRow>(
      `SELECT * FROM fxRates WHERE accountSetId = ? AND rateDate <= ? ORDER BY currencyCode, rateDate DESC`,
      [accountSetId, rateDate],
    );
    const latestByCurrency = new Map<string, FxRateRow>();
    for (const row of allRows) {
      if (!latestByCurrency.has(row.currencyCode)) {
        latestByCurrency.set(row.currencyCode, row);
      }
    }
    return [...latestByCurrency.values()].map(mapFxRateRow);
  }
  const rows = await service.queryAllAsync<FxRateRow>(
    `SELECT * FROM fxRates WHERE accountSetId = ? ORDER BY rateDate DESC, currencyCode`,
    [accountSetId],
  );
  return rows.map(mapFxRateRow);
}

// ════════════════════════════════════════════
// FX Revaluation Run
// ════════════════════════════════════════════

export async function saveFxRevaluationRunRecord(input: {
  db: SqliteDatabaseLike;
  run: FxRevaluationRun;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const stmt = input.db.prepare(`
    INSERT OR REPLACE INTO fxRevaluationRuns
      (id, accountSetId, period, baseCurrency, status, previewData, voucherId, voucherNo, createdAt, confirmedAt, createTime, updateTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    stmt.run([
      input.run.id,
      input.run.accountSetId || input.accountSetId,
      input.run.period,
      input.run.baseCurrency,
      input.run.status,
      input.run.previewData || null,
      input.run.voucherId || null,
      input.run.voucherNo || null,
      input.run.createdAt,
      input.run.confirmedAt || null,
      input.run.createTime || now,
      input.run.updateTime || now,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function listFxRevaluationRuns(
  service: SimpleQueryService,
  accountSetId: string,
  period?: string,
): Promise<FxRevaluationRun[]> {
  const sql = period
    ? `SELECT * FROM fxRevaluationRuns WHERE accountSetId = ? AND period = ? ORDER BY createdAt DESC`
    : `SELECT * FROM fxRevaluationRuns WHERE accountSetId = ? ORDER BY createdAt DESC`;
  const params = period ? [accountSetId, period] : [accountSetId];
  return service.queryAllAsync<FxRevaluationRun>(sql, params);
}

export async function findFxRevaluationRun(
  service: SimpleQueryService,
  accountSetId: string,
  id: string,
): Promise<FxRevaluationRun | null> {
  return service.querySingleAsync<FxRevaluationRun>(
    `SELECT * FROM fxRevaluationRuns WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
}

export async function deleteFxRevaluationRunRecord(input: {
  db: SqliteDatabaseLike;
  id: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const deleteLines = input.db.prepare(`DELETE FROM fxRevaluationRunLines WHERE runId = ?`);
  deleteLines.run([input.id]);
  deleteLines.free();
  const deleteRun = input.db.prepare(`DELETE FROM fxRevaluationRuns WHERE id = ? AND accountSetId = ?`);
  deleteRun.run([input.id, input.accountSetId]);
  deleteRun.free();
  await input.persist();
}

export async function saveFxRevaluationRunLinesRecord(input: {
  db: SqliteDatabaseLike;
  lines: FxRevaluationRunLine[];
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  for (const line of input.lines) {
    const stmt = input.db.prepare(`
      INSERT OR REPLACE INTO fxRevaluationRunLines
        (id, runId, accountSetId, sourceType, sourceId, sourceName, currencyCode,
         originalAmount, originalRate, revaluationRate, bookValueBase, revaluedBase,
         gainLossAmount, gainLossDirection, subjectCode, subjectName, createTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    try {
      stmt.run([
        line.id, line.runId, line.accountSetId || input.accountSetId,
        line.sourceType, line.sourceId, line.sourceName || null, line.currencyCode,
        line.originalAmount, line.originalRate, line.revaluationRate,
        line.bookValueBase, line.revaluedBase, line.gainLossAmount,
        line.gainLossDirection, line.subjectCode || null, line.subjectName || null,
        line.createTime || new Date().toISOString(),
      ]);
    } finally {
      stmt.free();
    }
  }
  await input.persist();
}

export async function listFxRevaluationRunLines(
  service: SimpleQueryService,
  accountSetId: string,
  runId: string,
): Promise<FxRevaluationRunLine[]> {
  return service.queryAllAsync<FxRevaluationRunLine>(
    `SELECT * FROM fxRevaluationRunLines WHERE runId = ? AND accountSetId = ?`,
    [runId, accountSetId],
  );
}

// ════════════════════════════════════════════
// Account Set Base Currency
// ════════════════════════════════════════════

export async function getAccountSetBaseCurrencyQuery(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<{ baseCurrency: string; baseCurrencyName: string } | null> {
  interface BaseCurrencyRow { baseCurrency: string | null; baseCurrencyName: string | null }
  const result = await service.querySingleAsync<BaseCurrencyRow>(
    `SELECT baseCurrency, baseCurrencyName FROM accountSets WHERE id = ? LIMIT 1`,
    [accountSetId],
  );
  if (!result) return null;
  return {
    baseCurrency: result.baseCurrency || 'CNY',
    baseCurrencyName: result.baseCurrencyName || '人民币',
  };
}

export async function saveAccountSetBaseCurrencyRecord(input: {
  db: SqliteDatabaseLike;
  baseCurrency: string;
  baseCurrencyName?: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const stmt = input.db.prepare(`
    UPDATE accountSets
    SET baseCurrency = ?, baseCurrencyName = COALESCE(?, baseCurrencyName), updateTime = ?
    WHERE id = ?
  `);
  try {
    stmt.run([input.baseCurrency || 'CNY', input.baseCurrencyName || null, now, input.accountSetId]);
  } finally {
    stmt.free();
  }
  await input.persist();
}
