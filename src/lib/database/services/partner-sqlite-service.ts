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
    departmentCode, departmentName, paymentTermDays, openingBalance,
    payrollSalaryExpenseSubjectCode, payrollSalaryExpenseSubjectName,
    payrollContributionExpenseSubjectCode, payrollContributionExpenseSubjectName,
    payrollSalaryPayableSubjectCode, payrollSalaryPayableSubjectName,
    payrollTaxPayableSubjectCode, payrollTaxPayableSubjectName,
    payrollEmployeeContributionPayableSubjectCode, payrollEmployeeContributionPayableSubjectName,
    payrollEmployerContributionPayableSubjectCode, payrollEmployerContributionPayableSubjectName,
    payrollDepartmentName, payrollProjectName, payrollCostCenterName,
    accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

export function buildPartnerInsert(partner: PartnerInsertInput, defaultAccountSetId: string, now: string): PartnerInsert {
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
      accountSetId,
      partner.createTime || now,
      partner.updateTime || now,
    ],
  };
}

export async function listPartners(service: PartnerQueryService, accountSetId: string): Promise<Partner[]> {
  const rows = await service.queryAllAsync<PartnerRow>(
    `SELECT * FROM partners WHERE accountSetId = ? ORDER BY code`,
    [accountSetId],
  );
  return rows.map(mapPartnerRow);
}

export async function findPartnerByCode(
  service: PartnerQueryService,
  accountSetId: string,
  code: string,
): Promise<Partner | undefined> {
  const row = await service.querySingleAsync<PartnerRow>(
    `SELECT * FROM partners WHERE accountSetId = ? AND code = ?`,
    [accountSetId, code],
  );
  return row ? mapPartnerRow(row) : undefined;
}

export async function findPartnerByName(
  service: PartnerQueryService,
  accountSetId: string,
  name: string,
): Promise<Partner | undefined> {
  const row = await service.querySingleAsync<PartnerRow>(
    `SELECT * FROM partners WHERE accountSetId = ? AND name = ?`,
    [accountSetId, name],
  );
  return row ? mapPartnerRow(row) : undefined;
}

export async function insertPartnerRecord(input: {
  db: SqliteDatabaseLike;
  partner: PartnerInsertInput;
  accountSetId: string;
  now: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const insert = buildPartnerInsert(input.partner, input.accountSetId, input.now);
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
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const deleteStmt = input.db.prepare(`DELETE FROM partners WHERE accountSetId = ?`);
  try {
    deleteStmt.run([input.accountSetId]);
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
      accountSetId: input.accountSetId,
      createTime: partner.createTime || now,
      updateTime: now,
    };
    const insert = buildPartnerInsert(insertInput, input.accountSetId, now);
    const stmt = input.db.prepare(insert.sql);
    try {
      stmt.run(insert.params);
    } finally {
      stmt.free();
    }
  }
  await input.persist();
}
