import assert from 'assert';
import { dedupePartnersForAccountSet } from './src/lib/partner-dedupe';

interface PartnerDedupeTestRow {
  id: string;
  code: string;
  name: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  accountSetId: string;
  createTime: string;
  updateTime: string;
}

const rows: PartnerDedupeTestRow[] = [
  { id: 'p1', code: 'ABC001', name: '上海科技有限公司', isCustomer: true, isSupplier: false, isEmployee: false, accountSetId: 'as_001', createTime: '2026-01-01', updateTime: '2026-01-01' },
  { id: 'p2', code: 'ABC001', name: '上海科技有限公司', isCustomer: true, isSupplier: false, isEmployee: false, accountSetId: 'as_001', createTime: '2026-01-02', updateTime: '2026-01-02' },
  { id: 'p3', code: 'EMP001', name: '赵六', isCustomer: false, isSupplier: false, isEmployee: true, accountSetId: 'as_001', createTime: '2026-01-01', updateTime: '2026-01-01' },
  { id: 'p4', code: 'ABC001', name: '另一个账套客户', isCustomer: true, isSupplier: false, isEmployee: false, accountSetId: 'as_002', createTime: '2026-01-01', updateTime: '2026-01-01' },
];

const deduped = dedupePartnersForAccountSet(rows);

assert.strictEqual(deduped.length, 3);
assert.deepStrictEqual(deduped.map(p => p.id), ['p1', 'p3', 'p4']);

console.log('partner dedupe ok');
