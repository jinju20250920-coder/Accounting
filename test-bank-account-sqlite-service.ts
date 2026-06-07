import assert from 'node:assert/strict';
import {
  buildBankAccountBindingInsert,
  mapBankAccountBindingRow,
} from './src/lib/database/services/bank-account-sqlite-service';

const insert = buildBankAccountBindingInsert({
  id: 'binding-1',
  accountSetId: 'set-1',
  accountNumber: '4451',
  bankId: 'ccb',
  bankName: '建设银行',
  aliasName: '建行-4451 USD',
  subSubjectCode: '100201',
  subSubjectName: '建行-4451 USD',
  currency: 'USD',
  isDefault: true,
  createdAt: '2026-06-07T00:00:00.000Z',
});

assert.equal(insert.params.length, 12);
assert.deepEqual(insert.params, [
  'binding-1',
  'set-1',
  '4451',
  'ccb',
  '建设银行',
  '建行-4451 USD',
  '100201',
  '建行-4451 USD',
  null,
  'USD',
  1,
  '2026-06-07T00:00:00.000Z',
]);

insert.params.forEach((value, index) => {
  assert.notEqual(value, undefined, `insert param ${index} should not be undefined`);
});

assert.deepEqual(
  mapBankAccountBindingRow({
    id: 'binding-1',
    accountSetId: 'set-1',
    accountNumber: '4451',
    bankId: 'ccb',
    bankName: '建设银行',
    aliasName: null,
    subSubjectCode: '100201',
    subSubjectName: '建行-4451 USD',
    branch: null,
    currency: 'USD',
    isDefault: 0,
    createdAt: '2026-06-07T00:00:00.000Z',
  }),
  {
    id: 'binding-1',
    accountSetId: 'set-1',
    accountNumber: '4451',
    bankId: 'ccb',
    bankName: '建设银行',
    aliasName: undefined,
    subSubjectCode: '100201',
    subSubjectName: '建行-4451 USD',
    branch: undefined,
    currency: 'USD',
    isDefault: false,
    createdAt: '2026-06-07T00:00:00.000Z',
  },
);

console.log('bank account sqlite service ok');
