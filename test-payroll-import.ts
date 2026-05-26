import assert from 'node:assert/strict';
import { parsePayrollRows } from './src/lib/payroll-import';

const valid = parsePayrollRows([
  ['工号', '姓名', '部门', '基本工资', '奖金', '社保缴费基数', '公积金缴费基数'],
  ['E001', '张三', '财务部', 10000, 2000, 10000, 10000],
]);

assert.equal(valid.validRows.length, 1);
assert.equal(valid.errors.length, 0);
assert.equal(valid.validRows[0].employeeCode, 'E001');
assert.equal(valid.validRows[0].departmentName, '财务部');
assert.equal(valid.validRows[0].basicSalary, 10000);
assert.equal(valid.validRows[0].allowance, 0);

const invalid = parsePayrollRows([
  ['工号', '姓名', '基本工资'],
  ['E001', '张三', 10000],
  ['E001', '李四', -100],
]);

assert.equal(invalid.validRows.length, 1);
assert.equal(invalid.errors.length, 1);
assert.match(invalid.errors[0].message, /重复工号/);
assert.match(invalid.errors[0].message, /不得为负数/);

const invalidBase = parsePayrollRows([
  ['工号', '姓名', '基本工资', '社保缴费基数'],
  ['E002', '王五', 8000, -1],
]);
assert.equal(invalidBase.validRows.length, 0);
assert.match(invalidBase.errors[0].message, /社保缴费基数不得为负数/);

console.log('payroll import tests passed');
