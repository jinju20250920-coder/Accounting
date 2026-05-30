"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const monthly_closing_checks_1 = require("./src/lib/monthly-closing-checks");
const payroll_1 = require("./src/lib/payroll");
const payroll_voucher_1 = require("./src/lib/payroll-voucher");
const salaryCheck = monthly_closing_checks_1.DEFAULT_MONTHLY_CLOSING_TEMPLATES.find((item) => item.code === 'payroll_salary_tax');
const socialCheck = monthly_closing_checks_1.DEFAULT_MONTHLY_CLOSING_TEMPLATES.find((item) => item.code === 'payroll_social_fund');
strict_1.default.equal(salaryCheck?.route, '/payroll');
strict_1.default.equal(socialCheck?.route, '/payroll');
const summary = (0, monthly_closing_checks_1.buildMonthlyClosingSummary)({
    period: '2026-05',
    vouchers: [],
    payrollBatches: [{
            status: 'confirmed',
            taxTotal: 230,
            includesSocialFundCalculation: true,
        }],
});
const salaryEvidence = summary.items.find((item) => item.code === 'payroll_salary_tax');
const socialEvidence = summary.items.find((item) => item.code === 'payroll_social_fund');
strict_1.default.equal(salaryEvidence?.systemStatus, 'warning');
strict_1.default.match(salaryEvidence?.systemMessage || '', /已确认工资计算批次/);
strict_1.default.match(salaryEvidence?.systemMessage || '', /仍需核对/);
strict_1.default.match(socialEvidence?.systemMessage || '', /社保、公积金计算结果/);
const sidebarSource = (0, node_fs_1.readFileSync)('./src/components/layout/sidebar.tsx', 'utf8');
strict_1.default.match(sidebarSource, /薪酬管理/);
strict_1.default.match(sidebarSource, /\/payroll/);
const payrollPageSource = (0, node_fs_1.readFileSync)('./src/app/payroll/page.tsx', 'utf8');
for (const action of ['导入工资表', '下载模板', '计算设置', '确认本月工资', '实发工资']) {
    strict_1.default.match(payrollPageSource, new RegExp(action));
}
for (const action of ['新增行', '保存', '取消', '编辑', '删除']) {
    strict_1.default.match(payrollPageSource, new RegExp(action));
}
strict_1.default.match(payrollPageSource, /createBlankPayrollInput/);
strict_1.default.match(payrollPageSource, /EMPTY_ENTRY_ROW_COUNT\s*=\s*10/);
strict_1.default.match(payrollPageSource, /createBlankPayrollRows/);
strict_1.default.match(payrollPageSource, /saveDraftRows/);
strict_1.default.match(payrollPageSource, /已录入内容将保留/);
strict_1.default.match(payrollPageSource, /addManualItems/);
strict_1.default.match(payrollPageSource, /updateItem/);
strict_1.default.match(payrollPageSource, /deleteItem/);
strict_1.default.match(payrollPageSource, /退回草稿后可修改明细/);
strict_1.default.match(payrollPageSource, /useDepartmentStore/);
strict_1.default.match(payrollPageSource, /usePartnerStore/);
strict_1.default.match(payrollPageSource, /const partners = usePartnerStore\(\(state\) => state\.partners\)/);
strict_1.default.match(payrollPageSource, /partners\.filter\(\(item\) => item\.isEmployee/);
strict_1.default.match(payrollPageSource, /function completeEmployeeFields/);
strict_1.default.match(payrollPageSource, /const employeeField = field === 'employeeCode' \? 'code' : 'name'/);
strict_1.default.match(payrollPageSource, /completeEmployeeFields\(row, 'employeeCode', row\.employeeCode, employeeOptions\)/);
strict_1.default.match(payrollPageSource, /departmentName: employeeDepartmentName/);
strict_1.default.match(payrollPageSource, /function clearDraftRow/);
strict_1.default.match(payrollPageSource, /function clearEditingRow/);
strict_1.default.match(payrollPageSource, /清空本行/);
strict_1.default.match(payrollPageSource, /<Eraser \/>/);
strict_1.default.match(payrollPageSource, /employee-code-options/);
strict_1.default.match(payrollPageSource, /employee-name-options/);
strict_1.default.match(payrollPageSource, /department-options/);
strict_1.default.match(payrollPageSource, /function addDraftRow/);
strict_1.default.match(payrollPageSource, /function handleDraftGridKeyDown/);
strict_1.default.match(payrollPageSource, /新增一行/);
strict_1.default.match(payrollPageSource, /EXCEL_CELL_CLASS/);
strict_1.default.match(payrollPageSource, /EXCEL_HEADER_CELL_CLASS/);
strict_1.default.match(payrollPageSource, /variant="excel"/);
strict_1.default.match(payrollPageSource, /border-collapse/);
strict_1.default.match(payrollPageSource, /border-slate-300/);
for (const resultLabel of ['应发工资', '个税', '实发工资', '企业成本']) {
    strict_1.default.match(payrollPageSource, new RegExp(resultLabel));
}
strict_1.default.match(payrollPageSource, /PAYROLL_RESULT_FIELDS/);
strict_1.default.match(payrollPageSource, /复制上月/);
strict_1.default.match(payrollPageSource, /生成计提凭证/);
strict_1.default.match(payrollPageSource, /工资计提凭证预览/);
strict_1.default.match(payrollPageSource, /PAYROLL_REGION_PRESETS/);
strict_1.default.match(payrollPageSource, /applyPayrollRegionPreset/);
strict_1.default.match(payrollPageSource, /个税默认设置/);
strict_1.default.match(payrollPageSource, /const DISABLE_BROWSER_AUTOFILL = \{ autoComplete: 'off' as const \}/);
strict_1.default.match(payrollPageSource, /\{\.\.\.DISABLE_BROWSER_AUTOFILL\}/);
strict_1.default.match(payrollPageSource, /function formatContributionRatePercent\(rate: number\): number/);
strict_1.default.match(payrollPageSource, /formatContributionRatePercent\(settingsDraft\.socialInsurance\[key\]\.employeeRate\)/);
strict_1.default.match(payrollPageSource, /formatContributionRatePercent\(settingsDraft\.socialInsurance\[key\]\.employerRate\)/);
strict_1.default.match(payrollPageSource, /formatContributionRatePercent\(settingsDraft\.housingFund\.employeeRate\)/);
strict_1.default.match(payrollPageSource, /formatContributionRatePercent\(settingsDraft\.housingFund\.employerRate\)/);
const monthlyClosingChecksPageSource = (0, node_fs_1.readFileSync)('./src/app/monthly-closing-checks/page.tsx', 'utf8');
strict_1.default.match(monthlyClosingChecksPageSource, /useRouter/);
strict_1.default.match(monthlyClosingChecksPageSource, /router\.push\('\/'\)/);
strict_1.default.match(monthlyClosingChecksPageSource, /返回智能做账/);
const payrollDefaultsSource = (0, node_fs_1.readFileSync)('./src/lib/payroll-defaults.ts', 'utf8');
strict_1.default.match(payrollDefaultsSource, /PAYROLL_REGION_PRESETS/);
strict_1.default.match(payrollDefaultsSource, /shanghai/);
strict_1.default.match(payrollDefaultsSource, /applyPayrollRegionPreset/);
const payrollSource = (0, node_fs_1.readFileSync)('./src/lib/payroll.ts', 'utf8');
const payrollTaxRulesSource = (0, node_fs_1.readFileSync)('./src/lib/payroll-tax-rules.ts', 'utf8');
strict_1.default.match(payrollSource, /incomeType\?: PayrollIncomeType/);
strict_1.default.match(payrollSource, /annualBonusTaxMethod\?: PayrollAnnualBonusTaxMethod/);
strict_1.default.match(payrollSource, /calculateAnnualBonusTax/);
strict_1.default.match(payrollTaxRulesSource, /ruleType: 'annual_bonus'/);
strict_1.default.match(payrollTaxRulesSource, /ruleType: 'business_income'/);
const annualBonusConfig = (0, payroll_1.createBlankPayrollCalculationConfig)();
const annualBonusResult = (0, payroll_1.calculatePayrollItem)({
    ...(0, payroll_1.createBlankPayrollInput)(),
    employeeCode: 'EMP-BONUS',
    employeeName: 'Annual Bonus Employee',
    incomeType: 'annual_bonus',
    annualBonusTaxMethod: 'separate',
    bonus: 120000,
}, annualBonusConfig, 12);
strict_1.default.equal(annualBonusResult.grossSalary, 120000);
strict_1.default.equal(annualBonusResult.individualIncomeTax, 11790);
strict_1.default.equal(annualBonusResult.taxCalculationType, 'annual_bonus_separate');
const payrollVoucherSource = (0, node_fs_1.readFileSync)('./src/lib/payroll-voucher.ts', 'utf8');
strict_1.default.match(payrollVoucherSource, /buildPayrollAccrualVoucherPreview/);
strict_1.default.match(payrollVoucherSource, /previewToVoucherEntries/);
strict_1.default.match(payrollVoucherSource, /660201/);
strict_1.default.match(payrollVoucherSource, /resolvePayrollVoucherSubjects/);
strict_1.default.match(payrollVoucherSource, /employeeByCode/);
strict_1.default.match(payrollVoucherSource, /payrollSalaryExpenseSubjectCode/);
const voucherPreview = (0, payroll_voucher_1.buildPayrollAccrualVoucherPreview)([{
        id: 'item-voucher-1',
        batchId: 'batch-voucher-1',
        accountSetId: 'as-1',
        payrollPeriod: '2026-05',
        employeeCode: 'EMP-RD',
        employeeName: 'R&D Employee',
        departmentName: 'R&D',
        inputData: {
            ...(0, payroll_1.createBlankPayrollInput)(),
            employeeCode: 'EMP-RD',
            employeeName: 'R&D Employee',
            basicSalary: 10000,
        },
        calculationResult: (0, payroll_1.calculatePayrollItem)({
            ...(0, payroll_1.createBlankPayrollInput)(),
            employeeCode: 'EMP-RD',
            employeeName: 'R&D Employee',
            basicSalary: 10000,
        }, (0, payroll_1.createBlankPayrollCalculationConfig)(), 5),
        validationStatus: 'valid',
        validationMessages: [],
        createdAt: '2026-05-29T00:00:00.000Z',
        updatedAt: '2026-05-29T00:00:00.000Z',
    }], '2026-05', [{
        id: 'partner-rd',
        code: 'EMP-RD',
        name: 'R&D Employee',
        isCustomer: false,
        isSupplier: false,
        isEmployee: true,
        payrollSalaryExpenseSubjectCode: '660401',
        payrollSalaryExpenseSubjectName: '研发费用-工资',
        frozen: false,
        createTime: '2026-05-29T00:00:00.000Z',
        updateTime: '2026-05-29T00:00:00.000Z',
    }]);
(0, strict_1.default)(voucherPreview.some((entry) => entry.subjectCode === '660401'));
const accountSetFallbackPreview = (0, payroll_voucher_1.buildPayrollAccrualVoucherPreview)([{
        id: 'item-voucher-2',
        batchId: 'batch-voucher-2',
        accountSetId: 'as-1',
        payrollPeriod: '2026-05',
        employeeCode: 'EMP-DEFAULT',
        employeeName: 'Default Subject Employee',
        departmentName: 'Admin',
        inputData: {
            ...(0, payroll_1.createBlankPayrollInput)(),
            employeeCode: 'EMP-DEFAULT',
            employeeName: 'Default Subject Employee',
            basicSalary: 8000,
        },
        calculationResult: (0, payroll_1.calculatePayrollItem)({
            ...(0, payroll_1.createBlankPayrollInput)(),
            employeeCode: 'EMP-DEFAULT',
            employeeName: 'Default Subject Employee',
            basicSalary: 8000,
        }, (0, payroll_1.createBlankPayrollCalculationConfig)(), 5),
        validationStatus: 'valid',
        validationMessages: [],
        createdAt: '2026-05-29T00:00:00.000Z',
        updatedAt: '2026-05-29T00:00:00.000Z',
    }], '2026-05', [], {
    payrollSalaryExpenseSubjectCode: '660299',
    payrollSalaryExpenseSubjectName: '管理费用-工资默认',
});
(0, strict_1.default)(accountSetFallbackPreview.some((entry) => entry.subjectCode === '660299'));
console.log('payroll monthly integration tests passed');
