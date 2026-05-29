# Payroll Tax Rules and Voucher Design

## Goal

Extend payroll from a single monthly wage calculation flow into a configurable payroll tax and voucher workflow. The system should support Excel-like wage entry, regional social insurance defaults, annual bonus tax treatment, employee-level accounting mappings, and payroll accrual voucher generation.

## Scope

This design covers:

- Manual payroll entry in an Excel-style grid.
- Per-row calculation result display.
- Regional social insurance and housing fund defaults.
- Individual income tax settings and editable tax rate tables.
- Separate annual bonus tax calculation modes.
- Employee card payroll accounting mappings.
- Payroll accrual voucher generation.
- Smart accounting workbench return and monthly closing check behavior.

This design does not implement full business income settlement workflows inside the employee payroll table. Business income tax rules are maintained as reference rules and should be calculated through a separate income tax workflow if needed later.

## User Experience

### Payroll Entry Grid

The payroll page uses an Excel-style table with visible grid lines rather than card-style input blocks. Opening the manual entry dialog shows 10 blank rows by default. Users can add rows through an add-row button at the bottom or by pressing Enter on the last editable cell.

Each row supports:

- Employee code and name free input.
- Employee dropdown sourced from auxiliary records where identity includes employee.
- Department dropdown sourced from department settings.
- Auto-fill of name, department, and available employee defaults when employee code matches an employee card.
- Clear-row action to reset a mistaken row.
- Browser autofill disabled on payroll inputs.

The right side of each row shows read-only calculated columns:

- Gross salary.
- Individual income tax.
- Net salary.
- Employer cost.

### Payroll Settings

The calculation settings dialog puts individual income tax defaults before social insurance settings. The individual tax section includes a settings icon beside the title. Clicking the icon opens the advanced tax rate settings table.

The social insurance and housing fund section includes:

- Account-set payroll region.
- Region preset selector.
- Apply-region-default action to reapply defaults.
- Editable rates and base limits after presets are applied.

## Calculation Design

### Regular Wage Engine

The default engine calculates monthly wage and monthly bonus using cumulative withholding for resident individual salary income.

Inputs include:

- Basic salary.
- Monthly bonus.
- Allowances.
- Pre-tax deductions.
- Social insurance base.
- Housing fund base.
- Special additional deductions.
- Prior cumulative taxable values.
- Prior cumulative tax withheld.

The existing monthly payroll table should continue using this engine by default.

### Annual Bonus Engine

Annual bonus must not be treated as the same field as monthly bonus. It needs a separate calculation mode because the tax treatment can differ.

Supported methods:

- Separate taxation: divide the annual one-time bonus by 12, match the applicable tax rate and quick deduction, then calculate tax for the annual bonus independently.
- Consolidated taxation: include the annual bonus in comprehensive income and calculate together with salary income.

Payroll rows should include an income type or tax method field. The default is regular salary. When annual bonus is selected, the row uses the annual bonus engine and exposes the annual bonus tax method.

### Business Income Rules

Individual business income does not follow salary cumulative withholding. The system should maintain business income tax brackets separately, generally using 5%-35% progressive rates. These rules are not mixed into the employee payroll table.

## Tax Rate Settings

The tax settings icon opens an advanced rate table. The table supports:

- Rule type: salary, annual bonus, business income.
- Effective date.
- Bracket lower bound.
- Bracket upper bound.
- Tax rate.
- Quick deduction.
- System preset flag.
- Account-set custom flag.
- Enabled status.

System presets are read-only or protected by confirmation. Account-set custom rules can override system presets by rule type and effective date.

When calculating, the engine resolves tax rules by:

1. Account-set custom rule for the period and rule type.
2. System preset rule for the period and rule type.
3. Built-in fallback rule if no persisted rule is available.

## Regional Contribution Defaults

Account sets may store a default payroll region. Payroll settings use this region to apply social insurance and housing fund defaults.

The preset includes:

- Pension employee and employer rates.
- Medical employee and employer rates.
- Unemployment employee and employer rates.
- Work injury employer rate.
- Maternity employer rate where applicable.
- Social insurance base lower and upper limits.
- Housing fund employee and employer rates.
- Housing fund base lower and upper limits.

Users can apply a preset and then modify only fields that differ from the default. Employee-specific overrides can be added later without changing the preset model.

## Employee Card Payroll Accounting

Employee cards in auxiliary settings need a payroll accounting section. It stores default subjects used when payroll vouchers are generated.

Fields:

- Salary expense subject.
- Employer social insurance and housing fund expense subject.
- Salary payable subject.
- Individual income tax payable subject.
- Employee contribution withholding subject.
- Optional department.
- Optional project.
- Optional cost center.

The employee card remains the source for employee code, employee name, department defaults, and payroll accounting defaults.

## Voucher Generation

Payroll voucher generation starts from a calculated payroll batch. The system presents a preview before saving a draft voucher.

Minimum entries:

- Debit salary expense.
- Debit employer social insurance and housing fund expense.
- Credit salary payable.
- Credit individual income tax payable.
- Credit employee social insurance and housing fund withholding.

Subject resolution priority:

1. Payroll row override.
2. Employee card payroll accounting setting.
3. Department default payroll accounting setting.
4. Account-set payroll default subject.
5. System fallback subject.

This enables sales, management, and R&D employees to be accrued into different expense subjects without manually editing every voucher.

## Smart Accounting and Closing

The monthly closing checks should continue to detect payroll, social insurance, housing fund, and individual income tax status. When users enter check settings from the smart accounting workbench, the page must provide a clear return action back to the smart accounting workbench.

## Error Handling

- If an employee code is not found, keep the user's free input and show row-level validation only when saving.
- If a selected region has no preset data, keep current values and show a non-blocking warning.
- If no tax rule matches the period, use built-in fallback rules and mark the calculation snapshot accordingly.
- If voucher entries are unbalanced, prevent saving and show the difference.
- If employee card subject mappings are incomplete, fall back through the configured priority chain.

## Data Model Changes

Recommended new or extended structures:

- `PayrollTaxRule`: stores editable tax brackets by rule type and effective date.
- `PayrollIncomeType`: regular salary, annual bonus, business income reference.
- `PayrollAnnualBonusMethod`: separate taxation or consolidated taxation.
- Employee payroll accounting fields on auxiliary employee records.
- Account-set payroll defaults for region and fallback subjects.
- Optional department payroll default subject mapping.

## Testing

Coverage should include:

- Manual entry grid default 10 rows.
- Enter adds a new row.
- Employee code auto-fills employee name and department.
- Clear row resets employee and salary fields.
- Region preset applies non-zero default rates and bases.
- Percentage inputs do not show floating point artifacts.
- Tax settings icon opens the tax rate table.
- Annual bonus separate taxation uses bonus divided by 12 to choose rate.
- Annual bonus consolidated taxation routes through the regular wage engine.
- Voucher preview is balanced.
- Voucher subject priority uses employee mapping before defaults.
- Build and lint pass for payroll-related files.
