import { create } from 'zustand';
import { useVoucherStore } from './useVoucherStore';
import { databaseService } from '@/lib/database/service';

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
  getOutstandingItems: (query: OutstandingQuery) => Promise<OutstandingItem[]>;
}

// 计算科目余额从记账记录表
const calculateBalanceFromLedger = (subjectCode: string, excludeEntryId?: string): SubjectBalance => {
  // 从 useVoucherStore 获取历史数据和当前数据
  const { ledgerEntries, currentEntries } = useVoucherStore.getState();

  // 从 ledgerEntries 计算历史余额
  const subjectEntries = ledgerEntries.filter(entry => entry.subjectCode === subjectCode);
  const debitTotal = subjectEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const creditTotal = subjectEntries.reduce((sum, entry) => sum + entry.credit, 0);

  // 加上当前凭证中该科目的金额（未入账金额），排除指定分录
  const currentSubjectEntries = currentEntries.filter(entry =>
    entry.subjectCode === subjectCode && entry.id !== excludeEntryId
  );
  const currentDebit = currentSubjectEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const currentCredit = currentSubjectEntries.reduce((sum, entry) => sum + entry.credit, 0);

  // 假设所有科目期初余额为0，实际应用中应从设置获取
  const openingBalance = 0;
  const direction = subjectCode.startsWith('1') || subjectCode.startsWith('5') || subjectCode.startsWith('6') ? 'debit' : 'credit';
  const closingBalance = direction === 'debit'
    ? openingBalance + debitTotal + currentDebit - (creditTotal + currentCredit)
    : openingBalance + creditTotal + currentCredit - (debitTotal + currentDebit);

  // 获取科目名称（从科目表获取）
  let subjectName = subjectCode;
  try {
    const subjects = require('../lib/data/subjects.json');
    const subject = subjects.find((s: any) => s.code === subjectCode);
    if (subject) {
      subjectName = subject.name;
    }
  } catch (error) {
    console.error('Failed to load subjects:', error);
  }

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
    const { ledgerEntries, currentEntries } = useVoucherStore.getState();

    // 过滤该往来单位的所有分录
    const allEntries = [...ledgerEntries, ...currentEntries];
    const partnerEntries = allEntries.filter(entry =>
      entry.customerName === partnerName || entry.supplierName === partnerName
    );

    // 计算每个分录的已核销金额（这里简化处理，实际应从数据库查询核销关系）
    const entriesWithRec = partnerEntries.map(entry => {
      const recAmount = 0; // TODO: 从数据库获取已核销金额
      return {
        ...entry,
        recAmount,
        remainingAmount: (entry.debit > 0 ? entry.debit : entry.credit) - recAmount
      };
    });

    const debitSum = entriesWithRec
      .filter(entry => entry.debit > 0)
      .reduce((sum, entry) => sum + entry.remainingAmount, 0);

    const creditSum = entriesWithRec
      .filter(entry => entry.credit > 0)
      .reduce((sum, entry) => sum + entry.remainingAmount, 0);

    return debitSum - creditSum;
  },

  // 获取未结清单据
  getOutstandingItems: async (query: OutstandingQuery): Promise<OutstandingItem[]> => {
    try {
      return await databaseService.getOutstandingItems(query);
    } catch (error) {
      console.error('Failed to get outstanding items:', error);
      return [];
    }
  }
}));
