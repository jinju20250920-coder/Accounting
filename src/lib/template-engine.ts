/**
 * 自动化模板引擎 - 基于模板自动生成凭证
 * 核心思路：模板驱动 + 公式解释器
 */

// 模板类型定义
export interface VoucherTemplate {
  id: string;
  name: string;
  triggerType: string; // 触发类型：'invoice_import', 'bank_statement', 'tax_statement' 等
  invoiceType?: 'input' | 'output'; // 发票类型（用于发票模板）
  description?: string;
  isSystem: boolean; // 系统内置模板不可修改
  entries: TemplateEntry[];
  validations: TemplateValidation[];
  variables: VariableDefinition[];
}

// 模板分录定义
export interface TemplateEntry {
  id: string;
  subject: string;
  subjectName?: string;
  direction: 'debit' | 'credit';
  formula: string; // 公式表达式，如：{total_amount}, {total_amount} * 0.13, {tax_amount}
  description?: string;
  isDynamic?: boolean; // 是否动态科目（基于变量计算）
}

// 模板验证规则
export interface TemplateValidation {
  field: string;
  condition: string; // 如：'required', 'mustExist', 'numeric'
  message: string;
}

// 变量定义
export interface VariableDefinition {
  name: string;
  type: 'number' | 'string' | 'date';
  source: 'extracted' | 'calculated' | 'constant';
  description?: string;
  defaultValue?: any;
}

// 输入数据
export interface InputData {
  [key: string]: any;
  total_amount?: number;
  tax_amount?: number;
  base_amount?: number;
  partner_name?: string;
  invoice_date?: string;
  invoice_no?: string;
  // ...其他字段
}

// 公式解释器
export class FormulaInterpreter {
  /**
   * 计算公式值
   */
  static evaluate(formula: string, data: InputData): number {
    if (!formula || formula.trim() === '') {
      return 0;
    }

    // 移除公式的大括号
    const expression = formula.replace(/[{}]/g, '').trim();

    // 如果是纯数字，直接返回
    if (/^\d+(\.\d+)?$/.test(expression)) {
      return parseFloat(expression);
    }

    // 检查是否包含变量
    const variables = expression.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);

    if (!variables) {
      // 尝试直接计算表达式
      try {
        return this.safeEval(expression, data);
      } catch {
        return 0;
      }
    }

    // 替换变量为实际值
    let finalExpression = expression;
    for (const variable of variables) {
      const value = data[variable];
      if (value === undefined || value === null) {
        return 0;
      }
      finalExpression = finalExpression.replace(
        new RegExp(`\\b${variable}\\b`, 'g'),
        value.toString()
      );
    }

    // 计算最终表达式
    try {
      return this.safeEval(finalExpression, data);
    } catch {
      return 0;
    }
  }

  /**
   * 安全计算表达式
   */
  private static safeEval(expression: string, data: InputData): number {
    // 创建安全的计算环境
    const allowedOperators = ['+', '-', '*', '/', '(', ')', 'Math.abs'];
    const cleaned = expression.replace(/[^0-9+\-*/().\s]/g, '');

    // 使用Function构造函数进行计算
    try {
      return new Function('data', `
        "use strict";
        const Math = globalThis.Math;
        return ${cleaned};
      `)(data);
    } catch {
      return 0;
    }
  }

  /**
   * 提取公式中的变量
   */
  static extractVariables(formula: string): string[] {
    const matches = formula.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return matches.map(match => match.slice(1, -1));
  }
}

// 自动化模板引擎
export class TemplateEngine {
  private templates: VoucherTemplate[] = [];

  constructor() {
    this.loadDefaultTemplates();
  }

  /**
   * 加载默认模板
   */
  private loadDefaultTemplates(): void {
    this.templates = [
      {
        id: 'tpl_sale_invoice',
        name: '销售发票确认收入',
        triggerType: 'invoice_import',
        invoiceType: 'output',
        isSystem: true,
        description: '销售发票自动生成收入凭证',
        variables: [
          {
            name: 'total_amount',
            type: 'number',
            source: 'extracted',
            description: '发票总金额'
          },
          {
            name: 'tax_amount',
            type: 'number',
            source: 'extracted',
            description: '税额'
          },
          {
            name: 'base_amount',
            type: 'number',
            source: 'calculated',
            description: '不含税金额',
            defaultValue: (data) => data.total_amount - data.tax_amount
          }
        ],
        validations: [
          {
            field: 'total_amount',
            condition: 'required',
            message: '发票总金额不能为空'
          },
          {
            field: 'partner_name',
            condition: 'required',
            message: '客户名称不能为空'
          }
        ],
        entries: [
          {
            id: 'entry_1',
            subject: '1122',
            subjectName: '应收账款',
            direction: 'debit',
            formula: '{total_amount}',
            description: '应收账款'
          },
          {
            id: 'entry_2',
            subject: '6001',
            subjectName: '主营业务收入',
            direction: 'credit',
            formula: '{base_amount}',
            description: '确认收入'
          },
          {
            id: 'entry_3',
            subject: '222101',
            subjectName: '应交税费-增值税-销项税额',
            direction: 'credit',
            formula: '{tax_amount}',
            description: '销项税额'
          }
        ]
      },
      {
        id: 'tpl_purchase_invoice',
        name: '采购发票确认成本',
        triggerType: 'invoice_import',
        invoiceType: 'input',
        isSystem: true,
        description: '采购发票自动生成成本凭证',
        variables: [
          {
            name: 'total_amount',
            type: 'number',
            source: 'extracted',
            description: '发票总金额'
          },
          {
            name: 'tax_amount',
            type: 'number',
            source: 'extracted',
            description: '税额'
          },
          {
            name: 'base_amount',
            type: 'number',
            source: 'calculated',
            description: '不含税金额',
            defaultValue: (data) => data.total_amount - data.tax_amount
          }
        ],
        validations: [
          {
            field: 'total_amount',
            condition: 'required',
            message: '发票总金额不能为空'
          },
          {
            field: 'partner_name',
            condition: 'required',
            message: '供应商名称不能为空'
          }
        ],
        entries: [
          {
            id: 'entry_1',
            subject: '1401',
            subjectName: '材料采购',
            direction: 'debit',
            formula: '{base_amount}',
            description: '材料采购'
          },
          {
            id: 'entry_2',
            subject: '222101',
            subjectName: '应交税费-增值税-进项税额',
            direction: 'debit',
            formula: '{tax_amount}',
            description: '进项税额'
          },
          {
            id: 'entry_3',
            subject: '2202',
            subjectName: '应付账款',
            direction: 'credit',
            formula: '{total_amount}',
            description: '应付账款'
          }
        ]
      },
      {
        id: 'tpl_bank_deposit',
        name: '银行收款',
        triggerType: 'bank_statement',
        isSystem: true,
        description: '银行收款自动生成凭证',
        variables: [
          {
            name: 'amount',
            type: 'number',
            source: 'extracted',
            description: '收款金额'
          },
          {
            name: 'counterparty',
            type: 'string',
            source: 'extracted',
            description: '对方单位'
          }
        ],
        validations: [
          {
            field: 'amount',
            condition: 'required',
            message: '金额不能为空'
          }
        ],
        entries: [
          {
            id: 'entry_1',
            subject: '1002',
            subjectName: '银行存款',
            direction: 'debit',
            formula: '{amount}',
            description: '银行收款'
          }
        ]
      },
      {
        id: 'tpl_bank_payment',
        name: '银行付款',
        triggerType: 'bank_statement',
        isSystem: true,
        description: '银行付款自动生成凭证',
        variables: [
          {
            name: 'amount',
            type: 'number',
            source: 'extracted',
            description: '付款金额'
          },
          {
            name: 'counterparty',
            type: 'string',
            source: 'extracted',
            description: '对方单位'
          }
        ],
        validations: [
          {
            field: 'amount',
            condition: 'required',
            message: '金额不能为空'
          }
        ],
        entries: [
          {
            id: 'entry_1',
            subject: '6603',
            subjectName: '管理费用',
            direction: 'debit',
            formula: '{amount}',
            description: '银行付款'
          },
          {
            id: 'entry_2',
            subject: '1002',
            subjectName: '银行存款',
            direction: 'credit',
            formula: '{amount}',
            description: '银行付款'
          }
        ]
      }
    ];
  }

  /**
   * 获取所有模板
   */
  getTemplates(): VoucherTemplate[] {
    return [...this.templates];
  }

  /**
   * 根据触发类型获取模板
   */
  getTemplatesByTrigger(triggerType: string): VoucherTemplate[] {
    return this.templates.filter(template => template.triggerType === triggerType);
  }

  /**
   * 根据ID获取模板
   */
  getTemplateById(id: string): VoucherTemplate | undefined {
    return this.templates.find(template => template.id === id);
  }

  /**
   * 生成凭证（支持科目覆盖）
   * subjectOverrides: key = entry.id, value = { code, name }
   */
  generateVoucherWithOverrides(
    templateId: string,
    inputData: InputData,
    subjectOverrides?: Record<string, { code: string; name: string }>
  ): {
    success: boolean;
    voucher?: any;
    errors?: string[];
    warnings?: string[];
  } {
    const template = this.getTemplateById(templateId);
    if (!template) {
      return { success: false, errors: ['模板不存在'] };
    }

    // 验证输入数据
    const validationResult = this.validateInput(template, inputData);
    if (!validationResult.valid) {
      return { success: false, errors: validationResult.errors };
    }

    // 计算分录（应用科目覆盖）
    const entries = this.calculateEntries(template, inputData, subjectOverrides);

    // 检查借贷是否平衡，不平衡时自动调整（如跳过税金分录后贷方需调整）
    let totalDebit = entries
      .filter(e => e.direction === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);
    let totalCredit = entries
      .filter(e => e.direction === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      // 调整金额较小的一侧，使其与较大侧平衡
      if (totalDebit > totalCredit) {
        // 借方大，调整贷方最后一个分录
        const creditEntries = entries.filter(e => e.direction === 'credit');
        if (creditEntries.length > 0) {
          const lastCredit = creditEntries[creditEntries.length - 1];
          lastCredit.amount = Math.round((lastCredit.amount + (totalDebit - totalCredit)) * 100) / 100;
          totalCredit = totalDebit;
        }
      } else {
        // 贷方大，调整借方最后一个分录
        const debitEntries = entries.filter(e => e.direction === 'debit');
        if (debitEntries.length > 0) {
          const lastDebit = debitEntries[debitEntries.length - 1];
          lastDebit.amount = Math.round((lastDebit.amount + (totalCredit - totalDebit)) * 100) / 100;
          totalDebit = totalCredit;
        }
      }
    }

    const partnerName = inputData.partner_name || '';
    const voucherDate = inputData.invoice_date || new Date().toISOString().split('T')[0];

    const voucher = {
      id: generateId(),
      voucherNo: `自动-${Date.now()}`,
      date: voucherDate,
      summary: template.name,
      entries: entries.map(entry => ({
        id: generateId(),
        voucherId: '',
        date: voucherDate,
        summary: entry.description,
        subjectCode: entry.subject,
        subjectName: entry.subjectName,
        debit: entry.direction === 'debit' ? entry.amount : 0,
        credit: entry.direction === 'credit' ? entry.amount : 0,
      })),
      partnerName,
      status: 'draft',
      voucherType: 'auto',
      createdBy: 'system',
      createdAt: new Date().toISOString()
    };

    return {
      success: true,
      voucher,
      warnings: validationResult.warnings || []
    };
  }

  /**
   * 生成凭证
   */
  generateVoucher(templateId: string, inputData: InputData): {
    success: boolean;
    voucher?: any;
    errors?: string[];
    warnings?: string[];
  } {
    const template = this.getTemplateById(templateId);
    if (!template) {
      return {
        success: false,
        errors: ['模板不存在']
      };
    }

    // 验证输入数据
    const validationResult = this.validateInput(template, inputData);
    if (!validationResult.valid) {
      return {
        success: false,
        errors: validationResult.errors
      };
    }

    // 计算分录
    const entries = this.calculateEntries(template, inputData);

    // 检查借贷是否平衡
    const totalDebit = entries
      .filter(e => e.direction === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCredit = entries
      .filter(e => e.direction === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        errors: ['借贷不平衡，请检查模板配置']
      };
    }

    // 生成凭证
    const voucher = {
      id: generateId(),
      voucherNo: `自动-${Date.now()}`,
      date: inputData.invoice_date || new Date().toISOString().split('T')[0],
      summary: template.name,
      entries: entries.map(entry => ({
        id: generateId(),
        voucherId: '',
        date: voucher.date,
        summary: entry.description,
        subjectCode: entry.subject,
        subjectName: entry.subjectName,
        debit: entry.direction === 'debit' ? entry.amount : 0,
        credit: entry.direction === 'credit' ? entry.amount : 0
      })),
      status: 'draft',
      voucherType: 'auto',
      createdBy: 'system',
      createdAt: new Date().toISOString()
    };

    return {
      success: true,
      voucher,
      warnings: validationResult.warnings || []
    };
  }

  /**
   * 验证输入数据
   */
  private validateInput(template: VoucherTemplate, data: InputData): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必填字段
    for (const validation of template.validations) {
      if (validation.condition === 'required') {
        if (data[validation.field] === undefined || data[validation.field] === null || data[validation.field] === '') {
          errors.push(validation.message);
        }
      }
    }

    // 检查数值字段
    for (const validation of template.validations) {
      if (validation.condition === 'numeric') {
        const value = data[validation.field];
        if (value !== undefined && value !== null && isNaN(parseFloat(value))) {
          errors.push(validation.message);
        }
      }
    }

    // 检查公式中的变量是否存在
    for (const entry of template.entries) {
      const variables = FormulaInterpreter.extractVariables(entry.formula);
      for (const variable of variables) {
        if (data[variable] === undefined && !this.getVariableDefaultValue(template, variable, data)) {
          warnings.push(`分录中的变量 "${variable}" 未找到值`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 计算分录
   */
  private calculateEntries(
    template: VoucherTemplate,
    data: InputData,
    subjectOverrides?: Record<string, { code: string; name: string }>
  ): Array<{
    subject: string;
    subjectName?: string;
    direction: 'debit' | 'credit';
    amount: number;
    description?: string;
  }> {
    return template.entries
      .map(entry => {
        const amount = FormulaInterpreter.evaluate(entry.formula, data);

        // 应用科目覆盖
        const override = subjectOverrides?.[entry.id];

        // 如果覆盖的科目为空字符串，表示跳过该分录（如员工报销无税金科目）
        const subjectCode = override?.code !== undefined ? override.code : entry.subject;
        if (!subjectCode) {
          return { ...entry, subject: '', amount: 0, skip: true };
        }

        return {
          subject: subjectCode,
          subjectName: override?.name || entry.subjectName,
          direction: entry.direction,
          amount: Math.round(amount * 100) / 100,
          description: entry.description
        };
      })
      .filter(entry => !(entry as any).skip);
  }

  /**
   * 获取变量默认值
   */
  private getVariableDefaultValue(template: VoucherTemplate, variable: string, data: InputData): any {
    const variableDef = template.variables.find(v => v.name === variable);
    if (variableDef?.defaultValue && typeof variableDef.defaultValue === 'function') {
      return variableDef.defaultValue(data);
    }
    return variableDef?.defaultValue;
  }

  /**
   * 创建新模板（供用户自定义）
   */
  createTemplate(template: Omit<VoucherTemplate, 'id'>): VoucherTemplate {
    const newTemplate: VoucherTemplate = {
      ...template,
      id: `tpl_${Date.now()}`
    };
    this.templates.push(newTemplate);
    return newTemplate;
  }

  /**
   * 更新模板
   */
  updateTemplate(id: string, updates: Partial<VoucherTemplate>): VoucherTemplate | null {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return null;

    // 系统内置模板不允许修改
    if (this.templates[index].isSystem) return null;

    this.templates[index] = { ...this.templates[index], ...updates };
    return this.templates[index];
  }

  /**
   * 删除模板
   */
  deleteTemplate(id: string): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;

    // 系统内置模板不允许删除
    if (this.templates[index].isSystem) return false;

    this.templates.splice(index, 1);
    return true;
  }
}

// 全局模板引擎实例
export const templateEngine = new TemplateEngine();

// 生成ID的辅助函数
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}