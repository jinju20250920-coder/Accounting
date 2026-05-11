import assert from 'node:assert/strict';
import { buildSmartAccountingSummary } from './src/lib/smart-accounting-workbench';
import { applySmartAccountingOverrides } from './src/lib/smart-accounting-workbench-state';

const summary = buildSmartAccountingSummary({
  period: '2026-03',
  vouchers: [
    {
      id: 'v1',
      voucherNo: 'J-202603-001',
      date: '2026-03-10',
      status: 'posted',
      entries: [
        { id: 'e1', subjectCode: '6602', subjectName: '管理费用', debit: 1000, credit: 0 },
        { id: 'e2', subjectCode: '1002', subjectName: '银行存款', debit: 0, credit: 1000 },
      ],
    },
  ],
  bankTransactions: [
    {
      id: 'b1',
      date: '2026-03-12',
      status: 'voucher_generated',
      voucherId: 'v1',
    },
  ],
  invoices: [
    {
      id: 'i1',
      invoiceDate: '2026-03-15',
      invoiceType: 'input',
      voucherId: null,
      paymentStatus: 'unpaid',
    },
  ],
});

const overridden = applySmartAccountingOverrides(summary, {
  invoice_voucher_check: {
    status: 'confirmed_not_needed',
    note: '本月没有发票',
    updatedAt: '2026-05-12T10:00:00.000Z',
  },
});

assert.equal(overridden.tasks.find((task) => task.code === 'invoice_voucher_check')?.status, 'confirmed_not_needed');
assert.equal(overridden.tasks.find((task) => task.code === 'invoice_voucher_check')?.isUserEdited, true);
assert.equal(overridden.tasks.find((task) => task.code === 'invoice_voucher_check')?.note, '本月没有发票');
assert.equal(overridden.warningCount, 0, '用户确认无须处理后，提醒数量应下降');
assert.equal(overridden.pendingCount, 1, '用户确认无须处理后，待办数量应下降');
assert.equal(overridden.canClose, true, '确认无须处理后，不应阻塞月结');
assert.equal(
  overridden.risks.some((risk) => risk.code === 'invoice_voucher_missing'),
  false,
  '用户确认无须处理后，应移除对应的发票风险',
);

console.log('smart accounting overrides tests passed');
