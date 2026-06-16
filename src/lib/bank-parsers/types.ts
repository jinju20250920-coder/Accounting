import type { BankAccountInfo } from '../../types';

export type { BankAccountInfo };

/**
 * Column mapping: Chinese keywords → standard BankTransaction fields.
 * Keywords use substring matching: "借方发生额（支出）" matches keyword "借方发生额".
 */
export interface ColumnMapping {
  date?: string[];
  time?: string[];
  debit?: string[];
  credit?: string[];
  balance?: string[];
  counterpartyName?: string[];
  counterpartyAccount?: string[];
  summary?: string[];
  notes?: string[];
  transactionSerialNo?: string[];
  enterpriseSerialNo?: string[];
  voucherNo?: string[];
  voucherType?: string[];
  cashRemitFlag?: string[];
  ourAccount?: string[];
  ourAccountName?: string[];
  ourBranch?: string[];
}

/**
 * Bank parser configuration.
 *
 * Row indexing convention (0-based):
 * - Rows 0 through headerRows-1 = metadata rows
 * - Row at headerRows = column header row
 * - Data starts at headerRows + 1
 * - Use headerRows: 0 when first row IS column headers
 */
export interface BankParserConfig {
  id: string;
  name: string;
  headerRows: number;
  columnMapping: ColumnMapping;
  dateFormat: 'iso' | 'excel_serial' | 'compact' | 'custom';
  dateFormatCustom?: string;
  hasSeparatedTime?: boolean;
  dataStartRow?: number;
  sheetIndex?: number;
  metaExtract?: Array<{
    row: number;
    col?: number;
    keyword?: string;
    field: keyof BankAccountInfo;
  }>;
  identifiers: {
    sheetKeywords?: string[];
    columnKeywords?: string[];
    minColumns?: number;
    maxColumns?: number;
  };
}

/** Date handler plugin interface */
export interface DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string };
}

/** Bank account binding record */
export interface BankAccountBinding {
  id: string;
  accountSetId: string;
  accountNumber: string;
  bankId: string;
  bankName: string;
  aliasName?: string;
  subSubjectCode: string;
  subSubjectName: string;
  branch?: string;
  currency?: string;
  isDefault?: boolean;
  createdAt: string;
}

/** Input payload used when creating or updating a bank account binding */
export interface BankAccountBindingInput {
  accountSetId: string;
  accountNumber: string;
  bankId: string;
  bankName: string;
  aliasName?: string;
  subSubjectCode: string;
  subSubjectName: string;
  branch?: string;
  currency?: string;
  isDefault?: boolean;
}

/** Custom bank config saved by users via the Coach UI */
export interface CustomBankConfig {
  id: string;
  accountSetId: string;
  name: string;
  config: BankParserConfig;
  createdAt: string;
  updatedAt: string;
}

/** Detection result from auto-detection */
export interface DetectionResult {
  bankId: string;
  score: number;
  config: BankParserConfig;
}
