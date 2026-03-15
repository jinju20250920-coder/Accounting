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

// 创建简单的存储配置（不带版本控制）
export function createVersionStorage<T>(name: string): any {
  // 检查是否在客户端环境
  const isClient = typeof window !== 'undefined';

  const storage: StateStorage = {
    getItem: async (name: string) => {
      // 服务器端返回 null
      if (!isClient) {
        return null;
      }

      try {
        await database.init();
        const data = await database.get(name);
        if (data) {
          return JSON.stringify(data);
        }
      } catch (e) {
        console.warn('IndexedDB read failed, falling back to localStorage:', e);
      }

      const item = localStorage.getItem(name);
      if (!item) return null;

      return item;
    },

    setItem: async (name: string, value: string) => {
      if (!isClient) {
        return;
      }

      try {
        await database.init();
        await database.set(name, JSON.parse(value));
        localStorage.setItem(name, value);
      } catch (e) {
        console.warn('IndexedDB write failed, using localStorage only:', e);
        localStorage.setItem(name, value);
      }
    },

    removeItem: async (name: string) => {
      if (!isClient) {
        return;
      }

      try {
        await database.init();
        await database.delete(name);
      } catch (e) {
        console.warn('IndexedDB delete failed:', e);
      }
      localStorage.removeItem(name);
    }
  };

  return {
    name,
    storage,
    partialize: (state: any) => state
  };
}

// 创建带版本控制的存储配置
export function createVersionedStorage<T>(name: string, migrations: Record<number, MigrationFunction>): any {
  // 检查是否在客户端环境
  const isClient = typeof window !== 'undefined';

  const storage: StateStorage = {
    getItem: async (name: string) => {
      // 服务器端返回 null
      if (!isClient) {
        return null;
      }

      // 优先从 IndexedDB 获取
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
      if (!item) return null;

      try {
        const parsed = JSON.parse(item);

        // 如果没有版本信息，默认为V1
        if (!parsed.version) {
          return JSON.stringify({
            state: parsed,
            version: DATA_VERSIONS.V1
          });
        }

        return JSON.stringify(parsed);
      } catch {
        return null;
      }
    },

    setItem: async (name: string, value: string) => {
      // 服务器端不执行存储操作
      if (!isClient) {
        return;
      }

      try {
        // 同时保存到 IndexedDB 和 localStorage
        await database.init();
        await database.set(name, JSON.parse(value));
        localStorage.setItem(name, value);
      } catch (e) {
        console.warn('IndexedDB write failed, using localStorage only:', e);
        localStorage.setItem(name, value);
      }
    },

    removeItem: async (name: string) => {
      // 服务器端不执行删除操作
      if (!isClient) {
        return;
      }

      try {
        await database.init();
        await database.delete(name);
      } catch (e) {
        console.warn('IndexedDB delete failed:', e);
      }
      localStorage.removeItem(name);
    }
  };

  // 返回持久化中间件，不包含迁移功能
  // 返回一个简单的持久化配置
  return {
    name,
    storage,
    partialize: (state: any) => state
  };
}

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

// SSR-safe persist configuration
export function safePersist<T>(config: any) {
  // 如果不是客户端环境，返回一个不持久化的配置
  if (typeof window === 'undefined') {
    return config;
  }

  // 客户端使用完整的persist配置
  return config;
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

  return {
    getItem: async (name: string) => {
      if (!isClient) return null;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      try {
        await database.init();
        const data = await database.get(scopedKey);
        if (data) {
          return JSON.stringify(data);
        }
      } catch (e) {
        console.warn('IndexedDB read failed, falling back to localStorage:', e);
      }

      const item = localStorage.getItem(scopedKey);
      if (!item) return null;

      return item;
    },

    setItem: async (name: string, value: string) => {
      if (!isClient) return;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      try {
        await database.init();
        await database.set(scopedKey, JSON.parse(value));
        localStorage.setItem(scopedKey, value);
      } catch (e) {
        console.warn('IndexedDB write failed, using localStorage only:', e);
        localStorage.setItem(scopedKey, value);
      }
    },

    removeItem: async (name: string) => {
      if (!isClient) return;

      const accountSetId = getAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      try {
        await database.init();
        await database.delete(scopedKey);
      } catch (e) {
        console.warn('IndexedDB delete failed:', e);
      }
      localStorage.removeItem(scopedKey);
    }
  };
}

// 创建支持多账套的 persist 配置
export function createAccountSetPersistConfig(baseKey: string) {
  const storage = createAccountSetStorage(baseKey);
  return {
    name: baseKey, // 基础键名，实际存储时会添加账套前缀
    storage,
    partialize: (state: any) => state
  };
}