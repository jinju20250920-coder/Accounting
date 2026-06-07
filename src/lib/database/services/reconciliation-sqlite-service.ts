import type { OutstandingItem, OutstandingQuery, RecRelation } from '../../../types';
import type { SqliteBindable, SqliteDatabaseLike } from './fixed-asset-sqlite-service';

// ── Row types (what SQLite returns) ──

export interface RecRelationRow {
  id: string;
  recRefNo: string;
  debitEntryId: string;
  creditEntryId: string;
  amount: number;
  recDate: string;
  partnerName: string | null;
  accountSetId: string;
  createTime: string | null;
  updateTime: string | null;
}

export interface EntryRow {
  id: string;
  voucherId: string;
  subjectCode: string;
  subjectName: string;
  direction: string;
  debit: number;
  credit: number;
  summary: string | null;
  customerName: string | null;
  supplierName: string | null;
  auxiliary: string | null;
  recRefNo: string | null;
  docNo: string | null;
  date: string;
  accountSetId: string;
}

// ── Query service interface ──

export interface ReconciliationQueryService {
  queryAllAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T[]>;
  querySingleAsync<T>(sql: string, params?: SqliteBindable[]): Promise<T | null>;
}

// ── SQL constants ──

const REC_RELATION_INSERT_SQL = `
  INSERT OR REPLACE INTO recRelations (
    id, recRefNo, debitEntryId, creditEntryId, amount, recDate,
    partnerName, accountSetId, createTime, updateTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// ── Mapper ──

function text(value: string | null | undefined, fallback = ''): string {
  return value ?? fallback;
}

export function mapRecRelationRow(row: RecRelationRow): RecRelation {
  return {
    id: row.id,
    debitEntryId: row.debitEntryId,
    creditEntryId: row.creditEntryId,
    amount: row.amount || 0,
    recRefNo: text(row.recRefNo),
    recDate: text(row.recDate),
    createdBy: '',
    createTime: text(row.createTime),
    updateTime: text(row.updateTime),
    accountSetId: row.accountSetId,
  };
}

// ── Write operations ──

function buildRecRelationParams(relation: RecRelation, accountSetId: string, now: string): SqliteBindable[] {
  return [
    relation.id,
    relation.recRefNo || '',
    relation.debitEntryId,
    relation.creditEntryId,
    relation.amount || 0,
    relation.recDate || new Date().toISOString().split('T')[0],
    '', // partnerName
    accountSetId,
    relation.createTime || now,
    relation.updateTime || now,
  ];
}

export async function saveRecRelationsRecord(input: {
  db: SqliteDatabaseLike;
  relations: RecRelation[];
  accountSetId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  for (const relation of input.relations) {
    const stmt = input.db.prepare(REC_RELATION_INSERT_SQL);
    try {
      stmt.run(buildRecRelationParams(relation, input.accountSetId, now));
    } finally {
      stmt.free();
    }
  }
}

export async function saveRecRelationRecord(input: {
  db: SqliteDatabaseLike;
  relation: RecRelation;
  accountSetId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const stmt = input.db.prepare(REC_RELATION_INSERT_SQL);
  try {
    stmt.run(buildRecRelationParams(input.relation, input.accountSetId, now));
  } finally {
    stmt.free();
  }
}

export async function updateEntryRecRefNoRecord(input: {
  db: SqliteDatabaseLike;
  entryId: string;
  recRefNo: string;
  accountSetId: string;
}): Promise<void> {
  const stmt = input.db.prepare(
    `UPDATE entries SET recRefNo = ? WHERE id = ? AND accountSetId = ?`,
  );
  try {
    stmt.run([input.recRefNo, input.entryId, input.accountSetId]);
  } finally {
    stmt.free();
  }
}

// ── Read operations ──

export async function listRecRelations(
  service: ReconciliationQueryService,
  accountSetId: string,
): Promise<RecRelation[]> {
  const rows = await service.queryAllAsync<RecRelationRow>(
    `SELECT * FROM recRelations WHERE accountSetId = ?`,
    [accountSetId],
  );
  return rows.map(mapRecRelationRow);
}

export async function findRecRelationsByRecRefNo(
  service: ReconciliationQueryService,
  accountSetId: string,
  recRefNo: string,
): Promise<RecRelation[]> {
  const rows = await service.queryAllAsync<RecRelationRow>(
    `SELECT * FROM recRelations WHERE recRefNo = ? AND accountSetId = ?`,
    [recRefNo, accountSetId],
  );
  return rows.map(mapRecRelationRow);
}

export async function findRecRelationsByEntryId(
  service: ReconciliationQueryService,
  accountSetId: string,
  entryId: string,
): Promise<RecRelation[]> {
  const debitRows = await service.queryAllAsync<RecRelationRow>(
    `SELECT * FROM recRelations WHERE debitEntryId = ? AND accountSetId = ?`,
    [entryId, accountSetId],
  );
  const creditRows = await service.queryAllAsync<RecRelationRow>(
    `SELECT * FROM recRelations WHERE creditEntryId = ? AND accountSetId = ?`,
    [entryId, accountSetId],
  );
  return [...debitRows, ...creditRows].map(mapRecRelationRow);
}

export async function getOutstandingItems(
  service: ReconciliationQueryService,
  accountSetId: string,
  query: OutstandingQuery,
): Promise<OutstandingItem[]> {
  if (!query.partnerName) return [];

  const allEntries = await service.queryAllAsync<EntryRow>(
    `SELECT * FROM entries WHERE accountSetId = ?`,
    [accountSetId],
  );

  let partnerEntries = allEntries.filter(entry => {
    const aux = entry.auxiliary ? JSON.parse(entry.auxiliary) : {};
    return (
      entry.customerName === query.partnerName ||
      entry.supplierName === query.partnerName ||
      aux?.customer === query.partnerName ||
      aux?.supplier === query.partnerName
    );
  });

  if (query.subjectCode) {
    partnerEntries = partnerEntries.filter(e => e.subjectCode === query.subjectCode);
  }

  if (query.startDate && query.endDate) {
    partnerEntries = partnerEntries.filter(e => e.date >= query.startDate && e.date <= query.endDate);
  }

  const items: OutstandingItem[] = [];

  for (const entry of partnerEntries) {
    const relations = await findRecRelationsByEntryId(service, accountSetId, entry.id);
    const totalRecAmount = relations.reduce((sum, rel) => sum + rel.amount, 0);
    const entryAmount = entry.debit > 0 ? entry.debit : entry.credit;
    const remainingAmount = entryAmount - totalRecAmount;

    if (remainingAmount > 0.001) {
      if (query.amountRange) {
        if (remainingAmount < query.amountRange[0] || remainingAmount > query.amountRange[1]) {
          continue;
        }
      }

      items.push({
        entryId: entry.id,
        voucherNo: '', // not on EntryRow, would need a join
        docNo: text(entry.docNo),
        date: entry.date,
        summary: text(entry.summary),
        amount: entryAmount,
        remainingAmount,
        direction: entry.debit > 0 ? 'debit' : 'credit',
        partnerName: text(entry.customerName || entry.supplierName) || query.partnerName,
      });
    }
  }

  return items;
}

export async function calculatePartnerBalance(
  service: ReconciliationQueryService,
  accountSetId: string,
  partnerName: string,
): Promise<number> {
  const items = await getOutstandingItems(service, accountSetId, {
    partnerName,
    subjectCode: '',
    startDate: '',
    endDate: '',
    amountRange: [0, Infinity],
  });

  const debitSum = items
    .filter(item => item.direction === 'debit')
    .reduce((sum, item) => sum + item.remainingAmount, 0);

  const creditSum = items
    .filter(item => item.direction === 'credit')
    .reduce((sum, item) => sum + item.remainingAmount, 0);

  return debitSum - creditSum;
}
