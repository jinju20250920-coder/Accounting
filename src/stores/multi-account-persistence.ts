import { StateStorage } from 'zustand/middleware';
import { databaseService } from '@/lib/database';
import { useAccountSetStore } from './useAccountSetStore';

/**
 * 多账套数据隔离存储系统
 *
 * 设计思路：
 * - 每个账套的数据使用独立的存储键，格式为：{baseKey}:{accountSetId}
 * - 当没有选择账套时，数据会自动隔离存储和加载
 */

// 账套数据缓存 - 在内存中缓存各账套的数据
const accountSetDataCache = new Map<string, Map<string, any>>();

// 获取当前账套ID
function getCurrentAccountSetId(): string | null {
  try {
    const store = useAccountSetStore.getState();
    return store.currentAccountSetId;
  } catch {
    return null;
  }
}

// 为账套生成存储键
function getAccountSetScopedKey(baseKey: string, accountSetId: string | null): string {
  if (!accountSetId) {
    return `${baseKey}:default`;
  }
  return `${baseKey}:${accountSetId}`;
}

// 获取账套数据缓存
function getAccountSetCache(accountSetId: string): Map<string, any> {
  if (!accountSetDataCache.has(accountSetId)) {
    accountSetDataCache.set(accountSetId, new Map());
  }
  return accountSetDataCache.get(accountSetId)!;
}

/**
 * 创建支持多账套隔离的 StateStorage
 * 这是一个包装器，会根据当前选择的账套自动选择正确的存储键
 */
export function createAccountSetScopedStorage(baseKey: string): StateStorage {
  const isClient = typeof window !== 'undefined';

  return {
    getItem: async (name: string) => {
      if (!isClient) return null;

      const accountSetId = getCurrentAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      // 首先检查内存缓存
      const cache = getAccountSetCache(accountSetId || 'default');
      if (cache.has(scopedKey)) {
        return JSON.stringify(cache.get(scopedKey));
      }

      try {
        // 尝试从 IndexedDB 获取
        await databaseService.init();
        const data = await databaseService.get(scopedKey);
        if (data) {
          cache.set(scopedKey, data);
          return JSON.stringify(data);
        }
      } catch (e) {
        console.warn('IndexedDB read failed, falling back to localStorage:', e);
      }

      // 回退到 localStorage
      const item = localStorage.getItem(scopedKey);
      if (!item) return null;

      // 同步到内存缓存
      try {
        const parsed = JSON.parse(item);
        cache.set(scopedKey, parsed);
      } catch {
        // 忽略
      }

      return item;
    },

    setItem: async (name: string, value: string) => {
      if (!isClient) return;

      const accountSetId = getCurrentAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      // 解析值
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      // 更新内存缓存
      const cache = getAccountSetCache(accountSetId || 'default');
      cache.set(scopedKey, parsedValue);

      try {
        // 同时保存到 IndexedDB 和 localStorage
        await databaseService.init();
        await databaseService.set(scopedKey, parsedValue);
        localStorage.setItem(scopedKey, value);
      } catch (e) {
        console.warn('IndexedDB write failed, using localStorage only:', e);
        localStorage.setItem(scopedKey, value);
      }
    },

    removeItem: async (name: string) => {
      if (!isClient) return;

      const accountSetId = getCurrentAccountSetId();
      const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

      // 清除内存缓存
      const cache = getAccountSetCache(accountSetId || 'default');
      cache.delete(scopedKey);

      try {
        await databaseService.init();
        await databaseService.delete(scopedKey);
      } catch (e) {
        console.warn('IndexedDB delete failed:', e);
      }
      localStorage.removeItem(scopedKey);
    }
  };
}

/**
 * 为指定账套创建持久化配置
 */
export function getAccountSetPersistConfig(baseKey: string, accountSetId: string) {
  const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);
  return {
    name: scopedKey,
    storage: createAccountSetScopedStorage(baseKey)
  };
}

/**
 * 迁移数据从默认存储迁移到账套隔离存储
 * 用于将旧数据迁移到新的账套隔离格式
 */
export async function migrateToAccountSetScoped(
  baseKey: string,
  targetAccountSetId: string,
  deleteOldData: boolean = false
): Promise<boolean> {
  const isClient = typeof window !== 'undefined';
  if (!isClient) return false;

  const oldKey = baseKey;
  const newKey = getAccountSetScopedKey(baseKey, targetAccountSetId);

  try {
    // 从旧存储读取数据
    const oldData = localStorage.getItem(oldKey);
    if (!oldData) {
      console.log(`No old data found for ${oldKey}`);
      return true;
    }

    // 写入新存储
    localStorage.setItem(newKey, oldData);

    try {
      await databaseService.init();
      const parsed = JSON.parse(oldData);
      await databaseService.set(newKey, parsed);
    } catch {
      // 忽略 IndexedDB 错误
    }

    // 如果需要删除旧数据
    if (deleteOldData) {
      localStorage.removeItem(oldKey);
      try {
        await databaseService.init();
        await databaseService.delete(oldKey);
      } catch {
        // 忽略
      }
    }

    console.log(`Migrated ${oldKey} to ${newKey}`);
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

/**
 * 清除指定账套的所有数据
 */
export async function clearAccountSetData(accountSetId: string, baseKeys: string[]): Promise<void> {
  const isClient = typeof window !== 'undefined';
  if (!isClient) return;

  for (const baseKey of baseKeys) {
    const scopedKey = getAccountSetScopedKey(baseKey, accountSetId);

    // 清除内存缓存
    const cache = getAccountSetCache(accountSetId);
    cache.delete(scopedKey);

    try {
      await databaseService.init();
      await databaseService.delete(scopedKey);
    } catch {
      // 忽略
    }
    localStorage.removeItem(scopedKey);
  }

  // 清除整个账套的缓存
  accountSetDataCache.delete(accountSetId);
}

/**
 * 复制一个账套的数据到另一个账套
 */
export async function copyAccountSetData(
  sourceAccountSetId: string,
  targetAccountSetId: string,
  baseKeys: string[]
): Promise<boolean> {
  const isClient = typeof window !== 'undefined';
  if (!isClient) return false;

  try {
    for (const baseKey of baseKeys) {
      const sourceKey = getAccountSetScopedKey(baseKey, sourceAccountSetId);
      const targetKey = getAccountSetScopedKey(baseKey, targetAccountSetId);

      const data = localStorage.getItem(sourceKey);
      if (data) {
        localStorage.setItem(targetKey, data);
        try {
          await databaseService.init();
          const parsed = JSON.parse(data);
          await databaseService.set(targetKey, parsed);
        } catch {
          // 忽略
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
}
