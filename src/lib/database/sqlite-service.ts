import { accountSetDbManager } from './account-set-db-manager';
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
  UserPreference as _UserPreference
} from '@/types';

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

// AuditLog interface
export interface AuditLog {
  id: string;
  type: 'create' | 'update' | 'delete' | 'post' | 'reverse';
  entityType: 'voucher' | 'entry' | 'subject' | 'department' | 'project' | 'partner' | 'currency' | 'template';
  entityId: string;
  details: string;
  userId: string;
  timestamp: string;
  accountSetId?: string;
}

class SQLiteService {
  private dbInstance: any = null;
  private _accountSetId: string = 'default'; // 当前账套ID

  // 设置当前账套ID
  setAccountSetId(accountSetId: string) {
    this._accountSetId = accountSetId;
    this.dbInstance = null; // 清除缓存的数据库实例
  }

  // 获取当前账套ID
  get accountSetId(): string {
    return this._accountSetId;
  }

  private async getDb(): Promise<any> {
    // 如果有缓存的实例，直接返回
    if (this.dbInstance) {
      return this.dbInstance;
    }

    // 优先使用多账套管理器
    if (this._accountSetId !== 'default') {
      let db = accountSetDbManager.getDatabase(this._accountSetId);

      // 如果数据库未打开，尝试打开
      if (!db) {
        try {
          db = await accountSetDbManager.openAccountSetDatabase(this._accountSetId);
          console.log(`Account set database opened for ${this._accountSetId}`);
        } catch (error) {
          console.warn(`Failed to open account set database for ${this._accountSetId}:`, error);

          // 检查是否有文件句柄记录
          const { fileHandleManager } = await import('./file-handle-manager');
          const dbInfo = await fileHandleManager.getAccountSetInfo(this._accountSetId);

          if (!dbInfo) {
            // 没有文件句柄记录，可能是旧数据迁移场景
            // 检查 sqliteManager 中是否有数据，如果有则使用旧数据库
            const { sqliteManager } = await import('./sqlite-manager');
            await sqliteManager.init();
            const oldDb = sqliteManager.getDatabase();

            if (oldDb) {
              // 检查旧数据库中是否有数据
              const result = oldDb.exec(`SELECT COUNT(*) as count FROM vouchers`);
              const voucherCount = result[0]?.values[0]?.[0] || 0;

              if (voucherCount > 0) {
                console.log(`Found ${voucherCount} vouchers in legacy database, using sqliteManager for ${this._accountSetId}`);
                console.warn('Please migrate your data to the new multi-account set system. Use the database location dialog to initialize the account set database.');
                this.dbInstance = oldDb;
                return oldDb;
              }
            }

            // 如果旧数据库也没有数据，创建新的账套数据库
            try {
              const { useAccountSetStore } = await import('@/stores/useAccountSetStore');
              const accountSetStore = useAccountSetStore.getState();
              const accountSet = accountSetStore.getAccountSetById(this._accountSetId);

              if (accountSet) {
                console.log(`Creating new database for account set ${this._accountSetId}`);
                // 创建新数据库（使用 OPFS 作为默认存储）
                await accountSetDbManager.createAccountSetDatabase(
                  this._accountSetId,
                  accountSet.name,
                  'opfs' // 默认使用 OPFS
                );
                // 再次打开
                db = await accountSetDbManager.openAccountSetDatabase(this._accountSetId);
                console.log(`Account set database created and opened for ${this._accountSetId}`);
              } else {
                throw new Error(`Account set ${this._accountSetId} not found`);
              }
            } catch (createError) {
              console.error(`Failed to create account set database for ${this._accountSetId}:`, createError);
              // 最后的降级方案：使用全局 sqliteManager
              const { sqliteManager } = await import('./sqlite-manager');
              await sqliteManager.init();
              db = sqliteManager.getDatabase();
            }
          } else {
            // 有文件句柄但无法打开，可能是文件损坏
            console.error('Database file exists but cannot be opened. It may be corrupted.');
            const { sqliteManager } = await import('./sqlite-manager');
            await sqliteManager.init();
            db = sqliteManager.getDatabase();
          }
        }
      }

      this.dbInstance = db;
      return db;
    }

    // 降级到全局 sqliteManager（默认账套或未设置账套时）
    const { sqliteManager } = await import('./sqlite-manager');
    await sqliteManager.init();
    const db = sqliteManager.getDatabase();
    this.dbInstance = db;
    return db;
  }

  // 确保数据库已初始化的辅助方法
  private async ensureInitialized(): Promise<void> {
    if (!this.dbInstance) {
      await this.getDb();
    }
    if (!this.dbInstance) {
      throw new Error('Failed to initialize SQLite database');
    }
  }

  // Helper to execute a query and return results (async version)
  private async querySingleAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    await this.ensureInitialized();

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
            currencyCode, exchangeRate, originalAmount, date, accountSetId,
            createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          entryWithAccountSet.exchangeRate || 0,
          entryWithAccountSet.originalAmount || 0,
          entryWithAccountSet.date || new Date().toISOString().split('T')[0],
          entryWithAccountSet.accountSetId,
          entryWithAccountSet.createTime || new Date().toISOString(),
          entryWithAccountSet.updateTime || new Date().toISOString()
        ]);
        entryStmt.free();
      }
    } catch (error) {
      console.error('Save voucher failed:', error);
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
      entries: entries.map((entry: any) => ({
        ...entry,
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

    return Promise.all(
      vouchers.map(async (voucher: any) => {
        const entries = await this.queryAllAsync<any>(
          `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
          [voucher.id, this.accountSetId]
        );

        return {
          ...voucher,
          entries: entries.map((entry: any) => ({
            ...entry,
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
          entries: entries.map((entry: any) => ({
            ...entry,
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
          entries: entries.map((entry: any) => ({
            ...entry,
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
            enabled, frozen, description, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          subjectWithAccountSet.accountSetId,
          subjectWithAccountSet.createTime || now,
          subjectWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
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

    return results.map(result => ({
      id: result.id,
      code: result.code,
      name: result.name,
      parentId: result.parentId,
      level: result.level,
      direction: result.direction,
      enableDept: false,
      enableProject: false,
      enableForeign: false,
      isCustomer: false,
      isSupplier: false,
      isEmployee: false,
      enableCashFlow: false,
      disabled: result.enabled === 0,
      block: result.frozen === 1,
      subjectType: result.type,
      createTime: result.createTime,
      updateTime: result.updateTime,
      accountSetId: result.accountSetId
    }));
  }

  async getSubjectByCode(code: string): Promise<Subject | undefined> {
    await this.ensureInitialized();
    return await this.querySingleAsync<Subject>(
      `SELECT * FROM subjects WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
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
            bankAccount, enabled, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          partnerWithAccountSet.accountSetId,
          partnerWithAccountSet.createTime || now,
          partnerWithAccountSet.updateTime || now
        ]);
        stmt.free();
      }
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
    data.partners = await this.queryAllAsync<any>(`SELECT * FROM partners WHERE accountSetId = ?`, [this._accountSetId]);
    data.voucherTemplates = await this.queryAllAsync<any>(`SELECT * FROM voucherTemplates WHERE accountSetId = ?`, [this._accountSetId]);
    data.commonSummaries = await this.queryAllAsync<any>(`SELECT * FROM commonSummaries WHERE accountSetId = ?`, [this._accountSetId]);
    data.userPreferences = await this.queryAllAsync<any>(`SELECT * FROM userPreferences WHERE accountSetId = ?`, [this._accountSetId]);
    data.auditLogs = await this.queryAllAsync<any>(`SELECT * FROM auditLogs WHERE accountSetId = ?`, [this._accountSetId]);
    data.recRelations = await this.queryAllAsync<any>(`SELECT * FROM recRelations WHERE accountSetId = ?`, [this._accountSetId]);

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
      const tables = ['subjects', 'departments', 'projects', 'currencies', 'partners',
                     'voucherTemplates', 'commonSummaries', 'userPreferences',
                     'auditLogs', 'recRelations'];

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
}

export const sqliteService = new SQLiteService();
