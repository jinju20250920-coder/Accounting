import { databaseManager } from './manager';
import type { IDBPDatabase } from 'idb';
import type { FinanceDB } from './manager';
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

// AuditLog interface (not in types/index.ts yet)
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

class DatabaseService {
  private get db(): IDBPDatabase<FinanceDB> {
    return databaseManager.getDatabase();
  }

  private get accountSetId(): string {
    const id = databaseManager.getCurrentAccountSetId();
    if (!id) {
      // 如果没有选择账套，返回默认账套ID（确保至少有一个默认账套）
      return 'default-account-set';
    }
    return id;
  }

  // 安全获取所有记录：优先使用索引，失败则回退到全表扫描
  private async getAllFromIndexSafe(
    storeName: any,
    indexName: string,
    key?: any
  ): Promise<any[]> {
    try {
      if (key !== undefined) {
        return await this.db.getAllFromIndex(storeName, indexName, key);
      }
      return await this.db.getAllFromIndex(storeName, indexName);
    } catch (error) {
      // 索引不存在时，回退到全表扫描
      console.warn(`Index ${indexName} not found, falling back to full scan for ${storeName}`);
      const all = await this.db.getAll(storeName);
      if (key !== undefined) {
        return all.filter((item: any) => item.accountSetId === key);
      }
      return all;
    }
  }

  // ========== 凭证操作 ==========

  async saveVoucher(voucher: Voucher): Promise<void> {
    const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');

    // 保存凭证（自动添加 accountSetId）
    const voucherWithAccountSet = {
      ...voucher,
      accountSetId: this.accountSetId
    };
    await tx.objectStore('vouchers').put(voucherWithAccountSet);

    // 保存分录
    for (const entry of voucher.entries) {
      const entryWithAccountSet = {
        ...entry,
        accountSetId: this.accountSetId,
        voucherId: voucher.id
      };
      await tx.objectStore('entries').put(entryWithAccountSet);
    }

    await tx.done;
  }

  async getVoucher(id: string): Promise<Voucher | undefined> {
    const voucher = await this.db.get('vouchers', id);

    if (!voucher || voucher.accountSetId !== this.accountSetId) {
      return undefined;
    }

    // 获取关联的分录
    const entries = await this.getAllFromIndexSafe('entries', 'by-voucher', id);
    const filteredEntries = entries.filter(entry => entry.accountSetId === this.accountSetId);

    return {
      ...voucher,
      entries: filteredEntries
    };
  }

  async getAllVouchers(): Promise<Voucher[]> {
    const allVouchers = await this.getAllFromIndexSafe('vouchers', 'by-accountSet', this.accountSetId);

    // 为每个凭证加载分录
    const vouchersWithEntries = await Promise.all(
      allVouchers.map(async (voucher) => {
        const entries = await this.db.getAllFromIndex('entries', 'by-voucher', voucher.id);
        const filteredEntries = entries.filter(entry => entry.accountSetId === this.accountSetId);
        return {
          ...voucher,
          entries: filteredEntries
        };
      })
    );

    return vouchersWithEntries;
  }

  async getVouchersByDateRange(startDate: string, endDate: string): Promise<Voucher[]> {
    const allVouchers = await this.getAllFromIndexSafe('vouchers', 'by-accountSet', this.accountSetId);
    const dateRangeVouchers = allVouchers.filter(v => v.date >= startDate && v.date <= endDate);

    const vouchersWithEntries = await Promise.all(
      dateRangeVouchers.map(async (voucher) => {
        const entries = await this.db.getAllFromIndex('entries', 'by-voucher', voucher.id);
        const filteredEntries = entries.filter(entry => entry.accountSetId === this.accountSetId);
        return {
          ...voucher,
          entries: filteredEntries
        };
      })
    );

    return vouchersWithEntries;
  }

  async getVouchersByStatus(status: 'draft' | 'review' | 'posted' | 'reversed'): Promise<Voucher[]> {
    const allVouchers = await this.getAllFromIndexSafe('vouchers', 'by-accountSet', this.accountSetId);
    const statusVouchers = allVouchers.filter(v => v.status === status);

    const vouchersWithEntries = await Promise.all(
      statusVouchers.map(async (voucher) => {
        const entries = await this.db.getAllFromIndex('entries', 'by-voucher', voucher.id);
        const filteredEntries = entries.filter(entry => entry.accountSetId === this.accountSetId);
        return {
          ...voucher,
          entries: filteredEntries
        };
      })
    );

    return vouchersWithEntries;
  }

  async deleteVoucher(id: string): Promise<void> {
    // 首先检查凭证是否属于当前账套
    const voucher = await this.db.get('vouchers', id);
    if (!voucher || voucher.accountSetId !== this.accountSetId) {
      return;
    }

    const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');

    // 删除关联的分录
    const entries = await this.db.getAllFromIndex('entries', 'by-voucher', id);
    const filteredEntries = entries.filter(entry => entry.accountSetId === this.accountSetId);
    for (const entry of filteredEntries) {
      await tx.objectStore('entries').delete(entry.id);
    }

    // 删除凭证
    await tx.objectStore('vouchers').delete(id);

    await tx.done;
  }

  // ========== 科目操作 ==========

  async saveSubjects(subjects: Subject[]): Promise<void> {
    const tx = this.db.transaction('subjects', 'readwrite');

    for (const subject of subjects) {
      const subjectWithAccountSet = {
        ...subject,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('subjects').put(subjectWithAccountSet);
    }

    await tx.done;
  }

  async getAllSubjects(): Promise<Subject[]> {
    return await this.getAllFromIndexSafe('subjects', 'by-accountSet', this.accountSetId);
  }

  async getSubjectByCode(code: string): Promise<Subject | undefined> {
    const allSubjects = await this.getAllFromIndexSafe('subjects', 'by-accountSet', this.accountSetId);
    return allSubjects.find(s => s.code === code);
  }

  // ========== 部门操作 ==========

  async saveDepartments(departments: Department[]): Promise<void> {
    const tx = this.db.transaction('departments', 'readwrite');

    for (const dept of departments) {
      const deptWithAccountSet = {
        ...dept,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('departments').put(deptWithAccountSet);
    }

    await tx.done;
  }

  async getAllDepartments(): Promise<Department[]> {
    return await this.getAllFromIndexSafe('departments', 'by-accountSet', this.accountSetId);
  }

  async getDepartmentByCode(code: string): Promise<Department | undefined> {
    const allDepartments = await this.getAllFromIndexSafe('departments', 'by-accountSet', this.accountSetId);
    return allDepartments.find(d => d.code === code);
  }

  // ========== 项目操作 ==========

  async saveProjects(projects: Project[]): Promise<void> {
    const tx = this.db.transaction('projects', 'readwrite');

    for (const project of projects) {
      const projectWithAccountSet = {
        ...project,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('projects').put(projectWithAccountSet);
    }

    await tx.done;
  }

  async getAllProjects(): Promise<Project[]> {
    return await this.getAllFromIndexSafe('projects', 'by-accountSet', this.accountSetId);
  }

  async getProjectByCode(code: string): Promise<Project | undefined> {
    const allProjects = await this.getAllFromIndexSafe('projects', 'by-accountSet', this.accountSetId);
    return allProjects.find(p => p.code === code);
  }

  // ========== 币别操作 ==========

  async saveCurrencies(currencies: Currency[]): Promise<void> {
    const tx = this.db.transaction('currencies', 'readwrite');

    for (const currency of currencies) {
      const currencyWithAccountSet = {
        ...currency,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('currencies').put(currencyWithAccountSet);
    }

    await tx.done;
  }

  async getAllCurrencies(): Promise<Currency[]> {
    return await this.getAllFromIndexSafe('currencies', 'by-accountSet', this.accountSetId);
  }

  async getCurrencyByCode(code: string): Promise<Currency | undefined> {
    const allCurrencies = await this.getAllFromIndexSafe('currencies', 'by-accountSet', this.accountSetId);
    return allCurrencies.find(c => c.code === code);
  }

  // ========== 往来单位操作 ==========

  async savePartners(partners: Partner[]): Promise<void> {
    const tx = this.db.transaction('partners', 'readwrite');

    for (const partner of partners) {
      const partnerWithAccountSet = {
        ...partner,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('partners').put(partnerWithAccountSet);
    }

    await tx.done;
  }

  async getAllPartners(): Promise<Partner[]> {
    return await this.getAllFromIndexSafe('partners', 'by-accountSet', this.accountSetId);
  }

  async getPartnerByCode(code: string): Promise<Partner | undefined> {
    const allPartners = await this.getAllFromIndexSafe('partners', 'by-accountSet', this.accountSetId);
    return allPartners.find(p => p.code === code);
  }

  // ========== 凭证模板操作 ==========

  async saveVoucherTemplates(templates: VoucherTemplate[]): Promise<void> {
    const tx = this.db.transaction('voucherTemplates', 'readwrite');

    for (const template of templates) {
      const templateWithAccountSet = {
        ...template,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('voucherTemplates').put(templateWithAccountSet);
    }

    await tx.done;
  }

  async getAllVoucherTemplates(): Promise<VoucherTemplate[]> {
    return await this.getAllFromIndexSafe('voucherTemplates', 'by-accountSet', this.accountSetId);
  }

  async getVoucherTemplateById(id: string): Promise<VoucherTemplate | undefined> {
    const template = await this.db.get('voucherTemplates', id);
    return template && template.accountSetId === this.accountSetId ? template : undefined;
  }

  // ========== 常用摘要操作 ==========

  async saveCommonSummaries(summaries: CommonSummary[]): Promise<void> {
    const tx = this.db.transaction('commonSummaries', 'readwrite');

    for (const summary of summaries) {
      const summaryWithAccountSet = {
        ...summary,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('commonSummaries').put(summaryWithAccountSet);
    }

    await tx.done;
  }

  async getAllCommonSummaries(): Promise<CommonSummary[]> {
    return await this.getAllFromIndexSafe('commonSummaries', 'by-accountSet', this.accountSetId);
  }

  // ========== 用户偏好操作 ==========

  async savePreference(preference: UserPreference): Promise<void> {
    const tx = this.db.transaction('userPreferences', 'readwrite');
    const preferenceWithAccountSet = {
      ...preference,
      accountSetId: this.accountSetId
    };
    await tx.objectStore('userPreferences').put(preferenceWithAccountSet);
    await tx.done;
  }

  async getPreferencesByUser(userId: string): Promise<UserPreference[]> {
    const allPreferences = await this.getAllFromIndexSafe('userPreferences', 'by-accountSet', this.accountSetId);
    return allPreferences.filter(p => (p as any).userId === userId);
  }

  // ========== 审计日志操作 ==========

  async addAuditLog(log: AuditLog): Promise<void> {
    const tx = this.db.transaction('auditLogs', 'readwrite');
    const logWithAccountSet = {
      ...log,
      accountSetId: this.accountSetId
    };
    await tx.objectStore('auditLogs').put(logWithAccountSet);
    await tx.done;
  }

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const allLogs = await this.getAllFromIndexSafe('auditLogs', 'by-accountSet', this.accountSetId);
    return allLogs.slice(0, limit);
  }

  // ========== 数据导出/导入 ==========

  async exportData() {
    return {
      vouchers: await this.getAllVouchers(),
      subjects: await this.getAllSubjects(),
      departments: await this.getAllDepartments(),
      projects: await this.getAllProjects(),
      currencies: await this.getAllCurrencies(),
      partners: await this.getAllPartners(),
      voucherTemplates: await this.getAllVoucherTemplates(),
      commonSummaries: await this.getAllCommonSummaries(),
      preferences: await this.getPreferencesByUser('current-user'),
      auditLogs: await this.getAuditLogs(1000),
      recRelations: await this.getAllFromIndexSafe('recRelations', 'by-accountSet', this.accountSetId),
      exportDate: new Date().toISOString(),
      version: '3.0'
    };
  }

  async importData(data: any) {
    const tx = this.db.transaction([
      'vouchers',
      'entries',
      'subjects',
      'departments',
      'projects',
      'currencies',
      'partners',
      'voucherTemplates',
      'commonSummaries',
      'userPreferences',
      'auditLogs',
      'recRelations'
    ], 'readwrite');

    // 导入凭证
    if (data.vouchers) {
      for (const voucher of data.vouchers) {
        const voucherWithAccountSet = {
          ...voucher,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('vouchers').put(voucherWithAccountSet);
        for (const entry of voucher.entries) {
          const entryWithAccountSet = {
            ...entry,
            accountSetId: this.accountSetId,
            voucherId: voucher.id
          };
          await tx.objectStore('entries').put(entryWithAccountSet);
        }
      }
    }

    // 导入科目
    if (data.subjects) {
      for (const subject of data.subjects) {
        const subjectWithAccountSet = {
          ...subject,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('subjects').put(subjectWithAccountSet);
      }
    }

    // 导入部门
    if (data.departments) {
      for (const dept of data.departments) {
        const deptWithAccountSet = {
          ...dept,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('departments').put(deptWithAccountSet);
      }
    }

    // 导入项目
    if (data.projects) {
      for (const project of data.projects) {
        const projectWithAccountSet = {
          ...project,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('projects').put(projectWithAccountSet);
      }
    }

    // 导入币别
    if (data.currencies) {
      for (const currency of data.currencies) {
        const currencyWithAccountSet = {
          ...currency,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('currencies').put(currencyWithAccountSet);
      }
    }

    // 导入往来单位
    if (data.partners) {
      for (const partner of data.partners) {
        const partnerWithAccountSet = {
          ...partner,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('partners').put(partnerWithAccountSet);
      }
    }

    // 导入凭证模板
    if (data.voucherTemplates) {
      for (const template of data.voucherTemplates) {
        const templateWithAccountSet = {
          ...template,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('voucherTemplates').put(templateWithAccountSet);
      }
    }

    // 导入常用摘要
    if (data.commonSummaries) {
      for (const summary of data.commonSummaries) {
        const summaryWithAccountSet = {
          ...summary,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('commonSummaries').put(summaryWithAccountSet);
      }
    }

    // 导入用户偏好
    if (data.preferences) {
      for (const pref of data.preferences) {
        const prefWithAccountSet = {
          ...pref,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('userPreferences').put(prefWithAccountSet);
      }
    }

    // 导入审计日志
    if (data.auditLogs) {
      for (const log of data.auditLogs) {
        const logWithAccountSet = {
          ...log,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('auditLogs').put(logWithAccountSet);
      }
    }

    // 导入核销关系
    if (data.recRelations) {
      for (const relation of data.recRelations) {
        const relationWithAccountSet = {
          ...relation,
          accountSetId: this.accountSetId
        };
        await tx.objectStore('recRelations').put(relationWithAccountSet);
      }
    }

    await tx.done;
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

    console.log('All data synchronized to IndexedDB');
  }

  async restoreAllData() {
    const data: any = {};

    // 恢复凭证数据
    data.vouchers = await this.getAllVouchers();

    // 恢复科目数据
    data.subjects = await this.getAllSubjects();

    // 恢复部门数据
    data.departments = await this.getAllDepartments();

    // 恢复项目数据
    data.projects = await this.getAllProjects();

    // 恢复其他数据
    data.currencies = await this.getAllCurrencies();
    data.partners = await this.getAllPartners();
    data.voucherTemplates = await this.getAllVoucherTemplates();
    data.commonSummaries = await this.getAllCommonSummaries();

    return data;
  }

  // ========== 核销关系操作 ==========

  async saveRecRelations(relations: any[]): Promise<void> {
    const tx = this.db.transaction('recRelations', 'readwrite');

    for (const relation of relations) {
      const relationWithAccountSet = {
        ...relation,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('recRelations').put(relationWithAccountSet);
    }

    await tx.done;
  }

  async saveRecRelation(relation: any): Promise<void> {
    const tx = this.db.transaction('recRelations', 'readwrite');
    const relationWithAccountSet = {
      ...relation,
      accountSetId: this.accountSetId
    };
    await tx.objectStore('recRelations').put(relationWithAccountSet);
    await tx.done;
  }

  async getRecRelations(): Promise<any[]> {
    return await this.getAllFromIndexSafe('recRelations', 'by-accountSet', this.accountSetId);
  }

  async updateEntryRecRefNo(entryId: string, recRefNo: string): Promise<void> {
    const tx = this.db.transaction('entries', 'readwrite');
    const entry = await tx.objectStore('entries').get(entryId);
    if (entry) {
      entry.recRefNo = recRefNo;
      await tx.objectStore('entries').put(entry);
    }
    await tx.done;
  }

  async getRecRelationsByRecRefNo(recRefNo: string): Promise<any[]> {
    return await this.getAllFromIndexSafe('recRelations', 'by-recRefNo', recRefNo);
  }

  async getRecRelationsByEntryId(entryId: string): Promise<any[]> {
    const debitRelations = await this.getAllFromIndexSafe('recRelations', 'by-debitEntry', entryId);
    const creditRelations = await this.getAllFromIndexSafe('recRelations', 'by-creditEntry', entryId);
    return [...debitRelations, ...creditRelations];
  }

  async getOutstandingItems(query: any): Promise<any[]> {
    console.log('getOutstandingItems called with query:', query);

    if (!query.partnerName) {
      return [];
    }

    const allEntries = await this.getAllFromIndexSafe('entries', 'by-accountSet', this.accountSetId);
    console.log('All entries count:', allEntries.length);

    // 过滤往来单位分录 - 支持多种匹配方式
    let partnerEntries = allEntries.filter(entry => {
      const matches =
        entry.customerName === query.partnerName ||
        entry.supplierName === query.partnerName ||
        (entry.auxiliary?.customer === query.partnerName) ||
        (entry.auxiliary?.supplier === query.partnerName);

      if (matches) {
        console.log('Matching entry found:', {
          id: entry.id,
          customerName: entry.customerName,
          supplierName: entry.supplierName,
          auxiliary: entry.auxiliary
        });
      }
      return matches;
    });

    console.log('Partner entries after filter:', partnerEntries.length);

    // 科目代码过滤
    if (query.subjectCode) {
      partnerEntries = partnerEntries.filter(entry =>
        entry.subjectCode === query.subjectCode
      );
    }

    // 日期范围过滤
    if (query.startDate && query.endDate) {
      partnerEntries = partnerEntries.filter(entry =>
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

      if (remainingAmount > 0.001) { // 考虑浮点误差
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
    counts.vouchers = (await this.db.getAllFromIndex('vouchers', 'by-accountSet', this.accountSetId)).length;
    counts.entries = (await this.db.getAllFromIndex('entries', 'by-accountSet', this.accountSetId)).length;
    counts.subjects = (await this.db.getAllFromIndex('subjects', 'by-accountSet', this.accountSetId)).length;
    counts.departments = (await this.db.getAllFromIndex('departments', 'by-accountSet', this.accountSetId)).length;
    counts.projects = (await this.db.getAllFromIndex('projects', 'by-accountSet', this.accountSetId)).length;
    counts.currencies = (await this.db.getAllFromIndex('currencies', 'by-accountSet', this.accountSetId)).length;
    counts.partners = (await this.db.getAllFromIndex('partners', 'by-accountSet', this.accountSetId)).length;
    counts.voucherTemplates = (await this.db.getAllFromIndex('voucherTemplates', 'by-accountSet', this.accountSetId)).length;
    counts.commonSummaries = (await this.db.getAllFromIndex('commonSummaries', 'by-accountSet', this.accountSetId)).length;
    counts.userPreferences = (await this.db.getAllFromIndex('userPreferences', 'by-accountSet', this.accountSetId)).length;
    counts.auditLogs = (await this.db.getAllFromIndex('auditLogs', 'by-accountSet', this.accountSetId)).length;
    counts.recRelations = (await this.db.getAllFromIndex('recRelations', 'by-accountSet', this.accountSetId)).length;

    console.log('Data integrity check:', counts);
    return counts;
  }

  // ========== 清空数据 ==========

  async clearAllData() {
    // 清空 vouchers 和 entries
    {
      const allRecords = await this.db.getAllFromIndex('vouchers', 'by-accountSet', this.accountSetId);
      const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');
      for (const record of allRecords) {
        await tx.objectStore('vouchers').delete(record.id);
      }
      const allEntries = await this.db.getAllFromIndex('entries', 'by-accountSet', this.accountSetId);
      for (const record of allEntries) {
        await tx.objectStore('entries').delete(record.id);
      }
      await tx.done;
    }

    // 清空其他表
    const clearSingleStore = async (storeName: 'subjects' | 'departments' | 'projects' | 'currencies' | 'partners' | 'voucherTemplates' | 'commonSummaries' | 'userPreferences' | 'auditLogs' | 'recRelations') => {
      const allRecords = await this.db.getAllFromIndex(storeName, 'by-accountSet', this.accountSetId);
      const tx = this.db.transaction(storeName, 'readwrite');
      for (const record of allRecords) {
        await tx.objectStore(storeName).delete(record.id);
      }
      await tx.done;
    };

    await clearSingleStore('subjects');
    await clearSingleStore('departments');
    await clearSingleStore('projects');
    await clearSingleStore('currencies');
    await clearSingleStore('partners');
    await clearSingleStore('voucherTemplates');
    await clearSingleStore('commonSummaries');
    await clearSingleStore('userPreferences');
    await clearSingleStore('auditLogs');
    await clearSingleStore('recRelations');
  }
}

export const databaseService = new DatabaseService();
