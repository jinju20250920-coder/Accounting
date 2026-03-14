import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createVersionedStorage, DATA_VERSIONS, STORAGE_KEYS } from './persistence-config';

// 操作类型枚举
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  POST = 'post',
  REVERSE = 'reverse',
  IMPORT = 'import',
  EXPORT = 'export',
  LOGIN = 'login',
  LOGOUT = 'logout'
}

// 凭证状态枚举
enum VoucherStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  POSTED = 'posted',
  REVERSED = 'reversed'
}

// 审计记录接口
interface AuditRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  operation: OperationType;
  entityType: 'voucher' | 'subject' | 'account_set' | 'template' | 'system';
  entityId: string;
  entityName?: string;
  details: any;
  oldValue?: any;
  newValue?: any;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}

// 审计查询条件
interface AuditQuery {
  operation?: OperationType;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

// 审计统计
interface AuditStats {
  totalOperations: number;
  successRate: number;
  dailyOperations: Array<{ date: string; count: number }>;
  operationTypes: Array<{ type: OperationType; count: number }>;
  topUsers: Array<{ userId: string; userName: string; count: number }>;
}

// 审计Store
interface AuditStore {
  records: AuditRecord[];
  settings: {
    maxRecords: number;
    retentionDays: number;
    enableExport: boolean;
  };

  // Actions
  addRecord: (record: Omit<AuditRecord, 'id'>) => void;
  getRecords: (query?: AuditQuery) => AuditRecord[];
  getRecordById: (id: string) => AuditRecord | undefined;
  getVoucherHistory: (voucherId: string) => AuditRecord[];
  getStatistics: (dateRange?: { start: string; end: string }) => AuditStats;
  clearRecords: (beforeDate?: string) => void;
  exportAuditLog: (format: 'csv' | 'json') => string;

  // 数据管理
  updateSettings: (settings: Partial<AuditStore['settings']>) => void;
  cleanupExpiredRecords: () => void;
  searchRecords: (keyword: string) => AuditRecord[];
  getRecentActivity: (limit?: number) => AuditRecord[];
}

// 迁移函数
const migrateV1ToV2 = (state: any) => {
  if (!state.records) return state;

  // 添加result字段到所有记录
  const migratedRecords = state.records.map((record: any) => ({
    ...record,
    result: record.result || 'success'
  }));

  return {
    ...state,
    records: migratedRecords,
    version: DATA_VERSIONS.V2
  };
};

export const useAuditStore = create<AuditStore>()(
  persist(
    (set, get) => ({
      records: [],
      settings: {
        maxRecords: 5000,
        retentionDays: 365,
        enableExport: true
      },

      // 添加审计记录
      addRecord: (record) => {
        const auditRecord: AuditRecord = {
          ...record,
          id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          ipAddress: '127.0.0.1', // 实际应用中应该获取真实IP
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        };

        set((state) => ({
          records: [auditRecord, ...state.records].slice(0, 5000) // 最多保留5000条记录
        }));
      },

      // 获取审计记录
      getRecords: (query) => {
        const state = get();
        let filtered = [...state.records];

        if (query) {
          if (query.operation) {
            filtered = filtered.filter(r => r.operation === query.operation);
          }
          if (query.entityType) {
            filtered = filtered.filter(r => r.entityType === query.entityType);
          }
          if (query.userId) {
            filtered = filtered.filter(r => r.userId === query.userId);
          }
          if (query.startDate) {
            filtered = filtered.filter(r => r.timestamp >= query.startDate!);
          }
          if (query.endDate) {
            filtered = filtered.filter(r => r.timestamp <= query.endDate!);
          }
          if (query.keyword) {
            const keyword = query.keyword.toLowerCase();
            filtered = filtered.filter(r =>
              r.entityName?.toLowerCase().includes(keyword) ||
              r.details.summary?.toLowerCase().includes(keyword) ||
              r.details.voucherNo?.toLowerCase().includes(keyword)
            );
          }
        }

        return filtered;
      },

      // 根据ID获取记录
      getRecordById: (id) => {
        const state = get();
        return state.records.find(r => r.id === id);
      },

      // 获取凭证历史
      getVoucherHistory: (voucherId) => {
        const state = get();
        return state.records.filter(r =>
          r.entityType === 'voucher' && r.entityId === voucherId
        ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      // 获取审计统计
      getStatistics: (dateRange) => {
        const state = get();
        let records = state.records;

        // 根据日期范围过滤
        if (dateRange) {
          records = records.filter(r =>
            r.timestamp >= dateRange.start && r.timestamp <= dateRange.end
          );
        }

        // 总操作数
        const totalOperations = records.length;

        // 成功率
        const successCount = records.filter(r => r.result === 'success').length;
        const successRate = totalOperations > 0 ? successCount / totalOperations : 0;

        // 每日操作统计
        const dailyMap = new Map<string, number>();
        records.forEach(r => {
          const date = r.timestamp.split('T')[0];
          dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
        });
        const dailyOperations = Array.from(dailyMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // 操作类型统计
        const typeMap = new Map<OperationType, number>();
        records.forEach(r => {
          typeMap.set(r.operation, (typeMap.get(r.operation) || 0) + 1);
        });
        const operationTypes = Array.from(typeMap.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count);

        // 用户操作统计
        const userMap = new Map<string, { userId: string; userName: string; count: number }>();
        records.forEach(r => {
          const existing = userMap.get(r.userId);
          if (existing) {
            existing.count += 1;
          } else {
            userMap.set(r.userId, {
              userId: r.userId,
              userName: r.userName,
              count: 1
            });
          }
        });
        const topUsers = Array.from(userMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return {
          totalOperations,
          successRate,
          dailyOperations,
          operationTypes,
          topUsers
        };
      },

      // 清理审计记录
      clearRecords: (beforeDate) => {
        if (beforeDate) {
          set((state) => ({
            records: state.records.filter(r => r.timestamp >= beforeDate)
          }));
        } else {
          set({ records: [] });
        }
      },

      // 导出审计日志
      exportAuditLog: (format) => {
        const state = get();

        if (format === 'json') {
          return JSON.stringify(state.records, null, 2);
        } else if (format === 'csv') {
          const headers = [
            '时间', '用户', '操作', '实体类型', '实体ID',
            '实体名称', '结果', '错误信息'
          ];

          const rows = state.records.map(r => [
            r.timestamp,
            r.userName,
            r.operation,
            r.entityType,
            r.entityId,
            r.entityName || '',
            r.result,
            r.errorMessage || ''
          ]);

          const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

          return csvContent;
        }

        return '';
      },

      // 数据管理
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),

      cleanupExpiredRecords: () => {
        const state = get();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - state.settings.retentionDays);
        const cutoffDateString = cutoffDate.toISOString();

        set((prevState) => ({
          records: state.records
            .filter(r => r.timestamp >= cutoffDateString)
            .slice(0, state.settings.maxRecords)
        }));
      },

      searchRecords: (keyword) => {
        const state = get();
        return state.records.filter(r =>
          r.entityName?.toLowerCase().includes(keyword.toLowerCase()) ||
          r.details.summary?.toLowerCase().includes(keyword.toLowerCase()) ||
          r.details.voucherNo?.toLowerCase().includes(keyword.toLowerCase()) ||
          r.userName.toLowerCase().includes(keyword.toLowerCase())
        );
      },

      getRecentActivity: (limit = 10) => {
        const state = get();
        return state.records.slice(0, limit);
      }
    }),
    {
      name: 'finance-audit',
      partialize: (state) => ({
        records: state.records.slice(0, 5000),
        settings: state.settings
      }),
      migrate: (state, version) => {
        if (version < DATA_VERSIONS.V2) {
          return migrateV1ToV2(state);
        }
        return state;
      }
    }
  )
);

// 便捷函数：记录凭证操作
export function logVoucherAction(
  voucherId: string,
  voucherNo: string,
  operation: OperationType,
  details: any,
  result: 'success' | 'failed' = 'success',
  errorMessage?: string,
  userId = 'current_user',
  userName = '当前用户'
) {
  useAuditStore.getState().addRecord({
    userId,
    userName,
    operation,
    entityType: 'voucher',
    entityId: voucherId,
    entityName: `凭证${voucherNo}`,
    details,
    result,
    errorMessage: errorMessage || '',
    timestamp: new Date().toISOString(),
    ipAddress: '127.0.0.1',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  });
}

// 便捷函数：记录登录
export function logLogin(userId: string, userName: string, success: boolean) {
  useAuditStore.getState().addRecord({
    userId,
    userName,
    operation: OperationType.LOGIN,
    entityType: 'system',
    entityId: 'login',
    details: { timestamp: new Date().toISOString() },
    result: success ? 'success' : 'failed',
    timestamp: new Date().toISOString(),
    ipAddress: '127.0.0.1',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  });
}

// 便捷函数：记录导出
export function logExport(type: 'voucher' | 'report', format: 'excel' | 'pdf' | 'csv') {
  useAuditStore.getState().addRecord({
    userId: 'current_user',
    userName: '当前用户',
    operation: OperationType.EXPORT,
    entityType: type === 'voucher' ? 'voucher' : 'system',
    entityId: `export_${Date.now()}`,
    details: { format, timestamp: new Date().toISOString() },
    result: 'success',
    timestamp: new Date().toISOString(),
    ipAddress: '127.0.0.1',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  });
}

export { OperationType };