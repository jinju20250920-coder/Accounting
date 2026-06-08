type AccountingPeriodStatus = 'draft' | 'open' | 'closed' | 'locked';
type AccountingPeriodStatusColor = 'gray' | 'blue' | 'green' | 'red';

export interface SwitchableAccountingPeriod {
  id: string;
  year: number;
  month: number;
  status: AccountingPeriodStatus;
  statusColor: AccountingPeriodStatusColor;
  isCurrent: boolean;
  canEdit: boolean;
  canClose: boolean;
  canReopen: boolean;
}

export interface AccountingPeriodSwitchResult<T extends SwitchableAccountingPeriod> {
  periods: T[];
  currentPeriod: string;
}

export function formatAccountingPeriodValue(period: Pick<SwitchableAccountingPeriod, 'year' | 'month'>): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

export function sortAccountingPeriodsDesc<T extends Pick<SwitchableAccountingPeriod, 'year' | 'month'>>(periods: T[]): T[] {
  return [...periods].sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
}

export function getCurrentAccountingPeriod<T extends Pick<SwitchableAccountingPeriod, 'isCurrent'>>(periods: T[]): T | undefined {
  return periods.find(period => period.isCurrent);
}

export function switchCurrentAccountingPeriod<T extends SwitchableAccountingPeriod>(
  periods: T[],
  targetPeriodId: string,
): AccountingPeriodSwitchResult<T> {
  const targetPeriod = periods.find(period => period.id === targetPeriodId);
  if (!targetPeriod) {
    throw new Error(`Accounting period not found: ${targetPeriodId}`);
  }

  return {
    currentPeriod: formatAccountingPeriodValue(targetPeriod),
    periods: periods.map(period => {
      const isCurrent = period.id === targetPeriodId;
      return {
        ...period,
        isCurrent,
        canEdit: isCurrent && period.status === 'open',
        canClose: isCurrent && period.status === 'open',
        canReopen: !isCurrent && period.status === 'closed',
      };
    }) as T[],
  };
}
