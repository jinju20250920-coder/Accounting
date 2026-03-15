import { create } from 'zustand';
import { DATA_VERSIONS } from './persistence-config';

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
  getSmartMatch: (summary: string, subjects?: Array<{ code: string; name: string }>) => SmartMatchResult | null;
  getPreferencesBySubject: (subject: string) => Preference[];
  updatePreferenceSuccess: (id: string, success: boolean) => void;
  clearPreferences: () => void;
  getStatistics: () => {
    totalMatches: number;
    successRate: number;
    mostUsedSubjects: Array<{ subject: string; count: number }>;
    recentMatches: Array<{ summary: string; subject: string; timestamp: number }>;
  };

  // 数据管理
  exportPreferences: () => string;
  importPreferences: (data: string) => boolean;
  cleanupOldPreferences: (days: number) => void;
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

// 数据迁移配置
const migrations = {
  [DATA_VERSIONS.V1 + 1]: migrateV1ToV2
};

export const useUserPreferenceStore = create<PreferenceStore>()((set, get) => ({
  preferences: [],

  // 保存用户偏好
  savePreference: (summary, subject, subjectName) => {
    const state = get();
    const timestamp = Date.now();

    set((prevState) => {
      // 检查是否已存在相似的摘要
      const existingIndex = prevState.preferences.findIndex(
        pref =>
          pref.summary === summary &&
          pref.subject === subject
      );

      if (existingIndex >= 0) {
        // 更新现有偏好的匹配次数
        const updated = [...prevState.preferences];
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
          preferences: [newPreference, ...prevState.preferences].slice(0, 50)
        };
      }
    });
  },

  // 获取智能匹配结果
  getSmartMatch: (summary, subjects = []) => {
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
    try {
      const rules = require('@/lib/data/keyword-rules.json');
      const l1Match = rules.find((rule: any) =>
        summary.includes(rule.keyword) ||
        rule.keyword.includes(summary)
      );

      if (l1Match) {
        // 从科目数据中查找科目名称，而不是只从用户偏好中查找
        const subjectName = subjects.find(s => s.code === l1Match.subject)?.name ||
                          state.preferences.find(p => p.subject === l1Match.subject)?.subjectName;

        return {
          subject: l1Match.subject,
          subjectName,
          source: 'rule' as const,
          confidence: 0.6
        };
      }
    } catch (error) {
      console.warn('Failed to load keyword rules:', error);
    }

    // 3. 无匹配
    return null;
  },

  // 根据科目获取偏好
  getPreferencesBySubject: (subject) => {
    const state = get();
    return state.preferences.filter(pref => pref.subject === subject);
  },

  // 更新匹配成功状态
  updatePreferenceSuccess: (id, success) => {
    set((prevState) => {
      const index = prevState.preferences.findIndex(p => p.id === id);
      if (index >= 0) {
        const updated = [...prevState.preferences];
        const pref = updated[index];

        // 更新成功率和匹配次数
        updated[index] = {
          ...pref,
          successRate: (pref.successRate * pref.matchedCount + (success ? 1 : 0)) / (pref.matchedCount + 1),
          matchedCount: pref.matchedCount + 1,
          timestamp: Date.now()
        };

        return { preferences: updated };
      }
      return prevState;
    });
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

    // 最近匹配
    const recentMatches = state.preferences
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(pref => ({
        summary: pref.summary,
        subject: pref.subject,
        timestamp: pref.timestamp
      }));

    return {
      totalMatches,
      successRate,
      mostUsedSubjects,
      recentMatches
    };
  },

  // 导出偏好数据
  exportPreferences: () => {
    const state = get();
    return JSON.stringify({
      version: DATA_VERSIONS.CURRENT,
      preferences: state.preferences,
      exportTime: new Date().toISOString()
    }, null, 2);
  },

  // 导入偏好数据
  importPreferences: (data) => {
    try {
      const parsed = JSON.parse(data);

      // 验证数据格式
      if (!parsed.preferences || !Array.isArray(parsed.preferences)) {
        throw new Error('Invalid preference data format');
      }

      // 更新时间戳
      const updatedPreferences = parsed.preferences.map((pref: any) => ({
        ...pref,
        id: `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        matchedCount: pref.matchedCount || 1,
        successRate: pref.successRate || 1.0
      }));

      set({
        preferences: [...get().preferences, ...updatedPreferences].slice(0, 100) // 最多保留100条
      });

      return true;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  },

  // 清理旧偏好数据
  cleanupOldPreferences: (days) => {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    set((prevState) => ({
      preferences: prevState.preferences.filter(p => p.timestamp > cutoffDate)
    }));
  }
}));