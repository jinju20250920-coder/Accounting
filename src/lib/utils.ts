import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * 合并类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 获取月份的最后一天日期 (YYYY-MM-DD 格式)
 * @param year 年份
 * @param month 月份 (1-12)
 */
export function getMonthEndDate(year: number, month: number): string {
  const endDateObj = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
}

/**
 * 获取月份的开始日期 (YYYY-MM-01)
 * @param year 年份
 * @param month 月份 (1-12)
 */
export function getMonthStartDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}