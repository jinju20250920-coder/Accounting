import type { BankParserConfig } from '../types';

export const pinganConfig: BankParserConfig = {
  id: 'pingan',
  name: '平安银行',
  headerRows: 1,
  columnMapping: {
    date: ['交易日期'],
    ourAccount: ['账号'],
    ourAccountName: ['账户名称'],
    debit: ['借方(支出)金额'],
    credit: ['贷方(收入)金额'],
    balance: ['账户余额'],
    counterpartyAccount: ['对方账号'],
    counterpartyName: ['对方账户名称'],
    ourBranch: ['对方开户行'],
    notes: ['用途'],
    transactionSerialNo: ['银行流水号'],
    summary: ['摘要'],
  },
  dateFormat: 'iso',
  metaExtract: [],
  identifiers: {
    sheetKeywords: ['平安银行', 'Ping An', '平安'],
    columnKeywords: ['明细来源', '付款单备注', '审批状态'],
    minColumns: 18,
    maxColumns: 22,
  },
};
