import assert from 'node:assert/strict';
import {
  buildSmartAccountingSummary,
  type SmartAccountingInput,
} from './src/lib/smart-accounting-workbench';

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

console.log('smart accounting workbench tests passed');
