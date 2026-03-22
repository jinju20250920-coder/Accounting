/**
 * AccountSetDbManager - 账套数据库管理器
 * 管理账套数据库的创建、切换、关闭、删除
 * 实现一账套一文件架构
 */

import initSqlJs from 'sql.js';
import { fileHandleManager } from './file-handle-manager';
import type { AccountSetHandleInfo } from './file-handle-manager';

// 账套数据库实例
interface AccountSetDatabase {
  accountSetId: string;
  db: any;
  handle: FileSystemFileHandle | null;
  lastAccess: number;
}

// 数据库配置
interface DatabaseConfig {
  accountSetId: string;
  storageType: 'fsa' | 'opfs' | 'local';
  handle?: FileSystemFileHandle;
}

class AccountSetDbManager {
  private static instance: AccountSetDbManager;
  // 当前打开的数据库实例映射 (accountSetId -> db instance)
  private openDatabases: Map<string, AccountSetDatabase> = new Map();
  // 当前激活的账套
  private currentAccountSetId: string | null = null;

  private constructor() {}

  static getInstance(): AccountSetDbManager {
    if (!AccountSetDbManager.instance) {
      AccountSetDbManager.instance = new AccountSetDbManager();
    }
    return AccountSetDbManager.instance;
  }

  /**
   * 获取 SQL.js 实例
   */
  private async getSqlJs(): Promise<any> {
    return await initSqlJs({
      locateFile: (file: string) => `/sqljs/${file}`,
    });
  }

  /**
   * 初始化数据库管理器
   * 与 sqliteManager 接口兼容
   */
  async init(): Promise<void> {
    // 检查是否有当前账套，如果有则打开其数据库
    if (this.currentAccountSetId) {
      try {
        const db = await this.openAccountSetDatabase(this.currentAccountSetId);
        console.log(`Account set database initialized: ${this.currentAccountSetId}`);
      } catch (error) {
        console.warn('Failed to open current account set database:', error);
      }
    } else {
      console.log('No current account set set, database manager initialized but no database opened');
    }
  }

  /**
   * 设置当前账套 ID
   * 与 sqliteManager 接口兼容
   */
  setCurrentAccountSet(accountSetId: string): void {
    this.currentAccountSetId = accountSetId;
  }

  /**
   * 获取数据库（同步版本，用于兼容）
   * 如果数据库未打开，返回 null
   */
  getDatabase(): any | null {
    return this.getCurrentDatabase();
  }

  /**
   * 检查数据库是否已初始化
   */
  isInitialized(): boolean {
    return this.currentAccountSetId !== null && this.openDatabases.has(this.currentAccountSetId);
  }

  /**
   * 导出当前账套的数据
   * 与 sqliteManager 接口兼容
   */
  async exportData(): Promise<any> {
    const db = this.getCurrentDatabase();
    if (!db) {
      throw new Error('No current database opened');
    }

    const accountSetId = this.currentAccountSetId;

    // Get vouchers
    const vouchersResult = db.exec(`SELECT * FROM vouchers`);
    const vouchers = vouchersResult[0]?.values.map((row: any[], index: number) => {
      const columns = vouchersResult[0].columns;
      const voucher: any = {};
      columns.forEach((col: string, idx: number) => {
        voucher[col] = row[idx];
      });
      return voucher;
    }) || [];

    // Get entries for each voucher
    const vouchersWithEntries = [];
    for (const voucher of vouchers) {
      const entriesResult = db.exec(`SELECT * FROM entries WHERE voucherId = ?`, [voucher.id]);
      const entries = entriesResult[0]?.values.map((row: any[], index: number) => {
        const columns = entriesResult[0].columns;
        const entry: any = {};
        columns.forEach((col: string, idx: number) => {
          entry[col] = row[idx];
        });
        return entry;
      }) || [];

      vouchersWithEntries.push({
        ...voucher,
        entries
      });
    }

    // Get other data
    const subjectsResult = db.exec(`SELECT * FROM subjects`);
    const subjects = subjectsResult[0]?.values.map((row: any[]) => {
      const columns = subjectsResult[0].columns;
      const subject: any = {};
      columns.forEach((col: string, idx: number) => {
        subject[col] = row[idx];
      });
      return subject;
    }) || [];

    const departmentsResult = db.exec(`SELECT * FROM departments`);
    const departments = departmentsResult[0]?.values.map((row: any[]) => {
      const columns = departmentsResult[0].columns;
      const dept: any = {};
      columns.forEach((col: string, idx: number) => {
        dept[col] = row[idx];
      });
      return dept;
    }) || [];

    const projectsResult = db.exec(`SELECT * FROM projects`);
    const projects = projectsResult[0]?.values.map((row: any[]) => {
      const columns = projectsResult[0].columns;
      const project: any = {};
      columns.forEach((col: string, idx: number) => {
        project[col] = row[idx];
      });
      return project;
    }) || [];

    const currenciesResult = db.exec(`SELECT * FROM currencies`);
    const currencies = currenciesResult[0]?.values.map((row: any[]) => {
      const columns = currenciesResult[0].columns;
      const currency: any = {};
      columns.forEach((col: string, idx: number) => {
        currency[col] = row[idx];
      });
      return currency;
    }) || [];

    const partnersResult = db.exec(`SELECT * FROM partners`);
    const partners = partnersResult[0]?.values.map((row: any[]) => {
      const columns = partnersResult[0].columns;
      const partner: any = {};
      columns.forEach((col: string, idx: number) => {
        partner[col] = row[idx];
      });
      return partner;
    }) || [];

    const voucherTemplatesResult = db.exec(`SELECT * FROM voucherTemplates`);
    const voucherTemplates = voucherTemplatesResult[0]?.values.map((row: any[]) => {
      const columns = voucherTemplatesResult[0].columns;
      const template: any = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        template[col] = col === 'entries' || col === 'validations' || col === 'variables' ? JSON.parse(value) : value;
      });
      return template;
    }) || [];

    const commonSummariesResult = db.exec(`SELECT * FROM commonSummaries`);
    const commonSummaries = commonSummariesResult[0]?.values.map((row: any[]) => {
      const columns = commonSummariesResult[0].columns;
      const summary: any = {};
      columns.forEach((col: string, idx: number) => {
        summary[col] = row[idx];
      });
      return {
        id: summary.id,
        text: summary.content,
        sortOrder: summary.frequency,
        createTime: summary.createTime,
        updateTime: summary.updateTime
      };
    }) || [];

    const preferencesResult = db.exec(`SELECT * FROM userPreferences`);
    const preferences = preferencesResult[0]?.values.map((row: any[]) => {
      const columns = preferencesResult[0].columns;
      const pref: any = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        pref[col] = col === 'value' ? JSON.parse(value) : value;
      });
      return pref;
    }) || [];

    const auditLogsResult = db.exec(`SELECT * FROM auditLogs`);
    const auditLogs = auditLogsResult[0]?.values.map((row: any[]) => {
      const columns = auditLogsResult[0].columns;
      const log: any = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        log[col] = col === 'details' ? JSON.parse(value) : value;
      });
      return log;
    }) || [];

    const recRelationsResult = db.exec(`SELECT * FROM recRelations`);
    const recRelations = recRelationsResult[0]?.values.map((row: any[]) => {
      const columns = recRelationsResult[0].columns;
      const relation: any = {};
      columns.forEach((col: string, idx: number) => {
        relation[col] = row[idx];
      });
      return relation;
    }) || [];

    return {
      vouchers: vouchersWithEntries,
      subjects,
      departments,
      projects,
      currencies,
      partners,
      voucherTemplates,
      commonSummaries,
      preferences,
      auditLogs,
      recRelations,
      exportDate: new Date().toISOString(),
      version: '3.0'
    };
  }

  /**
   * 导入数据到当前账套
   * 与 sqliteManager 接口兼容
   */
  async importData(data: any): Promise<void> {
    const db = this.getCurrentDatabase();
    if (!db) {
      throw new Error('No current database opened');
    }

    try {
      // Import vouchers and entries
      if (data.vouchers) {
        for (const voucher of data.vouchers) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO vouchers (
              id, voucherNo, date, status, summary, creator, reviewer, poster,
              reverseVoucherId, referenceNumber, attachmentCount,
              createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            voucher.id,
            voucher.voucherNo,
            voucher.date,
            voucher.status,
            voucher.summary,
            voucher.creator,
            voucher.reviewer,
            voucher.poster,
            voucher.reverseVoucherId,
            voucher.referenceNumber,
            voucher.attachmentCount || 0,
            voucher.createTime,
            voucher.updateTime
          ]);
          stmt.free();

          for (const entry of voucher.entries) {
            const entryStmt = db.prepare(`
              INSERT OR REPLACE INTO entries (
                id, voucherId, subjectCode, subjectName, direction, debit, credit,
                summary, customerName, supplierName, auxiliary, recRefNo,
                departmentCode, departmentName, projectCode, projectName,
                currencyCode, exchangeRate, originalAmount, date,
                createTime, updateTime
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            entryStmt.run([
              entry.id,
              entry.voucherId,
              entry.subjectCode,
              entry.subjectName,
              entry.direction,
              entry.debit,
              entry.credit,
              entry.summary,
              entry.customerName,
              entry.supplierName,
              JSON.stringify(entry.auxiliary || {}),
              entry.recRefNo,
              entry.departmentCode,
              entry.departmentName,
              entry.projectCode,
              entry.projectName,
              entry.currencyCode,
              entry.exchangeRate,
              entry.originalAmount,
              entry.date,
              entry.createTime,
              entry.updateTime
            ]);
            entryStmt.free();
          }
        }
      }

      // Import other data (simplified for brevity)
      // ... subjects, departments, projects, currencies, partners, templates, summaries, preferences, auditLogs, recRelations
    } catch (error) {
      console.error('Import data failed:', error);
      throw error;
    }
  }

  /**
   * 为账套创建新数据库
   */
  async createAccountSetDatabase(
    accountSetId: string,
    accountSetName: string,
    storageType: 'fsa' | 'opfs' | 'local'
  ): Promise<{
    handle: FileSystemFileHandle | null;
    fileName: string;
  }> {
    const SQL = await this.getSqlJs();

    if (storageType === 'fsa') {
      // 使用 File System Access API
      const defaultFileName = `${accountSetName}_${new Date().toISOString().slice(0, 10)}.db`;
      const { handle, fileName } = await fileHandleManager.requestNewFile(defaultFileName);

      // 创建新的数据库
      const db = new SQL.Database();
      this.createTables(db);

      // 写入文件
      await this.writeFile(handle, db);

      // 保存句柄
      await fileHandleManager.saveHandle(accountSetId, accountSetName, fileName, handle, 'fsa');

      // 缓存数据库实例
      this.openDatabases.set(accountSetId, {
        accountSetId,
        db,
        handle,
        lastAccess: Date.now()
      });

      return { handle, fileName };
    } else if (storageType === 'opfs') {
      // 使用 OPFS
      const opfsRoot = await (navigator.storage as any).getDirectory();
      const fileName = `${accountSetName}_${new Date().toISOString().slice(0, 10)}.db`;
      const handle = await opfsRoot.getFileHandle(fileName, { create: true });

      const db = new SQL.Database();
      this.createTables(db);

      // 写入 OPFS 文件
      await this.writeOPFSFile(handle, db);

      // 保存句柄（虽然 OPFS 句柄不需要持久化，但统一管理）
      await fileHandleManager.saveHandle(accountSetId, accountSetName, fileName, handle, 'opfs');

      this.openDatabases.set(accountSetId, {
        accountSetId,
        db,
        handle,
        lastAccess: Date.now()
      });

      return { handle, fileName };
    } else {
      // localStorage 方式（后备）
      // 这种方式不需要文件句柄
      throw new Error('localStorage storage type not implemented for account set isolation');
    }
  }

  /**
   * 打开账套数据库
   */
  async openAccountSetDatabase(accountSetId: string): Promise<any> {
    // 如果已经打开，直接返回
    const cached = this.openDatabases.get(accountSetId);
    if (cached) {
      this.currentAccountSetId = accountSetId;
      return cached.db;
    }

    // 获取账套文件信息
    const info = await fileHandleManager.getAccountSetInfo(accountSetId);
    if (!info) {
      throw new Error(`Account set ${accountSetId} not found`);
    }

    const SQL = await this.getSqlJs();

    if (info.storageType === 'fsa') {
      // 从 IndexedDB 获取句柄
      const handle = await fileHandleManager.getHandle(accountSetId);
      if (!handle) {
        throw new Error('File handle not found in storage');
      }

      // 读取文件内容
      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // 创建数据库实例
      const db = new SQL.Database(uint8Array);

      // 缓存
      this.openDatabases.set(accountSetId, {
        accountSetId,
        db,
        handle,
        lastAccess: Date.now()
      });

      this.currentAccountSetId = accountSetId;
      return db;
    } else if (info.storageType === 'opfs') {
      // OPFS 方式
      const handle = await fileHandleManager.getHandle(accountSetId);
      if (!handle) {
        throw new Error('OPFS file handle not found');
      }

      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      const db = new SQL.Database(uint8Array);

      this.openDatabases.set(accountSetId, {
        accountSetId,
        db,
        handle,
        lastAccess: Date.now()
      });

      this.currentAccountSetId = accountSetId;
      return db;
    } else {
      throw new Error('Unsupported storage type');
    }
  }

  /**
   * 获取当前账套的数据库
   */
  getCurrentDatabase(): any | null {
    if (!this.currentAccountSetId) {
      return null;
    }
    const cached = this.openDatabases.get(this.currentAccountSetId);
    return cached?.db || null;
  }

  /**
   * 获取指定账套的数据库
   */
  getDatabase(accountSetId: string): any | null {
    const cached = this.openDatabases.get(accountSetId);
    return cached?.db || null;
  }

  /**
   * 切换当前账套
   */
  async switchAccountSet(accountSetId: string): Promise<any> {
    if (this.currentAccountSetId === accountSetId) {
      return this.getCurrentDatabase();
    }

    return await this.openAccountSetDatabase(accountSetId);
  }

  /**
   * 保存当前账套数据库
   */
  async saveCurrentDatabase(): Promise<void> {
    if (!this.currentAccountSetId) {
      throw new Error('No current account set');
    }

    const cached = this.openDatabases.get(this.currentAccountSetId);
    if (!cached) {
      throw new Error('Database not opened');
    }

    if (cached.handle) {
      await this.writeFile(cached.handle, cached.db);
    }
  }

  /**
   * 保存指定账套数据库
   */
  async saveAccountSetDatabase(accountSetId: string): Promise<void> {
    const cached = this.openDatabases.get(accountSetId);
    if (!cached) {
      throw new Error('Database not opened');
    }

    if (cached.handle) {
      await this.writeFile(cached.handle, cached.db);
    }
  }

  /**
   * 关闭账套数据库
   */
  async closeAccountSetDatabase(accountSetId: string): Promise<void> {
    const cached = this.openDatabases.get(accountSetId);
    if (cached) {
      // 保存更改
      if (cached.handle) {
        await this.writeFile(cached.handle, cached.db);
      }

      // 从缓存中移除
      this.openDatabases.delete(accountSetId);

      // 如果是当前账套，清除
      if (this.currentAccountSetId === accountSetId) {
        this.currentAccountSetId = null;
      }
    }
  }

  /**
   * 删除账套数据库（关闭并删除文件）
   */
  async deleteAccountSetDatabase(accountSetId: string): Promise<void> {
    // 先关闭
    await this.closeAccountSetDatabase(accountSetId);

    // 获取账套信息
    const info = await fileHandleManager.getAccountSetInfo(accountSetId);
    if (!info) {
      return; // 已经不存在
    }

    // 尝试删除文件（如果可能）
    if (info.storageType === 'opfs') {
      try {
        const opfsRoot = await (navigator.storage as any).getDirectory();
        // @ts-ignore - removeEntry 是 OPFS API
        await opfsRoot.removeEntry(info.fileName);
      } catch (error) {
        console.warn('Failed to delete OPFS file:', error);
      }
    }

    // 从 IndexedDB 移除句柄
    await fileHandleManager.removeHandle(accountSetId);
  }

  /**
   * 复制账套数据库（创建新账套时复制现有账套）
   */
  async copyAccountSetDatabase(
    sourceAccountSetId: string,
    targetAccountSetId: string,
    targetAccountSetName: string
  ): Promise<void> {
    const sourceDb = this.getDatabase(sourceAccountSetId);
    if (!sourceDb) {
      throw new Error('Source database not opened');
    }

    // 导出源数据库
    const data = sourceDb.export();

    // 为目标账套创建新文件
    const SQL = await this.getSqlJs();
    const targetDb = new SQL.Database(data);

    // 保存到新文件
    const { handle, fileName } = await this.createAccountSetDatabase(
      targetAccountSetId,
      targetAccountSetName,
      'fsa' // 默认使用 FSA
    );

    // 使用导出的数据替换新创建的空数据库
    await this.writeFile(handle, targetDb);
  }

  /**
   * 获取所有账套信息
   */
  async getAllAccountSets(): Promise<AccountSetHandleInfo[]> {
    return await fileHandleManager.getAllAccountSets();
  }

  /**
   * 获取账套信息
   */
  async getAccountSetInfo(accountSetId: string): Promise<AccountSetHandleInfo | null> {
    return await fileHandleManager.getAccountSetInfo(accountSetId);
  }

  /**
   * 更新账套名称
   */
  async updateAccountSetName(accountSetId: string, newName: string): Promise<void> {
    await fileHandleManager.updateAccountSetName(accountSetId, newName);
  }

  /**
   * 获取当前账套 ID
   */
  getCurrentAccountSetId(): string | null {
    return this.currentAccountSetId;
  }

  /**
   * 写入文件（File System Access API）
   */
  private async writeFile(handle: FileSystemFileHandle, db: any): Promise<void> {
    const data = db.export();
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  /**
   * 写入 OPFS 文件
   */
  private async writeOPFSFile(handle: FileSystemFileHandle, db: any): Promise<void> {
    const data = db.export();
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();

    // 如果支持 sync()，调用它确保数据写入磁盘
    if ('sync' in handle && typeof (handle as any).sync === 'function') {
      await (handle as any).sync();
    }
  }

  /**
   * 创建数据库表结构
   */
  private createTables(db: any): void {
    const tables = `
      -- 账套表（可选，主要用于记录账套元数据）
      CREATE TABLE IF NOT EXISTS accountSets (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT,
        description TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      -- 凭证表
      CREATE TABLE IF NOT EXISTS vouchers (
        id TEXT PRIMARY KEY,
        voucherNo TEXT,
        date TEXT,
        status TEXT,
        summary TEXT,
        creator TEXT,
        reviewer TEXT,
        poster TEXT,
        reverseVoucherId TEXT,
        referenceNumber TEXT,
        attachmentCount INTEGER DEFAULT 0,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      -- 分录表
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        voucherId TEXT,
        subjectCode TEXT,
        subjectName TEXT,
        direction TEXT,
        debit REAL,
        credit REAL,
        summary TEXT,
        customerName TEXT,
        supplierName TEXT,
        auxiliary TEXT,
        recRefNo TEXT,
        departmentCode TEXT,
        departmentName TEXT,
        projectCode TEXT,
        projectName TEXT,
        currencyCode TEXT,
        exchangeRate REAL DEFAULT 1.0,
        originalAmount REAL DEFAULT 0,
        date TEXT,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (voucherId) REFERENCES vouchers(id)
      );

      -- 科目表
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        parentId TEXT,
        level INTEGER DEFAULT 1,
        type TEXT,
        direction TEXT DEFAULT 'debit',
        balance REAL DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        frozen INTEGER DEFAULT 0,
        description TEXT,
        enableDept INTEGER DEFAULT 0,
        enableProject INTEGER DEFAULT 0,
        enableForeign INTEGER DEFAULT 0,
        foreignCurrency TEXT,
        isCustomer INTEGER DEFAULT 0,
        isSupplier INTEGER DEFAULT 0,
        isEmployee INTEGER DEFAULT 0,
        enableCashFlow INTEGER DEFAULT 0,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (parentId) REFERENCES subjects(id)
      );

      -- 部门表
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
        updateTime TEXT,
        FOREIGN KEY (parentId) REFERENCES departments(id)
      );

      -- 项目表
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        description TEXT,
        enabled INTEGER DEFAULT 1,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      -- 币别表
      CREATE TABLE IF NOT EXISTS currencies (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        symbol TEXT,
        exchangeRate REAL DEFAULT 1.0,
        enabled INTEGER DEFAULT 1,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      -- 往来单位表
      CREATE TABLE IF NOT EXISTS partners (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        type TEXT DEFAULT 'customer',
        contact TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        taxNo TEXT,
        bankAccount TEXT,
        enabled INTEGER DEFAULT 1,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      -- 凭证模板表
      CREATE TABLE IF NOT EXISTS voucherTemplates (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        entries TEXT,
        validations TEXT,
        variables TEXT,
        isSystem INTEGER DEFAULT 0,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      -- 常用摘要表
      CREATE TABLE IF NOT EXISTS commonSummaries (
        id TEXT PRIMARY KEY,
        content TEXT,
        frequency INTEGER DEFAULT 0,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      -- 用户偏好表
      CREATE TABLE IF NOT EXISTS userPreferences (
        id TEXT PRIMARY KEY,
        userId TEXT,
        type TEXT,
        key TEXT,
        value TEXT,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      -- 审计日志表
      CREATE TABLE IF NOT EXISTS auditLogs (
        id TEXT PRIMARY KEY,
        type TEXT,
        entityType TEXT,
        entityId TEXT,
        details TEXT,
        userId TEXT,
        timestamp TEXT,
        accountSetId TEXT
      );

      -- 核销关系表
      CREATE TABLE IF NOT EXISTS recRelations (
        id TEXT PRIMARY KEY,
        recRefNo TEXT,
        debitEntryId TEXT,
        creditEntryId TEXT,
        amount REAL,
        recDate TEXT,
        partnerName TEXT,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (debitEntryId) REFERENCES entries(id),
        FOREIGN KEY (creditEntryId) REFERENCES entries(id)
      );
    `;

    db.exec(tables);

    // 创建索引
    const indexes = `
      CREATE INDEX IF NOT EXISTS idx_vouchers_accountSetId ON vouchers(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);
      CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
      CREATE INDEX IF NOT EXISTS idx_vouchers_voucherNo ON vouchers(voucherNo);
      CREATE INDEX IF NOT EXISTS idx_entries_accountSetId ON entries(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_entries_voucherId ON entries(voucherId);
      CREATE INDEX IF NOT EXISTS idx_entries_subjectCode ON entries(subjectCode);
      CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
      CREATE INDEX IF NOT EXISTS idx_entries_recRefNo ON entries(recRefNo);
      CREATE INDEX IF NOT EXISTS idx_subjects_accountSetId ON subjects(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code);
      CREATE INDEX IF NOT EXISTS idx_subjects_parentId ON subjects(parentId);
      CREATE INDEX IF NOT EXISTS idx_departments_accountSetId ON departments(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
      CREATE INDEX IF NOT EXISTS idx_projects_accountSetId ON projects(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
      CREATE INDEX IF NOT EXISTS idx_currencies_accountSetId ON currencies(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);
      CREATE INDEX IF NOT EXISTS idx_partners_accountSetId ON partners(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(code);
      CREATE INDEX IF NOT EXISTS idx_voucherTemplates_accountSetId ON voucherTemplates(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_commonSummaries_accountSetId ON commonSummaries(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_userPreferences_accountSetId ON userPreferences(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_auditLogs_accountSetId ON auditLogs(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_recRelations_accountSetId ON recRelations(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_recRelations_recRefNo ON recRelations(recRefNo);
    `;

    db.exec(indexes);
  }
}

export const accountSetDbManager = AccountSetDbManager.getInstance();
