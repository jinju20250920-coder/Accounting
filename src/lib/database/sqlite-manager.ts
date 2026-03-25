import initSqlJs from 'sql.js';

// File System Access API types
interface FileSystemHandleHelper {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  isSameEntry: (other: FileSystemHandle) => Promise<boolean>;
  queryPermission: (mode: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
  requestPermission: (mode: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
}

interface HandleStorageData {
  handle: FileSystemHandleHelper;
  lastModified: number;
}

class SQLiteManager {
  private static instance: SQLiteManager;
  private db: any = null;
  private currentAccountSetId: string | null = null;
  private initPromise: Promise<void> | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private DB_STORAGE_KEY = 'sqljs-finance-db';
  private DB_FILE_NAME = 'finance-assistant.db';
  private isElectron: boolean = false;
  private dbPath: string | null = null;
  private opfsHandle: FileSystemHandleHelper | null = null;
  private useOPFS: boolean = false;
  private useFileSystemAccess: boolean = false; // 使用 File System Access API
  private HANDLE_STORAGE_KEY = 'sqlite-db-handle'; // IndexedDB 存储键
  private dbHandle: FileSystemHandleHelper | null = null; // 持久化的文件句柄

  static getInstance(): SQLiteManager {
    if (!SQLiteManager.instance) {
      SQLiteManager.instance = new SQLiteManager();
    }
    return SQLiteManager.instance;
  }

  constructor() {
    // 检测是否是 Electron 环境
    this.isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron?.();

    // 检测是否支持 File System Access API (Chrome 86+, Edge 86+, Opera 72+)
    // Firefox 需要设置 about:config 中的 dom.fs.enabled = true
    if (typeof window !== 'undefined' && !this.isElectron) {
      this.useFileSystemAccess = 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;

      if (this.useFileSystemAccess) {
        console.log('File System Access API is supported, database can be stored on disk');
      } else {
        // 后备方案：检测 OPFS
        this.useOPFS = 'storage' in navigator && 'getDirectory' in (navigator.storage as any);
        if (this.useOPFS) {
          console.log('OPFS is supported, database will be stored in persistent file storage');
        } else {
          console.warn('File System Access API and OPFS not supported, falling back to localStorage');
        }
      }
    }
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

      if (this.isElectron) {
        // Electron 环境 - 尝试加载或创建磁盘文件数据库
        await this.initializeElectronDatabase(SQL);
      } else if (this.useOPFS) {
        // 浏览器环境 - 使用 OPFS 文件存储
        await this.initializeOPFSDatabase(SQL);
      } else {
        // 浏览器环境 - 使用 localStorage (后备方案)
        this.initializeBrowserDatabase(SQL);
      }

      // Start auto-save timer
      this.startAutoSave();
    } catch (error) {
      console.error('SQLite initialization failed:', error);
      // Fallback to new database
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sqljs/${file}`,
      });
      this.db = new SQL.Database();
      this.createTables();
      console.log('SQLite database initialized with fallback');
    }
  }

  private async initializeElectronDatabase(SQL: any): Promise<void> {
    // 首先尝试获取已保存的数据库路径或使用默认路径
    let dbPath = await window.electronAPI.getDbPath();

    if (!dbPath) {
      // 检查是否有默认路径的文件
      const defaultPath = await window.electronAPI.getDefaultDbPath();
      const fileExists = await window.electronAPI.fileExists(defaultPath);

      if (fileExists) {
        dbPath = defaultPath;
        await window.electronAPI.setDbPath(defaultPath);
        console.log(`Using default database at: ${defaultPath}`);
      } else {
        // 没有找到数据库，创建新的默认数据库
        console.log(`Creating new database at: ${defaultPath}`);
        this.db = new SQL.Database();
        this.createTables();
        this.dbPath = defaultPath;
        await window.electronAPI.setDbPath(defaultPath);
        await this.saveDatabase(); // 保存新数据库
        return;
      }
    }

    // 尝试加载数据库
    try {
      const loadedData = await window.electronAPI.loadDb();
      if (loadedData) {
        this.db = new SQL.Database(new Uint8Array(loadedData));
        this.dbPath = dbPath;
        console.log('SQLite database loaded from disk successfully');
      } else {
        // 没有找到数据库，创建新的
        this.db = new SQL.Database();
        this.createTables();
        this.dbPath = dbPath;
        console.log('SQLite database initialized successfully (new database)');
        await this.saveDatabase(); // 保存新数据库
      }
    } catch (error) {
      console.error('Failed to load database from disk:', error);
      // 加载失败，创建新数据库
      this.db = new SQL.Database();
      this.createTables();
      this.dbPath = dbPath;
      console.log('SQLite database initialized with fallback');
    }
  }

  private async initializeOPFSDatabase(SQL: any): Promise<void> {
    try {
      // 获取 OPFS 根目录
      const opfsRoot = await (navigator.storage as any).getDirectory();

      // 尝试打开现有数据库文件
      let dbExists = false;
      try {
        // 检查文件是否存在
        await opfsRoot.getFileHandle(this.DB_FILE_NAME);
        dbExists = true;
        console.log('Existing OPFS database file found');
      } catch {
        console.log('No existing OPFS database file, will create new one');
      }

      if (dbExists) {
        // 打开现有文件并加载数据
        this.opfsHandle = await opfsRoot.getFileHandle(this.DB_FILE_NAME);
        const file = await this.opfsHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        if (uint8Array.length > 0) {
          this.db = new SQL.Database(uint8Array);
          console.log('SQLite database loaded from OPFS successfully');
        } else {
          // 文件为空，创建新数据库
          this.db = new SQL.Database();
          this.createTables();
          console.log('SQLite database initialized (new OPFS database)');
        }
      } else {
        // 创建新数据库文件
        this.opfsHandle = await opfsRoot.getFileHandle(this.DB_FILE_NAME, { create: true });
        this.db = new SQL.Database();
        this.createTables();
        console.log('SQLite database initialized successfully (new OPFS database)');
        // 立即保存新创建的数据库
        await this.saveOPFSDatabase();
      }
    } catch (error) {
      console.error('OPFS initialization failed, falling back to localStorage:', error);
      this.useOPFS = false;
      this.initializeBrowserDatabase(SQL);
    }
  }

  private initializeBrowserDatabase(SQL: any): void {
    const savedDb = this.loadDatabase();

    if (savedDb) {
      // Load existing database
      this.db = new SQL.Database(savedDb);
      console.log('SQLite database loaded from storage successfully');
    } else {
      // Create new database
      this.db = new SQL.Database();
      this.createTables();
      console.log('SQLite database initialized successfully (new database)');
    }
  }


  private async saveDatabase(): Promise<void> {
    try {
      if (this.db) {
        const data = this.db.export();

        if (this.isElectron) {
          // Electron 环境 - 保存到磁盘文件
          await window.electronAPI.saveDb(Array.from(new Uint8Array(data)));
          console.log('Database saved to disk');
        } else if (this.useOPFS) {
          // 浏览器环境 - 使用 OPFS 文件存储
          await this.saveOPFSDatabase();
        } else {
          // 浏览器环境 - 使用 localStorage (后备方案)
          try {
            const uint8Data = new Uint8Array(data);
            // 使用循环而不是 spread 操作符来避免栈溢出
            let binaryString = '';
            const chunkSize = 0x8000; // 32KB chunks
            for (let i = 0; i < uint8Data.length; i += chunkSize) {
              const chunk = uint8Data.subarray(i, i + chunkSize);
              binaryString += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const base64 = btoa(binaryString);
            localStorage.setItem(this.DB_STORAGE_KEY, base64);
          } catch (storageError) {
            console.error('LocalStorage save failed:', storageError);
            // 数据太大，localStorage 无法存储
            console.warn('Database too large for localStorage. Consider using OPFS or Electron mode.');
          }
        }
      }
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  private async saveOPFSDatabase(): Promise<void> {
    if (!this.db || !this.opfsHandle) return;

    try {
      const data = this.db.export();
      const writable = await this.opfsHandle.createWritable();
      await writable.write(data);
      await writable.close();

      // 如果支持 sync()，调用它确保数据写入磁盘
      if ('sync' in this.opfsHandle && typeof this.opfsHandle.sync === 'function') {
        await this.opfsHandle.sync();
      }

      console.log('Database saved to OPFS file');
    } catch (error) {
      console.error('Failed to save database to OPFS:', error);
      throw error;
    }
  }

  /**
   * 清理损坏的数据库数据
   */
  async clearCorruptedData(): Promise<void> {
    try {
      if (this.useOPFS) {
        const opfsRoot = await (navigator.storage as any).getDirectory();
        // @ts-ignore - removeEntry 是 OPFS API
        await opfsRoot.removeEntry(this.DB_FILE_NAME);
        this.opfsHandle = null;
        console.log('Corrupted OPFS database file cleared');
      } else {
        localStorage.removeItem(this.DB_STORAGE_KEY);
        console.log('Corrupted database data cleared from localStorage');
      }
    } catch (error) {
      console.error('Failed to clear corrupted data:', error);
    }
  }

  private loadDatabase(): Uint8Array | null {
    try {
      const saved = localStorage.getItem(this.DB_STORAGE_KEY);
      if (saved) {
        // Fixed: Decode entire base64 string at once
        try {
          const binaryString = atob(saved);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes;
        } catch (base64Error) {
          console.error('Base64 decoding failed, clearing corrupted data:', base64Error);
          this.clearCorruptedData();
          return null;
        }
      }
    } catch (error) {
      console.error('Failed to load database, clearing corrupted data:', error);
      this.clearCorruptedData();
    }
    return null;
  }

  /**
   * 估算 OPFS 存储空间使用情况
   */
  async getOPFSUsage(): Promise<{ usage: number; quota: number } | null> {
    if (!this.useOPFS) {
      return null;
    }

    try {
      const estimate = await (navigator.storage as any).estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    } catch (error) {
      console.error('Failed to get OPFS usage:', error);
      return null;
    }
  }

  private startAutoSave(): void {
    // Auto-save every 5 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveDatabase();
    }, 5000);

    if (!this.isElectron && !this.useOPFS) {
      // 仅在 localStorage 环境中使用页面事件 (OPFS 和 Electron 数据已持久化)
      const handleBeforeUnload = () => {
        this.saveDatabase();
      };

      const handlePageHide = () => {
        this.saveDatabase();
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handlePageHide);

      // Cleanup on instance destruction (if needed)
      // For now, we'll just keep the listeners active
    }
  }

  // Manually trigger save
  save(): void {
    this.saveDatabase();
  }

  // Clear corrupted data
  clearData(): void {
    this.clearCorruptedData();
  }

  // Export database for download
  exportDatabase(): Uint8Array {
    return this.db.export();
  }

  // Import database from file
  async importDatabase(data: Uint8Array): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/sqljs/${file}`,
    });
    this.db = new SQL.Database(data);
    this.saveDatabase();
    console.log('Database imported successfully');
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

      -- 发票表
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoiceType TEXT NOT NULL,
        invoiceCode TEXT NOT NULL,
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

  async getDatabaseAsync(): Promise<any> {
    if (!this.db) {
      console.warn('SQLite database not initialized, attempting to initialize...');
      try {
        await this.init();
      } catch (error) {
        console.error('SQLite automatic initialization failed:', error);
        throw new Error('Failed to initialize SQLite database');
      }
    }
    return this.db;
  }

  // 同步版本 - 必须在调用前先调用 init()
  getDatabase(): any {
    if (!this.db) {
      console.warn('SQLite database not initialized, attempting to initialize...');
      // 不在这里做复杂的异步操作
      // 只是记录警告，让调用者知道问题
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

  // 同步获取数据库，如果未初始化则抛出错误
  getDatabaseSync(): any {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
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
      // Map DB fields to type fields for export
      return {
        id: summary.id,
        text: summary.content,
        sortOrder: summary.frequency,
        createTime: summary.createTime,
        updateTime: summary.updateTime,
        accountSetId: summary.accountSetId
      };
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
            summaryWithAccountSet.text || summaryWithAccountSet.content, // Handle both field names
            summaryWithAccountSet.sortOrder || summaryWithAccountSet.frequency || 0, // Handle both field names
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

  // ========== OPFS 辅助方法 ==========

  /**
   * 检查是否正在使用 OPFS 存储
   */
  isUsingOPFS(): boolean {
    return this.useOPFS;
  }

  /**
   * 获取数据库文件信息（仅 OPFS 环境）
   */
  async getDatabaseFileInfo(): Promise<{ name: string; size: number; lastModified: number } | null> {
    if (!this.useOPFS || !this.opfsHandle) {
      return null;
    }

    try {
      const file = await this.opfsHandle.getFile();
      return {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified
      };
    } catch (error) {
      console.error('Failed to get database file info:', error);
      return null;
    }
  }

  /**
   * 下载数据库文件（用于手动备份）
   */
  async downloadDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      const data = this.db.export();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-assistant-${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Database file downloaded');
    } catch (error) {
      console.error('Failed to download database:', error);
      throw error;
    }
  }

  /**
   * 从文件上传并导入数据库
   */
  async uploadDatabase(file: File): Promise<void> {
    try {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sqljs/${file}`,
      });

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      this.db = new SQL.Database(uint8Array);
      await this.saveDatabase();

      console.log('Database file uploaded and imported successfully');
    } catch (error) {
      console.error('Failed to upload database:', error);
      throw error;
    }
  }

  /**
   * 删除 OPFS 数据库文件并重置
   */
  async resetDatabase(): Promise<void> {
    try {
      if (this.useOPFS) {
        const opfsRoot = await (navigator.storage as any).getDirectory();
        // 使用 removeEntry 删除文件
        // @ts-ignore - removeEntry 是 OPFS API
        await opfsRoot.removeEntry(this.DB_FILE_NAME);
        this.opfsHandle = null;
      } else {
        localStorage.removeItem(this.DB_STORAGE_KEY);
      }

      // 重新初始化
      this.db = null;
      this.initPromise = null;
      await this.init();

      console.log('Database reset successfully');
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw error;
    }
  }
}

export const sqliteManager = SQLiteManager.getInstance();
