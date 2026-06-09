import {
  createBlankPayrollCalculationConfig,
  type PayrollCalculationConfig,
  type SocialInsuranceConfig,
} from '@/lib/payroll';

export type PayrollRegionId = 'generic' | 'shanghai' | 'beijing' | 'shenzhen' | 'guangzhou' | 'hangzhou' | 'nanjing' | 'chengdu';

export interface PayrollRegionPreset {
  id: PayrollRegionId;
  name: string;
  description: string;
  socialInsurance: SocialInsuranceConfig;
  housingFund: PayrollCalculationConfig['housingFund'];
}

export const PAYROLL_TAX_SCENARIO_NOTES = [
  {
    id: 'monthly_wage',
    name: '工资薪金',
    description: '按居民个人综合所得累计预扣预缴计算，当前工资表默认使用这套规则。',
  },
  {
    id: 'annual_bonus',
    name: '全年一次性奖金',
    description: '可选择并入综合所得，也可在现行延续政策下单独计税；单独计税时通常用奖金除以 12 找税率和速算扣除数。',
  },
  {
    id: 'business_income',
    name: '个体工商户经营所得',
    description: '不按工资薪金累计预扣规则计算，通常按经营所得 5%-35% 超额累进税率和申报周期处理。',
  },
];

function contribution(employeeRate: number, employerRate: number, enabled = true) {
  return { enabled, employeeRate, employerRate };
}

function presetConfig(overrides: Partial<PayrollCalculationConfig>): PayrollCalculationConfig {
  const base = createBlankPayrollCalculationConfig();
  return {
    ...base,
    ...overrides,
    socialInsurance: { ...base.socialInsurance, ...overrides.socialInsurance },
    housingFund: { ...base.housingFund, ...overrides.housingFund },
  };
}

export const PAYROLL_REGION_PRESETS: PayrollRegionPreset[] = [
  {
    id: 'generic',
    name: '通用默认',
    description: '常用企业参考比例，适合没有明确地区政策时先启用。',
    ...presetConfig({
      socialInsurance: {
        pension: contribution(0.08, 0.16),
        medical: contribution(0.02, 0.09),
        unemployment: contribution(0.005, 0.005),
        injury: contribution(0, 0.002),
        maternity: contribution(0, 0, false),
        supplementaryMedical: contribution(0, 0, false),
        minimumBase: 5000,
        maximumBase: 30000,
        defaultBaseMode: 'gross',
      },
      housingFund: {
        enabled: true,
        employeeRate: 0.07,
        employerRate: 0.07,
        minimumBase: 5000,
        maximumBase: 30000,
        defaultBaseMode: 'gross',
      },
    }),
  },
  {
    id: 'shanghai',
    name: '上海默认',
    description: '上海常用参考比例和上下限，实际以当地当年公告为准。',
    ...presetConfig({
      socialInsurance: {
        pension: contribution(0.08, 0.16),
        medical: contribution(0.02, 0.095),
        unemployment: contribution(0.005, 0.005),
        injury: contribution(0, 0.0026),
        maternity: contribution(0, 0, false),
        supplementaryMedical: contribution(0, 0, false),
        minimumBase: 7384,
        maximumBase: 36921,
        defaultBaseMode: 'gross',
      },
      housingFund: {
        enabled: true,
        employeeRate: 0.07,
        employerRate: 0.07,
        minimumBase: 2690,
        maximumBase: 36921,
        defaultBaseMode: 'gross',
      },
    }),
  },
  {
    id: 'beijing',
    name: '北京默认',
    description: '北京常用参考比例和上下限，实际以当地当年公告为准。',
    ...presetConfig({
      socialInsurance: {
        pension: contribution(0.08, 0.16),
        medical: contribution(0.02, 0.098),
        unemployment: contribution(0.005, 0.005),
        injury: contribution(0, 0.002),
        maternity: contribution(0, 0, false),
        supplementaryMedical: contribution(0, 0, false),
        minimumBase: 6821,
        maximumBase: 35283,
        defaultBaseMode: 'gross',
      },
      housingFund: {
        enabled: true,
        employeeRate: 0.12,
        employerRate: 0.12,
        minimumBase: 2420,
        maximumBase: 35283,
        defaultBaseMode: 'gross',
      },
    }),
  },
  {
    id: 'shenzhen',
    name: '深圳默认',
    description: '深圳常用参考比例和上下限，实际以当地当年公告为准。',
    ...presetConfig({
      socialInsurance: {
        pension: contribution(0.08, 0.15),
        medical: contribution(0.02, 0.06),
        unemployment: contribution(0.003, 0.007),
        injury: contribution(0, 0.0014),
        maternity: contribution(0, 0, false),
        supplementaryMedical: contribution(0, 0, false),
        minimumBase: 2360,
        maximumBase: 38892,
        defaultBaseMode: 'gross',
      },
      housingFund: {
        enabled: true,
        employeeRate: 0.05,
        employerRate: 0.05,
        minimumBase: 2360,
        maximumBase: 38892,
        defaultBaseMode: 'gross',
      },
    }),
  },
  {
    id: 'guangzhou',
    name: '广州默认',
    description: '广州常用参考比例和上下限，实际以当地当年公告为准。',
    ...presetConfig({
      socialInsurance: {
        pension: contribution(0.08, 0.14),
        medical: contribution(0.02, 0.055),
        unemployment: contribution(0.002, 0.008),
        injury: contribution(0, 0.002),
        maternity: contribution(0, 0, false),
        supplementaryMedical: contribution(0, 0, false),
        minimumBase: 5284,
        maximumBase: 26421,
        defaultBaseMode: 'gross',
      },
      housingFund: {
        enabled: true,
        employeeRate: 0.05,
        employerRate: 0.05,
        minimumBase: 2300,
        maximumBase: 38082,
        defaultBaseMode: 'gross',
      },
    }),
  },
  {
    id: 'hangzhou',
    name: '杭州默认',
    description: '杭州常用参考比例和上下限，实际以当地当年公告为准。',
    ...presetConfig({
      socialInsurance: {
        pension: contribution(0.08, 0.14),
        medical: contribution(0.02, 0.095),
        unemployment: contribution(0.005, 0.005),
        injury: contribution(0, 0.002),
        maternity: contribution(0, 0, false),
        supplementaryMedical: contribution(0, 0, false),
        minimumBase: 4462,
        maximumBase: 24060,
        defaultBaseMode: 'gross',
      },
      housingFund: {
        enabled: true,
        employeeRate: 0.12,
        employerRate: 0.12,
        minimumBase: 2490,
        maximumBase: 38390,
        defaultBaseMode: 'gross',
      },
    }),
  },
  {
    id: 'nanjing',
    name: '南京默认',
    description: '南京常用参考比例和上下限，实际以当地当年公告为准。',
    ...presetConfig({
      socialInsurance: {
        pension: contribution(0.08, 0.16),
        medical: contribution(0.02, 0.09),
        unemployment: contribution(0.005, 0.005),
        injury: contribution(0, 0.002),
        maternity: contribution(0, 0, false),
        supplementaryMedical: contribution(0, 0, false),
        minimumBase: 4494,
        maximumBase: 24042,
        defaultBaseMode: 'gross',
      },
      housingFund: {
        enabled: true,
        employeeRate: 0.08,
        employerRate: 0.08,
        minimumBase: 2490,
        maximumBase: 37200,
        defaultBaseMode: 'gross',
      },
    }),
  },
  {
    id: 'chengdu',
    name: '成都默认',
    description: '成都常用参考比例和上下限，实际以当地当年公告为准。',
    ...presetConfig({
      socialInsurance: {
        pension: contribution(0.08, 0.16),
        medical: contribution(0.02, 0.075),
        unemployment: contribution(0.004, 0.006),
        injury: contribution(0, 0.002),
        maternity: contribution(0, 0, false),
        supplementaryMedical: contribution(0, 0, false),
        minimumBase: 4246,
        maximumBase: 21228,
        defaultBaseMode: 'gross',
      },
      housingFund: {
        enabled: true,
        employeeRate: 0.06,
        employerRate: 0.06,
        minimumBase: 2100,
        maximumBase: 29357,
        defaultBaseMode: 'gross',
      },
    }),
  },
];

export function getPayrollRegionPreset(regionId: string | undefined): PayrollRegionPreset {
  return PAYROLL_REGION_PRESETS.find((preset) => preset.id === regionId) || PAYROLL_REGION_PRESETS[0];
}

export function getDefaultPayrollRegionId(accountSet: unknown): PayrollRegionId {
  return ((accountSet as { payrollRegionId?: PayrollRegionId } | null | undefined)?.payrollRegionId) || 'generic';
}

const ADDRESS_REGION_KEYWORDS: Array<{ keywords: string[]; regionId: PayrollRegionId }> = [
  { keywords: ['上海'], regionId: 'shanghai' },
  { keywords: ['北京'], regionId: 'beijing' },
  { keywords: ['深圳'], regionId: 'shenzhen' },
  { keywords: ['广州'], regionId: 'guangzhou' },
  { keywords: ['杭州'], regionId: 'hangzhou' },
  { keywords: ['南京'], regionId: 'nanjing' },
  { keywords: ['成都', '四川'], regionId: 'chengdu' },
];

export function inferRegionFromAddress(address: string): PayrollRegionId {
  if (!address) return 'generic';
  for (const { keywords, regionId } of ADDRESS_REGION_KEYWORDS) {
    if (keywords.some(kw => address.includes(kw))) return regionId;
  }
  return 'generic';
}

export function applyPayrollRegionPreset(
  config: PayrollCalculationConfig,
  regionId: string,
): PayrollCalculationConfig {
  const preset = getPayrollRegionPreset(regionId);
  return {
    ...config,
    socialInsurance: { ...preset.socialInsurance },
    housingFund: { ...preset.housingFund },
  };
}
