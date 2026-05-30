"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILT_IN_PAYROLL_TAX_RULES = void 0;
exports.buildDefaultPayrollTaxRuleSet = buildDefaultPayrollTaxRuleSet;
exports.clonePayrollTaxRuleSet = clonePayrollTaxRuleSet;
exports.getPayrollTaxRules = getPayrollTaxRules;
exports.findPayrollTaxBracket = findPayrollTaxBracket;
exports.BUILT_IN_PAYROLL_TAX_RULES = [
    { id: 'salary-2019-001', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 0, upperLimit: 36000, rate: 0.03, quickDeduction: 0, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'salary-2019-002', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 36000, upperLimit: 144000, rate: 0.1, quickDeduction: 2520, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'salary-2019-003', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 144000, upperLimit: 300000, rate: 0.2, quickDeduction: 16920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'salary-2019-004', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 300000, upperLimit: 420000, rate: 0.25, quickDeduction: 31920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'salary-2019-005', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 420000, upperLimit: 660000, rate: 0.3, quickDeduction: 52920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'salary-2019-006', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 660000, upperLimit: 960000, rate: 0.35, quickDeduction: 85920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'salary-2019-007', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 960000, upperLimit: null, rate: 0.45, quickDeduction: 181920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'annual-bonus-2019-001', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 0, upperLimit: 3000, rate: 0.03, quickDeduction: 0, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'annual-bonus-2019-002', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 3000, upperLimit: 12000, rate: 0.1, quickDeduction: 210, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'annual-bonus-2019-003', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 12000, upperLimit: 25000, rate: 0.2, quickDeduction: 1410, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'annual-bonus-2019-004', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 25000, upperLimit: 35000, rate: 0.25, quickDeduction: 2660, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'annual-bonus-2019-005', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 35000, upperLimit: 55000, rate: 0.3, quickDeduction: 4410, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'annual-bonus-2019-006', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 55000, upperLimit: 80000, rate: 0.35, quickDeduction: 7160, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'annual-bonus-2019-007', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 80000, upperLimit: null, rate: 0.45, quickDeduction: 15160, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'business-income-2019-001', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 0, upperLimit: 30000, rate: 0.05, quickDeduction: 0, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'business-income-2019-002', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 30000, upperLimit: 90000, rate: 0.1, quickDeduction: 1500, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'business-income-2019-003', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 90000, upperLimit: 300000, rate: 0.2, quickDeduction: 10500, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'business-income-2019-004', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 300000, upperLimit: 500000, rate: 0.3, quickDeduction: 40500, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
    { id: 'business-income-2019-005', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 500000, upperLimit: null, rate: 0.35, quickDeduction: 65500, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
];
function buildDefaultPayrollTaxRuleSet() {
    return {
        salary: exports.BUILT_IN_PAYROLL_TAX_RULES.filter((rule) => rule.ruleType === 'salary').map((rule) => ({ ...rule })),
        annual_bonus: exports.BUILT_IN_PAYROLL_TAX_RULES.filter((rule) => rule.ruleType === 'annual_bonus').map((rule) => ({ ...rule })),
        business_income: exports.BUILT_IN_PAYROLL_TAX_RULES.filter((rule) => rule.ruleType === 'business_income').map((rule) => ({ ...rule })),
    };
}
function clonePayrollTaxRuleSet(taxRules) {
    const defaults = buildDefaultPayrollTaxRuleSet();
    return {
        salary: (taxRules?.salary?.length ? taxRules.salary : defaults.salary).map((rule) => ({ ...rule })),
        annual_bonus: (taxRules?.annual_bonus?.length ? taxRules.annual_bonus : defaults.annual_bonus).map((rule) => ({ ...rule })),
        business_income: (taxRules?.business_income?.length ? taxRules.business_income : defaults.business_income).map((rule) => ({ ...rule })),
    };
}
function getPayrollTaxRules(ruleType) {
    return exports.BUILT_IN_PAYROLL_TAX_RULES
        .filter((rule) => rule.ruleType === ruleType && rule.enabled)
        .sort((a, b) => a.lowerLimit - b.lowerLimit);
}
function findPayrollTaxBracket(ruleType, amount, customRules) {
    const normalizedRules = customRules ? clonePayrollTaxRuleSet(customRules) : null;
    const rules = (normalizedRules?.[ruleType] || getPayrollTaxRules(ruleType))
        .filter((rule) => rule.enabled)
        .sort((a, b) => a.lowerLimit - b.lowerLimit);
    return rules.find((rule) => amount > rule.lowerLimit && (rule.upperLimit === null || amount <= rule.upperLimit))
        || rules[rules.length - 1];
}
