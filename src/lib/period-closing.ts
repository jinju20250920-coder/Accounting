import type { AccountingPeriod } from '@/stores/useAccountSetStore';
import type { AssetCategory } from '@/types';
import {
  applyMonthlyCheckRuleConfigs,
  buildMonthlyClosingSummary,
  createMonthlyCheckInstances,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
  type MonthlyCheckInstance,
  type MonthlyCheckRuleConfigs,
  type MonthlyClosingBankTransaction,
  type MonthlyClosingInvoice,
  type MonthlyClosingVoucher,
} from './monthly-closing-checks';
import type { AuditLog } from './database/sqlite-service';

export interface PeriodClosingData {
  vouchers: MonthlyClosingVoucher[];
  invoices: MonthlyClosingInvoice[];
  bankTransactions: MonthlyClosingBankTransaction[];
  assetCategories?: AssetCategory[];
  prepaidSubjectCodes?: string[];
}

const LOCKED_PERIOD_STATUSES: AccountingPeriod['status'][] = ['closed', 'locked'];

function getPeriodLockedReason(period: AccountingPeriod) {
  if (period.status === 'closed') return '已关账';
  if (period.status === 'locked') return '已锁定';
  if (period.canEdit === false) return '不可编辑';
  return '';
}

export function findAccountingPeriodForDate(periods: AccountingPeriod[] | undefined, date: string) {
  if (!date || !periods?.length) return null;

  return periods.find((period) => date >= period.startDate && date <= period.endDate) || null;
}

export function isAccountingDateEditable(periods: AccountingPeriod[] | undefined, date: string) {
  const period = findAccountingPeriodForDate(periods, date);
  if (!period) return true;

  return !LOCKED_PERIOD_STATUSES.includes(period.status) && period.canEdit !== false;
}

export function assertAccountingDateEditable(
  periods: AccountingPeriod[] | undefined,
  date: string,
  actionName = '修改业务',
) {
  const period = findAccountingPeriodForDate(periods, date);
  if (!period) return;

  const reason = getPeriodLockedReason(period);
  if (reason) {
    throw new Error(`${actionName}失败：${period.name}期间${reason}，不能继续写入本期数据`);
  }
}

export function assertPeriodCanCloseWithData(
  period: AccountingPeriod,
  data: PeriodClosingData,
  ruleConfigs?: MonthlyCheckRuleConfigs,
  checkOverrides?: Record<string, Partial<MonthlyCheckInstance>>,
) {
  const periodText = `${period.year}-${String(period.month).padStart(2, '0')}`;
  const templates = applyMonthlyCheckRuleConfigs(DEFAULT_MONTHLY_CLOSING_TEMPLATES, ruleConfigs);
  const instances = createMonthlyCheckInstances(periodText, templates).map((instance) => {
    const override = checkOverrides?.[instance.code];
    return override ? { ...instance, ...override } : instance;
  });

  const summary = buildMonthlyClosingSummary({
    period: periodText,
    instances,
    vouchers: data.vouchers,
    invoices: data.invoices,
    bankTransactions: data.bankTransactions,
    assetCategories: data.assetCategories,
    prepaidSubjectCodes: data.prepaidSubjectCodes,
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
