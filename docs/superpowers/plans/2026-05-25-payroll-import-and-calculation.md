# 工资导入与薪酬计算模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加可导入、可配置计算、可确认和可供月结检查读取的工资管理模块。

**Architecture:** 工资计算和导入校验位于独立纯函数模块；工资批次、明细及参数快照通过现有 `sqliteService` 持久化并由 Zustand store 编排页面操作；`/payroll` 工作台展示期间工资数据，月结检查只读取工资模块可证明的状态。

**Tech Stack:** Next.js App Router, React, TypeScript, Zustand, sql.js/SQLite, XLSX, shadcn/ui, lucide-react

---

## 文件结构

### 新建文件

- `src/lib/payroll.ts` - 工资、社保、公积金和累计个税的纯计算函数与类型。
- `src/lib/payroll-import.ts` - Excel/CSV 解析、模板列映射和行级校验。
- `src/stores/usePayrollStore.ts` - 期间工资批次加载、配置保存、计算与确认操作。
- `src/app/payroll/page.tsx` - 工资导入和计算工作台页面。
- `test-payroll-calculation.ts` - 计算规则测试。
- `test-payroll-import.ts` - 导入映射和校验测试。
- `test-payroll-monthly-integration.ts` - 工资页面入口与月结规则联动测试。

### 修改文件

- `src/types/index.ts` - 如数据库层需要共享工资数据形状，导出工资接口。
- `src/lib/database/sqlite-service.ts` - 新增工资表迁移和 CRUD。
- `src/lib/database/sqlite-manager.ts` - 为新数据库初始化创建工资表和索引。
- `src/components/layout/sidebar.tsx` - 增加 `薪酬管理` 导航入口。
- `src/lib/monthly-closing-checks.ts` - 工资检查项改为工资页面入口，并读取可证明的工资状态。

## Task 1: 建立可核验的计算规则

**Files:**
- Create: `test-payroll-calculation.ts`
- Create: `src/lib/payroll.ts`

- [ ] **Step 1: 核对个税官方规则来源**

使用国家税务总局或中国政府网公开文件核对工资薪金累计预扣预缴的基本减除费用、预扣率表和速算扣除数，并在 `src/lib/payroll.ts` 的默认个税配置旁记录来源标题、生效日期及链接。社保、公积金不得填入地区默认比例。

- [ ] **Step 2: 写入失败测试**

创建测试，用明确输入覆盖应发、社保公积金基数边界、累计个税和分位舍入：

```typescript
import assert from 'node:assert/strict';
import {
  calculatePayrollItem,
  clampContributionBase,
  DEFAULT_CUMULATIVE_TAX_CONFIG,
  type PayrollCalculationConfig,
} from './src/lib/payroll';

const config: PayrollCalculationConfig = {
  socialInsurance: {
    pension: { enabled: true, employeeRate: 0.08, employerRate: 0.16 },
    medical: { enabled: true, employeeRate: 0.02, employerRate: 0.1 },
    unemployment: { enabled: true, employeeRate: 0.005, employerRate: 0.005 },
    injury: { enabled: false, employeeRate: 0, employerRate: 0 },
    maternity: { enabled: false, employeeRate: 0, employerRate: 0 },
    supplementaryMedical: { enabled: false, employeeRate: 0, employerRate: 0 },
    minimumBase: 5000,
    maximumBase: 20000,
    defaultBaseMode: 'gross',
  },
  housingFund: {
    enabled: true,
    employeeRate: 0.07,
    employerRate: 0.07,
    minimumBase: 5000,
    maximumBase: 20000,
    defaultBaseMode: 'gross',
  },
  individualTax: DEFAULT_CUMULATIVE_TAX_CONFIG,
};

assert.equal(clampContributionBase(3000, 5000, 20000), 5000);
assert.equal(clampContributionBase(30000, 5000, 20000), 20000);

const result = calculatePayrollItem({
  employeeCode: 'E001',
  employeeName: '张三',
  basicSalary: 15000,
  bonus: 1000,
  allowance: 500,
  otherEarnings: 0,
  leaveDeduction: 500,
  otherPreTaxDeduction: 0,
  specialAdditionalDeduction: 1000,
  otherLegalDeduction: 0,
  priorCumulativeIncome: 0,
  priorCumulativeEmployeeContributions: 0,
  priorCumulativeSpecialAdditionalDeduction: 0,
  priorCumulativeOtherLegalDeduction: 0,
  priorCumulativeTaxWithheld: 0,
}, config, 1);

assert.equal(result.grossSalary, 16000);
assert.equal(result.employeeSocialInsurance, 1680);
assert.equal(result.employeeHousingFund, 1120);
assert.equal(result.employerSocialInsurance, 4240);
assert.equal(result.employerHousingFund, 1120);
assert.equal(result.taxableIncomeCumulative, 7200);
assert.equal(result.individualIncomeTax, 216);
assert.equal(result.netSalary, 12984);
console.log('payroll calculation tests passed');
```

- [ ] **Step 3: 运行测试验证失败**

Run:

```powershell
npx.cmd tsc test-payroll-calculation.ts --outDir tmp\test-payroll --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
```

Expected: FAIL，因为 `src/lib/payroll.ts` 尚不存在。

- [ ] **Step 4: 实现最小计算模块**

在 `src/lib/payroll.ts` 定义以下公开接口并实现两位小数舍入、基数截断、累计税额计算：

```typescript
export interface ContributionItemConfig {
  enabled: boolean;
  employeeRate: number;
  employerRate: number;
}

export interface PayrollInput {
  employeeCode: string;
  employeeName: string;
  departmentName?: string;
  basicSalary: number;
  bonus: number;
  allowance: number;
  otherEarnings: number;
  leaveDeduction: number;
  otherPreTaxDeduction: number;
  socialInsuranceBase?: number;
  housingFundBase?: number;
  specialAdditionalDeduction: number;
  otherLegalDeduction: number;
  priorCumulativeIncome: number;
  priorCumulativeEmployeeContributions: number;
  priorCumulativeSpecialAdditionalDeduction: number;
  priorCumulativeOtherLegalDeduction: number;
  priorCumulativeTaxWithheld: number;
  otherPostTaxDeduction?: number;
}

export interface PayrollCalculationResult {
  grossSalary: number;
  employeeSocialInsurance: number;
  employerSocialInsurance: number;
  employeeHousingFund: number;
  employerHousingFund: number;
  taxableIncomeCumulative: number;
  individualIncomeTax: number;
  netSalary: number;
  employerTotalCost: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

个税计算输出必须使用 `max(0, 累计税额 - 前期累计已预扣税额)`，不得产生负的本期个税。

- [ ] **Step 5: 运行计算测试通过**

Run:

```powershell
npx.cmd tsc test-payroll-calculation.ts --outDir tmp\test-payroll --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
node tmp\test-payroll\test-payroll-calculation.js
```

Expected: `payroll calculation tests passed`

## Task 2: 导入解析与校验

**Files:**
- Create: `test-payroll-import.ts`
- Create: `src/lib/payroll-import.ts`

- [ ] **Step 1: 写入失败测试**

使用 worksheet 二维数组测试列映射、重复工号和负数错误：

```typescript
import assert from 'node:assert/strict';
import { parsePayrollRows } from './src/lib/payroll-import';

const valid = parsePayrollRows([
  ['工号', '姓名', '基本工资', '奖金', '社保缴费基数', '公积金缴费基数'],
  ['E001', '张三', 10000, 2000, 10000, 10000],
]);
assert.equal(valid.validRows.length, 1);
assert.equal(valid.errors.length, 0);
assert.equal(valid.validRows[0].basicSalary, 10000);

const invalid = parsePayrollRows([
  ['工号', '姓名', '基本工资'],
  ['E001', '张三', 10000],
  ['E001', '李四', -100],
]);
assert.equal(invalid.validRows.length, 1);
assert.equal(invalid.errors.length, 1);
assert.match(invalid.errors[0].message, /重复工号|不得为负数/);
console.log('payroll import tests passed');
```

- [ ] **Step 2: 运行测试验证失败**

Run:

```powershell
npx.cmd tsc test-payroll-import.ts --outDir tmp\test-payroll --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
```

Expected: FAIL，因为导入模块尚不存在。

- [ ] **Step 3: 实现解析器和模板生成函数**

公开以下函数：

```typescript
export interface PayrollImportError {
  rowNumber: number;
  message: string;
}

export interface PayrollImportResult {
  validRows: PayrollInput[];
  errors: PayrollImportError[];
}

export function parsePayrollRows(rows: unknown[][]): PayrollImportResult;
export async function parsePayrollFile(file: File): Promise<PayrollImportResult>;
export function generatePayrollImportTemplate(): void;
export function exportPayrollResults(items: PayrollCalculationResult[], period: string): void;
```

字段映射使用中文模板列名；未提供可选金额时归零；必填字段或金额格式不合法的行仅进入 `errors`。

- [ ] **Step 4: 运行导入测试通过**

Run:

```powershell
npx.cmd tsc test-payroll-import.ts --outDir tmp\test-payroll --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
node tmp\test-payroll\test-payroll-import.js
```

Expected: `payroll import tests passed`

## Task 3: SQLite 表和服务方法

**Files:**
- Modify: `src/lib/database/sqlite-manager.ts`
- Modify: `src/lib/database/sqlite-service.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: 定义数据库边界类型**

在 `src/types/index.ts` 导出 `PayrollBatch`、`PayrollItem`、`PayrollCalculationConfigRecord`，字段与设计文档表结构一致，JSON 列在应用层解析为 `PayrollInput` 和 `PayrollCalculationResult`。

- [ ] **Step 2: 新数据库初始化增加表**

在 `sqlite-manager.ts` 的 `createTables()` 中加入：

```sql
CREATE TABLE IF NOT EXISTS payroll_batches (...);
CREATE TABLE IF NOT EXISTS payroll_items (...);
CREATE TABLE IF NOT EXISTS payroll_calculation_configs (...);
CREATE INDEX IF NOT EXISTS idx_payroll_batches_period ON payroll_batches(accountSetId, payrollPeriod);
CREATE INDEX IF NOT EXISTS idx_payroll_items_batch ON payroll_items(accountSetId, batchId);
CREATE INDEX IF NOT EXISTS idx_payroll_config_period ON payroll_calculation_configs(accountSetId, effectivePeriod);
```

SQL 列定义必须与已批准规格第 6.2 节一致。

- [ ] **Step 3: 既有数据库迁移增加同一组表**

在 `sqlite-service.ts` 的初始化迁移路径中执行相同 `CREATE TABLE IF NOT EXISTS` 和索引语句，使升级用户无需重置数据库。

- [ ] **Step 4: 增加工资 CRUD 服务**

在 `SQLiteService` 增加：

```typescript
getPayrollBatches(period?: string): Promise<PayrollBatch[]>;
getPayrollItems(batchId: string): Promise<PayrollItem[]>;
savePayrollCalculationConfig(record: PayrollCalculationConfigRecord): Promise<void>;
getPayrollCalculationConfig(period: string): Promise<PayrollCalculationConfigRecord | null>;
savePayrollBatch(batch: PayrollBatch, items: PayrollItem[]): Promise<void>;
updatePayrollBatchStatus(batchId: string, status: PayrollBatch['status']): Promise<void>;
deletePayrollBatch(batchId: string): Promise<void>;
```

每个查询与更新都必须加入 `accountSetId = this.accountSetId` 条件，写操作结束后调用现有 `persist()`。

- [ ] **Step 5: 编译验证数据库接口**

Run:

```powershell
npx.cmd tsc --project tsconfig.json --noEmit
```

Expected: PASS，无新增类型错误。

## Task 4: 工资页面状态编排

**Files:**
- Create: `src/stores/usePayrollStore.ts`
- Test: `test-payroll-calculation.ts`

- [ ] **Step 1: 增加批次汇总测试**

扩展计算测试，导入两位员工的计算结果并断言：

```typescript
const summary = summarizePayrollResults([resultA, resultB]);
assert.equal(summary.employeeCount, 2);
assert.equal(summary.grossTotal, roundMoney(resultA.grossSalary + resultB.grossSalary));
assert.equal(summary.netTotal, roundMoney(resultA.netSalary + resultB.netSalary));
```

- [ ] **Step 2: 运行测试验证失败并补充汇总函数**

在 `src/lib/payroll.ts` 添加：

```typescript
export function summarizePayrollResults(items: PayrollCalculationResult[]): PayrollSummary;
```

运行 Task 1 测试命令，直到新增断言通过。

- [ ] **Step 3: 实现工资 store**

`usePayrollStore` 提供以下页面动作：

```typescript
interface PayrollStore {
  batches: PayrollBatch[];
  selectedBatch: PayrollBatch | null;
  items: PayrollItem[];
  config: PayrollCalculationConfigRecord | null;
  loading: boolean;
  error: string | null;
  loadPeriod(period: string): Promise<void>;
  loadBatch(batchId: string): Promise<void>;
  saveConfig(period: string, config: PayrollCalculationConfig): Promise<void>;
  importDraft(period: string, fileName: string, rows: PayrollInput[]): Promise<PayrollBatch>;
  recalculateBatch(batchId: string): Promise<void>;
  confirmBatch(batchId: string): Promise<void>;
  revertBatchToDraft(batchId: string): Promise<void>;
  deleteDraftBatch(batchId: string): Promise<void>;
}
```

`confirmBatch` 必须阻止存在校验错误或缺少配置的批次确认。

- [ ] **Step 4: 编译验证 store**

Run:

```powershell
npx.cmd tsc --project tsconfig.json --noEmit
```

Expected: PASS。

## Task 5: 工资工作台页面

**Files:**
- Create: `src/app/payroll/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: 添加薪酬管理导航入口**

在业务模块侧边栏中增加 `薪酬管理`，使用 `WalletCards` 或现有可用的 `lucide-react` 图标，并路由到 `/payroll`。

- [ ] **Step 2: 实现页面工具栏与汇总区**

页面顶部展示期间、批次状态和四个主要动作：

```tsx
<Button onClick={downloadTemplate}><Download />下载模板</Button>
<Button onClick={() => fileInputRef.current?.click()}><Upload />导入工资表</Button>
<Button onClick={() => setSettingsOpen(true)}><Settings2 />计算设置</Button>
<Button onClick={exportCurrentBatch} disabled={!selectedBatch}><FileDown />导出结果</Button>
```

下方紧凑展示 `员工人数`、`应发合计`、`企业成本`、`个税合计`、`实发合计`。

- [ ] **Step 3: 实现导入与明细表**

上传文件后先展示预览和错误列表；确认导入后由 store 保存草稿批次。明细表至少提供：

```text
工号 | 姓名 | 部门 | 应发工资 | 个人社保 | 个人公积金 | 个税 | 实发工资 | 企业成本 | 校验状态
```

明细表使用固定列宽和横向滚动，保证工资数字可扫描、不因按钮或错误文本发生布局位移。

- [ ] **Step 4: 实现计算设置与批次操作**

设置面板包含社保险种开关、个人/企业比例、基数上下限、公积金比例和个税配置版本显示。页面动作包括 `重新计算`、`确认本月工资`、`退回草稿` 和 `删除草稿`，不同批次状态仅开放允许操作。

- [ ] **Step 5: 页面编译与浏览器验证**

Run:

```powershell
npx.cmd tsc --project tsconfig.json --noEmit
npm.cmd run dev
```

在浏览器访问 `http://localhost:3000/payroll`，验证导入、设置、明细表、空状态与窄屏滚动均可使用。

## Task 6: 月结检查联动

**Files:**
- Modify: `src/lib/monthly-closing-checks.ts`
- Modify: `src/app/monthly-closing-checks/page.tsx` only if configuration view must show updated route label
- Create: `test-payroll-monthly-integration.ts`

- [ ] **Step 1: 写入失败集成测试**

测试工资检查条目的页面入口，以及可证明状态边界：

```typescript
import assert from 'node:assert/strict';
import { DEFAULT_MONTHLY_CLOSING_TEMPLATES } from './src/lib/monthly-closing-checks';

const salaryCheck = DEFAULT_MONTHLY_CLOSING_TEMPLATES.find((item) => item.code === 'payroll_salary_tax');
const socialCheck = DEFAULT_MONTHLY_CLOSING_TEMPLATES.find((item) => item.code === 'payroll_social_fund');
assert.equal(salaryCheck?.route, '/payroll');
assert.equal(socialCheck?.route, '/payroll');
console.log('payroll monthly integration tests passed');
```

- [ ] **Step 2: 运行测试验证失败**

Run:

```powershell
npx.cmd tsc test-payroll-monthly-integration.ts --outDir tmp\test-payroll --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
node tmp\test-payroll\test-payroll-monthly-integration.js
```

Expected: FAIL，因为当前工资检查仍指向 `/voucher-entry-page`。

- [ ] **Step 3: 更改入口并增加工资证据读取接口**

将两个工资检查模板的 `route` 更新为 `/payroll`。若当期存在 `confirmed` 工资批次，则只向检查计算层暴露：

```typescript
{
  hasConfirmedPayrollBatch: true,
  hasPayrollTaxCalculation: taxTotal >= 0,
  hasSocialFundCalculation: items.some((item) => item.calculationResult includes contribution fields),
}
```

不得将以上状态直接等同于工资已计提、已支付、个税已申报或社保已缴纳。

- [ ] **Step 4: 运行工资和既有月结测试**

Run:

```powershell
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-payroll --module commonjs --target es2020
node tmp\test-payroll\test-payroll-monthly-integration.js
node tmp\test-payroll\test-monthly-closing-checks.js
node tmp\test-payroll\test-smart-accounting-workbench.js
```

Expected: 全部 PASS。

## Task 7: 最终验证与提交

**Files:**
- All payroll and integration files changed in Tasks 1-6

- [ ] **Step 1: 执行完整验证**

Run:

```powershell
npx.cmd tsc --project tsconfig.json --noEmit
npx.cmd eslint src/lib/payroll.ts src/lib/payroll-import.ts src/stores/usePayrollStore.ts src/app/payroll/page.tsx src/components/layout/sidebar.tsx src/lib/monthly-closing-checks.ts test-payroll-calculation.ts test-payroll-import.ts test-payroll-monthly-integration.ts
```

Run the compiled payroll tests and the existing period/monthly tests. Expected: 无新增 TypeScript 或 ESLint error，所有测试通过。

- [ ] **Step 2: 验证关键页面流程**

打开 `/payroll`：

1. 下载模板。
2. 导入一份有效数据并计算。
3. 更改社保比例并确认汇总更新。
4. 确认批次并刷新，确认 SQLite 数据仍可读取。
5. 打开月结检查入口，确认跳转到工资页面且不会把“已计算”误显示为“已缴纳”。

- [ ] **Step 3: 仅暂存本功能文件并提交**

```powershell
git add -- src/lib/payroll.ts src/lib/payroll-import.ts src/types/index.ts src/lib/database/sqlite-service.ts src/lib/database/sqlite-manager.ts src/stores/usePayrollStore.ts src/app/payroll/page.tsx src/components/layout/sidebar.tsx src/lib/monthly-closing-checks.ts test-payroll-calculation.ts test-payroll-import.ts test-payroll-monthly-integration.ts docs/superpowers/plans/2026-05-25-payroll-import-and-calculation.md
git commit -m "Add payroll import and calculation workflow"
```

已有月结/智能做账未提交改动如果与本功能重叠，提交前应逐项查看 diff，仅包含本次工资模块实际需要的修改。
