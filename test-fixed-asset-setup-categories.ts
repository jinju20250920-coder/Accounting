import assert from 'node:assert/strict';
import { getFixedAssetSetupCategories } from './src/lib/fixed-asset-setup-categories';

assert.deepEqual(
  getFixedAssetSetupCategories([]).map(category => ({
    code: category.code,
    name: category.name,
    years: category.defaultUsefulLifeYears,
    method: category.defaultDepreciationMethod,
  })),
  [
    { code: 'ELECTRONIC', name: '\u7535\u5b50\u8bbe\u5907', years: 3, method: 'straight_line' },
    { code: 'VEHICLE', name: '\u8fd0\u8f93\u5de5\u5177', years: 4, method: 'straight_line' },
    { code: 'FURNITURE', name: '\u529e\u516c\u5bb6\u5177', years: 5, method: 'straight_line' },
    { code: 'MACHINERY', name: '\u673a\u5668\u8bbe\u5907', years: 10, method: 'straight_line' },
    { code: 'BUILDING', name: '\u623f\u5c4b\u5efa\u7b51\u7269', years: 20, method: 'straight_line' },
  ],
);

assert.deepEqual(
  getFixedAssetSetupCategories([
    {
      id: 'custom-1',
      code: 'CUSTOM',
      name: '\u81ea\u5b9a\u4e49\u8bbe\u5907',
      assetType: 'fixed',
      defaultUsefulLifeYears: 8,
      defaultDepreciationMethod: 'double_declining',
      defaultSalvageRate: 0.05,
      assetSubjectCode: '1601',
      depreciationSubjectCode: '1602',
      expenseSubjectCode: '6602',
      sortOrder: 1,
      enabled: true,
      createTime: '2026-01-01',
      updateTime: '2026-01-01',
    },
    {
      id: 'intangible-1',
      code: 'SOFTWARE',
      name: '\u8f6f\u4ef6',
      assetType: 'intangible',
      defaultUsefulLifeYears: 10,
      defaultDepreciationMethod: 'straight_line',
      defaultSalvageRate: 0,
      assetSubjectCode: '1701',
      depreciationSubjectCode: '1702',
      expenseSubjectCode: '6602',
      sortOrder: 2,
      enabled: true,
      createTime: '2026-01-01',
      updateTime: '2026-01-01',
    },
  ]).map(category => category.code),
  ['CUSTOM'],
);

console.log('fixed asset setup categories ok');
