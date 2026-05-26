/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');

const smartPage = fs.readFileSync('src/app/page.tsx', 'utf8');
const monthlyPage = fs.readFileSync('src/app/monthly-closing-checks/page.tsx', 'utf8');
const sidebar = fs.readFileSync('src/components/layout/sidebar.tsx', 'utf8');

assert.match(smartPage, /检查设置/, 'smart accounting page should expose monthly check settings entry');
assert.match(smartPage, /usePayrollStore/, 'smart accounting page should read payroll batch evidence');
assert.match(smartPage, /payrollBatches/, 'smart accounting page should pass payroll evidence into monthly checks');
assert.doesNotMatch(smartPage, /本月状态修正/, 'smart accounting page should not keep a separate status correction editor');
assert.doesNotMatch(smartPage, /月结检查状态/, 'smart accounting page should not show a separate monthly check status table');
assert.doesNotMatch(smartPage, /恢复系统预设/, 'smart accounting page should not expose an independent smart-workbench reset');
assert.ok(
  smartPage.indexOf('本月做账任务') !== -1 &&
    smartPage.indexOf('下一步建议') !== -1 &&
    smartPage.indexOf('本月做账任务') < smartPage.indexOf('下一步建议'),
  'smart accounting page should show monthly accounting tasks before next actions',
);

assert.match(monthlyPage, /检查规则配置/, 'monthly closing page should keep rule configuration');
assert.match(monthlyPage, /月结步骤检查明细/, 'monthly closing page should keep manual check maintenance');
assert.doesNotMatch(monthlyPage, /整体进度/, 'monthly closing page should not show closing progress dashboard');
assert.doesNotMatch(monthlyPage, /模块进度总览/, 'monthly closing page should not show module status overview');
assert.doesNotMatch(monthlyPage, /当前没有阻塞项，可进入月结|当前存在阻塞项，暂不可月结/, 'monthly closing page should not show close status');

assert.doesNotMatch(sidebar, /月结检查/, 'sidebar should not expose monthly closing checks as a top-level menu item');
assert.doesNotMatch(sidebar, /path: '\/monthly-closing-checks'/, 'sidebar should not link directly to monthly closing checks');

console.log('smart/monthly UI boundary tests passed');
