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

export interface PayrollVoucherDefaultSubjects {
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
}

interface PayrollVoucherSubjects {
  salaryExpense: { code: string; name: string };
  contributionExpense: { code: string; name: string };
  salaryPayable: { code: string; name: string };
  taxPayable: { code: string; name: string };
  employeeContributionPayable: { code: string; name: string };
  employerContributionPayable: { code: string; name: string };
}

const SUBJECTS = {
  salaryExpense: { code: '660201', name: '管理费用-工资' },
  contributionExpense: { code: '660202', name: '管理费用-社保' },
  salaryPayable: { code: '2151', name: '应付职工薪酬' },
  taxPayable: { code: '222102', name: '应交税费-个税' },
  employeeContributionPayable: { code: '220101', name: '其他应付款-个人社保' },
  employerContributionPayable: { code: '220102', name: '其他应付款-公司付社保' },
};

function addAmount(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, roundMoney((map.get(key) || 0) + amount));
}

function departmentKey(name: string | undefined): string {
  return name?.trim() || '';
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

export function resolvePayrollVoucherSubjects(
  item: PayrollItem,
  employeeByCode: Map<string, Partner>,
  defaultSubjects: PayrollVoucherDefaultSubjects = {},
): PayrollVoucherSubjects {
  const employee = employeeByCode.get(item.employeeCode);
  return {
    salaryExpense: subjectOrFallback(
      item.inputData.payrollSalaryExpenseSubjectCode,
      item.inputData.payrollSalaryExpenseSubjectName,
      subjectOrFallback(
        employee?.payrollSalaryExpenseSubjectCode,
        employee?.payrollSalaryExpenseSubjectName,
        subjectOrFallback(
          defaultSubjects.payrollSalaryExpenseSubjectCode,
          defaultSubjects.payrollSalaryExpenseSubjectName,
          SUBJECTS.salaryExpense,
        ),
      ),
    ),
    contributionExpense: subjectOrFallback(
      item.inputData.payrollContributionExpenseSubjectCode,
      item.inputData.payrollContributionExpenseSubjectName,
      subjectOrFallback(
        employee?.payrollContributionExpenseSubjectCode,
        employee?.payrollContributionExpenseSubjectName,
        subjectOrFallback(
          defaultSubjects.payrollContributionExpenseSubjectCode,
          defaultSubjects.payrollContributionExpenseSubjectName,
          SUBJECTS.contributionExpense,
        ),
      ),
    ),
    salaryPayable: subjectOrFallback(
      item.inputData.payrollSalaryPayableSubjectCode,
      item.inputData.payrollSalaryPayableSubjectName,
      subjectOrFallback(
        employee?.payrollSalaryPayableSubjectCode,
        employee?.payrollSalaryPayableSubjectName,
        subjectOrFallback(
          defaultSubjects.payrollSalaryPayableSubjectCode,
          defaultSubjects.payrollSalaryPayableSubjectName,
          SUBJECTS.salaryPayable,
        ),
      ),
    ),
    taxPayable: subjectOrFallback(
      item.inputData.payrollTaxPayableSubjectCode,
      item.inputData.payrollTaxPayableSubjectName,
      subjectOrFallback(
        employee?.payrollTaxPayableSubjectCode,
        employee?.payrollTaxPayableSubjectName,
        subjectOrFallback(
          defaultSubjects.payrollTaxPayableSubjectCode,
          defaultSubjects.payrollTaxPayableSubjectName,
          SUBJECTS.taxPayable,
        ),
      ),
    ),
    employeeContributionPayable: subjectOrFallback(
      item.inputData.payrollEmployeeContributionPayableSubjectCode,
      item.inputData.payrollEmployeeContributionPayableSubjectName,
      subjectOrFallback(
        employee?.payrollEmployeeContributionPayableSubjectCode,
        employee?.payrollEmployeeContributionPayableSubjectName,
        subjectOrFallback(
          defaultSubjects.payrollEmployeeContributionPayableSubjectCode,
          defaultSubjects.payrollEmployeeContributionPayableSubjectName,
          SUBJECTS.employeeContributionPayable,
        ),
      ),
    ),
    employerContributionPayable: subjectOrFallback(
      item.inputData.payrollEmployerContributionPayableSubjectCode,
      item.inputData.payrollEmployerContributionPayableSubjectName,
      subjectOrFallback(
        employee?.payrollEmployerContributionPayableSubjectCode,
        employee?.payrollEmployerContributionPayableSubjectName,
        subjectOrFallback(
          defaultSubjects.payrollEmployerContributionPayableSubjectCode,
          defaultSubjects.payrollEmployerContributionPayableSubjectName,
          SUBJECTS.employerContributionPayable,
        ),
      ),
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
  defaultSubjects: PayrollVoucherDefaultSubjects = {},
): PayrollVoucherEntryPreview[] {
  const salaryDebitMap = new Map<string, number>();
  const contributionDebitMap = new Map<string, number>();
  const salaryPayableMap = new Map<string, number>();
  const employerContributionPayableMap = new Map<string, number>();
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
    const subjects = resolvePayrollVoucherSubjects(item, employeeByCode, defaultSubjects);
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
      result.netSalary,
    );
    addAmount(
      employerContributionPayableMap,
      makeCreditKey(subjects.employerContributionPayable.code, subjects.employerContributionPayable.name),
      employerContribution,
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
      summary: `${period} 应付员工实发工资`,
      subjectCode,
      subjectName,
      debit: 0,
      credit: amount,
    });
  });

  employerContributionPayableMap.forEach((amount, key) => {
    if (amount <= 0) return;
    const [subjectCode, subjectName] = key.split('|');
    entries.push({
      summary: `${period} 代提公司社保公积金`,
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
