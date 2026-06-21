'use client';

import { create } from 'zustand';
import { getCurrentService, getCurrentManager } from '@/lib/database';
import type { RecRelation, OutstandingItem, VoucherEntry, Voucher } from '@/types';
import { generateId, generateClearingNo, calculateClearedAmount, calculateRemainingAmount } from '@/lib/accounting';
import { useVoucherStore, generateVoucherNo } from './useVoucherStore';

interface ClearingStore {
  recRelations: RecRelation[];
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  loadRecRelations: () => Promise<void>;
  updateRecRefNo: (entryId: string, recRefNo: string) => Promise<void>;
  processClearing: (entryId: string, items: OutstandingItem[]) => Promise<void>;
  processBatchClearing: (entryIds: string[], entries: VoucherEntry[]) => Promise<string[]>;
  getClearedAmount: (entryId: string) => number;
  getRemainingAmount: (entryId: string, totalAmount: number) => number;
  getClearingItems: (entryId: string) => RecRelation[];
  ensureInitialized: () => Promise<void>;
}

// ========== 共享辅助函数 ==========

/**
 * 创建并保存单个核销关系
 */
async function createAndSaveClearingRelation(
  debitEntryId: string,
  creditEntryId: string,
  amount: number,
  recRefNo: string
): Promise<RecRelation> {
  const relation: RecRelation = {
    id: generateId(),
    debitEntryId,
    creditEntryId,
    amount,
    recRefNo,
    recDate: new Date().toISOString().split('T')[0],
    createdBy: 'current-user',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString()
  };

  await getCurrentService().saveRecRelation(relation);

  // 更新分录的核销单号
  await getCurrentService().updateEntryRecRefNo(debitEntryId, recRefNo);
  await getCurrentService().updateEntryRecRefNo(creditEntryId, recRefNo);

  return relation;
}

/**
 * 计算分录的净额（借方-贷方）
 */
function calculateEntryNetAmount(entry: VoucherEntry): number {
  return entry.debit - entry.credit;
}

/**
 * 判断分录是否为外币分录（非 CNY/RMB）
 */
function isForeignEntry(entry: VoucherEntry): boolean {
  return Boolean(entry.currencyCode)
    && entry.currencyCode !== 'CNY'
    && entry.currencyCode !== 'RMB';
}

/**
 * 计算一对核销分录的实现汇兑损益
 *
 * 场景：两笔同币别、同科目的外币分录（一借一贷）相互核销时，
 * 若两笔本币金额不一致（因汇率变动），差额即为已实现汇兑损益。
 *
 * 对于应收/资产类（借方原始、贷方核销）：
 *   diff = creditAbs - debitAbs > 0 → 客户多还（汇兑收益）
 *   diff < 0 → 客户少还（汇兑损失）
 *
 * 对于应付/负债类（贷方原始、借方核销）：
 *   diff = debitAbs - creditAbs > 0 → 我方多付（汇兑损失）
 *   diff < 0 → 我方少付（汇兑收益）
 *
 * @returns 损益金额：正数=收益，负数=损失；0 表示无汇兑损益
 */
function calculateRealizedFxGainLoss(
  debitEntry: VoucherEntry,
  creditEntry: VoucherEntry,
  isAccountsReceivable: boolean,
): number {
  const debitAbs = debitEntry.debit || 0;
  const creditAbs = creditEntry.credit || 0;
  if (isAccountsReceivable) {
    return Math.round((creditAbs - debitAbs) * 100) / 100;
  }
  return Math.round((debitAbs - creditAbs) * 100) / 100;
}

/**
 * 查找汇兑损益科目：优先 660303（财务费用-汇兑损益），回退到 6603。
 */
async function resolveFxGainLossSubject(): Promise<{ code: string; name: string } | null> {
  const subj660303 = await getCurrentService().getSubjectByCode('660303');
  if (subj660303 && !subj660303.disabled) {
    return { code: subj660303.code, name: subj660303.name };
  }
  const subj6603 = await getCurrentService().getSubjectByCode('6603');
  if (subj6603 && !subj6603.disabled) {
    return { code: subj6603.code, name: subj6603.name };
  }
  return null;
}

/**
 * 在批量核销完成后，为所有产生汇兑损益的外币对生成一张凭证。
 *
 * 凭证结构（多对汇总到一张）：
 * - 对每个原 AR/AP 科目：借贷一笔调整分录（让该科目在核销后的余额归零）
 * - 对汇兑损益科目：汇总借贷一笔（差额）
 *
 * 收益：借原科目，贷汇兑损益
 * 损失：借汇兑损益，贷原科目
 */
async function generateFxSettlementVoucher(params: {
  adjustments: Array<{
    subjectCode: string;
    subjectName: string;
    currencyCode: string;
    customerName?: string;
    supplierName?: string;
    amount: number; // 正=收益，负=损失
  }>;
  recRefNo: string;
}): Promise<Voucher | null> {
  const { adjustments, recRefNo } = params;
  const materialAdjustments = adjustments.filter(a => Math.abs(a.amount) >= 0.01);
  if (materialAdjustments.length === 0) return null;

  const fxSubject = await resolveFxGainLossSubject();
  if (!fxSubject) {
    console.warn('[FX settlement] 未找到 660303/6603 汇兑损益科目，跳过汇兑损益凭证生成');
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const voucherNo = await generateVoucherNo(today);

  const entries: VoucherEntry[] = [];
  let totalGain = 0; // 正数汇总
  let totalLoss = 0; // 正数汇总

  materialAdjustments.forEach((adj) => {
    const isGain = adj.amount > 0;
    const absAmount = Math.abs(adj.amount);
    const auxiliary: Record<string, string> = {};
    if (adj.customerName) auxiliary.customer = adj.customerName;
    if (adj.supplierName) auxiliary.supplier = adj.supplierName;

    if (isGain) {
      totalGain += absAmount;
      // 收益：借原科目，贷汇兑损益
      entries.push({
        id: generateId(),
        voucherId: '',
        date: today,
        summary: `汇兑损益-核销 ${adj.customerName || adj.supplierName || ''} (${adj.currencyCode})`,
        subjectCode: adj.subjectCode,
        subjectName: adj.subjectName,
        debit: absAmount,
        credit: 0,
        auxiliary,
        recRefNo,
        currencyCode: '',
        currencyName: '',
        exchangeRate: 0,
        originalAmount: 0,
        accountSetId: '',
      });
    } else {
      totalLoss += absAmount;
      // 损失：贷原科目
      entries.push({
        id: generateId(),
        voucherId: '',
        date: today,
        summary: `汇兑损益-核销 ${adj.customerName || adj.supplierName || ''} (${adj.currencyCode})`,
        subjectCode: adj.subjectCode,
        subjectName: adj.subjectName,
        debit: 0,
        credit: absAmount,
        auxiliary,
        recRefNo,
        currencyCode: '',
        currencyName: '',
        exchangeRate: 0,
        originalAmount: 0,
        accountSetId: '',
      });
    }
  });

  // 汇兑损益科目汇总分录（借贷差额）
  const netGain = Math.round((totalGain - totalLoss) * 100) / 100;
  if (netGain > 0) {
    entries.push({
      id: generateId(),
      voucherId: '',
      date: today,
      summary: `汇兑损益-核销净收益 ${recRefNo}`,
      subjectCode: fxSubject.code,
      subjectName: fxSubject.name,
      debit: 0,
      credit: netGain,
      auxiliary: {},
      recRefNo,
      currencyCode: '',
      currencyName: '',
      exchangeRate: 0,
      originalAmount: 0,
      accountSetId: '',
    });
  } else if (netGain < 0) {
    entries.push({
      id: generateId(),
      voucherId: '',
      date: today,
      summary: `汇兑损益-核销净损失 ${recRefNo}`,
      subjectCode: fxSubject.code,
      subjectName: fxSubject.name,
      debit: Math.abs(netGain),
      credit: 0,
      auxiliary: {},
      recRefNo,
      currencyCode: '',
      currencyName: '',
      exchangeRate: 0,
      originalAmount: 0,
      accountSetId: '',
    });
  }

  const voucher: Voucher = {
    id: generateId(),
    voucherNo,
    date: today,
    summary: `核销汇兑损益-${recRefNo}`,
    status: 'posted',
    voucherType: 'general',
    createdBy: 'system-fx',
    createTime: now,
    updateTime: now,
    accountSetId: '',
    entries,
  };

  try {
    await getCurrentService().saveVoucher(voucher);
    console.info('[FX settlement] 已生成汇兑损益凭证', voucherNo, '分录数', entries.length);
    return voucher;
  } catch (err) {
    console.error('[FX settlement] 保存汇兑损益凭证失败', err);
    return null;
  }
}

export const useClearingStore = create<ClearingStore>((set, get) => ({
  recRelations: [],
  isLoading: false,
  isInitialized: false,

  loadRecRelations: async () => {
    set({ isLoading: true });
    try {
      // 确保数据库已初始化
      await getCurrentManager().init();
      const relations = await getCurrentService().getRecRelations();
      console.log('Loaded rec relations:', relations.length, relations);
      set({ recRelations: relations });
      set({ isInitialized: true });
    } catch (error) {
      console.error('加载核销关系失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  ensureInitialized: async () => {
    const state = get();
    if (!state.isInitialized) {
      await state.loadRecRelations();
    }
  },

  updateRecRefNo: async (entryId: string, recRefNo: string) => {
    try {
      await getCurrentService().updateEntryRecRefNo(entryId, recRefNo);
    } catch (error) {
      console.error('更新核销单号失败:', error);
    }
  },

  processBatchClearing: async (entryIds: string[], entries: VoucherEntry[]) => {
    set({ isLoading: true });
    const clearedEntries: string[] = [];

    try {
      // 确保数据库已初始化
      await getCurrentManager().init();
      console.log('processBatchClearing 调用，entryIds:', entryIds, 'entries:', entries.length);

      // 使用统一的核销单号生成函数
      const recRefNo = generateClearingNo();

      // 按科目分组
      const subjectGroups = new Map<string, string[]>();
      entryIds.forEach(entryId => {
        const entry = entries.find(e => e.id === entryId);
        if (entry) {
          const key = entry.subjectCode || 'unknown';
          if (!subjectGroups.has(key)) {
            subjectGroups.set(key, []);
          }
          subjectGroups.get(key)!.push(entryId);
        }
      });

      console.log('科目分组:', Array.from(subjectGroups.entries()));

      // 判断是应收还是应付（通过第一个分录的科目判断）
      const firstEntry = entries.find(e => e.id === entryIds[0]);
      const isAccountsReceivable = firstEntry?.customerName ? true : false;

      // 收集外币对的汇兑损益调整（核销完成后统一生成一张凭证）
      const fxAdjustments: Array<{
        subjectCode: string;
        subjectName: string;
        currencyCode: string;
        customerName?: string;
        supplierName?: string;
        amount: number;
      }> = [];

      // 处理每个科目分组
      for (const [subjectCode, groupEntryIds] of subjectGroups.entries()) {
        // 如果科目相同，可以直接相互核销
        for (let i = 0; i < groupEntryIds.length; i++) {
          for (let j = i + 1; j < groupEntryIds.length; j++) {
            const entry1Id = groupEntryIds[i];
            const entry2Id = groupEntryIds[j];

            const entry1 = entries.find(e => e.id === entry1Id);
            const entry2 = entries.find(e => e.id === entry2Id);

            console.log('检查分录对:', entry1Id, entry2Id, entry1, entry2);

            if (entry1 && entry2) {
              // 计算带符号的金额
              let entry1Amount = 0;
              let entry2Amount = 0;

              if (isAccountsReceivable) {
                // 应收账款：借方正数，贷方负数
                entry1Amount = entry1.debit > 0 ? entry1.debit : -entry1.credit;
                entry2Amount = entry2.debit > 0 ? entry2.debit : -entry2.credit;
              } else {
                // 应付账款：贷方正数，借方负数
                entry1Amount = entry1.credit > 0 ? entry1.credit : -entry1.debit;
                entry2Amount = entry2.credit > 0 ? entry2.credit : -entry2.debit;
              }

              console.log('金额方向:', entry1Amount, entry2Amount);

              // 只有异号才能核销
              if (entry1Amount * entry2Amount < 0) {
                // 获取已核销金额
                const entry1Relations = get().getClearingItems(entry1Id);
                const entry1Cleared = calculateClearedAmount(entry1Relations);

                const entry2Relations = get().getClearingItems(entry2Id);
                const entry2Cleared = calculateClearedAmount(entry2Relations);

                // 计算剩余金额（考虑正负方向）
                let entry1Remaining = 0;
                let entry2Remaining = 0;

                if (entry1Amount > 0) {
                  // 正数分录：剩余 = 原始 - 已核销
                  entry1Remaining = entry1Amount - entry1Cleared;
                  // 剩余不足0.01则跳过
                  if (entry1Remaining < 0.01) {
                    console.log('分录1已完全核销，跳过:', entry1Id, entry1Remaining);
                    continue;
                  }
                } else {
                  // 负数分录：剩余 = 原始 + 已核销（因为cleared是正数）
                  entry1Remaining = entry1Amount + entry1Cleared;
                  // 剩余大于-0.01则跳过（已完全核销）
                  if (entry1Remaining > -0.01) {
                    console.log('分录1已完全核销，跳过:', entry1Id, entry1Remaining);
                    continue;
                  }
                  // 负数剩余取绝对值用于计算核销金额
                  entry1Remaining = Math.abs(entry1Remaining);
                }

                if (entry2Amount > 0) {
                  entry2Remaining = entry2Amount - entry2Cleared;
                  if (entry2Remaining < 0.01) {
                    console.log('分录2已完全核销，跳过:', entry2Id, entry2Remaining);
                    continue;
                  }
                } else {
                  entry2Remaining = entry2Amount + entry2Cleared;
                  if (entry2Remaining > -0.01) {
                    console.log('分录2已完全核销，跳过:', entry2Id, entry2Remaining);
                    continue;
                  }
                  entry2Remaining = Math.abs(entry2Remaining);
                }

                console.log('剩余金额:', entry1Remaining, entry2Remaining);

                // 取较小值作为核销金额
                const minAmount = Math.min(entry1Remaining, entry2Remaining);

                const debitEntryId = entry1Amount > 0 ? entry1Id : entry2Id;
                const creditEntryId = entry1Amount < 0 ? entry1Id : entry2Id;

                console.log('保存核销关系:', { debitEntryId, creditEntryId, amount: minAmount, recRefNo });

                try {
                  // 使用共享函数创建并保存核销关系
                  await createAndSaveClearingRelation(
                    debitEntryId,
                    creditEntryId,
                    minAmount,
                    recRefNo
                  );

                  clearedEntries.push(entry1Id, entry2Id);

                  // 外币对核销：计算实现汇兑损益
                  // 仅当两笔分录都是外币且币别相同，且核销金额 > 0 时才计算
                  const debitEntry = entry1Amount > 0 ? entry1 : entry2;
                  const creditEntry = entry1Amount < 0 ? entry1 : entry2;
                  if (
                    debitEntry && creditEntry
                    && isForeignEntry(debitEntry)
                    && isForeignEntry(creditEntry)
                    && debitEntry.currencyCode === creditEntry.currencyCode
                  ) {
                    const fxAmount = calculateRealizedFxGainLoss(debitEntry, creditEntry, isAccountsReceivable);
                    if (Math.abs(fxAmount) >= 0.01) {
                      fxAdjustments.push({
                        subjectCode: debitEntry.subjectCode,
                        subjectName: debitEntry.subjectName,
                        currencyCode: debitEntry.currencyCode!,
                        customerName: debitEntry.customerName || debitEntry.auxiliary?.customer,
                        supplierName: debitEntry.supplierName || debitEntry.auxiliary?.supplier,
                        amount: fxAmount,
                      });
                      console.info('[FX settlement] 检测到汇兑损益', {
                        subjectCode: debitEntry.subjectCode,
                        currency: debitEntry.currencyCode,
                        amount: fxAmount,
                        isAccountsReceivable,
                      });
                    }
                  }
                } catch (dbError) {
                  console.error('保存核销关系失败:', dbError);
                }
              }
            }
          }
        }
      }

      // 重新加载核销关系
      await get().loadRecRelations();

      // 若有外币核销产生汇兑损益，生成一张汇总凭证
      if (fxAdjustments.length > 0) {
        await generateFxSettlementVoucher({ adjustments: fxAdjustments, recRefNo });
      }

      // 重新加载凭证数据，确保 recRefNo 字段更新
      const voucherStore = useVoucherStore.getState();
      await voucherStore.initialize();

      console.log('批量核销完成，已核销条目:', clearedEntries, '汇兑损益调整:', fxAdjustments.length);

    } catch (error) {
      console.error('批量核销失败:', error);
    } finally {
      set({ isLoading: false });
    }

    return clearedEntries;
  },

  processClearing: async (entryId: string, items: OutstandingItem[]) => {
    set({ isLoading: true });
    try {
      // 确保数据库已初始化
      await getCurrentManager().init();
      // 使用统一的核销单号生成函数
      const recRefNo = generateClearingNo();

      for (const item of items) {
        const debitEntryId = item.direction === 'debit' ? item.entryId : entryId;
        const creditEntryId = item.direction === 'credit' ? item.entryId : entryId;

        // 使用共享函数创建并保存核销关系
        await createAndSaveClearingRelation(
          debitEntryId,
          creditEntryId,
          item.remainingAmount,
          recRefNo
        );
      }

      // 重新加载核销关系
      await get().loadRecRelations();
    } catch (error) {
      console.error('处理核销失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  getClearedAmount: (entryId: string): number => {
    const { recRelations } = get();
    return recRelations
      .filter(rel => rel.debitEntryId === entryId || rel.creditEntryId === entryId)
      .reduce((sum, rel) => sum + rel.amount, 0);
  },

  getRemainingAmount: (entryId: string, totalAmount: number): number => {
    const clearedAmount = get().getClearedAmount(entryId);
    return totalAmount - clearedAmount;
  },

  getClearingItems: (entryId: string): RecRelation[] => {
    const { recRelations } = get();
    return recRelations.filter(rel =>
      rel.debitEntryId === entryId || rel.creditEntryId === entryId
    );
  }
}));