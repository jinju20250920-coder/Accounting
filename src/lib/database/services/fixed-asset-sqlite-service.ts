import type { FixedAsset } from '../../../types';

export type SqliteBindable = string | number | null;

export type FixedAssetSaveInput = Pick<
  FixedAsset,
  | 'id'
  | 'assetCode'
  | 'assetName'
  | 'originalValue'
  | 'acquisitionDate'
> & Partial<FixedAsset>;

export interface SqliteStatement {
  run(params: SqliteBindable[]): void;
  free(): void;
}

export interface SqliteDatabaseLike {
  prepare(sql: string): SqliteStatement;
}

export interface FixedAssetInsert {
  sql: string;
  params: SqliteBindable[];
}

export interface FixedAssetRow {
  id: string;
  tenantId: string;
  accountSetId: string;
  assetCode: string;
  assetName: string;
  categoryId: string | null;
  categoryName: string | null;
  unit: string | null;
  quantity: number | null;
  remainingQuantity: number | null;
  unitPrice: number | null;
  originalValue: number | null;
  salvageValue: number | null;
  depreciableValue: number | null;
  accumulatedDepreciation: number | null;
  netValue: number | null;
  depreciationMethod: string | null;
  usefulLifeYears: number | null;
  usefulLifeMonths: number | null;
  remainingDepreciationMonths: number | null;
  acquisitionDate: string | null;
  depreciationStartDate: string | null;
  status: string | null;
  accountingStatus: string | null;
  acquisitionType: string | null;
  isOpeningBalance: number | null;
  initialAccumulatedDepreciation: number | null;
  createTime: string | null;
  updateTime: string | null;
}

const FIXED_ASSET_INSERT_SQL = `
  INSERT OR REPLACE INTO fixedAssets (
    id, tenantId, accountSetId, assetCode, assetName, categoryId, categoryName, unit, quantity, remainingQuantity, unitPrice,
    originalValue, salvageValue, depreciableValue, accumulatedDepreciation, netValue,
    depreciationMethod, usefulLifeYears, usefulLifeMonths, remainingDepreciationMonths,
    acquisitionDate, depreciationStartDate, status, accountingStatus, acquisitionType, isOpeningBalance, initialAccumulatedDepreciation,
    createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function text(value: string | undefined | null, fallback = ''): string {
  return value ?? fallback;
}

function numberValue(value: number | undefined | null, fallback: number): number {
  return value ?? fallback;
}

export function buildFixedAssetInsert(
  asset: FixedAssetSaveInput,
  tenantId: string,
  accountSetId: string,
): FixedAssetInsert {
  const originalValue = numberValue(asset.originalValue, 0);
  const usefulLifeMonths = numberValue(asset.usefulLifeMonths, 120);
  const now = new Date().toISOString();

  return {
    sql: FIXED_ASSET_INSERT_SQL,
    params: [
      asset.id,
      tenantId,
      accountSetId,
      asset.assetCode,
      asset.assetName,
      text(asset.categoryId),
      text(asset.categoryName),
      text(asset.unit, '台'),
      numberValue(asset.quantity, 1),
      numberValue(asset.remainingQuantity, 1),
      numberValue(asset.unitPrice, originalValue),
      originalValue,
      numberValue(asset.salvageValue, 0),
      numberValue(asset.depreciableValue, originalValue),
      numberValue(asset.accumulatedDepreciation, 0),
      numberValue(asset.netValue, originalValue),
      text(asset.depreciationMethod, 'straight_line'),
      numberValue(asset.usefulLifeYears, 10),
      usefulLifeMonths,
      numberValue(asset.remainingDepreciationMonths, usefulLifeMonths),
      text(asset.acquisitionDate),
      text(asset.depreciationStartDate),
      text(asset.status, 'active'),
      text(asset.accountingStatus, 'accounted'),
      text(asset.acquisitionType, 'opening_balance'),
      asset.isOpeningBalance ? 1 : 0,
      numberValue(asset.initialAccumulatedDepreciation, 0),
      text(asset.createTime, now),
      text(asset.updateTime, now),
    ],
  };
}

export async function saveFixedAssetRecord(input: {
  db: SqliteDatabaseLike;
  tenantId: string;
  accountSetId: string;
  asset: FixedAssetSaveInput;
  persist: () => Promise<void>;
}): Promise<void> {
  const insert = buildFixedAssetInsert(input.asset, input.tenantId, input.accountSetId);
  const stmt = input.db.prepare(insert.sql);
  try {
    stmt.run(insert.params);
  } finally {
    stmt.free();
  }
  await input.persist();
}
