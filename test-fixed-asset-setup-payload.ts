import assert from 'node:assert/strict';
import { buildFixedAssetSetupPayload } from './src/lib/fixed-asset-setup-payload';
import { buildFixedAssetInsert } from './src/lib/database/services/fixed-asset-sqlite-service';

const payload = buildFixedAssetSetupPayload({
  row: {
    assetName: '办公电脑',
    categoryId: 'cat-electronic',
    categoryName: '电子设备',
    originalValue: 10000,
    accumulatedDepreciation: 1200,
    acquisitionDate: '2026-01-15',
    depreciationMethod: 'straight_line',
    usefulLifeYears: 5,
  },
  index: 0,
  accountSetId: 'set-1',
  fallbackDate: '2026-01-01',
  now: '2026-06-07T00:00:00.000Z',
});

assert.equal(payload.id, 'set-1_opening_asset_0001');
assert.equal(payload.assetCode, 'FA0001');
assert.equal(payload.categoryId, 'cat-electronic');
assert.equal(payload.categoryName, '电子设备');
assert.equal(payload.acquisitionDate, '2026-01-15');
assert.equal(payload.depreciationMethod, 'straight_line');
assert.equal(payload.netValue, 8800);
assert.equal(payload.accountSetId, 'set-1');

for (const [key, value] of Object.entries(payload)) {
  assert.notEqual(value, undefined, `${key} should not be undefined`);
}

const insert = buildFixedAssetInsert(payload, 'set-1');
assert.equal(insert.params.length, 27);
assert.equal(insert.params[4], 'cat-electronic');
assert.equal(insert.params[5], '电子设备');
insert.params.forEach((value, index) => {
  assert.notEqual(value, undefined, `insert param ${index} should not be undefined`);
});

const fallbackPayload = buildFixedAssetSetupPayload({
  row: {
    assetName: '桌椅',
    categoryId: '',
    categoryName: '',
    originalValue: 2000,
    accumulatedDepreciation: 0,
    acquisitionDate: '',
    depreciationMethod: '',
    usefulLifeYears: 0,
  },
  index: 1,
  accountSetId: 'set-1',
  fallbackDate: '2026-01-01',
  now: '2026-06-07T00:00:00.000Z',
});

assert.equal(fallbackPayload.categoryId, '');
assert.equal(fallbackPayload.categoryName, '通用设备');
assert.equal(fallbackPayload.acquisitionDate, '2026-01-01');
assert.equal(fallbackPayload.usefulLifeYears, 10);
assert.equal(fallbackPayload.usefulLifeMonths, 120);

console.log('fixed asset setup payload ok');
