/**
 * AccountSetDbManager - 账套管理器
 * 管理账套的创建、删除、重命名、数据导出/导入
 * 所有账套共享全局数据库，通过 accountSetId 字段隔离
 */

type SqlValue = string | number | Uint8Array | null;

import { sqliteService } from './sqlite-service';
import { buildPartnerInsert, type PartnerInsertInput } from './services/partner-sqlite-service';

export interface AccountSetInfo {
  id: string;
  code: string;
  name: string;
  baseCurrency: string;
  baseCurrencyName: string;
  description: string;
  createTime: string;
  updateTime: string;
}

class AccountSetDbManager {
  private static instance: AccountSetDbManager;

  private constructor() {}

  static getInstance(): AccountSetDbManager {
    if (!AccountSetDbManager.instance) {
      AccountSetDbManager.instance = new AccountSetDbManager();
    }
    return AccountSetDbManager.instance;
  }

  /**
   * 初始化（接口兼容，无需操作）
   */
  async init(): Promise<void> {}

  /**
   * 设置当前账套 ID
   */
  setCurrentAccountSet(accountSetId: string): void {
    sqliteService.setAccountSetId(accountSetId);
  }

  /**
   * 获取当前账套 ID
   */
  getCurrentAccountSetId(): string | null {
    return sqliteService.accountSetId || null;
  }

  /**
   * 创建账套（在全局数据库 accountSets 表插入记录）
   */
  async createAccountSet(
    accountSetId: string,
    name: string,
    code?: string,
    description?: string,
    baseCurrency = 'CNY',
    baseCurrencyName = '人民币'
  ): Promise<void> {
    const db = await sqliteService.getDatabase();
    const tenantId = sqliteService.tenantId;
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO accountSets (id, tenantId, code, name, baseCurrency, baseCurrencyName, description, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([accountSetId, tenantId, code || accountSetId, name, baseCurrency, baseCurrencyName, description || '', now, now]);
    stmt.free();
  }

  /**
   * 删除账套（删除该账套的所有数据）
   */
  async deleteAccountSet(accountSetId: string): Promise<void> {
    const db = await sqliteService.getDatabase();
    const tenantId = sqliteService.tenantId;

    db.run('BEGIN TRANSACTION');
    try {
    const tables = [
      'amortizationRecords',
      'depreciationRecords',
      'invoiceReconciliations',
      'invoices',
      'prepaidExpenses',
      'prepaidChangeRecords',
      'intangibleAssets',
      'intangibleChangeRecords',
      'fixedAssets',
      'assetCategories',
      'assetChangeRecords',
      'assetSplitRecords',
      'assetMergeRecords',
      'asset_category_mapping',
      'recRelations',
      'fxRates',
      'fxRevaluationRuns',
      'fxRevaluationRunLines',
      'auditLogs',
      'userPreferences',
      'commonSummaries',
      'voucherTemplates',
      'partners',
      'currencies',
      'projects',
      'departments',
      'entries',
      'vouchers',
      'subjects',
      'bankTransactions',
      'bankTransactionRules',
      'bank_opening_balances',
      'bank_account_bindings',
      'custom_bank_configs',
      'tax_items',
      'tax_filings',
      'invoice_smart_rules',
      'supplier_subject_mapping',
      'purchase_invoice_rule_config',
      'invoice_subject_rules',
      'expense_reimbursement',
      'expense_keyword_categories',
      'auxiliary_strategy_config',
      'payroll_batches',
      'payroll_items',
      'payroll_calculation_configs',
      'codeRules',
      'monthly_closing_checks',
    ];

    for (const table of tables) {
      try {
        const stmt = db.prepare(`DELETE FROM ${table} WHERE tenantId = ? AND accountSetId = ?`);
        stmt.run([tenantId, accountSetId]);
        stmt.free();
      } catch {
        // 表可能不存在，忽略
      }
    }

    const stmt = db.prepare(`DELETE FROM accountSets WHERE id = ?`);
    stmt.run([accountSetId]);
    stmt.free();

    db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * 重命名账套
   */
  async updateAccountSetName(accountSetId: string, newName: string): Promise<void> {
    const db = await sqliteService.getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`UPDATE accountSets SET name = ?, updateTime = ? WHERE id = ?`);
    stmt.run([newName, now, accountSetId]);
    stmt.free();
  }

  async updateAccountSetBaseCurrency(accountSetId: string, baseCurrency: string, baseCurrencyName?: string): Promise<void> {
    const db = await sqliteService.getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `UPDATE accountSets SET baseCurrency = ?, baseCurrencyName = COALESCE(?, baseCurrencyName), updateTime = ? WHERE id = ?`
    );
    stmt.run([baseCurrency || 'CNY', baseCurrencyName || null, now, accountSetId]);
    stmt.free();
  }

  /**
   * 获取所有账套信息
   */
  async getAllAccountSets(): Promise<AccountSetInfo[]> {
    const db = await sqliteService.getDatabase();
    const tenantId = sqliteService.tenantId;
    const stmt = db.prepare(`SELECT id, code, name, baseCurrency, baseCurrencyName, description, createTime, updateTime FROM accountSets WHERE tenantId = ? ORDER BY createTime`);
    stmt.bind([tenantId]);
    const rows: SqlValue[][] = [];
    while (stmt.step()) {
      rows.push(stmt.get());
    }
    stmt.free();
    if (rows.length === 0) return [];

    return rows.map((row) => ({
      id: String(row[0] ?? ''),
      code: String(row[1] ?? ''),
      name: String(row[2] ?? ''),
      baseCurrency: String(row[3] ?? 'CNY'),
      baseCurrencyName: String(row[4] ?? '人民币'),
      description: row[5] as string,
      createTime: String(row[6] ?? ''),
      updateTime: String(row[7] ?? ''),
    }));
  }

  /**
   * 获取账套信息
   */
  async getAccountSetInfo(accountSetId: string): Promise<AccountSetInfo | null> {
    const db = await sqliteService.getDatabase();
    const tenantId = sqliteService.tenantId;
    const stmt = db.prepare(`SELECT id, code, name, baseCurrency, baseCurrencyName, description, createTime, updateTime FROM accountSets WHERE tenantId = ? AND id = ?`);
    stmt.bind([tenantId, accountSetId]);
    const hasRow = stmt.step();
    if (!hasRow) {
      stmt.free();
      return null;
    }
    const row = stmt.get();
    stmt.free();
    return {
      id: row[0],
      code: row[1],
      name: row[2],
      baseCurrency: row[3] || 'CNY',
      baseCurrencyName: row[4] || '人民币',
      description: row[5],
      createTime: row[6],
      updateTime: row[7],
    };
  }

  /**
   * 导出账套数据（从全局数据库按 accountSetId 过滤）
   */
  async exportAccountSetData(accountSetId: string): Promise<Record<string, unknown>> {
    const db = await sqliteService.getDatabase();

    const queryTable = (tableName: string) => {
      try {
        const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE accountSetId = ?`);
        stmt.bind([accountSetId]);
        const rows: SqlValue[][] = [];
        while (stmt.step()) {
          const row = stmt.get();
          rows.push(row);
        }
        stmt.free();
        return rows;
      } catch {
        return [];
      }
    };

    const vouchers = queryTable('vouchers');
    const entries = queryTable('entries');
    const subjects = queryTable('subjects');
    const departments = queryTable('departments');
    const projects = queryTable('projects');
    const currencies = queryTable('currencies');
    const partners = queryTable('partners');
    const voucherTemplates = queryTable('voucherTemplates');
    const commonSummaries = queryTable('commonSummaries');
    const userPreferences = queryTable('userPreferences');
    const auditLogs = queryTable('auditLogs');
    const recRelations = queryTable('recRelations');
    const fxRates = queryTable('fxRates');
    const fxRevaluationRuns = queryTable('fxRevaluationRuns');
    const fxRevaluationRunLines = queryTable('fxRevaluationRunLines');
    const fixedAssets = queryTable('fixedAssets');
    const depreciationRecords = queryTable('depreciationRecords');
    const intangibleAssets = queryTable('intangibleAssets');
    const prepaidExpenses = queryTable('prepaidExpenses');
    const amortizationRecords = queryTable('amortizationRecords');
    const invoices = queryTable('invoices');
    const bankTransactions = queryTable('bankTransactions');

    return {
      accountSetId,
      vouchers,
      entries,
      subjects,
      departments,
      projects,
      currencies,
      partners,
      voucherTemplates,
      commonSummaries,
      userPreferences,
      auditLogs,
      recRelations,
      fxRates,
      fxRevaluationRuns,
      fxRevaluationRunLines,
      fixedAssets,
      depreciationRecords,
      intangibleAssets,
      prepaidExpenses,
      amortizationRecords,
      invoices,
      bankTransactions,
      exportDate: new Date().toISOString(),
      version: '4.0',
    };
  }

  /**
   * 导入数据到指定账套
   */
  async importAccountSetData(accountSetId: string, data: Record<string, unknown>): Promise<void> {
    const db = await sqliteService.getDatabase();

    try {
      // Import vouchers
      if (data.vouchers) {
        for (const voucher of data.vouchers as Record<string, unknown>[]) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO vouchers (
              id, voucherNo, date, status, summary, creator, reviewer, poster,
              reverseVoucherId, referenceNumber, attachmentCount, accountSetId,
              createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            voucher.id, voucher.voucherNo, voucher.date, voucher.status,
            voucher.summary, voucher.creator, voucher.reviewer, voucher.poster,
            voucher.reverseVoucherId, voucher.referenceNumber, voucher.attachmentCount || 0,
            accountSetId,
            voucher.createTime, voucher.updateTime
          ]);
          stmt.free();
        }
      }

      // Import entries
      if (data.entries) {
        for (const entry of data.entries as Record<string, unknown>[]) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO entries (
              id, voucherId, subjectCode, subjectName, direction, debit, credit,
              summary, customerName, supplierName, auxiliary, recRefNo,
              departmentCode, departmentName, projectCode, projectName,
              currencyCode, exchangeRate, originalAmount, date, accountSetId,
              createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            entry.id, entry.voucherId, entry.subjectCode, entry.subjectName,
            entry.direction, entry.debit, entry.credit, entry.summary,
            entry.customerName, entry.supplierName, entry.auxiliary, entry.recRefNo,
            entry.departmentCode, entry.departmentName, entry.projectCode, entry.projectName,
            entry.currencyCode, entry.currencyName || null, entry.exchangeRate, entry.originalAmount, entry.date,
            accountSetId,
            entry.createTime, entry.updateTime
          ]);
          stmt.free();
        }
      }

      // Import subjects
      if (data.subjects) {
        for (const subject of data.subjects as Record<string, unknown>[]) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO subjects (
              id, code, name, parentId, level, type, direction, balance,
              enabled, frozen, description, enableDept, enableProject, enableForeign,
              foreignCurrency, isCustomer, isSupplier, isEmployee, enableCashFlow,
              accountSetId, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            subject.id, subject.code, subject.name, subject.parentId, subject.level,
            subject.type, subject.direction, subject.balance,
            subject.enabled ? 1 : 0, subject.frozen ? 1 : 0, subject.description,
            subject.enableDept ? 1 : 0, subject.enableProject ? 1 : 0, subject.enableForeign ? 1 : 0,
            subject.foreignCurrency, subject.isCustomer ? 1 : 0, subject.isSupplier ? 1 : 0,
            subject.isEmployee ? 1 : 0, subject.enableCashFlow ? 1 : 0,
            accountSetId, subject.createTime, subject.updateTime
          ]);
          stmt.free();
        }
      }

      // Import simpler tables
      const simpleTables = [
        { name: 'departments', cols: 'id, code, name, parentId, level, enabled, description, accountSetId, createTime, updateTime' },
        { name: 'projects', cols: 'id, code, name, description, enabled, accountSetId, createTime, updateTime' },
        { name: 'currencies', cols: 'id, code, name, symbol, exchangeRate, enabled, accountSetId, createTime, updateTime' },
      ];

      for (const table of simpleTables) {
        const records = data[table.name];
        if (!records) continue;
        const placeholders = table.cols.split(', ').map(() => '?').join(', ');
        for (const record of records as Record<string, unknown>[]) {
          try {
            const stmt = db.prepare(
              `INSERT OR REPLACE INTO ${table.name} (${table.cols}) VALUES (${placeholders})`
            );
            const values = table.cols.split(', ').map(col => {
              if (col === 'accountSetId') return accountSetId;
              return record[col] ?? null;
            });
            stmt.run(values);
            stmt.free();
          } catch {
            // Skip records that fail
          }
        }
      }

      if (data.partners) {
        const now = new Date().toISOString();
        for (const partner of data.partners as Record<string, unknown>[]) {
          const insert = buildPartnerInsert(
            {
              ...partner,
              taxNo: (partner.taxNo ?? partner.taxNumber) as string | undefined,
              accountSetId,
            } as PartnerInsertInput,
            sqliteService.tenantId,
            accountSetId,
            now,
          );
          const stmt = db.prepare(insert.sql);
          try {
            stmt.run(insert.params);
          } finally {
            stmt.free();
          }
        }
      }

      if (data.fxRates) {
        for (const rate of data.fxRates as Record<string, unknown>[]) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO fxRates (
              id, accountSetId, rateDate, currencyCode, baseCurrency, middleRate, source, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            rate.id,
            rate.accountSetId || accountSetId,
            rate.rateDate,
            rate.currencyCode,
            rate.baseCurrency || 'CNY',
            rate.middleRate,
            rate.source || null,
            rate.createTime,
            rate.updateTime
          ]);
          stmt.free();
        }
      }

      if (data.fxRevaluationRuns) {
        for (const run of data.fxRevaluationRuns as Record<string, unknown>[]) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO fxRevaluationRuns (
              id, accountSetId, period, baseCurrency, status, scope, revaluationDate,
              createdBy, notes, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            run.id,
            run.accountSetId || accountSetId,
            run.period,
            run.baseCurrency || 'CNY',
            run.status,
            run.scope,
            run.revaluationDate,
            run.createdBy || null,
            run.notes || null,
            run.createTime,
            run.updateTime
          ]);
          stmt.free();
        }
      }

      if (data.fxRevaluationRunLines) {
        for (const line of data.fxRevaluationRunLines as Record<string, unknown>[]) {
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
            line.accountSetId || accountSetId,
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
            line.createTime
          ]);
          stmt.free();
        }
      }

      console.log(`Data imported to account set: ${accountSetId}`);
    } catch (error) {
      console.error('Import data failed:', error);
      throw error;
    }
  }

}

export const accountSetDbManager = AccountSetDbManager.getInstance();
