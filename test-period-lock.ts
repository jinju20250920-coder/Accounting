import assert from 'node:assert/strict';
import {
  assertAccountingDateEditable,
  findAccountingPeriodForDate,
  isAccountingDateEditable,
} from './src/lib/period-closing';
import type { AccountingPeriod } from './src/stores/useAccountSetStore';

const periods: AccountingPeriod[] = [
  {
    id: '202603',
    name: '2026年3月',
    year: 2026,
    month: 3,
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    status: 'closed',
    statusColor: 'green',
    voucherCount: 12,
    lastVoucherNo: '记-202603-012',
    isCurrent: false,
    canEdit: false,
    canClose: false,
    canReopen: true,
  },
  {
    id: '202604',
    name: '2026年4月',
    year: 2026,
    month: 4,
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    status: 'open',
    statusColor: 'blue',
    voucherCount: 2,
    lastVoucherNo: '记-202604-002',
    isCurrent: true,
    canEdit: true,
    canClose: true,
    canReopen: false,
  },
  {
    id: '202605',
    name: '2026年5月',
    year: 2026,
    month: 5,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    status: 'locked',
    statusColor: 'red',
    voucherCount: 0,
    lastVoucherNo: '记-202605-000',
    isCurrent: false,
    canEdit: false,
    canClose: false,
    canReopen: false,
  },
];

assert.equal(findAccountingPeriodForDate(periods, '2026-03-15')?.id, '202603');
assert.equal(findAccountingPeriodForDate(periods, '2026-04-30')?.id, '202604');
assert.equal(findAccountingPeriodForDate(periods, '2026-06-01'), null);

assert.equal(isAccountingDateEditable(periods, '2026-04-08'), true);
assert.equal(isAccountingDateEditable(periods, '2026-03-08'), false);
assert.equal(isAccountingDateEditable(periods, '2026-05-08'), false);
assert.equal(isAccountingDateEditable([], '2026-03-08'), true);

assert.doesNotThrow(() => assertAccountingDateEditable(periods, '2026-04-08', '保存凭证'));
assert.throws(
  () => assertAccountingDateEditable(periods, '2026-03-08', '保存凭证'),
  /保存凭证.*2026年3月.*已关账/,
);
assert.throws(
  () => assertAccountingDateEditable(periods, '2026-05-08', '过账凭证'),
  /过账凭证.*2026年5月.*已锁定/,
);

console.log('period lock tests passed');
