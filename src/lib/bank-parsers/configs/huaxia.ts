import type { BankParserConfig } from '../types';

export const huaxiaConfig: BankParserConfig = {
  id: 'huaxia',
  name: '华夏银行',
  headerRows: 8,
  columnMapping: {
    date: ['交易日期'],
    time: ['交易时间'],
    debit: ['支出金额'],
    credit: ['收入金额'],
    balance: ['余额'],
    counterpartyAccount: ['对方账号'],
    counterpartyName: ['对方户名'],
    ourBranch: ['对方行名'],
    transactionSerialNo: ['核心流水号'],
    summary: ['摘要'],
    voucherNo: ['凭证号码'],
    notes: ['交易描述'],
  },
  dateFormat: 'iso',
  hasSeparatedTime: true,
  metaExtract: [
    { row: 1, keyword: '账号', field: 'accountNumber' },
    { row: 2, keyword: '户名', field: 'accountName' },
  ],
  identifiers: {
    sheetKeywords: ['华夏银行', 'Huaxia'],
    columnKeywords: ['核心流水号', '明细标注', '记账日期'],
    minColumns: 13,
    maxColumns: 17,
  },
};
