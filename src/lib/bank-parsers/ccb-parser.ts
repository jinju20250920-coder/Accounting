/**
 * CCB parser — backward-compatible wrapper.
 * Delegates to the universal engine with CCB config.
 */
import { parseWithConfig } from './engine';
import { ccbConfig } from './configs/ccb';
import type { BankStatementParseResult } from '@/types';

export async function parseCCBStatement(file: File): Promise<BankStatementParseResult> {
  return parseWithConfig(file, ccbConfig);
}

// Re-export CCB_COLUMNS for any external consumers that reference it
export const CCB_COLUMNS = {
  DATE: 0,
  TRANSACTION_TIME: 1,
  VOUCHER_TYPE: 2,
  VOUCHER_NO: 3,
  DEBIT: 4,
  CREDIT: 5,
  BALANCE: 6,
  CASH_REMIT_FLAG: 7,
  COUNTERPARTY_NAME: 8,
  COUNTERPARTY_ACCOUNT: 9,
  SUMMARY: 10,
  NOTES: 11,
  TRANSACTION_SERIAL_NO: 12,
  ENTERPRISE_SERIAL_NO: 13,
  OUR_ACCOUNT: 14,
  OUR_ACCOUNT_NAME: 15,
  OUR_BRANCH: 16,
};
