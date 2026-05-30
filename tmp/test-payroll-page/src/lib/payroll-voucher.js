"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePayrollVoucherSubjects = resolvePayrollVoucherSubjects;
exports.buildPayrollAccrualVoucherPreview = buildPayrollAccrualVoucherPreview;
exports.previewToVoucherEntries = previewToVoucherEntries;
const payroll_1 = require("./payroll");
const SUBJECTS = {
    salaryExpense: { code: '660201', name: '管理费用-工资' },
    contributionExpense: { code: '660203', name: '管理费用-社保公积金' },
    salaryPayable: { code: '2211', name: '应付职工薪酬' },
    taxPayable: { code: '2221', name: '应交税费-个人所得税' },
    employeeContributionPayable: { code: '2241', name: '其他应付款-个人社保公积金' },
};
function addAmount(map, key, amount) {
    map.set(key, (0, payroll_1.roundMoney)((map.get(key) || 0) + amount));
}
function departmentKey(name) {
    return name?.trim() || '未分部门';
}
function subjectOrFallback(code, name, fallback) {
    return code?.trim()
        ? { code, name: name?.trim() || fallback.name }
        : fallback;
}
function resolvePayrollVoucherSubjects(item, employeeByCode, defaultSubjects = {}) {
    const employee = employeeByCode.get(item.employeeCode);
    return {
        salaryExpense: subjectOrFallback(employee?.payrollSalaryExpenseSubjectCode, employee?.payrollSalaryExpenseSubjectName, subjectOrFallback(defaultSubjects.payrollSalaryExpenseSubjectCode, defaultSubjects.payrollSalaryExpenseSubjectName, SUBJECTS.salaryExpense)),
        contributionExpense: subjectOrFallback(employee?.payrollContributionExpenseSubjectCode, employee?.payrollContributionExpenseSubjectName, subjectOrFallback(defaultSubjects.payrollContributionExpenseSubjectCode, defaultSubjects.payrollContributionExpenseSubjectName, SUBJECTS.contributionExpense)),
        salaryPayable: subjectOrFallback(employee?.payrollSalaryPayableSubjectCode, employee?.payrollSalaryPayableSubjectName, subjectOrFallback(defaultSubjects.payrollSalaryPayableSubjectCode, defaultSubjects.payrollSalaryPayableSubjectName, SUBJECTS.salaryPayable)),
        taxPayable: subjectOrFallback(employee?.payrollTaxPayableSubjectCode, employee?.payrollTaxPayableSubjectName, subjectOrFallback(defaultSubjects.payrollTaxPayableSubjectCode, defaultSubjects.payrollTaxPayableSubjectName, SUBJECTS.taxPayable)),
        employeeContributionPayable: subjectOrFallback(employee?.payrollEmployeeContributionPayableSubjectCode, employee?.payrollEmployeeContributionPayableSubjectName, subjectOrFallback(defaultSubjects.payrollEmployeeContributionPayableSubjectCode, defaultSubjects.payrollEmployeeContributionPayableSubjectName, SUBJECTS.employeeContributionPayable)),
    };
}
function makeDebitKey(subjectCode, subjectName, departmentName) {
    return `${subjectCode}|${subjectName}|${departmentName}`;
}
function makeCreditKey(subjectCode, subjectName) {
    return `${subjectCode}|${subjectName}`;
}
function buildPayrollAccrualVoucherPreview(items, period, employees = [], defaultSubjects = {}) {
    const salaryDebitMap = new Map();
    const contributionDebitMap = new Map();
    const salaryPayableMap = new Map();
    const taxPayableMap = new Map();
    const employeeContributionPayableMap = new Map();
    const employeeByCode = new Map(employees
        .filter((employee) => employee.isEmployee)
        .map((employee) => [employee.code, employee]));
    items.forEach((item) => {
        const result = item.calculationResult;
        const departmentName = departmentKey(result.departmentName);
        const subjects = resolvePayrollVoucherSubjects(item, employeeByCode, defaultSubjects);
        const employerContribution = (0, payroll_1.roundMoney)(result.employerSocialInsurance + result.employerHousingFund);
        const employeeContribution = (0, payroll_1.roundMoney)(result.employeeSocialInsurance + result.employeeHousingFund + (item.inputData.otherPostTaxDeduction || 0));
        addAmount(salaryDebitMap, makeDebitKey(subjects.salaryExpense.code, subjects.salaryExpense.name, departmentName), result.grossSalary);
        addAmount(contributionDebitMap, makeDebitKey(subjects.contributionExpense.code, subjects.contributionExpense.name, departmentName), employerContribution);
        addAmount(salaryPayableMap, makeCreditKey(subjects.salaryPayable.code, subjects.salaryPayable.name), (0, payroll_1.roundMoney)(result.netSalary + employerContribution));
        addAmount(taxPayableMap, makeCreditKey(subjects.taxPayable.code, subjects.taxPayable.name), result.individualIncomeTax);
        addAmount(employeeContributionPayableMap, makeCreditKey(subjects.employeeContributionPayable.code, subjects.employeeContributionPayable.name), employeeContribution);
    });
    const entries = [];
    salaryDebitMap.forEach((amount, key) => {
        if (amount <= 0)
            return;
        const [subjectCode, subjectName, departmentName] = key.split('|');
        entries.push({
            summary: `${period} 计提工资`,
            subjectCode,
            subjectName,
            debit: amount,
            credit: 0,
            departmentName,
        });
    });
    contributionDebitMap.forEach((amount, key) => {
        if (amount <= 0)
            return;
        const [subjectCode, subjectName, departmentName] = key.split('|');
        entries.push({
            summary: `${period} 计提公司社保公积金`,
            subjectCode,
            subjectName,
            debit: amount,
            credit: 0,
            departmentName,
        });
    });
    salaryPayableMap.forEach((amount, key) => {
        if (amount <= 0)
            return;
        const [subjectCode, subjectName] = key.split('|');
        entries.push({
            summary: `${period} 应付员工实发工资及公司社保公积金`,
            subjectCode,
            subjectName,
            debit: 0,
            credit: amount,
        });
    });
    taxPayableMap.forEach((amount, key) => {
        if (amount <= 0)
            return;
        const [subjectCode, subjectName] = key.split('|');
        entries.push({
            summary: `${period} 代扣代缴个人所得税`,
            subjectCode,
            subjectName,
            debit: 0,
            credit: amount,
        });
    });
    employeeContributionPayableMap.forEach((amount, key) => {
        if (amount <= 0)
            return;
        const [subjectCode, subjectName] = key.split('|');
        entries.push({
            summary: `${period} 代扣个人社保公积金及其他扣款`,
            subjectCode,
            subjectName,
            debit: 0,
            credit: amount,
        });
    });
    return entries;
}
function previewToVoucherEntries(previewEntries, voucherId, date) {
    return previewEntries.map((entry, index) => ({
        id: `entry_${voucherId}_${index}`,
        voucherId,
        date,
        summary: entry.summary,
        subjectCode: entry.subjectCode,
        subjectName: entry.subjectName,
        debit: entry.debit,
        credit: entry.credit,
        auxiliary: entry.departmentName ? { department: entry.departmentName } : {},
    }));
}
