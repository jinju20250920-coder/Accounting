import type { BankParserConfig } from '../types';

export const czbConfig: BankParserConfig = {
  id: 'czb',
  name: '浙商银行',
  headerRows: 5,
  columnMapping: {
    date: ['交易时间'],
    summary: ['摘要'],
    voucherType: ['凭证种类'],
    voucherNo: ['凭证号'],
    debit: ['借方发生金额'],
    credit: ['贷方发生金额'],
    balance: ['交易后余额'],
    counterpartyName: ['对方名称'],
    counterpartyAccount: ['对方账号'],
    notes: ['用途/附言'],
    transactionSerialNo: ['流水号'],
  },
  dateFormat: 'custom',
  dateFormatCustom: 'yyyy-MM-dd-HHmm',
  metaExtract: [
    { row: 2, keyword: '账号', field: 'accountNumber' },
    { row: 1, keyword: '账户名称', field: 'accountName' },
  ],
  identifiers: {
    sheetKeywords: ['浙商银行', 'CZB'],
    columnKeywords: ['借方发生金额(元)', '贷方发生金额(元)', '交易后余额(元)'],
    minColumns: 10,
    maxColumns: 14,
  },
};
