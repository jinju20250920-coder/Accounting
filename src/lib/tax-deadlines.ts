// 税务申报期限管理系统（数据驱动版）
import type {
  TaxItem, TaxFiling, TaxHoliday, TaxDeadlineAlert, TaxFilingStatus, TaxType,
} from '@/types';
import { adjustToWorkday } from './tax-holidays';

export type { TaxDeadlineAlert } from '@/types';

/** 预置税种模板（seed 到 tax_items 表，按纳税人类型过滤） */
export interface TaxItemSeed {
  id: string;
  taxName: string;
  taxType: TaxType;
  deadlineType: TaxItem['deadlineType'];
  deadlineDays: number;
  graceDays: number;
  applicableTaxpayerType: TaxItem['applicableTaxpayerType'];
  description: string;
  sortOrder: number;
}

export const CHINA_TAX_SEEDS: TaxItemSeed[] = [
  si('vat-monthly', '增值税(月报)', 'vat', 'monthly', 15, 0, 'general', '一般纳税人按月申报增值税', 1),
  si('vat-quarterly', '增值税(季报)', 'vat', 'quarterly', 15, 0, 'small', '小规模纳税人按季申报增值税', 2),
  si('corporate-quarterly', '企业所得税(季报)', 'corporate', 'quarterly', 15, 0, 'both', '季度预缴企业所得税', 3),
  si('corporate-annual', '企业所得税(年报)', 'corporate', 'annual', 120, 15, 'both', '企业所得税年度汇算清缴(次年5月31日)', 4),
  si('personal-monthly', '个人所得税', 'personal', 'monthly', 15, 0, 'both', '个人所得税代扣代缴申报', 5),
  si('consumption-monthly', '消费税', 'consumption', 'monthly', 15, 0, 'both', '消费税按月申报', 6),
  si('stamp-duty', '印花税', 'stamp', 'quarterly', 15, 0, 'both', '印花税按季申报', 7),
  si('property-tax', '房产税', 'property', 'annual', 180, 0, 'both', '房产税（分期缴纳）', 8),
  si('land-use-tax', '城镇土地使用税', 'land_use', 'annual', 180, 0, 'both', '城土使用税', 9),
  si('vehicle-tax', '车船税', 'vehicle', 'annual', 180, 0, 'both', '车船税', 10),
  si('land-value-tax', '土地增值税', 'land_value', 'quarterly', 15, 0, 'both', '土地增值税按季申报', 11),
  si('city-construction', '城市维护建设税', 'city_construction', 'monthly', 15, 0, 'both', '城建税（随增值税/消费税）', 12),
  si('education-surcharge', '教育费附加', 'education_surcharge', 'monthly', 15, 0, 'both', '教育费附加', 13),
  si('local-education', '地方教育附加', 'local_education', 'monthly', 15, 0, 'both', '地方教育附加', 14),
  si('environmental-tax', '环境保护税', 'environmental', 'quarterly', 15, 0, 'both', '环保税按季申报', 15),
  si('disability-fund', '残疾人就业保障金', 'disability', 'annual', 300, 0, 'both', '残保金（年度）', 16),
];

function si(id: string, taxName: string, taxType: TaxType, deadlineType: TaxItem['deadlineType'],
           deadlineDays: number, graceDays: number, applicable: TaxItem['applicableTaxpayerType'],
           description: string, sortOrder: number): TaxItemSeed {
  return { id, taxName, taxType, deadlineType, deadlineDays, graceDays, applicableTaxpayerType: applicable, description, sortOrder };
}

/** 为某账套生成默认 tax_items（首次进入税务页 seed） */
export function buildDefaultTaxItems(tenantId: string, accountSetId: string, taxpayerType: 'small' | 'general'): TaxItem[] {
  const now = new Date().toISOString();
  return CHINA_TAX_SEEDS
    .filter(s => s.applicableTaxpayerType === 'both' || s.applicableTaxpayerType === taxpayerType)
    .map(s => ({
      id: s.id, tenantId, accountSetId, taxName: s.taxName, taxType: s.taxType,
      deadlineType: s.deadlineType, deadlineDays: s.deadlineDays, graceDays: s.graceDays,
      applicableTaxpayerType: s.applicableTaxpayerType, isBuiltIn: true, isEnabled: true,
      sortOrder: s.sortOrder, description: s.description, createdAt: now, updatedAt: now,
    }));
}

/** 计算某税种某期的截止申报日（含节假日顺延） */
export function calculateTaxDeadline(taxItem: TaxItem, year: number, period: number, holidays: TaxHoliday[]): Date {
  let base: Date;
  switch (taxItem.deadlineType) {
    case 'monthly':
      // period = 税款所属月(1-12)。次月 deadlineDays 日。JS month index = period → 自然指向次月。
      base = new Date(year, period, taxItem.deadlineDays);
      break;
    case 'quarterly':
      // period = 季度(1-4)。季末月的次月 deadlineDays 日。
      base = new Date(year, period * 3, taxItem.deadlineDays);
      break;
    case 'half_yearly':
      base = new Date(year, period <= 1 ? 6 : 12, taxItem.deadlineDays);
      break;
    case 'annual':
      // 年度（如汇算清缴）：次年 5 月 31 日
      base = new Date(year + 1, 4, 31);
      break;
  }
  return adjustToWorkday(base, holidays);
}

/** 计算某税种"当前待申报期" */
export function computeCurrentPeriod(taxItem: TaxItem, today: Date): { taxPeriod: string; periodLabel: string; deadline: string } {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  let taxPeriod: string, periodLabel: string, periodNum: number, calcYear = y;

  switch (taxItem.deadlineType) {
    case 'monthly': {
      const pm = m === 1 ? 12 : m - 1;
      if (m === 1) calcYear = y - 1;
      taxPeriod = `${calcYear}-${String(pm).padStart(2, '0')}`;
      periodLabel = `${calcYear}年${pm}月`;
      periodNum = pm;
      break;
    }
    case 'quarterly':
    case 'half_yearly': {
      const curQ = Math.ceil(m / 3);
      const lastQ = curQ === 1 ? 4 : curQ - 1;
      if (curQ === 1) calcYear = y - 1;
      taxPeriod = `${calcYear}-Q${lastQ}`;
      periodLabel = `${calcYear}年第${lastQ}季度`;
      periodNum = lastQ;
      break;
    }
    case 'annual': {
      taxPeriod = `${y - 1}`;
      periodLabel = `${y - 1}年度`;
      periodNum = 1;
      break;
    }
  }
  const deadline = calculateTaxDeadline(taxItem, calcYear, periodNum, []); // holidays 注入由调用方
  return { taxPeriod, periodLabel, deadline: toISO(deadline) };
}

export function deriveFilingStatus(filing: { isFiled: boolean; deadline: string }, today: Date): TaxFilingStatus {
  if (filing.isFiled) return 'filed';
  const dl = new Date(filing.deadline);
  dl.setHours(0, 0, 0, 0);
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  return dl.getTime() < t.getTime() ? 'overdue' : 'pending';
}

export function calculateDaysRemaining(deadline: string | Date, today = new Date()): number {
  const dl = new Date(deadline); dl.setHours(0, 0, 0, 0);
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  return Math.ceil((dl.getTime() - t.getTime()) / 86400000);
}

export function calculateUrgency(daysRemaining: number, graceDays: number): TaxDeadlineAlert['urgency'] {
  if (daysRemaining < -graceDays) return 'urgent';
  if (daysRemaining < 0) return 'high';
  if (daysRemaining <= 7) return 'high';
  if (daysRemaining <= 15) return 'medium';
  return 'low';
}

export function getUrgencyConfig(u: TaxDeadlineAlert['urgency']) {
  return {
    low: { color: 'bg-green-50 text-green-600', label: '正常', icon: '✅' },
    medium: { color: 'bg-yellow-50 text-yellow-600', label: '注意', icon: '⚠️' },
    high: { color: 'bg-orange-50 text-orange-600', label: '紧急', icon: '🚨' },
    urgent: { color: 'bg-red-50 text-red-600', label: '超期', icon: '🔥' },
  }[u];
}

/**
 * 合并 alerts：对每个启用的 taxItem 计算当前待申报期，匹配已落库 filing，
 * 用 deriveFilingStatus 决定状态。零写入。
 */
export function getCurrentTaxDeadlines(
  taxItems: TaxItem[],
  holidays: TaxHoliday[],
  filings: TaxFiling[],
  today = new Date(),
): TaxDeadlineAlert[] {
  const alerts: TaxDeadlineAlert[] = [];
  for (const item of taxItems.filter(i => i.isEnabled)) {
    const { taxPeriod, periodLabel } = computeCurrentPeriod(item, today);
    const filing = filings.find(f => f.taxItemId === item.id && f.taxPeriod === taxPeriod);
    // 重算含节假日的真实截止日
    const periodNum = parsePeriodNum(taxPeriod, item.deadlineType);
    const calcYear = parsePeriodYear(taxPeriod);
    const dl = calculateTaxDeadline(item, calcYear, periodNum, holidays);
    const deadlineISO = toISO(dl);
    const status = filing
      ? deriveFilingStatus(filing, today)
      : deriveFilingStatus({ isFiled: false, deadline: deadlineISO }, today);
    const daysRemaining = calculateDaysRemaining(dl, today);
    alerts.push({
      taxItem: item, taxPeriod, periodLabel, deadline: deadlineISO,
      status, daysRemaining, urgency: calculateUrgency(daysRemaining, item.graceDays), filing,
    });
  }
  return alerts.sort((a, b) => {
    // filed 最后，其余按剩余天数升序
    if (a.status === 'filed' && b.status !== 'filed') return 1;
    if (b.status === 'filed' && a.status !== 'filed') return -1;
    return a.daysRemaining - b.daysRemaining;
  });
}

function parsePeriodNum(taxPeriod: string, type: TaxItem['deadlineType']): number {
  if (type === 'quarterly' || type === 'half_yearly') return Number(taxPeriod.split('Q')[1]);
  if (type === 'annual') return 1;
  return Number(taxPeriod.split('-')[1]); // monthly 'YYYY-MM'
}
function parsePeriodYear(taxPeriod: string): number {
  return Number(taxPeriod.split('-')[0]);
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 向后兼容：旧导出名（TaxDeadlineReminder 旧实现引用）。保留至 Task 10 改造完成。
export type TaxDeadline = TaxItemSeed;
