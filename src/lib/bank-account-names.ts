export const NEW_BANK_OPTION_ID = '__new__';

function normalizeCurrency(currency?: string): string {
  return (currency || '').trim().toUpperCase();
}

function getLastDigits(accountNumber: string, length = 4): string {
  const digits = accountNumber.replace(/\D/g, '');
  const source = digits || accountNumber.trim();
  return source.slice(-length);
}

function toBankSlug(name: string): string {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (ascii) return ascii;

  const codePoints = Array.from(name.trim())
    .map(char => char.codePointAt(0)?.toString(36) || '')
    .filter(Boolean)
    .join('_');
  return codePoints || 'custom';
}

export function buildBankAccountDisplayName(input: {
  bankName: string;
  shortName?: string;
  accountNumber: string;
  currency?: string;
  customName?: string;
}): string {
  const customName = input.customName?.trim();
  if (customName) return customName;

  const bankName = (input.shortName || input.bankName).trim();
  const lastDigits = getLastDigits(input.accountNumber);
  const currency = normalizeCurrency(input.currency);
  return [lastDigits ? `${bankName}-${lastDigits}` : bankName, currency].filter(Boolean).join(' ');
}

export function resolveBankSelection(input: {
  selectedBankId: string;
  selectedBankName: string;
  customBankName: string;
}): { bankId: string; bankName: string; isCustom: boolean } {
  if (input.selectedBankId === NEW_BANK_OPTION_ID) {
    const bankName = input.customBankName.trim();
    return {
      bankId: `custom_bank_${toBankSlug(bankName)}`,
      bankName,
      isCustom: true,
    };
  }

  return {
    bankId: input.selectedBankId,
    bankName: input.selectedBankName.trim(),
    isCustom: false,
  };
}
