import type { AccountingPeriod } from '@/stores/useAccountSetStore';
import {
  buildMonthlyClosingSummary,
  type MonthlyClosingBankTransaction,
  type MonthlyClosingInvoice,
  type MonthlyClosingVoucher,
} from './monthly-closing-checks';
import type { AuditLog } from './database/sqlite-service';

export interface PeriodClosingData {
  vouchers: MonthlyClosingVoucher[];
  invoices: MonthlyClosingInvoice[];
  bankTransactions: MonthlyClosingBankTransaction[];
}

export function assertPeriodCanCloseWithData(period: AccountingPeriod, data: PeriodClosingData) {
  const periodText = `${period.year}-${String(period.month).padStart(2, '0')}`;
  const summary = buildMonthlyClosingSummary({
    period: periodText,
    vouchers: data.vouchers,
    invoices: data.invoices,
    bankTransactions: data.bankTransactions,
  });

  if (!summary.canClose) {
    const blockers = summary.items
      .filter((item) => item.systemStatus === 'blocked' && !item.completed)
      .slice(0, 3)
      .map((item) => item.title)
      .join('、');
    throw new Error(`当前期间存在 ${summary.blockerCount} 个阻塞项，暂不能月结：${blockers}`);
  }

  return summary;
}

export function createPeriodClosingAuditLog(
  period: AccountingPeriod,
  action: 'close' | 'reopen',
  context: {
    accountSetId?: string;
    userId?: string;
    blockerCount?: number;
    warningCount?: number;
  } = {},
): AuditLog {
  return {
    id: `period_${action}_${period.id}_${Date.now()}`,
    type: 'update',
    entityType: 'period',
    entityId: period.id,
    details: JSON.stringify({
      action,
      period: `${period.year}-${String(period.month).padStart(2, '0')}`,
      periodName: period.name,
      blockerCount: context.blockerCount || 0,
      warningCount: context.warningCount || 0,
    }),
    userId: context.userId || 'system',
    timestamp: new Date().toISOString(),
    accountSetId: context.accountSetId,
  };
}
