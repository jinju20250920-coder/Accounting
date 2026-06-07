import type {
  AssetCategoryMapping,
  AuxiliaryStrategyConfig,
  ExpenseKeywordCategory,
  ExpenseReimbursement,
  InvoiceSmartRule,
  PurchaseInvoiceRuleConfig,
  SupplierSubjectMapping,
} from '../../../types';
import type { CustomBankConfig } from '../../bank-parsers/types';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';
import type { SimpleQueryService } from './dept-project-currency-sqlite-service';

export interface InvoiceRuleQueryService extends SimpleQueryService {
  runAsync(sql: string, params?: SqliteBindable[]): Promise<void>;
}

// ════════════════════════════════════════════
// Custom Bank Configs
// ════════════════════════════════════════════

interface CustomBankConfigRow {
  id: string;
  accountSetId: string;
  name: string;
  config: string;
  createdAt: string;
  updatedAt: string;
}

export async function listCustomBankConfigs(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<CustomBankConfig[]> {
  const results = await service.queryAllAsync<CustomBankConfigRow>(
    `SELECT * FROM custom_bank_configs WHERE accountSetId = ? ORDER BY createdAt DESC`,
    [accountSetId],
  );
  return (results || []).map(row => ({
    id: row.id,
    accountSetId: row.accountSetId,
    name: row.name,
    config: JSON.parse(row.config) as CustomBankConfig['config'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function saveCustomBankConfigRecord(input: {
  db: SqliteDatabaseLike;
  config: CustomBankConfig;
  persist: () => Promise<void>;
}): Promise<void> {
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO custom_bank_configs (id, accountSetId, name, config, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  try {
    stmt.run([
      input.config.id,
      input.config.accountSetId,
      input.config.name,
      JSON.stringify(input.config.config),
      input.config.createdAt,
      input.config.updatedAt,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteCustomBankConfigRecord(
  service: Pick<InvoiceRuleQueryService, 'runAsync'>,
  accountSetId: string,
  id: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(
    `DELETE FROM custom_bank_configs WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  await persist();
}

// ════════════════════════════════════════════
// Smart Rules
// ════════════════════════════════════════════

interface SmartRuleRow {
  id: string;
  accountSetId: string;
  name: string;
  invoiceType: string;
  priority: number;
  conditions: string;
  actions: string;
  enabled: number;
  createTime: string;
  updateTime: string;
}

export async function listSmartRules(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<InvoiceSmartRule[]> {
  const results = await service.queryAllAsync<SmartRuleRow>(
    `SELECT * FROM invoice_smart_rules WHERE accountSetId = ? ORDER BY priority DESC, name ASC`,
    [accountSetId],
  );
  return (results || []).map(row => {
    let conditions: unknown[] = [];
    let actions: unknown[] = [];
    try { conditions = JSON.parse(row.conditions); } catch { conditions = []; }
    try { actions = JSON.parse(row.actions); } catch { actions = []; }
    return {
      id: row.id,
      accountSetId: row.accountSetId,
      name: row.name,
      invoiceType: row.invoiceType,
      priority: row.priority,
      conditions,
      actions,
      enabled: !!row.enabled,
      createTime: row.createTime,
      updateTime: row.updateTime,
    } as InvoiceSmartRule;
  });
}

export async function saveSmartRuleRecord(input: {
  db: SqliteDatabaseLike;
  rule: InvoiceSmartRule;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const conditions = typeof input.rule.conditions === 'string'
    ? input.rule.conditions
    : JSON.stringify(input.rule.conditions || []);
  const actions = typeof input.rule.actions === 'string'
    ? input.rule.actions
    : JSON.stringify(input.rule.actions || []);
  const now = new Date().toISOString();
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO invoice_smart_rules
      (id, accountSetId, name, invoiceType, priority, conditions, actions, enabled, createTime, updateTime)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  try {
    stmt.run([
      input.rule.id,
      input.rule.accountSetId || input.accountSetId,
      input.rule.name,
      input.rule.invoiceType || 'both',
      input.rule.priority ?? 50,
      conditions,
      actions,
      input.rule.enabled !== false ? 1 : 0,
      input.rule.createTime || now,
      input.rule.updateTime || now,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteSmartRuleRecord(
  service: Pick<InvoiceRuleQueryService, 'runAsync'>,
  accountSetId: string,
  id: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(
    `DELETE FROM invoice_smart_rules WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  await persist();
}

// ════════════════════════════════════════════
// Supplier Subject Mapping
// ════════════════════════════════════════════

export async function listSupplierMappings(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<SupplierSubjectMapping[]> {
  const results = await service.queryAllAsync<SupplierSubjectMapping>(
    `SELECT * FROM supplier_subject_mapping WHERE accountSetId = ? ORDER BY groupName, sellerName`,
    [accountSetId],
  );
  return (results || []) as SupplierSubjectMapping[];
}

export async function listSupplierMappingsByGroup(
  service: SimpleQueryService,
  accountSetId: string,
  groupName: string,
): Promise<SupplierSubjectMapping[]> {
  const results = await service.queryAllAsync<SupplierSubjectMapping>(
    `SELECT * FROM supplier_subject_mapping WHERE accountSetId = ? AND groupName = ? ORDER BY sellerName`,
    [accountSetId, groupName],
  );
  return (results || []) as SupplierSubjectMapping[];
}

export async function findSupplierMappingBySellerName(
  service: SimpleQueryService,
  accountSetId: string,
  sellerName: string,
): Promise<SupplierSubjectMapping | null> {
  const result = await service.querySingleAsync<SupplierSubjectMapping>(
    `SELECT * FROM supplier_subject_mapping WHERE accountSetId = ? AND sellerName = ? LIMIT 1`,
    [accountSetId, sellerName],
  );
  return result as SupplierSubjectMapping | null;
}

export async function saveSupplierMappingRecord(input: {
  db: SqliteDatabaseLike;
  mapping: SupplierSubjectMapping;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO supplier_subject_mapping
      (id, accountSetId, groupName, sellerName,
       defaultDebitSubject, defaultDebitSubjectName,
       defaultTaxSubject, defaultTaxSubjectName,
       defaultCreditSubject, defaultCreditSubjectName,
       createTime, updateTime)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  try {
    stmt.run([
      input.mapping.id,
      input.mapping.accountSetId || input.accountSetId,
      input.mapping.groupName,
      input.mapping.sellerName,
      input.mapping.defaultDebitSubject || null,
      input.mapping.defaultDebitSubjectName || null,
      input.mapping.defaultTaxSubject || null,
      input.mapping.defaultTaxSubjectName || null,
      input.mapping.defaultCreditSubject || null,
      input.mapping.defaultCreditSubjectName || null,
      input.mapping.createTime || now,
      input.mapping.updateTime || now,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteSupplierMappingRecord(
  service: Pick<InvoiceRuleQueryService, 'runAsync'>,
  accountSetId: string,
  id: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(
    `DELETE FROM supplier_subject_mapping WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  await persist();
}

// ════════════════════════════════════════════
// Purchase Invoice Rule Config
// ════════════════════════════════════════════

interface PurchaseInvoiceRuleConfigRow {
  id: string;
  accountSetId: string;
  businessGroups: string;
  keywordRules: string;
  globalSettings: string;
  updateTime: string;
}

const DEFAULT_BUSINESS_GROUPS: PurchaseInvoiceRuleConfig['businessGroups'] = [
  { id: 'inventory', name: '库存商品', debitSubject: '1403.02 库存商品', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 100, assetThreshold: 5000, isPreset: true, autoTax: true, keywords: ['库存', '商品', '存货'], requirePartnerCard: true },
  { id: 'material', name: '生产材料', debitSubject: '1403.01 原材料', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 90, assetThreshold: 5000, isPreset: true, autoTax: true, keywords: ['材料', '原料', '配件'], requirePartnerCard: true },
  { id: 'reimbursement', name: '员工报销', debitSubject: '(匹配关键词)', taxSubject: '', creditSubject: '2241 其他应付款', partnerType: '员工', priority: 80, assetThreshold: 0, isPreset: true, autoTax: false, keywords: ['报销', '差旅', '办公'], requirePartnerCard: false },
  { id: 'fixed_asset', name: '固定资产', debitSubject: '1601 固定资产', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 70, assetThreshold: 5000, isPreset: true, autoTax: true, keywords: ['设备', '固定资产', '机器'], requirePartnerCard: true },
];

const DEFAULT_KEYWORD_RULES: PurchaseInvoiceRuleConfig['keywordRules'] = [
  { id: '1', keywords: '电脑, 服务器', businessGroup: 'fixed_asset', threshold: 5000 },
  { id: '2', keywords: '滴滴, 打车', businessGroup: 'reimbursement', threshold: 0 },
];

const DEFAULT_GLOBAL_SETTINGS: PurchaseInvoiceRuleConfig['globalSettings'] = {
  assetThreshold: 5000,
  autoTaxSubject: true,
  autoCheckDuplicate: true,
  autoRecognizeReimburser: true,
};

export async function getPurchaseInvoiceRuleConfigQuery(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<{ config: PurchaseInvoiceRuleConfig; isDefault: boolean }> {
  const result = await service.querySingleAsync<PurchaseInvoiceRuleConfigRow>(
    `SELECT * FROM purchase_invoice_rule_config WHERE accountSetId = ?`,
    [accountSetId],
  );
  if (result) {
    return {
      isDefault: false,
      config: {
        id: result.id,
        accountSetId: result.accountSetId,
        businessGroups: JSON.parse(result.businessGroups),
        keywordRules: JSON.parse(result.keywordRules),
        globalSettings: JSON.parse(result.globalSettings),
        updateTime: result.updateTime,
      },
    };
  }
  return {
    isDefault: true,
    config: {
      id: `pirc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      accountSetId,
      businessGroups: DEFAULT_BUSINESS_GROUPS,
      keywordRules: DEFAULT_KEYWORD_RULES,
      globalSettings: DEFAULT_GLOBAL_SETTINGS,
      updateTime: new Date().toISOString(),
    },
  };
}

export async function savePurchaseInvoiceRuleConfigRecord(input: {
  db: SqliteDatabaseLike;
  config: PurchaseInvoiceRuleConfig;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO purchase_invoice_rule_config
      (id, accountSetId, businessGroups, keywordRules, globalSettings, updateTime)
     VALUES (?,?,?,?,?,?)`,
  );
  try {
    stmt.run([
      input.config.id,
      input.config.accountSetId || input.accountSetId,
      JSON.stringify(input.config.businessGroups),
      JSON.stringify(input.config.keywordRules),
      JSON.stringify(input.config.globalSettings),
      input.config.updateTime || now,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

// ════════════════════════════════════════════
// Expense Reimbursement
// ════════════════════════════════════════════

export async function listExpenseReimbursements(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<ExpenseReimbursement[]> {
  const results = await service.queryAllAsync<ExpenseReimbursement>(
    `SELECT * FROM expense_reimbursement WHERE accountSetId = ? ORDER BY createTime DESC`,
    [accountSetId],
  );
  return (results || []) as ExpenseReimbursement[];
}

export async function saveExpenseReimbursementRecord(input: {
  db: SqliteDatabaseLike;
  record: ExpenseReimbursement;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO expense_reimbursement
      (id, accountSetId, invoiceCode, reimburserName, reimburserId, notes, importBatchId, createTime, updateTime)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  try {
    stmt.run([
      input.record.id,
      input.record.accountSetId || input.accountSetId,
      input.record.invoiceCode,
      input.record.reimburserName,
      input.record.reimburserId || null,
      input.record.notes || null,
      input.record.importBatchId || null,
      input.record.createTime || now,
      input.record.updateTime || now,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function updateExpenseReimbursementRecord(input: {
  db: SqliteDatabaseLike;
  id: string;
  updates: Partial<ExpenseReimbursement>;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const updateFields = Object.keys(input.updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(input.updates), now, input.id, input.accountSetId] as SqliteBindable[];
  const stmt = input.db.prepare(
    `UPDATE expense_reimbursement SET ${updateFields}, updateTime = ? WHERE id = ? AND accountSetId = ?`,
  );
  try {
    stmt.run(values);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteExpenseReimbursementRecord(
  service: Pick<InvoiceRuleQueryService, 'runAsync'>,
  accountSetId: string,
  id: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(
    `DELETE FROM expense_reimbursement WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  await persist();
}

export async function clearExpenseReimbursementsRecord(
  service: Pick<InvoiceRuleQueryService, 'runAsync'>,
  accountSetId: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(
    `DELETE FROM expense_reimbursement WHERE accountSetId = ?`,
    [accountSetId],
  );
  await persist();
}

// ════════════════════════════════════════════
// Expense Keyword Categories
// ════════════════════════════════════════════

interface ExpenseKeywordCategoryRow {
  id: string;
  accountSetId: string;
  category: string;
  keywords: string;
  expenseSubjectCode: string | null;
  expenseSubjectName: string | null;
  isSystem: number;
  enabled: number;
  createTime: string;
  updateTime: string;
}

export async function listExpenseKeywordCategories(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<ExpenseKeywordCategory[]> {
  const results = await service.queryAllAsync<ExpenseKeywordCategoryRow>(
    `SELECT * FROM expense_keyword_categories WHERE accountSetId = ? ORDER BY category`,
    [accountSetId],
  );
  return (results || []).map(row => {
    let keywords: string[] = [];
    try { keywords = JSON.parse(row.keywords); } catch { keywords = []; }
    return {
      id: row.id,
      accountSetId: row.accountSetId,
      category: row.category,
      keywords,
      expenseSubjectCode: row.expenseSubjectCode,
      expenseSubjectName: row.expenseSubjectName,
      isSystem: !!row.isSystem,
      enabled: !!row.enabled,
      createTime: row.createTime,
      updateTime: row.updateTime,
    } as ExpenseKeywordCategory;
  });
}

export async function saveExpenseKeywordCategoryRecord(input: {
  db: SqliteDatabaseLike;
  cat: ExpenseKeywordCategory;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const keywords = typeof input.cat.keywords === 'string'
    ? input.cat.keywords
    : JSON.stringify(input.cat.keywords || []);
  const now = new Date().toISOString();
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO expense_keyword_categories
      (id, accountSetId, category, keywords, expenseSubjectCode, expenseSubjectName,
       isSystem, enabled, createTime, updateTime)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  try {
    stmt.run([
      input.cat.id,
      input.cat.accountSetId || input.accountSetId,
      input.cat.category,
      keywords,
      input.cat.expenseSubjectCode || null,
      input.cat.expenseSubjectName || null,
      input.cat.isSystem ? 1 : 0,
      input.cat.enabled !== false ? 1 : 0,
      input.cat.createTime || now,
      input.cat.updateTime || now,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteExpenseKeywordCategoryRecord(
  service: Pick<InvoiceRuleQueryService, 'runAsync'>,
  accountSetId: string,
  id: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(
    `DELETE FROM expense_keyword_categories WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  await persist();
}

// ════════════════════════════════════════════
// Auxiliary Strategy
// ════════════════════════════════════════════

interface AuxiliaryStrategyConfigRow {
  id: string;
  accountSetId: string;
  mode: string;
  autoCreatePartner: number;
  autoDisableAuxiliaryOnSubAccount: number;
  updateTime: string;
}

export async function getAuxiliaryStrategyQuery(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<AuxiliaryStrategyConfig | null> {
  const result = await service.querySingleAsync<AuxiliaryStrategyConfigRow>(
    `SELECT * FROM auxiliary_strategy_config WHERE accountSetId = ? LIMIT 1`,
    [accountSetId],
  );
  if (!result) return null;
  return {
    id: result.id,
    accountSetId: result.accountSetId,
    mode: result.mode,
    autoCreatePartner: !!result.autoCreatePartner,
    autoDisableAuxiliaryOnSubAccount: !!result.autoDisableAuxiliaryOnSubAccount,
    updateTime: result.updateTime,
  } as AuxiliaryStrategyConfig;
}

export async function saveAuxiliaryStrategyRecord(input: {
  db: SqliteDatabaseLike;
  config: AuxiliaryStrategyConfig;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO auxiliary_strategy_config
      (id, accountSetId, mode, autoCreatePartner, autoDisableAuxiliaryOnSubAccount, updateTime)
     VALUES (?,?,?,?,?,?)`,
  );
  try {
    stmt.run([
      input.config.id,
      input.config.accountSetId || input.accountSetId,
      input.config.mode || 'auxiliary',
      input.config.autoCreatePartner ? 1 : 0,
      input.config.autoDisableAuxiliaryOnSubAccount !== false ? 1 : 0,
      input.config.updateTime || new Date().toISOString(),
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

// ════════════════════════════════════════════
// Asset Category Mapping
// ════════════════════════════════════════════

interface AssetCategoryMappingRow {
  id: string;
  accountSetId: string;
  keywords: string;
  assetCategory: string;
  depreciationYears: number;
  depreciationMethod: string;
  subjectCode: string;
  residualRate: number;
  isSystem: number;
  createTime: string;
  updateTime: string;
}

export async function listAssetCategoryMappings(
  service: SimpleQueryService,
  accountSetId: string,
): Promise<AssetCategoryMapping[]> {
  const results = await service.queryAllAsync<AssetCategoryMappingRow>(
    `SELECT * FROM asset_category_mapping WHERE accountSetId = ? ORDER BY assetCategory`,
    [accountSetId],
  );
  return (results || []).map(row => {
    let keywords: string[] = [];
    try { keywords = JSON.parse(row.keywords); } catch { keywords = []; }
    return {
      id: row.id,
      accountSetId: row.accountSetId,
      keywords,
      assetCategory: row.assetCategory,
      depreciationYears: row.depreciationYears,
      depreciationMethod: row.depreciationMethod,
      subjectCode: row.subjectCode,
      residualRate: row.residualRate,
      isSystem: !!row.isSystem,
      createTime: row.createTime,
      updateTime: row.updateTime,
    } as AssetCategoryMapping;
  });
}

export async function saveAssetCategoryMappingRecord(input: {
  db: SqliteDatabaseLike;
  mapping: AssetCategoryMapping;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const keywords = typeof input.mapping.keywords === 'string'
    ? input.mapping.keywords
    : JSON.stringify(input.mapping.keywords || []);
  const now = new Date().toISOString();
  const stmt = input.db.prepare(
    `INSERT OR REPLACE INTO asset_category_mapping
      (id, accountSetId, keywords, assetCategory, depreciationYears, depreciationMethod,
       subjectCode, residualRate, isSystem, createTime, updateTime)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  try {
    stmt.run([
      input.mapping.id,
      input.mapping.accountSetId || input.accountSetId,
      keywords,
      input.mapping.assetCategory,
      input.mapping.depreciationYears,
      input.mapping.depreciationMethod || 'straight_line',
      input.mapping.subjectCode,
      input.mapping.residualRate ?? 0.05,
      input.mapping.isSystem ? 1 : 0,
      input.mapping.createTime || now,
      input.mapping.updateTime || now,
    ]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function deleteAssetCategoryMappingRecord(
  service: Pick<InvoiceRuleQueryService, 'runAsync'>,
  accountSetId: string,
  id: string,
  persist: () => Promise<void>,
): Promise<void> {
  await service.runAsync(
    `DELETE FROM asset_category_mapping WHERE id = ? AND accountSetId = ?`,
    [id, accountSetId],
  );
  await persist();
}

// ════════════════════════════════════════════
// Invoice hold/category updates
// ════════════════════════════════════════════

export async function updateInvoiceHoldStatusRecord(input: {
  db: SqliteDatabaseLike;
  id: string;
  holdStatus: 'normal' | 'on_hold';
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const stmt = input.db.prepare(
    `UPDATE invoices SET holdStatus = ?, updateTime = ? WHERE id = ? AND accountSetId = ?`,
  );
  try {
    stmt.run([input.holdStatus, now, input.id, input.accountSetId]);
  } finally {
    stmt.free();
  }
  await input.persist();
}

export async function updateInvoiceCategoryRecord(input: {
  db: SqliteDatabaseLike;
  id: string;
  category: string | null;
  accountSetId: string;
  persist: () => Promise<void>;
}): Promise<void> {
  const now = new Date().toISOString();
  const stmt = input.db.prepare(
    `UPDATE invoices SET category = ?, updateTime = ? WHERE id = ? AND accountSetId = ?`,
  );
  try {
    stmt.run([input.category, now, input.id, input.accountSetId]);
  } finally {
    stmt.free();
  }
  await input.persist();
}
