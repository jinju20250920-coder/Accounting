import type { BankParserConfig, CustomBankConfig } from './types';
import { ccbConfig } from './configs/ccb';
import { icbcConfig } from './configs/icbc';
import { abcConfig } from './configs/abc';
import { cmbConfig } from './configs/cmb';
import { bocConfig } from './configs/boc';
import { citicConfig } from './configs/citic';
import { bocomConfig } from './configs/bocom';
import { industrialConfig } from './configs/industrial';
import { czbConfig } from './configs/czb';
import { spdbConfig } from './configs/spdb';
import { cmbcConfig } from './configs/cmbc';
import { pinganConfig } from './configs/pingan';
import { huaxiaConfig } from './configs/huaxia';
import { shanghaiConfig } from './configs/shanghai';

/** All built-in bank configs */
const builtInConfigs: BankParserConfig[] = [
  ccbConfig, icbcConfig, abcConfig, cmbConfig, bocConfig, citicConfig,
  bocomConfig, industrialConfig, czbConfig, spdbConfig, cmbcConfig,
  pinganConfig, huaxiaConfig, shanghaiConfig,
];

/** Get all built-in configs */
export function getAllConfigs(): BankParserConfig[] {
  return builtInConfigs;
}

/** Get config by bank ID */
export function getConfigById(id: string): BankParserConfig | undefined {
  return builtInConfigs.find(c => c.id === id);
}

/** Get all configs for detection (built-in + custom) */
export function getAllConfigsWithCustom(customConfigs?: CustomBankConfig[]): BankParserConfig[] {
  const customs = customConfigs?.map(c => c.config) || [];
  return [...builtInConfigs, ...customs];
}

/** Bank list for UI selectors */
export function getBankList(): Array<{ id: string; name: string }> {
  return builtInConfigs.map(c => ({ id: c.id, name: c.name }));
}

/** Bank brand colors and short identifiers for visual display */
export const BANK_BRANDS: Record<string, { color: string; short: string }> = {
  ccb:        { color: '#003DA6', short: '建行' },
  icbc:       { color: '#C50019', short: '工行' },
  abc:        { color: '#008C50', short: '农行' },
  boc:        { color: '#C50019', short: '中行' },
  cmb:        { color: '#CC1931', short: '招行' },
  bocom:      { color: '#003399', short: '交行' },
  citic:      { color: '#E60012', short: '中信' },
  spdb:       { color: '#003399', short: '浦发' },
  cmbc:       { color: '#00A651', short: '民生' },
  industrial: { color: '#003399', short: '兴业' },
  czb:        { color: '#E60012', short: '浙商' },
  pingan:     { color: '#FA6400', short: '平安' },
  huaxia:     { color: '#E60012', short: '华夏' },
  shanghai:   { color: '#003DA6', short: '上海' },
};
