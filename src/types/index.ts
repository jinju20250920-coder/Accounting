// 账套
export interface AccountingSet {
  id: string;
  code: string;
  name: string;
  taxNo?: string;               // 公司税号（纳税人识别号）
  baseCurrency: string;
  baseCurrencyName: string;
  startDate: string;
  currentPeriod: string;
  voucherPrefix: string;
  voucherNoFormat: 'sequential' | 'monthly' | 'yearly';
  lastVoucherNo: number;  // 最后一个凭证号（序号部分）
  lastVoucherFullNo: string;  // 完整的最后一个凭证号（含前缀）
  isInitialized: boolean;
  isClosed: boolean;
  createTime: string;
  updateTime: string;

  // 数据库文件相关字段（新增）
  dbFileName?: string;           // 数据库文件名
  dbFilePath?: string;           // 数据库文件路径
  dbFileSize?: number;           // 文件大小（字节）
  dbLastModified?: number;       // 最后修改时间戳
  dbStorageType?: 'fsa' | 'opfs' | 'local'; // 存储类型：File System Access API / OPFS / localStorage
  dbHandleId?: string;           // IndexedDB 中的句柄 ID
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
  isCustomer: boolean; // 客户核算（原应收）
  isSupplier: boolean; // 供应商核算（原应付）
  isEmployee: boolean; // 雇员核算
  enableCashFlow: boolean; // 现金流量核算
  disabled: boolean;
  block: boolean; // 冻结状态
  subjectType?: 'Asset' | 'Liability' | 'Equity' | 'Cost' | 'Profit/Loss'; // 科目类型
  accountSetId?: string; // 新增字段：所属账套ID
  bankAccountNumber?: string; // 银行账号（仅1002子科目使用，用于自动匹配银行流水）
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
  createTime: string;
  updateTime?: string;
  accountSetId?: string; // 新增字段：所属账套ID
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
  currencyCode?: string; // 币别代码
  currencyName?: string; // 币别名称
  cashFlowItem?: string; // 现金流量项目
  customerName?: string; // 客户名称
  supplierName?: string; // 供应商名称
  auxiliary?: {
    department?: string;
    project?: string;
    customer?: string;
    supplier?: string;
  };
  accountSetId?: string; // 新增字段：所属账套ID
  docNo?: string; // 业务单据号（发票号、银行流水号等）
  recRefNo?: string; // 核销单号（为后续核销系统预留）
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
  voucherType?: 'general' | 'receipt' | 'payment' | 'transfer' | 'closing';
  description?: string;
  entries: VoucherTemplateEntry[];
  validations?: any[];
  variables?: any[];
  isSystem?: boolean;
  createTime: string;
  updateTime: string;
  accountSetId?: string; // 新增字段：所属账套ID
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
  accountSetId?: string; // 新增字段：所属账套ID
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
  accountSetId?: string; // 新增字段：所属账套ID
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
  createTime: string;
  updateTime: string;
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
  createTime: string;
  updateTime: string;
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

// 银行账户信息
export interface BankAccountInfo {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
  currency?: string;
}

// 银行交易记录
export interface BankTransaction {
  id: string;
  date: string;
  transactionTime?: string;
  voucherType?: string;
  voucherNo?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  cashRemitFlag?: string;
  counterpartyName?: string;
  counterpartyAccount?: string;
  summary: string;
  notes?: string;
  transactionSerialNo?: string;
  enterpriseSerialNo?: string;
  ourAccount?: string;
  ourAccountName?: string;
  ourBranch?: string;
  rowNumber: number;

  // UI properties (for matching and display)
  status?: 'pending' | 'matched' | 'unmatched' | 'error' | 'voucher_generated';
  matchedSubject?: string;
  matchedSubjectName?: string;
  confidence?: number;
  description?: string;
  amount?: number;
  type?: 'debit' | 'credit';
  generatedVoucherNo?: string;
  voucherId?: string;
  importBatchId?: string;
}

// 银行流水解析结果
export interface BankStatementParseResult {
  fileName: string;
  type: 'bank';
  bankInfo: BankAccountInfo;
  transactions: BankTransaction[];
  errors: Array<{ row: number; message: string }>;
  rawData?: any[][];
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
  createTime: string;
  updateTime: string;
}

// 核销关系表
export interface RecRelation {
  id: string;
  debitEntryId: string;        // 借方分录ID
  creditEntryId: string;       // 贷方分录ID
  amount: number;              // 核销金额
  recRefNo: string;            // 核销单号
  recDate: string;             // 核销日期
  createdBy: string;           // 创建人
  createTime: string;          // 创建时间
  updateTime: string;          // 更新时间
  accountSetId?: string;       // 所属账套ID
}

// 未结清单据查询参数
export interface OutstandingQuery {
  partnerName: string;         // 往来单位名称
  subjectCode?: string;        // 科目代码（可选）
  startDate?: string;          // 开始日期（可选）
  endDate?: string;            // 结束日期（可选）
  amountRange?: [number, number]; // 金额范围（可选）
}

// 未结清单据项
export interface OutstandingItem {
  entryId: string;             // 分录ID
  voucherNo: string;           // 凭证号
  docNo: string;               // 业务单据号
  date: string;                // 日期
  summary: string;             // 摘要
  amount: number;              // 金额
  remainingAmount: number;     // 剩余未核销金额
  direction: 'debit' | 'credit'; // 方向
  partnerName?: string;        // 往来单位名称
}

// 记账表
export interface LedgerEntry {
  id: string;
  entryNo: string;  // 分录编号，格式：{voucherNo}-{entrySeq}，从1开始
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
  accountSetId?: string; // 新增字段：所属账套ID
  docNo?: string; // 业务单据号（发票号、银行流水号等）
  recRefNo?: string; // 核销单号（为后续核销系统预留）
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

// 币别管理
export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  precision: number;
  exchangeRate: number;
  rateStartDate: string;
  gainLossSubjectCode: string;
  gainLossSubjectName: string;
  isBase: boolean;
  disabled: boolean;
  createTime: string;
  accountSetId?: string; // 新增字段：所属账套ID
  updateTime: string;
}

// 常用摘要
export interface CommonSummary {
  id: string;
  text: string;
  sortOrder: number;
  createTime: string;
  updateTime: string;
  accountSetId?: string; // 新增字段：所属账套ID
}

// 最近使用摘要
export interface RecentSummary {
  id: string;
  text: string;
  usedAt: string;
}

// 凭证模版（完整的凭证保存为模版）
export interface VoucherFullTemplate {
  id: string;
  name: string;
  description?: string;
  voucherType: 'general' | 'receipt' | 'payment' | 'transfer' | 'closing';
  entries: VoucherTemplateEntry[];
  createTime: string;
  updateTime: string;
  accountSetId?: string; // 新增字段：所属账套ID
}

// 凭证模版分录
export interface VoucherTemplateEntry {
  id: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  deptCode?: string;
  projectCode?: string;
  debit: number;
  credit: number;
  currencyCode?: string; // 币别代码
  currencyName?: string; // 币别名称
  cashFlowItem?: string; // 现金流量项目
  customerName?: string; // 客户名称
  supplierName?: string; // 供应商名称
}

// 往来单位（统一模型）
export interface Partner {
  id: string;
  code: string;
  name: string;
  isCustomer: boolean; // 客户勾选
  isSupplier: boolean; // 供应商勾选
  isEmployee: boolean; // 雇员勾选
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string; // 税号
  bankAccount?: string; // 银行账号
  bankName?: string; // 开户银行
  defaultSubjectCode?: string; // 默认对方科目代码（供应商→应付账款，客户→应收账款）
  defaultSubjectName?: string; // 默认对方科目名称
  paymentTermDays?: number; // 账期天数（入账日期+账期=到期日）
  frozen: boolean;
  createTime: string;
  updateTime: string;
  // 合并相关字段
  mergedFrom?: string[]; // 从哪些ID合并而来
  parentId?: string; // 关联的集团ID（用于合并到集团）
  accountSetId?: string; // 新增字段：所属账套ID
}

// ============================================
// 银行流水匹配规则
// ============================================

export interface BankTransactionRule {
  id: string;
  name: string;              // 规则名称
  keyword: string;           // 匹配关键词
  subjectCode: string;       // 对方科目代码
  subjectName: string;       // 对方科目名称
  direction: 'in' | 'out' | 'both'; // 流入/流出/双向
  priority: number;          // 优先级 1-10
  enabled: boolean;          // 是否启用
  isSystem: boolean;         // 系统规则不可删除
  accountSetId?: string;
  createTime: string;
  updateTime: string;
}

// ============================================
// 固定资产模块类型定义
// ============================================

// 折旧方法类型
export type DepreciationMethod = 'straight_line' | 'double_declining' | 'sum_of_years' | 'units_of_production';

// 资产状态
export type AssetStatus = 'active' | 'disposed' | 'fully_depreciated';

// 资产分类类型
export type AssetCategoryType = 'fixed' | 'intangible';

// 资产分类
export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  assetType: AssetCategoryType;
  defaultUsefulLifeYears: number;
  defaultDepreciationMethod: DepreciationMethod;
  defaultSalvageRate: number; // 默认残值率（如0.05表示5%）
  assetSubjectCode: string;
  depreciationSubjectCode: string;
  expenseSubjectCode: string;
  description?: string;
  sortOrder: number;
  enabled: boolean;
  accountSetId?: string;
  createTime: string;
  updateTime: string;
}

// 固定资产卡片
export interface FixedAsset {
  id: string;
  assetCode: string; // 资产编码
  assetName: string; // 资产名称
  categoryId?: string; // 分类ID
  categoryName?: string; // 分类名称
  assetType?: 'equipment' | 'vehicle' | 'furniture' | 'machinery' | 'building' | 'other'; // 资产类型
  specification?: string; // 规格型号
  unit: string; // 计量单位（台/把/套/个）
  quantity: number; // 入账数量
  remainingQuantity: number; // 在库数量（入账 - 已处置）
  unitPrice: number; // 单价 = 原值 / 数量

  // 财务数据
  originalValue: number; // 原值
  salvageValue: number; // 残值
  depreciableValue: number; // 应计折旧额 = 原值 - 残值
  accumulatedDepreciation: number; // 累计折旧
  netValue: number; // 净值 = 原值 - 累计折旧

  // 折旧设置
  depreciationMethod: DepreciationMethod;
  usefulLifeYears: number; // 使用年限
  usefulLifeMonths: number; // 使用月数
  originalUsefulLifeMonths?: number; // 原始使用月数（改造前）
  depreciatedMonths?: number; // 已折旧月数
  remainingDepreciationMonths?: number; // 剩余折旧月数
  totalUnits?: number; // 总工作量（工作量法）
  unitsUsed?: number; // 已使用工作量

  // 日期
  acquisitionDate: string; // 购置日期
  depreciationStartDate?: string; // 折旧开始日期（取得日期下月1日）
  depreciationEndDate?: string; // 折旧结束日期
  lastDepreciationDate?: string; // 最后折旧日期
  disposalDate?: string; // 处置日期

  // 状态
  status: AssetStatus;
  location?: string; // 存放地点
  departmentCode?: string; // 使用部门代码
  departmentName?: string; // 使用部门名称

  // 取得方式
  acquisitionType: 'purchase' | 'opening_balance' | 'cip_conversion' | 'invoice'; // 取得方式
  sourceInvoiceId?: string; // 来源发票ID
  sourceVoucherId?: string; // 取得凭证ID

  // 科目映射（从分类继承，不在卡片编辑）
  assetSubjectCode?: string; // 资产科目（如1501）
  assetSubjectName?: string;
  depreciationSubjectCode?: string; // 累计折旧科目（如1502）
  depreciationSubjectName?: string;
  expenseSubjectCode?: string; // 费用科目（如660204）
  expenseSubjectName?: string;
  cipSubjectCode?: string; // 在建工程科目（转固用）
  cipSubjectName?: string;
  disposalSubjectCode?: string; // 固定资产清理科目
  disposalSubjectName?: string;

  // 单体管理（高价值资产）
  serialNumber?: string; // 序列号
  assignedUser?: string; // 使用人

  // 改造记录
  improvementHistory?: AssetImprovement[];

  // 处置记录（支持多次部分处置）
  disposalHistory?: AssetDisposal[];

  // 其他信息
  supplierName?: string; // 供应商
  invoiceNo?: string; // 发票号
  notes?: string; // 备注
  accountSetId?: string;
  createTime: string;
  updateTime: string;
}

// 资产改造记录
export interface AssetImprovement {
  id: string;
  date: string; // 改造日期
  addedValue: number; // 增加原值
  extendedMonths: number; // 延长月数
  reason?: string; // 改造原因
  voucherId?: string; // 凭证ID
  voucherNo?: string; // 凭证号
  createTime: string;
}

// 资产处置记录
export interface AssetDisposal {
  id: string;
  date: string; // 处置日期
  type: 'scrapped' | 'sold' | 'lost'; // 报废/出售/盘亏
  quantity: number; // 处置数量
  disposedOriginalValue: number; // 处置原值
  disposedAccumulatedDepreciation: number; // 处置累计折旧
  disposedNetValue: number; // 处置净值
  disposalIncome: number; // 清理收入
  disposalExpense: number; // 清理费用
  netGainLoss: number; // 净损益
  reason?: string; // 处置原因
  voucherIds?: string[]; // 凭证ID列表（处置可能生成多张凭证）
  voucherNos?: string[]; // 凭证号列表
  createTime: string;
}

// 资产变动记录
export interface AssetChangeRecord {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  accountSetId: string;

  changeType: 'acquisition' | 'depreciation' | 'improvement' | 'disposal' | 'transfer' | 'status_change';
  changeDate: string;
  period: string; // 会计期间 YYYY-MM

  // 变更详情
  fieldName: string; // 变更字段
  beforeValue: string; // 变更前值（JSON序列化）
  afterValue: string; // 变更后值（JSON序列化）

  // 凭证关联
  voucherId?: string;
  voucherNo?: string;

  reason?: string; // 变更原因
  operatorId?: string; // 操作人
  createTime: string;
}

// 折旧记录
export interface DepreciationRecord {
  id: string;
  assetId: string;
  assetCode?: string;
  assetName?: string;

  // 期间
  period: string; // 格式：YYYY-MM
  depreciationDate: string; // 折旧日期

  // 金额
  periodDepreciation: number; // 本期折旧额
  accumulatedDepreciation: number; // 累计折旧（含本期）
  netValueAfter: number; // 折旧后净值

  // 工作量法专用
  unitsThisPeriod?: number; // 本期工作量
  unitDepreciationRate?: number; // 单位折旧额

  // 凭证关联
  voucherId?: string; // 生成的凭证ID
  voucherNo?: string; // 凭证号

  // 状态
  status: 'draft' | 'posted'; // 草稿/已记账
  notes?: string;
  accountSetId?: string;
  createTime: string;
  updateTime: string;
}

// 折旧计算输入
export interface DepreciationCalculationInput {
  originalValue: number;
  salvageValue: number;
  usefulLifeYears: number;
  usefulLifeMonths: number;
  acquisitionDate: string;
  depreciationStartDate: string;
  accumulatedDepreciation: number;
  method: DepreciationMethod;
  totalUnits?: number;
  unitsUsed?: number;
  asOfDate: string;
}

// 折旧计算结果
export interface DepreciationResult {
  periodDepreciation: number; // 本期折旧额
  accumulatedDepreciation: number; // 累计折旧
  netValue: number; // 净值
  remainingLife: number; // 剩余使用月数
  isFullyDepreciated: boolean; // 是否已提足折旧
  calculationDetails: string; // 计算说明
}

// 批量折旧结果
export interface BatchDepreciationResult {
  records: DepreciationRecord[];
  totalDepreciation: number;
  assetCount: number;
  period: string;
  errors: Array<{ assetId: string; assetName: string; error: string }>;
}

// ============================================
// 无形资产与待摊费用模块类型定义
// ============================================

// 摊销方法类型
export type AmortizationMethod = 'straight_line' | 'units_of_production';

// 无形资产类型
export type IntangibleAssetType = 'patent' | 'trademark' | 'software' | 'copyright' | 'goodwill' | 'other';

// 无形资产摊销状态
export type AmortizationStatus = 'active' | 'fully_amortized' | 'disposed';

// 待摊费用类型
export type PrepaidExpenseType = 'rent' | 'insurance' | 'subscription' | 'maintenance' | 'advertising' | 'other';

// 无形资产
export interface IntangibleAsset {
  id: string;
  assetCode: string; // 资产编码
  assetName: string; // 资产名称
  assetType: IntangibleAssetType; // 资产类型

  // 财务数据
  originalValue: number; // 原值
  residualValue: number; // 残值
  accumulatedAmortization: number; // 累计摊销
  netValue: number; // 净值

  // 摊销设置
  amortizationMethod: AmortizationMethod;
  usefulLifeYears: number; // 使用年限
  usefulLifeMonths: number; // 使用月数
  totalUnits?: number; // 总产量（产量法）
  unitsUsed?: number; // 已使用产量

  // 日期
  acquisitionDate: string; // 购置日期
  amortizationStartDate?: string; // 摊销开始日期
  lastAmortizationDate?: string; // 最后摊销日期
  expiryDate?: string; // 到期日期

  // 状态
  status: AmortizationStatus;

  // 科目映射
  assetSubjectCode: string; // 资产科目（如1701）
  assetSubjectName?: string;
  amortizationSubjectCode: string; // 累计摊销科目（如1702）
  amortizationSubjectName?: string;
  expenseSubjectCode: string; // 费用科目
  expenseSubjectName?: string;

  // 其他信息
  registrationNo?: string; // 登记号（专利号、商标注册号）
  legalLifeYears?: number; // 法定保护年限
  departmentCode?: string;
  departmentName?: string;
  notes?: string;
  accountSetId?: string;
  createTime: string;
  updateTime: string;
}

// 待摊费用
export interface PrepaidExpense {
  id: string;
  expenseCode: string; // 费用编码
  expenseName: string; // 费用名称
  expenseType: PrepaidExpenseType; // 费用类型

  // 财务数据
  originalAmount: number; // 原始金额
  amortizedAmount: number; // 已摊销金额
  remainingAmount: number; // 剩余金额

  // 摊销设置
  amortizationMethod: AmortizationMethod;
  amortizationPeriods: number; // 摊销总期数
  amortizedPeriods: number; // 已摊销期数
  periodAmount: number; // 每期金额

  // 日期
  paymentDate: string; // 支付日期
  startDate: string; // 服务开始日期
  endDate: string; // 服务结束日期
  lastAmortizationDate?: string; // 最后摊销日期

  // 状态
  status: AmortizationStatus;

  // 科目映射
  prepaidSubjectCode: string; // 待摊科目（如1801或1811）
  prepaidSubjectName?: string;
  expenseSubjectCode: string; // 费用科目
  expenseSubjectName?: string;

  // 其他信息
  supplierName?: string; // 供应商
  invoiceNo?: string; // 发票号
  contractNo?: string; // 合同号
  departmentCode?: string;
  departmentName?: string;
  notes?: string;
  accountSetId?: string;
  createTime: string;
  updateTime: string;
}

// 摊销记录（统一用于无形资产和待摊费用）
export interface AmortizationRecord {
  id: string;
  entityType: 'intangible' | 'prepaid'; // 实体类型
  entityId: string; // 实体ID
  entityCode?: string; // 实体编码
  entityName?: string; // 实体名称

  // 期间
  period: string; // 格式：YYYY-MM
  amortizationDate: string; // 摊销日期

  // 金额
  periodAmortization: number; // 本期摊销额
  accumulatedAmortization: number; // 累计摊销
  remainingAmount: number; // 剩余金额

  // 产量法专用
  unitsThisPeriod?: number; // 本期产量

  // 凭证关联
  voucherId?: string; // 生成的凭证ID
  voucherNo?: string; // 凭证号

  // 状态
  status: 'draft' | 'posted'; // 草稿/已记账
  notes?: string;
  accountSetId?: string;
  createTime: string;
  updateTime: string;
}

// 摊销计算输入
export interface AmortizationCalculationInput {
  originalValue: number;
  residualValue: number;
  usefulLifeMonths: number;
  amortizedAmount: number;
  acquisitionDate: string;
  amortizationStartDate: string;
  method: AmortizationMethod;
  totalUnits?: number;
  unitsUsed?: number;
  asOfDate: string;
}

// 摊销计算结果
export interface AmortizationResult {
  periodAmortization: number; // 本期摊销额
  accumulatedAmortization: number; // 累计摊销
  remainingAmount: number; // 剩余金额
  remainingLife: number; // 剩余期数
  isFullyAmortized: boolean; // 是否已摊销完毕
  calculationDetails: string; // 计算说明
}

// 批量摊销结果
export interface BatchAmortizationResult {
  records: AmortizationRecord[];
  totalAmortization: number;
  entityCount: number;
  period: string;
  errors: Array<{ entityId: string; entityName: string; error: string }>;
}

// ============================================
// 资产导入相关类型
// ============================================

// 解析后的固定资产数据
export interface ParsedFixedAsset {
  rowNumber: number;
  assetCode?: string;
  assetName?: string;
  categoryName?: string;
  specification?: string;
  originalValue?: number;
  salvageValue?: number;
  depreciationMethod?: string;
  usefulLifeYears?: number;
  acquisitionDate?: string;
  location?: string;
  departmentCode?: string;
  expenseSubjectCode?: string;
  supplierName?: string;
  invoiceNo?: string;
  notes?: string;
}

// 解析后的无形资产数据
export interface ParsedIntangibleAsset {
  rowNumber: number;
  assetCode?: string;
  assetName?: string;
  assetType?: string;
  originalValue?: number;
  residualValue?: number;
  amortizationMethod?: string;
  usefulLifeYears?: number;
  acquisitionDate?: string;
  registrationNo?: string;
  departmentCode?: string;
  expenseSubjectCode?: string;
  notes?: string;
}

// 解析后的待摊费用数据
export interface ParsedPrepaidExpense {
  rowNumber: number;
  expenseCode?: string;
  expenseName?: string;
  expenseType?: string;
  originalAmount?: number;
  paymentDate?: string;
  startDate?: string;
  endDate?: string;
  amortizationPeriods?: number;
  prepaidSubjectCode?: string;
  expenseSubjectCode?: string;
  supplierName?: string;
  invoiceNo?: string;
  departmentCode?: string;
  notes?: string;
}

// 资产筛选条件
export interface AssetFilter {
  category?: string;
  status?: string;
  dateRange?: [string, string];
  searchQuery?: string;
  departmentCode?: string;
}

// 资产报表数据项
export interface AssetReportItem {
  code: string;
  name: string;
  category: string;
  originalValue: number;
  accumulatedDepreciation: number;
  netValue: number;
  acquisitionDate: string;
  usefulLife: string;
  status: string;
  location?: string;
  department?: string;
}

// 折旧/摊销报表数据项
export interface DepreciationReportItem {
  period: string;
  assetCode: string;
  assetName: string;
  beginningNetValue: number;
  periodAmount: number;
  endingNetValue: number;
  method: string;
  voucherNo?: string;
}

// ==================== 发票管理相关类型 ====================

// 发票类型
export type InvoiceType = 'input' | 'output'; // 进项/销项

// 发票收付款状态
export type InvoicePaymentStatus = 'unpaid' | 'partial' | 'paid';

// 发票
export interface Invoice {
  id: string;
  invoiceType: InvoiceType;         // 发票类型: input(进项)/output(销项)
  invoiceCode: string;              // 发票号码
  digitalInvoiceNo?: string;        // 数电发票号码（与发票号码二选一）
  invoiceDate: string;              // 开票日期
  sellerName: string;               // 销售方名称
  sellerTaxNo?: string;             // 销售方税号
  buyerName: string;                // 购买方名称
  buyerTaxNo?: string;              // 购买方税号
  goodsName?: string;               // 货物或服务名称
  specification?: string;           // 规格型号
  unit?: string;                    // 单位
  quantity?: number;                // 数量
  unitPrice?: number;               // 单价
  amount: number;                   // 金额(不含税)
  taxRate?: number;                 // 税率
  taxAmount?: number;               // 税额
  totalAmount: number;              // 价税合计
  paymentStatus: InvoicePaymentStatus; // 收付款状态
  paidAmount: number;               // 已收/已付金额
  voucherId?: string;               // 关联凭证ID
  voucherNo?: string;               // 关联凭证号
  partnerId?: string;               // 关联往来单位ID
  partnerName?: string;             // 往来单位名称
  notes?: string;                   // 备注
  accountSetId: string;             // 账套ID
  createTime: string;               // 创建时间
  updateTime: string;               // 更新时间
  holdStatus?: 'normal' | 'on_hold';   // 发票处理状态，默认 normal
  category?: 'purchase' | 'reimbursement' | 'fixed_asset' | null; // 规则引擎分类标签
  groupName?: string; // 匹配的业务组名称，空则使用默认科目
}

// 发票核销记录
export interface InvoiceReconciliation {
  id: string;
  invoiceId: string;                // 发票ID
  voucherId?: string;               // 凭证ID
  entryId?: string;                 // 凭证分录ID
  amount: number;                   // 核销金额
  reconcileDate: string;            // 核销日期
  notes?: string;                   // 备注
  accountSetId: string;             // 账套ID
  createTime: string;               // 创建时间
}

// 发票科目映射规则（关键词匹配）
export interface InvoiceSubjectRule {
  id: string;
  accountSetId: string;
  name: string;                     // 规则名称（如"差旅费"）
  keywords: string[];               // 匹配关键词（goodsName 子串匹配，任一命中即可）
  invoiceType: 'input' | 'output' | 'both';
  matchTaxRate?: number;            // 可选税率匹配（如 0.13, 0.09, 0.06），不填则忽略税率
  // 进项科目覆盖（可选，不填用默认）
  inputDebitSubject?: string;       // 进项-借方科目代码（如 6602，覆盖默认的材料采购）
  inputDebitSubjectName?: string;
  inputTaxSubject?: string;         // 进项-进项税科目（如 222101）
  inputTaxSubjectName?: string;
  inputCreditSubject?: string;      // 进项-贷方科目代码（如 2241其他应付款）
  inputCreditSubjectName?: string;
  // 销项科目覆盖（可选，不填用默认）
  outputDebitSubject?: string;      // 销项-借方科目（如 1122）
  outputDebitSubjectName?: string;
  outputCreditSubject?: string;     // 销项-贷方科目-收入（如 6002）
  outputCreditSubjectName?: string;
  outputTaxSubject?: string;        // 销项-销项税（如 222102）
  outputTaxSubjectName?: string;
  priority: number;                 // 数字越大越优先，默认 0
  createTime: string;
  updateTime: string;
}

// ============================================================
// Invoice Smart Rule Engine v2.0 Types
// ============================================================

// --- Condition Types ---
export type ConditionField = 'goodsName' | 'sellerName' | 'notes' | 'totalAmount' | 'taxRate' | 'supplierInList';

export type SmartRuleCondition = TextCondition | NumericCondition | SupplierListCondition;

export interface TextCondition {
  field: 'goodsName' | 'sellerName' | 'notes';
  operator: 'contains' | 'equals';
  values: string[];
}

export interface NumericCondition {
  field: 'totalAmount' | 'taxRate';
  operator: '>' | '<' | '>=' | '<=' | 'equals';
  value: number;
}

export interface SupplierListCondition {
  field: 'supplierInList';
  groupName: string;
}

// --- Action Types ---
export type SmartRuleAction =
  | OverrideSubjectAction
  | AssignAuxiliaryAction
  | MarkAsAction
  | CreateFixedAssetAction
  | SupplierSubjectAction
  | ReimbursementSubjectAction;

export interface OverrideSubjectAction {
  type: 'overrideSubject';
  slot: 'debit' | 'tax' | 'credit';
  subjectCode: string;
  subjectName: string;
}

export interface AssignAuxiliaryAction {
  type: 'assignAuxiliary';
  auxiliaryType: 'employee' | 'project';
  nameList: string[];
  sourceField: 'notes' | 'sellerName';
}

export interface MarkAsAction {
  type: 'markAs';
  category: 'purchase' | 'reimbursement' | 'fixed_asset';
}

export interface CreateFixedAssetAction {
  type: 'createFixedAsset';
  assetCategory: string;
  depreciationYears: number;
  depreciationMethod: DepreciationMethod;
  assetSubjectCode: string;
  depreciationSubjectCode: string;
  expenseSubjectCode: string;
  residualRate: number;
}

export interface SupplierSubjectAction {
  type: 'supplierSubject';
  groupName: string;
}

export interface ReimbursementSubjectAction {
  type: 'reimbursementSubject';
  creditSubjectCode: string;
  creditSubjectName: string;
}

// --- Rule Type ---
export interface InvoiceSmartRule {
  id: string;
  accountSetId: string;
  name: string;
  invoiceType: 'input' | 'output' | 'both';
  priority: number;
  // Note: conditionLogic intentionally omitted — v2.0 is AND-only. Add field when OR is needed.
  conditions: SmartRuleCondition[];
  actions: SmartRuleAction[];
  enabled: boolean;
  createTime: string;
  updateTime: string;
}

// --- Engine Result Types ---
export interface AuxiliaryResult {
  debitAuxiliary: string | null;
  creditAuxiliary: string | null;
  debitNeedsPrompt: boolean;
  creditNeedsPrompt: boolean;
  auxiliaryDisabled: boolean;
  docNo: string;                     // 始终 = invoice.invoiceCode
}

export interface ReimbursementResult {
  creditOverride: { code: string; name: string } | null;
  reimburserName: string | null;
  partnerCreated: boolean;
}

export interface ActionResult {
  subjectOverrides: Record<string, { code: string; name: string }>;
  auxiliaryResult: AuxiliaryResult | null;
  markCategory: 'purchase' | 'reimbursement' | 'fixed_asset' | null;
  fixedAssetCard: Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> | null;
  reimburserName: string | null;
  partnerCreated: boolean;
}

// --- Supporting Types ---
export type SupplierType = 'material' | 'inventory' | 'fixed_asset' | 'service' | 'other';

export interface SupplierSubjectMapping {
  id: string;
  accountSetId: string;
  groupName: string;
  sellerName: string;
  defaultDebitSubject?: string;
  defaultDebitSubjectName?: string;
  defaultTaxSubject?: string;
  defaultTaxSubjectName?: string;
  defaultCreditSubject?: string;
  defaultCreditSubjectName?: string;
  createTime: string;
  updateTime: string;
}

export interface ExpenseReimbursement {
  id: string;
  accountSetId: string;
  invoiceCode: string;
  reimburserName: string;
  reimburserId?: string;
  notes?: string;
  importBatchId?: string;
  createTime: string;
  updateTime: string;
}

export interface ExpenseKeywordCategory {
  id: string;
  accountSetId: string;
  category: string;
  keywords: string[];
  expenseSubjectCode?: string;
  expenseSubjectName?: string;
  isSystem: boolean;
  enabled: boolean;
  createTime: string;
  updateTime: string;
}

export interface AuxiliaryStrategyConfig {
  id: string;
  accountSetId: string;
  mode: 'auxiliary' | 'sub_account';
  autoCreatePartner: boolean;
  autoDisableAuxiliaryOnSubAccount: boolean;
  // 智能路由开关
  enableSmartRouting?: boolean;
  // 多动作执行开关
  enableMultiAction?: boolean;
  updateTime: string;
}

export interface PurchaseInvoiceRuleConfig {
  id: string;
  accountSetId: string;
  businessGroups: {
    id: string;
    name: string;
    debitSubject: string;
    debitSubjectName?: string;
    taxSubject: string;
    taxSubjectName?: string;
    creditSubject: string;
    creditSubjectName?: string;
    partnerType: string;
    assetThreshold?: number;
    priority?: number;
    description?: string;
    isPreset?: boolean;
    autoTax?: boolean;
    keywords?: string[];
    requirePartnerCard?: boolean; // 是否需要往来卡片（员工报销等不需要）
  }[];
  keywordRules: {
    id: string;
    keywords: string;
    businessGroup: string;
    threshold: number;
  }[];
  globalSettings: {
    assetThreshold: number;
    autoTaxSubject: boolean;
    autoCheckDuplicate: boolean;
    autoRecognizeReimburser: boolean;
  };
  updateTime: string;
}

export interface AssetCategoryMapping {
  id: string;
  accountSetId: string;
  keywords: string[];
  assetCategory: string;
  depreciationYears: number;
  depreciationMethod: string;
  subjectCode: string;
  residualRate: number;
  isSystem: boolean;
  createTime: string;
  updateTime: string;
}

// --- Engine Context (passed to executeActions) ---
export interface EngineContext {
  invoice: Invoice;
  matchedRule: InvoiceSmartRule | null;
  supplierMappings: SupplierSubjectMapping[];
  expenseReimbursements: ExpenseReimbursement[];
  auxiliaryStrategy: AuxiliaryStrategyConfig | null;
  expenseKeywords: ExpenseKeywordCategory[];
  assetMappings: AssetCategoryMapping[];
  allRules: InvoiceSmartRule[];
  baseTaxSubject?: string;
}

// 发票筛选条件
export interface InvoiceFilter {
  invoiceType?: InvoiceType;
  startDate?: string;
  endDate?: string;
  partnerId?: string;
  paymentStatus?: InvoicePaymentStatus;
  hasVoucher?: boolean;
  searchQuery?: string;
}

// 发票资金一览表项
export interface InvoiceSummaryItem {
  partnerId?: string;
  partnerName: string;
  totalInputAmount: number;         // 进项发票总额
  totalOutputAmount: number;        // 销项发票总额
  paidInputAmount: number;          // 已付进项金额
  receivedOutputAmount: number;     // 已收销项金额
  unpaidInputAmount: number;        // 未付进项金额
  unreceivedOutputAmount: number;   // 未收销项金额
  inputInvoiceCount: number;        // 进项发票数量
  outputInvoiceCount: number;       // 销项发票数量
  hasVoucherInputCount: number;     // 已生成凭证的进项发票数
  hasVoucherOutputCount: number;    // 已生成凭证的销项发票数
}