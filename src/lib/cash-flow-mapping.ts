// 现金流量表分类映射 — 按 counterpart 科目前缀分类到 CAS 行项目
// 参考：CAS 31 现金流量表准则

export type CashFlowSection = 'operating' | 'investing' | 'financing';

export interface CashFlowLineItem {
  code: string;
  name: string;
  section: CashFlowSection;
}

interface CashFlowRule {
  prefix: string;
  inflowItem?: CashFlowLineItem;
  outflowItem?: CashFlowLineItem;
}

export const CASH_FLOW_RULES: CashFlowRule[] = [
  // 经营 — 收入（60xx 主营 + 其他业务）
  {
    prefix: '6001',
    inflowItem: { code: '1', name: '销售商品、提供劳务收到的现金', section: 'operating' },
  },
  {
    prefix: '60',
    inflowItem: { code: '1', name: '销售商品、提供劳务收到的现金', section: 'operating' },
  },
  // 经营 — 营业成本/税金（64xx）
  {
    prefix: '6401',
    outflowItem: { code: '4', name: '购买商品、接受劳务支付的现金', section: 'operating' },
  },
  {
    prefix: '64',
    outflowItem: { code: '4', name: '购买商品、接受劳务支付的现金', section: 'operating' },
  },
  // 经营 — 销售费用/管理费用/财务费用（66xx）
  {
    prefix: '6603',
    outflowItem: { code: '6', name: '支付其他与经营活动有关的现金', section: 'operating' },
  },
  {
    prefix: '66',
    outflowItem: { code: '6', name: '支付其他与经营活动有关的现金', section: 'operating' },
  },
  // 经营 — 所得税（6801）
  {
    prefix: '6801',
    outflowItem: { code: '5', name: '支付的各项税费', section: 'operating' },
  },
  // 经营 — 应收账款（1122，回款时触发流入）
  {
    prefix: '1122',
    inflowItem: { code: '1', name: '销售商品、提供劳务收到的现金', section: 'operating' },
  },
  // 经营 — 应付账款（2202，付款时触发流出）
  {
    prefix: '2202',
    outflowItem: { code: '4', name: '购买商品、接受劳务支付的现金', section: 'operating' },
  },
  // 经营 — 预付/预收账款
  {
    prefix: '1123',
    outflowItem: { code: '4', name: '购买商品、接受劳务支付的现金', section: 'operating' },
  },
  {
    prefix: '2203',
    inflowItem: { code: '1', name: '销售商品、提供劳务收到的现金', section: 'operating' },
  },
  // 经营 — 应交税费
  {
    prefix: '2221',
    outflowItem: { code: '5', name: '支付的各项税费', section: 'operating' },
  },
  // 经营 — 应付职工薪酬
  {
    prefix: '2211',
    outflowItem: { code: '5b', name: '支付给职工以及为职工支付的现金', section: 'operating' },
  },
  // 投资 — 固定资产（160xx）
  {
    prefix: '160',
    outflowItem: { code: 'I-2', name: '购建固定资产、无形资产和其他长期资产支付的现金', section: 'investing' },
    inflowItem: { code: 'I-1', name: '处置固定资产、无形资产和其他长期资产收回的现金净额', section: 'investing' },
  },
  // 投资 — 无形资产（170xx）
  {
    prefix: '170',
    outflowItem: { code: 'I-2', name: '购建固定资产、无形资产和其他长期资产支付的现金', section: 'investing' },
    inflowItem: { code: 'I-1', name: '处置固定资产、无形资产和其他长期资产收回的现金净额', section: 'investing' },
  },
  // 投资 — 长期股权投资（1511）
  {
    prefix: '151',
    outflowItem: { code: 'I-3', name: '投资支付的现金', section: 'investing' },
    inflowItem: { code: 'I-4', name: '收回投资收到的现金', section: 'investing' },
  },
  // 筹资 — 短期借款（2001）
  {
    prefix: '2001',
    inflowItem: { code: 'F-1', name: '取得借款收到的现金', section: 'financing' },
    outflowItem: { code: 'F-2', name: '偿还债务支付的现金', section: 'financing' },
  },
  // 筹资 — 长期借款（2501）
  {
    prefix: '2501',
    inflowItem: { code: 'F-1', name: '取得借款收到的现金', section: 'financing' },
    outflowItem: { code: 'F-2', name: '偿还债务支付的现金', section: 'financing' },
  },
  // 筹资 — 应付债券（2502）
  {
    prefix: '2502',
    inflowItem: { code: 'F-1', name: '取得借款收到的现金', section: 'financing' },
    outflowItem: { code: 'F-2', name: '偿还债务支付的现金', section: 'financing' },
  },
  // 筹资 — 实收资本（4001）
  {
    prefix: '4001',
    inflowItem: { code: 'F-3', name: '吸收投资收到的现金', section: 'financing' },
  },
  // 筹资 — 分配股利/利润（4103 应付股利）
  {
    prefix: '4103',
    outflowItem: { code: 'F-4', name: '分配股利、利润或偿付利息支付的现金', section: 'financing' },
  },
  // 筹资 — 应付利息（1132 / 2231）
  {
    prefix: '2231',
    outflowItem: { code: 'F-4', name: '分配股利、利润或偿付利息支付的现金', section: 'financing' },
  },
];

export const DEFAULT_INFLOW: CashFlowLineItem = {
  code: '3',
  name: '收到其他与经营活动有关的现金',
  section: 'operating',
};

export const DEFAULT_OUTFLOW: CashFlowLineItem = {
  code: '6',
  name: '支付其他与经营活动有关的现金',
  section: 'operating',
};

const SORTED_RULES = [...CASH_FLOW_RULES].sort((a, b) => b.prefix.length - a.prefix.length);

export function classifyByCounterpart(subjectCode: string, isCashInflow: boolean): CashFlowLineItem {
  for (const rule of SORTED_RULES) {
    if (subjectCode.startsWith(rule.prefix)) {
      return isCashInflow ? (rule.inflowItem ?? DEFAULT_INFLOW) : (rule.outflowItem ?? DEFAULT_OUTFLOW);
    }
  }
  return isCashInflow ? DEFAULT_INFLOW : DEFAULT_OUTFLOW;
}

// 现金类科目编码前缀：库存现金、银行存款、其他货币资金、交易性金融资产（短期理财）
export const CASH_SUBJECT_PREFIXES = ['1001', '1002', '1012', '1101'];

export function isCashSubject(subjectCode: string): boolean {
  return CASH_SUBJECT_PREFIXES.some(prefix => subjectCode.startsWith(prefix));
}
