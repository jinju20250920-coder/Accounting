'use client';

import { create } from 'zustand';
import { useVoucherStore } from './useVoucherStore';
import { useClearingStore } from './useClearingStore';
import { getCurrentService } from '@/lib/database';
import type { VoucherEntry } from '@/types';
import subjectsData from '../lib/data/subjects.json';

interface SubjectBalance {
  subjectCode: string;
  subjectName: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
  direction: 'debit' | 'credit';
}

// 未结清单据项
interface OutstandingItem {
  entryId: string;
  voucherNo: string;
  docNo: string;
  date: string;
  summary: string;
  amount: number;
  remainingAmount: number;
  direction: 'debit' | 'credit';
  partnerName?: string;
}

// 未结清单据查询参数
interface OutstandingQuery {
  partnerName: string;
  subjectCode?: string;
  startDate?: string;
  endDate?: string;
  amountRange?: [number, number];
}

interface AccountStore {
  // 科目余额表
  subjectBalances: SubjectBalance[];

  // Actions
  getBalance: (subjectCode: string, excludeEntryId?: string) => number;
  getSubjectBalance: (subjectCode: string, excludeEntryId?: string) => SubjectBalance | undefined;
  updateBalance: (subjectCode: string, subjectName: string, debit: number, credit: number) => void;
  setOpeningBalance: (subjectCode: string, subjectName: string, balance: number, direction: 'debit' | 'credit') => void;
  recalculateBalances: () => void;
  clearBalances: () => void;
  // 往来核销相关操作
  getPartnerBalance: (partnerName: string) => number;
  getPartnerMonthlyAmount: (partnerName: string, yearMonth: string) => number;
  getPartnerMonthlyClearing: (partnerName: string, yearMonth: string) => number;
  getOutstandingItems: (query: OutstandingQuery) => Promise<OutstandingItem[]>;
}

// 计算科目余额从所有已记账凭证和当前凭证
const calculateBalanceFromLedger = (subjectCode: string, excludeEntryId?: string): SubjectBalance => {
  const { vouchers, currentEntries } = useVoucherStore.getState();

  let openingDebit = 0;
  let openingCredit = 0;
  let debitTotal = 0;
  let creditTotal = 0;

  vouchers.forEach(voucher => {
    if (voucher.status === 'posted' || voucher.status === 'reversed') {
      const isOpening = voucher.voucherNo?.startsWith('记-期初');
      voucher.entries.forEach(entry => {
        if (entry.subjectCode === subjectCode) {
          if (isOpening) {
            openingDebit += entry.debit;
            openingCredit += entry.credit;
          } else {
            debitTotal += entry.debit;
            creditTotal += entry.credit;
          }
        }
      });
    }
  });

  const currentSubjectEntries = currentEntries.filter(entry =>
    entry.subjectCode === subjectCode && entry.id !== excludeEntryId
  );
  const currentDebit = currentSubjectEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const currentCredit = currentSubjectEntries.reduce((sum, entry) => sum + entry.credit, 0);

  const direction = subjectCode.startsWith('1') || subjectCode.startsWith('5') || subjectCode.startsWith('6') ? 'debit' : 'credit';
  const openingBalance = direction === 'debit'
    ? openingDebit - openingCredit
    : openingCredit - openingDebit;
  const closingBalance = direction === 'debit'
    ? openingBalance + debitTotal + currentDebit - (creditTotal + currentCredit)
    : openingBalance + creditTotal + currentCredit - (debitTotal + currentDebit);

  let subjectName = subjectCode;
  try {
    const subject = (subjectsData as Array<{ code: string; name: string }>).find(s => s.code === subjectCode);
    if (subject) subjectName = subject.name;
  } catch {}

  return {
    subjectCode,
    subjectName,
    openingBalance,
    debitTotal: debitTotal + currentDebit,
    creditTotal: creditTotal + currentCredit,
    closingBalance,
    direction
  };
};

export const useAccountStore = create<AccountStore>((set, get) => ({
  // 初始状态
  subjectBalances: [],

  // 获取科目余额（从记账记录表计算）
  getBalance: (subjectCode: string, excludeEntryId?: string): number => {
    const balance = calculateBalanceFromLedger(subjectCode, excludeEntryId);
    return balance.closingBalance || 0;
  },

  // 获取完整的科目余额信息（从记账记录表计算）
  getSubjectBalance: (subjectCode: string, excludeEntryId?: string): SubjectBalance | undefined => {
    return calculateBalanceFromLedger(subjectCode, excludeEntryId);
  },

  // 更新余额（记账时调用）
  updateBalance: (subjectCode: string, subjectName: string, debit: number, credit: number) => {
    // 余额现在完全从记账记录表计算，不需要本地存储
    console.log(`余额更新: 科目${subjectCode} - 借方${debit}, 贷方${credit}`);
  },

  // 设置期初余额
  setOpeningBalance: (subjectCode: string, subjectName: string, balance: number, direction: 'debit' | 'credit') => {
    // 期初余额需要存储，因为记账记录表不包含期初数据
    set((state) => {
      const existingIndex = state.subjectBalances.findIndex(b => b.subjectCode === subjectCode);

      if (existingIndex >= 0) {
        const existing = state.subjectBalances[existingIndex];
        const newBalances = [...state.subjectBalances];
        newBalances[existingIndex] = {
          ...existing,
          openingBalance: balance,
          direction
        };
        return { subjectBalances: newBalances };
      } else {
        const newBalance: SubjectBalance = {
          subjectCode,
          subjectName,
          openingBalance: balance,
          debitTotal: 0,
          creditTotal: 0,
          closingBalance: balance,
          direction
        };
        return { subjectBalances: [...state.subjectBalances, newBalance] };
      }
    });
  },

  // 重新计算所有余额
  recalculateBalances: () => {
    // 余额现在完全从记账记录表计算，不需要本地存储
    console.log('余额重新计算');
  },

  // 清空所有余额
  clearBalances: () => {
    set({ subjectBalances: [] });
  },

  // 计算往来单位余额（实时轧差）
  getPartnerBalance: (partnerName: string): number => {
    // 从 useVoucherStore 获取历史数据和当前数据
    const { vouchers, currentEntries } = useVoucherStore.getState();
    // 从 clearingStore 获取核销关系
    const { recRelations } = useClearingStore.getState();

    // 收集所有分录（包括已记账和当前未记账的）
    type PartnerEntry = VoucherEntry & { voucherStatus: string; isPosted: boolean };
    const allEntries: PartnerEntry[] = [];

    // 只使用已记账凭证进行余额计算
    vouchers.forEach(voucher => {
      if (voucher.status === 'posted') {
        voucher.entries.forEach(entry => {
          allEntries.push({
            ...entry,
            voucherStatus: voucher.status,
            isPosted: voucher.status === 'posted'
          });
        });
      }
    });

    // 过滤该往来单位的所有分录 - 支持多种匹配方式
    const partnerEntries = allEntries.filter(entry => {
      // 尝试多种匹配方式
      const matches =
        entry.customerName === partnerName ||
        entry.supplierName === partnerName ||
        (entry.auxiliary?.customer === partnerName) ||
        (entry.auxiliary?.supplier === partnerName) ||
        (typeof entry.auxiliary === 'string' && entry.auxiliary === partnerName);
      return matches;
    });

    // 计算每个分录的已核销金额（从核销关系数据获取）
    const entriesWithRec = partnerEntries.map(entry => {
      // 查找该分录的所有核销关系
      const relatedRecs = recRelations.filter(rel =>
        rel.debitEntryId === entry.id || rel.creditEntryId === entry.id
      );

      // 计算已核销金额总和
      const recAmount = relatedRecs.reduce((sum, rel) => sum + rel.amount, 0);
      const totalAmount = entry.debit > 0 ? entry.debit : entry.credit;

      return {
        ...entry,
        recAmount,
        remainingAmount: Math.max(0, totalAmount - recAmount) // 确保剩余金额不为负
      };
    });

    // 计算借方和贷方总额（都为正数，但在余额计算时区分方向）
    const debitSum = entriesWithRec
      .filter(entry => entry.debit > 0)
      .reduce((sum, entry) => sum + entry.remainingAmount, 0);

    const creditSum = entriesWithRec
      .filter(entry => entry.credit > 0)
      .reduce((sum, entry) => sum + entry.remainingAmount, 0);

    const balance = debitSum - creditSum;
    console.log(`Partner "${partnerName}" balance: ${balance} (debit: ${debitSum}, credit: ${creditSum})`);

    return balance;
  },

  // 获取未结清单据
  getOutstandingItems: async (query: OutstandingQuery): Promise<OutstandingItem[]> => {
    try {
      return await getCurrentService().getOutstandingItems(query);
    } catch (error) {
      console.error('Failed to get outstanding items:', error);
      return [];
    }
  },

  // 获取往来单位本月发生额
  getPartnerMonthlyAmount: (partnerName: string, yearMonth: string): number => {
    const { vouchers } = useVoucherStore.getState();

    let monthlyTotal = 0;

    vouchers.forEach(voucher => {
      // 只计算已记账凭证，且日期在指定月份
      if (voucher.status === 'posted' && voucher.date.startsWith(yearMonth)) {
        voucher.entries.forEach(entry => {
          // 检查是否是该往来单位
          const isMatch =
            entry.customerName === partnerName ||
            entry.supplierName === partnerName ||
            entry.auxiliary?.customer === partnerName ||
            entry.auxiliary?.supplier === partnerName;

          if (isMatch) {
            // 应收账款：借方为正，贷方为负
            // 应付账款：贷方为正，借方为负
            // 这里简化处理：借方-贷方
            monthlyTotal += (entry.debit - entry.credit);
          }
        });
      }
    });

    return monthlyTotal;
  },

  // 获取往来单位本月核销额
  getPartnerMonthlyClearing: (partnerName: string, yearMonth: string): number => {
    const { vouchers } = useVoucherStore.getState();
    const { recRelations } = useClearingStore.getState();

    let monthlyClearing = 0;

    // 获取该往来单位在本月的所有分录ID
    const monthlyEntryIds = new Set<string>();
    vouchers.forEach(voucher => {
      if (voucher.status === 'posted' && voucher.date.startsWith(yearMonth)) {
        voucher.entries.forEach(entry => {
          const isMatch =
            entry.customerName === partnerName ||
            entry.supplierName === partnerName ||
            entry.auxiliary?.customer === partnerName ||
            entry.auxiliary?.supplier === partnerName;

          if (isMatch) {
            monthlyEntryIds.add(entry.id);
          }
        });
      }
    });

    // 统计涉及这些分录的核销金额（只计算一次，避免重复）
    const countedRelations = new Set<string>();
    recRelations.forEach(rel => {
      // 检查核销关系是否涉及本月的分录
      const involvesMonthlyEntry =
        monthlyEntryIds.has(rel.debitEntryId) ||
        monthlyEntryIds.has(rel.creditEntryId);

      // 检查核销日期是否在本月
      const isInMonth = rel.recDate && rel.recDate.startsWith(yearMonth);

      if (involvesMonthlyEntry && isInMonth && !countedRelations.has(rel.id)) {
        monthlyClearing += rel.amount;
        countedRelations.add(rel.id);
      }
    });

    return monthlyClearing;
  }
}));
