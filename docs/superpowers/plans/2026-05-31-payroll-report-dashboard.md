# Payroll Report Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the payroll reporting dashboard so it matches the narrowed BRD: one page, two tabs, shared filters, KPI cards, derived summaries, and Excel export from the existing payroll data source.

**Architecture:** Keep all report data derived from persisted payroll batches and payroll items. The report helper remains the single place for filtering, grouping, and totals. The page stays focused on rendering the dashboard shell, two tabs, row expansion, and export actions, while the sidebar provides the canonical navigation entry.

**Tech Stack:** Next.js App Router, React, TypeScript, existing payroll store/database helpers, existing UI primitives (`Tabs`, `Table`, `Badge`, `Button`, `ChineseMonthPicker`), `xlsx`.

---

### Task 1: Lock the data contract and status mapping

**Files:**
- Modify: `src/lib/payroll-report.ts`
- Modify: `test-payroll-report.ts`
- Modify: `src/lib/payroll.ts` only if a report field needs to read persisted batch metadata

- [ ] **Step 1: Tighten the helper contract with explicit assertions**

```ts
import assert from 'node:assert/strict';
import { buildPayrollReportData, isPayrollPeriodInRange } from './src/lib/payroll-report';

assert.equal(isPayrollPeriodInRange('2026-02', '2026-01', '2026-03'), true);
assert.equal(isPayrollPeriodInRange('2026-04', '2026-01', '2026-03'), false);

const report = buildPayrollReportData({ batches, itemsByBatchId, filters });
assert.equal(report.summary.batchCount, 2);
assert.equal(report.summary.employeeCount, 2);
assert.equal(report.batchRows[1].statusLabel, '已入账');
assert.equal(report.batchRows[1].voucherLabel, '记-202602-001');
assert.equal(report.detailRows[1].statusLabel, '已入账');
```

- [ ] **Step 2: Run the helper test to verify the current behavior**

Run:
`npx.cmd tsc test-payroll-report.ts --outDir tmp\\test-payroll-report --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck`

Expected: compile success, then `node tmp\\test-payroll-report\\test-payroll-report.js` passes with the persisted voucher-linked status.

- [ ] **Step 3: Keep the helper implementation derived from persisted data**

```ts
function resolveStatusLabel(batch: PayrollBatch): string {
  if (batch.accrualVoucherNo?.trim() || batch.accrualVoucherId?.trim()) return '已入账';
  if (batch.status === 'confirmed') return '已确认';
  if (batch.status === 'calculated') return '已计算';
  return '草稿';
}
```

- [ ] **Step 4: Run the TypeScript build to verify the helper stays type-safe**

Run:
`npx.cmd tsc --noEmit --pretty false`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payroll-report.ts test-payroll-report.ts src/lib/payroll.ts
git commit -m "feat: lock payroll report data contract"
```

### Task 2: Refine the payroll report dashboard page

**Files:**
- Create or modify: `src/app/payroll/report/page.tsx`

- [ ] **Step 1: Verify the dashboard renders the required two-tab structure**

The page must render:

```tsx
<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'batch' | 'detail')}>
  <TabsList className="grid w-full max-w-md grid-cols-2">
    <TabsTrigger value="batch">按批次汇总</TabsTrigger>
    <TabsTrigger value="detail">按员工月份明细</TabsTrigger>
  </TabsList>
</Tabs>
```

- [ ] **Step 2: Keep the filter toolbar compact and shared**

The filter block should stay in one compact row/grid and drive both tabs:

```tsx
<ChineseMonthPicker value={draftFilters.startPeriod} onChange={(value) => setDraftFilters((prev) => ({ ...prev, startPeriod: value }))} />
<ChineseMonthPicker value={draftFilters.endPeriod} onChange={(value) => setDraftFilters((prev) => ({ ...prev, endPeriod: value }))} />
<Input placeholder="姓名或工号" value={draftFilters.employeeQuery} onChange={(event) => setDraftFilters((prev) => ({ ...prev, employeeQuery: event.target.value }))} />
```

- [ ] **Step 3: Render KPI cards from the current filtered result**

```tsx
const summaryCards = [
  ['税前工资合计', report.summary.grossTotal],
  ['个人社保公积金合计', report.summary.employeeContributionTotal],
  ['个税合计', report.summary.taxTotal],
  ['实发工资合计', report.summary.netTotal],
  ['公司成本合计', report.summary.employerCostTotal],
] as const;
```

- [ ] **Step 4: Keep the batch and employee-month tables expandable**

Batch rows should expand to show employee rows, and employee rows should expand to show earning and deduction breakdown. The implementation should continue to read from `report.batchRows` and `report.detailRows` only.

- [ ] **Step 5: Keep export aligned with the active tab**

```ts
const fileName = activeTab === 'batch'
  ? `工资统计汇总_${appliedFilters.startPeriod}_${appliedFilters.endPeriod}.xlsx`
  : `工资统计明细_${appliedFilters.startPeriod}_${appliedFilters.endPeriod}.xlsx`;
XLSX.writeFile(workbook, fileName);
```

- [ ] **Step 6: Run the page-focused checks**

Run:
`npx.cmd tsc --noEmit --pretty false`
`npx.cmd eslint src/app/payroll/report/page.tsx src/lib/payroll-report.ts test-payroll-report.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/payroll/report/page.tsx
git commit -m "feat: refine payroll report dashboard"
```

### Task 3: Wire navigation and sidebar discoverability

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/payroll/page.tsx`

- [ ] **Step 1: Ensure the payroll section is discoverable from the sidebar**

```ts
{ icon: WalletCards, label: '薪酬管理', path: '/payroll', permission: 'voucher:view', children: [
  { label: '工资管理', path: '/payroll', permission: 'voucher:view' },
  { label: '工资报表', path: '/payroll/report', permission: 'voucher:view' },
]},
```

- [ ] **Step 2: Keep the payroll page as an optional shortcut into the report**

```tsx
<Button variant="outline" size="sm" onClick={() => router.push('/payroll/report')}>
  <BarChart3 />工资报表
</Button>
```

- [ ] **Step 3: Make the sidebar auto-expand for payroll pages without extra clicks**

```ts
const autoExpandedItems = useMemo(() => new Set(
  visibleMenuItems
    .filter((item) => item.children?.some((child) => isActive(child.path)) || (item.children && isActive(item.path)))
    .map((item) => item.label),
), [isActive, visibleMenuItems]);
```

- [ ] **Step 4: Run navigation smoke verification**

Run the app and verify:

- `/payroll` shows the payroll management page
- `/payroll/report` shows the report dashboard
- The sidebar highlights and expands `薪酬管理` on both pages

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar.tsx src/app/payroll/page.tsx
git commit -m "feat: wire payroll report navigation"
```

## Self-Review

- Spec coverage: shared filters, KPI cards, two tabs, export, and sidebar navigation all map to a task.
- Placeholder scan: no TBD/TODO placeholders were introduced.
- Type consistency: `PayrollReportFilters`, `PayrollBatchReportRow`, `PayrollEmployeeMonthRow`, and `buildPayrollReportData` are used consistently across the plan.
- Scope check: the plan stays within the dashboard and does not add trend charts, AI, or new payroll calculation logic.
