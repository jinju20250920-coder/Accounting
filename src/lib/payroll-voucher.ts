import { roundMoney, type PayrollItem } from './payroll';
import type { Partner, VoucherEntry } from '../types';

export interface PayrollVoucherEntryPreview {
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
  departmentName?: string;
}

interface PayrollVoucherSubjects {
  salaryExpense: { code: string; name: string };
  contributionExpense: { code: string; name: string };
  salaryPayable: { code: string; name: string };
  taxPayable: { code: string; name: string };
  employeeContributionPayable: { code: string; name: string };
}

const SUBJECTS = {
  salaryExpense: { code: '660201', name: '管理费用-工资' },
  contributionExpense: { code: '660203', name: '管理费用-社保公积金' },
  salaryPayable: { code: '2211', name: '应付职工薪酬' },
  taxPayable: { code: '2221', name: '应交税费-个人所得税' },
  employeeContributionPayable: { code: '2241', name: '其他应付款-个人社保公积金' },
};

function addAmount(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, roundMoney((map.get(key) || 0) + amount));
}

function departmentKey(name: string | undefined): string {
  return name?.trim() || '未分部门';
}

function subjectOrFallback(
  code: string | undefined,
  name: string | undefined,
  fallback: { code: string; name: string },
): { code: string; name: string } {
  return code?.trim()
    ? { code, name: name?.trim() || fallback.name }
    : fallback;
}

export function resolvePayrollVoucherSubjects(item: PayrollItem, employeeByCode: Map<string, Partner>): PayrollVoucherSubjects {
  const employee = employeeByCode.get(item.employeeCode);
  return {
    salaryExpense: subjectOrFallback(employee?.payrollSalaryExpenseSubjectCode, employee?.payrollSalaryExpenseSubjectName, SUBJECTS.salaryExpense),
    contributionExpense: subjectOrFallback(employee?.payrollContributionExpenseSubjectCode, employee?.payrollContributionExpenseSubjectName, SUBJECTS.contributionExpense),
    salaryPayable: subjectOrFallback(employee?.payrollSalaryPayableSubjectCode, employee?.payrollSalaryPayableSubjectName, SUBJECTS.salaryPayable),
    taxPayable: subjectOrFallback(employee?.payrollTaxPayableSubjectCode, employee?.payrollTaxPayableSubjectName, SUBJECTS.taxPayable),
    employeeContributionPayable: subjectOrFallback(
      employee?.payrollEmployeeContributionPayableSubjectCode,
      employee?.payrollEmployeeContributionPayableSubjectName,
      SUBJECTS.employeeContributionPayable,
    ),
  };
}

function makeDebitKey(subjectCode: string, subjectName: string, departmentName: string): string {
  return `${subjectCode}|${subjectName}|${departmentName}`;
}

function makeCreditKey(subjectCode: string, subjectName: string): string {
  return `${subjectCode}|${subjectName}`;
}

export function buildPayrollAccrualVoucherPreview(
  items: PayrollItem[],
  period: string,
  employees: Partner[] = [],
): PayrollVoucherEntryPreview[] {
  const salaryDebitMap = new Map<string, number>();
  const contributionDebitMap = new Map<string, number>();
  const salaryPayableMap = new Map<string, number>();
  const taxPayableMap = new Map<string, number>();
  const employeeContributionPayableMap = new Map<string, number>();
  const employeeByCode = new Map(
    employees
      .filter((employee) => employee.isEmployee)
      .map((employee) => [employee.code, employee] as const),
  );

  items.forEach((item) => {
    const result = item.calculationResult;
    const departmentName = departmentKey(result.departmentName);
    const subjects = resolvePayrollVoucherSubjects(item, employeeByCode);
    const employerContribution = roundMoney(result.employerSocialInsurance + result.employerHousingFund);
    const employeeContribution = roundMoney(
      result.employeeSocialInsurance + result.employeeHousingFund + (item.inputData.otherPostTaxDeduction || 0),
    );

    addAmount(
      salaryDebitMap,
      makeDebitKey(subjects.salaryExpense.code, subjects.salaryExpense.name, departmentName),
      result.grossSalary,
    );
    addAmount(
      contributionDebitMap,
      makeDebitKey(subjects.contributionExpense.code, subjects.contributionExpense.name, departmentName),
      employerContribution,
    );
    addAmount(
      salaryPayableMap,
      makeCreditKey(subjects.salaryPayable.code, subjects.salaryPayable.name),
      roundMoney(result.netSalary + employerContribution),
    );
    addAmount(
      taxPayableMap,
      makeCreditKey(subjects.taxPayable.code, subjects.taxPayable.name),
      result.individualIncomeTax,
    );
    addAmount(
      employeeContributionPayableMap,
      makeCreditKey(subjects.employeeContributionPayable.code, subjects.employeeContributionPayable.name),
      employeeContribution,
    );
  });

  const entries: PayrollVoucherEntryPreview[] = [];

  salaryDebitMap.forEach((amount, key) => {
    if (amount <= 0) return;
    const [subjectCode, subjectName, departmentName] = key.split('|');
    entries.push({
      summary: `${period} 计提工资`,
      subjectCode,
      subjectName,
      debit: amount,
      credit: 0,
      departmentName,
    });
  });

  contributionDebitMap.forEach((amount, key) => {
    if (amount <= 0) return;
    const [subjectCode, subjectName, departmentName] = key.split('|');
    entries.push({
      summary: `${period} 计提公司社保公积金`,
      subjectCode,
      subjectName,
      debit: amount,
      credit: 0,
      departmentName,
    });
  });

  salaryPayableMap.forEach((amount, key) => {
    if (amount <= 0) return;
    const [subjectCode, subjectName] = key.split('|');
    entries.push({
      summary: `${period} 应付员工实发工资及公司社保公积金`,
      subjectCode,
      subjectName,
      debit: 0,
      credit: amount,
    });
  });

  taxPayableMap.forEach((amount, key) => {
    if (amount <= 0) return;
    const [subjectCode, subjectName] = key.split('|');
    entries.push({
      summary: `${period} 代扣代缴个人所得税`,
      subjectCode,
      subjectName,
      debit: 0,
      credit: amount,
    });
  });

  employeeContributionPayableMap.forEach((amount, key) => {
    if (amount <= 0) return;
    const [subjectCode, subjectName] = key.split('|');
    entries.push({
      summary: `${period} 代扣个人社保公积金及其他扣款`,
      subjectCode,
      subjectName,
      debit: 0,
      credit: amount,
    });
  });

  return entries;
}

export function previewToVoucherEntries(
  previewEntries: PayrollVoucherEntryPreview[],
  voucherId: string,
  date: string,
): VoucherEntry[] {
  return previewEntries.map((entry, index) => ({
    id: `entry_${voucherId}_${index}`,
    voucherId,
    date,
    summary: entry.summary,
    subjectCode: entry.subjectCode,
    subjectName: entry.subjectName,
    debit: entry.debit,
    credit: entry.credit,
    auxiliary: entry.departmentName ? { department: entry.departmentName } : {},
  }));
}
