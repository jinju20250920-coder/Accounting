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
  idType: string | null;
  idNumber: string | null;
  defaultSubjectCode?: string | null;
  defaultSubjectName?: string | null;
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
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNo?: string;
  bankAccount?: string;
  idType?: string;
  idNumber?: string;
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
    idType, idNumber,
    departmentCode, departmentName, paymentTermDays, openingBalance,
    payrollSalaryExpenseSubjectCode, payrollSalaryExpenseSubjectName,
    payrollContributionExpenseSubjectCode, payrollContributionExpenseSubjectName,
    payrollSalaryPayableSubjectCode, payrollSalaryPayableSubjectName,
    payrollTaxPayableSubjectCode, payrollTaxPayableSubjectName,
    payrollEmployeeContributionPayableSubjectCode, payrollEmployeeContributionPayableSubjectName,
    payrollEmployerContributionPayableSubjectCode, payrollEmployerContributionPayableSubjectName,
    payrollDepartmentName, payrollProjectName, payrollCostCenterName,
    accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function optionalText(value: string | null | undefined): string | undefined {
  return value || undefined;
}

function text(value: string | undefined): string {
  return value || '';
}

function resolvePartnerType(partner: PartnerInsertInput): string {
  if (partner.type) return partner.type;
  if (partner.isSupplier && partner.isCustomer) return 'both';
  if (partner.isSupplier) return 'supplier';
  if (partner.isCustomer) return 'customer';
  return 'other';
}

export function mapPartnerRow(row: PartnerRow): Partner {
  const isCustomer = row.type === 'customer' || row.type === 'both';
  const isSupplier = row.type === 'supplier' || row.type === 'both';
  const isEmployee = row.type === 'employee';

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
    idType: optionalText(row.idType),
    idNumber: optionalText(row.idNumber),
    defaultSubjectCode: optionalText(row.defaultSubjectCode),
    defaultSubjectName: optionalText(row.defaultSubjectName),
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
      text(partner.idType),
      text(partner.idNumber),
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
  for (const partner of input.partners) {
    const insertInput: PartnerInsertInput = {
      id: partner.id,
      code: partner.code,
      name: partner.name,
      isCustomer: partner.isCustomer,
      isSupplier: partner.isSupplier,
      contact: partner.contact,
      phone: partner.phone,
      email: partner.email,
      address: partner.address,
      taxNo: partner.taxNumber,
      bankAccount: partner.bankAccount,
      idType: partner.idType,
      idNumber: partner.idNumber,
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
      createTime: now,
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
