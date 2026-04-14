import * as XLSX from 'xlsx';
import type { BankParserConfig, BankAccountInfo } from './types';
import type { BankTransaction, BankStatementParseResult } from '@/types';
import { getDateHandler } from './date-handlers';
import { extractMeta } from './meta-extractor';

/**
 * Parse a bank statement file using the given configuration.
 */
export async function parseWithConfig(file: File, config: BankParserConfig): Promise<BankStatementParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[config.sheetIndex || 0];
  const ws = workbook.Sheets[sheetName];

  if (!ws) {
    return {
      fileName: file.name,
      type: 'bank',
      bankInfo: { bankName: '', accountName: '', accountNumber: '' },
      transactions: [],
      errors: [{ row: 0, message: '无法读取工作表' }],
    };
  }

  const rawData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rawData.length <= config.headerRows) {
    return {
      fileName: file.name,
      type: 'bank',
      bankInfo: { bankName: '', accountName: '', accountNumber: '' },
      transactions: [],
      errors: [{ row: 0, message: '文件无数据' }],
    };
  }

  // Step 1: Extract metadata from header rows
  const bankInfo = extractMeta(rawData, config);

  // Step 2: Get column headers row
  const headerRow = rawData[config.headerRows];
  if (!headerRow) {
    return {
      fileName: file.name,
      type: 'bank',
      bankInfo,
      transactions: [],
      errors: [{ row: config.headerRows, message: '找不到列标题行' }],
    };
  }

  // For banks with multi-row headers (e.g. CCB), merge the previous row
  // so keywords from both rows can be matched.
  const prevRow = config.headerRows > 0 ? rawData[config.headerRows - 1] : null;
  const mergedHeaders = headerRow.map((cell: string, i: number) => {
    const cur = String(cell || '').trim();
    const prev = prevRow ? String(prevRow[i] || '').trim() : '';
    // Combine: prefer current row's text, append previous row's text if different
    if (cur && prev && cur !== prev) return prev + cur;
    return cur || prev;
  });

  // Step 3: Match column headers to standard fields
  const colIndex = matchColumns(mergedHeaders, config.columnMapping);

  // Validate: need at least date and one of debit/credit
  const hasDate = colIndex.has('date');
  const hasDebitOrCredit = colIndex.has('debit') || colIndex.has('credit');
  if (!hasDate || !hasDebitOrCredit) {
    return {
      fileName: file.name,
      type: 'bank',
      bankInfo,
      transactions: [],
      errors: [{ row: config.headerRows, message: `列匹配失败：需要日期和借贷金额列。匹配到: ${[...colIndex.keys()].join(', ') || '无'}` }],
    };
  }

  // Step 4: Parse data rows
  const dateHandler = getDateHandler(config.dateFormat, config.dateFormatCustom);
  const transactions: BankTransaction[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  const dataStart = config.dataStartRow != null ? config.dataStartRow : config.headerRows + 1;
  for (let i = dataStart; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every(c => !String(c || '').trim())) continue; // skip empty rows

    try {
      const tx = parseRow(row, i, colIndex, dateHandler, config.hasSeparatedTime || false);
      if (tx.date) {
        transactions.push(tx);
      }
    } catch (e) {
      errors.push({ row: i + 1, message: `第 ${i + 1} 行解析失败: ${(e as Error).message}` });
    }
  }

  return { fileName: file.name, type: 'bank', bankInfo, transactions, errors, rawData };
}

/**
 * Match column headers against configured keywords using substring matching.
 */
export function matchColumns(headers: string[], mapping: BankParserConfig['columnMapping']): Map<string, number> {
  const result = new Map<string, number>();
  for (const [field, keywords] of Object.entries(mapping)) {
    if (!keywords) continue;
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || '').trim();
      if (keywords.some(kw => header.includes(kw))) {
        result.set(field, i);
        break;
      }
    }
  }
  return result;
}

/**
 * Parse a single data row into a BankTransaction.
 */
function parseRow(
  row: string[],
  rowIndex: number,
  colIndex: Map<string, number>,
  dateHandler: { parse: (raw: any, timeRaw?: any) => { date: string; time?: string } },
  hasSeparatedTime: boolean,
): BankTransaction {
  const get = (field: string): string => {
    const idx = colIndex.get(field);
    return idx !== undefined ? String(row[idx] || '').trim() : '';
  };

  const rawDate = get('date');
  const rawTime = hasSeparatedTime ? get('time') : undefined;
  const { date, time } = dateHandler.parse(rawDate, rawTime);

  const debit = parseAmount(get('debit'));
  const credit = parseAmount(get('credit'));

  return {
    id: `${Date.now()}-r${rowIndex}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    transactionTime: time,
    voucherType: get('voucherType') || undefined,
    voucherNo: get('voucherNo') || undefined,
    debit,
    credit,
    balance: parseAmount(get('balance')),
    cashRemitFlag: get('cashRemitFlag') || undefined,
    counterpartyName: get('counterpartyName') || undefined,
    counterpartyAccount: get('counterpartyAccount') || undefined,
    summary: get('summary') || get('notes') || '(无摘要)',
    notes: get('notes') || undefined,
    transactionSerialNo: get('transactionSerialNo') || undefined,
    enterpriseSerialNo: get('enterpriseSerialNo') || undefined,
    ourAccount: get('ourAccount') || undefined,
    ourAccountName: get('ourAccountName') || undefined,
    ourBranch: get('ourBranch') || undefined,
    rowNumber: rowIndex + 1,
  };
}

function parseAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').replace(/--/g, '').trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return isNaN(num) ? undefined : Math.round(num * 100) / 100;
}
