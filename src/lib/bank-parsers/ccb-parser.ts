
/**
 * 中国建设银行银行流水解析器
 * CCB Bank Statement Parser
 */

import * as XLSX from 'xlsx';
import type { BankAccountInfo, BankTransaction, BankStatementParseResult } from '@/types';

// 列索引映射（基于实际文件格式）
const CCB_COLUMNS = {
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
  OUR_BRANCH: 16
};

export function parseCCBStatement(file: File): Promise<BankStatementParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        const result = parseCCBJsonData(jsonData, file.name);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function parseCCBJsonData(jsonData: any[][], fileName: string): BankStatementParseResult {
  const errors: Array<{ row: number; message: string }> = [];
  const transactions: BankTransaction[] = [];

  // 提取银行账户信息
  const bankInfo: BankAccountInfo = {
    bankName: extractValue(jsonData, 3, 1) || '中国建设银行',
    accountName: extractValue(jsonData, 5, 1) || '',
    accountNumber: extractValue(jsonData, 4, 1) || '',
    branch: extractValue(jsonData, 3, 1) || '',
    currency: extractValue(jsonData, 3, 3) || '人民币元'
  };

  // 交易数据从第10行开始（索引9）
  for (let i = 9; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const date = String(row[CCB_COLUMNS.DATE] || '').trim();
    if (!date) continue; // 跳过空日期行

    try {
      const transaction = parseTransactionRow(row, i + 1);
      transactions.push(transaction);
    } catch (error) {
      errors.push({
        row: i + 1,
        message: error instanceof Error ? error.message : '解析错误'
      });
    }
  }

  return {
    fileName,
    type: 'bank',
    bankInfo,
    transactions,
    errors,
    rawData: jsonData
  };
}

function extractValue(data: any[][], rowIndex: number, colIndex: number): string | undefined {
  if (!data[rowIndex] || !data[rowIndex][colIndex]) return undefined;
  return String(data[rowIndex][colIndex]).trim();
}

function parseTransactionRow(row: any[], rowNumber: number): BankTransaction {
  const id = `txn_${Date.now()}_${rowNumber}_${Math.random().toString(36).substr(2, 9)}`;

  // 解析借方和贷方金额
  const debitValue = String(row[CCB_COLUMNS.DEBIT] || '').trim();
  const creditValue = String(row[CCB_COLUMNS.CREDIT] || '').trim();

  let debit: number | undefined;
  let credit: number | undefined;

  if (debitValue !== '--' && debitValue !== '') {
    const num = parseFloat(debitValue.replace(/,/g, ''));
    if (!isNaN(num)) debit = num;
  }

  if (creditValue !== '--' && creditValue !== '') {
    const num = parseFloat(creditValue.replace(/,/g, ''));
    if (!isNaN(num)) credit = num;
  }

  // 解析余额
  const balanceValue = String(row[CCB_COLUMNS.BALANCE] || '').trim();
  let balance: number | undefined;
  if (balanceValue) {
    const num = parseFloat(balanceValue.replace(/,/g, ''));
    if (!isNaN(num)) balance = num;
  }

  return {
    id,
    date: String(row[CCB_COLUMNS.DATE] || '').trim(),
    transactionTime: String(row[CCB_COLUMNS.TRANSACTION_TIME] || '').trim(),
    voucherType: String(row[CCB_COLUMNS.VOUCHER_TYPE] || '').trim(),
    voucherNo: String(row[CCB_COLUMNS.VOUCHER_NO] || '').trim(),
    debit,
    credit,
    balance,
    cashRemitFlag: String(row[CCB_COLUMNS.CASH_REMIT_FLAG] || '').trim(),
    counterpartyName: String(row[CCB_COLUMNS.COUNTERPARTY_NAME] || '').trim(),
    counterpartyAccount: String(row[CCB_COLUMNS.COUNTERPARTY_ACCOUNT] || '').trim(),
    summary: String(row[CCB_COLUMNS.SUMMARY] || '').trim(),
    notes: String(row[CCB_COLUMNS.NOTES] || '').trim(),
    transactionSerialNo: String(row[CCB_COLUMNS.TRANSACTION_SERIAL_NO] || '').trim(),
    enterpriseSerialNo: String(row[CCB_COLUMNS.ENTERPRISE_SERIAL_NO] || '').trim(),
    ourAccount: String(row[CCB_COLUMNS.OUR_ACCOUNT] || '').trim(),
    ourAccountName: String(row[CCB_COLUMNS.OUR_ACCOUNT_NAME] || '').trim(),
    ourBranch: String(row[CCB_COLUMNS.OUR_BRANCH] || '').trim(),
    rowNumber
  };
}

export { CCB_COLUMNS };
