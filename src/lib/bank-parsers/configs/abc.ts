import type { BankParserConfig } from '../types';

export const abcConfig: BankParserConfig = {
  id: 'abc',
  name: '农业银行',
  headerRows: 2,
  columnMapping: {
    date: ['交易时间'],
    credit: ['收入金额'],
    debit: ['支出金额'],
    balance: ['账户余额'],
    counterpartyAccount: ['对方账号'],
    counterpartyName: ['对方户名'],
    summary: ['摘要'],
    notes: ['对方开户行'],
  },
  dateFormat: 'iso',
  metaExtract: [
    { row: 1, keyword: '账号', field: 'accountNumber' },
    { row: 1, keyword: '户名', field: 'accountName' },
  ],
  identifiers: {
    sheetKeywords: ['农业银行', 'ABC'],
    columnKeywords: ['收入金额', '支出金额', '对方开户行'],
    minColumns: 7,
    maxColumns: 10,
  },
};
