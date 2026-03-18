import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface FinanceDB extends DBSchema {
  accountSets: {
    key: string;
    value: any;
    indexes: {
      'by-code': string;
    };
  };
  vouchers: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
      'by-date': string;
      'by-status': string;
      'by-voucherNo': string;
    };
  };
  entries: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
      'by-voucher': string;
      'by-subject': string;
      'by-date': string;
    };
  };
  subjects: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
      'by-parent': string;
    };
  };
  departments: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };
  projects: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };
  currencies: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };
  partners: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };
  voucherTemplates: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
    };
  };
  commonSummaries: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
    };
  };
  userPreferences: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
    };
  };
  auditLogs: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
    };
  };
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private db: IDBPDatabase<FinanceDB> | null = null;
  private currentAccountSetId: string | null = null;

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<FinanceDB>('finance-assistant-db', 1, {
      upgrade(db) {
        // 创建账套元数据表
        if (!db.objectStoreNames.contains('accountSets')) {
          const accountSetsStore = db.createObjectStore('accountSets', { keyPath: 'id' });
          accountSetsStore.createIndex('by-code', 'code');
        }

        // 创建凭证表
        if (!db.objectStoreNames.contains('vouchers')) {
          const vouchersStore = db.createObjectStore('vouchers', { keyPath: 'id' });
          vouchersStore.createIndex('by-accountSet', 'accountSetId');
          vouchersStore.createIndex('by-date', 'date');
          vouchersStore.createIndex('by-status', 'status');
          vouchersStore.createIndex('by-voucherNo', 'voucherNo');
        }

        // 创建分录表
        if (!db.objectStoreNames.contains('entries')) {
          const entriesStore = db.createObjectStore('entries', { keyPath: 'id' });
          entriesStore.createIndex('by-accountSet', 'accountSetId');
          entriesStore.createIndex('by-voucher', 'voucherId');
          entriesStore.createIndex('by-subject', 'subjectCode');
          entriesStore.createIndex('by-date', 'date');
        }

        // 创建科目表
        if (!db.objectStoreNames.contains('subjects')) {
          const subjectsStore = db.createObjectStore('subjects', { keyPath: 'id' });
          subjectsStore.createIndex('by-accountSet', 'accountSetId');
          subjectsStore.createIndex('by-code', 'code');
          subjectsStore.createIndex('by-parent', 'parentId');
        }

        // 创建部门表
        if (!db.objectStoreNames.contains('departments')) {
          const deptStore = db.createObjectStore('departments', { keyPath: 'id' });
          deptStore.createIndex('by-accountSet', 'accountSetId');
          deptStore.createIndex('by-code', 'code');
        }

        // 创建项目表
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-accountSet', 'accountSetId');
          projectStore.createIndex('by-code', 'code');
        }

        // 创建货币表
        if (!db.objectStoreNames.contains('currencies')) {
          const currencyStore = db.createObjectStore('currencies', { keyPath: 'id' });
          currencyStore.createIndex('by-accountSet', 'accountSetId');
          currencyStore.createIndex('by-code', 'code');
        }

        // 创建往来单位表
        if (!db.objectStoreNames.contains('partners')) {
          const partnerStore = db.createObjectStore('partners', { keyPath: 'id' });
          partnerStore.createIndex('by-accountSet', 'accountSetId');
          partnerStore.createIndex('by-code', 'code');
        }

        // 创建凭证模板表
        if (!db.objectStoreNames.contains('voucherTemplates')) {
          const templateStore = db.createObjectStore('voucherTemplates', { keyPath: 'id' });
          templateStore.createIndex('by-accountSet', 'accountSetId');
        }

        // 创建常用摘要表
        if (!db.objectStoreNames.contains('commonSummaries')) {
          const summaryStore = db.createObjectStore('commonSummaries', { keyPath: 'id' });
          summaryStore.createIndex('by-accountSet', 'accountSetId');
        }

        // 创建用户偏好表
        if (!db.objectStoreNames.contains('userPreferences')) {
          const prefStore = db.createObjectStore('userPreferences', { keyPath: 'id' });
          prefStore.createIndex('by-accountSet', 'accountSetId');
        }

        // 创建审计日志表
        if (!db.objectStoreNames.contains('auditLogs')) {
          const auditStore = db.createObjectStore('auditLogs', { keyPath: 'id' });
          auditStore.createIndex('by-accountSet', 'accountSetId');
        }
      },
    });
  }

  async switchAccountSet(accountSetId: string): Promise<void> {
    this.currentAccountSetId = accountSetId;
  }

  getCurrentAccountSetId(): string | null {
    return this.currentAccountSetId;
  }

  getDatabase(): IDBPDatabase<FinanceDB> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }
}

export const databaseManager = DatabaseManager.getInstance();
