'use client';

import { create } from 'zustand';
import type { BankTransactionRule } from '@/types';

const generateId = () => `rule_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;

// 系统预设规则
const SYSTEM_RULES: Omit<BankTransactionRule, 'accountSetId'>[] = [
  { id: 'sys_001', name: '银行结息', keyword: '结息', subjectCode: '6603', subjectName: '财务费用', direction: 'in', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_002', name: '利息收入', keyword: '利息', subjectCode: '6603', subjectName: '财务费用', direction: 'in', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_003', name: '银行手续费', keyword: '手续费', subjectCode: '660301', subjectName: '手续费', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_004', name: '银行年费', keyword: '年费', subjectCode: '660301', subjectName: '手续费', direction: 'out', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_005', name: '发放工资', keyword: '工资', subjectCode: '2211', subjectName: '应付职工薪酬', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_006', name: '代发薪酬', keyword: '薪酬', subjectCode: '2211', subjectName: '应付职工薪酬', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_007', name: '代发工资', keyword: '代发', subjectCode: '2211', subjectName: '应付职工薪酬', direction: 'out', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_008', name: '社保', keyword: '社保', subjectCode: '2211', subjectName: '应付职工薪酬', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_009', name: '公积金', keyword: '公积金', subjectCode: '2211', subjectName: '应付职工薪酬', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_010', name: '缴税', keyword: '税', subjectCode: '2221', subjectName: '应交税费', direction: 'out', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_011', name: '报销款', keyword: '报销', subjectCode: '6603', subjectName: '管理费用', direction: 'out', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_012', name: '房屋租金', keyword: '租金', subjectCode: '6603', subjectName: '管理费用', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_013', name: '房租', keyword: '房租', subjectCode: '6603', subjectName: '管理费用', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_014', name: '水电费', keyword: '水费', subjectCode: '6603', subjectName: '管理费用', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_015', name: '电费', keyword: '电费', subjectCode: '6603', subjectName: '管理费用', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_016', name: '电话费', keyword: '电话费', subjectCode: '6603', subjectName: '管理费用', direction: 'out', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_017', name: '货款付款', keyword: '货款', subjectCode: '2202', subjectName: '应付账款', direction: 'out', priority: 7, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_018', name: '货款收款', keyword: '货款', subjectCode: '1122', subjectName: '应收账款', direction: 'in', priority: 7, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_019', name: '采购付款', keyword: '采购', subjectCode: '2202', subjectName: '应付账款', direction: 'out', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_020', name: '销售收款', keyword: '销售', subjectCode: '1122', subjectName: '应收账款', direction: 'in', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_021', name: '运费', keyword: '运费', subjectCode: '6603', subjectName: '管理费用', direction: 'out', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_022', name: '退款', keyword: '退款', subjectCode: '1122', subjectName: '应收账款', direction: 'in', priority: 7, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  // ⚠️ 关键词精化为「转账手续费」「汇款手续费」整词，避免误伤摘要里的渠道词
  // （电子转账 / 跨行转账 / 网银汇款 等），那种交易并非手续费。
  // 真正的手续费由「手续费」规则（sys_003）兜底；此处仅保留精确整词命中。
  { id: 'sys_023', name: '转账手续费', keyword: '转账手续费', subjectCode: '6603', subjectName: '财务费用', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_024', name: '汇款手续费', keyword: '汇款手续费', subjectCode: '6603', subjectName: '财务费用', direction: 'out', priority: 9, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_025', name: '跨行转账', keyword: '跨行', subjectCode: '6603', subjectName: '财务费用', direction: 'out', priority: 8, enabled: true, isSystem: true, createTime: '', updateTime: '' },
  { id: 'sys_026', name: '印花税', keyword: '印花税', subjectCode: '2221', subjectName: '应交税费', direction: 'out', priority: 10, enabled: true, isSystem: true, createTime: '', updateTime: '' },
];

interface BankRuleStore {
  rules: BankTransactionRule[];
  loading: boolean;

  // Actions
  initialize: () => Promise<void>;
  addRule: (rule: Omit<BankTransactionRule, 'id' | 'isSystem' | 'createTime' | 'updateTime'>) => Promise<void>;
  updateRule: (id: string, updates: Partial<BankTransactionRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
  getEnabledRules: () => BankTransactionRule[];
}

export const useBankRuleStore = create<BankRuleStore>((set, get) => ({
  rules: [],
  loading: false,

  initialize: async () => {
    set({ loading: true });
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      await sqliteService.getDatabase();

      // 确保 accountSetId 已设置
      const { useAccountSetStore } = await import('./useAccountSetStore');
      const accountSetId = useAccountSetStore.getState().currentAccountSetId;
      if (accountSetId) {
        sqliteService.setAccountSetId(accountSetId);
      }

      const db = await sqliteService.getDatabase();
      if (!db) { set({ loading: false }); return; }

      // 读取已有规则
      const stmt = db.prepare('SELECT * FROM bankTransactionRules WHERE tenantId = ? AND accountSetId = ? ORDER BY priority DESC');
      stmt.bind([sqliteService.tenantId, sqliteService.accountSetId]);
      const existingRules: BankTransactionRule[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, string | number | Uint8Array | null>;
        existingRules.push({
          id: String(row.id ?? ''),
          accountSetId: row.accountSetId != null ? String(row.accountSetId) : undefined,
          name: String(row.name ?? ''),
          keyword: String(row.keyword ?? ''),
          subjectCode: String(row.subjectCode ?? ''),
          subjectName: String(row.subjectName ?? ''),
          direction: String(row.direction ?? '') as BankTransactionRule['direction'],
          priority: Number(row.priority ?? 0),
          enabled: row.enabled === 1,
          isSystem: row.isSystem === 1,
          createTime: String(row.createTime ?? ''),
          updateTime: String(row.updateTime ?? ''),
        });
      }
      stmt.free();

      // 如果没有规则，初始化系统预设
      if (existingRules.length === 0) {
        const now = new Date().toISOString();
        const systemRules: BankTransactionRule[] = SYSTEM_RULES.map(r => ({
          ...r,
          accountSetId: sqliteService.accountSetId,
          createTime: now,
          updateTime: now,
        }));

        for (const rule of systemRules) {
          const insertStmt = db.prepare(`
            INSERT INTO bankTransactionRules (id, name, keyword, subjectCode, subjectName, direction, priority, enabled, isSystem, tenantId, accountSetId, createTime, updateTime)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertStmt.run([rule.id, rule.name, rule.keyword, rule.subjectCode, rule.subjectName, rule.direction, rule.priority, 1, 1, sqliteService.tenantId, rule.accountSetId, rule.createTime, rule.updateTime]);
          insertStmt.free();
        }

        set({ rules: systemRules, loading: false });
      } else {
        set({ rules: existingRules, loading: false });
      }
    } catch (error) {
      console.error('Initialize bank rules failed:', error);
      set({ loading: false });
    }
  },

  addRule: async (ruleData) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      if (!db) return;

      const now = new Date().toISOString();
      const rule: BankTransactionRule = {
        ...ruleData,
        id: generateId(),
        isSystem: false,
        accountSetId: sqliteService.accountSetId,
        createTime: now,
        updateTime: now,
      };

      const stmt = db.prepare(`
        INSERT INTO bankTransactionRules (id, name, keyword, subjectCode, subjectName, direction, priority, enabled, isSystem, tenantId, accountSetId, createTime, updateTime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([rule.id, rule.name, rule.keyword, rule.subjectCode, rule.subjectName, rule.direction, rule.priority, rule.enabled ? 1 : 0, 0, sqliteService.tenantId, rule.accountSetId, rule.createTime, rule.updateTime]);
      stmt.free();

      set(state => ({ rules: [...state.rules, rule] }));
    } catch (error) {
      console.error('Add bank rule failed:', error);
    }
  },

  updateRule: async (id, updates) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      if (!db) return;

      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: Array<string | number | null> = [];

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'accountSetId') continue;
        if (key === 'enabled' || key === 'isSystem') {
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else if (typeof value === 'string' || typeof value === 'number') {
          fields.push(`${key} = ?`);
          values.push(value);
        } else {
          fields.push(`${key} = ?`);
          values.push(null);
        }
      }

      fields.push('updateTime = ?');
      values.push(now);
      values.push(id);
      values.push(sqliteService.tenantId);
      values.push(sqliteService.accountSetId);

      const stmt = db.prepare(`UPDATE bankTransactionRules SET ${fields.join(', ')} WHERE id = ? AND tenantId = ? AND accountSetId = ?`);
      stmt.run(values);
      stmt.free();

      set(state => ({
        rules: state.rules.map(r => r.id === id ? { ...r, ...updates, updateTime: now } : r),
      }));
    } catch (error) {
      console.error('Update bank rule failed:', error);
    }
  },

  deleteRule: async (id) => {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      if (!db) return;

      const stmt = db.prepare('DELETE FROM bankTransactionRules WHERE id = ? AND tenantId = ? AND accountSetId = ? AND isSystem = 0');
      stmt.run([id, sqliteService.tenantId, sqliteService.accountSetId]);
      stmt.free();

      set(state => ({ rules: state.rules.filter(r => r.id !== id) }));
    } catch (error) {
      console.error('Delete bank rule failed:', error);
    }
  },

  toggleRule: async (id) => {
    const rule = get().rules.find(r => r.id === id);
    if (!rule) return;
    await get().updateRule(id, { enabled: !rule.enabled });
  },

  getEnabledRules: () => {
    return get().rules.filter(r => r.enabled).sort((a, b) => b.priority - a.priority);
  },
}));
