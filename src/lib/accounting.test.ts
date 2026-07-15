import { describe, it, expect } from 'vitest';
import { matchBankTransaction, type BankMatchRule } from './accounting';

// 模拟一套贴近现实的规则：转账/汇款已精化为整词，避免渠道词误伤。
const rules: BankMatchRule[] = [
  { keyword: '转账手续费', subjectCode: '6603', subjectName: '财务费用', direction: 'out', priority: 9 },
  { keyword: '汇款手续费', subjectCode: '6603', subjectName: '财务费用', direction: 'out', priority: 9 },
  { keyword: '结息', subjectCode: '6603', subjectName: '财务费用', direction: 'in', priority: 9 },
  { keyword: '工程款', subjectCode: '2202', subjectName: '应付账款', direction: 'out', priority: 8 },
  { keyword: '货款', subjectCode: '2202', subjectName: '应付账款', direction: 'out', priority: 7 },
  { keyword: '货款', subjectCode: '1122', subjectName: '应收账款', direction: 'in', priority: 7 },
];

describe('matchBankTransaction', () => {
  it('摘要“电子转账”不再被误判为财务费用（关键词已精化为“转账手续费”）', () => {
    const m = matchBankTransaction(
      { summary: '电子转账', notes: '', counterpartyName: '刘京魁', isDebit: true },
      rules, [], []
    );
    // 不应命中财务费用；有对方户名时兜底到应付账款
    expect(m?.subjectCode).not.toBe('6603');
    expect(m?.subjectCode).toBe('2202');
  });

  it('备注(用途)命中优先：备注“工程款”→应付账款，不被摘要渠道词截胡', () => {
    const m = matchBankTransaction(
      { summary: '电子转账', notes: '工程款', counterpartyName: '刘京魁', isDebit: true },
      rules, [], []
    );
    expect(m?.subjectCode).toBe('2202');
    expect(m?.subjectName).toBe('应付账款');
  });

  it('备注“货款”付款→应付账款', () => {
    const m = matchBankTransaction(
      { summary: '电子转账', notes: '货款', counterpartyName: '某供应商', isDebit: true },
      rules, [], []
    );
    expect(m?.subjectCode).toBe('2202');
  });

  it('结息（仅摘要，流入）仍正确匹配财务费用', () => {
    const m = matchBankTransaction(
      { summary: '结息', notes: '', isDebit: false },
      rules, [], []
    );
    expect(m?.subjectCode).toBe('6603');
  });

  it('真正的“转账手续费”仍命中财务费用', () => {
    const m = matchBankTransaction(
      { summary: '收费', notes: '对公转账手续费', isDebit: true },
      rules, [], []
    );
    expect(m?.subjectCode).toBe('6603');
  });

  it('无规则命中但有对方户名：付款兜底应付账款，收款兜底应收账款', () => {
    const out = matchBankTransaction(
      { summary: '电子转账', notes: '其他用途', counterpartyName: '张三', isDebit: true },
      rules, [], []
    );
    expect(out?.subjectCode).toBe('2202');
    const inc = matchBankTransaction(
      { summary: '电子汇入', notes: '其他用途', counterpartyName: '李四', isDebit: false },
      rules, [], []
    );
    expect(inc?.subjectCode).toBe('1122');
  });

  it('同优先级下，更长(更具体)的关键词优先', () => {
    // 两条 P9 规则：「银行手续费」(5字) 与假设的「费」(1字)；长词应先命中
    const localRules: BankMatchRule[] = [
      { keyword: '费', subjectCode: '9999', subjectName: '短词', direction: 'out', priority: 9 },
      { keyword: '银行手续费', subjectCode: '660301', subjectName: '手续费', direction: 'out', priority: 9 },
    ];
    const m = matchBankTransaction(
      { summary: '扣银行手续费', notes: '', isDebit: true },
      localRules, [], []
    );
    expect(m?.subjectCode).toBe('660301');
  });
});
