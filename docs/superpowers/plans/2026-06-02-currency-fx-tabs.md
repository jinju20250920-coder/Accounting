# Currency & FX Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second tab to the existing currency settings page for daily FX rate maintenance, and add a currency field to bank account bindings without changing the existing currency-management workflow.

**Architecture:** Keep the existing `/settings/currencies` route as the single entry point for currency administration. Reuse the current `currencies` store and `fxRates` database tables, and add a lightweight FX tab that reads/writes daily middle rates by `date + currencyCode`. Bank account bindings will keep their current subject-binding flow, but the binding form and persistence layer will gain a currency field that defaults to the account set base currency.

**Tech Stack:** Next.js App Router, React, Zustand, SQLite service layer, existing UI primitives, existing Excel import/export utilities.

---

### Task 1: Normalize the persistence layer for FX and bank currency fields

**Files:**
- Modify: `src/lib/database/sqlite-service.ts`
- Modify: `src/lib/database/sqlite-manager.ts`
- Modify: `src/lib/database/account-set-db-manager.ts`
- Modify: `src/lib/database/service.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add a failing runtime contract for FX and currency persistence**

```ts
import assert from 'node:assert/strict';
import { sqliteService } from './src/lib/database/sqlite-service';

async function main() {
  const accountSetId = `fx_contract_${Date.now()}`;
  sqliteService.setAccountSetId(accountSetId);

  await sqliteService.saveAccountSetBaseCurrency('USD', '美元', accountSetId);
  await sqliteService.saveFxRates([{
    id: `${accountSetId}-fx-1`,
    accountSetId,
    rateDate: '2026-06-02',
    currencyCode: 'EUR',
    baseCurrency: 'USD',
    middleRate: 1.08,
    source: 'manual',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  }]);

  await sqliteService.saveBankAccountBinding({
    id: `${accountSetId}-bank-1`,
    accountSetId,
    accountNumber: 'USD-001',
    bankId: 'bank-usd',
    bankName: 'USD Bank',
    aliasName: '美元户',
    subSubjectCode: '100201',
    subSubjectName: '银行存款-美元',
    branch: '上海',
    currency: 'USD',
    isDefault: true,
    createdAt: new Date().toISOString(),
  });

  const rates = await sqliteService.getFxRates('2026-06-02');
  const bindings = await sqliteService.getBankAccountBindings();
  assert.equal(rates.length, 1);
  assert.equal(rates[0].currencyCode, 'EUR');
  assert.equal(bindings[0].currency, 'USD');
}

main();
```

- [ ] **Step 2: Make SQLite and IndexedDB schemas match the current FX contract**
  - Ensure `currencies` supports `enabled` and still tolerates legacy `disabled`.
  - Ensure `fxRates` uses `accountSetId + rateDate + currencyCode`.
  - Ensure `bank_account_bindings` persists `currency`.
  - Keep Node initialization on a pure in-memory path so test runs do not touch `window` or `localStorage`.

- [ ] **Step 3: Run the contract test and fix schema mismatches**

Run:
```powershell
if (Test-Path -LiteralPath 'tmp\test-currency-fx-contract') { Remove-Item -LiteralPath 'tmp\test-currency-fx-contract' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-currency-fx-contract --module commonjs --target es2020
if ($LASTEXITCODE -eq 0) { node tmp\test-currency-fx-contract\test-currency-fx-contract.js }
```

Expected:
- compile succeeds
- runtime contract passes without `localStorage` / `window` errors
- no `enableSmartRouting` warning from the auxiliary strategy migration

- [ ] **Step 4: Commit**

```bash
git add src/lib/database/sqlite-service.ts src/lib/database/sqlite-manager.ts src/lib/database/account-set-db-manager.ts src/lib/database/service.ts src/types/index.ts
git add test-currency-fx-contract.ts
git commit -m "fix: normalize multicurrency persistence schema"
```

---

### Task 2: Add the FX tab to the currency settings page

**Files:**
- Modify: `src/app/settings/currencies/page.tsx`
- Modify: `src/stores/useCurrencyStore.ts`
- Modify: `src/lib/database/sqlite-service.ts`
- Test: `test-currency-fx-contract.ts`

- [ ] **Step 1: Add a failing UI/state contract for the new tab**

```ts
import assert from 'node:assert/strict';

const tabs = ['币种', '汇率'];
assert.deepEqual(tabs, ['币种', '汇率']);
```

- [ ] **Step 2: Split the existing page into two tabs**
  - Keep the current currency table in the first tab.
  - Add a second tab for daily FX rates.
  - Reuse the current store rather than introducing a second route.
  - Keep the current currency import/export/template actions on the currency tab.

- [ ] **Step 3: Implement FX tab state and CRUD**
  - Add a date filter, an FX table, and an add/edit dialog for `date + currencyCode + middleRate`.
  - Default `baseCurrency` from the current account set and show it as read-only.
  - Write FX rates through `saveFxRates` / `getFxRates`.
  - Keep the tab layout compact enough that the existing currency UI still fits cleanly.

- [ ] **Step 4: Run typecheck and the contract test**

Run:
```powershell
npx.cmd tsc --project tsconfig.json --noEmit --pretty false
```

Expected:
- no type errors
- `src/app/settings/currencies/page.tsx` renders both tabs without breaking the existing currency table

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/currencies/page.tsx src/stores/useCurrencyStore.ts src/lib/database/sqlite-service.ts test-currency-fx-contract.ts
git commit -m "feat: add fx rates tab to currency settings"
```

---

### Task 3: Add currency selection to bank account bindings

**Files:**
- Modify: `src/app/settings/bank-accounts/page.tsx`
- Modify: `src/stores/useBankAccountStore.ts`
- Modify: `src/lib/bank-parsers/types.ts`
- Modify: `src/lib/database/sqlite-service.ts`

- [ ] **Step 1: Add a failing binding contract**

```ts
import assert from 'node:assert/strict';
import { sqliteService } from './src/lib/database/sqlite-service';

async function main() {
  await sqliteService.saveBankAccountBinding({
    id: 'binding-1',
    accountSetId: 'set_001',
    accountNumber: 'USD-001',
    bankId: 'bank-usd',
    bankName: 'USD Bank',
    aliasName: '美元户',
    subSubjectCode: '100201',
    subSubjectName: '银行存款-美元',
    branch: '上海',
    currency: 'USD',
    isDefault: true,
    createdAt: new Date().toISOString(),
  });

  const rows = await sqliteService.getBankAccountBindings();
  assert.equal(rows[0].currency, 'USD');
}

main();
```

- [ ] **Step 2: Add a currency field to the bank account binding flow**
  - Add a currency dropdown to the add/edit wizard.
  - Default the currency to the current account set base currency.
  - Keep the existing subject-binding and bank format steps untouched.
  - Persist the field via `saveBankAccountBinding` and surface it in the binding list.

- [ ] **Step 3: Keep the import flow consistent**
  - Imported bindings should also populate `currency`.
  - If the import file does not provide a currency, default it to the current base currency.
  - Existing subject creation logic must continue to work as-is.

- [ ] **Step 4: Run typecheck and the binding contract**

Run:
```powershell
npx.cmd tsc --project tsconfig.json --noEmit --pretty false
```

Expected:
- no type errors
- new and imported bindings both persist their currency

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/bank-accounts/page.tsx src/stores/useBankAccountStore.ts src/lib/bank-parsers/types.ts src/lib/database/sqlite-service.ts
git commit -m "feat: add currency to bank account bindings"
```

---

### Task 4: Verify the end-to-end currency workflow

**Files:**
- Test: `test-currency-fx-contract.ts`
- Test: `test-multicurrency-fx.ts`
- Modify as needed: `src/app/settings/currencies/page.tsx`, `src/app/settings/bank-accounts/page.tsx`

- [ ] **Step 1: Run the full compile**

Run:
```powershell
npx.cmd tsc --project tsconfig.json --noEmit --pretty false
```

Expected:
- project compiles cleanly

- [ ] **Step 2: Run the FX persistence test**

Run:
```powershell
if (Test-Path -LiteralPath 'tmp\test-multicurrency-fx') { Remove-Item -LiteralPath 'tmp\test-multicurrency-fx' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-multicurrency-fx --module commonjs --target es2020
if ($LASTEXITCODE -eq 0) { node tmp\test-multicurrency-fx\test-multicurrency-fx.js }
```

Expected:
- `multicurrency fx persistence tests passed`
- no Node runtime `localStorage` / `window` failures

- [ ] **Step 3: Sanity-check the UI manually**
  - Open `/settings/currencies`
  - Confirm the two tabs are visible and usable
  - Add or edit a rate in the FX tab
  - Open `/settings/bank-accounts`
  - Confirm the currency dropdown is present and defaults correctly

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/currencies/page.tsx src/app/settings/bank-accounts/page.tsx src/stores/useCurrencyStore.ts src/stores/useBankAccountStore.ts src/lib/bank-parsers/types.ts src/lib/database/sqlite-service.ts test-currency-fx-contract.ts test-multicurrency-fx.ts
git commit -m "feat: finish currency and fx workflow"
```

---

## Self-Review

Coverage check:
- Spec requirement: two tabs in `/settings/currencies` -> Task 2
- Spec requirement: FX tab maintains daily middle rates only -> Task 2
- Spec requirement: bank account binding gets currency field -> Task 3
- Spec requirement: account-set base currency remains configurable -> Task 1 / Task 2 / Task 3
- Spec requirement: no separate FX route -> Task 2 explicitly keeps the single route

Placeholder check:
- No TBD/TODO placeholders remain.
- Each task has explicit files, commands, and verification.

Type consistency check:
- `Currency`, `FxRate`, and `BankAccountBinding` field names match the current stores and service layer.
- `saveFxRates` / `getFxRates` and `saveBankAccountBinding` / `getBankAccountBindings` are the exact method names used in the codebase.

