# Multi-Bank Statement Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand bank statement import from CCB-only to 14 banks using a configuration-driven parser engine, plus bank account management and field-mapping coach UI.

**Architecture:** Configuration-driven parser engine — each bank is a config object (column mapping + date format + metadata extraction) consumed by a shared parsing engine. Date formats handled by pluggable handlers. Bank auto-detection scores file features against registered configs. Bank account bindings stored in SQLite for mapping bank accounts to 1002 sub-subjects.

**Tech Stack:** TypeScript, XLSX (xlsx library), Zustand stores, SQLite (sql.js), shadcn/ui components, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-12-multi-bank-parser-design.md`

---

## File Structure

### New files (core engine)
- `src/lib/bank-parsers/types.ts` — BankParserConfig, ColumnMapping, DateHandler interface, BankAccountBinding
- `src/lib/bank-parsers/date-handlers.ts` — 5 date handlers (ISO, ExcelSerial, Compact, CompactTime, Custom)
- `src/lib/bank-parsers/meta-extractor.ts` — extract BankAccountInfo from header rows
- `src/lib/bank-parsers/engine.ts` — universal parser engine (read Excel → match columns → normalize → output)
- `src/lib/bank-parsers/detector.ts` — auto-detect bank type from file content
- `src/lib/bank-parsers/bank-registry.ts` — registry of all bank configs + custom config loader

### New files (14 bank configs)
- `src/lib/bank-parsers/configs/ccb.ts` through `src/lib/bank-parsers/configs/shanghai.ts` — 14 config files

### New files (bank account management)
- `src/stores/useBankAccountStore.ts` — Zustand store for bank account bindings
- `src/app/settings/bank-accounts/page.tsx` — settings page for managing bank accounts

### New files (UI components)
- `src/components/bank-format-selector.tsx` — bank format selector for import flow
- `src/components/field-mapping-coach.tsx` — 5-step coach UI for unknown formats

### Modified files
- `src/lib/parser.ts` — `parseBankStatement()` to accept bank ID, delegate to engine
- `src/lib/bank-parsers/ccb-parser.ts` — refactor as compat wrapper
- `src/lib/database/sqlite-service.ts` — add 2 new tables (bank_account_bindings, custom_bank_configs)
- `src/components/transaction-import.tsx` — integrate bank-format-selector, new engine
- `src/components/layout/sidebar.tsx` — add "银行账户" menu item under settings

---

## Task 1: Types and Interfaces

**Files:**
- Create: `src/lib/bank-parsers/types.ts`

- [ ] **Step 1: Create the types file**

Create `src/lib/bank-parsers/types.ts` with the following content:

```typescript
import type { BankAccountInfo, BankTransaction, BankStatementParseResult } from '@/types';

/**
 * Column mapping: Chinese keywords → standard BankTransaction fields.
 * Keywords use substring matching: "借方发生额（支出）" matches keyword "借方发生额".
 */
export interface ColumnMapping {
  date?: string[];
  time?: string[];
  debit?: string[];
  credit?: string[];
  balance?: string[];
  counterpartyName?: string[];
  counterpartyAccount?: string[];
  summary?: string[];
  notes?: string[];
  transactionSerialNo?: string[];
  enterpriseSerialNo?: string[];
  voucherNo?: string[];
  voucherType?: string[];
  cashRemitFlag?: string[];
  ourAccount?: string[];
  ourAccountName?: string[];
  ourBranch?: string[];
}

/**
 * Bank parser configuration.
 *
 * Row indexing convention (0-based):
 * - Rows 0 through headerRows-1 = metadata rows
 * - Row at headerRows = column header row
 * - Data starts at headerRows + 1
 * - Use headerRows: 0 when first row IS column headers
 */
export interface BankParserConfig {
  id: string;
  name: string;
  headerRows: number;
  columnMapping: ColumnMapping;
  dateFormat: 'iso' | 'excel_serial' | 'compact' | 'custom';
  dateFormatCustom?: string;
  hasSeparatedTime?: boolean;
  sheetIndex?: number;
  metaExtract?: Array<{
    row: number;
    col?: number;
    keyword?: string;
    field: keyof BankAccountInfo;
  }>;
  identifiers: {
    sheetKeywords?: string[];
    columnKeywords?: string[];
    minColumns?: number;
    maxColumns?: number;
  };
}

/** Date handler plugin interface */
export interface DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string };
}

/** Bank account binding record */
export interface BankAccountBinding {
  id: string;
  accountSetId: string;
  accountNumber: string;
  bankId: string;
  bankName: string;
  aliasName?: string;
  subSubjectCode: string;
  subSubjectName: string;
  branch?: string;
  currency?: string;
  isDefault?: boolean;
  createdAt: string;
}

/** Custom bank config saved by users via the Coach UI */
export interface CustomBankConfig {
  id: string;
  accountSetId: string;
  name: string;
  config: BankParserConfig;
  createdAt: string;
  updatedAt: string;
}

/** Detection result from auto-detection */
export interface DetectionResult {
  bankId: string;
  score: number;
  config: BankParserConfig;
}

export type { BankAccountInfo, BankTransaction, BankStatementParseResult };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/AI/ai-finance-assistant && npx tsc --noEmit src/lib/bank-parsers/types.ts 2>&1 | head -20`
Expected: No errors (or only import path resolution errors that resolve once other files exist)

- [ ] **Step 3: Commit**

```bash
git add src/lib/bank-parsers/types.ts
git commit -m "feat: add bank parser type definitions (BankParserConfig, DateHandler, BankAccountBinding)"
```

---

## Task 2: Date Handlers

**Files:**
- Create: `src/lib/bank-parsers/date-handlers.ts`
- Depends on: Task 1 (types.ts)

- [ ] **Step 1: Create date-handlers.ts**

```typescript
import type { DateHandler } from './types';

/**
 * Parse ISO date strings: "2024-01-26", "2024-01-26 16:30:12"
 * Used by: ABC, CITIC, CMBC, Ping An, Industrial, CCB, Shanghai, BOCOM, Huaxia
 */
export class ISODateHandler implements DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string } {
    const str = String(raw || '').trim();
    if (!str) return { date: '' };

    // If datetime combined (e.g. "2024-01-26 16:30:12")
    const match = str.match(/^(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2}:\d{2})?/);
    if (match) {
      return {
        date: match[1],
        time: timeRaw ? this.formatTime(String(timeRaw)) : (match[2] || undefined),
      };
    }

    return { date: str, time: timeRaw ? this.formatTime(String(timeRaw)) : undefined };
  }

  private formatTime(raw: string): string | undefined {
    const t = raw.trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
    if (/^\d{2}:\d{2}$/.test(t)) return t + ':00';
    return undefined;
  }
}

/**
 * Parse Excel serial number dates: 45292 → "2024-01-01"
 * Used by: ICBC
 */
export class ExcelSerialDateHandler implements DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string } {
    const num = Number(raw);
    if (isNaN(num) || num <= 0) return { date: '' };

    // Excel serial: days since 1900-01-01 (with the 1900 leap year bug offset)
    const ms = (num - 25569) * 86400000;
    const d = new Date(ms);
    const date = d.toISOString().slice(0, 10);

    return {
      date,
      time: timeRaw ? new ISODateHandler().parse('', timeRaw).time : undefined,
    };
  }
}

/**
 * Parse compact date strings: "20240102" → "2024-01-02"
 * Used by: BOC, SPDB
 */
export class CompactDateHandler implements DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string } {
    const str = String(raw || '').trim();
    const match = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      return {
        date: `${match[1]}-${match[2]}-${match[3]}`,
        time: timeRaw ? this.parseCompactTime(String(timeRaw)) : undefined,
      };
    }

    // Fallback: try ISO
    return new ISODateHandler().parse(raw, timeRaw);
  }

  private parseCompactTime(raw: string): string | undefined {
    const t = raw.trim();
    const match = t.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (match) return `${match[1]}:${match[2]}:${match[3]}`;
    // Already formatted?
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
    return undefined;
  }
}

/**
 * Parse custom date formats. Currently supports "yyyy-MM-dd-HHmm" → "yyyy-MM-dd HH:mm"
 * Used by: CZB
 */
export class CustomFormatDateHandler implements DateHandler {
  constructor(private pattern: string = 'yyyy-MM-dd-HHmm') {}

  parse(raw: any, timeRaw?: any): { date: string; time?: string } {
    const str = String(raw || '').trim();
    if (!str) return { date: '' };

    if (this.pattern === 'yyyy-MM-dd-HHmm') {
      // "2024-01-26-13:43" → date "2024-01-26", time "13:43:00"
      const match = str.match(/^(\d{4}-\d{2}-\d{2})[-\s](\d{2}:\d{2})/);
      if (match) {
        return { date: match[1], time: match[2] + ':00' };
      }
    }

    // Fallback to ISO
    return new ISODateHandler().parse(raw, timeRaw);
  }
}

/**
 * Get the appropriate date handler for a given format.
 */
export function getDateHandler(format: string, customPattern?: string): DateHandler {
  switch (format) {
    case 'excel_serial': return new ExcelSerialDateHandler();
    case 'compact': return new CompactDateHandler();
    case 'custom': return new CustomFormatDateHandler(customPattern);
    case 'iso':
    default: return new ISODateHandler();
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/AI/ai-finance-assistant && npx tsc --noEmit src/lib/bank-parsers/date-handlers.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/bank-parsers/date-handlers.ts
git commit -m "feat: add date handler plugins (ISO, ExcelSerial, Compact, CustomFormat)"
```

---

## Task 3: Metadata Extractor

**Files:**
- Create: `src/lib/bank-parsers/meta-extractor.ts`
- Depends on: Task 1 (types.ts)

- [ ] **Step 1: Create meta-extractor.ts**

```typescript
import type { BankAccountInfo, BankParserConfig } from './types';

/**
 * Extract BankAccountInfo from metadata rows (rows 0 to headerRows-1).
 */
export function extractMeta(rawData: string[][], config: BankParserConfig): BankAccountInfo {
  const info: BankAccountInfo = {
    bankName: '',
    accountName: '',
    accountNumber: '',
    branch: '',
    currency: '',
  };

  if (!config.metaExtract) return info;

  for (const rule of config.metaExtract) {
    const row = rawData[rule.row];
    if (!row) continue;

    let value = '';

    if (rule.col !== undefined) {
      // Direct column index
      value = String(row[rule.col] || '').trim();
      // Strip label prefix (e.g. "账号: 6222..." → "6222...")
      value = stripLabel(value, rule.keyword);
    } else if (rule.keyword) {
      // Auto-detect: scan row for keyword, take next cell's value
      value = findByKeyword(row, rule.keyword);
    }

    if (value) {
      (info as any)[rule.field] = value;
    }
  }

  return info;
}

function stripLabel(value: string, keyword?: string): string {
  if (!keyword) return value;
  // Remove patterns like "账号:" or "账号："
  const idx = value.indexOf(keyword);
  if (idx >= 0) {
    const after = value.slice(idx + keyword.length).replace(/^[:：\s]+/, '');
    if (after) return after;
  }
  return value;
}

function findByKeyword(row: string[], keyword: string): string {
  for (let i = 0; i < row.length; i++) {
    const cell = String(row[i] || '').trim();
    if (cell.includes(keyword)) {
      // Return the next cell's value, or the remainder after the keyword in this cell
      if (i + 1 < row.length) {
        const next = String(row[i + 1] || '').trim();
        if (next) return next;
      }
      // Keyword and value in same cell: "账号: 6222..."
      return stripLabel(cell, keyword);
    }
  }
  return '';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bank-parsers/meta-extractor.ts
git commit -m "feat: add metadata extractor for bank statement headers"
```

---

## Task 4: Universal Parsing Engine

**Files:**
- Create: `src/lib/bank-parsers/engine.ts`
- Depends on: Tasks 1, 2, 3

- [ ] **Step 1: Create engine.ts**

```typescript
import * as XLSX from 'xlsx';
import type { BankParserConfig, BankAccountInfo, BankTransaction, BankStatementParseResult } from './types';
import { getDateHandler } from './date-handlers';
import { extractMeta } from './meta-extractor';

/**
 * Parse a bank statement file using the given configuration.
 */
export async function parseWithConfig(file: File, config: BankParserConfig): Promise<BankStatementParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[config.sheetIndex || 0];
  const ws = workbook.Sheets[sheetName];

  if (!ws) {
    return {
      fileName: file.name,
      type: 'bank',
      bankInfo: { bankName: '', accountName: '', accountNumber: '' },
      transactions: [],
      errors: [{ row: 0, message: '无法读取工作表' }],
    };
  }

  const rawData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rawData.length <= config.headerRows) {
    return {
      fileName: file.name,
      type: 'bank',
      bankInfo: { bankName: '', accountName: '', accountNumber: '' },
      transactions: [],
      errors: [{ row: 0, message: '文件无数据' }],
    };
  }

  // Step 1: Extract metadata from header rows
  const bankInfo = extractMeta(rawData, config);

  // Step 2: Get column headers row
  const headerRow = rawData[config.headerRows];
  if (!headerRow) {
    return {
      fileName: file.name,
      type: 'bank',
      bankInfo,
      transactions: [],
      errors: [{ row: config.headerRows, message: '找不到列标题行' }],
    };
  }

  // Step 3: Match column headers to standard fields
  const colIndex = matchColumns(headerRow, config.columnMapping);

  // Validate: need at least date and one of debit/credit
  const hasDate = colIndex.has('date');
  const hasDebitOrCredit = colIndex.has('debit') || colIndex.has('credit');
  if (!hasDate || !hasDebitOrCredit) {
    return {
      fileName: file.name,
      type: 'bank',
      bankInfo,
      transactions: [],
      errors: [{ row: config.headerRows, message: `列匹配失败：需要日期和借贷金额列。匹配到: ${[...colIndex.keys()].join(', ') || '无'}` }],
    };
  }

  // Step 4: Parse data rows
  const dateHandler = getDateHandler(config.dateFormat, config.dateFormatCustom);
  const transactions: BankTransaction[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = config.headerRows + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every(c => !String(c || '').trim())) continue; // skip empty rows

    try {
      const tx = parseRow(row, i, colIndex, dateHandler, config.hasSeparatedTime || false);
      if (tx.date) {
        transactions.push(tx);
      }
    } catch (e) {
      errors.push({ row: i + 1, message: `第 ${i + 1} 行解析失败: ${(e as Error).message}` });
    }
  }

  return { fileName: file.name, type: 'bank', bankInfo, transactions, errors, rawData };
}

/**
 * Match column headers against configured keywords using substring matching.
 */
export function matchColumns(headers: string[], mapping: BankParserConfig['columnMapping']): Map<string, number> {
  const result = new Map<string, number>();
  for (const [field, keywords] of Object.entries(mapping)) {
    if (!keywords) continue;
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || '').trim();
      if (keywords.some(kw => header.includes(kw))) {
        result.set(field, i);
        break;
      }
    }
  }
  return result;
}

/**
 * Parse a single data row into a BankTransaction.
 */
function parseRow(
  row: string[],
  rowIndex: number,
  colIndex: Map<string, number>,
  dateHandler: { parse: (raw: any, timeRaw?: any) => { date: string; time?: string } },
  hasSeparatedTime: boolean,
): BankTransaction {
  const get = (field: string): string => {
    const idx = colIndex.get(field);
    return idx !== undefined ? String(row[idx] || '').trim() : '';
  };

  const rawDate = get('date');
  const rawTime = hasSeparatedTime ? get('time') : undefined;
  const { date, time } = dateHandler.parse(rawDate, rawTime);

  const debit = parseAmount(get('debit'));
  const credit = parseAmount(get('credit'));

  return {
    id: `${Date.now()}-r${rowIndex}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    transactionTime: time,
    voucherType: get('voucherType') || undefined,
    voucherNo: get('voucherNo') || undefined,
    debit,
    credit,
    balance: parseAmount(get('balance')),
    cashRemitFlag: get('cashRemitFlag') || undefined,
    counterpartyName: get('counterpartyName') || undefined,
    counterpartyAccount: get('counterpartyAccount') || undefined,
    summary: get('summary') || get('notes') || '(无摘要)',
    notes: get('notes') || undefined,
    transactionSerialNo: get('transactionSerialNo') || undefined,
    enterpriseSerialNo: get('enterpriseSerialNo') || undefined,
    ourAccount: get('ourAccount') || undefined,
    ourAccountName: get('ourAccountName') || undefined,
    ourBranch: get('ourBranch') || undefined,
    rowNumber: rowIndex + 1,
  };
}

function parseAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').replace(/--/g, '').trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return isNaN(num) ? undefined : Math.round(num * 100) / 100;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/AI/ai-finance-assistant && npx tsc --noEmit src/lib/bank-parsers/engine.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/bank-parsers/engine.ts
git commit -m "feat: add universal bank statement parsing engine"
```

---

## Task 5: Bank Auto-Detector

**Files:**
- Create: `src/lib/bank-parsers/detector.ts`
- Depends on: Tasks 1, 4

- [ ] **Step 1: Create detector.ts**

```typescript
import * as XLSX from 'xlsx';
import type { BankParserConfig, DetectionResult } from './types';

/**
 * Auto-detect which bank format a file uses.
 * Returns scored results sorted by confidence (highest first).
 */
export async function detectBank(file: File, configs: BankParserConfig[]): Promise<DetectionResult[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];

  const rawData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const previewRows = rawData.slice(0, 20);
  const allText = previewRows.flat().map(c => String(c || '')).join(' ');

  const results: DetectionResult[] = [];

  for (const config of configs) {
    let score = 0;

    // Check sheet keywords
    if (config.identifiers.sheetKeywords) {
      for (const kw of config.identifiers.sheetKeywords) {
        if (allText.includes(kw)) score += 2;
      }
    }

    // Check column keywords — find the likely header row
    const headerRowIdx = Math.min(config.headerRows, previewRows.length - 1);
    const headerRow = previewRows[headerRowIdx] || [];
    const headerText = headerRow.join(' ');

    if (config.identifiers.columnKeywords) {
      for (const kw of config.identifiers.columnKeywords) {
        if (headerText.includes(kw)) score += 3;
      }
    }

    // Check column count
    const colCount = headerRow.length;
    if (config.identifiers.minColumns && colCount >= config.identifiers.minColumns) score += 1;
    if (config.identifiers.maxColumns && colCount <= config.identifiers.maxColumns) score += 1;

    if (score > 0) {
      results.push({ bankId: config.id, score, config });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Get the best detection result if confidence is high enough.
 * Returns null if no confident match found.
 */
export function getBestDetection(results: DetectionResult[]): DetectionResult | null {
  if (results.length === 0) return null;
  const best = results[0];
  if (best.score < 5) return null;
  if (results.length > 1 && best.score - results[1].score < 2) return null;
  return best;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bank-parsers/detector.ts
git commit -m "feat: add bank format auto-detector"
```

---

## Task 6: Bank Registry

**Files:**
- Create: `src/lib/bank-parsers/bank-registry.ts`
- Create: `src/lib/bank-parsers/configs/ccb.ts` (plus remaining 13 configs)
- Depends on: Tasks 1-5

This task creates the registry that holds all configs and loads custom ones from DB.

- [ ] **Step 1: Create all 14 bank config files**

Create each config file in `src/lib/bank-parsers/configs/`. Each file exports a single `BankParserConfig`. See spec section "Config Examples" and the "Supported Banks" table for exact values. Files:

- `ccb.ts` — headerRows: **9**, iso, 17 cols (reference config from spec — rows 0-8 metadata, row 9 = column headers)
- `icbc.ts` — headerRows: **5**, excel_serial, 10 cols (rows 0-4 metadata, row 5 = headers)
- `abc.ts` — headerRows: **3**, iso, 8 cols (rows 0-2 metadata, row 3 = headers, data from row 4. Row 0 = "账户明细" title, Row 1 = 账号/户名/币种, Row 2 = column headers. **NOTE**: Spec table says 3 but actual sample shows headers at row 2 → use **2**. Verify with sample file.)
- `cmb.ts` — headerRows: **9**, iso + separated time, 36 cols (rows 0-8 metadata, row 9 = headers)
- `boc.ts` — headerRows: **9**, compact, 38 cols (rows 0-8 metadata, row 9 = headers)
- `citic.ts` — headerRows: **14**, iso, 22 cols (rows 0-13 metadata, row 14 = headers)
- `bocom.ts` — headerRows: **2**, iso, 7 cols (row 0 = 查询账号/户名, row 1 = headers, data from row 2)
- `industrial.ts` — headerRows: **1**, iso, 19 cols (row 0 = headers IS column names, data from row 1. **IMPORTANT**: Spec says "Fewest header rows" = 1. Verify: if row 0 IS column headers with no metadata above, use headerRows: **0**. If row 0 has metadata like bank name and row 1 has column headers, use **1**. Check sample.)
- `czb.ts` — headerRows: **5**, custom, 12 cols (rows 0-4 metadata, row 5 = headers)
- `spdb.ts` — headerRows: **5**, compact + separated time, 16 cols (rows 0-4 metadata, row 5 = headers — confirmed by spec config example)
- `cmbc.ts` — headerRows: **18**, iso, 10 cols (rows 0-17 metadata, row 18 = headers)
- `pingan.ts` — headerRows: **1**, iso, 20 cols (row 0 = headers IS column names. **IMPORTANT**: Same as Industrial — verify if row 0 is column headers (use **0**) or has metadata above (use **1**). Check sample.)
- `huaxia.ts` — headerRows: **8**, iso + separated time, 15 cols (rows 0-7 metadata, row 8 = headers)
- `shanghai.ts` — headerRows: **6**, iso, 12 cols (rows 0-5 metadata, row 6 = headers)

**headerRows values come from the spec "Supported Banks" table.** The convention is: rows 0 through headerRows-1 = metadata, row headerRows = column headers, data starts at headerRows+1.

Each config must include: `columnMapping` (keywords matching actual column names), `dateFormat`, `metaExtract` (account number/name from header rows), and `identifiers` (unique keywords for auto-detection).

**Column header reference for all 14 banks** (from sample file analysis):

| Bank | Column Headers (Chinese) |
|------|-------------------------|
| CCB (建设) | 日期, 交易时间, 凭证类型, 凭证号, 借方发生额, 贷方发生额, 余额, 钞汇标识, 对方户名, 对方账号, 摘要, 备注, 交易流水号, 企业流水号, 本方账号, 本方户名, 本方网点 |
| ICBC (工商) | 日期, 交易类型, 凭证种类, 凭证号, 对方户名, 对方账号, 摘要, 借方发生额, 贷方发生额, 余额 |
| ABC (农行) | 交易时间, 收入金额, 支出金额, 账户余额, 对方账号, 对方户名, 对方开户行, 摘要 |
| CMB (招商) | 账号, 账号名称, 币种, 交易日, 交易时间, 起息日, 交易类型, 借方金额, 贷方金额, 余额, 摘要, 流水号, 流程实例号, 业务名称, 用途, 业务参考号, 业务摘要, 其它摘要, 收(付)方分行名, 收(付)方名称, 收(付)方账号, (more...) |
| BOC (中行) | 交易类型, 业务类型, 付款人开户行号/名, 付款人账号/名称, 收款人开户行行号/名, 收款人账号/名称, 交易日期, 交易时间, 交易货币, 交易金额, 交易后余额, 起息日期, 汇率, 交易流水号, 客户申请号, 客户业务编号, 凭证类型/号码, 记录标识号, 摘要, 用途, 交易附言, 备注, (bilingual — use Chinese keywords only) |
| CITIC (中信) | 交易日期, 交易时间, 对方账号, 对方账户名称, 对方账号开户网点名称, 借方发生额, 贷方发生额, 账户余额, 摘要, 退汇标识, 退汇日期, 柜员交易号, 附言, 币种, 交易账号, 交易账号开户网点名称, 对账编号, 单位结算卡号, 发起方流水号, 动账资金分簿, 凭证类型, 凭证号码 |
| BOCOM (交行) | 交易时间, 借方发生额（支出）, 贷方发生额（收入）, 账户余额, 对方账号, 对方户名, 摘要 |
| Industrial (兴业) | 银行流水号, 账号, 户名, 凭证代号, 币种, 现/转, 借方金额(支出), 贷方金额(收入), 账户余额, 摘要, 对方账号, 对方户名, 对方银行, 对方行号, 记账日期, 交易时间, 用途, 备注, 唯一流水编号 |
| CZB (浙商) | 流水号, 交易时间, 摘要, 凭证种类, 凭证号, 借方发生金额(元), 贷方发生金额(元), 交易后余额(元), 对方名称, 对方账号, 对方开户行, 用途/附言 |
| SPDB (浦发) | 交易日期, 交易时间, 申请日期, 凭证号, 借方金额, 贷方金额, 余额, 对方账号, 对方户名, 对方行名, 交易流水号, 传票序号, 记录状态, 摘要, 交易附言, 客户账户类型 |
| CMBC (民生) | 交易时间, 交易流水号, 借方发生额, 贷方发生额, 账户余额, 凭证号, 客户附言, 对方账号, 对方账号名称, 对方开户行 |
| Ping An (平安) | 交易日期, 账号, 账户名称, 银行名称, 银行类型, 借方(支出)金额, 贷方(收入)金额, 账户余额, 币种, 对方账号, 对方账户名称, 对方开户行, 对方开户行类型, 用途, 审批状态, 交易类型, 银行流水号, 摘要, 明细来源, 付款单备注 |
| Huaxia (华夏) | 序号, 交易日期, 交易时间, 支出金额, 收入金额, 余额, 对方账号, 对方户名, 对方行名, 核心流水号, 交易描述, 摘要, 凭证号码, 明细标注, 记账日期 |
| Shanghai (上海) | 交易流水号, 交易时间, 记账日期, 交易方向, 借方发生额, 贷方发生额, 余额, 对手账号, 对手名称, 摘要, 交易用途, 备注 |

- [ ] **Step 2: Create bank-registry.ts**

```typescript
import type { BankParserConfig, CustomBankConfig } from './types';
import { ccbConfig } from './configs/ccb';
import { icbcConfig } from './configs/icbc';
import { abcConfig } from './configs/abc';
import { cmbConfig } from './configs/cmb';
import { bocConfig } from './configs/boc';
import { citicConfig } from './configs/citic';
import { bocomConfig } from './configs/bocom';
import { industrialConfig } from './configs/industrial';
import { czbConfig } from './configs/czb';
import { spdbConfig } from './configs/spdb';
import { cmbcConfig } from './configs/cmbc';
import { pinganConfig } from './configs/pingan';
import { huaxiaConfig } from './configs/huaxia';
import { shanghaiConfig } from './configs/shanghai';

/** All built-in bank configs */
const builtInConfigs: BankParserConfig[] = [
  ccbConfig, icbcConfig, abcConfig, cmbConfig, bocConfig, citicConfig,
  bocomConfig, industrialConfig, czbConfig, spdbConfig, cmbcConfig,
  pinganConfig, huaxiaConfig, shanghaiConfig,
];

/** Get all built-in configs */
export function getAllConfigs(): BankParserConfig[] {
  return builtInConfigs;
}

/** Get config by bank ID */
export function getConfigById(id: string): BankParserConfig | undefined {
  return builtInConfigs.find(c => c.id === id);
}

/** Get all configs for detection (built-in + custom) */
export function getAllConfigsWithCustom(customConfigs?: CustomBankConfig[]): BankParserConfig[] {
  const customs = customConfigs?.map(c => c.config) || [];
  return [...builtInConfigs, ...customs];
}

/** Bank list for UI selectors */
export function getBankList(): Array<{ id: string; name: string }> {
  return builtInConfigs.map(c => ({ id: c.id, name: c.name }));
}
```

- [ ] **Step 3: Verify all imports resolve**

Run: `cd D:/AI/ai-finance-assistant && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/lib/bank-parsers/configs/ src/lib/bank-parsers/bank-registry.ts
git commit -m "feat: add 14 bank configs and bank registry"
```

---

## Task 7: Update parser.ts and ccb-parser.ts

**Files:**
- Modify: `src/lib/parser.ts` (lines 32-38)
- Modify: `src/lib/bank-parsers/ccb-parser.ts` (entire file)
- Depends on: Tasks 1-6

- [ ] **Step 1: Update parseBankStatement in parser.ts**

In `src/lib/parser.ts`, change the `parseBankStatement` function (lines 32-38) to accept an optional `bankId` parameter and delegate to the engine:

```typescript
import type { BankStatementParseResult } from '@/types';
import { parseWithConfig } from './bank-parsers/engine';
import { getConfigById, getAllConfigsWithCustom } from './bank-parsers/bank-registry';
import { getBestDetection, detectBank } from './bank-parsers/detector';

/**
 * 解析银行流水Excel文件
 * @param file 上传的Excel文件
 * @param bankId 银行ID（可选，不传则自动检测）
 */
export async function parseBankStatement(file: File, bankId?: string): Promise<BankStatementParseResult> {
  if (bankId) {
    const config = getConfigById(bankId);
    if (config) return parseWithConfig(file, config);
  }

  // Auto-detect
  const allConfigs = getAllConfigsWithCustom();
  const results = await detectBank(file, allConfigs);
  const best = getBestDetection(results);

  if (best) {
    return parseWithConfig(file, best.config);
  }

  // Fallback: try CCB (legacy behavior)
  const ccbConfig = getConfigById('ccb');
  if (ccbConfig) return parseWithConfig(file, ccbConfig);

  throw new Error('无法识别银行格式，请手动选择银行类型');
}
```

**Also** remove the old `import { parseCCBStatement } from './bank-parsers/ccb-parser'` line from parser.ts (it's no longer called directly — the new code uses `getConfigById` + `parseWithConfig` instead). Add these new imports at the top of parser.ts:
```typescript
import { parseWithConfig } from './bank-parsers/engine';
import { getConfigById, getAllConfigsWithCustom } from './bank-parsers/bank-registry';
import { getBestDetection, detectBank } from './bank-parsers/detector';
```

- [ ] **Step 2: Refactor ccb-parser.ts as compat wrapper**

Replace the entire content of `src/lib/bank-parsers/ccb-parser.ts` with:

```typescript
/**
 * CCB parser — backward-compatible wrapper.
 * Delegates to the universal engine with CCB config.
 */
import { parseWithConfig } from './engine';
import { ccbConfig } from './configs/ccb';
import type { BankStatementParseResult } from './types';

export async function parseCCBStatement(file: File): Promise<BankStatementParseResult> {
  return parseWithConfig(file, ccbConfig);
}

// Re-export for any external consumers
export { ccbConfig as CCB_CONFIG };
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd D:/AI/ai-finance-assistant && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/lib/parser.ts src/lib/bank-parsers/ccb-parser.ts
git commit -m "refactor: parseBankStatement delegates to config-driven engine, CCB parser as compat wrapper"
```

---

## Task 8: SQLite Migrations (2 New Tables)

**Files:**
- Modify: `src/lib/database/sqlite-service.ts`
- Depends on: Task 1 (types)

- [ ] **Step 1: Add bank_account_bindings table migration**

In `src/lib/database/sqlite-service.ts`, find the `ensureInitialized` or migration method (around line 140+). After the existing migrations, add a new migration block following the same pattern:

```typescript
// --- Migration: bank_account_bindings ---
try {
  const checkBindings = this.dbInstance.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='bank_account_bindings'"
  );
  if (!checkBindings[0]?.values?.length) {
    console.log('Migrating database: creating bank_account_bindings table...');
    this.dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS bank_account_bindings (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        accountNumber TEXT NOT NULL,
        bankId TEXT NOT NULL,
        bankName TEXT NOT NULL,
        aliasName TEXT,
        subSubjectCode TEXT NOT NULL,
        subSubjectName TEXT NOT NULL,
        branch TEXT,
        currency TEXT,
        isDefault INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        UNIQUE(accountSetId, accountNumber)
      );
      CREATE INDEX IF NOT EXISTS idx_bank_bindings_accountSetId ON bank_account_bindings(accountSetId);
      CREATE INDEX IF NOT EXISTS idx_bank_bindings_accountNumber ON bank_account_bindings(accountNumber);
    `);
  }
} catch (e) {
  console.warn('bank_account_bindings migration warning:', e);
}

// --- Migration: custom_bank_configs ---
try {
  const checkCustom = this.dbInstance.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_bank_configs'"
  );
  if (!checkCustom[0]?.values?.length) {
    console.log('Migrating database: creating custom_bank_configs table...');
    this.dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS custom_bank_configs (
        id TEXT PRIMARY KEY,
        accountSetId TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_custom_bank_configs_accountSetId ON custom_bank_configs(accountSetId);
    `);
  }
} catch (e) {
  console.warn('custom_bank_configs migration warning:', e);
}
```

- [ ] **Step 2: Add CRUD methods for bank_account_bindings**

Add these methods to the `SQLiteService` class:

```typescript
// --- Bank Account Bindings ---
async getBankAccountBindings(): Promise<any[]> {
  const db = await this.getDatabase();
  const result = db.exec(
    `SELECT * FROM bank_account_bindings WHERE accountSetId = ? ORDER BY createdAt DESC`,
    [this.accountSetId]
  );
  return result[0]?.values?.map((row: any[]) => ({
    id: row[0], accountSetId: row[1], accountNumber: row[2], bankId: row[3],
    bankName: row[4], aliasName: row[5], subSubjectCode: row[6], subSubjectName: row[7],
    branch: row[8], currency: row[9], isDefault: !!row[10], createdAt: row[11],
  })) || [];
}

async saveBankAccountBinding(binding: any): Promise<void> {
  const db = await this.getDatabase();
  db.exec(
    `INSERT OR REPLACE INTO bank_account_bindings
     (id, accountSetId, accountNumber, bankId, bankName, aliasName, subSubjectCode, subSubjectName, branch, currency, isDefault, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [binding.id, binding.accountSetId, binding.accountNumber, binding.bankId, binding.bankName,
     binding.aliasName || null, binding.subSubjectCode, binding.subSubjectName,
     binding.branch || null, binding.currency || null, binding.isDefault ? 1 : 0, binding.createdAt]
  );
  await this.persist();
}

async deleteBankAccountBinding(id: string): Promise<void> {
  const db = await this.getDatabase();
  db.exec(`DELETE FROM bank_account_bindings WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
  await this.persist();
}

async findBankAccountBinding(accountNumber: string): Promise<any | null> {
  const db = await this.getDatabase();
  const result = db.exec(
    `SELECT * FROM bank_account_bindings WHERE accountNumber = ? AND accountSetId = ?`,
    [accountNumber, this.accountSetId]
  );
  if (!result[0]?.values?.length) return null;
  const row = result[0].values[0];
  return {
    id: row[0], accountSetId: row[1], accountNumber: row[2], bankId: row[3],
    bankName: row[4], aliasName: row[5], subSubjectCode: row[6], subSubjectName: row[7],
    branch: row[8], currency: row[9], isDefault: !!row[10], createdAt: row[11],
  };
}

// --- Custom Bank Configs ---
async getCustomBankConfigs(): Promise<any[]> {
  const db = await this.getDatabase();
  const result = db.exec(
    `SELECT * FROM custom_bank_configs WHERE accountSetId = ? ORDER BY createdAt DESC`,
    [this.accountSetId]
  );
  return result[0]?.values?.map((row: any[]) => ({
    id: row[0], accountSetId: row[1], name: row[2], config: JSON.parse(row[3]),
    createdAt: row[4], updatedAt: row[5],
  })) || [];
}

async saveCustomBankConfig(customConfig: any): Promise<void> {
  const db = await this.getDatabase();
  db.exec(
    `INSERT OR REPLACE INTO custom_bank_configs (id, accountSetId, name, config, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [customConfig.id, customConfig.accountSetId, customConfig.name,
     JSON.stringify(customConfig.config), customConfig.createdAt, customConfig.updatedAt]
  );
  await this.persist();
}

async deleteCustomBankConfig(id: string): Promise<void> {
  const db = await this.getDatabase();
  db.exec(`DELETE FROM custom_bank_configs WHERE id = ? AND accountSetId = ?`, [id, this.accountSetId]);
  await this.persist();
}
```

- [ ] **Step 3: Verify build**

Run: `cd D:/AI/ai-finance-assistant && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/lib/database/sqlite-service.ts
git commit -m "feat: add bank_account_bindings and custom_bank_configs tables + CRUD methods"
```

---

## Task 9: Bank Account Store

**Files:**
- Create: `src/stores/useBankAccountStore.ts`
- Modify: `src/stores/index.ts` (add export)
- Depends on: Tasks 1, 8

- [ ] **Step 1: Create useBankAccountStore.ts**

```typescript
import { create } from 'zustand';
import type { BankAccountBinding } from '@/lib/bank-parsers/types';
import { getCurrentService } from '@/lib/database';
import { waitForDbInit } from '@/hooks/useDatabaseSync';

interface BankAccountStore {
  bindings: BankAccountBinding[];
  loading: boolean;
  loadBindings: () => Promise<void>;
  addBinding: (data: Omit<BankAccountBinding, 'id' | 'createdAt'>) => Promise<BankAccountBinding>;
  updateBinding: (id: string, data: Partial<BankAccountBinding>) => Promise<void>;
  deleteBinding: (id: string) => Promise<void>;
  findByAccountNumber: (accountNumber: string) => BankAccountBinding | undefined;
}

export const useBankAccountStore = create<BankAccountStore>((set, get) => ({
  bindings: [],
  loading: false,

  loadBindings: async () => {
    await waitForDbInit();
    const service = getCurrentService();
    const raw = service.getBankAccountBindings();
    set({ bindings: raw as BankAccountBinding[] });
  },

  addBinding: async (data) => {
    await waitForDbInit();
    const service = getCurrentService();
    const binding: BankAccountBinding = {
      ...data,
      id: `bab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    service.saveBankAccountBinding(binding);
    set(state => ({ bindings: [binding, ...state.bindings] }));
    return binding;
  },

  updateBinding: async (id, data) => {
    await waitForDbInit();
    const service = getCurrentService();
    const existing = get().bindings.find(b => b.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    service.saveBankAccountBinding(updated);
    set(state => ({ bindings: state.bindings.map(b => b.id === id ? updated : b) }));
  },

  deleteBinding: async (id) => {
    await waitForDbInit();
    const service = getCurrentService();
    service.deleteBankAccountBinding(id);
    set(state => ({ bindings: state.bindings.filter(b => b.id !== id) }));
  },

  findByAccountNumber: (accountNumber) => {
    return get().bindings.find(b => b.accountNumber === accountNumber);
  },
}));
```

- [ ] **Step 2: Add export to stores/index.ts**

In `src/stores/index.ts`, add the export line:

```typescript
export { useBankAccountStore } from './useBankAccountStore';
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/useBankAccountStore.ts src/stores/index.ts
git commit -m "feat: add BankAccountStore for bank account binding management"
```

---

## Task 10: Bank Format Selector Component

**Files:**
- Create: `src/components/bank-format-selector.tsx`
- Depends on: Task 6 (bank-registry)

- [ ] **Step 1: Create bank-format-selector.tsx**

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { getBankList } from '@/lib/bank-parsers/bank-registry';
import type { DetectionResult } from '@/lib/bank-parsers/types';

interface BankFormatSelectorProps {
  value: string;
  onChange: (bankId: string) => void;
  detectionResult?: DetectionResult | null;
}

const bankList = getBankList();

export function BankFormatSelector({ value, onChange, detectionResult }: BankFormatSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="选择银行格式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">自动检测</SelectItem>
          <SelectItem value="custom">自定义格式</SelectItem>
          {bankList.map(bank => (
            <SelectItem key={bank.id} value={bank.id}>
              {bank.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {detectionResult && (
        <Badge variant="secondary" className="text-xs">
          <Zap className="h-3 w-3 mr-1" />
          已识别: {detectionResult.config.name}
        </Badge>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bank-format-selector.tsx
git commit -m "feat: add bank format selector component with auto-detection badge"
```

---

## Task 11: Integrate Bank Selector into Transaction Import

**Files:**
- Modify: `src/components/transaction-import.tsx`
- Depends on: Tasks 7, 10

- [ ] **Step 1: Add state and imports**

In `src/components/transaction-import.tsx`:

1. Add imports at the top:
```typescript
import { BankFormatSelector } from '@/components/bank-format-selector';
import { detectBank, getBestDetection } from '@/lib/bank-parsers/detector';
import { getAllConfigs } from '@/lib/bank-parsers/bank-registry';
import type { DetectionResult } from '@/lib/bank-parsers/types';
import { useBankAccountStore } from '@/stores';
```

2. Add state variables in the component (near existing state declarations):
```typescript
const [selectedBankId, setSelectedBankId] = useState<string>('auto');
const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
```

- [ ] **Step 2: Add bank detection on file selection**

Find the file input `onChange` handler (it calls `setSelectedFile(file)`). The handler must be made `async` if it isn't already. After `setSelectedFile(file)`, add auto-detection:

```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setSelectedFile(file);
  setDetectionResult(null);

  // Auto-detect bank format
  try {
    const results = await detectBank(file, getAllConfigs());
    const best = getBestDetection(results);
    setDetectionResult(best);
    if (best) setSelectedBankId(best.bankId);
  } catch {
    // Detection failed, user will select manually
  }
};
```

- [ ] **Step 3: Update parseBankStatement call to pass bankId**

Find the `parseBankStatement(selectedFile)` call (around line 265) and change it to:

```typescript
const bankId = selectedBankId === 'auto' ? undefined : selectedBankId;
const result: BankStatementParseResult = await parseBankStatement(selectedFile, bankId);
```

- [ ] **Step 4: Add BankFormatSelector to the upload UI**

Before or near the file upload button, add the bank format selector:

```tsx
<BankFormatSelector
  value={selectedBankId}
  onChange={setSelectedBankId}
  detectionResult={selectedFile ? detectionResult : null}
/>
```

- [ ] **Step 5: Test with existing CCB file**

Run the dev server: `cd D:/AI/ai-finance-assistant && npm run dev`
Upload the existing CCB file to verify backward compatibility.

- [ ] **Step 6: Commit**

```bash
git add src/components/transaction-import.tsx
git commit -m "feat: integrate bank format selector and auto-detection into transaction import"
```

---

## Task 12: Bank Account Management Settings Page

**Files:**
- Create: `src/app/settings/bank-accounts/page.tsx`
- Modify: `src/components/layout/sidebar.tsx` (add menu item)
- Depends on: Tasks 9, 10

- [ ] **Step 1: Add sidebar navigation entry**

In `src/components/layout/sidebar.tsx`, find the "基础档案" children array (around line 83-91) and add:

```typescript
{ label: '银行账户', path: '/settings/bank-accounts' },
```

- [ ] **Step 2: Create settings page**

Create `src/app/settings/bank-accounts/page.tsx` — a settings page following the existing settings page patterns (e.g. `settings/currencies/page.tsx`). It should:

- Load bindings on mount via `useBankAccountStore.loadBindings()`
- Display a table: bank name, account number, subject code, alias, actions
- "Add" button opens an inline form (Popover or drawer) with:
  - Bank select dropdown (from `getBankList()`)
  - Account number input
  - Alias input (optional)
- On save: auto-generate 1002 sub-subject code, create subject + binding
- Edit/delete actions per row
- Use shadcn/ui components (Card, Table, Button, Input, Select, Dialog)
- Follow the project's UI conventions (slate-50 background, white cards, blue-600 primary)

The auto subject generation logic:
1. Query existing subjects where code starts with '1002' and length > 4
2. Find max numeric suffix (100201, 100202 → next = 100203)
3. Create subject with code and name `银行存款 - [bankName] ([last4digits])`

- [ ] **Step 3: Verify page loads in browser**

Run: `cd D:/AI/ai-finance-assistant && npm run dev`
Navigate to `/settings/bank-accounts` and verify the page renders.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/bank-accounts/page.tsx src/components/layout/sidebar.tsx
git commit -m "feat: add bank account management settings page"
```

---

## Task 13: Field Mapping Coach UI

**Files:**
- Create: `src/components/field-mapping-coach.tsx`
- Depends on: Tasks 4, 8, 9

This is the 5-step coach wizard for unknown bank formats.

- [ ] **Step 1: Create field-mapping-coach.tsx**

Create `src/components/field-mapping-coach.tsx` — a multi-step Dialog component with 5 steps:

**Step 0: Header Row Selection**
- Read the uploaded file's first 20 rows into a preview table
- Auto-highlight the guessed header row (first row where > 50% cells are non-empty Chinese text)
- Click a row to select it as the header row
- `headerRows = selectedRowIndex`

**Step 1: Column Mapping**
- Display column headers from the selected header row
- For each standard field (date, debit, credit, balance, counterpartyName, summary, etc.):
  - Show a Select dropdown listing all detected column headers
  - User maps field → column
- Required fields: date, at least one of debit/credit

**Step 2: Date Format**
- Show sample values from the mapped date column (first 3 non-empty values)
- Radio buttons: ISO / Excel Serial / Compact / Custom
- If custom: text input for format pattern

**Step 3: Test Verification**
- Build a temporary `BankParserConfig` from the user's selections
- Run `parseWithConfig()` on the file with this config
- Show first 5 parsed rows in a table
- User confirms or goes back

**Step 4: Save**
- Name input for the custom config
- Save to `custom_bank_configs` table via SQLite service
- Close dialog and use the saved config for parsing

Use shadcn/ui Dialog, Table, Select, RadioGroup, Button, Input components. Follow the project's Tailwind styling conventions.

- [ ] **Step 2: Integrate coach into transaction-import.tsx**

In `src/components/transaction-import.tsx`:
1. Import `FieldMappingCoach`
2. Add state: `const [showCoach, setShowCoach] = useState(false);`
3. When user selects "自定义格式" from bank selector, show the coach
4. When coach completes, use the returned config to parse the file

- [ ] **Step 3: Test the coach flow**

Run dev server, upload any Excel file, select "自定义格式", verify the 5-step flow works end-to-end.

- [ ] **Step 4: Commit**

```bash
git add src/components/field-mapping-coach.tsx src/components/transaction-import.tsx
git commit -m "feat: add field mapping coach UI for unknown bank formats"
```

---

## Task 14: Import-Time Binding Integration

**Files:**
- Modify: `src/components/transaction-import.tsx`
- Depends on: Tasks 9, 11

- [ ] **Step 1: Add binding lookup after parsing**

In `src/components/transaction-import.tsx`, in the `saveParsedTransactions` function (or wherever parsed results are saved), add binding lookup logic:

After parsing succeeds and before saving transactions:
1. Extract `ourAccount` from the first transaction or from `bankInfo.accountNumber`
2. Call `useBankAccountStore.getState().findByAccountNumber(accountNumber)`
3. If found: use `binding.subSubjectCode` as the bank subject for this batch
4. If not found: show a Dialog asking "发现新银行账户 [XXXX]，是否立即绑定并生成科目？"
   - "是" → open bank-account-form inline, create binding + subject, then continue
   - "否" → fall back to existing `autoMatchBankSubject()` behavior

- [ ] **Step 2: Test with CCB file**

Upload a CCB file, verify the binding prompt appears for new accounts, verify the fallback works.

- [ ] **Step 3: Commit**

```bash
git add src/components/transaction-import.tsx
git commit -m "feat: integrate bank account binding lookup into import flow"
```

---

## Task 15: End-to-End Testing

**Files:**
- No new files; test with sample files
- Depends on: All previous tasks

- [ ] **Step 1: Test CCB import (regression)**

Upload `银行流水.xls` with bank selector set to "自动检测" or "建设银行". Verify:
- Auto-detection identifies CCB
- Transactions parse correctly
- Account name validation works
- Voucher generation works

- [ ] **Step 2: Test each new bank config**

For each of the 13 new banks, select the bank manually and upload the sample file from `各银行水单格式.xls`. Verify:
- Transactions parse with correct dates
- Debit/credit amounts are correct
- Counterparty info extracted
- No parse errors for valid data rows

- [ ] **Step 3: Test bank account management**

- Navigate to `/settings/bank-accounts`
- Add a new bank account binding
- Verify subject auto-generated under 1002
- Import a file with matching account number → verify binding is used

- [ ] **Step 4: Test coach UI**

- Upload an arbitrary Excel file
- Select "自定义格式"
- Complete all 5 coach steps
- Verify custom config is saved and re-used on next import

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end testing"
```

---

## Task Summary

| # | Task | Files | Dependencies |
|---|------|-------|-------------|
| 1 | Types and Interfaces | types.ts | — |
| 2 | Date Handlers | date-handlers.ts | 1 |
| 3 | Metadata Extractor | meta-extractor.ts | 1 |
| 4 | Universal Parsing Engine | engine.ts | 1, 2, 3 |
| 5 | Bank Auto-Detector | detector.ts | 1, 4 |
| 6 | Bank Configs + Registry | configs/*.ts, bank-registry.ts | 1 |
| 7 | Update parser.ts + ccb-parser.ts | parser.ts, ccb-parser.ts | 1-6 |
| 8 | SQLite Migrations | sqlite-service.ts | 1 |
| 9 | Bank Account Store | useBankAccountStore.ts, stores/index.ts | 1, 8 |
| 10 | Bank Format Selector | bank-format-selector.tsx | 6 |
| 11 | Integrate into Transaction Import | transaction-import.tsx | 7, 10 |
| 12 | Bank Account Settings Page | page.tsx, sidebar.tsx | 9, 10 |
| 13 | Field Mapping Coach UI | field-mapping-coach.tsx | 4, 8, 9 |
| 14 | Import-Time Binding | transaction-import.tsx | 9, 11 |
| 15 | End-to-End Testing | — | All |
