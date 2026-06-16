import type { Voucher } from '../types';

export interface VoucherNumberingConfig {
  word?: string;
  period?: 'monthly' | 'yearly' | 'continuous';
  digits?: 3 | 4 | 5;
  useClassified?: boolean;
  classifiedWords?: {
    receipt: string;
    payment: string;
    general: string;
  };
}

export function resolveVoucherWord(
  cfg: VoucherNumberingConfig | undefined,
  voucherType?: string
): string {
  if (cfg?.useClassified && voucherType) {
    const classifiedWords = cfg.classifiedWords || { receipt: '收', payment: '付', general: '记' };
    if (voucherType === 'receipt') return classifiedWords.receipt;
    if (voucherType === 'payment') return classifiedWords.payment;
    return classifiedWords.general;
  }

  return cfg?.word || '记';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatDatePrefix(date: string, period: VoucherNumberingConfig['period']): string {
  const yearMonth = date.substring(0, 7).replace('-', '');
  const year = date.substring(0, 4);

  if (period === 'yearly') return year;
  if (period === 'continuous') return '';
  return yearMonth;
}

function isAlreadyFormatted(voucherNo: string, word: string, datePrefix: string, digits: number): boolean {
  if (!voucherNo) return false;

  if (datePrefix) {
    return new RegExp(`^${escapeRegExp(word)}-${datePrefix}-\\d{${digits}}$`).test(voucherNo);
  }

  return new RegExp(`^${escapeRegExp(word)}-\\d{${digits}}$`).test(voucherNo);
}

function isLegacyVoucherNo(voucherNo: string): boolean {
  return (
    /^\d{4}-\d{2}-\d+$/.test(voucherNo) ||
    /^\d{6}-\d+$/.test(voucherNo) ||
    /^\d{4}-\d+$/.test(voucherNo) ||
    /^\d+$/.test(voucherNo)
  );
}

function extractSequence(voucherNo: string, digits: number): string | null {
  const exactDigits = voucherNo.match(new RegExp(`(\\d{${digits}})$`));
  if (exactDigits) return exactDigits[1];

  const trailingDigits = voucherNo.match(/(\d+)$/);
  if (!trailingDigits) return null;
  return trailingDigits[1].padStart(digits, '0');
}

export function formatVoucherNoForDisplay(
  voucher: Pick<Voucher, 'voucherNo' | 'date' | 'voucherType'>,
  cfg?: VoucherNumberingConfig
): string {
  const rawVoucherNo = voucher.voucherNo || '';
  if (!rawVoucherNo) return '';

  const word = resolveVoucherWord(cfg, voucher.voucherType);
  const period = cfg?.period || 'monthly';
  const digits = cfg?.digits || 3;
  const datePrefix = formatDatePrefix(voucher.date, period);

  if (isAlreadyFormatted(rawVoucherNo, word, datePrefix, digits)) {
    return rawVoucherNo;
  }

  if (!isLegacyVoucherNo(rawVoucherNo)) {
    return rawVoucherNo;
  }

  const sequence = extractSequence(rawVoucherNo, digits);
  if (!sequence) return rawVoucherNo;

  if (datePrefix) {
    return `${word}-${datePrefix}-${sequence}`;
  }

  return `${word}-${sequence}`;
}
