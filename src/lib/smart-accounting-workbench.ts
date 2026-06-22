import {
  MONTHLY_CHECK_MODULE_LABELS,
  type MonthlyClosingCheckResult,
  type MonthlyClosingSummary,
} from './monthly-closing-checks';

export type SmartTaskStatus = 'completed' | 'in_progress' | 'warning' | 'blocked' | 'not_started';
export type SmartRiskSeverity = 'info' | 'warning' | 'blocker';

export interface SmartAccountingEntry {
  id: string;
  subjectCode: string;
  subjectName?: string;
  debit?: number;
  credit?: number;
}

export interface SmartAccountingVoucher {
  id: string;
  voucherNo: string;
  date: string;
  status: 'draft' | 'review' | 'posted' | 'reversed';
  entries: SmartAccountingEntry[];
}

export interface SmartAccountingBankTransaction {
  id: string;
  date: string;
  status?: string;
  voucherId?: string;
}

export interface SmartAccountingInvoice {
  id: string;
  invoiceDate: string;
  invoiceType: 'input' | 'output';
  voucherId?: string | null;
  paymentStatus?: string;
}

export interface SmartAccountingInput {
  period: string;
  vouchers: SmartAccountingVoucher[];
  bankTransactions?: SmartAccountingBankTransaction[];
  invoices?: SmartAccountingInvoice[];
}

export interface SmartAccountingTask {
  code: string;
  stage: string;
  name: string;
  status: SmartTaskStatus;
  exceptionCount: number;
  targetRoute: string;
  actionLabel: string;
}

export interface SmartAccountingRisk {
  code: string;
  severity: SmartRiskSeverity;
  title: string;
  description: string;
  targetRoute: string;
  actionLabel: string;
}

export interface SmartAccountingSummary {
  period: string;
  progress: number;
  completedCount: number;
  totalCount: number;
  pendingCount: number;
  warningCount: number;
  blockerCount: number;
  canClose: boolean;
  tasks: SmartAccountingTask[];
  risks: SmartAccountingRisk[];
  nextActions: SmartAccountingRisk[];
  metrics: {
    fixedAssetOriginalBalance: number;
    accumulatedDepreciationBalance: number;
    currentDepreciationCredit: number;
    prepaidBalance: number;
    currentPrepaidCredit: number;
  };
}

const FIXED_ASSET_ORIGINAL_CODES = ['1501', '1601', '1604'];
const ACCUMULATED_DEPRECIATION_CODES = ['1502'];
const PREPAID_CODES = ['1801', '1811'];
const KEY_SUBJECT_REVIEW_CODES = ['1002', '1122', '1221', '1405', '2202', '2203', '2211', '2221'];

function isInPeriod(date: string | undefined, period: string): boolean {
  return Boolean(date?.startsWith(period));
}

function includesCode(subjectCode: string, codes: string[]): boolean {
  return codes.some((code) => subjectCode === code || subjectCode.startsWith(code));
}

function sumEntries(
  vouchers: SmartAccountingVoucher[],
  codes: string[],
  side: 'debit' | 'credit' | 'balanceDebit' | 'balanceCredit',
  period?: string,
): number {
  return vouchers
    .filter((voucher) => voucher.status === 'posted' && (!period || isInPeriod(voucher.date, period)))
    .flatMap((voucher) => voucher.entries)
    .filter((entry) => includesCode(entry.subjectCode, codes))
    .reduce((sum, entry) => {
      const debit = entry.debit || 0;
      const credit = entry.credit || 0;
      if (side === 'debit') return sum + debit;
      if (side === 'credit') return sum + credit;
      if (side === 'balanceDebit') return sum + debit - credit;
      return sum + credit - debit;
    }, 0);
}

function task(
  code: string,
  stage: string,
  name: string,
  status: SmartTaskStatus,
  exceptionCount: number,
  targetRoute: string,
  actionLabel: string,
): SmartAccountingTask {
  return { code, stage, name, status, exceptionCount, targetRoute, actionLabel };
}

function risk(
  code: string,
  severity: SmartRiskSeverity,
  title: string,
  description: string,
  targetRoute: string,
  actionLabel: string,
): SmartAccountingRisk {
  return { code, severity, title, description, targetRoute, actionLabel };
}

export function buildSmartAccountingSummary(input: SmartAccountingInput): SmartAccountingSummary {
  const bankTransactions = input.bankTransactions || [];
  const invoices = input.invoices || [];
  const periodVouchers = input.vouchers.filter((voucher) => isInPeriod(voucher.date, input.period));
  const periodBankTransactions = bankTransactions.filter((tx) => isInPeriod(tx.date, input.period));
  const periodInvoices = invoices.filter((invoice) => isInPeriod(invoice.invoiceDate, input.period));

  const tasks: SmartAccountingTask[] = [];
  const risks: SmartAccountingRisk[] = [];

  const unbalancedVouchers = periodVouchers.filter((voucher) => {
    const debit = voucher.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const credit = voucher.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    return Math.abs(debit - credit) >= 0.01;
  });
  const unpostedVouchers = periodVouchers.filter((voucher) => voucher.status === 'draft' || voucher.status === 'review');

  if (periodBankTransactions.length === 0) {
    tasks.push(task('bank_import_check', '数据采集', '银行流水导入检查', 'warning', 1, '/import', '导入流水'));
    risks.push(risk('bank_import_missing', 'warning', '本期尚未导入银行流水', '建议先完成资金数据采集，避免漏记收付款凭证。', '/import', '导入流水'));
  } else {
    const unpostedBankCount = periodBankTransactions.filter((tx) => tx.status !== 'voucher_generated' && !tx.voucherId).length;
    tasks.push(task(
      'bank_import_check',
      '数据采集',
      '银行流水导入检查',
      unpostedBankCount > 0 ? 'warning' : 'completed',
      unpostedBankCount,
      '/import',
      unpostedBankCount > 0 ? '生成凭证' : '查看',
    ));
    if (unpostedBankCount > 0) {
      risks.push(risk('bank_voucher_missing', 'warning', `${unpostedBankCount} 条银行流水未生成凭证`, '银行流水已导入但尚未完全入账。', '/import', '去处理'));
    }
  }

  if (periodInvoices.length > 0) {
    const invoiceWithoutVoucher = periodInvoices.filter((invoice) => !invoice.voucherId).length;
    tasks.push(task(
      'invoice_voucher_check',
      '自动做账',
      '发票生成凭证检查',
      invoiceWithoutVoucher > 0 ? 'warning' : 'completed',
      invoiceWithoutVoucher,
      '/invoices/summary',
      invoiceWithoutVoucher > 0 ? '生成凭证' : '查看',
    ));
    if (invoiceWithoutVoucher > 0) {
      risks.push(risk('invoice_voucher_missing', 'warning', `${invoiceWithoutVoucher} 张发票未生成凭证`, '本期已有发票数据，建议确认是否需要生成入账凭证。', '/invoices/summary', '去处理'));
    }
  }

  const fixedAssetOriginalBalance = Math.max(0, sumEntries(input.vouchers, FIXED_ASSET_ORIGINAL_CODES, 'balanceDebit'));
  const accumulatedDepreciationBalance = Math.max(0, sumEntries(input.vouchers, ACCUMULATED_DEPRECIATION_CODES, 'balanceCredit'));
  const currentDepreciationCredit = sumEntries(input.vouchers, ACCUMULATED_DEPRECIATION_CODES, 'credit', input.period);

  if ((fixedAssetOriginalBalance > 0 || accumulatedDepreciationBalance > 0) && currentDepreciationCredit <= 0) {
    tasks.push(task('fixed_asset_depreciation_check', '资产摊折', '固定资产折旧确认', 'warning', 1, '/assets/depreciation', '计提折旧'));
    risks.push(risk(
      'fixed_asset_depreciation_review',
      'warning',
      '固定资产相关科目存在余额，本月未发现折旧计提',
      `固定资产原值余额 ${fixedAssetOriginalBalance.toFixed(2)}，累计折旧余额 ${accumulatedDepreciationBalance.toFixed(2)}，本期折旧发生额 0.00。`,
      '/assets/depreciation',
      '计提折旧',
    ));
  }

  const prepaidBalance = Math.max(0, sumEntries(input.vouchers, PREPAID_CODES, 'balanceDebit'));
  const currentPrepaidCredit = sumEntries(input.vouchers, PREPAID_CODES, 'credit', input.period);

  if (prepaidBalance > 0 && currentPrepaidCredit <= 0) {
    tasks.push(task('prepaid_amortization_check', '资产摊折', '待摊费用摊销确认', 'warning', 1, '/assets/prepaid', '计提摊销'));
    risks.push(risk(
      'prepaid_amortization_review',
      'warning',
      '待摊费用相关科目存在余额，本月未发现摊销',
      `待摊费用余额 ${prepaidBalance.toFixed(2)}，本期待摊科目贷方发生额 0.00。`,
      '/assets/prepaid',
      '计提摊销',
    ));
  }

  const inactiveKeySubjects = KEY_SUBJECT_REVIEW_CODES.filter((code) => {
    const debitBalance = Math.abs(sumEntries(input.vouchers, [code], 'balanceDebit'));
    const creditBalance = Math.abs(sumEntries(input.vouchers, [code], 'balanceCredit'));
    const currentDebit = sumEntries(input.vouchers, [code], 'debit', input.period);
    const currentCredit = sumEntries(input.vouchers, [code], 'credit', input.period);
    return Math.max(debitBalance, creditBalance) > 0 && currentDebit <= 0 && currentCredit <= 0;
  });

  if (inactiveKeySubjects.length > 0) {
    tasks.push(task(
      'key_subject_no_activity_check',
      '财务检查',
      '重点科目余额确认',
      'warning',
      inactiveKeySubjects.length,
      '/balance',
      '确认余额',
    ));
    risks.push(risk(
      'key_subject_no_activity_review',
      'warning',
      `重点科目 ${inactiveKeySubjects.join('、')} 有余额但本期无发生额`,
      '请确认银行存款、往来、存货、税费、工资等重点科目余额长期未变化是否正常。',
      '/balance',
      '去确认',
    ));
  }

  tasks.push(task(
    'voucher_balance_check',
    '财务检查',
    '凭证借贷平衡检查',
    unbalancedVouchers.length > 0 ? 'blocked' : 'completed',
    unbalancedVouchers.length,
    '/voucher-list',
    unbalancedVouchers.length > 0 ? '修复' : '查看',
  ));
  if (unbalancedVouchers.length > 0) {
    risks.push(risk('voucher_unbalanced', 'blocker', `${unbalancedVouchers.length} 张凭证借贷不平`, '借贷不平凭证必须修复后才能月结。', '/voucher-list', '修复凭证'));
  }

  tasks.push(task(
    'voucher_posting_check',
    '财务检查',
    '未记账凭证检查',
    unpostedVouchers.length > 0 ? 'blocked' : 'completed',
    unpostedVouchers.length,
    '/voucher-list',
    unpostedVouchers.length > 0 ? '去审核' : '查看',
  ));
  if (unpostedVouchers.length > 0) {
    risks.push(risk('voucher_unposted', 'blocker', `${unpostedVouchers.length} 张凭证未完成记账`, '草稿或审核中的凭证会影响本期财务完整性。', '/voucher-list', '去审核'));
  }

  tasks.push(task('report_generation_check', '报表结转', '三大报表生成', 'not_started', 0, '/reports', '生成报表'));

  const completedCount = tasks.filter((item) => item.status === 'completed').length;
  const blockerCount = risks.filter((item) => item.severity === 'blocker').length;
  const warningCount = risks.filter((item) => item.severity === 'warning').length;

  const nextActions = [...risks].sort((a, b) => {
    const severityScore = { blocker: 0, warning: 1, info: 2 };
    const routeScore = (item: SmartAccountingRisk) => item.code === 'bank_import_missing' ? -1 : 0;
    return severityScore[a.severity] - severityScore[b.severity] || routeScore(a) - routeScore(b);
  });

  return {
    period: input.period,
    progress: tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100),
    completedCount,
    totalCount: tasks.length,
    pendingCount: tasks.length - completedCount,
    warningCount,
    blockerCount,
    canClose: blockerCount === 0,
    tasks,
    risks,
    nextActions,
    metrics: {
      fixedAssetOriginalBalance,
      accumulatedDepreciationBalance,
      currentDepreciationCredit,
      prepaidBalance,
      currentPrepaidCredit,
    },
  };
}

function smartStatusFromMonthlyCheck(item: MonthlyClosingCheckResult): SmartTaskStatus {
  if (item.completed) return 'completed';
  if (item.systemStatus === 'blocked') return 'blocked';
  if (item.systemStatus === 'warning') return 'warning';
  if (item.systemStatus === 'passed') return 'completed';
  if (item.systemStatus === 'no_data') {
    // 进项/销项发票：无数据通常意味着用户还没导入，应提示"未开始"
    // 资产/待摊等：无数据确实代表"无需处理"，可视为完成
    if (item.code === 'input_invoice_certification' || item.code === 'output_invoice_posting') {
      return 'not_started';
    }
    return 'completed';
  }
  return 'not_started';
}

function smartActionLabelFromMonthlyCheck(item: MonthlyClosingCheckResult): string {
  if (item.completed) return '查看';
  if (item.systemStatus === 'blocked') return '处理阻塞';
  if (item.systemStatus === 'warning') return item.allowManualConfirmation ? '确认处理' : '去处理';
  return '查看';
}

function shouldCreateMonthlyRisk(item: MonthlyClosingCheckResult): boolean {
  return !item.completed && (item.systemStatus === 'blocked' || item.systemStatus === 'warning');
}

function sortSmartRisks(a: SmartAccountingRisk, b: SmartAccountingRisk): number {
  const severityScore: Record<SmartRiskSeverity, number> = { blocker: 0, warning: 1, info: 2 };
  return severityScore[a.severity] - severityScore[b.severity];
}

export function buildSmartAccountingSummaryFromMonthlyClosing(
  input: SmartAccountingInput,
  monthlySummary: MonthlyClosingSummary,
): SmartAccountingSummary {
  const baseSummary = buildSmartAccountingSummary(input);
  const tasks: SmartAccountingTask[] = monthlySummary.items.map((item) => ({
    code: item.code,
    stage: MONTHLY_CHECK_MODULE_LABELS[item.module],
    name: item.title,
    status: smartStatusFromMonthlyCheck(item),
    exceptionCount: item.exceptionCount,
    targetRoute: item.route,
    actionLabel: smartActionLabelFromMonthlyCheck(item),
  }));
  const risks: SmartAccountingRisk[] = monthlySummary.items
    .filter(shouldCreateMonthlyRisk)
    .map((item) => ({
      code: item.code,
      severity: item.systemSeverity,
      title: item.title,
      description: item.systemMessage,
      targetRoute: item.route,
      actionLabel: smartActionLabelFromMonthlyCheck(item),
    }));
  const nextActions = [...risks].sort(sortSmartRisks);

  return {
    ...baseSummary,
    period: monthlySummary.period,
    progress: monthlySummary.progress,
    completedCount: monthlySummary.completedCount,
    totalCount: monthlySummary.totalCount,
    pendingCount: monthlySummary.pendingCount,
    warningCount: monthlySummary.warningCount,
    blockerCount: monthlySummary.blockerCount,
    canClose: monthlySummary.canClose,
    tasks,
    risks,
    nextActions,
  };
}
