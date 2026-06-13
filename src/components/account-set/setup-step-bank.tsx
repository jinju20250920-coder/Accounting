'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Landmark,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Upload,
  Download,
  Edit,
  Save,
} from 'lucide-react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { loadOpeningBalanceLockKeys } from '@/lib/opening-balance-rules';
import { BANK_BRANDS } from '@/lib/bank-parsers/bank-registry';
import { useToast } from '@/components/ui/toast';
import {
  NEW_BANK_OPTION_ID,
  buildBankAccountDisplayName,
  resolveBankSelection,
} from '@/lib/bank-account-names';
import { importFromExcel, exportTemplate, exportToExcel } from '@/lib/excel-utils';

interface BankAccountEntry {
  id: string;
  bankId: string;
  bankName: string;
  customBankName: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  exchangeRate: string;
  openingBalance: string; // foreign currency amount if currency != CNY, else base amount
  subjectCode: string;
}

interface SetupStepBankProps {
  accountSetId: string;
}

const CURRENCIES = [
  { code: 'CNY', name: '人民币' },
  { code: 'USD', name: '美元' },
  { code: 'EUR', name: '欧元' },
  { code: 'HKD', name: '港币' },
  { code: 'JPY', name: '日元' },
];

const BANK_IMPORT_HEADERS = [
  { key: 'bankName' as const, label: '银行', required: true },
  { key: 'accountNumber' as const, label: '账号', required: true },
  { key: 'accountName' as const, label: '账户名称', required: false },
  { key: 'currency' as const, label: '币种', required: false },
  { key: 'exchangeRate' as const, label: '汇率', required: false },
  { key: 'openingBalance' as const, label: '期初余额', required: false },
];

const emptyForm = (): BankAccountEntry => ({
  id: `bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  bankId: '',
  bankName: '',
  customBankName: '',
  accountNumber: '',
  accountName: '',
  currency: 'CNY',
  exchangeRate: '',
  openingBalance: '',
  subjectCode: '',
});

export function SetupStepBank({ accountSetId }: SetupStepBankProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<BankAccountEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BankAccountEntry>(emptyForm());
  const [lockedBankKeys, setLockedBankKeys] = useState<Set<string>>(new Set());

  const bankOptions = useMemo(() => Object.entries(BANK_BRANDS).map(([id, brand]) => ({
    id,
    name: brand.short,
    shortName: brand.short,
  })), []);

  const bankNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, brand] of Object.entries(BANK_BRANDS)) {
      map[brand.short] = id;
    }
    return map;
  }, []);

  useEffect(() => {
    const loadExistingAccounts = async () => {
      try {
        if (sqliteService.accountSetId !== accountSetId) {
          sqliteService.setAccountSetId(accountSetId);
        }
        const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
        const periodStart = (accountSet?.startDate || accountSet?.enableDate || new Date().toISOString().substring(0, 7)).substring(0, 7);
        const bindings = await sqliteService.getBankAccountBindings();
        const loadedEntries = await Promise.all(bindings.map(async (binding) => {
          const detail = await sqliteService.getBankOpeningBalanceDetail(binding.accountNumber, periodStart);
          const knownBank = bankOptions.some(bank => bank.id === binding.bankId);
          const matchedOption = bankOptions.find(bank => bank.id === binding.bankId);
          const isForeign = binding.currency && binding.currency !== 'CNY';
          // If we have foreignBalance stored, show that; else fall back to balance (legacy data)
          const displayBalance = isForeign && detail?.foreignBalance != null ? String(detail.foreignBalance) : (detail?.balance != null ? String(detail.balance) : '');
          return {
            id: binding.id,
            bankId: knownBank ? binding.bankId : NEW_BANK_OPTION_ID,
            bankName: matchedOption?.name || binding.bankName || '',
            customBankName: knownBank ? '' : binding.bankName,
            accountNumber: binding.accountNumber,
            accountName: binding.aliasName || binding.subSubjectName || '',
            currency: binding.currency || 'CNY',
            exchangeRate: detail?.exchangeRate != null ? String(detail.exchangeRate) : '',
            openingBalance: displayBalance,
            subjectCode: binding.subSubjectCode || '',
          };
        }));
        setEntries(loadedEntries);
        setSaved(loadedEntries.length > 0);
        const lockKeys = await loadOpeningBalanceLockKeys(accountSetId, { sqliteService });
        setLockedBankKeys(lockKeys.bankKeys);
      } catch (error) {
        console.warn('Load bank accounts failed:', error);
      }
    };
    loadExistingAccounts();
  }, [accountSetId, bankOptions]);

  const getBankDisplay = (entry: BankAccountEntry) => {
    if (entry.bankId === NEW_BANK_OPTION_ID) return entry.customBankName || '自定义银行';
    const option = bankOptions.find(b => b.id === entry.bankId);
    return option?.name || entry.bankName || '-';
  };

  const getCurrencyDisplay = (code: string) => {
    const cur = CURRENCIES.find(c => c.code === code);
    return cur ? cur.name : code;
  };

  const isForeignCurrency = (code: string) => code && code !== 'CNY';

  const computeBaseAmount = (entry: BankAccountEntry): number => {
    const amount = parseFloat(entry.openingBalance) || 0;
    if (!isForeignCurrency(entry.currency)) return amount;
    const rate = parseFloat(entry.exchangeRate) || 0;
    return Math.round(amount * rate * 100) / 100;
  };

  const totalBaseBalance = entries.reduce((sum, e) => sum + computeBaseAmount(e), 0);

  const updateForm = (field: keyof BankAccountEntry, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'bankId') {
        const option = bankOptions.find(b => b.id === value);
        next.bankName = option?.name || '';
      }
      // Reset exchange rate when currency changes back to CNY
      if (field === 'currency' && value === 'CNY') {
        next.exchangeRate = '';
      }
      return next;
    });
  };

  // Persist a single entry to DB
  const persistEntry = async (entry: BankAccountEntry, index: number) => {
    if (sqliteService.accountSetId !== accountSetId) {
      sqliteService.setAccountSetId(accountSetId);
    }
    const existingSubjects = await sqliteService.getAllSubjects();
    const existingCodes = new Set(existingSubjects.map(s => s.code));
    const selectedBank = bankOptions.find(bank => bank.id === entry.bankId);
    const bankSelection = resolveBankSelection({
      selectedBankId: entry.bankId,
      selectedBankName: selectedBank?.name || '',
      customBankName: entry.customBankName,
    });
    let subjectCode = entry.subjectCode || `1002${String(index + 1).padStart(2, '0')}`;
    while (!entry.subjectCode && existingCodes.has(subjectCode)) {
      const nextNumber = Number(subjectCode.slice(4) || '0') + 1;
      subjectCode = `1002${String(nextNumber).padStart(2, '0')}`;
    }
    const accountDisplayName = buildBankAccountDisplayName({
      bankName: bankSelection.bankName,
      shortName: selectedBank?.shortName,
      accountNumber: entry.accountNumber,
      currency: entry.currency,
      customName: entry.accountName,
    });

    const existingBindings = await sqliteService.getBankAccountBindings();
    const existingBinding = existingBindings.find(b => b.accountNumber === entry.accountNumber.trim());
    await sqliteService.saveBankAccountBinding?.({
      ...existingBinding,
      id: entry.id,
      accountSetId,
      bankId: bankSelection.bankId,
      bankName: bankSelection.bankName,
      accountNumber: entry.accountNumber.trim(),
      aliasName: accountDisplayName,
      subSubjectCode: subjectCode,
      subSubjectName: accountDisplayName,
      currency: entry.currency,
      isDefault: index === 0,
      createdAt: new Date().toISOString(),
    });

    // Ensure the 1002 sub-account (关联科目) exists with foreign currency settings
    if (!existingCodes.has(subjectCode)) {
      await sqliteService.saveSubjects([{
        id: subjectCode,
        code: subjectCode,
        name: accountDisplayName,
        parentId: '1002',
        level: 2,
        direction: 'debit',
        subjectType: 'Asset',
        block: false,
        enableForeign: isForeignCurrency(entry.currency),
        foreignCurrency: isForeignCurrency(entry.currency) ? entry.currency : '',
        enableDept: false,
        enableProject: false,
        isCustomer: false,
        isSupplier: false,
        isEmployee: false,
        enableCashFlow: true,
        disabled: false,
        accountSetId,
      }]);
    }

    // Save opening balance (converted to base currency if foreign)
    const foreignAmount = parseFloat(entry.openingBalance);
    if (!isNaN(foreignAmount) && foreignAmount !== 0) {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const periodStart = accountSet?.startDate || accountSet?.enableDate || new Date().toISOString().substring(0, 7);
      const baseAmount = computeBaseAmount(entry);
      await sqliteService.saveBankOpeningBalance({
        accountNumber: entry.accountNumber.trim(),
        periodStart: periodStart.substring(0, 7),
        balance: baseAmount,
        foreignBalance: isForeignCurrency(entry.currency) ? foreignAmount : null,
        exchangeRate: isForeignCurrency(entry.currency) ? (parseFloat(entry.exchangeRate) || null) : null,
        generateVoucher: false,
        createdBy: 'system',
      });
    }
  };

  const handleAdd = async () => {
    if (!form.bankId) {
      showToast('warning', '请选择银行');
      return;
    }
    if (form.bankId === NEW_BANK_OPTION_ID && !form.customBankName.trim()) {
      showToast('warning', '请输入新增银行名称');
      return;
    }
    if (!form.accountNumber.trim()) {
      showToast('warning', '请输入银行账号');
      return;
    }
    if (isForeignCurrency(form.currency) && (!form.exchangeRate || parseFloat(form.exchangeRate) <= 0)) {
      showToast('warning', '外币账户请填写汇率');
      return;
    }

    setSaving(true);
    try {
      const newIndex = entries.length;
      const newEntry = { ...form };
      await persistEntry(newEntry, newIndex);
      setEntries(prev => [...prev, newEntry]);
      setForm(emptyForm());
      setSaved(true);
      showToast('success', '已保存银行账户');
    } catch (error) {
      console.error('Save bank account failed:', error);
      showToast('error', '保存银行账户失败');
    } finally {
      setSaving(false);
    }
  };

  // Inline edit save
  const handleEditSave = async (id: string) => {
    const index = entries.findIndex(e => e.id === id);
    if (index < 0) return;
    const entry = entries[index];
    if (isForeignCurrency(entry.currency) && (!entry.exchangeRate || parseFloat(entry.exchangeRate) <= 0)) {
      showToast('warning', '外币账户请填写汇率');
      return;
    }
    try {
      await persistEntry(entry, index);
      setEditingId(null);
      setSaved(true);
      showToast('success', '已更新银行账户');
    } catch (error) {
      console.error('Update bank account failed:', error);
      showToast('error', '更新银行账户失败');
    }
  };

  // Edit cell change (only when in edit mode)
  const updateEditedCell = (id: string, field: keyof BankAccountEntry, value: string) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const next = { ...e, [field]: value };
      if (field === 'currency' && value === 'CNY') {
        next.exchangeRate = '';
      }
      return next;
    }));
  };

  const removeEntry = async (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    try {
      await sqliteService.deleteBankAccountBinding?.(entry.accountNumber);
      setEntries(prev => prev.filter((_, i) => i !== index));
      setSaved(entries.length === 1);
    } catch (error) {
      console.error('Delete bank account failed:', error);
      showToast('error', '删除银行账户失败');
    }
  };

  // Excel import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel<BankAccountEntry>(file, BANK_IMPORT_HEADERS);
      const imported: BankAccountEntry[] = [];
      let skipped = 0;

      for (const row of rawData) {
        if (!row.bankName || !row.accountNumber) {
          skipped++;
          continue;
        }
        const bankName = String(row.bankName).trim();
        const matchedId = bankNameToId[bankName] || NEW_BANK_OPTION_ID;
        const currencyStr = String(row.currency || 'CNY').trim().toUpperCase();
        const currencyCode = CURRENCIES.find(c => c.name === currencyStr || c.code === currencyStr)?.code || 'CNY';

        imported.push({
          id: `bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          bankId: matchedId,
          bankName: matchedId !== NEW_BANK_OPTION_ID ? (bankOptions.find(b => b.id === matchedId)?.name || bankName) : '',
          customBankName: matchedId === NEW_BANK_OPTION_ID ? bankName : '',
          accountNumber: String(row.accountNumber).trim(),
          accountName: String(row.accountName || '').trim(),
          currency: currencyCode,
          exchangeRate: String(row.exchangeRate || '').trim(),
          openingBalance: String(Math.round(Number(row.openingBalance || 0) * 100) / 100),
          subjectCode: '',
        });
      }

      if (imported.length === 0) {
        showToast('warning', '未找到有效数据');
      } else {
        setSaving(true);
        let actuallySaved = 0;
        for (const [i, entry] of imported.entries()) {
          if (isForeignCurrency(entry.currency) && (!entry.exchangeRate || parseFloat(entry.exchangeRate) <= 0)) {
            skipped++;
            continue;
          }
          try {
            await persistEntry(entry, entries.length + i);
            setEntries(prev => [...prev, entry]);
            actuallySaved++;
          } catch (err) {
            skipped++;
          }
        }
        if (skipped > 0) showToast('warning', `导入 ${actuallySaved} 条，跳过 ${skipped} 条（外币未填汇率或保存失败）`);
        else showToast('success', `成功导入 ${actuallySaved} 个银行账户`);
        setSaved(true);
        setSaving(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToast('error', `导入失败：${message}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    exportTemplate<BankAccountEntry>(
      '银行账户导入模板',
      { bankName: '建设银行', accountNumber: '6227001234560000001', accountName: '基本户', currency: 'CNY', exchangeRate: '', openingBalance: 100000 } as unknown as BankAccountEntry,
      BANK_IMPORT_HEADERS,
    );
  };

  const handleExport = () => {
    if (entries.length === 0) {
      showToast('warning', '没有可导出的数据');
      return;
    }
    const data = entries.map(e => ({
      '银行': getBankDisplay(e),
      '账号': e.accountNumber,
      '账户名称': e.accountName || '-',
      '币种': getCurrencyDisplay(e.currency),
      '汇率': isForeignCurrency(e.currency) ? (e.exchangeRate || '') : '',
      '期初余额': parseFloat(e.openingBalance) || 0,
      '本位币金额': computeBaseAmount(e),
    }));
    exportToExcel(data, '银行账户');
    showToast('success', '银行账户数据导出成功');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">银行账户配置</h2>
        <p className="text-sm text-slate-500 mt-1">
          配置公司的银行账户。外币账户需填写汇率，系统自动换算为本位币写入科目余额
        </p>
      </div>

      {entries.length > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
          <div className="flex-1 text-center">
            <p className="text-sm text-slate-500">账户数量</p>
            <p className="text-lg font-semibold text-slate-900">{entries.length}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm text-slate-500">本位币期初合计</p>
            <p className="text-lg font-semibold text-blue-700">{totalBaseBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
          </div>
          {saved && (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle2 className="h-3 w-3 mr-1" /> 已保存
            </Badge>
          )}
        </div>
      )}

      {/* Inline add form */}
      <div className="border rounded-lg p-4 bg-slate-50">
        <Label className="text-sm font-medium mb-3 block">新增银行账户</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 items-end gap-3">
          <div>
            <Label className="text-xs text-slate-500">银行 *</Label>
            <select value={form.bankId} onChange={(event) => updateForm('bankId', event.target.value)} className="h-9 w-full rounded-md border px-3 text-sm">
              <option value="">选择银行</option>
              {bankOptions.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
              <option value={NEW_BANK_OPTION_ID}>新增银行...</option>
            </select>
          </div>
          {form.bankId === NEW_BANK_OPTION_ID && (
            <div>
              <Label className="text-xs text-slate-500">新增银行名称 *</Label>
              <Input value={form.customBankName} onChange={(event) => updateForm('customBankName', event.target.value)} placeholder="如：华润银行" className="h-9 text-sm" autoComplete="off" />
            </div>
          )}
          <div>
            <Label className="text-xs text-slate-500">账号 *</Label>
            <Input value={form.accountNumber} onChange={(event) => updateForm('accountNumber', event.target.value)} placeholder="银行账号" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">账户名称</Label>
            <Input value={form.accountName} onChange={(event) => updateForm('accountName', event.target.value)} placeholder="如：基本户" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">币种</Label>
            <select value={form.currency} onChange={(event) => updateForm('currency', event.target.value)} className="h-9 w-full rounded-md border px-3 text-sm">
              {CURRENCIES.map(currency => (
                <option key={currency.code} value={currency.code}>{currency.name} ({currency.code})</option>
              ))}
            </select>
          </div>
          {isForeignCurrency(form.currency) && (
            <div>
              <Label className="text-xs text-slate-500">汇率 *</Label>
              <Input type="number" step="0.0001" value={form.exchangeRate} onChange={(event) => updateForm('exchangeRate', event.target.value)} placeholder="如：7.0" className="h-9 text-sm" autoComplete="off" />
            </div>
          )}
          <div>
            <Label className="text-xs text-slate-500">
              {isForeignCurrency(form.currency) ? '原币期初余额' : '期初余额'}
            </Label>
            <Input type="number" value={form.openingBalance} onChange={(event) => updateForm('openingBalance', event.target.value)} placeholder="0.00" className="h-9 text-sm" autoComplete="off" />
          </div>
        </div>
        {isForeignCurrency(form.currency) && form.openingBalance && form.exchangeRate && (
          <p className="mt-2 text-xs text-blue-600">
            本位币期初余额：¥ {computeBaseAmount(form).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </p>
        )}
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={saving || !form.bankId || !form.accountNumber}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />保存中...</> : <><Plus className="h-4 w-4 mr-1" /> 添加</>}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> 导入Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4 mr-1" /> 下载模板
        </Button>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleExport} className="ml-auto">
            <Download className="h-4 w-4 mr-1" /> 导出
          </Button>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">银行</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">账号</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">账户名称</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">币种</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">汇率</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">原币期初余额</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-32">本位币期初余额</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">关联科目</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isEditing = editingId === entry.id;
                const isForeign = isForeignCurrency(entry.currency);
                // Match by accountNumber (unique) — bankName is not unique across accounts at the same bank
                const isPosted = lockedBankKeys.has(entry.accountNumber);
                return (
                  <tr key={entry.id} className="border-t hover:bg-slate-50">
                    <td className="px-2 py-1">
                      {isEditing ? (
                        <select
                          value={entry.bankId}
                          onChange={(e) => {
                            const bankId = e.target.value;
                            const option = bankOptions.find(b => b.id === bankId);
                            updateEditedCell(entry.id, 'bankId', bankId);
                            if (option) updateEditedCell(entry.id, 'bankName', option.name);
                          }}
                          className="h-8 w-full text-sm rounded-md border px-2"
                        >
                          <option value="">选择银行</option>
                          {bankOptions.map(bank => (
                            <option key={bank.id} value={bank.id}>{bank.name}</option>
                          ))}
                          <option value={NEW_BANK_OPTION_ID}>新增银行...</option>
                        </select>
                      ) : (
                        <span className="font-medium">{getBankDisplay(entry)}</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {isEditing ? (
                        <Input
                          value={entry.accountNumber}
                          onChange={(e) => updateEditedCell(entry.id, 'accountNumber', e.target.value)}
                          className="h-8 text-sm font-mono"
                          autoComplete="off"
                        />
                      ) : (
                        <span className="font-mono text-xs">{entry.accountNumber}</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {isEditing ? (
                        <Input
                          value={entry.accountName}
                          onChange={(e) => updateEditedCell(entry.id, 'accountName', e.target.value)}
                          className="h-8 text-sm"
                          autoComplete="off"
                        />
                      ) : (
                        <span className="text-slate-600">{entry.accountName || '-'}</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {isEditing ? (
                        <select
                          value={entry.currency}
                          onChange={(e) => updateEditedCell(entry.id, 'currency', e.target.value)}
                          disabled={isPosted}
                          className="h-8 w-full text-xs rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="outline" className="text-xs">{getCurrencyDisplay(entry.currency)}</Badge>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {isEditing ? (
                        isForeign ? (
                          <Input
                            type="number"
                            step="0.0001"
                            value={entry.exchangeRate}
                            onChange={(e) => updateEditedCell(entry.id, 'exchangeRate', e.target.value)}
                            disabled={isPosted}
                            className="h-8 text-sm text-right disabled:bg-slate-100"
                            autoComplete="off"
                            placeholder="汇率"
                          />
                        ) : <span className="text-slate-300">-</span>
                      ) : (
                        <span className="text-slate-600">{isForeign ? (entry.exchangeRate || '-') : '-'}</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={entry.openingBalance}
                          onChange={(e) => updateEditedCell(entry.id, 'openingBalance', e.target.value)}
                          disabled={isPosted}
                          className="h-8 text-sm text-right disabled:bg-slate-100"
                          autoComplete="off"
                        />
                      ) : (
                        <span className="text-slate-600">{parseFloat(entry.openingBalance || '0').toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-blue-700 font-medium">
                      ¥ {computeBaseAmount(entry).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-xs font-mono text-slate-500">
                      {entry.subjectCode || '-'}
                    </td>
                    <td className="px-3 py-1">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <Button variant="ghost" size="sm" onClick={() => handleEditSave(entry.id)} className="h-7 w-7 p-0 text-green-600 hover:text-green-700">
                            <Save className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(entry.id)} className="h-7 w-7 p-0">
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => !isPosted && removeEntry(index)}
                          disabled={isPosted}
                          title={isPosted ? '已入账期初凭证，无法删除。如需调整请先冲销期初凭证' : '删除'}
                          className={`h-7 w-7 p-0 ${isPosted ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700'}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <Landmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无银行账户</p>
          <p className="text-sm">点击添加或导入 Excel 批量录入</p>
        </div>
      )}
    </div>
  );
}
