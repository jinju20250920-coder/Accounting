'use client';

import { create } from 'zustand';
import { useAccountSetStore } from './useAccountSetStore';
import type { AccountingPeriod } from './useAccountSetStore';
import { getMonthEndDate, getMonthStartDate } from '@/lib/utils';
import { useVoucherStore } from './useVoucherStore';
import { useInvoiceStore } from './useInvoiceStore';
import {
  type MonthlyClosingBankTransaction,
  type MonthlyClosingInvoice,
  type MonthlyClosingVoucher,
} from '@/lib/monthly-closing-checks';
import { sqliteService } from '@/lib/database/sqlite-service';
import {
  assertPeriodCanCloseWithData,
  createPeriodClosingAuditLog,
  type PeriodClosingData,
} from '@/lib/period-closing';

// 期间模板接口
export interface PeriodTemplate {
  id: string;
  name: string;
  months: number[];
  description: string;
}

// 期间管理状态接口
interface PeriodManagementStore {
  // 期间模板
  periodTemplates: PeriodTemplate[];
  // 是否显示创建期间模态框
  showCreateModal: boolean;
  // 当前激活的标签页
  activeTab: 'periods' | 'templates' | 'settings';

  // Actions - 期间管理（与账套关联）
  getCurrentPeriod: () => AccountingPeriod | undefined;
  getPeriodsForCurrentAccountSet: () => AccountingPeriod[];
  selectPeriod: (periodId: string) => void;
  createPeriod: (periodData: Omit<AccountingPeriod, 'id' | 'createdDate' | 'lastModifiedDate'>) => void;
  updatePeriod: (id: string, updates: Partial<AccountingPeriod>) => void;
  deletePeriod: (id: string) => void;
  closePeriod: (id: string) => Promise<void>;
  reopenPeriod: (id: string) => void;
  setCurrentPeriod: (id: string) => void;

  // Actions - 模板管理
  applyTemplate: (templateId: string) => void;
  createTemplate: (templateData: Omit<PeriodTemplate, 'id'>) => void;
  updateTemplate: (id: string, updates: Partial<PeriodTemplate>) => void;
  deleteTemplate: (id: string) => void;

  // Actions - UI 控制
  toggleCreateModal: () => void;
  setActiveTab: (tab: 'periods' | 'templates' | 'settings') => void;

  // Actions - 期间操作
  closeCurrentPeriod: () => Promise<void>;
  createNextPeriod: () => void;
}

// 生成默认期间数据（为新账套创建时使用）
const generateDefaultPeriods = (): AccountingPeriod[] => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const periods: AccountingPeriod[] = [];

  // 生成最近 12 个月的期间
  for (let i = 11; i >= 0; i--) {
    const year = currentYear - Math.floor((currentMonth - 1 - i) / 12);
    const month = ((currentMonth - 1 - i) % 12 + 12) % 12 + 1;

    const startDate = getMonthStartDate(year, month);
    const endDate = getMonthEndDate(year, month);

    const isCurrent = year === currentYear && month === currentMonth;

    periods.push({
      id: `${year}${String(month).padStart(2, '0')}`,
      name: `${year}年${month}月`,
      year,
      month,
      startDate,
      endDate,
      status: isCurrent ? 'open' : 'closed',
      statusColor: isCurrent ? 'blue' : 'green',
      voucherCount: isCurrent ? 0 : Math.floor(Math.random() * 50),
      lastVoucherNo: `记-${year}${String(month).padStart(2, '0')}-000`,
      closingBalance: isCurrent ? undefined : Math.floor(Math.random() * 3000000),
      isCurrent,
      canEdit: isCurrent,
      canClose: isCurrent,
      canReopen: !isCurrent && month !== currentMonth,
    });
  }

  return periods;
};

// 初始化期间模板
const defaultTemplates: PeriodTemplate[] = [
  {
    id: '1',
    name: '自然年度',
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    description: '按自然年度划分，每年12个会计期间'
  },
  {
    id: '2',
    name: '财年4月制',
    months: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3],
    description: '财年开始于4月，结束于次年3月'
  },
  {
    id: '3',
    name: '季度期间',
    months: [1, 4, 7, 10],
    description: '按季度划分，每年4个会计期间'
  }
];

async function loadPeriodClosingData(period: AccountingPeriod): Promise<PeriodClosingData> {
  const vouchers = useVoucherStore.getState().vouchers;
  const invoices = useInvoiceStore.getState().invoices;
  const periodBankTransactions = await sqliteService.getBankTransactionsByDateRange(period.startDate, period.endDate);

  return {
    vouchers: vouchers.map((voucher) => ({
      id: voucher.id,
      voucherNo: voucher.voucherNo,
      date: voucher.date,
      status: voucher.status,
      entries: voucher.entries.map((entry) => ({
        id: entry.id,
        subjectCode: entry.subjectCode,
        subjectName: entry.subjectName,
        debit: entry.debit,
        credit: entry.credit,
      })),
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceDate: invoice.invoiceDate,
      invoiceType: invoice.invoiceType,
      voucherId: invoice.voucherId,
      paymentStatus: invoice.paymentStatus,
    })),
    bankTransactions: periodBankTransactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      status: tx.status,
      voucherId: tx.voucherId,
    })),
  };
}

async function assertPeriodCanClose(period: AccountingPeriod) {
  const data = await loadPeriodClosingData(period);
  return assertPeriodCanCloseWithData(period, data);
}

// 创建期间管理 store
export const usePeriodManagementStore = create<PeriodManagementStore>()((set, get) => ({
  periodTemplates: defaultTemplates,
  showCreateModal: false,
  activeTab: 'periods',

  // 获取当前期间（动态计算：最新的 open 状态期间）
  getCurrentPeriod: () => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (!currentAccountSet?.accountingPeriods?.length) return undefined;
    // 优先找 isCurrent 标记的期间
    const marked = currentAccountSet.accountingPeriods.find(p => p.isCurrent);
    if (marked) return marked;
    // fallback: 找最新的 open 状态期间
    const openPeriods = currentAccountSet.accountingPeriods.filter(p => p.status === 'open');
    if (openPeriods.length > 0) {
      return openPeriods.reduce((latest, p) =>
        (p.year * 12 + p.month) > (latest.year * 12 + latest.month) ? p : latest
      );
    }
    // fallback: 找最新的期间
    return currentAccountSet.accountingPeriods.reduce((latest, p) =>
      (p.year * 12 + p.month) > (latest.year * 12 + latest.month) ? p : latest
    );
  },

  // 获取当前账套的期间列表
  getPeriodsForCurrentAccountSet: () => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    return currentAccountSet?.accountingPeriods || [];
  },

  // 选择期间
  selectPeriod: (periodId) => {
    // 这里可以添加期间选择逻辑
  },

  // 创建期间
  createPeriod: (periodData) => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (currentAccountSet) {
      const newPeriod: AccountingPeriod = {
        ...periodData,
        id: `${periodData.year}${String(periodData.month).padStart(2, '0')}`
      };

      useAccountSetStore.getState().updateAccountSet(currentAccountSet.id, {
        accountingPeriods: [...(currentAccountSet.accountingPeriods || []), newPeriod]
      });
    }
  },

  // 更新期间
  updatePeriod: (id, updates) => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (currentAccountSet && currentAccountSet.accountingPeriods) {
      useAccountSetStore.getState().updateAccountSet(currentAccountSet.id, {
        accountingPeriods: currentAccountSet.accountingPeriods.map(period =>
          period.id === id ? { ...period, ...updates } : period
        )
      });
    }
  },

  // 删除期间
  deletePeriod: (id) => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (currentAccountSet && currentAccountSet.accountingPeriods) {
      useAccountSetStore.getState().updateAccountSet(currentAccountSet.id, {
        accountingPeriods: currentAccountSet.accountingPeriods.filter(period => period.id !== id)
      });
    }
  },

  // 关闭期间
  closePeriod: async (id) => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (currentAccountSet && currentAccountSet.accountingPeriods) {
      const targetPeriod = currentAccountSet.accountingPeriods.find(period => period.id === id);
      let summary: ReturnType<typeof assertPeriodCanCloseWithData> | undefined;
      if (targetPeriod) {
        summary = await assertPeriodCanClose(targetPeriod);
      }

      useAccountSetStore.getState().updateAccountSet(currentAccountSet.id, {
        accountingPeriods: currentAccountSet.accountingPeriods.map(period =>
          period.id === id ? {
            ...period,
            status: 'closed',
            statusColor: 'green',
            canEdit: false,
            canClose: false,
            canReopen: true
          } : period
        )
      });

      if (targetPeriod) {
        await sqliteService.addAuditLog(createPeriodClosingAuditLog(targetPeriod, 'close', {
          accountSetId: currentAccountSet.id,
          blockerCount: summary?.blockerCount,
          warningCount: summary?.warningCount,
        }));
      }
    }
  },

  // 重新打开期间
  reopenPeriod: (id) => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (currentAccountSet && currentAccountSet.accountingPeriods) {
      const targetPeriod = currentAccountSet.accountingPeriods.find(period => period.id === id);
      useAccountSetStore.getState().updateAccountSet(currentAccountSet.id, {
        accountingPeriods: currentAccountSet.accountingPeriods.map(period =>
          period.id === id ? {
            ...period,
            status: 'open',
            statusColor: 'blue',
            canEdit: true,
            canClose: true,
            canReopen: false
          } : period
        )
      });
      if (targetPeriod) {
        void sqliteService.addAuditLog(createPeriodClosingAuditLog(targetPeriod, 'reopen', {
          accountSetId: currentAccountSet.id,
        }));
      }
    }
  },

  // 设置当前期间
  setCurrentPeriod: (id) => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (currentAccountSet && currentAccountSet.accountingPeriods) {
      useAccountSetStore.getState().updateAccountSet(currentAccountSet.id, {
        accountingPeriods: currentAccountSet.accountingPeriods.map(period => {
          const isCurrent = period.id === id;
          return {
            ...period,
            isCurrent,
            status: isCurrent ? 'open' : (period.status === 'open' ? 'closed' : period.status),
            statusColor: isCurrent ? 'blue' : period.statusColor,
            canEdit: isCurrent,
            canClose: isCurrent,
            canReopen: !isCurrent && period.status !== 'locked'
          };
        })
      });
    }
  },

  // 应用模板
  applyTemplate: (templateId) => {
    const state = get();
    const template = state.periodTemplates.find(t => t.id === templateId);
    if (template) {
      console.log('应用期间模板:', template.name);
    }
  },

  // 创建模板
  createTemplate: (templateData) => {
    set((state) => ({
      periodTemplates: [...state.periodTemplates, {
        ...templateData,
        id: `template_${Date.now()}`
      }]
    }));
  },

  // 更新模板
  updateTemplate: (id, updates) => {
    set((state) => ({
      periodTemplates: state.periodTemplates.map(template =>
        template.id === id ? { ...template, ...updates } : template
      )
    }));
  },

  // 删除模板
  deleteTemplate: (id) => {
    set((state) => ({
      periodTemplates: state.periodTemplates.filter(template => template.id !== id)
    }));
  },

  // 切换创建期间模态框
  toggleCreateModal: () => set((state) => ({ showCreateModal: !state.showCreateModal })),

  // 设置激活标签页
  setActiveTab: (tab) => set({ activeTab: tab }),

  // 关闭当前期间
  closeCurrentPeriod: async () => {
    const currentPeriod = get().getCurrentPeriod();
    if (currentPeriod) {
      await get().closePeriod(currentPeriod.id);
    }
  },

  // 创建下一个期间
  createNextPeriod: () => {
    const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (!currentAccountSet) return;

    const currentPeriod = get().getCurrentPeriod();

    let nextYear: number;
    let nextMonth: number;

    if (currentPeriod) {
      nextYear = currentPeriod.year;
      nextMonth = currentPeriod.month + 1;
      if (nextMonth > 12) {
        nextYear += 1;
        nextMonth = 1;
      }
    } else {
      // 没有当前期间，从账套启用日期推算，或使用当前年月
      const enableDate = currentAccountSet.enableDate || new Date().toISOString().slice(0, 7);
      const [ey, em] = enableDate.split('-').map(Number);
      nextYear = ey || new Date().getFullYear();
      nextMonth = em || new Date().getMonth() + 1;
    }

    // 检查该期间是否已存在
    const existingPeriods = currentAccountSet.accountingPeriods || [];
    const periodId = `${nextYear}${String(nextMonth).padStart(2, '0')}`;
    if (existingPeriods.some(p => p.id === periodId)) {
      console.warn('期间已存在:', periodId);
      return;
    }

    const startDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const endDate = new Date(nextYear, nextMonth, 0).toISOString().split('T')[0];

    const newPeriod: Omit<AccountingPeriod, 'id' | 'createdDate' | 'lastModifiedDate'> = {
      name: `${nextYear}年${nextMonth}月`,
      year: nextYear,
      month: nextMonth,
      startDate,
      endDate,
      status: 'open',
      statusColor: 'blue',
      voucherCount: 0,
      lastVoucherNo: `记-${nextYear}${String(nextMonth).padStart(2, '0')}-000`,
      isCurrent: true,
      canEdit: true,
      canClose: true,
      canReopen: false
    };

    // 先将当前期间标记为非当前
    if (currentPeriod) {
      get().updatePeriod(currentPeriod.id, {
        isCurrent: false,
        status: 'closed',
        statusColor: 'green',
        canEdit: false,
        canClose: false,
        canReopen: true
      });
    }

    // 然后创建新期间
    get().createPeriod(newPeriod);
  }
}));

// 在创建新账套时自动添加默认期间
const originalAddAccountSet = useAccountSetStore.getState().addAccountSet;
useAccountSetStore.setState({
  addAccountSet: async (accountSetData) => {
    const newAccountSet = await originalAddAccountSet({
      ...accountSetData,
      accountingPeriods: generateDefaultPeriods()
    });
    return newAccountSet;
  }
});
