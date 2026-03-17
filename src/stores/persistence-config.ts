import { persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { database } from '@/lib/database';
import { useAccountSetStore } from './useAccountSetStore';

// 数据版本定义
export const DATA_VERSIONS = {
  V1: 1, // 初始版本
  V2: 2, // 添加凭证状态
  V3: 3, // 添加AI学习功能
  V4: 4, // 添加基础档案管理
  CURRENT: 4
} as const;

// 数据迁移函数类型
export type MigrationFunction = (state: any, version: number) => any;

// 存储键名配置
export const STORAGE_KEYS = {
  VOUCHERS: 'finance-vouchers',
  PREFERENCES: 'finance-preferences',
  AUDIT: 'finance-audit',
  SETTINGS: 'finance-settings',
  SUBJECTS: 'finance-subjects',
  DEPARTMENTS: 'finance-departments',
  PROJECTS: 'finance-projects',
  CURRENCIES: 'finance-currencies'
} as const;

// ========== IndexedDB 存储实现 ==========

// 创建 IndexedDB 存储
export function createIndexedDBStorage(baseKey: string): StateStorage {
  const isClient = typeof window !== 'undefined';

  return {
    getItem: async (name: string): Promise<string | null> => {
      if (!isClient) return null;

      try {
        await database.init();
        const data = await database.get(name);
        if (data) {
          return JSON.stringify(data);
        }
      } catch (e) {
        console.warn('IndexedDB read failed, falling back to localStorage:', e);
      }

      // 回退到 localStorage
      const item = localStorage.getItem(name);
      if (item) {
        // 同步到 IndexedDB
        try {
          const parsed = JSON.parse(item);
          await database.init();
          await database.set(name, parsed);
        } catch {
          // 忽略同步错误
        }
      }
      return item;
    },

    setItem: async (name: string, value: string): Promise<void> => {
      if (!isClient) return;

      try {
        await database.init();
        await database.set(name, JSON.parse(value));
        localStorage.setItem(name, value);
      } catch (e) {
        console.warn('IndexedDB write failed, using localStorage only:', e);
        localStorage.setItem(name, value);
      }
    },

    removeItem: async (name: string): Promise<void> => {
      if (!isClient) return;

      try {
        await database.init();
        await database.delete(name);
      } catch (e) {
        console.warn('IndexedDB delete failed:', e);
      }
      localStorage.removeItem(name);
    }
  };
}

// ========== 多账套数据隔离支持 ==========

// 获取账套隔离的存储键
export function getAccountSetScopedKey(baseKey: string, accountSetId: string | null): string {
  if (!accountSetId) {
    return `${baseKey}:default`;
  }
  return `${baseKey}:${accountSetId}`;
}

// 创建支持多账套隔离的 StateStorage
export function createAccountSetStorage(baseKey: string): StateStorage {
  const isClient = typeof window !== 'undefined';

  // 获取当前账套ID
  const getAccountSetId = (): string | null => {
    if (!isClient) return null;
    try {
      const store = useAccountSetStore.getState();
      return store.currentAccountSetId;
    } catch {
      return null;
    }
  };

  const indexedDBStorage = createIndexedDBStorage(baseKey);

  return {
    getItem: async (name: string): Promise<string | null> => {
      if (!isClient) return null;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      // 使用带账套前缀的键调用 IndexedDB 存储
      return indexedDBStorage.getItem(scopedKey);
    },

    setItem: async (name: string, value: string): Promise<void> => {
      if (!isClient) return;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      // 使用带账套前缀的键调用 IndexedDB 存储
      await indexedDBStorage.setItem(scopedKey, value);
    },

    removeItem: async (name: string): Promise<void> => {
      if (!isClient) return;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      // 使用带账套前缀的键调用 IndexedDB 存储
      await indexedDBStorage.removeItem(scopedKey);
    }
  };
}

// 创建支持多账套的 persist 配置
export function createAccountSetPersistConfig(baseKey: string): any {
  const storage = createAccountSetStorage(baseKey) as any;
  return {
    name: baseKey, // 基础键名，实际存储时会添加账套前缀
    storage,
    partialize: (state: any) => state
  };
}

// SSR-safe persist configuration
export function safePersist<T>(config: any) {
  // 如果不是客户端环境，返回一个不持久化的配置
  if (typeof window === 'undefined') {
    return config;
  }

  // 客户端使用完整的persist配置
  return config;
}

// ========== 数据迁移工具 ==========

// 从 localStorage 迁移数据到 IndexedDB
export async function migrateFromLocalStorageToIndexedDB(): Promise<boolean> {
  const isClient = typeof window !== 'undefined';
  if (!isClient) return false;

  try {
    await database.init();

    const keys = Object.keys(localStorage);
    let migratedCount = 0;

    for (const key of keys) {
      if (key.startsWith('finance-')) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            await database.set(key, parsed);
            migratedCount++;
          } catch {
            // 跳过无法解析的项
          }
        }
      }
    }

    console.log(`Migrated ${migratedCount} items from localStorage to IndexedDB`);
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

// ========== 存储健康检查 ==========

export async function checkStorageHealth(): Promise<{
  indexedDB: boolean;
  localStorage: boolean;
  dataIntegrity: any;
}> {
  const isClient = typeof window !== 'undefined';
  if (!isClient) {
    return { indexedDB: false, localStorage: false, dataIntegrity: null };
  }

  let indexedDBHealth = false;
  let localStorageHealth = false;
  let dataIntegrity = null;

  // 检查 IndexedDB
  try {
    await database.init();
    await database.set('health-check', 'ok');
    const result = await database.get('health-check');
    indexedDBHealth = result === 'ok';
    await database.delete('health-check');

    // 检查数据完整性
    dataIntegrity = await database.checkDataIntegrity();
  } catch (e) {
    console.error('IndexedDB health check failed:', e);
  }

  // 检查 localStorage
  try {
    localStorage.setItem('health-check', 'ok');
    localStorageHealth = localStorage.getItem('health-check') === 'ok';
    localStorage.removeItem('health-check');
  } catch (e) {
    console.error('localStorage health check failed:', e);
  }

  return {
    indexedDB: indexedDBHealth,
    localStorage: localStorageHealth,
    dataIntegrity
  };
}
