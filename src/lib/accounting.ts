/**
 * 会计引擎核心逻辑
 */

// 常用会计科目代码
const ACCOUNT_CODES = {
  CASH: '1001',
  BANK: '1002',
  AR: '1122',
  PRE_RECEIVABLE: '1123',
  AP: '2202',
  PRE_PAYABLE: '2203',
  INCOME: '6001',
  EXPENSE: '6401',
  FINANCE_EXPENSE: '6603',
  PROFIT: '4103',
  UNALLOCATED_PROFIT: '4104',
  TAX_VAT: '222101',
  CAPITAL: '4001',
  ACCUMULATED_DEPRECIATION: '1502',
  BUILDING_ASSETS: '1601',
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
export function isVoucherBalanced(entries: any[]): boolean {
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
  originalVoucher: any,
  reverseDateParam?: string
): any {
  const reverseNumber = `冲${originalVoucher.voucherNo}`;
  const reverseDate = reverseDateParam || new Date().toISOString().split('T')[0];

  // 创建冲销凭证，所有分录借贷方向相反
  const reversedEntries = originalVoucher.entries.map((entry: any) => ({
    ...entry,
    debit: entry.credit,
    credit: entry.debit,
    summary: `冲销: ${entry.summary}`,
    reverseOf: entry.id
  }));

  return {
    id: generateId(),
    voucherNo: reverseNumber,
    date: reverseDate,
    summary: `冲销凭证 ${originalVoucher.voucherNo}`,
    entries: reversedEntries,
    status: VoucherStatus.REVERSED,
    originalVoucher: originalVoucher.id,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    voucherType: 'reverse'
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
    const subjects = require('./data/subjects.json');
    return subjects.map((subject: any) => ({
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
