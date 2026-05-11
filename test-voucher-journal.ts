import assert from 'node:assert/strict';
import { createReverseVoucher } from './src/lib/accounting';
import { buildVoucherJournalRows } from './src/lib/voucher-journal';
import type { Voucher } from './src/types';

const vouchers: Voucher[] = [
  {
    id: 'v-posted',
    voucherNo: 'J-202603-001',
    date: '2026-03-03',
    status: 'posted',
    voucherType: 'general',
    createdBy: 'demo',
    createTime: '2026-03-03T09:00:00.000Z',
    entries: [
      {
        id: 'e1',
        voucherId: 'v-posted',
        date: '2026-03-03',
        summary: 'Pay rent',
        subjectCode: '6602',
        subjectName: 'Management expense',
        debit: 1200,
        credit: 0,
        currencyCode: 'CNY',
        auxiliary: { department: 'Finance' },
      },
      {
        id: 'e2',
        voucherId: 'v-posted',
        date: '2026-03-03',
        summary: 'Pay rent',
        subjectCode: '1002',
        subjectName: 'Bank deposit',
        debit: 0,
        credit: 1200,
        currencyCode: 'CNY',
        docNo: 'BANK-001',
      },
    ],
  },
  {
    id: 'v-draft',
    voucherNo: 'J-202603-002',
    date: '2026-03-04',
    status: 'draft',
    voucherType: 'general',
    createdBy: 'demo',
    createTime: '2026-03-04T09:00:00.000Z',
    entries: [
      {
        id: 'e3',
        voucherId: 'v-draft',
        date: '2026-03-04',
        summary: 'Draft voucher',
        subjectCode: '1001',
        subjectName: 'Cash',
        debit: 10,
        credit: 0,
      },
    ],
  },
  {
    id: 'v-reversed',
    voucherNo: 'J-202603-003',
    date: '2026-03-05',
    status: 'reversed',
    voucherType: 'general',
    createdBy: 'demo',
    createTime: '2026-03-05T09:00:00.000Z',
    entries: [
      {
        id: 'e4',
        voucherId: 'v-reversed',
        date: '2026-03-05',
        summary: 'Reversed voucher',
        subjectCode: '1002',
        subjectName: 'Bank deposit',
        debit: 10,
        credit: 0,
      },
    ],
  },
];

const rows = buildVoucherJournalRows(vouchers);

assert.equal(rows.length, 3, 'voucher journal includes posted and reversed entries');
assert.deepEqual(rows.map((row) => row.voucherNo), ['J-202603-001', 'J-202603-001', 'J-202603-003']);
assert.equal(rows[0].lineNo, 1);
assert.equal(rows[1].lineNo, 2);
assert.equal(rows[0].department, 'Finance');
assert.equal(rows[1].docNo, 'BANK-001');

const subjectRows = buildVoucherJournalRows(vouchers, {
  searchQuery: 'Bank',
});

assert.equal(subjectRows.length, 2, 'search includes posted and reversed entries');
assert.equal(subjectRows[0].subjectCode, '1002');

const reversedVoucher = createReverseVoucher(vouchers[0], '2026-03-31');

assert.notEqual(reversedVoucher.entries[0].id, vouchers[0].entries[0].id, 'reverse entries must get new ids');
assert.equal(reversedVoucher.entries[0].voucherId, reversedVoucher.id, 'reverse entries must point to the new voucher');
assert.equal(reversedVoucher.entries[0].debit, vouchers[0].entries[0].credit);
assert.equal(reversedVoucher.entries[0].credit, vouchers[0].entries[0].debit);

console.log('voucher journal tests passed');
