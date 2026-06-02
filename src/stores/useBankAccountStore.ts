import { create } from 'zustand';
import type { BankAccountBinding, BankAccountBindingInput } from '@/lib/bank-parsers/types';
import { getCurrentService } from '@/lib/database';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from './useAccountSetStore';

type SqliteServiceType = typeof sqliteService;
import { waitForDbInit } from '@/hooks/useDatabaseSync';

interface BankAccountStore {
  bindings: BankAccountBinding[];
  loading: boolean;
  loadBindings: () => Promise<void>;
  addBinding: (data: BankAccountBindingInput) => Promise<BankAccountBinding>;
  updateBinding: (id: string, data: Partial<BankAccountBinding>) => Promise<void>;
  deleteBinding: (id: string) => Promise<void>;
  findByAccountNumber: (accountNumber: string) => BankAccountBinding | undefined;
}

export const useBankAccountStore = create<BankAccountStore>((set, get) => ({
  bindings: [],
  loading: false,

  loadBindings: async () => {
    await waitForDbInit();
    const service = getCurrentService() as SqliteServiceType;
    const bindings = await service.getBankAccountBindings();
    set({ bindings: bindings as BankAccountBinding[] });
  },

  addBinding: async (data) => {
    await waitForDbInit();
    const service = getCurrentService() as SqliteServiceType;
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const currency = data.currency?.trim() || currentAccountSet?.baseCurrency || 'CNY';
    const binding: BankAccountBinding = {
      ...data,
      currency,
      id: `bab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    await service.saveBankAccountBinding(binding);
    set(state => ({ bindings: [binding, ...state.bindings] }));
    return binding;
  },

  updateBinding: async (id, data) => {
    await waitForDbInit();
    const service = getCurrentService() as SqliteServiceType;
    const existing = get().bindings.find(b => b.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    await service.saveBankAccountBinding(updated);
    set(state => ({ bindings: state.bindings.map(b => b.id === id ? updated : b) }));
  },

  deleteBinding: async (id) => {
    await waitForDbInit();
    const service = getCurrentService() as SqliteServiceType;
    await service.deleteBankAccountBinding(id);
    set(state => ({ bindings: state.bindings.filter(b => b.id !== id) }));
  },

  findByAccountNumber: (accountNumber) => {
    return get().bindings.find(b => b.accountNumber === accountNumber);
  },
}));
