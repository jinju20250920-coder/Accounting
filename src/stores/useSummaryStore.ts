import { create } from 'zustand';
import { getCurrentService } from '@/lib/database';
import type { CommonSummary, RecentSummary } from '@/types';
import { useAccountSetStore } from './useAccountSetStore';

// 默认常用摘要
const defaultCommonSummaries: Omit<CommonSummary, 'id' | 'createdAt' | 'accountSetId'>[] = [
  {
    text: '报销差旅费',
    sortOrder: 1
  },
  {
    text: '支付货款',
    sortOrder: 2
  },
  {
    text: '计提折旧',
    sortOrder: 3
  },
  {
    text: '购买办公用品',
    sortOrder: 4
  },
  {
    text: '销售收入',
    sortOrder: 5
  },
  {
    text: '收到货款',
    sortOrder: 6
  },
  {
    text: '支付水电费',
    sortOrder: 7
  },
  {
    text: '发放工资',
    sortOrder: 8
  }
];

// 常用摘要存储
interface SummaryStore {
  // 常用摘要库（预定义）
  commonSummaries: CommonSummary[];

  // 最近使用的摘要（内存存储，不持久化）
  recentSummaries: RecentSummary[];

  // 常用摘要操作
  addCommonSummary: (text: string) => Promise<void>;
  updateCommonSummary: (id: string, text: string) => Promise<void>;
  deleteCommonSummary: (id: string) => Promise<void>;
  reorderCommonSummaries: (ids: string[]) => Promise<void>;

  // 最近使用操作
  addRecentSummary: (text: string) => void;
  clearRecentSummaries: () => void;

  // 获取摘要列表
  getSummaryList: () => { common: CommonSummary[]; recent: RecentSummary[] };

  // Excel 导入导出
  importSummariesFromExcel: (data: Array<{ 摘要内容: string }>) => Promise<{ success: number; failed: number; errors: string[] }>;
  exportSummariesToExcel: () => Array<{ 摘要内容: string; 排序: number }>;

  // 初始化
  initializeSummaries: () => Promise<void>;
}

export const useSummaryStore = create<SummaryStore>((set, get) => ({
  commonSummaries: [],
  recentSummaries: [],

  // 初始化常用摘要
  initializeSummaries: async () => {
    try {
      const summaries = await getCurrentService().getAllCommonSummaries();

      if (summaries.length > 0) {
        set({ commonSummaries: summaries });
        return;
      }

      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const now = new Date().toISOString();
      const initializedSummaries = defaultCommonSummaries.map((summary, index) => ({
        ...summary,
        id: `summary_${index}`,
        createdAt: now,
        accountSetId: currentAccountSet?.id
      }));

      await getCurrentService().saveCommonSummaries(initializedSummaries);
      set({ commonSummaries: initializedSummaries });
    } catch (error) {
      console.error('Failed to initialize summaries:', error);
      throw error;
    }
  },

  // 常用摘要操作
  addCommonSummary: async (text: string) => {
    try {
      const state = get();
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const newSummary: CommonSummary = {
        id: Date.now().toString(),
        text: text.trim(),
        sortOrder: state.commonSummaries.length + 1,
        createdAt: new Date().toISOString(),
        accountSetId: currentAccountSet?.id
      };

      const newSummaries = [...state.commonSummaries, newSummary].sort((a, b) => a.sortOrder - b.sortOrder);
      await getCurrentService().saveCommonSummaries(newSummaries);

      set({ commonSummaries: newSummaries });
    } catch (error) {
      console.error('Failed to add common summary:', error);
      throw error;
    }
  },

  updateCommonSummary: async (id: string, text: string) => {
    try {
      const state = get();
      const updatedSummaries = state.commonSummaries.map(summary =>
        summary.id === id ? { ...summary, text: text.trim() } : summary
      );
      await getCurrentService().saveCommonSummaries(updatedSummaries);
      set({ commonSummaries: updatedSummaries });
    } catch (error) {
      console.error('Failed to update common summary:', error);
      throw error;
    }
  },

  deleteCommonSummary: async (id: string) => {
    try {
      const state = get();
      const updatedSummaries = state.commonSummaries.filter(summary => summary.id !== id);
      await getCurrentService().saveCommonSummaries(updatedSummaries);
      set({ commonSummaries: updatedSummaries });
    } catch (error) {
      console.error('Failed to delete common summary:', error);
      throw error;
    }
  },

  reorderCommonSummaries: async (ids: string[]) => {
    try {
      const state = get();
      const reorderedSummaries = ids.map((id, index) => {
        const summary = state.commonSummaries.find(s => s.id === id);
        return summary ? { ...summary, sortOrder: index + 1 } : null;
      }).filter(Boolean).map(s => s as CommonSummary);

      await getCurrentService().saveCommonSummaries(reorderedSummaries);
      set({ commonSummaries: reorderedSummaries });
    } catch (error) {
      console.error('Failed to reorder common summaries:', error);
      throw error;
    }
  },

  // 最近使用操作（内存存储，不持久化）
  addRecentSummary: (text: string) => set((state) => {
    const trimmedText = text.trim();

    // 如果是空字符串，不添加
    if (!trimmedText) {
      return state;
    }

    // 检查是否已存在（避免重复）
    const existingIndex = state.recentSummaries.findIndex(summary =>
      summary.text === trimmedText
    );

    let newRecentSummaries = [...state.recentSummaries];

    if (existingIndex !== -1) {
      // 如果已存在，移到顶部
      const [existing] = newRecentSummaries.splice(existingIndex, 1);
      newRecentSummaries.unshift({
        ...existing,
        usedAt: new Date().toISOString()
      });
    } else {
      // 如果不存在，添加到顶部
      newRecentSummaries.unshift({
        id: Date.now().toString(),
        text: trimmedText,
        usedAt: new Date().toISOString()
      });
    }

    // 最多保存 5 条最近使用的摘要
    return {
      recentSummaries: newRecentSummaries.slice(0, 5)
    };
  }),

  clearRecentSummaries: () => set({ recentSummaries: [] }),

  // 获取摘要列表
  getSummaryList: () => {
    const state = get();
    return {
      common: [...state.commonSummaries].sort((a, b) => a.sortOrder - b.sortOrder),
      recent: [...state.recentSummaries]
    };
  },

  // Excel 导入摘要
  importSummariesFromExcel: async (data: Array<{ 摘要内容: string }>) => {
    try {
      const state = get();
      const errors: string[] = [];
      let success = 0;
      let failed = 0;

      const newSummaries: CommonSummary[] = [];
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      data.forEach((row, index) => {
        const text = row['摘要内容'];
        if (!text || String(text).trim() === '') {
          failed++;
          errors.push(`第${index + 2}行：摘要内容不能为空`);
          return;
        }

        // 检查是否已存在
        const exists = state.commonSummaries.some(s => s.text === String(text).trim());
        if (exists) {
          failed++;
          errors.push(`第${index + 2}行：摘要已存在，跳过`);
          return;
        }

        newSummaries.push({
          id: Date.now().toString() + '_' + index,
          text: String(text).trim(),
          sortOrder: state.commonSummaries.length + success + 1,
          createdAt: new Date().toISOString(),
          accountSetId: currentAccountSet?.id
        });
        success++;
      });

      if (newSummaries.length > 0) {
        const updatedSummaries = [...state.commonSummaries, ...newSummaries].sort((a, b) => a.sortOrder - b.sortOrder);
        await getCurrentService().saveCommonSummaries(updatedSummaries);
        set({ commonSummaries: updatedSummaries });
      }

      return { success, failed, errors };
    } catch (error) {
      console.error('Failed to import summaries from Excel:', error);
      throw error;
    }
  },

  // Excel 导出摘要
  exportSummariesToExcel: () => {
    const state = get();
    return state.commonSummaries
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((summary) => ({
        摘要内容: summary.text,
        排序: summary.sortOrder
      }));
  }
}));
