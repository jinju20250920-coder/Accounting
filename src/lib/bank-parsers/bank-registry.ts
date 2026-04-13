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
