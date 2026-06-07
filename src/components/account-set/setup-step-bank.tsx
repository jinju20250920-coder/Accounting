'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { BANK_BRANDS } from '@/lib/bank-parsers/bank-registry';
import { useToast } from '@/components/ui/toast';
import {
  NEW_BANK_OPTION_ID,
  buildBankAccountDisplayName,
  resolveBankSelection,
} from '@/lib/bank-account-names';

interface BankAccountEntry {
  id: string;
  bankId: string;
  customBankName: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  subjectCode: string;
  openingBalance: string;
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

export function SetupStepBank({ accountSetId }: SetupStepBankProps) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<BankAccountEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const bankOptions = useMemo(() => Object.entries(BANK_BRANDS).map(([id, brand]) => ({
    id,
    name: brand.short,
    shortName: brand.short,
  })), []);

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
          const openingBalance = await sqliteService.getBankOpeningBalance(binding.accountNumber, periodStart);
          const knownBank = bankOptions.some(bank => bank.id === binding.bankId);
          return {
            id: binding.id,
            bankId: knownBank ? binding.bankId : NEW_BANK_OPTION_ID,
            customBankName: knownBank ? '' : binding.bankName,
            accountNumber: binding.accountNumber,
            accountName: binding.aliasName || binding.subSubjectName || '',
            currency: binding.currency || 'CNY',
            subjectCode: binding.subSubjectCode || '',
            openingBalance: openingBalance !== null && openingBalance !== undefined ? String(openingBalance) : '',
          };
        }));
        setEntries(loadedEntries);
        setSaved(loadedEntries.length > 0);
      } catch (error) {
        console.warn('Load bank accounts failed:', error);
      }
    };
    loadExistingAccounts();
  }, [accountSetId, bankOptions]);

  const addEntry = () => {
    setSaved(false);
    setEntries(prev => [
      ...prev,
      {
        id: `bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        bankId: '',
        customBankName: '',
        accountNumber: '',
        accountName: '',
        currency: 'CNY',
        subjectCode: '',
        openingBalance: '',
      },
    ]);
  };

  const removeEntry = (index: number) => {
    setSaved(false);
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof BankAccountEntry, value: string) => {
    setSaved(false);
    setEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const validateEntries = () => {
    const validEntries: BankAccountEntry[] = [];

    for (const [index, entry] of entries.entries()) {
      if (!entry.bankId) {
        showToast('warning', `第 ${index + 1} 个银行账户必须选择银行`);
        return null;
      }
      if (entry.bankId === NEW_BANK_OPTION_ID && !entry.customBankName.trim()) {
        showToast('warning', `第 ${index + 1} 个银行账户请输入新增银行名称`);
        return null;
      }
      if (!entry.accountNumber.trim()) {
        showToast('warning', `第 ${index + 1} 个银行账户请输入账号`);
        return null;
      }
      validEntries.push(entry);
    }

    if (validEntries.length === 0) {
      showToast('warning', '请至少添加一个银行账户');
      return null;
    }

    return validEntries;
  };

  const handleSave = async () => {
    const validEntries = validateEntries();
    if (!validEntries) return;

    setSaving(true);
    try {
      if (sqliteService.accountSetId !== accountSetId) {
        sqliteService.setAccountSetId(accountSetId);
      }

      const existingSubjects = await sqliteService.getAllSubjects();
      const existingCodes = new Set(existingSubjects.map(subject => subject.code));
      const existingBindings = await sqliteService.getBankAccountBindings();
      const now = new Date().toISOString();

      for (const [index, entry] of validEntries.entries()) {
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

        const existingBinding = existingBindings.find(binding => binding.accountNumber === entry.accountNumber.trim());
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
          createdAt: now,
        });

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
            enableForeign: entry.currency !== 'CNY',
            foreignCurrency: entry.currency !== 'CNY' ? entry.currency : '',
            enableDept: false,
            enableProject: false,
            isCustomer: false,
            isSupplier: false,
            isEmployee: false,
            enableCashFlow: true,
            disabled: false,
            accountSetId,
          }]);
          existingCodes.add(subjectCode);
        }
      }

      // Save opening balances for entries that have one
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const periodStart = accountSet?.startDate || accountSet?.enableDate || new Date().toISOString().substring(0, 7);
      for (const entry of validEntries) {
        const balance = parseFloat(entry.openingBalance);
        if (!isNaN(balance) && balance !== 0) {
          await sqliteService.saveBankOpeningBalance({
            accountNumber: entry.accountNumber.trim(),
            periodStart: periodStart.substring(0, 7),
            balance,
            generateVoucher: false,
            createdBy: 'system',
          });
        }
      }

      setSaved(true);
      showToast('success', `已保存 ${validEntries.length} 个银行账户`);
    } catch (error) {
      console.error('Save bank accounts failed:', error);
      showToast('error', '保存银行账户失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">银行账户配置</h2>
        <p className="text-sm text-slate-500 mt-1">
          配置公司的银行账户，便于银行流水导入和资金管理
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
          <Landmark className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-3">暂无银行账户</p>
          <Button variant="outline" onClick={addEntry}>
            <Plus className="h-4 w-4 mr-1" />
            添加银行账户
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div key={entry.id} className="border rounded-lg p-4 relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEntry(index)}
                className="absolute top-2 right-2 h-7 w-7 p-0 text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>

              <div className="grid grid-cols-2 gap-4 pr-8">
                <div className="space-y-2">
                  <Label required>银行</Label>
                  <select
                    value={entry.bankId}
                    onChange={(event) => updateEntry(index, 'bankId', event.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">选择银行</option>
                    {bankOptions.map(bank => (
                      <option key={bank.id} value={bank.id}>{bank.name}</option>
                    ))}
                    <option value={NEW_BANK_OPTION_ID}>新增银行...</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label required>账号</Label>
                  <Input
                    value={entry.accountNumber}
                    onChange={(event) => updateEntry(index, 'accountNumber', event.target.value)}
                    placeholder="银行账号"
                    autoComplete="off"
                  />
                </div>
                {entry.bankId === NEW_BANK_OPTION_ID && (
                  <div className="space-y-2">
                    <Label required>新增银行名称</Label>
                    <Input
                      value={entry.customBankName}
                      onChange={(event) => updateEntry(index, 'customBankName', event.target.value)}
                      placeholder="如：华润银行"
                      autoComplete="off"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>银行账户名称</Label>
                  <Input
                    value={entry.accountName}
                    onChange={(event) => updateEntry(index, 'accountName', event.target.value)}
                    placeholder="可手写，如：XX银行-4451 USD"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>币种</Label>
                  <select
                    value={entry.currency}
                    onChange={(event) => updateEntry(index, 'currency', event.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    {CURRENCIES.map(currency => (
                      <option key={currency.code} value={currency.code}>{currency.name} ({currency.code})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>期初余额</Label>
                  <Input
                    type="number"
                    value={entry.openingBalance}
                    onChange={(event) => updateEntry(index, 'openingBalance', event.target.value)}
                    placeholder="0.00"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addEntry} className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            添加银行账户
          </Button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex justify-end gap-2">
          {saved && (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle2 className="h-3 w-3 mr-1" /> 已保存
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || saved}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                保存中...
              </>
            ) : (
              '保存银行账户'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
