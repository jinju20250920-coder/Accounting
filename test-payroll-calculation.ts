import assert from 'node:assert/strict';
import {
  applyPriorCumulativeValues,
  calculatePayrollItem,
  clampContributionBase,
  createBlankPayrollCalculationConfig,
  DEFAULT_CUMULATIVE_TAX_CONFIG,
  roundMoney,
  summarizePayrollResults,
  type PayrollCalculationConfig,
} from './src/lib/payroll';
import { buildPayrollAccrualVoucherPreview } from './src/lib/payroll-voucher';

const config: PayrollCalculationConfig = {
  socialInsurance: {
    pension: { enabled: true, employeeRate: 0.08, employerRate: 0.16 },
    medical: { enabled: true, employeeRate: 0.02, employerRate: 0.1 },
    unemployment: { enabled: true, employeeRate: 0.005, employerRate: 0.005 },
    injury: { enabled: false, employeeRate: 0, employerRate: 0 },
    maternity: { enabled: false, employeeRate: 0, employerRate: 0 },
    supplementaryMedical: { enabled: false, employeeRate: 0, employerRate: 0 },
    minimumBase: 5000,
    maximumBase: 20000,
    defaultBaseMode: 'gross',
  },
  housingFund: {
    enabled: true,
    employeeRate: 0.07,
    employerRate: 0.07,
    minimumBase: 5000,
    maximumBase: 20000,
    defaultBaseMode: 'gross',
  },
  individualTax: DEFAULT_CUMULATIVE_TAX_CONFIG,
  taxRules: createBlankPayrollCalculationConfig().taxRules,
};

assert.equal(clampContributionBase(3000, 5000, 20000), 5000);
assert.equal(clampContributionBase(30000, 5000, 20000), 20000);

const firstEmployee = calculatePayrollItem({
  employeeCode: 'E001',
  employeeName: '张三',
  basicSalary: 15000,
  bonus: 1000,
  allowance: 500,
  otherEarnings: 0,
  leaveDeduction: 500,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 1000,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, config, 1);

assert.equal(firstEmployee.grossSalary, 16000);
assert.equal(firstEmployee.employeeSocialInsurance, 1680);
assert.equal(firstEmployee.employeeHousingFund, 1120);
assert.equal(firstEmployee.employerSocialInsurance, 4240);
assert.equal(firstEmployee.employerHousingFund, 1120);
assert.equal(firstEmployee.taxableIncomeCumulative, 7200);
assert.equal(firstEmployee.individualIncomeTax, 216);
assert.equal(firstEmployee.netSalary, 12984);
assert.equal(firstEmployee.employerTotalCost, 21360);

const higherDeductionConfig: PayrollCalculationConfig = {
  ...config,
  individualTax: {
    ...config.individualTax,
    standardDeductionPerMonth: 8000,
  },
};
const higherDeductionEmployee = calculatePayrollItem({
  employeeCode: 'E001-D',
  employeeName: 'Deduction Employee',
  basicSalary: 15000,
  bonus: 1000,
  allowance: 500,
  otherEarnings: 0,
  leaveDeduction: 500,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 1000,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, higherDeductionConfig, 1);
assert.equal(higherDeductionEmployee.taxableIncomeCumulative, 4200);
assert.equal(higherDeductionEmployee.individualIncomeTax, 126);

const topBracketConfig = createBlankPayrollCalculationConfig();
const topBracketEmployee = calculatePayrollItem({
  employeeCode: 'E007',
  employeeName: 'Top Bracket Employee',
  basicSalary: 1000000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, topBracketConfig, 1);
assert.equal(topBracketEmployee.taxableIncomeCumulative, 995000);
assert.equal(topBracketEmployee.individualIncomeTax, 265830);

const zeroBaseEmployee = calculatePayrollItem({
  employeeCode: 'E-ZERO',
  employeeName: 'Zero Base Employee',
  basicSalary: 50000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  socialInsuranceBase: 0,
  housingFundBase: 0,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, config, 1);
assert.equal(zeroBaseEmployee.socialInsuranceBase, 0);
assert.equal(zeroBaseEmployee.housingFundBase, 0);
assert.equal(zeroBaseEmployee.employeeSocialInsurance, 0);
assert.equal(zeroBaseEmployee.employeeHousingFund, 0);
assert.equal(zeroBaseEmployee.taxableIncomeCumulative, 45000);
assert.equal(zeroBaseEmployee.individualIncomeTax, 1980);

const cappedBaseConfig: PayrollCalculationConfig = {
  socialInsurance: {
    pension: { enabled: true, employeeRate: 0.08, employerRate: 0.16 },
    medical: { enabled: true, employeeRate: 0.02, employerRate: 0.1 },
    unemployment: { enabled: true, employeeRate: 0.005, employerRate: 0.005 },
    injury: { enabled: false, employeeRate: 0, employerRate: 0 },
    maternity: { enabled: false, employeeRate: 0, employerRate: 0 },
    supplementaryMedical: { enabled: false, employeeRate: 0, employerRate: 0 },
    minimumBase: 5000,
    maximumBase: 36921,
    defaultBaseMode: 'configured',
    configuredDefaultBase: 36921,
  },
  housingFund: {
    enabled: true,
    employeeRate: 0.07,
    employerRate: 0.07,
    minimumBase: 5000,
    maximumBase: 36921,
    defaultBaseMode: 'configured',
    configuredDefaultBase: 36921,
  },
  individualTax: DEFAULT_CUMULATIVE_TAX_CONFIG,
  taxRules: createBlankPayrollCalculationConfig().taxRules,
};

const lowSalaryBaseEmployee = calculatePayrollItem({
  employeeCode: 'E-LOW',
  employeeName: 'Low Salary Base Employee',
  basicSalary: 30000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, cappedBaseConfig, 1);
assert.equal(lowSalaryBaseEmployee.socialInsuranceBase, 30000);
assert.equal(lowSalaryBaseEmployee.housingFundBase, 30000);
assert.equal(lowSalaryBaseEmployee.employeeSocialInsurance, 3150);
assert.equal(lowSalaryBaseEmployee.employeeHousingFund, 2100);

const marchStartEmployee = calculatePayrollItem({
  employeeCode: 'E-MARCH',
  employeeName: 'March Start Employee',
  basicSalary: 50000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  socialInsuranceBase: 36921,
  housingFundBase: 36921,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
  priorCumulativeMonths: 1,
}, cappedBaseConfig, 3);
assert.equal(marchStartEmployee.employeeSocialInsurance, 2953.68 + 738.42 + 184.61);
assert.equal(marchStartEmployee.employeeHousingFund, 2584.47);
assert.equal(marchStartEmployee.taxableIncomeCumulative, 38538.82);
assert.equal(marchStartEmployee.individualIncomeTax, 1333.88);

const cumulativeConfig: PayrollCalculationConfig = {
  socialInsurance: {
    pension: { enabled: true, employeeRate: 0.08, employerRate: 0 },
    medical: { enabled: true, employeeRate: 0.02, employerRate: 0 },
    unemployment: { enabled: true, employeeRate: 0.005, employerRate: 0 },
    injury: { enabled: false, employeeRate: 0, employerRate: 0 },
    maternity: { enabled: false, employeeRate: 0, employerRate: 0 },
    supplementaryMedical: { enabled: false, employeeRate: 0, employerRate: 0 },
    minimumBase: 0,
    maximumBase: 100000,
    defaultBaseMode: 'gross',
  },
  housingFund: {
    enabled: true,
    employeeRate: 0.0175,
    employerRate: 0,
    minimumBase: 0,
    maximumBase: 100000,
    defaultBaseMode: 'gross',
  },
  individualTax: DEFAULT_CUMULATIVE_TAX_CONFIG,
  taxRules: createBlankPayrollCalculationConfig().taxRules,
};

const mayWithoutPriorDataEmployee = calculatePayrollItem({
  employeeCode: 'E-MAY',
  employeeName: 'May Employee',
  basicSalary: 50000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, cumulativeConfig, 5);
assert.equal(mayWithoutPriorDataEmployee.employeeSocialInsurance, 5250);
assert.equal(mayWithoutPriorDataEmployee.employeeHousingFund, 875);
assert.equal(mayWithoutPriorDataEmployee.taxableIncomeCumulative, 38875);
assert.equal(mayWithoutPriorDataEmployee.individualIncomeTax, 1367.5);
assert.equal(mayWithoutPriorDataEmployee.netSalary, 42507.5);

const firstCumulativeEmployee = calculatePayrollItem({
  employeeCode: 'E-CUM-1',
  employeeName: 'Cumulative Month One',
  basicSalary: 50000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, cumulativeConfig, 1);
assert.equal(firstCumulativeEmployee.taxableIncomeCumulative, 38875);
assert.equal(firstCumulativeEmployee.individualIncomeTax, 1367.5);

const carriedForwardInput = applyPriorCumulativeValues({
  employeeCode: 'E-CUM-2',
  employeeName: 'Cumulative Month Two',
  basicSalary: 50000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, {
  id: 'payitem-prev',
  batchId: 'paybatch-prev',
  accountSetId: 'acct-1',
  payrollPeriod: '2026-01',
  employeeCode: 'E-CUM-1',
  employeeName: 'Cumulative Month One',
  departmentName: 'Sales',
  inputData: {
    employeeCode: 'E-CUM-1',
    employeeName: 'Cumulative Month One',
    basicSalary: 50000,
    bonus: 0,
    allowance: 0,
    otherEarnings: 0,
    leaveDeduction: 0,
    otherPreTaxDeduction: 0,
    specialAdditionalDeduction: 0,
    otherLegalDeduction: 0,
    priorCumulativeIncome: 0,
    priorCumulativeEmployeeContributions: 0,
    priorCumulativeSpecialAdditionalDeduction: 0,
    priorCumulativeOtherLegalDeduction: 0,
    priorCumulativeTaxWithheld: 0,
  },
  calculationResult: firstCumulativeEmployee,
  validationStatus: 'valid',
  validationMessages: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
assert.equal(carriedForwardInput.priorCumulativeIncome, 50000);
assert.equal(carriedForwardInput.priorCumulativeEmployeeContributions, 6125);
assert.equal(carriedForwardInput.priorCumulativeTaxWithheld, 1367.5);

const secondCumulativeEmployee = calculatePayrollItem({
  employeeCode: 'E-CUM-2',
  employeeName: 'Cumulative Month Two',
  basicSalary: 50000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 50000,
  priorCumulativeEmployeeContributions: 6125,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 1367.5,
  priorCumulativeMonths: 2,
}, cumulativeConfig, 2);
assert.equal(secondCumulativeEmployee.taxableIncomeCumulative, 77750);
assert.equal(secondCumulativeEmployee.individualIncomeTax, 3887.5);
assert.equal(secondCumulativeEmployee.netSalary, 39987.5);

const secondEmployee = calculatePayrollItem({
  employeeCode: 'E002',
  employeeName: '李四',
  basicSalary: 7000,
  bonus: 0,
  allowance: 0,
  otherEarnings: 0,
  leaveDeduction: 0,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 0,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, config, 1);
const summary = summarizePayrollResults([firstEmployee, secondEmployee]);
assert.equal(summary.employeeCount, 2);
assert.equal(summary.grossTotal, roundMoney(firstEmployee.grossSalary + secondEmployee.grossSalary));
assert.equal(summary.netTotal, roundMoney(firstEmployee.netSalary + secondEmployee.netSalary));

const voucherPreview = buildPayrollAccrualVoucherPreview([
  {
    id: 'payitem-voucher',
    batchId: 'paybatch-voucher',
    accountSetId: 'acct-voucher',
    payrollPeriod: '2026-04',
    employeeCode: 'E-VCH',
    employeeName: 'Voucher Employee',
    departmentName: 'Sales',
    inputData: {
      employeeCode: 'E-VCH',
      employeeName: 'Voucher Employee',
      departmentName: 'Sales',
      incomeType: 'salary',
      basicSalary: 50000,
      bonus: 0,
      allowance: 0,
      otherEarnings: 0,
      leaveDeduction: 0,
      otherPreTaxDeduction: 0,
      socialInsuranceBase: undefined,
      housingFundBase: undefined,
      specialAdditionalDeduction: 0,
      otherLegalDeduction: 0,
      priorCumulativeIncome: 0,
      priorCumulativeEmployeeContributions: 0,
      priorCumulativeSpecialAdditionalDeduction: 0,
      priorCumulativeOtherLegalDeduction: 0,
      priorCumulativeTaxWithheld: 0,
      otherPostTaxDeduction: 0,
    },
    calculationResult: calculatePayrollItem({
      employeeCode: 'E-VCH',
      employeeName: 'Voucher Employee',
      departmentName: 'Sales',
      incomeType: 'salary',
      basicSalary: 50000,
      bonus: 0,
      allowance: 0,
      otherEarnings: 0,
      leaveDeduction: 0,
      otherPreTaxDeduction: 0,
      socialInsuranceBase: undefined,
      housingFundBase: undefined,
      specialAdditionalDeduction: 0,
      otherLegalDeduction: 0,
      priorCumulativeIncome: 0,
      priorCumulativeEmployeeContributions: 0,
      priorCumulativeSpecialAdditionalDeduction: 0,
      priorCumulativeOtherLegalDeduction: 0,
      priorCumulativeTaxWithheld: 0,
      otherPostTaxDeduction: 0,
    }, config, 1),
    validationStatus: 'valid',
    validationMessages: [],
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
], '2026-01');
const salaryPayableEntry = voucherPreview.find((entry) => entry.summary.includes('应付员工实发工资'));
const employerContributionEntry = voucherPreview.find((entry) => entry.summary.includes('代提公司社保公积金'));
assert.equal(salaryPayableEntry?.credit, 44870);
assert.equal(employerContributionEntry?.credit, 6700);
assert.notEqual(salaryPayableEntry?.credit, employerContributionEntry?.credit);

const defaultPreview = buildPayrollAccrualVoucherPreview([
  {
    id: 'payitem-default-voucher',
    batchId: 'paybatch-default-voucher',
    accountSetId: 'acct-default-voucher',
    payrollPeriod: '2026-03',
    employeeCode: 'E-DEFAULT',
    employeeName: 'Default Voucher Employee',
    departmentName: 'Sales',
    inputData: {
      employeeCode: 'E-DEFAULT',
      employeeName: 'Default Voucher Employee',
      departmentName: 'Sales',
      incomeType: 'salary',
      basicSalary: 50000,
      bonus: 0,
      allowance: 0,
      otherEarnings: 0,
      leaveDeduction: 0,
      otherPreTaxDeduction: 0,
      socialInsuranceBase: undefined,
      housingFundBase: undefined,
      specialAdditionalDeduction: 0,
      otherLegalDeduction: 0,
      priorCumulativeIncome: 0,
      priorCumulativeEmployeeContributions: 0,
      priorCumulativeSpecialAdditionalDeduction: 0,
      priorCumulativeOtherLegalDeduction: 0,
      priorCumulativeTaxWithheld: 0,
      otherPostTaxDeduction: 0,
    },
    calculationResult: calculatePayrollItem({
      employeeCode: 'E-DEFAULT',
      employeeName: 'Default Voucher Employee',
      departmentName: 'Sales',
      incomeType: 'salary',
      basicSalary: 50000,
      bonus: 0,
      allowance: 0,
      otherEarnings: 0,
      leaveDeduction: 0,
      otherPreTaxDeduction: 0,
      socialInsuranceBase: undefined,
      housingFundBase: undefined,
      specialAdditionalDeduction: 0,
      otherLegalDeduction: 0,
      priorCumulativeIncome: 0,
      priorCumulativeEmployeeContributions: 0,
      priorCumulativeSpecialAdditionalDeduction: 0,
      priorCumulativeOtherLegalDeduction: 0,
      priorCumulativeTaxWithheld: 0,
      otherPostTaxDeduction: 0,
    }, config, 1),
    validationStatus: 'valid',
    validationMessages: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
], '2026-03');
const defaultSalaryEntry = defaultPreview.find((entry) => entry.summary.includes('计提工资'));
const defaultContributionEntry = defaultPreview.find((entry) => entry.summary.includes('计提公司社保公积金'));
const defaultSalaryPayable = defaultPreview.find((entry) => entry.summary.includes('应付员工实发工资'));
const defaultTaxPayable = defaultPreview.find((entry) => entry.summary.includes('代扣代缴个人所得税'));
const defaultEmployeeContribution = defaultPreview.find((entry) => entry.summary.includes('代扣个人社保公积金及其他扣款'));
assert.equal(defaultSalaryEntry?.subjectCode, '660201');
assert.equal(defaultContributionEntry?.subjectCode, '660202');
assert.equal(defaultSalaryPayable?.subjectCode, '2151');
assert.equal(defaultTaxPayable?.subjectCode, '222102');
assert.equal(defaultEmployeeContribution?.subjectCode, '220101');

console.log('payroll calculation tests passed');
