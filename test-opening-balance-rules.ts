import assert from 'node:assert/strict';
import {
  analyzeOpeningBalance,
  buildOpeningAdjustmentEntry,
  buildPartnerOpeningEntriesFromPartners,
  hasSubledgerSourceForSubject,
} from './src/lib/opening-balance-rules';

const analysis = analyzeOpeningBalance({
  subjectEntries: [
    { subjectCode: '1002', subjectName: '银行存款', debit: 1000, credit: 0 },
    { subjectCode: '1122', subjectName: '应收账款', debit: 500, credit: 0 },
    { subjectCode: '2202', subjectName: '应付账款', debit: 0, credit: 300 },
  ],
  partnerEntries: [
    { name: '客户A', type: 'receivable', amount: 300, remark: '' },
    { name: '供应商A', type: 'payable', amount: 300, remark: '' },
  ],
  bankEntries: [
    { accountNumber: '4451', bankName: 'XX银行', balance: 800 },
  ],
  assetEntries: [
    { assetCode: 'FA001', assetName: '设备', originalValue: 200, accumulatedDepreciation: 50, netValue: 150, included: true },
  ],
});

assert.equal(analysis.totalDebit, 1300);
assert.equal(analysis.totalCredit, 350);
assert.equal(analysis.balanceDifference, 950);
assert.equal(analysis.adjustmentSide, 'credit');
assert.deepEqual(
  analysis.subledgerDifferences.map(item => ({
    subjectCode: item.subjectCode,
    subjectBalance: item.subjectBalance,
    detailBalance: item.detailBalance,
    difference: item.difference,
  })),
  [
    { subjectCode: '1002', subjectBalance: 1000, detailBalance: 800, difference: 200 },
    { subjectCode: '1122', subjectBalance: 500, detailBalance: 300, difference: 200 },
    { subjectCode: '1601', subjectBalance: 0, detailBalance: 200, difference: -200 },
    { subjectCode: '1602', subjectBalance: 0, detailBalance: 50, difference: -50 },
  ],
);

const adjustment = buildOpeningAdjustmentEntry({
  subjectCode: '4104',
  subjectName: '利润分配-未分配利润',
  analysis,
  id: 'adjustment-1',
  date: '2026-01-01',
});

assert.deepEqual(adjustment, {
  id: 'adjustment-1',
  voucherId: '',
  date: '2026-01-01',
  summary: '期初平衡调整',
  subjectCode: '4104',
  subjectName: '利润分配-未分配利润',
  debit: 0,
  credit: 950,
});

assert.equal(
  hasSubledgerSourceForSubject('100201', {
    partnerEntries: [],
    bankEntries: [{ accountNumber: '4451', bankName: 'XX银行', balance: 800 }],
    assetEntries: [],
  }),
  true,
);

assert.equal(
  hasSubledgerSourceForSubject('6602', {
    partnerEntries: [{ name: '客户A', type: 'receivable', amount: 300, remark: '' }],
    bankEntries: [],
    assetEntries: [],
  }),
  false,
);

assert.deepEqual(
  buildPartnerOpeningEntriesFromPartners([
    { name: '客户A', isCustomer: true, isSupplier: false, openingBalance: 1200 },
    { name: '供应商B', isCustomer: false, isSupplier: true, openingBalance: 800 },
    { name: '客户供应商C', isCustomer: true, isSupplier: true, openingBalance: 300 },
    { name: '零余额D', isCustomer: true, isSupplier: false, openingBalance: 0 },
  ]),
  [
    { name: '客户A', type: 'receivable', amount: 1200, remark: '往来单位期初余额' },
    { name: '供应商B', type: 'payable', amount: 800, remark: '往来单位期初余额' },
    { name: '客户供应商C', type: 'receivable', amount: 300, remark: '往来单位期初余额' },
  ],
);

console.log('opening balance rules ok');
