import assert from 'node:assert/strict';
import {
  buildMonthlyClosingSummary,
  createMonthlyCheckInstances,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
  type MonthlyClosingInput,
  type MonthlyCheckTemplate,
} from './src/lib/monthly-closing-checks';
import {
  assertPeriodCanCloseWithData,
  createPeriodClosingAuditLog,
} from './src/lib/period-closing';
import type { AccountingPeriod } from './src/stores/useAccountSetStore';

assert.equal(DEFAULT_MONTHLY_CLOSING_TEMPLATES.length, 22, 'default template should contain 22 closing checks');
assert.equal(new Set(DEFAULT_MONTHLY_CLOSING_TEMPLATES.map((item) => item.module)).size, 10, 'default template should cover 10 modules');

const bankUnpostedInput: MonthlyClosingInput = {
  period: '2026-03',
  vouchers: [],
  bankTransactions: [
    { id: 'bank-1', date: '2026-03-05', status: 'imported' },
    { id: 'bank-2', date: '2026-03-06', status: 'voucher_generated', voucherId: 'voucher-1' },
  ],
  invoices: [],
};

const bankUnpostedSummary = buildMonthlyClosingSummary(bankUnpostedInput);
const bankVoucherCheck = bankUnpostedSummary.items.find((item) => item.code === 'bank_import_and_voucher');
assert.equal(bankVoucherCheck?.systemStatus, 'blocked');
assert.equal(bankVoucherCheck?.blockClosing, true);
assert.equal(bankUnpostedSummary.blockerCount, 1);
assert.equal(bankUnpostedSummary.canClose, false);

const noBankSummary = buildMonthlyClosingSummary({
  period: '2026-03',
  vouchers: [],
  bankTransactions: [],
  invoices: [],
});
const noBankCheck = noBankSummary.items.find((item) => item.code === 'bank_import_and_voucher');
assert.equal(noBankCheck?.systemStatus, 'warning');
assert.equal(noBankCheck?.blockClosing, false, 'no bank flow should require confirmation, not block by default');

const subjectReviewSummary = buildMonthlyClosingSummary({
  period: '2026-03',
  vouchers: [
    {
      id: 'v-prev',
      voucherNo: 'J-202602-001',
      date: '2026-02-20',
      status: 'posted',
      entries: [
        { id: 'e1', subjectCode: '1122', subjectName: 'Accounts receivable', debit: 10000, credit: 0 },
      ],
    },
  ],
  bankTransactions: [],
  invoices: [],
});
const subjectReview = subjectReviewSummary.items.find((item) => item.code === 'gl_key_subject_no_activity');
assert.equal(subjectReview?.systemStatus, 'warning');
assert.match(subjectReview?.systemMessage || '', /1122/);

const customTemplates: MonthlyCheckTemplate[] = DEFAULT_MONTHLY_CLOSING_TEMPLATES.map((template) =>
  template.code === 'bank_import_and_voucher'
    ? { ...template, owner: '张会计', blockClosing: true }
    : template,
);

const marchInstances = createMonthlyCheckInstances('2026-03', customTemplates);
marchInstances[0].manualStatus = 'completed';
marchInstances[0].note = 'March result';

const aprilInstances = createMonthlyCheckInstances('2026-04', customTemplates, marchInstances);
const aprilBank = aprilInstances.find((item) => item.code === 'bank_import_and_voucher');
assert.equal(aprilBank?.owner, '张会计');
assert.equal(aprilBank?.blockClosing, true);
assert.equal(aprilBank?.manualStatus, 'unchecked', 'new month should not inherit previous completion result');
assert.equal(aprilBank?.note, undefined, 'new month should not inherit previous notes');

const closablePeriod: AccountingPeriod = {
  id: '202603',
  name: '2026年3月',
  year: 2026,
  month: 3,
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  status: 'open',
  statusColor: 'blue',
  voucherCount: 0,
  lastVoucherNo: '记-202603-000',
  isCurrent: true,
  canEdit: true,
  canClose: true,
  canReopen: false,
};

assert.throws(
  () => assertPeriodCanCloseWithData(closablePeriod, {
    vouchers: [],
    invoices: [],
    bankTransactions: [
      { id: 'bank-unposted', date: '2026-03-08', status: 'imported' },
    ],
  }),
  /银行流水/,
  '关账前检查必须使用真实银行流水阻断未生成凭证的流水',
);

const closingLog = createPeriodClosingAuditLog(closablePeriod, 'close', {
  accountSetId: 'account-set-1',
  userId: 'user-admin',
  blockerCount: 0,
  warningCount: 1,
});

assert.equal(closingLog.type, 'update');
assert.equal(closingLog.entityType, 'period');
assert.equal(closingLog.entityId, '202603');
assert.match(closingLog.details, /close/);
assert.equal(closingLog.accountSetId, 'account-set-1');

console.log('monthly closing checks tests passed');
