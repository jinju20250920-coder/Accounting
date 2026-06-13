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
}

export interface PartnerOpeningSource {
  name: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
  openingBalance?: number;
}

export interface BankOpeningEntry {
  accountNumber: string;
  bankName: string;
  balance: number;
}

export interface AssetOpeningEntry {
  assetCode: string;
  assetName: string;
  originalValue: number;
  accumulatedDepreciation: number;
  netValue: number;
  included: boolean;
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

function differenceOrNull(input: Omit<SubledgerDifference, 'difference'>): SubledgerDifference | null {
  const difference = roundMoney(input.subjectBalance - input.detailBalance);
  if (Math.abs(difference) < MONEY_EPSILON) return null;
  return { ...input, difference };
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
      return {
        name: partner.name,
        type: partner.isSupplier && !partner.isCustomer ? 'payable' as const : 'receivable' as const,
        amount,
        remark: '往来单位期初余额',
      };
    })
    .filter((entry): entry is PartnerOpeningEntry => entry !== null);
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
  options?: { dbInstance?: any; sqliteService?: any },
): Promise<OpeningLockKeys> {
  const db = options?.dbInstance ?? options?.sqliteService?.dbInstance;
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
