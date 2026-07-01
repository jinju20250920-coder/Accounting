import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface FinanceDB extends DBSchema {
  recRelations: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-recRefNo': string;
      'by-debitEntry': string;
      'by-creditEntry': string;
      'by-partner': string;
      'by-date': string;
    };
  };
  accountSets: {
    key: string;
    value: unknown;
    indexes: {
      'by-code': string;
    };
  };
  vouchers: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-date': string;
      'by-status': string;
      'by-voucherNo': string;
    };
  };
  entries: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-voucher': string;
      'by-subject': string;
      'by-date': string;
      'by-recRefNo': string;
    };
  };
  subjects: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
      'by-parent': string;
    };
  };
  departments: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };
  projects: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };
  currencies: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };
  fxRates: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-rateDate': string;
      'by-currencyCode': string;
    };
  };
  bank_account_bindings: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-accountNumber': string;
    };
  };
  fxRevaluationRuns: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-period': string;
    };
  };
  fxRevaluationRunLines: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-runId': string;
      'by-sourceType': string;
    };
  };
  partners: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };
  voucherTemplates: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
    };
  };
  commonSummaries: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
    };
  };
  userPreferences: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
    };
  };
  auditLogs: {
    key: string;
    value: unknown;
    indexes: {
      'by-accountSet': string;
    };
  };
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private db: IDBPDatabase<FinanceDB> | null = null;
  private currentAccountSetId: string | null = null;
  private initPromise: Promise<void> | null = null;

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    this.db = await openDB<FinanceDB>('finance-assistant-db', 6, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`数据库升级: 版本 ${oldVersion} -> ${newVersion}`);

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

        if (!db.objectStoreNames.contains('fxRates')) {
          const fxRatesStore = db.createObjectStore('fxRates', { keyPath: 'id' });
          fxRatesStore.createIndex('by-accountSet', 'accountSetId');
          fxRatesStore.createIndex('by-rateDate', 'rateDate');
          fxRatesStore.createIndex('by-currencyCode', 'currencyCode');
        }

        if (!db.objectStoreNames.contains('bank_account_bindings')) {
          const bankBindingsStore = db.createObjectStore('bank_account_bindings', { keyPath: 'id' });
          bankBindingsStore.createIndex('by-accountSet', 'accountSetId');
          bankBindingsStore.createIndex('by-accountNumber', 'accountNumber');
        }

        if (!db.objectStoreNames.contains('fxRevaluationRuns')) {
          const fxRevaluationRunsStore = db.createObjectStore('fxRevaluationRuns', { keyPath: 'id' });
          fxRevaluationRunsStore.createIndex('by-accountSet', 'accountSetId');
          fxRevaluationRunsStore.createIndex('by-period', 'period');
        }

        if (!db.objectStoreNames.contains('fxRevaluationRunLines')) {
          const fxRevaluationRunLinesStore = db.createObjectStore('fxRevaluationRunLines', { keyPath: 'id' });
          fxRevaluationRunLinesStore.createIndex('by-accountSet', 'accountSetId');
          fxRevaluationRunLinesStore.createIndex('by-runId', 'runId');
          fxRevaluationRunLinesStore.createIndex('by-sourceType', 'sourceType');
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

        // 创建核销关系表（版本4）
        if (!db.objectStoreNames.contains('recRelations')) {
          console.log('创建 recRelations 表');
          const recRelationsStore = db.createObjectStore('recRelations', { keyPath: 'id' });
          recRelationsStore.createIndex('by-accountSet', 'accountSetId');
          recRelationsStore.createIndex('by-recRefNo', 'recRefNo');
          recRelationsStore.createIndex('by-debitEntry', 'debitEntryId');
          recRelationsStore.createIndex('by-creditEntry', 'creditEntryId');
          recRelationsStore.createIndex('by-date', 'recDate');
        }

        // 为entries表添加recRefNo字段的索引
        const entriesStore = transaction.objectStore('entries');
        try {
          entriesStore.createIndex('by-recRefNo', 'recRefNo');
        } catch (error) {
          // 索引已存在，忽略错误
          console.log('by-recRefNo 索引已存在');
        }
      },
    });
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

  getDatabase(): IDBPDatabase<FinanceDB> {
    if (!this.db) {
      // 如果数据库未初始化，抛出更友好的错误
      console.warn('Database not initialized, attempting to initialize...');
      throw new Error('Database not initialized. Please ensure database is initialized before use.');
    }
    return this.db;
  }

  /**
   * 安全获取数据库，如果未初始化则等待初始化
   * 使用这个方法而不是 getDatabase() 来避免初始化时序问题
   */
  async getDatabaseSafe(): Promise<IDBPDatabase<FinanceDB>> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  /**
   * 检查数据库是否已初始化
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  // ========== 数据导出/导入 ==========

  async exportData() {
    const db = this.getDatabase();
    const accountSetId = this.getCurrentAccountSetId();

    if (!accountSetId) {
      throw new Error('No account set selected');
    }

    const vouchers = await db.getAllFromIndex('vouchers', 'by-accountSet', accountSetId);

    // 为每个凭证加载分录
    const vouchersWithEntries = await Promise.all(
      vouchers.map(async (voucher) => {
        const entries = await db.getAllFromIndex('entries', 'by-voucher', voucher.id);
        const filteredEntries = entries.filter(entry => entry.accountSetId === accountSetId);
        return {
          ...voucher,
          entries: filteredEntries
        };
      })
    );

    return {
      vouchers: vouchersWithEntries,
      subjects: await db.getAllFromIndex('subjects', 'by-accountSet', accountSetId),
      departments: await db.getAllFromIndex('departments', 'by-accountSet', accountSetId),
      projects: await db.getAllFromIndex('projects', 'by-accountSet', accountSetId),
      currencies: await db.getAllFromIndex('currencies', 'by-accountSet', accountSetId),
      partners: await db.getAllFromIndex('partners', 'by-accountSet', accountSetId),
      voucherTemplates: await db.getAllFromIndex('voucherTemplates', 'by-accountSet', accountSetId),
      commonSummaries: await db.getAllFromIndex('commonSummaries', 'by-accountSet', accountSetId),
      preferences: await db.getAllFromIndex('userPreferences', 'by-accountSet', accountSetId),
      auditLogs: await db.getAllFromIndex('auditLogs', 'by-accountSet', accountSetId),
      exportDate: new Date().toISOString(),
      version: '3.0'
    };
  }

  async importData(data: Record<string, unknown>): Promise<void> {
    const db = this.getDatabase();
    const accountSetId = this.getCurrentAccountSetId();

    if (!accountSetId) {
      throw new Error('No account set selected');
    }

    const tx = db.transaction([
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
      'auditLogs'
    ], 'readwrite');

    // 导入凭证
    if (data.vouchers) {
      for (const voucher of data.vouchers) {
        const voucherWithAccountSet = {
          ...voucher,
          accountSetId
        };
        await tx.objectStore('vouchers').put(voucherWithAccountSet);
        for (const entry of voucher.entries) {
          const entryWithAccountSet = {
            ...entry,
            accountSetId,
            voucherId: voucher.id
          };
          await tx.objectStore('entries').put(entryWithAccountSet);
        }
      }
    }

    // 导入科目
    if (data.subjects) {
      for (const subject of data.subjects) {
        await tx.objectStore('subjects').put({ ...subject, accountSetId });
      }
    }

    // 导入部门
    if (data.departments) {
      for (const dept of data.departments) {
        await tx.objectStore('departments').put({ ...dept, accountSetId });
      }
    }

    // 导入项目
    if (data.projects) {
      for (const project of data.projects) {
        await tx.objectStore('projects').put({ ...project, accountSetId });
      }
    }

    // 导入币别
    if (data.currencies) {
      for (const currency of data.currencies) {
        await tx.objectStore('currencies').put({ ...currency, accountSetId });
      }
    }

    // 导入往来单位
    if (data.partners) {
      for (const partner of data.partners) {
        await tx.objectStore('partners').put({ ...partner, accountSetId });
      }
    }

    // 导入凭证模板
    if (data.voucherTemplates) {
      for (const template of data.voucherTemplates) {
        await tx.objectStore('voucherTemplates').put({ ...template, accountSetId });
      }
    }

    // 导入常用摘要
    if (data.commonSummaries) {
      for (const summary of data.commonSummaries) {
        await tx.objectStore('commonSummaries').put({ ...summary, accountSetId });
      }
    }

    // 导入用户偏好
    if (data.preferences) {
      for (const pref of data.preferences) {
        await tx.objectStore('userPreferences').put({ ...pref, accountSetId });
      }
    }

    // 导入审计日志
    if (data.auditLogs) {
      for (const log of data.auditLogs) {
        await tx.objectStore('auditLogs').put({ ...log, accountSetId });
      }
    }

    await tx.done;
  }
}

export const databaseManager = DatabaseManager.getInstance();
