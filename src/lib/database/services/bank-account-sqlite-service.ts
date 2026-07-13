import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';

export interface BankAccountBinding {
  id: string;
  tenantId?: string;
  accountSetId: string;
  accountNumber: string;
  bankId: string;
  bankName: string;
  aliasName?: string;
  subSubjectCode: string;
  subSubjectName: string;
  branch?: string;
  currency?: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface BankAccountBindingRow {
  id: string;
  tenantId: string;
  accountSetId: string;
  accountNumber: string;
  bankId: string;
  bankName: string;
  aliasName: string | null;
  subSubjectCode: string;
  subSubjectName: string;
  branch: string | null;
  currency: string | null;
  isDefault: number | boolean | null;
  createdAt: string;
}

export interface BankAccountBindingInsert {
  sql: string;
  params: SqliteBindable[];
}

export interface BankAccountBindingQueryService {
  queryAllAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T[]>;
  querySingleAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T | null>;
  runAsync(sql: string, params?: SqliteBindable[]): Promise<void>;
}

const BANK_ACCOUNT_BINDING_INSERT_SQL = `
  INSERT OR REPLACE INTO bank_account_bindings
  (id, tenantId, accountSetId, accountNumber, bankId, bankName, aliasName, subSubjectCode, subSubjectName, branch, currency, isDefault, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function nullableText(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalText(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildBankAccountBindingInsert(binding: BankAccountBinding): BankAccountBindingInsert {
  return {
    sql: BANK_ACCOUNT_BINDING_INSERT_SQL,
    params: [
      binding.id,
      binding.tenantId,
      binding.accountSetId,
      binding.accountNumber,
      binding.bankId,
      binding.bankName,
      nullableText(binding.aliasName),
      binding.subSubjectCode,
      binding.subSubjectName,
      nullableText(binding.branch),
      nullableText(binding.currency),
      binding.isDefault ? 1 : 0,
      binding.createdAt,
    ],
  };
}

export function mapBankAccountBindingRow(row: BankAccountBindingRow): BankAccountBinding {
  return {
    id: row.id,
    tenantId: row.tenantId,
    accountSetId: row.accountSetId,
    accountNumber: row.accountNumber,
    bankId: row.bankId,
    bankName: row.bankName,
    aliasName: optionalText(row.aliasName),
    subSubjectCode: row.subSubjectCode,
    subSubjectName: row.subSubjectName,
    branch: optionalText(row.branch),
    currency: optionalText(row.currency),
    isDefault: !!row.isDefault,
    createdAt: row.createdAt,
  };
}

export async function listBankAccountBindings(
  service: BankAccountBindingQueryService,
  tenantId: string,
  accountSetId: string,
): Promise<BankAccountBinding[]> {
  const rows = await service.queryAllAsync<BankAccountBindingRow>(
    `SELECT * FROM bank_account_bindings WHERE tenantId = ? AND accountSetId = ? ORDER BY createdAt DESC`,
    [tenantId, accountSetId],
  );
  return (rows || []).map(mapBankAccountBindingRow);
}

export async function saveBankAccountBindingRecord(input: {
  db: SqliteDatabaseLike;
  binding: BankAccountBinding;
  persist: () => Promise<void>;
}): Promise<void> {
  const insert = buildBankAccountBindingInsert(input.binding);
  const stmt = input.db.prepare(insert.sql);
  try {
    stmt.run(insert.params);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteBankAccountBindingRecord(
  service: BankAccountBindingQueryService,
  tenantId: string,
  accountSetId: string,
  id: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(
    `DELETE FROM bank_account_bindings WHERE id = ? AND tenantId = ? AND accountSetId = ?`,
    [id, tenantId, accountSetId],
  );
  await persist();
}

export async function findBankAccountBindingRecord(
  service: BankAccountBindingQueryService,
  tenantId: string,
  accountSetId: string,
  accountNumber: string,
): Promise<BankAccountBinding | null> {
  const row = await service.querySingleAsync<BankAccountBindingRow>(
    `SELECT * FROM bank_account_bindings WHERE accountNumber = ? AND tenantId = ? AND accountSetId = ?`,
    [accountNumber, tenantId, accountSetId],
  );
  return row ? mapBankAccountBindingRow(row) : null;
}
