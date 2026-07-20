import type { TaxHoliday } from '@/types';

export type { TaxHoliday } from '@/types';

/** 判断某日是否为工作日（周一至周五且非 holiday；或 workday 调休补班日） */
export function isWorkday(date: Date, holidays: TaxHoliday[]): boolean {
  const iso = toISODate(date);
  const match = holidays.find(h => h.date === iso);
  if (match?.type === 'workday') return true;   // 调休补班 → 工作日
  if (match?.type === 'holiday') return false;  // 放假
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;                // 普通工作日
}

/** 将截止日顺延到下一个工作日 */
export function adjustToWorkday(date: Date, holidays: TaxHoliday[]): Date {
  const d = new Date(date);
  let guard = 0;
  while (!isWorkday(d, holidays) && guard < 30) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 2026 年中国法定节假日 + 调休（来源：国务院通知） */
export const SEED_HOLIDAYS_2026: TaxHoliday[] = [
  // 元旦
  hid('2026-01-01', '元旦', 'holiday'),
  // 春节 2.17-2.23 放假，2.15(日) 2.28(六) 补班
  hid('2026-02-17', '春节', 'holiday'), hid('2026-02-18', '春节', 'holiday'),
  hid('2026-02-19', '春节', 'holiday'), hid('2026-02-20', '春节', 'holiday'),
  hid('2026-02-21', '春节', 'holiday'), hid('2026-02-22', '春节', 'holiday'),
  hid('2026-02-23', '春节', 'holiday'),
  hid('2026-02-15', '春节调休', 'workday'), hid('2026-02-28', '春节调休', 'workday'),
  // 清明 4.4-4.6
  hid('2026-04-04', '清明节', 'holiday'), hid('2026-04-05', '清明节', 'holiday'),
  hid('2026-04-06', '清明节', 'holiday'),
  // 劳动节 5.1-5.5，4.26(日) 补班
  hid('2026-05-01', '劳动节', 'holiday'), hid('2026-05-02', '劳动节', 'holiday'),
  hid('2026-05-03', '劳动节', 'holiday'), hid('2026-05-04', '劳动节', 'holiday'),
  hid('2026-05-05', '劳动节', 'holiday'), hid('2026-04-26', '劳动节调休', 'workday'),
  // 端午 6.19-6.21
  hid('2026-06-19', '端午节', 'holiday'), hid('2026-06-20', '端午节', 'holiday'),
  hid('2026-06-21', '端午节', 'holiday'),
  // 中秋+国庆 10.1-10.8，9.27(日) 10.10(六) 补班
  hid('2026-10-01', '国庆节', 'holiday'), hid('2026-10-02', '国庆节', 'holiday'),
  hid('2026-10-03', '国庆节', 'holiday'), hid('2026-10-04', '中秋节', 'holiday'),
  hid('2026-10-05', '国庆节', 'holiday'), hid('2026-10-06', '国庆节', 'holiday'),
  hid('2026-10-07', '国庆节', 'holiday'), hid('2026-10-08', '国庆节', 'holiday'),
  hid('2026-09-27', '国庆调休', 'workday'), hid('2026-10-10', '国庆调休', 'workday'),
];

/**
 * 2027 年 — 国务院通知通常在 2026 年 11 月底发布（参考 2026 年通知国办发明电〔2025〕22号）。
 * 通知发布前只放元旦（法律固定 1 月 1 日，无歧义），其余节假日为农历/调休，未发布前不预测。
 * 空数组即回退到仅周末顺延（`isWorkday` 行为安全，不会把截止日误推到假日）。
 * 发布后请按通知补全放假 + 调休补班。
 */
export const SEED_HOLIDAYS_2027: TaxHoliday[] = [
  hid('2027-01-01', '元旦', 'holiday'),
];

function hid(date: string, name: string, type: 'holiday' | 'workday'): TaxHoliday {
  return { id: `h-${date}`, date, name, type, isBuiltIn: true };
}
