# Payroll Tax Rules Annual Bonus Voucher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable payroll tax rules, annual bonus tax calculation, employee payroll accounting mappings, and subject-aware payroll voucher generation.

**Architecture:** Keep tax calculation in focused library modules, keep persisted payroll actions in `usePayrollStore`, keep employee accounting mappings on the existing `Partner` employee card, and keep payroll UI orchestration in `src/app/payroll/page.tsx`. Voucher generation resolves subjects through a deterministic priority chain and still previews a balanced draft before saving.

**Tech Stack:** Next.js App Router, React, Zustand, existing SQLite service wrappers, TypeScript tests, ESLint, Playwright smoke tests.

---

## File Structure

- Create `src/lib/payroll-tax-rules.ts`: tax rule types, built-in salary/annual-bonus/business-income brackets, and rule resolution helpers.
- Modify `src/lib/payroll.ts`: add income type and annual bonus tax method fields, calculate regular salary and annual bonus through separate paths, and expose result metadata.
- Modify `src/lib/payroll-voucher.ts`: resolve voucher subjects by row, employee mapping, department defaults, account-set defaults, then fallback.
- Modify `src/types/index.ts`: add employee payroll accounting mapping fields to `Partner`.
- Modify `src/stores/usePartnerStore.ts`: preserve new employee payroll accounting fields in default, add, update, import, and export flows.
- Modify `src/app/settings/auxiliary/page.tsx`: show payroll accounting fields when the partner is marked as employee.
- Modify `src/app/payroll/page.tsx`: add tax settings icon/table dialog and annual bonus income type controls in the grid.
- Modify `test-payroll-monthly-integration.ts`: directed integration assertions for annual bonus tax and voucher subject resolution.
- Modify `test-payroll-store-contract.ts`: source-level contract assertions for store and UI paths.

---

### Task 1: Tax Rule Library and Annual Bonus Calculation

**Files:**
- Create: `src/lib/payroll-tax-rules.ts`
- Modify: `src/lib/payroll.ts`
- Test: `test-payroll-monthly-integration.ts`

- [ ] **Step 1: Write failing test coverage for annual bonus tax rules**

Add these assertions to `test-payroll-monthly-integration.ts` after the existing payroll imports:

```ts
const payrollSource = fs.readFileSync(path.join(rootDir, 'src/lib/payroll.ts'), 'utf8');
const payrollTaxRulesSource = fs.readFileSync(path.join(rootDir, 'src/lib/payroll-tax-rules.ts'), 'utf8');

assert(payrollSource.includes("incomeType?: PayrollIncomeType"), 'PayrollInput should support an income type');
assert(payrollSource.includes("annualBonusTaxMethod?: PayrollAnnualBonusTaxMethod"), 'PayrollInput should support annual bonus tax method');
assert(payrollSource.includes('calculateAnnualBonusTax'), 'payroll calculation should use the annual bonus engine');
assert(payrollTaxRulesSource.includes("ruleType: 'annual_bonus'"), 'annual bonus tax rules should be defined');
assert(payrollTaxRulesSource.includes("ruleType: 'business_income'"), 'business income tax rules should be defined');
```

Append a runtime assertion near the existing payroll calculation assertions:

```ts
const annualBonusConfig = createBlankPayrollCalculationConfig();
const annualBonusResult = calculatePayrollItem({
  ...createBlankPayrollInput(),
  employeeCode: 'EMP-BONUS',
  employeeName: 'Annual Bonus Employee',
  incomeType: 'annual_bonus',
  annualBonusTaxMethod: 'separate',
  bonus: 120000,
}, annualBonusConfig, 12);

assert.strictEqual(annualBonusResult.grossSalary, 120000, 'annual bonus gross salary should equal bonus amount');
assert.strictEqual(annualBonusResult.individualIncomeTax, 11790, 'annual bonus separate tax should use bonus / 12 bracket');
assert.strictEqual(annualBonusResult.taxCalculationType, 'annual_bonus_separate', 'annual bonus result should expose calculation type');
```

- [ ] **Step 2: Run the directed test and verify it fails**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-tax-red') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-tax-red' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-payroll-tax-red --module commonjs --target es2020
node tmp\test-payroll-tax-red\test-payroll-monthly-integration.js
```

Expected: FAIL because `src/lib/payroll-tax-rules.ts`, `incomeType`, and `calculateAnnualBonusTax` do not exist.

- [ ] **Step 3: Create tax rule types and built-in rules**

Create `src/lib/payroll-tax-rules.ts`:

```ts
export type PayrollTaxRuleType = 'salary' | 'annual_bonus' | 'business_income';

export interface PayrollTaxBracketRule {
  id: string;
  ruleType: PayrollTaxRuleType;
  effectiveDate: string;
  lowerLimit: number;
  upperLimit: number | null;
  rate: number;
  quickDeduction: number;
  isSystemPreset: boolean;
  isAccountSetCustom: boolean;
  enabled: boolean;
}

export const BUILT_IN_PAYROLL_TAX_RULES: PayrollTaxBracketRule[] = [
  { id: 'salary-2019-001', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 0, upperLimit: 36000, rate: 0.03, quickDeduction: 0, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'salary-2019-002', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 36000, upperLimit: 144000, rate: 0.1, quickDeduction: 2520, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'salary-2019-003', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 144000, upperLimit: 300000, rate: 0.2, quickDeduction: 16920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'salary-2019-004', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 300000, upperLimit: 420000, rate: 0.25, quickDeduction: 31920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'salary-2019-005', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 420000, upperLimit: 660000, rate: 0.3, quickDeduction: 52920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'salary-2019-006', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 660000, upperLimit: 960000, rate: 0.35, quickDeduction: 85920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'salary-2019-007', ruleType: 'salary', effectiveDate: '2019-01-01', lowerLimit: 960000, upperLimit: null, rate: 0.45, quickDeduction: 181920, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'annual-bonus-2019-001', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 0, upperLimit: 3000, rate: 0.03, quickDeduction: 0, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'annual-bonus-2019-002', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 3000, upperLimit: 12000, rate: 0.1, quickDeduction: 210, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'annual-bonus-2019-003', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 12000, upperLimit: 25000, rate: 0.2, quickDeduction: 1410, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'annual-bonus-2019-004', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 25000, upperLimit: 35000, rate: 0.25, quickDeduction: 2660, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'annual-bonus-2019-005', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 35000, upperLimit: 55000, rate: 0.3, quickDeduction: 4410, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'annual-bonus-2019-006', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 55000, upperLimit: 80000, rate: 0.35, quickDeduction: 7160, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'annual-bonus-2019-007', ruleType: 'annual_bonus', effectiveDate: '2019-01-01', lowerLimit: 80000, upperLimit: null, rate: 0.45, quickDeduction: 15160, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'business-income-2019-001', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 0, upperLimit: 30000, rate: 0.05, quickDeduction: 0, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'business-income-2019-002', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 30000, upperLimit: 90000, rate: 0.1, quickDeduction: 1500, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'business-income-2019-003', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 90000, upperLimit: 300000, rate: 0.2, quickDeduction: 10500, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'business-income-2019-004', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 300000, upperLimit: 500000, rate: 0.3, quickDeduction: 40500, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
  { id: 'business-income-2019-005', ruleType: 'business_income', effectiveDate: '2019-01-01', lowerLimit: 500000, upperLimit: null, rate: 0.35, quickDeduction: 65500, isSystemPreset: true, isAccountSetCustom: false, enabled: true },
];

export function getPayrollTaxRules(ruleType: PayrollTaxRuleType): PayrollTaxBracketRule[] {
  return BUILT_IN_PAYROLL_TAX_RULES
    .filter((rule) => rule.ruleType === ruleType && rule.enabled)
    .sort((a, b) => a.lowerLimit - b.lowerLimit);
}

export function findPayrollTaxBracket(ruleType: PayrollTaxRuleType, amount: number): PayrollTaxBracketRule {
  const rules = getPayrollTaxRules(ruleType);
  return rules.find((rule) => amount > rule.lowerLimit && (rule.upperLimit === null || amount <= rule.upperLimit))
    || rules[rules.length - 1];
}
```

- [ ] **Step 4: Extend payroll types and route annual bonus calculation**

In `src/lib/payroll.ts`, add:

```ts
import { findPayrollTaxBracket } from '@/lib/payroll-tax-rules';

export type PayrollIncomeType = 'salary' | 'annual_bonus' | 'business_income';
export type PayrollAnnualBonusTaxMethod = 'separate' | 'consolidated';
export type PayrollTaxCalculationType = 'salary_cumulative' | 'annual_bonus_separate' | 'annual_bonus_consolidated';
```

Extend `PayrollInput`:

```ts
incomeType?: PayrollIncomeType;
annualBonusTaxMethod?: PayrollAnnualBonusTaxMethod;
```

Extend `PayrollCalculationResult`:

```ts
taxCalculationType: PayrollTaxCalculationType;
annualBonusTaxMethod?: PayrollAnnualBonusTaxMethod;
annualBonusTaxableAverage?: number;
```

Set defaults in `createBlankPayrollInput()`:

```ts
incomeType: 'salary',
annualBonusTaxMethod: 'separate',
```

Add annual bonus helpers:

```ts
export function calculateAnnualBonusTax(annualBonusAmount: number): {
  tax: number;
  taxableAverage: number;
  rate: number;
  quickDeduction: number;
} {
  const taxableAverage = roundMoney(annualBonusAmount / 12);
  const bracket = findPayrollTaxBracket('annual_bonus', taxableAverage);
  return {
    tax: roundMoney(Math.max(0, annualBonusAmount * bracket.rate - bracket.quickDeduction)),
    taxableAverage,
    rate: bracket.rate,
    quickDeduction: bracket.quickDeduction,
  };
}
```

At the beginning of `calculatePayrollItem`, branch when `input.incomeType === 'annual_bonus' && input.annualBonusTaxMethod === 'separate'`:

```ts
const incomeType = input.incomeType || 'salary';
const annualBonusTaxMethod = input.annualBonusTaxMethod || 'separate';
if (incomeType === 'annual_bonus' && annualBonusTaxMethod === 'separate') {
  const grossSalary = roundMoney(input.bonus + input.otherEarnings + input.allowance - input.leaveDeduction - input.otherPreTaxDeduction);
  const annualBonusTax = calculateAnnualBonusTax(grossSalary);
  const netSalary = roundMoney(grossSalary - annualBonusTax.tax - (input.otherPostTaxDeduction ?? 0));
  return {
    employeeCode: input.employeeCode,
    employeeName: input.employeeName,
    departmentName: input.departmentName,
    grossSalary,
    socialInsuranceBase: 0,
    housingFundBase: 0,
    employeeSocialInsurance: 0,
    employerSocialInsurance: 0,
    employeeHousingFund: 0,
    employerHousingFund: 0,
    taxableIncomeCumulative: grossSalary,
    individualIncomeTax: annualBonusTax.tax,
    netSalary,
    employerTotalCost: grossSalary,
    taxCalculationType: 'annual_bonus_separate',
    annualBonusTaxMethod,
    annualBonusTaxableAverage: annualBonusTax.taxableAverage,
  };
}
```

For the existing regular path, return:

```ts
taxCalculationType: incomeType === 'annual_bonus' ? 'annual_bonus_consolidated' : 'salary_cumulative',
annualBonusTaxMethod: incomeType === 'annual_bonus' ? annualBonusTaxMethod : undefined,
```

- [ ] **Step 5: Run the directed test and commit**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-tax') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-tax' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-payroll-tax --module commonjs --target es2020
node tmp\test-payroll-tax\test-payroll-monthly-integration.js
```

Expected: PASS with `payroll monthly integration tests passed`.

Commit:

```powershell
git add -- src/lib/payroll-tax-rules.ts src/lib/payroll.ts test-payroll-monthly-integration.ts
git commit -m "Add annual bonus payroll tax engine"
```

---

### Task 2: Payroll UI Tax Settings and Income Type Controls

**Files:**
- Modify: `src/app/payroll/page.tsx`
- Test: `test-payroll-store-contract.ts`

- [ ] **Step 1: Write failing source assertions**

Add to `test-payroll-store-contract.ts`:

```ts
const payrollPageSource = fs.readFileSync(path.join(rootDir, 'src/app/payroll/page.tsx'), 'utf8');

assert(payrollPageSource.includes('taxSettingsOpen'), 'payroll page should have a tax settings dialog state');
assert(payrollPageSource.includes('Settings'), 'payroll page should render a settings icon for tax rules');
assert(payrollPageSource.includes('incomeType'), 'payroll grid should expose income type controls');
assert(payrollPageSource.includes('annualBonusTaxMethod'), 'payroll grid should expose annual bonus tax method controls');
assert(payrollPageSource.includes('BUILT_IN_PAYROLL_TAX_RULES'), 'tax settings dialog should render tax rule presets');
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-ui-red') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-ui-red' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-payroll-ui-red --module commonjs --target es2020
node tmp\test-payroll-ui-red\test-payroll-store-contract.js
```

Expected: FAIL because the tax settings dialog and controls are not present.

- [ ] **Step 3: Add imports and dialog state**

In `src/app/payroll/page.tsx`, import:

```ts
import { Settings } from 'lucide-react';
import { BUILT_IN_PAYROLL_TAX_RULES } from '@/lib/payroll-tax-rules';
```

Add state in `PayrollPage`:

```ts
const [taxSettingsOpen, setTaxSettingsOpen] = useState(false);
```

- [ ] **Step 4: Add income type and annual bonus method columns**

Add select controls in both draft and saved payroll row renderers:

```tsx
<select
  value={input.incomeType || 'salary'}
  onChange={(event) => onTextChange('incomeType' as keyof PayrollInput, event.target.value)}
  className="h-8 w-full border-0 bg-transparent px-2 text-xs outline-none"
>
  <option value="salary">工资薪金</option>
  <option value="annual_bonus">全年一次性奖金</option>
</select>
```

For rows where `input.incomeType === 'annual_bonus'`, render:

```tsx
<select
  value={input.annualBonusTaxMethod || 'separate'}
  onChange={(event) => onTextChange('annualBonusTaxMethod' as keyof PayrollInput, event.target.value)}
  className="h-8 w-full border-0 bg-transparent px-2 text-xs outline-none"
>
  <option value="separate">单独计税</option>
  <option value="consolidated">并入综合所得</option>
</select>
```

- [ ] **Step 5: Add tax settings icon and rate table dialog**

In the individual tax settings header, add:

```tsx
<Button variant="ghost" size="icon" onClick={() => setTaxSettingsOpen(true)} title="税率设置">
  <Settings className="h-4 w-4" />
</Button>
```

Add a dialog near the other payroll dialogs:

```tsx
<Dialog open={taxSettingsOpen} onOpenChange={setTaxSettingsOpen}>
  <DialogContent className="max-w-4xl">
    <DialogHeader>
      <DialogTitle>税率设置</DialogTitle>
      <DialogDescription>系统预设税率用于工资薪金、全年一次性奖金和经营所得计算。</DialogDescription>
    </DialogHeader>
    <div className="max-h-[60vh] overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50">
            <th className="border px-2 py-1 text-left">规则</th>
            <th className="border px-2 py-1 text-left">生效日期</th>
            <th className="border px-2 py-1 text-right">起点</th>
            <th className="border px-2 py-1 text-right">终点</th>
            <th className="border px-2 py-1 text-right">税率</th>
            <th className="border px-2 py-1 text-right">速算扣除数</th>
          </tr>
        </thead>
        <tbody>
          {BUILT_IN_PAYROLL_TAX_RULES.map((rule) => (
            <tr key={rule.id}>
              <td className="border px-2 py-1">{rule.ruleType}</td>
              <td className="border px-2 py-1">{rule.effectiveDate}</td>
              <td className="border px-2 py-1 text-right">{rule.lowerLimit}</td>
              <td className="border px-2 py-1 text-right">{rule.upperLimit ?? '以上'}</td>
              <td className="border px-2 py-1 text-right">{formatContributionRatePercent(rule.rate)}</td>
              <td className="border px-2 py-1 text-right">{rule.quickDeduction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 6: Run contract test and commit**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-ui') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-ui' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-payroll-ui --module commonjs --target es2020
node tmp\test-payroll-ui\test-payroll-store-contract.js
```

Expected: PASS with `payroll store contract tests passed`.

Commit:

```powershell
git add -- src/app/payroll/page.tsx test-payroll-store-contract.ts
git commit -m "Add payroll tax settings controls"
```

---

### Task 3: Employee Payroll Accounting Fields

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/stores/usePartnerStore.ts`
- Modify: `src/app/settings/auxiliary/page.tsx`
- Test: `test-payroll-store-contract.ts`

- [ ] **Step 1: Write failing source assertions**

Add to `test-payroll-store-contract.ts`:

```ts
const typesSource = fs.readFileSync(path.join(rootDir, 'src/types/index.ts'), 'utf8');
const partnerStoreSource = fs.readFileSync(path.join(rootDir, 'src/stores/usePartnerStore.ts'), 'utf8');
const auxiliaryPageSource = fs.readFileSync(path.join(rootDir, 'src/app/settings/auxiliary/page.tsx'), 'utf8');

assert(typesSource.includes('payrollSalaryExpenseSubjectCode'), 'Partner should store salary expense subject code');
assert(typesSource.includes('payrollContributionExpenseSubjectCode'), 'Partner should store contribution expense subject code');
assert(typesSource.includes('payrollSalaryPayableSubjectCode'), 'Partner should store salary payable subject code');
assert(typesSource.includes('payrollTaxPayableSubjectCode'), 'Partner should store tax payable subject code');
assert(typesSource.includes('payrollEmployeeContributionPayableSubjectCode'), 'Partner should store employee contribution payable subject code');
assert(partnerStoreSource.includes('payrollSalaryExpenseSubjectCode'), 'partner store should preserve payroll subject fields');
assert(auxiliaryPageSource.includes('工资核算设置'), 'auxiliary page should render employee payroll accounting settings');
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-employee-accounting-red') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-employee-accounting-red' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-employee-accounting-red --module commonjs --target es2020
node tmp\test-employee-accounting-red\test-payroll-store-contract.js
```

Expected: FAIL because employee payroll accounting fields do not exist.

- [ ] **Step 3: Extend Partner type**

In `src/types/index.ts`, add optional fields to `Partner`:

```ts
payrollSalaryExpenseSubjectCode?: string;
payrollSalaryExpenseSubjectName?: string;
payrollContributionExpenseSubjectCode?: string;
payrollContributionExpenseSubjectName?: string;
payrollSalaryPayableSubjectCode?: string;
payrollSalaryPayableSubjectName?: string;
payrollTaxPayableSubjectCode?: string;
payrollTaxPayableSubjectName?: string;
payrollEmployeeContributionPayableSubjectCode?: string;
payrollEmployeeContributionPayableSubjectName?: string;
payrollDepartmentName?: string;
payrollProjectName?: string;
payrollCostCenterName?: string;
```

- [ ] **Step 4: Preserve fields in partner store and form state**

In `src/stores/usePartnerStore.ts`, add these fields to the default employee record:

```ts
payrollSalaryExpenseSubjectCode: '660201',
payrollSalaryExpenseSubjectName: '管理费用-工资',
payrollContributionExpenseSubjectCode: '660203',
payrollContributionExpenseSubjectName: '管理费用-社保公积金',
payrollSalaryPayableSubjectCode: '2211',
payrollSalaryPayableSubjectName: '应付职工薪酬',
payrollTaxPayableSubjectCode: '2221',
payrollTaxPayableSubjectName: '应交税费-个人所得税',
payrollEmployeeContributionPayableSubjectCode: '2241',
payrollEmployeeContributionPayableSubjectName: '其他应付款-个人社保公积金',
```

In `src/app/settings/auxiliary/page.tsx`, extend `formData`, `handleEdit`, and `resetFormData` with the same fields using empty strings as default for non-employees.

- [ ] **Step 5: Render employee payroll accounting settings**

In the auxiliary dialog, render this block only when `formData.isEmployee`:

```tsx
{formData.isEmployee && (
  <div className="space-y-3 border-t pt-4">
    <h3 className="text-sm font-semibold text-slate-700">工资核算设置</h3>
    <SubjectSearchPopover
      value={formData.payrollSalaryExpenseSubjectCode}
      onSelect={(code, name) => setFormData((prev) => ({ ...prev, payrollSalaryExpenseSubjectCode: code, payrollSalaryExpenseSubjectName: name }))}
      placeholder="工资费用科目"
    />
    <SubjectSearchPopover
      value={formData.payrollContributionExpenseSubjectCode}
      onSelect={(code, name) => setFormData((prev) => ({ ...prev, payrollContributionExpenseSubjectCode: code, payrollContributionExpenseSubjectName: name }))}
      placeholder="社保公积金费用科目"
    />
    <SubjectSearchPopover
      value={formData.payrollSalaryPayableSubjectCode}
      onSelect={(code, name) => setFormData((prev) => ({ ...prev, payrollSalaryPayableSubjectCode: code, payrollSalaryPayableSubjectName: name }))}
      placeholder="应付工资科目"
    />
    <SubjectSearchPopover
      value={formData.payrollTaxPayableSubjectCode}
      onSelect={(code, name) => setFormData((prev) => ({ ...prev, payrollTaxPayableSubjectCode: code, payrollTaxPayableSubjectName: name }))}
      placeholder="个税应交科目"
    />
    <SubjectSearchPopover
      value={formData.payrollEmployeeContributionPayableSubjectCode}
      onSelect={(code, name) => setFormData((prev) => ({ ...prev, payrollEmployeeContributionPayableSubjectCode: code, payrollEmployeeContributionPayableSubjectName: name }))}
      placeholder="个人社保公积金代扣科目"
    />
  </div>
)}
```

- [ ] **Step 6: Run contract test and commit**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-employee-accounting') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-employee-accounting' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-employee-accounting --module commonjs --target es2020
node tmp\test-employee-accounting\test-payroll-store-contract.js
```

Expected: PASS with `payroll store contract tests passed`.

Commit:

```powershell
git add -- src/types/index.ts src/stores/usePartnerStore.ts src/app/settings/auxiliary/page.tsx test-payroll-store-contract.ts
git commit -m "Add employee payroll accounting settings"
```

---

### Task 4: Voucher Subject Resolution Priority

**Files:**
- Modify: `src/lib/payroll-voucher.ts`
- Modify: `src/app/payroll/page.tsx`
- Test: `test-payroll-monthly-integration.ts`

- [ ] **Step 1: Write failing voucher subject assertions**

Add to `test-payroll-monthly-integration.ts`:

```ts
const payrollVoucherSource = fs.readFileSync(path.join(rootDir, 'src/lib/payroll-voucher.ts'), 'utf8');

assert(payrollVoucherSource.includes('resolvePayrollVoucherSubjects'), 'voucher generation should resolve subjects through a helper');
assert(payrollVoucherSource.includes('employeeByCode'), 'voucher generation should use employee mapping by code');
assert(payrollVoucherSource.includes('payrollSalaryExpenseSubjectCode'), 'voucher generation should read employee salary expense subject');
```

Add runtime import:

```ts
import { buildPayrollAccrualVoucherPreview } from './src/lib/payroll-voucher';
```

Add runtime assertion:

```ts
const voucherPreview = buildPayrollAccrualVoucherPreview([{
  id: 'item-voucher-1',
  batchId: 'batch-voucher-1',
  accountSetId: 'as-1',
  payrollPeriod: '2026-05',
  employeeCode: 'EMP-RD',
  employeeName: 'R&D Employee',
  departmentName: 'R&D',
  inputData: {
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-RD',
    employeeName: 'R&D Employee',
    basicSalary: 10000,
  },
  calculationResult: calculatePayrollItem({
    ...createBlankPayrollInput(),
    employeeCode: 'EMP-RD',
    employeeName: 'R&D Employee',
    basicSalary: 10000,
  }, createBlankPayrollCalculationConfig(), 5),
  validationStatus: 'valid',
  validationMessages: [],
  createdAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
}], '2026-05', [{
  id: 'partner-rd',
  code: 'EMP-RD',
  name: 'R&D Employee',
  isCustomer: false,
  isSupplier: false,
  isEmployee: true,
  payrollSalaryExpenseSubjectCode: '660401',
  payrollSalaryExpenseSubjectName: '研发费用-工资',
  frozen: false,
  createTime: '2026-05-29T00:00:00.000Z',
  updateTime: '2026-05-29T00:00:00.000Z',
}]);

assert(voucherPreview.some((entry) => entry.subjectCode === '660401'), 'voucher preview should use employee salary expense subject');
```

- [ ] **Step 2: Run integration test and verify it fails**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-voucher-subject-red') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-voucher-subject-red' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-voucher-subject-red --module commonjs --target es2020
node tmp\test-voucher-subject-red\test-payroll-monthly-integration.js
```

Expected: FAIL because `buildPayrollAccrualVoucherPreview` does not accept employee mappings.

- [ ] **Step 3: Implement subject resolver**

In `src/lib/payroll-voucher.ts`, import `Partner`:

```ts
import type { Partner, VoucherEntry } from '@/types';
```

Add:

```ts
interface PayrollVoucherSubjects {
  salaryExpense: { code: string; name: string };
  contributionExpense: { code: string; name: string };
  salaryPayable: { code: string; name: string };
  taxPayable: { code: string; name: string };
  employeeContributionPayable: { code: string; name: string };
}

function subjectOrFallback(code: string | undefined, name: string | undefined, fallback: { code: string; name: string }) {
  return code?.trim() ? { code, name: name?.trim() || fallback.name } : fallback;
}

export function resolvePayrollVoucherSubjects(item: PayrollItem, employeeByCode: Map<string, Partner>): PayrollVoucherSubjects {
  const employee = employeeByCode.get(item.employeeCode);
  return {
    salaryExpense: subjectOrFallback(employee?.payrollSalaryExpenseSubjectCode, employee?.payrollSalaryExpenseSubjectName, SUBJECTS.salaryExpense),
    contributionExpense: subjectOrFallback(employee?.payrollContributionExpenseSubjectCode, employee?.payrollContributionExpenseSubjectName, SUBJECTS.contributionExpense),
    salaryPayable: subjectOrFallback(employee?.payrollSalaryPayableSubjectCode, employee?.payrollSalaryPayableSubjectName, SUBJECTS.salaryPayable),
    taxPayable: subjectOrFallback(employee?.payrollTaxPayableSubjectCode, employee?.payrollTaxPayableSubjectName, SUBJECTS.taxPayable),
    employeeContributionPayable: subjectOrFallback(employee?.payrollEmployeeContributionPayableSubjectCode, employee?.payrollEmployeeContributionPayableSubjectName, SUBJECTS.employeeContributionPayable),
  };
}
```

- [ ] **Step 4: Group voucher amounts by resolved subject**

Change the function signature:

```ts
export function buildPayrollAccrualVoucherPreview(items: PayrollItem[], period: string, employees: Partner[] = []): PayrollVoucherEntryPreview[] {
```

Create map:

```ts
const employeeByCode = new Map(employees.filter((employee) => employee.isEmployee).map((employee) => [employee.code, employee]));
```

Use a composite key including subject and department when grouping debit lines:

```ts
const salaryKey = `${subjects.salaryExpense.code}|${subjects.salaryExpense.name}|${department}`;
```

When creating entries from group keys, split into subject code, name, and department. Use resolved payable subjects for credit lines.

- [ ] **Step 5: Pass employees from payroll page**

In `src/app/payroll/page.tsx`, where voucher preview is opened, pass employee partners:

```ts
const employeePartners = partners.filter((partner) => partner.isEmployee);
setVoucherPreviewEntries(buildPayrollAccrualVoucherPreview(items, selectedBatch.payrollPeriod, employeePartners));
```

- [ ] **Step 6: Run integration test and commit**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-voucher-subject') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-voucher-subject' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-voucher-subject --module commonjs --target es2020
node tmp\test-voucher-subject\test-payroll-monthly-integration.js
```

Expected: PASS with `payroll monthly integration tests passed`.

Commit:

```powershell
git add -- src/lib/payroll-voucher.ts src/app/payroll/page.tsx test-payroll-monthly-integration.ts
git commit -m "Use employee payroll subjects in vouchers"
```

---

### Task 5: Final Verification and Cleanup

**Files:**
- Verify all modified payroll, partner, and test files.

- [ ] **Step 1: Run lint**

Run:

```powershell
npx.cmd eslint src\app\payroll\page.tsx src\app\settings\auxiliary\page.tsx src\lib\payroll.ts src\lib\payroll-tax-rules.ts src\lib\payroll-voucher.ts src\stores\usePartnerStore.ts src\types\index.ts test-payroll-monthly-integration.ts test-payroll-store-contract.ts
```

Expected: exit code 0, or only pre-existing warnings outside the changed lines.

- [ ] **Step 2: Run directed TypeScript tests**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-final') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp\test-payroll-final' -Recurse -Force }
npx.cmd tsc --project tsconfig.json --noEmit false --outDir tmp\test-payroll-final --module commonjs --target es2020
node tmp\test-payroll-final\test-payroll-store-contract.js
node tmp\test-payroll-final\test-payroll-monthly-integration.js
```

Expected:

```text
payroll store contract tests passed
payroll monthly integration tests passed
```

- [ ] **Step 3: Run production build**

Run:

```powershell
npm.cmd run build
```

Expected: build exits 0. Known Zustand static-generation storage warnings are acceptable if unchanged.

- [ ] **Step 4: Check temp files and diff cleanliness**

Run:

```powershell
git diff --check -- src\app\payroll\page.tsx src\app\settings\auxiliary\page.tsx src\lib\payroll.ts src\lib\payroll-tax-rules.ts src\lib\payroll-voucher.ts src\stores\usePartnerStore.ts src\types\index.ts test-payroll-monthly-integration.ts test-payroll-store-contract.ts docs\superpowers\plans\2026-05-29-payroll-tax-rules-annual-bonus-voucher.md
git status --short --untracked-files=all
```

Expected: no whitespace errors. Only intentional project changes and known unrelated dirty files remain.

- [ ] **Step 5: Clean generated test artifacts**

Run:

```powershell
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\tmp') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\tmp' -Recurse -Force }
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\test-results') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\test-results' -Recurse -Force }
if (Test-Path -LiteralPath 'D:\AI\ai-finance-assistant\playwright-report') { Remove-Item -LiteralPath 'D:\AI\ai-finance-assistant\playwright-report' -Recurse -Force }
```

Expected: generated temp directories are removed.

- [ ] **Step 6: Commit final verification metadata if any docs or tests changed**

If only source and test files are already committed from previous tasks, no additional commit is needed. If this plan file is still uncommitted, commit it:

```powershell
git add -- docs/superpowers/plans/2026-05-29-payroll-tax-rules-annual-bonus-voucher.md
git commit -m "Plan payroll tax rules annual bonus voucher work"
```
