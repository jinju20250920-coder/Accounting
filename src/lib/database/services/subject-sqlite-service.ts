import type { Subject } from '../../../types';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';

// ── Row type (what SQLite returns) ──

export interface SubjectRow {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  type: string | null;
  direction: string;
  balance: number | null;
  enabled: number | null;
  frozen: number | null;
  description: string | null;
  enableDept: number | null;
  enableProject: number | null;
  enableForeign: number | null;
  foreignCurrency: string | null;
  isCustomer: number | null;
  isSupplier: number | null;
  isEmployee: number | null;
  enableCashFlow: number | null;
  isMonetary: number | null;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

// ── Query service interface ──

export interface SubjectQueryService {
  queryAllAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T[]>;
  querySingleAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T | null>;
}

// ── SQL constant ──

const SUBJECT_INSERT_SQL = `
  INSERT OR REPLACE INTO subjects (
    id, code, name, parentId, level, type, direction, balance,
    enabled, frozen, description, enableDept, enableProject,
    enableForeign, foreignCurrency, isCustomer, isSupplier,
    isEmployee, enableCashFlow, isMonetary, accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// ── Mapper ──

export function mapSubjectRow(row: SubjectRow): Subject {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
    level: row.level,
    direction: (row.direction as Subject['direction']) || 'debit',
    enableDept: Boolean(row.enableDept),
    enableProject: Boolean(row.enableProject),
    enableForeign: Boolean(row.enableForeign),
    foreignCurrency: row.foreignCurrency || '',
    isCustomer: Boolean(row.isCustomer),
    isSupplier: Boolean(row.isSupplier),
    isEmployee: Boolean(row.isEmployee),
    enableCashFlow: Boolean(row.enableCashFlow),
    isMonetary: Boolean(row.isMonetary),
    disabled: row.enabled === 0,
    block: row.frozen === 1,
    subjectType: (row.type as Subject['subjectType']) || undefined,
    accountSetId: row.accountSetId,
  };
}

// ── Write operations ──

function buildSubjectInsertParams(subject: Subject, accountSetId: string, now: string): SqliteBindable[] {
  return [
    subject.id,
    subject.code,
    subject.name,
    subject.parentId,
    subject.level || 1,
    subject.subjectType || '',
    subject.direction,
    0, // balance — not on Subject type, stored in DB
    subject.disabled !== undefined ? Number(!subject.disabled) : 1,
    subject.block !== undefined ? Number(subject.block) : 0,
    '', // description — not on Subject type, stored in DB
    Number(subject.enableDept || false),
    Number(subject.enableProject || false),
    Number(subject.enableForeign || false),
    subject.foreignCurrency || '',
    Number(subject.isCustomer || false),
    Number(subject.isSupplier || false),
    Number(subject.isEmployee || false),
    Number(subject.enableCashFlow || false),
    Number(subject.isMonetary || false),
    accountSetId,
    now, // createTime
    now, // updateTime
  ];
}

export async function saveSubjectsRecord(input: {
  db: SqliteDatabaseLike;
  subjects: Subject[];
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  for (const subject of input.subjects) {
    const stmt = input.db.prepare(SUBJECT_INSERT_SQL);
    try {
      stmt.run(buildSubjectInsertParams(subject, input.accountSetId, now));
    } finally {
      stmt.free();
    }
  }
  await input.persist();
}

export async function migrateSubjectVouchersRecord(input: {
  db: SqliteDatabaseLike & { getRowsModified(): number };
  oldSubjectCode: string;
  newSubjectCode: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<number> {
  const stmt = input.db.prepare(
    `UPDATE entries SET subjectCode = ? WHERE accountSetId = ? AND subjectCode = ?`,
  );
  try {
    stmt.run([input.newSubjectCode, input.accountSetId, input.oldSubjectCode]);
  } finally {
    stmt.free();
  }
  const changes = input.db.getRowsModified();
  await input.persist();
  return changes;
}

// ── Read operations ──

export async function listSubjects(
  service: SubjectQueryService,
  accountSetId: string,
): Promise<Subject[]> {
  const rows = await service.queryAllAsync<SubjectRow>(
    `SELECT * FROM subjects WHERE accountSetId = ? ORDER BY code`,
    [accountSetId],
  );
  const subjects = rows.map(mapSubjectRow);

  // Auto-fix: ensure 1122 (应收账款) has isCustomer=true and 2202 (应付账款) has isSupplier=true
  const fixedSubjects = subjects.map(subject => {
    if (subject.code === '1122') {
      return { ...subject, isCustomer: true, enableDept: true, enableProject: true, parentId: null, level: 1 };
    }
    if (subject.code === '2202') {
      return { ...subject, isSupplier: true };
    }
    return subject;
  });

  return fixedSubjects;
}

export async function findSubjectByCode(
  service: SubjectQueryService,
  accountSetId: string,
  code: string,
): Promise<Subject | undefined> {
  const row = await service.querySingleAsync<SubjectRow>(
    `SELECT * FROM subjects WHERE accountSetId = ? AND code = ?`,
    [accountSetId, code],
  );
  return row ? mapSubjectRow(row) : undefined;
}

export async function hasVoucherForSubject(
  service: SubjectQueryService,
  accountSetId: string,
  subjectIdOrCode: string,
): Promise<boolean> {
  interface CountRow { count: number }
  const result = await service.querySingleAsync<CountRow>(
    `SELECT COUNT(*) as count FROM entries WHERE accountSetId = ? AND (subjectCode = ? OR subjectCode = (SELECT code FROM subjects WHERE accountSetId = ? AND id = ?))`,
    [accountSetId, subjectIdOrCode, accountSetId, subjectIdOrCode],
  );
  return (result?.count || 0) > 0;
}
