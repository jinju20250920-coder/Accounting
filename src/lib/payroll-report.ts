import type { PayrollBatch, PayrollItem } from './payroll';

export type PayrollReportStatusFilter = 'all' | 'draft' | 'calculated' | 'confirmed' | 'invoiced';

export interface PayrollReportFilters {
  startPeriod: string;
  endPeriod: string;
  employeeQuery: string;
  departmentName: string;
  status: PayrollReportStatusFilter;
}

export interface PayrollBatchVoucherInfo {
  voucherId?: string;
  voucherNo?: string;
}

export interface PayrollBatchReportRow {
  batchId: string;
  batchPeriod: string;
  batchName: string;
  sourceFileName?: string;
  status: PayrollBatch['status'];
  statusLabel: string;
  voucherId?: string;
  voucherLabel: string;
  employeeCount: number;
  grossTotal: number;
  employeeContributionTotal: number;
  taxTotal: number;
  netTotal: number;
  employerCostTotal: number;
  items: PayrollEmployeeMonthRow[];
}

export interface PayrollEmployeeMonthRow {
  batchId: string;
  batchPeriod: string;
  batchName: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  voucherId?: string;
  inputData: PayrollItem['inputData'];
  calculationResult: PayrollItem['calculationResult'];
  grossSalary: number;
  employeeContributionTotal: number;
  employeeSocialInsurance: number;
  employeeHousingFund: number;
  individualIncomeTax: number;
  netSalary: number;
  employerSocialInsurance: number;
  employerHousingFund: number;
  employerCostTotal: number;
  status: PayrollBatch['status'];
  statusLabel: string;
  voucherLabel: string;
}

export interface PayrollReportSummary {
  batchCount: number;
  employeeCount: number;
  grossTotal: number;
  employeeContributionTotal: number;
  taxTotal: number;
  netTotal: number;
  employerCostTotal: number;
}

export interface PayrollReportData {
  summary: PayrollReportSummary;
  batchRows: PayrollBatchReportRow[];
  detailRows: PayrollEmployeeMonthRow[];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function periodToComparable(period: string): number {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return Number.NaN;
  return year * 100 + month;
}

export function isPayrollPeriodInRange(period: string, startPeriod: string, endPeriod: string): boolean {
  const current = periodToComparable(period);
  const start = periodToComparable(startPeriod);
  const end = periodToComparable(endPeriod);
  if (Number.isNaN(current) || Number.isNaN(start) || Number.isNaN(end)) return false;
  return current >= start && current <= end;
}

function resolveStatusLabel(batch: PayrollBatch, voucherInfo?: PayrollBatchVoucherInfo): string {
  if (batch.accrualVoucherNo?.trim() || batch.accrualVoucherId?.trim() || voucherInfo?.voucherNo || voucherInfo?.voucherId) return '已入账';
  if (batch.status === 'confirmed') return '已确认';
  if (batch.status === 'calculated') return '已计算';
  return '草稿';
}

function resolveVoucherLabel(voucherInfo?: PayrollBatchVoucherInfo): string {
  return voucherInfo?.voucherNo || voucherInfo?.voucherId || '-';
}

function matchesEmployeeQuery(item: PayrollItem, query: string): boolean {
  if (!query) return true;
  const normalized = normalizeText(query);
  return [
    item.employeeCode,
    item.employeeName,
    item.departmentName || '',
  ].some((value) => normalizeText(value).includes(normalized));
}

function matchesDepartment(item: PayrollItem, departmentName: string): boolean {
  if (!departmentName || departmentName === '全部') return true;
  return (item.departmentName || '').trim() === departmentName.trim();
}

function matchesStatus(batch: PayrollBatch, status: PayrollReportStatusFilter, voucherInfo?: PayrollBatchVoucherInfo): boolean {
  if (status === 'all') return true;
  if (status === 'invoiced') return Boolean(voucherInfo?.voucherNo || voucherInfo?.voucherId);
  return batch.status === status;
}

export function buildPayrollReportData(input: {
  batches: PayrollBatch[];
  itemsByBatchId: Map<string, PayrollItem[]>;
  filters: PayrollReportFilters;
}): PayrollReportData {
  const { batches, itemsByBatchId, filters } = input;
  const filteredBatches = batches
    .filter((batch) => isPayrollPeriodInRange(batch.payrollPeriod, filters.startPeriod, filters.endPeriod))
    .filter((batch) => matchesStatus(batch, filters.status, {
      voucherId: batch.accrualVoucherId,
      voucherNo: batch.accrualVoucherNo,
    }));

  const batchRows: PayrollBatchReportRow[] = [];
  const detailRows: PayrollEmployeeMonthRow[] = [];
  const uniqueEmployeeCodes = new Set<string>();
  const summary: PayrollReportSummary = {
    batchCount: 0,
    employeeCount: 0,
    grossTotal: 0,
    employeeContributionTotal: 0,
    taxTotal: 0,
    netTotal: 0,
    employerCostTotal: 0,
  };

  filteredBatches.forEach((batch) => {
    const batchItems = (itemsByBatchId.get(batch.id) || [])
      .filter((item) => matchesEmployeeQuery(item, filters.employeeQuery))
      .filter((item) => matchesDepartment(item, filters.departmentName));
    if (batchItems.length === 0) return;

    const voucherInfo = {
      voucherId: batch.accrualVoucherId,
      voucherNo: batch.accrualVoucherNo,
    };
    const statusLabel = resolveStatusLabel(batch, voucherInfo);
    const voucherLabel = resolveVoucherLabel(voucherInfo);

    const mappedItems = batchItems.map<PayrollEmployeeMonthRow>((item) => ({
      batchId: batch.id,
      batchPeriod: batch.payrollPeriod,
      batchName: batch.batchName,
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      departmentName: item.departmentName || '-',
      voucherId: voucherInfo.voucherId,
      inputData: item.inputData,
      calculationResult: item.calculationResult,
      grossSalary: item.calculationResult.grossSalary,
      employeeContributionTotal: roundTwo(
        item.calculationResult.employeeSocialInsurance + item.calculationResult.employeeHousingFund,
      ),
      employeeSocialInsurance: item.calculationResult.employeeSocialInsurance,
      employeeHousingFund: item.calculationResult.employeeHousingFund,
      individualIncomeTax: item.calculationResult.individualIncomeTax,
      netSalary: item.calculationResult.netSalary,
      employerSocialInsurance: item.calculationResult.employerSocialInsurance,
      employerHousingFund: item.calculationResult.employerHousingFund,
      employerCostTotal: item.calculationResult.employerTotalCost,
      status: batch.status,
      statusLabel,
      voucherLabel,
    }));

    const batchGrossTotal = mappedItems.reduce((sum, item) => sum + item.grossSalary, 0);
    const batchEmployeeContributionTotal = mappedItems.reduce((sum, item) => sum + item.employeeContributionTotal, 0);
    const batchTaxTotal = mappedItems.reduce((sum, item) => sum + item.individualIncomeTax, 0);
    const batchNetTotal = mappedItems.reduce((sum, item) => sum + item.netSalary, 0);
    const batchEmployerCostTotal = mappedItems.reduce((sum, item) => sum + item.employerCostTotal, 0);

    batchRows.push({
      batchId: batch.id,
      batchPeriod: batch.payrollPeriod,
      batchName: batch.batchName,
      sourceFileName: batch.sourceFileName,
      status: batch.status,
      statusLabel,
      voucherId: voucherInfo.voucherId,
      voucherLabel,
      employeeCount: mappedItems.length,
      grossTotal: roundTwo(batchGrossTotal),
      employeeContributionTotal: roundTwo(batchEmployeeContributionTotal),
      taxTotal: roundTwo(batchTaxTotal),
      netTotal: roundTwo(batchNetTotal),
      employerCostTotal: roundTwo(batchEmployerCostTotal),
      items: mappedItems,
    });
    detailRows.push(...mappedItems);
    mappedItems.forEach((item) => {
      if (item.employeeCode) {
        uniqueEmployeeCodes.add(item.employeeCode);
      }
    });

    summary.batchCount += 1;
    summary.grossTotal = roundTwo(summary.grossTotal + batchGrossTotal);
    summary.employeeContributionTotal = roundTwo(summary.employeeContributionTotal + batchEmployeeContributionTotal);
    summary.taxTotal = roundTwo(summary.taxTotal + batchTaxTotal);
    summary.netTotal = roundTwo(summary.netTotal + batchNetTotal);
    summary.employerCostTotal = roundTwo(summary.employerCostTotal + batchEmployerCostTotal);
  });

  summary.employeeCount = uniqueEmployeeCodes.size;

  return { summary, batchRows, detailRows };
}

function roundTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
