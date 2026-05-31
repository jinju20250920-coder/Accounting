# Multi-Currency Accounting and FX Revaluation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Do not hardcode exchange rates, currencies, or revaluation results.

**Goal:** Add first-class multi-currency accounting support with account-set base currency, currency master data, daily middle exchange rates, foreign-currency bank accounts, optional foreign-currency voucher lines, and a month-end FX revaluation preview that covers foreign-currency bank, AR, and AP balances before generating a posting voucher.

**Architecture:** The system keeps the account set's base currency as the reporting and posting currency, stores original currency and exchange-rate metadata on supported transactions, derives base-currency amounts from source currency amounts and rates, and computes month-end FX revaluation as a preview from existing open-item balances before creating a confirming voucher.

**Tech Stack:** Existing Next.js App Router, React, TypeScript, current SQLite persistence layer, existing voucher/account-set/bank/AR/AP modules, and current accounting period controls.

---

# 1. Background

The current financial model is effectively single-currency. Bank accounts, vouchers, and open items do not consistently preserve original currency and exchange-rate information, which makes it impossible to:

- Distinguish `100 USD` from `100 CNY`.
- Revalue foreign-currency balances at month end.
- Generate consistent FX gain/loss adjustment vouchers.
- Keep bank, AR, AP, and GL modules aligned on a single base-currency ledger.

This design introduces a multi-currency foundation without rewriting the entire product at once.

# 2. Scope

## Included

- Account-set base currency configuration.
- Currency master data.
- Daily exchange-rate table with middle rate only.
- Bank account currency assignment.
- Optional currency fields on general ledger voucher entries.
- Mandatory currency fields on foreign-currency bank account entries.
- Foreign-currency AR/AP open-item revaluation support.
- Month-end FX revaluation preview and confirmation flow.
- FX gain/loss adjustment voucher generation after confirmation.

## Excluded

- Buy/sell rate maintenance.
- Automated intraday rate updates.
- Auto-posting month-end FX vouchers without user confirmation.
- Full historical restatement of all legacy data.
- Rewriting all report pages into multi-currency views in one pass.
- Advanced hedge accounting.
- Multi-company consolidation.

# 3. Core Design Principles

## 3.1 Base Currency

Each account set must have a configurable base currency. All financial statements, ledgers, and standard summaries use the account-set base currency as the default display and posting currency.

## 3.2 Dual Amount Model

For any foreign-currency supported business object, store both:

- Original currency amount.
- Base-currency amount.
- Exchange rate used for conversion.

Formula:

`baseAmount = originalAmount * exchangeRate`

Rounding follows existing monetary rounding utilities and stored precision rules.

## 3.3 Source of Truth

The source records remain the primary source of truth. FX revaluation is always derived from persisted balances and open items, never from hardcoded adjustment fixtures.

## 3.4 Confirmation Before Posting

Month-end FX revaluation must first produce a preview. Only after the user confirms the preview should the system generate the adjustment voucher.

# 4. Data Model

## 4.1 Account Set

Add a base currency field to account sets:

- `baseCurrencyCode`

This value is required for new account sets and editable for existing account sets if no incompatible multi-currency balances exist.

## 4.2 Currency Master

Add a currency master table with at least:

- `code` - ISO-like currency code such as `CNY`, `USD`, `EUR`.
- `name` - display name.
- `symbol` - display symbol.
- `precision` - decimal precision.
- `enabled` - whether the currency can be selected.
- `createdAt` / `updatedAt`.

## 4.3 Daily Exchange Rates

Add a daily rate table with:

- `currencyCode`
- `rateDate`
- `middleRate`
- `createdAt`
- `updatedAt`

Only middle rate is maintained in this phase.

## 4.4 Bank Accounts

Bank accounts must store:

- `currencyCode`

Foreign-currency bank accounts require a non-base currency code.

## 4.5 Voucher Entries

Voucher entry records must support optional currency metadata:

- `currencyCode`
- `exchangeRate`
- `originalAmount`
- `localAmount`

Rules:

- Foreign-currency bank account entries must populate all four fields.
- General ledger entries may leave currency metadata empty for base-currency-only transactions.
- If currency metadata exists, `localAmount` must remain consistent with `originalAmount * exchangeRate`.

## 4.6 AR/AP Open Items

AR/AP open items must persist:

- Original currency.
- Open original amount.
- Open base-currency amount.
- Locked transaction rate where applicable.
- Settlement status.

These values are required for month-end revaluation.

# 5. Functional Requirements

## 5.1 Account-Set Base Currency

- The account set editor must allow selecting a base currency.
- The selected base currency is used as the default posting currency.
- Existing account sets without a base currency should default to `CNY` during migration unless their stored data already indicates a different valid base currency.

## 5.2 Currency Master Management

- Users can add, edit, enable, and disable currencies.
- Disabled currencies must not be selectable in new bank accounts or new foreign-currency transactions.
- Currency code must be unique.

## 5.3 Daily Exchange Rate Maintenance

- Users can maintain one middle rate per currency per date.
- If a rate is missing for the selected date, the system must block auto-conversion for foreign-currency bank entries and prompt the user to enter or select a valid rate.
- Manual override of the middle rate is allowed at entry time where business requires it.

## 5.4 Foreign-Currency Bank Accounts

- Foreign-currency bank accounts must require a currency code.
- Bank entries for these accounts must require:
  - currency code
  - original amount
  - exchange rate
  - base-currency amount
- The system should auto-fill exchange rate from the daily rate table when available.
- Users may adjust the rate before saving.

## 5.5 General Ledger Entries

- General ledger voucher lines may optionally carry currency metadata.
- If currency metadata is filled, the line must validate the amount conversion.
- Base-currency-only lines remain allowed and continue to behave as today.

## 5.6 AR/AP Open Item Revaluation

- Foreign-currency AR/AP open balances must be included in month-end revaluation.
- The system revalues only unpaid / uncollected / open balances.
- Settled items are excluded from revaluation.
- Differences between locked transaction value and period-end revalued value become FX gains or losses.

## 5.7 Month-End FX Revaluation Preview

- The system must provide a preview screen before posting the month-end FX adjustment voucher.
- The preview must show:
  - target period
  - selected end-of-period rate
  - affected balances by module
  - original currency amount
  - pre-adjustment base amount
  - post-revaluation base amount
  - difference
  - gain/loss direction
- The user must confirm the preview before the system generates the voucher.

## 5.8 FX Adjustment Voucher Generation

- After confirmation, the system generates a posted voucher.
- The voucher must balance automatically.
- FX losses and gains must post to the configured FX gain/loss account.
- The voucher must link back to the source revaluation run for auditability.

# 6. Module Impact

## 6.1 Bank Module

- Add bank account currency.
- Add currency handling to bank transactions.
- Preserve original amount and rate on imported or manually entered foreign-currency transactions.

## 6.2 General Ledger

- Preserve currency fields on voucher lines where relevant.
- Keep base-currency posting as the accounting default.

## 6.3 AR/AP

- Preserve foreign-currency open-item balances.
- Use locked transaction rates for settlement comparison.
- Participate in month-end revaluation.

## 6.4 Reports

- Existing reports should continue to aggregate in base currency by default.
- Where helpful, display original currency as auxiliary information.

# 7. User Experience

## 7.1 Configuration

- The account set settings page should expose base currency and currency master access.
- Bank account editing should expose currency selection.

## 7.2 Entry Forms

- For foreign-currency bank accounts, currency and rate fields should be visible by default.
- For base-currency-only entries, currency fields can remain hidden or optional.

## 7.3 Month-End Workflow

- The revaluation page should present a preview-first flow:
  1. Select period.
  2. Load affected balances.
  3. Review preview.
  4. Confirm and post voucher.

# 8. Validation Rules

- Currency code must exist in the currency master and be enabled.
- Exchange rate must be greater than zero.
- Foreign-currency bank entries must not save without a currency code and base-currency conversion.
- Revaluation must only include open AR/AP items and foreign-currency bank balances.
- The generated FX adjustment voucher must be balanced.

# 9. Migration Strategy

- Add new nullable columns first.
- Backfill account-set base currency to `CNY` where missing.
- Default existing base-currency-only records to zero currency metadata.
- Do not alter existing posted voucher amounts during migration.
- Keep the rollout compatible with the current single-currency data so the app remains usable during transition.

# 10. Acceptance Criteria

- An account set can be configured with a base currency.
- Multiple currencies can be maintained and enabled.
- Daily middle exchange rates can be stored and queried by date.
- Foreign-currency bank accounts require currency metadata.
- General ledger lines can optionally carry currency metadata.
- AR/AP open balances are included in month-end revaluation.
- The revaluation screen shows a preview before posting.
- Confirming the preview generates a balanced FX adjustment voucher.
- Existing base-currency flows continue to work without forced currency input.

# 11. Non-Goals

- Multi-rate market spread support.
- Auto-posting FX adjustment without approval.
- Forward contracts or hedge accounting.
- Cross-company consolidation.
- Rewriting the entire reporting layer in one pass.

