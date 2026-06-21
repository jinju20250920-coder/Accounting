/**
 * 会计引擎核心逻辑
 */

import type { Voucher, VoucherEntry } from '@/types';

// 常用会计科目代码
export const ACCOUNT_CODES = {
  // 资产类
  CASH: '1001',
  BANK: '1002',
  FIXED_ASSET: '1501',
  ACCUMULATED_DEPRECIATION: '1502',
  IMPAIRMENT_PROVISION: '1503',
  FIXED_ASSET_CLEARING: '1601',
  CONSTRUCTION_IN_PROGRESS: '1604',
  INTANGIBLE_ASSET: '1701',
  ACCUMULATED_AMORTIZATION: '1702',
  LONG_TERM_PREPAID: '1801',

  // 负债类
  AR: '1122',
  PRE_RECEIVABLE: '1123',
  AP: '2202',
  PRE_PAYABLE: '2203',
  TAX_VAT_INPUT: '222101',
  TAX_VAT_OUTPUT: '222102',

  // 所有者权益
  CAPITAL: '4001',
  PROFIT: '4103',
  UNALLOCATED_PROFIT: '4104',

  // 损益类
  INCOME: '6001',
  NON_OPERATING_INCOME: '6301',
  EXPENSE: '6401',
  FINANCE_EXPENSE: '6603',
  ASSET_IMPAIRMENT_LOSS: '6701',
  NON_OPERATING_EXPENSE: '6711',
} as const;

// 关键词规则类型
interface KeywordRule {
  id: string;
  keyword: string;
  subject: string;
  direction: 'debit' | 'credit';
  priority: number;
}

// 智能匹配结果类型
interface SmartMatchResult {
  subject: string;
  subjectName?: string;
  source: 'rule' | 'user-preference' | 'manual';
  confidence?: number;
}

/**
 * 计算科目余额
 */
export function calculateSubjectBalance(
  openingBalance: number,
  debitTotal: number,
  creditTotal: number,
  direction: 'debit' | 'credit'
): number {
  if (direction === 'debit') {
    return openingBalance + debitTotal - creditTotal;
  } else {
    return openingBalance + creditTotal - debitTotal;
  }
}

/**
 * 生成凭证字号
 */
export function generateVoucherNo(year: number, month: number, seq: number): string {
  const seqStr = seq.toString().padStart(3, '0');
  return `${year}-${month.toString().padStart(2, '0')}-${seqStr}`;
}

/**
 * 计算借贷平衡
 */
export function isVoucherBalanced(entries: Pick<VoucherEntry, 'debit' | 'credit'>[]): boolean {
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  return Math.abs(totalDebit - totalCredit) < 0.01;
}

/**
 * 汇兑损益计算
 */
export function calculateExchangeGainLoss(
  foreignBalance: number,
  baseRate: number,
  endRate: number
): number {
  return foreignBalance * endRate - foreignBalance * baseRate;
}

/**
 * 汇兑损益科目判断
 */
export function determineExchangeGainLossSubject(
  gainLoss: number,
  isAsset: boolean
): 'debit' | 'credit' {
  if (gainLoss >= 0) {
    // 正数=收益
    if (isAsset) {
      // 资产增值=汇兑收益（借方）
      return 'debit';
    } else {
      // 负债增值=汇兑损失（借方）
      return 'credit';
    }
  } else {
    // 负数=损失
    if (isAsset) {
      // 资产减少=汇兑损失（贷方）
      return 'credit';
    } else {
      // 负债减少=汇兑收益（贷方）
      return 'debit';
    }
  }
}

/**
 * 关键词匹配
 */
export function matchSubjectByKeywords(
  summary: string,
  keywordRules: Array<{ keywords: string[]; targetSubject: string; targetDirection: 'debit' | 'credit'; priority: number }>,
  counterparty?: string
): { matched: boolean; subject?: string; confidence?: number } {
  if (!summary) {
    return { matched: false, confidence: 0 };
  }

  const summaryLower = summary.toLowerCase();
  let bestMatch: { matched: boolean; subject?: string; confidence: number } = { matched: false, confidence: 0 };

  for (const rule of keywordRules) {
    if (!rule.targetSubject) continue;

    for (const keyword of rule.keywords) {
      if (summaryLower.includes(keyword.toLowerCase())) {
        const hasCounterparty = counterparty && rule.keywords.some(k =>
          k.includes(counterparty?.toLowerCase() || '')
        );
        const matchScore = (1 / rule.keywords.length) * 100;
        const bonusScore = hasCounterparty ? 10 : 0;

        if (matchScore + bonusScore > bestMatch.confidence) {
          bestMatch = {
            matched: true,
            subject: rule.targetSubject,
            confidence: matchScore + bonusScore
          };
        }
        break;
      }
    }
  }

  return bestMatch;
}

/**
 * 银行流水智能匹配 - 四层优先级
 * 1. 往来单位默认科目（精确匹配对方户名）
 * 2. 用户自定义规则
 * 3. 系统默认规则
 * 4. L2 用户偏好
 */
export interface BankMatchInput {
  summary: string;           // 摘要
  notes?: string;            // 备注
  counterpartyName?: string; // 对方户名
  isDebit: boolean;          // true=银行流水借方(付款/流出), false=银行流水贷方(收款/流入)
}

export interface BankMatchRule {
  keyword: string;
  subjectCode: string;
  subjectName: string;
  direction: 'in' | 'out' | 'both';
  priority: number;
}

export interface BankMatchPartner {
  name: string;
  defaultSubjectCode?: string;
  defaultSubjectName?: string;
}

export interface BankMatchResult {
  subjectCode: string;
  subjectName: string;
  source: 'partner' | 'custom-rule' | 'system-rule' | 'user-preference';
  confidence: number;
  partnerName?: string;
}

export function matchBankTransaction(
  input: BankMatchInput,
  rules: BankMatchRule[],
  partners: BankMatchPartner[],
  userPrefs: Array<{ summary: string; subject: string; subjectName?: string; timestamp: number }>,
): BankMatchResult | null {
  const text = [input.summary, input.notes].filter(Boolean).join(' ');
  const direction: 'in' | 'out' = input.isDebit ? 'out' : 'in';

  // === 第1层：往来单位默认科目 ===
  if (input.counterpartyName) {
    const partner = partners.find(p =>
      p.name === input.counterpartyName ||
      input.counterpartyName.includes(p.name) ||
      p.name.includes(input.counterpartyName)
    );
    if (partner?.defaultSubjectCode) {
      return {
        subjectCode: partner.defaultSubjectCode,
        subjectName: partner.defaultSubjectName || '',
        source: 'partner',
        confidence: 0.95,
        partnerName: partner.name,
      };
    }
  }

  // === 第2层+第3层：自定义规则 + 系统规则 ===
  const enabledRules = rules
    .filter(r => r.direction === 'both' || r.direction === direction)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of enabledRules) {
    if (text.includes(rule.keyword) || rule.keyword.includes(text)) {
      return {
        subjectCode: rule.subjectCode,
        subjectName: rule.subjectName,
        source: rule.priority >= 9 ? 'system-rule' : 'custom-rule',
        confidence: 0.5 + rule.priority / 20,
      };
    }
  }

  // === 第4层：L2 用户偏好 ===
  const l2Matches = userPrefs.filter(pref =>
    text.includes(pref.summary) ||
    pref.summary.includes(text) ||
    text.includes(pref.subject)
  );

  if (l2Matches.length > 0) {
    const best = l2Matches.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
    return {
      subjectCode: best.subject,
      subjectName: best.subjectName || '',
      source: 'user-preference',
      confidence: Math.min(l2Matches.length * 0.15, 0.85),
    };
  }

  // === 第5层：智能推断（有对方户名但无匹配规则） ===
  if (input.counterpartyName && input.counterpartyName.trim().length > 0) {
    if (input.isDebit) {
      // 借方=付款（钱流出）→ 应付账款
      return {
        subjectCode: '2202',
        subjectName: '应付账款',
        source: 'system-rule',
        confidence: 0.4,
        partnerName: input.counterpartyName,
      };
    } else {
      // 贷方=收款（钱流入）→ 应收账款
      return {
        subjectCode: '1122',
        subjectName: '应收账款',
        source: 'system-rule',
        confidence: 0.4,
        partnerName: input.counterpartyName,
      };
    }
  }

  return null;
}

/**
 * AI智能匹配 - Level 1 + Level 2
 * L1（规则先行）: 使用预设的关键词规则
 * L2（上下文学习）: 使用用户历史偏好
 */
export function getSmartMatch(
  summary: string,
  userPrefs: Array<{ summary: string; subject: string; subjectName?: string; timestamp: number }>,
  subjects: Array<{ code: string; name: string }>
): SmartMatchResult | null {
  if (!summary) {
    return null;
  }

  // 1. 尝试 L2：在用户偏好中寻找匹配
  const l2Matches = userPrefs.filter(pref =>
    summary.includes(pref.summary) ||
    pref.summary.includes(summary) ||
    summary.includes(pref.subject)
  );

  // 优先选择匹配度最高的
  if (l2Matches.length > 0) {
    const bestMatch = l2Matches.reduce((best, current) => {
      // 按时间优先，最近的偏好权重更高
      const bestScore = current.timestamp > best.timestamp ? 1 : 0;
      return bestScore ? current : best;
    });

    const subjectName = subjects.find(s => s.code === bestMatch.subject)?.name;

    return {
      subject: bestMatch.subject,
      subjectName,
      source: 'user-preference',
      confidence: Math.min(l2Matches.length * 0.15, 0.95)
    };
  }

  // 2. 尝试 L1：在预设规则中寻找匹配
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rules: KeywordRule[] = require('./data/keyword-rules.json');
    const l1Match = rules.find(rule =>
      summary.includes(rule.keyword) ||
      rule.keyword.includes(summary)
    );

    if (l1Match) {
      const subjectName = subjects.find(s => s.code === l1Match.subject)?.name;

      return {
        subject: l1Match.subject,
        subjectName,
        source: 'rule',
        confidence: 0.6 + (l1Match.priority / 20) // 规则优先级越高，置信度越高
      };
    }
  } catch (error) {
    console.error('Failed to load keyword rules:', error);
  }

  // 3. 无匹配
  return null;
}

/**
 * 凭证状态机管理
 */
export enum VoucherStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  POSTED = 'posted',
  REVERSED = 'reversed'
}

export function calculateVoucherStatus(
  currentStatus: VoucherStatus,
  action: 'save' | 'submit' | 'approve' | 'post' | 'reverse'
): { newStatus: VoucherStatus; isValid: boolean; message: string } {
  const transitions: Record<VoucherStatus, Record<string, VoucherStatus>> = {
    [VoucherStatus.DRAFT]: {
      save: VoucherStatus.DRAFT,
      submit: VoucherStatus.REVIEW,
      approve: VoucherStatus.DRAFT, // DRAFT状态无法直接approve
      post: VoucherStatus.DRAFT,     // DRAFT状态无法直接post
      reverse: VoucherStatus.DRAFT  // DRAFT状态无需reverse
    },
    [VoucherStatus.REVIEW]: {
      save: VoucherStatus.REVIEW,
      submit: VoucherStatus.REVIEW,
      approve: VoucherStatus.POSTED,
      post: VoucherStatus.POSTED,
      reverse: VoucherStatus.DRAFT
    },
    [VoucherStatus.POSTED]: {
      save: VoucherStatus.POSTED,
      submit: VoucherStatus.POSTED,
      approve: VoucherStatus.POSTED,
      post: VoucherStatus.POSTED,
      reverse: VoucherStatus.REVERSED
    },
    [VoucherStatus.REVERSED]: {
      save: VoucherStatus.REVERSED,
      submit: VoucherStatus.REVERSED,
      approve: VoucherStatus.REVERSED,
      post: VoucherStatus.REVERSED,
      reverse: VoucherStatus.REVERSED
    }
  };

  const newStatus = transitions[currentStatus][action];
  const isValid = newStatus !== undefined;

  return {
    newStatus,
    isValid,
    message: isValid
      ? `状态变更: ${currentStatus} → ${newStatus}`
      : `非法操作: ${currentStatus} 状态下无法执行 ${action}`
  };
}

/**
 * 创建冲销凭证
 */
export function createReverseVoucher(
  originalVoucher: Voucher,
  reverseDateParam?: string
): Voucher & {
  originalVoucher: string;
} {
  const reverseVoucherId = generateId();
  const reverseNumber = `冲${originalVoucher.voucherNo}`;
  const reverseDate = reverseDateParam || originalVoucher.date || new Date().toISOString().split('T')[0];

  // 创建冲销凭证，所有分录借贷方向相反
  const reversedEntries = originalVoucher.entries.map((entry: VoucherEntry) => ({
    ...entry,
    id: generateId(),
    voucherId: reverseVoucherId,
    date: reverseDate,
    debit: entry.credit,
    credit: entry.debit,
    summary: `冲销: ${entry.summary}`,
    reverseOf: entry.id
  }));

  return {
    id: reverseVoucherId,
    voucherNo: reverseNumber,
    date: reverseDate,
    summary: `冲销凭证 ${originalVoucher.voucherNo}`,
    entries: reversedEntries,
    status: VoucherStatus.REVERSED,
    originalVoucher: originalVoucher.id,
    createdBy: 'system',
    createTime: new Date().toISOString(),
    voucherType: originalVoucher.voucherType
  };
}

/**
 * 格式化金额
 */
export function formatAmount(amount: number): string {
  const absAmount = Math.abs(amount);
  return absAmount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    style: 'currency',
    currency: 'CNY'
  });
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date): string {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString().split('T')[0];
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取科目列表
 */
export function getSubjects(): Array<{ code: string; name: string }> {
  // 从默认科目数据加载
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const subjects = require('./data/subjects.json') as Array<{ code: string; name: string }>;
    return subjects.map((subject) => ({
      code: subject.code,
      name: subject.name
    }));
  } catch (error) {
    console.error('Failed to load subjects:', error);
    return [];
  }
}

/**
 * 验证科目是否存在
 */
// 账龄模式
export type AgingMode = 'month' | 'year' | 'day';

// 账龄结果类型
export interface AgingResult {
  partner: string;
  partnerType: 'customer' | 'supplier';
  totalAmount: number;
  buckets: {
    current: number;
    overdue1: number;
    overdue2: number;
    overdue3: number;
    overdue6: number;
  };
  agingDistribution: number[];
  lastActivityDate?: string;
  isWriteOff: boolean;
}

export interface AgingDetail {
  id: string;
  voucherNo: string;
  docNo: string;
  date: string;
  summary: string;
  amount: number;
  remainingAmount: number;
  daysOverdue: number;
  bucket: string;
  partnerName: string;
  isWriteOff: boolean;
  subjectCode?: string;
  subjectName?: string;
  recRefNo?: string;
  currencyCode?: string;
  originalAmount?: number;
  exchangeRate?: number;
}

export interface AgingConfig {
  mode: AgingMode;
  asOfDate: string;
  showWriteOff: boolean;
  overdueThreshold: number;
  customBuckets?: number[];
  useCustomBuckets?: boolean;
}

// 计算天数差
export function calculateDaysDifference(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// 获取账龄区间
export function getAgingBucket(days: number, mode: AgingMode, useCustomBuckets: boolean = false, customBuckets: number[] = [30, 90, 180, 365, 730]): string {
  if (useCustomBuckets) {
    // 使用用户自定义的5个区间，保持用户输入的顺序
    if (days <= customBuckets[0]) return 'current';
    if (days <= customBuckets[1]) return 'overdue1';
    if (days <= customBuckets[2]) return 'overdue2';
    if (days <= customBuckets[3]) return 'overdue3';
    if (days <= customBuckets[4]) return 'overdue6';
    return 'overdue6';
  }

  switch (mode) {
    case 'month':
      if (days <= 30) return 'current';
      if (days <= 90) return 'overdue1';
      if (days <= 180) return 'overdue2';
      if (days <= 365) return 'overdue3';
      return 'overdue6';

    case 'year':
      if (days <= 365) return 'current';
      if (days <= 730) return 'overdue1';
      if (days <= 1095) return 'overdue2';
      return 'overdue6';

    case 'day':
      if (days <= 30) return 'current';
      if (days <= 60) return 'overdue1';
      if (days <= 90) return 'overdue2';
      if (days <= 120) return 'overdue3';
      return 'overdue6';

    default:
      return 'current';
  }
}

// 计算账龄分布
export function calculateAgingDistribution(amounts: number[]): number[] {
  const total = amounts.reduce((sum, amt) => sum + amt, 0);
  return amounts.map(amt => total > 0 ? amt / total : 0);
}

// 获取逾期颜色
export function getOverdueColor(days: number, isWriteOff: boolean): string {
  if (isWriteOff) return 'text-gray-400';
  if (days <= 30) return 'text-gray-600';
  if (days <= 90) return 'text-yellow-600';
  if (days <= 180) return 'text-orange-600';
  return 'text-red-600';
}

// 格式化账龄显示
export function formatAging(days: number, mode: AgingMode): string {
  if (mode === 'month') {
    if (days <= 30) return '1个月内';
    if (days <= 90) return '1-3个月';
    if (days <= 180) return '3-6个月';
    if (days <= 365) return '6个月-1年';
    return '1年以上';
  }

  if (mode === 'year') {
    if (days <= 365) return '1年以内';
    if (days <= 730) return '1-2年';
    if (days <= 1095) return '2-3年';
    return '3年以上';
  }

  if (mode === 'day') {
    if (days <= 30) return '1-30天';
    if (days <= 60) return '31-60天';
    if (days <= 90) return '61-90天';
    if (days <= 120) return '91-120天';
    return '120天以上';
  }

  return `${days}天`;
}

// 格式化金额
export function formatMoney(amount: number): string {
  if (amount === 0) return '-';
  return amount.toLocaleString('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  });
}

// 计算账龄数据（基于剩余金额）
export function calculateAgingData(
  entries: VoucherEntry[],
  config: AgingConfig,
  partners: Array<{ code: string; name: string; isCustomer: boolean; isSupplier: boolean }> = [],
  recRelations: Array<{ debitEntryId: string; creditEntryId: string; amount: number }> = [],
  isAccountsReceivable: boolean = true // 新增：区分应收/应付
): AgingResult[] {
  // 1. 按往来单位分组
  const partnerMap = new Map<string, VoucherEntry[]>();

  entries.forEach(entry => {
    let partnerName = entry.customerName || entry.supplierName;

    // 如果没有直接的客户/供应商名称，尝试从辅助核算中获取代码并转换为名称
    if (!partnerName) {
      const partnerCode = entry.auxiliary?.customer || entry.auxiliary?.supplier;
      if (partnerCode) {
        const partner = partners.find(p => p.code === partnerCode);
        partnerName = partner?.name || partnerCode;
      }
    }

    if (partnerName) {
      if (!partnerMap.has(partnerName)) {
        partnerMap.set(partnerName, []);
      }
      partnerMap.get(partnerName)!.push(entry);
    }
  });

  // 2. 计算每个往来单位的账龄（基于剩余金额）
  const agingResults: AgingResult[] = [];

  partnerMap.forEach((entries, partner) => {
    const result: AgingResult = {
      partner,
      partnerType: entries[0].customerName ? 'customer' : 'supplier',
      totalAmount: 0,
      buckets: { current: 0, overdue1: 0, overdue2: 0, overdue3: 0, overdue6: 0 },
      agingDistribution: [],
      isWriteOff: false,
    };

    // 计算每个分录的账龄
    entries.forEach(entry => {
      // 计算该分录的已核销金额
      const relatedRecs = recRelations.filter(rel =>
        rel.debitEntryId === entry.id || rel.creditEntryId === entry.id
      );
      const recAmount = relatedRecs.reduce((sum, rel) => sum + rel.amount, 0);

      // 计算原始金额（带正负方向）
      let amount = 0;
      if (isAccountsReceivable) {
        // 应收账款：借方正数，贷方负数
        amount = entry.debit > 0 ? entry.debit : -entry.credit;
      } else {
        // 应付账款：贷方正数，借方负数
        amount = entry.credit > 0 ? entry.credit : -entry.debit;
      }

      // 计算剩余金额
      let remainingAmount = 0;
      if (amount > 0) {
        // 借方/贷方金额：剩余金额 = 总金额 - 已核销金额
        remainingAmount = amount - recAmount;
        // 如果已全部核销，跳过该分录
        if (remainingAmount <= 0.01) {
          return;
        }
      } else {
        // 贷方/借方金额：剩余金额 = 总金额 + 已核销金额（因为已核销金额是正数）
        remainingAmount = amount + recAmount;
        // 如果已全部核销，跳过该分录
        if (remainingAmount >= -0.01) {
          return;
        }
      }

      const days = calculateDaysDifference(entry.sourceVoucherDate || entry.date, config.asOfDate);
      const bucket = getAgingBucket(days, config.mode, config.useCustomBuckets, config.customBuckets);

      result.totalAmount += remainingAmount;
      result.buckets[bucket as keyof typeof result.buckets] += remainingAmount;

      // 检查是否有核销记录
      if (entry.recRefNo || recAmount > 0) {
        result.isWriteOff = true;
      }
    });

    // 计算分布
    result.agingDistribution = calculateAgingDistribution([
      result.buckets.current,
      result.buckets.overdue1,
      result.buckets.overdue2,
      result.buckets.overdue3,
      result.buckets.overdue6
    ]);

    agingResults.push(result);
  });

  return agingResults.sort((a, b) => b.totalAmount - a.totalAmount);
}

// 获取明细数据
export function getAgingDetails(
  entries: VoucherEntry[],
  config: AgingConfig & { bucket?: string; partner?: string },
  isAccountsReceivable: boolean = true,
  vouchers?: Voucher[], // 新增：可选的凭证列表参数，用于获取真正的凭证号
  recRelations?: Array<{ entryId?: string; debitEntryId?: string; creditEntryId?: string; amount?: number }>, // 新增：可选的核销关系，用于计算剩余金额
  partners: Array<{ code: string; name: string; isCustomer: boolean; isSupplier: boolean }> = []
): AgingDetail[] {
  const details: AgingDetail[] = [];

    // 辅助函数：计算已核销金额
  const getClearedAmount = (entryId: string): number => {
    if (!recRelations) return 0;
    return recRelations
      .filter(rel => rel.debitEntryId === entryId || rel.creditEntryId === entryId)
      .reduce((sum, rel) => sum + rel.amount, 0);
  };

  entries.forEach(entry => {
    let partnerName = entry.customerName || entry.supplierName;

    // 如果没有直接的客户/供应商名称，尝试从辅助核算中获取代码并转换为名称
    if (!partnerName) {
      const partnerCode = entry.auxiliary?.customer || entry.auxiliary?.supplier;
      if (partnerCode) {
        const partner = partners.find(p => p.code === partnerCode);
        partnerName = partner?.name || partnerCode;
      }
    }

    // 按合作伙伴筛选
    if (config.partner && partnerName !== config.partner) {
      return;
    }

    const days = calculateDaysDifference(entry.sourceVoucherDate || entry.date, config.asOfDate);
    const bucket = getAgingBucket(days, config.mode, config.useCustomBuckets, config.customBuckets);

    // 按账龄区间筛选
    if (config.bucket && bucket !== config.bucket) {
      return;
    }

    // 计算金额：应收时借方为正，贷方为负；应付时相反
    let amount = 0;
    let totalAmount = 0;

    if (isAccountsReceivable) {
      // 应收账款：借方为正，贷方为负
      amount = entry.debit > 0 ? entry.debit : -entry.credit;
      totalAmount = entry.debit > 0 ? entry.debit : -entry.credit;
    } else {
      // 应付账款：贷方为正，借方为负
      amount = entry.credit > 0 ? entry.credit : -entry.debit;
      totalAmount = entry.credit > 0 ? entry.credit : -entry.debit;
    }

    // 计算剩余金额：根据金额的正负方向来计算
    const clearedAmount = getClearedAmount(entry.id);
    let remainingAmount = 0;

    if (totalAmount > 0) {
      // 借方金额：剩余金额 = 总金额 - 已核销金额
      remainingAmount = totalAmount - clearedAmount;
    } else {
      // 贷方金额：剩余金额 = 总金额 + 已核销金额（因为已核销金额是正数）
      remainingAmount = totalAmount + clearedAmount;
    }

    // 判断核销状态：剩余金额为0表示完全核销
    const isFullyWrittenOff = Math.abs(remainingAmount) < 0.01;
    const isPartiallyWrittenOff = clearedAmount > 0 && !isFullyWrittenOff;
    const isWriteOff = isFullyWrittenOff;

    // 查找真正的凭证号
    let actualVoucherNo = entry.voucherId;
    if (vouchers) {
      const voucher = vouchers.find(v => v.id === entry.voucherId);
      if (voucher && voucher.voucherNo) {
        actualVoucherNo = voucher.voucherNo;
      }
    }

    details.push({
      id: entry.id,
      voucherNo: actualVoucherNo,
      docNo: entry.docNo || '',
      date: entry.date,
      summary: entry.summary,
      amount: amount,
      remainingAmount: remainingAmount,
      daysOverdue: days,
      bucket,
      partnerName: partnerName,
      isWriteOff: isWriteOff,
      subjectCode: entry.subjectCode,
      subjectName: entry.subjectName,
      recRefNo: entry.recRefNo,
      currencyCode: entry.currencyCode,
      originalAmount: entry.originalAmount,
      exchangeRate: entry.exchangeRate,
    });
  });

  return details.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export function validateSubjectExists(
  subjectCode: string,
  subjects: Array<{ code: string; name: string }>
): { valid: boolean; message?: string } {
  if (!subjectCode || subjectCode.trim() === '') {
    return { valid: true }; // 空科目不验证
  }

  const exists = subjects.some(s => s.code === subjectCode.trim());
  if (!exists) {
    return {
      valid: false,
      message: `科目编号 "${subjectCode}" 不存在，不能录入`
    };
  }
  return { valid: true };
}

// 核销相关方法
export function calculateClearedAmount(relations: Array<{ amount?: number }>): number {
  return relations.reduce((sum, rel) => sum + rel.amount, 0);
}

export function calculateRemainingAmount(totalAmount: number, clearedAmount: number): number {
  return totalAmount - clearedAmount;
}

export function validateClearingAmount(
  entryAmount: number,
  selectedAmount: number,
  remainingAmount: number
): { valid: boolean; message: string } {
  if (selectedAmount <= 0) {
    return { valid: false, message: '核销金额必须大于0' };
  }

  if (selectedAmount > remainingAmount) {
    return { valid: false, message: `核销金额不能超过剩余未核销金额${remainingAmount.toFixed(2)}` };
  }

  return { valid: true, message: '金额验证通过' };
}

export function generateClearingNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `REC-${timestamp}-${randomStr}`;
}

/**
 * 校验账期是否可用于入账
 * @param date 入账日期 (YYYY-MM-DD)
 * @param accountSet 账套信息
 * @returns 校验结果
 */
export function validateAccountingPeriod(
  date: string,
  accountSet: {
    accountingPeriods?: Array<{
      year: number;
      month: number;
      status: string;
      isCurrent?: boolean;
    }>;
  } | null | undefined
): { valid: boolean; error?: string; period?: { year: number; month: number; status: string; isCurrent?: boolean } } {
  if (!accountSet) {
    return { valid: false, error: '账套信息不存在' };
  }

  const period = date.substring(0, 7); // YYYY-MM
  const [year, month] = period.split('-').map(Number);

  const periodData = accountSet.accountingPeriods?.find(
    p => p.year === year && p.month === month
  );

  if (!periodData) {
    return { valid: false, error: `${year}年${month}月账期不存在` };
  }

  if (periodData.status === 'closed') {
    return { valid: false, error: `${year}年${month}月账期已关闭` };
  }

  if (periodData.status === 'locked') {
    return { valid: false, error: `${year}年${month}月账期已锁定` };
  }

  return { valid: true, period: periodData };
}
