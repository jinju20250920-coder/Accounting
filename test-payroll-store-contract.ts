import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBlankPayrollCalculationConfig } from './src/lib/payroll';

const blankConfig = createBlankPayrollCalculationConfig();
assert.equal(blankConfig.socialInsurance.pension.employeeRate, 0);
assert.equal(blankConfig.housingFund.enabled, true);
assert.equal(blankConfig.individualTax.standardDeductionPerMonth, 5000);

const storeSource = readFileSync('./src/stores/usePayrollStore.ts', 'utf8');
const payrollPageSource = readFileSync('./src/app/payroll/page.tsx', 'utf8');
const typesSource = readFileSync('./src/types/index.ts', 'utf8');
const partnerStoreSource = readFileSync('./src/stores/usePartnerStore.ts', 'utf8');
const auxiliaryPageSource = readFileSync('./src/app/settings/auxiliary/page.tsx', 'utf8');

for (const action of [
  'loadPeriod',
  'loadBatch',
  'saveConfig',
  'importDraft',
  'recalculateBatch',
  'confirmBatch',
  'revertBatchToDraft',
  'deleteDraftBatch',
  'addManualItems',
  'addManualItem',
  'updateItem',
  'deleteItem',
  'copyPreviousPeriod',
  'createAccrualVoucher',
]) {
  assert.match(storeSource, new RegExp(`${action}: async`));
}

assert.match(storeSource, /validatePayrollInput/);
assert.match(storeSource, /previousPeriod/);
assert.match(storeSource, /buildPayrollAccrualVoucherPreview/);
assert.match(storeSource, /previewToVoucherEntries/);
assert.match(payrollPageSource, /taxSettingsOpen/);
assert.match(payrollPageSource, /Settings/);
assert.match(payrollPageSource, /incomeType/);
assert.match(payrollPageSource, /annualBonusTaxMethod/);
assert.match(payrollPageSource, /BUILT_IN_PAYROLL_TAX_RULES/);
assert.match(payrollPageSource, /showOptionalFields/);
assert.match(payrollPageSource, /显示扩展字段|隐藏扩展字段/);
assert.match(payrollPageSource, /employeeHousingFund/);
assert.match(payrollPageSource, /养老/);
assert.match(payrollPageSource, /医疗/);
assert.match(payrollPageSource, /失业/);
assert.match(
  payrollPageSource,
  /<Dialog open=\{settingsOpen\}[\s\S]*?onClick=\{\(\) => setTaxSettingsOpen\(true\)\}/,
);
assert.match(
  payrollPageSource,
  /value=\{settingsDraft\.individualTax\.standardDeductionPerMonth\}[\s\S]*?onChange=\{\(event\) => updateStandardDeduction\(event\.target\.value\)\}/,
);
assert.match(
  payrollPageSource,
  /<Dialog open=\{taxSettingsOpen\}[\s\S]*?PAYROLL_TAX_RULE_SECTIONS\.map[\s\S]*?settingsDraft\.taxRules\[section\.ruleType\]\.map\(\(rule, index\)/,
);
assert.match(
  payrollPageSource,
  /updateTaxRule\(section\.ruleType, index, 'lowerLimit', event\.target\.value\)/,
);
assert.match(
  payrollPageSource,
  /updateTaxRule\(section\.ruleType, index, 'upperLimit', event\.target\.value\)/,
);
assert.match(
  payrollPageSource,
  /updateTaxRule\(section\.ruleType, index, 'rate', event\.target\.value\)/,
);
assert.match(
  payrollPageSource,
  /updateTaxRule\(section\.ruleType, index, 'quickDeduction', event\.target\.value\)/,
);
assert.ok(
  payrollPageSource.indexOf('<Dialog open={taxSettingsOpen} onOpenChange={setTaxSettingsOpen}>')
  > payrollPageSource.indexOf('<Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>'),
  'tax settings dialog should render after the calculation settings dialog so it can appear on top',
);
assert.match(
  payrollPageSource,
  /async function saveSettings\(\)[\s\S]*?updateAccountSet\(currentAccountSet\.id,\s*\{[\s\S]*?payrollRegionId:\s*settingsRegionId/,
);
assert.match(
  payrollPageSource,
  /async function saveSettings\(\)[\s\S]*?if \(selectedBatch\) \{\s*await recalculateBatch\(selectedBatch\.id\);\s*\}/,
);
assert.doesNotMatch(
  payrollPageSource,
  /function applyRegionPreset\(regionId: PayrollRegionId\)[\s\S]*?updateAccountSet\(currentAccountSet\.id,\s*\{\s*payrollRegionId:\s*regionId/,
);
assert.doesNotMatch(payrollPageSource, /<Dialog open=\{settingsOpen\}[\s\S]*?税率快捷调整/);
assert.doesNotMatch(
  payrollPageSource,
  /<Dialog open=\{copyDialogOpen\}[\s\S]*?<div className="hidden">[\s\S]*?PAYROLL_TAX_RULE_SECTIONS[\s\S]*?<\/div>/,
);
assert.match(
  payrollPageSource,
  /employeeContributionColumns[\s\S]*?pension[\s\S]*?medical[\s\S]*?unemployment[\s\S]*?employeeHousingFund[\s\S]*?individualIncomeTax[\s\S]*?netSalary[\s\S]*?employerTotalCost/,
);
assert.doesNotMatch(
  payrollPageSource,
  /const PAYROLL_AMOUNT_FIELDS:[\s\S]*?\{\s*key:\s*'socialInsuranceBase',\s*label:\s*'社保缴费基数'\s*\}/,
);
assert.doesNotMatch(
  payrollPageSource,
  /const PAYROLL_AMOUNT_FIELDS:[\s\S]*?\{\s*key:\s*'housingFundBase',\s*label:\s*'公积金缴费基数'\s*\}/,
);
assert.match(
  payrollPageSource,
  /value=\{input\.incomeType === 'annual_bonus' \? \(input\.annualBonusTaxMethod \|\| ''\) : ''\}/,
);
assert.match(
  payrollPageSource,
  /<option value="">--<\/option>/,
);
assert.match(typesSource, /payrollSalaryExpenseSubjectCode/);
assert.match(typesSource, /payrollContributionExpenseSubjectCode/);
assert.match(typesSource, /payrollSalaryPayableSubjectCode/);
assert.match(typesSource, /payrollTaxPayableSubjectCode/);
assert.match(typesSource, /payrollEmployeeContributionPayableSubjectCode/);
assert.match(partnerStoreSource, /payrollSalaryExpenseSubjectCode/);
assert.match(partnerStoreSource, /departmentName:\s*'销售部'/);
assert.match(auxiliaryPageSource, /部门/);
assert.match(auxiliaryPageSource, /payrollSalaryExpenseSubjectCode/);
assert.doesNotMatch(auxiliaryPageSource, /payrollContributionExpenseSubjectCode/);
assert.doesNotMatch(auxiliaryPageSource, /payrollSalaryPayableSubjectCode/);
assert.doesNotMatch(auxiliaryPageSource, /payrollTaxPayableSubjectCode/);
assert.doesNotMatch(auxiliaryPageSource, /payrollEmployeeContributionPayableSubjectCode/);

console.log('payroll store contract tests passed');
