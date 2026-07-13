/* eslint-disable */
// Run bank parser engine + detector against each fixture.
// Validates: detection picks correct bank, parser extracts tx count = 3, no errors.
// Run with: node .bank-test/run-parser-tests.cjs
const path = require('path');
const fs = require('fs');

// Use ts-node via the project's ts compilation, but since this is CJS just compile inline
// Easier: use tsx if available, else register ts manually.
// Simpler: use babel/register? The project uses Next.js TS config.
// Best approach: use tsx through npx — but that may not be installed.
// Alternative: bypass TS entirely by importing compiled JS via dynamic require of the TS source via esbuild.

const TS = require('../node_modules/typescript');
const Module = require('module');

// Custom loader: compile .ts files to JS using TS compiler, then require them
const tsExtensions = ['.ts', '.tsx'];
const origRequire = Module.prototype.require;
const Module_compile = Module.prototype._compile;
require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const js = TS.transpileModule(source, {
    compilerOptions: {
      target: TS.ScriptTarget.ES2020,
      module: TS.ModuleKind.CommonJS,
      esModuleInterop: true,
      jsx: TS.JsxEmit.Preserve,
      allowJs: true,
      skipLibCheck: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(js, filename);
};

// Now we can require the TS files directly
const root = path.resolve(__dirname, '..');
const bankParsersDir = path.join(root, 'src', 'lib', 'bank-parsers');

const { parseWithConfig } = require(path.join(bankParsersDir, 'engine.ts'));
const { detectBank, getBestDetection } = require(path.join(bankParsersDir, 'detector.ts'));
const { getAllConfigs } = require(path.join(bankParsersDir, 'bank-registry.ts'));

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RESULTS_DIR = path.join(__dirname, 'results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

const bankOrder = ['ccb', 'icbc', 'abc', 'cmb', 'boc', 'citic', 'bocom', 'industrial', 'czb', 'spdb', 'cmbc', 'pingan', 'huaxia', 'shanghai'];
const configs = getAllConfigs();
const summary = [];

(async () => {
  for (const bankId of bankOrder) {
    const fixturePath = path.join(FIXTURES_DIR, `${bankId}-test.xlsx`);
    if (!fs.existsSync(fixturePath)) {
      summary.push({ bankId, status: 'MISSING_FIXTURE' });
      continue;
    }

    const fileBuffer = fs.readFileSync(fixturePath);
    const file = {
      name: path.basename(fixturePath),
      arrayBuffer: async () => fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
    };

    // 1. Detection
    let detectionResults = [];
    let bestDetection = null;
    try {
      detectionResults = await detectBank(file, configs);
      bestDetection = getBestDetection(detectionResults);
    } catch (e) {
      summary.push({ bankId, status: 'DETECT_ERROR', error: e.message });
      continue;
    }

    // 2. Parse with the EXPECTED config (regardless of detection) — this tests the parser itself
    const expectedConfig = configs.find(c => c.id === bankId);
    let parseResult = null;
    let parseError = null;
    try {
      parseResult = await parseWithConfig(file, expectedConfig);
    } catch (e) {
      parseError = e.message;
    }

    // Also parse with DETECTED config (or expected if detection failed) to test the full auto flow
    const detectedConfig = bestDetection?.config || expectedConfig;
    let autoParseResult = null;
    let autoParseError = null;
    if (bestDetection) {
      try {
        autoParseResult = await parseWithConfig(file, detectedConfig);
      } catch (e) {
        autoParseError = e.message;
      }
    }

    summary.push({
      bankId,
      detected: bestDetection?.bankId || 'NONE',
      detectionScore: bestDetection?.score || 0,
      detectionTop3: detectionResults.slice(0, 3).map(r => `${r.bankId}(${r.score})`),
      expectedTxCount: 3,
      parsedTxCount: parseResult?.transactions?.length || 0,
      parseErrors: parseResult?.errors || [],
      parseError,
      autoParsedTxCount: autoParseResult?.transactions?.length || 0,
      autoParseError,
      bankInfo: parseResult?.bankInfo || {},
    });
  }

  // Print results
  console.log('\n' + '='.repeat(100));
  console.log('BANK IMPORT TEST RESULTS');
  console.log('='.repeat(100));
  console.log('Bank ID        | Detected       | Score | Parse Txs | Auto Txs | BankInfo');
  console.log('-'.repeat(100));

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const r of summary) {
    if (r.status === 'MISSING_FIXTURE') {
      console.log(`${r.bankId.padEnd(15)} | MISSING FIXTURE`);
      failCount++;
      continue;
    }
    if (r.status === 'DETECT_ERROR') {
      console.log(`${r.bankId.padEnd(15)} | DETECT ERROR: ${r.error}`);
      failCount++;
      continue;
    }
    const detectionOk = r.detected === r.bankId;
    const parseOk = r.parsedTxCount === r.expectedTxCount && r.parseErrors.length === 0 && !r.parseError;
    const autoOk = r.autoParsedTxCount === r.expectedTxCount;

    let status = 'FAIL';
    if (detectionOk && parseOk && autoOk) { status = 'PASS'; passCount++; }
    else if (parseOk) { status = 'WARN'; warnCount++; }
    else { failCount++; }

    const infoStr = `bank=${r.bankInfo.bankName || '-'}, acc=${(r.bankInfo.accountNumber || '-').slice(-8)}, name=${r.bankInfo.accountName || '-'}`;
    console.log(`${r.bankId.padEnd(15)} | ${(r.detected + (detectionOk ? ' ✓' : ' ✗')).padEnd(15)} | ${String(r.detectionScore).padEnd(5)} | ${String(r.parsedTxCount).padEnd(9)} | ${String(r.autoParsedTxCount).padEnd(8)} | ${status} | ${infoStr}`);
    if (r.parseErrors.length > 0) {
      console.log(`                parseErrors: ${JSON.stringify(r.parseErrors)}`);
    }
    if (r.parseError) {
      console.log(`                parseError: ${r.parseError}`);
    }
    if (r.detectionTop3.length > 0 && !detectionOk) {
      console.log(`                detectionTop3: ${r.detectionTop3.join(', ')}`);
    }
  }

  console.log('-'.repeat(100));
  console.log(`PASS: ${passCount}/14   WARN: ${warnCount}/14   FAIL: ${failCount}/14`);
  console.log('='.repeat(100));

  // Write JSON results
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'parser-test-results.json'),
    JSON.stringify(summary, null, 2)
  );

  process.exit(failCount > 0 ? 1 : 0);
})();
