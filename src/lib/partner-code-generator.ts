export const PARTNER_CODE_PREFIXES = {
  customer: 'CUS',
  supplier: 'SUP',
  employee: 'EMP',
} as const;

export type PartnerCodeType = keyof typeof PARTNER_CODE_PREFIXES;

export function pickPartnerTypePriority(
  isCustomer: boolean,
  isSupplier: boolean,
  isEmployee: boolean,
): PartnerCodeType | null {
  if (isCustomer) return 'customer';
  if (isSupplier) return 'supplier';
  if (isEmployee) return 'employee';
  return null;
}

export function generatePartnerCode(
  existingCodes: string[],
  type: PartnerCodeType,
): string {
  const prefix = PARTNER_CODE_PREFIXES[type];
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const maxSeq = existingCodes.reduce((max, code) => {
    const m = re.exec(code);
    if (!m) return max;
    return Math.max(max, parseInt(m[1], 10));
  }, 0);
  const next = maxSeq + 1;
  const width = Math.max(3, String(next).length);
  return `${prefix}-${String(next).padStart(width, '0')}`;
}
