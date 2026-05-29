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
assert.match(storeSource, /请先退回草稿后修改/);
assert.match(storeSource, /手工维护批次/);
assert.match(storeSource, /validatePayrollInput/);
assert.match(storeSource, /previousPeriod/);
assert.match(storeSource, /buildPayrollAccrualVoucherPreview/);
assert.match(storeSource, /previewToVoucherEntries/);
assert.match(payrollPageSource, /taxSettingsOpen/);
assert.match(payrollPageSource, /Settings/);
assert.match(payrollPageSource, /incomeType/);
assert.match(payrollPageSource, /annualBonusTaxMethod/);
assert.match(payrollPageSource, /BUILT_IN_PAYROLL_TAX_RULES/);
assert.match(typesSource, /payrollSalaryExpenseSubjectCode/);
assert.match(typesSource, /payrollContributionExpenseSubjectCode/);
assert.match(typesSource, /payrollSalaryPayableSubjectCode/);
assert.match(typesSource, /payrollTaxPayableSubjectCode/);
assert.match(typesSource, /payrollEmployeeContributionPayableSubjectCode/);
assert.match(partnerStoreSource, /payrollSalaryExpenseSubjectCode/);
assert.match(auxiliaryPageSource, /工资核算设置/);

console.log('payroll store contract tests passed');
