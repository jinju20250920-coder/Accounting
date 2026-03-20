// 简单的账龄计算函数测试
import {
  calculateDaysDifference,
  getAgingBucket,
  calculateAgingDistribution,
  formatAging,
  formatMoney,
  calculateAgingData,
  getAgingDetails,
  type AgingConfig,
  type AgingMode,
} from './src/lib/accounting';
import type { VoucherEntry } from './src/types';

console.log('=== 账龄计算函数测试 ===\n');

// 测试1: 计算天数差
console.log('测试1: 计算天数差');
const testPairs = [
  ['2024-01-01', '2024-01-10'],
  ['2024-01-01', '2024-02-01'],
  ['2024-01-01', '2024-04-01'],
  ['2024-01-01', '2024-07-01'],
  ['2024-01-01', '2025-01-01'],
];

testPairs.forEach(([start, end]) => {
  const days = calculateDaysDifference(start, end);
  console.log(`  ${start} 到 ${end}: ${days} 天`);
});

// 测试2: 账龄区间
console.log('\n测试2: 账龄区间（按月模式）');
const modes: AgingMode[] = ['month', 'year', 'day'];
modes.forEach((mode) => {
  console.log(`\n  模式: ${mode}`);
  [30, 45, 90, 120, 180, 200, 365, 400, 730, 1095].forEach((days) => {
    const bucket = getAgingBucket(days, mode);
    const formatted = formatAging(days, mode);
    console.log(`    ${days}天 -> ${bucket} (${formatted})`);
  });
});

// 测试3: 账龄分布计算
console.log('\n测试3: 账龄分布计算');
const amounts = [1000, 2000, 1500, 500, 0];
const distribution = calculateAgingDistribution(amounts);
console.log(`  金额: [${amounts.join(', ')}]`);
console.log(`  分布: [${distribution.map((d) => (d * 100).toFixed(1) + '%').join(', ')}]`);

// 测试4: 格式化金额
console.log('\n测试4: 格式化金额');
[0, 100, 1500.5, 1000000].forEach((amount) => {
  console.log(`  ${amount} -> ${formatMoney(amount)}`);
});

// 测试5: 完整的账龄数据计算
console.log('\n测试5: 完整的账龄数据计算');

// 创建测试凭证分录
const testEntries: VoucherEntry[] = [
  {
    id: '1',
    voucherId: 'V-2024-001',
    date: '2024-12-15',
    summary: '销售商品给A公司',
    subjectCode: '1122',
    subjectName: '应收账款',
    debit: 10000,
    credit: 0,
    customerName: 'A公司',
  },
  {
    id: '2',
    voucherId: 'V-2024-002',
    date: '2024-10-20',
    summary: '销售商品给A公司',
    subjectCode: '1122',
    subjectName: '应收账款',
    debit: 20000,
    credit: 0,
    customerName: 'A公司',
  },
  {
    id: '3',
    voucherId: 'V-2024-003',
    date: '2024-08-10',
    summary: '销售商品给B公司',
    subjectCode: '1122',
    subjectName: '应收账款',
    debit: 15000,
    credit: 0,
    customerName: 'B公司',
  },
  {
    id: '4',
    voucherId: 'V-2024-004',
    date: '2024-06-01',
    summary: '销售商品给B公司',
    subjectCode: '1122',
    subjectName: '应收账款',
    debit: 30000,
    credit: 0,
    customerName: 'B公司',
    recRefNo: 'REC-001',
  },
  {
    id: '5',
    voucherId: 'V-2024-005',
    date: '2023-12-01',
    summary: '销售商品给C公司',
    subjectCode: '1122',
    subjectName: '应收账款',
    debit: 50000,
    credit: 0,
    customerName: 'C公司',
  },
];

const config: AgingConfig = {
  mode: 'month',
  asOfDate: '2024-12-20',
  showWriteOff: true,
  overdueThreshold: 30,
};

const agingData = calculateAgingData(testEntries, config);
console.log(`\n  截止日期: ${config.asOfDate}`);
console.log(`  往来单位数量: ${agingData.length}`);

agingData.forEach((result) => {
  console.log(`\n  ${result.partner} (${result.partnerType}):`);
  console.log(`    总额: ${formatMoney(result.totalAmount)}`);
  console.log(`    当前: ${formatMoney(result.buckets.current)}`);
  console.log(`    逾期1期: ${formatMoney(result.buckets.overdue1)}`);
  console.log(`    逾期2期: ${formatMoney(result.buckets.overdue2)}`);
  console.log(`    逾期3期: ${formatMoney(result.buckets.overdue3)}`);
  console.log(`    逾期6期以上: ${formatMoney(result.buckets.overdue6)}`);
  console.log(`    分布: [${result.agingDistribution.map((d) => (d * 100).toFixed(0) + '%').join(', ')}]`);
  console.log(`    已核销: ${result.isWriteOff ? '是' : '否'}`);
});

// 测试6: 获取明细数据
console.log('\n测试6: 获取明细数据');
const details = getAgingDetails(testEntries, config);
console.log(`  明细数量: ${details.length}`);
details.slice(0, 3).forEach((detail) => {
  console.log(`\n  ${detail.partnerName} - ${detail.voucherNo}:`);
  console.log(`    日期: ${detail.date}`);
  console.log(`    摘要: ${detail.summary}`);
  console.log(`    金额: ${formatMoney(detail.amount)}`);
  console.log(`    逾期天数: ${detail.daysOverdue}天`);
  console.log(`    账龄区间: ${detail.bucket}`);
  console.log(`    已核销: ${detail.isWriteOff ? '是' : '否'}`);
});

// 测试7: 筛选明细数据
console.log('\n测试7: 筛选明细数据（按合作伙伴）');
const partnerDetails = getAgingDetails(testEntries, { ...config, partner: 'A公司' });
console.log(`  A公司的明细数量: ${partnerDetails.length}`);

console.log('\n=== 测试完成 ===');
