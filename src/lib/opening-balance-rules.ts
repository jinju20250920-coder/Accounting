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

export interface OpeningBalanceAnalysis {
  totalDebit: number;
  totalCredit: number;
  balanceDifference: number;
  isBalanced: boolean;
  adjustmentSide: 'debit' | 'credit' | null;
  subledgerDifferences: SubledgerDifference[];
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

  const candidates = [
    differenceOrNull({
      subjectCode: '1002',
      subjectName: '银行存款',
      subjectBalance: getSubjectBalance(input.subjectEntries, '1002'),
      detailBalance: bankDetail,
      source: 'bank',
    }),
    differenceOrNull({
      subjectCode: '1122',
      subjectName: '应收账款',
      subjectBalance: getSubjectBalance(input.subjectEntries, '1122'),
      detailBalance: customerDetail,
      source: 'customer',
    }),
    differenceOrNull({
      subjectCode: '2202',
      subjectName: '应付账款',
      subjectBalance: Math.abs(getSubjectBalance(input.subjectEntries, '2202')),
      detailBalance: supplierDetail,
      source: 'supplier',
    }),
    differenceOrNull({
      subjectCode: '1601',
      subjectName: '固定资产',
      subjectBalance: getSubjectBalance(input.subjectEntries, '1601'),
      detailBalance: assetOriginalDetail,
      source: 'fixed_asset',
    }),
    differenceOrNull({
      subjectCode: '1602',
      subjectName: '累计折旧',
      subjectBalance: Math.abs(getSubjectBalance(input.subjectEntries, '1602')),
      detailBalance: accumulatedDepreciationDetail,
      source: 'accumulated_depreciation',
    }),
  ];

  return {
    totalDebit,
    totalCredit,
    balanceDifference,
    isBalanced: balanceDifference < MONEY_EPSILON,
    adjustmentSide: balanceDifference < MONEY_EPSILON ? null : signedDifference > 0 ? 'credit' : 'debit',
    subledgerDifferences: candidates.filter((item): item is SubledgerDifference => item !== null),
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
