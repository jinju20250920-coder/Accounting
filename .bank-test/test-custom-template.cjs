/* eslint-disable */
// Test custom template functionality:
// 1. Unknown bank fixture (no built-in markers) → detection should NOT match any built-in confidently
// 2. Build a custom BankParserConfig manually → parseWithConfig should work
// 3. Register custom config → detectBank should pick it
// Run with: node .bank-test/test-custom-template.cjs
const path = require('path');
const fs = require('fs');

const TS = require('../node_modules/typescript');
require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const js = TS.transpileModule(source, {
    compilerOptions: {
      target: TS.ScriptTarget.ES2020,
      module: TS.ModuleKind.CommonJS,
      esModuleInterop: true,
      allowJs: true,
      skipLibCheck: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(js, filename);
};

const XLSX = require('../node_modules/xlsx');
const root = path.resolve(__dirname, '..');
const bankParsersDir = path.join(root, 'src', 'lib', 'bank-parsers');
const { parseWithConfig } = require(path.join(bankParsersDir, 'engine.ts'));
const { detectBank, getBestDetection } = require(path.join(bankParsersDir, 'detector.ts'));
const { getAllConfigs, getAllConfigsWithCustom } = require(path.join(bankParsersDir, 'bank-registry.ts'));
const typeTypes = require(path.join(bankParsersDir, 'types.ts'));

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUT_DIR = path.join(__dirname, 'results');

// ============ Step 1: Create an unknown-bank fixture ============
// Simulate a fictional regional bank "星河银行" with novel column names
const SAMPLE_TX = [
  { date: '2024-03-15', time: '10:25:36', debit: 5280.00, credit: 0, balance: 89234.56, cpName: '北京海泰科技有限公司', cpAcc: '1109 8821 0023 5566', summary: '采购办公用品' },
  { date: '2024-03-16', time: '14:12:08', debit: 0, credit: 25000.00, balance: 114234.56, cpName: '深圳万象商贸有限公司', cpAcc: '6228 4800 9988 2211', summary: '销售货款收入' },
];

function buildUnknownBankFixture() {
  const rows = [];
  rows.push(['星河银行', '北京海淀支行', '', '', '', '', '', '']);           // row 0 metadata
  rows.push(['账号: 9999 1111 2222 3333', '', '户名: 北京测试有限公司', '', '', '', '', '']);  // row 1
  // row 2: novel column names that don't match built-in identifiers
  rows.push(['业务发生日', '时刻', '出账金额', '入账金额', '账户结余', '交易对手', '对手账户', '业务摘要']);
  SAMPLE_TX.forEach((t) => {
    rows.push([
      t.date, t.time,
      t.debit ? t.debit : '',
      t.credit ? t.credit : '',
      t.balance,
      t.cpName, t.cpAcc, t.summary
    ]);
  });
  return rows;
}

const data = buildUnknownBankFixture();
const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
const unknownPath = path.join(FIXTURES_DIR, 'unknown-bank-test.xlsx');
XLSX.writeFile(wb, unknownPath);
console.log(`Generated unknown-bank fixture: ${data.length} rows`);

(async () => {
  const fileBuffer = fs.readFileSync(unknownPath);
  const file = {
    name: path.basename(unknownPath),
    arrayBuffer: async () => fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
  };

  const builtInConfigs = getAllConfigs();
  console.log(`\nBuilt-in configs: ${builtInConfigs.length}`);

  // ============ Test 1: Built-in detection should return no/low-confidence match ============
  console.log('\n--- Test 1: Detection with built-in configs only ---');
  const detectResults = await detectBank(file, builtInConfigs);
  const best = getBestDetection(detectResults);
  console.log(`Detection results count: ${detectResults.length}`);
  console.log(`Top 3: ${detectResults.slice(0, 3).map(r => `${r.bankId}(${r.score})`).join(', ') || '(none)'}`);
  const passTest1 = best === null;
  console.log(`Result: ${passTest1 ? 'PASS' : 'FAIL'} (expected null/low-confidence; got ${best?.bankId || 'null'})`);

  // ============ Test 2: Manually build a custom config and parse ============
  console.log('\n--- Test 2: Build custom config + parseWithConfig ---');
  const customConfig = {
    id: 'custom_galaxy',
    name: '星河银行',
    headerRows: 2,
    columnMapping: {
      date: ['业务发生日'],
      time: ['时刻'],
      debit: ['出账金额'],
      credit: ['入账金额'],
      balance: ['账户结余'],
      counterpartyName: ['交易对手'],
      counterpartyAccount: ['对手账户'],
      summary: ['业务摘要'],
    },
    dateFormat: 'iso',
    hasSeparatedTime: true,
    metaExtract: [
      { row: 1, keyword: '账号', field: 'accountNumber' },
      { row: 1, keyword: '户名', field: 'accountName' },
    ],
    identifiers: {
      sheetKeywords: ['星河银行'],
      columnKeywords: ['业务发生日', '账户结余', '业务摘要'],
      minColumns: 6,
      maxColumns: 10,
    },
  };
  const parseResult = await parseWithConfig(file, customConfig);
  const passTest2 = parseResult.transactions.length === 2
    && parseResult.errors.length === 0
    && parseResult.transactions[0].debit === 5280
    && parseResult.transactions[1].credit === 25000;
  console.log(`Transactions parsed: ${parseResult.transactions.length}`);
  console.log(`Errors: ${parseResult.errors.length}`);
  if (parseResult.transactions.length > 0) {
    const t0 = parseResult.transactions[0];
    console.log(`First tx: date=${t0.date} time=${t0.transactionTime} debit=${t0.debit} credit=${t0.credit} balance=${t0.balance} cp=${t0.counterpartyName}`);
  }
  console.log(`bankInfo: ${JSON.stringify(parseResult.bankInfo)}`);
  console.log(`Result: ${passTest2 ? 'PASS' : 'FAIL'}`);

  // ============ Test 3: Register custom config, re-detect — should now match custom ============
  console.log('\n--- Test 3: Detection with custom config registered ---');
  const allConfigs = getAllConfigsWithCustom([
    {
      id: 'customrecord_1',
      accountSetId: 'test',
      name: '星河银行',
      config: customConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  console.log(`Total configs (built-in + 1 custom): ${allConfigs.length}`);
  const detectWithCustom = await detectBank(file, allConfigs);
  const bestWithCustom = getBestDetection(detectWithCustom);
  console.log(`Top 3: ${detectWithCustom.slice(0, 3).map(r => `${r.bankId}(${r.score})`).join(', ')}`);
  const passTest3 = bestWithCustom?.bankId === 'custom_galaxy';
  console.log(`Result: ${passTest3 ? 'PASS' : 'FAIL'} (expected custom_galaxy; got ${bestWithCustom?.bankId || 'null'})`);

  // ============ Summary ============
  console.log('\n' + '='.repeat(80));
  console.log('CUSTOM TEMPLATE TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Test 1 (unknown file → no false positive detection):  ${passTest1 ? 'PASS' : 'FAIL'}`);
  console.log(`Test 2 (custom config → parses transactions):          ${passTest2 ? 'PASS' : 'FAIL'}`);
  console.log(`Test 3 (registered custom → detection picks custom):  ${passTest3 ? 'PASS' : 'FAIL'}`);
  const allPass = passTest1 && passTest2 && passTest3;
  console.log(`Overall: ${allPass ? 'ALL PASS' : 'FAILURES'}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'custom-template-results.json'),
    JSON.stringify({
      test1_no_false_positive: passTest1,
      test2_custom_parse: passTest2,
      test3_custom_detection: passTest3,
      detectResultsBuiltInOnly: detectResults.slice(0, 5).map(r => ({ bankId: r.bankId, score: r.score })),
      detectResultsWithCustom: detectWithCustom.slice(0, 5).map(r => ({ bankId: r.bankId, score: r.score })),
      parsedTxCount: parseResult.transactions.length,
      parsedFirstTx: parseResult.transactions[0],
      bankInfo: parseResult.bankInfo,
    }, null, 2)
  );

  process.exit(allPass ? 0 : 1);
})();
