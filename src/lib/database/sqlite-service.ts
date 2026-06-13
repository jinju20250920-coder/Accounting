import type {
  Voucher as _Voucher,
  VoucherEntry as _VoucherEntry,
  Subject as _Subject,
  Department as _Department,
  Project as _Project,
  Currency as _Currency,
  Partner as _Partner,
  VoucherFullTemplate as _VoucherTemplate,
  CommonSummary as _CommonSummary,
  UserPreference as _UserPreference,
  InvoiceSmartRule as _InvoiceSmartRule,
  SupplierSubjectMapping as _SupplierSubjectMapping,
  ExpenseReimbursement as _ExpenseReimbursement,
  ExpenseKeywordCategory as _ExpenseKeywordCategory,
  AuxiliaryStrategyConfig as _AuxiliaryStrategyConfig,
  AssetCategoryMapping as _AssetCategoryMapping,
  FxRate as _FxRate,
  FxRevaluationRun as _FxRevaluationRun,
  FxRevaluationRunLine as _FxRevaluationRunLine,
  PurchaseInvoiceRuleConfig as _PurchaseInvoiceRuleConfig,
} from '@/types';
import type {
  PayrollBatch,
  PayrollCalculationConfigRecord,
  PayrollItem,
} from '../payroll';
import { clonePayrollTaxRuleSet } from '../payroll-tax-rules';
import { saveFixedAssetRecord, type FixedAssetSaveInput } from './services/fixed-asset-sqlite-service';
import {
  deleteBankAccountBindingRecord,
  findBankAccountBindingRecord,
  listBankAccountBindings,
  saveBankAccountBindingRecord,
  type BankAccountBinding,
  type BankAccountBindingQueryService,
} from './services/bank-account-sqlite-service';
import {
  findPartnerByCode,
  findPartnerByName,
  insertPartnerRecord,
  listPartners,
  savePartnersRecord,
  type PartnerInsertInput,
  type PartnerQueryService,
} from './services/partner-sqlite-service';
import {
  buildBankTransactionUpdate,
  clearBankTransactionsRecord,
  deleteBankTransactionRecord,
  deleteBankTransactionsByBatchRecord,
  existsBankTransactionRecord,
  findPostedBankTransactionRecord,
  getBankTransactionRecord,
  listBankTransactionsByBatchRecord,
  listBankTransactionsByDateRangeRecord,
  listBankTransactionsByStatusRecord,
  listBankTransactionsRecord,
  saveBankTransactionRecord,
  updateBankTransactionRecord,
  type BankTransactionQueryService,
  type BankTransactionRecord,
  type BankTransactionSaveInput,
  type BankTransactionUpdateInput,
} from './services/bank-transaction-sqlite-service';
import {
  calculatePartnerBalance as calcPartnerBalance,
  findRecRelationsByEntryId as findRecByEntryId,
  findRecRelationsByRecRefNo as findRecByRefNo,
  getOutstandingItems as getOutstanding,
  listRecRelations,
  saveRecRelationRecord,
  saveRecRelationsRecord,
  updateEntryRecRefNoRecord,
  type ReconciliationQueryService,
} from './services/reconciliation-sqlite-service';
import {
  findSubjectByCode,
  hasVoucherForSubject as hasVoucherForSubjectQuery,
  listSubjects,
  migrateSubjectVouchersRecord,
  saveSubjectsRecord,
  type SubjectQueryService,
} from './services/subject-sqlite-service';
import {
  findCurrencyByCode as findCurrencyByCodeQuery,
  findDepartmentByCode as findDeptByCodeQuery,
  findProjectByCode as findProjByCodeQuery,
  listCurrencies,
  listDepartments,
  listProjects,
  saveCurrenciesRecord,
  saveDepartmentsRecord,
  saveProjectsRecord,
  type SimpleQueryService,
} from './services/dept-project-currency-sqlite-service';
import {
  addAuditLogRecord,
  listAuditLogs,
  listCommonSummaries,
  listPreferencesByUser,
  saveCommonSummariesRecord,
  savePreferenceRecord,
} from './services/audit-preference-summary-sqlite-service';
import {
  deleteFxRevaluationRunRecord,
  findFxRevaluationRun,
  findVoucherTemplateById,
  getAccountSetBaseCurrencyQuery,
  listFxRates,
  listFxRevaluationRunLines,
  listFxRevaluationRuns,
  listVoucherTemplates,
  mapFxRateRow,
  saveAccountSetBaseCurrencyRecord,
  saveFxRatesRecord,
  saveFxRevaluationRunLinesRecord,
  saveFxRevaluationRunRecord,
  saveVoucherTemplatesRecord,
} from './services/voucher-template-fx-sqlite-service';
import {
  checkDataIntegrityQuery,
  clearAllDataRecord,
  exportAccountSetData,
  importFxRevaluationRunLinesRecord,
  importFxRevaluationRunsRecord,
} from './services/export-import-sqlite-service';
import {
  getBankOpeningBalanceQuery,
  getBankOpeningBalanceDetailQuery,
  getAllBankOpeningBalancesQuery,
  getCashOverviewQuery,
  getJournalEntriesQuery,
  getTransactionStatusCountsQuery,
  saveBankOpeningBalanceRecord,
} from './services/bank-cash-sqlite-service';
import {
  deleteVoucherRecord,
  getVoucherById,
  listVouchers,
  listVouchersByDateRange,
  listVouchersByStatus,
  saveVoucherRecord,
  updateVoucherStatusRecord,
  type VoucherQueryService,
} from './services/voucher-sqlite-service';
import {
  clearExpenseReimbursementsRecord,
  deleteAssetCategoryMappingRecord,
  deleteCustomBankConfigRecord,
  deleteExpenseKeywordCategoryRecord,
  deleteExpenseReimbursementRecord,
  deleteSmartRuleRecord,
  deleteSupplierMappingRecord,
  getAuxiliaryStrategyQuery,
  getPurchaseInvoiceRuleConfigQuery,
  listAssetCategoryMappings,
  listCustomBankConfigs,
  listExpenseKeywordCategories,
  listExpenseReimbursements,
  listSmartRules,
  listSupplierMappings,
  listSupplierMappingsByGroup,
  findSupplierMappingBySellerName,
  saveAssetCategoryMappingRecord,
  saveAuxiliaryStrategyRecord,
  saveCustomBankConfigRecord,
  saveExpenseKeywordCategoryRecord,
  saveExpenseReimbursementRecord,
  savePurchaseInvoiceRuleConfigRecord,
  saveSmartRuleRecord,
  saveSupplierMappingRecord,
  updateExpenseReimbursementRecord,
  updateInvoiceCategoryRecord,
  updateInvoiceHoldStatusRecord,
  type InvoiceRuleQueryService,
} from './services/invoice-rule-sqlite-service';
import type { CustomBankConfig } from '../bank-parsers/types';
import {
  clearPayrollBatchVoucherByVoucherIdRecord,
  deletePayrollBatchRecord,
  getPayrollBatchByVoucherId,
  getPayrollCalculationConfigQuery,
  listPayrollBatches,
  listPayrollItems,
  savePayrollBatchRecord,
  savePayrollCalculationConfigRecord,
  updatePayrollBatchStatusRecord,
  updatePayrollBatchVoucherRecord,
  type PayrollQueryService,
} from './services/payroll-sqlite-service';

const resolveSqlJsWasmPath = (file: string): string => {
  if (typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.cwd === 'function') {
    return `${process.cwd().replace(/\\/g, '/')}/node_modules/sql.js/dist/${file}`;
  }
  return `/sqljs/${file}`;
};

// Re-export types for stores to import
export type Voucher = _Voucher;
export type VoucherEntry = _VoucherEntry;
export type Subject = _Subject;
export type Department = _Department;
export type Project = _Project;
export type Currency = _Currency;
export type Partner = _Partner;
export type VoucherTemplate = _VoucherTemplate;
export type CommonSummary = _CommonSummary;
export type UserPreference = _UserPreference;
export type InvoiceSmartRule = _InvoiceSmartRule;
export type SupplierSubjectMapping = _SupplierSubjectMapping;
export type ExpenseReimbursement = _ExpenseReimbursement;
export type ExpenseKeywordCategory = _ExpenseKeywordCategory;
export type AuxiliaryStrategyConfig = _AuxiliaryStrategyConfig;
export type AssetCategoryMapping = _AssetCategoryMapping;
export type FxRate = _FxRate;
export type FxRevaluationRun = _FxRevaluationRun;
export type FxRevaluationRunLine = _FxRevaluationRunLine;
export type PurchaseInvoiceRuleConfig = _PurchaseInvoiceRuleConfig;

// AuditLog interface
export interface AuditLog {
  id: string;
  type: 'create' | 'update' | 'delete' | 'post' | 'reverse';
  entityType: 'voucher' | 'entry' | 'subject' | 'department' | 'project' | 'partner' | 'currency' | 'template' | 'period';
  entityId: string;
  details: string;
  userId: string;
  timestamp: string;
  accountSetId?: string;
}

class SQLiteService {
  private dbInstance: any = null;
  private _accountSetId: string = 'default'; // 当前账套ID
  private _initPromise: Promise<void> | null = null; // 防止并发初始化

  /** 写操作后立即持久化到 OPFS/localStorage/磁盘 */
  private async persist(): Promise<void> {
    try {
      const { sqliteManager } = await import('./sqlite-manager');
      await sqliteManager.save();
    } catch {
      // sqliteManager 不可用时静默忽略（fallback 内存库无法持久化）
    }
  }

  // 设置当前账套ID
  setAccountSetId(accountSetId: string) {
    if (this._accountSetId === accountSetId) return;
    this._accountSetId = accountSetId;
  }

  // 获取当前账套ID
  get accountSetId(): string {
    return this._accountSetId;
  }

  // 公开方法：获取数据库实例（带完整初始化和降级逻辑）
  async getDatabase(): Promise<any> {
    await this.ensureInitialized();
    return this.dbInstance;
  }

  private async getDb(): Promise<any> {
    // 如果有缓存的实例，直接返回
    if (this.dbInstance) {
      return this.dbInstance;
    }

    // 从全局 sqliteManager 获取数据库
    try {
      const { sqliteManager } = await import('./sqlite-manager');
      await sqliteManager.init();
      const db = await sqliteManager.getDatabaseSafe();
      if (db) {
        this.dbInstance = db;
        return db;
      }
    } catch (error) {
      console.error('Failed to initialize sqliteManager:', error);
    }

    // 最后回退：创建内存数据库
    try {
      const SQL = await (await import('sql.js')).default({
        locateFile: resolveSqlJsWasmPath,
      });
      const db = new SQL.Database();
      console.warn('Using in-memory database as last resort');
      this.dbInstance = db;
      return db;
    } catch (error) {
      console.error('Failed to create in-memory database:', error);
    }

    throw new Error('All database initialization methods failed');
  }

  private getBankAccountBindingQueryService(): BankAccountBindingQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
      runAsync: (sql: string, params?: unknown[]) => this.runAsync(sql, params),
    };
  }

  private getBankTransactionQueryService(): BankTransactionQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
      runAsync: (sql: string, params?: unknown[]) => this.runAsync(sql, params),
    };
  }

  private getPartnerQueryService(): PartnerQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
    };
  }

  private getVoucherQueryService(): VoucherQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
    };
  }

  private getReconciliationQueryService(): ReconciliationQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
    };
  }

  private getSubjectQueryService(): SubjectQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
    };
  }

  private getSimpleQueryService(): SimpleQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
    };
  }

  private getInvoiceRuleQueryService(): InvoiceRuleQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
      runAsync: (sql: string, params?: unknown[]) => this.runAsync(sql, params),
    };
  }

  private getPayrollQueryService(): PayrollQueryService {
    return {
      queryAllAsync: <T>(sql: string, params?: unknown[]) => this.queryAllAsync<T>(sql, params),
      querySingleAsync: <T>(sql: string, params?: unknown[]) => this.querySingleAsync<T>(sql, params),
      runAsync: (sql: string, params?: unknown[]) => this.runAsync(sql, params),
    };
  }

  // 确保数据库已初始化的辅助方法（带并发保护）
  private async ensureInitialized(): Promise<void> {
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._doEnsureInitialized();
    try {
      await this._initPromise;
    } catch (err) {
      // 初始化失败时重置，允许下次重试
      this._initPromise = null;
      throw err;
    }
  }

  private async _doEnsureInitialized(): Promise<void> {
    if (!this.dbInstance) {
      this.dbInstance = await this.getDb();
    }
    if (!this.dbInstance) {
      console.error('Failed to initialize SQLite database');
      throw new Error('Failed to initialize SQLite database');
    }

    // 迁移：检查并添加 accountSetId 列（如果不存在）
    await this.migrateAddAccountSetIdColumns();
    await this.migrateMulticurrencyFoundation();
    // 迁移：检查并添加 subjects 表的新列（如果不存在）
    await this.migrateAddSubjectColumns();
    // 迁移：检查并创建固定资产相关表（如果不存在）
    await this.migrateCreateFixedAssetTables();
    // 迁移：检查并创建银行流水表（如果不存在）
    await this.migrateCreateBankTransactionsTable();
    // 迁移：创建银行流水匹配规则表
    await this.migrateCreateBankRulesTable();
    // 迁移：智能规则引擎相关表（替代 invoice_subject_rules）
    await this.migrateSmartRuleEngine();
    // 迁移：创建采购发票规则配置表
    await this.migratePurchaseInvoiceRuleConfig();
    // 迁移：从 supplier_subject_mapping 表移除 supplierType 列
    await this.migrateRemoveSupplierTypeColumn();
    // 迁移：invoices 表增加 groupName 列（旧 templateId 列重命名）
    await this.migrateAddInvoiceGroupName();
    await this.migrateFixedAssetLifecycle();
    await this.migrateBankTransactionsSourceColumn();
    // 迁移：创建工资导入和计算相关表
    await this.migrateCreatePayrollTables();
    // 迁移：创建用户/角色/权限相关表
    await this.migrateCreateUserTables();
    // 迁移：fxRates 表增加 createdBy 列
    await this.migrateFxRatesCreatedBy();
    // 迁移：创建银行账户期初余额表
    await this.migrateCreateBankOpeningBalancesTable();
    // 迁移：vouchers 表补齐 creator/reviewer/poster 等列
    await this.migrateAddVoucherColumns();
    // 迁移：创建部门和项目表
    await this.migrateCreateDepartmentProjectTables();
    // 数据迁移：为旧凭证补全外币分录字段（仅货币性项目，从关联的银行流水或摘要解析推断）
    await this.migrateBackfillVoucherEntryFxFields();
  }

  /**
   * 数据迁移：扫描所有凭证分录，对货币性项目（1001/1002/1122/2202 等）补全 currencyCode/exchangeRate/originalAmount。
   * 数据来源优先级：
   *   1. 关联的银行流水（bankTransactions.exchangeRate/originalAmount）
   *   2. 凭证摘要解析的 (XXX@rate) 模式
   * 非货币性分录若残留 FX 字段则清空（CAS 19 合规）。
   * 幂等：已存在 FX 字段的货币性分录不会被覆盖。
   */
  private async migrateBackfillVoucherEntryFxFields(): Promise<void> {
    if (!this.dbInstance) return;
    if (typeof localStorage !== 'undefined') {
      const flag = 'fx_migration_done_' + this.accountSetId;
      if (localStorage.getItem(flag) === '1') return;
    }

    // 健康检查：先用一个最简单的 query 探测 dbInstance 是否可用。
    try {
      const probe = this.dbInstance.exec('SELECT 1');
      if (!probe || probe.length === 0) return;
    } catch (err) {
      console.warn('[FX migration] 数据库探测失败，跳过本次迁移。', err);
      return;
    }

    // NOTE: 此方法在 _doEnsureInitialized() 内部被调用，不能使用 queryAllAsync（会触发 ensureInitialized 导致死锁）。
    // 直接使用 this.dbInstance 进行查询。
    const db = this.dbInstance;
    const asId = this.accountSetId || '';

    try {
      const MONETARY_PREFIXES = ['1001','1002','1012','1101','1121','1122','1123','1131','1132','1221','1231','1401','1471','1501','1502','1503','1504','2001','2002','2101','2201','2202','2203','2211','2221','2231','2232','2241','2501','2502','2701','2702'];
      const isMonetary = (code: string) => !!code && MONETARY_PREFIXES.some(p => code.startsWith(p));

      const vStmt = db.prepare(`SELECT id, voucherNo, summary, date FROM vouchers WHERE accountSetId = ?`);
      vStmt.bind([asId]);
      const rows: any[] = [];
      while (vStmt.step()) rows.push(vStmt.getAsObject());
      vStmt.free();

      let patchedCount = 0;
      for (const v of rows) {
        const eStmt = db.prepare(`SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`);
        eStmt.bind([v.id, asId]);
        const entries: any[] = [];
        while (eStmt.step()) entries.push(eStmt.getAsObject());
        eStmt.free();

        const tStmt = db.prepare(`SELECT * FROM bankTransactions WHERE accountSetId = ? AND voucherId = ? LIMIT 1`);
        tStmt.bind([asId, v.id]);
        const linkedTx: any[] = [];
        while (tStmt.step()) linkedTx.push(tStmt.getAsObject());
        tStmt.free();

        const txRate = linkedTx[0]?.exchangeRate;
        const txOriginal = linkedTx[0]?.originalAmount;
        const txCurrency = (linkedTx[0] as any)?.currencyCode || (linkedTx[0]?.summary?.match?.(/\(([A-Z]{3})@/)?.[1]);

        const summaryMatch = (v.summary || '').match(/\(([A-Z]{3})@([\d.]+)\)/);
        const summaryCurrency = summaryMatch?.[1];
        const summaryRate = summaryMatch ? parseFloat(summaryMatch[2]) : undefined;

        const effectiveCurrency = txCurrency || summaryCurrency;
        const effectiveRate = txRate || summaryRate;

        let needsUpdate = false;
        for (const e of entries) {
          const monetary = isMonetary(e.subjectCode || '');
          const hasExistingFx = !!e.currencyCode && e.currencyCode !== 'CNY';

          if (monetary && !hasExistingFx && effectiveCurrency && effectiveRate && effectiveRate > 0) {
            const cnyAmount = (e.debit || 0) + (e.credit || 0);
            const original = txOriginal && txOriginal > 0
              ? txOriginal
              : Math.round((cnyAmount / effectiveRate) * 100) / 100;
            const stmt = db.prepare(
              `UPDATE entries SET currencyCode = ?, currencyName = ?, exchangeRate = ?, originalAmount = ?, updateTime = ? WHERE id = ? AND accountSetId = ?`,
            );
            try {
              stmt.run([effectiveCurrency, effectiveCurrency, effectiveRate, original, new Date().toISOString(), e.id, asId]);
              needsUpdate = true;
            } finally {
              stmt.free();
            }
          } else if (!monetary && hasExistingFx) {
            const stmt = db.prepare(
              `UPDATE entries SET currencyCode = NULL, currencyName = NULL, exchangeRate = NULL, originalAmount = NULL, updateTime = ? WHERE id = ? AND accountSetId = ?`,
            );
            try {
              stmt.run([new Date().toISOString(), e.id, asId]);
              needsUpdate = true;
            } finally {
              stmt.free();
            }
          }
        }

        if (needsUpdate) patchedCount++;
      }

      if (patchedCount > 0) {
        await this.persist();
        console.log(`[FX migration] 已补全 ${patchedCount} 张凭证的外币字段`);
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fx_migration_done_' + this.accountSetId, '1');
      }
    } catch (err) {
      console.error('[FX migration] 失败:', err);
    }
  }

  private async migrateCreatePayrollTables(): Promise<void> {
    if (!this.dbInstance) return;

    const statements = [
      `CREATE TABLE IF NOT EXISTS payroll_batches (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        payrollPeriod TEXT NOT NULL,
        batchName TEXT NOT NULL,
        status TEXT NOT NULL,
        sourceFileName TEXT,
        employeeCount INTEGER NOT NULL DEFAULT 0,
        grossTotal REAL NOT NULL DEFAULT 0,
        employerCostTotal REAL NOT NULL DEFAULT 0,
        taxTotal REAL NOT NULL DEFAULT 0,
        netTotal REAL NOT NULL DEFAULT 0,
        calculationConfigSnapshot TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        confirmedAt TEXT,
        accrualVoucherId TEXT,
        accrualVoucherNo TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS payroll_items (
        id TEXT PRIMARY KEY,
        batchId TEXT NOT NULL,
        accountSetId TEXT NOT NULL,
        payrollPeriod TEXT NOT NULL,
        employeeCode TEXT NOT NULL,
        employeeName TEXT NOT NULL,
        departmentName TEXT,
        inputData TEXT NOT NULL,
        calculationResult TEXT NOT NULL,
        validationStatus TEXT NOT NULL,
        validationMessages TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS payroll_calculation_configs (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        effectivePeriod TEXT NOT NULL,
        socialInsuranceConfig TEXT NOT NULL,
        housingFundConfig TEXT NOT NULL,
        individualTaxConfig TEXT NOT NULL,
        policyLabel TEXT NOT NULL,
        policyEffectiveDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_payroll_batches_period ON payroll_batches(accountSetId, payrollPeriod)`,
      `CREATE INDEX IF NOT EXISTS idx_payroll_items_batch ON payroll_items(accountSetId, batchId)`,
      `CREATE INDEX IF NOT EXISTS idx_payroll_config_period ON payroll_calculation_configs(accountSetId, effectivePeriod)`,
    ];
    for (const sql of statements) {
      this.dbInstance.exec(sql);
    }
    await this.migrateAddPayrollBatchVoucherColumns();
  }

  private async migrateAddPayrollBatchVoucherColumns(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      const pragma = this.dbInstance.exec('PRAGMA table_info(payroll_batches)');
      const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];
      const missingColumns = [
        { name: 'accrualVoucherId', sql: 'ALTER TABLE payroll_batches ADD COLUMN accrualVoucherId TEXT' },
        { name: 'accrualVoucherNo', sql: 'ALTER TABLE payroll_batches ADD COLUMN accrualVoucherNo TEXT' },
      ].filter((item) => !columns.includes(item.name));

      if (missingColumns.length > 0) {
        this.dbInstance.exec(missingColumns.map((item) => item.sql).join(';\n'));
      }
    } catch (error) {
      if (!String(error).includes('duplicate column name')) {
        console.warn('payroll_batches voucher column migration warning:', error);
      }
    }
  }

  /**
   * 迁移：固定资产全生命周期管理扩展
   */
  private async migrateFixedAssetLifecycle(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      const pragma = this.dbInstance.exec("PRAGMA table_info(fixedAssets)");
      const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];

      // 新增字段
      const newColumns = [
        { name: 'remainingQuantity', sql: 'ALTER TABLE fixedAssets ADD COLUMN remainingQuantity INTEGER DEFAULT 1' },
        { name: 'unitPrice', sql: 'ALTER TABLE fixedAssets ADD COLUMN unitPrice REAL' },
        { name: 'acquisitionType', sql: "ALTER TABLE fixedAssets ADD COLUMN acquisitionType TEXT DEFAULT 'purchase'" },
        { name: 'sourceInvoiceId', sql: 'ALTER TABLE fixedAssets ADD COLUMN sourceInvoiceId TEXT' },
        { name: 'sourceVoucherId', sql: 'ALTER TABLE fixedAssets ADD COLUMN sourceVoucherId TEXT' },
        { name: 'originalUsefulLifeMonths', sql: 'ALTER TABLE fixedAssets ADD COLUMN originalUsefulLifeMonths INTEGER' },
        { name: 'depreciatedMonths', sql: 'ALTER TABLE fixedAssets ADD COLUMN depreciatedMonths INTEGER DEFAULT 0' },
        { name: 'serialNumber', sql: 'ALTER TABLE fixedAssets ADD COLUMN serialNumber TEXT' },
        { name: 'assignedUser', sql: 'ALTER TABLE fixedAssets ADD COLUMN assignedUser TEXT' },
        { name: 'improvementHistory', sql: "ALTER TABLE fixedAssets ADD COLUMN improvementHistory TEXT DEFAULT '[]'" },
        { name: 'disposalHistory', sql: "ALTER TABLE fixedAssets ADD COLUMN disposalHistory TEXT DEFAULT '[]'" },
        { name: 'cipSubjectCode', sql: 'ALTER TABLE fixedAssets ADD COLUMN cipSubjectCode TEXT' },
        { name: 'cipSubjectName', sql: 'ALTER TABLE fixedAssets ADD COLUMN cipSubjectName TEXT' },
        { name: 'disposalSubjectCode', sql: 'ALTER TABLE fixedAssets ADD COLUMN disposalSubjectCode TEXT' },
        { name: 'disposalSubjectName', sql: 'ALTER TABLE fixedAssets ADD COLUMN disposalSubjectName TEXT' },
        { name: 'assetType', sql: "ALTER TABLE fixedAssets ADD COLUMN assetType TEXT DEFAULT 'equipment'" },
        { name: 'accountingStatus', sql: "ALTER TABLE fixedAssets ADD COLUMN accountingStatus TEXT DEFAULT 'accounted'" },
        { name: 'acquisitionVoucherId', sql: 'ALTER TABLE fixedAssets ADD COLUMN acquisitionVoucherId TEXT' },
        { name: 'acquisitionVoucherNo', sql: 'ALTER TABLE fixedAssets ADD COLUMN acquisitionVoucherNo TEXT' },
        { name: 'acquisitionAccountingDate', sql: 'ALTER TABLE fixedAssets ADD COLUMN acquisitionAccountingDate TEXT' },
        { name: 'isOpeningBalance', sql: 'ALTER TABLE fixedAssets ADD COLUMN isOpeningBalance INTEGER DEFAULT 0' },
        { name: 'initialAccumulatedDepreciation', sql: 'ALTER TABLE fixedAssets ADD COLUMN initialAccumulatedDepreciation REAL DEFAULT 0' },
        { name: 'creditSubjectCode', sql: 'ALTER TABLE fixedAssets ADD COLUMN creditSubjectCode TEXT' },
        { name: 'creditSubjectName', sql: 'ALTER TABLE fixedAssets ADD COLUMN creditSubjectName TEXT' },
        { name: 'projectCode', sql: 'ALTER TABLE fixedAssets ADD COLUMN projectCode TEXT' },
        { name: 'projectName', sql: 'ALTER TABLE fixedAssets ADD COLUMN projectName TEXT' },
        { name: 'depreciationEndDate', sql: 'ALTER TABLE fixedAssets ADD COLUMN depreciationEndDate TEXT' },
        { name: 'remainingDepreciationMonths', sql: 'ALTER TABLE fixedAssets ADD COLUMN remainingDepreciationMonths INTEGER' },
      ];

      for (const col of newColumns) {
        if (!columns.includes(col.name)) {
          this.dbInstance.exec(col.sql);
          console.log(`fixedAssets table: added ${col.name} column`);
        }
      }

      // 初始化现有数据的默认值
      this.dbInstance.exec(`
        UPDATE fixedAssets SET remainingQuantity = quantity WHERE remainingQuantity IS NULL OR remainingQuantity = 1;
        UPDATE fixedAssets SET unitPrice = originalValue / quantity WHERE unitPrice IS NULL AND quantity > 0;
        UPDATE fixedAssets SET acquisitionType = 'opening_balance' WHERE acquisitionType IS NULL;
        UPDATE fixedAssets SET usefulLifeYears = 5 WHERE usefulLifeYears IS NULL;
        UPDATE fixedAssets SET usefulLifeMonths = 60 WHERE usefulLifeMonths IS NULL;
        UPDATE fixedAssets SET depreciationMethod = 'straight_line' WHERE depreciationMethod IS NULL;
        UPDATE fixedAssets SET depreciatedMonths = 0 WHERE depreciatedMonths IS NULL;
      `);
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.warn('FixedAsset lifecycle migration warning:', error);
      }
    }

    // 资产分类表迁移 - 添加折旧起始规则列
    try {
      const columnsResult = this.dbInstance.exec("PRAGMA table_info(assetCategories)");
      const columns = columnsResult[0]?.values?.map(v => v[1] as string) || [];

      if (!columns.includes('depreciationStartRule')) {
        console.log('Migrating assetCategories table: adding depreciationStartRule column');
        this.dbInstance.exec("ALTER TABLE assetCategories ADD COLUMN depreciationStartRule TEXT DEFAULT 'next_month'");
        // 更新现有分类：根据资产类型设置默认规则
        this.dbInstance.exec(`
          UPDATE assetCategories SET depreciationStartRule = 'current_month' WHERE assetType = 'intangible';
          UPDATE assetCategories SET depreciationStartRule = 'next_month' WHERE assetType = 'fixed' OR assetType IS NULL;
        `);

        // 修复无形资产的折旧开始日期：改为入账当月而非下月
        // 获取所有无形资产分类的ID
        const intangibleCategories = this.dbInstance.exec(
          "SELECT id FROM assetCategories WHERE assetType = 'intangible'"
        );
        if (intangibleCategories[0]?.values?.length > 0) {
          const categoryIds = intangibleCategories[0].values.map(v => v[0]);
          console.log('Fixing depreciationStartDate for intangible assets in categories:', categoryIds);

          // 更新无形资产的折旧开始日期：从入账日期当月1日开始
          for (const categoryId of categoryIds) {
            this.dbInstance.exec(`
              UPDATE fixedAssets
              SET depreciationStartDate = substr(acquisitionAccountingDate, 1, 8) || '01'
              WHERE categoryId = ? AND acquisitionAccountingDate IS NOT NULL
            `, [categoryId as string]);
          }
        }
      }
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.warn('AssetCategories depreciationStartRule migration warning:', error);
      }
    }

    // 创建资产变动记录表
    try {
      const tableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='assetChangeRecords'"
      );

      if (!tableCheck[0]?.values?.length) {
        console.log('Migrating database: creating assetChangeRecords table...');
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS assetChangeRecords (
            id TEXT PRIMARY KEY,
            assetId TEXT NOT NULL,
            assetCode TEXT NOT NULL,
            assetName TEXT NOT NULL,
            accountSetId TEXT NOT NULL,
            changeType TEXT NOT NULL,
            changeDate TEXT NOT NULL,
            period TEXT NOT NULL,
            fieldName TEXT NOT NULL,
            beforeValue TEXT,
            afterValue TEXT,
            originalValueChange REAL,
            depreciationChange REAL,
            originalValueBalance REAL,
            accumulatedDepreciationBalance REAL,
            netValueBalance REAL,
            voucherId TEXT,
            voucherNo TEXT,
            reason TEXT,
            operatorId TEXT,
            createTime TEXT NOT NULL,
            FOREIGN KEY (assetId) REFERENCES fixedAssets(id),
            FOREIGN KEY (voucherId) REFERENCES vouchers(id)
          );
          CREATE INDEX IF NOT EXISTS idx_acr_assetId ON assetChangeRecords(assetId);
          CREATE INDEX IF NOT EXISTS idx_acr_period ON assetChangeRecords(period);
          CREATE INDEX IF NOT EXISTS idx_acr_changeType ON assetChangeRecords(changeType);
        `);
        console.log('assetChangeRecords table migration completed');
      } else {
        // 添加时序账字段（ALTER TABLE）
        const acrPragma = this.dbInstance.exec("PRAGMA table_info(assetChangeRecords)");
        const acrColumns = acrPragma[0]?.values?.map((row: any[]) => row[1]) || [];
        const acrNewColumns = [
          { name: 'originalValueChange', sql: 'ALTER TABLE assetChangeRecords ADD COLUMN originalValueChange REAL' },
          { name: 'depreciationChange', sql: 'ALTER TABLE assetChangeRecords ADD COLUMN depreciationChange REAL' },
          { name: 'originalValueBalance', sql: 'ALTER TABLE assetChangeRecords ADD COLUMN originalValueBalance REAL' },
          { name: 'accumulatedDepreciationBalance', sql: 'ALTER TABLE assetChangeRecords ADD COLUMN accumulatedDepreciationBalance REAL' },
          { name: 'netValueBalance', sql: 'ALTER TABLE assetChangeRecords ADD COLUMN netValueBalance REAL' },
        ];
        for (const col of acrNewColumns) {
          if (!acrColumns.includes(col.name)) {
            this.dbInstance.exec(col.sql);
          }
        }
      }
    } catch (error) {
      console.warn('assetChangeRecords table migration warning:', error);
    }

    // 资产拆分记录表
    try {
      const splitTableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='assetSplitRecords'"
      );

      if (!splitTableCheck[0]?.values?.length) {
        console.log('Migrating database: creating assetSplitRecords table...');
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS assetSplitRecords (
            id TEXT PRIMARY KEY,
            sourceAssetId TEXT NOT NULL,
            targetAssetIds TEXT NOT NULL,
            splitDate TEXT NOT NULL,
            splitRatios TEXT NOT NULL,
            splitAmounts TEXT NOT NULL,
            voucherId TEXT,
            voucherNo TEXT,
            accountSetId TEXT NOT NULL,
            createTime TEXT NOT NULL
          )
        `);
        console.log('assetSplitRecords table migration completed');
      }
    } catch (error) {
      console.warn('assetSplitRecords table migration warning:', error);
    }

    // 资产合并记录表
    try {
      const mergeTableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='assetMergeRecords'"
      );

      if (!mergeTableCheck[0]?.values?.length) {
        console.log('Migrating database: creating assetMergeRecords table...');
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS assetMergeRecords (
            id TEXT PRIMARY KEY,
            sourceAssetIds TEXT NOT NULL,
            targetAssetId TEXT NOT NULL,
            mergeDate TEXT NOT NULL,
            sourceAmounts TEXT NOT NULL,
            voucherId TEXT,
            voucherNo TEXT,
            accountSetId TEXT NOT NULL,
            createTime TEXT NOT NULL
          )
        `);
        console.log('assetMergeRecords table migration completed');
      }
    } catch (error) {
      console.warn('assetMergeRecords table migration warning:', error);
    }
  }

  /**
   * 迁移：创建银行流水表（如果不存在）
   */
  private async migrateCreateBankTransactionsTable(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      // 检查 bankTransactions 表是否存在
      const tableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bankTransactions'"
      );

      if (!tableCheck[0]?.values?.length) {
        console.log('Migrating database: creating bankTransactions table...');

        const createTable = `
          -- 银行流水表
          CREATE TABLE IF NOT EXISTS bankTransactions (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            transactionTime TEXT,
            voucherType TEXT,
            voucherNo TEXT,
            debit REAL DEFAULT 0,
            credit REAL DEFAULT 0,
            balance REAL,
            cashRemitFlag TEXT,
            counterpartyName TEXT,
            counterpartyAccount TEXT,
            summary TEXT,
            notes TEXT,
            transactionSerialNo TEXT,
            enterpriseSerialNo TEXT,
            ourAccount TEXT,
            ourAccountName TEXT,
            ourBranch TEXT,
            rowNumber INTEGER,
            status TEXT DEFAULT 'pending',
            matchedSubject TEXT,
            matchedSubjectName TEXT,
            confidence REAL,
            bankAccountId TEXT,
            importBatchId TEXT,
            voucherId TEXT,
            generatedVoucherNo TEXT,
            exchangeRate REAL,
            originalAmount REAL,
            source TEXT DEFAULT 'import',
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id),
            FOREIGN KEY (voucherId) REFERENCES vouchers(id)
          );

          -- 银行流水索引
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_accountSetId ON bankTransactions(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_date ON bankTransactions(date);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_status ON bankTransactions(status);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_importBatchId ON bankTransactions(importBatchId);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_voucherId ON bankTransactions(voucherId);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_dedup ON bankTransactions(accountSetId, date, voucherNo, transactionSerialNo);
        `;

        this.dbInstance.exec(createTable);
        console.log('Bank transactions table migration completed successfully');
      }
    } catch (error) {
      console.warn('Bank transactions table migration warning:', error);
    }
  }

  /**
   * 迁移：创建固定资产相关表（如果不存在）
   * 这是为了兼容旧版本数据库
   */
  private async migrateCreateFixedAssetTables(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      // 检查 assetCategories 表是否存在
      const tableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='assetCategories'"
      );

      if (!tableCheck[0]?.values?.length) {
        console.log('Migrating database: creating fixed asset tables...');

        const createTables = `
          -- 资产分类表
          CREATE TABLE IF NOT EXISTS assetCategories (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE,
            name TEXT NOT NULL,
            assetType TEXT NOT NULL,
            defaultUsefulLifeYears INTEGER,
            defaultDepreciationMethod TEXT,
            defaultSalvageRate REAL DEFAULT 0.05,
            assetSubjectCode TEXT,
            depreciationSubjectCode TEXT,
            expenseSubjectCode TEXT,
            description TEXT,
            sortOrder INTEGER DEFAULT 0,
            enabled INTEGER DEFAULT 1,
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- 固定资产卡片表
          CREATE TABLE IF NOT EXISTS fixedAssets (
            id TEXT PRIMARY KEY,
            assetCode TEXT UNIQUE,
            assetName TEXT NOT NULL,
            categoryId TEXT,
            categoryName TEXT,
            specification TEXT,
            unit TEXT,
            quantity INTEGER DEFAULT 1,
            originalValue REAL NOT NULL,
            salvageValue REAL DEFAULT 0,
            depreciableValue REAL,
            accumulatedDepreciation REAL DEFAULT 0,
            netValue REAL,
            depreciationMethod TEXT NOT NULL,
            usefulLifeYears INTEGER,
            usefulLifeMonths INTEGER,
            totalUnits REAL,
            unitsUsed REAL DEFAULT 0,
            acquisitionDate TEXT NOT NULL,
            depreciationStartDate TEXT,
            lastDepreciationDate TEXT,
            disposalDate TEXT,
            status TEXT DEFAULT 'active',
            location TEXT,
            departmentCode TEXT,
            departmentName TEXT,
            assetSubjectCode TEXT,
            assetSubjectName TEXT,
            depreciationSubjectCode TEXT,
            depreciationSubjectName TEXT,
            expenseSubjectCode TEXT,
            expenseSubjectName TEXT,
            supplierName TEXT,
            invoiceNo TEXT,
            notes TEXT,
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (categoryId) REFERENCES assetCategories(id),
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- 折旧记录表
          CREATE TABLE IF NOT EXISTS depreciationRecords (
            id TEXT PRIMARY KEY,
            assetId TEXT NOT NULL,
            assetCode TEXT,
            assetName TEXT,
            period TEXT NOT NULL,
            depreciationDate TEXT NOT NULL,
            periodDepreciation REAL NOT NULL,
            accumulatedDepreciation REAL,
            netValueAfter REAL,
            unitsThisPeriod REAL,
            unitDepreciationRate REAL,
            voucherId TEXT,
            voucherNo TEXT,
            status TEXT DEFAULT 'draft',
            notes TEXT,
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (assetId) REFERENCES fixedAssets(id),
            FOREIGN KEY (voucherId) REFERENCES vouchers(id),
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- 无形资产表
          CREATE TABLE IF NOT EXISTS intangibleAssets (
            id TEXT PRIMARY KEY,
            assetCode TEXT UNIQUE,
            assetName TEXT NOT NULL,
            assetType TEXT NOT NULL,
            originalValue REAL NOT NULL,
            residualValue REAL DEFAULT 0,
            accumulatedAmortization REAL DEFAULT 0,
            netValue REAL,
            amortizationMethod TEXT NOT NULL,
            usefulLifeYears INTEGER,
            usefulLifeMonths INTEGER,
            totalUnits REAL,
            unitsUsed REAL DEFAULT 0,
            acquisitionDate TEXT NOT NULL,
            amortizationStartDate TEXT,
            lastAmortizationDate TEXT,
            expiryDate TEXT,
            status TEXT DEFAULT 'active',
            assetSubjectCode TEXT,
            assetSubjectName TEXT,
            amortizationSubjectCode TEXT,
            amortizationSubjectName TEXT,
            expenseSubjectCode TEXT,
            expenseSubjectName TEXT,
            registrationNo TEXT,
            legalLifeYears INTEGER,
            departmentCode TEXT,
            departmentName TEXT,
            notes TEXT,
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- 待摊费用表
          CREATE TABLE IF NOT EXISTS prepaidExpenses (
            id TEXT PRIMARY KEY,
            expenseCode TEXT UNIQUE,
            expenseName TEXT NOT NULL,
            expenseType TEXT NOT NULL,
            originalAmount REAL NOT NULL,
            amortizedAmount REAL DEFAULT 0,
            remainingAmount REAL,
            amortizationMethod TEXT DEFAULT 'straight_line',
            amortizationPeriods INTEGER,
            amortizedPeriods INTEGER DEFAULT 0,
            periodAmount REAL,
            paymentDate TEXT NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            lastAmortizationDate TEXT,
            status TEXT DEFAULT 'active',
            prepaidSubjectCode TEXT,
            prepaidSubjectName TEXT,
            expenseSubjectCode TEXT,
            expenseSubjectName TEXT,
            supplierName TEXT,
            invoiceNo TEXT,
            contractNo TEXT,
            departmentCode TEXT,
            departmentName TEXT,
            notes TEXT,
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- 摊销记录表（统一用于无形资产和待摊费用）
          CREATE TABLE IF NOT EXISTS amortizationRecords (
            id TEXT PRIMARY KEY,
            entityType TEXT NOT NULL,
            entityId TEXT NOT NULL,
            entityCode TEXT,
            entityName TEXT,
            period TEXT NOT NULL,
            amortizationDate TEXT NOT NULL,
            periodAmortization REAL NOT NULL,
            accumulatedAmortization REAL,
            remainingAmount REAL,
            unitsThisPeriod REAL,
            voucherId TEXT,
            voucherNo TEXT,
            status TEXT DEFAULT 'draft',
            notes TEXT,
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (voucherId) REFERENCES vouchers(id),
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- 编码规则表
          CREATE TABLE IF NOT EXISTS codeRules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            prefix TEXT,
            suffix TEXT,
            padding INTEGER DEFAULT 4,
            separator TEXT DEFAULT '',
            auto_inc INTEGER DEFAULT 1,
            resetPeriod TEXT DEFAULT 'none',
            lastNumber INTEGER DEFAULT 0,
            lastResetDate TEXT,
            accountSetId TEXT,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- 发票表
          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            invoiceType TEXT NOT NULL,
            invoiceCode TEXT NOT NULL,
            digitalInvoiceNo TEXT,
            invoiceDate TEXT NOT NULL,
            sellerName TEXT,
            sellerTaxNo TEXT,
            buyerName TEXT,
            buyerTaxNo TEXT,
            goodsName TEXT,
            specification TEXT,
            unit TEXT,
            quantity REAL,
            unitPrice REAL,
            amount REAL NOT NULL,
            taxRate REAL,
            taxAmount REAL,
            totalAmount REAL NOT NULL,
            paymentStatus TEXT DEFAULT 'unpaid',
            paidAmount REAL DEFAULT 0,
            voucherId TEXT,
            voucherNo TEXT,
            partnerId TEXT,
            partnerName TEXT,
            notes TEXT,
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (voucherId) REFERENCES vouchers(id),
            FOREIGN KEY (partnerId) REFERENCES partners(id),
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- 发票核销记录表
          CREATE TABLE IF NOT EXISTS invoiceReconciliations (
            id TEXT PRIMARY KEY,
            invoiceId TEXT NOT NULL,
            voucherId TEXT,
            entryId TEXT,
            amount REAL NOT NULL,
            reconcileDate TEXT NOT NULL,
            notes TEXT,
            accountSetId TEXT,
            createTime TEXT,
            FOREIGN KEY (invoiceId) REFERENCES invoices(id),
            FOREIGN KEY (voucherId) REFERENCES vouchers(id),
            FOREIGN KEY (entryId) REFERENCES entries(id),
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );

          -- Asset Categories indexes
          CREATE INDEX IF NOT EXISTS idx_assetCategories_accountSetId ON assetCategories(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_assetCategories_code ON assetCategories(code);
          CREATE INDEX IF NOT EXISTS idx_assetCategories_assetType ON assetCategories(assetType);

          -- Fixed Assets indexes
          CREATE INDEX IF NOT EXISTS idx_fixedAssets_accountSetId ON fixedAssets(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_fixedAssets_assetCode ON fixedAssets(assetCode);
          CREATE INDEX IF NOT EXISTS idx_fixedAssets_categoryId ON fixedAssets(categoryId);
          CREATE INDEX IF NOT EXISTS idx_fixedAssets_status ON fixedAssets(status);

          -- Depreciation Records indexes
          CREATE INDEX IF NOT EXISTS idx_depreciationRecords_accountSetId ON depreciationRecords(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_depreciationRecords_assetId ON depreciationRecords(assetId);
          CREATE INDEX IF NOT EXISTS idx_depreciationRecords_period ON depreciationRecords(period);
          CREATE INDEX IF NOT EXISTS idx_depreciationRecords_voucherId ON depreciationRecords(voucherId);

          -- Intangible Assets indexes
          CREATE INDEX IF NOT EXISTS idx_intangibleAssets_accountSetId ON intangibleAssets(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_intangibleAssets_assetCode ON intangibleAssets(assetCode);
          CREATE INDEX IF NOT EXISTS idx_intangibleAssets_assetType ON intangibleAssets(assetType);
          CREATE INDEX IF NOT EXISTS idx_intangibleAssets_status ON intangibleAssets(status);

          -- Prepaid Expenses indexes
          CREATE INDEX IF NOT EXISTS idx_prepaidExpenses_accountSetId ON prepaidExpenses(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_prepaidExpenses_expenseCode ON prepaidExpenses(expenseCode);
          CREATE INDEX IF NOT EXISTS idx_prepaidExpenses_expenseType ON prepaidExpenses(expenseType);
          CREATE INDEX IF NOT EXISTS idx_prepaidExpenses_status ON prepaidExpenses(status);

          -- Amortization Records indexes
          CREATE INDEX IF NOT EXISTS idx_amortizationRecords_accountSetId ON amortizationRecords(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_amortizationRecords_entityId ON amortizationRecords(entityId);
          CREATE INDEX IF NOT EXISTS idx_amortizationRecords_entityType ON amortizationRecords(entityType);
          CREATE INDEX IF NOT EXISTS idx_amortizationRecords_period ON amortizationRecords(period);
          CREATE INDEX IF NOT EXISTS idx_amortizationRecords_voucherId ON amortizationRecords(voucherId);

          -- Invoice indexes
          CREATE INDEX IF NOT EXISTS idx_invoices_accountSetId ON invoices(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_invoices_invoiceType ON invoices(invoiceType);
          CREATE INDEX IF NOT EXISTS idx_invoices_invoiceCode ON invoices(invoiceCode);
          CREATE INDEX IF NOT EXISTS idx_invoices_invoiceDate ON invoices(invoiceDate);
          CREATE INDEX IF NOT EXISTS idx_invoices_partnerId ON invoices(partnerId);
          CREATE INDEX IF NOT EXISTS idx_invoices_voucherId ON invoices(voucherId);
          CREATE INDEX IF NOT EXISTS idx_invoices_paymentStatus ON invoices(paymentStatus);

          -- Invoice Reconciliation indexes
          CREATE INDEX IF NOT EXISTS idx_invoiceReconciliations_accountSetId ON invoiceReconciliations(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_invoiceReconciliations_invoiceId ON invoiceReconciliations(invoiceId);
          CREATE INDEX IF NOT EXISTS idx_invoiceReconciliations_voucherId ON invoiceReconciliations(voucherId);

          -- 银行流水表
          CREATE TABLE IF NOT EXISTS bankTransactions (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            transactionTime TEXT,
            voucherType TEXT,
            voucherNo TEXT,
            debit REAL DEFAULT 0,
            credit REAL DEFAULT 0,
            balance REAL,
            cashRemitFlag TEXT,
            counterpartyName TEXT,
            counterpartyAccount TEXT,
            summary TEXT,
            notes TEXT,
            transactionSerialNo TEXT,
            enterpriseSerialNo TEXT,
            ourAccount TEXT,
            ourAccountName TEXT,
            ourBranch TEXT,
            rowNumber INTEGER,
            status TEXT DEFAULT 'pending',
            matchedSubject TEXT,
            matchedSubjectName TEXT,
            confidence REAL,
            bankAccountId TEXT,
            importBatchId TEXT,
            voucherId TEXT,
            generatedVoucherNo TEXT,
            exchangeRate REAL,
            originalAmount REAL,
            source TEXT DEFAULT 'import',
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id),
            FOREIGN KEY (voucherId) REFERENCES vouchers(id)
          );

          -- 银行流水索引
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_accountSetId ON bankTransactions(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_date ON bankTransactions(date);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_status ON bankTransactions(status);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_importBatchId ON bankTransactions(importBatchId);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_voucherId ON bankTransactions(voucherId);
          CREATE INDEX IF NOT EXISTS idx_bankTransactions_dedup ON bankTransactions(accountSetId, date, voucherNo, transactionSerialNo);
        `;

        this.dbInstance.exec(createTables);
        console.log('Fixed asset tables migration completed successfully');
      }
    } catch (error) {
      console.warn('Fixed asset tables migration warning:', error);
    }
  }

  /**
   * 迁移：创建银行流水匹配规则表 + 为 partners 添加默认科目列
   */
  private async migrateCreateBankRulesTable(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      // 创建规则表
      const tableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bankTransactionRules'"
      );

      if (!tableCheck[0]?.values?.length) {
        console.log('Migrating database: creating bankTransactionRules table...');

        const createTable = `
          CREATE TABLE IF NOT EXISTS bankTransactionRules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            keyword TEXT NOT NULL,
            subjectCode TEXT NOT NULL,
            subjectName TEXT,
            direction TEXT DEFAULT 'both',
            priority INTEGER DEFAULT 5,
            enabled INTEGER DEFAULT 1,
            isSystem INTEGER DEFAULT 0,
            accountSetId TEXT,
            createTime TEXT,
            updateTime TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_bankTransactionRules_accountSetId ON bankTransactionRules(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_bankTransactionRules_enabled ON bankTransactionRules(enabled);
        `;

        this.dbInstance.exec(createTable);
        console.log('Bank transaction rules table migration completed');
      }

      // 为 partners 表添加默认科目列
      const pragma = this.dbInstance.exec("PRAGMA table_info(partners)");
      const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];

      if (!columns.includes('defaultSubjectCode')) {
        this.dbInstance.exec(`
          ALTER TABLE partners ADD COLUMN defaultSubjectCode TEXT;
          ALTER TABLE partners ADD COLUMN defaultSubjectName TEXT;
        `);
        console.log('Partners table: added defaultSubjectCode/defaultSubjectName columns');
      }

      const extraPartnerColumns = [
        'bankName',
        'departmentCode',
        'departmentName',
        'paymentTermDays',
        'openingBalance',
        'idType',
        'idNumber',
        'employmentStartDate',
        'employmentEndDate',
        'payrollSalaryExpenseSubjectCode',
        'payrollSalaryExpenseSubjectName',
        'payrollContributionExpenseSubjectCode',
        'payrollContributionExpenseSubjectName',
        'payrollSalaryPayableSubjectCode',
        'payrollSalaryPayableSubjectName',
        'payrollTaxPayableSubjectCode',
        'payrollTaxPayableSubjectName',
        'payrollEmployeeContributionPayableSubjectCode',
        'payrollEmployeeContributionPayableSubjectName',
        'payrollEmployerContributionPayableSubjectCode',
        'payrollEmployerContributionPayableSubjectName',
        'payrollDepartmentName',
        'payrollProjectName',
        'payrollCostCenterName',
      ];
      for (const column of extraPartnerColumns) {
        if (!columns.includes(column)) {
          this.dbInstance.exec(`ALTER TABLE partners ADD COLUMN ${column} TEXT;`);
          console.log(`Partners table: added ${column} column`);
        }
      }
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.warn('Bank rules migration warning:', error);
      }
    }
  }

  /**
   * 迁移：创建采购发票规则配置表
   */
  private async migratePurchaseInvoiceRuleConfig(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      // 检查 purchase_invoice_rule_config 表是否存在
      const tableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_invoice_rule_config'"
      );

      if (!tableCheck[0]?.values?.length) {
        console.log('Migrating database: creating purchase_invoice_rule_config table...');

        const createTable = `
          CREATE TABLE IF NOT EXISTS purchase_invoice_rule_config (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            businessGroups TEXT NOT NULL DEFAULT '[]',
            keywordRules TEXT NOT NULL DEFAULT '[]',
            globalSettings TEXT NOT NULL DEFAULT '{"assetThreshold":5000,"autoTaxSubject":true,"autoCheckDuplicate":true,"autoRecognizeReimburser":true}',
            updateTime TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_pirc_accountSetId ON purchase_invoice_rule_config(accountSetId);
        `;

        this.dbInstance.exec(createTable);
        console.log('Purchase invoice rule config table migration completed');
      }
    } catch (error) {
      console.warn('Purchase invoice rule config table migration warning:', error);
    }
  }

  /**
   * 迁移：从 supplier_subject_mapping 表移除 supplierType 列
   */
  private async migrateRemoveSupplierTypeColumn(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      const pragma = this.dbInstance.exec("PRAGMA table_info(supplier_subject_mapping)");
      const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];

      if (columns.includes('supplierType')) {
        // 在 SQLite 中，要删除列需要创建新表并复制数据
        console.log('Migrating database: removing supplierType column from supplier_subject_mapping...');

        // 1. 创建临时表
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS supplier_subject_mapping_temp (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            groupName TEXT NOT NULL,
            sellerName TEXT NOT NULL,
            defaultDebitSubject TEXT,
            defaultDebitSubjectName TEXT,
            defaultTaxSubject TEXT,
            defaultTaxSubjectName TEXT,
            defaultCreditSubject TEXT,
            defaultCreditSubjectName TEXT,
            createTime TEXT NOT NULL,
            updateTime TEXT NOT NULL
          );
        `);

        // 2. 复制数据到临时表（不包括 supplierType）
        this.dbInstance.exec(`
          INSERT INTO supplier_subject_mapping_temp
          (id, accountSetId, groupName, sellerName,
           defaultDebitSubject, defaultDebitSubjectName,
           defaultTaxSubject, defaultTaxSubjectName,
           defaultCreditSubject, defaultCreditSubjectName,
           createTime, updateTime)
          SELECT id, accountSetId, groupName, sellerName,
                 defaultDebitSubject, defaultDebitSubjectName,
                 defaultTaxSubject, defaultTaxSubjectName,
                 defaultCreditSubject, defaultCreditSubjectName,
                 createTime, updateTime
          FROM supplier_subject_mapping;
        `);

        // 3. 删除原表
        this.dbInstance.exec("DROP TABLE supplier_subject_mapping");

        // 4. 重命名临时表
        this.dbInstance.exec("ALTER TABLE supplier_subject_mapping_temp RENAME TO supplier_subject_mapping");

        // 5. 重新创建索引
        this.dbInstance.exec(`
          CREATE INDEX IF NOT EXISTS idx_ssm_accountSetId ON supplier_subject_mapping(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_ssm_groupName ON supplier_subject_mapping(groupName);
        `);

        console.log('Migration completed: supplierType column removed from supplier_subject_mapping');
      }
    } catch (error) {
      console.warn('Migration warning: Failed to remove supplierType column from supplier_subject_mapping', error);
    }
  }

  /**
   * 迁移：智能规则引擎相关表（替代 invoice_subject_rules）
   */
  private async migrateSmartRuleEngine(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      // 检查 invoice_smart_rules 表是否存在（作为新表集的标记）
      const tableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_smart_rules'"
      );

      if (!tableCheck[0]?.values?.length) {
        console.log('Migrating database: creating smart rule engine tables...');

        // Drop old invoice_subject_rules (dev stage, data loss OK)
        try {
          this.dbInstance.exec('DROP TABLE IF EXISTS invoice_subject_rules');
        } catch { /* ignore */ }

        const createTables = `
          CREATE TABLE IF NOT EXISTS invoice_smart_rules (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            name TEXT NOT NULL,
            invoiceType TEXT NOT NULL DEFAULT 'both',
            priority INTEGER NOT NULL DEFAULT 50,
            conditions TEXT NOT NULL DEFAULT '[]',
            actions TEXT NOT NULL DEFAULT '[]',
            enabled INTEGER NOT NULL DEFAULT 1,
            createTime TEXT NOT NULL,
            updateTime TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS supplier_subject_mapping (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            groupName TEXT NOT NULL,
            sellerName TEXT NOT NULL,
            supplierType TEXT NOT NULL DEFAULT 'material',
            defaultDebitSubject TEXT,
            defaultDebitSubjectName TEXT,
            defaultTaxSubject TEXT,
            defaultTaxSubjectName TEXT,
            defaultCreditSubject TEXT,
            defaultCreditSubjectName TEXT,
            createTime TEXT NOT NULL,
            updateTime TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS expense_reimbursement (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            invoiceCode TEXT NOT NULL,
            reimburserName TEXT NOT NULL,
            reimburserId TEXT,
            notes TEXT,
            importBatchId TEXT,
            createTime TEXT NOT NULL,
            updateTime TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS expense_keyword_categories (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            category TEXT NOT NULL,
            keywords TEXT NOT NULL DEFAULT '[]',
            expenseSubjectCode TEXT,
            expenseSubjectName TEXT,
            isSystem INTEGER NOT NULL DEFAULT 0,
            enabled INTEGER NOT NULL DEFAULT 1,
            createTime TEXT NOT NULL,
            updateTime TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS auxiliary_strategy_config (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'auxiliary',
            autoCreatePartner INTEGER NOT NULL DEFAULT 0,
            autoDisableAuxiliaryOnSubAccount INTEGER NOT NULL DEFAULT 1,
            enableSmartRouting INTEGER NOT NULL DEFAULT 1,
            enableMultiAction INTEGER NOT NULL DEFAULT 1,
            updateTime TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS purchase_invoice_rule_config (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            businessGroups TEXT NOT NULL DEFAULT '[]',
            keywordRules TEXT NOT NULL DEFAULT '[]',
            globalSettings TEXT NOT NULL DEFAULT '{"assetThreshold":5000,"autoTaxSubject":true,"autoCheckDuplicate":true,"autoRecognizeReimburser":true}',
            updateTime TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS asset_category_mapping (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            keywords TEXT NOT NULL DEFAULT '[]',
            assetCategory TEXT NOT NULL,
            depreciationYears INTEGER NOT NULL,
            depreciationMethod TEXT NOT NULL,
            subjectCode TEXT NOT NULL,
            residualRate REAL NOT NULL DEFAULT 0.05,
            isSystem INTEGER NOT NULL DEFAULT 0,
            createTime TEXT NOT NULL,
            updateTime TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_isr_smart_accountSetId ON invoice_smart_rules(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_ssm_accountSetId ON supplier_subject_mapping(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_ssm_groupName ON supplier_subject_mapping(groupName);
          CREATE INDEX IF NOT EXISTS idx_er_accountSetId ON expense_reimbursement(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_ekc_accountSetId ON expense_keyword_categories(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_asc_accountSetId ON auxiliary_strategy_config(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_acm_accountSetId ON asset_category_mapping(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_pirc_accountSetId ON purchase_invoice_rule_config(accountSetId);
        `;

        this.dbInstance.exec(createTables);

        // Insert system presets for expense_keyword_categories
        const now = new Date().toISOString();
        const expensePresets = [
          { category: '交通', keywords: '["交通","打车","滴滴","出租","高铁","火车","机票","航班","航空","地铁","公交"]' },
          { category: '餐饮', keywords: '["餐","饮食","外卖","饭店","快餐","食品","酒水"]' },
          { category: '通讯', keywords: '["话费","通讯","流量","宽带","手机","电信","移动","联通"]' },
          { category: '住宿', keywords: '["住宿","酒店","宾馆","旅店","民宿","房费"]' },
          { category: '办公', keywords: '["办公","文具","打印","耗材","纸","笔","文件夹"]' },
        ];
        for (const preset of expensePresets) {
          this.dbInstance.exec(
            `INSERT INTO expense_keyword_categories (id, accountSetId, category, keywords, isSystem, enabled, createTime, updateTime)
             VALUES (?, ?, ?, ?, 1, 1, ?, ?)`,
            [`sys_ekc_${preset.category}`, this._accountSetId, preset.category, preset.keywords, now, now]
          );
        }

        // Insert system presets for asset_category_mapping
        const assetPresets = [
          { cat: '电子设备', keywords: '["电脑","笔记本","服务器","打印机","显示器"]', years: 3, subjectCode: '1601' },
          { cat: '办公家具', keywords: '["桌","椅","柜","沙发","家具"]', years: 5, subjectCode: '1601' },
          { cat: '装修', keywords: '["装修","装饰","改造"]', years: 5, subjectCode: '1601' },
          { cat: '运输工具', keywords: '["汽车","车辆","货车","叉车"]', years: 4, subjectCode: '1601' },
        ];
        for (const preset of assetPresets) {
          this.dbInstance.exec(
            `INSERT INTO asset_category_mapping (id, accountSetId, keywords, assetCategory, depreciationYears, depreciationMethod, subjectCode, residualRate, isSystem, createTime, updateTime)
             VALUES (?, ?, ?, ?, ?, 'straight_line', ?, 0.05, 1, ?, ?)`,
            [`sys_acm_${preset.cat}`, this._accountSetId, preset.keywords, preset.cat, preset.years, preset.subjectCode, now, now]
          );
        }

        // Insert default auxiliary_strategy_config
        const auxiliaryColumns = new Set(
          (this.dbInstance.exec("PRAGMA table_info(auxiliary_strategy_config)")[0]?.values || []).map((row: any[]) => row[1])
        );
        const hasSmartRouting = auxiliaryColumns.has('enableSmartRouting');
        const hasMultiAction = auxiliaryColumns.has('enableMultiAction');
        const auxiliaryInsert = hasSmartRouting && hasMultiAction
          ? `INSERT INTO auxiliary_strategy_config (id, accountSetId, mode, autoCreatePartner, autoDisableAuxiliaryOnSubAccount, enableSmartRouting, enableMultiAction, updateTime)
             VALUES (?, ?, 'auxiliary', 0, 1, 1, 1, ?)`
          : `INSERT INTO auxiliary_strategy_config (id, accountSetId, mode, autoCreatePartner, autoDisableAuxiliaryOnSubAccount, updateTime)
             VALUES (?, ?, 'auxiliary', 0, 1, ?)`;
        this.dbInstance.exec(
          auxiliaryInsert,
          hasSmartRouting && hasMultiAction
            ? [`sys_asc_default`, this._accountSetId, now]
            : [`sys_asc_default`, this._accountSetId, now]
        );

        console.log('Smart rule engine tables migration completed');
      }

      // ALTER invoices: add holdStatus and category columns
      try {
        const pragma = this.dbInstance.exec("PRAGMA table_info(invoices)");
        const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];

        if (!columns.includes('holdStatus')) {
          this.dbInstance.exec(`ALTER TABLE invoices ADD COLUMN holdStatus TEXT DEFAULT 'normal'`);
          console.log('invoices table: added holdStatus column');
        }
        if (!columns.includes('category')) {
          this.dbInstance.exec(`ALTER TABLE invoices ADD COLUMN category TEXT`);
          console.log('invoices table: added category column');
        }
      } catch (e) {
        if (!e.message?.includes('duplicate column name')) {
          console.warn('invoices ALTER warning:', e);
        }
      }

      // ALTER auxiliary_strategy_config: add new strategy fields
      try {
        const pragma = this.dbInstance.exec("PRAGMA table_info(auxiliary_strategy_config)");
        const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];

        if (!columns.includes('enableSmartRouting')) {
          this.dbInstance.exec(`ALTER TABLE auxiliary_strategy_config ADD COLUMN enableSmartRouting INTEGER DEFAULT 1`);
          console.log('auxiliary_strategy_config table: added enableSmartRouting column');
        }
        if (!columns.includes('enableMultiAction')) {
          this.dbInstance.exec(`ALTER TABLE auxiliary_strategy_config ADD COLUMN enableMultiAction INTEGER DEFAULT 1`);
          console.log('auxiliary_strategy_config table: added enableMultiAction column');
        }
      } catch (e) {
        if (!e.message?.includes('duplicate column name')) {
          console.warn('auxiliary_strategy_config ALTER warning:', e);
        }
      }
    } catch (error) {
      console.warn('Smart rule engine migration warning:', error);
    }
  }

  /**
   * 迁移：为现有数据库添加 accountSetId 列
   */
  private async migrateAddAccountSetIdColumns(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      // 检查 vouchers 表是否有 accountSetId 列
      const pragma = this.dbInstance.exec("PRAGMA table_info(vouchers)");
      const hasAccountSetId = pragma[0]?.values?.some((row: any[]) => row[1] === 'accountSetId');

      if (!hasAccountSetId) {
        console.log('Migrating database: adding accountSetId columns to existing tables...');
        const alterTables = `
          ALTER TABLE vouchers ADD COLUMN accountSetId TEXT;
          ALTER TABLE entries ADD COLUMN accountSetId TEXT;
          ALTER TABLE subjects ADD COLUMN accountSetId TEXT;
          ALTER TABLE departments ADD COLUMN accountSetId TEXT;
          ALTER TABLE projects ADD COLUMN accountSetId TEXT;
          ALTER TABLE currencies ADD COLUMN accountSetId TEXT;
          ALTER TABLE partners ADD COLUMN accountSetId TEXT;
          ALTER TABLE voucherTemplates ADD COLUMN accountSetId TEXT;
          ALTER TABLE commonSummaries ADD COLUMN accountSetId TEXT;
          ALTER TABLE userPreferences ADD COLUMN accountSetId TEXT;
          ALTER TABLE auditLogs ADD COLUMN accountSetId TEXT;
          ALTER TABLE recRelations ADD COLUMN accountSetId TEXT;
        `;

        this.dbInstance.exec(alterTables);
        console.log('Database migration completed successfully');
      }
    } catch (error) {
      // 如果是 "duplicate column name" 错误，说明列已存在，可以忽略
      if (!error.message?.includes('duplicate column name')) {
        console.warn('Database migration warning:', error);
      }
    }

    // --- Migration: bank_account_bindings ---
    if (!this.dbInstance) return;
    try {
      const checkBindings = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bank_account_bindings'"
      );
      if (!checkBindings[0]?.values?.length) {
        console.log('Migrating database: creating bank_account_bindings table...');
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS bank_account_bindings (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            accountNumber TEXT NOT NULL,
            bankId TEXT NOT NULL,
            bankName TEXT NOT NULL,
            aliasName TEXT,
            subSubjectCode TEXT NOT NULL,
            subSubjectName TEXT NOT NULL,
            branch TEXT,
            currency TEXT,
            isDefault INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL,
            UNIQUE(accountSetId, accountNumber)
          );
          CREATE INDEX IF NOT EXISTS idx_bank_bindings_accountSetId ON bank_account_bindings(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_bank_bindings_accountNumber ON bank_account_bindings(accountNumber);
        `);
        console.log('bank_account_bindings table migration completed');
      }
    } catch (e) {
      console.warn('bank_account_bindings migration warning:', e);
    }

    // --- Migration: custom_bank_configs ---
    try {
      const checkCustom = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_bank_configs'"
      );
      if (!checkCustom[0]?.values?.length) {
        console.log('Migrating database: creating custom_bank_configs table...');
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS custom_bank_configs (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            name TEXT NOT NULL,
            config TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_custom_bank_configs_accountSetId ON custom_bank_configs(accountSetId);
        `);
        console.log('custom_bank_configs table migration completed');
      }
    } catch (e) {
      console.warn('custom_bank_configs migration warning:', e);
    }
  }

  /**
   * 迁移：为 subjects 表添加缺失的列
   * 添加 isCustomer, isSupplier, isEmployee, enableDept, enableProject, enableForeign, foreignCurrency, enableCashFlow
   */
  /**
   * Multicurrency foundation migrations:
   * - accountSets base currency columns
   * - entries currencyName metadata
   * - fxRates daily middle-rate table
   */
  private async migrateMulticurrencyFoundation(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      const accountSetColumnsResult = this.dbInstance.exec('PRAGMA table_info(accountSets)');
      const accountSetColumns = accountSetColumnsResult[0]?.values?.map((row: any[]) => row[1]) || [];
      if (accountSetColumns.length === 0) {
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS accountSets (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE,
            name TEXT,
            baseCurrency TEXT DEFAULT 'CNY',
            baseCurrencyName TEXT DEFAULT '人民币',
            taxNo TEXT,
            description TEXT,
            createTime TEXT,
            updateTime TEXT
          );
        `);
      } else {
        const accountSetAlterations = [
          !accountSetColumns.includes('baseCurrency') ? "ALTER TABLE accountSets ADD COLUMN baseCurrency TEXT DEFAULT 'CNY';" : '',
          !accountSetColumns.includes('baseCurrencyName') ? "ALTER TABLE accountSets ADD COLUMN baseCurrencyName TEXT DEFAULT '人民币';" : '',
        ].filter(Boolean);
        if (accountSetAlterations.length > 0) {
          this.dbInstance.exec(accountSetAlterations.join('\n'));
        }
        this.dbInstance.exec(`
          UPDATE accountSets
          SET baseCurrency = COALESCE(NULLIF(baseCurrency, ''), 'CNY'),
              baseCurrencyName = COALESCE(NULLIF(baseCurrencyName, ''), '人民币')
          WHERE baseCurrency IS NULL OR baseCurrency = '' OR baseCurrencyName IS NULL OR baseCurrencyName = '';
        `);
      }

      const entryColumnsResult = this.dbInstance.exec('PRAGMA table_info(entries)');
      const entryColumns = entryColumnsResult[0]?.values?.map((row: any[]) => row[1]) || [];
      if (entryColumns.length > 0 && !entryColumns.includes('currencyName')) {
        this.dbInstance.exec(`ALTER TABLE entries ADD COLUMN currencyName TEXT;`);
      }

      const fxRateTableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='fxRates'"
      );
      if (!fxRateTableCheck[0]?.values?.length) {
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS fxRates (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            rateDate TEXT NOT NULL,
            currencyCode TEXT NOT NULL,
            baseCurrency TEXT NOT NULL DEFAULT 'CNY',
            middleRate REAL NOT NULL,
            source TEXT,
            createTime TEXT NOT NULL,
            updateTime TEXT NOT NULL,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id),
            UNIQUE(accountSetId, rateDate, currencyCode)
          );
          CREATE INDEX IF NOT EXISTS idx_fxRates_accountSetId ON fxRates(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_fxRates_rateDate ON fxRates(rateDate);
          CREATE INDEX IF NOT EXISTS idx_fxRates_currencyCode ON fxRates(currencyCode);
        `);
      }

      // fxRevaluationRuns + fxRevaluationRunLines
      const fxRevTableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='fxRevaluationRuns'"
      );
      if (!fxRevTableCheck[0]?.values?.length) {
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS fxRevaluationRuns (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            period TEXT NOT NULL,
            baseCurrency TEXT NOT NULL,
            status TEXT NOT NULL,
            previewData TEXT,
            voucherId TEXT,
            voucherNo TEXT,
            createdAt TEXT NOT NULL,
            confirmedAt TEXT,
            createTime TEXT,
            updateTime TEXT,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );
          CREATE TABLE IF NOT EXISTS fxRevaluationRunLines (
            id TEXT PRIMARY KEY,
            runId TEXT NOT NULL,
            accountSetId TEXT NOT NULL,
            sourceType TEXT NOT NULL,
            sourceId TEXT NOT NULL,
            sourceName TEXT,
            currencyCode TEXT NOT NULL,
            originalAmount REAL NOT NULL,
            originalRate REAL NOT NULL,
            revaluationRate REAL NOT NULL,
            bookValueBase REAL NOT NULL,
            revaluedBase REAL NOT NULL,
            gainLossAmount REAL NOT NULL,
            gainLossDirection TEXT NOT NULL,
            subjectCode TEXT,
            subjectName TEXT,
            createTime TEXT,
            FOREIGN KEY (runId) REFERENCES fxRevaluationRuns(id),
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );
          CREATE INDEX IF NOT EXISTS idx_fxRevRuns_accountSetId ON fxRevaluationRuns(accountSetId);
          CREATE INDEX IF NOT EXISTS idx_fxRevRuns_period ON fxRevaluationRuns(period);
          CREATE INDEX IF NOT EXISTS idx_fxRevLines_runId ON fxRevaluationRunLines(runId);
        `);
      }
    } catch (error) {
      if (!String(error).includes('duplicate column name')) {
        console.warn('Multicurrency foundation migration warning:', error);
      }
    }
  }

  private async migrateAddSubjectColumns(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      // 检查 subjects 表是否有 isCustomer 列
      const pragma = this.dbInstance.exec("PRAGMA table_info(subjects)");
      const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];

      const neededColumns = [
        'type', 'balance', 'description', 'frozen',
        'enableDept', 'enableProject', 'enableForeign', 'foreignCurrency',
        'isCustomer', 'isSupplier', 'isEmployee', 'enableCashFlow',
        'bankAccountNumber'
      ];

      const missingColumns = neededColumns.filter(col => !columns.includes(col));

      if (missingColumns.length > 0) {
        console.log('Migrating subjects table: adding columns', missingColumns);

        for (const col of missingColumns) {
          let sql: string;
          if (col === 'foreignCurrency' || col === 'bankAccountNumber' || col === 'type' || col === 'description') {
            sql = `ALTER TABLE subjects ADD COLUMN ${col} TEXT`;
          } else if (col === 'balance') {
            sql = `ALTER TABLE subjects ADD COLUMN ${col} REAL DEFAULT 0`;
          } else {
            sql = `ALTER TABLE subjects ADD COLUMN ${col} INTEGER DEFAULT 0`;
          }
          this.dbInstance.exec(sql);
        }
        console.log('Subjects table migration completed successfully');
      }

      // 更新默认科目的值
      const updateStmts = [
        `UPDATE subjects SET isCustomer = 1 WHERE code = '1122'`,
        `UPDATE subjects SET isSupplier = 1 WHERE code = '2202'`,
        `UPDATE subjects SET enableDept = 1 WHERE code = '1122'`,
        `UPDATE subjects SET enableProject = 1 WHERE code = '1122'`,
      ];
      for (const sql of updateStmts) {
        this.dbInstance.exec(sql);
      }
      console.log('Subject default values updated');
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.warn('Subjects table migration warning:', error);
      }
    }
  }

  private async migrateAddInvoiceGroupName(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      const pragma = this.dbInstance.exec("PRAGMA table_info(invoices)");
      const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];

      // Migrate old templateId column to groupName
      if (columns.includes('templateId') && !columns.includes('groupName')) {
        console.log('Migrating invoices table: renaming templateId to groupName');
        this.dbInstance.exec('ALTER TABLE invoices RENAME COLUMN templateId TO groupName;');
      } else if (!columns.includes('groupName')) {
        console.log('Migrating invoices table: adding groupName column');
        this.dbInstance.exec('ALTER TABLE invoices ADD COLUMN groupName TEXT;');
      }
      if (!columns.includes('digitalInvoiceNo')) {
        console.log('Migrating invoices table: adding digitalInvoiceNo column');
        this.dbInstance.exec('ALTER TABLE invoices ADD COLUMN digitalInvoiceNo TEXT;');
      }
    } catch (error) {
      if (!error.message?.includes('duplicate column name')) {
        console.warn('Invoices table migration warning:', error);
      }
    }

    // codeRules 表：确保表存在
    try {
      const tableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='codeRules'"
      );
      if (!tableCheck[0]?.values?.length) {
        console.log('Creating codeRules table...');
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS codeRules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            prefix TEXT,
            suffix TEXT,
            padding INTEGER DEFAULT 4,
            separator TEXT DEFAULT '',
            auto_inc INTEGER DEFAULT 1,
            resetPeriod TEXT DEFAULT 'none',
            lastNumber INTEGER DEFAULT 0,
            lastResetDate TEXT,
            accountSetId TEXT,
            FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
          );
        `);
      }
    } catch (error) {
      console.warn('codeRules table creation warning:', error);
    }

    // codeRules 表迁移：autoIncrement -> auto_inc（避免保留字冲突）
    try {
      const codeRulesCols = this.dbInstance.exec("PRAGMA table_info(codeRules)");
      if (codeRulesCols.length > 0 && codeRulesCols[0].values.length > 0) {
        const hasOldCol = codeRulesCols[0].values.some((col: any[]) => col[1] === 'autoIncrement');
        const hasNewCol = codeRulesCols[0].values.some((col: any[]) => col[1] === 'auto_inc');
        if (hasOldCol && !hasNewCol) {
          this.dbInstance.exec('ALTER TABLE codeRules RENAME COLUMN autoIncrement TO auto_inc;');
        }
      }
    } catch (error) {
      if (!error.message?.includes('no such table')) {
        console.warn('codeRules table migration warning:', error);
      }
    }
  }

  // Helper to execute a query and return results (async version)
  private async querySingleAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    await this.ensureInitialized();

    // Double-check that dbInstance is actually available
    if (!this.dbInstance) {
      throw new Error('Database instance is null after initialization');
    }

    // 确保所有参数都不是 undefined 或 null
    const safeParams = params.map(param =>
      param === undefined || param === null ? '' : param
    );

    const stmt = this.dbInstance.prepare(sql);
    try {
      stmt.bind(safeParams);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        return result as T;
      }
      return null;
    } finally {
      stmt.free();
    }
  }

  // Helper to execute a query and return results (sync version for backward compatibility - not recommended)
  private querySingle<T>(sql: string, params: any[] = []): T | null {
    if (!this.dbInstance) {
      console.error('Database not initialized - use async methods instead');
      return null;
    }

    // 确保所有参数都不是 undefined 或 null
    const safeParams = params.map(param =>
      param === undefined || param === null ? '' : param
    );

    const stmt = this.dbInstance.prepare(sql);
    try {
      stmt.bind(safeParams);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        return result as T;
      }
      return null;
    } finally {
      stmt.free();
    }
  }

  // Helper to execute a query and return multiple results (async version)
  private async queryAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureInitialized();

    // Double-check that dbInstance is actually available
    if (!this.dbInstance) {
      throw new Error('Database instance is null after initialization');
    }

    // 确保所有参数都不是 undefined 或 null
    const safeParams = params.map(param =>
      param === undefined || param === null ? '' : param
    );

    const stmt = this.dbInstance.prepare(sql);
    try {
      const results: T[] = [];
      stmt.bind(safeParams);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  // Helper to execute a write statement (INSERT/UPDATE/DELETE) with params
  private async runAsync(sql: string, params: any[] = []): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) {
      throw new Error('Database instance is null after initialization');
    }
    const safeParams = params.map(param =>
      param === undefined || param === null ? '' : param
    );
    const stmt = this.dbInstance.prepare(sql);
    try {
      stmt.run(safeParams);
    } finally {
      stmt.free();
    }
  }

  // Helper to execute a query and return multiple results (sync version for backward compatibility - not recommended)
  private queryAll<T>(sql: string, params: any[] = []): T[] {
    if (!this.dbInstance) {
      console.error('Database not initialized - use async methods instead');
      return [];
    }

    // 确保所有参数都不是 undefined 或 null
    const safeParams = params.map(param =>
      param === undefined || param === null ? '' : param
    );

    const stmt = this.dbInstance.prepare(sql);
    try {
      const results: T[] = [];
      stmt.bind(safeParams);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  // ========== 凭证操作 ==========

  async saveVoucher(voucher: Voucher): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveVoucherRecord({
      db: this.dbInstance,
      voucher,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async updateVoucherStatus(id: string, status: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await updateVoucherStatusRecord({
      db: this.dbInstance,
      id,
      status,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async getVoucher(id: string): Promise<Voucher | undefined> {
    await this.ensureInitialized();
    return getVoucherById(this.getVoucherQueryService(), this.accountSetId, id);
  }

  async getAllVouchers(): Promise<Voucher[]> {
    await this.ensureInitialized();
    return listVouchers(this.getVoucherQueryService(), this.accountSetId);
  }

  async getVouchersByDateRange(startDate: string, endDate: string): Promise<Voucher[]> {
    await this.ensureInitialized();
    return listVouchersByDateRange(this.getVoucherQueryService(), this.accountSetId, startDate, endDate);
  }

  async getVouchersByStatus(status: 'draft' | 'review' | 'posted' | 'reversed'): Promise<Voucher[]> {
    await this.ensureInitialized();
    return listVouchersByStatus(this.getVoucherQueryService(), this.accountSetId, status);
  }

  async deleteVoucher(id: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await deleteVoucherRecord({
      db: this.dbInstance,
      id,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  // ========== 科目操作 ==========

  async saveSubjects(subjects: Subject[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveSubjectsRecord({
      db: this.dbInstance,
      subjects,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async getAllSubjects(): Promise<Subject[]> {
    await this.ensureInitialized();
    return listSubjects(this.getSubjectQueryService(), this.accountSetId);
  }

  async getSubjectByCode(code: string): Promise<Subject | undefined> {
    await this.ensureInitialized();
    return findSubjectByCode(this.getSubjectQueryService(), this.accountSetId, code);
  }

  async hasVoucherForSubject(subjectIdOrCode: string): Promise<boolean> {
    await this.ensureInitialized();
    return hasVoucherForSubjectQuery(this.getSubjectQueryService(), this.accountSetId, subjectIdOrCode);
  }

  async migrateSubjectVouchers(oldSubjectCode: string, newSubjectCode: string): Promise<number> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    return migrateSubjectVouchersRecord({
      db: this.dbInstance as any,
      oldSubjectCode,
      newSubjectCode,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  // 迁移：为 bankTransactions 添加 source 列和 ourAccount 索引
  private async migrateBankTransactionsSourceColumn(): Promise<void> {
    try {
      const columns = this.dbInstance.exec("PRAGMA table_info(bankTransactions)");
      if (columns.length > 0) {
        const columnNames = columns[0].values?.map((row: any[]) => row[1]) || [];
        if (!columnNames.includes('credit')) {
          this.dbInstance.run('ALTER TABLE bankTransactions ADD COLUMN credit REAL DEFAULT 0');
          console.log('Migration: Added credit column to bankTransactions');
        }
        if (!columnNames.includes('debit')) {
          this.dbInstance.run('ALTER TABLE bankTransactions ADD COLUMN debit REAL DEFAULT 0');
          console.log('Migration: Added debit column to bankTransactions');
        }
        if (!columnNames.includes('source')) {
          this.dbInstance.run('ALTER TABLE bankTransactions ADD COLUMN source TEXT DEFAULT \'import\'');
          console.log('Migration: Added source column to bankTransactions');
        }
        if (!columnNames.includes('exchangeRate')) {
          this.dbInstance.run('ALTER TABLE bankTransactions ADD COLUMN exchangeRate REAL');
          console.log('Migration: Added exchangeRate column to bankTransactions');
        }
        if (!columnNames.includes('originalAmount')) {
          this.dbInstance.run('ALTER TABLE bankTransactions ADD COLUMN originalAmount REAL');
          console.log('Migration: Added originalAmount column to bankTransactions');
        }
      }
      // Add index for ourAccount filtering
      this.dbInstance.run('CREATE INDEX IF NOT EXISTS idx_bankTransactions_ourAccount ON bankTransactions(ourAccount)');
    } catch (e) {
      console.warn('Migration: bankTransactions source column failed', e);
    }
  }

  /**
   * 迁移：创建用户/角色/权限相关表
   */
  private async migrateCreateUserTables(): Promise<void> {
    if (!this.dbInstance) return;

    try {
      // 创建 users 表（新 schema，含 status 列）
      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          passwordHash TEXT NOT NULL,
          displayName TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          status TEXT DEFAULT 'active',
          lastLoginTime TEXT,
          createTime TEXT,
          updateTime TEXT
        )
      `);

      // 补齐旧 createTables() 创建的 users 表缺失的列
      try {
        const pragma = this.dbInstance.exec('PRAGMA table_info(users)');
        const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];
        const addColumns: string[] = [];
        if (!columns.includes('status')) addColumns.push('ALTER TABLE users ADD COLUMN status TEXT DEFAULT "active"');
        if (!columns.includes('email')) addColumns.push('ALTER TABLE users ADD COLUMN email TEXT');
        if (!columns.includes('phone')) addColumns.push('ALTER TABLE users ADD COLUMN phone TEXT');
        if (!columns.includes('lastLoginTime')) addColumns.push('ALTER TABLE users ADD COLUMN lastLoginTime TEXT');
        for (const sql of addColumns) {
          this.dbInstance.exec(sql);
        }
      } catch (colErr) {
        console.warn('[User migration] column patch failed:', colErr);
      }

      // 创建 roles 表
      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          displayName TEXT NOT NULL,
          description TEXT,
          isSystem INTEGER DEFAULT 0,
          createTime TEXT,
          updateTime TEXT
        )
      `);

      // 创建 permissions 表
      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS permissions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT
        )
      `);

      // 创建 role_permissions 表
      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          roleId TEXT NOT NULL,
          permissionId TEXT NOT NULL,
          PRIMARY KEY (roleId, permissionId)
        )
      `);

      // 创建 user_roles 表（关联表，旧 createTables 的 user_roles 是角色定义表，schema 不同需重建）
      try {
        const urPragma = this.dbInstance.exec('PRAGMA table_info(user_roles)');
        const urColumns = urPragma[0]?.values?.map((row: any[]) => row[1]) || [];
        if (urColumns.includes('name') && !urColumns.includes('userId')) {
          // 旧 schema：id/name/displayName → 需要重建为 userId/roleId
          const hasData = this.dbInstance.exec('SELECT count(*) FROM user_roles');
          const count = hasData[0]?.values?.[0]?.[0] || 0;
          if (count === 0 || urColumns.includes('permissions')) {
            // 空表或旧角色定义表，安全重建
            this.dbInstance.exec('DROP TABLE IF EXISTS user_roles');
          }
        }
      } catch { /* ignore */ }
      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS user_roles (
          userId TEXT NOT NULL,
          roleId TEXT NOT NULL,
          PRIMARY KEY (userId, roleId)
        )
      `);

      // 创建 account_set_users 表（旧 schema 用 id+role 列，新 schema 用复合主键）
      try {
        const asuPragma = this.dbInstance.exec('PRAGMA table_info(account_set_users)');
        const asuColumns = asuPragma[0]?.values?.map((row: any[]) => row[1]) || [];
        if (asuColumns.includes('id') && !asuColumns.includes('roleId')) {
          const hasData = this.dbInstance.exec('SELECT count(*) FROM account_set_users');
          const count = hasData[0]?.values?.[0]?.[0] || 0;
          if (count === 0) {
            this.dbInstance.exec('DROP TABLE IF EXISTS account_set_users');
          }
        }
      } catch { /* ignore */ }
      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS account_set_users (
          accountSetId TEXT NOT NULL,
          userId TEXT NOT NULL,
          roleId TEXT NOT NULL,
          PRIMARY KEY (accountSetId, userId)
        )
      `);

      // 插入预设角色
      const now = new Date().toISOString();
      const roles = [
        { id: 'role_admin', name: 'admin', displayName: '管理员', description: '拥有系统全部权限', isSystem: 1 },
        { id: 'role_accountant', name: 'accountant', displayName: '会计', description: '凭证录入、审核、记账、报表查看、往来管理、发票管理、资产管理', isSystem: 1 },
        { id: 'role_cashier', name: 'cashier', displayName: '出纳', description: '资金管理、银行流水导入、手动记账、凭证查看、报表查看', isSystem: 1 },
      ];
      for (const role of roles) {
        const stmt = this.dbInstance.prepare(
          `INSERT OR IGNORE INTO roles (id, name, displayName, description, isSystem, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([role.id, role.name, role.displayName, role.description, role.isSystem, now, now]);
        stmt.free();
      }

      // 插入权限定义
      const permissions = [
        // 凭证
        { id: 'voucher:create', name: '新增凭证', category: 'voucher' },
        { id: 'voucher:edit', name: '编辑凭证', category: 'voucher' },
        { id: 'voucher:delete', name: '删除凭证', category: 'voucher' },
        { id: 'voucher:review', name: '审核凭证', category: 'voucher' },
        { id: 'voucher:post', name: '记账', category: 'voucher' },
        { id: 'voucher:reverse', name: '冲销', category: 'voucher' },
        { id: 'voucher:view', name: '查看凭证', category: 'voucher' },
        // 资金管理
        { id: 'fund:import', name: '导入银行流水', category: 'fund' },
        { id: 'fund:manual', name: '手动记一笔', category: 'fund' },
        { id: 'fund:reconcile', name: '智能对账', category: 'fund' },
        { id: 'fund:view', name: '查看资金管理', category: 'fund' },
        // 发票
        { id: 'invoice:import', name: '导入发票', category: 'invoice' },
        { id: 'invoice:edit', name: '编辑发票', category: 'invoice' },
        { id: 'invoice:delete', name: '删除发票', category: 'invoice' },
        { id: 'invoice:view', name: '查看发票', category: 'invoice' },
        // 报表
        { id: 'report:view', name: '查看报表', category: 'report' },
        // 资产
        { id: 'asset:create', name: '新增资产', category: 'asset' },
        { id: 'asset:edit', name: '编辑资产', category: 'asset' },
        { id: 'asset:delete', name: '删除资产', category: 'asset' },
        { id: 'asset:depreciate', name: '计提折旧/摊销', category: 'asset' },
        { id: 'asset:view', name: '查看资产', category: 'asset' },
        // 往来
        { id: 'partner:manage', name: '管理往来单位', category: 'partner' },
        { id: 'partner:view', name: '查看往来', category: 'partner' },
        // 基础档案
        { id: 'settings:manage', name: '管理基础档案', category: 'settings' },
        { id: 'settings:view', name: '查看基础档案', category: 'settings' },
        // 账套
        { id: 'accountset:manage', name: '管理账套', category: 'accountset' },
        { id: 'accountset:view', name: '查看账套', category: 'accountset' },
        // 用户管理
        { id: 'user:manage', name: '管理用户和角色', category: 'user' },
        { id: 'user:view', name: '查看用户', category: 'user' },
      ];
      for (const perm of permissions) {
        const stmt = this.dbInstance.prepare(
          `INSERT OR IGNORE INTO permissions (id, name, category, description) VALUES (?, ?, ?, ?)`
        );
        stmt.run([perm.id, perm.name, perm.category, '']);
        stmt.free();
      }

      // 管理员拥有全部权限
      for (const perm of permissions) {
        const stmt = this.dbInstance.prepare(
          `INSERT OR IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`
        );
        stmt.run(['role_admin', perm.id]);
        stmt.free();
      }

      // 会计权限：凭证CRUD+审核+记账、报表、往来管理、发票管理、资产管理（不含冲销）
      const accountantPerms = [
        'voucher:create', 'voucher:edit', 'voucher:delete', 'voucher:review', 'voucher:post', 'voucher:view',
        'fund:view',
        'invoice:import', 'invoice:edit', 'invoice:view',
        'report:view',
        'asset:create', 'asset:edit', 'asset:depreciate', 'asset:view',
        'partner:manage', 'partner:view',
        'settings:view',
        'accountset:view',
        'user:view',
      ];
      for (const permId of accountantPerms) {
        const stmt = this.dbInstance.prepare(
          `INSERT OR IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`
        );
        stmt.run(['role_accountant', permId]);
        stmt.free();
      }

      // 出纳权限：资金管理、银行流水导入、手动记账、凭证查看、报表查看
      const cashierPerms = [
        'voucher:view',
        'fund:import', 'fund:manual', 'fund:reconcile', 'fund:view',
        'invoice:view',
        'report:view',
        'asset:view',
        'partner:view',
        'settings:view',
        'accountset:view',
        'user:view',
      ];
      for (const permId of cashierPerms) {
        const stmt = this.dbInstance.prepare(
          `INSERT OR IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`
        );
        stmt.run(['role_cashier', permId]);
        stmt.free();
      }

      // 创建默认管理员用户（密码: admin123）
      // SHA-256 hash of 'admin123' with salt 'default'
      const defaultPasswordHash = 'sha256:default:8938e28d00cc4d0b087f84900e8b17bb489132fb161466446704226cdc4ca338';

      // 检测 users 表实际列，兼容不同 schema（旧数据库可能有 salt 列）
      const userPragma = this.dbInstance.exec('PRAGMA table_info(users)');
      const userColumns = userPragma[0]?.values?.map((row: any[]) => row[1]) || [];

      // 先删除旧的 admin 用户再插入，避免 INSERT OR REPLACE 与额外 NOT NULL 列冲突
      const delStmt = this.dbInstance.prepare('DELETE FROM users WHERE username = ?');
      delStmt.run(['admin']);
      delStmt.free();

      const hasSalt = userColumns.includes('salt');
      if (hasSalt) {
        const insStmt = this.dbInstance.prepare(
          `INSERT INTO users (id, username, passwordHash, displayName, status, salt, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        insStmt.run(['user_admin', 'admin', defaultPasswordHash, '管理员', 'active', 'default', now, now]);
        insStmt.free();
      } else {
        const insStmt = this.dbInstance.prepare(
          `INSERT INTO users (id, username, passwordHash, displayName, status, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        insStmt.run(['user_admin', 'admin', defaultPasswordHash, '管理员', 'active', now, now]);
        insStmt.free();
      }

      // 分配管理员角色给默认用户
      const urStmt = this.dbInstance.prepare(
        `INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)`
      );
      urStmt.run(['user_admin', 'role_admin']);
      urStmt.free();

      console.log('Migration: User/role/permission tables created with preset data');
    } catch (error) {
      console.error('Migration: Failed to create user tables', error);
    }
  }

  /**
   * 迁移：fxRates 表增加 createdBy 列
   */
  private async migrateFxRatesCreatedBy(): Promise<void> {
    if (!this.dbInstance) return;
    try {
      const cols = this.dbInstance.exec(`PRAGMA table_info(fxRates)`);
      const colNames = cols[0]?.values?.map((r: any[]) => r[1] as string) || [];
      if (!colNames.includes('createdBy')) {
        this.dbInstance.exec(`ALTER TABLE fxRates ADD COLUMN createdBy TEXT`);
        console.log('Migration: Added createdBy column to fxRates');
      }
    } catch (error) {
      console.error('Migration: Failed to add createdBy to fxRates', error);
    }
  }

  /**
   * 迁移：vouchers 表补齐 creator/reviewer/poster/reverseVoucherId 等列
   */
  private async migrateAddVoucherColumns(): Promise<void> {
    if (!this.dbInstance) return;
    try {
      const pragma = this.dbInstance.exec('PRAGMA table_info(vouchers)');
      const columns = pragma[0]?.values?.map((row: any[]) => row[1]) || [];
      const addColumns: string[] = [];
      if (!columns.includes('creator')) addColumns.push('ALTER TABLE vouchers ADD COLUMN creator TEXT');
      if (!columns.includes('reviewer')) addColumns.push('ALTER TABLE vouchers ADD COLUMN reviewer TEXT');
      if (!columns.includes('poster')) addColumns.push('ALTER TABLE vouchers ADD COLUMN poster TEXT');
      if (!columns.includes('reverseVoucherId')) addColumns.push('ALTER TABLE vouchers ADD COLUMN reverseVoucherId TEXT');
      if (!columns.includes('referenceNumber')) addColumns.push('ALTER TABLE vouchers ADD COLUMN referenceNumber TEXT');
      if (!columns.includes('attachmentCount')) addColumns.push('ALTER TABLE vouchers ADD COLUMN attachmentCount INTEGER DEFAULT 0');
      if (!columns.includes('totalDebit')) addColumns.push('ALTER TABLE vouchers ADD COLUMN totalDebit REAL DEFAULT 0');
      if (!columns.includes('totalCredit')) addColumns.push('ALTER TABLE vouchers ADD COLUMN totalCredit REAL DEFAULT 0');
      if (!columns.includes('createTime')) addColumns.push('ALTER TABLE vouchers ADD COLUMN createTime TEXT');
      if (!columns.includes('updateTime')) addColumns.push('ALTER TABLE vouchers ADD COLUMN updateTime TEXT');
      if (!columns.includes('voucherType')) addColumns.push('ALTER TABLE vouchers ADD COLUMN voucherType TEXT');
      for (const sql of addColumns) {
        this.dbInstance.exec(sql);
      }
    } catch (error) {
      console.error('Migration: Failed to add voucher columns', error);
    }
  }

  /**
   * 迁移：创建银行账户期初余额表
   */
  private async migrateCreateBankOpeningBalancesTable(): Promise<void> {
    if (!this.dbInstance) return;
    try {
      const tableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bank_opening_balances'"
      );
      if (!tableCheck[0]?.values?.length) {
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS bank_opening_balances (
            id TEXT PRIMARY KEY,
            accountSetId TEXT NOT NULL,
            accountNumber TEXT NOT NULL,
            periodStart TEXT NOT NULL,
            balance REAL NOT NULL DEFAULT 0,
            generateVoucher INTEGER NOT NULL DEFAULT 0,
            voucherId TEXT,
            createdBy TEXT,
            createdAt TEXT,
            updatedAt TEXT
          )
        `);
        this.dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_bank_opening_balances_lookup ON bank_opening_balances (accountSetId, accountNumber, periodStart)`);
        console.log('Migration: Created bank_opening_balances table');
      }
      // Ensure exchangeRate and foreignBalance columns exist for foreign currency support
      const columnInfo = this.dbInstance.exec("PRAGMA table_info(bank_opening_balances)");
      if (columnInfo.length > 0) {
        const columnNames = columnInfo[0].values?.map((row: any[]) => row[1]) || [];
        if (!columnNames.includes('exchangeRate')) {
          this.dbInstance.run('ALTER TABLE bank_opening_balances ADD COLUMN exchangeRate REAL');
          console.log('Migration: Added exchangeRate column to bank_opening_balances');
        }
        if (!columnNames.includes('foreignBalance')) {
          this.dbInstance.run('ALTER TABLE bank_opening_balances ADD COLUMN foreignBalance REAL');
          console.log('Migration: Added foreignBalance column to bank_opening_balances');
        }
      }
    } catch (error) {
      console.error('Migration: Failed to create bank_opening_balances table', error);
    }
  }

  private async migrateCreateDepartmentProjectTables(): Promise<void> {
    if (!this.dbInstance) return;
    try {
      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          parentId TEXT,
          level INTEGER DEFAULT 1,
          enabled INTEGER DEFAULT 1,
          description TEXT,
          accountSetId TEXT,
          createTime TEXT,
          updateTime TEXT
        )
      `);
      this.dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_departments_accountSetId ON departments (accountSetId)`);

      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          description TEXT,
          enabled INTEGER DEFAULT 1,
          accountSetId TEXT,
          createTime TEXT,
          updateTime TEXT
        )
      `);
      this.dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_projects_accountSetId ON projects (accountSetId)`);
    } catch (error) {
      console.error('Migration: Failed to create departments/projects tables', error);
    }
  }

  async getBankOpeningBalance(accountNumber: string, periodStart: string): Promise<number | null> {
    await this.ensureInitialized();
    return getBankOpeningBalanceQuery(this.getSimpleQueryService(), this.accountSetId, accountNumber, periodStart);
  }

  async getBankOpeningBalanceDetail(accountNumber: string, periodStart: string) {
    await this.ensureInitialized();
    return getBankOpeningBalanceDetailQuery(this.getSimpleQueryService(), this.accountSetId, accountNumber, periodStart);
  }

  async getAllBankOpeningBalances() {
    await this.ensureInitialized();
    return getAllBankOpeningBalancesQuery(this.getSimpleQueryService(), this.accountSetId);
  }

  async saveBankOpeningBalance(data: {
    accountNumber: string;
    periodStart: string;
    balance: number;
    foreignBalance?: number | null;
    exchangeRate?: number | null;
    generateVoucher?: boolean;
    createdBy?: string;
  }): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveBankOpeningBalanceRecord({
      db: this.dbInstance,
      accountSetId: this.accountSetId,
      ...data,
    });
  }

  async getCashOverview(ourAccount: string, periodStart: string, periodEnd: string): Promise<{
    openingBalance: number;
    totalCredit: number;
    totalDebit: number;
    closingBalance: number;
    lastBankBalance: number | null;
  }> {
    await this.ensureInitialized();
    return getCashOverviewQuery(this.getSimpleQueryService(), this.accountSetId, ourAccount, periodStart, periodEnd);
  }

  async getJournalEntries(ourAccount: string, periodStart: string, periodEnd: string, options?: {
    statusFilter?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ entries: any[]; total: number }> {
    await this.ensureInitialized();
    return getJournalEntriesQuery(this.getSimpleQueryService(), this.accountSetId, ourAccount, periodStart, periodEnd, options);
  }

  async getTransactionStatusCounts(ourAccount: string, periodStart: string, periodEnd: string): Promise<Record<string, number>> {
    await this.ensureInitialized();
    return getTransactionStatusCountsQuery(this.getSimpleQueryService(), this.accountSetId, ourAccount, periodStart, periodEnd);
  }

  // ========== 部门操作 ==========

  async saveDepartments(departments: Department[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveDepartmentsRecord({
      db: this.dbInstance,
      departments,
      accountSetId: this.accountSetId,
    });
  }

  async getAllDepartments(): Promise<Department[]> {
    await this.ensureInitialized();
    return listDepartments(this.getSimpleQueryService(), this.accountSetId);
  }

  async getDepartmentByCode(code: string): Promise<Department | undefined> {
    await this.ensureInitialized();
    return findDeptByCodeQuery(this.getSimpleQueryService(), this.accountSetId, code);
  }

  // ========== 项目操作 ==========

  async saveProjects(projects: Project[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveProjectsRecord({
      db: this.dbInstance,
      projects,
      accountSetId: this.accountSetId,
    });
  }

  async getAllProjects(): Promise<Project[]> {
    await this.ensureInitialized();
    return listProjects(this.getSimpleQueryService(), this.accountSetId);
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    await this.ensureInitialized();
    return findProjByCodeQuery(this.getSimpleQueryService(), this.accountSetId, code);
  }

  // ========== 币别操作 ==========

  async saveCurrencies(currencies: Currency[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveCurrenciesRecord({
      db: this.dbInstance,
      currencies,
      accountSetId: this.accountSetId,
    });
  }

  async getAllCurrencies(): Promise<Currency[]> {
    await this.ensureInitialized();
    return listCurrencies(this.getSimpleQueryService(), this.accountSetId);
  }

  async getCurrencyByCode(code: string): Promise<Currency | undefined> {
    await this.ensureInitialized();
    return findCurrencyByCodeQuery(this.getSimpleQueryService(), this.accountSetId, code);
  }

  // ========== 往来单位操作 ==========

  async getAccountSetBaseCurrency(accountSetId: string = this.accountSetId): Promise<{ baseCurrency: string; baseCurrencyName: string } | null> {
    await this.ensureInitialized();
    return getAccountSetBaseCurrencyQuery(this.getSimpleQueryService(), accountSetId);
  }

  async saveAccountSetBaseCurrency(baseCurrency: string, baseCurrencyName?: string, accountSetId: string = this.accountSetId): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveAccountSetBaseCurrencyRecord({
      db: this.dbInstance,
      baseCurrency,
      baseCurrencyName,
      accountSetId,
      persist: () => this.persist(),
    });
  }

  async saveFxRates(rates: FxRate[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveFxRatesRecord({
      db: this.dbInstance,
      rates,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async getFxRates(rateDate?: string): Promise<FxRate[]> {
    await this.ensureInitialized();
    return listFxRates(this.getSimpleQueryService(), this.accountSetId, rateDate);
  }

  // ========== FX 重估运行操作 ==========

  async saveFxRevaluationRun(run: FxRevaluationRun): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveFxRevaluationRunRecord({
      db: this.dbInstance,
      run,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async getFxRevaluationRuns(period?: string): Promise<FxRevaluationRun[]> {
    await this.ensureInitialized();
    return listFxRevaluationRuns(this.getSimpleQueryService(), this.accountSetId, period);
  }

  async getFxRevaluationRun(id: string): Promise<FxRevaluationRun | null> {
    await this.ensureInitialized();
    return findFxRevaluationRun(this.getSimpleQueryService(), this.accountSetId, id);
  }

  async deleteFxRevaluationRun(id: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await deleteFxRevaluationRunRecord({
      db: this.dbInstance,
      id,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async saveFxRevaluationRunLines(lines: FxRevaluationRunLine[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveFxRevaluationRunLinesRecord({
      db: this.dbInstance,
      lines,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async getFxRevaluationRunLines(runId: string): Promise<FxRevaluationRunLine[]> {
    await this.ensureInitialized();
    return listFxRevaluationRunLines(this.getSimpleQueryService(), this.accountSetId, runId);
  }

  async savePartners(partners: Partner[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await savePartnersRecord({
      db: this.dbInstance,
      partners,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async saveFixedAsset(asset: FixedAssetSaveInput): Promise<void> {
    try {
      await saveFixedAssetRecord({
        db: this.dbInstance!,
        accountSetId: this.accountSetId,
        asset,
        persist: () => this.persist(),
      });
    } catch (error) {
      console.error('Save fixed asset failed:', error);
      throw error;
    }
  }

  async getAllPartners(): Promise<Partner[]> {
    await this.ensureInitialized();
    return await listPartners(this.getPartnerQueryService(), this.accountSetId);
  }

  async getPartnerByCode(code: string): Promise<Partner | undefined> {
    await this.ensureInitialized();
    return await findPartnerByCode(this.getPartnerQueryService(), this.accountSetId, code);
  }

  async getPartnerByName(name: string): Promise<Partner | undefined> {
    await this.ensureInitialized();
    return await findPartnerByName(this.getPartnerQueryService(), this.accountSetId, name);
  }

  async addPartner(partner: PartnerInsertInput): Promise<void> {
    await this.ensureInitialized();
    await insertPartnerRecord({
      db: this.dbInstance!,
      partner,
      accountSetId: this.accountSetId,
      now: new Date().toISOString(),
      persist: () => this.persist(),
    });
  }

  // ========== 凭证模板操作 ==========

  async saveVoucherTemplates(templates: VoucherTemplate[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveVoucherTemplatesRecord({
      db: this.dbInstance,
      templates,
      accountSetId: this.accountSetId,
    });
  }

  async getAllVoucherTemplates(): Promise<VoucherTemplate[]> {
    await this.ensureInitialized();
    return listVoucherTemplates(this.getSimpleQueryService(), this.accountSetId) as Promise<VoucherTemplate[]>;
  }

  async getVoucherTemplateById(id: string): Promise<VoucherTemplate | undefined> {
    await this.ensureInitialized();
    return findVoucherTemplateById(this.getSimpleQueryService(), this.accountSetId, id) as Promise<VoucherTemplate | undefined>;
  }

  // ========== 常用摘要操作 ==========

  async saveCommonSummaries(summaries: CommonSummary[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveCommonSummariesRecord({
      db: this.dbInstance,
      summaries,
      accountSetId: this.accountSetId,
    });
  }

  async getAllCommonSummaries(): Promise<CommonSummary[]> {
    await this.ensureInitialized();
    return listCommonSummaries(this.getSimpleQueryService(), this.accountSetId);
  }

  // ========== 用户偏好操作 ==========

  async savePreference(preference: UserPreference): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await savePreferenceRecord({
      db: this.dbInstance,
      preference,
      accountSetId: this.accountSetId,
    });
  }

  async getPreferencesByUser(userId: string): Promise<UserPreference[]> {
    await this.ensureInitialized();
    return listPreferencesByUser(this.getSimpleQueryService(), this.accountSetId, userId);
  }

  // ========== 审计日志操作 ==========

  async addAuditLog(log: AuditLog): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await addAuditLogRecord({
      db: this.dbInstance,
      log,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    await this.ensureInitialized();
    return listAuditLogs(this.getSimpleQueryService(), this.accountSetId, limit);
  }

  // ========== 数据导出/导入 ==========

  async exportData() {
    await this.ensureInitialized();
    return exportAccountSetData(this.getSimpleQueryService(), this._accountSetId);
  }

  async importData(data: any) {
    await this.ensureInitialized();
    await this.clearAllData();

    if (data.vouchers && Array.isArray(data.vouchers)) {
      for (const voucher of data.vouchers) {
        if (voucher.accountSetId === this._accountSetId) {
          await this.saveVoucher(voucher);
        }
      }
    }
    if (data.subjects && Array.isArray(data.subjects)) {
      await this.saveSubjects(data.subjects.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.departments && Array.isArray(data.departments)) {
      await this.saveDepartments(data.departments.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.projects && Array.isArray(data.projects)) {
      await this.saveProjects(data.projects.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.currencies && Array.isArray(data.currencies)) {
      await this.saveCurrencies(data.currencies.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.fxRates && Array.isArray(data.fxRates)) {
      await this.saveFxRates(data.fxRates.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.partners && Array.isArray(data.partners)) {
      await this.savePartners(data.partners.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.voucherTemplates && Array.isArray(data.voucherTemplates)) {
      await this.saveVoucherTemplates(data.voucherTemplates.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.commonSummaries && Array.isArray(data.commonSummaries)) {
      await this.saveCommonSummaries(data.commonSummaries.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.recRelations && Array.isArray(data.recRelations)) {
      await this.saveRecRelations(data.recRelations.filter((s: any) => s.accountSetId === this._accountSetId));
    }
    if (data.fxRevaluationRuns && Array.isArray(data.fxRevaluationRuns)) {
      await importFxRevaluationRunsRecord({
        db: this.dbInstance,
        runs: data.fxRevaluationRuns.filter((s: any) => s.accountSetId === this._accountSetId),
        accountSetId: this._accountSetId,
      });
    }
    if (data.fxRevaluationRunLines && Array.isArray(data.fxRevaluationRunLines)) {
      await importFxRevaluationRunLinesRecord({
        db: this.dbInstance,
        lines: data.fxRevaluationRunLines.filter((s: any) => s.accountSetId === this._accountSetId),
        accountSetId: this._accountSetId,
      });
    }

    console.log('Data imported successfully for account set:', this._accountSetId);
  }

  // ========== 数据同步与恢复 ==========

  async syncAllData(stores: any[]) {
    for (const store of stores) {
      if (store.vouchers) {
        for (const voucher of store.vouchers) {
          await this.saveVoucher(voucher);
        }
      }
      if (store.subjects) {
        await this.saveSubjects(store.subjects);
      }
      if (store.departments) {
        await this.saveDepartments(store.departments);
      }
      if (store.projects) {
        await this.saveProjects(store.projects);
      }
      if (store.currencies) {
        await this.saveCurrencies(store.currencies);
      }
      if (store.partners) {
        await this.savePartners(store.partners);
      }
      if (store.voucherTemplates) {
        await this.saveVoucherTemplates(store.voucherTemplates);
      }
      if (store.commonSummaries) {
        await this.saveCommonSummaries(store.commonSummaries);
      }
      if (store.recRelations) {
        await this.saveRecRelations(store.recRelations);
      }
    }
    console.log('All data synchronized to SQLite');
  }

  async restoreAllData() {
    return this.exportData();
  }

  // ========== 核销关系操作 ==========

  async saveRecRelations(relations: any[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveRecRelationsRecord({
      db: this.dbInstance,
      relations,
      accountSetId: this.accountSetId,
    });
  }

  async saveRecRelation(relation: any): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await saveRecRelationRecord({
      db: this.dbInstance,
      relation,
      accountSetId: this.accountSetId,
    });
  }

  async getRecRelations(): Promise<any[]> {
    await this.ensureInitialized();
    return listRecRelations(this.getReconciliationQueryService(), this.accountSetId);
  }

  async updateEntryRecRefNo(entryId: string, recRefNo: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await updateEntryRecRefNoRecord({
      db: this.dbInstance,
      entryId,
      recRefNo,
      accountSetId: this.accountSetId,
    });
  }

  async getRecRelationsByRecRefNo(recRefNo: string): Promise<any[]> {
    await this.ensureInitialized();
    return findRecByRefNo(this.getReconciliationQueryService(), this.accountSetId, recRefNo);
  }

  async getRecRelationsByEntryId(entryId: string): Promise<any[]> {
    await this.ensureInitialized();
    return findRecByEntryId(this.getReconciliationQueryService(), this.accountSetId, entryId);
  }

  async getOutstandingItems(query: any): Promise<any[]> {
    await this.ensureInitialized();
    return getOutstanding(this.getReconciliationQueryService(), this.accountSetId, query);
  }

  async calculatePartnerBalance(partnerName: string): Promise<number> {
    await this.ensureInitialized();
    return calcPartnerBalance(this.getReconciliationQueryService(), this.accountSetId, partnerName);
  }

  // ========== 数据完整性检查 ==========

  async checkDataIntegrity() {
    await this.ensureInitialized();
    const counts = await checkDataIntegrityQuery(this.getSimpleQueryService(), this.accountSetId);
    console.log('Data integrity check:', counts);
    return counts;
  }

  // ========== 清空数据 ==========

  async clearAllData() {
    await this.ensureInitialized();
    if (!this.dbInstance) throw new Error('Database instance is null after initialization');
    await clearAllDataRecord(this.dbInstance, this.accountSetId);
  }

  // ========== 银行流水操作 ==========

  async saveBankTransaction(transaction: BankTransactionSaveInput): Promise<void> {
    try {
      await this.ensureInitialized();
      await saveBankTransactionRecord({
        db: this.dbInstance!,
        accountSetId: this.accountSetId,
        transaction,
        persist: () => this.persist(),
      });
    } catch (error) {
      console.error('Save bank transaction failed:', error);
      throw error;
    }
  }

  async saveBankTransactions(transactions: BankTransactionSaveInput[]): Promise<void> {
    try {
      await this.ensureInitialized();
      for (const tx of transactions) {
        await saveBankTransactionRecord({
          db: this.dbInstance!,
          accountSetId: this.accountSetId,
          transaction: tx,
          persist: async () => {},
        });
      }
      await this.persist();
    } catch (error) {
      console.error('Save bank transactions failed:', error);
      throw error;
    }
  }

  async getBankTransaction(id: string): Promise<BankTransactionRecord | undefined> {
    await this.ensureInitialized();
    return await getBankTransactionRecord(this.getBankTransactionQueryService(), this.accountSetId, id);
  }

  async getAllBankTransactions(): Promise<BankTransactionRecord[]> {
    await this.ensureInitialized();
    return await listBankTransactionsRecord(this.getBankTransactionQueryService(), this.accountSetId);
  }

  async getBankTransactionsByStatus(status: 'pending' | 'matched' | 'voucher_generated'): Promise<BankTransactionRecord[]> {
    await this.ensureInitialized();
    return await listBankTransactionsByStatusRecord(this.getBankTransactionQueryService(), this.accountSetId, status);
  }

  async getBankTransactionsByDateRange(startDate: string, endDate: string): Promise<BankTransactionRecord[]> {
    await this.ensureInitialized();
    return await listBankTransactionsByDateRangeRecord(this.getBankTransactionQueryService(), this.accountSetId, startDate, endDate);
  }

  async getBankTransactionsByBatch(batchId: string): Promise<BankTransactionRecord[]> {
    await this.ensureInitialized();
    return await listBankTransactionsByBatchRecord(this.getBankTransactionQueryService(), this.accountSetId, batchId);
  }

  async updateBankTransaction(id: string, updates: BankTransactionUpdateInput): Promise<void> {
    try {
      await this.ensureInitialized();
      await updateBankTransactionRecord({
        db: this.dbInstance!,
        accountSetId: this.accountSetId,
        id,
        updates,
        persist: () => this.persist(),
      });
    } catch (error) {
      console.error('Update bank transaction failed:', error);
      throw error;
    }
  }

  /** 检查流水是否已入账（按 date + voucherNo + transactionSerialNo 去重） */
  async findPostedBankTransaction(date: string, voucherNo: string, transactionSerialNo: string): Promise<BankTransactionRecord | null> {
    await this.ensureInitialized();
    return await findPostedBankTransactionRecord(this.getBankTransactionQueryService(), this.accountSetId, date, voucherNo, transactionSerialNo);
  }

  /** 检查流水是否已存在（导入去重，不论状态） */
  async existsBankTransaction(date: string, voucherNo: string, transactionSerialNo: string): Promise<boolean> {
    await this.ensureInitialized();
    return await existsBankTransactionRecord(this.getBankTransactionQueryService(), this.accountSetId, date, voucherNo, transactionSerialNo);
  }

  async deleteBankTransaction(id: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await deleteBankTransactionRecord(this.getBankTransactionQueryService(), this.accountSetId, id, () => this.persist());
    } catch (error) {
      console.error('Delete bank transaction failed:', error);
      throw error;
    }
  }

  async deleteBankTransactionsByBatch(batchId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await deleteBankTransactionsByBatchRecord(this.getBankTransactionQueryService(), this.accountSetId, batchId, () => this.persist());
    } catch (error) {
      console.error('Delete bank transactions by batch failed:', error);
      throw error;
    }
  }

  async clearBankTransactions(): Promise<void> {
    try {
      await this.ensureInitialized();
      await clearBankTransactionsRecord(this.getBankTransactionQueryService(), this.accountSetId, () => this.persist());
    } catch (error) {
      console.error('Clear bank transactions failed:', error);
      throw error;
    }
  }

  // --- Bank Account Bindings ---
  async getBankAccountBindings(): Promise<BankAccountBinding[]> {
    await this.ensureInitialized();
    return await listBankAccountBindings(this.getBankAccountBindingQueryService(), this.accountSetId);
  }

  async saveBankAccountBinding(binding: BankAccountBinding): Promise<void> {
    await this.ensureInitialized();
    await saveBankAccountBindingRecord({
      db: this.dbInstance!,
      binding,
      persist: () => this.persist(),
    });
  }

  async deleteBankAccountBinding(id: string): Promise<void> {
    await this.ensureInitialized();
    await deleteBankAccountBindingRecord(this.getBankAccountBindingQueryService(), this.accountSetId, id, () => this.persist());
  }

  async findBankAccountBinding(accountNumber: string): Promise<BankAccountBinding | null> {
    await this.ensureInitialized();
    return await findBankAccountBindingRecord(this.getBankAccountBindingQueryService(), this.accountSetId, accountNumber);
  }

  // --- Custom Bank Configs ---
  async getCustomBankConfigs(): Promise<CustomBankConfig[]> {
    await this.ensureInitialized();
    return await listCustomBankConfigs(this.getInvoiceRuleQueryService(), this.accountSetId);
  }

  async saveCustomBankConfig(customConfig: CustomBankConfig): Promise<void> {
    await this.ensureInitialized();
    await saveCustomBankConfigRecord({
      db: this.dbInstance!,
      config: customConfig,
      persist: () => this.persist(),
    });
  }

  async deleteCustomBankConfig(id: string): Promise<void> {
    await this.ensureInitialized();
    await deleteCustomBankConfigRecord(this.getInvoiceRuleQueryService(), this.accountSetId, id, () => this.persist());
  }

  // ========== 智能规则引擎操作 ==========

  // --- Smart Rules ---
  async getSmartRules(): Promise<InvoiceSmartRule[]> {
    await this.ensureInitialized();
    return await listSmartRules(this.getInvoiceRuleQueryService(), this.accountSetId);
  }

  async saveSmartRule(rule: InvoiceSmartRule): Promise<void> {
    await this.ensureInitialized();
    await saveSmartRuleRecord({
      db: this.dbInstance!,
      rule,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async deleteSmartRule(id: string): Promise<void> {
    await this.ensureInitialized();
    await deleteSmartRuleRecord(this.getInvoiceRuleQueryService(), this.accountSetId, id, () => this.persist());
  }

  // --- Supplier Subject Mapping ---
  async getSupplierMappings(): Promise<SupplierSubjectMapping[]> {
    await this.ensureInitialized();
    return await listSupplierMappings(this.getInvoiceRuleQueryService(), this.accountSetId);
  }

  async getSupplierMappingsByGroup(groupName: string): Promise<SupplierSubjectMapping[]> {
    await this.ensureInitialized();
    return await listSupplierMappingsByGroup(this.getInvoiceRuleQueryService(), this.accountSetId, groupName);
  }

  async saveSupplierMapping(mapping: SupplierSubjectMapping): Promise<void> {
    await this.ensureInitialized();
    await saveSupplierMappingRecord({
      db: this.dbInstance!,
      mapping,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async deleteSupplierMapping(id: string): Promise<void> {
    await this.ensureInitialized();
    await deleteSupplierMappingRecord(this.getInvoiceRuleQueryService(), this.accountSetId, id, () => this.persist());
  }

  async getSupplierMappingBySellerName(sellerName: string): Promise<SupplierSubjectMapping | null> {
    await this.ensureInitialized();
    return await findSupplierMappingBySellerName(this.getInvoiceRuleQueryService(), this.accountSetId, sellerName);
  }

  // --- Purchase Invoice Rule Config ---
  async getPurchaseInvoiceRuleConfig(): Promise<PurchaseInvoiceRuleConfig> {
    await this.ensureInitialized();
    const { config, isDefault } = await getPurchaseInvoiceRuleConfigQuery(this.getInvoiceRuleQueryService(), this.accountSetId);
    if (isDefault) {
      await this.savePurchaseInvoiceRuleConfig(config);
    }
    return config;
  }

  async savePurchaseInvoiceRuleConfig(config: PurchaseInvoiceRuleConfig): Promise<void> {
    await this.ensureInitialized();
    await savePurchaseInvoiceRuleConfigRecord({
      db: this.dbInstance!,
      config,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  // --- Expense Reimbursement ---
  async getExpenseReimbursements(): Promise<ExpenseReimbursement[]> {
    await this.ensureInitialized();
    return await listExpenseReimbursements(this.getInvoiceRuleQueryService(), this.accountSetId);
  }

  async saveExpenseReimbursement(record: ExpenseReimbursement): Promise<void> {
    await this.ensureInitialized();
    await saveExpenseReimbursementRecord({
      db: this.dbInstance!,
      record,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async updateExpenseReimbursement(id: string, updates: Partial<ExpenseReimbursement>): Promise<void> {
    await this.ensureInitialized();
    await updateExpenseReimbursementRecord({
      db: this.dbInstance!,
      id,
      updates,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async deleteExpenseReimbursement(id: string): Promise<void> {
    await this.ensureInitialized();
    await deleteExpenseReimbursementRecord(this.getInvoiceRuleQueryService(), this.accountSetId, id, () => this.persist());
  }

  async clearExpenseReimbursements(): Promise<void> {
    await this.ensureInitialized();
    await clearExpenseReimbursementsRecord(this.getInvoiceRuleQueryService(), this.accountSetId, () => this.persist());
  }

  // --- Expense Keyword Categories ---
  async getExpenseKeywordCategories(): Promise<ExpenseKeywordCategory[]> {
    await this.ensureInitialized();
    return await listExpenseKeywordCategories(this.getInvoiceRuleQueryService(), this.accountSetId);
  }

  async saveExpenseKeywordCategory(cat: ExpenseKeywordCategory): Promise<void> {
    await this.ensureInitialized();
    await saveExpenseKeywordCategoryRecord({
      db: this.dbInstance!,
      cat,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async deleteExpenseKeywordCategory(id: string): Promise<void> {
    await this.ensureInitialized();
    await deleteExpenseKeywordCategoryRecord(this.getInvoiceRuleQueryService(), this.accountSetId, id, () => this.persist());
  }

  // --- Auxiliary Strategy ---
  async getAuxiliaryStrategy(): Promise<AuxiliaryStrategyConfig | null> {
    await this.ensureInitialized();
    return await getAuxiliaryStrategyQuery(this.getInvoiceRuleQueryService(), this.accountSetId);
  }

  async saveAuxiliaryStrategy(config: AuxiliaryStrategyConfig): Promise<void> {
    await this.ensureInitialized();
    await saveAuxiliaryStrategyRecord({
      db: this.dbInstance!,
      config,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  // --- Asset Category Mapping ---
  async getAssetCategoryMappings(): Promise<AssetCategoryMapping[]> {
    await this.ensureInitialized();
    return await listAssetCategoryMappings(this.getInvoiceRuleQueryService(), this.accountSetId);
  }

  async saveAssetCategoryMapping(mapping: AssetCategoryMapping): Promise<void> {
    await this.ensureInitialized();
    await saveAssetCategoryMappingRecord({
      db: this.dbInstance!,
      mapping,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async deleteAssetCategoryMapping(id: string): Promise<void> {
    await this.ensureInitialized();
    await deleteAssetCategoryMappingRecord(this.getInvoiceRuleQueryService(), this.accountSetId, id, () => this.persist());
  }

  // --- Invoice hold/category updates ---
  async updateInvoiceHoldStatus(id: string, holdStatus: 'normal' | 'on_hold'): Promise<void> {
    await this.ensureInitialized();
    await updateInvoiceHoldStatusRecord({
      db: this.dbInstance!,
      id,
      holdStatus,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async updateInvoiceCategory(id: string, category: string | null): Promise<void> {
    await this.ensureInitialized();
    await updateInvoiceCategoryRecord({
      db: this.dbInstance!,
      id,
      category,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  // --- Payroll import and calculation ---
  async getPayrollBatches(period?: string): Promise<PayrollBatch[]> {
    await this.ensureInitialized();
    return await listPayrollBatches(this.getPayrollQueryService(), this.accountSetId, period);
  }

  async getPayrollItems(batchId: string): Promise<PayrollItem[]> {
    await this.ensureInitialized();
    return await listPayrollItems(this.getPayrollQueryService(), this.accountSetId, batchId);
  }

  async savePayrollCalculationConfig(record: PayrollCalculationConfigRecord): Promise<void> {
    await this.ensureInitialized();
    await savePayrollCalculationConfigRecord({
      db: this.dbInstance!,
      record,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async getPayrollCalculationConfig(period: string): Promise<PayrollCalculationConfigRecord | null> {
    await this.ensureInitialized();
    return await getPayrollCalculationConfigQuery(
      this.getPayrollQueryService(),
      this.accountSetId,
      period,
      clonePayrollTaxRuleSet,
    );
  }

  async savePayrollBatch(batch: PayrollBatch, items: PayrollItem[]): Promise<void> {
    await this.ensureInitialized();
    await savePayrollBatchRecord({
      db: this.dbInstance!,
      batch,
      items,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async updatePayrollBatchStatus(batchId: string, status: PayrollBatch['status']): Promise<void> {
    await this.ensureInitialized();
    await updatePayrollBatchStatusRecord({
      db: this.dbInstance!,
      batchId,
      status,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async deletePayrollBatch(batchId: string): Promise<void> {
    await this.ensureInitialized();
    await deletePayrollBatchRecord({
      service: this.getPayrollQueryService(),
      db: this.dbInstance!,
      batchId,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async updatePayrollBatchVoucher(batchId: string, voucherId: string, voucherNo: string): Promise<void> {
    await this.ensureInitialized();
    await updatePayrollBatchVoucherRecord({
      db: this.dbInstance!,
      batchId,
      voucherId,
      voucherNo,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async clearPayrollBatchVoucherByVoucherId(voucherId: string): Promise<boolean> {
    await this.ensureInitialized();
    return await clearPayrollBatchVoucherByVoucherIdRecord({
      service: this.getPayrollQueryService(),
      db: this.dbInstance!,
      voucherId,
      accountSetId: this.accountSetId,
      persist: () => this.persist(),
    });
  }

  async getPayrollBatchByVoucherId(voucherId: string): Promise<PayrollBatch | null> {
    await this.ensureInitialized();
    return await getPayrollBatchByVoucherId(this.getPayrollQueryService(), this.accountSetId, voucherId);
  }

  // --- Legacy stubs (will be removed once consumers migrate to smart rules) ---
  async getInvoiceSubjectRules(): Promise<any[]> {
    // Backward-compatible: read from invoice_smart_rules mapped to old shape
    const smartRules = await this.getSmartRules();
    return smartRules.map(rule => {
      // Extract keyword conditions and tax rate from conditions/actions
      const keywordCondition = rule.conditions.find((c: any) => c.field === 'goodsName') as any;
      const keywords: string[] = keywordCondition?.values || [];
      const taxCondition = rule.conditions.find((c: any) => c.field === 'taxRate') as any;
      const matchTaxRate = taxCondition ? Number(taxCondition.value) : null;
      // Extract subject overrides from actions
      const overrideAction = rule.actions.find((a: any) => a.type === 'override_subjects') as any;
      const overrides = overrideAction?.subjectOverrides || {};
      return {
        id: rule.id,
        accountSetId: rule.accountSetId,
        name: rule.name,
        keywords,
        invoiceType: rule.invoiceType,
        matchTaxRate,
        inputDebitSubject: overrides.debit?.code || null,
        inputDebitSubjectName: overrides.debit?.name || null,
        inputTaxSubject: overrides.tax?.code || null,
        inputTaxSubjectName: overrides.tax?.name || null,
        inputCreditSubject: overrides.credit?.code || null,
        inputCreditSubjectName: overrides.credit?.name || null,
        outputDebitSubject: overrides.debit?.code || null,
        outputDebitSubjectName: overrides.debit?.name || null,
        outputCreditSubject: overrides.credit?.code || null,
        outputCreditSubjectName: overrides.credit?.name || null,
        outputTaxSubject: overrides.tax?.code || null,
        outputTaxSubjectName: overrides.tax?.name || null,
        priority: rule.priority,
        enabled: rule.enabled,
        createTime: rule.createTime,
        updateTime: rule.updateTime,
      };
    });
  }

  async saveInvoiceSubjectRule(rule: any): Promise<void> {
    // Convert old-format rule to InvoiceSmartRule and save
    const conditions: any[] = [];
    if (rule.keywords && Array.isArray(rule.keywords) && rule.keywords.length > 0) {
      conditions.push({ field: 'goodsName', operator: 'contains', values: rule.keywords });
    }
    if (rule.matchTaxRate != null) {
      conditions.push({ field: 'taxRate', operator: 'equals', value: rule.matchTaxRate });
    }
    const subjectOverrides: Record<string, { code: string; name: string }> = {};
    if (rule.inputDebitSubject) subjectOverrides.debit = { code: rule.inputDebitSubject, name: rule.inputDebitSubjectName || '' };
    if (rule.inputTaxSubject || rule.outputTaxSubject) subjectOverrides.tax = { code: rule.inputTaxSubject || rule.outputTaxSubject, name: rule.inputTaxSubjectName || rule.outputTaxSubjectName || '' };
    if (rule.inputCreditSubject) subjectOverrides.credit = { code: rule.inputCreditSubject, name: rule.inputCreditSubjectName || '' };
    if (rule.outputCreditSubject && !subjectOverrides.credit) subjectOverrides.credit = { code: rule.outputCreditSubject, name: rule.outputCreditSubjectName || '' };
    if (rule.outputDebitSubject && !subjectOverrides.debit) subjectOverrides.debit = { code: rule.outputDebitSubject, name: rule.outputDebitSubjectName || '' };

    const actions: any[] = [];
    if (Object.keys(subjectOverrides).length > 0) {
      actions.push({ type: 'override_subjects', subjectOverrides });
    }
    const now = new Date().toISOString();
    await this.saveSmartRule({
      id: rule.id,
      accountSetId: rule.accountSetId || this.accountSetId,
      name: rule.name,
      invoiceType: rule.invoiceType || 'both',
      priority: rule.priority || 50,
      conditions,
      actions,
      enabled: rule.enabled !== false,
      createTime: rule.createTime || now,
      updateTime: rule.updateTime || now,
    });
  }

  async deleteInvoiceSubjectRule(id: string): Promise<void> {
    await this.deleteSmartRule(id);
  }
}

export const sqliteService = new SQLiteService();
