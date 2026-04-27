import { useState } from 'react';

// 编码规则接口
export interface CodeRule {
  id: string;
  name: string;
  prefix: string;
  suffix?: string;
  padding: number;
  separator: '-' | '_' | '';
  autoIncrement: boolean;
  lastNumber: number;
}

// 默认编码规则
const defaultRules: CodeRule[] = [
  {
    id: 'dept_rule_1',
    name: '部门编码',
    prefix: 'DEPT',
    suffix: '',
    padding: 3,
    separator: '-',
    autoIncrement: true,
    lastNumber: 0
  },
  {
    id: 'subject_rule_1',
    name: '科目编码',
    prefix: '',
    suffix: '',
    padding: 4,
    separator: '',
    autoIncrement: true,
    lastNumber: 0
  },
  {
    id: 'project_rule_1',
    name: '项目编码',
    prefix: 'PRJ',
    suffix: '',
    padding: 3,
    separator: '-',
    autoIncrement: true,
    lastNumber: 0
  },
  {
    id: 'auxiliary_rule_1',
    name: '核算项目编码',
    prefix: 'AUX',
    suffix: '',
    padding: 3,
    separator: '-',
    autoIncrement: true,
    lastNumber: 0
  },
  {
    id: 'fixed_asset_rule_1',
    name: '固定资产编码',
    prefix: 'FA',
    suffix: '',
    padding: 4,
    separator: '',
    autoIncrement: true,
    lastNumber: 0
  },
  {
    id: 'intangible_asset_rule_1',
    name: '无形资产编码',
    prefix: 'IA',
    suffix: '',
    padding: 4,
    separator: '',
    autoIncrement: true,
    lastNumber: 0
  },
  {
    id: 'prepaid_expense_rule_1',
    name: '待摊费用编码',
    prefix: 'PE',
    suffix: '',
    padding: 4,
    separator: '',
    autoIncrement: true,
    lastNumber: 0
  }
];

// 生成编码的工具函数
export const generateCode = (
  rule: CodeRule,
  existingCodes: string[] = []
): string => {
  let number = rule.lastNumber + 1;

  // 如果启用了自动递增，确保编码不重复
  if (rule.autoIncrement) {
    while (existingCodes.includes(`${rule.prefix}${rule.separator}${String(number).padStart(rule.padding, '0')}${rule.suffix}`)) {
      number++;
    }
  }

  // 更新规则的最后编号
  rule.lastNumber = number;

  // 生成编码
  return `${rule.prefix}${rule.separator}${String(number).padStart(rule.padding, '0')}${rule.suffix}`;
};

// 编码规则管理器
export class CodeRuleManager {
  private static instance: CodeRuleManager;
  private rules: Map<string, CodeRule> = new Map();

  private constructor() {
    // 初始化默认规则
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

  // 获取所有规则
  getRules(): CodeRule[] {
    return Array.from(this.rules.values());
  }

  // 根据ID获取规则
  getRule(id: string): CodeRule | undefined {
    return this.rules.get(id);
  }

  // 根据类型获取规则
  getRuleByType(type: 'department' | 'subject' | 'project' | 'auxiliary' | 'fixed_asset' | 'intangible_asset' | 'prepaid_expense'): CodeRule {
    switch (type) {
      case 'department':
        return this.rules.get('dept_rule_1') || defaultRules[0];
      case 'subject':
        return this.rules.get('subject_rule_1') || defaultRules[1];
      case 'project':
        return this.rules.get('project_rule_1') || defaultRules[2];
      case 'auxiliary':
        return this.rules.get('auxiliary_rule_1') || defaultRules[3];
      case 'fixed_asset':
        return this.rules.get('fixed_asset_rule_1') || defaultRules[4];
      case 'intangible_asset':
        return this.rules.get('intangible_asset_rule_1') || defaultRules[5];
      case 'prepaid_expense':
        return this.rules.get('prepaid_expense_rule_1') || defaultRules[6];
      default:
        throw new Error(`未知的编码类型: ${type}`);
    }
  }

  // 更新规则
  updateRule(id: string, updates: Partial<CodeRule>): void {
    const rule = this.rules.get(id);
    if (rule) {
      this.rules.set(id, { ...rule, ...updates });
    }
  }

  // 创建新规则
  createRule(rule: CodeRule): void {
    this.rules.set(rule.id, rule);
  }

  // 删除规则
  deleteRule(id: string): void {
    this.rules.delete(id);
  }

  // 从localStorage加载规则
  loadRules(): void {
    // 检查是否在浏览器环境
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = localStorage.getItem('codeRules');
      if (stored) {
        const rules = JSON.parse(stored);
        rules.forEach((rule: CodeRule) => {
          this.rules.set(rule.id, rule);
        });
      }
    } catch (error) {
      console.error('加载编码规则失败:', error);
    }
  }

  // 保存规则到localStorage
  saveRules(): void {
    // 检查是否在浏览器环境
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const rules = Array.from(this.rules.values());
      localStorage.setItem('codeRules', JSON.stringify(rules));
    } catch (error) {
      console.error('保存编码规则失败:', error);
    }
  }

  // 重置规则为默认值
  resetToDefaults(): void {
    this.rules.clear();
    defaultRules.forEach(rule => {
      this.rules.set(rule.id, { ...rule });
    });
    this.saveRules();
  }
}

// 创建自定义Hook用于编码规则管理
export const useCodeRules = () => {
  const [rules, setRules] = useState<CodeRule[]>(() => {
    const manager = CodeRuleManager.getInstance();
    manager.loadRules();
    return manager.getRules();
  });

  const manager = CodeRuleManager.getInstance();

  const updateRule = (id: string, updates: Partial<CodeRule>) => {
    manager.updateRule(id, updates);
    manager.saveRules();
    setRules(manager.getRules());
  };

  const createRule = (rule: CodeRule) => {
    manager.createRule(rule);
    manager.saveRules();
    setRules(manager.getRules());
  };

  const deleteRule = (id: string) => {
    manager.deleteRule(id);
    manager.saveRules();
    setRules(manager.getRules());
  };

  const resetToDefaults = () => {
    manager.resetToDefaults();
    setRules(manager.getRules());
  };

  return {
    rules,
    updateRule,
    createRule,
    deleteRule,
    resetToDefaults
  };
};