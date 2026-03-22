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

/**
 * 解析银行流水Excel文件
 */
export async function parseBankStatement(file: File): Promise<ParseResult> {
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

  for (let rowIndex = 0; rowIndex < firstSheet.data.length; rowIndex++) {
    const row = firstSheet.data[rowIndex];

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
    totalRows: firstSheet.data.length,
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
      return parseBankStatement(file);
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
