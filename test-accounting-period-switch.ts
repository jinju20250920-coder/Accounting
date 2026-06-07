import assert from 'node:assert/strict';
import { switchCurrentAccountingPeriod, type SwitchableAccountingPeriod } from './src/lib/accounting-period-switch';

type AccountingPeriod = SwitchableAccountingPeriod & {
  name: string;
  startDate: string;
  endDate: string;
  voucherCount: number;
  lastVoucherNo: string;
};

const periods: AccountingPeriod[] = [
  {
    id: '202711',
    name: '2027\u5e7411\u6708',
    year: 2027,
    month: 11,
    startDate: '2027-11-01',
    endDate: '2027-11-30',
    status: 'closed',
    statusColor: 'green',
    voucherCount: 3,
    lastVoucherNo: '\u8bb0-202711-003',
    isCurrent: false,
    canEdit: false,
    canClose: false,
    canReopen: true,
  },
  {
    id: '202712',
    name: '2027\u5e7412\u6708',
    year: 2027,
    month: 12,
    startDate: '2027-12-01',
    endDate: '2027-12-31',
    status: 'open',
    statusColor: 'blue',
    voucherCount: 0,
    lastVoucherNo: '',
    isCurrent: true,
    canEdit: true,
    canClose: true,
    canReopen: false,
  },
];

const result = switchCurrentAccountingPeriod(periods, '202711');

assert.equal(result.currentPeriod, '2027-11');
assert.deepEqual(
  result.periods.map(period => ({
    id: period.id,
    status: period.status,
    statusColor: period.statusColor,
    isCurrent: period.isCurrent,
    canEdit: period.canEdit,
    canClose: period.canClose,
    canReopen: period.canReopen,
  })),
  [
    {
      id: '202711',
      status: 'open',
      statusColor: 'blue',
      isCurrent: true,
      canEdit: true,
      canClose: true,
      canReopen: false,
    },
    {
      id: '202712',
      status: 'closed',
      statusColor: 'green',
      isCurrent: false,
      canEdit: false,
      canClose: false,
      canReopen: true,
    },
  ],
);

assert.throws(
  () => switchCurrentAccountingPeriod(periods, '202710'),
  /Accounting period not found/,
);

console.log('accounting period switch ok');
