import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const managerSource = readFileSync('./src/lib/database/sqlite-manager.ts', 'utf8');
const serviceSource = readFileSync('./src/lib/database/sqlite-service.ts', 'utf8');

for (const table of ['payroll_batches', 'payroll_items', 'payroll_calculation_configs']) {
  assert.match(managerSource, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(serviceSource, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}

for (const method of [
  'getPayrollBatches',
  'getPayrollItems',
  'savePayrollCalculationConfig',
  'getPayrollCalculationConfig',
  'savePayrollBatch',
  'updatePayrollBatchStatus',
  'deletePayrollBatch',
]) {
  assert.match(serviceSource, new RegExp(`async ${method}\\(`));
}
assert.match(serviceSource, /已确认工资批次不能删除/, 'database service must protect confirmed payroll batches');

console.log('payroll storage contract tests passed');
