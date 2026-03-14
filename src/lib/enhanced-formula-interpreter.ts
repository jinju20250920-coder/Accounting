/**
 * 增强的公式解释器 - 安全性增强版本
 */

// 公式变量类型
export interface FormulaVariables {
  [key: string]: number | string | Date;
}

// 公式计算结果
export interface FormulaResult {
  value: number;
  formula: string;
  variables: string[];
  error?: string;
  warnings: string[];
}

// 安全配置
export interface SecurityConfig {
  maxExpressionLength: number;
  allowedFunctions: string[];
  allowedConstants: string[];
  maxDecimalPlaces: number;
  enableTrigonometry: boolean;
  enableLogarithm: boolean;
  enablePower: boolean;
}

// 默认安全配置
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxExpressionLength: 100,
  allowedFunctions: [
    'Math.abs', 'Math.round', 'Math.floor', 'Math.ceil',
    'Math.max', 'Math.min', 'Math.sqrt'
  ],
  allowedConstants: ['Math.PI', 'Math.E'],
  maxDecimalPlaces: 6,
  enableTrigonometry: false,
  enableLogarithm: false,
  enablePower: true
};

// 数学函数映射
const MATH_FUNCTIONS = {
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  max: Math.max,
  min: Math.min,
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log,
  log10: Math.log10,
  pow: Math.pow
};

// 增强的公式解释器
export class EnhancedFormulaInterpreter {
  private securityConfig: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.securityConfig = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * 计算公式值
   */
  evaluate(formula: string, variables: FormulaVariables): FormulaResult {
    const warnings: string[] = [];
    let cleanFormula = formula.trim();

    // 基本验证
    if (!cleanFormula) {
      return {
        value: 0,
        formula: '',
        variables: [],
        warnings: ['公式为空']
      };
    }

    // 检查公式长度
    if (cleanFormula.length > this.securityConfig.maxExpressionLength) {
      return {
        value: 0,
        formula,
        variables: [],
        error: `公式长度超过限制 (${this.securityConfig.maxExpressionLength} 字符)`,
        warnings
      };
    }

    // 提取变量
    const extractedVariables = this.extractVariables(cleanFormula);

    // 验证变量
    for (const varName of extractedVariables) {
      if (!variables[varName] !== undefined) {
        warnings.push(`变量 ${varName} 未提供值`);
      }
    }

    // 预处理公式
    let processedFormula = this.preprocessFormula(cleanFormula);

    // 安全检查
    const securityCheck = this.validateSecurity(processedFormula);
    if (!securityCheck.valid) {
      return {
        value: 0,
        formula,
        variables: extractedVariables,
        error: securityCheck.error,
        warnings: [...warnings, ...securityCheck.warnings]
      };
    }

    // 替换变量
    let finalFormula = processedFormula;
    for (const varName of extractedVariables) {
      const value = variables[varName];
      if (value !== undefined) {
        // 确保值是数字
        const numValue = Number(value);
        if (isNaN(numValue)) {
          warnings.push(`变量 ${varName} 的值不是有效数字`);
        } else {
          // 限制小数位数
          if (this.securityConfig.maxDecimalPlaces > 0) {
            finalFormula = finalFormula.replace(
              new RegExp(`\\b${varName}\\b`, 'g'),
              numValue.toFixed(this.securityConfig.maxDecimalPlaces)
            );
          } else {
            finalFormula = finalFormula.replace(
              new RegExp(`\\b${varName}\\b`, 'g'),
              numValue.toString()
            );
          }
        }
      }
    }

    // 执行计算
    try {
      const result = this.safeCalculate(finalFormula);

      return {
        value: result,
        formula,
        variables: extractedVariables,
        warnings
      };
    } catch (error) {
      return {
        value: 0,
        formula,
        variables: extractedVariables,
        error: error instanceof Error ? error.message : '计算错误',
        warnings: [...warnings]
      };
    }
  }

  /**
   * 提取公式中的变量
   */
  extractVariables(formula: string): string[] {
    // 匹配 {variable} 格式的变量
    const matches = formula.match(/\{([^}]+)\}/g);
    if (!matches) return [];

    // 提取变量名并去重
    return matches
      .map(match => match.slice(1, -1).trim())
      .filter((value, index, self) => self.indexOf(value) === index);
  }

  /**
   * 预处理公式
   */
  private preprocessFormula(formula: string): string {
    // 移除变量的大括号
    let processed = formula.replace(/[{}]/g, '');

    // 规范化空格
    processed = processed.replace(/\s+/g, ' ').trim();

    // 处理负数
    processed = processed.replace(/\s*\-\s*(\d+)/g, '-$1');

    return processed;
  }

  /**
   * 安全验证
   */
  private validateSecurity(formula: string): { valid: boolean; error?: string; warnings: string[] } {
    const warnings: string[] = [];
    let error: string | undefined;

    // 检查潜在的危险字符
    const dangerousPatterns = [
      /[\u0000-\u001F\u007F-\u009F]/, // 控制字符
      /(?:eval|Function|constructor|prototype|__proto__)/, // 危险函数
      /(?:import|require|fetch|XMLHttpRequest)/, // 网络相关
      /(?:document|window|global|process|Buffer)/, // 全局对象
      /(?:\.\.|\.\s*\()/ // 潜在的路径遍历
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(formula)) {
        error = '公式包含不安全的内容';
        warnings.push('检测到潜在的危险字符模式');
        break;
      }
    }

    // 检查不允许的函数
    const functionPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let match;
    while ((match = functionPattern.exec(formula)) !== null) {
      const functionName = match[1];
      const fullFunctionName = functionName.startsWith('Math.')
        ? functionName
        : `Math.${functionName}`;

      if (!this.securityConfig.allowedFunctions.includes(fullFunctionName)) {
        warnings.push(`使用了未授权的函数: ${functionName}`);
      }
    }

    // 检查常数
    const constantPattern = /([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    while ((match = constantPattern.exec(formula)) !== null) {
      if (this.securityConfig.allowedConstants.includes(match[0])) {
        continue;
      }

      // 允许数字
      if (/^\d+(\.\d+)?$/.test(match[0])) {
        continue;
      }

      // 允许变量（会被后续替换）
      if (!formula.includes(`{${match[0]}}`)) {
        warnings.push(`使用了未授权的常量: ${match[0]}`);
      }
    }

    // 检查嵌套深度
    const depth = (formula.match(/\(/g) || []).length;
    if (depth > 10) {
      warnings.push('公式嵌套过深，可能影响性能');
    }

    return {
      valid: !error,
      error,
      warnings
    };
  }

  /**
   * 安全计算
   */
  private safeCalculate(formula: string): number {
    // 创建安全的计算上下文
    const context = {
      // 只暴露必要的数学函数
      ...Object.fromEntries(
        Object.entries(MATH_FUNCTIONS).filter(([key]) => {
          const fullName = `Math.${key}`;
          if (this.securityConfig.allowedFunctions.includes(fullName)) {
            return true;
          }

          // 根据配置检查特殊函数
          if (key === 'pow' && !this.securityConfig.enablePower) {
            return false;
          }
          if (['sin', 'cos', 'tan'].includes(key) && !this.securityConfig.enableTrigonometry) {
            return false;
          }
          if (['log', 'log10'].includes(key) && !this.securityConfig.enableLogarithm) {
            return false;
          }

          return false;
        })
      ),
      // 禁止访问全局对象
      globalThis: undefined,
      global: undefined,
      window: undefined,
      self: undefined,
      this: undefined
    };

    // 使用WebAssembly沙箱进行计算（在生产环境中）
    // 这里使用简化的Function构造函数
    try {
      // 过滤表达式，只允许数字、运算符、括号和允许的函数
      const sanitizedFormula = formula.replace(/[^0-9+\-*/().\s,]/g, '');

      // 创建计算函数
      const calculator = new Function('Math', `
        "use strict";
        return ${sanitizedFormula};
      `);

      return calculator(context);
    } catch (error) {
      throw new Error(`计算失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量计算多个公式
   */
  batchEvaluate(formulas: string[], variables: FormulaVariables): FormulaResult[] {
    return formulas.map(formula => this.evaluate(formula, variables));
  }

  /**
   * 验证公式语法
   */
  validateSyntax(formula: string): { valid: boolean; error?: string } {
    try {
      this.safeCalculate(this.preprocessFormula(formula));
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : '语法错误'
      };
    }
  }

  /**
   * 获取公式中的依赖项
   */
  getDependencies(formula: string): string[] {
    return this.extractVariables(formula);
  }

  /**
   * 更新安全配置
   */
  updateSecurityConfig(config: Partial<SecurityConfig>): void {
    this.securityConfig = { ...this.securityConfig, ...config };
  }
}

// 创建默认实例
export const defaultFormulaInterpreter = new EnhancedFormulaInterpreter();