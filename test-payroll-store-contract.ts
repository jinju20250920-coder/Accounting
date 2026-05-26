import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBlankPayrollCalculationConfig } from './src/lib/payroll';

const blankConfig = createBlankPayrollCalculationConfig();
assert.equal(blankConfig.socialInsurance.pension.employeeRate, 0);
assert.equal(blankConfig.housingFund.enabled, true);
assert.equal(blankConfig.individualTax.standardDeductionPerMonth, 5000);

const storeSource = readFileSync('./src/stores/usePayrollStore.ts', 'utf8');
for (const action of [
  'loadPeriod',
  'loadBatch',
  'saveConfig',
  'importDraft',
  'recalculateBatch',
  'confirmBatch',
  'revertBatchToDraft',
  'deleteDraftBatch',
]) {
  assert.match(storeSource, new RegExp(`${action}: async`));
}

console.log('payroll store contract tests passed');
