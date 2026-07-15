import { describe, it, expect } from 'vitest';
import {
  calculateTaxDeadline, computeCurrentPeriod, deriveFilingStatus,
  getCurrentTaxDeadlines, calculateUrgency, buildDefaultTaxItems,
} from './tax-deadlines';
import type { TaxItem, TaxFiling, TaxHoliday } from '@/types';

const item = (over: Partial<TaxItem>): TaxItem => ({
  id: 'x', tenantId: 't', accountSetId: 's', taxName: 'X', taxType: 'vat',
  deadlineType: 'monthly', deadlineDays: 15, graceDays: 0,
  applicableTaxpayerType: 'both', isBuiltIn: true, isEnabled: true,
  sortOrder: 0, createdAt: '', updatedAt: '', ...over,
});

describe('calculateTaxDeadline', () => {
  it('monthly: June period due July 15', () => {
    const d = calculateTaxDeadline(item({ deadlineType: 'monthly', deadlineDays: 15 }), 2026, 6, []);
    expect(d.getMonth()).toBe(6);  // July (0-based)
    expect(d.getDate()).toBe(15);
  });
  it('monthly: December period (period=12) rolls over to January 15 NEXT YEAR', () => {
    // Dec 2025 taxes are due Jan 15, 2026. new Date(2025, 12, 15) overflows month 12 → Jan 2026.
    const d = calculateTaxDeadline(item({ deadlineType: 'monthly', deadlineDays: 15 }), 2025, 12, []);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);  // January (0-based)
    expect(d.getDate()).toBe(15);
  });
  it('quarterly: Q1 due April 15', () => {
    const d = calculateTaxDeadline(item({ deadlineType: 'quarterly', deadlineDays: 15 }), 2026, 1, []);
    expect(d.getMonth()).toBe(3);  // April
    expect(d.getDate()).toBe(15);
  });
  it('annual: CIT due May 31 next year', () => {
    const d = calculateTaxDeadline(item({ deadlineType: 'annual', deadlineDays: 120 }), 2026, 1, []);
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(4);  // May
    expect(d.getDate()).toBe(31);
  });
  it('rolls weekend forward', () => {
    // July 15 2026 is Wednesday; use Sep 15 = Tuesday. Force a Saturday: Oct 17 2026 = Saturday
    // monthly period=9 (Sep) → due Oct 15 2026 (Thursday). To test weekend, use deadlineDays=17 → Oct 17 Sat → 19 Mon
    const d = calculateTaxDeadline(item({ deadlineType: 'monthly', deadlineDays: 17 }), 2026, 9, []);
    expect(d.getDate()).toBe(19); // Sat 17 → Mon 19
  });
});

describe('computeCurrentPeriod', () => {
  it('monthly in July returns June period', () => {
    const p = computeCurrentPeriod(item({ deadlineType: 'monthly' }), new Date('2026-07-13'));
    expect(p.taxPeriod).toBe('2026-06');
    expect(p.periodLabel).toBe('2026年6月');
  });
  it('monthly in January returns prior-year December', () => {
    const p = computeCurrentPeriod(item({ deadlineType: 'monthly' }), new Date('2026-01-05'));
    expect(p.taxPeriod).toBe('2025-12');
  });
  it('quarterly in May (Q2) returns Q1', () => {
    const p = computeCurrentPeriod(item({ deadlineType: 'quarterly' }), new Date('2026-05-10'));
    expect(p.taxPeriod).toBe('2026-Q1');
    expect(p.periodLabel).toBe('2026年第1季度');
  });
});

describe('deriveFilingStatus', () => {
  const today = new Date('2026-07-13');
  it('isFiled → filed', () => {
    expect(deriveFilingStatus({ isFiled: true, deadline: '2026-07-15' } as TaxFiling, today)).toBe('filed');
  });
  it('not filed, deadline passed → overdue', () => {
    expect(deriveFilingStatus({ isFiled: false, deadline: '2026-07-10' } as TaxFiling, today)).toBe('overdue');
  });
  it('not filed, deadline future → pending', () => {
    expect(deriveFilingStatus({ isFiled: false, deadline: '2026-07-15' } as TaxFiling, today)).toBe('pending');
  });
});

describe('calculateUrgency', () => {
  it('< -grace → urgent', () => { expect(calculateUrgency(-5, 0)).toBe('urgent'); });
  it('0..7 → high', () => { expect(calculateUrgency(3, 0)).toBe('high'); });
  it('8..15 → medium', () => { expect(calculateUrgency(10, 0)).toBe('medium'); });
  it('>15 → low', () => { expect(calculateUrgency(30, 0)).toBe('low'); });
});

describe('getCurrentTaxDeadlines', () => {
  it('merges stored filing status into alerts', () => {
    const items = buildDefaultTaxItems('t', 's', 'small').filter(i => i.id === 'vat-quarterly');
    const today = new Date('2026-07-13');
    // Q2 quarterly period for small taxpayer in July = Q2, due ~July 15
    const filings: TaxFiling[] = [];
    const alerts = getCurrentTaxDeadlines(items, [], filings, today);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].taxItem.id).toBe('vat-quarterly');
    expect(alerts[0].status).toBe('pending'); // nothing filed
  });
});
