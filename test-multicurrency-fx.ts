import assert from 'node:assert/strict';
import { sqliteService } from './src/lib/database/sqlite-service';
import type { Currency, FxRate } from './src/types';
import type { BankAccountBinding } from './src/lib/bank-parsers/types';

async function ensureAccountSetRow(accountSetId: string): Promise<void> {
  const db = await sqliteService.getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO accountSets (
      id, code, name, baseCurrency, baseCurrencyName, taxNo, description, createTime, updateTime
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    accountSetId,
    accountSetId,
    'FX Test Account Set',
    'CNY',
    '人民币',
    '',
    '',
    now,
    now,
  ]);
  stmt.free();
}

async function main() {
  const accountSetId = `fx_test_${Date.now()}`;
  sqliteService.setAccountSetId(accountSetId);

  await ensureAccountSetRow(accountSetId);

  await sqliteService.saveAccountSetBaseCurrency('USD', '美元', accountSetId);
  const baseCurrency = await sqliteService.getAccountSetBaseCurrency(accountSetId);
  assert.equal(baseCurrency?.baseCurrency, 'USD');
  assert.equal(baseCurrency?.baseCurrencyName, '美元');

  const currencies: Currency[] = [
    {
      id: `${accountSetId}-cny`,
      code: 'CNY',
      name: '人民币',
      symbol: '¥',
      precision: 2,
      exchangeRate: 1,
      rateStartDate: '2026-06-01',
      gainLossSubjectCode: '6603',
      gainLossSubjectName: '财务费用',
      isBase: true,
      disabled: false,
      accountSetId,
      createTime: '2026-06-01T00:00:00.000Z',
      updateTime: '2026-06-01T00:00:00.000Z',
    },
    {
      id: `${accountSetId}-usd`,
      code: 'USD',
      name: '美元',
      symbol: '$',
      precision: 2,
      exchangeRate: 7.12,
      rateStartDate: '2026-06-01',
      gainLossSubjectCode: '6603',
      gainLossSubjectName: '财务费用',
      isBase: false,
      disabled: false,
      accountSetId,
      createTime: '2026-06-01T00:00:00.000Z',
      updateTime: '2026-06-01T00:00:00.000Z',
    },
  ];

  await sqliteService.saveCurrencies(currencies);
  const loadedCurrencies = await sqliteService.getAllCurrencies();
  assert.equal(loadedCurrencies.length >= 2, true);
  assert.equal(loadedCurrencies.some((currency) => currency.code === 'USD'), true);

  const fxRate: FxRate = {
    id: `${accountSetId}-fx-1`,
    accountSetId,
    rateDate: '2026-06-01',
    currencyCode: 'USD',
    baseCurrency: 'CNY',
    middleRate: 7.12,
    source: 'manual',
    createTime: '2026-06-01T00:00:00.000Z',
    updateTime: '2026-06-01T00:00:00.000Z',
  };

  await sqliteService.saveFxRates([fxRate]);
  const loadedRates = await sqliteService.getFxRates('2026-06-01');
  assert.equal(loadedRates.length, 1);
  assert.equal(loadedRates[0].currencyCode, 'USD');
  assert.equal(loadedRates[0].middleRate, 7.12);

  const bankBinding: BankAccountBinding = {
    id: `${accountSetId}-bank-1`,
    accountSetId,
    accountNumber: 'USD-001',
    bankId: 'bank-usd',
    bankName: 'USD Bank',
    aliasName: '美元户',
    subSubjectCode: '1002',
    subSubjectName: '银行存款',
    branch: '上海',
    currency: 'USD',
    isDefault: true,
    createdAt: '2026-06-01T00:00:00.000Z',
  };

  await sqliteService.saveBankAccountBinding(bankBinding);
  const loadedBinding = await sqliteService.findBankAccountBinding('USD-001');
  assert.equal(loadedBinding?.currency, 'USD');
  assert.equal(loadedBinding?.subSubjectCode, '1002');

  console.log('multicurrency fx persistence tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
