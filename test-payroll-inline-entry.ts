import assert from 'node:assert/strict';
import {
  createBlankPayrollInput,
  validatePayrollInput,
  type PayrollInput,
} from './src/lib/payroll';

const amountFields = [
  ['basicSalary', '基本工资'],
  ['bonus', '奖金'],
  ['allowance', '津贴补贴'],
  ['otherEarnings', '其他应发'],
  ['leaveDeduction', '请假扣款'],
  ['otherPreTaxDeduction', '其他税前扣减'],
  ['specialAdditionalDeduction', '专项附加扣除'],
  ['otherLegalDeduction', '其他依法扣除'],
  ['priorCumulativeIncome', '前期累计收入'],
  ['priorCumulativeEmployeeContributions', '前期累计个人社保公积金'],
  ['priorCumulativeSpecialAdditionalDeduction', '前期累计专项附加扣除'],
  ['priorCumulativeOtherLegalDeduction', '前期累计其他依法扣除'],
  ['priorCumulativeTaxWithheld', '前期累计已预扣税额'],
  ['otherPostTaxDeduction', '其他税后扣减'],
] as const satisfies readonly (readonly [keyof PayrollInput, string])[];

const optionalBaseFields = [
  ['socialInsuranceBase', '社保缴费基数'],
  ['housingFundBase', '公积金缴费基数'],
] as const satisfies readonly (readonly [keyof PayrollInput, string])[];

const validationAmountFields: readonly (readonly [keyof PayrollInput, string])[] = [
  ...amountFields,
  ...optionalBaseFields,
];

const blank = createBlankPayrollInput();
assert.equal(blank.employeeCode, '');
assert.equal(blank.employeeName, '');
amountFields.forEach(([field]) => {
  assert.equal(blank[field], 0, `${String(field)} should start at zero`);
});
optionalBaseFields.forEach(([field]) => {
  assert.equal(blank[field], undefined, `${String(field)} should preserve calculation fallback`);
});

const validInput: PayrollInput = {
  ...blank,
  employeeCode: 'E001',
  employeeName: '张三',
  basicSalary: 10000,
};

assert.deepEqual(validatePayrollInput(validInput, []), []);
assert.deepEqual(validatePayrollInput({ ...validInput, employeeCode: '' }, []), ['工号不能为空']);
assert.deepEqual(validatePayrollInput({ ...validInput, employeeName: '' }, []), ['姓名不能为空']);
assert.deepEqual(validatePayrollInput(validInput, ['E001']), ['重复工号']);
assert.deepEqual(validatePayrollInput(validInput, [' E001 ']), ['重复工号']);

validationAmountFields.forEach(([field, label]) => {
  const negative = { ...validInput, [field]: -1 } as PayrollInput;
  assert.ok(validatePayrollInput(negative, []).includes(`${label}不得为负数`));

  const nonFinite = { ...validInput, [field]: Number.NaN } as PayrollInput;
  assert.ok(validatePayrollInput(nonFinite, []).includes(`${label}必须为有限数字`));
});

console.log('payroll inline entry tests passed');
