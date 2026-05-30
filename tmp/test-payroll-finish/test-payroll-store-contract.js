"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const payroll_1 = require("./src/lib/payroll");
const blankConfig = (0, payroll_1.createBlankPayrollCalculationConfig)();
strict_1.default.equal(blankConfig.socialInsurance.pension.employeeRate, 0);
strict_1.default.equal(blankConfig.housingFund.enabled, true);
strict_1.default.equal(blankConfig.individualTax.standardDeductionPerMonth, 5000);
const storeSource = (0, node_fs_1.readFileSync)('./src/stores/usePayrollStore.ts', 'utf8');
const payrollPageSource = (0, node_fs_1.readFileSync)('./src/app/payroll/page.tsx', 'utf8');
const typesSource = (0, node_fs_1.readFileSync)('./src/types/index.ts', 'utf8');
const partnerStoreSource = (0, node_fs_1.readFileSync)('./src/stores/usePartnerStore.ts', 'utf8');
const auxiliaryPageSource = (0, node_fs_1.readFileSync)('./src/app/settings/auxiliary/page.tsx', 'utf8');
for (const action of [
    'loadPeriod',
    'loadBatch',
    'saveConfig',
    'importDraft',
    'recalculateBatch',
    'confirmBatch',
    'revertBatchToDraft',
    'deleteDraftBatch',
    'addManualItems',
    'addManualItem',
    'updateItem',
    'deleteItem',
    'copyPreviousPeriod',
    'createAccrualVoucher',
]) {
    strict_1.default.match(storeSource, new RegExp(`${action}: async`));
}
strict_1.default.match(storeSource, /请先退回草稿后修改/);
strict_1.default.match(storeSource, /手工维护批次/);
strict_1.default.match(storeSource, /validatePayrollInput/);
strict_1.default.match(storeSource, /previousPeriod/);
strict_1.default.match(storeSource, /buildPayrollAccrualVoucherPreview/);
strict_1.default.match(storeSource, /previewToVoucherEntries/);
strict_1.default.match(payrollPageSource, /taxSettingsOpen/);
strict_1.default.match(payrollPageSource, /Settings/);
strict_1.default.match(payrollPageSource, /incomeType/);
strict_1.default.match(payrollPageSource, /annualBonusTaxMethod/);
strict_1.default.match(payrollPageSource, /BUILT_IN_PAYROLL_TAX_RULES/);
strict_1.default.match(typesSource, /payrollSalaryExpenseSubjectCode/);
strict_1.default.match(typesSource, /payrollContributionExpenseSubjectCode/);
strict_1.default.match(typesSource, /payrollSalaryPayableSubjectCode/);
strict_1.default.match(typesSource, /payrollTaxPayableSubjectCode/);
strict_1.default.match(typesSource, /payrollEmployeeContributionPayableSubjectCode/);
strict_1.default.match(partnerStoreSource, /payrollSalaryExpenseSubjectCode/);
strict_1.default.match(auxiliaryPageSource, /工资核算设置/);
console.log('payroll store contract tests passed');
