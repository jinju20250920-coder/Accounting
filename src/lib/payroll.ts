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
}

export interface PayrollInput {
  employeeCode: string;
  employeeName: string;
  departmentName?: string;
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

export function calculatePayrollItem(
  input: PayrollInput,
  config: PayrollCalculationConfig,
  calculationMonth: number,
): PayrollCalculationResult {
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
  const bracket = findTaxBracket(taxableIncomeCumulative, config.individualTax);
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
