import type { BankParserConfig } from '../types';

export const spdbConfig: BankParserConfig = {
  id: 'spdb',
  name: '浦发银行',
  headerRows: 5,
  columnMapping: {
    date: ['交易日期'],
    time: ['交易时间'],
    voucherNo: ['凭证号'],
    debit: ['借方金额'],
    credit: ['贷方金额'],
    balance: ['余额'],
    counterpartyAccount: ['对方账号'],
    counterpartyName: ['对方户名'],
    ourBranch: ['对方行名'],
    transactionSerialNo: ['交易流水号'],
    summary: ['摘要'],
    notes: ['交易附言'],
  },
  dateFormat: 'compact',
  hasSeparatedTime: true,
  metaExtract: [
    { row: 1, keyword: '账号', field: 'accountNumber' },
    { row: 2, keyword: '账户名称', field: 'accountName' },
  ],
  identifiers: {
    sheetKeywords: ['浦发', 'SPDB'],
    columnKeywords: ['传票序号', '记录状态', '客户账户类型'],
    minColumns: 14,
    maxColumns: 18,
  },
};
