import { describe, it, expect } from 'vitest';
import { adjustToWorkday, isWorkday } from './tax-holidays';
import type { TaxHoliday } from '@/types';

const H = (date: string, type: 'holiday' | 'workday'): TaxHoliday => ({
  id: date, date, name: 'x', type, isBuiltIn: true,
});

describe('isWorkday', () => {
  it('weekday with no holiday is a workday', () => {
    expect(isWorkday(new Date('2026-07-13'), [])).toBe(true); // Monday
  });
  it('Saturday is not a workday', () => {
    expect(isWorkday(new Date('2026-07-18'), [])).toBe(false); // Saturday
  });
  it('Sunday is not a workday', () => {
    expect(isWorkday(new Date('2026-07-19'), [])) .toBe(false); // Sunday
  });
  it('weekday that is a holiday is not a workday', () => {
    expect(isWorkday(new Date('2026-01-01'), [H('2026-01-01', 'holiday')])).toBe(false);
  });
  it('weekend that is a workday override IS a workday', () => {
    expect(isWorkday(new Date('2026-02-07'), [H('2026-02-07', 'workday')])).toBe(true); // Sat 调休补班
  });
});

describe('adjustToWorkday', () => {
  it('weekday unchanged', () => {
    expect(adjustToWorkday(new Date('2026-07-13'), []).getTime()).toBe(new Date('2026-07-13').getTime());
  });
  it('Saturday rolls to Monday', () => {
    expect(adjustToWorkday(new Date('2026-07-18'), []).getDate()).toBe(20); // → Mon 20
  });
  it('Sunday rolls to Monday', () => {
    expect(adjustToWorkday(new Date('2026-07-19'), []).getDate()).toBe(20);
  });
  it('holiday on weekday rolls forward to next non-holiday weekday', () => {
    // 2026-01-01 Thu holiday → Fri 02 (no holiday) = workday
    expect(adjustToWorkday(new Date('2026-01-01'), [H('2026-01-01', 'holiday')]).getDate()).toBe(2);
  });
  it('consecutive holidays + weekend roll past all', () => {
    // Oct 1-7 holiday (National Day). Oct 1 2026 = Thursday. Roll to Oct 8.
    const holidays: TaxHoliday[] = [];
    for (let d = 1; d <= 7; d++) {
      holidays.push(H(`2026-10-0${d}`, 'holiday'));
    }
    expect(adjustToWorkday(new Date('2026-10-01'), holidays).getDate()).toBe(8);
  });
  it('workday override on a weekend prevents rolling', () => {
    // Sat 2026-02-07 is a 调休补班 workday → unchanged
    expect(adjustToWorkday(new Date('2026-02-07'), [H('2026-02-07', 'workday')]).getDate()).toBe(7);
  });
});
