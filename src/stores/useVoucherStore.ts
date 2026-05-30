



'use client';

import { create } from 'zustand';
import { getCurrentService, getCurrentManager } from '@/lib/database';
import type { Voucher } from '@/lib/database/service';
import { useAccountSetStore } from './useAccountSetStore';
import { assertAccountingDateEditable } from '@/lib/period-closing';

// 凭证状态
type VoucherStatus = 'draft' | 'review' | 'posted' | 'reversed';

// 凭证类型
type VoucherType = 'general' | 'payment' | 'receipt' | 'transfer' | 'closing';

// 科目余额
interface SubjectBalance {
  subjectCode: string;
  subjectName: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
}

// 记账表
interface LedgerEntry {
  id: string;
  entryNo: string; // 新增：分录编号，格式：{voucherNo}-{entrySeq}，从1开始
  voucherNo: string;
  entryDate: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
  deptCode?: string;
  projectCode?: string;
  auxiliary?: {
    department?: string;
    project?: string;
    customer?: string;
    supplier?: string;
  } | string;
  entryTime: string;
  writeOffFlag: boolean;
  correction: boolean;
  accountSetId?: string; // 新增字段：所属账套ID
  docNo?: string; // 业务单据号（发票号、银行流水号等）
  recRefNo?: string; // 核销单号（为后续核销系统预留）
}

// Store 接口
interface VoucherStore {
  // 当前凭证状态
  currentVoucher: Voucher | null;
  currentEntries: Voucher['entries'];
  voucherDate: string;
  voucherNo: string;
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  vouchers: Voucher[];
  subjectBalances: SubjectBalance[];
  isLoading: boolean;
  settings: {
    autoBalance: boolean;
    defaultSubject: string;
    lastVoucherDate: string;
  };

  // 记账表
  ledgerEntries: LedgerEntry[];

  // 记账表操作
  addToLedger: (subjects: Array<{ code: string; name: string }>) => void;
  getLedgerEntries: () => LedgerEntry[];
  getLedgerEntriesByDateRange: (startDate: string, endDate: string) => LedgerEntry[];
  getLedgerEntriesBySubject: (subjectCode: string) => LedgerEntry[];

  // Actions
  addEntry: () => void;
  updateEntry: (id: string, field: string, value: any) => void;
  removeEntry: (id: string) => void;
  updateVoucherDate: (date: string) => Promise<void>;
  updateVoucherSummary: (summary: string) => void;
  saveVoucher: (status?: VoucherStatus, subjects?: Array<{ code: string; name: string }>) => Promise<void>;
  deleteVoucher: (id: string) => void;
  clearVoucher: () => void;
  autoBalanceCredit: () => void;
  autoBalanceDebit: () => void;
  loadVoucher: (id: string) => void;
  getVouchersByStatus: (status: VoucherStatus) => Voucher[];
  getVouchersByDateRange: (startDate: string, endDate: string) => Voucher[];
  getVoucherStatistics: () => {
    total: number;
    byStatus: Record<VoucherStatus, number>;
    byMonth: Array<{ month: string; count: number }>;
  };
  updateSubjectBalance: (subjectCode: string, debit: number, credit: number) => void;
  calculateSubjectBalances: () => void;
  getSubjectBalance: (subjectCode: string) => SubjectBalance | null;
  updateSettings: (newSettings: Partial<VoucherStore['settings']>) => void;
  cleanupOldData: (cutoffDate: string) => void;
  addVoucherFromTransactions: (transactionData: any) => void;

  // Session management (Side-by-Side)
  setActiveVoucher: (voucherId: string) => void;
  createVoucher: () => void;
  copyVoucher: (voucherId: string) => void;
  saveVoucherAndCreateNext: () => void;
  pasteEntries: (entries: any[]) => void;

  // 模板操作
  loadTemplate: (template: any, loadAmounts: boolean) => void;

  // 初始化
  initialize: () => Promise<void>;
}

// 辅助函数：创建默认分录
const createDefaultEntry = (voucherId: string, index?: number): any => ({
  id: index !== undefined ? `entry_${voucherId}_${index}` : `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  voucherId,
  date: new Date().toISOString().split('T')[0],
  summary: '',
  subjectCode: '',
  subjectName: '',
  debit: 0,
  credit: 0,
  currencyCode: '',
  currencyName: '',
  cashFlowItem: '',
  customerName: '',
  supplierName: '',
  auxiliary: {},
  docNo: '',
  recRefNo: ''
});

// 辅助函数：生成凭证字号
const generateVoucherNo = async (date: string): Promise<string> => {
  const yearMonth = date.substring(0, 7).replace('-', '');

  // 从账套设置中获取最后一个凭证号和年月
  const { getCurrentAccountSet } = useAccountSetStore.getState();
  const currentAccountSet = getCurrentAccountSet();

  let lastSeq = 0;
  let lastYearMonth = '';

  // 检查账套中记录的最后凭证年月
  if (currentAccountSet?.lastVoucherFullNo) {
    // 从完整凭证号中提取年月：格式 "记-202603-001"
    const match = currentAccountSet.lastVoucherFullNo.match(/记-(\d{6})-\d{3}/);
    if (match) {
      lastYearMonth = match[1];
    }
  }

  // 如果是新月，重置序号为 0
  if (lastYearMonth && lastYearMonth !== yearMonth) {
    lastSeq = 0;
  } else if (currentAccountSet?.lastVoucherNo !== undefined) {
    // 同一月，使用账套中记录的序号
    lastSeq = currentAccountSet.lastVoucherNo;
  }

  // 从数据库获取当前月份的所有凭证号，确保序号连续
  try {
    const allVouchers = await getCurrentService().getAllVouchers();
    const currentMonthVouchers = allVouchers.filter(v =>
      v.voucherNo.startsWith(`记-${yearMonth}-`)
    );

    if (currentMonthVouchers.length > 0) {
      // 提取序号并找到最大值
      const sequences = currentMonthVouchers.map(v => {
        const match = v.voucherNo.match(/-(\d{3})$/);
        return match ? parseInt(match[1], 10) : 0;
      });

      const maxSeq = Math.max(...sequences);
      // 使用数据库中的最大序号和账套记录的序号中的较大值
      lastSeq = Math.max(lastSeq, maxSeq);
    }
  } catch (error) {
    console.warn('Failed to fetch vouchers for sequence generation:', error);
  }

  // 生成新的序号
  const newSeq = lastSeq + 1;
  const seqStr = String(newSeq).padStart(3, '0');

  return `记-${yearMonth}-${seqStr}`;
};

const assertVoucherDateEditable = (date: string, actionName: string) => {
  const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
  assertAccountingDateEditable(currentAccountSet?.accountingPeriods, date, actionName);
};

// 创建store
export const useVoucherStore = create<VoucherStore>((set, get) => ({
  // 初始状态
  currentVoucher: null,
  currentEntries: Array.from({ length: 10 }, (_, i) => createDefaultEntry('init', i)),
  voucherDate: new Date().toISOString().split('T')[0],
  voucherNo: '记-001',
  isBalanced: false,
  totalDebit: 0,
  totalCredit: 0,
  vouchers: [],
  subjectBalances: [],
  isLoading: false,
  settings: {
    autoBalance: true,
    defaultSubject: '1002',
    lastVoucherDate: new Date().toISOString().split('T')[0]
  },
  ledgerEntries: [],

  // 初始化方法
  initialize: async () => {
    set({ isLoading: true });
    try {
      // 确保使用正确的账套ID
      const { useAccountSetStore } = await import('@/stores/useAccountSetStore');
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      if (currentAccountSet) {
        sqliteService.setAccountSetId(currentAccountSet.id);
      }

      // 初始化数据库
      await getCurrentManager().init();
      const vouchers = await getCurrentService().getAllVouchers();
      // Show all vouchers - filtering is done in individual components
      set({ vouchers: vouchers });
    } catch (error) {
      console.error('Failed to initialize voucher store:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // 当前凭证操作
  addEntry: () => set((state) => {
    const newEntry = createDefaultEntry(state.currentVoucher?.id || Date.now().toString());
    return {
      currentEntries: [...state.currentEntries, newEntry]
    };
  }),

  updateEntry: (id: string, field: string, value: any) => set((state) => {
    const entries = state.currentEntries.map(entry =>
      entry.id === id ? { ...entry, [field]: value } : entry
    );

    // 重新计算借贷总额
    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

    return {
      currentEntries: entries,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  }),

  removeEntry: (id: string) => set((state) => {
    const entries = state.currentEntries.filter(e => e.id !== id);
    // 重新计算
    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

    return {
      currentEntries: entries,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  }),

  updateVoucherDate: async (date: string) => {
    const voucherNo = await generateVoucherNo(date);
    set((state) => ({
      voucherDate: date,
      voucherNo,
      currentVoucher: state.currentVoucher ? { ...state.currentVoucher, date } : null
    }));
  },

  updateVoucherSummary: (summary: string) => set((state) => ({
    currentVoucher: state.currentVoucher ? { ...state.currentVoucher, summary } : null
  })),

  saveVoucher: async (status: VoucherStatus = 'draft', subjects?: Array<{ code: string; name: string }>) => {
    const state = get();
    const voucher = state.currentVoucher;

    if (!voucher) return;
    assertVoucherDateEditable(voucher.date, '保存凭证');

    // 验证借贷平衡
    const isBalanced = Math.abs(state.totalDebit - state.totalCredit) < 0.01;
    if (!isBalanced) {
      throw new Error('借贷不平衡，请检查金额！');
    }

    const now = new Date().toISOString();
    const savedVoucher: Voucher = {
      ...voucher,
      entries: state.currentEntries,
      status,
      updateTime: now,
      createTime: voucher.createTime || now
    };

    // 保存到数据库
    await getCurrentService().saveVoucher(savedVoucher);

    // 提取凭证号的序号部分并更新账套的 lastVoucherNo
    const voucherNoMatch = savedVoucher.voucherNo.match(/(\d+)$/);
    if (voucherNoMatch) {
      const seqNumber = parseInt(voucherNoMatch[1], 10);

      // 更新账套设置中的最后一个凭证号（同时保存序号和完整凭证号）
      const accountSetStore = useAccountSetStore.getState();
      accountSetStore.updateAccountSet(accountSetStore.currentAccountSetId!, {
        lastVoucherNo: seqNumber,
        lastVoucherFullNo: savedVoucher.voucherNo
      });
    }

    set((prevState) => ({
      vouchers: prevState.vouchers.some(v => v.id === voucher.id)
        ? prevState.vouchers.map(v =>
            v.id === voucher.id ? savedVoucher : v
          )
        : [...prevState.vouchers, savedVoucher],
      currentVoucher: savedVoucher,
      settings: {
        ...prevState.settings,
        lastVoucherDate: state.voucherDate
      }
    }));
  },

  deleteVoucher: async (id: string) => {
    const voucher = get().vouchers.find(v => v.id === id) || await getCurrentService().getVoucher(id);
    if (voucher) {
      assertVoucherDateEditable(voucher.date, '删除凭证');
    }

    await getCurrentService().deleteVoucher(id);
    set((state) => ({
      vouchers: state.vouchers.filter(v => v.id !== id)
    }));
  },

  clearVoucher: () => set({
    currentVoucher: null,
    currentEntries: Array.from({ length: 10 }, (_, i) => createDefaultEntry('clear', i)),
    isBalanced: false,
    totalDebit: 0,
    totalCredit: 0
  }),

  autoBalanceCredit: () => {
    const state = get();
    const totalDebit = state.currentEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = state.currentEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
    const diff = totalDebit - totalCredit;

    // 找到贷方为空且是最后一行
    const lastEntry = [...state.currentEntries].reverse().find(e => e.credit === 0 && e.id !== 'summary');
    if (lastEntry) {
      get().updateEntry(lastEntry.id, 'credit', diff);
    }
  },

  autoBalanceDebit: () => {
    const state = get();
    const totalDebit = state.currentEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = state.currentEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
    const diff = totalCredit - totalDebit;

    // 找到借方为空且是最后一行
    const lastEntry = [...state.currentEntries].reverse().find(e => e.debit === 0 && e.id !== 'summary');
    if (lastEntry) {
      get().updateEntry(lastEntry.id, 'debit', diff);
    }
  },

  // 历史数据操作
  loadVoucher: async (id: string) => {
    const voucher = await getCurrentService().getVoucher(id);
    if (voucher) {
      set({
        currentVoucher: voucher,
        currentEntries: voucher.entries,
        voucherDate: voucher.date,
        voucherNo: voucher.voucherNo,
        totalDebit: voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0),
        totalCredit: voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0),
        isBalanced: Math.abs(voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0) -
                       voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0)) < 0.01
      });
    }
  },

  getVouchersByStatus: (status: VoucherStatus) => {
    const state = get();
    return state.vouchers.filter(v => v.status === status);
  },

  getVouchersByDateRange: (startDate: string, endDate: string) => {
    const state = get();
    return state.vouchers.filter(v => v.date >= startDate && v.date <= endDate);
  },

  getVoucherStatistics: () => {
    const state = get();
    const byStatus = {
      draft: 0,
      review: 0,
      posted: 0,
      reversed: 0
    };

    state.vouchers.forEach(v => {
      byStatus[v.status]++;
    });

    // 按月统计
    const monthMap = new Map<string, number>();
    state.vouchers.forEach(v => {
      const month = v.date.substring(0, 7);
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    });

    const byMonth = Array.from(monthMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      total: state.vouchers.length,
      byStatus,
      byMonth
    };
  },

  // 科目余额
  updateSubjectBalance: (subjectCode: string, debit: number, credit: number) => {
    const state = get();
    const existing = state.subjectBalances.find(b => b.subjectCode === subjectCode);

    if (existing) {
      set({
        subjectBalances: state.subjectBalances.map(b =>
          b.subjectCode === subjectCode
            ? {
                ...b,
                debitTotal: b.debitTotal + debit,
                creditTotal: b.creditTotal + credit,
                closingBalance: b.openingBalance + b.debitTotal + debit - (b.creditTotal + credit)
              }
            : b
        )
      });
    } else {
      const newBalance: SubjectBalance = {
        subjectCode,
        subjectName: '', // 需要从科目表获取
        openingBalance: 0,
        debitTotal: debit,
        creditTotal: credit,
        closingBalance: debit - credit
      };
      set({
        subjectBalances: [...state.subjectBalances, newBalance]
      });
    }
  },

  calculateSubjectBalances: () => {
    const state = get();
    const balances = new Map<string, SubjectBalance>();

    // 遍历所有凭证
    state.vouchers.forEach(voucher => {
      if (voucher.status === 'posted' || voucher.status === 'reversed') {
        voucher.entries.forEach(entry => {
          const existing = balances.get(entry.subjectCode);

          if (existing) {
            existing.debitTotal += entry.debit;
            existing.creditTotal += entry.credit;
            existing.closingBalance = existing.openingBalance + existing.debitTotal - existing.creditTotal;
          } else {
            balances.set(entry.subjectCode, {
              subjectCode: entry.subjectCode,
              subjectName: entry.subjectName,
              openingBalance: 0,
              debitTotal: entry.debit,
              creditTotal: entry.credit,
              closingBalance: entry.debit - entry.credit
            });
          }
        });
      }
    });

    set({
      subjectBalances: Array.from(balances.values())
    });
  },

  getSubjectBalance: (subjectCode: string) => {
    const state = get();
    return state.subjectBalances.find(b => b.subjectCode === subjectCode) || null;
  },

  // 设置
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),

  // 数据清理
  cleanupOldData: (cutoffDate: string) => {
    const state = get();

    // 清理旧凭证
    const cleanedVouchers = state.vouchers.filter(v => v.date >= cutoffDate);

    // 清理审计记录（如果需要）
    const cleanedSubjectBalances = state.subjectBalances.filter(b => {
      // 保留当前期间的数据
      const subjectTransactions = state.vouchers.filter(v =>
        v.date >= cutoffDate &&
        (v.status === 'posted' || v.status === 'reversed')
      ).some(v => v.entries.some(e => e.subjectCode === b.subjectCode));

      return subjectTransactions || b.subjectCode === state.settings.defaultSubject;
    });

    set({
      vouchers: cleanedVouchers,
      subjectBalances: cleanedSubjectBalances
    });
  },

  // 从银行交易记录生成凭证
  addVoucherFromBankTransactions: async (bankTransactions: any[], bankAccountId: string) => {
    const state = get();
    const now = new Date().toISOString();

    // 为每个银行交易生成一个凭证
    for (const transaction of bankTransactions) {
      assertVoucherDateEditable(transaction.date, '生成凭证');
      try {
        const voucherId = `voucher_${Date.now()}_${transaction.id}`;

        // 生成凭证号
        const voucherNo = await generateVoucherNo(transaction.date);

        // 确定交易类型（借方或贷方）
        const isDebit = !!transaction.debit;
        const amount = transaction.debit || transaction.credit || 0;

        // 获取银行科目信息（简化版）
        // 在实际应用中，应从 bankAccountId 获取真实的科目代码和名称
        const bankSubjectCode = '1002';
        const bankSubjectName = '银行存款';

        // 创建凭证分录
        const entries: any[] = [];

        // 交易分录（对方科目）
        const transactionEntry: any = {
          id: `entry_${voucherId}_0`,
          voucherId,
          date: transaction.date,
          summary: transaction.summary || transaction.notes || '银行交易',
          subjectCode: transaction.matchedSubject || '6603', // 默认科目
          subjectName: transaction.matchedSubjectName || '财务费用',
          debit: isDebit ? 0 : amount,
          credit: isDebit ? amount : 0,
          customerName: transaction.counterpartyName,
          supplierName: transaction.counterpartyName,
          auxiliary: {
            customer: transaction.counterpartyName,
            supplier: transaction.counterpartyName
          },
          docNo: transaction.transactionSerialNo,
          recRefNo: transaction.enterpriseSerialNo
        };
        entries.push(transactionEntry);

        // 银行存款分录（平衡分录）
        const bankEntry: any = {
          id: `entry_${voucherId}_1`,
          voucherId,
          date: transaction.date,
          summary: '银行存款',
          subjectCode: bankSubjectCode,
          subjectName: bankSubjectName,
          debit: isDebit ? amount : 0,
          credit: isDebit ? 0 : amount
        };
        entries.push(bankEntry);

        // 创建新凭证
        const newVoucher: Voucher = {
          id: voucherId,
          voucherNo,
          date: transaction.date,
          summary: transaction.summary || transaction.notes || '银行交易',
          entries: entries,
          status: 'draft',
          voucherType: isDebit ? 'receipt' : 'payment',
          createdBy: 'system',
          createTime: now,
          updateTime: now
        };

        // 保存到数据库
        await getCurrentService().saveVoucher(newVoucher);

        // 添加到凭证列表
        set((prevState) => ({
          vouchers: [...prevState.vouchers, newVoucher]
        }));
      } catch (error) {
        console.error('Error creating voucher for transaction:', transaction, error);
        // 继续处理下一个交易，而不是失败整个操作
      }
    }
  },

  // 从交易记录生成凭证（保持旧接口）
  addVoucherFromTransactions: async (transactionData: any) => {
    const state = get();
    const now = new Date().toISOString();

    // 生成凭证号
    const voucherNo = await generateVoucherNo(transactionData.date);

    // 创建凭证分录
    assertVoucherDateEditable(transactionData.date, '生成凭证');

    const entries: any[] = transactionData.entries.map((entry: any, index: number) => ({
      id: `entry_${Date.now()}_${index}`,
      voucherId: transactionData.id,
      date: transactionData.date,
      summary: transactionData.description,
      subjectCode: entry.subject,
      subjectName: entry.subjectName,
      debit: entry.debit || 0,
      credit: entry.credit || 0
    }));

    // 创建新凭证
    const newVoucher: Voucher = {
      id: transactionData.id,
      voucherNo,
      date: transactionData.date,
      summary: transactionData.description,
      entries: entries,
      status: 'draft',
      voucherType: 'general',
      createdBy: 'system',
      createTime: now,
      updateTime: now
    };

    // 保存到数据库
    await getCurrentService().saveVoucher(newVoucher);

    // 添加到凭证列表
    set((prevState) => ({
      vouchers: [...prevState.vouchers, newVoucher]
    }));
  },

  // Session management methods
  setActiveVoucher: (voucherId: string) => {
    const state = get();
    const voucher = state.vouchers.find(v => v.id === voucherId);

    if (voucher) {
      set({
        currentVoucher: voucher,
        currentEntries: voucher.entries,
        voucherDate: voucher.date,
        voucherNo: voucher.voucherNo,
        totalDebit: voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0),
        totalCredit: voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0),
        isBalanced: Math.abs(voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0) -
                       voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0)) < 0.01
      });
    }
  },

  createVoucher: async () => {
    const state = get();
    const now = new Date().toISOString();
    const newId = Date.now().toString();
    assertVoucherDateEditable(state.voucherDate, '新增凭证');

    // Generate voucher number
    const voucherNo = await generateVoucherNo(state.voucherDate);

    // Create blank voucher
    const newVoucher: Voucher = {
      id: newId,
      voucherNo,
      date: state.voucherDate,
      summary: '',
      entries: Array.from({ length: 10 }, (_, i) => createDefaultEntry(newId, i)),
      status: 'draft',
      voucherType: 'general',
      createdBy: 'user',
      createTime: now,
      updateTime: now
    };

    // 保存到数据库
    await getCurrentService().saveVoucher(newVoucher);

    // Update current state
    set({
      currentVoucher: newVoucher,
      currentEntries: newVoucher.entries,
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: true,
      vouchers: [...state.vouchers, newVoucher]
    });
  },

  copyVoucher: async (voucherId: string) => {
    const state = get();
    const voucher = state.vouchers.find(v => v.id === voucherId);

    if (!voucher) return;
    assertVoucherDateEditable(voucher.date, '复制凭证');

    const now = new Date().toISOString();
    const newId = Date.now().toString();

    // 生成新凭证号
    const voucherNo = await generateVoucherNo(voucher.date);

    // Create copy with new ID and regenerated entry IDs
    const copiedVoucher: Voucher = {
      ...voucher,
      id: newId,
      voucherNo,
      summary: voucher.summary ? voucher.summary + ' (副本)' : '(副本)',
      status: 'draft',
      createTime: now,
      updateTime: now,
      entries: voucher.entries.map((entry, idx) => ({
        ...entry,
        id: `${newId}_e${idx}`,
        voucherId: newId,
      }))
    };

    // 保存到数据库
    await getCurrentService().saveVoucher(copiedVoucher);

    // Update current state
    set({
      currentVoucher: copiedVoucher,
      currentEntries: copiedVoucher.entries,
      voucherDate: copiedVoucher.date,
      voucherNo: copiedVoucher.voucherNo,
      totalDebit: copiedVoucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0),
      totalCredit: copiedVoucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0),
      isBalanced: Math.abs(copiedVoucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0) -
                         copiedVoucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0)) < 0.01,
      vouchers: [...state.vouchers, copiedVoucher]
    });
  },

  saveVoucherAndCreateNext: async () => {
    const state = get();
    if (!state.currentVoucher) return;
    assertVoucherDateEditable(state.currentVoucher.date, '保存凭证');
    assertVoucherDateEditable(state.voucherDate, '新增凭证');

    // Save current voucher
    try {
      // Verify balance
      const isBalanced = Math.abs(state.totalDebit - state.totalCredit) < 0.01;
      if (!isBalanced) {
        throw new Error('借贷不平衡，请检查金额！');
      }

      const now = new Date().toISOString();
      const savedVoucher: Voucher = {
        ...state.currentVoucher,
        entries: state.currentEntries,
        status: 'draft',
        updateTime: now
      };

      // 保存到数据库
      await getCurrentService().saveVoucher(savedVoucher);

      // Update existing voucher in list
      const updatedVouchers = state.vouchers.map(v =>
        v.id === savedVoucher.id ? savedVoucher : v
      );

      // Generate voucher number for new voucher
      const voucherNo = await generateVoucherNo(state.voucherDate);

      // Create new voucher
      const newId = Date.now().toString();
      const newVoucher: Voucher = {
        id: newId,
        voucherNo,
        date: state.voucherDate,
        summary: '',
        entries: Array.from({ length: 10 }, (_, i) => createDefaultEntry(newId, i)),
        status: 'draft',
        voucherType: 'general',
        createdBy: 'user',
        createTime: now,
        updateTime: now
      };

      // 保存新凭证到数据库
      await getCurrentService().saveVoucher(newVoucher);

      set({
        currentVoucher: newVoucher,
        currentEntries: newVoucher.entries,
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: true,
        vouchers: [...updatedVouchers, newVoucher]
      });

      return true;
    } catch (error) {
      throw error;
    }
  },

  pasteEntries: (entries: any[]) => {
    const state = get();

    // Add entries to current voucher
    const newEntries = [...state.currentEntries, ...entries.map((entry, index) => ({
      ...entry,
      id: `paste_${Date.now()}_${index}`,
      voucherId: state.currentVoucher?.id || Date.now().toString()
    }))];

    // Recalculate totals
    const totalDebit = newEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = newEntries.reduce((sum, e) => sum + (e.credit || 0), 0);

    set({
      currentEntries: newEntries,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    });
  },

  // 记账表操作
  addToLedger: () => {
    // 实现记账表操作
  },

  getLedgerEntries: () => {
    const state = get();
    return state.ledgerEntries;
  },

  getLedgerEntriesByDateRange: (startDate: string, endDate: string) => {
    const state = get();
    return state.ledgerEntries.filter(entry =>
      entry.entryDate >= startDate && entry.entryDate <= endDate
    );
  },

  getLedgerEntriesBySubject: (subjectCode: string) => {
    const state = get();
    return state.ledgerEntries.filter(entry =>
      entry.subjectCode === subjectCode
    );
  },

  loadTemplate: async (template: any, loadAmounts: boolean) => {
    const state = get();
    const now = new Date().toISOString();
    const newId = Date.now().toString();
    assertVoucherDateEditable(state.voucherDate, '套用模板生成凭证');

    // Generate voucher number
    const voucherNo = await generateVoucherNo(state.voucherDate);

    // Create new entries from template
    const newEntries = template.entries.map((entry: any, index: number) => ({
      ...createDefaultEntry(newId, index),
      summary: entry.summary || '',
      subjectCode: entry.subjectCode || '',
      subjectName: entry.subjectName || '',
      deptCode: entry.deptCode || '',
      projectCode: entry.projectCode || '',
      debit: loadAmounts ? (entry.debit || 0) : 0,
      credit: loadAmounts ? (entry.credit || 0) : 0,
      auxiliary: {
        department: entry.deptCode || '',
        project: entry.projectCode || '',
        customer: entry.customerName || '',
        supplier: entry.supplierName || ''
      }
    }));

    // Ensure we have at least 10 rows
    while (newEntries.length < 10) {
      newEntries.push(createDefaultEntry(newId, newEntries.length));
    }

    // Calculate totals
    const totalDebit = newEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = newEntries.reduce((sum, e) => sum + (e.credit || 0), 0);

    // Create a new voucher with the entries
    const newVoucher: Voucher = {
      id: newId,
      voucherNo,
      date: state.voucherDate,
      summary: '',
      entries: newEntries,
      status: 'draft',
      voucherType: 'general',
      createdBy: 'user',
      createTime: now,
      updateTime: now
    };

    // Save to database
    await getCurrentService().saveVoucher(newVoucher);

    set({
      currentEntries: newEntries,
      voucherNo: newVoucher.voucherNo,
      currentVoucher: newVoucher,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      vouchers: [...state.vouchers, newVoucher]
    });
  }
}));
