# Invoice Smart Rule Engine v2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade invoice subject matching from single-keyword to a multi-condition rule engine with supplier whitelist, expense category detection, auxiliary accounting offset, fixed asset card generation, and hold area.

**Architecture:** Condition/Action separation model. New standalone engine module (`invoice-rule-engine.ts`) handles matching and action resolution. SQLite stores rules as JSON conditions/actions. Supplier whitelist is the primary classifier (in whitelist → purchase, not in → reimbursement/asset).

**Tech Stack:** Next.js + React + TypeScript + SQLite (sql.js) + Zustand + shadcn/ui + Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-17-invoice-smart-rule-engine-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/invoice-rule-engine.ts` | Core matching engine: condition evaluation, action execution, expense detection, auxiliary resolution |
| `src/components/invoice-smart-rule-dialog.tsx` | 5-tab config dialog (strategy/rules/supplier/expense/asset) |
| `src/components/expense-list-import-dialog.tsx` | Expense reimbursement Excel import dialog |

### Modified Files
| File | Change |
|------|--------|
| `src/types/index.ts` | Add ~10 new interfaces/types, add `holdStatus`/`category` to Invoice |
| `src/lib/database/sqlite-service.ts` | Replace `invoice_subject_rules` table, add 5 new tables, 2 ALTER TABLEs, CRUD methods |
| `src/stores/useInvoiceStore.ts` | Rewrite `generateInvoiceVoucher` to call new engine |
| `src/stores/usePartnerStore.ts` | Add `findByName()` method |
| `src/stores/useFixedAssetStore.ts` | Add `createFromInvoice()` wrapper |
| `src/app/invoices/input/page.tsx` | Replace config dialog, add hold area tab, stats cards |
| `src/app/invoices/output/page.tsx` | Replace config dialog reference |

---

## Phase 1: Types & Database Foundation

### Task 1: Add TypeScript Types

**Files:**
- Modify: `src/types/index.ts` (after line 1071, after `InvoiceSubjectRule`)

- [ ] **Step 1: Add new type definitions after `InvoiceSubjectRule`**

```typescript
// ============================================================
// Invoice Smart Rule Engine v2.0 Types
// ============================================================

// --- Condition Types ---
type ConditionField = 'goodsName' | 'sellerName' | 'notes' | 'totalAmount' | 'taxRate' | 'supplierInList';

type SmartRuleCondition = TextCondition | NumericCondition | SupplierListCondition;

interface TextCondition {
  field: 'goodsName' | 'sellerName' | 'notes';
  operator: 'contains' | 'equals';
  values: string[];
}

interface NumericCondition {
  field: 'totalAmount' | 'taxRate';
  operator: '>' | '<' | '>=' | '<=' | 'equals';
  value: number;
}

interface SupplierListCondition {
  field: 'supplierInList';
  groupName: string;
}

// --- Action Types ---
type SmartRuleAction =
  | OverrideSubjectAction
  | AssignAuxiliaryAction
  | MarkAsAction
  | CreateFixedAssetAction
  | SupplierSubjectAction
  | ReimbursementSubjectAction;

interface OverrideSubjectAction {
  type: 'overrideSubject';
  slot: 'debit' | 'tax' | 'credit';
  subjectCode: string;
  subjectName: string;
}

interface AssignAuxiliaryAction {
  type: 'assignAuxiliary';
  auxiliaryType: 'employee' | 'project';
  nameList: string[];
  sourceField: 'notes' | 'sellerName';
}

interface MarkAsAction {
  type: 'markAs';
  category: 'purchase' | 'reimbursement' | 'fixed_asset';
}

interface CreateFixedAssetAction {
  type: 'createFixedAsset';
  assetCategory: string;
  depreciationYears: number;
  depreciationMethod: DepreciationMethod;
  assetSubjectCode: string;
  depreciationSubjectCode: string;
  expenseSubjectCode: string;
  residualRate: number;
}

interface SupplierSubjectAction {
  type: 'supplierSubject';
  groupName: string;
}

interface ReimbursementSubjectAction {
  type: 'reimbursementSubject';
  creditSubjectCode: string;
  creditSubjectName: string;
}

// --- Rule Type ---
interface InvoiceSmartRule {
  id: string;
  accountSetId: string;
  name: string;
  invoiceType: 'input' | 'output' | 'both';
  priority: number;
  // Note: conditionLogic intentionally omitted — v2.0 is AND-only. Add field when OR is needed.
  conditions: SmartRuleCondition[];
  actions: SmartRuleAction[];
  enabled: boolean;
  createTime: string;
  updateTime: string;
}

// --- Engine Result Types (also exported from invoice-rule-engine.ts) ---
interface AuxiliaryResult {
  debitAuxiliary: string | null;
  creditAuxiliary: string | null;
  debitNeedsPrompt: boolean;
  creditNeedsPrompt: boolean;
  auxiliaryDisabled: boolean;
  docNo: string;                     // 始终 = invoice.invoiceCode
}

interface ReimbursementResult {
  creditOverride: { code: string; name: string } | null;
  reimburserName: string | null;
  partnerCreated: boolean;
}

interface ActionResult {
  subjectOverrides: Record<string, { code: string; name: string }>;
  auxiliaryResult: AuxiliaryResult | null;
  markCategory: 'purchase' | 'reimbursement' | 'fixed_asset' | null;
  fixedAssetCard: Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> | null;
  reimburserName: string | null;
  partnerCreated: boolean;
}

// --- Supporting Types ---
type SupplierType = 'material' | 'inventory' | 'fixed_asset' | 'service' | 'other';

interface SupplierSubjectMapping {
  id: string;
  accountSetId: string;
  groupName: string;
  sellerName: string;
  supplierType: SupplierType;
  defaultDebitSubject?: string;
  defaultDebitSubjectName?: string;
  defaultTaxSubject?: string;
  defaultTaxSubjectName?: string;
  defaultCreditSubject?: string;
  defaultCreditSubjectName?: string;
  createTime: string;
  updateTime: string;
}

interface ExpenseReimbursement {
  id: string;
  accountSetId: string;
  invoiceCode: string;
  reimburserName: string;
  reimburserId?: string;
  notes?: string;
  importBatchId?: string;
  createTime: string;
  updateTime: string;
}

interface ExpenseKeywordCategory {
  id: string;
  accountSetId: string;
  category: string;
  keywords: string[];
  expenseSubjectCode?: string;
  expenseSubjectName?: string;
  isSystem: boolean;
  enabled: boolean;
  createTime: string;
  updateTime: string;
}

interface AuxiliaryStrategyConfig {
  id: string;
  accountSetId: string;
  mode: 'auxiliary' | 'sub_account';
  autoCreatePartner: boolean;
  autoDisableAuxiliaryOnSubAccount: boolean;
  updateTime: string;
}

interface AssetCategoryMapping {
  id: string;
  accountSetId: string;
  keywords: string[];
  assetCategory: string;
  depreciationYears: number;
  depreciationMethod: string;
  subjectCode: string;
  residualRate: number;
  isSystem: boolean;
  createTime: string;
  updateTime: string;
}

// --- Engine Context (passed to executeActions) ---
interface EngineContext {
  invoice: Invoice;
  matchedRule: InvoiceSmartRule | null;
  supplierMappings: SupplierSubjectMapping[];
  expenseReimbursements: ExpenseReimbursement[];
  auxiliaryStrategy: AuxiliaryStrategyConfig | null;
  expenseKeywords: ExpenseKeywordCategory[];
  assetMappings: AssetCategoryMapping[];
  allRules: InvoiceSmartRule[];
}
```

- [ ] **Step 2: Add `holdStatus` and `category` to Invoice interface**

Add these two fields to the Invoice interface (after `updateTime: string;` at line 1030):

```typescript
  holdStatus?: 'normal' | 'on_hold';   // 发票处理状态，默认 normal
  category?: 'purchase' | 'reimbursement' | 'fixed_asset' | null; // 规则引擎分类标签
```

- [ ] **Step 3: Verify types compile**

Run: `cd /d/AI/ai-finance-assistant && npx tsc --noEmit 2>&1 | head -20`
Expected: May have errors from files referencing old types — that's OK, will fix in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add smart rule engine v2.0 type definitions"
```

---

### Task 2: Database Migration & CRUD

**Files:**
- Modify: `src/lib/database/sqlite-service.ts`

- [ ] **Step 1: Add new migration method `migrateSmartRuleEngine`**

Add a new migration method after the existing `migrateCreateBankRulesTable()` method. This method:
1. Drops `invoice_subject_rules` if exists (dev stage)
2. Creates `invoice_smart_rules`, `supplier_subject_mapping`, `expense_reimbursement`, `expense_keyword_categories`, `auxiliary_strategy_config`, `asset_category_mapping` tables
3. ALTERs `invoices` to add `holdStatus` and `category` columns
4. Inserts system presets for `expense_keyword_categories` (5 rows: 交通/餐饮/通讯/住宿/办公)
5. Inserts system presets for `asset_category_mapping` (4 rows: 电子设备/办公家具/装修/运输工具)
6. Inserts default `auxiliary_strategy_config` (mode='auxiliary')

Add the migration call to `ensureInitialized()` after line 135:
```typescript
await this.migrateSmartRuleEngine();
```

Key SQL for table creation (see spec sections 3.1-3.6 for exact schemas).

- [ ] **Step 2: Add CRUD methods for each new table**

Add these methods to `SqliteService` class:

```typescript
// Smart Rules
async getSmartRules(): Promise<InvoiceSmartRule[]>
async saveSmartRule(rule: InvoiceSmartRule): Promise<void>
async deleteSmartRule(id: string): Promise<void>

// Supplier Subject Mapping
async getSupplierMappings(): Promise<SupplierSubjectMapping[]>
async getSupplierMappingsByGroup(groupName: string): Promise<SupplierSubjectMapping[]>
async saveSupplierMapping(mapping: SupplierSubjectMapping): Promise<void>
async deleteSupplierMapping(id: string): Promise<void>

// Expense Reimbursement
async getExpenseReimbursements(): Promise<ExpenseReimbursement[]>
async saveExpenseReimbursement(record: ExpenseReimbursement): Promise<void>
async updateExpenseReimbursement(id: string, updates: Partial<ExpenseReimbursement>): Promise<void>
async deleteExpenseReimbursement(id: string): Promise<void>
async clearExpenseReimbursements(): Promise<void>

// Expense Keyword Categories
async getExpenseKeywordCategories(): Promise<ExpenseKeywordCategory[]>
async saveExpenseKeywordCategory(cat: ExpenseKeywordCategory): Promise<void>
async deleteExpenseKeywordCategory(id: string): Promise<void>

// Auxiliary Strategy
async getAuxiliaryStrategy(): Promise<AuxiliaryStrategyConfig | null>
async saveAuxiliaryStrategy(config: AuxiliaryStrategyConfig): Promise<void>

// Asset Category Mapping
async getAssetCategoryMappings(): Promise<AssetCategoryMapping[]>
async saveAssetCategoryMapping(mapping: AssetCategoryMapping): Promise<void>
async deleteAssetCategoryMapping(id: string): Promise<void>

// Invoice hold/category updates
async updateInvoiceHoldStatus(id: string, holdStatus: 'normal' | 'on_hold'): Promise<void>
async updateInvoiceCategory(id: string, category: string | null): Promise<void>
```

Each method follows the existing pattern: get `accountSetId` from `getCurrentAccountSetId()`, use parameterized SQL, parse JSON columns on read.

- [ ] **Step 3: Remove old `invoice_subject_rules` CRUD methods**

Remove or comment out: `getInvoiceSubjectRules()`, `saveInvoiceSubjectRule()`, `deleteInvoiceSubjectRule()`. The old table is dropped by the migration. Also remove the old table creation from `migrateCreateBankRulesTable()`.

- [ ] **Step 4: Verify database initializes**

Run: `npm run dev` → open app → check console for migration success.

- [ ] **Step 5: Commit**

```bash
git add src/lib/database/sqlite-service.ts
git commit -m "feat(db): add smart rule engine tables, migrations, and CRUD methods"
```

---

## Phase 2: Core Matching Engine

### Task 3: Build the Rule Engine

**Files:**
- Create: `src/lib/invoice-rule-engine.ts`

- [ ] **Step 1: Create engine file with condition evaluation**

Implement `evaluateCondition()` and `evaluateConditions()` per spec section 4.2. Include:
- `FIELD_MAP` constant for field name mapping
- Text condition evaluation (contains/equals)
- Numeric condition evaluation (compare operators)
- Supplier list condition (exact match against mapping group)

- [ ] **Step 2: Implement `matchRule()`**

Per spec section 4.1:
- Filter rules by `invoiceType`
- Sort by `priority DESC, createTime ASC`
- Evaluate conditions (AND logic) for each rule
- Return first matched rule or null

- [ ] **Step 3: Implement action executors**

Implement each action resolver per spec sections 4.3-4.6:
- `resolveSupplierSubject()` — supplier mapping table → slot overrides
- `resolveReimbursement()` — expense list lookup → credit override + partner auto-create. **Important:** Partner interface has no `type` field. Auto-create reimburser with `{ isEmployee: true, isCustomer: false, isSupplier: false, code: 'EMP-' + Date.now(), name: reimburserName }`.
- `buildAssetCard()` — invoice data → FixedAsset object
- `resolveAuxiliaryStrategy()` — strategy config + subject config → auxiliary result. **Important:** `Subject` interface has no `auxiliaryItems` array. Auxiliary capability is determined by boolean flags: `hasAuxiliary(subject)` = `subject.isCustomer || subject.isSupplier || subject.isEmployee || subject.enableDept || subject.enableProject || subject.enableCashFlow`. Implement this as a helper function.
- `detectExpenseCategory()` — keyword library match → ExpenseKeywordCategory
- `generateAssetCode()` — helper: `FA-YYYYMM-NNN` format, query max NNN from DB
- `executeActions()` — see signature in Task 1's `EngineContext` type below

- [ ] **Step 4: Implement `executeActions()`**

Orchestrate all action executors, merge subject overrides with priority:
`reimbursementSubject > supplierSubject > overrideSubject > template default`

Return `ActionResult` with all resolved data.

- [ ] **Step 5: Export `getSlotMap()` and `INPUT_SLOT_MAP`/`OUTPUT_SLOT_MAP`**

Per spec section 4.5, for template entry ID mapping.

- [ ] **Step 6: Commit**

```bash
git add src/lib/invoice-rule-engine.ts
git commit -m "feat(engine): add invoice smart rule matching engine with multi-condition support"
```

---

## Phase 3: Store Integration

### Task 4: Update useInvoiceStore

**Files:**
- Modify: `src/stores/useInvoiceStore.ts`

- [ ] **Step 1: Rewrite `generateInvoiceVoucher` to use new engine**

Replace the current matching logic (lines ~449-478) with calls to the new engine:
1. Load all context: `getSmartRules()`, `getSupplierMappings()`, `getExpenseReimbursements()`, `getAuxiliaryStrategy()`, `getExpenseKeywordCategories()`
2. Call `matchRule(invoice, rules, supplierMappings)`
3. Call `detectExpenseCategory(invoice, expenseKeywords)`
4. If matched, call `executeActions()` with full context
5. Apply `subjectOverrides` to template engine call
6. Handle `fixedAssetCard` → `fixedAssetStore.addAsset()`
7. Handle `markCategory` → `sqliteService.updateInvoiceCategory()`
8. Set `docNo` on voucher entries to `invoice.invoiceCode`
9. Keep existing fallback to default subjects when no rule matches

- [ ] **Step 2: Remove old `InvoiceSubjectRule` references**

Remove imports and usage of old `getInvoiceSubjectRules()` method from this store. The old method remains in sqlite-service for backward compat but is no longer called.

- [ ] **Step 3: Commit**

```bash
git add src/stores/useInvoiceStore.ts
git commit -m "feat(invoice): integrate smart rule engine into voucher generation"
```

### Task 5: Add Partner and FixedAsset Store Methods

**Files:**
- Modify: `src/stores/usePartnerStore.ts`
- Modify: `src/stores/useFixedAssetStore.ts`

- [ ] **Step 1: Add `findByName` to PartnerStore**

```typescript
findByName: (name: string): Partner | undefined => {
  return get().partners.find(p => p.name === name);
},
```

Also change `addPartner` return type from `Promise<void>` to `Promise<Partner>` — make it return the newly created partner object (needed by engine for partner auto-creation flow). The engine does: `addPartner(...) → returns Partner → uses partner.id`.

Note: Partner interface uses `isEmployee: boolean` (not `type: 'individual'`). Engine should set `isEmployee: true, isCustomer: false, isSupplier: false` when auto-creating reimburser cards. The `code` field is required and must be unique — engine should generate `code: 'EMP-' + Date.now()`.

- [ ] **Step 2: Add `createFromInvoice` to FixedAssetStore**

Convenience wrapper that takes a `Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'>` from `buildAssetCard()` and calls `addAsset()`.

- [ ] **Step 3: Commit**

```bash
git add src/stores/usePartnerStore.ts src/stores/useFixedAssetStore.ts
git commit -m "feat(stores): add findByName and createFromInvoice helpers"
```

---

## Phase 4: UI — Config Dialog & Expense Import

### Task 6: Build InvoiceSmartRuleDialog (Tab 0-1)

**Files:**
- Create: `src/components/invoice-smart-rule-dialog.tsx`

This is the largest UI task. Build it incrementally.

- [ ] **Step 1: Create dialog shell with 5-tab layout**

```tsx
<Tabs defaultValue="strategy">
  <TabsList>
    <TabsTrigger value="strategy">辅助核算策略</TabsTrigger>
    <TabsTrigger value="rules">规则配置</TabsTrigger>
    <TabsTrigger value="suppliers">供应商映射</TabsTrigger>
    <TabsTrigger value="expenses">费用清单</TabsTrigger>
    <TabsTrigger value="assets">资产类别</TabsTrigger>
  </TabsList>
  {/* Tab content panels */}
</Tabs>
```

- [ ] **Step 2: Implement Tab 0 — 辅助核算策略**

- Radio group: 辅助核算 vs 科目明细化
- Checkboxes: auto-create partner, auto-disable auxiliary on sub-account
- 核算对象偏移规则 reference table (read-only, shows mapping logic):
  - 采购/原材料 → 供应商在白名单中 → 销方
  - 报销/差旅 → 类别:餐饮/交通/通讯 → 报销人
  - 资产/设备 → 金额>5000+关键词 → 资产卡片
- Expense keyword categories table (editable, system rows with purple badge)
- Save to `auxiliary_strategy_config` table

- [ ] **Step 3: Implement Tab 1 — 规则配置**

- Rule list with priority badges and enable/disable toggles
- Add/edit form with:
  - Basic info: name, invoiceType select, priority number
  - Conditions: dynamic rows with field/operator/values inputs
  - Actions: dynamic rows with type-specific configuration
- Inline drawer editing per CLAUDE.md UI conventions

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice-smart-rule-dialog.tsx
git commit -m "feat(ui): add smart rule config dialog with strategy and rules tabs"
```

### Task 7: Build Expense List Import Dialog

**Files:**
- Create: `src/components/expense-list-import-dialog.tsx`

**Depends on:** Task 2 (expense_reimbursement table must exist in DB)

- [ ] **Step 1: Create import dialog component**

- File picker accepting `.xlsx`, `.xls`
- Parse Excel: expect columns "发票号码", "报销人", "备注"
- Preview table with match status (check if invoice exists in DB)
- Confirm button → batch insert into `expense_reimbursement` table
- Dedup by invoice code (overwrite existing)

- [ ] **Step 2: Commit**

```bash
git add src/components/expense-list-import-dialog.tsx
git commit -m "feat(ui): add expense list Excel import dialog"
```

### Task 8: Build InvoiceSmartRuleDialog (Tab 2-4)

**Files:**
- Modify: `src/components/invoice-smart-rule-dialog.tsx`

**Depends on:** Task 7 (expense-list-import-dialog used by Tab 3)

- [ ] **Step 1: Implement Tab 2 — 供应商映射**

- Group selector dropdown + "新建组" button
- Table: supplier name + type dropdown + 3 subject slots
- Type dropdown auto-fills default subjects
- Add supplier row + batch import button

- [ ] **Step 2: Implement Tab 3 — 费用清单**

- Import button → opens `ExpenseListImportDialog` from Task 7
- Download template button
- List of imported records with match status
- Clear all button

- [ ] **Step 3: Implement Tab 4 — 资产类别映射**

- Table: category + depreciation years + method + keywords
- System preset rows with purple badge (not deletable, editable years)
- User rows with blue badge (deletable)
- Add row button

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice-smart-rule-dialog.tsx
git commit -m "feat(ui): add supplier mapping, expense list, and asset category tabs"
```

---

## Phase 5: UI — Invoice List Integration

### Task 9: Update Input Invoice Page

**Files:**
- Modify: `src/app/invoices/input/page.tsx`

- [ ] **Step 1: Replace config dialog import**

Change `InvoiceSubjectConfigDialog` → `InvoiceSmartRuleDialog` in imports and JSX.

- [ ] **Step 2: Add hold area tab**

Replace the current flat list with tabbed view:
- Tab "全部发票" — all invoices
- Tab "待生成凭证" — `holdStatus='normal'` and no `voucherId`
- Tab "已生成凭证" — has `voucherId`
- Tab "暂不入账" — `holdStatus='on_hold'`

Filter logic adjusts query based on active tab.

- [ ] **Step 3: Update stats cards**

Replace 6 summary cards with 4 status-grouped cards per spec section 5.2:
- 已入账 (voucherId exists)
- 待生成凭证 (normal, no voucher)
- 暂不入账 (on_hold, separate)
- 本月合计 (all)

- [ ] **Step 4: Add hold/restore action buttons**

- "暂不入账" button on selected invoices → `updateInvoiceHoldStatus(id, 'on_hold')`
- "恢复到待选" button in hold tab → `updateInvoiceHoldStatus(id, 'normal')`
- "费用清单" button to open expense import

- [ ] **Step 5: Verify everything works**

Run: `npm run dev` → open input invoices page → test tabs, stats, hold/restore.

- [ ] **Step 6: Commit**

```bash
git add src/app/invoices/input/page.tsx
git commit -m "feat(invoices): add hold area tabs, status stats, and smart rule dialog to input page"
```

### Task 10: Update Output Invoice Page

**Files:**
- Modify: `src/app/invoices/output/page.tsx`

- [ ] **Step 1: Replace config dialog import**

Same as Task 9 Step 1 — swap `InvoiceSubjectConfigDialog` for `InvoiceSmartRuleDialog`.

- [ ] **Step 2: Commit**

```bash
git add src/app/invoices/output/page.tsx
git commit -m "feat(invoices): replace config dialog in output invoice page"
```

---

## Phase 6: Cleanup & Verification

### Task 11: End-to-End Verification

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Manual test flow**

1. Open app → Settings → Configure smart rules (Tab 0-4)
2. Import input invoices with mixed types (supplier whitelist + unknown sellers)
3. Import expense list (Excel with reimburser + invoice code)
4. Generate vouchers → verify subject overrides, auxiliary accounting, docNo
5. Test hold area: mark invoices as on_hold, verify they disappear from voucher list
6. Restore hold invoices, generate vouchers
7. Check fixed asset cards auto-created for asset-type invoices

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup and verification for smart rule engine v2.0"
```
