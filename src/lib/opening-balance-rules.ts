export interface OpeningSubjectEntry {
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
}

export interface PartnerOpeningEntry {
  name: string;
  type: 'receivable' | 'payable';
  amount: number;
  remark: string;
  currency?: string;
  foreignAmount?: number;
  exchangeRate?: number;
}

export interface PartnerOpeningSource {
  name: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
  openingBalance?: number;
  defaultCurrency?: string;
  openingForeignBalance?: number;
  openingExchangeRate?: number;
}

export interface BankOpeningEntry {
  accountNumber: string;
  bankName: string;
  subjectCode?: string;
  subjectName?: string;
  balance: number;
  currency?: string;
  foreignBalance?: number | null;
  exchangeRate?: number | null;
}

export interface BankOpeningSource {
  accountNumber?: string;
  bankName?: string;
  aliasName?: string;
  currency?: string | null;
  subSubjectCode?: string;
  subSubjectName?: string;
}

export interface BankOpeningSavedBalance {
  balance?: number | null;
  foreignBalance?: number | null;
  exchangeRate?: number | null;
}

export interface AssetOpeningEntry {
  assetCode: string;
  assetName: string;
  originalValue: number;
  accumulatedDepreciation: number;
  netValue: number;
  included: boolean;
}

export interface AssetOpeningSource {
  assetCode: string;
  assetName: string;
  originalValue: number;
  accumulatedDepreciation: number;
  netValue: number;
}

export interface OpeningPostedVoucherEntryLike {
  summary?: string;
  subjectCode?: string;
  subjectName?: string;
  debit?: number;
  credit?: number;
  currencyCode?: string;
  currencyName?: string;
  originalAmount?: number;
  exchangeRate?: number;
  auxiliary?: {
    bankAccount?: string;
    customer?: string;
    supplier?: string;
    assetCode?: string;
    assetName?: string;
  };
}

export interface OpeningVoucherLike {
  id: string;
  voucherNo?: string;
  status?: 'draft' | 'review' | 'posted' | 'reversed' | string;
  date?: string;
  createTime?: string;
  updateTime?: string;
  entries?: OpeningPostedVoucherEntryLike[];
}

export interface OpeningPostedDetailIndex {
  bankBalances: Map<string, number>;
  partnerReceivables: Map<string, number>;
  partnerPayables: Map<string, number>;
  assetOriginalValues: Map<string, number>;
  assetAccumulatedDepreciation: Map<string, number>;
}

export type OpeningPostingStatus = 'posted' | 'partial' | 'unposted';

export interface BankOpeningRowState extends BankOpeningEntry {
  status: OpeningPostingStatus;
  postedAmount: number;
  unpostedAmount: number;
}

export interface PartnerOpeningRowState extends PartnerOpeningEntry {
  status: OpeningPostingStatus;
  postedAmount: number;
  unpostedAmount: number;
}

export interface AssetOpeningRowState extends AssetOpeningEntry {
  status: OpeningPostingStatus;
  postedOriginalValue: number;
  unpostedOriginalValue: number;
  postedAccumulatedDepreciation: number;
  unpostedAccumulatedDepreciation: number;
  postedNetValue: number;
  unpostedNetValue: number;
}

export interface SubledgerDifference {
  subjectCode: string;
  subjectName: string;
  subjectBalance: number;
  detailBalance: number;
  difference: number;
  source: 'bank' | 'customer' | 'supplier' | 'fixed_asset' | 'accumulated_depreciation';
}

export interface ControlledSubjectSummary {
  subjectCode: string;
  subjectName: string;
  detailBalance: number;
  userEnteredBalance: number;
  difference: number;
  source: 'bank' | 'customer' | 'supplier' | 'fixed_asset' | 'accumulated_depreciation';
  direction: 'debit' | 'credit';
  hasDetail: boolean;
}

export interface OpeningBalanceAnalysis {
  totalDebit: number;
  totalCredit: number;
  balanceDifference: number;
  isBalanced: boolean;
  adjustmentSide: 'debit' | 'credit' | null;
  subledgerDifferences: SubledgerDifference[];
  controlledSubjects: ControlledSubjectSummary[];
}

export interface OpeningAdjustmentEntryInput {
  subjectCode: string;
  subjectName: string;
  analysis: OpeningBalanceAnalysis;
  id: string;
  date: string;
}

export interface OpeningAdjustmentEntry {
  id: string;
  voucherId: string;
  date: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
}

const MONEY_EPSILON = 0.01;
const CONTROLLED_SUBJECT_PREFIXES = {
  bank: '1002',
  customer: '1122',
  supplier: '2202',
  fixedAsset: '1601',
  accumulatedDepreciation: '1602',
} as const;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getSubjectBalance(entries: OpeningSubjectEntry[], subjectCode: string): number {
  return roundMoney(
    entries
      .filter(entry => entry.subjectCode === subjectCode || entry.subjectCode.startsWith(`${subjectCode}`))
      .reduce((sum, entry) => sum + (entry.debit || 0) - (entry.credit || 0), 0),
  );
}

function approxEqual(left: number, right: number): boolean {
  return Math.abs(roundMoney(left - right)) < MONEY_EPSILON;
}

function getEntryAmount(entry: OpeningPostedVoucherEntryLike): number {
  return roundMoney((entry.debit || 0) - (entry.credit || 0));
}

function getOpeningEntryNameFromSummary(summary?: string, prefix?: string): string {
  if (!summary || !prefix || !summary.startsWith(prefix)) return '';
  return summary.substring(prefix.length);
}

function getPostedAssetKeys(entry: OpeningPostedVoucherEntryLike): string[] {
  const summary = entry.summary || '';
  const code = entry.auxiliary?.assetCode || '';
  const name = entry.auxiliary?.assetName || '';
  const summaryName = summary.startsWith('期初资产-')
    ? getOpeningEntryNameFromSummary(summary, '期初资产-')
    : summary.startsWith('期初累计折旧-')
      ? getOpeningEntryNameFromSummary(summary, '期初累计折旧-')
      : '';
  const keys = new Set<string>();
  const add = (value?: string) => {
    if (!value) return;
    keys.add(value);
    keys.add(`name:${value}`);
  };

  add(code);
  add(name);
  add(summaryName);

  return Array.from(keys);
}

function getAssetLookupKeys(row: AssetOpeningEntry): string[] {
  const keys = new Set<string>();
  const add = (value?: string) => {
    if (!value) return;
    keys.add(value);
    keys.add(`name:${value}`);
  };

  add(row.assetCode);
  add(row.assetName);
  return Array.from(keys);
}

function getPostedAssetAmount(map: Map<string, number>, row: AssetOpeningEntry): number {
  for (const key of getAssetLookupKeys(row)) {
    const amount = map.get(key);
    if (typeof amount === 'number' && Math.abs(amount) >= MONEY_EPSILON) {
      return amount;
    }
  }
  return 0;
}

export function analyzeOpeningBalance(input: {
  subjectEntries: OpeningSubjectEntry[];
  partnerEntries: PartnerOpeningEntry[];
  bankEntries: BankOpeningEntry[];
  assetEntries: AssetOpeningEntry[];
}): OpeningBalanceAnalysis {
  const customerDetail = roundMoney(
    input.partnerEntries
      .filter(entry => entry.type === 'receivable')
      .reduce((sum, entry) => sum + (entry.amount || 0), 0),
  );
  const supplierDetail = roundMoney(
    input.partnerEntries
      .filter(entry => entry.type === 'payable')
      .reduce((sum, entry) => sum + (entry.amount || 0), 0),
  );
  const bankDetail = roundMoney(input.bankEntries.reduce((sum, entry) => sum + (entry.balance || 0), 0));
  const includedAssets = input.assetEntries.filter(entry => entry.included);
  const assetOriginalDetail = roundMoney(includedAssets.reduce((sum, entry) => sum + (entry.originalValue || 0), 0));
  const accumulatedDepreciationDetail = roundMoney(
    includedAssets.reduce((sum, entry) => sum + (entry.accumulatedDepreciation || 0), 0),
  );
  const subjectEntriesForVoucher = input.subjectEntries.filter(
    entry => !hasSubledgerSourceForSubject(entry.subjectCode, input),
  );
  const subjectDebit = subjectEntriesForVoucher.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const subjectCredit = subjectEntriesForVoucher.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  const bankDebit = input.bankEntries.reduce((sum, entry) => sum + Math.max(entry.balance || 0, 0), 0);
  const bankCredit = input.bankEntries.reduce((sum, entry) => sum + Math.max(-(entry.balance || 0), 0), 0);
  const totalDebit = roundMoney(subjectDebit + customerDetail + bankDebit + assetOriginalDetail);
  const totalCredit = roundMoney(subjectCredit + supplierDetail + bankCredit + accumulatedDepreciationDetail);
  const signedDifference = roundMoney(totalDebit - totalCredit);
  const balanceDifference = Math.abs(signedDifference);

  const controlledInputs = [
    {
      subjectCode: '1002',
      subjectName: '银行存款',
      detailBalance: bankDetail,
      userEnteredBalance: getSubjectBalance(input.subjectEntries, '1002'),
      source: 'bank' as const,
      direction: 'debit' as const,
    },
    {
      subjectCode: '1122',
      subjectName: '应收账款',
      detailBalance: customerDetail,
      userEnteredBalance: getSubjectBalance(input.subjectEntries, '1122'),
      source: 'customer' as const,
      direction: 'debit' as const,
    },
    {
      subjectCode: '2202',
      subjectName: '应付账款',
      detailBalance: supplierDetail,
      userEnteredBalance: Math.abs(getSubjectBalance(input.subjectEntries, '2202')),
      source: 'supplier' as const,
      direction: 'credit' as const,
    },
    {
      subjectCode: '1601',
      subjectName: '固定资产',
      detailBalance: assetOriginalDetail,
      userEnteredBalance: getSubjectBalance(input.subjectEntries, '1601'),
      source: 'fixed_asset' as const,
      direction: 'debit' as const,
    },
    {
      subjectCode: '1602',
      subjectName: '累计折旧',
      detailBalance: accumulatedDepreciationDetail,
      userEnteredBalance: Math.abs(getSubjectBalance(input.subjectEntries, '1602')),
      source: 'accumulated_depreciation' as const,
      direction: 'credit' as const,
    },
  ];

  const controlledSubjects: ControlledSubjectSummary[] = controlledInputs.map(item => ({
    subjectCode: item.subjectCode,
    subjectName: item.subjectName,
    detailBalance: item.detailBalance,
    userEnteredBalance: item.userEnteredBalance,
    difference: roundMoney(item.userEnteredBalance - item.detailBalance),
    source: item.source,
    direction: item.direction,
    hasDetail: item.detailBalance >= MONEY_EPSILON,
  }));

  const subledgerDifferences: SubledgerDifference[] = controlledSubjects
    .filter(item => Math.abs(item.difference) >= MONEY_EPSILON)
    .map(item => ({
      subjectCode: item.subjectCode,
      subjectName: item.subjectName,
      subjectBalance: item.userEnteredBalance,
      detailBalance: item.detailBalance,
      difference: item.difference,
      source: item.source,
    }));

  return {
    totalDebit,
    totalCredit,
    balanceDifference,
    isBalanced: balanceDifference < MONEY_EPSILON,
    adjustmentSide: balanceDifference < MONEY_EPSILON ? null : signedDifference > 0 ? 'credit' : 'debit',
    subledgerDifferences,
    controlledSubjects,
  };
}

export function buildOpeningAdjustmentEntry(input: OpeningAdjustmentEntryInput): OpeningAdjustmentEntry | null {
  if (input.analysis.isBalanced || !input.analysis.adjustmentSide) return null;

  return {
    id: input.id,
    voucherId: '',
    date: input.date,
    summary: '期初平衡调整',
    subjectCode: input.subjectCode,
    subjectName: input.subjectName,
    debit: input.analysis.adjustmentSide === 'debit' ? input.analysis.balanceDifference : 0,
    credit: input.analysis.adjustmentSide === 'credit' ? input.analysis.balanceDifference : 0,
  };
}

export function buildPartnerOpeningEntriesFromPartners(partners: PartnerOpeningSource[]): PartnerOpeningEntry[] {
  return partners
    .map((partner): PartnerOpeningEntry | null => {
      const amount = roundMoney(Math.abs(partner.openingBalance || 0));
      if (!partner.name || amount < MONEY_EPSILON) return null;
      const currency = partner.defaultCurrency && partner.defaultCurrency !== 'CNY' && partner.defaultCurrency !== 'RMB'
        ? partner.defaultCurrency
        : undefined;
      const foreign = currency && partner.openingForeignBalance ? Math.abs(partner.openingForeignBalance) : undefined;
      const rate = currency && partner.openingExchangeRate && partner.openingExchangeRate > 0 ? partner.openingExchangeRate : undefined;
      return {
        name: partner.name,
        type: partner.isSupplier && !partner.isCustomer ? 'payable' as const : 'receivable' as const,
        amount,
        remark: '往来单位期初余额',
        currency,
        foreignAmount: foreign,
        exchangeRate: rate,
      };
    })
    .filter((entry): entry is PartnerOpeningEntry => entry !== null);
}

export function mergeOpeningEntriesByKey<T>(
  current: T[],
  incoming: T[],
  getKey: (entry: T) => string,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const entry of current) {
    const key = getKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  for (const entry of incoming) {
    const key = getKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged;
}

export function mergePartnerOpeningEntriesFromPartners(
  current: PartnerOpeningEntry[],
  partners: PartnerOpeningSource[],
): PartnerOpeningEntry[] {
  return mergeOpeningEntriesByKey(
    current,
    buildPartnerOpeningEntriesFromPartners(partners),
    entry => `${entry.type}:${entry.name}`,
  );
}

export function buildBankOpeningEntriesFromBindings(
  bindings: BankOpeningSource[],
  savedByAccount: Map<string, BankOpeningSavedBalance>,
): BankOpeningEntry[] {
  return bindings
    .map((binding): BankOpeningEntry | null => {
      const accountNumber = binding.accountNumber || '';
      if (!accountNumber) return null;
      const saved = savedByAccount.get(accountNumber);
      return {
        accountNumber,
        bankName: binding.bankName || binding.aliasName || '',
        subjectCode: binding.subSubjectCode || '1002',
        subjectName: binding.subSubjectName || '银行存款',
        balance: saved?.balance ?? 0,
        currency: binding.currency || 'CNY',
        foreignBalance: saved?.foreignBalance ?? null,
        exchangeRate: saved?.exchangeRate ?? null,
      };
    })
    .filter((entry): entry is BankOpeningEntry => entry !== null);
}

export function buildAssetOpeningEntriesFromAssets(assets: AssetOpeningSource[]): AssetOpeningEntry[] {
  return assets.map(asset => ({
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    originalValue: asset.originalValue,
    accumulatedDepreciation: asset.accumulatedDepreciation,
    netValue: asset.netValue,
    included: true,
  }));
}

export function collectPostedOpeningDetailIndex(
  entries: OpeningPostedVoucherEntryLike[],
): OpeningPostedDetailIndex {
  const bankBalances = new Map<string, number>();
  const partnerReceivables = new Map<string, number>();
  const partnerPayables = new Map<string, number>();
  const assetOriginalValues = new Map<string, number>();
  const assetAccumulatedDepreciation = new Map<string, number>();

  for (const entry of entries) {
    const summary = entry.summary || '';
    const amount = getEntryAmount(entry);

    if (summary.startsWith('期初银行-')) {
      const accountNumber = entry.auxiliary?.bankAccount || '';
      if (!accountNumber) continue;
      bankBalances.set(accountNumber, roundMoney((bankBalances.get(accountNumber) || 0) + amount));
      continue;
    }

    if (summary.startsWith('期初应收-')) {
      const customer = entry.auxiliary?.customer || getOpeningEntryNameFromSummary(summary, '期初应收-');
      if (!customer) continue;
      partnerReceivables.set(customer, roundMoney((partnerReceivables.get(customer) || 0) + amount));
      continue;
    }

    if (summary.startsWith('期初应付-')) {
      const supplier = entry.auxiliary?.supplier || getOpeningEntryNameFromSummary(summary, '期初应付-');
      if (!supplier) continue;
      partnerPayables.set(supplier, roundMoney((partnerPayables.get(supplier) || 0) + Math.abs(amount)));
      continue;
    }

    if (summary.startsWith('期初资产-')) {
      const keys = getPostedAssetKeys(entry);
      if (keys.length === 0) continue;
      const postedAmount = roundMoney(Math.max(amount, 0));
      for (const key of keys) {
        assetOriginalValues.set(key, roundMoney((assetOriginalValues.get(key) || 0) + postedAmount));
      }
      continue;
    }

    if (summary.startsWith('期初累计折旧-')) {
      const keys = getPostedAssetKeys(entry);
      if (keys.length === 0) continue;
      const postedAmount = roundMoney(Math.abs(Math.min(amount, 0)));
      for (const key of keys) {
        assetAccumulatedDepreciation.set(key, roundMoney((assetAccumulatedDepreciation.get(key) || 0) + postedAmount));
      }
    }
  }

  return {
    bankBalances,
    partnerReceivables,
    partnerPayables,
    assetOriginalValues,
    assetAccumulatedDepreciation,
  };
}

export function deriveBankOpeningRowStates(
  rows: BankOpeningEntry[],
  index: OpeningPostedDetailIndex,
): BankOpeningRowState[] {
  return rows.map(row => {
    const current = roundMoney(row.balance || 0);
    const posted = roundMoney(index.bankBalances.get(row.accountNumber) || 0);
    const unposted = roundMoney(current - posted);
    return {
      ...row,
      status: approxEqual(current, posted) ? 'posted' : approxEqual(posted, 0) ? 'unposted' : 'partial',
      postedAmount: posted,
      unpostedAmount: unposted,
    };
  });
}

export function derivePartnerOpeningRowStates(
  rows: PartnerOpeningEntry[],
  index: OpeningPostedDetailIndex,
): PartnerOpeningRowState[] {
  return rows.map(row => {
    const key = row.type === 'receivable' ? index.partnerReceivables.get(row.name) : index.partnerPayables.get(row.name);
    const posted = roundMoney(key || 0);
    const current = roundMoney(row.amount || 0);
    const unposted = roundMoney(current - posted);
    return {
      ...row,
      status: approxEqual(current, posted) ? 'posted' : approxEqual(posted, 0) ? 'unposted' : 'partial',
      postedAmount: posted,
      unpostedAmount: unposted,
    };
  });
}

export function deriveAssetOpeningRowStates(
  rows: AssetOpeningEntry[],
  index: OpeningPostedDetailIndex,
): AssetOpeningRowState[] {
  return rows.map(row => {
    const postedOriginalValue = roundMoney(getPostedAssetAmount(index.assetOriginalValues, row));
    const postedAccumulatedDepreciation = roundMoney(getPostedAssetAmount(index.assetAccumulatedDepreciation, row));
    const currentOriginalValue = roundMoney(row.originalValue || 0);
    const currentAccumulatedDepreciation = roundMoney(row.accumulatedDepreciation || 0);
    const unpostedOriginalValue = roundMoney(currentOriginalValue - postedOriginalValue);
    const unpostedAccumulatedDepreciation = roundMoney(currentAccumulatedDepreciation - postedAccumulatedDepreciation);
    const currentNetValue = roundMoney(row.netValue || (currentOriginalValue - currentAccumulatedDepreciation));
    const postedNetValue = roundMoney(postedOriginalValue - postedAccumulatedDepreciation);
    const unpostedNetValue = roundMoney(currentNetValue - postedNetValue);
    const fullyPosted = approxEqual(currentOriginalValue, postedOriginalValue)
      && approxEqual(currentAccumulatedDepreciation, postedAccumulatedDepreciation);
    const hasAnyPosted = !approxEqual(postedOriginalValue, 0) || !approxEqual(postedAccumulatedDepreciation, 0);

    return {
      ...row,
      status: fullyPosted ? 'posted' : hasAnyPosted ? 'partial' : 'unposted',
      postedOriginalValue,
      unpostedOriginalValue,
      postedAccumulatedDepreciation,
      unpostedAccumulatedDepreciation,
      postedNetValue,
      unpostedNetValue,
    };
  });
}

export function resolvePostedOpeningVoucher(
  vouchers: OpeningVoucherLike[],
  accountSetId: string,
): OpeningVoucherLike | null {
  const stableId = `opening_balance_${accountSetId}`;
  const exactStablePosted = vouchers.find(voucher => voucher.id === stableId && voucher.status === 'posted');
  if (exactStablePosted) return exactStablePosted;

  const openingPosted = vouchers
    .filter(voucher => voucher.id.startsWith('opening_') && voucher.status === 'posted')
    .sort((left, right) => {
      const leftTime = new Date(left.updateTime || left.createTime || left.date || 0).getTime();
      const rightTime = new Date(right.updateTime || right.createTime || right.date || 0).getTime();
      if (rightTime !== leftTime) return rightTime - leftTime;
      return right.id.localeCompare(left.id);
    });

  return openingPosted[0] || null;
}

export function hasSubledgerSourceForSubject(
  subjectCode: string,
  input: {
    partnerEntries: PartnerOpeningEntry[];
    bankEntries: BankOpeningEntry[];
    assetEntries: AssetOpeningEntry[];
  },
): boolean {
  const hasBankDetail = input.bankEntries.some(entry => entry.accountNumber && Math.abs(entry.balance || 0) >= MONEY_EPSILON);
  if (subjectCode.startsWith(CONTROLLED_SUBJECT_PREFIXES.bank)) return hasBankDetail;

  const hasCustomerDetail = input.partnerEntries.some(
    entry => entry.type === 'receivable' && entry.name && (entry.amount || 0) > 0,
  );
  if (subjectCode.startsWith(CONTROLLED_SUBJECT_PREFIXES.customer)) return hasCustomerDetail;

  const hasSupplierDetail = input.partnerEntries.some(
    entry => entry.type === 'payable' && entry.name && (entry.amount || 0) > 0,
  );
  if (subjectCode.startsWith(CONTROLLED_SUBJECT_PREFIXES.supplier)) return hasSupplierDetail;

  const hasAssetDetail = input.assetEntries.some(entry => entry.included);
  if (subjectCode.startsWith(CONTROLLED_SUBJECT_PREFIXES.fixedAsset)) return hasAssetDetail;
  if (subjectCode.startsWith(CONTROLLED_SUBJECT_PREFIXES.accumulatedDepreciation)) return hasAssetDetail;

  return false;
}

// ════════════════════════════════════════════
// Posted-row lock detection
// ════════════════════════════════════════════

export interface OpeningLockKeys {
  hasOpeningVoucher: boolean;
  bankKeys: Set<string>;     // accountNumber (unique) — preferred matching key
  partnerKeys: Set<string>;  // partner name
  assetKeys: Set<string>;    // asset name
}

interface OpeningLockDbLike {
  exec: (sql: string) => Array<{ values?: unknown[][] }>;
}

const EMPTY_LOCK_KEYS: OpeningLockKeys = {
  hasOpeningVoucher: false,
  bankKeys: new Set(),
  partnerKeys: new Set(),
  assetKeys: new Set(),
};

/**
 * Reads the opening balance voucher's entry summaries to figure out which
 * bank accounts / partners / assets have already been posted. Each step
 * (bank/partners/fixed-assets) uses these sets to lock amount fields and
 * the delete button on rows that have already entered the ledger, so users
 * must reverse the opening voucher rather than silently edit posted numbers.
 */
export async function loadOpeningBalanceLockKeys(
  accountSetId: string,
  options?: { dbInstance?: OpeningLockDbLike; sqliteService?: unknown },
): Promise<OpeningLockKeys> {
  const db = options?.dbInstance
    ?? (options?.sqliteService as { dbInstance?: OpeningLockDbLike } | undefined)?.dbInstance;
  if (!db) {
    console.warn('[loadOpeningBalanceLockKeys] db not ready for', accountSetId);
    return EMPTY_LOCK_KEYS;
  }

  try {
    // Scan entries from ALL opening vouchers for this account set — both the new
    // stable ID (opening_balance_<accountSetId>) and legacy timestamp-based IDs
    // (opening_<timestamp>). The setup wizard's cleanup only runs on re-save,
    // so older test data may still have the old format.
    //
    // For banks we read auxiliary.bankAccount (unique accountNumber). Falling back
    // to bankName would falsely lock any new row added at the same bank, since the
    // summary only carries the bank name (建行 has many accounts).
    const result = db.exec(
      `SELECT e.summary, e.auxiliary FROM entries e
       INNER JOIN vouchers v ON e.voucherId = v.id
       WHERE e.accountSetId = '${accountSetId}'
       AND e.voucherId LIKE 'opening_%'
       AND v.id LIKE 'opening_%'`,
    );
    if (!result || !result[0] || !result[0].values || result[0].values.length === 0) {
      return EMPTY_LOCK_KEYS;
    }

    const bankKeys = new Set<string>();
    const partnerKeys = new Set<string>();
    const assetKeys = new Set<string>();

    for (const row of result[0].values) {
      const summary = typeof row[0] === 'string' ? row[0] : '';
      if (!summary) continue;
      if (summary.startsWith('期初银行-')) {
        // Prefer auxiliary.bankAccount (unique). Legacy entries without it are skipped —
        // the user can re-save opening to migrate.
        const auxiliaryRaw = typeof row[1] === 'string' ? row[1] : '';
        if (auxiliaryRaw) {
          try {
            const auxiliary = JSON.parse(auxiliaryRaw);
            const accountNumber = auxiliary?.bankAccount;
            if (typeof accountNumber === 'string' && accountNumber) {
              bankKeys.add(accountNumber);
            }
          } catch { /* skip malformed auxiliary */ }
        }
      } else if (summary.startsWith('期初应收-')) {
        partnerKeys.add(summary.substring('期初应收-'.length));
      } else if (summary.startsWith('期初应付-')) {
        partnerKeys.add(summary.substring('期初应付-'.length));
      } else if (summary.startsWith('期初资产-')) {
        assetKeys.add(summary.substring('期初资产-'.length));
      } else if (summary.startsWith('期初累计折旧-')) {
        assetKeys.add(summary.substring('期初累计折旧-'.length));
      }
    }

    return { hasOpeningVoucher: true, bankKeys, partnerKeys, assetKeys };
  } catch (err) {
    console.warn('loadOpeningBalanceLockKeys failed:', err);
    return EMPTY_LOCK_KEYS;
  }
}
