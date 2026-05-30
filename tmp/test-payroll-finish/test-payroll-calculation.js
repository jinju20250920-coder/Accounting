"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const payroll_1 = require("./src/lib/payroll");
const config = {
    socialInsurance: {
        pension: { enabled: true, employeeRate: 0.08, employerRate: 0.16 },
        medical: { enabled: true, employeeRate: 0.02, employerRate: 0.1 },
        unemployment: { enabled: true, employeeRate: 0.005, employerRate: 0.005 },
        injury: { enabled: false, employeeRate: 0, employerRate: 0 },
        maternity: { enabled: false, employeeRate: 0, employerRate: 0 },
        supplementaryMedical: { enabled: false, employeeRate: 0, employerRate: 0 },
        minimumBase: 5000,
        maximumBase: 20000,
        defaultBaseMode: 'gross',
    },
    housingFund: {
        enabled: true,
        employeeRate: 0.07,
        employerRate: 0.07,
        minimumBase: 5000,
        maximumBase: 20000,
        defaultBaseMode: 'gross',
    },
    individualTax: payroll_1.DEFAULT_CUMULATIVE_TAX_CONFIG,
    taxRules: (0, payroll_1.createBlankPayrollCalculationConfig)().taxRules,
};
strict_1.default.equal((0, payroll_1.clampContributionBase)(3000, 5000, 20000), 5000);
strict_1.default.equal((0, payroll_1.clampContributionBase)(30000, 5000, 20000), 20000);
const firstEmployee = (0, payroll_1.calculatePayrollItem)({
    employeeCode: 'E001',
    employeeName: '张三',
    basicSalary: 15000,
    bonus: 1000,
    allowance: 500,
    otherEarnings: 0,
    leaveDeduction: 500,
    otherPreTaxDeduction: 0,
    specialAdditionalDeduction: 1000,
    otherLegalDeduction: 0,
    priorCumulativeIncome: 0,
    priorCumulativeEmployeeContributions: 0,
    priorCumulativeSpecialAdditionalDeduction: 0,
    priorCumulativeOtherLegalDeduction: 0,
    priorCumulativeTaxWithheld: 0,
}, config, 1);
strict_1.default.equal(firstEmployee.grossSalary, 16000);
strict_1.default.equal(firstEmployee.employeeSocialInsurance, 1680);
strict_1.default.equal(firstEmployee.employeeHousingFund, 1120);
strict_1.default.equal(firstEmployee.employerSocialInsurance, 4240);
strict_1.default.equal(firstEmployee.employerHousingFund, 1120);
strict_1.default.equal(firstEmployee.taxableIncomeCumulative, 7200);
strict_1.default.equal(firstEmployee.individualIncomeTax, 216);
strict_1.default.equal(firstEmployee.netSalary, 12984);
strict_1.default.equal(firstEmployee.employerTotalCost, 21360);
const secondEmployee = (0, payroll_1.calculatePayrollItem)({
    employeeCode: 'E002',
    employeeName: '李四',
    basicSalary: 7000,
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
}, config, 1);
const summary = (0, payroll_1.summarizePayrollResults)([firstEmployee, secondEmployee]);
strict_1.default.equal(summary.employeeCount, 2);
strict_1.default.equal(summary.grossTotal, (0, payroll_1.roundMoney)(firstEmployee.grossSalary + secondEmployee.grossSalary));
strict_1.default.equal(summary.netTotal, (0, payroll_1.roundMoney)(firstEmployee.netSalary + secondEmployee.netSalary));
console.log('payroll calculation tests passed');
