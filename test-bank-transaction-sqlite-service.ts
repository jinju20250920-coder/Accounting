import assert from 'node:assert/strict';
import {
  buildBankTransactionInsert,
  mapBankTransactionRow,
} from './src/lib/database/services/bank-transaction-sqlite-service';

const insert = buildBankTransactionInsert({
  id: 'tx-1',
  date: '2026-06-07',
  transactionTime: '',
  voucherType: '',
  voucherNo: '',
  debit: 1200,
  credit: 0,
  balance: 8800,
  cashRemitFlag: '',
  counterpartyName: 'Shanghai Co.',
  counterpartyAccount: '',
  summary: 'bank deposit',
  notes: '',
  transactionSerialNo: '',
  enterpriseSerialNo: '',
  ourAccount: '',
  ourAccountName: '',
  ourBranch: '',
  rowNumber: 1,
  status: undefined,
  matchedSubject: '',
  matchedSubjectName: '',
  confidence: undefined,
  bankAccountId: '',
  importBatchId: '',
  voucherId: '',
  generatedVoucherNo: '',
  exchangeRate: undefined,
  originalAmount: undefined,
  source: undefined,
  accountSetId: 'set-1',
  createTime: '2026-06-07T00:00:00.000Z',
  updateTime: '2026-06-07T00:00:00.000Z',
}, 'set-1');

assert.equal(insert.params.length, 33);
assert.equal(insert.params[19], 'pending');
assert.equal(insert.params[29], 'import');
insert.params.forEach((value, index) => {
  assert.notEqual(value, undefined, `insert param ${index} should not be undefined`);
});

const mapped = mapBankTransactionRow({
  id: 'tx-1',
  date: '2026-06-07',
  transactionTime: null,
  voucherType: null,
  voucherNo: null,
  debit: 1200,
  credit: 0,
  balance: 8800,
  cashRemitFlag: null,
  counterpartyName: 'Shanghai Co.',
  counterpartyAccount: null,
  summary: 'bank deposit',
  notes: null,
  transactionSerialNo: null,
  enterpriseSerialNo: null,
  ourAccount: null,
  ourAccountName: null,
  ourBranch: null,
  rowNumber: 1,
  status: 'matched',
  matchedSubject: '1002',
  matchedSubjectName: 'bank deposit',
  confidence: 0.99,
  bankAccountId: null,
  importBatchId: null,
  voucherId: null,
  generatedVoucherNo: null,
  exchangeRate: null,
  originalAmount: null,
  source: 'manual',
  accountSetId: 'set-1',
  createTime: '2026-06-07T00:00:00.000Z',
  updateTime: '2026-06-07T00:00:00.000Z',
});

assert.equal(mapped.id, 'tx-1');
assert.equal(mapped.date, '2026-06-07');
assert.equal(mapped.transactionTime, undefined);
assert.equal(mapped.status, 'matched');
assert.equal(mapped.matchedSubject, '1002');
assert.equal(mapped.matchedSubjectName, 'bank deposit');
assert.equal(mapped.confidence, 0.99);
assert.equal(mapped.bankAccountId, undefined);
assert.equal(mapped.exchangeRate, null);
assert.equal(mapped.originalAmount, null);
assert.equal(mapped.source, 'manual');
assert.equal(mapped.accountSetId, 'set-1');
assert.equal(mapped.createTime, '2026-06-07T00:00:00.000Z');
assert.equal(mapped.updateTime, '2026-06-07T00:00:00.000Z');

console.log('bank transaction sqlite service ok');
