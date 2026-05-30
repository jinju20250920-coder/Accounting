import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
assert.match(salaryEvidence?.systemMessage || '', /已确认工资计算批次/);
assert.match(salaryEvidence?.systemMessage || '', /仍需核对/);
assert.match(socialEvidence?.systemMessage || '', /社保、公积金计算结果/);

const sidebarSource = readFileSync('./src/components/layout/sidebar.tsx', 'utf8');
assert.match(sidebarSource, /薪酬管理/);
assert.match(sidebarSource, /\/payroll/);

const payrollPageSource = readFileSync('./src/app/payroll/page.tsx', 'utf8');
for (const action of ['导入工资表', '下载模板', '计算设置', '确认本月工资', '实发工资']) {
  assert.match(payrollPageSource, new RegExp(action));
}
for (const action of ['新增行', '保存', '取消', '编辑', '删除']) {
  assert.match(payrollPageSource, new RegExp(action));
}
assert.match(payrollPageSource, /createBlankPayrollInput/);
assert.match(payrollPageSource, /EMPTY_ENTRY_ROW_COUNT\s*=\s*10/);
assert.match(payrollPageSource, /createBlankPayrollRows/);
assert.match(payrollPageSource, /saveDraftRows/);
assert.match(payrollPageSource, /已录入内容将保留/);
assert.match(payrollPageSource, /addManualItems/);
assert.match(payrollPageSource, /updateItem/);
assert.match(payrollPageSource, /deleteItem/);
assert.match(payrollPageSource, /退回草稿后可修改明细/);
assert.match(payrollPageSource, /useDepartmentStore/);
assert.match(payrollPageSource, /usePartnerStore/);
assert.match(payrollPageSource, /const partners = usePartnerStore\(\(state\) => state\.partners\)/);
assert.match(payrollPageSource, /partners\.filter\(\(item\) => item\.isEmployee/);
assert.match(payrollPageSource, /function completeEmployeeFields/);
assert.match(payrollPageSource, /const employeeField = field === 'employeeCode' \? 'code' : 'name'/);
assert.match(payrollPageSource, /completeEmployeeFields\(row, 'employeeCode', row\.employeeCode, employeeOptions\)/);
assert.match(payrollPageSource, /departmentName: employeeDepartmentName/);
assert.match(payrollPageSource, /function clearDraftRow/);
assert.match(payrollPageSource, /function clearEditingRow/);
assert.match(payrollPageSource, /清空本行/);
assert.match(payrollPageSource, /<Eraser \/>/);
assert.match(payrollPageSource, /employee-code-options/);
assert.match(payrollPageSource, /employee-name-options/);
assert.match(payrollPageSource, /department-options/);
assert.match(payrollPageSource, /function addDraftRow/);
assert.match(payrollPageSource, /function handleDraftGridKeyDown/);
assert.match(payrollPageSource, /新增一行/);
assert.match(payrollPageSource, /EXCEL_CELL_CLASS/);
assert.match(payrollPageSource, /EXCEL_HEADER_CELL_CLASS/);
assert.match(payrollPageSource, /variant="excel"/);
assert.match(payrollPageSource, /border-collapse/);
assert.match(payrollPageSource, /border-slate-300/);
for (const resultLabel of ['应发工资', '个税', '实发工资', '企业成本']) {
  assert.match(payrollPageSource, new RegExp(resultLabel));
}
assert.match(payrollPageSource, /PAYROLL_RESULT_FIELDS/);
assert.match(payrollPageSource, /复制上月/);
assert.match(payrollPageSource, /生成计提凭证/);
assert.match(payrollPageSource, /工资计提凭证预览/);
assert.match(payrollPageSource, /PAYROLL_REGION_PRESETS/);
assert.match(payrollPageSource, /applyPayrollRegionPreset/);
assert.match(payrollPageSource, /个税默认设置/);
assert.match(payrollPageSource, /const DISABLE_BROWSER_AUTOFILL = \{ autoComplete: 'off' as const \}/);
assert.match(payrollPageSource, /\{\.\.\.DISABLE_BROWSER_AUTOFILL\}/);
assert.match(payrollPageSource, /function formatContributionRatePercent\(rate: number\): number/);
assert.match(payrollPageSource, /formatContributionRatePercent\(settingsDraft\.socialInsurance\[key\]\.employeeRate\)/);
assert.match(payrollPageSource, /formatContributionRatePercent\(settingsDraft\.socialInsurance\[key\]\.employerRate\)/);
assert.match(payrollPageSource, /formatContributionRatePercent\(settingsDraft\.housingFund\.employeeRate\)/);
assert.match(payrollPageSource, /formatContributionRatePercent\(settingsDraft\.housingFund\.employerRate\)/);

const monthlyClosingChecksPageSource = readFileSync('./src/app/monthly-closing-checks/page.tsx', 'utf8');
assert.match(monthlyClosingChecksPageSource, /useRouter/);
assert.match(monthlyClosingChecksPageSource, /router\.push\('\/'\)/);
assert.match(monthlyClosingChecksPageSource, /返回智能做账/);

const payrollDefaultsSource = readFileSync('./src/lib/payroll-defaults.ts', 'utf8');
assert.match(payrollDefaultsSource, /PAYROLL_REGION_PRESETS/);
assert.match(payrollDefaultsSource, /shanghai/);
assert.match(payrollDefaultsSource, /applyPayrollRegionPreset/);

const payrollSource = readFileSync('./src/lib/payroll.ts', 'utf8');
const payrollTaxRulesSource = readFileSync('./src/lib/payroll-tax-rules.ts', 'utf8');
assert.match(payrollSource, /incomeType\?: PayrollIncomeType/);
assert.match(payrollSource, /annualBonusTaxMethod\?: PayrollAnnualBonusTaxMethod/);
assert.match(payrollSource, /calculateAnnualBonusTax/);
assert.match(payrollTaxRulesSource, /ruleType: 'annual_bonus'/);
assert.match(payrollTaxRulesSource, /ruleType: 'business_income'/);

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

const payrollVoucherSource = readFileSync('./src/lib/payroll-voucher.ts', 'utf8');
assert.match(payrollVoucherSource, /buildPayrollAccrualVoucherPreview/);
assert.match(payrollVoucherSource, /previewToVoucherEntries/);
assert.match(payrollVoucherSource, /660201/);
assert.match(payrollVoucherSource, /resolvePayrollVoucherSubjects/);
assert.match(payrollVoucherSource, /employeeByCode/);
assert.match(payrollVoucherSource, /payrollSalaryExpenseSubjectCode/);

const voucherPreview = buildPayrollAccrualVoucherPreview([{
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
}]);

assert(voucherPreview.some((entry) => entry.subjectCode === '660401'));

const accountSetFallbackPreview = buildPayrollAccrualVoucherPreview([{
  id: 'item-voucher-2',
  batchId: 'batch-voucher-2',
  accountSetId: 'as-1',
  payrollPeriod: '2026-05',
  employeeCode: 'EMP-DEFAULT',
  employeeName: 'Default Subject Employee',
  departmentName: 'Admin',
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

const departmentFallbackPreview = buildPayrollAccrualVoucherPreview([{
  id: 'item-voucher-3',
  batchId: 'batch-voucher-3',
  accountSetId: 'as-1',
  payrollPeriod: '2026-05',
  employeeCode: 'EMP-DEPT',
  employeeName: 'Department Subject Employee',
  departmentName: 'Sales',
  inputData: {
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-DEPT',
    employeeName: 'Department Subject Employee',
    departmentName: 'Sales',
    basicSalary: 9000,
  },
  calculationResult: calculatePayrollItem({
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-DEPT',
    employeeName: 'Department Subject Employee',
    departmentName: 'Sales',
    basicSalary: 9000,
  }, createBlankPayrollCalculationConfig(), 5),
  validationStatus: 'valid',
  validationMessages: [],
  createdAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
}], '2026-05', [], {
  payrollSalaryExpenseSubjectCode: '660299',
  payrollSalaryExpenseSubjectName: '管理费用-工资默认',
}, [{
  id: 'dept-sales',
  code: 'DEPT-SALES',
  name: 'Sales',
  parentId: null,
  level: 1,
  payrollSalaryExpenseSubjectCode: '660101',
  payrollSalaryExpenseSubjectName: '销售费用-工资',
  frozen: false,
}]);

assert(departmentFallbackPreview.some((entry) => entry.subjectCode === '660101'));

const rowOverridePreview = buildPayrollAccrualVoucherPreview([{
  id: 'item-voucher-4',
  batchId: 'batch-voucher-4',
  accountSetId: 'as-1',
  payrollPeriod: '2026-05',
  employeeCode: 'EMP-ROW',
  employeeName: 'Row Override Employee',
  departmentName: 'R&D',
  inputData: {
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-ROW',
    employeeName: 'Row Override Employee',
    departmentName: 'R&D',
    basicSalary: 11000,
    payrollSalaryExpenseSubjectCode: '660901',
    payrollSalaryExpenseSubjectName: '项目成本-工资',
  } as typeof createBlankPayrollInput extends () => infer T ? T : never,
  calculationResult: calculatePayrollItem({
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-ROW',
    employeeName: 'Row Override Employee',
    departmentName: 'R&D',
    basicSalary: 11000,
  }, createBlankPayrollCalculationConfig(), 5),
  validationStatus: 'valid',
  validationMessages: [],
  createdAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
}], '2026-05', [{
  id: 'partner-row',
  code: 'EMP-ROW',
  name: 'Row Override Employee',
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
}, [{
  id: 'dept-rd',
  code: 'DEPT-RD',
  name: 'R&D',
  parentId: null,
  level: 1,
  payrollSalaryExpenseSubjectCode: '660501',
  payrollSalaryExpenseSubjectName: '技术部门工资',
  frozen: false,
}]);

assert(rowOverridePreview.some((entry) => entry.subjectCode === '660901'));

console.log('payroll monthly integration tests passed');
