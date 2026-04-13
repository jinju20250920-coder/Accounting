import type { BankParserConfig } from '../types';

export const bocomConfig: BankParserConfig = {
  id: 'bocom',
  name: '交通银行',
  headerRows: 2,

  columnMapping: {
    date:                 ['交易时间'],
    debit:                ['借方发生额'],
    credit:               ['贷方发生额'],
    balance:              ['账户余额'],
    counterpartyAccount:  ['对方账号'],
    counterpartyName:     ['对方户名'],
    summary:              ['摘要'],
  },

  dateFormat: 'iso',

  metaExtract: [
    { row: 0, keyword: '账号', field: 'accountNumber' },
    { row: 0, keyword: '户名', field: 'accountName' },
  ],

  identifiers: {
    sheetKeywords:  ['交通银行', 'BOCOM'],
    columnKeywords: ['借方发生额（支出）', '贷方发生额（收入）'],
    minColumns: 6,
    maxColumns: 9,
  },
};
