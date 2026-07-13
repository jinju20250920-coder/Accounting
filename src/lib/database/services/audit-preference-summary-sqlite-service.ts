import type { AuditLog } from '../sqlite-service';
import type { CommonSummary, UserPreference } from '../../../types';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';
import type { SimpleQueryService } from './dept-project-currency-sqlite-service';

// ════════════════════════════════════════════
// Audit Log
// ════════════════════════════════════════════

export interface AuditLogRow {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  details: string | null;
  userId: string | null;
  timestamp: string;
  tenantId: string;
  accountSetId: string;
}

export function mapAuditLogRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    type: row.type as AuditLog['type'],
    entityType: row.entityType as AuditLog['entityType'],
    entityId: row.entityId,
    details: row.details ? JSON.parse(row.details) : {},
    userId: row.userId || '',
    timestamp: row.timestamp,
    accountSetId: row.accountSetId,
  };
}

export async function addAuditLogRecord(input: {
  db: SqliteDatabaseLike;
  log: AuditLog;
  tenantId: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const log = { ...input.log, accountSetId: input.accountSetId };
  const stmt = input.db.prepare(`
    INSERT INTO auditLogs (
      id, type, entityType, entityId, details, userId, timestamp, tenantId, accountSetId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    stmt.run([
      log.id,
      log.type,
      log.entityType,
      log.entityId,
      JSON.stringify(log.details),
      log.userId,
      log.timestamp,
      input.tenantId,
      log.accountSetId,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function listAuditLogs(
  service: SimpleQueryService,
  tenantId: string,
  accountSetId: string,
  limit: number,
): Promise<AuditLog[]> {
  const rows = await service.queryAllAsync<AuditLogRow>(
    `SELECT * FROM auditLogs WHERE tenantId = ? AND accountSetId = ? ORDER BY timestamp DESC LIMIT ?`,
    [tenantId, accountSetId, limit],
  );
  return rows.map(mapAuditLogRow);
}

// ════════════════════════════════════════════
// User Preference
// ════════════════════════════════════════════

export interface UserPreferenceRow {
  id: string;
  userId: string;
  type: string | null;
  key: string | null;
  value: string | null;
  tenantId: string;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

export function mapUserPreferenceRow(row: UserPreferenceRow): UserPreference {
  return {
    id: row.id,
    oldSubject: '',
    newSubject: '',
    operationType: 'subject_correction',
    count: 1,
    createTime: row.createTime || '',
    updateTime: row.updateTime || '',
  };
}

export async function savePreferenceRecord(input: {
  db: SqliteDatabaseLike;
  preference: UserPreference;
  tenantId: string;
  accountSetId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const pref = { ...input.preference, accountSetId: input.accountSetId };
  const stmt = input.db.prepare(`
    INSERT OR REPLACE INTO userPreferences (
      id, userId, type, key, value, tenantId, accountSetId, createTime, updateTime
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    stmt.run([
      pref.id,
      '',  // userId
      '',  // type
      '',  // key
      JSON.stringify(pref),
      input.tenantId,
      input.accountSetId,
      pref.createTime || now,
      pref.updateTime || now,
    ]);
  } finally {
    stmt.free();
  }
}

export async function listPreferencesByUser(
  service: SimpleQueryService,
  tenantId: string,
  accountSetId: string,
  userId: string,
): Promise<UserPreference[]> {
  const rows = await service.queryAllAsync<UserPreferenceRow>(
    `SELECT * FROM userPreferences WHERE tenantId = ? AND accountSetId = ? AND userId = ?`,
    [tenantId, accountSetId, userId],
  );
  return rows.map(row => {
    try {
      const parsed = row.value ? JSON.parse(row.value) : {};
      return { ...mapUserPreferenceRow(row), ...parsed };
    } catch {
      return mapUserPreferenceRow(row);
    }
  });
}

// ════════════════════════════════════════════
// Common Summary
// ════════════════════════════════════════════

export interface CommonSummaryRow {
  id: string;
  content: string;
  frequency: number | null;
  tenantId: string;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

const SUMMARY_INSERT_SQL = `
  INSERT OR REPLACE INTO commonSummaries (
    id, content, frequency, tenantId, accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

export function mapCommonSummaryRow(row: CommonSummaryRow): CommonSummary {
  return {
    id: row.id,
    text: row.content,
    sortOrder: row.frequency || 0,
    createTime: row.createTime || '',
    updateTime: row.updateTime || '',
    accountSetId: row.accountSetId,
  };
}

export async function saveCommonSummariesRecord(input: {
  db: SqliteDatabaseLike;
  summaries: CommonSummary[];
  tenantId: string;
  accountSetId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  for (const summary of input.summaries) {
    const stmt = input.db.prepare(SUMMARY_INSERT_SQL);
    try {
      stmt.run([
        summary.id,
        summary.text || '',
        summary.sortOrder || 0,
        input.tenantId,
        input.accountSetId,
        summary.createTime || now,
        summary.updateTime || now,
      ]);
    } finally {
      stmt.free();
    }
  }
}

export async function listCommonSummaries(
  service: SimpleQueryService,
  tenantId: string,
  accountSetId: string,
): Promise<CommonSummary[]> {
  const rows = await service.queryAllAsync<CommonSummaryRow>(
    `SELECT * FROM commonSummaries WHERE tenantId = ? AND accountSetId = ? ORDER BY frequency DESC`,
    [tenantId, accountSetId],
  );
  return rows.map(mapCommonSummaryRow);
}
