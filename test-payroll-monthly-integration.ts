import assert from 'node:assert/strict';

import {
  buildMonthlyClosingSummary,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
} from './src/lib/monthly-closing-checks';
import {
  calculatePayrollItem,
  createBlankPayrollCalculationConfig,
  createBlankPayrollInput,
} from './src/lib/payroll';
import { buildPayrollAccrualVoucherPreview } from './src/lib/payroll-voucher';

const salaryCheck = DEFAULT_MONTHLY_CLOSING_TEMPLATES.find((item) => item.code === 'payroll_salary_tax');
const socialCheck = DEFAULT_MONTHLY_CLOSING_TEMPLATES.find((item) => item.code === 'payroll_social_fund');
assert.equal(salaryCheck?.route, '/payroll');
assert.equal(socialCheck?.route, '/payroll');

const summary = buildMonthlyClosingSummary({
  period: '2026-05',
  vouchers: [],
  payrollBatches: [{
    status: 'confirmed',
    taxTotal: 230,
    includesSocialFundCalculation: true,
  }],
});
const salaryEvidence = summary.items.find((item) => item.code === 'payroll_salary_tax');
const socialEvidence = summary.items.find((item) => item.code === 'payroll_social_fund');
assert.equal(salaryEvidence?.systemStatus, 'warning');
assert.match(salaryEvidence?.systemMessage || '', /工资计算批次/);
assert.match(socialEvidence?.systemMessage || '', /社保、公积金计算结果/);

const annualBonusConfig = createBlankPayrollCalculationConfig();
const annualBonusResult = calculatePayrollItem({
  ...createBlankPayrollInput(),
  employeeCode: 'EMP-BONUS',
  employeeName: 'Annual Bonus Employee',
  incomeType: 'annual_bonus',
  annualBonusTaxMethod: 'separate',
  bonus: 120000,
}, annualBonusConfig, 12);
assert.equal(annualBonusResult.grossSalary, 120000);
assert.equal(annualBonusResult.individualIncomeTax, 11790);
assert.equal(annualBonusResult.taxCalculationType, 'annual_bonus_separate');

const salaryPreview = buildPayrollAccrualVoucherPreview([{
  id: 'item-voucher-1',
  batchId: 'batch-voucher-1',
  accountSetId: 'as-1',
  payrollPeriod: '2026-05',
  employeeCode: 'EMP-RD',
  employeeName: 'R&D Employee',
  departmentName: 'R&D',
  inputData: {
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-RD',
    employeeName: 'R&D Employee',
    basicSalary: 10000,
    payrollSalaryExpenseSubjectCode: '660401',
    payrollSalaryExpenseSubjectName: '研发费用-工资',
  },
  calculationResult: calculatePayrollItem({
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-RD',
    employeeName: 'R&D Employee',
    basicSalary: 10000,
  }, createBlankPayrollCalculationConfig(), 5),
  validationStatus: 'valid',
  validationMessages: [],
  createdAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
}], '2026-05', [{
  id: 'partner-rd',
  code: 'EMP-RD',
  name: 'R&D Employee',
  isCustomer: false,
  isSupplier: false,
  isEmployee: true,
  payrollSalaryExpenseSubjectCode: '660401',
  payrollSalaryExpenseSubjectName: '研发费用-工资',
  frozen: false,
  createTime: '2026-05-29T00:00:00.000Z',
  updateTime: '2026-05-29T00:00:00.000Z',
}], {
  payrollSalaryExpenseSubjectCode: '660299',
  payrollSalaryExpenseSubjectName: '管理费用-工资默认',
});
assert(salaryPreview.some((entry) => entry.subjectCode === '660401'));

const accountSetFallbackPreview = buildPayrollAccrualVoucherPreview([{
  id: 'item-voucher-2',
  batchId: 'batch-voucher-2',
  accountSetId: 'as-1',
  payrollPeriod: '2026-05',
  employeeCode: 'EMP-DEFAULT',
  employeeName: 'Default Subject Employee',
  departmentName: 'Sales',
  inputData: {
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-DEFAULT',
    employeeName: 'Default Subject Employee',
    basicSalary: 8000,
  },
  calculationResult: calculatePayrollItem({
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-DEFAULT',
    employeeName: 'Default Subject Employee',
    basicSalary: 8000,
  }, createBlankPayrollCalculationConfig(), 5),
  validationStatus: 'valid',
  validationMessages: [],
  createdAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
}], '2026-05', [], {
  payrollSalaryExpenseSubjectCode: '660299',
  payrollSalaryExpenseSubjectName: '管理费用-工资默认',
});
assert(accountSetFallbackPreview.some((entry) => entry.subjectCode === '660299'));

console.log('payroll monthly integration tests passed');
