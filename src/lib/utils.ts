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

/**
 * 格式化数字（不带货币符号，保留2位小数）
 */
export function formatNumber(amount: number | null | undefined): string {
  return (amount ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 格式化日期为中文格式 (YYYY-MM-DD → YYYY年MM月DD日)
 */
export function formatDateChinese(date: string | null | undefined): string {
  if (!date) return '';
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
}

/**
 * 四舍五入到2位小数
 */
export function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}