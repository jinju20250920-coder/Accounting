import * as XLSX from 'xlsx';
import type { PayrollCalculationResult, PayrollInput } from './payroll';

export interface PayrollImportError {
  rowNumber: number;
  message: string;
}

export interface PayrollImportResult {
  validRows: PayrollInput[];
  errors: PayrollImportError[];
}

const IMPORT_HEADERS = [
  '工号',
  '姓名',
  '部门',
  '基本工资',
  '奖金',
  '津贴补贴',
  '其他应发',
  '请假扣款',
  '其他税前扣减',
  '社保缴费基数',
  '公积金缴费基数',
  '专项附加扣除',
  '其他依法扣除',
  '前期累计收入',
  '前期累计个人社保公积金',
  '前期累计专项附加扣除',
  '前期累计其他依法扣除',
  '前期累计已预扣税额',
  '其他税后扣减',
] as const;

type HeaderName = typeof IMPORT_HEADERS[number];

function textValue(value: unknown): string {
  return String(value ?? '').trim();
}

function parseMoney(
  row: unknown[],
  headerIndex: Map<string, number>,
  name: HeaderName,
  messages: string[],
  required = false,
): number | undefined {
  const cellIndex = headerIndex.get(name);
  const rawValue = cellIndex === undefined ? '' : row[cellIndex];
  const rawText = textValue(rawValue);

  if (!rawText) {
    if (required) messages.push(`${name}不能为空`);
    return required ? undefined : 0;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    messages.push(`${name}必须为数字`);
    return undefined;
  }
  if (value < 0) {
    messages.push(`${name}不得为负数`);
    return undefined;
  }
  return value;
}

function parseOptionalBase(
  row: unknown[],
  headerIndex: Map<string, number>,
  name: '社保缴费基数' | '公积金缴费基数',
  messages: string[],
): number | undefined {
  const index = headerIndex.get(name);
  if (index === undefined || !textValue(row[index])) return undefined;
  return parseMoney(row, headerIndex, name, messages);
}

export function parsePayrollRows(rows: unknown[][]): PayrollImportResult {
  const headerRow = rows[0] || [];
  const headerIndex = new Map<string, number>(
    headerRow.map((value, index) => [textValue(value), index]),
  );
  const errors: PayrollImportError[] = [];
  const validRows: PayrollInput[] = [];
  const existingEmployeeCodes = new Set<string>();

  rows.slice(1).forEach((row, offset) => {
    if (row.every((cell) => !textValue(cell))) return;
    const rowNumber = offset + 2;
    const messages: string[] = [];
    const employeeCode = textValue(row[headerIndex.get('工号') ?? -1]);
    const employeeName = textValue(row[headerIndex.get('姓名') ?? -1]);

    if (!employeeCode) messages.push('工号不能为空');
    if (!employeeName) messages.push('姓名不能为空');
    if (employeeCode && existingEmployeeCodes.has(employeeCode)) messages.push('重复工号');

    const basicSalary = parseMoney(row, headerIndex, '基本工资', messages, true);
    const bonus = parseMoney(row, headerIndex, '奖金', messages);
    const allowance = parseMoney(row, headerIndex, '津贴补贴', messages);
    const otherEarnings = parseMoney(row, headerIndex, '其他应发', messages);
    const leaveDeduction = parseMoney(row, headerIndex, '请假扣款', messages);
    const otherPreTaxDeduction = parseMoney(row, headerIndex, '其他税前扣减', messages);
    const specialAdditionalDeduction = parseMoney(row, headerIndex, '专项附加扣除', messages);
    const otherLegalDeduction = parseMoney(row, headerIndex, '其他依法扣除', messages);
    const priorCumulativeIncome = parseMoney(row, headerIndex, '前期累计收入', messages);
    const priorCumulativeEmployeeContributions = parseMoney(row, headerIndex, '前期累计个人社保公积金', messages);
    const priorCumulativeSpecialAdditionalDeduction = parseMoney(row, headerIndex, '前期累计专项附加扣除', messages);
    const priorCumulativeOtherLegalDeduction = parseMoney(row, headerIndex, '前期累计其他依法扣除', messages);
    const priorCumulativeTaxWithheld = parseMoney(row, headerIndex, '前期累计已预扣税额', messages);
    const otherPostTaxDeduction = parseMoney(row, headerIndex, '其他税后扣减', messages);
    const socialInsuranceBase = parseOptionalBase(row, headerIndex, '社保缴费基数', messages);
    const housingFundBase = parseOptionalBase(row, headerIndex, '公积金缴费基数', messages);

    if (employeeCode) existingEmployeeCodes.add(employeeCode);
    if (messages.length > 0 || basicSalary === undefined) {
      errors.push({ rowNumber, message: messages.join('；') });
      return;
    }

    validRows.push({
      employeeCode,
      employeeName,
      departmentName: textValue(row[headerIndex.get('部门') ?? -1]) || undefined,
      basicSalary,
      bonus: bonus ?? 0,
      allowance: allowance ?? 0,
      otherEarnings: otherEarnings ?? 0,
      leaveDeduction: leaveDeduction ?? 0,
      otherPreTaxDeduction: otherPreTaxDeduction ?? 0,
      socialInsuranceBase,
      housingFundBase,
      specialAdditionalDeduction: specialAdditionalDeduction ?? 0,
      otherLegalDeduction: otherLegalDeduction ?? 0,
      priorCumulativeIncome: priorCumulativeIncome ?? 0,
      priorCumulativeEmployeeContributions: priorCumulativeEmployeeContributions ?? 0,
      priorCumulativeSpecialAdditionalDeduction: priorCumulativeSpecialAdditionalDeduction ?? 0,
      priorCumulativeOtherLegalDeduction: priorCumulativeOtherLegalDeduction ?? 0,
      priorCumulativeTaxWithheld: priorCumulativeTaxWithheld ?? 0,
      otherPostTaxDeduction: otherPostTaxDeduction ?? 0,
    });
  });

  return { validRows, errors };
}

export async function parsePayrollFile(file: File): Promise<PayrollImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
  return parsePayrollRows(rows);
}

export function generatePayrollImportTemplate(): void {
  const sampleRow = [
    'E001', '示例员工', '财务部', 10000, 1000, 500, 0, 0, 0, 10000, 10000, 1000, 0, 0, 0, 0, 0, 0, 0,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([[...IMPORT_HEADERS], sampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '工资导入模板');
  XLSX.writeFile(workbook, '工资导入模板.xlsx');
}

export function exportPayrollResults(items: PayrollCalculationResult[], period: string): void {
  const rows = items.map((item) => ({
    工号: item.employeeCode,
    姓名: item.employeeName,
    部门: item.departmentName || '',
    应发工资: item.grossSalary,
    个人社保: item.employeeSocialInsurance,
    个人公积金: item.employeeHousingFund,
    个税: item.individualIncomeTax,
    实发工资: item.netSalary,
    企业社保: item.employerSocialInsurance,
    企业公积金: item.employerHousingFund,
    企业总成本: item.employerTotalCost,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '工资计算结果');
  XLSX.writeFile(workbook, `工资计算结果_${period}.xlsx`);
}
