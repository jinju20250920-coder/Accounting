# Multi-Currency FX Revaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account-set base currency, multi-currency master data, daily middle exchange rates, foreign-currency bank account support, optional foreign-currency voucher metadata, and preview-first month-end FX revaluation for bank, AR, and AP balances.

**Architecture:** Keep currency master data, daily rates, and revaluation runs in the persistence layer; keep the conversion/revaluation math in a pure helper module; keep the UI pages focused on configuration, preview, and confirmation. The first phase should be bank-led but include AR/AP open-item revaluation in the same preview flow, so the product has one consistent multicurrency foundation instead of separate ad hoc features.

**Tech Stack:** Next.js App Router, React, TypeScript, Zustand stores, existing SQLite service/manager layer, existing UI primitives (`Tabs`, `Table`, `Dialog`, `Select`, `Badge`, `Button`), existing accounting utilities.

---

## File Map

- Create: `src/lib/fx-revaluation.ts`
- Create: `src/stores/useFxRateStore.ts`
- Create: `src/app/exchange/page.tsx`
- Create: `test-multicurrency-fx.ts`
- Modify: `src/types/index.ts`
- Modify: `src/stores/useAccountSetStore.ts`
- Modify: `src/stores/useCurrencyStore.ts`
- Modify: `src/stores/useBankAccountStore.ts`
- Modify: `src/stores/useVoucherStore.ts`
- Modify: `src/lib/accounting.ts`
- Modify: `src/lib/voucher-journal.ts`
- Modify: `src/lib/database/sqlite-manager.ts`
- Modify: `src/lib/database/sqlite-service.ts`
- Modify: `src/lib/database/service.ts`
- Modify: `src/lib/database/account-set-db-manager.ts`
- Modify: `src/app/sets/page.tsx`
- Modify: `src/app/settings/currencies/page.tsx`
- Modify: `src/app/settings/bank-accounts/page.tsx`
- Modify: `src/app/voucher-entry-page/page.tsx`
- Modify: `src/app/voucher-list/page.tsx`
- Modify: `src/app/import/page.tsx`
- Modify: `src/app/aging/ar/page.tsx`
- Modify: `src/app/aging/ap/page.tsx`

---

### Task 1: Persist the multicurrency data model and migration path

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/database/sqlite-manager.ts`
- Modify: `src/lib/database/sqlite-service.ts`
- Modify: `src/lib/database/service.ts`
- Modify: `src/lib/database/account-set-db-manager.ts`
- Modify: `src/stores/useAccountSetStore.ts`
- Modify: `src/stores/useCurrencyStore.ts`
- Create: `test-multicurrency-fx.ts`

- [ ] **Step 1: Write the failing persistence test**

```ts
import assert from 'node:assert/strict';
import { sqliteService } from './src/lib/database/sqlite-service';

async function main() {
  sqliteService.setAccountSetId('set_fx_test');

  await sqliteService.saveCurrencies([
    { id: 'cny', code: 'CNY', name: '人民币', symbol: '¥', precision: 2, enabled: true, accountSetId: 'set_fx_test', createTime: '2026-06-01T00:00:00.000Z', updateTime: '2026-06-01T00:00:00.000Z' },
    { id: 'usd', code: 'USD', name: '美元', symbol: '$', precision: 2, enabled: true, accountSetId: 'set_fx_test', createTime: '2026-06-01T00:00:00.000Z', updateTime: '2026-06-01T00:00:00.000Z' },
  ]);

  const currencies = await sqliteService.getAllCurrencies();
  assert.equal(currencies.some((c) => c.code === 'USD'), true);

  const accountSet = await sqliteService.getAccountSetById('set_fx_test');
  assert.equal(accountSet?.baseCurrency, 'CNY');

  const rates = await sqliteService.getFxRates?.('USD', '2026-06-01');
  assert.equal(rates?.middleRate, 7.12);
}

main();
```

- [ ] **Step 2: Run the test to verify the current code fails for missing schema/helpers**

Run:
`npx.cmd tsc test-multicurrency-fx.ts --outDir tmp\test-multicurrency-fx --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck`

Expected: fail until `baseCurrency`, `fx_rates`, `fx_revaluation_runs`, and the corresponding service methods exist.

- [ ] **Step 3: Add the schema and domain types**

Add:
- `AccountSet.baseCurrencyCode` / keep existing `baseCurrency` compatibility during migration
- `Currency` master fields: `code`, `name`, `symbol`, `precision`, `enabled`
- `FxRate` fields: `currencyCode`, `rateDate`, `middleRate`
- `VoucherEntry` currency metadata: `currencyCode`, `exchangeRate`, `originalAmount`, `localAmount`
- `BankAccountBinding.currency`
- `FxRevaluationRun` / `FxRevaluationRunItem` for preview auditability

Keep the storage logic backward-compatible:
- existing base-currency-only records continue to load
- legacy currency exchange-rate values are not used as the source of truth for conversion
- base currency defaults to `CNY` only when a stored account set has no explicit value

- [ ] **Step 4: Implement the SQLite migration helpers**

Add schema migration for:
- `accountSets.baseCurrency`
- `fx_rates`
- `fx_revaluation_runs`
- `fx_revaluation_run_items`
- `bank_account_bindings.currency`
- `voucher entries` currency columns where they are still missing

The service layer must expose read/write methods for:
- saving and querying daily middle rates
- saving and querying FX revaluation runs and preview items
- persisting bank account currency assignments
- persisting optional voucher line currency metadata

- [ ] **Step 5: Run the TypeScript build**

Run:
`npx.cmd tsc --noEmit --pretty false`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/database/sqlite-manager.ts src/lib/database/sqlite-service.ts src/lib/database/service.ts src/lib/database/account-set-db-manager.ts src/stores/useAccountSetStore.ts src/stores/useCurrencyStore.ts test-multicurrency-fx.ts
git commit -m "feat: add multicurrency persistence foundation"
```

### Task 2: Add base-currency and daily-rate configuration UI

**Files:**
- Modify: `src/app/sets/page.tsx`
- Modify: `src/app/settings/currencies/page.tsx`
- Create: `src/stores/useFxRateStore.ts`
- Modify: `src/stores/useCurrencyStore.ts`
- Modify: `src/stores/useAccountSetStore.ts`

- [ ] **Step 1: Add the failing UI/store assertions**

Extend the multicurrency test coverage so it checks that:

```ts
assert.equal(accountSet?.baseCurrency, 'CNY');
assert.equal(typeof fxRateStore.getRate('USD', '2026-06-01'), 'number');
```

Also assert that disabled currencies are not returned by the selectable currency list.

- [ ] **Step 2: Implement the account-set base currency selector**

The account-set editor must expose base currency in `src/app/sets/page.tsx`, using the existing account set form and persisting through `useAccountSetStore`.

The form should:
- default new account sets to `CNY`
- load existing saved values
- not silently overwrite a saved base currency during unrelated edits

- [ ] **Step 3: Split currency master from daily rates**

In `src/app/settings/currencies/page.tsx`, keep the current currency master list, but add a dedicated daily-rate section that reads/writes `fx_rates` through `src/stores/useFxRateStore.ts`.

The daily-rate UI should:
- pick a `rateDate`
- pick a `currencyCode`
- edit a single `middleRate`
- show the current rate history by date
- prevent selecting disabled currencies

- [ ] **Step 4: Remove the old “exchange rate as master source of truth” behavior**

`src/stores/useCurrencyStore.ts` must remain the currency master source, but it must not drive conversion logic for FX transactions. Conversion logic must read the daily middle rate store.

- [ ] **Step 5: Run page-focused verification**

Run:
`npx.cmd tsc --noEmit --pretty false`
`npx.cmd eslint src/app/sets/page.tsx src/app/settings/currencies/page.tsx src/stores/useFxRateStore.ts src/stores/useCurrencyStore.ts src/stores/useAccountSetStore.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/sets/page.tsx src/app/settings/currencies/page.tsx src/stores/useFxRateStore.ts src/stores/useCurrencyStore.ts src/stores/useAccountSetStore.ts
git commit -m "feat: add base currency and daily fx rate settings"
```

### Task 3: Wire foreign-currency bank accounts and optional voucher metadata

**Files:**
- Modify: `src/stores/useBankAccountStore.ts`
- Modify: `src/app/settings/bank-accounts/page.tsx`
- Modify: `src/app/import/page.tsx`
- Modify: `src/stores/useVoucherStore.ts`
- Modify: `src/lib/voucher-journal.ts`
- Modify: `src/app/voucher-entry-page/page.tsx`
- Modify: `src/app/voucher-list/page.tsx`
- Modify: `src/lib/bank-parsers/types.ts`
- Modify: `src/lib/database/sqlite-service.ts`

- [ ] **Step 1: Add the failing flow assertions**

Extend `test-multicurrency-fx.ts` so it covers:

```ts
const bankBinding = await bankStore.addBinding({
  accountSetId: 'set_fx_test',
  accountNumber: 'USD-001',
  bankId: 'bank-usd',
  bankName: 'USD Bank',
  aliasName: '美元户',
  subSubjectCode: '1002',
  subSubjectName: '银行存款',
  branch: '上海',
  currency: 'USD',
  isDefault: true,
});

assert.equal(bankBinding.currency, 'USD');
```

And voucher lines can carry optional currency metadata without breaking base-currency-only lines.

- [ ] **Step 2: Require currency metadata for foreign-currency bank accounts**

`src/app/settings/bank-accounts/page.tsx` and `src/stores/useBankAccountStore.ts` must require:
- `currency`
- `originalAmount`
- `exchangeRate`
- `localAmount`

for foreign-currency bank accounts/transactions. Base-currency-only entries may keep the fields hidden or optional.

- [ ] **Step 3: Read the daily middle rate when entering foreign-currency bank data**

`src/app/import/page.tsx` and any bank-entry flow must auto-fill the daily middle rate when a matching date/currency rate exists, and must block save if the rate is missing for a foreign-currency bank entry.

- [ ] **Step 4: Preserve optional currency metadata on voucher rows**

`src/stores/useVoucherStore.ts`, `src/app/voucher-entry-page/page.tsx`, `src/lib/voucher-journal.ts`, and `src/app/voucher-list/page.tsx` must accept optional currency fields on voucher lines, render them where helpful, and keep base-currency posting as the default behavior.

- [ ] **Step 5: Run the integration build**

Run:
`npx.cmd tsc --noEmit --pretty false`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/useBankAccountStore.ts src/app/settings/bank-accounts/page.tsx src/app/import/page.tsx src/stores/useVoucherStore.ts src/lib/voucher-journal.ts src/app/voucher-entry-page/page.tsx src/app/voucher-list/page.tsx src/lib/bank-parsers/types.ts src/lib/database/sqlite-service.ts
git commit -m "feat: support foreign currency bank and voucher metadata"
```

### Task 4: Build the FX revaluation engine, preview page, and posting flow

**Files:**
- Create: `src/lib/fx-revaluation.ts`
- Create: `src/app/exchange/page.tsx`
- Modify: `src/lib/accounting.ts`
- Modify: `src/lib/database/sqlite-service.ts`
- Modify: `src/stores/useVoucherStore.ts`
- Modify: `src/app/voucher-list/page.tsx`
- Modify: `src/app/aging/ar/page.tsx`
- Modify: `src/app/aging/ap/page.tsx`
- Create: `test-fx-revaluation.ts`

- [ ] **Step 1: Write the failing revaluation test**

```ts
import assert from 'node:assert/strict';
import { buildFxRevaluationPreview, buildFxRevaluationVoucher } from './src/lib/fx-revaluation';

const preview = buildFxRevaluationPreview({
  period: '2026-06',
  baseCurrencyCode: 'CNY',
  fxRates: [
    { currencyCode: 'USD', rateDate: '2026-06-30', middleRate: 7.2 },
  ],
  bankBalances: [
    { accountId: 'bank-usd', currencyCode: 'USD', originalAmount: 1000, bookLocalAmount: 7000, source: 'bank' },
  ],
  openItems: [
    { itemId: 'ar-1', module: 'ar', currencyCode: 'USD', originalOpenAmount: 500, bookLocalAmount: 3500, lockedRate: 7.0 },
  ],
});

assert.equal(preview.items.length > 0, true);
assert.equal(preview.summary.netDifference !== 0, true);

const voucher = buildFxRevaluationVoucher(preview);
assert.equal(voucher.entries.reduce((sum, entry) => sum + entry.debit - entry.credit, 0), 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
`npx.cmd tsc test-fx-revaluation.ts --outDir tmp\\test-fx-revaluation --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck`

Expected: fail until the helper module and the revaluation tables exist.

- [ ] **Step 3: Implement the pure revaluation helper**

`src/lib/fx-revaluation.ts` must:
- accept persisted bank balances and AR/AP open items
- compare book local amount vs. revalued local amount at the selected middle rate
- produce separate preview rows for bank / AR / AP
- determine gain vs. loss direction from the delta sign
- build a balanced posting voucher using the configured FX gain/loss subject from the currency master or account set configuration

- [ ] **Step 4: Build the preview-first UI**

`src/app/exchange/page.tsx` must:
- let the user choose a period
- load all affected balances
- show a preview table before posting
- show totals by source module
- show the gain/loss voucher lines that will be posted
- require a confirm action before creating the voucher

The page must not auto-post.

- [ ] **Step 5: Link the posting result back to source records**

When a revaluation run is confirmed:
- persist the run record and its items
- create a posted voucher
- link the voucher back to the run for auditability
- keep the original balances intact so later runs can be traced

- [ ] **Step 6: Extend period-close and aging screens where needed**

`src/app/aging/ar/page.tsx` and `src/app/aging/ap/page.tsx` should surface the original currency and local amount fields where helpful, but they must still default to base-currency presentation.

- [ ] **Step 7: Run the final verification set**

Run:
`npx.cmd tsc --noEmit --pretty false`
`npx.cmd eslint src/app/exchange/page.tsx src/lib/fx-revaluation.ts src/stores/useVoucherStore.ts src/app/voucher-list/page.tsx src/lib/accounting.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/fx-revaluation.ts src/app/exchange/page.tsx src/lib/accounting.ts src/lib/database/sqlite-service.ts src/stores/useVoucherStore.ts src/app/voucher-list/page.tsx src/app/aging/ar/page.tsx src/app/aging/ap/page.tsx test-fx-revaluation.ts
git commit -m "feat: add fx revaluation preview and posting"
```

## Self-Review

- Spec coverage: base currency, currency master, daily middle rates, foreign-currency bank accounts, optional voucher metadata, AR/AP revaluation, preview-first posting, and auditability are each assigned to at least one task.
- Placeholder scan: no TBD/TODO placeholders were introduced.
- Type consistency: `FxRate`, `FxRevaluationRun`, `FxRevaluationRunItem`, and the optional currency metadata fields are used consistently across the plan.
- Scope check: the plan stays within the confirmed first phase and does not add buy/sell rates, hedge accounting, or auto-posting without confirmation.
