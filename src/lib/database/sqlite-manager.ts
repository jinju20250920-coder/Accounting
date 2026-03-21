import initSqlJs from 'sql.js';

class SQLiteManager {
  private static instance: SQLiteManager;
  private db: any = null;
  private currentAccountSetId: string | null = null;
  private initPromise: Promise<void> | null = null;

  static getInstance(): SQLiteManager {
    if (!SQLiteManager.instance) {
      SQLiteManager.instance = new SQLiteManager();
    }
    return SQLiteManager.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sqljs/${file}`,
      });

      // Create in-memory database (we'll persist to file later)
      this.db = new SQL.Database();

      // Create tables
      this.createTables();

      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('SQLite initialization failed:', error);
      throw new Error('Failed to initialize SQLite database');
    }
  }

  private createTables(): void {
    // Create tables with accountSetId for multi-tenancy
    const tables = `
      -- 账套表
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
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id),
        FOREIGN KEY (reverseVoucherId) REFERENCES vouchers(id)
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
        FOREIGN KEY (voucherId) REFERENCES vouchers(id),
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
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
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (parentId) REFERENCES subjects(id),
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
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
        FOREIGN KEY (parentId) REFERENCES departments(id),
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
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
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
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
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
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
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      -- 凭证模板表
      CREATE TABLE IF NOT EXISTS voucherTemplates (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        description TEXT,
        entries TEXT,
        validations TEXT,
        variables TEXT,
        isSystem INTEGER DEFAULT 0,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      -- 常用摘要表
      CREATE TABLE IF NOT EXISTS commonSummaries (
        id TEXT PRIMARY KEY,
        content TEXT,
        frequency INTEGER DEFAULT 0,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
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
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
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
        accountSetId TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
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
        FOREIGN KEY (creditEntryId) REFERENCES entries(id),
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );
    `;

    this.db.exec(tables);

    // Create indexes for better query performance
    const indexes = `
      -- Vouchers indexes
      CREATE INDEX IF NOT EXISTS idx_vouchers_accountSetId ON vouchers(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);
      CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
      CREATE INDEX IF NOT EXISTS idx_vouchers_voucherNo ON vouchers(voucherNo);

      -- Entries indexes
      CREATE INDEX IF NOT EXISTS idx_entries_accountSetId ON entries(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_entries_voucherId ON entries(voucherId);
      CREATE INDEX IF NOT EXISTS idx_entries_subjectCode ON entries(subjectCode);
      CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
      CREATE INDEX IF NOT EXISTS idx_entries_recRefNo ON entries(recRefNo);

      -- Subjects indexes
      CREATE INDEX IF NOT EXISTS idx_subjects_accountSetId ON subjects(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code);
      CREATE INDEX IF NOT EXISTS idx_subjects_parentId ON subjects(parentId);

      -- Partners indexes
      CREATE INDEX IF NOT EXISTS idx_partners_accountSetId ON partners(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(code);

      -- RecRelations indexes
      CREATE INDEX IF NOT EXISTS idx_recRelations_accountSetId ON recRelations(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_recRelations_recRefNo ON recRelations(recRefNo);
      CREATE INDEX IF NOT EXISTS idx_recRelations_debitEntryId ON recRelations(debitEntryId);
      CREATE INDEX IF NOT EXISTS idx_recRelations_creditEntryId ON recRelations(creditEntryId);
      CREATE INDEX IF NOT EXISTS idx_recRelations_partnerName ON recRelations(partnerName);
    `;

    this.db.exec(indexes);
  }

  setCurrentAccountSet(accountSetId: string): void {
    this.currentAccountSetId = accountSetId;
  }

  async switchAccountSet(accountSetId: string): Promise<void> {
    this.currentAccountSetId = accountSetId;
  }

  getCurrentAccountSetId(): string | null {
    return this.currentAccountSetId;
  }

  getDatabase(): any {
    if (!this.db) {
      console.warn('SQLite database not initialized, attempting to initialize...');
      throw new Error('SQLite database not initialized');
    }
    return this.db;
  }

  async getDatabaseSafe(): Promise<any> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  isInitialized(): boolean {
    return this.db !== null;
  }

  // Database file operations
  async exportDatabase(): Promise<Uint8Array> {
    return this.db.export();
  }

  async importDatabase(data: Uint8Array): Promise<void> {
    try {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sqljs/${file}`,
      });
      this.db = new SQL.Database(data);
      console.log('Database imported successfully');
    } catch (error) {
      console.error('Failed to import database:', error);
      throw new Error('Failed to import database');
    }
  }

  // Export as JSON (for compatibility with IndexedDB)
  async exportData(): Promise<any> {
    const db = this.getDatabase();
    const accountSetId = this.getCurrentAccountSetId();

    if (!accountSetId) {
      throw new Error('No account set selected');
    }

    // Get vouchers
    const vouchersResult = db.exec(`SELECT * FROM vouchers WHERE accountSetId = ?`, [accountSetId]);
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
      const entriesResult = db.exec(`SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`, [voucher.id, accountSetId]);
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
    const subjectsResult = db.exec(`SELECT * FROM subjects WHERE accountSetId = ?`, [accountSetId]);
    const subjects = subjectsResult[0]?.values.map((row: any[], index: number) => {
      const columns = subjectsResult[0].columns;
      const subject: any = {};
      columns.forEach((col: string, idx: number) => {
        subject[col] = row[idx];
      });
      return subject;
    }) || [];

    const departmentsResult = db.exec(`SELECT * FROM departments WHERE accountSetId = ?`, [accountSetId]);
    const departments = departmentsResult[0]?.values.map((row: any[], index: number) => {
      const columns = departmentsResult[0].columns;
      const dept: any = {};
      columns.forEach((col: string, idx: number) => {
        dept[col] = row[idx];
      });
      return dept;
    }) || [];

    const projectsResult = db.exec(`SELECT * FROM projects WHERE accountSetId = ?`, [accountSetId]);
    const projects = projectsResult[0]?.values.map((row: any[], index: number) => {
      const columns = projectsResult[0].columns;
      const project: any = {};
      columns.forEach((col: string, idx: number) => {
        project[col] = row[idx];
      });
      return project;
    }) || [];

    const currenciesResult = db.exec(`SELECT * FROM currencies WHERE accountSetId = ?`, [accountSetId]);
    const currencies = currenciesResult[0]?.values.map((row: any[], index: number) => {
      const columns = currenciesResult[0].columns;
      const currency: any = {};
      columns.forEach((col: string, idx: number) => {
        currency[col] = row[idx];
      });
      return currency;
    }) || [];

    const partnersResult = db.exec(`SELECT * FROM partners WHERE accountSetId = ?`, [accountSetId]);
    const partners = partnersResult[0]?.values.map((row: any[], index: number) => {
      const columns = partnersResult[0].columns;
      const partner: any = {};
      columns.forEach((col: string, idx: number) => {
        partner[col] = row[idx];
      });
      return partner;
    }) || [];

    const voucherTemplatesResult = db.exec(`SELECT * FROM voucherTemplates WHERE accountSetId = ?`, [accountSetId]);
    const voucherTemplates = voucherTemplatesResult[0]?.values.map((row: any[], index: number) => {
      const columns = voucherTemplatesResult[0].columns;
      const template: any = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        template[col] = col === 'entries' || col === 'validations' || col === 'variables' ? JSON.parse(value) : value;
      });
      return template;
    }) || [];

    const commonSummariesResult = db.exec(`SELECT * FROM commonSummaries WHERE accountSetId = ?`, [accountSetId]);
    const commonSummaries = commonSummariesResult[0]?.values.map((row: any[], index: number) => {
      const columns = commonSummariesResult[0].columns;
      const summary: any = {};
      columns.forEach((col: string, idx: number) => {
        summary[col] = row[idx];
      });
      return summary;
    }) || [];

    const preferencesResult = db.exec(`SELECT * FROM userPreferences WHERE accountSetId = ?`, [accountSetId]);
    const preferences = preferencesResult[0]?.values.map((row: any[], index: number) => {
      const columns = preferencesResult[0].columns;
      const pref: any = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        pref[col] = col === 'value' ? JSON.parse(value) : value;
      });
      return pref;
    }) || [];

    const auditLogsResult = db.exec(`SELECT * FROM auditLogs WHERE accountSetId = ?`, [accountSetId]);
    const auditLogs = auditLogsResult[0]?.values.map((row: any[], index: number) => {
      const columns = auditLogsResult[0].columns;
      const log: any = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        log[col] = col === 'details' ? JSON.parse(value) : value;
      });
      return log;
    }) || [];

    const recRelationsResult = db.exec(`SELECT * FROM recRelations WHERE accountSetId = ?`, [accountSetId]);
    const recRelations = recRelationsResult[0]?.values.map((row: any[], index: number) => {
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

  async importData(data: any): Promise<void> {
    const db = this.getDatabase();
    const accountSetId = this.getCurrentAccountSetId();

    if (!accountSetId) {
      throw new Error('No account set selected');
    }

    try {
      // Import vouchers and entries
      if (data.vouchers) {
        for (const voucher of data.vouchers) {
          const voucherWithAccountSet = { ...voucher, accountSetId };
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO vouchers (
              id, voucherNo, date, status, summary, creator, reviewer, poster,
              reverseVoucherId, referenceNumber, attachmentCount, accountSetId,
              createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            voucherWithAccountSet.id,
            voucherWithAccountSet.voucherNo,
            voucherWithAccountSet.date,
            voucherWithAccountSet.status,
            voucherWithAccountSet.summary,
            voucherWithAccountSet.creator,
            voucherWithAccountSet.reviewer,
            voucherWithAccountSet.poster,
            voucherWithAccountSet.reverseVoucherId,
            voucherWithAccountSet.referenceNumber,
            voucherWithAccountSet.attachmentCount || 0,
            voucherWithAccountSet.accountSetId,
            voucherWithAccountSet.createTime,
            voucherWithAccountSet.updateTime
          ]);
          stmt.free();

          for (const entry of voucher.entries) {
            const entryWithAccountSet = { ...entry, accountSetId, voucherId: voucher.id };
            const entryStmt = db.prepare(`
              INSERT OR REPLACE INTO entries (
                id, voucherId, subjectCode, subjectName, direction, debit, credit,
                summary, customerName, supplierName, auxiliary, recRefNo,
                departmentCode, departmentName, projectCode, projectName,
                currencyCode, exchangeRate, originalAmount, date, accountSetId,
                createTime, updateTime
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            entryStmt.run([
              entryWithAccountSet.id,
              entryWithAccountSet.voucherId,
              entryWithAccountSet.subjectCode,
              entryWithAccountSet.subjectName,
              entryWithAccountSet.direction,
              entryWithAccountSet.debit,
              entryWithAccountSet.credit,
              entryWithAccountSet.summary,
              entryWithAccountSet.customerName,
              entryWithAccountSet.supplierName,
              JSON.stringify(entryWithAccountSet.auxiliary || {}),
              entryWithAccountSet.recRefNo,
              entryWithAccountSet.departmentCode,
              entryWithAccountSet.departmentName,
              entryWithAccountSet.projectCode,
              entryWithAccountSet.projectName,
              entryWithAccountSet.currencyCode,
              entryWithAccountSet.exchangeRate,
              entryWithAccountSet.originalAmount,
              entryWithAccountSet.date,
              entryWithAccountSet.accountSetId,
              entryWithAccountSet.createTime,
              entryWithAccountSet.updateTime
            ]);
            entryStmt.free();
          }
        }
      }

      // Import subjects
      if (data.subjects) {
        for (const subject of data.subjects) {
          const subjectWithAccountSet = { ...subject, accountSetId };
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO subjects (
              id, code, name, parentId, level, type, direction, balance,
              enabled, frozen, description, accountSetId, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            subjectWithAccountSet.id,
            subjectWithAccountSet.code,
            subjectWithAccountSet.name,
            subjectWithAccountSet.parentId,
            subjectWithAccountSet.level || 1,
            subjectWithAccountSet.type,
            subjectWithAccountSet.direction,
            subjectWithAccountSet.balance || 0,
            subjectWithAccountSet.enabled !== undefined ? Number(subjectWithAccountSet.enabled) : 1,
            subjectWithAccountSet.frozen !== undefined ? Number(subjectWithAccountSet.frozen) : 0,
            subjectWithAccountSet.description,
            subjectWithAccountSet.accountSetId,
            subjectWithAccountSet.createTime,
            subjectWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }

      // Import departments
      if (data.departments) {
        for (const dept of data.departments) {
          const deptWithAccountSet = { ...dept, accountSetId };
          const stmt = db.prepare(`
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
            deptWithAccountSet.description,
            deptWithAccountSet.accountSetId,
            deptWithAccountSet.createTime,
            deptWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }

      // Import projects
      if (data.projects) {
        for (const project of data.projects) {
          const projectWithAccountSet = { ...project, accountSetId };
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO projects (
              id, code, name, description, enabled, accountSetId, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            projectWithAccountSet.id,
            projectWithAccountSet.code,
            projectWithAccountSet.name,
            projectWithAccountSet.description,
            projectWithAccountSet.enabled !== undefined ? Number(projectWithAccountSet.enabled) : 1,
            projectWithAccountSet.accountSetId,
            projectWithAccountSet.createTime,
            projectWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }

      // Import currencies
      if (data.currencies) {
        for (const currency of data.currencies) {
          const currencyWithAccountSet = { ...currency, accountSetId };
          const stmt = db.prepare(`
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
            currencyWithAccountSet.createTime,
            currencyWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }

      // Import partners
      if (data.partners) {
        for (const partner of data.partners) {
          const partnerWithAccountSet = { ...partner, accountSetId };
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO partners (
              id, code, name, type, contact, phone, email, address, taxNo,
              bankAccount, enabled, accountSetId, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            partnerWithAccountSet.id,
            partnerWithAccountSet.code,
            partnerWithAccountSet.name,
            partnerWithAccountSet.type || 'customer',
            partnerWithAccountSet.contact,
            partnerWithAccountSet.phone,
            partnerWithAccountSet.email,
            partnerWithAccountSet.address,
            partnerWithAccountSet.taxNo,
            partnerWithAccountSet.bankAccount,
            partnerWithAccountSet.enabled !== undefined ? Number(partnerWithAccountSet.enabled) : 1,
            partnerWithAccountSet.accountSetId,
            partnerWithAccountSet.createTime,
            partnerWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }

      // Import voucher templates
      if (data.voucherTemplates) {
        for (const template of data.voucherTemplates) {
          const templateWithAccountSet = { ...template, accountSetId };
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO voucherTemplates (
              id, name, type, description, entries, validations, variables,
              isSystem, accountSetId, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            templateWithAccountSet.id,
            templateWithAccountSet.name,
            templateWithAccountSet.type,
            templateWithAccountSet.description,
            JSON.stringify(templateWithAccountSet.entries || []),
            JSON.stringify(templateWithAccountSet.validations || []),
            JSON.stringify(templateWithAccountSet.variables || []),
            templateWithAccountSet.isSystem !== undefined ? Number(templateWithAccountSet.isSystem) : 0,
            templateWithAccountSet.accountSetId,
            templateWithAccountSet.createTime,
            templateWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }

      // Import common summaries
      if (data.commonSummaries) {
        for (const summary of data.commonSummaries) {
          const summaryWithAccountSet = { ...summary, accountSetId };
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO commonSummaries (
              id, content, frequency, accountSetId, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            summaryWithAccountSet.id,
            summaryWithAccountSet.content,
            summaryWithAccountSet.frequency || 0,
            summaryWithAccountSet.accountSetId,
            summaryWithAccountSet.createTime,
            summaryWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }

      // Import user preferences
      if (data.preferences) {
        for (const pref of data.preferences) {
          const prefWithAccountSet = { ...pref, accountSetId };
          const stmt = db.prepare(`
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
            prefWithAccountSet.createTime,
            prefWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }

      // Import audit logs
      if (data.auditLogs) {
        for (const log of data.auditLogs) {
          const logWithAccountSet = { ...log, accountSetId };
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO auditLogs (
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
        }
      }

      // Import rec relations
      if (data.recRelations) {
        for (const relation of data.recRelations) {
          const relationWithAccountSet = { ...relation, accountSetId };
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO recRelations (
              id, recRefNo, debitEntryId, creditEntryId, amount, recDate,
              partnerName, accountSetId, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            relationWithAccountSet.id,
            relationWithAccountSet.recRefNo,
            relationWithAccountSet.debitEntryId,
            relationWithAccountSet.creditEntryId,
            relationWithAccountSet.amount,
            relationWithAccountSet.recDate,
            relationWithAccountSet.partnerName,
            relationWithAccountSet.accountSetId,
            relationWithAccountSet.createTime,
            relationWithAccountSet.updateTime
          ]);
          stmt.free();
        }
      }
    } catch (error) {
      console.error('Import data failed:', error);
      throw error;
    }
  }
}

export const sqliteManager = SQLiteManager.getInstance();
