// 持久化配置 - 用于 Zustand persist 中间件
// 注意：主数据（凭证、科目等）通过 SQLite/OPFS 数据库持久化
// 此配置仅用于 UI 状态和辅助数据的持久化
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

// 创建持久化配置 - 使用 localStorage 持久化 UI 状态
export function createAccountSetPersistConfig<T>(storageKey: string): PersistOptions<T> {
  return {
    name: storageKey,
  };
}
