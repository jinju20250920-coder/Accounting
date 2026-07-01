/**
 * FileHandleManager - 管理账套与文件句柄的映射
 * 使用 IndexedDB 存储文件句柄，实现一账套一文件架构
 */

// IndexedDB 数据库名称和版本
const DB_NAME = 'FinanceAssistantDB';
const DB_VERSION = 1;
const STORE_NAME = 'accountSetHandles';

// 文件句柄存储数据结构
interface AccountSetHandleData {
  accountSetId: string;
  accountSetName: string;
  fileName: string;
  handle: FileSystemFileHandle;
  lastModified: number;
  storageType: 'fsa' | 'opfs' | 'local'; // fsa = File System Access API
  created: string;
  updated: string;
}

// 账套元数据（不含文件句柄，用于展示）
interface AccountSetHandleInfo {
  accountSetId: string;
  accountSetName: string;
  fileName: string;
  lastModified: number;
  storageType: 'fsa' | 'opfs' | 'local';
  created: string;
  updated: string;
}

class FileHandleManager {
  private static instance: FileHandleManager;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): FileHandleManager {
    if (!FileHandleManager.instance) {
      FileHandleManager.instance = new FileHandleManager();
    }
    return FileHandleManager.instance;
  }

  /**
   * 初始化 IndexedDB
   */
  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'accountSetId' });
          store.createIndex('accountSetName', 'accountSetName', { unique: false });
          store.createIndex('fileName', 'fileName', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * 保存文件句柄（创建或更新账套）
   */
  async saveHandle(
    accountSetId: string,
    accountSetName: string,
    fileName: string,
    handle: FileSystemFileHandle,
    storageType: 'fsa' | 'opfs' | 'local' = 'fsa'
  ): Promise<void> {
    await this.init();

    const now = new Date().toISOString();
    const data: AccountSetHandleData = {
      accountSetId,
      accountSetName,
      fileName,
      handle,
      lastModified: Date.now(),
      storageType,
      created: now,
      updated: now
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save file handle'));
    });
  }

  /**
   * 获取文件句柄
   */
  async getHandle(accountSetId: string): Promise<FileSystemFileHandle | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(accountSetId);

      request.onsuccess = () => {
        const data = request.result as AccountSetHandleData | undefined;
        resolve(data?.handle || null);
      };
      request.onerror = () => reject(new Error('Failed to get file handle'));
    });
  }

  /**
   * 验证文件句柄是否有效
   */
  async verifyHandle(accountSetId: string): Promise<boolean> {
    try {
      const handle = await this.getHandle(accountSetId);
      if (!handle) return false;

      // 尝试获取文件信息来验证句柄是否有效
      const file = await handle.getFile();
      return true;
    } catch (error) {
      console.warn('Handle verification failed:', error);
      return false;
    }
  }

  /**
   * 获取账套的文件信息（不包含句柄）
   */
  async getAccountSetInfo(accountSetId: string): Promise<AccountSetHandleInfo | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(accountSetId);

      request.onsuccess = () => {
        const data = request.result as AccountSetHandleData | undefined;
        if (!data) {
          resolve(null);
          return;
        }

        // 返回不包含句柄的数据
        resolve({
          accountSetId: data.accountSetId,
          accountSetName: data.accountSetName,
          fileName: data.fileName,
          lastModified: data.lastModified,
          storageType: data.storageType,
          created: data.created,
          updated: data.updated
        });
      };
      request.onerror = () => reject(new Error('Failed to get account set info'));
    });
  }

  /**
   * 获取所有账套的文件信息列表
   */
  async getAllAccountSets(): Promise<AccountSetHandleInfo[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const dataArray = request.result as AccountSetHandleData[];
        const infos: AccountSetHandleInfo[] = dataArray.map(data => ({
          accountSetId: data.accountSetId,
          accountSetName: data.accountSetName,
          fileName: data.fileName,
          lastModified: data.lastModified,
          storageType: data.storageType,
          created: data.created,
          updated: data.updated
        }));
        resolve(infos);
      };
      request.onerror = () => reject(new Error('Failed to get all account sets'));
    });
  }

  /**
   * 删除文件句柄（删除账套时使用）
   */
  async removeHandle(accountSetId: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(accountSetId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove file handle'));
    });
  }

  /**
   * 更新账套名称
   */
  async updateAccountSetName(accountSetId: string, newName: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(accountSetId);

      getRequest.onsuccess = () => {
        const data = getRequest.result as AccountSetHandleData | undefined;
        if (!data) {
          reject(new Error('Account set not found'));
          return;
        }

        const updatedData: AccountSetHandleData = {
          ...data,
          accountSetName: newName,
          updated: new Date().toISOString()
        };

        const putRequest = store.put(updatedData);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to update account set name'));
      };

      getRequest.onerror = () => reject(new Error('Failed to get account set'));
    });
  }

  /**
   * 清空所有数据（重置时使用）
   */
  async clearAll(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear all handles'));
    });
  }

  /**
   * 检测浏览器是否支持 File System Access API
   */
  static isFileSystemAccessAPISupported(): boolean {
    return typeof window !== 'undefined' &&
      'showSaveFilePicker' in window &&
      'showOpenFilePicker' in window;
  }

  /**
   * 检测浏览器是否支持 OPFS
   */
  static isOPFSSupported(): boolean {
    return typeof navigator !== 'undefined' &&
      'storage' in navigator &&
      'getDirectory' in (navigator.storage as StorageManager & { getDirectory?: () => unknown });
  }

  /**
   * 获取推荐的存储类型
   */
  static getRecommendedStorageType(): 'fsa' | 'opfs' | 'local' {
    if (FileHandleManager.isFileSystemAccessAPISupported()) {
      return 'fsa';
    } else if (FileHandleManager.isOPFSSupported()) {
      return 'opfs';
    }
    return 'local';
  }

  /**
   * 获取存储类型的显示名称
   */
  static getStorageTypeName(storageType: 'fsa' | 'opfs' | 'local'): string {
    switch (storageType) {
      case 'fsa':
        return '磁盘文件（File System Access API）';
      case 'opfs':
        return '浏览器私有文件系统（OPFS）';
      case 'local':
        return '本地存储（localStorage）';
      default:
        return '未知';
    }
  }

  /**
   * 请求用户选择/创建数据库文件
   */
  async requestNewFile(defaultFileName: string): Promise<{
    handle: FileSystemFileHandle;
    fileName: string;
  }> {
    if (!FileHandleManager.isFileSystemAccessAPISupported()) {
      throw new Error('File System Access API not supported');
    }

    try {
      // 使用 showSaveFilePicker 让用户选择/创建文件
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFileName,
        types: [{
          description: 'SQLite Database',
          accept: { 'application/x-sqlite3': ['.db'] }
        }]
      });

      return {
        handle,
        fileName: handle.name
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('User cancelled file selection');
      }
      throw error;
    }
  }
}

export { FileHandleManager };
export type { AccountSetHandleInfo };
export const fileHandleManager = FileHandleManager.getInstance();
