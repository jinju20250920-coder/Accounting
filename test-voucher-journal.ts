import assert from 'node:assert/strict';
import { buildVoucherJournalRows } from './src/lib/voucher-journal';
import type { Voucher } from './src/types';

const vouchers: Voucher[] = [
  {
    id: 'v-posted',
    voucherNo: '记-202603-001',
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
        summary: '支付房租',
        subjectCode: '6602',
        subjectName: '管理费用',
        debit: 1200,
        credit: 0,
        currencyCode: 'CNY',
        auxiliary: { department: '财务部' },
      },
      {
        id: 'e2',
        voucherId: 'v-posted',
        date: '2026-03-03',
        summary: '支付房租',
        subjectCode: '1002',
        subjectName: '银行存款',
        debit: 0,
        credit: 1200,
        currencyCode: 'CNY',
        docNo: 'BANK-001',
      },
    ],
  },
  {
    id: 'v-draft',
    voucherNo: '记-202603-002',
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
        summary: '草稿凭证',
        subjectCode: '1001',
        subjectName: '库存现金',
        debit: 10,
        credit: 0,
      },
    ],
  },
  {
    id: 'v-reversed',
    voucherNo: '记-202603-003',
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
        summary: '已冲销凭证',
        subjectCode: '1002',
        subjectName: '银行存款',
        debit: 10,
        credit: 0,
      },
    ],
  },
];

const rows = buildVoucherJournalRows(vouchers);

assert.equal(rows.length, 2, '凭证序时账默认只展示已记账凭证的有效分录');
assert.deepEqual(rows.map((row) => row.voucherNo), ['记-202603-001', '记-202603-001']);
assert.equal(rows[0].lineNo, 1);
assert.equal(rows[1].lineNo, 2);
assert.equal(rows[0].department, '财务部');
assert.equal(rows[1].docNo, 'BANK-001');

const subjectRows = buildVoucherJournalRows(vouchers, {
  searchQuery: '银行',
});

assert.equal(subjectRows.length, 1, '搜索应匹配科目名称');
assert.equal(subjectRows[0].subjectCode, '1002');

console.log('voucher journal tests passed');
