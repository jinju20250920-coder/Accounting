/**
 * 固定资产折旧计算引擎
 * 支持4种折旧方法：直线法、双倍余额递减法、年数总和法、工作量法
 */

import type {
  DepreciationMethod,
  DepreciationCalculationInput,
  DepreciationResult,
  DepreciationStartRule,
} from '@/types';

/**
 * 判断本期是否应该计提折旧
 * @param acquisitionDate 取得日期
 * @param period 期间（YYYY-MM）
 * @param rule 折旧起始规则
 * @returns 是否应该计提本期折旧
 */
export function shouldDepreciateThisPeriod(
  acquisitionDate: string,
  period: string,
  rule: DepreciationStartRule = 'next_month'
): boolean {
  const acquisitionMonth = acquisitionDate.substring(0, 7);
  if (rule === 'current_month') {
    // 无形资产规则：当月增加当月开始摊销
    return true;
  } else {
    // 固定资产规则：当月增加不计提，下月开始
    return acquisitionMonth < period;
  }
}

/**
 * 判断本期是否应该停止计提折旧（处置当月）
 * @param disposalDate 处置日期
 * @param period 期间（YYYY-MM）
 * @param rule 折旧起始规则
 * @returns 是否应该停止计提
 */
export function shouldStopDepreciationThisPeriod(
  disposalDate: string,
  period: string,
  rule: DepreciationStartRule = 'next_month'
): boolean {
  const disposalMonth = disposalDate.substring(0, 7);
  if (rule === 'current_month') {
    // 无形资产规则：当月减少当月停止摊销
    return disposalMonth <= period;
  } else {
    // 固定资产规则：当月减少当月照提，下月停提
    return disposalMonth < period;
  }
}

/**
 * 计算两个日期之间的月数差
 */
export function calculateMonthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/**
 * 四舍五入到两位小数
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 直线法折旧计算
 * 公式：月折旧额 = (原值 - 累计折旧 - 残值) / 剩余月数
 *
 * 对新购资产（累计折旧=0、已过月数=0）等价于 (原值 - 残值) / 总月数。
 * 对期初导入资产（已有累计折旧）使用剩余应计折旧额和剩余月数，避免超额折旧。
 *
 * @param input 折旧计算输入参数
 * @returns 折旧计算结果
 */
export function calculateStraightLineDepreciation(
  input: DepreciationCalculationInput
): DepreciationResult {
  const {
    originalValue,
    salvageValue,
    usefulLifeMonths,
    accumulatedDepreciation,
    depreciationStartDate,
    asOfDate,
  } = input;

  const depreciableValue = originalValue - salvageValue;

  // 计算已过月数
  const monthsElapsed = depreciationStartDate
    ? calculateMonthsBetween(depreciationStartDate, asOfDate)
    : 0;

  // 剩余应计折旧额（原值 - 已计提累计折旧 - 残值）
  const remainingDepreciableValue = Math.max(0, depreciableValue - accumulatedDepreciation);
  // 剩余月数
  const remainingMonths = Math.max(0, usefulLifeMonths - monthsElapsed);

  // 月折旧额 = 剩余应计折旧额 / 剩余月数
  const monthlyDepreciation = remainingMonths > 0 ? remainingDepreciableValue / remainingMonths : 0;

  // 本期折旧额（一个月）
  const periodDepreciation = roundToTwoDecimals(monthlyDepreciation);

  // 新的累计折旧
  const newAccumulatedDepreciation = roundToTwoDecimals(
    Math.min(accumulatedDepreciation + periodDepreciation, depreciableValue)
  );

  // 折旧后净值
  const netValue = roundToTwoDecimals(
    Math.max(originalValue - newAccumulatedDepreciation, salvageValue)
  );

  // 剩余使用月数
  const remainingLife = Math.max(0, usefulLifeMonths - monthsElapsed);

  // 是否已提足折旧
  const isFullyDepreciated = newAccumulatedDepreciation >= depreciableValue || netValue <= salvageValue;

  return {
    periodDepreciation,
    accumulatedDepreciation: newAccumulatedDepreciation,
    netValue,
    remainingLife,
    isFullyDepreciated,
    calculationDetails: `直线法: (${(originalValue ?? 0).toLocaleString()} - ${(accumulatedDepreciation ?? 0).toLocaleString()} - ${(salvageValue ?? 0).toLocaleString()}) / ${remainingMonths}月 = ${monthlyDepreciation.toFixed(2)}/月`,
  };
}

/**
 * 双倍余额递减法折旧计算
 * 公式：月折旧额 = 账面净值 × (2 / 使用年限 / 12)
 * 注意：最后两年改为直线法，确保不小于残值
 *
 * @param input 折旧计算输入参数
 * @returns 折旧计算结果
 */
export function calculateDoubleDecliningDepreciation(
  input: DepreciationCalculationInput
): DepreciationResult {
  const {
    originalValue,
    salvageValue,
    usefulLifeYears,
    usefulLifeMonths,
    accumulatedDepreciation,
    depreciationStartDate,
    asOfDate,
  } = input;

  const depreciableValue = originalValue - salvageValue;
  const bookValue = originalValue - accumulatedDepreciation;

  // 年折旧率 = 2 / 使用年限
  const annualRate = usefulLifeYears > 0 ? 2 / usefulLifeYears : 0;
  const monthlyRate = annualRate / 12;

  // 计算已过月数
  const monthsElapsed = depreciationStartDate
    ? calculateMonthsBetween(depreciationStartDate, asOfDate)
    : 0;

  // 当前年份（从1开始）
  const currentYear = Math.floor(monthsElapsed / 12) + 1;

  let periodDepreciation: number;

  // 最后两年改用直线法
  if (currentYear >= usefulLifeYears - 1 && usefulLifeYears > 2) {
    // 剩余账面价值按直线法分摊到剩余月份
    const remainingMonths = Math.max(1, usefulLifeMonths - monthsElapsed);
    periodDepreciation = (bookValue - salvageValue) / remainingMonths;
  } else {
    // 正常双倍余额递减法
    periodDepreciation = bookValue * monthlyRate;
  }

  // 确保不超过最大可折旧额
  const maxDepreciation = bookValue - salvageValue;
  periodDepreciation = Math.min(periodDepreciation, maxDepreciation);
  periodDepreciation = Math.max(0, periodDepreciation);
  periodDepreciation = roundToTwoDecimals(periodDepreciation);

  // 新的累计折旧
  const newAccumulatedDepreciation = roundToTwoDecimals(
    Math.min(accumulatedDepreciation + periodDepreciation, depreciableValue)
  );

  // 折旧后净值
  const netValue = roundToTwoDecimals(
    Math.max(originalValue - newAccumulatedDepreciation, salvageValue)
  );

  // 剩余使用月数
  const remainingLife = Math.max(0, usefulLifeMonths - monthsElapsed);

  // 是否已提足折旧
  const isFullyDepreciated = newAccumulatedDepreciation >= depreciableValue || netValue <= salvageValue;

  return {
    periodDepreciation,
    accumulatedDepreciation: newAccumulatedDepreciation,
    netValue,
    remainingLife,
    isFullyDepreciated,
    calculationDetails: `双倍余额递减法: 账面净值 ${(bookValue ?? 0).toLocaleString()} × 月折旧率 ${(monthlyRate * 100).toFixed(4)}% = ${periodDepreciation.toFixed(2)}`,
  };
}

/**
 * 年数总和法折旧计算
 * 公式：月折旧额 = (原值 - 残值) × (剩余使用年限 / 年数总和) / 12
 *
 * @param input 折旧计算输入参数
 * @returns 折旧计算结果
 */
export function calculateSumOfYearsDepreciation(
  input: DepreciationCalculationInput
): DepreciationResult {
  const {
    originalValue,
    salvageValue,
    usefulLifeYears,
    usefulLifeMonths,
    accumulatedDepreciation,
    depreciationStartDate,
    asOfDate,
  } = input;

  const depreciableValue = originalValue - salvageValue;

  // 年数总和 = n × (n+1) / 2
  const sumOfYears = (usefulLifeYears * (usefulLifeYears + 1)) / 2;

  // 计算已过月数
  const monthsElapsed = depreciationStartDate
    ? calculateMonthsBetween(depreciationStartDate, asOfDate)
    : 0;

  // 已过年数（带小数）
  const yearsElapsed = monthsElapsed / 12;

  // 剩余使用年限（带小数）
  const remainingLifeYears = Math.max(0, usefulLifeYears - yearsElapsed);

  // 当前年份的折旧率 = 剩余使用年限 / 年数总和
  // 月折旧额 = 应计折旧额 × 年折旧率 / 12
  let periodDepreciation = 0;
  if (sumOfYears > 0 && remainingLifeYears > 0) {
    periodDepreciation = depreciableValue * (remainingLifeYears / sumOfYears) / 12;
  }

  // 确保不超过最大可折旧额
  const maxDepreciation = depreciableValue - accumulatedDepreciation;
  periodDepreciation = Math.min(periodDepreciation, maxDepreciation);
  periodDepreciation = Math.max(0, periodDepreciation);
  periodDepreciation = roundToTwoDecimals(periodDepreciation);

  // 新的累计折旧
  const newAccumulatedDepreciation = roundToTwoDecimals(
    Math.min(accumulatedDepreciation + periodDepreciation, depreciableValue)
  );

  // 折旧后净值
  const netValue = roundToTwoDecimals(
    Math.max(originalValue - newAccumulatedDepreciation, salvageValue)
  );

  // 剩余使用月数
  const remainingLife = Math.max(0, usefulLifeMonths - monthsElapsed);

  // 是否已提足折旧
  const isFullyDepreciated = newAccumulatedDepreciation >= depreciableValue || netValue <= salvageValue;

  return {
    periodDepreciation,
    accumulatedDepreciation: newAccumulatedDepreciation,
    netValue,
    remainingLife,
    isFullyDepreciated,
    calculationDetails: `年数总和法: (${(originalValue ?? 0).toLocaleString()} - ${(salvageValue ?? 0).toLocaleString()}) × (${remainingLifeYears.toFixed(2)}年 / ${sumOfYears}) / 12 = ${periodDepreciation.toFixed(2)}`,
  };
}

/**
 * 工作量法折旧计算
 * 公式：单位折旧额 = (原值 - 残值) / 总工作量
 *      本期折旧额 = 本期工作量 × 单位折旧额
 *
 * @param input 折旧计算输入参数
 * @param unitsThisPeriod 本期工作量
 * @returns 折旧计算结果
 */
export function calculateUnitsOfProductionDepreciation(
  input: DepreciationCalculationInput,
  unitsThisPeriod: number
): DepreciationResult {
  const {
    originalValue,
    salvageValue,
    totalUnits,
    unitsUsed = 0,
    accumulatedDepreciation,
    usefulLifeMonths,
    depreciationStartDate,
    asOfDate,
  } = input;

  if (!totalUnits || totalUnits <= 0) {
    return {
      periodDepreciation: 0,
      accumulatedDepreciation,
      netValue: originalValue - accumulatedDepreciation,
      remainingLife: usefulLifeMonths,
      isFullyDepreciated: false,
      calculationDetails: '工作量法: 总工作量未设置，无法计算折旧',
    };
  }

  const depreciableValue = originalValue - salvageValue;

  // 单位折旧额
  const unitDepreciationRate = depreciableValue / totalUnits;

  // 本期折旧额
  let periodDepreciation = unitsThisPeriod * unitDepreciationRate;

  // 确保不超过最大可折旧额
  const maxDepreciation = depreciableValue - accumulatedDepreciation;
  periodDepreciation = Math.min(periodDepreciation, maxDepreciation);
  periodDepreciation = Math.max(0, periodDepreciation);
  periodDepreciation = roundToTwoDecimals(periodDepreciation);

  // 新的累计折旧
  const newAccumulatedDepreciation = roundToTwoDecimals(
    Math.min(accumulatedDepreciation + periodDepreciation, depreciableValue)
  );

  // 折旧后净值
  const netValue = roundToTwoDecimals(
    Math.max(originalValue - newAccumulatedDepreciation, salvageValue)
  );

  // 计算已过月数
  const monthsElapsed = depreciationStartDate
    ? calculateMonthsBetween(depreciationStartDate, asOfDate)
    : 0;

  // 剩余使用月数
  const remainingLife = Math.max(0, usefulLifeMonths - monthsElapsed);

  // 新的已使用工作量
  const newUnitsUsed = unitsUsed + unitsThisPeriod;

  // 是否已提足折旧
  const isFullyDepreciated =
    newAccumulatedDepreciation >= depreciableValue ||
    netValue <= salvageValue ||
    newUnitsUsed >= totalUnits;

  return {
    periodDepreciation,
    accumulatedDepreciation: newAccumulatedDepreciation,
    netValue,
    remainingLife,
    isFullyDepreciated,
    calculationDetails: `工作量法: ${unitsThisPeriod}单位 × (${(originalValue ?? 0).toLocaleString()} - ${(salvageValue ?? 0).toLocaleString()}) / ${(totalUnits ?? 0).toLocaleString()} = ${periodDepreciation.toFixed(2)}`,
  };
}

/**
 * 统一折旧计算入口
 * 根据折旧方法自动选择对应的计算函数
 *
 * @param method 折旧方法
 * @param input 折旧计算输入参数
 * @param period 计算期间（YYYY-MM），用于判断折旧起始规则
 * @param unitsThisPeriod 本期工作量（仅工作量法需要）
 * @returns 折旧计算结果
 */
export function calculateDepreciation(
  method: DepreciationMethod,
  input: DepreciationCalculationInput,
  period?: string,
  unitsThisPeriod?: number
): DepreciationResult {
  // 检查折旧起始规则
  if (period && input.depreciationStartRule) {
    const shouldDepreciate = shouldDepreciateThisPeriod(
      input.acquisitionDate,
      period,
      input.depreciationStartRule
    );
    if (!shouldDepreciate) {
      return {
        periodDepreciation: 0,
        accumulatedDepreciation: input.accumulatedDepreciation,
        netValue: Math.max(input.originalValue - input.accumulatedDepreciation, input.salvageValue),
        remainingLife: input.usefulLifeMonths,
        isFullyDepreciated: false,
        calculationDetails: input.depreciationStartRule === 'next_month'
          ? '固定资产规则：当月增加不计提，下月开始'
          : '无形资产规则：当月增加当月开始（但本期不满足条件）',
      };
    }
  }

  // 检查是否已提足折旧
  const depreciableValue = input.originalValue - input.salvageValue;
  if (input.accumulatedDepreciation >= depreciableValue) {
    return {
      periodDepreciation: 0,
      accumulatedDepreciation: input.accumulatedDepreciation,
      netValue: Math.max(input.originalValue - input.accumulatedDepreciation, input.salvageValue),
      remainingLife: 0,
      isFullyDepreciated: true,
      calculationDetails: '已提足折旧，无需继续计提',
    };
  }

  switch (method) {
    case 'straight_line':
      return calculateStraightLineDepreciation(input);

    case 'double_declining':
      return calculateDoubleDecliningDepreciation(input);

    case 'sum_of_years':
      return calculateSumOfYearsDepreciation(input);

    case 'units_of_production':
      if (unitsThisPeriod === undefined || unitsThisPeriod <= 0) {
        return {
          periodDepreciation: 0,
          accumulatedDepreciation: input.accumulatedDepreciation,
          netValue: input.originalValue - input.accumulatedDepreciation,
          remainingLife: input.usefulLifeMonths,
          isFullyDepreciated: false,
          calculationDetails: '工作量法: 本期工作量未提供或为零',
        };
      }
      return calculateUnitsOfProductionDepreciation(input, unitsThisPeriod);

    default:
      throw new Error(`未知的折旧方法: ${method}`);
  }
}

/**
 * 计算资产的预计月折旧额（用于预览）
 *
 * @param originalValue 原值
 * @param salvageValue 残值
 * @param method 折旧方法
 * @param usefulLifeYears 使用年限
 * @param usefulLifeMonths 使用月数
 * @returns 预计月折旧额
 */
export function calculateEstimatedMonthlyDepreciation(
  originalValue: number,
  salvageValue: number,
  method: DepreciationMethod,
  usefulLifeYears: number,
  usefulLifeMonths: number
): number {
  const depreciableValue = originalValue - salvageValue;

  switch (method) {
    case 'straight_line':
      return usefulLifeMonths > 0 ? roundToTwoDecimals(depreciableValue / usefulLifeMonths) : 0;

    case 'double_declining': {
      // 第一年第一个月的折旧额作为参考
      const monthlyRate = (2 / usefulLifeYears) / 12;
      return roundToTwoDecimals(originalValue * monthlyRate);
    }

    case 'sum_of_years': {
      // 第一年第一个月的折旧额作为参考
      const sumOfYears = (usefulLifeYears * (usefulLifeYears + 1)) / 2;
      const firstYearRate = usefulLifeYears / sumOfYears;
      return roundToTwoDecimals(depreciableValue * firstYearRate / 12);
    }

    case 'units_of_production':
      return 0; // 工作量法无法预估，取决于实际使用量

    default:
      return 0;
  }
}

/**
 * 获取折旧方法的中文名称
 */
export function getDepreciationMethodName(method: DepreciationMethod): string {
  const nameMap: Record<DepreciationMethod, string> = {
    straight_line: '直线法',
    double_declining: '双倍余额递减法',
    sum_of_years: '年数总和法',
    units_of_production: '工作量法',
  };
  return nameMap[method] || method;
}

/**
 * 解析折旧方法（从中文名称到代码）
 */
export function parseDepreciationMethod(methodName: string): DepreciationMethod {
  const methodMap: Record<string, DepreciationMethod> = {
    '直线法': 'straight_line',
    '年限平均法': 'straight_line',
    '双倍余额递减法': 'double_declining',
    '双倍余额': 'double_declining',
    '年数总和法': 'sum_of_years',
    '年数总和': 'sum_of_years',
    '工作量法': 'units_of_production',
    '工作量': 'units_of_production',
    'straight_line': 'straight_line',
    'double_declining': 'double_declining',
    'sum_of_years': 'sum_of_years',
    'units_of_production': 'units_of_production',
  };
  return methodMap[methodName] || 'straight_line';
}

/**
 * 根据资产类型获取折旧起始规则
 * 固定资产：当月增加不计提，下月开始（next_month）
 * 无形资产：当月增加当月开始摊销（current_month）
 */
export function getDepreciationStartRule(assetType: 'fixed' | 'intangible'): DepreciationStartRule {
  return assetType === 'intangible' ? 'current_month' : 'next_month';
}
