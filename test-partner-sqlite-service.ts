import assert from 'node:assert/strict';
import {
  buildPartnerInsert,
  mapPartnerRow,
} from './src/lib/database/services/partner-sqlite-service';

const partnerRow = {
  id: 'p1',
  code: 'C001',
  name: '上海科技有限公司',
  type: 'both',
  contact: '张三',
  phone: '13800138000',
  email: '',
  address: '',
  taxNo: '91310000',
  bankAccount: '',
  defaultSubjectCode: '',
  defaultSubjectName: '',
  departmentCode: '',
  departmentName: '',
  paymentTermDays: 30,
  openingBalance: 1250.5,
  payrollSalaryExpenseSubjectCode: '',
  payrollSalaryExpenseSubjectName: '',
  payrollContributionExpenseSubjectCode: '',
  payrollContributionExpenseSubjectName: '',
  payrollSalaryPayableSubjectCode: '',
  payrollSalaryPayableSubjectName: '',
  payrollTaxPayableSubjectCode: '',
  payrollTaxPayableSubjectName: '',
  payrollEmployeeContributionPayableSubjectCode: '',
  payrollEmployeeContributionPayableSubjectName: '',
  payrollEmployerContributionPayableSubjectCode: '',
  payrollEmployerContributionPayableSubjectName: '',
  payrollDepartmentName: '',
  payrollProjectName: '',
  payrollCostCenterName: '',
  enabled: 1,
  createTime: '2026-06-07T00:00:00.000Z',
  updateTime: '2026-06-07T00:00:00.000Z',
  accountSetId: 'set-1',
};

assert.deepEqual(mapPartnerRow(partnerRow), {
  id: 'p1',
  code: 'C001',
  name: '上海科技有限公司',
  isCustomer: true,
  isSupplier: true,
  isEmployee: false,
  contact: '张三',
  phone: '13800138000',
  email: '',
  address: '',
  taxNumber: '91310000',
  bankAccount: '',
  defaultSubjectCode: undefined,
  defaultSubjectName: undefined,
  departmentCode: undefined,
  departmentName: undefined,
  paymentTermDays: 30,
  openingBalance: 1250.5,
  payrollSalaryExpenseSubjectCode: undefined,
  payrollSalaryExpenseSubjectName: undefined,
  payrollContributionExpenseSubjectCode: undefined,
  payrollContributionExpenseSubjectName: undefined,
  payrollSalaryPayableSubjectCode: undefined,
  payrollSalaryPayableSubjectName: undefined,
  payrollTaxPayableSubjectCode: undefined,
  payrollTaxPayableSubjectName: undefined,
  payrollEmployeeContributionPayableSubjectCode: undefined,
  payrollEmployeeContributionPayableSubjectName: undefined,
  payrollEmployerContributionPayableSubjectCode: undefined,
  payrollEmployerContributionPayableSubjectName: undefined,
  payrollDepartmentName: undefined,
  payrollProjectName: undefined,
  payrollCostCenterName: undefined,
  frozen: false,
  createTime: '2026-06-07T00:00:00.000Z',
  updateTime: '2026-06-07T00:00:00.000Z',
  accountSetId: 'set-1',
});

const insert = buildPartnerInsert({
  id: 'p1',
  code: 'C001',
  name: '上海科技有限公司',
  type: '',
  isCustomer: true,
  isSupplier: false,
  phone: '13800138000',
  taxNo: '91310000',
  openingBalance: 800,
  accountSetId: 'set-1',
  createTime: '2026-06-07T00:00:00.000Z',
  updateTime: '2026-06-07T00:00:00.000Z',
}, 'default-set', '2026-06-07T00:00:00.000Z');

assert.equal(insert.params.length, 33);
assert.equal(insert.params[3], 'customer');
assert.equal(insert.params[9], '');
assert.equal(insert.params[14], 800);
assert.equal(insert.params[30], 'set-1');
assert.equal(insert.params[31], '2026-06-07T00:00:00.000Z');
insert.params.forEach((value, index) => {
  assert.notEqual(value, undefined, `insert param ${index} should not be undefined`);
});

console.log('partner sqlite service ok');
