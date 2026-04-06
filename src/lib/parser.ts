/**
 * Excel导入解析器 - 解析银行流水和税务申报明细
 */

import * as XLSX from 'xlsx';

export interface ParsedEntry {
  rowNumber: number;
  date?: string;
  summary?: string;
  voucherNo?: string;
  subjectCode?: string;
  subjectName?: string;
  counterparty?: string;
  debit?: number;
  credit?: number;
  amount?: number;
  category?: string;
}

export interface ParseResult {
  fileName: string;
  type: 'bank' | 'tax' | 'template';
  totalRows: number;
  entries: ParsedEntry[];
  errors: Array<{ row: number; message: string }>;
}

import { parseCCBStatement } from './bank-parsers/ccb-parser';
import type { BankStatementParseResult } from '@/types';

/**
 * 解析银行流水Excel文件
 * 自动检测银行格式并使用对应解析器
 */
export async function parseBankStatement(file: File): Promise<BankStatementParseResult> {
  // 目前仅支持建设银行格式
  return parseCCBStatement(file);
}

/**
 * 旧版 parseBankStatement 保留兼容性
 * @deprecated Use parseBankStatement instead
 */
export async function parseBankStatementV1(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  const firstSheet = workbook.Sheets[0];

  if (!firstSheet) {
    return {
      fileName: file.name,
      type: 'bank',
      totalRows: 0,
      entries: [],
      errors: [{ row: 0, message: '文件为空或格式不正确' }]
    };
  }

  const data: ParsedEntry[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // 假设列结构（可配置）
  // A: 日期, B: 凭证字号, C: 摘要, D: 科目代码, E: 借方, F: 贷方, G: 对方单位
  const colMap = { 0: 'date', 1: 'voucherNo', 2: 'summary', 3: 'subjectCode', 4: 'debit', 5: 'credit', 6: 'counterparty' };

  // 注意：旧版使用 firstSheet.data，但 XLSX 读取方式已改变
  // 这里保留代码结构，但实际已不再使用
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

  for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
    const row = jsonData[rowIndex];

    if (!row || row.length === 0) continue;

    const entry: Partial<ParsedEntry> = {
      rowNumber: rowIndex + 2, // +2 因为有表头
      date: row[colMap[0]],
      voucherNo: row[colMap[1]],
      summary: row[colMap[2]],
      subjectCode: row[colMap[3]],
      debit: row[colMap[4]],
      credit: row[colMap[5]],
      counterparty: row[colMap[6]],
      amount: row[colMap[4]] || row[colMap[5]]
    };

    // 数据验证
    if (!entry.date) {
      errors.push({ row: rowIndex + 2, message: '日期不能为空' });
      continue;
    }

    if (!entry.amount || isNaN(entry.amount)) {
      errors.push({ row: rowIndex + 2, message: '金额无效' });
      continue;
    }

    if (entry.debit && entry.credit) {
      errors.push({ row: rowIndex + 2, message: '借方和贷方不能同时有值' });
      entry.credit = 0; // 清空贷方
    }

    if (!entry.debit && !entry.credit) {
      errors.push({ row: rowIndex + 2, message: '借方或贷方必须有一个' });
      continue;
    }

    data.push(entry as ParsedEntry);
  }

  return {
    fileName: file.name,
    type: 'bank',
    totalRows: jsonData.length,
    entries: data,
    errors
  };
}

/**
 * 解析税务申报明细Excel文件
 */
export async function parseTaxStatement(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  const firstSheet = workbook.Sheets[0];

  if (!firstSheet) {
    return {
      fileName: file.name,
      type: 'tax',
      totalRows: 0,
      entries: [],
      errors: [{ row: 0, message: '文件为空或格式不正确' }]
    };
  }

  const data: ParsedEntry[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // 假设列结构（可配置）
  // A: 日期, B: 产品名称, C: 销售金额, D: 销项税额, E: 进项税额, F: 税率
  const colMap = { 0: 'date', 1: 'product', 2: 'amount', 3: 'outputTax', 4: 'inputTax', 5: 'taxRate' };

  for (let rowIndex = 0; rowIndex < firstSheet.data.length; rowIndex++) {
    const row = firstSheet.data[rowIndex];

    if (!row || row.length === 0) continue;

    const entry: Partial<ParsedEntry> = {
      rowNumber: rowIndex + 2,
      date: row[colMap[0]],
      summary: `销售${row[colMap[1]] || ''}`,
      debit: row[colMap[2]],
      credit: 0,
      counterparty: '',
      amount: row[colMap[2]]
    };

    // 销售记录处理
    const saleAmount = entry.debit || 0;
    if (!isNaN(saleAmount) && saleAmount > 0) {
      data.push(entry as ParsedEntry);

      // 生成应交税费-增值税分录（贷方）
      const taxRate = row[colMap[5]] ? parseFloat(row[colMap[5]]) : 0;
      const taxAmount = saleAmount * taxRate;
      if (taxAmount > 0) {
        data.push({
          rowNumber: rowIndex + 2,
          date: row[colMap[0]],
          summary: `销售${row[colMap[1]]}-增值税`,
          debit: taxAmount,
          credit: 0
        });
      }
    }

    // 进项税处理
    const inputTax = row[colMap[4]] ? parseFloat(row[colMap[4]]) : 0;
    if (inputTax !== undefined && inputTax < 0) {
      data.push({
        rowNumber: rowIndex + 2,
        date: row[colMap[0]],
        summary: `进项税-增值税`,
        debit: Math.abs(inputTax),
        credit: 0
      });
    }
  }

  return {
    fileName: file.name,
    type: 'tax',
    totalRows: firstSheet.data.length,
    entries: data,
    errors
  };
}

/**
 * 根据文件类型选择解析器
 */
export function parseStatement(file: File, type: 'bank' | 'tax' | 'template'): Promise<ParseResult> {
  switch (type) {
    case 'bank':
      return parseBankStatementV1(file);
    case 'tax':
      return parseTaxStatement(file);
    case 'template':
      return parseTemplateFile(file);
    default:
      return Promise.resolve({
        fileName: file.name,
        type: 'template',
        totalRows: 0,
        entries: [],
        errors: [{ row: 0, message: '不支持的文件类型' }]
      });
  }
}

/**
 * 解析凭证模板文件
 */
async function parseTemplateFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  const firstSheet = workbook.Sheets[0];

  if (!firstSheet) {
    return {
      fileName: file.name,
      type: 'template',
      totalRows: 0,
      entries: [],
      errors: [{ row: 0, message: '文件为空或格式不正确' }]
    };
  }

  const data: ParsedEntry[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // Template file column mapping: A: 摘要, B: 科目代码, C: 借方, D: 贷方
  const colMap = { 0: 'summary', 1: 'subjectCode', 2: 'debit', 3: 'credit' };

  for (let rowIndex = 0; rowIndex < firstSheet.data.length; rowIndex++) {
    const row = firstSheet.data[rowIndex];

    if (!row || row.length === 0) continue;

    const entry: Partial<ParsedEntry> = {
      rowNumber: rowIndex + 2,
      summary: row[colMap[0]]?.toString() || '',
      subjectCode: row[colMap[1]]?.toString() || '',
      debit: row[colMap[2]],
      credit: row[colMap[3]]
    };

    // 验证必填字段
    if (!entry.summary && !entry.subjectCode) {
      errors.push({ row: rowIndex + 2, message: '摘要和科目不能同时为空' });
      continue;
    }

    if (!entry.debit && !entry.credit) {
      errors.push({ row: rowIndex + 2, message: '借方或贷方必须有一个' });
      continue;
    }

    data.push(entry as ParsedEntry);
  }

  return {
    fileName: file.name,
    type: 'template',
    totalRows: firstSheet.data.length,
    entries: data,
    errors
  };
}

/**
 * 智能科目名称搜索
 */
export function searchSubjects(
  subjects: Array<{ code: string; name: string; pinyin?: string }>,
  keyword: string
): Array<{ code: string; name: string; pinyin?: string }> {
  const keywordLower = keyword.toLowerCase();

  return subjects.filter(subject => {
    const codeMatch = subject.code.toLowerCase().includes(keywordLower);
    const nameMatch = subject.name?.toLowerCase().includes(keywordLower);
    const pinyinMatch = subject.pinyin?.toLowerCase().includes(keywordLower);

    return codeMatch || nameMatch || pinyinMatch;
  }).slice(0, 10); // 返回前10个匹配
}

// ==================== 资产导入解析器 ====================

export interface ParsedFixedAsset {
  rowNumber: number;
  assetCode?: string;
  assetName?: string;
  categoryName?: string;
  originalValue?: number;
  salvageValue?: number;
  depreciationMethod?: string;
  usefulLifeYears?: number;
  acquisitionDate?: string;
  departmentCode?: string;
  departmentName?: string;
  expenseSubjectCode?: string;
  expenseSubjectName?: string;
  notes?: string;
}

export interface ParsedIntangibleAsset {
  rowNumber: number;
  assetCode?: string;
  assetName?: string;
  assetType?: string;
  originalValue?: number;
  residualValue?: number;
  amortizationMethod?: string;
  usefulLifeYears?: number;
  acquisitionDate?: string;
  registrationNo?: string;
  departmentCode?: string;
  expenseSubjectCode?: string;
  notes?: string;
}

export interface ParsedPrepaidExpense {
  rowNumber: number;
  expenseCode?: string;
  expenseName?: string;
  expenseType?: string;
  originalAmount?: number;
  paymentDate?: string;
  startDate?: string;
  endDate?: string;
  amortizationPeriods?: number;
  prepaidSubjectCode?: string;
  expenseSubjectCode?: string;
  supplierName?: string;
  invoiceNo?: string;
  departmentCode?: string;
  notes?: string;
}

export interface AssetParseResult<T> {
  fileName: string;
  totalRows: number;
  data: T[];
  errors: Array<{ row: number; message: string }>;
}

/**
 * 解析固定资产Excel文件
 * 列映射: A:资产编码, B:资产名称, C:分类名称, D:原值, E:残值, F:折旧方法, G:使用年限, H:购置日期, I:部门代码, J:费用科目, K:备注
 */
export async function parseFixedAssetsExcel(file: File): Promise<AssetParseResult<ParsedFixedAsset>> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    return {
      fileName: file.name,
      totalRows: 0,
      data: [],
      errors: [{ row: 0, message: '文件为空或格式不正确' }]
    };
  }

  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
  const data: ParsedFixedAsset[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // 跳过表头，从第2行开始
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0 || !row[1]) continue; // 跳过空行

    const rowIndex = i + 1;
    const entry: ParsedFixedAsset = {
      rowNumber: rowIndex,
      assetCode: row[0]?.toString()?.trim(),
      assetName: row[1]?.toString()?.trim(),
      categoryName: row[2]?.toString()?.trim(),
      originalValue: parseFloat(row[3]) || 0,
      salvageValue: parseFloat(row[4]) || 0,
      depreciationMethod: row[5]?.toString()?.trim(),
      usefulLifeYears: parseInt(row[6]) || undefined,
      acquisitionDate: parseExcelDate(row[7]),
      departmentCode: row[8]?.toString()?.trim(),
      expenseSubjectCode: row[9]?.toString()?.trim(),
      notes: row[10]?.toString()?.trim(),
    };

    // 验证必填字段
    if (!entry.assetName) {
      errors.push({ row: rowIndex, message: '资产名称不能为空' });
      continue;
    }
    if (!entry.originalValue || entry.originalValue <= 0) {
      errors.push({ row: rowIndex, message: '原值必须大于0' });
      continue;
    }
    if (!entry.acquisitionDate) {
      errors.push({ row: rowIndex, message: '购置日期不能为空' });
      continue;
    }

    data.push(entry);
  }

  return {
    fileName: file.name,
    totalRows: jsonData.length - 1,
    data,
    errors
  };
}

/**
 * 解析无形资产Excel文件
 * 列映射: A:资产编码, B:资产名称, C:资产类型, D:原值, E:残值, F:摊销方法, G:使用年限, H:购置日期, I:登记号, J:部门代码, K:费用科目, L:备注
 */
export async function parseIntangibleAssetsExcel(file: File): Promise<AssetParseResult<ParsedIntangibleAsset>> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    return {
      fileName: file.name,
      totalRows: 0,
      data: [],
      errors: [{ row: 0, message: '文件为空或格式不正确' }]
    };
  }

  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
  const data: ParsedIntangibleAsset[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0 || !row[1]) continue;

    const rowIndex = i + 1;
    const entry: ParsedIntangibleAsset = {
      rowNumber: rowIndex,
      assetCode: row[0]?.toString()?.trim(),
      assetName: row[1]?.toString()?.trim(),
      assetType: row[2]?.toString()?.trim(),
      originalValue: parseFloat(row[3]) || 0,
      residualValue: parseFloat(row[4]) || 0,
      amortizationMethod: row[5]?.toString()?.trim(),
      usefulLifeYears: parseInt(row[6]) || undefined,
      acquisitionDate: parseExcelDate(row[7]),
      registrationNo: row[8]?.toString()?.trim(),
      departmentCode: row[9]?.toString()?.trim(),
      expenseSubjectCode: row[10]?.toString()?.trim(),
      notes: row[11]?.toString()?.trim(),
    };

    if (!entry.assetName) {
      errors.push({ row: rowIndex, message: '资产名称不能为空' });
      continue;
    }
    if (!entry.originalValue || entry.originalValue <= 0) {
      errors.push({ row: rowIndex, message: '原值必须大于0' });
      continue;
    }
    if (!entry.acquisitionDate) {
      errors.push({ row: rowIndex, message: '购置日期不能为空' });
      continue;
    }

    data.push(entry);
  }

  return {
    fileName: file.name,
    totalRows: jsonData.length - 1,
    data,
    errors
  };
}

/**
 * 解析待摊费用Excel文件
 * 列映射: A:费用编码, B:费用名称, C:费用类型, D:原始金额, E:支付日期, F:开始日期, G:结束日期, H:摊销期数, I:待摊科目, J:费用科目, K:供应商, L:发票号, M:部门代码, N:备注
 */
export async function parsePrepaidExpensesExcel(file: File): Promise<AssetParseResult<ParsedPrepaidExpense>> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    return {
      fileName: file.name,
      totalRows: 0,
      data: [],
      errors: [{ row: 0, message: '文件为空或格式不正确' }]
    };
  }

  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
  const data: ParsedPrepaidExpense[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0 || !row[1]) continue;

    const rowIndex = i + 1;
    const entry: ParsedPrepaidExpense = {
      rowNumber: rowIndex,
      expenseCode: row[0]?.toString()?.trim(),
      expenseName: row[1]?.toString()?.trim(),
      expenseType: row[2]?.toString()?.trim(),
      originalAmount: parseFloat(row[3]) || 0,
      paymentDate: parseExcelDate(row[4]),
      startDate: parseExcelDate(row[5]),
      endDate: parseExcelDate(row[6]),
      amortizationPeriods: parseInt(row[7]) || undefined,
      prepaidSubjectCode: row[8]?.toString()?.trim(),
      expenseSubjectCode: row[9]?.toString()?.trim(),
      supplierName: row[10]?.toString()?.trim(),
      invoiceNo: row[11]?.toString()?.trim(),
      departmentCode: row[12]?.toString()?.trim(),
      notes: row[13]?.toString()?.trim(),
    };

    if (!entry.expenseName) {
      errors.push({ row: rowIndex, message: '费用名称不能为空' });
      continue;
    }
    if (!entry.originalAmount || entry.originalAmount <= 0) {
      errors.push({ row: rowIndex, message: '原始金额必须大于0' });
      continue;
    }
    if (!entry.startDate) {
      errors.push({ row: rowIndex, message: '开始日期不能为空' });
      continue;
    }

    data.push(entry);
  }

  return {
    fileName: file.name,
    totalRows: jsonData.length - 1,
    data,
    errors
  };
}

/**
 * 解析Excel日期格式
 */
function parseExcelDate(value: any): string | undefined {
  if (!value) return undefined;

  // 如果是数字（Excel序列号）
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  // 如果是字符串
  if (typeof value === 'string') {
    // 尝试解析 YYYY-MM-DD 格式
    const match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match) {
      return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
    // 尝试解析 YYYY/MM/DD 格式
    const match2 = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (match2) {
      return `${match2[1]}-${String(match2[2]).padStart(2, '0')}-${String(match2[3]).padStart(2, '0')}`;
    }
  }

  return undefined;
}

// ==================== 资产导出功能 ====================

/**
 * 导出固定资产到Excel
 */
export function exportFixedAssetsToExcel(assets: any[]): void {
  const headers = [
    '资产编码', '资产名称', '分类', '原值', '残值', '累计折旧', '净值',
    '折旧方法', '使用年限', '购置日期', '状态', '部门', '费用科目', '备注'
  ];

  const rows = assets.map(asset => [
    asset.assetCode,
    asset.assetName,
    asset.categoryName || '',
    asset.originalValue,
    asset.salvageValue || 0,
    asset.accumulatedDepreciation || 0,
    asset.netValue,
    asset.depreciationMethod,
    asset.usefulLifeYears,
    asset.acquisitionDate,
    asset.status,
    asset.departmentName || '',
    asset.expenseSubjectCode || '',
    asset.notes || ''
  ]);

  exportToExcel([headers, ...rows], '固定资产清单');
}

/**
 * 导出无形资产到Excel
 */
export function exportIntangibleAssetsToExcel(assets: any[]): void {
  const headers = [
    '资产编码', '资产名称', '资产类型', '原值', '残值', '累计摊销', '净值',
    '摊销方法', '使用年限', '购置日期', '状态', '登记号', '费用科目', '备注'
  ];

  const rows = assets.map(asset => [
    asset.assetCode,
    asset.assetName,
    asset.assetType,
    asset.originalValue,
    asset.residualValue || 0,
    asset.accumulatedAmortization || 0,
    asset.netValue,
    asset.amortizationMethod,
    asset.usefulLifeYears,
    asset.acquisitionDate,
    asset.status,
    asset.registrationNo || '',
    asset.expenseSubjectCode || '',
    asset.notes || ''
  ]);

  exportToExcel([headers, ...rows], '无形资产清单');
}

/**
 * 导出待摊费用到Excel
 */
export function exportPrepaidExpensesToExcel(expenses: any[]): void {
  const headers = [
    '费用编码', '费用名称', '费用类型', '原始金额', '已摊销金额', '剩余金额',
    '摊销期数', '已摊销期数', '每期金额', '支付日期', '开始日期', '结束日期',
    '状态', '供应商', '发票号', '费用科目', '备注'
  ];

  const rows = expenses.map(expense => [
    expense.expenseCode,
    expense.expenseName,
    expense.expenseType,
    expense.originalAmount,
    expense.amortizedAmount || 0,
    expense.remainingAmount,
    expense.amortizationPeriods,
    expense.amortizedPeriods || 0,
    expense.periodAmount,
    expense.paymentDate,
    expense.startDate,
    expense.endDate,
    expense.status,
    expense.supplierName || '',
    expense.invoiceNo || '',
    expense.expenseSubjectCode || '',
    expense.notes || ''
  ]);

  exportToExcel([headers, ...rows], '待摊费用清单');
}

/**
 * 导出折旧记录到Excel
 */
export function exportDepreciationRecordsToExcel(records: any[]): void {
  const headers = [
    '期间', '资产编码', '资产名称', '本期折旧', '累计折旧', '折旧后净值',
    '状态', '凭证号', '备注'
  ];

  const rows = records.map(record => [
    record.period,
    record.assetCode,
    record.assetName,
    record.periodDepreciation,
    record.accumulatedDepreciation,
    record.netValueAfter,
    record.status,
    record.voucherNo || '',
    record.notes || ''
  ]);

  exportToExcel([headers, ...rows], '折旧明细表');
}

/**
 * 导出摊销记录到Excel
 */
export function exportAmortizationRecordsToExcel(records: any[]): void {
  const headers = [
    '期间', '实体编码', '实体名称', '实体类型', '本期摊销', '累计摊销', '剩余金额',
    '状态', '凭证号', '备注'
  ];

  const rows = records.map(record => [
    record.period,
    record.entityCode,
    record.entityName,
    record.entityType === 'intangible' ? '无形资产' : '待摊费用',
    record.periodAmortization,
    record.accumulatedAmortization,
    record.remainingAmount,
    record.status,
    record.voucherNo || '',
    record.notes || ''
  ]);

  exportToExcel([headers, ...rows], '摊销明细表');
}

/**
 * 通用Excel导出函数
 */
function exportToExcel(data: any[][], fileName: string): void {
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // 设置列宽
  const colWidths = data[0].map((_, colIndex) => {
    const maxWidth = Math.max(...data.map(row => {
      const cell = row[colIndex];
      return cell ? cell.toString().length * 2 : 10;
    }));
    return { wch: Math.min(Math.max(maxWidth, 10), 50) };
  });
  worksheet['!cols'] = colWidths;

  // 下载文件
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(workbook, `${fileName}_${dateStr}.xlsx`);
}

/**
 * 生成资产导入模板
 */
export function generateAssetImportTemplate(type: 'fixed' | 'intangible' | 'prepaid'): void {
  let headers: string[];
  let sampleData: string[];

  switch (type) {
    case 'fixed':
      headers = ['资产编码', '资产名称', '分类名称', '原值', '残值', '折旧方法', '使用年限', '购置日期', '部门代码', '费用科目', '备注'];
      sampleData = ['FA-001', '笔记本电脑', '电子设备', '5000', '250', '直线法', '3', '2024-01-15', 'D001', '660204', '办公用'];
      break;
    case 'intangible':
      headers = ['资产编码', '资产名称', '资产类型', '原值', '残值', '摊销方法', '使用年限', '购置日期', '登记号', '部门代码', '费用科目', '备注'];
      sampleData = ['IA-001', '财务软件', 'software', '50000', '0', '直线法', '10', '2024-01-01', '', 'D001', '660205', '用友软件'];
      break;
    case 'prepaid':
      headers = ['费用编码', '费用名称', '费用类型', '原始金额', '支付日期', '开始日期', '结束日期', '摊销期数', '待摊科目', '费用科目', '供应商', '发票号', '部门代码', '备注'];
      sampleData = ['PE-001', '年度保险费', 'insurance', '12000', '2024-01-01', '2024-01-01', '2024-12-31', '12', '1811', '660205', '平安保险', 'INV001', 'D001', '财产保险'];
      break;
  }

  exportToExcel([headers, sampleData], `${type === 'fixed' ? '固定资产' : type === 'intangible' ? '无形资产' : '待摊费用'}导入模板`);
}
