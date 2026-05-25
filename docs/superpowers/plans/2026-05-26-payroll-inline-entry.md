# 工资明细行内录入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有薪酬管理页面中增加工资明细行内新增、编辑和删除能力，保存后自动计算，并对已确认批次保持锁定。

**Architecture:** 复用现有 `PayrollInput`、`calculatePayrollItem`、`summarizePayrollResults` 及 `savePayrollBatch` 整批持久化机制，不修改 SQLite 表结构。`usePayrollStore` 负责可修改状态校验、重复工号校验、手工批次创建和整批重算，页面只负责行内表单的编辑状态和展示。

**Tech Stack:** Next.js App Router, React, TypeScript, Zustand, sql.js/SQLite, shadcn/ui, lucide-react, Playwright

---

## 文件结构

### 修改文件

- `src/stores/usePayrollStore.ts` - 增加手工新增、更新和删除明细动作，并统一处理批次重算和锁定。
- `src/app/payroll/page.tsx` - 增加行内编辑表格、编辑状态、单元格输入和操作按钮。
- `test-payroll-store-contract.ts` - 检查新增动作接口和锁定逻辑存在。
- `test-payroll-monthly-integration.ts` - 检查页面存在行内新增/编辑入口和锁定提示。

### 新建文件

- `test-payroll-inline-entry.ts` - 验证明细输入校验、重复工号判断和空白录入值构造的纯逻辑。

## Task 1: 提取行内录入的输入校验逻辑

**Files:**
- Modify: `src/lib/payroll.ts`
- Create: `test-payroll-inline-entry.ts`

- [ ] **Step 1: 写入失败测试**

在 `test-payroll-inline-entry.ts` 编写行内录入所需的纯函数合同：

```typescript
import assert from 'node:assert/strict';
import {
  createBlankPayrollInput,
  validatePayrollInput,
  type PayrollInput,
} from './src/lib/payroll';

const blank = createBlankPayrollInput();
assert.equal(blank.basicSalary, 0);
assert.equal(blank.employeeCode, '');

const invalid = validatePayrollInput({ ...blank, employeeCode: '', employeeName: '', basicSalary: -1 }, []);
assert.match(invalid.join(' '), /工号/);
assert.match(invalid.join(' '), /姓名/);
assert.match(invalid.join(' '), /非负数/);

const valid: PayrollInput = { ...blank, employeeCode: 'E001', employeeName: '张三', basicSalary: 10000 };
assert.deepEqual(validatePayrollInput(valid, []), []);
assert.match(validatePayrollInput({ ...valid, employeeName: '李四' }, ['E001']).join(' '), /重复/);
console.log('payroll inline entry validation tests passed');
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
if (Test-Path tmp\test-inline) { Remove-Item -Recurse -Force tmp\test-inline }; npx.cmd tsc test-payroll-inline-entry.ts --outDir tmp\test-inline --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
```

Expected: FAIL，提示 `createBlankPayrollInput` 或 `validatePayrollInput` 未导出。

- [ ] **Step 3: 实现最小纯函数**

在 `src/lib/payroll.ts` 中增加：

```typescript
export function createBlankPayrollInput(): PayrollInput {
  return {
    employeeCode: '',
    employeeName: '',
    departmentName: '',
    basicSalary: 0,
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
  };
}

export function validatePayrollInput(input: PayrollInput, existingEmployeeCodes: string[]): string[] {
  const errors: string[] = [];
  if (!input.employeeCode.trim()) errors.push('工号不能为空');
  if (!input.employeeName.trim()) errors.push('姓名不能为空');
  if (existingEmployeeCodes.includes(input.employeeCode.trim())) errors.push('同一批次工号不得重复');
  const amounts = [
    input.basicSalary, input.bonus, input.allowance, input.otherEarnings,
    input.leaveDeduction, input.otherPreTaxDeduction, input.socialInsuranceBase,
    input.housingFundBase, input.specialAdditionalDeduction, input.otherLegalDeduction,
    input.priorCumulativeIncome, input.priorCumulativeEmployeeContributions,
    input.priorCumulativeSpecialAdditionalDeduction, input.priorCumulativeOtherLegalDeduction,
    input.priorCumulativeTaxWithheld, input.otherPostTaxDeduction,
  ].filter((value): value is number => value !== undefined);
  if (amounts.some((value) => !Number.isFinite(value) || value < 0)) errors.push('金额必须为非负数');
  return errors;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
if (Test-Path tmp\test-inline) { Remove-Item -Recurse -Force tmp\test-inline }; npx.cmd tsc test-payroll-inline-entry.ts --outDir tmp\test-inline --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck; node tmp\test-inline\test-payroll-inline-entry.js
```

Expected: `payroll inline entry validation tests passed`

## Task 2: 实现批次内新增、编辑和删除动作

**Files:**
- Modify: `src/stores/usePayrollStore.ts`
- Modify: `test-payroll-store-contract.ts`

- [ ] **Step 1: 扩展失败合同测试**

在 `test-payroll-store-contract.ts` 的动作清单中加入：

```typescript
for (const action of [
  'addManualItem',
  'updateItem',
  'deleteItem',
]) {
  assert.match(storeSource, new RegExp(`${action}: async`));
}
assert.match(storeSource, /请先退回草稿后修改/);
assert.match(storeSource, /手工维护批次/);
assert.match(storeSource, /validatePayrollInput/);
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
if (Test-Path tmp\test-inline) { Remove-Item -Recurse -Force tmp\test-inline }; npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-inline --module commonjs --target es2020; node tmp\test-inline\test-payroll-store-contract.js
```

Expected: FAIL，提示 `addManualItem`、`updateItem` 或 `deleteItem` 尚不存在。

- [ ] **Step 3: 增加 store 接口与共用重算函数**

在 `PayrollStore` 中增加：

```typescript
addManualItem: (period: string, input: PayrollInput) => Promise<void>;
updateItem: (itemId: string, input: PayrollInput) => Promise<void>;
deleteItem: (itemId: string) => Promise<void>;
```

并新增共用批次构建函数，保留现有项目 ID、重新计算结果和汇总：

```typescript
function assertEditableBatch(batch: PayrollBatch | null): asserts batch is PayrollBatch {
  if (!batch) throw new Error('未找到工资批次');
  if (batch.status === 'confirmed') throw new Error('已确认批次请先退回草稿后修改');
}

function buildCalculatedBatch(batch: PayrollBatch, items: PayrollItem[], config: PayrollCalculationConfig): PayrollBatch {
  const summary = summarizePayrollResults(items.map((item) => item.calculationResult));
  return {
    ...batch,
    status: 'calculated',
    employeeCount: summary.employeeCount,
    grossTotal: summary.grossTotal,
    employerCostTotal: summary.employerCostTotal,
    taxTotal: summary.taxTotal,
    netTotal: summary.netTotal,
    calculationConfigSnapshot: config,
    updatedAt: new Date().toISOString(),
    confirmedAt: undefined,
  };
}
```

- [ ] **Step 4: 实现三个持久化动作**

先增加一个保留已有明细 ID、并使用 `savePayrollBatch` 的保存助手：

```typescript
type EditablePayrollRow = { input: PayrollInput; id?: string; createdAt?: string };

async function persistCalculatedItems(
  batch: PayrollBatch,
  rows: EditablePayrollRow[],
  config: PayrollCalculationConfig,
): Promise<{ batch: PayrollBatch; items: PayrollItem[] }> {
  const accountSetId = requireAccountSetId();
  const now = new Date().toISOString();
  const items: PayrollItem[] = rows.map((row) => ({
    id: row.id || generateId('payitem'),
    batchId: batch.id,
    accountSetId,
    payrollPeriod: batch.payrollPeriod,
    employeeCode: row.input.employeeCode,
    employeeName: row.input.employeeName,
    departmentName: row.input.departmentName,
    inputData: row.input,
    calculationResult: calculatePayrollItem(row.input, config, monthFromPeriod(batch.payrollPeriod)),
    validationStatus: 'valid',
    validationMessages: [],
    createdAt: row.createdAt || now,
    updatedAt: now,
  }));
  const updated = buildCalculatedBatch(batch, items, config);
  await sqliteService.savePayrollBatch(updated, items);
  return { batch: updated, items };
}
```

实现新增操作：

```typescript
addManualItem: async (period, input) => {
  const accountSetId = requireAccountSetId();
  const configRecord = get().config || await sqliteService.getPayrollCalculationConfig(period);
  if (!configRecord) throw new Error('请先保存社保、公积金及个税计算设置');
  const currentBatch = get().selectedBatch;
  if (currentBatch) assertEditableBatch(currentBatch);
  const validationErrors = validatePayrollInput(input, get().items.map((item) => item.employeeCode));
  if (validationErrors.length) throw new Error(validationErrors.join('；'));
  const now = new Date().toISOString();
  const batch: PayrollBatch = currentBatch || {
    id: generateId('paybatch'),
    accountSetId,
    payrollPeriod: period,
    batchName: `${period} 手工维护批次`,
    status: 'draft',
    employeeCount: 0,
    grossTotal: 0,
    employerCostTotal: 0,
    taxTotal: 0,
    netTotal: 0,
    calculationConfigSnapshot: configRecord.config,
    createdAt: now,
    updatedAt: now,
  };
  const saved = await persistCalculatedItems(
    batch,
    [
      ...get().items.map((item) => ({ id: item.id, createdAt: item.createdAt, input: item.inputData })),
      { input },
    ],
    configRecord.config,
  );
  set((state) => ({
    batches: [saved.batch, ...state.batches.filter((item) => item.id !== saved.batch.id)],
    selectedBatch: saved.batch,
    items: saved.items,
    error: null,
  }));
},
```

实现编辑与删除操作：

```typescript
updateItem: async (itemId, input) => {
  const batch = get().selectedBatch;
  assertEditableBatch(batch);
  const configRecord = get().config;
  if (!configRecord) throw new Error('请先保存社保、公积金及个税计算设置');
  const validationErrors = validatePayrollInput(
    input,
    get().items.filter((item) => item.id !== itemId).map((item) => item.employeeCode),
  );
  if (validationErrors.length) throw new Error(validationErrors.join('；'));
  const rows = get().items.map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    input: item.id === itemId ? input : item.inputData,
  }));
  const saved = await persistCalculatedItems(batch, rows, configRecord.config);
  set((state) => ({
    batches: state.batches.map((item) => item.id === saved.batch.id ? saved.batch : item),
    selectedBatch: saved.batch,
    items: saved.items,
    error: null,
  }));
},
deleteItem: async (itemId) => {
  const batch = get().selectedBatch;
  assertEditableBatch(batch);
  const configRecord = get().config;
  if (!configRecord) throw new Error('请先保存社保、公积金及个税计算设置');
  const rows = get().items
    .filter((item) => item.id !== itemId)
    .map((item) => ({ id: item.id, createdAt: item.createdAt, input: item.inputData }));
  const saved = await persistCalculatedItems(batch, rows, configRecord.config);
  set((state) => ({
    batches: state.batches.map((item) => item.id === saved.batch.id ? saved.batch : item),
    selectedBatch: saved.batch,
    items: saved.items,
    error: null,
  }));
},
```

每个动作成功后都必须更新 `batches`、`selectedBatch` 与 `items`，且状态改为 `calculated`。

- [ ] **Step 5: 运行 store 合同与现有工资测试**

Run:

```powershell
if (Test-Path tmp\test-inline) { Remove-Item -Recurse -Force tmp\test-inline }; npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-inline --module commonjs --target es2020; node tmp\test-inline\test-payroll-inline-entry.js; node tmp\test-inline\test-payroll-store-contract.js; node tmp\test-inline\test-payroll-calculation.js
```

Expected: 三项测试均打印 `passed`。

## Task 3: 在工资明细表中加入行内录入界面

**Files:**
- Modify: `src/app/payroll/page.tsx`
- Modify: `test-payroll-monthly-integration.ts`

- [ ] **Step 1: 写入页面合同失败测试**

在 `test-payroll-monthly-integration.ts` 中增加：

```typescript
for (const label of ['新增行', '保存', '取消', '编辑', '删除']) {
  assert.match(payrollPageSource, new RegExp(label));
}
assert.match(payrollPageSource, /createBlankPayrollInput/);
assert.match(payrollPageSource, /addManualItem/);
assert.match(payrollPageSource, /updateItem/);
assert.match(payrollPageSource, /deleteItem/);
assert.match(payrollPageSource, /退回草稿后可修改明细/);
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
if (Test-Path tmp\test-inline) { Remove-Item -Recurse -Force tmp\test-inline }; npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-inline --module commonjs --target es2020; node tmp\test-inline\test-payroll-monthly-integration.js
```

Expected: FAIL，提示页面中尚不存在 `新增行` 或新 store 动作。

- [ ] **Step 3: 增加编辑状态与操作按钮**

页面新增临时编辑状态：

```typescript
const [editingItemId, setEditingItemId] = useState<string | 'new' | null>(null);
const [editingInput, setEditingInput] = useState<PayrollInput>(createBlankPayrollInput());
const [editingErrors, setEditingErrors] = useState<string[]>([]);
const editable = selectedBatch?.status !== 'confirmed';
```

标题区动作规则：

```tsx
{editable && (
  <Button variant="outline" size="sm" onClick={startAddRow}>
    <Plus />新增行
  </Button>
)}
{selectedBatch?.status === 'confirmed' && (
  <span className="text-xs text-slate-500">退回草稿后可修改明细</span>
)}
```

- [ ] **Step 4: 实现行内表单和保存逻辑**

使用统一输入转换函数更新 `PayrollInput` 字段：

```typescript
function updateEditingText(field: 'employeeCode' | 'employeeName' | 'departmentName', value: string) {
  setEditingInput((input) => ({ ...input, [field]: value }));
}

function updateEditingAmount(field: keyof PayrollInput, value: string) {
  setEditingInput((input) => ({ ...input, [field]: value === '' ? 0 : Number(value) }));
}

async function saveEditingRow() {
  setEditingErrors([]);
  try {
    if (editingItemId === 'new') await addManualItem(period, editingInput);
    else if (editingItemId) await updateItem(editingItemId, editingInput);
    setEditingItemId(null);
    setEditingInput(createBlankPayrollInput());
  } catch (saveError) {
    setEditingErrors([saveError instanceof Error ? saveError.message : '保存工资明细失败']);
  }
}
```

新增行和被编辑行使用单元格 `Input` 组件显示全部可编辑输入字段，末列显示 `保存` 与 `取消`。普通未确认行末列显示 `编辑` 与 `删除`；确认行不显示任何修改命令。

- [ ] **Step 5: 运行页面合同测试和类型检查**

Run:

```powershell
if (Test-Path tmp\test-inline) { Remove-Item -Recurse -Force tmp\test-inline }; npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-inline --module commonjs --target es2020; node tmp\test-inline\test-payroll-monthly-integration.js; npx.cmd tsc --project tsconfig.json --noEmit
```

Expected: 测试通过且 TypeScript 无错误。

## Task 4: 校验回归与真实交互流程

**Files:**
- Modify only if verification finds a defect: files from Tasks 1-3
- Verify: `src/app/payroll/page.tsx`

- [ ] **Step 1: 运行定向静态检查与回归测试**

Run:

```powershell
npx.cmd eslint src\lib\payroll.ts src\stores\usePayrollStore.ts src\app\payroll\page.tsx test-payroll-inline-entry.ts test-payroll-store-contract.ts test-payroll-monthly-integration.ts
if (Test-Path tmp\test-inline) { Remove-Item -Recurse -Force tmp\test-inline }; npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-inline --module commonjs --target es2020
node tmp\test-inline\test-payroll-inline-entry.js
node tmp\test-inline\test-payroll-calculation.js
node tmp\test-inline\test-payroll-import.js
node tmp\test-inline\test-payroll-storage-contract.js
node tmp\test-inline\test-payroll-store-contract.js
node tmp\test-inline\test-payroll-monthly-integration.js
node tmp\test-inline\test-monthly-closing-checks.js
node tmp\test-inline\test-smart-accounting-workbench.js
node tmp\test-inline\test-period-lock.js
node tmp\test-inline\test-voucher-journal-navigation.js
node test-smart-monthly-ui-boundary.js
```

Expected: ESLint 无新增错误，所有已列出的测试打印 `passed`。

- [ ] **Step 2: 运行生产构建**

Run:

```powershell
npm.cmd run build
```

Expected: Next.js build 成功，并列出 `/payroll` 路由。

- [ ] **Step 3: 进行浏览器验收**

启动或复用本地开发服务器后，以管理员测试账号打开 `http://localhost:3000/payroll`，执行：

1. 保存空白或测试计算设置。
2. 点击 `新增行`，录入 `E101 / 手工录入一 / 基本工资 10000`，保存后核对顶部人数和应发金额。
3. 点击该行 `编辑`，将奖金改为 `1000`，保存后核对应发金额增加。
4. 点击 `新增行` 增加 `E102`，保存后删除该行，核对人数回退。
5. 点击 `确认本月工资`，确认 `新增行`、`编辑`、`删除` 均不可用且出现锁定提示。
6. 点击 `退回草稿`，确认编辑入口重新出现。

截图保存至 `output/playwright/payroll-inline-entry.png`。

- [ ] **Step 4: 查看变更边界并汇报**

Run:

```powershell
git diff --check -- src/lib/payroll.ts src/stores/usePayrollStore.ts src/app/payroll/page.tsx test-payroll-inline-entry.ts test-payroll-store-contract.ts test-payroll-monthly-integration.ts
git status --short
```

Expected: 无空白字符错误。由于当前工作区已有工资和月结相关未提交代码，不自动提交重叠生产文件；在最终报告中列明新增能力、验证证据和未提交边界。
