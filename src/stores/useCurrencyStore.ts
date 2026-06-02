'use client';

import { create } from 'zustand';
import { getCurrentService } from '@/lib/database';
import type { Currency, FxRate } from '@/types';
import { useAccountSetStore } from './useAccountSetStore';

interface CurrencyStore {
  currencies: Currency[];
  fxRates: FxRate[];
  loading: boolean;
  fxLoading: boolean;
  error: string | null;
  fxError: string | null;
  searchQuery: string;
  selectedCurrencyId: string | null;

  addCurrency: (currency: Omit<Currency, 'id' | 'createTime' | 'updateTime'>) => Promise<void>;
  updateCurrency: (id: string, updates: Partial<Omit<Currency, 'id' | 'createTime' | 'updateTime'>>) => Promise<void>;
  deleteCurrency: (id: string) => Promise<void>;
  toggleCurrencyDisabled: (id: string) => Promise<void>;
  setBaseCurrency: (id: string) => Promise<void>;

  getCurrencyById: (id: string) => Currency | undefined;
  getCurrencyByCode: (code: string) => Currency | undefined;
  getBaseCurrency: () => Currency | undefined;
  searchCurrencies: (query: string) => Currency[];
  getEnabledCurrencies: () => Currency[];
  getFxRates: () => FxRate[];

  setSearchQuery: (query: string) => void;
  setSelectedCurrencyId: (id: string | null) => void;
  clearError: () => void;
  clearFxError: () => void;
  initializeCurrencies: () => Promise<void>;
  initializeFxRates: () => Promise<void>;

  importCurrencies: (currencies: Omit<Currency, 'id' | 'createTime' | 'updateTime'>[]) => Promise<void>;
  exportCurrencies: () => string;
  resetToDefault: () => Promise<void>;
  upsertFxRate: (rate: Omit<FxRate, 'id' | 'createTime' | 'updateTime'> & { id?: string }) => Promise<void>;
  deleteFxRate: (id: string) => Promise<void>;
}

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;

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

function nowIso(): string {
  return new Date().toISOString();
}

function attachAccountSetId(currency: Omit<Currency, 'id' | 'createTime' | 'updateTime'>, accountSetId?: string): Currency {
  const timestamp = nowIso();
  return {
    ...currency,
    id: generateId(),
    createTime: timestamp,
    updateTime: timestamp,
    accountSetId
  };
}

export const useCurrencyStore = create<CurrencyStore>((set, get) => ({
  currencies: [],
  fxRates: [],
  loading: false,
  fxLoading: false,
  error: null,
  fxError: null,
  searchQuery: '',
  selectedCurrencyId: null,

  addCurrency: async (currency) => {
    try {
      const state = get();
      if (state.currencies.some(item => item.code === currency.code)) {
        set({ error: '币别代码已存在' });
        return;
      }

      const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const newCurrency = attachAccountSetId(currency, currentAccountSet?.id);
      const nextCurrencies = [...state.currencies, newCurrency];

      await getCurrentService().saveCurrencies(nextCurrencies);
      set({ currencies: nextCurrencies, error: null });
    } catch (error) {
      console.error('Failed to add currency:', error);
      set({ error: '添加币别失败' });
    }
  },

  updateCurrency: async (id, updates) => {
    try {
      const state = get();
      const current = state.currencies.find(item => item.id === id);
      if (!current) {
        set({ error: '币别不存在' });
        return;
      }

      if (updates.code && state.currencies.some(item => item.code === updates.code && item.id !== id)) {
        set({ error: '币别代码已存在' });
        return;
      }

      const now = nowIso();
      const updatedCurrencies = state.currencies.map(item => {
        if (item.id !== id) {
          if (updates.isBase === true) {
            return { ...item, isBase: false };
          }
          return item;
        }
        return {
          ...item,
          ...updates,
          isBase: updates.isBase ?? item.isBase,
          updateTime: now
        };
      });

      if (updates.isBase) {
        for (let i = 0; i < updatedCurrencies.length; i += 1) {
          if (updatedCurrencies[i].id !== id) {
            updatedCurrencies[i] = { ...updatedCurrencies[i], isBase: false };
          }
        }
      }

      await getCurrentService().saveCurrencies(updatedCurrencies);
      set({ currencies: updatedCurrencies, error: null });
    } catch (error) {
      console.error('Failed to update currency:', error);
      set({ error: '更新币别失败' });
    }
  },

  deleteCurrency: async (id) => {
    try {
      const state = get();
      const currency = state.currencies.find(item => item.id === id);
      if (!currency) {
        set({ error: '币别不存在' });
        return;
      }
      if (currency.isBase) {
        set({ error: '记账本位币不能删除' });
        return;
      }

      const nextCurrencies = state.currencies.filter(item => item.id !== id);
      await getCurrentService().saveCurrencies(nextCurrencies);
      set({
        currencies: nextCurrencies,
        selectedCurrencyId: state.selectedCurrencyId === id ? null : state.selectedCurrencyId,
        error: null
      });
    } catch (error) {
      console.error('Failed to delete currency:', error);
      set({ error: '删除币别失败' });
    }
  },

  toggleCurrencyDisabled: async (id) => {
    try {
      const state = get();
      const currency = state.currencies.find(item => item.id === id);
      if (!currency) {
        set({ error: '币别不存在' });
        return;
      }
      if (currency.isBase) {
        set({ error: '记账本位币不能禁用' });
        return;
      }

      const now = nowIso();
      const nextCurrencies = state.currencies.map(item =>
        item.id === id ? { ...item, disabled: !item.disabled, updateTime: now } : item
      );
      await getCurrentService().saveCurrencies(nextCurrencies);
      set({ currencies: nextCurrencies, error: null });
    } catch (error) {
      console.error('Failed to toggle currency disabled:', error);
      set({ error: '操作失败' });
    }
  },

  setBaseCurrency: async (id) => {
    try {
      const state = get();
      const currency = state.currencies.find(item => item.id === id);
      if (!currency) {
        set({ error: '币别不存在' });
        return;
      }
      if (currency.disabled) {
        set({ error: '已禁用的币别不能设为记账本位币' });
        return;
      }

      const now = nowIso();
      const updatedCurrencies = state.currencies.map(item => ({
        ...item,
        isBase: item.id === id,
        updateTime: item.id === id ? now : item.updateTime
      }));
      await getCurrentService().saveCurrencies(updatedCurrencies);

      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      if (currentAccountSet) {
        accountSetStore.updateAccountSet(currentAccountSet.id, {
          baseCurrency: currency.code,
          baseCurrencyName: currency.name
        });
        await getCurrentService().saveAccountSetBaseCurrency(currency.code, currency.name, currentAccountSet.id);
      }

      set({ currencies: updatedCurrencies, error: null });
    } catch (error) {
      console.error('Failed to set base currency:', error);
      set({ error: '设置记账本位币失败' });
    }
  },

  getFxRates: () => get().fxRates,

  getCurrencyById: (id) => get().currencies.find(item => item.id === id),
  getCurrencyByCode: (code) => get().currencies.find(item => item.code === code),
  getBaseCurrency: () => {
    const state = get();
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const baseCurrencyCode = accountSet?.baseCurrency || 'CNY';
    return state.currencies.find(item => item.isBase) || state.currencies.find(item => item.code === baseCurrencyCode);
  },
  searchCurrencies: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return get().currencies;
    const lowerQuery = trimmed.toLowerCase();
    return get().currencies.filter(currency =>
      currency.code.toLowerCase().includes(lowerQuery) ||
      currency.name.toLowerCase().includes(lowerQuery) ||
      currency.symbol.includes(trimmed)
    );
  },
  getEnabledCurrencies: () => get().currencies.filter(item => !item.disabled),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCurrencyId: (id) => set({ selectedCurrencyId: id }),
  clearError: () => set({ error: null }),
  clearFxError: () => set({ fxError: null }),

  initializeCurrencies: async () => {
    try {
      set({ loading: true, error: null });

      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const service = getCurrentService();
      const currencies = await service.getAllCurrencies();

      if (currencies.length > 0) {
        set({ currencies, loading: false });

        if (currentAccountSet && !currentAccountSet.baseCurrency) {
          accountSetStore.updateAccountSet(currentAccountSet.id, {
            baseCurrency: 'CNY',
            baseCurrencyName: '人民币'
          });
          await service.saveAccountSetBaseCurrency('CNY', '人民币', currentAccountSet.id);
        }
        return;
      }

      const timestamp = nowIso();
      const initializedCurrencies: Currency[] = defaultCurrencies.map((currency, index) => ({
        ...currency,
        id: `currency_${index}`,
        createTime: timestamp,
        updateTime: timestamp,
        accountSetId: currentAccountSet?.id
      }));

      await service.saveCurrencies(initializedCurrencies);

      if (currentAccountSet && !currentAccountSet.baseCurrency) {
        accountSetStore.updateAccountSet(currentAccountSet.id, {
          baseCurrency: 'CNY',
          baseCurrencyName: '人民币'
        });
        await service.saveAccountSetBaseCurrency('CNY', '人民币', currentAccountSet.id);
      }

      set({ currencies: initializedCurrencies, loading: false, error: null });
    } catch (error) {
      console.error('Failed to initialize currencies:', error);
      set({ error: '初始化币别数据失败', loading: false });
    }
  },

  initializeFxRates: async () => {
    try {
      set({ fxLoading: true, fxError: null });
      const rates = await getCurrentService().getFxRates();
      set({ fxRates: rates, fxLoading: false, fxError: null });
    } catch (error) {
      console.error('Failed to initialize FX rates:', error);
      set({ fxError: '初始化汇率数据失败', fxLoading: false });
    }
  },

  importCurrencies: async (currencies) => {
    try {
      const state = get();
      const existingCodes = new Set(state.currencies.map(item => item.code));
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const timestamp = nowIso();
      const imported: Currency[] = [];

      for (const currency of currencies) {
        if (existingCodes.has(currency.code)) {
          set({ error: `导入失败：币别代码 ${currency.code} 已存在` });
          return;
        }
        imported.push({
          ...currency,
          id: generateId(),
          createTime: timestamp,
          updateTime: timestamp,
          accountSetId: currentAccountSet?.id
        });
        existingCodes.add(currency.code);
      }

      const nextCurrencies = [...state.currencies, ...imported];
      await getCurrentService().saveCurrencies(nextCurrencies);
      set({ currencies: nextCurrencies, error: null });
    } catch (error) {
      console.error('Failed to import currencies:', error);
      set({ error: '导入币别失败' });
    }
  },

  exportCurrencies: () => {
    const state = get();
    const exportData = state.currencies.map(currency => ({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      precision: currency.precision,
      exchangeRate: currency.exchangeRate,
      rateStartDate: currency.rateStartDate,
      gainLossSubjectCode: currency.gainLossSubjectCode,
      gainLossSubjectName: currency.gainLossSubjectName,
      isBase: currency.isBase,
      disabled: currency.disabled
    }));
    return JSON.stringify(exportData, null, 2);
  },

  resetToDefault: async () => {
    try {
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const timestamp = nowIso();

      const initializedCurrencies: Currency[] = defaultCurrencies.map((currency, index) => ({
        ...currency,
        id: `currency_${index}`,
        createTime: timestamp,
        updateTime: timestamp,
        accountSetId: currentAccountSet?.id
      }));

      await getCurrentService().saveCurrencies(initializedCurrencies);

      if (currentAccountSet) {
        accountSetStore.updateAccountSet(currentAccountSet.id, {
          baseCurrency: 'CNY',
          baseCurrencyName: '人民币'
        });
        await getCurrentService().saveAccountSetBaseCurrency('CNY', '人民币', currentAccountSet.id);
      }

      set({ currencies: initializedCurrencies, error: null });
    } catch (error) {
      console.error('Failed to reset currencies:', error);
      set({ error: '重置币别失败' });
    }
  },

  upsertFxRate: async (rate) => {
    try {
      const state = get();
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const accountSetId = currentAccountSet?.id || rate.accountSetId || 'default';
      const baseCurrency =
        rate.baseCurrency ||
        get().getBaseCurrency()?.code ||
        (currentAccountSet?.baseCurrency && /^[A-Z]{3}$/.test(currentAccountSet.baseCurrency) ? currentAccountSet.baseCurrency : '') ||
        'CNY';
      const timestamp = nowIso();

      const existingById = rate.id ? state.fxRates.find(item => item.id === rate.id) : undefined;
      const existingByKey = state.fxRates.find(item => item.rateDate === rate.rateDate && item.currencyCode === rate.currencyCode && item.accountSetId === accountSetId);
      const existing = existingById || existingByKey;

      if (!existing && state.fxRates.some(item => item.rateDate === rate.rateDate && item.currencyCode === rate.currencyCode && item.accountSetId === accountSetId)) {
        set({ fxError: '同一日期和币种的汇率已存在' });
        return;
      }

      if (existingById && existingByKey && existingById.id !== existingByKey.id) {
        set({ fxError: '同一日期和币种的汇率已存在' });
        return;
      }

      const nextRate: FxRate = existing
        ? {
            ...existing,
            ...rate,
            accountSetId,
            baseCurrency,
            id: existing.id,
            updateTime: timestamp
          }
        : {
            id: generateId(),
            accountSetId,
            rateDate: rate.rateDate,
            currencyCode: rate.currencyCode,
            baseCurrency,
            middleRate: rate.middleRate,
            source: rate.source || 'manual',
            createTime: timestamp,
            updateTime: timestamp
          };

      await getCurrentService().saveFxRates([nextRate]);

      const nextRates = existing
        ? state.fxRates.map(item => (item.id === nextRate.id ? nextRate : item))
        : [...state.fxRates, nextRate];

      set({ fxRates: nextRates, fxError: null });
    } catch (error) {
      console.error('Failed to save FX rate:', error);
      set({ fxError: '保存汇率失败' });
    }
  },

  deleteFxRate: async (id) => {
    try {
      const state = get();
      const current = state.fxRates.find(item => item.id === id);
      if (!current) {
        set({ fxError: '汇率记录不存在' });
        return;
      }

      const service = getCurrentService() as any;
      const db = await service.getDatabase?.();
      if (!db || typeof db.prepare !== 'function') {
        set({ fxError: '当前数据库不支持删除汇率记录' });
        return;
      }

      const stmt = db.prepare('DELETE FROM fxRates WHERE id = ? AND accountSetId = ?');
      stmt.run([id, current.accountSetId]);
      stmt.free?.();
      await service.persist?.();

      set({
        fxRates: state.fxRates.filter(item => item.id !== id),
        fxError: null
      });
    } catch (error) {
      console.error('Failed to delete FX rate:', error);
      set({ fxError: '删除汇率失败' });
    }
  }
}));
