/**
 * Asset Acquisition Rule Engine
 *
 * 固定资产取得规则引擎 - 处理非发票来源的科目映射
 */

import type { Subject } from '@/types';

// 取得规则接口
export interface AssetAcquisitionRule {
  id: string;
  name: string;
  acquisitionType: string;
  debitSubjectCode: string;   // 借方科目（默认固定资产）
  debitSubjectName: string;
  creditSubjectCode: string;  // 贷方科目
  creditSubjectName: string;
  requireSupplier?: boolean;  // 是否需要供应商
  requireBankAccount?: boolean; // 是否需要银行账户
  requirePartner?: boolean;   // 是否需要往来单位
  priority: number;
  enabled: boolean;
}

// 默认取得规则
export const DEFAULT_ACQUISITION_RULES: AssetAcquisitionRule[] = [
  {
    id: 'rule_invoice',
    name: '发票取得',
    acquisitionType: 'invoice',
    debitSubjectCode: '1501',
    debitSubjectName: '固定资产',
    creditSubjectCode: '2202',
    creditSubjectName: '应付账款',
    requireSupplier: true,
    priority: 1,
    enabled: true,
  },
  {
    id: 'rule_purchase',
    name: '购入',
    acquisitionType: 'purchase',
    debitSubjectCode: '1501',
    debitSubjectName: '固定资产',
    creditSubjectCode: '1002',
    creditSubjectName: '银行存款',
    requireBankAccount: true,
    priority: 2,
    enabled: true,
  },
  {
    id: 'rule_shareholder',
    name: '股东投入',
    acquisitionType: 'shareholder_input',
    debitSubjectCode: '1501',
    debitSubjectName: '固定资产',
    creditSubjectCode: '4001',
    creditSubjectName: '实收资本',
    priority: 3,
    enabled: true,
  },
  {
    id: 'rule_surplus',
    name: '盘盈',
    acquisitionType: 'surplus',
    debitSubjectCode: '1501',
    debitSubjectName: '固定资产',
    creditSubjectCode: '6301',
    creditSubjectName: '营业外收入',
    priority: 4,
    enabled: true,
  },
  {
    id: 'rule_internal',
    name: '内部转入',
    acquisitionType: 'internal_transfer',
    debitSubjectCode: '1501',
    debitSubjectName: '固定资产',
    creditSubjectCode: '2241',
    creditSubjectName: '其他应付款',
    requirePartner: true,
    priority: 5,
    enabled: true,
  },
  {
    id: 'rule_opening',
    name: '期初导入',
    acquisitionType: 'opening_balance',
    debitSubjectCode: '1501',
    debitSubjectName: '固定资产',
    creditSubjectCode: '',
    creditSubjectName: '不生成凭证',
    priority: 6,
    enabled: true,
  },
  {
    id: 'rule_other',
    name: '其他',
    acquisitionType: 'other',
    debitSubjectCode: '1501',
    debitSubjectName: '固定资产',
    creditSubjectCode: '1901',
    creditSubjectName: '待处理财产损溢',
    priority: 7,
    enabled: true,
  },
];

// 取得类型显示名称
export const ACQUISITION_TYPE_NAMES: Record<string, string> = {
  invoice: '发票取得',
  purchase: '购入',
  shareholder_input: '股东投入',
  surplus: '盘盈',
  internal_transfer: '内部转入',
  opening_balance: '期初导入',
  other: '其他',
};

// 入账状态显示名称
export const ACCOUNTING_STATUS_NAMES: Record<string, string> = {
  pending: '未入账',
  accounted: '已入账',
  depreciating: '折旧中',
  disposed: '已处置',
};

/**
 * 根据取得类型获取规则
 */
export function getRuleByAcquisitionType(
  acquisitionType: string,
  rules: AssetAcquisitionRule[] = DEFAULT_ACQUISITION_RULES,
): AssetAcquisitionRule | undefined {
  return rules.find(r => r.acquisitionType === acquisitionType && r.enabled);
}

/**
 * 获取取得凭证的借贷分录
 */
export function getAcquisitionVoucherEntries(
  acquisitionType: string,
  originalValue: number,
  assetSubjectCode: string,
  assetSubjectName: string,
  rules?: AssetAcquisitionRule[],
): { debitSubject: string; debitName: string; creditSubject: string; creditName: string; amount: number } | null {
  const rule = getRuleByAcquisitionType(acquisitionType, rules);
  if (!rule || !rule.creditSubjectCode) return null;

  return {
    debitSubject: assetSubjectCode || rule.debitSubjectCode,
    debitName: assetSubjectName || rule.debitSubjectName,
    creditSubject: rule.creditSubjectCode,
    creditName: rule.creditSubjectName,
    amount: originalValue,
  };
}

/**
 * 检查是否需要生成取得凭证
 */
export function shouldGenerateAcquisitionVoucher(acquisitionType: string): boolean {
  // 期初导入不生成凭证
  if (acquisitionType === 'opening_balance') return false;
  return true;
}

/**
 * 检查是否允许折旧
 */
export function canDepreciate(accountingStatus: string | undefined): boolean {
  // 只有已入账和折旧中状态可以折旧
  return accountingStatus === 'accounted' || accountingStatus === 'depreciating';
}
