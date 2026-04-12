# Multi-Bank Statement Parser Design

Date: 2026-04-12
Status: Approved

## Overview

Expand bank statement import to support 14 banks (currently only CCB). The system uses a configuration-driven parser engine where each bank is defined by a JSON config, with plugin handlers for date formats and metadata extraction. Includes a bank account management module, auto-detection, and a field-mapping coach UI for unknown formats.

## Supported Banks (14 total)

| # | Bank | ID | Header Rows | Data Columns | Date Format | Notes |
|---|------|----|-------------|-------------|-------------|-------|
| 1 | 建设银行 CCB | ccb | 9 | 17 | ISO | Existing |
| 2 | 工商银行 ICBC | icbc | 5 | 10 | Excel serial | Serial number dates |
| 3 | 农业银行 ABC | abc | 3 | 8 | ISO datetime | Compact |
| 4 | 招商银行 CMB | cmb | 9 | 36 | ISO + time split | Most columns |
| 5 | 中国银行 BOC | boc | 9 | 38 | Compact (20240102) | Bilingual headers |
| 6 | 中信银行 CITIC | citic | 14 | 22 | ISO | Most header rows |
| 7 | 交通银行 BOCOM | bocom | 2 | 7 | ISO datetime | Very compact |
| 8 | 兴业银行 Industrial | industrial | 1 | 19 | ISO | Fewest header rows |
| 9 | 浙商银行 CZB | czb | 5 | 12 | Custom (yyyy-MM-dd-HHmm) | Special date format |
| 10 | 浦发银行 SPDB | spdb | 5 | 16 | Compact (20260305) + compact time (113807) | Separate compact date+time |
| 11 | 民生银行 CMBC | cmbc | 18 | 10 | ISO datetime | Most header rows |
| 12 | 平安银行 Ping An | pingan | 1 | 20 | ISO datetime | No header rows |
| 13 | 华夏银行 Huaxia | huaxia | 8 | 15 | ISO + time split | Date/time separated |
| 14 | 上海银行 Shanghai | shanghai | 6 | 12 | ISO | — |

## Architecture: Configuration-Driven Parser Engine

### Core Principle

Each bank = one configuration object + shared engine. Adding a new bank requires only a config file, zero code changes to the engine.

### File Structure

```
src/lib/bank-parsers/
├── types.ts                    # Type definitions
├── engine.ts                   # Universal parsing engine
├── detector.ts                 # Auto bank identification
├── date-handlers.ts            # Date format plugins (4 types)
├── meta-extractor.ts           # Header metadata extractor
├── bank-registry.ts            # Bank registry (built-in + custom configs)
├── configs/
│   ├── ccb.ts                  # CCB (migrated from ccb-parser.ts)
│   ├── icbc.ts                 # ICBC
│   ├── abc.ts                  # ABC
│   ├── cmb.ts                  # CMB
│   ├── boc.ts                  # BOC
│   ├── citic.ts                # CITIC
│   ├── bocom.ts                # BOCOM
│   ├── industrial.ts           # Industrial Bank
│   ├── czb.ts                  # CZB
│   ├── spdb.ts                 # SPDB
│   ├── cmbc.ts                 # CMBC
│   ├── pingan.ts               # Ping An
│   ├── huaxia.ts               # Huaxia
│   └── shanghai.ts             # Shanghai Bank
└── ccb-parser.ts               # Kept as compat layer, delegates to engine
```

## Module 1: Parser Configuration Schema

### Row Indexing Convention (CRITICAL)

**Row indexing is 0-based throughout.** The convention is:

- Rows `0` through `headerRows - 1` are **metadata rows** (account info, query params, etc.)
- Row at index `headerRows` is the **column header row** (contains column names like "日期", "借方发生额", etc.)
- Data rows start at index `headerRows + 1`

For example, CCB with `headerRows: 9` means rows 0-8 are metadata, row 9 is column headers, row 10+ is data.

**Exception**: When `headerRows: 0`, the first row (row 0) is both the column header row and the first row of interest. Row 1+ is data. This applies to banks like Industrial (兴业) and Ping An (平安) where the first row IS column headers.

### Config Schema

```typescript
interface BankParserConfig {
  id: string;                  // 'icbc' | 'abc' | 'ccb' | ...
  name: string;                // Display name (e.g. '工商银行')
  headerRows: number;          // Number of metadata rows before the column header row.
                               // Column header row = raw[headerRows].
                               // Data starts at raw[headerRows + 1].
                               // Use 0 when first row IS column headers.

  // Column mapping: Chinese keywords → standard fields
  // Keywords use substring matching: "借方发生额（支出）" matches keyword "借方发生额"
  columnMapping: {
    date?: string[];           // ['日期', '交易日期', '交易日', '记账日期']
    time?: string[];           // ['交易时间'] (if date and time are in separate columns)
    debit?: string[];          // ['借方发生额', '借方金额', '支出金额', '借方(支出)金额']
    credit?: string[];         // ['贷方发生额', '贷方金额', '收入金额', '贷方(收入)金额']
    balance?: string[];        // ['余额', '账户余额', '账户余额', '交易后余额']
    counterpartyName?: string[];  // ['对方户名', '对方名称', '对手名称', '收(付)方名称', '对方账户名称']
    counterpartyAccount?: string[]; // ['对方账号', '对手账号', '收(付)方账号', '对方账号名称']
    summary?: string[];        // ['摘要']
    notes?: string[];          // ['备注', '附言', '用途', '交易附言', '用途/附言']
    transactionSerialNo?: string[]; // ['流水号', '交易流水号', '银行流水号', '核心流水号', '唯一流水编号']
    enterpriseSerialNo?: string[]; // ['企业流水号', '企业序列号', '发起方流水号']
    voucherNo?: string[];      // ['凭证号', '凭证号码']
    voucherType?: string[];    // ['凭证种类', '凭证类型', '凭证代号']
    cashRemitFlag?: string[];  // ['钞汇标识', '现/转']
    ourAccount?: string[];     // ['账号'] (if present in data columns, not just header)
    ourAccountName?: string[]; // ['账号名称', '账户名称', '户名']
    ourBranch?: string[];      // ['开户行', '开户网点']
  };

  // Date handling strategy
  // All handlers normalize output to: date = 'YYYY-MM-DD', time = 'HH:mm:ss' (optional)
  dateFormat: 'iso' | 'excel_serial' | 'compact' | 'custom';
  dateFormatCustom?: string;   // Pattern for custom (e.g. 'yyyy-MM-dd-HHmm')
  hasSeparatedTime?: boolean;  // True if date and time are in separate columns (CMB, Huaxia)

  // Which Excel sheet to read (default: 0 = first sheet)
  sheetIndex?: number;

  // Metadata extraction from header rows (rows 0 to headerRows-1)
  // These populate BankAccountInfo in the parse result
  metaExtract?: Array<{
    row: number;               // Row index (0-based, within the metadata rows)
    col?: number;              // Column index. If omitted, auto-detect by scanning row for keyword
    keyword?: string;          // When col is omitted, scan all cells in this row for a cell
                               // containing this keyword, then use the NEXT cell's value.
                               // E.g. row 2 has ["账号:", "6222...1234"] at cols 0,1:
                               //   keyword '账号' finds col 0, returns value at col 1.
    field: keyof BankAccountInfo; // Target field in BankAccountInfo
  }>;

  // Auto-detection features
  identifiers: {
    sheetKeywords?: string[];  // Keywords to search for in sheet name or title rows
    columnKeywords?: string[]; // Characteristic column names unique to this bank
    minColumns?: number;       // Minimum column count (for disambiguation)
    maxColumns?: number;       // Maximum column count
  };
}
```

### Config Example: CCB (建设银行) — Reference Implementation

This config replicates the existing `ccb-parser.ts` behavior. **Note**: The existing parser uses hardcoded column indices and treats row 9 as the first data row (skipping column header detection). The new engine will read row 9 as column headers and use keyword-based column mapping. The actual column header row in CCB exports is at index 9.

```typescript
export const ccbConfig: BankParserConfig = {
  id: 'ccb',
  name: '建设银行',
  headerRows: 9,  // Rows 0-8 metadata, row 9 = column headers, row 10+ = data
  columnMapping: {
    date: ['日期'],
    time: ['交易时间'],
    voucherType: ['凭证类型'],
    voucherNo: ['凭证号'],
    debit: ['借方发生额'],
    credit: ['贷方发生额'],
    balance: ['余额'],
    cashRemitFlag: ['钞汇标识'],
    counterpartyName: ['对方户名'],
    counterpartyAccount: ['对方账号'],
    summary: ['摘要'],
    notes: ['备注'],
    transactionSerialNo: ['交易流水号'],
    enterpriseSerialNo: ['企业流水号'],
    ourAccount: ['本方账号'],
    ourAccountName: ['本方户名'],
    ourBranch: ['本方网点'],
  },
  dateFormat: 'iso',
  hasSeparatedTime: true,
  metaExtract: [
    { row: 3, col: 1, field: 'bankName' },      // Row 3, col 1 = bank name
    { row: 3, col: 1, field: 'branch' },        // Row 3, col 1 = branch (same cell as bankName)
    { row: 3, col: 3, field: 'currency' },       // Row 3, col 3 = currency
    { row: 4, col: 1, field: 'accountNumber' },  // Row 4, col 1 = account number
    { row: 5, col: 1, field: 'accountName' },    // Row 5, col 1 = account name
  ],
  identifiers: {
    sheetKeywords: ['建设银行', 'CCB'],
    columnKeywords: ['钞汇标识', '本方账号', '本方户名'],
    minColumns: 15,
    maxColumns: 20,
  },
};
```

### Config Example: ICBC (工商银行)

```typescript
export const icbcConfig: BankParserConfig = {
  id: 'icbc',
  name: '工商银行',
  headerRows: 5,  // Rows 0-4 metadata, row 5 = column headers, row 6+ = data
  columnMapping: {
    date: ['日期'],
    voucherType: ['凭证种类'],
    voucherNo: ['凭证号'],
    counterpartyName: ['对方户名'],
    counterpartyAccount: ['对方账号'],
    summary: ['摘要'],
    debit: ['借方发生额'],
    credit: ['贷方发生额'],
    balance: ['余额'],
  },
  dateFormat: 'excel_serial',  // Dates stored as Excel serial numbers (e.g. 45292)
  metaExtract: [
    { row: 1, keyword: '账号', field: 'accountNumber' },
    { row: 2, keyword: '户名', field: 'accountName' },
    { row: 1, keyword: '币种', field: 'currency' },
  ],
  identifiers: {
    sheetKeywords: ['工商银行', 'ICBC'],
    columnKeywords: ['网点号', '凭证种类'],
    minColumns: 10,
    maxColumns: 12,
  },
};
```

### Config Example: SPDB (浦发银行)

```typescript
export const spdbConfig: BankParserConfig = {
  id: 'spdb',
  name: '浦发银行',
  headerRows: 5,  // Rows 0-4 metadata, row 5 = column headers
  columnMapping: {
    date: ['交易日期'],     // Compact format: 20260305
    time: ['交易时间'],     // Compact format: 113807
    voucherNo: ['凭证号'],
    debit: ['借方金额'],
    credit: ['贷方金额'],
    balance: ['余额'],
    counterpartyAccount: ['对方账号'],
    counterpartyName: ['对方户名'],
    ourBranch: ['对方行名'],
    transactionSerialNo: ['交易流水号'],
    summary: ['摘要'],
    notes: ['交易附言'],
  },
  dateFormat: 'compact',       // 20260305 → 2026-03-05
  hasSeparatedTime: true,       // Time in separate column: 113807 → 11:38:07
  metaExtract: [
    { row: 1, keyword: '账号', field: 'accountNumber' },
    { row: 2, keyword: '账户名称', field: 'accountName' },
  ],
  identifiers: {
    sheetKeywords: ['浦发', 'SPDB'],
    columnKeywords: ['传票序号', '记录状态', '客户账户类型'],
    minColumns: 14,
    maxColumns: 18,
  },
};
```

## Module 2: Universal Parsing Engine

### Flow

```
1. Read Excel file → raw[][]  (XLSX.utils.sheet_to_json with header:1)
   - Default: read first sheet (workbook.Sheets[workbook.SheetNames[0]])
   - Config can specify sheetIndex for banks using non-default sheets
2. Extract column headers from raw[headerRows] (the header row)
   - If headerRows == 0, row 0 is the column header row
   - If headerRows == 9, row 9 is the column header row (rows 0-8 are metadata)
3. Match column header text against columnMapping keywords → build colIndex map
4. For each data row (raw[headerRows + 1] through raw[end]):
   a. Skip empty rows
   b. Extract raw values by colIndex
   c. DateHandler: normalize date to 'YYYY-MM-DD', time to 'HH:mm:ss'
   d. Clean amounts (strip commas, handle '--' and empty → undefined)
   e. Build BankTransaction object (date = 'YYYY-MM-DD', transactionTime = 'HH:mm:ss')
5. MetaExtractor: extract BankAccountInfo from header rows (0 to headerRows-1)
   - This populates the BankAccountInfo used for account name validation and binding lookup
6. Return BankStatementParseResult
```

### Column Matching Algorithm

Use fuzzy keyword matching: for each standard field (date, debit, etc.), iterate column headers and check if any configured keyword is a substring of the column header text. This handles variations like "借方发生额（支出）" matching keyword "借方发生额".

```typescript
function matchColumns(headers: string[], mapping: ColumnMapping): Map<string, number> {
  const result = new Map();
  for (const [field, keywords] of Object.entries(mapping)) {
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).trim();
      if (keywords.some(kw => header.includes(kw))) {
        result.set(field, i);
        break;
      }
    }
  }
  return result;
}
```

## Module 3: Date Handling Plugins

**Canonical output format**: All handlers normalize to `date: 'YYYY-MM-DD'` and `time: 'HH:mm:ss'`. These map directly to `BankTransaction.date` and `BankTransaction.transactionTime`.

| Handler | Format | Banks | Implementation |
|---------|--------|-------|----------------|
| `ISODateHandler` | `2024-01-26`, `2024-01-26 16:30:12` | ABC, CITIC, CMBC, Ping An, Industrial, CCB, Shanghai | Parse as ISO string |
| `ExcelSerialHandler` | `45292` (numeric) | ICBC | `new Date((serial - 25569) * 86400000)` |
| `CompactDateHandler` | `20240102` | BOC, SPDB | Regex `/(\d{4})(\d{2})(\d{2})/` → `YYYY-MM-DD` |
| `CompactTimeHandler` | `113807` | SPDB | Regex `/(\d{2})(\d{2})(\d{2})/` → `HH:mm:ss` (used with `hasSeparatedTime: true`) |
| `CustomFormatHandler` | `2024-01-26-13:43` | CZB | Pattern-based parsing (replace last `-` with space, parse as ISO) |

### Plugin Interface

```typescript
interface DateHandler {
  parse(raw: any, timeRaw?: any): { date: string; time?: string };
  // Returns: { date: 'YYYY-MM-DD', time: 'HH:mm:ss' | undefined }
}
```

### Behavior for Separated Time Columns

For banks with `hasSeparatedTime: true` (CMB, Huaxia, SPDB, CCB):
- The engine detects `time` in columnMapping and extracts the time value
- `timeRaw` is passed to the DateHandler
- The handler formats `timeRaw` using the appropriate strategy:
  - ISO time string (e.g. `07:58:57`): pass through
  - Compact time (e.g. `113807`): parse via CompactTimeHandler

## Module 4: Bank Auto-Detection

### Detection Strategy

When a file is uploaded, before user selects a bank:

1. Read first 20 rows of the Excel file
2. For each registered bank config:
   - Check `sheetKeywords` against all read cell values
   - Check `columnKeywords` against the detected header row
   - Check column count falls within `minColumns`..`maxColumns`
   - Score: keyword match = +2 per keyword, column match = +3 per keyword, column count match = +1
3. Sort by score
   - If top score >= 5 and leads second by >= 2: auto-select (high confidence)
   - If top score >= 5 but tied with others: show top 3 as suggestions
   - If top score < 5: no auto-detection, user must select manually

### Usage in UI

- Auto-detection result pre-fills the bank selector
- User can always override manually
- Detection runs on file upload, not on every render

## Module 5: Bank Account Management

### Relationship: BankAccountInfo vs BankAccountBinding

These are two separate types with distinct roles:

- **`BankAccountInfo`** (existing, in `types/index.ts`): Parse result metadata — what we extracted from the Excel file headers. Fields: `bankName`, `accountName`, `accountNumber`, `branch?`, `currency?`. This is an output of the parsing engine.
- **`BankAccountBinding`** (new): Account management record — the user's configured mapping between a bank account and a ledger subject. Contains all `BankAccountInfo` fields PLUS `subSubjectCode`, `aliasName`, `bankId`, etc.

**Flow**: Parser produces `BankAccountInfo` → system looks up matching `BankAccountBinding` by `accountNumber` → found = use its `subSubjectCode` / not found = prompt user to create binding.

### Data Model

```typescript
interface BankAccountBinding {
  id: string;
  accountSetId: string;
  accountNumber: string;      // Bank account number (unique identifier)
  bankId: string;             // Parser ID (e.g. 'icbc')
  bankName: string;           // Display name (e.g. '工商银行')
  aliasName?: string;         // User-defined alias (e.g. '工行工资专户')
  subSubjectCode: string;     // Auto-generated sub-account code (e.g. '100201')
  subSubjectName: string;     // Account name (e.g. '银行存款-工商银行(1234)')
  branch?: string;            // Branch name
  currency?: string;          // Currency
  isDefault?: boolean;        // Default account flag
  createdAt: string;
}
```

### SQLite Table

```sql
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
```

### Auto Subject Generation

When adding a new bank account:
1. Scan existing subjects under 1002 (银行存款)
2. Find the next available code (100201 → 100202 → ...)
3. Create subject with name: `银行存款 - [银行名] ([尾号4位])`
4. Save both the subject and the binding

### Import-Time Binding Flow

```
Parse complete → extract ourAccount from parsed data
    ↓
Query bank_account_bindings by accountNumber
    ├─ Found → use subSubjectCode for this import batch
    └─ Not found → prompt: "发现新银行账户 XXXX，是否立即绑定并生成科目？"
        ├─ Yes → create binding + subject → continue
        └─ No → use existing autoMatchBankSubject() fallback
```

### UI: Settings Page

New page at `settings/bank-accounts/` with:
- Bank account list (table with bank name, account number, subject code, alias)
- Add button → form: select bank (from 14 options), enter account number, alias
- Edit/delete buttons
- Default account toggle

### Store: useBankAccountStore

```typescript
interface BankAccountStore {
  bindings: BankAccountBinding[];
  loadBindings: () => Promise<void>;
  addBinding: (data: Omit<BankAccountBinding, 'id' | 'createdAt'>) => Promise<BankAccountBinding>;
  updateBinding: (id: string, data: Partial<BankAccountBinding>) => Promise<void>;
  deleteBinding: (id: string) => Promise<void>;
  findByAccountNumber: (accountNumber: string) => BankAccountBinding | undefined;
  getNextSubSubjectCode: () => Promise<string>;
}
```

### Migration from Existing autoMatchBankSubject()

The existing `autoMatchBankSubject()` in `transaction-import.tsx` auto-creates 1002 sub-subjects based on `bankAccountNumber`. The new `BankAccountBinding` system replaces this with explicit bindings.

**Migration strategy**:
1. The `bank_account_bindings` table starts empty on upgrade
2. On first import after upgrade, the binding lookup will miss → user is prompted to bind
3. If user declines binding, `autoMatchBankSubject()` continues to work as fallback
4. Over time, as users import and bind, the bindings table fills up
5. No forced migration scan needed — the system is backward-compatible

**Deprecated path**: Once all active bank accounts are bound, `autoMatchBankSubject()` can be fully removed in a future version.

## Module 6: Field Mapping Coach UI

### Trigger Conditions

- User selects "自定义格式" from bank selector
- Auto-parse fails (column matching failure, date format unrecognized)
- Bank has updated export format

### Five-Step Flow

**Step 0: Header Row Detection**
- Display the first 20 rows of the Excel file in a preview table
- Highlight the row that the system guesses is the column header row (heuristic: first row where > 50% of cells are non-empty and look like column names)
- User can adjust by clicking a row to select it as the column header row
- System derives `headerRows` from the user's selection (headerRows = selected row index)
- Data rows start after the selected row

**Step 1: Column Identification**
- Display the detected column headers from the selected header row (highlighted)
- For each standard field (date, debit, credit, summary, etc.), show a dropdown
- Each dropdown lists all detected column headers
- User assigns: "this column is date, this column is debit..."

**Step 2: Date Format Confirmation**
- Show sample values from the date column (first 3 values)
- User selects format type: ISO / Compact / Excel Serial / Custom
- If custom, enter a format pattern

**Step 3: Test Verification**
- Parse first 5 rows using the user's mapping
- Display results in a preview table
- User confirms or goes back to adjust

**Step 4: Save Rule**
- Save as custom bank config to SQLite `custom_bank_configs` table
- Associated with accountSetId for isolation
- Next import of same format auto-uses this config

### Custom Config Storage

```sql
CREATE TABLE IF NOT EXISTS custom_bank_configs (
  id TEXT PRIMARY KEY,
  accountSetId TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,  -- JSON-serialized BankParserConfig
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

## Integration Points

### Modified Files

1. **`src/lib/parser.ts`** — `parseBankStatement()` accepts bank ID parameter, delegates to engine
2. **`src/lib/database/sqlite-service.ts`** — Add migration for 2 new tables
3. **`src/components/transaction-import.tsx`** — Add BankFormatSelector, integrate new engine
4. **`src/lib/bank-parsers/ccb-parser.ts`** — Refactor as compat wrapper (delegates to engine with CCB config)
5. **Sidebar navigation** — Add "银行账户" menu item under settings section (in `src/components/layout/sidebar.tsx` or equivalent navigation component)

### New Files

1. **`src/lib/bank-parsers/types.ts`** — Type definitions (BankParserConfig, DateHandler, etc.)
2. **`src/lib/bank-parsers/engine.ts`** — Universal parser engine
3. **`src/lib/bank-parsers/detector.ts`** — Bank auto-detector
4. **`src/lib/bank-parsers/date-handlers.ts`** — Date format plugins (5 handlers)
5. **`src/lib/bank-parsers/meta-extractor.ts`** — Metadata extractor
6. **`src/lib/bank-parsers/bank-registry.ts`** — Registry + config loader
7. **14 config files** in `src/lib/bank-parsers/configs/`
8. **`src/stores/useBankAccountStore.ts`** — Bank account binding store
9. **`src/app/settings/bank-accounts/page.tsx`** — Bank account management page
10. **`src/components/bank-format-selector.tsx`** — Bank format selector (NOT bank-account-selector which already exists for choosing 1002 sub-account). This is for choosing which bank format to parse.
11. **`src/components/bank-account-form.tsx`** — Bank account form component
12. **`src/components/field-mapping-coach.tsx`** — Field mapping coach (5 steps)

### Naming Clarification

- **`bank-account-selector.tsx`** (existing): Selects which 1002 sub-account to post vouchers to. **No changes needed** — this continues to work as-is.
- **`bank-format-selector.tsx`** (new): Selects which bank's format to parse the uploaded file with. This is the new component for the import flow.

## Data Flow (End-to-End)

```
User uploads Excel
    ↓
[BankSelector] User selects bank / auto-detect pre-fills
    ↓
[Detector] Scan file features, verify selection
    ↓
[BankRegistry] Load config (built-in or custom from DB)
    ↓
[Engine] Parse with config:
    ├─ [MetaExtractor] Extract BankAccountInfo from header rows
    ├─ [ColumnMatcher] Match column headers to standard fields
    ├─ [DateHandler] Normalize dates
    └─ Build BankTransaction[]
    ↓
→ BankStatementParseResult
    ↓
[BankAccountBinding] Query by accountNumber
    ├─ Bound → use subSubjectCode
    └─ Unbound → prompt "New bank account found, bind now?"
    ↓
Existing flow: deduplicate → save → AI match → generate vouchers
```

## Error Handling

1. **Column match failure**: If < 3 required columns (date + debit/credit) matched, fall back to Coach UI
2. **Date parse failure**: Try all date handlers sequentially; if all fail, prompt user
3. **Empty file**: Show toast error "文件无数据"
4. **Unknown bank**: Show bank selector with "自定义格式" option
5. **Account name mismatch**: Existing validation continues to work (compare parsed accountName with company name)

## Testing Strategy

1. Each bank config tested with the provided sample files
2. Unit tests for each date handler
3. Integration test: full parse flow for each bank
4. Coach UI: test save/load custom configs
5. Bank account binding: test auto subject generation
