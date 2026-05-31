# Payroll Report Dashboard UI Optimization Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a payroll reporting dashboard page with shared filters, summary KPI cards, and two tabs for batch-level and employee-month reporting using the same persisted payroll data source.

**Architecture:** The dashboard reads payroll batches and payroll items from the existing payroll data store, derives all summary values client-side, and never hardcodes report data. One page hosts two tabs: batch summary and employee-month detail. The page reuses current status values from persisted batch state and exports Excel based on the active tab and current filters.

**Tech Stack:** Next.js App Router, React, TypeScript, existing payroll store/database helpers, Tailwind UI components, XLSX export.

---

# 1. Background

The current payroll reporting experience is functional but not yet shaped like a financial SaaS dashboard. The first release should improve scanability and reporting efficiency without changing payroll calculation logic.

# 2. Scope

## Included

- A dedicated payroll report page at `/payroll/report`
- A side navigation entry under `薪酬管理`
- Shared filters for period range, employee, department, and status
- KPI summary cards derived from current filter results
- `按批次汇总` tab
- `按员工月份明细` tab
- Expandable batch and row detail sections
- Excel export for the active tab
- Empty state, loading state, and error state

## Excluded

- Payroll calculation logic
- Tax and social insurance calculation rules
- Trend charts
- Exception scoring and AI analysis
- PDF export
- Screenshot export
- New status categories beyond existing batch states

# 3. Data Sources

The report page must reuse the existing payroll data source:

- Payroll batches
- Payroll items per batch
- Persisted batch status
- Persisted voucher linkage fields when available

The page must not use hardcoded report fixtures for runtime behavior.

# 4. Functional Requirements

## 4.1 Shared Filters

- Period range filter using month selection
- Employee text filter by name or employee code
- Department filter
- Status filter
- Query, reset, and export actions

Filters apply to both tabs and to KPI cards.

## 4.2 KPI Summary

Display the following totals for the current filter result:

- Tax-before salary total
- Employee social insurance and housing fund total
- Individual income tax total
- Net salary total
- Employer total cost

## 4.3 Batch Tab

- Each row represents one payroll batch
- Show batch period, batch name, status, employee count, totals, and voucher label
- Support row expand/collapse to show employee rows inside the batch
- Support batch-level recalculation from the report page

## 4.4 Employee-Month Tab

- Each row represents one employee in one month
- Show month, employee code, employee name, department, totals, status, and voucher label
- Support row expand/collapse to show earning and deduction breakdown
- Support row-level voucher navigation and payslip export

## 4.5 Status Rules

Only the existing batch statuses are used:

- 草稿
- 已计算
- 已确认
- 已入账

Status is derived from persisted batch state and voucher linkage, not from a separate report-only model.

## 4.6 Export

- Export reflects the current tab and current filter result
- Batch tab export uses batch summary columns
- Detail tab export uses employee-month columns

# 5. UI Requirements

- Keep the page in a dashboard layout with clear hierarchy
- Use a compact filter bar
- Use tabular numerals for monetary values
- Right-align all numeric columns
- Provide loading and empty states
- Keep the sidebar entry under `薪酬管理`

# 6. Acceptance Criteria

- The report page loads from the existing payroll data source
- The two tabs show different views of the same filtered dataset
- KPI totals update when filters change
- Export output matches the active tab
- Status labels match persisted batch state
- No runtime report data is hardcoded

# 7. Non-Goals

- Trend lines, charts, and anomaly panels
- AI financial assistant features
- Extra status categories
- New backend storage structures solely for reporting
- Changes to payroll calculation formulas
