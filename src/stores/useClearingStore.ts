import { create } from 'zustand';
import { getCurrentService, getCurrentManager } from '@/lib/database';
import type { RecRelation, OutstandingItem, VoucherEntry, Voucher } from '@/types';
import { generateId, generateClearingNo, calculateClearedAmount, calculateRemainingAmount } from '@/lib/accounting';
import { useVoucherStore } from './useVoucherStore';

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
    createdAt: new Date().toISOString()
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
              // 使用共享函数计算净额
              const entry1Amount = calculateEntryNetAmount(entry1);
              const entry2Amount = calculateEntryNetAmount(entry2);

              console.log('金额方向:', entry1Amount, entry2Amount);

              if (entry1Amount * entry2Amount < 0) {
                // 使用现有工具函数计算已核销金额和剩余金额
                const entry1Relations = get().getClearingItems(entry1Id);
                const entry1Cleared = calculateClearedAmount(entry1Relations);

                const entry2Relations = get().getClearingItems(entry2Id);
                const entry2Cleared = calculateClearedAmount(entry2Relations);

                const entry1Total = Math.abs(entry1Amount);
                const entry2Total = Math.abs(entry2Amount);
                const entry1Remaining = calculateRemainingAmount(entry1Total, entry1Cleared);
                const entry2Remaining = calculateRemainingAmount(entry2Total, entry2Cleared);

                console.log('剩余金额:', entry1Remaining, entry2Remaining);

                if (entry1Remaining > 0 && entry2Remaining > 0) {
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
                  } catch (dbError) {
                    console.error('保存核销关系失败:', dbError);
                  }
                }
              }
            }
          }
        }
      }

      // 重新加载核销关系
      await get().loadRecRelations();

      // 重新加载凭证数据，确保 recRefNo 字段更新
      const voucherStore = useVoucherStore.getState();
      await voucherStore.initialize();

      console.log('批量核销完成，已核销条目:', clearedEntries);

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