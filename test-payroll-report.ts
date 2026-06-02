import assert from 'node:assert/strict';
import { buildPayrollReportData, isPayrollPeriodInRange } from './src/lib/payroll-report';
import type { PayrollBatch, PayrollItem } from './src/lib/payroll';

const baseBatch = {
  accountSetId: 'acct-1',
  calculationConfigSnapshot: {} as never,
  sourceFileName: '工资表.xlsx',
  employeeCount: 1,
  grossTotal: 0,
  employerCostTotal: 0,
  taxTotal: 0,
  netTotal: 0,
  createdAt: '2026-01-31T00:00:00.000Z',
  updatedAt: '2026-01-31T00:00:00.000Z',
} as const;

const januaryBatch: PayrollBatch = {
  ...baseBatch,
  id: 'batch-jan',
  payrollPeriod: '2026-01',
  batchName: '2026-01 工资批次',
  status: 'calculated',
};

const februaryBatch: PayrollBatch = {
  ...baseBatch,
  id: 'batch-feb',
  payrollPeriod: '2026-02',
  batchName: '2026-02 工资批次',
  status: 'confirmed',
  updatedAt: '2026-02-28T00:00:00.000Z',
  accrualVoucherNo: '记202602-001',
  accrualVoucherId: 'voucher-feb-001',
};

function makeItem(args: {
  batchId: string;
  period: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  grossSalary: number;
  employeeSocialInsurance: number;
  employeeHousingFund: number;
  individualIncomeTax: number;
  netSalary: number;
  employerSocialInsurance: number;
  employerHousingFund: number;
  employerTotalCost: number;
}): PayrollItem {
  return {
    id: `${args.batchId}-${args.employeeCode}`,
    batchId: args.batchId,
    accountSetId: 'acct-1',
    payrollPeriod: args.period,
    employeeCode: args.employeeCode,
    employeeName: args.employeeName,
    departmentName: args.departmentName,
    inputData: {
      employeeCode: args.employeeCode,
      employeeName: args.employeeName,
      departmentName: args.departmentName,
      basicSalary: args.grossSalary,
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
    },
    calculationResult: {
      employeeCode: args.employeeCode,
      employeeName: args.employeeName,
      departmentName: args.departmentName,
      grossSalary: args.grossSalary,
      socialInsuranceBase: 36921,
      housingFundBase: 36921,
      employeeSocialInsurance: args.employeeSocialInsurance,
      employerSocialInsurance: args.employerSocialInsurance,
      employeeHousingFund: args.employeeHousingFund,
      employerHousingFund: args.employerHousingFund,
      taxableIncomeCumulative: 0,
      individualIncomeTax: args.individualIncomeTax,
      netSalary: args.netSalary,
      employerTotalCost: args.employerTotalCost,
      taxCalculationType: 'salary_cumulative',
    },
    validationStatus: 'valid',
    validationMessages: [],
    createdAt: '2026-01-31T00:00:00.000Z',
    updatedAt: '2026-01-31T00:00:00.000Z',
  };
}

const itemsByBatchId = new Map<string, PayrollItem[]>([
  [
    januaryBatch.id,
    [
      makeItem({
        batchId: januaryBatch.id,
        period: januaryBatch.payrollPeriod,
        employeeCode: 'E001',
        employeeName: '张三',
        departmentName: '销售部',
        grossSalary: 50000,
        employeeSocialInsurance: 3876.71,
        employeeHousingFund: 2584.47,
        individualIncomeTax: 1367.5,
        netSalary: 42204.94,
        employerSocialInsurance: 3876.71,
        employerHousingFund: 2584.47,
        employerTotalCost: 58000,
      }),
    ],
  ],
  [
    februaryBatch.id,
    [
      makeItem({
        batchId: februaryBatch.id,
        period: februaryBatch.payrollPeriod,
        employeeCode: 'E001',
        employeeName: '张三',
        departmentName: '销售部',
        grossSalary: 50000,
        employeeSocialInsurance: 3876.71,
        employeeHousingFund: 2584.47,
        individualIncomeTax: 3853.88,
        netSalary: 39684.94,
        employerSocialInsurance: 3876.71,
        employerHousingFund: 2584.47,
        employerTotalCost: 58000,
      }),
    ],
  ],
]);

assert.equal(isPayrollPeriodInRange('2026-02', '2026-01', '2026-03'), true);
assert.equal(isPayrollPeriodInRange('2026-04', '2026-01', '2026-03'), false);

const report = buildPayrollReportData({
  batches: [januaryBatch, februaryBatch],
  itemsByBatchId,
  filters: {
    startPeriod: '2026-01',
    endPeriod: '2026-02',
    employeeQuery: 'E001',
    departmentName: '销售部',
    status: 'all',
  },
});

assert.equal(report.summary.batchCount, 2);
assert.equal(report.summary.employeeCount, 1);
assert.equal(report.summary.grossTotal, 100000);
assert.equal(report.summary.employeeContributionTotal, 12922.36);
assert.equal(report.summary.taxTotal, 5221.38);
assert.equal(report.summary.netTotal, 81889.88);
assert.equal(report.summary.employerCostTotal, 116000);
assert.equal(report.batchRows.length, 2);
assert.equal(report.detailRows.length, 2);
assert.equal(report.batchRows[1].statusLabel, '已入账');
assert.equal(report.batchRows[1].voucherLabel, '记202602-001');
assert.equal(report.batchRows[1].voucherId, 'voucher-feb-001');
assert.equal(report.detailRows[1].statusLabel, '已入账');
assert.equal(report.detailRows[1].voucherId, 'voucher-feb-001');
assert.equal(report.detailRows[1].employeeName, '张三');

console.log('payroll report tests passed');
