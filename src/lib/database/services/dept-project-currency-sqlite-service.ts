import type { Currency, Department, Project } from '../../../types';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';

// ── Shared query interface ──

export interface SimpleQueryService {
  queryAllAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T[]>;
  querySingleAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T | null>;
}

// ════════════════════════════════════════════
// Department
// ════════════════════════════════════════════

export interface DepartmentRow {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  enabled: number | null;
  frozen: number | null;
  description: string | null;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

const DEPT_INSERT_SQL = `
  INSERT OR REPLACE INTO departments (
    id, code, name, parentId, level, enabled, description,
    accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export function mapDepartmentRow(row: DepartmentRow): Department {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
    level: row.level,
    frozen: row.enabled === 0 || row.frozen === 1,
    accountSetId: row.accountSetId,
  };
}

export async function saveDepartmentsRecord(input: {
  db: SqliteDatabaseLike;
  departments: Department[];
  accountSetId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  for (const dept of input.departments) {
    const stmt = input.db.prepare(DEPT_INSERT_SQL);
    try {
      stmt.run([
        dept.id,
        dept.code,
        dept.name,
        dept.parentId,
        dept.level || 1,
        dept.frozen !== undefined ? Number(!dept.frozen) : 1,
        '', // description
        input.accountSetId,
        now,
        now,
      ]);
    } finally {
      stmt.free();
    }
  }
}

export async function listDepartments(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<Department[]> {
  const rows = await service.queryAllAsync<DepartmentRow>(
    `SELECT * FROM departments WHERE accountSetId = ? ORDER BY code`,
    [accountSetId],
  );
  return rows.map(mapDepartmentRow);
}

export async function findDepartmentByCode(
  service: SimpleQueryService,
  accountSetId: string,
  code: string,
): Promise<Department | undefined> {
  const row = await service.querySingleAsync<DepartmentRow>(
    `SELECT * FROM departments WHERE accountSetId = ? AND code = ?`,
    [accountSetId, code],
  );
  return row ? mapDepartmentRow(row) : undefined;
}

// ════════════════════════════════════════════
// Project
// ════════════════════════════════════════════

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: number | null;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

const PROJECT_INSERT_SQL = `
  INSERT OR REPLACE INTO projects (
    id, code, name, description, enabled, accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: 'income',
    parentId: null,
    level: 1,
    startDate: '',
    endDate: '',
    frozen: row.enabled === 0,
    accountSetId: row.accountSetId,
  };
}

export async function saveProjectsRecord(input: {
  db: SqliteDatabaseLike;
  projects: Project[];
  accountSetId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  for (const project of input.projects) {
    const stmt = input.db.prepare(PROJECT_INSERT_SQL);
    try {
      stmt.run([
        project.id,
        project.code,
        project.name,
        '', // description
        project.frozen !== undefined ? Number(!project.frozen) : 1,
        input.accountSetId,
        now,
        now,
      ]);
    } finally {
      stmt.free();
    }
  }
}

export async function listProjects(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<Project[]> {
  const rows = await service.queryAllAsync<ProjectRow>(
    `SELECT * FROM projects WHERE accountSetId = ? ORDER BY code`,
    [accountSetId],
  );
  return rows.map(mapProjectRow);
}

export async function findProjectByCode(
  service: SimpleQueryService,
  accountSetId: string,
  code: string,
): Promise<Project | undefined> {
  const row = await service.querySingleAsync<ProjectRow>(
    `SELECT * FROM projects WHERE accountSetId = ? AND code = ?`,
    [accountSetId, code],
  );
  return row ? mapProjectRow(row) : undefined;
}

// ════════════════════════════════════════════
// Currency
// ════════════════════════════════════════════

export interface CurrencyRow {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number | null;
  enabled: number | null;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

const CURRENCY_INSERT_SQL = `
  INSERT OR REPLACE INTO currencies (
    id, code, name, symbol, exchangeRate, enabled, accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export function mapCurrencyRow(row: CurrencyRow): Currency {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    precision: 2,
    exchangeRate: row.exchangeRate || 1.0,
    rateStartDate: '',
    gainLossSubjectCode: '',
    gainLossSubjectName: '',
    isBase: row.code === 'CNY',
    enabled: row.enabled !== 0,
    disabled: row.enabled === 0,
    createTime: row.createTime || '',
    updateTime: row.updateTime || '',
    accountSetId: row.accountSetId,
  };
}

export async function saveCurrenciesRecord(input: {
  db: SqliteDatabaseLike;
  currencies: Currency[];
  accountSetId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  for (const currency of input.currencies) {
    const stmt = input.db.prepare(CURRENCY_INSERT_SQL);
    try {
      stmt.run([
        currency.id,
        currency.code,
        currency.name,
        currency.symbol,
        currency.exchangeRate || 1.0,
        currency.disabled !== undefined ? Number(!currency.disabled) : (currency.enabled !== undefined ? Number(currency.enabled) : 1),
        input.accountSetId,
        now,
        now,
      ]);
    } finally {
      stmt.free();
    }
  }
}

export async function listCurrencies(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<Currency[]> {
  const rows = await service.queryAllAsync<CurrencyRow>(
    `SELECT * FROM currencies WHERE accountSetId = ? ORDER BY code`,
    [accountSetId],
  );
  return rows.map(mapCurrencyRow);
}

export async function findCurrencyByCode(
  service: SimpleQueryService,
  accountSetId: string,
  code: string,
): Promise<Currency | undefined> {
  const row = await service.querySingleAsync<CurrencyRow>(
    `SELECT * FROM currencies WHERE accountSetId = ? AND code = ?`,
    [accountSetId, code],
  );
  return row ? mapCurrencyRow(row) : undefined;
}
