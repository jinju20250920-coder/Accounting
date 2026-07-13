/* eslint-disable */
// Generate test .xlsx fixtures for each of 14 banks using their parser configs.
// Run with: node .bank-test/generate-fixtures.cjs
const XLSX = require('../node_modules/xlsx');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, 'fixtures');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Common account info used across all banks
const ACC_NUM = '6225 8888 1234 5678';
const ACC_NAME = '北京金桔科技有限公司';
const BRANCH = '北京朝阳支行';
const CURRENCY = '人民币';

// Build a sample of 3 transactions
const SAMPLE_TX = [
  { date: '2024-03-15', time: '10:25:36', debit: 5280.00, credit: 0, balance: 89234.56, cpName: '北京海泰科技有限公司', cpAcc: '1109 8821 0023 5566', summary: '采购办公用品' },
  { date: '2024-03-16', time: '14:12:08', debit: 0, credit: 25000.00, balance: 114234.56, cpName: '深圳万象商贸有限公司', cpAcc: '6228 4800 9988 2211', summary: '销售货款收入' },
  { date: '2024-03-18', time: '16:48:55', debit: 1280.50, credit: 0, balance: 112954.06, cpName: '中国电信北京分公司', cpAcc: '4012 8896 0940', summary: '电话费代扣' },
];

const FIXTURES = {
  // ============ 1. 建设银行 CCB (headerRows: 8, dual-row header) ============
  ccb: () => {
    const rows = [];
    rows.push(['中国建设银行']);                      // row 0
    rows.push(['活期账户交易明细']);                   // row 1
    rows.push([]);                                   // row 2
    rows.push(['中国建设银行', '北京朝阳支行', '', CURRENCY]);  // row 3: bankName / branch / currency
    rows.push(['账号:', ACC_NUM]);                   // row 4
    rows.push(['户名:', ACC_NAME]);                  // row 5
    rows.push([]);                                   // row 6
    rows.push([]);                                   // row 7
    // row 8: dual-row header (this gets split into two header rows visually but we put as single)
    // engine.ts merges row at headerRows-1 (row 7) into row at headerRows (row 8)
    // To exercise the merge: put top labels on row 7, detail labels on row 8
    rows[7] = ['', '', '', '', '借方', '', '贷方', '', '', '', '', '', '', '', '', '本方', '', '', ''];
    rows.push(['记账日期', '交易时间', '凭证种类', '凭证号', '发生额', '借方发生额', '发生额', '贷方发生额', '余额', '钞汇标志', '对方账号', '对方户名', '摘要', '备注', '交易流水号', '本方账号', '本方账户名称', '本方账户开户机构', '企业流水号']);
    for (const t of SAMPLE_TX) {
      rows.push([
        t.date, t.time, '转账', 'ZD20240315-' + Math.floor(Math.random()*1000),
        t.debit ? t.debit : '', t.debit ? t.debit : '',
        t.credit ? t.credit : '', t.credit ? t.credit : '',
        t.balance, '钞汇',
        t.cpAcc, t.cpName, t.summary, '',
        'SN' + Date.now() + Math.floor(Math.random()*1000),
        ACC_NUM, ACC_NAME, BRANCH, 'EN' + Math.floor(Math.random()*1000)
      ]);
    }
    return rows;
  },

  // ============ 2. 工商银行 ICBC (headerRows: 5, excel_serial date) ============
  // metaExtract expects: row 1 keyword '账号' / '币种'; row 2 keyword '户名'
  icbc: () => {
    const rows = [];
    rows.push(['中国工商银行股份有限公司', '', '', '', '', '']);  // row 0
    rows.push(['账号:', ACC_NUM, '币种:', CURRENCY, '', '']);  // row 1
    rows.push(['户名:', ACC_NAME, '', '', '', '']);  // row 2
    rows.push(['网点号: 0501', '', '', '', '', '']); // row 3
    rows.push([]);  // row 4
    // row 5: header
    rows.push(['日期', '网点号', '凭证种类', '凭证号', '摘要', '借方发生额', '贷方发生额', '余额', '对方户名', '对方账号', '交易类型']);
    // Excel serial dates: 45366 = 2024-03-15, 45367 = 2024-03-16, 45369 = 2024-03-18
    const serials = ['45366', '45367', '45369'];
    SAMPLE_TX.forEach((t, i) => {
      rows.push([
        serials[i], '0501', '转账', 'ZD' + (1000+i),
        t.summary, t.debit ? t.debit : '', t.credit ? t.credit : '',
        t.balance, t.cpName, t.cpAcc, '企业转账'
      ]);
    });
    return rows;
  },

  // ============ 3. 农业银行 ABC (headerRows: 2, metaExtract expects row 1: '账号' / '户名') ============
  abc: () => {
    const rows = [];
    rows.push(['中国农业银行', '', '', '', '', '', '', '']);  // row 0
    rows.push(['账号:', ACC_NUM, '户名:', ACC_NAME, '', '', '', '']);  // row 1
    // row 2: header
    rows.push(['交易时间', '收入金额', '支出金额', '账户余额', '对方账号', '对方户名', '摘要', '对方开户行']);
    SAMPLE_TX.forEach((t) => {
      rows.push([
        t.date + ' ' + t.time, t.credit ? t.credit : '', t.debit ? t.debit : '',
        t.balance, t.cpAcc, t.cpName, t.summary, BRANCH
      ]);
    });
    return rows;
  },

  // ============ 4. 招商银行 CMB (headerRows: 9, metaExtract row 1 '账号' / row 2 '账户名称') ============
  cmb: () => {
    const rows = [];
    rows.push(['招商银行', '', '', '', '', '', '', '', '', '']);  // row 0
    rows.push(['账号:', ACC_NUM, '', '', '', '', '', '', '', '']);  // row 1
    rows.push(['账户名称:', ACC_NAME, '', '', '', '', '', '', '', '']);  // row 2
    for (let i = 3; i < 9; i++) rows.push([]);  // rows 3-8
    // row 9: header — must be ≥30 columns
    const header = Array(30).fill('');
    Object.assign(header, ['交易日', '交易时间', '借方金额', '贷方金额', '余额', '收(付)方名称', '收(付)方账号', '摘要', '流水号', '账号', '账号名称', '业务名称', '流程实例号']);
    rows.push(header);
    SAMPLE_TX.forEach((t, i) => {
      const row = Array(30).fill('');
      row[0] = t.date; row[1] = t.time;
      row[2] = t.debit ? t.debit : ''; row[3] = t.credit ? t.credit : '';
      row[4] = t.balance;
      row[5] = t.cpName; row[6] = t.cpAcc; row[7] = t.summary;
      row[8] = 'CMB' + Date.now() + i;
      row[9] = ACC_NUM; row[10] = ACC_NAME;
      rows.push(row);
    });
    return rows;
  },

  // ============ 5. 中国银行 BOC (headerRows: 9, compact date, 付款人/收款人) ============
  boc: () => {
    const rows = [];
    rows.push(['中国银行 Bank of China', '', '', '查询账号:', ACC_NUM, '', '', '', '', '']);  // row 0
    for (let i = 1; i < 9; i++) rows.push([]);  // rows 1-8
    // row 9: header — must be ≥30 columns
    const header = Array(30).fill('');
    Object.assign(header, ['交易日期', '交易时间', '借方发生额', '贷方发生额', '交易后余额', '付款人名称', '付款人账号', '付款人开户行', '收款人名称', '收款人账号', '收款人开户行', '交易流水号', '凭证类型', '凭证号码', '摘要', '交易附言', '起息日期']);
    rows.push(header);
    SAMPLE_TX.forEach((t, i) => {
      const row = Array(30).fill('');
      // Compact date "20240315"
      row[0] = t.date.replace(/-/g, '');
      row[1] = t.time.replace(/:/g, '');
      row[2] = t.debit ? t.debit : ''; row[3] = t.credit ? t.credit : '';
      row[4] = t.balance;
      // For debit (outflow): counterparty is payee; for credit: counterparty is payer
      if (t.debit) {
        row[5] = ACC_NAME; row[6] = ACC_NUM; row[7] = BRANCH;  // 付款人 = us
        row[8] = t.cpName; row[9] = t.cpAcc; row[10] = '对方行';
      } else {
        row[5] = t.cpName; row[6] = t.cpAcc; row[7] = '对方行';
        row[8] = ACC_NAME; row[9] = ACC_NUM; row[10] = BRANCH;
      }
      row[11] = 'BOC' + Date.now() + i;
      row[12] = '转账'; row[13] = 'ZD' + (1000+i);
      row[14] = t.summary; row[15] = t.summary;
      rows.push(row);
    });
    return rows;
  },

  // ============ 6. 中信银行 CITIC (headerRows: 14) ============
  citic: () => {
    const rows = [];
    rows.push(['中信银行', '', '账号:', ACC_NUM, '', '户名:', ACC_NAME, '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 0
    rows.push(['账户名称:', ACC_NAME, '', '账号:', ACC_NUM, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 1
    rows.push(['动账资金分簿: 人民币', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 2
    for (let i = 3; i < 14; i++) rows.push([]);  // rows 3-13
    // row 14: header — must be ≥20 columns
    const header = Array(22).fill('');
    Object.assign(header, ['交易日期', '交易时间', '借方发生额', '贷方发生额', '账户余额', '对方账户名称', '对方账号', '摘要', '附言', '柜员交易号', '发起方流水号', '交易账号', '退汇标识', '动账资金分簿']);
    rows.push(header);
    SAMPLE_TX.forEach((t, i) => {
      const row = Array(22).fill('');
      row[0] = t.date; row[1] = t.time;
      row[2] = t.debit ? t.debit : ''; row[3] = t.credit ? t.credit : '';
      row[4] = t.balance;
      row[5] = t.cpName; row[6] = t.cpAcc;
      row[7] = t.summary; row[8] = t.summary;
      row[9] = 'T' + Date.now() + i;
      row[10] = 'I' + Date.now() + i;
      row[11] = ACC_NUM;
      row[12] = 'N'; row[13] = CURRENCY;
      rows.push(row);
    });
    return rows;
  },

  // ============ 7. 交通银行 BOCOM (headerRows: 2, columns 借方发生额（支出）) ============
  bocom: () => {
    const rows = [];
    rows.push(['交通银行', '', '账号:', ACC_NUM, '', '户名:', ACC_NAME, '', '']);  // row 0
    rows.push(['账户明细', '', '', '', '', '', '', '', '']);  // row 1
    // row 2: header (max 9 cols)
    rows.push(['交易时间', '借方发生额（支出）', '贷方发生额（收入）', '账户余额', '对方账号', '对方户名', '摘要', '', '']);
    SAMPLE_TX.forEach((t) => {
      rows.push([
        t.date + ' ' + t.time,
        t.debit ? t.debit : '',
        t.credit ? t.credit : '',
        t.balance,
        t.cpAcc, t.cpName, t.summary, '', ''
      ]);
    });
    return rows;
  },

  // ============ 8. 兴业银行 Industrial (headerRows: 1 → 1 metadata row + header at row 1) ============
  industrial: () => {
    const rows = [];
    // row 0: metadata (兴业银行)
    rows.push(['兴业银行 Industrial Bank', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    // row 1: header — must be ≥17 columns
    const header = Array(19).fill('');
    Object.assign(header, ['记账日期', '交易时间', '借方金额', '贷方金额', '账户余额', '对方户名', '对方账号', '摘要', '用途', '银行流水号', '唯一流水编号', '账号', '户名', '凭证代号', '现/转', '对方行号']);
    rows.push(header);
    SAMPLE_TX.forEach((t, i) => {
      const row = Array(19).fill('');
      row[0] = t.date; row[1] = t.time;
      row[2] = t.debit ? t.debit : ''; row[3] = t.credit ? t.credit : '';
      row[4] = t.balance;
      row[5] = t.cpName; row[6] = t.cpAcc;
      row[7] = t.summary; row[8] = t.summary;
      row[9] = 'IB' + Date.now() + i;
      row[10] = 'UID' + Date.now() + i;
      row[11] = ACC_NUM; row[12] = ACC_NAME;
      row[13] = 'transfer'; row[14] = '转'; row[15] = '1010';
      rows.push(row);
    });
    return rows;
  },

  // ============ 9. 浙商银行 CZB (headerRows: 5, custom date yyyy-MM-dd-HHmm) ============
  czb: () => {
    const rows = [];
    rows.push(['浙商银行', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 0
    rows.push(['账户名称:', ACC_NAME, '', '', '', '', '', '', '', '', '', '', '', '']);  // row 1
    rows.push(['账号:', ACC_NUM, '', '', '', '', '', '', '', '', '', '', '', '']);  // row 2
    rows.push(['起止日期: 2024-03-01 至 2024-03-31', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 3
    rows.push([]);  // row 4
    // row 5: header
    rows.push(['交易时间', '摘要', '凭证种类', '凭证号', '借方发生金额(元)', '贷方发生金额(元)', '交易后余额(元)', '对方名称', '对方账号', '用途/附言', '流水号']);
    SAMPLE_TX.forEach((t, i) => {
      // Compact date "2024-03-15-10:25"
      const dtCompact = t.date + '-' + t.time.slice(0, 5);
      rows.push([
        dtCompact, t.summary, '转账', 'ZD' + (1000+i),
        t.debit ? t.debit : '', t.credit ? t.credit : '',
        t.balance, t.cpName, t.cpAcc, t.summary, 'CZB' + Date.now() + i
      ]);
    });
    return rows;
  },

  // ============ 10. 浦发银行 SPDB (headerRows: 5, compact date) ============
  spdb: () => {
    const rows = [];
    rows.push(['浦发银行', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 0
    rows.push(['账号:', ACC_NUM, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 1
    rows.push(['账户名称:', ACC_NAME, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 2
    rows.push(['传票序号: 1, 记录状态: 正常, 客户账户类型: 基本', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 3
    rows.push([]);  // row 4
    // row 5: header — must be 14-18 cols
    rows.push(['交易日期', '交易时间', '凭证号', '借方金额', '贷方金额', '余额', '对方账号', '对方户名', '对方行名', '交易流水号', '摘要', '交易附言', '传票序号', '记录状态', '客户账户类型']);
    SAMPLE_TX.forEach((t, i) => {
      rows.push([
        t.date.replace(/-/g, ''), t.time.replace(/:/g, ''),
        'ZD' + (1000+i),
        t.debit ? t.debit : '', t.credit ? t.credit : '',
        t.balance,
        t.cpAcc, t.cpName, BRANCH,
        'SPDB' + Date.now() + i,
        t.summary, t.summary, '1', '正常', '基本'
      ]);
    });
    return rows;
  },

  // ============ 11. 民生银行 CMBC (headerRows: 18) ============
  cmbc: () => {
    const rows = [];
    rows.push(['中国民生银行', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 0
    rows.push(['账户名称:', ACC_NAME, '', '', '', '', '', '', '', '', '', '', '', '']);  // row 1
    rows.push(['账号:', ACC_NUM, '', '', '', '', '', '', '', '', '', '', '', '']);  // row 2
    for (let i = 3; i < 18; i++) rows.push([]);  // rows 3-17
    // row 18: header (max 12 cols)
    rows.push(['交易时间', '交易流水号', '借方发生额', '贷方发生额', '账户余额', '凭证号', '客户附言', '对方账号', '对方账号名称', '对方开户行', '冲正流水', '备注']);
    SAMPLE_TX.forEach((t, i) => {
      rows.push([
        t.date + ' ' + t.time, 'CMBC' + Date.now() + i,
        t.debit ? t.debit : '', t.credit ? t.credit : '',
        t.balance, 'ZD' + (1000+i),
        t.summary, t.cpAcc, t.cpName, BRANCH, '', ''
      ]);
    });
    return rows;
  },

  // ============ 12. 平安银行 Ping An (headerRows: 1 → 1 metadata row + header at row 1) ============
  pingan: () => {
    const rows = [];
    // row 0: metadata
    rows.push(['平安银行 Ping An Bank', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    // row 1: header — must be ≥18 columns
    const header = Array(20).fill('');
    Object.assign(header, ['交易日期', '账号', '账户名称', '借方(支出)金额', '贷方(收入)金额', '账户余额', '对方账号', '对方账户名称', '对方开户行', '用途', '银行流水号', '摘要', '明细来源', '付款单备注', '审批状态']);
    rows.push(header);
    SAMPLE_TX.forEach((t, i) => {
      const row = Array(20).fill('');
      row[0] = t.date;
      row[1] = ACC_NUM; row[2] = ACC_NAME;
      row[3] = t.debit ? t.debit : ''; row[4] = t.credit ? t.credit : '';
      row[5] = t.balance;
      row[6] = t.cpAcc; row[7] = t.cpName; row[8] = BRANCH;
      row[9] = t.summary;
      row[10] = 'PA' + Date.now() + i;
      row[11] = t.summary;
      row[12] = '网银'; row[13] = t.summary; row[14] = '已审批';
      rows.push(row);
    });
    return rows;
  },

  // ============ 13. 华夏银行 Huaxia (headerRows: 8) ============
  huaxia: () => {
    const rows = [];
    rows.push(['华夏银行', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 0
    rows.push(['账号:', ACC_NUM, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 1
    rows.push(['户名:', ACC_NAME, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 2
    rows.push(['明细标注: 正常', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 3
    for (let i = 4; i < 8; i++) rows.push([]);  // rows 4-7
    // row 8: header — must be 13-17 cols
    rows.push(['交易日期', '交易时间', '支出金额', '收入金额', '余额', '对方账号', '对方户名', '对方行名', '核心流水号', '摘要', '凭证号码', '交易描述', '明细标注', '记账日期', '']);
    SAMPLE_TX.forEach((t, i) => {
      rows.push([
        t.date, t.time,
        t.debit ? t.debit : '', t.credit ? t.credit : '',
        t.balance,
        t.cpAcc, t.cpName, BRANCH,
        'HX' + Date.now() + i,
        t.summary, 'ZD' + (1000+i), t.summary, '正常', t.date, ''
      ]);
    });
    return rows;
  },

  // ============ 14. 上海银行 Shanghai (headerRows: 6) ============
  shanghai: () => {
    const rows = [];
    rows.push(['上海银行', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 0
    rows.push(['账户交易明细', '', '', '', '', '', '', '', '', '', '', '', '']);  // row 1
    rows.push(['账号:', ACC_NUM, '开户行:', BRANCH, '', '', '', '', '', '', '', '', '']);  // row 2
    for (let i = 3; i < 6; i++) rows.push([]);  // rows 3-5
    // row 6: header — must be 10-14 cols
    rows.push(['记账日期', '交易时间', '交易流水号', '借方发生额', '贷方发生额', '余额', '对手账号', '对手名称', '摘要', '交易用途', '交易方向']);
    SAMPLE_TX.forEach((t, i) => {
      rows.push([
        t.date, t.time, 'SH' + Date.now() + i,
        t.debit ? t.debit : '', t.credit ? t.credit : '',
        t.balance,
        t.cpAcc, t.cpName, t.summary, t.summary, t.debit ? '支出' : '收入'
      ]);
    });
    return rows;
  },
};

const bankOrder = ['ccb', 'icbc', 'abc', 'cmb', 'boc', 'citic', 'bocom', 'industrial', 'czb', 'spdb', 'cmbc', 'pingan', 'huaxia', 'shanghai'];
const results = [];
for (const bankId of bankOrder) {
  const builder = FIXTURES[bankId];
  if (!builder) { console.warn(`No builder for ${bankId}`); continue; }
  const data = builder();
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const outPath = path.join(OUT_DIR, `${bankId}-test.xlsx`);
  XLSX.writeFile(wb, outPath);
  results.push({ bankId, rows: data.length, path: outPath });
  console.log(`Generated ${bankId}: ${data.length} rows -> ${outPath}`);
}

console.log(`\nTotal: ${results.length} fixtures generated`);
