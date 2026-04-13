import type { BankParserConfig } from '../types';

export const citicConfig: BankParserConfig = {
  id: 'citic',
  name: '中信银行',
  headerRows: 14,

  columnMapping: {
    date:                 ['交易日期'],
    time:                 ['交易时间'],
    debit:                ['借方发生额'],
    credit:               ['贷方发生额'],
    balance:              ['账户余额'],
    counterpartyName:     ['对方账户名称'],
    counterpartyAccount:  ['对方账号'],
    summary:              ['摘要'],
    notes:                ['附言'],
    transactionSerialNo:  ['柜员交易号'],
    enterpriseSerialNo:   ['发起方流水号'],
    ourAccount:           ['交易账号'],
  },

  dateFormat: 'iso',
  hasSeparatedTime: true,

  metaExtract: [
    // Scan metadata rows for account info.
    // Using a representative row; the keyword search will match the cell
    // containing the keyword and extract the adjacent value.
    { row: 0, keyword: '账号', field: 'accountNumber' },
    { row: 0, keyword: '户名', field: 'accountName' },
    { row: 1, keyword: '账号', field: 'accountNumber' },
    { row: 1, keyword: '户名', field: 'accountName' },
    { row: 2, keyword: '账号', field: 'accountNumber' },
    { row: 2, keyword: '户名', field: 'accountName' },
  ],

  identifiers: {
    sheetKeywords:  ['中信银行', 'CITIC'],
    columnKeywords: ['退汇标识', '柜员交易号', '动账资金分簿'],
    minColumns: 20,
    maxColumns: 25,
  },
};
