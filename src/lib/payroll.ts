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
  payrollSalaryExpenseSubjectCode?: string;
  payrollSalaryExpenseSubjectName?: string;
  payrollContributionExpenseSubjectCode?: string;
  payrollContributionExpenseSubjectName?: string;
  payrollSalaryPayableSubjectCode?: string;
  payrollSalaryPayableSubjectName?: string;
  payrollTaxPayableSubjectCode?: string;
  payrollTaxPayableSubjectName?: string;
  payrollEmployeeContributionPayableSubjectCode?: string;
  payrollEmployeeContributionPayableSubjectName?: string;
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
  priorCumulativeMonths?: number;
  payrollEmployerContributionPayableSubjectCode?: string;
  payrollEmployerContributionPayableSubjectName?: string;
  otherPostTaxDeduction?: number;

  // 身份信息（个税系统）
  idType?: string;
  idNumber?: string;

  // 五险一金明细（个人当月缴纳额）
  pensionInsurance?: number;
  medicalInsurance?: number;
  unemploymentInsurance?: number;
  housingFund?: number;

  // 专项附加扣除明细（当月金额）
  childEducation?: number;
  continuingEducation?: number;
  housingLoanInterest?: number;
  housingRent?: number;
  elderlyCare?: number;
  infantCare?: number;
  privatePension?: number;

  // 其他扣除项
  taxExemptIncome?: number;
  corporateAnnuity?: number;
  commercialHealthInsurance?: number;
  taxDeferredPension?: number;
  donation?: number;
  taxReduction?: number;
  remark?: string;
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
  ['pensionInsurance', '基本养老保险费'],
  ['medicalInsurance', '基本医疗保险费'],
  ['unemploymentInsurance', '失业保险费'],
  ['housingFund', '住房公积金'],
  ['childEducation', '子女教育'],
  ['continuingEducation', '继续教育'],
  ['housingLoanInterest', '住房贷款利息'],
  ['housingRent', '住房租金'],
  ['elderlyCare', '赡养老人'],
  ['infantCare', '婴幼儿照护'],
  ['privatePension', '个人养老金'],
  ['taxExemptIncome', '免税收入'],
  ['corporateAnnuity', '企业年金'],
  ['commercialHealthInsurance', '商业健康保险'],
  ['taxDeferredPension', '税延养老保险'],
  ['donation', '捐赠额'],
  ['taxReduction', '减免税额'],
] as const satisfies readonly (readonly [keyof PayrollInput, string])[];

export function createBlankPayrollInput(): PayrollInput {
  return {
    employeeCode: '',
    employeeName: '',
    departmentName: '',
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
    priorCumulativeMonths: 1,
    otherPostTaxDeduction: 0,
    pensionInsurance: 0,
    medicalInsurance: 0,
    unemploymentInsurance: 0,
    housingFund: 0,
    childEducation: 0,
    continuingEducation: 0,
    housingLoanInterest: 0,
    housingRent: 0,
    elderlyCare: 0,
    infantCare: 0,
    privatePension: 0,
    taxExemptIncome: 0,
    corporateAnnuity: 0,
    commercialHealthInsurance: 0,
    taxDeferredPension: 0,
    donation: 0,
    taxReduction: 0,
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
  accrualVoucherId?: string;
  accrualVoucherNo?: string;
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

const PRIOR_CUMULATIVE_FIELDS: (keyof Pick<
  PayrollInput,
  | 'priorCumulativeIncome'
  | 'priorCumulativeEmployeeContributions'
  | 'priorCumulativeSpecialAdditionalDeduction'
  | 'priorCumulativeOtherLegalDeduction'
  | 'priorCumulativeTaxWithheld'
>)[] = [
  'priorCumulativeIncome',
  'priorCumulativeEmployeeContributions',
  'priorCumulativeSpecialAdditionalDeduction',
  'priorCumulativeOtherLegalDeduction',
  'priorCumulativeTaxWithheld',
];

function hasManualPriorCumulativeValues(input: PayrollInput): boolean {
  return PRIOR_CUMULATIVE_FIELDS.some((field) => Number(input[field] || 0) !== 0);
}

export function derivePriorCumulativeValues(previousItem: PayrollItem): Pick<
  PayrollInput,
  | 'priorCumulativeIncome'
  | 'priorCumulativeEmployeeContributions'
  | 'priorCumulativeSpecialAdditionalDeduction'
  | 'priorCumulativeOtherLegalDeduction'
  | 'priorCumulativeTaxWithheld'
  | 'priorCumulativeMonths'
> {
  const { inputData, calculationResult } = previousItem;
  const priorCumulativeIncome = roundMoney((inputData.priorCumulativeIncome || 0) + calculationResult.grossSalary);
  const priorCumulativeEmployeeContributions = roundMoney(
    (inputData.priorCumulativeEmployeeContributions || 0)
    + calculationResult.employeeSocialInsurance
    + calculationResult.employeeHousingFund,
  );
  const priorCumulativeSpecialAdditionalDeduction = roundMoney(
    (inputData.priorCumulativeSpecialAdditionalDeduction || 0)
    + (inputData.specialAdditionalDeduction || 0),
  );
  const priorCumulativeOtherLegalDeduction = roundMoney(
    (inputData.priorCumulativeOtherLegalDeduction || 0)
    + (inputData.otherLegalDeduction || 0),
  );
  const priorCumulativeTaxWithheld = roundMoney(
    (inputData.priorCumulativeTaxWithheld || 0)
    + calculationResult.individualIncomeTax,
  );
  const priorCumulativeMonths = Math.max(1, Math.trunc(inputData.priorCumulativeMonths || 0) + 1);

  return {
    priorCumulativeIncome,
    priorCumulativeEmployeeContributions,
    priorCumulativeSpecialAdditionalDeduction,
    priorCumulativeOtherLegalDeduction,
    priorCumulativeTaxWithheld,
    priorCumulativeMonths,
  };
}

export function applyPriorCumulativeValues(input: PayrollInput, previousItem?: PayrollItem): PayrollInput {
  if (!previousItem) return input;
  if (previousItem.calculationResult.taxCalculationType === 'annual_bonus_separate') return input;
  if (hasManualPriorCumulativeValues(input)) return input;
  return {
    ...input,
    ...derivePriorCumulativeValues(previousItem),
  };
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
  if (providedBase === 0) return 0;
  const requestedBase = providedBase ?? (
    config.defaultBaseMode === 'configured' && config.configuredDefaultBase !== undefined
      ? config.configuredDefaultBase
      : grossSalary
  );
  const effectiveBase = Math.min(grossSalary, requestedBase, config.maximumBase);
  return roundMoney(Math.max(0, effectiveBase));
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
  const cumulativeMonths = Math.max(1, Math.trunc(input.priorCumulativeMonths || 0));
  const taxableIncomeCumulative = Math.max(0, roundMoney(
    input.priorCumulativeIncome
    + grossSalary
    - config.individualTax.standardDeductionPerMonth * cumulativeMonths
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
