// 账套
export interface AccountingSet {
  id: string;
  code: string;
  name: string;
  baseCurrency: string;
  baseCurrencyName: string;
  startDate: string;
  currentPeriod: string;
  voucherPrefix: string;
  voucherNoFormat: 'sequential' | 'monthly' | 'yearly';
  lastVoucherNo: number;
  isInitialized: boolean;
  isClosed: boolean;
  createdAt: string;
}

// 科目
export interface Subject {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  direction: 'debit' | 'credit';
  enableDept: boolean;
  enableProject: boolean;
  enableForeign: boolean;
  foreignCurrency?: string;
  isAR: boolean;
  isAP: boolean;
  disabled: boolean;
  block: boolean; // 冻结状态
  subjectType?: 'Asset' | 'Liability' | 'Equity' | 'Cost' | 'Profit/Loss'; // 科目类型
}

// 凭证
export interface Voucher {
  id: string;
  voucherNo: string;
  date: string;
  summary?: string;
  entries: VoucherEntry[];
  status: 'draft' | 'review' | 'posted' | 'reversed';
  voucherType: 'general' | 'receipt' | 'payment' | 'transfer' | 'closing';
  createdBy: string;
  createdAt: string;
}

// 凭证分录
export interface VoucherEntry {
  id: string;
  voucherId: string;
  date: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  deptCode?: string;
  projectCode?: string;
  debit: number;
  credit: number;
}

// 科目余额
export interface SubjectBalance {
  subjectCode: string;
  subjectName: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
}

// 凭证模板
export interface VoucherTemplate {
  id: string;
  name: string;
  type: 'fixed' | 'variable' | 'ratio';
  description?: string;
  entries: TemplateEntry[];
  createdAt: string;
  updatedAt: string;
}

// 模板分录
export interface TemplateEntry {
  id: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  amount: number;
  amountType: 'fixed' | 'calculated';
  deptCode?: string;
  projectCode?: string;
  ratio?: number;
}

// 部门
export interface Department {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  frozen: boolean; // 冻结状态
}

// 项目
export interface Project {
  id: string;
  code: string;
  name: string;
  type: 'income' | 'cost' | 'other';
  parentId: string | null;
  level: number;
  startDate?: string;
  endDate?: string;
  frozen: boolean; // 冻结状态
}

// 账龄数据
export interface AgingData {
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
}

// 汇率
export interface ExchangeRate {
  id: string;
  accountingSetId: string;
  period: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  isManual: boolean;
  createdAt: string;
}

// 汇兑损益
export interface ExchangeGainLoss {
  id: string;
  voucherId: string;
  period: string;
  currencyCode: string;
  originalAmount: number;
  baseRate: number;
  endRate: number;
  gainLoss: number;
  subjectCode: string;
}

// 年结记录
export interface YearlyClosing {
  id: string;
  accountingSetId: string;
  year: number;
  closingDate: string;
  voucherId: string;
  isClosed: boolean;
  profitLoss: number;
  totalDebit: number;
  totalCredit: number;
  closingUser: string;
  closingTime: string;
}

// 期间状态
export interface PeriodStatus {
  year: number;
  month: number;
  isOpen: boolean;
  isClosed: boolean;
  closingDate?: string;
  voucherCount: number;
}

// 流水导入数据模型
export interface BankStatement {
  id: string;
  date: string;
  summary: string;
  debit?: number;
  credit?: number;
  counterparty?: string;
  amount: number;
  category?: string;
  source: 'bank' | 'alipay' | 'wechat';
}

export interface TaxStatement {
  id: string;
  date: string;
  productName?: string;
  saleAmount?: number;
  taxAmount?: number;
  inputTax?: number;
  productCode?: string;
  source: 'tax';
}

// 导入类型
export interface ImportType {
  value: 'bank' | 'tax' | 'template';
  label: string;
}

// 字段映射配置
export interface FieldMapping {
  importType: ImportType;
  mappings: FieldMap[];
}

export interface FieldMap {
  standardField: string;
  excelColumn: string;
  defaultValue?: string;
}

// 流水导入状态
export interface StatementImport {
  id: string;
  importType: ImportType;
  fileName: string;
  rawStatements: BankStatement[] | TaxStatement[];
  mappedEntries: MappedEntry[];
  voucherEntries: VoucherEntry[];
  status: 'pending' | 'reviewed' | 'completed';
  createdAt: string;
}

export interface MappedEntry {
  id: string;
  originalId: string;
  summary: string;
  subjectCode?: string;
  subjectName?: string;
  matchStatus: 'matched' | 'unmatched' | 'manual';
  debit?: number;
  credit?: number;
  suggestedSubject?: string;
  matchConfidence?: number;
}

// 关键词匹配规则
export interface KeywordRule {
  keywords: string[];
  targetSubject: string;
  targetDirection: 'debit' | 'credit';
  priority: number;
}

// 用户偏好记忆
export interface UserPreference {
  id: string;
  partnerName?: string;
  oldSubject: string;
  newSubject: string;
  operationType: 'subject_correction';
  count: number;
  createdAt: string;
}

// 记账表
export interface LedgerEntry {
  id: string;
  voucherNo: string;
  entryDate: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
  deptCode?: string;
  projectCode?: string;
  auxiliary?: {
    department?: string;
    project?: string;
    customer?: string;
    supplier?: string;
  } | string;
  entryTime: string;
  writeOffFlag: boolean;
  correction: boolean;
}

// 初始化配置
export interface InitConfig {
  setInfo: {
    name: string;
    code: string;
    baseCurrency: string;
    startDate: string;
  };
  subjectSet: 'standard' | 'manufacturing' | 'service' | 'custom';
  initPeriod: {
    year: number;
    month: number;
  };
  openingBalances: OpeningBalance[];
  initialRates: InitialRate[];
}

// 期初余额
export interface OpeningBalance {
  subjectCode: string;
  subjectName: string;
  openingBalance: number;
  direction: 'debit' | 'credit';
}

// 初始汇率
export interface InitialRate {
  currency: string;
  rate: number;
  effectiveDate: string;
}