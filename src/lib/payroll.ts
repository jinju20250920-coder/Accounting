import {
  buildDefaultPayrollTaxRuleSet,
  findPayrollTaxBracket,
  type PayrollTaxRuleSet,
} from './payroll-tax-rules';

export interface ContributionItemConfig {
  enabled: boolean;
  employeeRate: number;
  employerRate: number;
}

export type ContributionBaseMode = 'gross' | 'configured';

export interface SocialInsuranceConfig {
  pension: ContributionItemConfig;
  medical: ContributionItemConfig;
  unemployment: ContributionItemConfig;
  injury: ContributionItemConfig;
  maternity: ContributionItemConfig;
  supplementaryMedical: ContributionItemConfig;
  minimumBase: number;
  maximumBase: number;
  defaultBaseMode: ContributionBaseMode;
  configuredDefaultBase?: number;
}

export interface HousingFundConfig extends ContributionItemConfig {
  minimumBase: number;
  maximumBase: number;
  defaultBaseMode: ContributionBaseMode;
  configuredDefaultBase?: number;
}

export interface CumulativeTaxBracket {
  upperLimit: number | null;
  rate: number;
  quickDeduction: number;
}

export interface CumulativeTaxConfig {
  policyLabel: string;
  policyEffectiveDate: string;
  sourceUrl: string;
  standardDeductionPerMonth: number;
  brackets: CumulativeTaxBracket[];
}

export interface PayrollCalculationConfig {
  socialInsurance: SocialInsuranceConfig;
  housingFund: HousingFundConfig;
  individualTax: CumulativeTaxConfig;
  taxRules: PayrollTaxRuleSet;
}

export type PayrollIncomeType = 'salary' | 'annual_bonus' | 'business_income';
export type PayrollAnnualBonusTaxMethod = 'separate' | 'consolidated';
export type PayrollTaxCalculationType = 'salary_cumulative' | 'annual_bonus_separate' | 'annual_bonus_consolidated';

export interface PayrollInput {
  employeeCode: string;
  employeeName: string;
  departmentName?: string;
  incomeType?: PayrollIncomeType;
  annualBonusTaxMethod?: PayrollAnnualBonusTaxMethod;
  basicSalary: number;
  bonus: number;
  allowance: number;
  otherEarnings: number;
  leaveDeduction: number;
  otherPreTaxDeduction: number;
  socialInsuranceBase?: number;
  housingFundBase?: number;
  specialAdditionalDeduction: number;
  otherLegalDeduction: number;
  priorCumulativeIncome: number;
  priorCumulativeEmployeeContributions: number;
  priorCumulativeSpecialAdditionalDeduction: number;
  priorCumulativeOtherLegalDeduction: number;
  priorCumulativeTaxWithheld: number;
  otherPostTaxDeduction?: number;
}

const PAYROLL_INPUT_AMOUNT_FIELDS = [
  ['basicSalary', '基本工资'],
  ['bonus', '奖金'],
  ['allowance', '津贴补贴'],
  ['otherEarnings', '其他应发'],
  ['leaveDeduction', '请假扣款'],
  ['otherPreTaxDeduction', '其他税前扣减'],
  ['socialInsuranceBase', '社保缴费基数'],
  ['housingFundBase', '公积金缴费基数'],
  ['specialAdditionalDeduction', '专项附加扣除'],
  ['otherLegalDeduction', '其他依法扣除'],
  ['priorCumulativeIncome', '前期累计收入'],
  ['priorCumulativeEmployeeContributions', '前期累计个人社保公积金'],
  ['priorCumulativeSpecialAdditionalDeduction', '前期累计专项附加扣除'],
  ['priorCumulativeOtherLegalDeduction', '前期累计其他依法扣除'],
  ['priorCumulativeTaxWithheld', '前期累计已预扣税额'],
  ['otherPostTaxDeduction', '其他税后扣减'],
] as const satisfies readonly (readonly [keyof PayrollInput, string])[];

export function createBlankPayrollInput(): PayrollInput {
  return {
    employeeCode: '',
    employeeName: '',
    departmentName: '',
    incomeType: 'salary',
    annualBonusTaxMethod: 'separate',
    basicSalary: 0,
    bonus: 0,
    allowance: 0,
    otherEarnings: 0,
    leaveDeduction: 0,
    otherPreTaxDeduction: 0,
    specialAdditionalDeduction: 0,
    otherLegalDeduction: 0,
    priorCumulativeIncome: 0,
    priorCumulativeEmployeeContributions: 0,
    priorCumulativeSpecialAdditionalDeduction: 0,
    priorCumulativeOtherLegalDeduction: 0,
    priorCumulativeTaxWithheld: 0,
    otherPostTaxDeduction: 0,
  };
}

export function validatePayrollInput(input: PayrollInput, existingEmployeeCodes: string[]): string[] {
  const errors: string[] = [];
  const employeeCode = input.employeeCode.trim();

  if (!employeeCode) errors.push('工号不能为空');
  if (!input.employeeName.trim()) errors.push('姓名不能为空');
  if (employeeCode && existingEmployeeCodes.some((code) => code.trim() === employeeCode)) errors.push('重复工号');

  PAYROLL_INPUT_AMOUNT_FIELDS.forEach(([field, label]) => {
    const value = input[field];
    if (value === undefined) return;
    if (!Number.isFinite(value)) {
      errors.push(`${label}必须为有限数字`);
    } else if (value < 0) {
      errors.push(`${label}不得为负数`);
    }
  });

  return errors;
}

export interface PayrollCalculationResult {
  employeeCode: string;
  employeeName: string;
  departmentName?: string;
  grossSalary: number;
  socialInsuranceBase: number;
  housingFundBase: number;
  employeeSocialInsurance: number;
  employerSocialInsurance: number;
  employeeHousingFund: number;
  employerHousingFund: number;
  taxableIncomeCumulative: number;
  individualIncomeTax: number;
  netSalary: number;
  employerTotalCost: number;
  taxCalculationType: PayrollTaxCalculationType;
  annualBonusTaxMethod?: PayrollAnnualBonusTaxMethod;
  annualBonusTaxableAverage?: number;
}

export interface PayrollSummary {
  employeeCount: number;
  grossTotal: number;
  employeeContributionTotal: number;
  employerContributionTotal: number;
  taxTotal: number;
  netTotal: number;
  employerCostTotal: number;
}

export type PayrollBatchStatus = 'draft' | 'calculated' | 'confirmed';

export interface PayrollBatch {
  id: string;
  accountSetId: string;
  payrollPeriod: string;
  batchName: string;
  status: PayrollBatchStatus;
  sourceFileName?: string;
  employeeCount: number;
  grossTotal: number;
  employerCostTotal: number;
  taxTotal: number;
  netTotal: number;
  calculationConfigSnapshot: PayrollCalculationConfig;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
}

export interface PayrollItem {
  id: string;
  batchId: string;
  accountSetId: string;
  payrollPeriod: string;
  employeeCode: string;
  employeeName: string;
  departmentName?: string;
  inputData: PayrollInput;
  calculationResult: PayrollCalculationResult;
  validationStatus: 'valid' | 'invalid';
  validationMessages: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PayrollCalculationConfigRecord {
  id: string;
  accountSetId: string;
  effectivePeriod: string;
  config: PayrollCalculationConfig;
  policyLabel: string;
  policyEffectiveDate: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 国家税务总局公告2018年第61号，2019-01-01施行：
 * https://fgk.chinatax.gov.cn/zcfgk/c100012/c5194838/content.html
 */
export const DEFAULT_CUMULATIVE_TAX_CONFIG: CumulativeTaxConfig = {
  policyLabel: '国家税务总局公告2018年第61号',
  policyEffectiveDate: '2019-01-01',
  sourceUrl: 'https://www.chinatax.gov.cn/n810341/n810755/c3960202/content.html',
  standardDeductionPerMonth: 5000,
  brackets: [
    { upperLimit: 36000, rate: 0.03, quickDeduction: 0 },
    { upperLimit: 144000, rate: 0.1, quickDeduction: 2520 },
    { upperLimit: 300000, rate: 0.2, quickDeduction: 16920 },
    { upperLimit: 420000, rate: 0.25, quickDeduction: 31920 },
    { upperLimit: 660000, rate: 0.3, quickDeduction: 52920 },
    { upperLimit: 960000, rate: 0.35, quickDeduction: 85920 },
    { upperLimit: null, rate: 0.45, quickDeduction: 181920 },
  ],
};

export function createBlankPayrollCalculationConfig(): PayrollCalculationConfig {
  const emptyContribution = (): ContributionItemConfig => ({
    enabled: false,
    employeeRate: 0,
    employerRate: 0,
  });

  return {
    socialInsurance: {
      pension: emptyContribution(),
      medical: emptyContribution(),
      unemployment: emptyContribution(),
      injury: emptyContribution(),
      maternity: emptyContribution(),
      supplementaryMedical: emptyContribution(),
      minimumBase: 0,
      maximumBase: 100000,
      defaultBaseMode: 'gross',
    },
    housingFund: {
      enabled: true,
      employeeRate: 0,
      employerRate: 0,
      minimumBase: 0,
      maximumBase: 100000,
      defaultBaseMode: 'gross',
    },
    individualTax: DEFAULT_CUMULATIVE_TAX_CONFIG,
    taxRules: buildDefaultPayrollTaxRuleSet(),
  };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function clampContributionBase(value: number, minimumBase: number, maximumBase: number): number {
  return Math.min(Math.max(value, minimumBase), maximumBase);
}

function resolveContributionBase(
  providedBase: number | undefined,
  grossSalary: number,
  config: { minimumBase: number; maximumBase: number; defaultBaseMode: ContributionBaseMode; configuredDefaultBase?: number },
): number {
  const fallback = config.defaultBaseMode === 'configured' && config.configuredDefaultBase !== undefined
    ? config.configuredDefaultBase
    : grossSalary;
  return roundMoney(clampContributionBase(providedBase ?? fallback, config.minimumBase, config.maximumBase));
}

function calculateSocialContribution(
  base: number,
  config: SocialInsuranceConfig,
): { employee: number; employer: number } {
  const contributionItems = [
    config.pension,
    config.medical,
    config.unemployment,
    config.injury,
    config.maternity,
    config.supplementaryMedical,
  ].filter((item) => item.enabled);

  return contributionItems.reduce(
    (total, item) => ({
      employee: roundMoney(total.employee + roundMoney(base * item.employeeRate)),
      employer: roundMoney(total.employer + roundMoney(base * item.employerRate)),
    }),
    { employee: 0, employer: 0 },
  );
}

function calculateHousingFundContribution(
  base: number,
  config: HousingFundConfig,
): { employee: number; employer: number } {
  if (!config.enabled) return { employee: 0, employer: 0 };
  return {
    employee: roundMoney(base * config.employeeRate),
    employer: roundMoney(base * config.employerRate),
  };
}

function findTaxBracket(taxableIncome: number, config: CumulativeTaxConfig): CumulativeTaxBracket {
  return config.brackets.find((bracket) => bracket.upperLimit === null || taxableIncome <= bracket.upperLimit)
    || config.brackets[config.brackets.length - 1];
}

export function calculateAnnualBonusTax(
  annualBonusAmount: number,
  taxRules?: PayrollTaxRuleSet,
): {
  tax: number;
  taxableAverage: number;
  rate: number;
  quickDeduction: number;
} {
  const taxableAverage = roundMoney(annualBonusAmount / 12);
  const bracket = findPayrollTaxBracket('annual_bonus', taxableAverage, taxRules);
  return {
    tax: roundMoney(Math.max(0, annualBonusAmount * bracket.rate - bracket.quickDeduction)),
    taxableAverage,
    rate: bracket.rate,
    quickDeduction: bracket.quickDeduction,
  };
}

export function calculatePayrollItem(
  input: PayrollInput,
  config: PayrollCalculationConfig,
  calculationMonth: number,
): PayrollCalculationResult {
  const incomeType = input.incomeType || 'salary';
  const annualBonusTaxMethod = input.annualBonusTaxMethod || 'separate';

  if (incomeType === 'annual_bonus' && annualBonusTaxMethod === 'separate') {
    const grossSalary = roundMoney(
      input.bonus
      + input.otherEarnings
      + input.allowance
      - input.leaveDeduction
      - input.otherPreTaxDeduction,
    );
    const annualBonusTax = calculateAnnualBonusTax(grossSalary, config.taxRules);
    const netSalary = roundMoney(grossSalary - annualBonusTax.tax - (input.otherPostTaxDeduction ?? 0));

    return {
      employeeCode: input.employeeCode,
      employeeName: input.employeeName,
      departmentName: input.departmentName,
      grossSalary,
      socialInsuranceBase: 0,
      housingFundBase: 0,
      employeeSocialInsurance: 0,
      employerSocialInsurance: 0,
      employeeHousingFund: 0,
      employerHousingFund: 0,
      taxableIncomeCumulative: grossSalary,
      individualIncomeTax: annualBonusTax.tax,
      netSalary,
      employerTotalCost: grossSalary,
      taxCalculationType: 'annual_bonus_separate',
      annualBonusTaxMethod,
      annualBonusTaxableAverage: annualBonusTax.taxableAverage,
    };
  }

  const grossSalary = roundMoney(
    input.basicSalary
    + input.bonus
    + input.allowance
    + input.otherEarnings
    - input.leaveDeduction
    - input.otherPreTaxDeduction,
  );
  const socialInsuranceBase = resolveContributionBase(input.socialInsuranceBase, grossSalary, config.socialInsurance);
  const housingFundBase = resolveContributionBase(input.housingFundBase, grossSalary, config.housingFund);
  const socialInsurance = calculateSocialContribution(socialInsuranceBase, config.socialInsurance);
  const housingFund = calculateHousingFundContribution(housingFundBase, config.housingFund);
  const currentEmployeeContributions = roundMoney(socialInsurance.employee + housingFund.employee);
  const taxableIncomeCumulative = Math.max(0, roundMoney(
    input.priorCumulativeIncome
    + grossSalary
    - config.individualTax.standardDeductionPerMonth * calculationMonth
    - input.priorCumulativeEmployeeContributions
    - currentEmployeeContributions
    - input.priorCumulativeSpecialAdditionalDeduction
    - input.specialAdditionalDeduction
    - input.priorCumulativeOtherLegalDeduction
    - input.otherLegalDeduction,
  ));
  const salaryTaxConfig = {
    ...config.individualTax,
    brackets: (config.taxRules?.salary?.length
      ? config.taxRules.salary.map((rule) => ({
          upperLimit: rule.upperLimit,
          rate: rule.rate,
          quickDeduction: rule.quickDeduction,
        }))
      : config.individualTax.brackets),
  };
  const bracket = findTaxBracket(taxableIncomeCumulative, salaryTaxConfig);
  const cumulativeTax = roundMoney(taxableIncomeCumulative * bracket.rate - bracket.quickDeduction);
  const individualIncomeTax = roundMoney(Math.max(0, cumulativeTax - input.priorCumulativeTaxWithheld));
  const netSalary = roundMoney(
    grossSalary
    - currentEmployeeContributions
    - individualIncomeTax
    - (input.otherPostTaxDeduction ?? 0),
  );

  return {
    employeeCode: input.employeeCode,
    employeeName: input.employeeName,
    departmentName: input.departmentName,
    grossSalary,
    socialInsuranceBase,
    housingFundBase,
    employeeSocialInsurance: socialInsurance.employee,
    employerSocialInsurance: socialInsurance.employer,
    employeeHousingFund: housingFund.employee,
    employerHousingFund: housingFund.employer,
    taxableIncomeCumulative,
    individualIncomeTax,
    netSalary,
    employerTotalCost: roundMoney(grossSalary + socialInsurance.employer + housingFund.employer),
    taxCalculationType: incomeType === 'annual_bonus' ? 'annual_bonus_consolidated' : 'salary_cumulative',
    annualBonusTaxMethod: incomeType === 'annual_bonus' ? annualBonusTaxMethod : undefined,
  };
}

export function summarizePayrollResults(items: PayrollCalculationResult[]): PayrollSummary {
  return items.reduce<PayrollSummary>(
    (summary, item) => ({
      employeeCount: summary.employeeCount + 1,
      grossTotal: roundMoney(summary.grossTotal + item.grossSalary),
      employeeContributionTotal: roundMoney(
        summary.employeeContributionTotal + item.employeeSocialInsurance + item.employeeHousingFund,
      ),
      employerContributionTotal: roundMoney(
        summary.employerContributionTotal + item.employerSocialInsurance + item.employerHousingFund,
      ),
      taxTotal: roundMoney(summary.taxTotal + item.individualIncomeTax),
      netTotal: roundMoney(summary.netTotal + item.netSalary),
      employerCostTotal: roundMoney(summary.employerCostTotal + item.employerTotalCost),
    }),
    {
      employeeCount: 0,
      grossTotal: 0,
      employeeContributionTotal: 0,
      employerContributionTotal: 0,
      taxTotal: 0,
      netTotal: 0,
      employerCostTotal: 0,
    },
  );
}
