import type { Partner } from '../../../types';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';

export interface PartnerRow {
  id: string;
  code: string;
  name: string;
  type: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNo: string | null;
  bankAccount: string | null;
  bankName: string | null;
  idType: string | null;
  idNumber: string | null;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  defaultSubjectCode: string | null;
  defaultSubjectName: string | null;
  defaultCurrency: string | null;
  openingForeignBalance: number | string | null;
  openingExchangeRate: number | string | null;
  departmentCode: string | null;
  departmentName: string | null;
  paymentTermDays: number | string | null;
  openingBalance: number | string | null;
  payrollSalaryExpenseSubjectCode: string | null;
  payrollSalaryExpenseSubjectName: string | null;
  payrollContributionExpenseSubjectCode: string | null;
  payrollContributionExpenseSubjectName: string | null;
  payrollSalaryPayableSubjectCode: string | null;
  payrollSalaryPayableSubjectName: string | null;
  payrollTaxPayableSubjectCode: string | null;
  payrollTaxPayableSubjectName: string | null;
  payrollEmployeeContributionPayableSubjectCode: string | null;
  payrollEmployeeContributionPayableSubjectName: string | null;
  payrollEmployerContributionPayableSubjectCode: string | null;
  payrollEmployerContributionPayableSubjectName: string | null;
  payrollDepartmentName: string | null;
  payrollProjectName: string | null;
  payrollCostCenterName: string | null;
  enabled: number | boolean | null;
  createTime: string;
  updateTime: string;
  tenantId: string;
  accountSetId: string;
}

export interface PartnerInsertInput {
  id: string;
  name: string;
  code: string;
  type?: string;
  isSupplier?: boolean;
  isCustomer?: boolean;
  isEmployee?: boolean;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNo?: string;
  bankAccount?: string;
  bankName?: string;
  idType?: string;
  idNumber?: string;
  employmentStartDate?: string;
  employmentEndDate?: string;
  defaultSubjectCode?: string;
  defaultSubjectName?: string;
  defaultCurrency?: string;
  openingForeignBalance?: number;
  openingExchangeRate?: number;
  departmentCode?: string;
  departmentName?: string;
  paymentTermDays?: number;
  openingBalance?: number;
  payrollSalaryExpenseSubjectCode?: string;
  payrollSalaryExpenseSubjectName?: string;
  payrollContributionExpenseSubjectCode?: string;
  payrollContributionExpenseSubjectName?: string;
  payrollSalaryPayableSubjectCode?: string;
  payrollSalaryPayableSubjectName?: string;
  payrollTaxPayableSubjectCode?: string;
  payrollTaxPayableSubjectName?: string;
  payrollEmployeeContributionPayableSubjectCode?: string;
  payrollEmployeeContributionPayableSubjectName?: string;
  payrollEmployerContributionPayableSubjectCode?: string;
  payrollEmployerContributionPayableSubjectName?: string;
  payrollDepartmentName?: string;
  payrollProjectName?: string;
  payrollCostCenterName?: string;
  remark?: string;
  tenantId?: string;
  accountSetId?: string;
  createTime?: string;
  updateTime?: string;
}

export interface PartnerQueryService {
  queryAllAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T[]>;
  querySingleAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T | null>;
}

export interface PartnerInsert {
  sql: string;
  params: SqliteBindable[];
}

const PARTNER_INSERT_SQL = `
  INSERT OR REPLACE INTO partners (
    id, code, name, type, contact, phone, email, address, taxNo, bankAccount, enabled,
    bankName,
    idType, idNumber,
    employmentStartDate, employmentEndDate,
    defaultSubjectCode, defaultSubjectName, defaultCurrency,
    openingForeignBalance, openingExchangeRate,
    departmentCode, departmentName, paymentTermDays, openingBalance,
    payrollSalaryExpenseSubjectCode, payrollSalaryExpenseSubjectName,
    payrollContributionExpenseSubjectCode, payrollContributionExpenseSubjectName,
    payrollSalaryPayableSubjectCode, payrollSalaryPayableSubjectName,
    payrollTaxPayableSubjectCode, payrollTaxPayableSubjectName,
    payrollEmployeeContributionPayableSubjectCode, payrollEmployeeContributionPayableSubjectName,
    payrollEmployerContributionPayableSubjectCode, payrollEmployerContributionPayableSubjectName,
    payrollDepartmentName, payrollProjectName, payrollCostCenterName,
    tenantId, accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function optionalText(value: string | null | undefined): string | undefined {
  return value || undefined;
}

function text(value: string | undefined): string {
  return value || '';
}

function resolvePartnerType(partner: PartnerInsertInput): string {
  const hasExplicitRoles =
    partner.isCustomer !== undefined ||
    partner.isSupplier !== undefined ||
    partner.isEmployee !== undefined;

  if (partner.type && !hasExplicitRoles) return partner.type;

  const roles: string[] = [];
  if (partner.isCustomer) roles.push('customer');
  if (partner.isSupplier) roles.push('supplier');
  if (partner.isEmployee) roles.push('employee');
  if (roles.length === 0) return 'other';
  if (roles.length === 1) return roles[0];
  if (roles.length === 2 && roles.includes('customer') && roles.includes('supplier')) return 'both';
  return roles.join(',');
}

export function mapPartnerRow(row: PartnerRow): Partner {
  const typeStr = row.type || '';
  const typeParts = typeStr.split(',');
  const isCustomer = typeParts.includes('customer') || typeStr === 'both';
  const isSupplier = typeParts.includes('supplier') || typeStr === 'both';
  const isEmployee = typeParts.includes('employee');

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isCustomer,
    isSupplier,
    isEmployee,
    contact: row.contact || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    taxNumber: row.taxNo || '',
    bankAccount: row.bankAccount || '',
    bankName: row.bankName || '',
    idType: optionalText(row.idType),
    idNumber: optionalText(row.idNumber),
    employmentStartDate: optionalText(row.employmentStartDate),
    employmentEndDate: optionalText(row.employmentEndDate),
    defaultSubjectCode: optionalText(row.defaultSubjectCode),
    defaultSubjectName: optionalText(row.defaultSubjectName),
    defaultCurrency: optionalText(row.defaultCurrency),
    departmentCode: optionalText(row.departmentCode),
    departmentName: optionalText(row.departmentName),
    paymentTermDays: row.paymentTermDays !== null && row.paymentTermDays !== undefined ? Number(row.paymentTermDays) : undefined,
    openingBalance: row.openingBalance !== null && row.openingBalance !== undefined ? Number(row.openingBalance) : undefined,
    openingForeignBalance: row.openingForeignBalance !== null && row.openingForeignBalance !== undefined ? Number(row.openingForeignBalance) : undefined,
    openingExchangeRate: row.openingExchangeRate !== null && row.openingExchangeRate !== undefined ? Number(row.openingExchangeRate) : undefined,
    payrollSalaryExpenseSubjectCode: optionalText(row.payrollSalaryExpenseSubjectCode),
    payrollSalaryExpenseSubjectName: optionalText(row.payrollSalaryExpenseSubjectName),
    payrollContributionExpenseSubjectCode: optionalText(row.payrollContributionExpenseSubjectCode),
    payrollContributionExpenseSubjectName: optionalText(row.payrollContributionExpenseSubjectName),
    payrollSalaryPayableSubjectCode: optionalText(row.payrollSalaryPayableSubjectCode),
    payrollSalaryPayableSubjectName: optionalText(row.payrollSalaryPayableSubjectName),
    payrollTaxPayableSubjectCode: optionalText(row.payrollTaxPayableSubjectCode),
    payrollTaxPayableSubjectName: optionalText(row.payrollTaxPayableSubjectName),
    payrollEmployeeContributionPayableSubjectCode: optionalText(row.payrollEmployeeContributionPayableSubjectCode),
    payrollEmployeeContributionPayableSubjectName: optionalText(row.payrollEmployeeContributionPayableSubjectName),
    payrollEmployerContributionPayableSubjectCode: optionalText(row.payrollEmployerContributionPayableSubjectCode),
    payrollEmployerContributionPayableSubjectName: optionalText(row.payrollEmployerContributionPayableSubjectName),
    payrollDepartmentName: optionalText(row.payrollDepartmentName),
    payrollProjectName: optionalText(row.payrollProjectName),
    payrollCostCenterName: optionalText(row.payrollCostCenterName),
    frozen: row.enabled === 0,
    createTime: row.createTime,
    updateTime: row.updateTime,
    accountSetId: row.accountSetId,
  };
}

export function buildPartnerInsert(
  partner: PartnerInsertInput,
  defaultTenantId: string,
  defaultAccountSetId: string,
  now: string,
): PartnerInsert {
  const tenantId = partner.tenantId || defaultTenantId;
  const accountSetId = partner.accountSetId || defaultAccountSetId;
  return {
    sql: PARTNER_INSERT_SQL,
    params: [
      partner.id,
      partner.code,
      partner.name,
      resolvePartnerType(partner),
      text(partner.contact),
      text(partner.phone),
      text(partner.email),
      text(partner.address),
      text(partner.taxNo),
      text(partner.bankAccount),
      1,
      text(partner.bankName),
      text(partner.idType),
      text(partner.idNumber),
      text(partner.employmentStartDate),
      text(partner.employmentEndDate),
      text(partner.defaultSubjectCode),
      text(partner.defaultSubjectName),
      text(partner.defaultCurrency),
      partner.openingForeignBalance || null,
      partner.openingExchangeRate || null,
      text(partner.departmentCode),
      text(partner.departmentName),
      partner.paymentTermDays || null,
      partner.openingBalance || 0,
      text(partner.payrollSalaryExpenseSubjectCode),
      text(partner.payrollSalaryExpenseSubjectName),
      text(partner.payrollContributionExpenseSubjectCode),
      text(partner.payrollContributionExpenseSubjectName),
      text(partner.payrollSalaryPayableSubjectCode),
      text(partner.payrollSalaryPayableSubjectName),
      text(partner.payrollTaxPayableSubjectCode),
      text(partner.payrollTaxPayableSubjectName),
      text(partner.payrollEmployeeContributionPayableSubjectCode),
      text(partner.payrollEmployeeContributionPayableSubjectName),
      text(partner.payrollEmployerContributionPayableSubjectCode),
      text(partner.payrollEmployerContributionPayableSubjectName),
      text(partner.payrollDepartmentName),
      text(partner.payrollProjectName),
      text(partner.payrollCostCenterName),
      tenantId,
      accountSetId,
      partner.createTime || now,
      partner.updateTime || now,
    ],
  };
}

export async function listPartners(
  service: PartnerQueryService,
  tenantId: string,
  accountSetId: string,
): Promise<Partner[]> {
  const rows = await service.queryAllAsync<PartnerRow>(
    `SELECT * FROM partners WHERE tenantId = ? AND accountSetId = ? ORDER BY code`,
    [tenantId, accountSetId],
  );
  return rows.map(mapPartnerRow);
}

export async function findPartnerByCode(
  service: PartnerQueryService,
  tenantId: string,
  accountSetId: string,
  code: string,
): Promise<Partner | undefined> {
  const row = await service.querySingleAsync<PartnerRow>(
    `SELECT * FROM partners WHERE tenantId = ? AND accountSetId = ? AND code = ?`,
    [tenantId, accountSetId, code],
  );
  return row ? mapPartnerRow(row) : undefined;
}

export async function findPartnerByName(
  service: PartnerQueryService,
  tenantId: string,
  accountSetId: string,
  name: string,
): Promise<Partner | undefined> {
  const row = await service.querySingleAsync<PartnerRow>(
    `SELECT * FROM partners WHERE tenantId = ? AND accountSetId = ? AND name = ?`,
    [tenantId, accountSetId, name],
  );
  return row ? mapPartnerRow(row) : undefined;
}

export interface MergeResult {
  vouchersUpdated: number;
  invoicesUpdated: number;
  mappingsUpdated: number;
}

export interface PartnerMergePreview {
  vouchers: number;
  invoices: number;
  mappings: number;
}

export async function previewPartnerMerge(
  service: PartnerQueryService,
  tenantId: string,
  accountSetId: string,
  name: string,
): Promise<PartnerMergePreview> {
  const voucherRow = await service.querySingleAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM entries
     WHERE tenantId = ? AND accountSetId = ? AND (
       customerName = ? OR supplierName = ? OR auxiliary LIKE ?
     )`,
    [tenantId, accountSetId, name, name, `%${name}%`],
  );
  const invoiceRow = await service.querySingleAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM invoices
     WHERE tenantId = ? AND accountSetId = ? AND (sellerName = ? OR buyerName = ?)`,
    [tenantId, accountSetId, name, name],
  );
  const mappingRow = await service.querySingleAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM supplier_subject_mapping
     WHERE tenantId = ? AND accountSetId = ? AND sellerName = ?`,
    [tenantId, accountSetId, name],
  );
  return {
    vouchers: voucherRow?.cnt ?? 0,
    invoices: invoiceRow?.cnt ?? 0,
    mappings: mappingRow?.cnt ?? 0,
  };
}

function replaceNameInAuxiliaryJson(jsonStr: string, fromName: string, toName: string): string {
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    const walk = (value: unknown): unknown => {
      if (typeof value === 'string') return value === fromName ? toName : value;
      if (Array.isArray(value)) return value.map(walk);
      if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>)) {
          out[key] = walk((value as Record<string, unknown>)[key]);
        }
        return out;
      }
      return value;
    };
    return JSON.stringify(walk(parsed));
  } catch {
    return jsonStr.split(fromName).join(toName);
  }
}

export async function mergePartnerRecords(input: {
  db: SqliteDatabaseLike & { getRowsModified(): number };
  queryService: PartnerQueryService;
  tenantId: string;
  accountSetId: string;
  fromName: string;
  toName: string;
  persist: () => Promise<void>;
}): Promise<MergeResult> {
  const { db, queryService, tenantId, accountSetId, fromName, toName } = input;
  if (fromName === toName) {
    return { vouchersUpdated: 0, invoicesUpdated: 0, mappingsUpdated: 0 };
  }

  const targetPartner = await queryService.querySingleAsync<{ id: string }>(
    `SELECT id FROM partners WHERE tenantId = ? AND accountSetId = ? AND name = ? LIMIT 1`,
    [tenantId, accountSetId, toName],
  );
  const targetPartnerId = targetPartner?.id ?? null;

  let runStmt = db.prepare(
    `UPDATE entries SET customerName = ?, partnerId = ? WHERE tenantId = ? AND accountSetId = ? AND customerName = ?`,
  );
  let entriesTouched = 0;
  try {
    runStmt.run([toName, targetPartnerId ?? '', tenantId, accountSetId, fromName]);
  } finally {
    runStmt.free();
  }
  entriesTouched += db.getRowsModified();

  runStmt = db.prepare(
    `UPDATE entries SET supplierName = ?, partnerId = ? WHERE tenantId = ? AND accountSetId = ? AND supplierName = ?`,
  );
  try {
    runStmt.run([toName, targetPartnerId ?? '', tenantId, accountSetId, fromName]);
  } finally {
    runStmt.free();
  }
  entriesTouched += db.getRowsModified();

  const auxRows = await queryService.queryAllAsync<{ id: string; auxiliary: string | null }>(
    `SELECT id, auxiliary FROM entries WHERE tenantId = ? AND accountSetId = ? AND auxiliary LIKE ?`,
    [tenantId, accountSetId, `%${fromName}%`],
  );
  for (const row of auxRows) {
    if (!row.auxiliary) continue;
    const replaced = replaceNameInAuxiliaryJson(row.auxiliary, fromName, toName);
    if (replaced === row.auxiliary) continue;
    const upd = db.prepare(`UPDATE entries SET auxiliary = ? WHERE id = ?`);
    try {
      upd.run([replaced, row.id]);
    } finally {
      upd.free();
    }
    entriesTouched += 1;
  }

  let invoicesUpdated = 0;
  runStmt = db.prepare(
    `UPDATE invoices SET sellerName = ? WHERE tenantId = ? AND accountSetId = ? AND sellerName = ?`,
  );
  try {
    runStmt.run([toName, tenantId, accountSetId, fromName]);
  } finally {
    runStmt.free();
  }
  invoicesUpdated += db.getRowsModified();

  runStmt = db.prepare(
    `UPDATE invoices SET buyerName = ? WHERE tenantId = ? AND accountSetId = ? AND buyerName = ?`,
  );
  try {
    runStmt.run([toName, tenantId, accountSetId, fromName]);
  } finally {
    runStmt.free();
  }
  invoicesUpdated += db.getRowsModified();

  runStmt = db.prepare(
    `UPDATE supplier_subject_mapping SET sellerName = ? WHERE tenantId = ? AND accountSetId = ? AND sellerName = ?`,
  );
  try {
    runStmt.run([toName, tenantId, accountSetId, fromName]);
  } finally {
    runStmt.free();
  }
  const mappingsUpdated = db.getRowsModified();

  await input.persist();

  return {
    vouchersUpdated: entriesTouched,
    invoicesUpdated,
    mappingsUpdated,
  };
}

export async function insertPartnerRecord(input: {
  db: SqliteDatabaseLike;
  partner: PartnerInsertInput;
  tenantId: string;
  accountSetId: string;
  now: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const insert = buildPartnerInsert(input.partner, input.tenantId, input.accountSetId, input.now);
  const stmt = input.db.prepare(insert.sql);
  try {
    stmt.run(insert.params);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function savePartnersRecord(input: {
  db: SqliteDatabaseLike;
  partners: Partner[];
  tenantId: string;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const deleteStmt = input.db.prepare(
    `DELETE FROM partners WHERE tenantId = ? AND accountSetId = ?`,
  );
  try {
    deleteStmt.run([input.tenantId, input.accountSetId]);
  } finally {
    deleteStmt.free();
  }

  for (const partner of input.partners) {
    const insertInput: PartnerInsertInput = {
      id: partner.id,
      code: partner.code,
      name: partner.name,
      isCustomer: partner.isCustomer,
      isSupplier: partner.isSupplier,
      isEmployee: partner.isEmployee,
      contact: partner.contact,
      phone: partner.phone,
      email: partner.email,
      address: partner.address,
      taxNo: partner.taxNumber,
      bankAccount: partner.bankAccount,
      bankName: partner.bankName,
      idType: partner.idType,
      idNumber: partner.idNumber,
      employmentStartDate: partner.employmentStartDate,
      employmentEndDate: partner.employmentEndDate,
      defaultSubjectCode: partner.defaultSubjectCode,
      defaultSubjectName: partner.defaultSubjectName,
      defaultCurrency: partner.defaultCurrency,
      openingForeignBalance: partner.openingForeignBalance,
      openingExchangeRate: partner.openingExchangeRate,
      departmentCode: partner.departmentCode,
      departmentName: partner.departmentName,
      paymentTermDays: partner.paymentTermDays,
      openingBalance: partner.openingBalance,
      payrollSalaryExpenseSubjectCode: partner.payrollSalaryExpenseSubjectCode,
      payrollSalaryExpenseSubjectName: partner.payrollSalaryExpenseSubjectName,
      payrollContributionExpenseSubjectCode: partner.payrollContributionExpenseSubjectCode,
      payrollContributionExpenseSubjectName: partner.payrollContributionExpenseSubjectName,
      payrollSalaryPayableSubjectCode: partner.payrollSalaryPayableSubjectCode,
      payrollSalaryPayableSubjectName: partner.payrollSalaryPayableSubjectName,
      payrollTaxPayableSubjectCode: partner.payrollTaxPayableSubjectCode,
      payrollTaxPayableSubjectName: partner.payrollTaxPayableSubjectName,
      payrollEmployeeContributionPayableSubjectCode: partner.payrollEmployeeContributionPayableSubjectCode,
      payrollEmployeeContributionPayableSubjectName: partner.payrollEmployeeContributionPayableSubjectName,
      payrollEmployerContributionPayableSubjectCode: partner.payrollEmployerContributionPayableSubjectCode,
      payrollEmployerContributionPayableSubjectName: partner.payrollEmployerContributionPayableSubjectName,
      payrollDepartmentName: partner.payrollDepartmentName,
      payrollProjectName: partner.payrollProjectName,
      payrollCostCenterName: partner.payrollCostCenterName,
      tenantId: input.tenantId,
      accountSetId: input.accountSetId,
      createTime: partner.createTime || now,
      updateTime: now,
    };
    const insert = buildPartnerInsert(insertInput, input.tenantId, input.accountSetId, now);
    const stmt = input.db.prepare(insert.sql);
    try {
      stmt.run(insert.params);
    } finally {
      stmt.free();
    }
  }
  await input.persist();
}
