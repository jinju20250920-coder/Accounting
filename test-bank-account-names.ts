import assert from 'node:assert/strict';
import {
  buildBankAccountDisplayName,
  resolveBankSelection,
} from './src/lib/bank-account-names';

assert.equal(
  buildBankAccountDisplayName({
    bankName: '建设银行',
    accountNumber: '622700123456784451',
    currency: 'usd',
    customName: 'XX银行-4451 usd',
  }),
  'XX银行-4451 usd',
);

assert.equal(
  buildBankAccountDisplayName({
    bankName: '建设银行',
    shortName: '建行',
    accountNumber: '622700123456784451',
    currency: 'USD',
  }),
  '建行-4451 USD',
);

assert.deepEqual(
  resolveBankSelection({
    selectedBankId: '__new__',
    selectedBankName: '',
    customBankName: '华润银行',
  }),
  { bankId: 'custom_bank_gge_lnq_tfa_qx8', bankName: '华润银行', isCustom: true },
);

assert.deepEqual(
  resolveBankSelection({
    selectedBankId: 'ccb',
    selectedBankName: '建设银行',
    customBankName: '',
  }),
  { bankId: 'ccb', bankName: '建设银行', isCustom: false },
);

console.log('bank account names ok');
