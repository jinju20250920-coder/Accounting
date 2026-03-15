import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { CommonSummary, RecentSummary } from '@/types';

// 常用摘要存储
interface SummaryStore {
  // 常用摘要库（预定义）
  commonSummaries: CommonSummary[];

  // 最近使用的摘要
  recentSummaries: RecentSummary[];

  // 常用摘要操作
  addCommonSummary: (text: string) => void;
  updateCommonSummary: (id: string, text: string) => void;
  deleteCommonSummary: (id: string) => void;
  reorderCommonSummaries: (ids: string[]) => void;

  // 最近使用操作
  addRecentSummary: (text: string) => void;
  clearRecentSummaries: () => void;

  // 获取摘要列表
  getSummaryList: () => { common: CommonSummary[]; recent: RecentSummary[] };
}

// 默认常用摘要
const defaultCommonSummaries: CommonSummary[] = [
  {
    id: '1',
    text: '报销差旅费',
    sortOrder: 1,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    text: '支付货款',
    sortOrder: 2,
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    text: '计提折旧',
    sortOrder: 3,
    createdAt: new Date().toISOString()
  },
  {
    id: '4',
    text: '购买办公用品',
    sortOrder: 4,
    createdAt: new Date().toISOString()
  },
  {
    id: '5',
    text: '销售收入',
    sortOrder: 5,
    createdAt: new Date().toISOString()
  },
  {
    id: '6',
    text: '收到货款',
    sortOrder: 6,
    createdAt: new Date().toISOString()
  },
  {
    id: '7',
    text: '支付水电费',
    sortOrder: 7,
    createdAt: new Date().toISOString()
  },
  {
    id: '8',
    text: '发放工资',
    sortOrder: 8,
    createdAt: new Date().toISOString()
  }
];

export const useSummaryStore = create<SummaryStore>()(
  persist((set, get) => ({
    commonSummaries: defaultCommonSummaries,
    recentSummaries: [],

    // 常用摘要操作
    addCommonSummary: (text: string) => set((state) => {
      const newSummary: CommonSummary = {
        id: Date.now().toString(),
        text: text.trim(),
        sortOrder: state.commonSummaries.length + 1,
        createdAt: new Date().toISOString()
      };

      return {
        commonSummaries: [...state.commonSummaries, newSummary].sort((a, b) => a.sortOrder - b.sortOrder)
      };
    }),

    updateCommonSummary: (id: string, text: string) => set((state) => ({
      commonSummaries: state.commonSummaries.map(summary =>
        summary.id === id ? { ...summary, text: text.trim() } : summary
      )
    })),

    deleteCommonSummary: (id: string) => set((state) => ({
      commonSummaries: state.commonSummaries.filter(summary => summary.id !== id)
    })),

    reorderCommonSummaries: (ids: string[]) => set((state) => {
      return {
        commonSummaries: ids.map((id, index) => {
          const summary = state.commonSummaries.find(s => s.id === id);
          return summary ? { ...summary, sortOrder: index + 1 } : null;
        }).filter(Boolean).map(s => s as CommonSummary),
      };
    }),

    // 最近使用操作
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
    }
  }), {
    name: 'finance-summaries'
  })
);