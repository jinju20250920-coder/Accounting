import type { BankParserConfig } from '../types';

export const icbcConfig: BankParserConfig = {
  id: 'icbc',
  name: '工商银行',
  headerRows: 5,
  columnMapping: {
    date: ['日期'],
    voucherType: ['凭证种类'],
    voucherNo: ['凭证号'],
    counterpartyName: ['对方户名'],
    counterpartyAccount: ['对方账号'],
    summary: ['摘要'],
    debit: ['借方发生额'],
    credit: ['贷方发生额'],
    balance: ['余额'],
    notes: ['交易类型'],
  },
  dateFormat: 'excel_serial',
  metaExtract: [
    { row: 1, keyword: '账号', field: 'accountNumber' },
    { row: 2, keyword: '户名', field: 'accountName' },
    { row: 1, keyword: '币种', field: 'currency' },
  ],
  identifiers: {
    sheetKeywords: ['工商银行', 'ICBC'],
    columnKeywords: ['网点号', '凭证种类'],
    minColumns: 10,
    maxColumns: 12,
  },
};
