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

  /** 写操作后立即持久化到 OPFS/localStorage/磁盘 */
  private async persist(): Promise<void> {
    try {
      const { sqliteManager } = await import('./sqlite-manager');
      sqliteManager.save();
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

  // 确保数据库已初始化的辅助方法
  private async ensureInitialized(): Promise<void> {
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
  }

  private async migrateCreatePayrollTables(): Promise<void> {
    if (!this.dbInstance) return;

    this.dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS payroll_batches (
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
      );
      CREATE TABLE IF NOT EXISTS payroll_items (
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
      );
      CREATE TABLE IF NOT EXISTS payroll_calculation_configs (
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
      );
      CREATE INDEX IF NOT EXISTS idx_payroll_batches_period ON payroll_batches(accountSetId, payrollPeriod);
      CREATE INDEX IF NOT EXISTS idx_payroll_items_batch ON payroll_items(accountSetId, batchId);
      CREATE INDEX IF NOT EXISTS idx_payroll_config_period ON payroll_calculation_configs(accountSetId, effectivePeriod);
    `);
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
        'departmentCode',
        'departmentName',
        'paymentTermDays',
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
        'enableDept', 'enableProject', 'enableForeign', 'foreignCurrency',
        'isCustomer', 'isSupplier', 'isEmployee', 'enableCashFlow',
        'bankAccountNumber'
      ];

      const missingColumns = neededColumns.filter(col => !columns.includes(col));

      if (missingColumns.length > 0) {
        console.log('Migrating subjects table: adding columns', missingColumns);

        const alterStatements = missingColumns.map(col => {
          if (col === 'foreignCurrency' || col === 'bankAccountNumber') {
            return `ALTER TABLE subjects ADD COLUMN ${col} TEXT;`;
          } else {
            return `ALTER TABLE subjects ADD COLUMN ${col} INTEGER DEFAULT 0;`;
          }
        }).join('\n');

        this.dbInstance.exec(alterStatements);
        console.log('Subjects table migration completed successfully');
      }

      // 无论是否添加了列，都更新默认科目的值（确保数据正确）
      // 1122 = 应收账款 (客户), 2202 = 应付账款 (供应商)
      this.dbInstance.exec(`
        UPDATE subjects SET isCustomer = 1 WHERE code = '1122';
        UPDATE subjects SET isSupplier = 1 WHERE code = '2202';
        UPDATE subjects SET enableDept = 1 WHERE code = '1122';
        UPDATE subjects SET enableProject = 1 WHERE code = '1122';
      `);
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
    try {
      await this.ensureInitialized();

      if (!this.dbInstance) {
        throw new Error('Database instance is null after initialization');
      }

      // Save voucher
      const voucherWithAccountSet = {
        ...voucher,
        accountSetId: this.accountSetId
      };

      const stmt = this.dbInstance.prepare(`
        INSERT OR REPLACE INTO vouchers (
          id, voucherNo, date, status, summary, creator, reviewer, poster,
          reverseVoucherId, referenceNumber, attachmentCount, accountSetId,
          createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        voucherWithAccountSet.id || '',
        voucherWithAccountSet.voucherNo || '',
        voucherWithAccountSet.date || new Date().toISOString().split('T')[0],
        voucherWithAccountSet.status || 'draft',
        voucherWithAccountSet.summary || '',
        (voucherWithAccountSet as any).creator || (voucherWithAccountSet as any).createdBy || 'user',
        (voucherWithAccountSet as any).reviewer || '',
        (voucherWithAccountSet as any).poster || '',
        (voucherWithAccountSet as any).reverseVoucherId || '',
        (voucherWithAccountSet as any).referenceNumber || '',
        (voucherWithAccountSet as any).attachmentCount || 0,
        voucherWithAccountSet.accountSetId || '',
        (voucherWithAccountSet as any).createTime || new Date().toISOString(),
        (voucherWithAccountSet as any).updateTime || new Date().toISOString()
      ]);
      stmt.free();

      // Delete existing entries for this voucher
      const deleteStmt = this.dbInstance.prepare(`DELETE FROM entries WHERE voucherId = ? AND accountSetId = ?`);
      deleteStmt.run([voucher.id, this.accountSetId]);
      deleteStmt.free();

      // Save new entries
      console.log('[saveVoucher] 保存凭证', voucher.voucherNo, 'id:', voucher.id, 'accountSetId:', this.accountSetId, '共有', voucher.entries?.length || 0, '条分录');
      for (const entry of voucher.entries) {
        const entryWithAccountSet = {
          ...entry,
          accountSetId: this.accountSetId,
          voucherId: voucher.id
        } as any;

        const entryStmt = this.dbInstance.prepare(`
          INSERT INTO entries (
            id, voucherId, subjectCode, subjectName, direction, debit, credit,
            summary, customerName, supplierName, auxiliary, recRefNo,
            departmentCode, departmentName, projectCode, projectName,
            currencyCode, currencyName, exchangeRate, originalAmount, date, accountSetId,
            createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        entryStmt.run([
          entryWithAccountSet.id,
          entryWithAccountSet.voucherId,
          entryWithAccountSet.subjectCode || '',
          entryWithAccountSet.subjectName || '',
          entryWithAccountSet.debit > 0 ? 'debit' : 'credit',
          entryWithAccountSet.debit || 0,
          entryWithAccountSet.credit || 0,
          entryWithAccountSet.summary || '',
          entryWithAccountSet.customerName || '',
          entryWithAccountSet.supplierName || '',
          JSON.stringify(entryWithAccountSet.auxiliary || {}),
          entryWithAccountSet.recRefNo || '',
          entryWithAccountSet.departmentCode || entryWithAccountSet.deptCode || '',
          entryWithAccountSet.departmentName || '',
          entryWithAccountSet.projectCode || '',
          entryWithAccountSet.projectName || '',
          entryWithAccountSet.currencyCode || '',
          entryWithAccountSet.currencyName || '',
          entryWithAccountSet.exchangeRate || 0,
          entryWithAccountSet.originalAmount || 0,
          entryWithAccountSet.date || new Date().toISOString().split('T')[0],
          entryWithAccountSet.accountSetId,
          entryWithAccountSet.createTime || new Date().toISOString(),
          entryWithAccountSet.updateTime || new Date().toISOString()
        ]);
        entryStmt.free();
      }
      await this.persist();
    } catch (error) {
      console.error('Save voucher failed:', error);
      throw error;
    }
  }

  async updateVoucherStatus(id: string, status: string): Promise<void> {
    try {
      await this.ensureInitialized();

      if (!this.dbInstance) {
        throw new Error('Database instance is null after initialization');
      }

      const stmt = this.dbInstance.prepare(`
        UPDATE vouchers
        SET status = ?,
            updateTime = ?
        WHERE id = ? AND accountSetId = ?
      `);
      stmt.run([
        status,
        new Date().toISOString(),
        id,
        this.accountSetId
      ]);
      stmt.free();

      await this.persist();
    } catch (error) {
      console.error('Update voucher status failed:', error);
      throw error;
    }
  }

  async getVoucher(id: string): Promise<Voucher | undefined> {
    await this.ensureInitialized();
    const voucher = await this.querySingleAsync<any>(
      `SELECT * FROM vouchers WHERE id = ? AND accountSetId = ?`,
      [id, this.accountSetId]
    );

    if (!voucher) {
      return undefined;
    }

    const entries = await this.queryAllAsync<any>(
      `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
      [id, this.accountSetId]
    );

    return {
      ...voucher,
      // 字段映射：数据库字段 → 应用字段
      createdBy: voucher.creator || voucher.createdBy || 'user',
      entries: entries.map((entry: any) => ({
        ...entry,
        // 字段映射：数据库字段 → 应用字段
        deptCode: entry.departmentCode || entry.deptCode || '',
        auxiliary: entry.auxiliary ? JSON.parse(entry.auxiliary) : {}
      }))
    };
  }

  async getAllVouchers(): Promise<Voucher[]> {
    await this.ensureInitialized();
    const vouchers = await this.queryAllAsync<any>(
      `SELECT * FROM vouchers WHERE accountSetId = ? ORDER BY date DESC`,
      [this.accountSetId]
    );

    console.log('[getAllVouchers] accountSetId:', this.accountSetId, '从数据库读取到', vouchers.length, '张凭证');

    return Promise.all(
      vouchers.map(async (voucher: any) => {
        const entries = await this.queryAllAsync<any>(
          `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
          [voucher.id, this.accountSetId]
        );

        if (entries.length === 0) {
          console.warn('[getAllVouchers] 凭证', voucher.voucherNo, '没有分录！数据可能未正确保存');
        }

        return {
          ...voucher,
          // 字段映射：数据库字段 → 应用字段
          createdBy: voucher.creator || voucher.createdBy || 'user',
          entries: entries.map((entry: any) => ({
            ...entry,
            // 字段映射：数据库字段 → 应用字段
            deptCode: entry.departmentCode || entry.deptCode || '',
            auxiliary: entry.auxiliary ? JSON.parse(entry.auxiliary) : {}
          }))
        };
      })
    );
  }

  async getVouchersByDateRange(startDate: string, endDate: string): Promise<Voucher[]> {
    await this.ensureInitialized();
    const vouchers = await this.queryAllAsync<any>(
      `SELECT * FROM vouchers WHERE accountSetId = ? AND date >= ? AND date <= ? ORDER BY date DESC`,
      [this.accountSetId, startDate, endDate]
    );

    return Promise.all(
      vouchers.map(async (voucher: any) => {
        const entries = await this.queryAllAsync<any>(
          `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
          [voucher.id, this.accountSetId]
        );

        return {
          ...voucher,
          // 字段映射：数据库字段 → 应用字段
          createdBy: voucher.creator || voucher.createdBy || 'user',
          entries: entries.map((entry: any) => ({
            ...entry,
            // 字段映射：数据库字段 → 应用字段
            deptCode: entry.departmentCode || entry.deptCode || '',
            auxiliary: entry.auxiliary ? JSON.parse(entry.auxiliary) : {}
          }))
        };
      })
    );
  }

  async getVouchersByStatus(status: 'draft' | 'review' | 'posted' | 'reversed'): Promise<Voucher[]> {
    await this.ensureInitialized();
    const vouchers = await this.queryAllAsync<any>(
      `SELECT * FROM vouchers WHERE accountSetId = ? AND status = ? ORDER BY date DESC`,
      [this.accountSetId, status]
    );

    return Promise.all(
      vouchers.map(async (voucher: any) => {
        const entries = await this.queryAllAsync<any>(
          `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
          [voucher.id, this.accountSetId]
        );

        return {
          ...voucher,
          // 字段映射：数据库字段 → 应用字段
          createdBy: voucher.creator || voucher.createdBy || 'user',
          entries: entries.map((entry: any) => ({
            ...entry,
            // 字段映射：数据库字段 → 应用字段
            deptCode: entry.departmentCode || entry.deptCode || '',
            auxiliary: entry.auxiliary ? JSON.parse(entry.auxiliary) : {}
          }))
        };
      })
    );
  }

  async deleteVoucher(id: string): Promise<void> {
    try {
      await this.ensureInitialized();
      // Delete entries first
      const deleteEntriesStmt = this.dbInstance.prepare(`DELETE FROM entries WHERE voucherId = ? AND accountSetId = ?`);
      deleteEntriesStmt.run([id, this.accountSetId]);
      deleteEntriesStmt.free();

      // Delete voucher
      const deleteVoucherStmt = this.dbInstance.prepare(`DELETE FROM vouchers WHERE id = ? AND accountSetId = ?`);
      deleteVoucherStmt.run([id, this.accountSetId]);
      deleteVoucherStmt.free();
    } catch (error) {
      console.error('Delete voucher failed:', error);
      throw error;
    }
  }

  // ========== 科目操作 ==========

  async saveSubjects(subjects: Subject[]): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      for (const subject of subjects) {
        const subjectWithAccountSet = { ...subject, accountSetId: this.accountSetId } as any;
        const stmt = this.dbInstance.prepare(`
          INSERT OR REPLACE INTO subjects (
            id, code, name, parentId, level, type, direction, balance,
            enabled, frozen, description, enableDept, enableProject,
            enableForeign, foreignCurrency, isCustomer, isSupplier,
            isEmployee, enableCashFlow, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          subjectWithAccountSet.id,
          subjectWithAccountSet.code,
          subjectWithAccountSet.name,
          subjectWithAccountSet.parentId,
          subjectWithAccountSet.level || 1,
          subjectWithAccountSet.subjectType || subjectWithAccountSet.type || '',
          subjectWithAccountSet.direction,
          subjectWithAccountSet.balance || 0,
          subjectWithAccountSet.disabled !== undefined ? Number(!subjectWithAccountSet.disabled) :
            (subjectWithAccountSet.enabled !== undefined ? Number(subjectWithAccountSet.enabled) : 1),
          subjectWithAccountSet.block !== undefined ? Number(subjectWithAccountSet.block) :
            (subjectWithAccountSet.frozen !== undefined ? Number(subjectWithAccountSet.frozen) : 0),
          subjectWithAccountSet.description || '',
          Number(subjectWithAccountSet.enableDept || false),
          Number(subjectWithAccountSet.enableProject || false),
          Number(subjectWithAccountSet.enableForeign || false),
          subjectWithAccountSet.foreignCurrency || '',
          Number(subjectWithAccountSet.isCustomer || false),
          Number(subjectWithAccountSet.isSupplier || false),
          Number(subjectWithAccountSet.isEmployee || false),
          Number(subjectWithAccountSet.enableCashFlow || false),
          subjectWithAccountSet.accountSetId,
          subjectWithAccountSet.createTime || now,
          subjectWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
      await this.persist();
    } catch (error) {
      console.error('Save subjects failed:', error);
      throw error;
    }
  }

  async getAllSubjects(): Promise<Subject[]> {
    await this.ensureInitialized();
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM subjects WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );

    const subjects = results.map(result => ({
      id: result.id,
      code: result.code,
      name: result.name,
      parentId: result.parentId,
      level: result.level,
      direction: result.direction,
      enableDept: Boolean(result.enableDept),
      enableProject: Boolean(result.enableProject),
      enableForeign: Boolean(result.enableForeign),
      foreignCurrency: result.foreignCurrency || '',
      isCustomer: Boolean(result.isCustomer),
      isSupplier: Boolean(result.isSupplier),
      isEmployee: Boolean(result.isEmployee),
      enableCashFlow: Boolean(result.enableCashFlow),
      disabled: result.enabled === 0,
      block: result.frozen === 1,
      subjectType: result.type,
      description: result.description,
      balance: result.balance || 0,
      createTime: result.createTime,
      updateTime: result.updateTime,
      accountSetId: result.accountSetId
    }));

    // 自动修复：确保 1122（应收账款）有 isCustomer=true
    // 2202（应付账款）有 isSupplier=true
    // 这是为了确保即使数据库中的值不正确，应用也能正常工作
    // 同时修复 1122 的 parentId 和 level（应该是一级科目）
    const fixedSubjects = subjects.map(subject => {
      if (subject.code === '1122') {
        const needsFix = !subject.isCustomer || subject.parentId !== null || subject.level !== 1;
        if (needsFix) {
          console.log('Auto-fix: Fixing subject 1122 (应收账款)', {
            isCustomer: subject.isCustomer,
            parentId: subject.parentId,
            level: subject.level
          });
        }
        return {
          ...subject,
          isCustomer: true,
          enableDept: true,
          enableProject: true,
          parentId: null,
          level: 1
        };
      }
      if (subject.code === '2202') {
        if (!subject.isSupplier) {
          console.log('Auto-fix: Force setting isSupplier=true for subject 2202 (应付账款)');
        }
        return { ...subject, isSupplier: true };
      }
      return subject;
    });

    // 检查是否需要更新数据库
    const needsDbUpdate = fixedSubjects.some((s, i) => {
      const orig = subjects[i];
      return (s.code === '1122' && (s.isCustomer !== orig.isCustomer || s.parentId !== orig.parentId || s.level !== orig.level)) ||
             (s.code === '2202' && s.isSupplier !== orig.isSupplier);
    });

    if (needsDbUpdate) {
      // 异步保存到数据库（不等待）
      this.saveSubjects(fixedSubjects.filter(s => s.code === '1122' || s.code === '2202'))
        .catch(err => console.warn('Failed to save subject fixes:', err));
    }

    return fixedSubjects;
  }

  async getSubjectByCode(code: string): Promise<Subject | undefined> {
    await this.ensureInitialized();
    const result = await this.querySingleAsync<any>(
      `SELECT * FROM subjects WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );

    if (!result) return undefined;

    // Map database result to Subject type
    return {
      id: result.id,
      code: result.code,
      name: result.name,
      parentId: result.parentId,
      level: result.level,
      direction: result.direction,
      enableDept: Boolean(result.enableDept),
      enableProject: Boolean(result.enableProject),
      enableForeign: Boolean(result.enableForeign),
      foreignCurrency: result.foreignCurrency || '',
      isCustomer: Boolean(result.isCustomer),
      isSupplier: Boolean(result.isSupplier),
      isEmployee: Boolean(result.isEmployee),
      enableCashFlow: Boolean(result.enableCashFlow),
      disabled: result.enabled === 0,
      block: result.frozen === 1,
      subjectType: result.type,
      accountSetId: result.accountSetId
    };
  }

  async hasVoucherForSubject(subjectIdOrCode: string): Promise<boolean> {
    await this.ensureInitialized();
    const result = await this.querySingleAsync<any>(
      `SELECT COUNT(*) as count FROM entries WHERE accountSetId = ? AND (subjectCode = ? OR subjectCode = (SELECT code FROM subjects WHERE accountSetId = ? AND id = ?))`,
      [this.accountSetId, subjectIdOrCode, this.accountSetId, subjectIdOrCode]
    );
    return (result?.count || 0) > 0;
  }

  // 迁移科目凭证数据到新科目
  async migrateSubjectVouchers(oldSubjectCode: string, newSubjectCode: string): Promise<number> {
    await this.ensureInitialized();
    const stmt = this.dbInstance.prepare(
      `UPDATE entries SET subjectCode = ? WHERE accountSetId = ? AND subjectCode = ?`
    );
    stmt.run([newSubjectCode, this.accountSetId, oldSubjectCode]);
    const changes = this.dbInstance.getRowsModified();
    stmt.free();
    await this.persist();
    return changes;
  }

  // 迁移：为 bankTransactions 添加 source 列和 ourAccount 索引
  private async migrateBankTransactionsSourceColumn(): Promise<void> {
    try {
      const columns = this.dbInstance.exec("PRAGMA table_info(bankTransactions)");
      if (columns.length > 0) {
        const columnNames = columns[0].values?.map((row: any[]) => row[1]) || [];
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
      // 创建 users 表
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

      // 创建 user_roles 表
      this.dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS user_roles (
          userId TEXT NOT NULL,
          roleId TEXT NOT NULL,
          PRIMARY KEY (userId, roleId)
        )
      `);

      // 创建 account_set_users 表
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
      const userStmt = this.dbInstance.prepare(
        `INSERT OR IGNORE INTO users (id, username, passwordHash, displayName, status, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      userStmt.run(['user_admin', 'admin', defaultPasswordHash, '管理员', 'active', now, now]);
      userStmt.free();

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

  async getCashOverview(ourAccount: string, periodStart: string, periodEnd: string): Promise<{
    openingBalance: number;
    totalCredit: number;
    totalDebit: number;
    closingBalance: number;
    lastBankBalance: number | null;
  }> {
    await this.ensureInitialized();

    const accountFilter = ourAccount ? `AND ourAccount = ?` : '';
    const openingParams = ourAccount
      ? [this.accountSetId, ourAccount, periodStart]
      : [this.accountSetId, periodStart];

    // 期初余额 = 期初之前的所有收入 - 所有支出
    const openingResult = await this.querySingleAsync<any>(
      `SELECT COALESCE(SUM(credit), 0) as totalCredit,
              COALESCE(SUM(debit), 0) as totalDebit
       FROM bankTransactions
       WHERE accountSetId = ? ${accountFilter} AND date < ?`,
      openingParams
    );

    // 本月收支
    const periodParams = ourAccount
      ? [this.accountSetId, ourAccount, periodStart, periodEnd]
      : [this.accountSetId, periodStart, periodEnd];
    const periodResult = await this.querySingleAsync<any>(
      `SELECT COALESCE(SUM(credit), 0) as totalCredit,
              COALESCE(SUM(debit), 0) as totalDebit
       FROM bankTransactions
       WHERE accountSetId = ? ${accountFilter} AND date >= ? AND date <= ?`,
      periodParams
    );

    // 银行报告的最后余额
    const lastBalanceResult = await this.querySingleAsync<any>(
      `SELECT balance FROM bankTransactions
       WHERE accountSetId = ? ${accountFilter} AND date >= ? AND date <= ? AND balance IS NOT NULL
       ORDER BY date DESC, id DESC LIMIT 1`,
      periodParams
    );

    const openingCredit = openingResult?.totalCredit || 0;
    const openingDebit = openingResult?.totalDebit || 0;
    const openingBalance = Math.round((openingCredit - openingDebit) * 100) / 100;
    const totalCredit = periodResult?.totalCredit || 0;
    const totalDebit = periodResult?.totalDebit || 0;
    const closingBalance = Math.round((openingBalance + totalCredit - totalDebit) * 100) / 100;

    return {
      openingBalance,
      totalCredit,
      totalDebit,
      closingBalance,
      lastBankBalance: lastBalanceResult?.balance ?? null
    };
  }

  // 获取日记账明细（ourAccount为空时显示所有记录）
  async getJournalEntries(ourAccount: string, periodStart: string, periodEnd: string, options?: {
    statusFilter?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ entries: any[]; total: number }> {
    await this.ensureInitialized();

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const params: any[] = [this.accountSetId, periodStart, periodEnd];
    let whereClause = `WHERE accountSetId = ? AND date >= ? AND date <= ?`;

    if (ourAccount) {
      whereClause += ` AND ourAccount = ?`;
      params.push(ourAccount);
    }

    if (options?.statusFilter) {
      whereClause += ` AND status = ?`;
      params.push(options.statusFilter);
    }

    const countResult = await this.querySingleAsync<any>(
      `SELECT COUNT(*) as total FROM bankTransactions ${whereClause}`,
      params
    );

    const entries = await this.queryAllAsync<any>(
      `SELECT * FROM bankTransactions ${whereClause} ORDER BY date ASC, id ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return {
      entries: entries || [],
      total: countResult?.total || 0
    };
  }

  async getTransactionStatusCounts(ourAccount: string, periodStart: string, periodEnd: string): Promise<Record<string, number>> {
    await this.ensureInitialized();
    const params: any[] = [this.accountSetId, periodStart, periodEnd];
    let whereClause = `WHERE accountSetId = ? AND date >= ? AND date <= ?`;
    if (ourAccount) {
      whereClause += ` AND ourAccount = ?`;
      params.push(ourAccount);
    }
    const rows = await this.queryAllAsync<any>(
      `SELECT status, COUNT(*) as count FROM bankTransactions ${whereClause} GROUP BY status`,
      params
    );
    const counts: Record<string, number> = { pending: 0, matched: 0, voucher_generated: 0 };
    for (const row of rows) {
      counts[row.status] = row.count;
    }
    return counts;
  }

  // ========== 部门操作 ==========

  async saveDepartments(departments: Department[]): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      for (const dept of departments) {
        const deptWithAccountSet = { ...dept, accountSetId: this.accountSetId } as any;
        const stmt = this.dbInstance.prepare(`
          INSERT OR REPLACE INTO departments (
            id, code, name, parentId, level, enabled, description,
            accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          deptWithAccountSet.id,
          deptWithAccountSet.code,
          deptWithAccountSet.name,
          deptWithAccountSet.parentId,
          deptWithAccountSet.level || 1,
          deptWithAccountSet.enabled !== undefined ? Number(deptWithAccountSet.enabled) : 1,
          deptWithAccountSet.description || '',
          deptWithAccountSet.accountSetId,
          deptWithAccountSet.createTime || now,
          deptWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
    } catch (error) {
      console.error('Save departments failed:', error);
      throw error;
    }
  }

  async getAllDepartments(): Promise<Department[]> {
    await this.ensureInitialized();
    return await this.queryAllAsync<Department>(
      `SELECT * FROM departments WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );
  }

  async getDepartmentByCode(code: string): Promise<Department | undefined> {
    await this.ensureInitialized();
    return await this.querySingleAsync<Department>(
      `SELECT * FROM departments WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  // ========== 项目操作 ==========

  async saveProjects(projects: Project[]): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      for (const project of projects) {
        const projectWithAccountSet = { ...project, accountSetId: this.accountSetId } as any;
        const stmt = this.dbInstance.prepare(`
          INSERT OR REPLACE INTO projects (
            id, code, name, description, enabled, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          projectWithAccountSet.id,
          projectWithAccountSet.code,
          projectWithAccountSet.name,
          projectWithAccountSet.description || '',
          projectWithAccountSet.frozen !== undefined ? Number(!projectWithAccountSet.frozen) : 1,
          projectWithAccountSet.accountSetId,
          projectWithAccountSet.createTime || now,
          projectWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
    } catch (error) {
      console.error('Save projects failed:', error);
      throw error;
    }
  }

  async getAllProjects(): Promise<Project[]> {
    await this.ensureInitialized();
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM projects WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );

    return results.map(result => ({
      id: result.id,
      code: result.code,
      name: result.name,
      description: result.description,
      type: 'income' as Project['type'], // Default value
      parentId: null, // Default value
      level: 1, // Default value
      startDate: '', // Default value
      endDate: '', // Default value
      frozen: result.enabled === 0, // Map enabled to frozen
      createTime: result.createTime,
      updateTime: result.updateTime,
      accountSetId: result.accountSetId
    }));
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    await this.ensureInitialized();
    return await this.querySingleAsync<Project>(
      `SELECT * FROM projects WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  // ========== 币别操作 ==========

  async saveCurrencies(currencies: Currency[]): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      for (const currency of currencies) {
        const currencyWithAccountSet = { ...currency, accountSetId: this.accountSetId } as any;
        const stmt = this.dbInstance.prepare(`
          INSERT OR REPLACE INTO currencies (
            id, code, name, symbol, exchangeRate, enabled, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          currencyWithAccountSet.id,
          currencyWithAccountSet.code,
          currencyWithAccountSet.name,
          currencyWithAccountSet.symbol,
          currencyWithAccountSet.exchangeRate || 1.0,
          currencyWithAccountSet.enabled !== undefined ? Number(currencyWithAccountSet.enabled) : 1,
          currencyWithAccountSet.accountSetId,
          currencyWithAccountSet.createTime || now,
          currencyWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
    } catch (error) {
      console.error('Save currencies failed:', error);
      throw error;
    }
  }

  async getAllCurrencies(): Promise<Currency[]> {
    await this.ensureInitialized();
    return await this.queryAllAsync<Currency>(
      `SELECT * FROM currencies WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );
  }

  async getCurrencyByCode(code: string): Promise<Currency | undefined> {
    await this.ensureInitialized();
    return await this.querySingleAsync<Currency>(
      `SELECT * FROM currencies WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  // ========== 往来单位操作 ==========

  async getAccountSetBaseCurrency(accountSetId: string = this.accountSetId): Promise<{ baseCurrency: string; baseCurrencyName: string } | null> {
    await this.ensureInitialized();
    const result = await this.querySingleAsync<any>(
      `SELECT baseCurrency, baseCurrencyName FROM accountSets WHERE id = ? LIMIT 1`,
      [accountSetId]
    );
    if (!result) return null;
    return {
      baseCurrency: result.baseCurrency || 'CNY',
      baseCurrencyName: result.baseCurrencyName || '人民币',
    };
  }

  async saveAccountSetBaseCurrency(baseCurrency: string, baseCurrencyName?: string, accountSetId: string = this.accountSetId): Promise<void> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    const stmt = this.dbInstance.prepare(`
      UPDATE accountSets
      SET baseCurrency = ?, baseCurrencyName = COALESCE(?, baseCurrencyName), updateTime = ?
      WHERE id = ?
    `);
    stmt.run([baseCurrency || 'CNY', baseCurrencyName || null, now, accountSetId]);
    stmt.free();
    await this.persist();
  }

  async saveFxRates(rates: FxRate[]): Promise<void> {
    await this.ensureInitialized();
    for (const rate of rates) {
      const stmt = this.dbInstance.prepare(`
        INSERT OR REPLACE INTO fxRates
          (id, accountSetId, rateDate, currencyCode, baseCurrency, middleRate, source, createdBy, createTime, updateTime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        rate.id,
        rate.accountSetId || this.accountSetId,
        rate.rateDate,
        rate.currencyCode,
        rate.baseCurrency || 'CNY',
        rate.middleRate,
        rate.source || null,
        rate.createdBy || null,
        rate.createTime || new Date().toISOString(),
        rate.updateTime || new Date().toISOString(),
      ]);
      stmt.free();
    }
    await this.persist();
  }

  async getFxRates(rateDate?: string): Promise<FxRate[]> {
    await this.ensureInitialized();
    const sql = rateDate
      ? `SELECT * FROM fxRates WHERE accountSetId = ? AND rateDate = ? ORDER BY currencyCode`
      : `SELECT * FROM fxRates WHERE accountSetId = ? ORDER BY rateDate DESC, currencyCode`;
    const params = rateDate ? [this.accountSetId, rateDate] : [this.accountSetId];
    const rows = await this.queryAllAsync<any>(sql, params);
    return rows.map((row) => ({
      id: row.id,
      accountSetId: row.accountSetId,
      rateDate: row.rateDate,
      currencyCode: row.currencyCode,
      baseCurrency: row.baseCurrency || 'CNY',
      middleRate: row.middleRate,
      source: row.source || undefined,
      createdBy: row.createdBy || undefined,
      createTime: row.createTime,
      updateTime: row.updateTime,
    }));
  }

  // ========== FX 重估运行操作 ==========

  async saveFxRevaluationRun(run: FxRevaluationRun): Promise<void> {
    await this.ensureInitialized();
    const stmt = this.dbInstance.prepare(`
      INSERT OR REPLACE INTO fxRevaluationRuns
        (id, accountSetId, period, baseCurrency, status, previewData, voucherId, voucherNo, createdAt, confirmedAt, createTime, updateTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      run.id,
      run.accountSetId || this.accountSetId,
      run.period,
      run.baseCurrency,
      run.status,
      run.previewData || null,
      run.voucherId || null,
      run.voucherNo || null,
      run.createdAt,
      run.confirmedAt || null,
      run.createTime || new Date().toISOString(),
      run.updateTime || new Date().toISOString(),
    ]);
    stmt.free();
    await this.persist();
  }

  async getFxRevaluationRuns(period?: string): Promise<FxRevaluationRun[]> {
    await this.ensureInitialized();
    const sql = period
      ? `SELECT * FROM fxRevaluationRuns WHERE accountSetId = ? AND period = ? ORDER BY createdAt DESC`
      : `SELECT * FROM fxRevaluationRuns WHERE accountSetId = ? ORDER BY createdAt DESC`;
    const params = period ? [this.accountSetId, period] : [this.accountSetId];
    return this.queryAllAsync<FxRevaluationRun>(sql, params);
  }

  async getFxRevaluationRun(id: string): Promise<FxRevaluationRun | null> {
    await this.ensureInitialized();
    return this.querySingleAsync<FxRevaluationRun>(
      `SELECT * FROM fxRevaluationRuns WHERE id = ? AND accountSetId = ?`,
      [id, this.accountSetId]
    );
  }

  async deleteFxRevaluationRun(id: string): Promise<void> {
    await this.ensureInitialized();
    this.dbInstance.prepare(`DELETE FROM fxRevaluationRunLines WHERE runId = ?`).run([id]).free();
    this.dbInstance.prepare(`DELETE FROM fxRevaluationRuns WHERE id = ? AND accountSetId = ?`).run([id, this.accountSetId]).free();
    await this.persist();
  }

  async saveFxRevaluationRunLines(lines: FxRevaluationRunLine[]): Promise<void> {
    await this.ensureInitialized();
    for (const line of lines) {
      const stmt = this.dbInstance.prepare(`
        INSERT OR REPLACE INTO fxRevaluationRunLines
          (id, runId, accountSetId, sourceType, sourceId, sourceName, currencyCode,
           originalAmount, originalRate, revaluationRate, bookValueBase, revaluedBase,
           gainLossAmount, gainLossDirection, subjectCode, subjectName, createTime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        line.id, line.runId, line.accountSetId || this.accountSetId,
        line.sourceType, line.sourceId, line.sourceName || null, line.currencyCode,
        line.originalAmount, line.originalRate, line.revaluationRate,
        line.bookValueBase, line.revaluedBase, line.gainLossAmount,
        line.gainLossDirection, line.subjectCode || null, line.subjectName || null,
        line.createTime || new Date().toISOString(),
      ]);
      stmt.free();
    }
    await this.persist();
  }

  async getFxRevaluationRunLines(runId: string): Promise<FxRevaluationRunLine[]> {
    await this.ensureInitialized();
    return this.queryAllAsync<FxRevaluationRunLine>(
      `SELECT * FROM fxRevaluationRunLines WHERE runId = ? AND accountSetId = ?`,
      [runId, this.accountSetId]
    );
  }

  async savePartners(partners: Partner[]): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      for (const partner of partners) {
        const partnerWithAccountSet = { ...partner, accountSetId: this.accountSetId } as any;

        // Convert booleans to type string for DB
        let typeValue = 'other';
        if (partnerWithAccountSet.isCustomer && !partnerWithAccountSet.isSupplier && !partnerWithAccountSet.isEmployee) {
          typeValue = 'customer';
        } else if (!partnerWithAccountSet.isCustomer && partnerWithAccountSet.isSupplier && !partnerWithAccountSet.isEmployee) {
          typeValue = 'supplier';
        } else if (!partnerWithAccountSet.isCustomer && !partnerWithAccountSet.isSupplier && partnerWithAccountSet.isEmployee) {
          typeValue = 'employee';
        } else if (partnerWithAccountSet.isCustomer && partnerWithAccountSet.isSupplier) {
          typeValue = 'both';
        }

        const stmt = this.dbInstance.prepare(`
          INSERT OR REPLACE INTO partners (
            id, code, name, type, contact, phone, email, address, taxNo,
            bankAccount, enabled, defaultSubjectCode, defaultSubjectName, departmentCode, departmentName,
            paymentTermDays, payrollSalaryExpenseSubjectCode, payrollSalaryExpenseSubjectName,
            payrollContributionExpenseSubjectCode, payrollContributionExpenseSubjectName,
            payrollSalaryPayableSubjectCode, payrollSalaryPayableSubjectName,
            payrollTaxPayableSubjectCode, payrollTaxPayableSubjectName,
            payrollEmployeeContributionPayableSubjectCode, payrollEmployeeContributionPayableSubjectName,
            payrollEmployerContributionPayableSubjectCode, payrollEmployerContributionPayableSubjectName,
            payrollDepartmentName, payrollProjectName, payrollCostCenterName,
            accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          partnerWithAccountSet.id,
          partnerWithAccountSet.code,
          partnerWithAccountSet.name,
          typeValue,
          partnerWithAccountSet.contact || '',
          partnerWithAccountSet.phone || '',
          partnerWithAccountSet.email || '',
          partnerWithAccountSet.address || '',
          partnerWithAccountSet.taxNumber || partnerWithAccountSet.taxNo || '',
          partnerWithAccountSet.bankAccount || '',
          partnerWithAccountSet.frozen !== undefined ? Number(!partnerWithAccountSet.frozen) : 1,
          partnerWithAccountSet.defaultSubjectCode || '',
          partnerWithAccountSet.defaultSubjectName || '',
          partnerWithAccountSet.departmentCode || '',
          partnerWithAccountSet.departmentName || '',
          partnerWithAccountSet.paymentTermDays || null,
          partnerWithAccountSet.payrollSalaryExpenseSubjectCode || '',
          partnerWithAccountSet.payrollSalaryExpenseSubjectName || '',
          partnerWithAccountSet.payrollContributionExpenseSubjectCode || '',
          partnerWithAccountSet.payrollContributionExpenseSubjectName || '',
          partnerWithAccountSet.payrollSalaryPayableSubjectCode || '',
          partnerWithAccountSet.payrollSalaryPayableSubjectName || '',
          partnerWithAccountSet.payrollTaxPayableSubjectCode || '',
          partnerWithAccountSet.payrollTaxPayableSubjectName || '',
          partnerWithAccountSet.payrollEmployeeContributionPayableSubjectCode || '',
          partnerWithAccountSet.payrollEmployeeContributionPayableSubjectName || '',
          partnerWithAccountSet.payrollEmployerContributionPayableSubjectCode || '',
          partnerWithAccountSet.payrollEmployerContributionPayableSubjectName || '',
          partnerWithAccountSet.payrollDepartmentName || '',
          partnerWithAccountSet.payrollProjectName || '',
          partnerWithAccountSet.payrollCostCenterName || '',
          partnerWithAccountSet.accountSetId,
          partnerWithAccountSet.createTime || now,
          partnerWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
      await this.persist();
    } catch (error) {
      console.error('Save partners failed:', error);
      throw error;
    }
  }

  async getAllPartners(): Promise<Partner[]> {
    await this.ensureInitialized();
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM partners WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );

    return results.map(result => {
      // Convert type string to booleans for Type
      const isCustomer = result.type === 'customer' || result.type === 'both';
      const isSupplier = result.type === 'supplier' || result.type === 'both';
      const isEmployee = result.type === 'employee';

      return {
        id: result.id,
        code: result.code,
        name: result.name,
        isCustomer,
        isSupplier,
        isEmployee,
        contact: result.contact,
        phone: result.phone,
        email: result.email,
        address: result.address,
        taxNumber: result.taxNo,
        bankAccount: result.bankAccount,
        defaultSubjectCode: result.defaultSubjectCode || undefined,
        defaultSubjectName: result.defaultSubjectName || undefined,
        departmentCode: result.departmentCode || undefined,
        departmentName: result.departmentName || undefined,
        paymentTermDays: result.paymentTermDays !== null && result.paymentTermDays !== undefined ? Number(result.paymentTermDays) : undefined,
        payrollSalaryExpenseSubjectCode: result.payrollSalaryExpenseSubjectCode || undefined,
        payrollSalaryExpenseSubjectName: result.payrollSalaryExpenseSubjectName || undefined,
        payrollContributionExpenseSubjectCode: result.payrollContributionExpenseSubjectCode || undefined,
        payrollContributionExpenseSubjectName: result.payrollContributionExpenseSubjectName || undefined,
        payrollSalaryPayableSubjectCode: result.payrollSalaryPayableSubjectCode || undefined,
        payrollSalaryPayableSubjectName: result.payrollSalaryPayableSubjectName || undefined,
        payrollTaxPayableSubjectCode: result.payrollTaxPayableSubjectCode || undefined,
        payrollTaxPayableSubjectName: result.payrollTaxPayableSubjectName || undefined,
        payrollEmployeeContributionPayableSubjectCode: result.payrollEmployeeContributionPayableSubjectCode || undefined,
        payrollEmployeeContributionPayableSubjectName: result.payrollEmployeeContributionPayableSubjectName || undefined,
        payrollEmployerContributionPayableSubjectCode: result.payrollEmployerContributionPayableSubjectCode || undefined,
        payrollEmployerContributionPayableSubjectName: result.payrollEmployerContributionPayableSubjectName || undefined,
        payrollDepartmentName: result.payrollDepartmentName || undefined,
        payrollProjectName: result.payrollProjectName || undefined,
        payrollCostCenterName: result.payrollCostCenterName || undefined,
        frozen: result.enabled === 0,
        createTime: result.createTime,
        updateTime: result.updateTime,
        accountSetId: result.accountSetId
      };
    });
  }

  async getPartnerByCode(code: string): Promise<Partner | undefined> {
    await this.ensureInitialized();
    return await this.querySingleAsync<Partner>(
      `SELECT * FROM partners WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  async getPartnerByName(name: string): Promise<Partner | undefined> {
    await this.ensureInitialized();
    return await this.querySingleAsync<Partner>(
      `SELECT * FROM partners WHERE accountSetId = ? AND name = ?`,
      [this.accountSetId, name]
    );
  }

  async addPartner(partner: { id: string; name: string; code: string; type: string; isSupplier?: boolean; isCustomer?: boolean; contact?: string; phone?: string; email?: string; address?: string; taxNo?: string; bankAccount?: string; departmentCode?: string; departmentName?: string; paymentTermDays?: number; payrollSalaryExpenseSubjectCode?: string; payrollSalaryExpenseSubjectName?: string; payrollContributionExpenseSubjectCode?: string; payrollContributionExpenseSubjectName?: string; payrollSalaryPayableSubjectCode?: string; payrollSalaryPayableSubjectName?: string; payrollTaxPayableSubjectCode?: string; payrollTaxPayableSubjectName?: string; payrollEmployeeContributionPayableSubjectCode?: string; payrollEmployeeContributionPayableSubjectName?: string; payrollEmployerContributionPayableSubjectCode?: string; payrollEmployerContributionPayableSubjectName?: string; payrollDepartmentName?: string; payrollProjectName?: string; payrollCostCenterName?: string; remark?: string; accountSetId?: string; createTime?: string; updateTime?: string }): Promise<void> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    const accountSetId = partner.accountSetId || this.accountSetId;
    let typeValue = partner.type;
    if (!typeValue) {
      if (partner.isSupplier && partner.isCustomer) typeValue = 'both';
      else if (partner.isSupplier) typeValue = 'supplier';
      else if (partner.isCustomer) typeValue = 'customer';
      else typeValue = 'other';
    }
    const stmt = this.dbInstance.prepare(
      `INSERT OR REPLACE INTO partners (
         id, code, name, type, contact, phone, email, address, taxNo, bankAccount, enabled,
         departmentCode, departmentName, paymentTermDays,
         payrollSalaryExpenseSubjectCode, payrollSalaryExpenseSubjectName,
         payrollContributionExpenseSubjectCode, payrollContributionExpenseSubjectName,
         payrollSalaryPayableSubjectCode, payrollSalaryPayableSubjectName,
         payrollTaxPayableSubjectCode, payrollTaxPayableSubjectName,
         payrollEmployeeContributionPayableSubjectCode, payrollEmployeeContributionPayableSubjectName,
         payrollEmployerContributionPayableSubjectCode, payrollEmployerContributionPayableSubjectName,
         payrollDepartmentName, payrollProjectName, payrollCostCenterName,
         accountSetId, createTime, updateTime
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      partner.id, partner.code, partner.name, typeValue,
      partner.contact || '', partner.phone || '', partner.email || '', partner.address || '',
      partner.taxNo || '', partner.bankAccount || '', 1,
      partner.departmentCode || '', partner.departmentName || '', partner.paymentTermDays || null,
      partner.payrollSalaryExpenseSubjectCode || '', partner.payrollSalaryExpenseSubjectName || '',
      partner.payrollContributionExpenseSubjectCode || '', partner.payrollContributionExpenseSubjectName || '',
      partner.payrollSalaryPayableSubjectCode || '', partner.payrollSalaryPayableSubjectName || '',
      partner.payrollTaxPayableSubjectCode || '', partner.payrollTaxPayableSubjectName || '',
      partner.payrollEmployeeContributionPayableSubjectCode || '', partner.payrollEmployeeContributionPayableSubjectName || '',
      partner.payrollEmployerContributionPayableSubjectCode || '', partner.payrollEmployerContributionPayableSubjectName || '',
      partner.payrollDepartmentName || '', partner.payrollProjectName || '', partner.payrollCostCenterName || '',
      accountSetId,
      partner.createTime || now, partner.updateTime || now
    ]);
    stmt.free();
    await this.persist();
  }

  // ========== 凭证模板操作 ==========

  async saveVoucherTemplates(templates: VoucherTemplate[]): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      for (const template of templates) {
        const templateWithAccountSet = { ...template, accountSetId: this.accountSetId } as any;
        const stmt = this.dbInstance.prepare(`
          INSERT OR REPLACE INTO voucherTemplates (
            id, name, description, entries, validations, variables,
            isSystem, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          templateWithAccountSet.id,
          templateWithAccountSet.name,
          templateWithAccountSet.description || '',
          JSON.stringify(templateWithAccountSet.entries || []),
          JSON.stringify(templateWithAccountSet.validations || []),
          JSON.stringify(templateWithAccountSet.variables || []),
          templateWithAccountSet.isSystem !== undefined ? Number(templateWithAccountSet.isSystem) : 0,
          templateWithAccountSet.accountSetId,
          templateWithAccountSet.createTime || now,
          templateWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
    } catch (error) {
      console.error('Save voucher templates failed:', error);
      throw error;
    }
  }

  async getAllVoucherTemplates(): Promise<VoucherTemplate[]> {
    await this.ensureInitialized();
    const templates = await this.queryAllAsync<any>(
      `SELECT * FROM voucherTemplates WHERE accountSetId = ?`,
      [this.accountSetId]
    );
    return templates.map((template: any) => ({
      ...template,
      entries: template.entries ? JSON.parse(template.entries) : [],
      validations: template.validations ? JSON.parse(template.validations) : [],
      variables: template.variables ? JSON.parse(template.variables) : [],
      isSystem: Boolean(template.isSystem)
    }));
  }

  async getVoucherTemplateById(id: string): Promise<VoucherTemplate | undefined> {
    await this.ensureInitialized();
    const template = await this.querySingleAsync<any>(
      `SELECT * FROM voucherTemplates WHERE id = ? AND accountSetId = ?`,
      [id, this.accountSetId]
    );
    if (!template) return undefined;
    return {
      ...template,
      entries: template.entries ? JSON.parse(template.entries) : [],
      validations: template.validations ? JSON.parse(template.validations) : [],
      variables: template.variables ? JSON.parse(template.variables) : [],
      isSystem: Boolean(template.isSystem)
    };
  }

  // ========== 常用摘要操作 ==========

  async saveCommonSummaries(summaries: CommonSummary[]): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      for (const summary of summaries) {
        const summaryWithAccountSet = { ...summary, accountSetId: this.accountSetId } as any;
        const stmt = this.dbInstance.prepare(`
          INSERT OR REPLACE INTO commonSummaries (
            id, content, frequency, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          summaryWithAccountSet.id,
          summaryWithAccountSet.text || summaryWithAccountSet.content || '',
          summaryWithAccountSet.sortOrder || summaryWithAccountSet.frequency || 0,
          summaryWithAccountSet.accountSetId,
          summaryWithAccountSet.createTime || now,
          summaryWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
    } catch (error) {
      console.error('Save common summaries failed:', error);
      throw error;
    }
  }

  async getAllCommonSummaries(): Promise<CommonSummary[]> {
    await this.ensureInitialized();
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM commonSummaries WHERE accountSetId = ? ORDER BY frequency DESC`,
      [this.accountSetId]
    );

    return results.map(result => ({
      id: result.id,
      text: result.content, // Map DB content to type text
      sortOrder: result.frequency, // Map DB frequency to type sortOrder
      createTime: result.createTime,
      updateTime: result.updateTime,
      accountSetId: result.accountSetId
    }));
  }

  // ========== 用户偏好操作 ==========

  async savePreference(preference: UserPreference): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      const prefWithAccountSet = { ...preference, accountSetId: this.accountSetId } as any;
      const stmt = this.dbInstance.prepare(`
        INSERT OR REPLACE INTO userPreferences (
          id, userId, type, key, value, accountSetId, createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        prefWithAccountSet.id,
        prefWithAccountSet.userId || 'current-user',
        prefWithAccountSet.type,
        prefWithAccountSet.key,
        JSON.stringify(prefWithAccountSet.value),
        prefWithAccountSet.accountSetId,
        prefWithAccountSet.createTime || now,
        prefWithAccountSet.updateTime || now
      ]);
      stmt.free();
    } catch (error) {
      console.error('Save preference failed:', error);
      throw error;
    }
  }

  async getPreferencesByUser(userId: string): Promise<UserPreference[]> {
    await this.ensureInitialized();
    const prefs = await this.queryAllAsync<any>(
      `SELECT * FROM userPreferences WHERE accountSetId = ? AND userId = ?`,
      [this.accountSetId, userId]
    );
    return prefs.map((pref: any) => ({
      ...pref,
      value: pref.value ? JSON.parse(pref.value) : null
    }));
  }

  // ========== 审计日志操作 ==========

  async addAuditLog(log: AuditLog): Promise<void> {
    try {
      await this.ensureInitialized();
      const logWithAccountSet = { ...log, accountSetId: this.accountSetId };
      const stmt = this.dbInstance.prepare(`
        INSERT INTO auditLogs (
          id, type, entityType, entityId, details, userId, timestamp, accountSetId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        logWithAccountSet.id,
        logWithAccountSet.type,
        logWithAccountSet.entityType,
        logWithAccountSet.entityId,
        JSON.stringify(logWithAccountSet.details),
        logWithAccountSet.userId,
        logWithAccountSet.timestamp,
        logWithAccountSet.accountSetId
      ]);
      stmt.free();
      await this.persist();
    } catch (error) {
      console.error('Add audit log failed:', error);
      throw error;
    }
  }

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    await this.ensureInitialized();
    const logs = await this.queryAllAsync<any>(
      `SELECT * FROM auditLogs WHERE accountSetId = ? ORDER BY timestamp DESC LIMIT ?`,
      [this.accountSetId, limit]
    );
    return logs.map((log: any) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : {}
    }));
  }

  // ========== 数据导出/导入 ==========

  async exportData() {
    await this.ensureInitialized();
    const db = this.dbInstance;
    const data: any = {};

    // 导出 vouchers
    const vouchers = await this.queryAllAsync<any>(`SELECT * FROM vouchers WHERE accountSetId = ?`, [this._accountSetId]);
    data.vouchers = vouchers;

    // 导出 entries
    const entries = await this.queryAllAsync<any>(`SELECT * FROM entries WHERE accountSetId = ?`, [this._accountSetId]);
    data.entries = entries;

    // 导出其他表
    data.subjects = await this.queryAllAsync<any>(`SELECT * FROM subjects WHERE accountSetId = ?`, [this._accountSetId]);
    data.departments = await this.queryAllAsync<any>(`SELECT * FROM departments WHERE accountSetId = ?`, [this._accountSetId]);
    data.projects = await this.queryAllAsync<any>(`SELECT * FROM projects WHERE accountSetId = ?`, [this._accountSetId]);
    data.currencies = await this.queryAllAsync<any>(`SELECT * FROM currencies WHERE accountSetId = ?`, [this._accountSetId]);
    data.fxRates = await this.queryAllAsync<any>(`SELECT * FROM fxRates WHERE accountSetId = ?`, [this._accountSetId]);
    data.partners = await this.queryAllAsync<any>(`SELECT * FROM partners WHERE accountSetId = ?`, [this._accountSetId]);
    data.voucherTemplates = await this.queryAllAsync<any>(`SELECT * FROM voucherTemplates WHERE accountSetId = ?`, [this._accountSetId]);
    data.commonSummaries = await this.queryAllAsync<any>(`SELECT * FROM commonSummaries WHERE accountSetId = ?`, [this._accountSetId]);
    data.userPreferences = await this.queryAllAsync<any>(`SELECT * FROM userPreferences WHERE accountSetId = ?`, [this._accountSetId]);
    data.auditLogs = await this.queryAllAsync<any>(`SELECT * FROM auditLogs WHERE accountSetId = ?`, [this._accountSetId]);
    data.recRelations = await this.queryAllAsync<any>(`SELECT * FROM recRelations WHERE accountSetId = ?`, [this._accountSetId]);
    data.fxRevaluationRuns = await this.queryAllAsync<any>(`SELECT * FROM fxRevaluationRuns WHERE accountSetId = ?`, [this._accountSetId]);
    data.fxRevaluationRunLines = await this.queryAllAsync<any>(`SELECT * FROM fxRevaluationRunLines WHERE accountSetId = ?`, [this._accountSetId]);

    return data;
  }

  async importData(data: any) {
    await this.ensureInitialized();
    const db = this.dbInstance;

    // 清空当前账套的旧数据
    await this.clearAllData();

    // 导入 vouchers
    if (data.vouchers && Array.isArray(data.vouchers)) {
      for (const voucher of data.vouchers) {
        if (voucher.accountSetId === this._accountSetId) {
          await this.saveVoucher(voucher);
        }
      }
    }

    // 导入其他表数据
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
      const db = this.dbInstance;
      for (const run of data.fxRevaluationRuns.filter((s: any) => s.accountSetId === this._accountSetId)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO fxRevaluationRuns (
            id, accountSetId, period, baseCurrency, status, scope, revaluationDate,
            createdBy, notes, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          run.id,
          run.accountSetId || this._accountSetId,
          run.period,
          run.baseCurrency || 'CNY',
          run.status,
          run.scope,
          run.revaluationDate,
          run.createdBy || null,
          run.notes || null,
          run.createTime || new Date().toISOString(),
          run.updateTime || new Date().toISOString(),
        ]);
        stmt.free();
      }
    }
    if (data.fxRevaluationRunLines && Array.isArray(data.fxRevaluationRunLines)) {
      const db = this.dbInstance;
      for (const line of data.fxRevaluationRunLines.filter((s: any) => s.accountSetId === this._accountSetId)) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO fxRevaluationRunLines (
            id, runId, accountSetId, sourceType, sourceId, sourceNo, currencyCode,
            baseCurrency, originalAmount, originalRate, revaluedAmount, gainLossAmount,
            rateDate, createTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          line.id,
          line.runId,
          line.accountSetId || this._accountSetId,
          line.sourceType,
          line.sourceId,
          line.sourceNo || null,
          line.currencyCode,
          line.baseCurrency || 'CNY',
          line.originalAmount,
          line.originalRate ?? null,
          line.revaluedAmount,
          line.gainLossAmount,
          line.rateDate || null,
          line.createTime || new Date().toISOString(),
        ]);
        stmt.free();
      }
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
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      for (const relation of relations) {
        const relationWithAccountSet = { ...relation, accountSetId: this.accountSetId };
        const stmt = this.dbInstance.prepare(`
          INSERT OR REPLACE INTO recRelations (
            id, recRefNo, debitEntryId, creditEntryId, amount, recDate,
            partnerName, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          relationWithAccountSet.id,
          relationWithAccountSet.recRefNo || '',
          relationWithAccountSet.debitEntryId,
          relationWithAccountSet.creditEntryId,
          relationWithAccountSet.amount || 0,
          relationWithAccountSet.recDate || new Date().toISOString().split('T')[0],
          relationWithAccountSet.partnerName || '',
          relationWithAccountSet.accountSetId,
          relationWithAccountSet.createTime || now,
          relationWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
    } catch (error) {
      console.error('Save rec relations failed:', error);
      throw error;
    }
  }

  async saveRecRelation(relation: any): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      const relationWithAccountSet = { ...relation, accountSetId: this.accountSetId };
      const stmt = this.dbInstance.prepare(`
        INSERT OR REPLACE INTO recRelations (
          id, recRefNo, debitEntryId, creditEntryId, amount, recDate,
          partnerName, accountSetId, createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        relationWithAccountSet.id,
        relationWithAccountSet.recRefNo || '',
        relationWithAccountSet.debitEntryId,
        relationWithAccountSet.creditEntryId,
        relationWithAccountSet.amount || 0,
        relationWithAccountSet.recDate || new Date().toISOString().split('T')[0],
        relationWithAccountSet.partnerName || '',
        relationWithAccountSet.accountSetId,
        relationWithAccountSet.createTime || now,
        relationWithAccountSet.updateTime || now
      ]);
      stmt.free();
    } catch (error) {
      console.error('Save rec relation failed:', error);
      throw error;
    }
  }

  async getRecRelations(): Promise<any[]> {
    await this.ensureInitialized();
    return await this.queryAllAsync<any>(
      `SELECT * FROM recRelations WHERE accountSetId = ?`,
      [this.accountSetId]
    );
  }

  async updateEntryRecRefNo(entryId: string, recRefNo: string): Promise<void> {
    try {
      await this.ensureInitialized();
      const stmt = this.dbInstance.prepare(
        `UPDATE entries SET recRefNo = ? WHERE id = ? AND accountSetId = ?`
      );
      stmt.run([recRefNo, entryId, this.accountSetId]);
      stmt.free();
    } catch (error) {
      console.error('Update entry recRefNo failed:', error);
      throw error;
    }
  }

  async getRecRelationsByRecRefNo(recRefNo: string): Promise<any[]> {
    await this.ensureInitialized();
    return await this.queryAllAsync<any>(
      `SELECT * FROM recRelations WHERE recRefNo = ? AND accountSetId = ?`,
      [recRefNo, this.accountSetId]
    );
  }

  async getRecRelationsByEntryId(entryId: string): Promise<any[]> {
    await this.ensureInitialized();
    const debitRelations = await this.queryAllAsync<any>(
      `SELECT * FROM recRelations WHERE debitEntryId = ? AND accountSetId = ?`,
      [entryId, this.accountSetId]
    );
    const creditRelations = await this.queryAllAsync<any>(
      `SELECT * FROM recRelations WHERE creditEntryId = ? AND accountSetId = ?`,
      [entryId, this.accountSetId]
    );
    return [...debitRelations, ...creditRelations];
  }

  async getOutstandingItems(query: any): Promise<any[]> {
    console.log('getOutstandingItems called with query:', query);

    if (!query.partnerName) {
      return [];
    }

    await this.ensureInitialized();
    const allEntries = await this.queryAllAsync<any>(
      `SELECT * FROM entries WHERE accountSetId = ?`,
      [this.accountSetId]
    );

    console.log('All entries count:', allEntries.length);

    // Filter partner entries
    let partnerEntries = allEntries.filter((entry: any) => {
      const matches =
        entry.customerName === query.partnerName ||
        entry.supplierName === query.partnerName ||
        (entry.auxiliary?.customer === query.partnerName) ||
        (entry.auxiliary?.supplier === query.partnerName);
      return matches;
    });

    console.log('Partner entries after filter:', partnerEntries.length);

    // Subject code filter
    if (query.subjectCode) {
      partnerEntries = partnerEntries.filter((entry: any) =>
        entry.subjectCode === query.subjectCode
      );
    }

    // Date range filter
    if (query.startDate && query.endDate) {
      partnerEntries = partnerEntries.filter((entry: any) =>
        entry.date >= query.startDate && entry.date <= query.endDate
      );
    }

    const outstandingItems: any[] = [];

    for (const entry of partnerEntries) {
      console.log('Processing entry:', entry.id, entry.summary);

      const relations = await this.getRecRelationsByEntryId(entry.id);
      console.log('Rec relations for entry:', entry.id, relations);

      const totalRecAmount = relations.reduce((sum: number, rel: any) => {
        return sum + rel.amount;
      }, 0);

      console.log('Total rec amount:', totalRecAmount);

      const entryAmount = entry.debit > 0 ? entry.debit : entry.credit;
      const remainingAmount = entryAmount - totalRecAmount;

      console.log('Entry amount:', entryAmount, 'Remaining:', remainingAmount);

      if (remainingAmount > 0.001) { // Consider floating point errors
        if (query.amountRange) {
          if (remainingAmount < query.amountRange[0] || remainingAmount > query.amountRange[1]) {
            continue;
          }
        }

        const item = {
          entryId: entry.id,
          voucherNo: entry.voucherNo || '未知凭证',
          docNo: entry.docNo || '',
          date: entry.date,
          summary: entry.summary,
          amount: entryAmount,
          remainingAmount: remainingAmount,
          direction: entry.debit > 0 ? 'debit' as const : 'credit' as const,
          partnerName: entry.customerName || entry.supplierName || query.partnerName
        };

        console.log('Adding outstanding item:', item);
        outstandingItems.push(item);
      }
    }

    console.log('Final outstanding items:', outstandingItems);
    return outstandingItems;
  }

  async calculatePartnerBalance(partnerName: string): Promise<number> {
    await this.ensureInitialized();
    const outstandingItems = await this.getOutstandingItems({
      partnerName,
      subjectCode: '',
      startDate: '',
      endDate: '',
      amountRange: [0, Infinity]
    });

    const debitSum = outstandingItems
      .filter(item => item.direction === 'debit')
      .reduce((sum: number, item: any) => sum + item.remainingAmount, 0);

    const creditSum = outstandingItems
      .filter(item => item.direction === 'credit')
      .reduce((sum: number, item: any) => sum + item.remainingAmount, 0);

    return debitSum - creditSum;
  }

  // ========== 数据完整性检查 ==========

  async checkDataIntegrity() {
    await this.ensureInitialized();
    const counts: any = {};
    counts.vouchers = (await this.queryAllAsync<any>(`SELECT * FROM vouchers WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.entries = (await this.queryAllAsync<any>(`SELECT * FROM entries WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.subjects = (await this.queryAllAsync<any>(`SELECT * FROM subjects WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.departments = (await this.queryAllAsync<any>(`SELECT * FROM departments WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.projects = (await this.queryAllAsync<any>(`SELECT * FROM projects WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.currencies = (await this.queryAllAsync<any>(`SELECT * FROM currencies WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.partners = (await this.queryAllAsync<any>(`SELECT * FROM partners WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.voucherTemplates = (await this.queryAllAsync<any>(`SELECT * FROM voucherTemplates WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.commonSummaries = (await this.queryAllAsync<any>(`SELECT * FROM commonSummaries WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.userPreferences = (await this.queryAllAsync<any>(`SELECT * FROM userPreferences WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.auditLogs = (await this.queryAllAsync<any>(`SELECT * FROM auditLogs WHERE accountSetId = ?`, [this.accountSetId])).length;
    counts.recRelations = (await this.queryAllAsync<any>(`SELECT * FROM recRelations WHERE accountSetId = ?`, [this.accountSetId])).length;

    console.log('Data integrity check:', counts);
    return counts;
  }

  // ========== 清空数据 ==========

  async clearAllData() {
    try {
      await this.ensureInitialized();
      // Clear vouchers and entries
      const deleteEntriesStmt = this.dbInstance.prepare(`DELETE FROM entries WHERE accountSetId = ?`);
      deleteEntriesStmt.run([this.accountSetId]);
      deleteEntriesStmt.free();

      const deleteVouchersStmt = this.dbInstance.prepare(`DELETE FROM vouchers WHERE accountSetId = ?`);
      deleteVouchersStmt.run([this.accountSetId]);
      deleteVouchersStmt.free();

      // Clear other tables
      const tables = ['subjects', 'departments', 'projects', 'currencies', 'fxRates',
                     'fxRevaluationRuns', 'fxRevaluationRunLines', 'partners',
                     'voucherTemplates', 'commonSummaries', 'userPreferences',
                     'auditLogs', 'recRelations', 'bankTransactions', 'bank_account_bindings'];

      for (const table of tables) {
        const stmt = this.dbInstance.prepare(`DELETE FROM ${table} WHERE accountSetId = ?`);
        stmt.run([this.accountSetId]);
        stmt.free();
      }
    } catch (error) {
      console.error('Clear all data failed:', error);
      throw error;
    }
  }

  // ========== 银行流水操作 ==========

  async saveBankTransaction(transaction: any): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();
      const txWithAccountSet = { ...transaction, accountSetId: this.accountSetId };

      const stmt = this.dbInstance.prepare(`
        INSERT OR REPLACE INTO bankTransactions (
          id, date, transactionTime, voucherType, voucherNo, debit, credit, balance,
          cashRemitFlag, counterpartyName, counterpartyAccount, summary, notes,
          transactionSerialNo, enterpriseSerialNo, ourAccount, ourAccountName, ourBranch,
          rowNumber, status, matchedSubject, matchedSubjectName, confidence,
          bankAccountId, importBatchId, voucherId, generatedVoucherNo,
          exchangeRate, originalAmount,
          source,
          accountSetId, createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        txWithAccountSet.id,
        txWithAccountSet.date || '',
        txWithAccountSet.transactionTime || '',
        txWithAccountSet.voucherType || '',
        txWithAccountSet.voucherNo || '',
        txWithAccountSet.debit || 0,
        txWithAccountSet.credit || 0,
        txWithAccountSet.balance || 0,
        txWithAccountSet.cashRemitFlag || '',
        txWithAccountSet.counterpartyName || '',
        txWithAccountSet.counterpartyAccount || '',
        txWithAccountSet.summary || '',
        txWithAccountSet.notes || '',
        txWithAccountSet.transactionSerialNo || '',
        txWithAccountSet.enterpriseSerialNo || '',
        txWithAccountSet.ourAccount || '',
        txWithAccountSet.ourAccountName || '',
        txWithAccountSet.ourBranch || '',
        txWithAccountSet.rowNumber || 0,
        txWithAccountSet.status || 'pending',
        txWithAccountSet.matchedSubject || '',
        txWithAccountSet.matchedSubjectName || '',
        txWithAccountSet.confidence || 0,
        txWithAccountSet.bankAccountId || '',
        txWithAccountSet.importBatchId || '',
        txWithAccountSet.voucherId || '',
        txWithAccountSet.generatedVoucherNo || '',
        txWithAccountSet.exchangeRate || null,
        txWithAccountSet.originalAmount || null,
        txWithAccountSet.source || 'import',
        txWithAccountSet.accountSetId,
        txWithAccountSet.createTime || now,
        txWithAccountSet.updateTime || now
      ]);
      stmt.free();
    } catch (error) {
      console.error('Save bank transaction failed:', error);
      throw error;
    }
  }

  async saveBankTransactions(transactions: any[]): Promise<void> {
    for (const tx of transactions) {
      await this.saveBankTransaction(tx);
    }
    await this.persist();
  }

  async getBankTransaction(id: string): Promise<any | undefined> {
    await this.ensureInitialized();
    return await this.querySingleAsync<any>(
      `SELECT * FROM bankTransactions WHERE id = ? AND accountSetId = ?`,
      [id, this.accountSetId]
    );
  }

  async getAllBankTransactions(): Promise<any[]> {
    await this.ensureInitialized();
    return await this.queryAllAsync<any>(
      `SELECT * FROM bankTransactions WHERE accountSetId = ? ORDER BY date DESC, rowNumber ASC`,
      [this.accountSetId]
    );
  }

  async getBankTransactionsByStatus(status: 'pending' | 'matched' | 'voucher_generated'): Promise<any[]> {
    await this.ensureInitialized();
    return await this.queryAllAsync<any>(
      `SELECT * FROM bankTransactions WHERE accountSetId = ? AND status = ? ORDER BY date DESC`,
      [this.accountSetId, status]
    );
  }

  async getBankTransactionsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    await this.ensureInitialized();
    return await this.queryAllAsync<any>(
      `SELECT * FROM bankTransactions WHERE accountSetId = ? AND date >= ? AND date <= ? ORDER BY date DESC`,
      [this.accountSetId, startDate, endDate]
    );
  }

  async getBankTransactionsByBatch(batchId: string): Promise<any[]> {
    await this.ensureInitialized();
    return await this.queryAllAsync<any>(
      `SELECT * FROM bankTransactions WHERE accountSetId = ? AND importBatchId = ? ORDER BY rowNumber ASC`,
      [this.accountSetId, batchId]
    );
  }

  async updateBankTransaction(id: string, updates: Partial<any>): Promise<void> {
    try {
      await this.ensureInitialized();
      const now = new Date().toISOString();

      // 构建动态更新语句
      const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), now, id, this.accountSetId];

      const stmt = this.dbInstance.prepare(
        `UPDATE bankTransactions SET ${updateFields}, updateTime = ? WHERE id = ? AND accountSetId = ?`
      );
      stmt.run(values);
      stmt.free();
      await this.persist();
    } catch (error) {
      console.error('Update bank transaction failed:', error);
      throw error;
    }
  }

  /** 检查流水是否已入账（按 date + voucherNo + transactionSerialNo 去重） */
  async findPostedBankTransaction(date: string, voucherNo: string, transactionSerialNo: string): Promise<any | null> {
    await this.ensureInitialized();
    const rows = await this.queryAllAsync<any>(
      `SELECT * FROM bankTransactions WHERE accountSetId = ? AND date = ? AND voucherNo = ? AND transactionSerialNo = ? AND status = 'voucher_generated' LIMIT 1`,
      [this.accountSetId, date, voucherNo, transactionSerialNo]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /** 检查流水是否已存在（导入去重，不论状态） */
  async existsBankTransaction(date: string, voucherNo: string, transactionSerialNo: string): Promise<boolean> {
    await this.ensureInitialized();
    const rows = await this.queryAllAsync<any>(
      `SELECT id FROM bankTransactions WHERE accountSetId = ? AND date = ? AND voucherNo = ? AND transactionSerialNo = ? LIMIT 1`,
      [this.accountSetId, date, voucherNo, transactionSerialNo]
    );
    return rows.length > 0;
  }

  async deleteBankTransaction(id: string): Promise<void> {
    try {
      await this.ensureInitialized();
      const stmt = this.dbInstance.prepare(`DELETE FROM bankTransactions WHERE id = ? AND accountSetId = ?`);
      stmt.run([id, this.accountSetId]);
      stmt.free();
    } catch (error) {
      console.error('Delete bank transaction failed:', error);
      throw error;
    }
  }

  async deleteBankTransactionsByBatch(batchId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      const stmt = this.dbInstance.prepare(`DELETE FROM bankTransactions WHERE importBatchId = ? AND accountSetId = ?`);
      stmt.run([batchId, this.accountSetId]);
      stmt.free();
    } catch (error) {
      console.error('Delete bank transactions by batch failed:', error);
      throw error;
    }
  }

  async clearBankTransactions(): Promise<void> {
    try {
      await this.ensureInitialized();
      const stmt = this.dbInstance.prepare(
        `DELETE FROM bankTransactions WHERE accountSetId = ? AND status != 'voucher_generated'`
      );
      stmt.run([this.accountSetId]);
      stmt.free();
      await this.persist();
    } catch (error) {
      console.error('Clear bank transactions failed:', error);
      throw error;
    }
  }

  // --- Bank Account Bindings ---
  async getBankAccountBindings(): Promise<any[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM bank_account_bindings WHERE accountSetId = ? ORDER BY createdAt DESC`,
      [this.accountSetId]
    );
    return (results || []).map(row => ({
      id: row.id, accountSetId: row.accountSetId, accountNumber: row.accountNumber, bankId: row.bankId,
      bankName: row.bankName, aliasName: row.aliasName, subSubjectCode: row.subSubjectCode, subSubjectName: row.subSubjectName,
      branch: row.branch, currency: row.currency, isDefault: !!row.isDefault, createdAt: row.createdAt,
    }));
  }

  async saveBankAccountBinding(binding: any): Promise<void> {
    await this.runAsync(
      `INSERT OR REPLACE INTO bank_account_bindings
       (id, accountSetId, accountNumber, bankId, bankName, aliasName, subSubjectCode, subSubjectName, branch, currency, isDefault, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [binding.id, binding.accountSetId, binding.accountNumber, binding.bankId, binding.bankName,
       binding.aliasName || null, binding.subSubjectCode, binding.subSubjectName,
       binding.branch || null, binding.currency || null, binding.isDefault ? 1 : 0, binding.createdAt]
    );
    await this.persist();
  }

  async deleteBankAccountBinding(id: string): Promise<void> {
    await this.runAsync(`DELETE FROM bank_account_bindings WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
    await this.persist();
  }

  async findBankAccountBinding(accountNumber: string): Promise<any | null> {
    const result = await this.querySingleAsync<any>(
      `SELECT * FROM bank_account_bindings WHERE accountNumber = ? AND accountSetId = ?`,
      [accountNumber, this.accountSetId]
    );
    if (!result) return null;
    return {
      id: result.id, accountSetId: result.accountSetId, accountNumber: result.accountNumber, bankId: result.bankId,
      bankName: result.bankName, aliasName: result.aliasName, subSubjectCode: result.subSubjectCode, subSubjectName: result.subSubjectName,
      branch: result.branch, currency: result.currency, isDefault: !!result.isDefault, createdAt: result.createdAt,
    };
  }

  // --- Custom Bank Configs ---
  async getCustomBankConfigs(): Promise<any[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM custom_bank_configs WHERE accountSetId = ? ORDER BY createdAt DESC`,
      [this.accountSetId]
    );
    return (results || []).map(row => ({
      id: row.id, accountSetId: row.accountSetId, name: row.name, config: JSON.parse(row.config),
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    }));
  }

  async saveCustomBankConfig(customConfig: any): Promise<void> {
    await this.runAsync(
      `INSERT OR REPLACE INTO custom_bank_configs (id, accountSetId, name, config, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customConfig.id, customConfig.accountSetId, customConfig.name,
       JSON.stringify(customConfig.config), customConfig.createdAt, customConfig.updatedAt]
    );
    await this.persist();
  }

  async deleteCustomBankConfig(id: string): Promise<void> {
    await this.runAsync(`DELETE FROM custom_bank_configs WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
    await this.persist();
  }

  // ========== 智能规则引擎操作 ==========

  // --- Smart Rules ---
  async getSmartRules(): Promise<InvoiceSmartRule[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM invoice_smart_rules WHERE accountSetId = ? ORDER BY priority DESC, name ASC`,
      [this.accountSetId]
    );
    return (results || []).map(row => {
      try { row.conditions = JSON.parse(row.conditions); } catch { row.conditions = []; }
      try { row.actions = JSON.parse(row.actions); } catch { row.actions = []; }
      row.enabled = !!row.enabled;
      return row as InvoiceSmartRule;
    });
  }

  async saveSmartRule(rule: InvoiceSmartRule): Promise<void> {
    const conditions = typeof rule.conditions === 'string' ? rule.conditions : JSON.stringify(rule.conditions || []);
    const actions = typeof rule.actions === 'string' ? rule.actions : JSON.stringify(rule.actions || []);
    await this.runAsync(
      `INSERT OR REPLACE INTO invoice_smart_rules
        (id, accountSetId, name, invoiceType, priority, conditions, actions, enabled, createTime, updateTime)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [rule.id, rule.accountSetId || this.accountSetId, rule.name, rule.invoiceType || 'both',
       rule.priority ?? 50, conditions, actions, rule.enabled !== false ? 1 : 0,
       rule.createTime || new Date().toISOString(), rule.updateTime || new Date().toISOString()]
    );
    await this.persist();
  }

  async deleteSmartRule(id: string): Promise<void> {
    await this.runAsync(`DELETE FROM invoice_smart_rules WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
    await this.persist();
  }

  // --- Supplier Subject Mapping ---
  async getSupplierMappings(): Promise<SupplierSubjectMapping[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM supplier_subject_mapping WHERE accountSetId = ? ORDER BY groupName, sellerName`,
      [this.accountSetId]
    );
    return (results || []) as SupplierSubjectMapping[];
  }

  async getSupplierMappingsByGroup(groupName: string): Promise<SupplierSubjectMapping[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM supplier_subject_mapping WHERE accountSetId = ? AND groupName = ? ORDER BY sellerName`,
      [this.accountSetId, groupName]
    );
    return (results || []) as SupplierSubjectMapping[];
  }

  async saveSupplierMapping(mapping: SupplierSubjectMapping): Promise<void> {
    const now = new Date().toISOString();
    await this.runAsync(
      `INSERT OR REPLACE INTO supplier_subject_mapping
        (id, accountSetId, groupName, sellerName,
         defaultDebitSubject, defaultDebitSubjectName,
         defaultTaxSubject, defaultTaxSubjectName,
         defaultCreditSubject, defaultCreditSubjectName,
         createTime, updateTime)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [mapping.id, mapping.accountSetId || this.accountSetId,
       mapping.groupName, mapping.sellerName,
       mapping.defaultDebitSubject || null, mapping.defaultDebitSubjectName || null,
       mapping.defaultTaxSubject || null, mapping.defaultTaxSubjectName || null,
       mapping.defaultCreditSubject || null, mapping.defaultCreditSubjectName || null,
       mapping.createTime || now, mapping.updateTime || now]
    );
    await this.persist();
  }

  async deleteSupplierMapping(id: string): Promise<void> {
    await this.runAsync(`DELETE FROM supplier_subject_mapping WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
    await this.persist();
  }

  async getSupplierMappingBySellerName(sellerName: string): Promise<SupplierSubjectMapping | null> {
    const result = await this.querySingleAsync<any>(
      `SELECT * FROM supplier_subject_mapping WHERE accountSetId = ? AND sellerName = ? LIMIT 1`,
      [this.accountSetId, sellerName]
    );
    return result as SupplierSubjectMapping | null;
  }

  // --- Purchase Invoice Rule Config ---
  async getPurchaseInvoiceRuleConfig(): Promise<PurchaseInvoiceRuleConfig> {
    const result = await this.querySingleAsync<any>(
      `SELECT * FROM purchase_invoice_rule_config WHERE accountSetId = ?`,
      [this.accountSetId]
    );
    if (result) {
      const parsedConfig = {
        id: result.id,
        accountSetId: result.accountSetId,
        businessGroups: JSON.parse(result.businessGroups),
        keywordRules: JSON.parse(result.keywordRules),
        globalSettings: JSON.parse(result.globalSettings),
        updateTime: result.updateTime,
      };
      return parsedConfig;
    }
    // 返回默认配置
    const defaultConfig: PurchaseInvoiceRuleConfig = {
      id: `pirc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      accountSetId: this.accountSetId,
      businessGroups: [
        { id: 'inventory', name: '库存商品', debitSubject: '1403.02 库存商品', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 100, assetThreshold: 5000, isPreset: true, autoTax: true, keywords: ['库存', '商品', '存货'], requirePartnerCard: true },
        { id: 'material', name: '生产材料', debitSubject: '1403.01 原材料', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 90, assetThreshold: 5000, isPreset: true, autoTax: true, keywords: ['材料', '原料', '配件'], requirePartnerCard: true },
        { id: 'reimbursement', name: '员工报销', debitSubject: '(匹配关键词)', taxSubject: '', creditSubject: '2241 其他应付款', partnerType: '员工', priority: 80, assetThreshold: 0, isPreset: true, autoTax: false, keywords: ['报销', '差旅', '办公'], requirePartnerCard: false },
        { id: 'fixed_asset', name: '固定资产', debitSubject: '1601 固定资产', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 70, assetThreshold: 5000, isPreset: true, autoTax: true, keywords: ['设备', '固定资产', '机器'], requirePartnerCard: true },
      ],
      keywordRules: [
        { id: '1', keywords: '电脑, 服务器', businessGroup: 'fixed_asset', threshold: 5000 },
        { id: '2', keywords: '滴滴, 打车', businessGroup: 'reimbursement', threshold: 0 },
      ],
      globalSettings: {
        assetThreshold: 5000,
        autoTaxSubject: true,
        autoCheckDuplicate: true,
        autoRecognizeReimburser: true,
      },
      updateTime: new Date().toISOString(),
    };
    await this.savePurchaseInvoiceRuleConfig(defaultConfig);
    return defaultConfig;
  }

  async savePurchaseInvoiceRuleConfig(config: PurchaseInvoiceRuleConfig): Promise<void> {
    const now = new Date().toISOString();
    const values = [
      config.id,
      config.accountSetId || this.accountSetId,
      JSON.stringify(config.businessGroups),
      JSON.stringify(config.keywordRules),
      JSON.stringify(config.globalSettings),
      config.updateTime || now,
    ];
    await this.runAsync(
      `INSERT OR REPLACE INTO purchase_invoice_rule_config
        (id, accountSetId, businessGroups, keywordRules, globalSettings, updateTime)
       VALUES (?,?,?,?,?,?)`,
      values
    );
    await this.persist();
  }

  // --- Expense Reimbursement ---
  async getExpenseReimbursements(): Promise<ExpenseReimbursement[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM expense_reimbursement WHERE accountSetId = ? ORDER BY createTime DESC`,
      [this.accountSetId]
    );
    return (results || []) as ExpenseReimbursement[];
  }

  async saveExpenseReimbursement(record: ExpenseReimbursement): Promise<void> {
    const now = new Date().toISOString();
    await this.runAsync(
      `INSERT OR REPLACE INTO expense_reimbursement
        (id, accountSetId, invoiceCode, reimburserName, reimburserId, notes, importBatchId, createTime, updateTime)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [record.id, record.accountSetId || this.accountSetId,
       record.invoiceCode, record.reimburserName,
       record.reimburserId || null, record.notes || null, record.importBatchId || null,
       record.createTime || now, record.updateTime || now]
    );
    await this.persist();
  }

  async updateExpenseReimbursement(id: string, updates: Partial<ExpenseReimbursement>): Promise<void> {
    const now = new Date().toISOString();
    const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), now, id, this.accountSetId];
    await this.runAsync(
      `UPDATE expense_reimbursement SET ${updateFields}, updateTime = ? WHERE id = ? AND accountSetId = ?`,
      values
    );
    await this.persist();
  }

  async deleteExpenseReimbursement(id: string): Promise<void> {
    await this.runAsync(`DELETE FROM expense_reimbursement WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
    await this.persist();
  }

  async clearExpenseReimbursements(): Promise<void> {
    await this.runAsync(`DELETE FROM expense_reimbursement WHERE accountSetId = ?`, [this.accountSetId]);
    await this.persist();
  }

  // --- Expense Keyword Categories ---
  async getExpenseKeywordCategories(): Promise<ExpenseKeywordCategory[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM expense_keyword_categories WHERE accountSetId = ? ORDER BY category`,
      [this.accountSetId]
    );
    return (results || []).map(row => {
      try { row.keywords = JSON.parse(row.keywords); } catch { row.keywords = []; }
      row.isSystem = !!row.isSystem;
      row.enabled = !!row.enabled;
      return row as ExpenseKeywordCategory;
    });
  }

  async saveExpenseKeywordCategory(cat: ExpenseKeywordCategory): Promise<void> {
    const keywords = typeof cat.keywords === 'string' ? cat.keywords : JSON.stringify(cat.keywords || []);
    const now = new Date().toISOString();
    await this.runAsync(
      `INSERT OR REPLACE INTO expense_keyword_categories
        (id, accountSetId, category, keywords, expenseSubjectCode, expenseSubjectName,
         isSystem, enabled, createTime, updateTime)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [cat.id, cat.accountSetId || this.accountSetId,
       cat.category, keywords,
       cat.expenseSubjectCode || null, cat.expenseSubjectName || null,
       cat.isSystem ? 1 : 0, cat.enabled !== false ? 1 : 0,
       cat.createTime || now, cat.updateTime || now]
    );
    await this.persist();
  }

  async deleteExpenseKeywordCategory(id: string): Promise<void> {
    await this.runAsync(`DELETE FROM expense_keyword_categories WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
    await this.persist();
  }

  // --- Auxiliary Strategy ---
  async getAuxiliaryStrategy(): Promise<AuxiliaryStrategyConfig | null> {
    const result = await this.querySingleAsync<any>(
      `SELECT * FROM auxiliary_strategy_config WHERE accountSetId = ? LIMIT 1`,
      [this.accountSetId]
    );
    if (!result) return null;
    result.autoCreatePartner = !!result.autoCreatePartner;
    result.autoDisableAuxiliaryOnSubAccount = !!result.autoDisableAuxiliaryOnSubAccount;
    return result as AuxiliaryStrategyConfig;
  }

  async saveAuxiliaryStrategy(config: AuxiliaryStrategyConfig): Promise<void> {
    await this.runAsync(
      `INSERT OR REPLACE INTO auxiliary_strategy_config
        (id, accountSetId, mode, autoCreatePartner, autoDisableAuxiliaryOnSubAccount, updateTime)
       VALUES (?,?,?,?,?,?)`,
      [config.id, config.accountSetId || this.accountSetId,
       config.mode || 'auxiliary',
       config.autoCreatePartner ? 1 : 0,
       config.autoDisableAuxiliaryOnSubAccount !== false ? 1 : 0,
       config.updateTime || new Date().toISOString()]
    );
    await this.persist();
  }

  // --- Asset Category Mapping ---
  async getAssetCategoryMappings(): Promise<AssetCategoryMapping[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM asset_category_mapping WHERE accountSetId = ? ORDER BY assetCategory`,
      [this.accountSetId]
    );
    return (results || []).map(row => {
      try { row.keywords = JSON.parse(row.keywords); } catch { row.keywords = []; }
      row.isSystem = !!row.isSystem;
      return row as AssetCategoryMapping;
    });
  }

  async saveAssetCategoryMapping(mapping: AssetCategoryMapping): Promise<void> {
    const keywords = typeof mapping.keywords === 'string' ? mapping.keywords : JSON.stringify(mapping.keywords || []);
    const now = new Date().toISOString();
    await this.runAsync(
      `INSERT OR REPLACE INTO asset_category_mapping
        (id, accountSetId, keywords, assetCategory, depreciationYears, depreciationMethod,
         subjectCode, residualRate, isSystem, createTime, updateTime)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [mapping.id, mapping.accountSetId || this.accountSetId,
       keywords, mapping.assetCategory, mapping.depreciationYears,
       mapping.depreciationMethod || 'straight_line',
       mapping.subjectCode, mapping.residualRate ?? 0.05,
       mapping.isSystem ? 1 : 0,
       mapping.createTime || now, mapping.updateTime || now]
    );
    await this.persist();
  }

  async deleteAssetCategoryMapping(id: string): Promise<void> {
    await this.runAsync(`DELETE FROM asset_category_mapping WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
    await this.persist();
  }

  // --- Invoice hold/category updates ---
  async updateInvoiceHoldStatus(id: string, holdStatus: 'normal' | 'on_hold'): Promise<void> {
    const now = new Date().toISOString();
    await this.runAsync(
      `UPDATE invoices SET holdStatus = ?, updateTime = ? WHERE id = ? AND accountSetId = ?`,
      [holdStatus, now, id, this.accountSetId]
    );
    await this.persist();
  }

  async updateInvoiceCategory(id: string, category: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.runAsync(
      `UPDATE invoices SET category = ?, updateTime = ? WHERE id = ? AND accountSetId = ?`,
      [category, now, id, this.accountSetId]
    );
    await this.persist();
  }

  // --- Payroll import and calculation ---
  async getPayrollBatches(period?: string): Promise<PayrollBatch[]> {
    const params = period ? [this.accountSetId, period] : [this.accountSetId];
    const sql = period
      ? `SELECT * FROM payroll_batches WHERE accountSetId = ? AND payrollPeriod = ? ORDER BY updatedAt DESC`
      : `SELECT * FROM payroll_batches WHERE accountSetId = ? ORDER BY payrollPeriod DESC, updatedAt DESC`;
    const results = await this.queryAllAsync<any>(sql, params);
    return results.map((row) => ({
      ...row,
      calculationConfigSnapshot: JSON.parse(row.calculationConfigSnapshot),
    })) as PayrollBatch[];
  }

  async getPayrollItems(batchId: string): Promise<PayrollItem[]> {
    const results = await this.queryAllAsync<any>(
      `SELECT * FROM payroll_items WHERE accountSetId = ? AND batchId = ? ORDER BY employeeCode`,
      [this.accountSetId, batchId],
    );
    return results.map((row) => ({
      ...row,
      inputData: JSON.parse(row.inputData),
      calculationResult: JSON.parse(row.calculationResult),
      validationMessages: JSON.parse(row.validationMessages),
    })) as PayrollItem[];
  }

  async savePayrollCalculationConfig(record: PayrollCalculationConfigRecord): Promise<void> {
    const individualTaxConfig = {
      ...record.config.individualTax,
      __taxRules: record.config.taxRules,
    };
    await this.runAsync(
      `INSERT OR REPLACE INTO payroll_calculation_configs
       (id, accountSetId, effectivePeriod, socialInsuranceConfig, housingFundConfig,
        individualTaxConfig, policyLabel, policyEffectiveDate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        this.accountSetId,
        record.effectivePeriod,
        JSON.stringify(record.config.socialInsurance),
        JSON.stringify(record.config.housingFund),
        JSON.stringify(individualTaxConfig),
        record.policyLabel,
        record.policyEffectiveDate,
        record.createdAt,
        record.updatedAt,
      ],
    );
    await this.persist();
  }

  async getPayrollCalculationConfig(period: string): Promise<PayrollCalculationConfigRecord | null> {
    const row = await this.querySingleAsync<any>(
      `SELECT * FROM payroll_calculation_configs
       WHERE accountSetId = ? AND effectivePeriod <= ?
       ORDER BY effectivePeriod DESC LIMIT 1`,
      [this.accountSetId, period],
    );
    if (!row) return null;
    const parsedIndividualTaxConfig = JSON.parse(row.individualTaxConfig) as Record<string, unknown>;
    const { __taxRules, ...individualTax } = parsedIndividualTaxConfig;
    return {
      id: row.id,
      accountSetId: row.accountSetId,
      effectivePeriod: row.effectivePeriod,
      config: {
        socialInsurance: JSON.parse(row.socialInsuranceConfig),
        housingFund: JSON.parse(row.housingFundConfig),
        individualTax: individualTax as unknown as PayrollCalculationConfigRecord['config']['individualTax'],
        taxRules: clonePayrollTaxRuleSet(__taxRules as Parameters<typeof clonePayrollTaxRuleSet>[0]),
      },
      policyLabel: row.policyLabel,
      policyEffectiveDate: row.policyEffectiveDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async savePayrollBatch(batch: PayrollBatch, items: PayrollItem[]): Promise<void> {
    await this.runAsync(
      `INSERT OR REPLACE INTO payroll_batches
       (id, accountSetId, payrollPeriod, batchName, status, sourceFileName, employeeCount,
        grossTotal, employerCostTotal, taxTotal, netTotal, calculationConfigSnapshot,
        createdAt, updatedAt, confirmedAt, accrualVoucherId, accrualVoucherNo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batch.id,
        this.accountSetId,
        batch.payrollPeriod,
        batch.batchName,
        batch.status,
        batch.sourceFileName || null,
        batch.employeeCount,
        batch.grossTotal,
        batch.employerCostTotal,
        batch.taxTotal,
        batch.netTotal,
        JSON.stringify(batch.calculationConfigSnapshot),
        batch.createdAt,
        batch.updatedAt,
        batch.confirmedAt || null,
        batch.accrualVoucherId || null,
        batch.accrualVoucherNo || null,
      ],
    );
    await this.runAsync(
      `DELETE FROM payroll_items WHERE batchId = ? AND accountSetId = ?`,
      [batch.id, this.accountSetId],
    );
    for (const item of items) {
      await this.runAsync(
        `INSERT INTO payroll_items
         (id, batchId, accountSetId, payrollPeriod, employeeCode, employeeName, departmentName,
          inputData, calculationResult, validationStatus, validationMessages, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          batch.id,
          this.accountSetId,
          batch.payrollPeriod,
          item.employeeCode,
          item.employeeName,
          item.departmentName || null,
          JSON.stringify(item.inputData),
          JSON.stringify(item.calculationResult),
          item.validationStatus,
          JSON.stringify(item.validationMessages),
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
    await this.persist();
  }

  async updatePayrollBatchStatus(batchId: string, status: PayrollBatch['status']): Promise<void> {
    const confirmedAt = status === 'confirmed' ? new Date().toISOString() : null;
    await this.runAsync(
      `UPDATE payroll_batches SET status = ?, confirmedAt = ?, updatedAt = ?
       WHERE id = ? AND accountSetId = ?`,
      [status, confirmedAt, new Date().toISOString(), batchId, this.accountSetId],
    );
    await this.persist();
  }

  async deletePayrollBatch(batchId: string): Promise<void> {
    const batch = await this.querySingleAsync<{ status: PayrollBatch['status'] }>(
      `SELECT status FROM payroll_batches WHERE id = ? AND accountSetId = ?`,
      [batchId, this.accountSetId],
    );
    if (batch?.status === 'confirmed') {
      throw new Error('已确认工资批次不能删除');
    }
    await this.runAsync(
      `DELETE FROM payroll_items WHERE batchId = ? AND accountSetId = ?`,
      [batchId, this.accountSetId],
    );
    await this.runAsync(
      `DELETE FROM payroll_batches WHERE id = ? AND accountSetId = ? AND status <> 'confirmed'`,
      [batchId, this.accountSetId],
    );
    await this.persist();
  }

  async updatePayrollBatchVoucher(batchId: string, voucherId: string, voucherNo: string): Promise<void> {
    await this.runAsync(
      `UPDATE payroll_batches
       SET accrualVoucherId = ?, accrualVoucherNo = ?, updatedAt = ?
       WHERE id = ? AND accountSetId = ?`,
      [voucherId, voucherNo, new Date().toISOString(), batchId, this.accountSetId],
    );
    await this.persist();
  }

  async clearPayrollBatchVoucherByVoucherId(voucherId: string): Promise<boolean> {
    const existing = await this.querySingleAsync<{ id: string }>(
      `SELECT id FROM payroll_batches WHERE accountSetId = ? AND accrualVoucherId = ? LIMIT 1`,
      [this.accountSetId, voucherId],
    );
    if (!existing) return false;

    await this.runAsync(
      `UPDATE payroll_batches
       SET accrualVoucherId = NULL, accrualVoucherNo = NULL, updatedAt = ?
       WHERE accountSetId = ? AND accrualVoucherId = ?`,
      [new Date().toISOString(), this.accountSetId, voucherId],
    );
    await this.persist();
    return true;
  }

  async getPayrollBatchByVoucherId(voucherId: string): Promise<PayrollBatch | null> {
    const row = await this.querySingleAsync<any>(
      `SELECT * FROM payroll_batches WHERE accountSetId = ? AND accrualVoucherId = ? LIMIT 1`,
      [this.accountSetId, voucherId],
    );
    if (!row) return null;
    return {
      id: row.id,
      accountSetId: row.accountSetId,
      payrollPeriod: row.payrollPeriod,
      batchName: row.batchName,
      status: row.status,
      sourceFileName: row.sourceFileName || undefined,
      employeeCount: row.employeeCount,
      grossTotal: row.grossTotal,
      employerCostTotal: row.employerCostTotal,
      taxTotal: row.taxTotal,
      netTotal: row.netTotal,
      calculationConfigSnapshot: JSON.parse(row.calculationConfigSnapshot),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      confirmedAt: row.confirmedAt || undefined,
      accrualVoucherId: row.accrualVoucherId || undefined,
      accrualVoucherNo: row.accrualVoucherNo || undefined,
    };
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
