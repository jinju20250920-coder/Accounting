# Payroll Monthly Copy Settings Voucher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a practical payroll workflow for copying last month's payroll, applying regional contribution defaults, surfacing tax defaults, and generating a payroll accrual voucher.

**Architecture:** Keep payroll calculation rules in focused library modules, keep persistence/actions in `usePayrollStore`, and keep UI orchestration in the existing payroll page. Voucher generation creates a preview first, then saves a balanced draft voucher only after user confirmation.

**Tech Stack:** Next.js App Router, React, Zustand, existing SQLite service wrappers, TypeScript tests, Playwright smoke checks.

---

### Task 1: Payroll Defaults Library

**Files:**
- Create: `src/lib/payroll-defaults.ts`
- Modify: `src/lib/payroll.ts`
- Test: `test-payroll-monthly-integration.ts`

- [ ] Add region templates for Shanghai, Beijing, Shenzhen, and a generic default.
- [ ] Export `applyPayrollRegionPreset(config, regionId)` to merge contribution rates and bases into the current payroll config while preserving individual tax settings.
- [ ] Export `getDefaultPayrollRegionId(accountSet)` to read `payrollRegionId` from the account set, defaulting to `generic`.

### Task 2: Copy Previous Month

**Files:**
- Modify: `src/stores/usePayrollStore.ts`
- Modify: `src/app/payroll/page.tsx`
- Test: `test-payroll-store-contract.ts`
- Test: `test-payroll-monthly-integration.ts`

- [ ] Add `copyPreviousPeriod(period, mode)` to the payroll store.
- [ ] Load the previous period's latest batch, copy `inputData`, create or update the current period batch, and recalculate with current period settings.
- [ ] Add a payroll page button for copying last month, with append/replace handling based on whether current rows exist.

### Task 3: Settings UX

**Files:**
- Modify: `src/app/payroll/page.tsx`
- Test: `test-payroll-monthly-integration.ts`

- [ ] Show individual tax defaults before social insurance in the calculation settings dialog.
- [ ] Add a region preset selector that fills social insurance and housing fund defaults.
- [ ] Keep every default editable after applying the preset.

### Task 4: Payroll Accrual Voucher Preview and Save

**Files:**
- Create: `src/lib/payroll-voucher.ts`
- Modify: `src/stores/usePayrollStore.ts`
- Modify: `src/app/payroll/page.tsx`
- Test: `test-payroll-monthly-integration.ts`

- [ ] Generate balanced accrual entries from calculated payroll items.
- [ ] Preview entries in a dialog before saving.
- [ ] Save a draft general voucher through the existing database service after confirmation.

### Verification

- [ ] Run `npx.cmd eslint src\app\payroll\page.tsx src\stores\usePayrollStore.ts src\lib\payroll-defaults.ts src\lib\payroll-voucher.ts test-payroll-monthly-integration.ts test-payroll-store-contract.ts`.
- [ ] Run the directed TypeScript test bundle for payroll tests.
- [ ] Run Playwright smoke checks for copying, applying a region preset, and showing voucher preview.
- [ ] Run `npm.cmd run build`.
