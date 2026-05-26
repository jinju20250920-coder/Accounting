import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMonthlyClosingSummary,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
} from './src/lib/monthly-closing-checks';

const salaryCheck = DEFAULT_MONTHLY_CLOSING_TEMPLATES.find((item) => item.code === 'payroll_salary_tax');
const socialCheck = DEFAULT_MONTHLY_CLOSING_TEMPLATES.find((item) => item.code === 'payroll_social_fund');
assert.equal(salaryCheck?.route, '/payroll');
assert.equal(socialCheck?.route, '/payroll');

const summary = buildMonthlyClosingSummary({
  period: '2026-05',
  vouchers: [],
  payrollBatches: [{
    status: 'confirmed',
    taxTotal: 230,
    includesSocialFundCalculation: true,
  }],
});
const salaryEvidence = summary.items.find((item) => item.code === 'payroll_salary_tax');
const socialEvidence = summary.items.find((item) => item.code === 'payroll_social_fund');
assert.equal(salaryEvidence?.systemStatus, 'warning');
assert.match(salaryEvidence?.systemMessage || '', /已确认工资计算批次/);
assert.match(salaryEvidence?.systemMessage || '', /仍需核对/);
assert.match(socialEvidence?.systemMessage || '', /社保、公积金计算结果/);

const sidebarSource = readFileSync('./src/components/layout/sidebar.tsx', 'utf8');
assert.match(sidebarSource, /薪酬管理/);
assert.match(sidebarSource, /\/payroll/);

const payrollPageSource = readFileSync('./src/app/payroll/page.tsx', 'utf8');
for (const action of ['导入工资表', '下载模板', '计算设置', '确认本月工资', '实发工资']) {
  assert.match(payrollPageSource, new RegExp(action));
}
console.log('payroll monthly integration tests passed');
