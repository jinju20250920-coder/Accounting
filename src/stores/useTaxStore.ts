'use client';

import { create } from 'zustand';
import { getCurrentService } from '@/lib/database';
import { getCurrentTaxDeadlines, computeCurrentPeriod, buildDefaultTaxItems } from '@/lib/tax-deadlines';
import { useAccountSetStore } from './useAccountSetStore';
import type { TaxItem, TaxFiling, TaxHoliday, TaxDeadlineAlert } from '@/types';

export interface TaxStore {
  taxItems: TaxItem[];
  taxFilings: TaxFiling[];
  holidays: TaxHoliday[];
  loading: boolean;

  initialize: () => Promise<void>;
  getEnabledTaxItems: () => TaxItem[];
  getCurrentAlerts: () => TaxDeadlineAlert[];                 // 零写入
  ensureCurrentPeriodFilings: () => Promise<void>;            // 税务页用：懒创建落库
  markFiled: (taxItemId: string, taxPeriod: string, patch: { filedDate?: string; taxableAmount?: number; paidAmount?: number }) => Promise<void>;
  unmarkFiled: (taxItemId: string, taxPeriod: string) => Promise<void>;
  linkVoucher: (taxItemId: string, taxPeriod: string, voucherId: string, voucherNo: string) => Promise<void>;
  updateFilingAmounts: (taxItemId: string, taxPeriod: string, patch: { taxableAmount?: number; paidAmount?: number }) => Promise<void>;
  addTaxItem: (item: Omit<TaxItem, 'id' | 'tenantId' | 'accountSetId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTaxItem: (id: string, patch: Partial<TaxItem>) => Promise<void>;
  toggleTaxItem: (id: string, enabled: boolean) => Promise<void>;
  deleteTaxItem: (id: string) => Promise<void>;
  addHoliday: (h: Omit<TaxHoliday, 'id' | 'isBuiltIn'>) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
}

export const useTaxStore = create<TaxStore>((set, get) => {
  const ctx = () => {
    const s = getCurrentService();
    return { svc: s, tenantId: s.tenantId, accountSetId: s.accountSetId };
  };
  const nowISO = () => new Date().toISOString();

  return {
    taxItems: [], taxFilings: [], holidays: [], loading: false,

    initialize: async () => {
      set({ loading: true });
      try {
        const { svc, tenantId, accountSetId } = ctx();
        // 首次进入：seed 默认税种
        let items = await svc.listTaxItems();
        if (items.length === 0) {
          const acs = useAccountSetStore.getState().getCurrentAccountSet();
          const tp = acs?.accounting?.taxpayerType ?? 'small';
          const seeded = buildDefaultTaxItems(tenantId, accountSetId, tp);
          for (const it of seeded) await svc.saveTaxItem(it);
          items = await svc.listTaxItems();
        }
        const [filings, holidays] = await Promise.all([
          svc.listTaxFilings(),
          svc.listTaxHolidays(),
        ]);
        set({ taxItems: items, taxFilings: filings, holidays });
      } finally {
        set({ loading: false });
      }
    },

    getEnabledTaxItems: () => get().taxItems.filter(i => i.isEnabled),

    getCurrentAlerts: () => {
      const { taxItems, holidays, taxFilings } = get();
      return getCurrentTaxDeadlines(taxItems, holidays, taxFilings, new Date());
    },

    ensureCurrentPeriodFilings: async () => {
      const { svc, tenantId, accountSetId } = ctx();
      const { taxItems, holidays, taxFilings } = get();
      const today = new Date();
      const toCreate: TaxFiling[] = [];
      for (const item of taxItems.filter(i => i.isEnabled)) {
        const { taxPeriod, periodLabel } = computeCurrentPeriod(item, today);
        const exists = taxFilings.find(f => f.taxItemId === item.id && f.taxPeriod === taxPeriod);
        if (!exists) {
          // 重算含节假日的截止日
          const alerts = getCurrentTaxDeadlines([item], holidays, [], today);
          const dl = alerts[0]?.deadline ?? computeCurrentPeriod(item, today).deadline;
          toCreate.push({
            id: `tf_${accountSetId}_${item.id}_${taxPeriod}`,
            tenantId, accountSetId, taxItemId: item.id, taxName: item.taxName,
            taxPeriod, periodLabel, deadline: dl, isFiled: false,
            createdAt: nowISO(), updatedAt: nowISO(),
          });
        }
      }
      if (toCreate.length === 0) return;
      for (const f of toCreate) await svc.saveTaxFiling(f);
      // 从 DB 重载（DB 有 UNIQUE 约束是去重后的真值；append 方式在多次并发调用时会累积重复行）
      const fresh = await svc.listTaxFilings();
      set({ taxFilings: fresh });
    },

    markFiled: async (taxItemId, taxPeriod, patch) => {
      const { svc } = ctx();
      const existing = get().taxFilings.find(f => f.taxItemId === taxItemId && f.taxPeriod === taxPeriod);
      if (!existing) return;
      const updated: TaxFiling = {
        ...existing, isFiled: true, filedDate: patch.filedDate ?? nowISO().slice(0, 10),
        taxableAmount: patch.taxableAmount ?? existing.taxableAmount,
        paidAmount: patch.paidAmount ?? existing.paidAmount,
        updatedAt: nowISO(),
      };
      await svc.saveTaxFiling(updated);
      set({ taxFilings: get().taxFilings.map(f => f.id === updated.id ? updated : f) });
    },

    unmarkFiled: async (taxItemId, taxPeriod) => {
      const { svc } = ctx();
      const existing = get().taxFilings.find(f => f.taxItemId === taxItemId && f.taxPeriod === taxPeriod);
      if (!existing) return;
      const updated: TaxFiling = { ...existing, isFiled: false, filedDate: undefined, updatedAt: nowISO() };
      await svc.saveTaxFiling(updated);
      set({ taxFilings: get().taxFilings.map(f => f.id === updated.id ? updated : f) });
    },

    linkVoucher: async (taxItemId, taxPeriod, voucherId, voucherNo) => {
      const { svc } = ctx();
      const existing = get().taxFilings.find(f => f.taxItemId === taxItemId && f.taxPeriod === taxPeriod);
      if (!existing) return;
      const updated: TaxFiling = { ...existing, linkedVoucherId: voucherId, linkedVoucherNo: voucherNo, updatedAt: nowISO() };
      await svc.saveTaxFiling(updated);
      set({ taxFilings: get().taxFilings.map(f => f.id === updated.id ? updated : f) });
    },

    updateFilingAmounts: async (taxItemId, taxPeriod, patch) => {
      const { svc } = ctx();
      const existing = get().taxFilings.find(f => f.taxItemId === taxItemId && f.taxPeriod === taxPeriod);
      if (!existing) return;
      const updated: TaxFiling = {
        ...existing,
        taxableAmount: patch.taxableAmount ?? existing.taxableAmount,
        paidAmount: patch.paidAmount ?? existing.paidAmount,
        updatedAt: nowISO(),
      };
      await svc.saveTaxFiling(updated);
      set({ taxFilings: get().taxFilings.map(f => f.id === updated.id ? updated : f) });
    },

    addTaxItem: async (item) => {
      const { svc, tenantId, accountSetId } = ctx();
      const itemWithId = item as Partial<TaxItem>;
      const full: TaxItem = {
        ...item, tenantId, accountSetId,
        id: itemWithId.id || `custom_${Date.now()}`,
        createdAt: nowISO(), updatedAt: nowISO(),
      } as TaxItem;
      await svc.saveTaxItem(full);
      set({ taxItems: [...get().taxItems, full] });
    },

    updateTaxItem: async (id, patch) => {
      const { svc } = ctx();
      const existing = get().taxItems.find(i => i.id === id);
      if (!existing) return;
      const updated: TaxItem = { ...existing, ...patch, updatedAt: nowISO() };
      await svc.saveTaxItem(updated);
      set({ taxItems: get().taxItems.map(i => i.id === id ? updated : i) });
    },

    toggleTaxItem: async (id, enabled) => get().updateTaxItem(id, { isEnabled: enabled }),

    deleteTaxItem: async (id) => {
      const { svc } = ctx();
      const existing = get().taxItems.find(i => i.id === id);
      if (existing?.isBuiltIn) return; // 预置不可删（UI 层也应拦截）
      await svc.deleteTaxItem(id);
      set({ taxItems: get().taxItems.filter(i => i.id !== id) });
    },

    addHoliday: async (h) => {
      const { svc } = ctx();
      const full: TaxHoliday = { ...h, id: `h-${h.date}`, isBuiltIn: false };
      await svc.saveTaxHoliday(full);
      set({ holidays: [...get().holidays.filter(x => x.date !== h.date), full].sort((a, b) => a.date.localeCompare(b.date)) });
    },

    deleteHoliday: async (id) => {
      const { svc } = ctx();
      await svc.deleteTaxHoliday(id);
      set({ holidays: get().holidays.filter(h => h.id !== id) });
    },
  };
});
