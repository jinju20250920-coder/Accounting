import assert from 'node:assert/strict';
import {
  calculatePayrollItem,
  clampContributionBase,
  createBlankPayrollCalculationConfig,
  DEFAULT_CUMULATIVE_TAX_CONFIG,
  roundMoney,
  summarizePayrollResults,
  type PayrollCalculationConfig,
} from './src/lib/payroll';

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

console.log('payroll calculation tests passed');
