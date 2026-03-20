import { create } from 'zustand';
import { databaseService } from '@/lib/database/service';
import type { RecRelation, OutstandingItem } from '@/types';

interface ClearingStore {
  recRelations: RecRelation[];
  isLoading: boolean;

  // Actions
  loadRecRelations: () => Promise<void>;
  updateRecRefNo: (entryId: string, recRefNo: string) => Promise<void>;
  processClearing: (entryId: string, items: OutstandingItem[]) => Promise<void>;
  getClearedAmount: (entryId: string) => number;
  getRemainingAmount: (entryId: string, totalAmount: number) => number;
  getClearingItems: (entryId: string) => RecRelation[];
}

export const useClearingStore = create<ClearingStore>((set, get) => ({
  recRelations: [],
  isLoading: false,

  loadRecRelations: async () => {
    set({ isLoading: true });
    try {
      const relations = await databaseService.getRecRelations();
      set({ recRelations: relations });
    } catch (error) {
      console.error('加载核销关系失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  updateRecRefNo: async (entryId: string, recRefNo: string) => {
    try {
      await databaseService.updateEntryRecRefNo(entryId, recRefNo);
    } catch (error) {
      console.error('更新核销单号失败:', error);
    }
  },

  processClearing: async (entryId: string, items: OutstandingItem[]) => {
    set({ isLoading: true });
    try {
      // 创建核销关系
      const recRefNo = `REC-${Date.now().toString(36).toUpperCase()}`;

      for (const item of items) {
        const relation: RecRelation = {
          id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          debitEntryId: item.direction === 'debit' ? item.entryId : entryId,
          creditEntryId: item.direction === 'credit' ? item.entryId : entryId,
          amount: item.remainingAmount,
          recRefNo,
          recDate: new Date().toISOString().split('T')[0],
          createdBy: 'current-user',
          createdAt: new Date().toISOString()
        };

        await databaseService.saveRecRelation(relation);
      }

      // 更新当前分录的核销单号
      await databaseService.updateEntryRecRefNo(entryId, recRefNo);

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