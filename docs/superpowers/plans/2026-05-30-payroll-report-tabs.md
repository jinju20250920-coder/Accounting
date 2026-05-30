# Payroll Report Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone payroll report page with two tabs: batch summary and employee-month detail, both driven by the same date-range and employee/department filters.

**Architecture:** Keep reporting read-only and derived from existing payroll batches/items. Put all filtering, grouping, and totals into a pure helper module so the page stays focused on rendering tabs, tables, and export actions. Add only one small payroll batch linkage for voucher metadata so the detail tab can distinguish “已入账” from “已确认”.

**Tech Stack:** Next.js App Router, React, Zustand store already in repo, existing `sqliteService`, `Tabs` UI, `Table` UI, `xlsx` export.

---

### Task 1: Build report aggregation helpers and tests

**Files:**
- Create: `src/lib/payroll-report.ts`
- Create: `test-payroll-report.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import {
  buildPayrollReportData,
  isPayrollPeriodInRange,
} from './src/lib/payroll-report';
import type { PayrollBatch, PayrollItem } from './src/lib/payroll';

const batches: PayrollBatch[] = [
  {
    id: 'batch-jan',
    accountSetId: 'acct-1',
    payrollPeriod: '2026-01',
    batchName: '2026-01 工资批次',
    status: 'calculated',
    employeeCount: 1,
    grossTotal: 50000,
    employerCostTotal: 58000,
    taxTotal: 1333.88,
    netTotal: 42204.94,
    calculationConfigSnapshot: {} as never,
    createdAt: '2026-01-31T00:00:00.000Z',
    updatedAt: '2026-01-31T00:00:00.000Z',
  },
  {
    id: 'batch-feb',
    accountSetId: 'acct-1',
    payrollPeriod: '2026-02',
    batchName: '2026-02 工资批次',
    status: 'confirmed',
    employeeCount: 1,
    grossTotal: 50000,
    employerCostTotal: 58000,
    taxTotal: 3853.88,
    netTotal: 39684.94,
    calculationConfigSnapshot: {} as never,
    createdAt: '2026-02-28T00:00:00.000Z',
    updatedAt: '2026-02-28T00:00:00.000Z',
    accrualVoucherNo: '记-202602-001',
  },
];

const itemsByBatchId = new Map<string, PayrollItem[]>([
  [
    'batch-jan',
    [{
      id: 'item-jan',
      batchId: 'batch-jan',
      accountSetId: 'acct-1',
      payrollPeriod: '2026-01',
      employeeCode: 'E001',
      employeeName: '张三',
      departmentName: '销售部',
      inputData: {} as never,
      calculationResult: {
        employeeCode: 'E001',
        employeeName: '张三',
        departmentName: '销售部',
        grossSalary: 50000,
        socialInsuranceBase: 36921,
        housingFundBase: 36921,
        employeeSocialInsurance: 3876.71,
        employerSocialInsurance: 3876.71,
        employeeHousingFund: 2584.47,
        employerHousingFund: 2584.47,
        taxableIncomeCumulative: 38875,
        individualIncomeTax: 1367.5,
        netSalary: 42204.94,
        employerTotalCost: 58000,
        taxCalculationType: 'salary_cumulative',
      },
      validationStatus: 'valid',
      validationMessages: [],
      createdAt: '2026-01-31T00:00:00.000Z',
      updatedAt: '2026-01-31T00:00:00.000Z',
    }],
  ],
  [
    'batch-feb',
    [{
      id: 'item-feb',
      batchId: 'batch-feb',
      accountSetId: 'acct-1',
      payrollPeriod: '2026-02',
      employeeCode: 'E001',
      employeeName: '张三',
      departmentName: '销售部',
      inputData: {} as never,
      calculationResult: {
        employeeCode: 'E001',
        employeeName: '张三',
        departmentName: '销售部',
        grossSalary: 50000,
        socialInsuranceBase: 36921,
        housingFundBase: 36921,
        employeeSocialInsurance: 3876.71,
        employerSocialInsurance: 3876.71,
        employeeHousingFund: 2584.47,
        employerHousingFund: 2584.47,
        taxableIncomeCumulative: 77750,
        individualIncomeTax: 3853.88,
        netSalary: 39684.94,
        employerTotalCost: 58000,
        taxCalculationType: 'salary_cumulative',
      },
      validationStatus: 'valid',
      validationMessages: [],
      createdAt: '2026-02-28T00:00:00.000Z',
      updatedAt: '2026-02-28T00:00:00.000Z',
    }],
  ],
]);

assert.equal(isPayrollPeriodInRange('2026-02', '2026-01', '2026-03'), true);
assert.equal(isPayrollPeriodInRange('2026-04', '2026-01', '2026-03'), false);

const report = buildPayrollReportData({
  batches,
  itemsByBatchId,
  filters: {
    startPeriod: '2026-01',
    endPeriod: '2026-02',
    employeeQuery: 'E001',
    departmentName: '销售部',
    status: 'all',
  },
});

assert.equal(report.summary.grossTotal, 100000);
assert.equal(report.summary.taxTotal, 5221.38);
assert.equal(report.batchRows.length, 2);
assert.equal(report.detailRows.length, 2);
assert.equal(report.detailRows[1].statusLabel, '已确认');
assert.equal(report.detailRows[1].voucherLabel, '记-202602-001');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd tsc test-payroll-report.ts --outDir tmp\\test-payroll-report --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck`

Expected: fail because `src/lib/payroll-report.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface PayrollReportFilters {
  startPeriod: string;
  endPeriod: string;
  employeeQuery: string;
  departmentName: string;
  status: 'all' | 'draft' | 'calculated' | 'confirmed' | 'invoiced';
}

export function isPayrollPeriodInRange(period: string, startPeriod: string, endPeriod: string): boolean;
export function buildPayrollReportData(input: {
  batches: PayrollBatch[];
  itemsByBatchId: Map<string, PayrollItem[]>;
  filters: PayrollReportFilters;
}): {
  summary: PayrollReportSummary;
  batchRows: PayrollBatchReportRow[];
  detailRows: PayrollEmployeeMonthRow[];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tmp\\test-payroll-report\\test-payroll-report.js`

Expected: PASS with the assertions above.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payroll-report.ts test-payroll-report.ts
git commit -m "feat: add payroll report aggregation helpers"
```

### Task 2: Persist batch voucher linkage for report status

**Files:**
- Modify: `src/lib/payroll.ts:188-206`
- Modify: `src/lib/database/sqlite-manager.ts:809-824`
- Modify: `src/lib/database/sqlite-service.ts:152-169, 3748-3758, 3826-3953`
- Modify: `src/stores/usePayrollStore.ts:500-533`
- Modify: `test-payroll-report.ts`

- [ ] **Step 1: Write the failing test**

Add one assertion to the helper test so voucher linkage can drive the detail status:

```ts
assert.equal(report.detailRows[1].statusLabel, '已入账');
```

Use a second run with `accrualVoucherNo: '记-202602-001'` present on the February batch, and verify the status label upgrades from `已确认` to `已入账`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp\\test-payroll-report\\test-payroll-report.js`

Expected: fail because `PayrollBatch` has no `accrualVoucherId` / `accrualVoucherNo`, and the store does not persist them yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/payroll.ts
export interface PayrollBatch {
  // ...
  confirmedAt?: string;
  accrualVoucherId?: string;
  accrualVoucherNo?: string;
}
```

```ts
// src/lib/database/sqlite-service.ts and sqlite-manager.ts
// payroll_batches table adds:
//   accrualVoucherId TEXT
//   accrualVoucherNo TEXT
// and get/save paths read and write both columns.
```

```ts
// src/stores/usePayrollStore.ts
await sqliteService.updatePayrollBatchVoucher(batchId, voucher.id, voucher.voucherNo);
```

- [ ] **Step 4: Run test to verify it passes**

Run:
`npx.cmd tsc --noEmit --pretty false`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payroll.ts src/lib/database/sqlite-manager.ts src/lib/database/sqlite-service.ts src/stores/usePayrollStore.ts test-payroll-report.ts
git commit -m "feat: persist payroll voucher linkage on batches"
```

### Task 3: Implement the payroll report page with two tabs

**Files:**
- Create: `src/app/payroll/report/page.tsx`
- Modify: `src/app/payroll/page.tsx:978-1000` and top action bar

- [ ] **Step 1: Write the failing test**

Add a smoke-style assertion in `test-payroll-report.ts` for the visible UI data contract:

```ts
assert.equal(report.summary.employeeCount, 2);
assert.equal(report.batchRows[0].batchPeriod, '2026-01');
assert.equal(report.detailRows[0].employeeName, '张三');
```

This is the contract the page will render in the summary cards and both tabs.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd tsc --noEmit --pretty false`

Expected: the report page route does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
const [activeTab, setActiveTab] = useState<'batch' | 'detail'>('batch');
const [filters, setFilters] = useState<PayrollReportFilters>({
  startPeriod: currentPeriod,
  endPeriod: currentPeriod,
  employeeQuery: '',
  departmentName: '全部',
  status: 'all',
});

<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'batch' | 'detail')}>
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="batch">按批次汇总</TabsTrigger>
    <TabsTrigger value="detail">按员工月份明细</TabsTrigger>
  </TabsList>
</Tabs>
```

The page should:

- load all payroll batches for the current account set;
- load items for the batches that match the current filter range;
- derive `summary`, `batchRows`, and `detailRows` through `buildPayrollReportData`;
- render the summary cards above both tabs;
- render expandable rows in both tables;
- export the active tab to Excel using the filtered data.

- [ ] **Step 4: Run test to verify it passes**

Run:
`npx.cmd eslint src/app/payroll/report/page.tsx src/lib/payroll-report.ts src/app/payroll/page.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/payroll/report/page.tsx src/app/payroll/page.tsx
git commit -m "feat: add payroll report tabs page"
```

### Task 4: Add navigation and polish the reporting flow

**Files:**
- Modify: `src/app/payroll/page.tsx`
- Modify: `src/components/layout/sidebar.tsx` only if a discoverability link is needed later

- [ ] **Step 1: Write the failing test**

No new logic test is required here; the smoke target is route accessibility and navigation.

- [ ] **Step 2: Run test to verify it fails**

Run the app and open `/payroll/report`. Without the page route, this should 404.

- [ ] **Step 3: Write minimal implementation**

Add a top-bar button on the existing payroll page:

```tsx
<Button variant="outline" size="sm" asChild>
  <Link href="/payroll/report">工资统计汇总</Link>
</Button>
```

Keep the existing payroll page intact; this button is only a navigation shortcut into the new reporting page.

- [ ] **Step 4: Run test to verify it passes**

Run:
`npx.cmd tsc --noEmit --pretty false`
`npx.cmd eslint src/app/payroll/page.tsx src/app/payroll/report/page.tsx src/lib/payroll-report.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/payroll/page.tsx
git commit -m "feat: link payroll page to report tabs"
```

## Self-Review

- Spec coverage: filters, summary cards, batch tab, employee-month tab, row expansion, export, and navigation are all assigned to a task.
- Placeholder scan: no TBD/TODO placeholders were introduced.
- Type consistency: `PayrollReportFilters`, `PayrollBatchReportRow`, `PayrollEmployeeMonthRow`, and `buildPayrollReportData` are the same names used across tasks and tests.
- Scope check: the plan stays within one reporting page and one small voucher-link extension; it does not expand into payroll calculation or unrelated UI refactors.

