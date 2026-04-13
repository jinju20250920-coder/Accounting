import type { BankParserConfig } from '../types';

export const cmbConfig: BankParserConfig = {
  id: 'cmb',
  name: '招商银行',
  headerRows: 9,

  columnMapping: {
    date:                 ['交易日'],
    time:                 ['交易时间'],
    debit:                ['借方金额'],
    credit:               ['贷方金额'],
    balance:              ['余额'],
    counterpartyName:     ['收(付)方名称'],
    counterpartyAccount:  ['收(付)方账号'],
    summary:              ['摘要'],
    transactionSerialNo:  ['流水号'],
    ourAccount:           ['账号'],
    ourAccountName:       ['账号名称'],
  },

  dateFormat: 'iso',
  hasSeparatedTime: true,

  metaExtract: [
    { row: 1, keyword: '账号', field: 'accountNumber' },
    { row: 2, keyword: '账户名称', field: 'accountName' },
  ],

  identifiers: {
    sheetKeywords:  ['招商银行', 'CMB'],
    columnKeywords: ['收(付)方', '流程实例号', '业务名称'],
    minColumns: 30,
    maxColumns: 40,
  },
};
