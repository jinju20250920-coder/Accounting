import type { AssetCategory } from '../types';

export const DEFAULT_FIXED_ASSET_SETUP_CATEGORIES: AssetCategory[] = [
  {
    id: 'default-fixed',
    code: 'FIXED',
    name: '固定资产',
    assetType: 'fixed',
    defaultUsefulLifeYears: 5,
    defaultDepreciationMethod: 'straight_line',
    defaultSalvageRate: 0.05,
    depreciationStartRule: 'next_month',
    assetSubjectCode: '1501',
    depreciationSubjectCode: '1502',
    expenseSubjectCode: '660204',
    description: '企业持有的为生产商品、提供劳务、出租或经营管理而持有的使用寿命超过1年的有形资产',
    sortOrder: 1,
    enabled: true,
    createTime: '',
    updateTime: '',
  },
];

export function getFixedAssetSetupCategories(categories: AssetCategory[]): AssetCategory[] {
  const activeFixedCategories = categories.filter(
    category => category.enabled !== false && category.assetType !== 'intangible',
  );

  return activeFixedCategories.length > 0
    ? activeFixedCategories
    : DEFAULT_FIXED_ASSET_SETUP_CATEGORIES;
}
