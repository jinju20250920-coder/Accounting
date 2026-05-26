import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebar = fs.readFileSync('src/components/layout/sidebar.tsx', 'utf8');
const voucherList = fs.readFileSync('src/app/voucher-list/page.tsx', 'utf8');

assert.doesNotMatch(sidebar, /凭证序时账/, 'sidebar should not expose voucher journal as a top-level item');
assert.doesNotMatch(sidebar, /path: '\/voucher-journal'/, 'sidebar should not link to the standalone voucher journal page');

assert.match(voucherList, /序时账/, 'voucher list should keep a journal-style entry view');
assert.doesNotMatch(voucherList, /GL序列|GL凭证序列/, 'voucher list journal view should use accounting-facing journal wording');

console.log('voucher journal navigation tests passed');
