'use client';

import { create } from 'zustand';
import { getCurrentService } from '@/lib/database';
import type { Currency } from '@/types';
import { useAccountSetStore } from './useAccountSetStore';

interface CurrencyStore {
  // 状态
  currencies: Currency[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCurrencyId: string | null;

  // CRUD 操作
  addCurrency: (currency: Omit<Currency, 'id' | 'createTime' | 'updateTime'>) => Promise<void>;
  updateCurrency: (id: string, updates: Partial<Omit<Currency, 'id' | 'createTime' | 'updateTime'>>) => Promise<void>;
  deleteCurrency: (id: string) => Promise<void>;
  toggleCurrencyDisabled: (id: string) => Promise<void>;
  setBaseCurrency: (id: string) => Promise<void>;

  // 查询操作
  getCurrencyById: (id: string) => Currency | undefined;
  getCurrencyByCode: (code: string) => Currency | undefined;
  getBaseCurrency: () => Currency | undefined;
  searchCurrencies: (query: string) => Currency[];
  getEnabledCurrencies: () => Currency[];

  // 数据管理
  setSearchQuery: (query: string) => void;
  setSelectedCurrencyId: (id: string | null) => void;
  clearError: () => void;
  initializeCurrencies: () => Promise<void>;

  // 批量操作
  importCurrencies: (currencies: Omit<Currency, 'id' | 'createTime' | 'updateTime'>[]) => Promise<void>;
  exportCurrencies: () => string;
  resetToDefault: () => Promise<void>;
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 默认币别数据
const defaultCurrencies: Omit<Currency, 'id' | 'createTime' | 'updateTime'>[] = [
  {
    code: 'CNY',
    name: '人民币',
    symbol: '¥',
    precision: 2,
    exchangeRate: 1,
    rateStartDate: '2026-01-01',
    gainLossSubjectCode: '6603',
    gainLossSubjectName: '财务费用',
    isBase: true,
    disabled: false
  },
  {
    code: 'USD',
    name: '美元',
    symbol: '$',
    precision: 2,
    exchangeRate: 7.25,
    rateStartDate: '2026-01-01',
    gainLossSubjectCode: '6603',
    gainLossSubjectName: '财务费用',
    isBase: false,
    disabled: false
  },
  {
    code: 'EUR',
    name: '欧元',
    symbol: '€',
    precision: 2,
    exchangeRate: 7.85,
    rateStartDate: '2026-01-01',
    gainLossSubjectCode: '6603',
    gainLossSubjectName: '财务费用',
    isBase: false,
    disabled: false
  },
  {
    code: 'HKD',
    name: '港币',
    symbol: 'HK$',
    precision: 2,
    exchangeRate: 0.93,
    rateStartDate: '2026-01-01',
    gainLossSubjectCode: '6603',
    gainLossSubjectName: '财务费用',
    isBase: false,
    disabled: false
  },
  {
    code: 'JPY',
    name: '日元',
    symbol: '¥',
    precision: 0,
    exchangeRate: 0.048,
    rateStartDate: '2026-01-01',
    gainLossSubjectCode: '6603',
    gainLossSubjectName: '财务费用',
    isBase: false,
    disabled: false
  }
];

export const useCurrencyStore = create<CurrencyStore>((set, get) => ({
  // 初始状态
  currencies: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedCurrencyId: null,

  // 添加币别
  addCurrency: async (currency) => {
    try {
      const state = get();
      const existingCodes = state.currencies.map(c => c.code);

      if (existingCodes.includes(currency.code)) {
        set({ error: '币别代码已存在' });
        return;
      }

      // 获取当前账套ID
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const now = new Date().toISOString();
      const newCurrency: Currency = {
        ...currency,
        id: generateId(),
        createTime: now,
        updateTime: now,
        accountSetId: currentAccountSet?.id
      };

      await getCurrentService().saveCurrencies([...state.currencies, newCurrency]);
      set((state) => ({
        currencies: [...state.currencies, newCurrency],
        error: null
      }));
    } catch (error) {
      console.error('Failed to add currency:', error);
      set({ error: '添加币别失败' });
    }
  },

  // 更新币别
  updateCurrency: async (id, updates) => {
    try {
      const state = get();

      // 如果修改了币别代码，检查是否冲突
      if (updates.code) {
        const existing = state.currencies.find(c => c.code === updates.code && c.id !== id);
        if (existing) {
          set({ error: '币别代码已存在' });
          return;
        }
      }

      const current = state.currencies.find(c => c.id === id);
      if (!current) {
        set({ error: '币别不存在' });
        return;
      }

      // 如果设为记账本位币，需要取消其他币别的本位币标记
      if (updates.isBase) {
        const now = new Date().toISOString();
        const updatedCurrencies = state.currencies.map(c => {
          if (c.id === id) {
            return { ...c, ...updates, isBase: true, updateTime: now };
          }
          return { ...c, isBase: false };
        });
        await getCurrentService().saveCurrencies(updatedCurrencies);
        set({
          currencies: updatedCurrencies,
          error: null
        });
      } else {
        const now = new Date().toISOString();
        const updatedCurrency = { ...current, ...updates, updateTime: now };
        const updatedCurrencies = state.currencies.map(c =>
          c.id === id ? updatedCurrency : c
        );
        await getCurrentService().saveCurrencies(updatedCurrencies);
        set({
          currencies: updatedCurrencies,
          error: null
        });
      }
    } catch (error) {
      console.error('Failed to update currency:', error);
      set({ error: '更新币别失败' });
    }
  },

  // 删除币别
  deleteCurrency: async (id) => {
    try {
      const state = get();
      const currency = state.currencies.find(c => c.id === id);

      if (!currency) {
        set({ error: '币别不存在' });
        return;
      }

      if (currency.isBase) {
        set({ error: '记账本位币不能删除' });
        return;
      }

      await getCurrentService().saveCurrencies(state.currencies.filter(c => c.id !== id));
      set((state) => ({
        currencies: state.currencies.filter(c => c.id !== id),
        selectedCurrencyId: state.selectedCurrencyId === id ? null : state.selectedCurrencyId,
        error: null
      }));
    } catch (error) {
      console.error('Failed to delete currency:', error);
      set({ error: '删除币别失败' });
    }
  },

  // 切换币别禁用状态
  toggleCurrencyDisabled: async (id) => {
    try {
      const state = get();
      const currency = state.currencies.find(c => c.id === id);

      if (currency?.isBase) {
        set({ error: '记账本位币不能禁用' });
        return;
      }

      if (!currency) {
        set({ error: '币别不存在' });
        return;
      }

      const now = new Date().toISOString();
      const updatedCurrency = { ...currency, disabled: !currency.disabled, updateTime: now };
      const updatedCurrencies = state.currencies.map(c =>
        c.id === id ? updatedCurrency : c
      );
      await getCurrentService().saveCurrencies(updatedCurrencies);

      set({
        currencies: updatedCurrencies,
        error: null
      });
    } catch (error) {
      console.error('Failed to toggle currency disabled:', error);
      set({ error: '操作失败' });
    }
  },

  // 设置记账本位币
  setBaseCurrency: async (id) => {
    try {
      const state = get();
      const currency = state.currencies.find(c => c.id === id);

      if (!currency) {
        set({ error: '币别不存在' });
        return;
      }

      if (currency.disabled) {
        set({ error: '已禁用的币别不能设为记账本位币' });
        return;
      }

      const now = new Date().toISOString();
      const updatedCurrencies = state.currencies.map(c => ({
        ...c,
        isBase: c.id === id,
        updateTime: c.id === id ? now : c.updateTime
      }));
      await getCurrentService().saveCurrencies(updatedCurrencies);

      set({
        currencies: updatedCurrencies,
        error: null
      });
    } catch (error) {
      console.error('Failed to set base currency:', error);
      set({ error: '设置记账本位币失败' });
    }
  },

  // 根据ID获取币别
  getCurrencyById: (id) => {
    return get().currencies.find(c => c.id === id);
  },

  // 根据代码获取币别
  getCurrencyByCode: (code) => {
    return get().currencies.find(c => c.code === code);
  },

  // 获取记账本位币
  getBaseCurrency: () => {
    return get().currencies.find(c => c.isBase);
  },

  // 搜索币别
  searchCurrencies: (query) => {
    if (!query.trim()) return get().currencies;

    const lowerQuery = query.toLowerCase();
    return get().currencies.filter(c =>
      c.code.toLowerCase().includes(lowerQuery) ||
      c.name.toLowerCase().includes(lowerQuery) ||
      c.symbol.includes(query)
    );
  },

  // 获取启用的币别
  getEnabledCurrencies: () => {
    return get().currencies.filter(c => !c.disabled);
  },

  // 设置搜索查询
  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  // 设置选中币别
  setSelectedCurrencyId: (id) => {
    set({ selectedCurrencyId: id });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 初始化默认币别数据
  initializeCurrencies: async () => {
    try {
      const state = get();

      // 从数据库加载币别数据
      const currencies = await getCurrentService().getAllCurrencies();

      if (currencies.length > 0) {
        set({ currencies });
        return;
      }

      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const now = new Date().toISOString();
      const initializedCurrencies: Currency[] = defaultCurrencies.map((currency, index) => ({
        ...currency,
        id: `currency_${index}`,
        createTime: now,
        updateTime: now,
        accountSetId: currentAccountSet?.id
      }));

      await getCurrentService().saveCurrencies(initializedCurrencies);
      set({ currencies: initializedCurrencies });
    } catch (error) {
      console.error('Failed to initialize currencies:', error);
      set({ error: '初始化币别数据失败' });
    }
  },

  // 批量导入币别
  importCurrencies: async (currencies) => {
    try {
      const state = get();
      const existingCodes = state.currencies.map(c => c.code);
      const invalidCurrencies: string[] = [];
      const validCurrencies: Currency[] = [];
      const now = new Date().toISOString();

      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      currencies.forEach(currency => {
        if (existingCodes.includes(currency.code)) {
          invalidCurrencies.push(`${currency.code}: 币别代码已存在`);
        } else {
          validCurrencies.push({
            ...currency,
            id: generateId(),
            createTime: now,
            updateTime: now,
            accountSetId: currentAccountSet?.id
          });
          existingCodes.push(currency.code);
        }
      });

      if (invalidCurrencies.length > 0) {
        set({ error: `导入失败：${invalidCurrencies.join('; ')}` });
        return;
      }

      await getCurrentService().saveCurrencies([...state.currencies, ...validCurrencies]);
      set((state) => ({
        currencies: [...state.currencies, ...validCurrencies],
        error: null
      }));
    } catch (error) {
      console.error('Failed to import currencies:', error);
      set({ error: '导入币别失败' });
    }
  },

  // 导出币别
  exportCurrencies: () => {
    const state = get();
    const exportData = state.currencies.map(c => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      precision: c.precision,
      exchangeRate: c.exchangeRate,
      rateStartDate: c.rateStartDate,
      gainLossSubjectCode: c.gainLossSubjectCode,
      gainLossSubjectName: c.gainLossSubjectName,
      isBase: c.isBase,
      disabled: c.disabled
    }));
    return JSON.stringify(exportData, null, 2);
  },

  // 重置为默认数据
  resetToDefault: async () => {
    try {
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const now = new Date().toISOString();
      const initializedCurrencies: Currency[] = defaultCurrencies.map((currency, index) => ({
        ...currency,
        id: `currency_${index}`,
        createTime: now,
        updateTime: now,
        accountSetId: currentAccountSet?.id
      }));

      await getCurrentService().saveCurrencies(initializedCurrencies);
      set({ currencies: initializedCurrencies, error: null });
    } catch (error) {
      console.error('Failed to reset currencies:', error);
      set({ error: '重置币别失败' });
    }
  }
}));
