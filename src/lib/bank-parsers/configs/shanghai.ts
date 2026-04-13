import type { BankParserConfig } from '../types';

export const shanghaiConfig: BankParserConfig = {
  id: 'shanghai',
  name: '上海银行',
  headerRows: 6,
  columnMapping: {
    date: ['记账日期'],
    time: ['交易时间'],
    transactionSerialNo: ['交易流水号'],
    debit: ['借方发生额'],
    credit: ['贷方发生额'],
    balance: ['余额'],
    counterpartyAccount: ['对手账号'],
    counterpartyName: ['对手名称'],
    summary: ['摘要'],
    notes: ['交易用途'],
  },
  dateFormat: 'iso',
  hasSeparatedTime: true,
  metaExtract: [
    { row: 2, keyword: '账号', field: 'accountNumber' },
    { row: 2, keyword: '开户行', field: 'branch' },
  ],
  identifiers: {
    sheetKeywords: ['上海银行', 'Shanghai Bank'],
    columnKeywords: ['对手账号', '对手名称', '交易方向'],
    minColumns: 10,
    maxColumns: 14,
  },
};
