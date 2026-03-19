// 临时文件 - 即将被移除，用于解决模块缺失问题
import { PersistOptions } from 'zustand/middleware';

// 存储键常量
export const STORAGE_KEYS = {
  VOUCHERS: 'finance-vouchers',
  SUBJECTS: 'finance-subjects',
  DEPARTMENTS: 'finance-departments',
  PROJECTS: 'finance-projects',
  CURRENCIES: 'finance-currencies',
  PARTNERS: 'finance-partners',
  VOUCHER_TEMPLATES: 'finance-voucher-templates',
  SUMMARIES: 'finance-summaries',
  USER_PREFERENCES: 'finance-user-preferences',
  ACCOUNT_SET: 'finance-account-set',
  AUDIT_LOGS: 'finance-audit-logs',
  SETTINGS: 'finance-settings'
};

// 数据版本
export const DATA_VERSIONS = {
  SUBJECTS: 2,
  VOUCHERS: 1,
  DEPARTMENTS: 1,
  PROJECTS: 1,
  CURRENCIES: 1,
  PARTNERS: 1,
  VOUCHER_TEMPLATES: 1,
  SUMMARIES: 1,
  V2: 2,
  V1: 1,
  CURRENT: 2
};

// 创建账套持久化配置 - 临时版本，不使用实际持久化
export function createAccountSetPersistConfig<T>(storageKey: string): PersistOptions<T> {
  return {
    name: storageKey,
    // 暂时禁用持久化，等待完整重构
    skipHydration: true,
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  };
}
