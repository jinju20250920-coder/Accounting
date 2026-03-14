import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createVersionedStorage, DATA_VERSIONS } from './persistence-config';

// 用户偏好接口
interface Preference {
  id: string;
  summary: string; // 摘要（匹配模式）
  subject: string; // 用户最终确认的科目
  subjectName?: string;
  timestamp: number;
  matchedCount: number; // 匹配次数
  successRate: number; // 成功率
}

// 智能匹配结果
interface SmartMatchResult {
  subject: string;
  subjectName?: string;
  source: 'rule' | 'user-preference' | 'manual';
  confidence?: number;
}

// 用户偏好Store
interface PreferenceStore {
  preferences: Preference[];

  // Actions
  savePreference: (summary: string, subject: string, subjectName?: string) => void;
  getSmartMatch: (summary: string) => SmartMatchResult | null;
  getPreferencesBySubject: (subject: string) => Preference[];
  clearPreferences: () => void;
  getStatistics: () => {
    totalMatches: number;
    successRate: number;
    mostUsedSubjects: Array<{ subject: string; count: number }>;
  };
}

// 迁移函数
const migrateV1ToV2 = (state: any) => {
  if (!state.preferences) return state;

  // 添加匹配次数和成功率字段
  const migratedPreferences = state.preferences.map((pref: any) => ({
    ...pref,
    matchedCount: pref.matchedCount || 1,
    successRate: pref.successRate || 1.0
  }));

  return {
    ...state,
    preferences: migratedPreferences,
    version: DATA_VERSIONS.V2
  };
};

export const useUserPreferenceStore = create<PreferenceStore>()(
  createVersionedStorage<PreferenceStore>('finance-preferences', {
    [DATA_VERSIONS.V1 + 1]: migrateV1ToV2
  })((set, get) => ({
      preferences: [],

      // 保存用户偏好
      savePreference: (summary, subject, subjectName) => {
        const state = get();
        const timestamp = Date.now();

        set((state) => {
          // 检查是否已存在相似的摘要
          const existingIndex = state.preferences.findIndex(
            pref =>
              pref.summary === summary &&
              pref.subject === subject
          );

          if (existingIndex >= 0) {
            // 更新现有偏好的匹配次数
            const updated = [...state.preferences];
            updated[existingIndex] = {
              ...updated[existingIndex],
              matchedCount: updated[existingIndex].matchedCount + 1,
              timestamp,
              successRate: updated[existingIndex].successRate
            };

            return { preferences: updated };
          } else {
            // 添加新偏好，只保留最近50条
            const newPreference: Preference = {
              id: `pref_${timestamp}`,
              summary,
              subject,
              subjectName,
              timestamp,
              matchedCount: 1,
              successRate: 1.0
            };

            return {
              preferences: [newPreference, ...state.preferences].slice(0, 50)
            };
          }
        });
      },

      // 获取智能匹配结果
      getSmartMatch: (summary) => {
        const state = get();

        // 1. 尝试 L2：在用户偏好中寻找匹配
        const l2Matches = state.preferences.filter(pref =>
          summary.includes(pref.summary) ||
          pref.summary.includes(summary) ||
          summary.includes(pref.subject)
        );

        // 优先选择匹配度最高的
        if (l2Matches.length > 0) {
          const bestMatch = l2Matches.reduce((best, current) => {
            // 按匹配次数和成功率排序
            const bestScore = best.matchedCount * best.successRate;
            const currentScore = current.matchedCount * current.successRate;
            return currentScore > bestScore ? current : best;
          });

          return {
            subject: bestMatch.subject,
            subjectName: bestMatch.subjectName,
            source: 'user-preference' as const,
            confidence: Math.min(bestMatch.matchedCount * 0.1, 0.9)
          };
        }

        // 2. 尝试 L1：在预设规则中寻找匹配
        const rules = require('@/lib/data/keyword-rules.json');
        const l1Match = rules.find((rule: any) =>
          summary.includes(rule.keyword) ||
          rule.keyword.includes(summary)
        );

        if (l1Match) {
          return {
            subject: l1Match.subject,
            subjectName: state.preferences.find(p => p.subject === l1Match.subject)?.subjectName,
            source: 'rule' as const,
            confidence: 0.6
          };
        }

        // 3. 无匹配
        return null;
      },

      // 根据科目获取偏好
      getPreferencesBySubject: (subject) => {
        const state = get();
        return state.preferences.filter(pref => pref.subject === subject);
      },

      // 清空所有偏好
      clearPreferences: () => {
        set({ preferences: [] });
      },

      // 获取统计信息
      getStatistics: () => {
        const state = get();
        const totalMatches = state.preferences.length;
        const successRate = totalMatches > 0
          ? state.preferences.reduce((sum, pref) => sum + pref.successRate, 0) / totalMatches
          : 0;

        // 统计最常用的科目
        const subjectCounts = new Map<string, number>();
        state.preferences.forEach(pref => {
          subjectCounts.set(pref.subject, (subjectCounts.get(pref.subject) || 0) + 1);
        });

        const mostUsedSubjects = Array.from(subjectCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([subject, count]) => ({ subject, count }));

        return {
          totalMatches,
          successRate,
          mostUsedSubjects
        };
      },
    }),
    {
      name: 'user-pref-storage',
      storage: {
        getItem: (name: string) => {
          const item = localStorage.getItem(name);
          if (!item) return null;

          try {
            const parsed = JSON.parse(item);
            // 兼容旧数据格式
            if (!parsed.version) {
              return {
                state: {
                  preferences: parsed.preferences || []
                },
                version: 1
              };
            }
            return parsed;
          } catch {
            return null;
          }
        },
        setItem: (name: string, value: any) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name: string) => {
          localStorage.removeItem(name);
        }
      },
      partialize: (state) => ({ preferences: state.preferences })
    }
  )
);
