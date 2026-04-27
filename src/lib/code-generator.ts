import { useState } from 'react';

// 重置周期类型
export type ResetPeriod = 'none' | 'monthly' | 'yearly';

// 编码模式
export type CodeMode = 'auto' | 'manual';

// 编码规则接口
export interface CodeRule {
  id: string;
  name: string;
  prefix: string;
  suffix?: string;
  padding: number;
  separator: '-' | '_' | '';
  autoIncrement: boolean;
  resetPeriod: ResetPeriod;
  lastNumber: number;
  lastResetDate?: string;
  accountSetId?: string;
}

// 默认编码规则
const defaultRules: CodeRule[] = [
  {
    id: 'department_rule',
    name: '部门编码',
    prefix: 'DEPT',
    suffix: '',
    padding: 3,
    separator: '-',
    autoIncrement: true,
    resetPeriod: 'none',
    lastNumber: 0
  },
  {
    id: 'subject_rule',
    name: '科目编码',
    prefix: '',
    suffix: '',
    padding: 4,
    separator: '',
    autoIncrement: true,
    resetPeriod: 'none',
    lastNumber: 0
  },
  {
    id: 'project_rule',
    name: '项目编码',
    prefix: 'PRJ',
    suffix: '',
    padding: 3,
    separator: '-',
    autoIncrement: true,
    resetPeriod: 'none',
    lastNumber: 0
  },
  {
    id: 'auxiliary_rule',
    name: '核算项目编码',
    prefix: 'AUX',
    suffix: '',
    padding: 3,
    separator: '-',
    autoIncrement: true,
    resetPeriod: 'none',
    lastNumber: 0
  },
  {
    id: 'fixed_asset_rule',
    name: '固定资产编码',
    prefix: 'FA',
    suffix: '',
    padding: 4,
    separator: '',
    autoIncrement: true,
    resetPeriod: 'none',
    lastNumber: 0
  },
  {
    id: 'intangible_asset_rule',
    name: '无形资产编码',
    prefix: 'IA',
    suffix: '',
    padding: 4,
    separator: '',
    autoIncrement: true,
    resetPeriod: 'none',
    lastNumber: 0
  },
  {
    id: 'prepaid_expense_rule',
    name: '待摊费用编码',
    prefix: 'PE',
    suffix: '',
    padding: 4,
    separator: '',
    autoIncrement: true,
    resetPeriod: 'none',
    lastNumber: 0
  }
];

// 获取当前周期的标识
const getPeriodKey = (resetPeriod: ResetPeriod): string => {
  const now = new Date();
  switch (resetPeriod) {
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    case 'yearly':
      return `${now.getFullYear()}`;
    default:
      return '';
  }
};

// 获取编码中的时间部分（年份/月份）
const getPeriodCode = (resetPeriod: ResetPeriod, separator: string): string => {
  const now = new Date();
  switch (resetPeriod) {
    case 'monthly':
      return `${separator}${now.getFullYear()}${separator}${String(now.getMonth() + 1).padStart(2, '0')}`;
    case 'yearly':
      return `${separator}${now.getFullYear()}`;
    default:
      return '';
  }
};

// 检查是否需要重置编号
const shouldReset = (rule: CodeRule): boolean => {
  if (rule.resetPeriod === 'none') return false;

  const currentPeriod = getPeriodKey(rule.resetPeriod);
  return rule.lastResetDate !== currentPeriod;
};

// 生成编码的工具函数
export const generateCode = (
  rule: CodeRule,
  existingCodes: string[] = []
): { code: string; updatedRule: CodeRule } => {
  let number = rule.lastNumber + 1;

  // 检查是否需要重置
  const needReset = shouldReset(rule);
  if (needReset) {
    number = 1;
  }

  const prefix = rule.prefix || '';
  const suffix = rule.suffix || '';
  const separator = rule.separator || '';
  const periodCode = getPeriodCode(rule.resetPeriod, separator);

  // 如果启用了自动递增，确保编码不重复
  if (rule.autoIncrement) {
    // 构建匹配模式：前缀 + 分隔符 + (年份 + 分隔符 + 月份)? + 分隔符 + 序号 + 后缀
    const periodPattern = rule.resetPeriod === 'monthly'
      ? `\\d{4}${separator}\\d{2}`
      : rule.resetPeriod === 'yearly'
        ? '\\d{4}'
        : '';

    while (existingCodes.some(code => {
      const pattern = new RegExp(`^${prefix}${separator}${periodPattern ? periodPattern + separator : ''}\\d{${rule.padding}}${suffix}$`);
      return pattern.test(code);
    })) {
      number++;
    }
  }

  // 生成编码：前缀 + 时间部分 + 序号
  const code = `${prefix}${periodCode}${separator}${String(number).padStart(rule.padding, '0')}${suffix}`;

  // 更新规则
  const updatedRule: CodeRule = {
    ...rule,
    lastNumber: number,
    lastResetDate: getPeriodKey(rule.resetPeriod) || rule.lastResetDate
  };

  return { code, updatedRule };
};

// 预览编码格式
export const previewCode = (rule: Partial<CodeRule>): string => {
  const prefix = rule.prefix || '';
  const separator = rule.separator || '';
  const padding = rule.padding || 4;
  const suffix = rule.suffix || '';
  const resetPeriod = rule.resetPeriod || 'none';

  // 根据重置周期生成预览（使用当前日期）
  const now = new Date();
  let periodCode = '';
  if (resetPeriod === 'monthly') {
    periodCode = `${separator}${now.getFullYear()}${separator}${String(now.getMonth() + 1).padStart(2, '0')}`;
  } else if (resetPeriod === 'yearly') {
    periodCode = `${separator}${now.getFullYear()}`;
  }

  return `${prefix}${periodCode}${separator}${String(1).padStart(padding, '0')}${suffix}`;
};

// 编码规则管理器
export class CodeRuleManager {
  private static instance: CodeRuleManager;
  private rules: Map<string, CodeRule> = new Map();

  private constructor() {
    defaultRules.forEach(rule => {
      this.rules.set(rule.id, { ...rule });
    });
  }

  static getInstance(): CodeRuleManager {
    if (!CodeRuleManager.instance) {
      CodeRuleManager.instance = new CodeRuleManager();
    }
    return CodeRuleManager.instance;
  }

  getRules(): CodeRule[] {
    return Array.from(this.rules.values());
  }

  getRule(id: string): CodeRule | undefined {
    return this.rules.get(id);
  }

  getRuleByType(type: 'department' | 'subject' | 'project' | 'auxiliary' | 'fixed_asset' | 'intangible_asset' | 'prepaid_expense'): CodeRule {
    const ruleMap: Record<string, string> = {
      department: 'department_rule',
      subject: 'subject_rule',
      project: 'project_rule',
      auxiliary: 'auxiliary_rule',
      fixed_asset: 'fixed_asset_rule',
      intangible_asset: 'intangible_asset_rule',
      prepaid_expense: 'prepaid_expense_rule',
    };
    const ruleId = ruleMap[type];
    return this.rules.get(ruleId) || defaultRules.find(r => r.id === ruleId)!;
  }

  updateRule(id: string, updates: Partial<CodeRule>): void {
    const rule = this.rules.get(id);
    if (rule) {
      this.rules.set(id, { ...rule, ...updates });
    }
  }

  setRule(rule: CodeRule): void {
    this.rules.set(rule.id, rule);
  }

  // 从数据库加载规则
  async loadFromDB(accountSetId: string): Promise<void> {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      sqliteService.setAccountSetId(accountSetId);
      const db = await sqliteService.getDatabase();
      if (!db) return;

      const result = db.exec(
        'SELECT * FROM codeRules WHERE accountSetId = ?',
        [accountSetId]
      );

      if (result[0]?.values?.length) {
        result[0].values.forEach((row: any[]) => {
          const rule: CodeRule = {
            id: row[0],
            name: row[1],
            prefix: row[2],
            suffix: row[3],
            padding: row[4],
            separator: row[5] as '-' | '_' | '',
            autoIncrement: row[6] === 1,
            resetPeriod: row[7] as ResetPeriod,
            lastNumber: row[8],
            lastResetDate: row[9],
            accountSetId: row[10]
          };
          this.rules.set(rule.id, rule);
        });
      }
    } catch (error) {
      console.error('加载编码规则失败:', error);
    }
  }

  // 保存规则到数据库
  async saveToDB(accountSetId: string): Promise<void> {
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      sqliteService.setAccountSetId(accountSetId);
      const db = await sqliteService.getDatabase();
      if (!db) return;

      for (const rule of this.rules.values()) {
        const stmt = db.prepare(
          `INSERT OR REPLACE INTO codeRules (
            id, name, prefix, suffix, padding, separator, auto_inc,
            resetPeriod, lastNumber, lastResetDate, accountSetId
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        );
        stmt.run([
          rule.id, rule.name, rule.prefix, rule.suffix || '', rule.padding,
          rule.separator, rule.autoIncrement ? 1 : 0, rule.resetPeriod,
          rule.lastNumber, rule.lastResetDate || '', accountSetId
        ]);
        stmt.free();
      }
    } catch (error) {
      console.error('保存编码规则失败:', error);
    }
  }

  resetToDefaults(): void {
    this.rules.clear();
    defaultRules.forEach(rule => {
      this.rules.set(rule.id, { ...rule });
    });
  }
}

// 创建自定义Hook用于编码规则管理
export const useCodeRules = () => {
  const [rules, setRules] = useState<CodeRule[]>(() => {
    const manager = CodeRuleManager.getInstance();
    return manager.getRules();
  });

  const manager = CodeRuleManager.getInstance();

  const updateRule = (id: string, updates: Partial<CodeRule>) => {
    manager.updateRule(id, updates);
    setRules(manager.getRules());
  };

  const getRule = (id: string): CodeRule | undefined => {
    return manager.getRule(id);
  };

  const resetToDefaults = () => {
    manager.resetToDefaults();
    setRules(manager.getRules());
  };

  return {
    rules,
    updateRule,
    getRule,
    resetToDefaults
  };
};
