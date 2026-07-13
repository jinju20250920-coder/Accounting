import initSqlJs from 'sql.js';

import { buildPartnerInsert } from './services/partner-sqlite-service';

type SqlValue = string | number | Uint8Array | null;

interface SqlResult {
  columns: string[];
  values: SqlValue[][];
}

interface SqliteDatabase {
  exec(sql: string, params?: SqlValue[]): SqlResult[];
  export(): Uint8Array;
  run(sql: string, params?: SqlValue[]): void;
}

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

const resolveSqlJsWasmPath = (file: string): string => {
  if (typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.cwd === 'function') {
    return `${process.cwd().replace(/\\/g, '/')}/node_modules/sql.js/dist/${file}`;
  }
  return `/sqljs/${file}`;
};

class SQLiteManager {
  private static instance: SQLiteManager;
  private db: SqliteDatabase | null = null;
  private currentAccountSetId: string | null = null;
  private initPromise: Promise<void> | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private DB_STORAGE_KEY = 'sqljs-finance-db';
  private DB_FILE_NAME = 'finance-assistant.db';
  private isElectron: boolean = false;
  private dbPath: string | null = null;
  private opfsHandle: FileSystemHandleHelper | null = null;
  private useOPFS: boolean = false;
  private useFileSystemAccess: boolean = false; // File System Access API support
  private HANDLE_STORAGE_KEY = 'sqlite-db-handle'; // IndexedDB storage key
  private saveInProgress: boolean = false;
  private savePromise: Promise<void> | null = null;
  private dbHandle: FileSystemHandleHelper | null = null; // Persistent file handle
  private isBrowser: boolean = typeof window !== 'undefined';

  static getInstance(): SQLiteManager {
    if (!SQLiteManager.instance) {
      SQLiteManager.instance = new SQLiteManager();
    }
    return SQLiteManager.instance;
  }

  constructor() {
    // Detect whether we are running in Electron.
    this.isElectron = this.isBrowser && window.electronAPI?.isElectron?.();

    // Detect File System Access API support (Chrome 86+, Edge 86+, Opera 72+)
    // Firefox may require dom.fs.enabled = true in about:config.
    if (this.isBrowser && !this.isElectron) {
      this.useFileSystemAccess = 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;

      if (this.useFileSystemAccess) {
        console.log('File System Access API is supported, database can be stored on disk');
      } else {
        // Fallback: detect OPFS
        this.useOPFS = 'storage' in navigator && 'getDirectory' in (navigator.storage as Storage & { getDirectory?: unknown });
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
    try {
      await this.initPromise;
    } catch (err) {
      this.initPromise = null;
      throw err;
    }
  }

  private async _init(): Promise<void> {
    try {
      const SQL = await initSqlJs({
        locateFile: resolveSqlJsWasmPath,
      });

      if (this.isElectron) {
        // Electron environment - load or create the on-disk database.
        await this.initializeElectronDatabase(SQL);
      } else if (this.useOPFS) {
        // Browser environment - use OPFS file storage
        await this.initializeOPFSDatabase(SQL);
      } else if (!this.isBrowser) {
        // Node / test environment - pure in-memory database
        this.db = new SQL.Database();
        this.createTables();
        console.log('SQLite database initialized successfully (node in-memory database)');
      } else {
        // Browser environment - use localStorage as fallback
        this.initializeBrowserDatabase(SQL);
      }

      // Start auto-save timer
      if (this.isBrowser || this.isElectron || this.useOPFS) {
        this.startAutoSave();
      }
    } catch (error) {
      console.error('SQLite initialization failed:', error);
      // Fallback to new database
      const SQL = await initSqlJs({
        locateFile: resolveSqlJsWasmPath,
      });
      this.db = new SQL.Database();
      this.createTables();
      console.log('SQLite database initialized with fallback');
    }
  }

  private async initializeElectronDatabase(SQL: { Database: new (data?: Uint8Array) => SqliteDatabase }): Promise<void> {
    // First try the saved database path or fall back to the default path
    let dbPath = await window.electronAPI.getDbPath();

    if (!dbPath) {
      // Check whether a default database path exists.
      const defaultPath = await window.electronAPI.getDefaultDbPath();
      const fileExists = await window.electronAPI.fileExists(defaultPath);

      if (fileExists) {
        dbPath = defaultPath;
        await window.electronAPI.setDbPath(defaultPath);
        console.log(`Using default database at: ${defaultPath}`);
      } else {
        // No existing database, create a new default database.
        console.log(`Creating new database at: ${defaultPath}`);
        this.db = new SQL.Database();
        this.createTables();
        this.dbPath = defaultPath;
        await window.electronAPI.setDbPath(defaultPath);
        await this.saveDatabase();
        return;
      }
    }

    // Try loading the database from disk.
    try {
      const loadedData = await window.electronAPI.loadDb();
      if (loadedData) {
        this.db = new SQL.Database(new Uint8Array(loadedData));
        this.dbPath = dbPath;
        console.log('SQLite database loaded from disk successfully');
      } else {
        // No database found, create a new one.
        this.db = new SQL.Database();
        this.createTables();
        this.dbPath = dbPath;
        console.log('SQLite database initialized successfully (new database)');
        await this.saveDatabase();
      }
    } catch (error) {
      console.error('Failed to load database from disk:', error);
      // Failed to load, fall back to a new database.
      this.db = new SQL.Database();
      this.createTables();
      this.dbPath = dbPath;
      console.log('SQLite database initialized with fallback');
    }
  }

  private async initializeOPFSDatabase(SQL: { Database: new (data?: Uint8Array) => SqliteDatabase }): Promise<void> {
    try {
      // Get the OPFS root directory.
      const opfsRoot = await (navigator.storage as Storage & { getDirectory(): Promise<FileSystemDirectoryHandle> }).getDirectory();

      // Check whether the database file exists.
      let dbExists = false;
      try {
        await opfsRoot.getFileHandle(this.DB_FILE_NAME);
        dbExists = true;
        console.log('Existing OPFS database file found');
      } catch {
        console.log('No existing OPFS database file, will create new one');
      }

      if (dbExists) {
        // Open the existing file and load data.
        this.opfsHandle = await opfsRoot.getFileHandle(this.DB_FILE_NAME);
        const file = await this.opfsHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        if (uint8Array.length > 0) {
          try {
            this.db = new SQL.Database(uint8Array);
            // 健康检查：验证数据库可正常查询
            this.db.exec('SELECT count(*) FROM sqlite_master');
            console.log('SQLite database loaded from OPFS successfully');
          } catch (dbError) {
            console.error('OPFS database corrupted, recreating:', dbError);
            this.db = new SQL.Database();
            this.createTables();
            console.log('SQLite database recreated (corrupted OPFS file)');
            await this.saveOPFSDatabase(this.db.export());
          }
        } else {
          // Empty file, create a new database.
          this.db = new SQL.Database();
          this.createTables();
          console.log('SQLite database initialized (new OPFS database)');
        }
      } else {
        // Create a new database file.
        this.opfsHandle = await opfsRoot.getFileHandle(this.DB_FILE_NAME, { create: true });
        this.db = new SQL.Database();
        this.createTables();
        console.log('SQLite database initialized successfully (new OPFS database)');
        await this.saveOPFSDatabase(this.db.export());
      }
    } catch (error) {
      console.error('OPFS initialization failed, falling back to localStorage:', error);
      this.useOPFS = false;
      this.initializeBrowserDatabase(SQL);
    }
  }

  private initializeBrowserDatabase(SQL: { Database: new (data?: Uint8Array) => SqliteDatabase }): void {
    const savedDb = this.loadDatabase();

    if (savedDb) {
      try {
        this.db = new SQL.Database(savedDb);
        // 健康检查
        this.db.exec('SELECT count(*) FROM sqlite_master');
        console.log('SQLite database loaded from storage successfully');
      } catch (dbError) {
        console.error('localStorage database corrupted, recreating:', dbError);
        this.clearCorruptedData();
        this.db = new SQL.Database();
        this.createTables();
        console.log('SQLite database recreated (corrupted localStorage data)');
      }
    } else {
      // Create new database
      this.db = new SQL.Database();
      this.createTables();
      console.log('SQLite database initialized successfully (new database)');
    }
  }


  private async saveDatabase(): Promise<void> {
    if (this.saveInProgress && this.savePromise) {
      await this.savePromise;
      return this.saveDatabase();
    }
    this.saveInProgress = true;
    this.savePromise = (async () => {
      if (this.db) {
        const data = this.db.export();

        if (this.isElectron) {
          await window.electronAPI.saveDb(Array.from(new Uint8Array(data)));
        } else if (this.useOPFS) {
          await this.saveOPFSDatabase(data);
        } else if (!this.isBrowser) {
          // Node / test environment uses in-memory db only.
          return;
        } else {
          try {
            const uint8Data = new Uint8Array(data);
            let binaryString = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < uint8Data.length; i += chunkSize) {
              const chunk = uint8Data.subarray(i, i + chunkSize);
              binaryString += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const base64 = btoa(binaryString);
            localStorage.setItem(this.DB_STORAGE_KEY, base64);
          } catch (storageError) {
            console.error('LocalStorage save failed:', storageError);
          }
        }
      }
    })();

    try {
      await this.savePromise;
    } catch (error) {
      console.error('Failed to save database:', error);
      throw error;
    } finally {
      this.saveInProgress = false;
      this.savePromise = null;
    }
  }

  private async saveOPFSDatabase(data: Uint8Array): Promise<void> {
    if (!this.opfsHandle) return;

    try {
      const writable = await this.opfsHandle.createWritable();
      await writable.write(data as BlobPart);
      await writable.close();

      if ('sync' in this.opfsHandle && typeof this.opfsHandle.sync === 'function') {
        await this.opfsHandle.sync();
      }
    } catch (error) {
      console.error('Failed to save database to OPFS:', error);
      throw error;
    }
  }

  /**
   * 娓呯悊鎹熷潖鐨勬暟鎹簱鏁版嵁
   */
  async clearCorruptedData(): Promise<void> {
    try {
      if (this.useOPFS) {
        const opfsRoot = await (navigator.storage as Storage & { getDirectory(): Promise<FileSystemDirectoryHandle> }).getDirectory();
        await opfsRoot.removeEntry(this.DB_FILE_NAME);
        this.opfsHandle = null;
        console.log('Corrupted OPFS database file cleared');
      } else if (!this.isBrowser) {
        return;
      } else {
        localStorage.removeItem(this.DB_STORAGE_KEY);
        console.log('Corrupted database data cleared from localStorage');
      }
    } catch (error) {
      console.error('Failed to clear corrupted data:', error);
    }
  }

  private loadDatabase(): Uint8Array | null {
    if (!this.isBrowser) {
      return null;
    }
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
   * Estimate OPFS storage usage.
   */
  async getOPFSUsage(): Promise<{ usage: number; quota: number } | null> {
    if (!this.useOPFS) {
      return null;
    }

    try {
      const estimate = await (navigator.storage as Storage & { estimate(): Promise<{ usage?: number; quota?: number }> }).estimate();
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
    if (!this.isBrowser && !this.isElectron && !this.useOPFS) {
      return;
    }
    // Auto-save every 5 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveDatabase().catch(err => console.error('Auto-save failed:', err));
    }, 5000);

    // Register unload handlers to preserve pending writes.
    const handleBeforeUnload = () => {
      if (this.db) {
        try {
          const data = this.db.export();
          if (this.useOPFS && this.opfsHandle) {
            // OPFS sync write path.
            // beforeunload cannot await async work reliably, so auto-save is the main persistence path.
          } else if (!this.isElectron) {
            // localStorage sync write path.
            try {
              const uint8Data = new Uint8Array(data);
              let binaryString = '';
              const chunkSize = 0x8000;
              for (let i = 0; i < uint8Data.length; i += chunkSize) {
                const chunk = uint8Data.subarray(i, i + chunkSize);
                binaryString += String.fromCharCode.apply(null, Array.from(chunk));
              }
              localStorage.setItem(this.DB_STORAGE_KEY, btoa(binaryString));
            } catch (e) {
              console.error('beforeunload save failed:', e);
            }
          }
        } catch (e) {
          console.error('Export in beforeunload failed:', e);
        }
      }
    };

    const handlePageHide = () => {
      this.saveDatabase().catch(() => {});
    };

    if (this.isBrowser) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handlePageHide);
    }
  }

  // Manually trigger save
  save(): Promise<void> {
    return this.saveDatabase();
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
      locateFile: resolveSqlJsWasmPath,
    });
    this.db = new SQL.Database(data);
    this.saveDatabase();
    console.log('Database imported successfully');
  }

  private createTables(): void {
    // Create tables with accountSetId for multi-tenancy
    const tables = `
      CREATE TABLE IF NOT EXISTS accountSets (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        description TEXT,
        taxNo TEXT,
        address TEXT,
        baseCurrency TEXT,
        baseCurrencyName TEXT,
        currentPeriod TEXT,
        startDate TEXT,
        accountingStandard TEXT,
        enableDate TEXT,
        status TEXT,
        createdDate TEXT,
        lastModifiedDate TEXT,
        isInitialized INTEGER DEFAULT 0,
        trialEndDate TEXT,
        licensedCount INTEGER,
        lastVoucherNo INTEGER,
        lastVoucherFullNo TEXT,
        dbFileName TEXT,
        dbFilePath TEXT,
        dbFileSize INTEGER,
        dbLastModified INTEGER,
        dbStorageType TEXT,
        dbHandleId TEXT,
        createTime TEXT,
        updateTime TEXT,
        payrollRegionId TEXT,
        payrollTaxRules TEXT,
        payrollSalaryExpenseSubjectCode TEXT,
        payrollSalaryExpenseSubjectName TEXT,
        payrollContributionExpenseSubjectCode TEXT,
        payrollContributionExpenseSubjectName TEXT,
        payrollSalaryPayableSubjectCode TEXT,
        payrollSalaryPayableSubjectName TEXT,
        payrollTaxPayableSubjectCode TEXT,
        payrollTaxPayableSubjectName TEXT,
        payrollEmployeeContributionPayableSubjectCode TEXT,
        payrollEmployeeContributionPayableSubjectName TEXT,
        payrollEmployerContributionPayableSubjectCode TEXT,
        payrollEmployerContributionPayableSubjectName TEXT,
        accounting TEXT
      );

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
        totalDebit REAL DEFAULT 0,
        totalCredit REAL DEFAULT 0,
        voucherType TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        voucherId TEXT,
        subjectCode TEXT,
        subjectName TEXT,
        direction TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
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
        currencyName TEXT,
        exchangeRate REAL,
        originalAmount REAL,
        date TEXT,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        sourceEntryId TEXT,
        sourceVoucherDate TEXT,
        FOREIGN KEY (voucherId) REFERENCES vouchers(id),
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      CREATE TABLE IF NOT EXISTS currencies (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT,
        symbol TEXT,
        precision INTEGER,
        exchangeRate REAL,
        rateStartDate TEXT,
        gainLossSubjectCode TEXT,
        gainLossSubjectName TEXT,
        isBase INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        disabled INTEGER DEFAULT 0,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      CREATE TABLE IF NOT EXISTS fxRates (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        rateDate TEXT NOT NULL,
        currencyCode TEXT NOT NULL,
        baseCurrency TEXT NOT NULL,
        middleRate REAL NOT NULL,
        source TEXT,
        createTime TEXT NOT NULL,
        updateTime TEXT NOT NULL,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      CREATE TABLE IF NOT EXISTS bank_account_bindings (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        accountNumber TEXT NOT NULL,
        bankId TEXT,
        bankName TEXT,
        aliasName TEXT,
        subSubjectCode TEXT,
        subSubjectName TEXT,
        branch TEXT,
        currency TEXT,
        isDefault INTEGER DEFAULT 0,
        createdAt TEXT,
        updateTime TEXT,
        bankAccountCode TEXT,
        bankAccountName TEXT,
        bankAccountNumber TEXT,
        currencyCode TEXT,
        subjectCode TEXT,
        subjectName TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      CREATE TABLE IF NOT EXISTS fxRevaluationRuns (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        period TEXT NOT NULL,
        baseCurrency TEXT NOT NULL,
        status TEXT NOT NULL,
        previewData TEXT,
        voucherId TEXT,
        voucherNo TEXT,
        createdAt TEXT NOT NULL,
        confirmedAt TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      CREATE TABLE IF NOT EXISTS fxRevaluationRunLines (
        id TEXT PRIMARY KEY,
        runId TEXT NOT NULL,
        accountSetId TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        sourceId TEXT NOT NULL,
        sourceName TEXT,
        currencyCode TEXT NOT NULL,
        originalAmount REAL NOT NULL,
        originalRate REAL NOT NULL,
        revaluationRate REAL NOT NULL,
        bookValueBase REAL NOT NULL,
        revaluedBase REAL NOT NULL,
        gainLossAmount REAL NOT NULL,
        gainLossDirection TEXT NOT NULL,
        subjectCode TEXT,
        subjectName TEXT,
        createTime TEXT,
        FOREIGN KEY (runId) REFERENCES fxRevaluationRuns(id),
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        fullName TEXT,
        parentId TEXT,
        level INTEGER,
        direction TEXT,
        isLeaf INTEGER DEFAULT 0,
        type TEXT,
        balance REAL DEFAULT 0,
        description TEXT,
        subjectType TEXT,
        enabled INTEGER DEFAULT 1,
        frozen INTEGER DEFAULT 0,
        accountSetId TEXT,
        enableDept INTEGER DEFAULT 0,
        enableProject INTEGER DEFAULT 0,
        enableForeign INTEGER DEFAULT 0,
        foreignCurrency TEXT,
        isCustomer INTEGER DEFAULT 0,
        isSupplier INTEGER DEFAULT 0,
        isEmployee INTEGER DEFAULT 0,
        enableCashFlow INTEGER DEFAULT 0,
        isMonetary INTEGER DEFAULT 0,
        bankAccountNumber TEXT,
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
        bankName TEXT,
        idType TEXT,
        idNumber TEXT,
        employmentStartDate TEXT,
        employmentEndDate TEXT,
        defaultSubjectCode TEXT,
        defaultSubjectName TEXT,
        departmentCode TEXT,
        departmentName TEXT,
        paymentTermDays INTEGER,
        openingBalance REAL DEFAULT 0,
        payrollSalaryExpenseSubjectCode TEXT,
        payrollSalaryExpenseSubjectName TEXT,
        payrollContributionExpenseSubjectCode TEXT,
        payrollContributionExpenseSubjectName TEXT,
        payrollSalaryPayableSubjectCode TEXT,
        payrollSalaryPayableSubjectName TEXT,
        payrollTaxPayableSubjectCode TEXT,
        payrollTaxPayableSubjectName TEXT,
        payrollEmployeeContributionPayableSubjectCode TEXT,
        payrollEmployeeContributionPayableSubjectName TEXT,
        payrollEmployerContributionPayableSubjectCode TEXT,
        payrollEmployerContributionPayableSubjectName TEXT,
        payrollDepartmentName TEXT,
        payrollProjectName TEXT,
        payrollCostCenterName TEXT,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

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

      CREATE TABLE IF NOT EXISTS commonSummaries (
        id TEXT PRIMARY KEY,
        content TEXT,
        frequency INTEGER DEFAULT 0,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

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

      CREATE TABLE IF NOT EXISTS assetCategories (
        id TEXT PRIMARY KEY,
        code TEXT,
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

      CREATE TABLE IF NOT EXISTS payroll_batches (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        payrollPeriod TEXT NOT NULL,
        batchName TEXT NOT NULL,
        status TEXT NOT NULL,
        sourceFileName TEXT,
        employeeCount INTEGER NOT NULL DEFAULT 0,
        grossTotal REAL NOT NULL DEFAULT 0,
        employerCostTotal REAL NOT NULL DEFAULT 0,
        taxTotal REAL NOT NULL DEFAULT 0,
        netTotal REAL NOT NULL DEFAULT 0,
        calculationConfigSnapshot TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        confirmedAt TEXT,
        accrualVoucherId TEXT,
        accrualVoucherNo TEXT
      );

      CREATE TABLE IF NOT EXISTS payroll_items (
        id TEXT PRIMARY KEY,
        batchId TEXT NOT NULL,
        accountSetId TEXT NOT NULL,
        payrollPeriod TEXT NOT NULL,
        employeeCode TEXT NOT NULL,
        employeeName TEXT NOT NULL,
        departmentName TEXT,
        inputData TEXT NOT NULL,
        calculationResult TEXT NOT NULL,
        validationStatus TEXT NOT NULL,
        validationMessages TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payroll_calculation_configs (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        effectivePeriod TEXT NOT NULL,
        socialInsuranceConfig TEXT NOT NULL,
        housingFundConfig TEXT NOT NULL,
        individualTaxConfig TEXT NOT NULL,
        policyLabel TEXT NOT NULL,
        policyEffectiveDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoiceType TEXT NOT NULL,
        invoiceCode TEXT NOT NULL,
        digitalInvoiceNo TEXT,
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
        groupName TEXT,
        holdStatus TEXT DEFAULT 'normal',
        category TEXT,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (voucherId) REFERENCES vouchers(id),
        FOREIGN KEY (partnerId) REFERENCES partners(id),
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id)
      );

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
        updateTime TEXT
      );

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

      CREATE TABLE IF NOT EXISTS bankTransactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        transactionTime TEXT,
        voucherType TEXT,
        voucherNo TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        balance REAL,
        cashRemitFlag TEXT,
        counterpartyName TEXT,
        counterpartyAccount TEXT,
        summary TEXT,
        notes TEXT,
        transactionSerialNo TEXT,
        enterpriseSerialNo TEXT,
        ourAccount TEXT,
        ourAccountName TEXT,
        ourBranch TEXT,
        rowNumber INTEGER,
        status TEXT DEFAULT 'pending',
        matchedSubject TEXT,
        matchedSubjectName TEXT,
        confidence REAL,
        bankAccountId TEXT,
        importBatchId TEXT,
        voucherId TEXT,
        generatedVoucherNo TEXT,
        exchangeRate REAL,
        originalAmount REAL,
        source TEXT DEFAULT 'import',
        docNo TEXT,
        otherAccountName TEXT,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT,
        FOREIGN KEY (accountSetId) REFERENCES accountSets(id),
        FOREIGN KEY (voucherId) REFERENCES vouchers(id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        displayName TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        status TEXT DEFAULT 'active',
        lastLoginTime TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        displayName TEXT NOT NULL,
        description TEXT,
        isSystem INTEGER DEFAULT 0,
        createTime TEXT,
        updateTime TEXT
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        roleId TEXT NOT NULL,
        permissionId TEXT NOT NULL,
        PRIMARY KEY (roleId, permissionId)
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        tenantId TEXT NOT NULL,
        userId TEXT NOT NULL,
        roleId TEXT NOT NULL,
        PRIMARY KEY (tenantId, userId, roleId)
      );

      CREATE TABLE IF NOT EXISTS account_set_users (
        tenantId TEXT NOT NULL,
        accountSetId TEXT NOT NULL,
        userId TEXT NOT NULL,
        roleId TEXT NOT NULL,
        PRIMARY KEY (tenantId, accountSetId, userId)
      );

      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        settings TEXT,
        createTime TEXT NOT NULL,
        updateTime TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenant_users (
        tenantId TEXT NOT NULL,
        userId TEXT NOT NULL,
        role TEXT NOT NULL,
        joinedAt TEXT NOT NULL,
        PRIMARY KEY (tenantId, userId)
      );

      CREATE TABLE IF NOT EXISTS invoice_subject_rules (
        id TEXT PRIMARY KEY,
        name TEXT,
        invoiceType TEXT,
        keywords TEXT,
        priority INTEGER DEFAULT 0,
        debitSubjectCode TEXT,
        debitSubjectName TEXT,
        creditSubjectCode TEXT,
        creditSubjectName TEXT,
        taxSubjectCode TEXT,
        taxSubjectName TEXT,
        autoTax INTEGER DEFAULT 1,
        requirePartnerCard INTEGER DEFAULT 1,
        enabled INTEGER DEFAULT 1,
        accountSetId TEXT,
        createTime TEXT,
        updateTime TEXT
      );

      CREATE TABLE IF NOT EXISTS supplier_subject_mapping (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        groupName TEXT NOT NULL,
        sellerName TEXT NOT NULL,
        supplierType TEXT NOT NULL DEFAULT 'material',
        defaultDebitSubject TEXT,
        defaultDebitSubjectName TEXT,
        defaultTaxSubject TEXT,
        defaultTaxSubjectName TEXT,
        defaultCreditSubject TEXT,
        defaultCreditSubjectName TEXT,
        createTime TEXT NOT NULL,
        updateTime TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS custom_bank_configs (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monthly_closing_checks (
        id TEXT PRIMARY KEY,
        accountSetId TEXT,
        period TEXT,
        checkType TEXT,
        checkResult TEXT,
        details TEXT,
        status TEXT DEFAULT 'pending',
        createTime TEXT,
        updateTime TEXT
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

      -- FX indexes
      CREATE INDEX IF NOT EXISTS idx_fxRates_accountSetId ON fxRates(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_fxRates_rateDate ON fxRates(rateDate);
      CREATE INDEX IF NOT EXISTS idx_fxRates_currencyCode ON fxRates(currencyCode);

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

      -- Payroll indexes
      CREATE INDEX IF NOT EXISTS idx_payroll_batches_period ON payroll_batches(accountSetId, payrollPeriod);
      CREATE INDEX IF NOT EXISTS idx_payroll_items_batch ON payroll_items(accountSetId, batchId);
      CREATE INDEX IF NOT EXISTS idx_payroll_config_period ON payroll_calculation_configs(accountSetId, effectivePeriod);

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

      -- Tenants indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code);
      CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(userId);
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

  async getDatabaseAsync(): Promise<SqliteDatabase | null> {
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

  // Synchronous accessor - call init() before use.
  getDatabase(): SqliteDatabase | null {
    if (!this.db) {
      console.warn('SQLite database not initialized, attempting to initialize...');
      // Do not perform complex async work here.
      // Only log a warning so callers know initialization is pending.
    }
    return this.db;
  }

  async getDatabaseSafe(): Promise<SqliteDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  isInitialized(): boolean {
    return this.db !== null;
  }

  // Get the database synchronously; throw if init() has not completed.
  getDatabaseSync(): SqliteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }


  // Export as JSON (for compatibility with IndexedDB)
  async exportData(): Promise<Record<string, unknown>> {
    const db = this.getDatabase();
    const accountSetId = this.getCurrentAccountSetId();

    if (!accountSetId) {
      throw new Error('No account set selected');
    }

    // Get vouchers
    const vouchersResult = db.exec(`SELECT * FROM vouchers WHERE accountSetId = ?`, [accountSetId]);
    const vouchers = vouchersResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = vouchersResult[0].columns;
      const voucher: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        voucher[col] = row[idx];
      });
      return voucher;
    }) || [];

    // Get entries for each voucher
    const vouchersWithEntries = [];
    for (const voucher of vouchers) {
      const entriesResult = db.exec(`SELECT * FROM entries WHERE voucherId = ? AND accountSetId = ?`, [voucher.id, accountSetId]);
      const entries = entriesResult[0]?.values.map((row: SqlValue[], index: number) => {
        const columns = entriesResult[0].columns;
        const entry: Record<string, SqlValue> = {};
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
    const subjects = subjectsResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = subjectsResult[0].columns;
      const subject: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        subject[col] = row[idx];
      });
      return subject;
    }) || [];

    const departmentsResult = db.exec(`SELECT * FROM departments WHERE accountSetId = ?`, [accountSetId]);
    const departments = departmentsResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = departmentsResult[0].columns;
      const dept: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        dept[col] = row[idx];
      });
      return dept;
    }) || [];

    const projectsResult = db.exec(`SELECT * FROM projects WHERE accountSetId = ?`, [accountSetId]);
    const projects = projectsResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = projectsResult[0].columns;
      const project: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        project[col] = row[idx];
      });
      return project;
    }) || [];

    const currenciesResult = db.exec(`SELECT * FROM currencies WHERE accountSetId = ?`, [accountSetId]);
    const currencies = currenciesResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = currenciesResult[0].columns;
      const currency: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        currency[col] = row[idx];
      });
      return currency;
    }) || [];

    const partnersResult = db.exec(`SELECT * FROM partners WHERE accountSetId = ?`, [accountSetId]);
    const partners = partnersResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = partnersResult[0].columns;
      const partner: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        partner[col] = row[idx];
      });
      return partner;
    }) || [];

    const voucherTemplatesResult = db.exec(`SELECT * FROM voucherTemplates WHERE accountSetId = ?`, [accountSetId]);
    const voucherTemplates = voucherTemplatesResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = voucherTemplatesResult[0].columns;
      const template: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        template[col] = col === 'entries' || col === 'validations' || col === 'variables' ? JSON.parse(value) : value;
      });
      return template;
    }) || [];

    const commonSummariesResult = db.exec(`SELECT * FROM commonSummaries WHERE accountSetId = ?`, [accountSetId]);
    const commonSummaries = commonSummariesResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = commonSummariesResult[0].columns;
      const summary: Record<string, SqlValue> = {};
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
    const preferences = preferencesResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = preferencesResult[0].columns;
      const pref: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        pref[col] = col === 'value' ? JSON.parse(value) : value;
      });
      return pref;
    }) || [];

    const auditLogsResult = db.exec(`SELECT * FROM auditLogs WHERE accountSetId = ?`, [accountSetId]);
    const auditLogs = auditLogsResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = auditLogsResult[0].columns;
      const log: Record<string, SqlValue> = {};
      columns.forEach((col: string, idx: number) => {
        const value = row[idx];
        log[col] = col === 'details' ? JSON.parse(value) : value;
      });
      return log;
    }) || [];

    const recRelationsResult = db.exec(`SELECT * FROM recRelations WHERE accountSetId = ?`, [accountSetId]);
    const recRelations = recRelationsResult[0]?.values.map((row: SqlValue[], index: number) => {
      const columns = recRelationsResult[0].columns;
      const relation: Record<string, SqlValue> = {};
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

  async importData(data: Record<string, unknown>): Promise<void> {
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
                summary, customerName, supplierName, partnerId, auxiliary, recRefNo,
                departmentCode, departmentName, projectCode, projectName,
                currencyCode, exchangeRate, originalAmount, date, accountSetId,
                createTime, updateTime
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              entryWithAccountSet.partnerId,
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
        const now = new Date().toISOString();
        for (const partner of data.partners) {
          const insert = buildPartnerInsert(
            {
              ...partner,
              taxNo: partner.taxNo ?? partner.taxNumber,
              accountSetId,
            },
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

  // ========== OPFS helper methods ==========

  /**
   * Check whether OPFS storage is active.
   */
  isUsingOPFS(): boolean {
    return this.useOPFS;
  }

  /**
   * Get database file info in OPFS mode.
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
   * Download the database file for manual backup.
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
   * Upload a database file and import it.
   */
  async uploadDatabase(file: File): Promise<void> {
    try {
      const SQL = await initSqlJs({
        locateFile: resolveSqlJsWasmPath,
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
   * Delete the OPFS database file and reset state.
   */
  async resetDatabase(): Promise<void> {
    try {
      if (this.useOPFS) {
        const opfsRoot = await (navigator.storage as Storage & { getDirectory(): Promise<FileSystemDirectoryHandle> }).getDirectory();
        await opfsRoot.removeEntry(this.DB_FILE_NAME);
        this.opfsHandle = null;
      } else {
        localStorage.removeItem(this.DB_STORAGE_KEY);
      }

      // Re-initialize the in-memory database.
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
