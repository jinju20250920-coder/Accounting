import { openDB, DBSchema, IDBPDatabase } from 'idb';

// 定义数据库结构
interface FinanceDB extends DBSchema {
  vouchers: {
    key: string;
    value: Voucher;
    indexes: {
      'by-date': string;
      'by-status': string;
      'by-created': number;
    };
  };
  entries: {
    key: string;
    value: VoucherEntry;
    indexes: {
      'by-voucher': string;
      'by-subject': string;
    };
  };
  subjects: {
    key: string;
    value: Subject;
    indexes: {
      'by-code': string;
      'by-parent': string;
    };
  };
  departments: {
    key: string;
    value: Department;
    indexes: {
      'by-code': string;
    };
  };
  projects: {
    key: string;
    value: Project;
    indexes: {
      'by-code': string;
    };
  };
  preferences: {
    key: string;
    value: UserPreference;
    indexes: {
      'by-user': string;
    };
  };
  auditLogs: {
    key: string;
    value: AuditLog;
    indexes: {
      'by-timestamp': number;
      'by-type': string;
    };
  };
  keyValues: {
    key: string;
    value: any;
    indexes: {
      'by-key': string;
    };
  };
}

// 数据类型定义
export interface Voucher {
  id: string;
  voucherNo: string;
  date: string;
  summary: string;
  entries: VoucherEntry[];
  status: 'draft' | 'review' | 'posted' | 'reversed';
  voucherType: 'general' | 'payment' | 'receipt' | 'transfer' | 'closing';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

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
  auxiliary?: {
    department?: string;
    project?: string;
    customer?: string;
    supplier?: string;
  };
}

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
  cashFlowItem?: string; // 现金流量项目
  disabled: boolean;
  block: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  frozen: boolean;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  type: 'income' | 'cost' | 'other';
  frozen: boolean;
  startDate?: string;
  endDate?: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  subjectCode: string;
  subjectName: string;
  keyword: string;
  summary: string;
  createdAt: string;
  usedCount: number;
}

export interface AuditLog {
  id: string;
  type: 'create' | 'update' | 'delete' | 'post' | 'reverse';
  entityType: 'voucher' | 'entry' | 'subject' | 'department' | 'project';
  entityId: string;
  details: string;
  userId: string;
  timestamp: string;
}

class DatabaseService {
  private db: IDBPDatabase<FinanceDB> | null = null;
  private readonly DB_NAME = 'finance-assistant-db';
  private readonly DB_VERSION = 1;

  async init() {
    // 检查是否在客户端环境
    if (typeof window === 'undefined') {
      console.log('Server-side: Skipping database initialization');
      return;
    }

    if (this.db) return;

    this.db = await openDB<FinanceDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // 创建凭证表
        const voucherStore = db.createObjectStore('vouchers', { keyPath: 'id' });
        voucherStore.createIndex('by-date', 'date');
        voucherStore.createIndex('by-status', 'status');
        voucherStore.createIndex('by-created', 'createdAt');

        // 创建分录表
        const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
        entryStore.createIndex('by-voucher', 'voucherId');
        entryStore.createIndex('by-subject', 'subjectCode');

        // 创建科目表
        const subjectStore = db.createObjectStore('subjects', { keyPath: 'id' });
        subjectStore.createIndex('by-code', 'code');
        subjectStore.createIndex('by-parent', 'parentId');

        // 创建部门表
        const deptStore = db.createObjectStore('departments', { keyPath: 'id' });
        deptStore.createIndex('by-code', 'code');

        // 创建项目表
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-code', 'code');

        // 创建用户偏好表
        const prefStore = db.createObjectStore('preferences', { keyPath: 'id' });
        prefStore.createIndex('by-user', 'userId');

        // 创建审计日志表
        const auditStore = db.createObjectStore('auditLogs', { keyPath: 'id' });
        auditStore.createIndex('by-timestamp', 'timestamp');
        auditStore.createIndex('by-type', 'type');

        // 创建通用键值存储表
        const keyValueStore = db.createObjectStore('keyValues', { keyPath: 'id' });
        keyValueStore.createIndex('by-key', 'key');
      },
    });
  }

  // 凭证操作
  async saveVoucher(voucher: Voucher) {
    await this.init();

    // 保存凭证
    await this.db!.put('vouchers', voucher);

    // 保存或更新分录
    for (const entry of voucher.entries) {
      await this.db!.put('entries', {
        ...entry,
        voucherId: voucher.id
      });
    }
  }

  async getVoucher(id: string): Promise<Voucher | undefined> {
    await this.init();
    const voucher = await this.db!.get('vouchers', id);

    if (!voucher) return undefined;

    // 获取相关的分录
    const entries = await this.db!.getAllFromIndex('entries', 'by-voucher', voucher.id);
    return {
      ...voucher,
      entries
    };
  }

  async getAllVouchers(): Promise<Voucher[]> {
    await this.init();
    const vouchers = await this.db!.getAll('vouchers');

    // 为每个凭证加载分录
    const vouchersWithEntries = await Promise.all(
      vouchers.map(async (voucher) => {
        const entries = await this.db!.getAllFromIndex('entries', 'by-voucher', voucher.id);
        return {
          ...voucher,
          entries
        };
      })
    );

    return vouchersWithEntries;
  }

  async getVouchersByDateRange(startDate: string, endDate: string): Promise<Voucher[]> {
    await this.init();
    const vouchers = await this.db!.getAllFromIndex('vouchers', 'by-date',
      IDBKeyRange.bound(startDate, endDate));

    const vouchersWithEntries = await Promise.all(
      vouchers.map(async (voucher) => {
        const entries = await this.db!.getAllFromIndex('entries', 'by-voucher', voucher.id);
        return {
          ...voucher,
          entries
        };
      })
    );

    return vouchersWithEntries;
  }

  async getVouchersByStatus(status: 'draft' | 'review' | 'posted' | 'reversed'): Promise<Voucher[]> {
    await this.init();
    const vouchers = await this.db!.getAllFromIndex('vouchers', 'by-status', status);

    const vouchersWithEntries = await Promise.all(
      vouchers.map(async (voucher) => {
        const entries = await this.db!.getAllFromIndex('entries', 'by-voucher', voucher.id);
        return {
          ...voucher,
          entries
        };
      })
    );

    return vouchersWithEntries;
  }

  async deleteVoucher(id: string) {
    await this.init();
    await this.db!.delete('vouchers', id);

    // 删除相关分录
    const entries = await this.db!.getAllFromIndex('entries', 'by-voucher', id);
    for (const entry of entries) {
      await this.db!.delete('entries', entry.id);
    }
  }

  // 科目操作
  async saveSubjects(subjects: Subject[]) {
    await this.init();
    const tx = this.db!.transaction('subjects', 'readwrite');
    const store = tx.objectStore('subjects');
    for (const subject of subjects) {
      await store.put(subject);
    }
    await tx.done;
  }

  async getAllSubjects(): Promise<Subject[]> {
    await this.init();
    return await this.db!.getAll('subjects');
  }

  async getSubjectByCode(code: string): Promise<Subject | undefined> {
    await this.init();
    return await this.db!.getFromIndex('subjects', 'by-code', code);
  }

  // 部门操作
  async saveDepartments(departments: Department[]) {
    await this.init();
    const tx = this.db!.transaction('departments', 'readwrite');
    const store = tx.objectStore('departments');
    for (const dept of departments) {
      await store.put(dept);
    }
    await tx.done;
  }

  async getAllDepartments(): Promise<Department[]> {
    await this.init();
    return await this.db!.getAll('departments');
  }

  // 项目操作
  async saveProjects(projects: Project[]) {
    await this.init();
    const tx = this.db!.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    for (const project of projects) {
      await store.put(project);
    }
    await tx.done;
  }

  async getAllProjects(): Promise<Project[]> {
    await this.init();
    return await this.db!.getAll('projects');
  }

  // 用户偏好操作
  async savePreference(preference: UserPreference) {
    await this.init();
    await this.db!.put('preferences', preference);
  }

  async getPreferencesByUser(userId: string): Promise<UserPreference[]> {
    await this.init();
    return await this.db!.getAllFromIndex('preferences', 'by-user', userId);
  }

  // 审计日志操作
  async addAuditLog(log: AuditLog) {
    await this.init();
    await this.db!.put('auditLogs', log);
  }

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    await this.init();
    return await this.db!.getAllFromIndex('auditLogs', 'by-timestamp', undefined, limit);
  }

  // 数据导出
  async exportData() {
    await this.init();

    return {
      vouchers: await this.getAllVouchers(),
      subjects: await this.getAllSubjects(),
      departments: await this.getAllDepartments(),
      projects: await this.getAllProjects(),
      preferences: await this.getPreferencesByUser('current-user'),
      auditLogs: await this.getAuditLogs(1000),
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  // 数据导入
  async importData(data: any) {
    await this.init();

    const tx = this.db!.transaction([
      'vouchers',
      'entries',
      'subjects',
      'departments',
      'projects',
      'preferences'
    ], 'readwrite');

    // 导入凭证
    if (data.vouchers) {
      for (const voucher of data.vouchers) {
        tx.objectStore('vouchers').put(voucher);
        const entryStore = tx.objectStore('entries');
        for (const entry of voucher.entries) {
          await entryStore.put(entry);
        }
      }
    }

    // 导入科目
    if (data.subjects) {
      const subjectStore = tx.objectStore('subjects');
      for (const subject of data.subjects) {
        await subjectStore.put(subject);
      }
    }

    // 导入部门
    if (data.departments) {
      const deptStore = tx.objectStore('departments');
      for (const dept of data.departments) {
        await deptStore.put(dept);
      }
    }

    // 导入项目
    if (data.projects) {
      const projectStore = tx.objectStore('projects');
      for (const project of data.projects) {
        await projectStore.put(project);
      }
    }

    // 导入偏好
    if (data.preferences) {
      const prefStore = tx.objectStore('preferences');
      for (const pref of data.preferences) {
        await prefStore.put(pref);
      }
    }

    await tx.done;
  }

  // 清空所有数据
  async clearAllData() {
    await this.init();
    const tx = this.db!.transaction([
      'vouchers',
      'entries',
      'subjects',
      'departments',
      'projects',
      'preferences',
      'auditLogs'
    ], 'readwrite');

    await tx.objectStore('vouchers').clear();
    await tx.objectStore('entries').clear();
    await tx.objectStore('subjects').clear();
    await tx.objectStore('departments').clear();
    await tx.objectStore('projects').clear();
    await tx.objectStore('preferences').clear();
    await tx.objectStore('auditLogs').clear();

    await tx.done;
  }

  // 通用键值存储
  async set(key: string, value: any) {
    await this.init();

    // 使用一个通用对象存储所有简单键值对
    const keyValue = {
      id: `key-${key}`,
      key,
      value,
      timestamp: Date.now()
    };

    await this.db!.put('keyValues', keyValue);
  }

  async get(key: string): Promise<any | null> {
    await this.init();
    const keyValue = await this.db!.get('keyValues', `key-${key}`);
    return keyValue ? keyValue.value : null;
  }

  async delete(key: string) {
    await this.init();
    await this.db!.delete('keyValues', `key-${key}`);
  }
}

// 导出单例实例
export const database = new DatabaseService();