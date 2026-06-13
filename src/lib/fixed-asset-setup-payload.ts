import type { DepreciationMethod } from '../types';

export interface FixedAssetSetupRow {
  assetName: string;
  categoryId: string;
  categoryName: string;
  originalValue: number;
  salvageValue?: number;
  accumulatedDepreciation: number;
  acquisitionDate: string;
  depreciationMethod: string;
  usefulLifeYears: number;
}

export interface FixedAssetSetupPayload extends FixedAssetSetupRow {
  id: string;
  accountSetId: string;
  assetCode: string;
  unit: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number;
  salvageValue: number;
  depreciableValue: number;
  netValue: number;
  depreciationMethod: DepreciationMethod;
  usefulLifeMonths: number;
  remainingDepreciationMonths: number;
  status: 'active';
  accountingStatus: 'accounted';
  acquisitionType: 'opening_balance';
  isOpeningBalance: boolean;
  initialAccumulatedDepreciation: number;
  createTime: string;
  updateTime: string;
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeMethod(method: string): DepreciationMethod {
  const trimmed = method.trim();
  if (!trimmed) return 'straight_line';
  if (trimmed === 'straight-line') return 'straight_line';
  if (trimmed === 'double-declining') return 'double_declining';
  if (trimmed === 'sum-of-years') return 'sum_of_years';
  if (trimmed === 'units-of-production') return 'units_of_production';
  if (trimmed === '直线法') return 'straight_line';
  if (trimmed === '双倍余额递减法') return 'double_declining';
  if (trimmed === '年数总和法') return 'sum_of_years';
  if (trimmed === '工作量法') return 'units_of_production';
  if (trimmed === 'straight_line' || trimmed === 'double_declining' || trimmed === 'sum_of_years' || trimmed === 'units_of_production') {
    return trimmed;
  }
  return 'straight_line';
}

export function buildFixedAssetSetupPayload(input: {
  row: FixedAssetSetupRow;
  index: number;
  accountSetId: string;
  fallbackDate: string;
  now: string;
}): FixedAssetSetupPayload {
  const originalValue = roundMoney(input.row.originalValue);
  const accumulatedDepreciation = roundMoney(input.row.accumulatedDepreciation);
  const usefulLifeYears = Number(input.row.usefulLifeYears) > 0 ? Number(input.row.usefulLifeYears) : 10;
  const usefulLifeMonths = usefulLifeYears * 12;
  const inputSalvage = Number(input.row.salvageValue);
  const salvageValue = roundMoney(
    Number.isFinite(inputSalvage) && inputSalvage > 0
      ? inputSalvage
      : originalValue * 0.05
  );
  const depreciableValue = roundMoney(originalValue - salvageValue);

  return {
    id: `${input.accountSetId}_opening_asset_${String(input.index + 1).padStart(4, '0')}`,
    accountSetId: input.accountSetId,
    assetCode: `FA${String(input.index + 1).padStart(4, '0')}`,
    assetName: input.row.assetName.trim(),
    categoryId: input.row.categoryId.trim(),
    categoryName: input.row.categoryName.trim() || '通用设备',
    unit: '台',
    quantity: 1,
    remainingQuantity: 1,
    unitPrice: originalValue,
    originalValue,
    salvageValue,
    depreciableValue,
    accumulatedDepreciation,
    netValue: roundMoney(originalValue - accumulatedDepreciation),
    depreciationMethod: normalizeMethod(input.row.depreciationMethod),
    usefulLifeYears,
    usefulLifeMonths,
    remainingDepreciationMonths: usefulLifeMonths,
    acquisitionDate: input.row.acquisitionDate.trim() || input.fallbackDate,
    status: 'active',
    accountingStatus: 'accounted',
    acquisitionType: 'opening_balance',
    isOpeningBalance: true,
    initialAccumulatedDepreciation: accumulatedDepreciation,
    createTime: input.now,
    updateTime: input.now,
  };
}
