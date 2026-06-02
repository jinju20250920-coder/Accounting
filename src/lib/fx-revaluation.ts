/**
 * 汇兑损益重估引擎
 *
 * 接受外币银行余额 + 应收/应付未核销余额，
 * 按期末中间价重估，产生预览行和平衡凭证。
 */

import type { FxRate, FxRevaluationRun, FxRevaluationRunLine, Voucher, VoucherEntry } from '@/types';

// ─── 输入类型 ───

export interface FxRevaluationBankBalance {
  accountId: string;
  accountNumber: string;
  bankName?: string;
  currencyCode: string;
  /** 外币原币余额（正=借方，负=贷方） */
  originalAmount: number;
  /** 账面本币余额 */
  bookValueBase: number;
  /** 对应科目代码（如 1002.01） */
  subjectCode: string;
  subjectName: string;
}

export interface FxRevaluationOpenItem {
  itemId: string;
  moduleName: 'receivable' | 'payable';
  partnerName: string;
  currencyCode: string;
  /** 原币未核销余额 */
  originalAmount: number;
  /** 账面本币余额 */
  bookValueBase: number;
  /** 入账时汇率 */
  lockedRate?: number;
  subjectCode: string;
  subjectName: string;
}

export interface FxRevaluationInput {
  period: string;
  baseCurrency: string;
  /** 期末汇率列表 */
  fxRates: FxRate[];
  /** 外币银行账户余额 */
  bankBalances: FxRevaluationBankBalance[];
  /** 应收/应付外币未核销余额 */
  openItems: FxRevaluationOpenItem[];
  /** 汇兑损失科目代码 */
  gainLossSubjectCode: string;
  /** 汇兑损失科目名称 */
  gainLossSubjectName: string;
}

// ─── 输出类型 ───

export interface FxRevaluationPreviewLine {
  sourceType: 'bank' | 'receivable' | 'payable';
  sourceId: string;
  sourceName: string;
  currencyCode: string;
  originalAmount: number;
  originalRate: number;
  revaluationRate: number;
  bookValueBase: number;
  revaluedBase: number;
  gainLossAmount: number;
  gainLossDirection: 'gain' | 'loss';
  subjectCode: string;
  subjectName: string;
}

export interface FxRevaluationPreview {
  period: string;
  baseCurrency: string;
  items: FxRevaluationPreviewLine[];
  totalGain: number;
  totalLoss: number;
  netDifference: number;
}

// ─── 核心计算 ───

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function findRate(currencyCode: string, rates: FxRate[]): number | null {
  const r = rates.find((x) => x.currencyCode === currencyCode);
  return r ? r.middleRate : null;
}

/**
 * 计算汇兑损益
 * 正数 = 收益（资产增值 / 负债减值）
 * 负数 = 损失（资产减值 / 负债增值）
 */
function calcGainLoss(
  originalAmount: number,
  bookValueBase: number,
  revaluationRate: number,
): { revaluedBase: number; gainLossAmount: number } {
  const revaluedBase = round2(originalAmount * revaluationRate);
  const gainLossAmount = round2(revaluedBase - bookValueBase);
  return { revaluedBase, gainLossAmount };
}

/**
 * 构建重估预览
 */
export function buildFxRevaluationPreview(input: FxRevaluationInput): FxRevaluationPreview {
  const items: FxRevaluationPreviewLine[] = [];

  // 1. 银行余额重估
  for (const bank of input.bankBalances) {
    const endRate = findRate(bank.currencyCode, input.fxRates);
    if (!endRate) continue;
    const originalRate = bank.originalAmount !== 0
      ? round2(bank.bookValueBase / bank.originalAmount)
      : 0;
    const { revaluedBase, gainLossAmount } = calcGainLoss(
      bank.originalAmount,
      bank.bookValueBase,
      endRate,
    );
    if (Math.abs(gainLossAmount) < 0.005) continue;
    items.push({
      sourceType: 'bank',
      sourceId: bank.accountId,
      sourceName: bank.bankName || bank.accountNumber,
      currencyCode: bank.currencyCode,
      originalAmount: bank.originalAmount,
      originalRate,
      revaluationRate: endRate,
      bookValueBase: bank.bookValueBase,
      revaluedBase,
      gainLossAmount: Math.abs(gainLossAmount),
      gainLossDirection: gainLossAmount > 0 ? 'gain' : 'loss',
      subjectCode: bank.subjectCode,
      subjectName: bank.subjectName,
    });
  }

  // 2. 应收/应付未核销余额重估
  for (const item of input.openItems) {
    const endRate = findRate(item.currencyCode, input.fxRates);
    if (!endRate) continue;
    const originalRate = item.lockedRate || (item.originalAmount !== 0
      ? round2(item.bookValueBase / item.originalAmount)
      : 0);
    const { revaluedBase, gainLossAmount } = calcGainLoss(
      item.originalAmount,
      item.bookValueBase,
      endRate,
    );
    if (Math.abs(gainLossAmount) < 0.005) continue;

    // 应收是资产：正差额=收益，应付是负债：正差额=损失
    const isAsset = item.moduleName === 'receivable';
    const direction: 'gain' | 'loss' = (gainLossAmount > 0) === isAsset ? 'gain' : 'loss';

    items.push({
      sourceType: item.moduleName,
      sourceId: item.itemId,
      sourceName: item.partnerName,
      currencyCode: item.currencyCode,
      originalAmount: item.originalAmount,
      originalRate,
      revaluationRate: endRate,
      bookValueBase: item.bookValueBase,
      revaluedBase,
      gainLossAmount: Math.abs(gainLossAmount),
      gainLossDirection: direction,
      subjectCode: item.subjectCode,
      subjectName: item.subjectName,
    });
  }

  const totalGain = round2(items.filter((i) => i.gainLossDirection === 'gain').reduce((s, i) => s + i.gainLossAmount, 0));
  const totalLoss = round2(items.filter((i) => i.gainLossDirection === 'loss').reduce((s, i) => s + i.gainLossAmount, 0));

  return {
    period: input.period,
    baseCurrency: input.baseCurrency,
    items,
    totalGain,
    totalLoss,
    netDifference: round2(totalGain - totalLoss),
  };
}

// ─── 凭证构建 ───

export interface FxRevaluationVoucherEntry {
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
  summary: string;
}

/**
 * 从预览结果构建平衡凭证分录
 *
 * 每个预览行生成一条科目调整分录，
 * 再汇总净损益到汇兑损益科目。
 */
export function buildFxRevaluationVoucher(
  preview: FxRevaluationPreview,
  gainLossSubjectCode: string,
  gainLossSubjectName: string,
): FxRevaluationVoucherEntry[] {
  const entries: FxRevaluationVoucherEntry[] = [];

  // 各科目的调整分录
  let netGainLoss = 0; // 正=净收益，负=净损失

  for (const item of preview.items) {
    if (item.gainLossDirection === 'gain') {
      // 收益：调整科目借方（资产增值），汇兑损益科目贷方
      entries.push({
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        debit: item.gainLossAmount,
        credit: 0,
        summary: `汇兑收益-${item.currencyCode} ${item.sourceName}`,
      });
      netGainLoss += item.gainLossAmount;
    } else {
      // 损失：调整科目贷方（资产减值），汇兑损益科目借方
      entries.push({
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        debit: 0,
        credit: item.gainLossAmount,
        summary: `汇兑损失-${item.currencyCode} ${item.sourceName}`,
      });
      netGainLoss -= item.gainLossAmount;
    }
  }

  // 汇兑损益科目汇总分录
  if (Math.abs(netGainLoss) >= 0.005) {
    if (netGainLoss > 0) {
      // 净收益：汇兑损益科目贷方
      entries.push({
        subjectCode: gainLossSubjectCode,
        subjectName: gainLossSubjectName,
        debit: 0,
        credit: round2(netGainLoss),
        summary: `汇兑损益-期末调汇 ${preview.period}`,
      });
    } else {
      // 净损失：汇兑损益科目借方
      entries.push({
        subjectCode: gainLossSubjectCode,
        subjectName: gainLossSubjectName,
        debit: round2(Math.abs(netGainLoss)),
        credit: 0,
        summary: `汇兑损益-期末调汇 ${preview.period}`,
      });
    }
  }

  return entries;
}
