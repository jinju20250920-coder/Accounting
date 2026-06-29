# Opening Balance Unposted Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show which bank, partner, and fixed-asset opening rows are already posted, surface each row's unposted amount, and make the opening balance calculation and save flow use only the unposted remainder.

**Architecture:** Add a small pure helper in `src/lib/opening-balance-rules.ts` that parses posted opening-voucher entries into per-row posted balances and derives row status plus remaining amounts. The opening-balance page will render those statuses in the bank/partner/asset tabs and will feed only the unposted remainder into the opening-balance analysis and save logic.

**Tech Stack:** TypeScript, React, existing zustand stores, existing SQLite voucher persistence, existing shell-based test scripts.

---

### Task 1: Pure row-status helper

**Files:**
- Modify: `src/lib/opening-balance-rules.ts`
- Create: `test-opening-balance-unposted-status.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  collectPostedOpeningDetailIndex,
  deriveBankOpeningRowStates,
  derivePartnerOpeningRowStates,
  deriveAssetOpeningRowStates,
} from './src/lib/opening-balance-rules';

const index = collectPostedOpeningDetailIndex([
  { summary: '期初银行-基本户', debit: 100, credit: 0, auxiliary: { bankAccount: '6221' } },
  { summary: '期初应付-供应商A', debit: 0, credit: 200, auxiliary: { supplier: '供应商A' } },
  { summary: '期初资产-设备A', debit: 300, credit: 0, auxiliary: { assetCode: 'FA001' } },
  { summary: '期初累计折旧-设备A', debit: 0, credit: 80, auxiliary: { assetCode: 'FA001' } },
]);

const banks = deriveBankOpeningRowStates([{ accountNumber: '6221', bankName: '测试行', balance: 100 }, { accountNumber: '6222', bankName: '新增行', balance: 500 }], index);
const partners = derivePartnerOpeningRowStates([{ name: '供应商A', type: 'payable', amount: 200, remark: '' }, { name: '供应商B', type: 'payable', amount: 300, remark: '' }], index);
const assets = deriveAssetOpeningRowStates([{ assetCode: 'FA001', assetName: '设备A', originalValue: 300, accumulatedDepreciation: 80, netValue: 220, included: true }], index);

expect(banks[0].status).toBe('posted');
expect(banks[1].unpostedAmount).toBe(500);
expect(partners[0].status).toBe('posted');
expect(partners[1].unpostedAmount).toBe(300);
expect(assets[0].status).toBe('posted');
expect(assets[0].unpostedOriginalValue).toBe(0);
expect(assets[0].unpostedAccumulatedDepreciation).toBe(0);
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx.cmd tsc test-opening-balance-unposted-status.ts --outDir tmp\\test-opening-balance-unposted-status --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck`
Expected: fail because the helper exports do not exist yet.

- [ ] **Step 3: Implement the helper**

Add the posted-entry index and row-state derivation functions in `src/lib/opening-balance-rules.ts`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node tmp\\test-opening-balance-unposted-status\\test-opening-balance-unposted-status.js`
Expected: pass with `opening balance unposted status checks passed`.

### Task 2: Opening-balance page integration

**Files:**
- Modify: `src/components/account-set/setup-step-opening.tsx`

- [ ] **Step 1: Consume the row-state helper**

Use the derived row states to render bank/partner/asset status and unposted amounts, and to build the opening-balance analysis from only unposted detail.

- [ ] **Step 2: Update save logic**

Save only the unposted remainder for rows already partially or fully posted, and keep posted rows from being duplicated in the opening voucher.

- [ ] **Step 3: Show current status in the UI**

Add a status column and an unposted-amount column to the partner, bank, and asset tables.

- [ ] **Step 4: Verify in TypeScript and ESLint**

Run: `npx.cmd eslint src/lib/opening-balance-rules.ts src/components/account-set/setup-step-opening.tsx test-opening-balance-unposted-status.ts`
Run: `npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\\test-opening-balance-unposted-project --module commonjs --target es2020`

### Task 3: Regression check

**Files:**
- Existing project files

- [ ] **Step 1: Re-run the supplement merge test**

Run: `node tmp\\test-opening-supplement\\test-opening-balance-supplement.js`

- [ ] **Step 2: Re-run the main TypeScript build check**

Run: `npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\\test-opening-balance-unposted-project --module commonjs --target es2020`

