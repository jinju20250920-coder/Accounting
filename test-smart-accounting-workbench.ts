import assert from 'node:assert/strict';
import {
  buildSmartAccountingSummaryFromMonthlyClosing,
  buildSmartAccountingSummary,
  type SmartAccountingInput,
} from './src/lib/smart-accounting-workbench';
import { buildMonthlyClosingSummary } from './src/lib/monthly-closing-checks';

const input: SmartAccountingInput = {
  period: '2026-03',
  vouchers: [
    {
      id: 'voucher-1',
      voucherNo: '记-202603-001',
      date: '2026-03-10',
      status: 'posted',
      entries: [
        { id: 'e1', subjectCode: '1501', subjectName: '固定资产', debit: 100000, credit: 0 },
        { id: 'e2', subjectCode: '1002', subjectName: '银行存款', debit: 0, credit: 100000 },
      ],
    },
    {
      id: 'voucher-2',
      voucherNo: '记-202603-002',
      date: '2026-03-12',
      status: 'posted',
      entries: [
        { id: 'e3', subjectCode: '1801', subjectName: '长期待摊费用', debit: 24000, credit: 0 },
        { id: 'e4', subjectCode: '1002', subjectName: '银行存款', debit: 0, credit: 24000 },
      ],
    },
  ],
  bankTransactions: [],
  invoices: [],
};

const summary = buildSmartAccountingSummary(input);

assert.equal(
  summary.tasks.some((task) => task.code === 'invoice_import_check'),
  false,
  '本期没有发票时不应生成发票导入任务',
);

assert.equal(
  summary.risks.some((risk) => risk.code === 'fixed_asset_depreciation_review'),
  true,
  '固定资产相关科目有余额且本期无折旧发生额时应提醒',
);

assert.equal(
  summary.risks.some((risk) => risk.code === 'prepaid_amortization_review'),
  true,
  '待摊费用相关科目有余额且本期无摊销发生额时应提醒',
);

assert.equal(
  summary.risks.some((risk) => risk.code === 'bank_import_missing' && risk.severity === 'warning'),
  true,
  '银行流水本期未导入时应提醒',
);

assert.equal(summary.nextActions[0].targetRoute, '/import');

const keySubjectSummary = buildSmartAccountingSummary({
  period: '2026-03',
  vouchers: [
    {
      id: 'voucher-prev',
      voucherNo: 'J-202602-001',
      date: '2026-02-20',
      status: 'posted',
      entries: [
        { id: 'e-prev', subjectCode: '1122', subjectName: '应收账款', debit: 10000, credit: 0 },
      ],
    },
  ],
  bankTransactions: [
    {
      id: 'bank-ok',
      date: '2026-03-01',
      status: 'voucher_generated',
      voucherId: 'voucher-bank',
    },
  ],
  invoices: [],
});

assert.equal(
  keySubjectSummary.risks.some((risk) => risk.code === 'key_subject_no_activity_review'),
  true,
  '重点科目有余额但本期无变化时，首页工作台应提醒用户确认是否正常',
);

assert.equal(
  keySubjectSummary.tasks.some((task) => task.code === 'key_subject_no_activity_check'),
  true,
  '重点科目确认应作为首页工作台任务展示',
);

const monthlyBankBlocked = buildMonthlyClosingSummary({
  period: '2026-03',
  vouchers: [],
  bankTransactions: [{ id: 'bank-3', date: '2026-03-08', status: 'imported' }],
  invoices: [],
});
const linkedBankBlocked = buildSmartAccountingSummaryFromMonthlyClosing(input, monthlyBankBlocked);
assert.equal(
  linkedBankBlocked.tasks.some((task) => task.code === 'bank_import_and_voucher'),
  true,
  'smart workbench should expose monthly closing check items as tasks',
);
assert.equal(
  linkedBankBlocked.canClose,
  false,
  'smart workbench close status should follow monthly closing blockers',
);

const monthlyBankDisabled = buildMonthlyClosingSummary({
  period: '2026-03',
  vouchers: [],
  bankTransactions: [{ id: 'bank-4', date: '2026-03-08', status: 'imported' }],
  invoices: [],
  ruleConfigs: {
    bank_import_and_voucher: { enabled: false },
  },
});
const linkedBankDisabled = buildSmartAccountingSummaryFromMonthlyClosing(input, monthlyBankDisabled);
assert.equal(
  linkedBankDisabled.tasks.some((task) => task.code === 'bank_import_and_voucher'),
  false,
  'disabled monthly closing rules should disappear from smart workbench tasks',
);
assert.equal(
  linkedBankDisabled.risks.some((risk) => risk.code === 'bank_import_and_voucher'),
  false,
  'disabled monthly closing rules should not create smart workbench risks',
);

const monthlyBankWarningOnly = buildMonthlyClosingSummary({
  period: '2026-03',
  vouchers: [],
  bankTransactions: [{ id: 'bank-5', date: '2026-03-08', status: 'imported' }],
  invoices: [],
  ruleConfigs: {
    bank_import_and_voucher: { severity: 'warning', blockClosing: false },
  },
});
const linkedBankWarningOnly = buildSmartAccountingSummaryFromMonthlyClosing(input, monthlyBankWarningOnly);
assert.equal(
  linkedBankWarningOnly.canClose,
  true,
  'smart workbench should allow closing when monthly rule config downgrades a blocker to warning-only',
);

console.log('smart accounting workbench tests passed');
