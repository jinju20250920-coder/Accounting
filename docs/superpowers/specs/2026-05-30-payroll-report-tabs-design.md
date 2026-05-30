# Payroll Report Tabs Design

## Goal

Add a standalone payroll reporting page with two tabs:

1. Batch summary view grouped by payroll batch.
2. Employee-month detail view grouped by month and employee.

The page must support a date range query and optional employee / department filtering. It must reuse existing payroll batches and payroll items rather than introducing a new reporting table.

## Scope

This design covers:

- A new payroll report route in the payroll module.
- A shared filter bar for period range, employee, department, and status.
- A top summary section that reflects the current filter result.
- Two tabs on the same page:
  - `按批次汇总`
  - `按员工月份明细`
- Row expansion for both tabs.
- Excel export for the current tab and filter result.

This design does not cover:

- New payroll calculation logic.
- New database tables for reporting snapshots.
- Multi-tenant permissions changes.
- Approval workflow changes.

## User Experience

### Page Layout

The page should feel like a business reporting page rather than a form. It should have:

- A filter bar at the top.
- Summary cards beneath the filters.
- A tab switcher for the two report modes.
- A data table for the active tab.
- Pagination for the detail-heavy tab.

### Filters

The filter bar should support:

- Period range: start month and end month.
- Employee: free text or employee selector by name / code.
- Department: all or a selected department.
- Status: all or a selected payroll status.
- Query, reset, and export actions.

The filter result should drive both tabs and the summary cards. There should be no separate hidden query state for the two tabs.

### Summary Cards

The summary cards should always reflect the current filter conditions. They should aggregate only records that match the active filters.

Recommended cards:

- Tax before deduction total.
- Employee social insurance and housing fund total.
- Individual income tax total.
- Net salary total.
- Company cost total.

If the active tab is employee-month detail, the summary cards still aggregate across the same filtered result set.

## Tab 1: Batch Summary View

### Purpose

This tab is for quick review of payroll batches across the selected period range.

### Row Definition

Each row represents one payroll batch.

### Recommended Columns

- Batch period.
- Batch name or source file name.
- Status.
- Employee count.
- Gross total.
- Employee contribution total.
- Individual income tax total.
- Net total.
- Employer cost total.
- Action column.

### Expand Behavior

Each batch row can expand to show the batch's employee-level items.

Expanded rows should reuse the existing payroll items already stored in the batch. The child rows should show:

- Employee code.
- Employee name.
- Department.
- Gross salary.
- Individual contribution totals.
- Individual income tax.
- Net salary.
- Company cost.
- Status.

### Sorting

Default sort should be by period descending, then updated time descending if needed.

## Tab 2: Employee-Month Detail View

### Purpose

This tab is for detailed payroll review by month and employee.

### Row Definition

Each row represents one employee's payroll item for one month.

### Recommended Columns

- Month.
- Employee code.
- Employee name.
- Department.
- Tax before deduction.
- Employee social insurance.
- Employee housing fund.
- Individual income tax.
- Net salary.
- Company social insurance.
- Company housing fund.
- Status.
- Action column.

### Expand Behavior

Clicking a row should expand a detail panel that shows:

- Tax before deduction.
- Breakdown of earnings.
- Breakdown of deductions.
- Net salary.
- Voucher status.
- Actions:
  - View voucher.
  - Recalculate.
  - Export payslip.

The expanded details should reuse existing payroll item input and calculation data.

## Data Flow

### Source Data

The page should query from existing payroll sources:

- Payroll batches.
- Payroll items.
- Payroll configuration snapshot for period-specific display values.
- Employee and department master data for labels and optional filters.

### Aggregation

The page should compute report data in memory from the filtered batches and items:

- Batch summary tab aggregates by batch.
- Employee-month detail tab aggregates by payroll item.
- Summary cards aggregate across the active filtered dataset.

This avoids introducing a second persisted reporting model that could drift from the payroll source of truth.

### Filter Semantics

The active filter set should be applied first, then all summary and table data should be derived from the filtered result.

Filtering should consider:

- Payroll period between start and end month.
- Employee code or name match.
- Department match.
- Status match.

## Export

### Batch Tab Export

Export should include one row per payroll batch, using the currently filtered result set.

### Detail Tab Export

Export should include one row per employee-month payroll item, using the currently filtered result set.

The export should preserve the active tab context and the active filters.

## Error Handling

- If no data matches the filters, show an empty state rather than an error.
- If the period range is invalid, block the query and show inline feedback.
- If employee or department labels are missing, fall back to the underlying code.
- If the current batch data is stale, recalculate from existing payroll calculations rather than inventing a new reporting source.

## Data Model Impact

This feature should not add new persistent reporting tables.

Recommended additions are limited to:

- A reusable payroll report filter state in the page component or store.
- Derived types for batch summary rows and employee-month detail rows.
- Optional helper selectors for query and export.

## Testing

Coverage should include:

- Period range filter returns only batches/items in range.
- Employee and department filters reduce both summary and tables.
- Batch tab aggregates by batch.
- Detail tab aggregates by employee-month.
- Summary cards match the filtered dataset.
- Row expansion renders the expected detail fields.
- Export uses the active tab and active filters.
- Empty state appears when no rows match.
- Build and lint pass for the payroll report page.

## Implementation Order

1. Add the route and shared filter bar.
2. Implement the batch summary tab.
3. Implement the employee-month detail tab.
4. Add row expansion and export.
5. Add tests for aggregation and tab behavior.
