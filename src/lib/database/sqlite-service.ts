import { sqliteManager } from './sqlite-manager';
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
  private get db(): any {
    return sqliteManager.getDatabase();
  }

  private get accountSetId(): string {
    const id = sqliteManager.getCurrentAccountSetId();
    if (!id) {
      return 'default-account-set';
    }
    return id;
  }

  // Helper to execute a query and return results
  private querySingle<T>(sql: string, params: any[] = []): T | null {
    const stmt = this.db.prepare(sql);
    try {
      const result = stmt.getAsObject(params);
      return result as T;
    } finally {
      stmt.free();
    }
  }

  // Helper to execute a query and return multiple results
  private queryAll<T>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      const results: T[] = [];
      stmt.bind(params);
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
      // Save voucher
      const voucherWithAccountSet = {
        ...voucher,
        accountSetId: this.accountSetId
      };

      const stmt = this.db.prepare(`
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
        (voucherWithAccountSet as any).creator || (voucherWithAccountSet as any).createdBy,
        (voucherWithAccountSet as any).reviewer,
        (voucherWithAccountSet as any).poster,
        (voucherWithAccountSet as any).reverseVoucherId,
        (voucherWithAccountSet as any).referenceNumber,
        (voucherWithAccountSet as any).attachmentCount || 0,
        voucherWithAccountSet.accountSetId,
        (voucherWithAccountSet as any).createdAt || new Date().toISOString(),
        (voucherWithAccountSet as any).updatedAt || new Date().toISOString()
      ]);
      stmt.free();

      // Delete existing entries for this voucher
      const deleteStmt = this.db.prepare(`DELETE FROM entries WHERE voucherId = ? AND accountSetId = ?`);
      deleteStmt.run([voucher.id, this.accountSetId]);
      deleteStmt.free();

      // Save new entries
      for (const entry of voucher.entries) {
        const entryWithAccountSet = {
          ...entry,
          accountSetId: this.accountSetId,
          voucherId: voucher.id
        } as any;

        const entryStmt = this.db.prepare(`
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
          entryWithAccountSet.subjectCode,
          entryWithAccountSet.subjectName,
          entryWithAccountSet.debit > 0 ? 'debit' : 'credit',
          entryWithAccountSet.debit,
          entryWithAccountSet.credit,
          entryWithAccountSet.summary,
          entryWithAccountSet.customerName,
          entryWithAccountSet.supplierName,
          JSON.stringify(entryWithAccountSet.auxiliary || {}),
          entryWithAccountSet.recRefNo,
          entryWithAccountSet.departmentCode || entryWithAccountSet.deptCode,
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
    } catch (error) {
      console.error('Save voucher failed:', error);
      throw error;
    }
  }

  async getVoucher(id: string): Promise<Voucher | undefined> {
    const voucher = this.querySingle<any>(
      `SELECT * FROM vouchers WHERE id = ? AND accountSetId = ?`,
      [id, this.accountSetId]
    );

    if (!voucher) {
      return undefined;
    }

    const entries = this.queryAll<any>(
      `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
      [id, this.accountSetId]
    ).map((entry: any) => ({
      ...entry,
      auxiliary: entry.auxiliary ? JSON.parse(entry.auxiliary) : {}
    }));

    return {
      ...voucher,
      entries
    };
  }

  async getAllVouchers(): Promise<Voucher[]> {
    const vouchers = this.queryAll<any>(
      `SELECT * FROM vouchers WHERE accountSetId = ? ORDER BY date DESC`,
      [this.accountSetId]
    );

    return Promise.all(
      vouchers.map(async (voucher: any) => {
        const entries = this.queryAll<any>(
          `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
          [voucher.id, this.accountSetId]
        ).map((entry: any) => ({
          ...entry,
          auxiliary: entry.auxiliary ? JSON.parse(entry.auxiliary) : {}
        }));

        return {
          ...voucher,
          entries
        };
      })
    );
  }

  async getVouchersByDateRange(startDate: string, endDate: string): Promise<Voucher[]> {
    const vouchers = this.queryAll<any>(
      `SELECT * FROM vouchers WHERE accountSetId = ? AND date >= ? AND date <= ? ORDER BY date DESC`,
      [this.accountSetId, startDate, endDate]
    );

    return Promise.all(
      vouchers.map(async (voucher: any) => {
        const entries = this.queryAll<any>(
          `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
          [voucher.id, this.accountSetId]
        ).map((entry: any) => ({
          ...entry,
          auxiliary: entry.auxiliary ? JSON.parse(entry.auxiliary) : {}
        }));

        return {
          ...voucher,
          entries
        };
      })
    );
  }

  async getVouchersByStatus(status: 'draft' | 'review' | 'posted' | 'reversed'): Promise<Voucher[]> {
    const vouchers = this.queryAll<any>(
      `SELECT * FROM vouchers WHERE accountSetId = ? AND status = ? ORDER BY date DESC`,
      [this.accountSetId, status]
    );

    return Promise.all(
      vouchers.map(async (voucher: any) => {
        const entries = this.queryAll<any>(
          `SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`,
          [voucher.id, this.accountSetId]
        ).map((entry: any) => ({
          ...entry,
          auxiliary: entry.auxiliary ? JSON.parse(entry.auxiliary) : {}
        }));

        return {
          ...voucher,
          entries
        };
      })
    );
  }

  async deleteVoucher(id: string): Promise<void> {
    try {
      // Delete entries first
      const deleteEntriesStmt = this.db.prepare(`DELETE FROM entries WHERE voucherId = ? AND accountSetId = ?`);
      deleteEntriesStmt.run([id, this.accountSetId]);
      deleteEntriesStmt.free();

      // Delete voucher
      const deleteVoucherStmt = this.db.prepare(`DELETE FROM vouchers WHERE id = ? AND accountSetId = ?`);
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
      for (const subject of subjects) {
        const subjectWithAccountSet = { ...subject, accountSetId: this.accountSetId } as any;
        const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save subjects failed:', error);
      throw error;
    }
  }

  async getAllSubjects(): Promise<Subject[]> {
    return this.queryAll<Subject>(
      `SELECT * FROM subjects WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );
  }

  async getSubjectByCode(code: string): Promise<Subject | undefined> {
    return this.querySingle<Subject>(
      `SELECT * FROM subjects WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  // ========== 部门操作 ==========

  async saveDepartments(departments: Department[]): Promise<void> {
    try {
      for (const dept of departments) {
        const deptWithAccountSet = { ...dept, accountSetId: this.accountSetId } as any;
        const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save departments failed:', error);
      throw error;
    }
  }

  async getAllDepartments(): Promise<Department[]> {
    return this.queryAll<Department>(
      `SELECT * FROM departments WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );
  }

  async getDepartmentByCode(code: string): Promise<Department | undefined> {
    return this.querySingle<Department>(
      `SELECT * FROM departments WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  // ========== 项目操作 ==========

  async saveProjects(projects: Project[]): Promise<void> {
    try {
      for (const project of projects) {
        const projectWithAccountSet = { ...project, accountSetId: this.accountSetId } as any;
        const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save projects failed:', error);
      throw error;
    }
  }

  async getAllProjects(): Promise<Project[]> {
    return this.queryAll<Project>(
      `SELECT * FROM projects WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    return this.querySingle<Project>(
      `SELECT * FROM projects WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  // ========== 币别操作 ==========

  async saveCurrencies(currencies: Currency[]): Promise<void> {
    try {
      for (const currency of currencies) {
        const currencyWithAccountSet = { ...currency, accountSetId: this.accountSetId } as any;
        const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save currencies failed:', error);
      throw error;
    }
  }

  async getAllCurrencies(): Promise<Currency[]> {
    return this.queryAll<Currency>(
      `SELECT * FROM currencies WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );
  }

  async getCurrencyByCode(code: string): Promise<Currency | undefined> {
    return this.querySingle<Currency>(
      `SELECT * FROM currencies WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  // ========== 往来单位操作 ==========

  async savePartners(partners: Partner[]): Promise<void> {
    try {
      for (const partner of partners) {
        const partnerWithAccountSet = { ...partner, accountSetId: this.accountSetId } as any;
        const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save partners failed:', error);
      throw error;
    }
  }

  async getAllPartners(): Promise<Partner[]> {
    return this.queryAll<Partner>(
      `SELECT * FROM partners WHERE accountSetId = ? ORDER BY code`,
      [this.accountSetId]
    );
  }

  async getPartnerByCode(code: string): Promise<Partner | undefined> {
    return this.querySingle<Partner>(
      `SELECT * FROM partners WHERE accountSetId = ? AND code = ?`,
      [this.accountSetId, code]
    );
  }

  // ========== 凭证模板操作 ==========

  async saveVoucherTemplates(templates: VoucherTemplate[]): Promise<void> {
    try {
      for (const template of templates) {
        const templateWithAccountSet = { ...template, accountSetId: this.accountSetId } as any;
        const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save voucher templates failed:', error);
      throw error;
    }
  }

  async getAllVoucherTemplates(): Promise<VoucherTemplate[]> {
    const templates = this.queryAll<any>(
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
    const template = this.querySingle<any>(
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
      for (const summary of summaries) {
        const summaryWithAccountSet = { ...summary, accountSetId: this.accountSetId } as any;
        const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save common summaries failed:', error);
      throw error;
    }
  }

  async getAllCommonSummaries(): Promise<CommonSummary[]> {
    return this.queryAll<CommonSummary>(
      `SELECT * FROM commonSummaries WHERE accountSetId = ? ORDER BY frequency DESC`,
      [this.accountSetId]
    );
  }

  // ========== 用户偏好操作 ==========

  async savePreference(preference: UserPreference): Promise<void> {
    try {
      const prefWithAccountSet = { ...preference, accountSetId: this.accountSetId } as any;
      const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save preference failed:', error);
      throw error;
    }
  }

  async getPreferencesByUser(userId: string): Promise<UserPreference[]> {
    const prefs = this.queryAll<any>(
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
      const logWithAccountSet = { ...log, accountSetId: this.accountSetId };
      const stmt = this.db.prepare(`
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
    const logs = this.queryAll<any>(
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
    return sqliteManager.exportData();
  }

  async importData(data: any) {
    return sqliteManager.importData(data);
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
      for (const relation of relations) {
        const relationWithAccountSet = { ...relation, accountSetId: this.accountSetId };
        const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save rec relations failed:', error);
      throw error;
    }
  }

  async saveRecRelation(relation: any): Promise<void> {
    try {
      const relationWithAccountSet = { ...relation, accountSetId: this.accountSetId };
      const stmt = this.db.prepare(`
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
    } catch (error) {
      console.error('Save rec relation failed:', error);
      throw error;
    }
  }

  async getRecRelations(): Promise<any[]> {
    return this.queryAll<any>(
      `SELECT * FROM recRelations WHERE accountSetId = ?`,
      [this.accountSetId]
    );
  }

  async updateEntryRecRefNo(entryId: string, recRefNo: string): Promise<void> {
    try {
      const stmt = this.db.prepare(
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
    return this.queryAll<any>(
      `SELECT * FROM recRelations WHERE recRefNo = ? AND accountSetId = ?`,
      [recRefNo, this.accountSetId]
    );
  }

  async getRecRelationsByEntryId(entryId: string): Promise<any[]> {
    const debitRelations = this.queryAll<any>(
      `SELECT * FROM recRelations WHERE debitEntryId = ? AND accountSetId = ?`,
      [entryId, this.accountSetId]
    );
    const creditRelations = this.queryAll<any>(
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

    const allEntries = this.queryAll<any>(
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
    const counts: any = {};
    counts.vouchers = this.queryAll<any>(`SELECT * FROM vouchers WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.entries = this.queryAll<any>(`SELECT * FROM entries WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.subjects = this.queryAll<any>(`SELECT * FROM subjects WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.departments = this.queryAll<any>(`SELECT * FROM departments WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.projects = this.queryAll<any>(`SELECT * FROM projects WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.currencies = this.queryAll<any>(`SELECT * FROM currencies WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.partners = this.queryAll<any>(`SELECT * FROM partners WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.voucherTemplates = this.queryAll<any>(`SELECT * FROM voucherTemplates WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.commonSummaries = this.queryAll<any>(`SELECT * FROM commonSummaries WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.userPreferences = this.queryAll<any>(`SELECT * FROM userPreferences WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.auditLogs = this.queryAll<any>(`SELECT * FROM auditLogs WHERE accountSetId = ?`, [this.accountSetId]).length;
    counts.recRelations = this.queryAll<any>(`SELECT * FROM recRelations WHERE accountSetId = ?`, [this.accountSetId]).length;

    console.log('Data integrity check:', counts);
    return counts;
  }

  // ========== 清空数据 ==========

  async clearAllData() {
    try {
      // Clear vouchers and entries
      const deleteEntriesStmt = this.db.prepare(`DELETE FROM entries WHERE accountSetId = ?`);
      deleteEntriesStmt.run([this.accountSetId]);
      deleteEntriesStmt.free();

      const deleteVouchersStmt = this.db.prepare(`DELETE FROM vouchers WHERE accountSetId = ?`);
      deleteVouchersStmt.run([this.accountSetId]);
      deleteVouchersStmt.free();

      // Clear other tables
      const tables = ['subjects', 'departments', 'projects', 'currencies', 'partners',
                     'voucherTemplates', 'commonSummaries', 'userPreferences',
                     'auditLogs', 'recRelations'];

      for (const table of tables) {
        const stmt = this.db.prepare(`DELETE FROM ${table} WHERE accountSetId = ?`);
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