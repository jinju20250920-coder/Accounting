import { persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { databaseService } from '@/lib/database';
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
  CURRENCIES: 'finance-currencies',
  PARTNERS: 'finance-partners',
  VOUCHER_TEMPLATES: 'finance-voucher-templates',
  SUMMARIES: 'finance-summaries'
} as const;

// ========== IndexedDB 存储实现 ==========

// 创建 IndexedDB 存储
export function createIndexedDBStorage(): StateStorage {
  const isClient = typeof window !== 'undefined';

  return {
    getItem: async (name: string): Promise<string | null> => {
      if (!isClient) return null;

      console.log(`[IndexedDBStorage] 读取数据，name: ${name}`);
      try {
        await databaseService.init();
        const data = await databaseService.get(name);
        console.log(`[IndexedDBStorage] 从数据库获取数据:`, data);
        if (data) {
          return JSON.stringify(data);
        }
        // 如果 IndexedDB 中没有数据，返回 null，不要从 localStorage 回退
        return null;
      } catch (e) {
        console.warn('IndexedDB read failed:', e);
        return null;
      }
    },

    setItem: async (name: string, value: string): Promise<void> => {
      if (!isClient) return;

      console.log(`[IndexedDBStorage] 保存数据，name: ${name}`);
      try {
        await databaseService.init();
        // 尝试解析 value，如果已经是对象就直接使用
        let parsedValue;
        try {
          parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          parsedValue = value;
        }

        // 安全处理：确保数据可序列化，移除任何函数
        const safeValue = JSON.parse(JSON.stringify(parsedValue));
        console.log(`[IndexedDBStorage] 要保存的数据:`, safeValue);

        if (name.includes('finance-vouchers')) {
          console.log(`[IndexedDBStorage] 凭证数量:`, safeValue.state?.vouchers?.length || 0);
          if (safeValue.state?.vouchers) {
            console.log(`[IndexedDBStorage] 凭证列表:`, safeValue.state.vouchers.map((v: any) => v.voucherNo));
          }
        }

        await databaseService.set(name, safeValue);
        // 同时也写入 localStorage 作为备份（但不回读）
        localStorage.setItem(name, JSON.stringify(safeValue));
        console.log(`[IndexedDBStorage] 数据保存成功`);
      } catch (e) {
        console.warn('IndexedDB write failed, using localStorage only:', e);
        localStorage.setItem(name, value);
      }
    },

    removeItem: async (name: string): Promise<void> => {
      if (!isClient) return;

      console.log(`[IndexedDBStorage] 删除数据，name: ${name}`);
      try {
        await databaseService.init();
        await databaseService.delete(name);
      } catch (e) {
        console.warn('IndexedDB delete failed:', e);
      }
      // 同时也从 localStorage 中删除
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
export function createAccountSetStorage(): StateStorage {
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

  const indexedDBStorage = createIndexedDBStorage();

  return {
    getItem: async (name: string): Promise<string | null> => {
      if (!isClient) return null;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(name, accountSetId);
      console.log(`[createAccountSetStorage] getItem, name: ${name}, accountSetId: ${accountSetId}, scopedKey: ${scopedKey}`);

      // 使用带账套前缀的键调用 IndexedDB 存储
      return indexedDBStorage.getItem(scopedKey);
    },

    setItem: async (name: string, value: string): Promise<void> => {
      if (!isClient) return;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(name, accountSetId);
      console.log(`[createAccountSetStorage] setItem, name: ${name}, accountSetId: ${accountSetId}, scopedKey: ${scopedKey}`);

      // 使用带账套前缀的键调用 IndexedDB 存储
      await indexedDBStorage.setItem(scopedKey, value);
    },

    removeItem: async (name: string): Promise<void> => {
      if (!isClient) return;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(name, accountSetId);
      console.log(`[createAccountSetStorage] removeItem, name: ${name}, accountSetId: ${accountSetId}, scopedKey: ${scopedKey}`);

      // 使用带账套前缀的键调用 IndexedDB 存储
      await indexedDBStorage.removeItem(scopedKey);
    }
  };
}

// 创建支持多账套的 persist 配置
export function createAccountSetPersistConfig(baseKey: string): any {
  const storage = createAccountSetStorage() as any;
  return {
    name: baseKey, // 基础键名，实际存储时会添加账套前缀
    storage,
    // 只持久化纯数据，不持久化函数
    partialize: (state: any) => {
      const newState: any = {};
      for (const key in state) {
        const value = state[key];
        // 跳过函数、undefined 和 null
        if (typeof value !== 'function' && value !== undefined && value !== null) {
          newState[key] = value;
        }
      }
      return newState;
    }
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
    await databaseService.init();

    const keys = Object.keys(localStorage);
    let migratedCount = 0;

    for (const key of keys) {
      if (key.startsWith('finance-')) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            await databaseService.set(key, parsed);
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
    await databaseService.init();
    await databaseService.set('health-check', 'ok');
    const result = await databaseService.get('health-check');
    indexedDBHealth = result === 'ok';
    await databaseService.delete('health-check');

    // 检查数据完整性
    dataIntegrity = await databaseService.checkDataIntegrity();
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
