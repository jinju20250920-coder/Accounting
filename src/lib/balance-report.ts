import type { Subject, Voucher } from '../types';

export interface SubjectBalanceRow {
  subjectCode: string;
  subjectName: string;
  direction: 'debit' | 'credit';
  openingDebit: number;
  openingCredit: number;
  debitTotal: number;
  creditTotal: number;
  closingDebit: number;
  closingCredit: number;
}

export interface BankOpeningBalanceForReport {
  accountNumber: string;
  periodStart: string;
  balance: number;
}

export interface BankBindingForReport {
  accountNumber: string;
  subSubjectCode: string;
}

export interface BalanceReportInput {
  vouchers: Voucher[];
  subjects: Subject[];
  startMonth: string;
  endMonth: string;
  bankOpeningBalances?: BankOpeningBalanceForReport[];
  bankBindings?: BankBindingForReport[];
}

function isOpeningVoucher(voucher: Voucher): boolean {
  return (
    voucher.id.startsWith('opening_') ||
    voucher.voucherNo.includes('期初') ||
    voucher.summary?.includes('期初')
  );
}

function getOrCreateBalanceRow(
  balanceMap: Map<string, SubjectBalanceRow>,
  subjectCode: string,
  subjectName: string,
  direction: 'debit' | 'credit',
): SubjectBalanceRow {
  const existing = balanceMap.get(subjectCode);
  if (existing) return existing;

  const row: SubjectBalanceRow = {
    subjectCode,
    subjectName,
    direction,
    openingDebit: 0,
    openingCredit: 0,
    debitTotal: 0,
    creditTotal: 0,
    closingDebit: 0,
    closingCredit: 0,
  };
  balanceMap.set(subjectCode, row);
  return row;
}

function inferDirection(subjectCode: string, debit: number, credit: number): 'debit' | 'credit' {
  if (subjectCode === '1602' || subjectCode === '1502') return 'credit';
  if (subjectCode.startsWith('2') || subjectCode.startsWith('3')) return 'credit';
  if (subjectCode.startsWith('6')) return 'credit';
  if (credit > debit && debit === 0) return 'credit';
  return 'debit';
}

export function calculateBalanceReportRows(input: BalanceReportInput): SubjectBalanceRow[] {
  const {
    vouchers,
    subjects,
    startMonth,
    endMonth,
    bankBindings = [],
  } = input;
  const subjectMap = new Map(subjects.map(subject => [subject.code, subject]));
  const bankSubjectByAccountNumber = new Map<string, string>();
  const defaultBankBinding = bankBindings.find(binding => (binding as { isDefault?: boolean }).isDefault)
    || (bankBindings.length === 1 ? bankBindings[0] : undefined);
  bankBindings.forEach(binding => {
    if (binding.accountNumber && binding.subSubjectCode) {
      bankSubjectByAccountNumber.set(binding.accountNumber, binding.subSubjectCode);
    }
  });
  const balanceMap = new Map<string, SubjectBalanceRow>();
  const openingBankAccounts = new Set<string>();
  const openingBankSubjectCodes = new Set<string>();

  vouchers.forEach(voucher => {
    if (voucher.status !== 'posted') return;
    const voucherMonth = voucher.date.slice(0, 7);
    const openingVoucher = isOpeningVoucher(voucher);
    const beforeStart = voucherMonth < startMonth;
    const inPeriod = voucherMonth >= startMonth && voucherMonth <= endMonth;

    if (!openingVoucher && !beforeStart && !inPeriod) return;

    voucher.entries.forEach(entry => {
      const bankAccount = entry.auxiliary?.bankAccount;
      const mappedBankSubjectCode =
        entry.subjectCode.startsWith('1002') && bankAccount
          ? bankSubjectByAccountNumber.get(bankAccount)
          : entry.subjectCode.startsWith('1002')
            ? (defaultBankBinding?.subSubjectCode || undefined)
          : undefined;
      const effectiveSubjectCode = mappedBankSubjectCode || entry.subjectCode;

      // 银行期初在开账凭证中常以 1002* 记录，但余额表应优先使用
      // bank_opening_balances + 绑定子科目展示，避免父科目 1002 覆盖子科目。
      if ((openingVoucher || beforeStart) && entry.subjectCode.startsWith('1002') && !mappedBankSubjectCode) {
        return;
      }

      const subject = subjectMap.get(entry.subjectCode);
      const debit = entry.debit || 0;
      const credit = entry.credit || 0;
      const row = getOrCreateBalanceRow(
        balanceMap,
        effectiveSubjectCode,
        subjectMap.get(effectiveSubjectCode)?.name || subject?.name || entry.subjectName,
        subjectMap.get(effectiveSubjectCode)?.direction || subject?.direction || inferDirection(effectiveSubjectCode, debit, credit),
      );

      if (openingVoucher || beforeStart) {
        row.openingDebit += debit;
        row.openingCredit += credit;
        if (bankAccount) openingBankAccounts.add(bankAccount);
        if (effectiveSubjectCode.startsWith('1002')) openingBankSubjectCodes.add(effectiveSubjectCode);
        return;
      }

      row.debitTotal += debit;
      row.creditTotal += credit;
    });
  });

  balanceMap.forEach(row => {
    if (row.direction === 'debit') {
      const closingBalance = row.openingDebit - row.openingCredit + row.debitTotal - row.creditTotal;
      row.closingDebit = closingBalance >= 0 ? closingBalance : 0;
      row.closingCredit = closingBalance < 0 ? Math.abs(closingBalance) : 0;
      return;
    }

    const closingBalance = row.openingCredit - row.openingDebit + row.creditTotal - row.debitTotal;
    row.closingDebit = closingBalance < 0 ? Math.abs(closingBalance) : 0;
    row.closingCredit = closingBalance >= 0 ? closingBalance : 0;
  });

  return Array.from(balanceMap.values());
}
