import * as XLSX from 'xlsx';
import type { PayrollCalculationResult, PayrollInput, PayrollIncomeType, PayrollAnnualBonusTaxMethod } from './payroll';

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
  '收入类型',
  '年终奖计税方式',
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

function normalizeIncomeType(value: string): PayrollIncomeType | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (['工资薪金', 'salary', '工资'].includes(text)) return 'salary';
  if (['全年一次性奖金', 'annual_bonus', '年终奖'].includes(text)) return 'annual_bonus';
  return undefined;
}

function normalizeAnnualBonusTaxMethod(value: string): PayrollAnnualBonusTaxMethod | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (['单独计税', 'separate'].includes(text)) return 'separate';
  if (['并入综合所得', 'consolidated'].includes(text)) return 'consolidated';
  return undefined;
}

function parseMoney(
  row: unknown[],
  headerIndex: Map<string, number>,
  name: HeaderName,
  messages: string[],
  required = false,
): number | undefined {
  const cellIndex = headerIndex.get(name);
  const rawText = textValue(cellIndex === undefined ? '' : row[cellIndex]);
  if (!rawText) {
    if (required) messages.push(`${name}不能为空`);
    return required ? undefined : 0;
  }

  const value = Number(rawText);
  if (!Number.isFinite(value)) {
    messages.push(`${name}必须为数字`);
    return undefined;
  }
  if (value < 0) {
    messages.push(`${name}不能为负数`);
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
  if (index === undefined) return undefined;
  const rawText = textValue(row[index]);
  if (!rawText) return undefined;
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
    const departmentName = textValue(row[headerIndex.get('部门') ?? -1]) || undefined;
    const incomeType = normalizeIncomeType(textValue(row[headerIndex.get('收入类型') ?? -1]));
    const annualBonusTaxMethod = normalizeAnnualBonusTaxMethod(textValue(row[headerIndex.get('年终奖计税方式') ?? -1]));

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
      departmentName,
      incomeType,
      annualBonusTaxMethod,
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

/** 生成个税系统导入模板（29列格式，与个税扣缴系统一致） */
export function generateTaxSystemImportTemplate(): void {
  const sampleRow = [
    'E001', '赵六', '居民身份证', '110101199001011234',
    8000, 0,
    800, 200, 50, 800,
    1000, 0, 1000, 0, 1500, 0, 0,
    0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0, '',
  ];
  const ws = XLSX.utils.aoa_to_sheet([[...TAX_SYSTEM_IMPORT_HEADERS], sampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '正常工资薪金收入');

  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['注意事项：', '', '', '', '', ''],
    ['1、模板中标识为红色带*号的栏目为必填项，导入时不能为空！', '', '', '', '', ''],
    ['2、本期收入 = 基本工资+奖金+津贴补贴+其他应发-请假扣款-其他税前扣减', '', '', '', '', ''],
    ['3、五险一金填写个人当月缴纳金额', '', '', '', '', ''],
    ['4、专项附加扣除填写累计金额（截至当月的本年度累计）', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['证照类型填写范围', '', '', '', '', ''],
    ['居民身份证', '', '', '', '', ''],
    ['港澳居民来往内地通行证', '', '', '', '', ''],
    ['台湾居民来往大陆通行证', '', '', '', '', ''],
    ['外国人永久居留身份证', '', '', '', '', ''],
    ['护照', '', '', '', '', ''],
  ]);
  XLSX.utils.book_append_sheet(wb, guideSheet, '填表说明');
  XLSX.writeFile(wb, '正常工资薪金所得_导入模板.xls');
}

export function generatePayrollImportTemplate(): void {
  const sampleRow = [
    'E001',
    '赵六',
    '销售部',
    '工资薪金',
    '',
    50000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ];
  const mainSheet = XLSX.utils.aoa_to_sheet([[...IMPORT_HEADERS], sampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, mainSheet, '工资导入模板');

  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['字段说明', '口径'],
    ['基本工资 / 奖金 / 津贴补贴 / 其他应发 / 请假扣款 / 其他税前扣减 / 其他税后扣减', '当月金额'],
    ['专项附加扣除 / 其他依法扣除', '当月金额'],
    ['前期累计收入 / 前期累计个人社保公积金 / 前期累计专项附加扣除 / 前期累计其他依法扣除 / 前期累计已预扣税额', '本纳税年度截至上月的累计金额'],
    ['社保缴费基数 / 公积金缴费基数', '当月用于计算社保、公积金的基数，可填 0 或留空'],
    ['部门', '可填部门名称，系统会按部门页面数据回填部门编码'],
    ['收入类型', '工资薪金 或 全年一次性奖金；为空则按工资薪金处理'],
    ['年终奖计税方式', '仅收入类型为全年一次性奖金时填写：单独计税 或 并入综合所得'],
  ]);
  XLSX.utils.book_append_sheet(workbook, guideSheet, '字段说明');
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
    企业成本: item.employerTotalCost,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '工资计算结果');
  XLSX.writeFile(workbook, `工资计算结果_${period}.xlsx`);
}

// ==================== 个税系统导入/导出 ====================

const TAX_SYSTEM_IMPORT_HEADERS = [
  '工号', '*姓名', '*证件类型', '*证件号码', '本期收入', '本期免税收入',
  '基本养老保险费', '基本医疗保险费', '失业保险费', '住房公积金',
  '累计子女教育', '累计继续教育', '累计住房贷款利息', '累计住房租金',
  '累计赡养老人', '累计3岁以下婴幼儿照护', '累计个人养老金',
  '企业(职业)年金', '商业健康保险', '税延养老保险',
  '公务交通费用', '通讯费用', '律师办案费用', '西藏附加减除费用',
  '其他', '准予扣除的捐赠额', '减免税额', '协定减免', '备注',
] as const;

const TAX_SYSTEM_EXPORT_HEADERS = [
  '工号', '姓名', '证件类型', '证件号码', '所得期间起', '所得期间止',
  '本期收入', '本期免税收入', '基本养老保险费', '基本医疗保险费',
  '失业保险费', '住房公积金', '累计子女教育', '累计继续教育',
  '累计住房贷款利息', '累计住房租金', '累计赡养老人',
  '累计3岁以下婴幼儿照护', '累计个人养老金', '企业(职业)年金',
  '商业健康保险', '税延养老保险', '公务交通费用', '通讯费用',
  '律师办案费用', '准予扣除的捐赠额', '税前扣除项目合计',
  '减免税额', '协定减免', '减除费用标准', '已缴税额', '备注',
] as const;

type TaxSystemHeaderIndex = Map<string, number>;

function textVal(value: unknown): string {
  return String(value ?? '').trim();
}

function numVal(value: unknown): number {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

function getTaxSystemText(row: unknown[], headerIndex: TaxSystemHeaderIndex, ...names: string[]): string {
  for (const name of names) {
    const index = headerIndex.get(name);
    if (index !== undefined) return textVal(row[index]);
  }
  return '';
}

function getTaxSystemNumber(row: unknown[], headerIndex: TaxSystemHeaderIndex, ...names: string[]): number {
  for (const name of names) {
    const index = headerIndex.get(name);
    if (index !== undefined) return numVal(row[index]);
  }
  return 0;
}

/** 导出到个税系统导入模板格式（29列） */
export function exportToTaxSystem(
  items: (PayrollInput & { grossSalary?: number; individualIncomeTax?: number })[],
  period: string,
): void {
  const [year, month] = period.split('-').map(Number);
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const rows = items.map((item) => ({
    '工号': item.employeeCode,
    '*姓名': item.employeeName,
    '*证件类型': item.idType || '居民身份证',
    '*证件号码': item.idNumber || '',
    '本期收入': item.grossSalary ?? item.basicSalary + item.bonus + item.allowance + item.otherEarnings - item.leaveDeduction - item.otherPreTaxDeduction,
    '本期免税收入': item.taxExemptIncome || 0,
    '基本养老保险费': item.pensionInsurance || 0,
    '基本医疗保险费': item.medicalInsurance || 0,
    '失业保险费': item.unemploymentInsurance || 0,
    '住房公积金': item.housingFund || 0,
    '累计子女教育': (item.priorCumulativeSpecialAdditionalDeduction || 0) + (item.childEducation || 0),
    '累计继续教育': item.continuingEducation || 0,
    '累计住房贷款利息': item.housingLoanInterest || 0,
    '累计住房租金': item.housingRent || 0,
    '累计赡养老人': item.elderlyCare || 0,
    '累计3岁以下婴幼儿照护': item.infantCare || 0,
    '累计个人养老金': item.privatePension || 0,
    '企业(职业)年金': item.corporateAnnuity || 0,
    '商业健康保险': item.commercialHealthInsurance || 0,
    '税延养老保险': item.taxDeferredPension || 0,
    '公务交通费用': 0,
    '通讯费用': 0,
    '律师办案费用': 0,
    '西藏附加减除费用': 0,
    '其他': item.otherLegalDeduction || 0,
    '准予扣除的捐赠额': item.donation || 0,
    '减免税额': item.taxReduction || 0,
    '协定减免': 0,
    '备注': item.remark || '',
  }));

  const headerRow = [...TAX_SYSTEM_IMPORT_HEADERS];
  const ws = XLSX.utils.json_to_sheet(rows, { header: headerRow });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '正常工资薪金收入');

  // 填表说明 sheet
  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['注意事项：', '', '', '', '', ''],
    ['1、模板中标识为红色带*号的栏目为必填项，导入时不能为空！', '', '', '', '', ''],
    ['2、部分栏目内容需从如下表格中选择，否则系统禁止导入！', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['证照类型填写范围', '', '', '', '', ''],
    ['居民身份证', '', '', '', '', ''],
    ['港澳居民来往内地通行证', '', '', '', '', ''],
    ['台湾居民来往大陆通行证', '', '', '', '', ''],
    ['中华人民共和国港澳居民居住证', '', '', '', '', ''],
    ['外国人永久居留身份证', '', '', '', '', ''],
    ['护照', '', '', '', '', ''],
  ]);
  XLSX.utils.book_append_sheet(wb, guideSheet, '填表说明');
  XLSX.writeFile(wb, `正常工资薪金所得_${period}.xls`);
}

/** 从个税系统导入模板导入（29列格式） */
export function parseTaxSystemImportRows(rows: unknown[][]): PayrollImportResult {
  const headerRow = rows[0] || [];
  const headerIndex = new Map<string, number>(
    headerRow.map((value, index) => [textVal(value), index]),
  );
  const errors: PayrollImportError[] = [];
  const validRows: PayrollInput[] = [];
  const seenCodes = new Set<string>();

  rows.slice(1).forEach((row, offset) => {
    if (row.every((cell) => !textVal(cell))) return;
    const rowNumber = offset + 2;
    const messages: string[] = [];

    const employeeCode = getTaxSystemText(row, headerIndex, '工号');
    const employeeName = getTaxSystemText(row, headerIndex, '*姓名', '姓名');
    const idType = getTaxSystemText(row, headerIndex, '*证件类型', '证件类型') || undefined;
    const idNumber = getTaxSystemText(row, headerIndex, '*证件号码', '证件号码') || undefined;
    const currentIncome = getTaxSystemNumber(row, headerIndex, '本期收入');

    if (!employeeName) messages.push('姓名不能为空');
    if (!idType) messages.push('证件类型不能为空');
    if (!idNumber) messages.push('证件号码不能为空');
    if (employeeCode && seenCodes.has(employeeCode)) messages.push('重复工号');

    if (employeeCode) seenCodes.add(employeeCode);
    if (messages.length > 0) {
      errors.push({ rowNumber, message: messages.join('；') });
      return;
    }

    validRows.push({
      employeeCode: employeeCode || `EMP${String(validRows.length + 1).padStart(3, '0')}`,
      employeeName,
      idType,
      idNumber,
      basicSalary: currentIncome,
      bonus: 0,
      allowance: 0,
      otherEarnings: 0,
      leaveDeduction: 0,
      otherPreTaxDeduction: 0,
      specialAdditionalDeduction: 0,
      otherLegalDeduction: getTaxSystemNumber(row, headerIndex, '其他'),
      priorCumulativeIncome: 0,
      priorCumulativeEmployeeContributions: 0,
      priorCumulativeSpecialAdditionalDeduction: 0,
      priorCumulativeOtherLegalDeduction: 0,
      priorCumulativeTaxWithheld: 0,
      pensionInsurance: getTaxSystemNumber(row, headerIndex, '基本养老保险费'),
      medicalInsurance: getTaxSystemNumber(row, headerIndex, '基本医疗保险费'),
      unemploymentInsurance: getTaxSystemNumber(row, headerIndex, '失业保险费'),
      housingFund: getTaxSystemNumber(row, headerIndex, '住房公积金'),
      childEducation: getTaxSystemNumber(row, headerIndex, '累计子女教育'),
      continuingEducation: getTaxSystemNumber(row, headerIndex, '累计继续教育'),
      housingLoanInterest: getTaxSystemNumber(row, headerIndex, '累计住房贷款利息'),
      housingRent: getTaxSystemNumber(row, headerIndex, '累计住房租金'),
      elderlyCare: getTaxSystemNumber(row, headerIndex, '累计赡养老人'),
      infantCare: getTaxSystemNumber(row, headerIndex, '累计3岁以下婴幼儿照护'),
      privatePension: getTaxSystemNumber(row, headerIndex, '累计个人养老金'),
      taxExemptIncome: getTaxSystemNumber(row, headerIndex, '本期免税收入'),
      corporateAnnuity: getTaxSystemNumber(row, headerIndex, '企业(职业)年金'),
      commercialHealthInsurance: getTaxSystemNumber(row, headerIndex, '商业健康保险'),
      taxDeferredPension: getTaxSystemNumber(row, headerIndex, '税延养老保险'),
      donation: getTaxSystemNumber(row, headerIndex, '准予扣除的捐赠额'),
      taxReduction: getTaxSystemNumber(row, headerIndex, '减免税额'),
      remark: getTaxSystemText(row, headerIndex, '备注') || undefined,
      otherPostTaxDeduction: 0,
    });
  });

  return { validRows, errors };
}

/** 从个税系统导出文件导入（32列格式） */
export function parseTaxSystemExportRows(rows: unknown[][]): PayrollImportResult {
  const headerRow = rows[0] || [];
  const headerIndex = new Map<string, number>(
    headerRow.map((value, index) => [textVal(value), index]),
  );
  const errors: PayrollImportError[] = [];
  const validRows: PayrollInput[] = [];
  const seenCodes = new Set<string>();

  rows.slice(1).forEach((row, offset) => {
    if (row.every((cell) => !textVal(cell))) return;
    const rowNumber = offset + 2;
    const messages: string[] = [];

    const employeeCode = textVal(row[headerIndex.get('工号') ?? -1]);
    const employeeName = textVal(row[headerIndex.get('姓名') ?? -1]);
    const idType = textVal(row[headerIndex.get('证件类型') ?? -1]) || undefined;
    const idNumber = textVal(row[headerIndex.get('证件号码') ?? -1]) || undefined;

    if (!employeeName) messages.push('姓名不能为空');
    if (employeeCode && seenCodes.has(employeeCode)) messages.push('重复工号');

    const currentIncome = numVal(row[headerIndex.get('本期收入') ?? -1]);

    if (employeeCode) seenCodes.add(employeeCode);
    if (messages.length > 0) {
      errors.push({ rowNumber, message: messages.join('；') });
      return;
    }

    validRows.push({
      employeeCode: employeeCode || `EMP${String(validRows.length + 1).padStart(3, '0')}`,
      employeeName,
      idType,
      idNumber,
      basicSalary: currentIncome,
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
      pensionInsurance: numVal(row[headerIndex.get('基本养老保险费') ?? -1]),
      medicalInsurance: numVal(row[headerIndex.get('基本医疗保险费') ?? -1]),
      unemploymentInsurance: numVal(row[headerIndex.get('失业保险费') ?? -1]),
      housingFund: numVal(row[headerIndex.get('住房公积金') ?? -1]),
      childEducation: numVal(row[headerIndex.get('累计子女教育') ?? -1]),
      continuingEducation: numVal(row[headerIndex.get('累计继续教育') ?? -1]),
      housingLoanInterest: numVal(row[headerIndex.get('累计住房贷款利息') ?? -1]),
      housingRent: numVal(row[headerIndex.get('累计住房租金') ?? -1]),
      elderlyCare: numVal(row[headerIndex.get('累计赡养老人') ?? -1]),
      infantCare: numVal(row[headerIndex.get('累计3岁以下婴幼儿照护') ?? -1]),
      privatePension: numVal(row[headerIndex.get('累计个人养老金') ?? -1]),
      taxExemptIncome: numVal(row[headerIndex.get('本期免税收入') ?? -1]),
      corporateAnnuity: numVal(row[headerIndex.get('企业(职业)年金') ?? -1]),
      commercialHealthInsurance: numVal(row[headerIndex.get('商业健康保险') ?? -1]),
      taxDeferredPension: numVal(row[headerIndex.get('税延养老保险') ?? -1]),
      donation: numVal(row[headerIndex.get('准予扣除的捐赠额') ?? -1]),
      taxReduction: numVal(row[headerIndex.get('减免税额') ?? -1]),
      remark: textVal(row[headerIndex.get('备注') ?? -1]) || undefined,
      otherPostTaxDeduction: 0,
    });
  });

  return { validRows, errors };
}

/** 检测文件是否为个税系统导出格式 */
function isTaxSystemExport(headers: unknown[]): boolean {
  const headerTexts = headers.map(h => textVal(h));
  return headerTexts.includes('证件号码') && headerTexts.includes('所得期间起');
}

/** 检测文件是否为个税系统导入模板格式 */
function isTaxSystemImport(headers: unknown[]): boolean {
  const headerTexts = headers.map(h => textVal(h));
  return headerTexts.includes('*姓名')
    && headerTexts.includes('*证件类型')
    && headerTexts.includes('*证件号码')
    && headerTexts.includes('本期收入');
}

/** 增强版文件解析：自动识别个税系统导入/导出格式 vs 自有格式 */
export async function parsePayrollFileWithTaxSupport(file: File): Promise<PayrollImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
  if (rows.length === 0) return { validRows: [], errors: [] };

  const headerRow = rows[0] || [];
  if (isTaxSystemExport(headerRow)) {
    return parseTaxSystemExportRows(rows);
  }
  if (isTaxSystemImport(headerRow)) {
    return parseTaxSystemImportRows(rows);
  }
  return parsePayrollRows(rows);
}
