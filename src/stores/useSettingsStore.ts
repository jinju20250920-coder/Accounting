'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DATA_VERSIONS } from './persistence-config';
import type { AssetFinancialSettings } from '@/types';

// 应用设置接口
interface AppSettings {
  // 用户设置
  userName: string;
  company: string;
  fiscalYear: string;
  currency: string;
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  numberFormat: {
    decimalPlaces: number;
    thousandSeparator: boolean;
    currencySymbol: string;
  };

  // 功能设置
  features: {
    autoBalance: boolean;
    autoSave: boolean;
    saveInterval: number; // 分钟
    enableAI: boolean;
    enableAudit: boolean;
    enableExport: boolean;
  };

  // 往来核算方式设置
  accounting: {
    partnerTrackingMethod: 'subject' | 'card'; // 科目方式 或 往来卡片方式
  };

  // 界面设置
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: 'zh-CN' | 'en-US';
    layout: 'standard' | 'compact';
    showHelpTips: boolean;
  };

  // 数据设置
  data: {
    maxVouchersPerMonth: number;
    maxAuditRecords: number;
    dataRetentionDays: number;
    enableCloudSync: boolean;
  };

  // 快捷键设置
  shortcuts: {
    saveVoucher: string;
    newVoucher: string;
    addEntry: string;
    deleteEntry: string;
    autoBalance: string;
  };

  // 资产财务规则设置
  assetFinancialSettings: AssetFinancialSettings;
}

// 默认设置
const defaultSettings: AppSettings = {
  userName: '当前用户',
  company: '',
  fiscalYear: new Date().getFullYear().toString(),
  currency: 'CNY',
  dateFormat: 'YYYY-MM-DD',
  numberFormat: {
    decimalPlaces: 2,
    thousandSeparator: true,
    currencySymbol: '¥'
  },
  features: {
    autoBalance: true,
    autoSave: true,
    saveInterval: 5,
    enableAI: true,
    enableAudit: true,
    enableExport: true
  },
  accounting: {
    partnerTrackingMethod: 'card' // 默认使用往来卡片方式
  },
  ui: {
    theme: 'light',
    language: 'zh-CN',
    layout: 'standard',
    showHelpTips: true
  },
  data: {
    maxVouchersPerMonth: 1000,
    maxAuditRecords: 5000,
    dataRetentionDays: 365,
    enableCloudSync: false
  },
  shortcuts: {
    saveVoucher: 'Ctrl+S',
    newVoucher: 'Ctrl+N',
    addEntry: 'Tab',
    deleteEntry: 'Delete',
    autoBalance: 'Ctrl+B'
  },
  assetFinancialSettings: {
    impairmentMethod: 'provision',
    disposalVoucherMode: 'auto',
    subjectConfigs: [
      // 固定资产
      {
        assetType: 'fixed',
        clearingSubjectCode: '1601',        // 固定资产清理
        impairmentLossSubjectCode: '6701',  // 资产减值损失
        impairmentProvisionSubjectCode: '1503', // 固定资产减值准备
        gainSubjectCode: '6301',            // 营业外收入
        lossSubjectCode: '6711',            // 营业外支出
      },
      // 无形资产
      {
        assetType: 'intangible',
        clearingSubjectCode: '1703',        // 无形资产清理（或累计摊销）
        impairmentLossSubjectCode: '6701',  // 资产减值损失
        impairmentProvisionSubjectCode: '1703', // 无形资产减值准备
        gainSubjectCode: '6301',            // 营业外收入
        lossSubjectCode: '6711',            // 营业外支出
      },
    ],
  }
};

// V1到V2的迁移函数
const migrateV1ToV2 = (state: any) => {
  if (!state.settings) return state;

  // 合并旧的设置到新的结构
  const migratedSettings = {
    ...defaultSettings,
    ...state.settings,
    ui: {
      ...defaultSettings.ui,
      ...(state.settings.ui || {})
    },
    features: {
      ...defaultSettings.features,
      ...(state.settings.features || {})
    },
    data: {
      ...defaultSettings.data,
      ...(state.settings.data || {})
    }
  };

  return {
    ...state,
    settings: migratedSettings,
    version: DATA_VERSIONS.V2
  };
};

// 设置Store
interface SettingsStore {
  settings: AppSettings;

  // 设置操作
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  exportSettings: () => string;
  importSettings: (data: string) => boolean;

  // 快捷访问
  getUserInfo: () => { name: string; company: string; };
  getFeatureFlags: () => AppSettings['features'];
  getUIPreferences: () => AppSettings['ui'];
  getAssetFinancialSettings: () => AssetFinancialSettings;
}

// 数据迁移配置
const migrations = {
  [DATA_VERSIONS.V1 + 1]: migrateV1ToV2
};

export const useSettingsStore = create<SettingsStore>()(
  persist((set, get) => ({
    settings: defaultSettings,

  // 更新设置
  updateSettings: (newSettings) => set((state) => ({
    settings: {
      ...state.settings,
      ...newSettings,
      // 确保嵌套对象正确合并
      ...(newSettings.numberFormat && {
        numberFormat: { ...state.settings.numberFormat, ...newSettings.numberFormat }
      }),
      ...(newSettings.features && {
        features: { ...state.settings.features, ...newSettings.features }
      }),
      ...(newSettings.ui && {
        ui: { ...state.settings.ui, ...newSettings.ui }
      }),
      ...(newSettings.data && {
        data: { ...state.settings.data, ...newSettings.data }
      }),
      ...(newSettings.shortcuts && {
        shortcuts: { ...state.settings.shortcuts, ...newSettings.shortcuts }
      }),
      ...(newSettings.accounting && {
        accounting: { ...state.settings.accounting, ...newSettings.accounting }
      }),
      ...(newSettings.assetFinancialSettings && {
        assetFinancialSettings: { ...state.settings.assetFinancialSettings, ...newSettings.assetFinancialSettings }
      })
    }
  })),

  // 重置设置
  resetSettings: () => set({
    settings: defaultSettings
  }),

  // 导出设置
  exportSettings: () => {
    const state = get();
    return JSON.stringify({
      version: DATA_VERSIONS.CURRENT,
      settings: state.settings,
      exportTime: new Date().toISOString()
    }, null, 2);
  },

  // 导入设置
  importSettings: (data) => {
    try {
      const parsed = JSON.parse(data);

      // 验证数据格式
      if (!parsed.settings) {
        throw new Error('Invalid settings data format');
      }

      set({
        settings: { ...defaultSettings, ...parsed.settings }
      });

      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  },

  // 获取用户信息
  getUserInfo: () => {
    const state = get();
    return {
      name: state.settings.userName,
      company: state.settings.company
    };
  },

  // 获取功能标志
  getFeatureFlags: () => {
    const state = get();
    return state.settings.features;
  },

  // 获取UI偏好
  getUIPreferences: () => {
    const state = get();
    return state.settings.ui;
  },

  // 获取资产财务规则设置
  getAssetFinancialSettings: () => get().settings.assetFinancialSettings
}),
{
  name: 'finance-settings',
  partialize: (state) => ({
    settings: state.settings
  })
}
));