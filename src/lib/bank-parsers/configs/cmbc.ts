import type { BankParserConfig } from '../types';

export const cmbcConfig: BankParserConfig = {
  id: 'cmbc',
  name: '民生银行',
  headerRows: 18,
  columnMapping: {
    date: ['交易时间'],
    transactionSerialNo: ['交易流水号'],
    debit: ['借方发生额'],
    credit: ['贷方发生额'],
    balance: ['账户余额'],
    voucherNo: ['凭证号'],
    notes: ['客户附言'],
    counterpartyAccount: ['对方账号'],
    counterpartyName: ['对方账号名称'],
    ourBranch: ['对方开户行'],
  },
  dateFormat: 'iso',
  metaExtract: [
    { row: 2, keyword: '账号', field: 'accountNumber' },
    { row: 1, keyword: '账户名称', field: 'accountName' },
  ],
  identifiers: {
    sheetKeywords: ['民生银行', 'CMBC'],
    columnKeywords: ['客户附言', '对方账号名称', '冲正流水'],
    minColumns: 8,
    maxColumns: 12,
  },
};
