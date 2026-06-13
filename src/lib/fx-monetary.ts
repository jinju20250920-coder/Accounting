/**
 * 货币性项目科目代码前缀（CAS 19 外币折算）。
 * 仅货币性项目需记录外币原币/汇率；非货币性项目（库存、固定资产、收入、费用、权益等）
 * 按交易日汇率折算后以本币固定，不显示币别。
 */
export const MONETARY_SUBJECT_PREFIXES = [
  '1001', '1002', '1012',                  // 库存现金、银行存款、其他货币资金
  '1101',                                   // 交易性金融资产
  '1121', '1122', '1123',                  // 应收票据/账款/预付
  '1131', '1132',                          // 应收股利/利息
  '1221', '1231',                          // 其他应收款、坏账准备
  '1401',                                  // 预付账款（部分场景）
  '1471',                                  // 存货跌价准备（备抵类货币性）
  '1501', '1502', '1503',                  // 持有至到期/减值/可供出售
  '1504',                                  // 长期应收款
  '2001', '2002', '2101',                  // 短期借款、存入保证金、交易性金融负债
  '2201', '2202', '2203',                  // 应付票据/账款/预收
  '2211', '2221',                          // 应付职工薪酬、应交税费
  '2231', '2232', '2241',                  // 应付利息/股利/其他应付款
  '2501', '2502',                          // 长期借款、应付债券
  '2701', '2702',                          // 长期应付款、未确认融资费用
];

export function isMonetarySubject(code: string | undefined | null): boolean {
  if (!code) return false;
  return MONETARY_SUBJECT_PREFIXES.some(prefix => code.startsWith(prefix));
}

/** 判断分录是否为外币分录（有币别且非本位币） */
export function isForeignCurrencyEntry(entry: {
  currencyCode?: string | null;
  originalAmount?: number | null;
  exchangeRate?: number | null;
}): boolean {
  return !!entry.currencyCode && entry.currencyCode !== 'CNY';
}

/** 判断一组分录中是否存在外币分录（用于决定是否显示币别列） */
export function hasAnyForeignCurrency(
  entries: Array<{ currencyCode?: string | null }>,
): boolean {
  return entries.some(e => !!e.currencyCode && e.currencyCode !== 'CNY');
}
