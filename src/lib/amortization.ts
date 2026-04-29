/**
 * 无形资产和待摊费用摊销计算引擎
 * 支持2种摊销方法：直线法、产量法
 */

import type {
  AmortizationMethod,
  AmortizationCalculationInput,
  AmortizationResult,
} from '@/types';

import { roundToTwoDecimals, calculateMonthsBetween } from './depreciation';

/**
 * 直线法摊销计算
 * 公式：月摊销额 = (原值 - 残值) / 摊销月数
 *
 * @param input 摊销计算输入参数
 * @returns 摊销计算结果
 */
export function calculateStraightLineAmortization(
  input: AmortizationCalculationInput
): AmortizationResult {
  const {
    originalValue,
    residualValue,
    usefulLifeMonths,
    amortizedAmount,
    amortizationStartDate,
    asOfDate,
  } = input;

  const amortizableValue = originalValue - residualValue;
  const monthlyAmortization = usefulLifeMonths > 0 ? amortizableValue / usefulLifeMonths : 0;

  // 计算已过月数
  const monthsElapsed = amortizationStartDate
    ? calculateMonthsBetween(amortizationStartDate, asOfDate)
    : 0;

  // 本期摊销额（一个月）
  const periodAmortization = roundToTwoDecimals(monthlyAmortization);

  // 新的累计摊销
  const newAccumulatedAmortization = roundToTwoDecimals(
    Math.min(amortizedAmount + periodAmortization, amortizableValue)
  );

  // 摊销后剩余金额
  const remainingAmount = roundToTwoDecimals(
    Math.max(originalValue - newAccumulatedAmortization, residualValue)
  );

  // 剩余摊销期数
  const remainingLife = Math.max(0, usefulLifeMonths - monthsElapsed);

  // 是否已摊销完毕
  const isFullyAmortized = newAccumulatedAmortization >= amortizableValue || remainingAmount <= residualValue;

  return {
    periodAmortization,
    accumulatedAmortization: newAccumulatedAmortization,
    remainingAmount,
    remainingLife,
    isFullyAmortized,
    calculationDetails: `直线法: (${(originalValue ?? 0).toLocaleString()} - ${(residualValue ?? 0).toLocaleString()}) / ${usefulLifeMonths}月 = ${monthlyAmortization.toFixed(2)}/月`,
  };
}

/**
 * 产量法摊销计算
 * 公式：单位摊销额 = (原值 - 残值) / 总产量
 *      本期摊销额 = 本期产量 × 单位摊销额
 *
 * @param input 摊销计算输入参数
 * @param unitsThisPeriod 本期产量
 * @returns 摊销计算结果
 */
export function calculateUnitsAmortization(
  input: AmortizationCalculationInput,
  unitsThisPeriod: number
): AmortizationResult {
  const {
    originalValue,
    residualValue,
    totalUnits,
    unitsUsed = 0,
    amortizedAmount,
    usefulLifeMonths,
    amortizationStartDate,
    asOfDate,
  } = input;

  if (!totalUnits || totalUnits <= 0) {
    return {
      periodAmortization: 0,
      accumulatedAmortization: amortizedAmount,
      remainingAmount: originalValue - amortizedAmount,
      remainingLife: usefulLifeMonths,
      isFullyAmortized: false,
      calculationDetails: '产量法: 总产量未设置，无法计算摊销',
    };
  }

  const amortizableValue = originalValue - residualValue;

  // 单位摊销额
  const unitAmortizationRate = amortizableValue / totalUnits;

  // 本期摊销额
  let periodAmortization = unitsThisPeriod * unitAmortizationRate;

  // 确保不超过最大可摊销额
  const maxAmortization = amortizableValue - amortizedAmount;
  periodAmortization = Math.min(periodAmortization, maxAmortization);
  periodAmortization = Math.max(0, periodAmortization);
  periodAmortization = roundToTwoDecimals(periodAmortization);

  // 新的累计摊销
  const newAccumulatedAmortization = roundToTwoDecimals(
    Math.min(amortizedAmount + periodAmortization, amortizableValue)
  );

  // 摊销后剩余金额
  const remainingAmount = roundToTwoDecimals(
    Math.max(originalValue - newAccumulatedAmortization, residualValue)
  );

  // 计算已过月数
  const monthsElapsed = amortizationStartDate
    ? calculateMonthsBetween(amortizationStartDate, asOfDate)
    : 0;

  // 剩余摊销期数
  const remainingLife = Math.max(0, usefulLifeMonths - monthsElapsed);

  // 新的已使用产量
  const newUnitsUsed = unitsUsed + unitsThisPeriod;

  // 是否已摊销完毕
  const isFullyAmortized =
    newAccumulatedAmortization >= amortizableValue ||
    remainingAmount <= residualValue ||
    newUnitsUsed >= totalUnits;

  return {
    periodAmortization,
    accumulatedAmortization: newAccumulatedAmortization,
    remainingAmount,
    remainingLife,
    isFullyAmortized,
    calculationDetails: `产量法: ${unitsThisPeriod}单位 × (${(originalValue ?? 0).toLocaleString()} - ${(residualValue ?? 0).toLocaleString()}) / ${(totalUnits ?? 0).toLocaleString()} = ${periodAmortization.toFixed(2)}`,
  };
}

/**
 * 统一摊销计算入口
 * 根据摊销方法自动选择对应的计算函数
 *
 * @param method 摊销方法
 * @param input 摊销计算输入参数
 * @param unitsThisPeriod 本期产量（仅产量法需要）
 * @returns 摊销计算结果
 */
export function calculateAmortization(
  method: AmortizationMethod,
  input: AmortizationCalculationInput,
  unitsThisPeriod?: number
): AmortizationResult {
  // 检查是否已摊销完毕
  const amortizableValue = input.originalValue - input.residualValue;
  if (input.amortizedAmount >= amortizableValue) {
    return {
      periodAmortization: 0,
      accumulatedAmortization: input.amortizedAmount,
      remainingAmount: Math.max(input.originalValue - input.amortizedAmount, input.residualValue),
      remainingLife: 1,
      isFullyAmortized: true,
      calculationDetails: '已摊销完毕，无需继续摊销',
    };
  }

  switch (method) {
    case 'straight_line':
      return calculateStraightLineAmortization(input);

    case 'units_of_production':
      if (unitsThisPeriod === undefined || unitsThisPeriod <= 0) {
        return {
          periodAmortization: 0,
          accumulatedAmortization: input.amortizedAmount,
          remainingAmount: input.originalValue - input.amortizedAmount,
          remainingLife: input.usefulLifeMonths,
          isFullyAmortized: false,
          calculationDetails: '产量法: 本期产量未提供或为零',
        };
      }
      return calculateUnitsAmortization(input, unitsThisPeriod);

    default:
      throw new Error(`未知的摊销方法: ${method}`);
  }
}

/**
 * 计算待摊费用的每期固定摊销额
 *
 * @param originalAmount 原始金额
 * @param amortizationPeriods 摊销期数
 * @returns 每期摊销额
 */
export function calculatePeriodAmount(
  originalAmount: number,
  amortizationPeriods: number
): number {
  if (amortizationPeriods <= 0) return 0;
  return roundToTwoDecimals(originalAmount / amortizationPeriods);
}

/**
 * 计算待摊费用剩余期数
 *
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @param amortizedPeriods 已摊销期数
 * @returns 剩余期数
 */
export function calculateRemainingPeriods(
  startDate: string,
  endDate: string,
  amortizedPeriods: number
): number {
  const totalMonths = calculateMonthsBetween(startDate, endDate);
  return Math.max(0, totalMonths - amortizedPeriods);
}

/**
 * 获取摊销方法的中文名称
 */
export function getAmortizationMethodName(method: AmortizationMethod): string {
  const nameMap: Record<AmortizationMethod, string> = {
    straight_line: '直线法',
    units_of_production: '产量法',
  };
  return nameMap[method] || method;
}

/**
 * 解析摊销方法（从中文名称到代码）
 */
export function parseAmortizationMethod(methodName: string): AmortizationMethod {
  const methodMap: Record<string, AmortizationMethod> = {
    '直线法': 'straight_line',
    '年限平均法': 'straight_line',
    '产量法': 'units_of_production',
    '工作量法': 'units_of_production',
    'straight_line': 'straight_line',
    'units_of_production': 'units_of_production',
  };
  return methodMap[methodName] || 'straight_line';
}

/**
 * 获取无形资产类型的中文名称
 */
export function getIntangibleAssetTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    patent: '专利权',
    trademark: '商标权',
    software: '软件',
    copyright: '著作权',
    goodwill: '商誉',
    other: '其他',
  };
  return typeMap[type] || type;
}

/**
 * 获取待摊费用类型的中文名称
 */
export function getPrepaidExpenseTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    rent: '租金',
    insurance: '保险费',
    subscription: '订阅费',
    maintenance: '维护费',
    advertising: '广告费',
    other: '其他',
  };
  return typeMap[type] || type;
}
