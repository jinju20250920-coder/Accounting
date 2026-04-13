import type { BankParserConfig } from '../types';

export const industrialConfig: BankParserConfig = {
  id: 'industrial',
  name: '兴业银行',
  headerRows: 1,

  columnMapping: {
    date:                 ['记账日期'],
    time:                 ['交易时间'],
    debit:                ['借方金额'],
    credit:               ['贷方金额'],
    balance:              ['账户余额'],
    counterpartyName:     ['对方户名'],
    counterpartyAccount:  ['对方账号'],
    summary:              ['摘要'],
    notes:                ['用途'],
    transactionSerialNo:  ['银行流水号'],
    enterpriseSerialNo:   ['唯一流水编号'],
    ourAccount:           ['账号'],
    ourAccountName:       ['户名'],
    voucherType:          ['凭证代号'],
    cashRemitFlag:        ['现/转'],
  },

  dateFormat: 'iso',

  identifiers: {
    sheetKeywords:  ['兴业银行', 'Industrial Bank'],
    columnKeywords: ['唯一流水编号', '现/转', '对方行号'],
    minColumns: 17,
    maxColumns: 21,
  },
};
