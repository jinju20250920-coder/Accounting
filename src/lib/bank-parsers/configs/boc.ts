import type { BankParserConfig } from '../types';

export const bocConfig: BankParserConfig = {
  id: 'boc',
  name: '中国银行',
  headerRows: 9,
  columnMapping: {
    date: ['交易日期'],
    time: ['交易时间'],
    debit: ['借方发生额', '支出金额'],
    credit: ['贷方发生额', '收入金额', '交易金额'],
    balance: ['交易后余额', '账户余额'],
    counterpartyName: ['付款人名称', '收款人名称', '付款人', '收款人'],
    counterpartyAccount: ['付款人账号', '收款人账号'],
    transactionSerialNo: ['交易流水号'],
    voucherType: ['凭证类型'],
    voucherNo: ['凭证号码'],
    summary: ['摘要'],
    notes: ['交易附言', '备注', '用途'],
  },
  dateFormat: 'compact',
  hasSeparatedTime: true,
  metaExtract: [
    { row: 0, keyword: '查询账号', field: 'accountNumber' },
  ],
  identifiers: {
    sheetKeywords: ['中国银行', 'BOC', ' Bank of China'],
    columnKeywords: ['付款人开户行', '收款人开户行', '交易后余额', '起息日期'],
    minColumns: 30,
    maxColumns: 42,
  },
};
