'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Landmark,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Upload,
  Download,
  Edit,
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
import { importFromExcel, exportTemplate, exportToExcel } from '@/lib/excel-utils';

interface BankAccountEntry {
  id: string;
  bankId: string;
  bankName: string;
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

const BANK_IMPORT_HEADERS = [
  { key: 'bankName' as const, label: '银行', required: true },
  { key: 'accountNumber' as const, label: '账号', required: true },
  { key: 'accountName' as const, label: '账户名称', required: false },
  { key: 'currency' as const, label: '币种', required: false },
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
  subjectCode: '',
  openingBalance: '',
});

export function SetupStepBank({ accountSetId }: SetupStepBankProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<BankAccountEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<BankAccountEntry>(emptyForm());

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
          const openingBalance = await sqliteService.getBankOpeningBalance(binding.accountNumber, periodStart);
          const knownBank = bankOptions.some(bank => bank.id === binding.bankId);
          const matchedOption = bankOptions.find(bank => bank.id === binding.bankId);
          return {
            id: binding.id,
            bankId: knownBank ? binding.bankId : NEW_BANK_OPTION_ID,
            bankName: matchedOption?.name || binding.bankName || '',
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

  const getBankDisplay = (entry: BankAccountEntry) => {
    if (entry.bankId === NEW_BANK_OPTION_ID) return entry.customBankName || '自定义银行';
    const option = bankOptions.find(b => b.id === entry.bankId);
    return option?.name || entry.bankName || '-';
  };

  const getCurrencyDisplay = (code: string) => {
    const cur = CURRENCIES.find(c => c.code === code);
    return cur ? `${cur.name}` : code;
  };

  const totalBalance = entries.reduce((sum, e) => sum + (parseFloat(e.openingBalance) || 0), 0);

  // Dialog form handlers
  const openAddDialog = () => {
    setEditingIndex(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setForm({ ...entries[index] });
    setShowDialog(true);
  };

  const updateForm = (field: keyof BankAccountEntry, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'bankId') {
        const option = bankOptions.find(b => b.id === value);
        next.bankName = option?.name || '';
      }
      return next;
    });
  };

  const handleFormSave = () => {
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

    setSaved(false);
    if (editingIndex !== null) {
      setEntries(prev => {
        const next = [...prev];
        next[editingIndex] = { ...form };
        return next;
      });
    } else {
      setEntries(prev => [...prev, { ...form }]);
    }
    setShowDialog(false);
  };

  const removeEntry = (index: number) => {
    setSaved(false);
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (entries.length === 0) {
      showToast('warning', '请至少添加一个银行账户');
      return;
    }

    setSaving(true);
    try {
      if (sqliteService.accountSetId !== accountSetId) {
        sqliteService.setAccountSetId(accountSetId);
      }

      const existingSubjects = await sqliteService.getAllSubjects();
      const existingCodes = new Set(existingSubjects.map(subject => subject.code));
      const existingBindings = await sqliteService.getBankAccountBindings();
      const now = new Date().toISOString();

      for (const [index, entry] of entries.entries()) {
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

      // Save opening balances
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const periodStart = accountSet?.startDate || accountSet?.enableDate || new Date().toISOString().substring(0, 7);
      for (const entry of entries) {
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
      showToast('success', `已保存 ${entries.length} 个银行账户`);
    } catch (error) {
      console.error('Save bank accounts failed:', error);
      showToast('error', '保存银行账户失败');
    } finally {
      setSaving(false);
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
          subjectCode: '',
          openingBalance: String(Math.round(Number(row.openingBalance || 0) * 100) / 100),
        });
      }

      if (imported.length > 0) {
        setSaved(false);
        setEntries(prev => [...prev, ...imported]);
      }
      if (skipped > 0) showToast('warning', `导入 ${imported.length} 条，跳过 ${skipped} 条`);
      else if (imported.length > 0) showToast('success', `成功导入 ${imported.length} 个银行账户`);
      else showToast('warning', '未找到有效数据');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToast('error', `导入失败：${message}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    exportTemplate<BankAccountEntry>(
      '银行账户导入模板',
      { bankName: '建设银行', accountNumber: '6227001234560000001', accountName: '基本户', currency: 'CNY', openingBalance: 100000 } as unknown as BankAccountEntry,
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
      '期初余额': parseFloat(e.openingBalance) || 0,
    }));
    exportToExcel(data, '银行账户');
    showToast('success', '银行账户数据导出成功');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">银行账户配置</h2>
        <p className="text-sm text-slate-500 mt-1">
          配置公司的银行账户，便于银行流水导入和资金管理
        </p>
      </div>

      {entries.length > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
          <div className="flex-1 text-center">
            <p className="text-sm text-slate-500">账户数量</p>
            <p className="text-lg font-semibold text-slate-900">{entries.length}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm text-slate-500">期初余额合计</p>
            <p className="text-lg font-semibold text-blue-700">{totalBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        <Button variant="outline" size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" /> 添加银行账户
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> 导入Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4 mr-1" /> 下载模板
        </Button>
        {entries.length > 0 && (
          <>
            <Button variant="ghost" size="sm" onClick={handleExport} className="ml-auto">
              <Download className="h-4 w-4 mr-1" /> 导出
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setSaved(false); setEntries([]); }} className="text-red-500 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-1" /> 清空
            </Button>
          </>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">银行</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">账号</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">账户名称</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-20">币种</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">期初余额</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{getBankDisplay(entry)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700">{entry.accountNumber}</td>
                  <td className="px-3 py-2 text-slate-600">{entry.accountName || '-'}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">{getCurrencyDisplay(entry.currency)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(parseFloat(entry.openingBalance) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-1">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(index)} className="h-7 w-7 p-0">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeEntry(index)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingIndex !== null ? '编辑银行账户' : '添加银行账户'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label required>银行</Label>
                  <select
                    value={form.bankId}
                    onChange={(event) => updateForm('bankId', event.target.value)}
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
                    value={form.accountNumber}
                    onChange={(event) => updateForm('accountNumber', event.target.value)}
                    placeholder="银行账号"
                    autoComplete="off"
                  />
                </div>
              </div>

              {form.bankId === NEW_BANK_OPTION_ID && (
                <div className="space-y-2">
                  <Label required>新增银行名称</Label>
                  <Input
                    value={form.customBankName}
                    onChange={(event) => updateForm('customBankName', event.target.value)}
                    placeholder="如：华润银行"
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>账户名称</Label>
                  <Input
                    value={form.accountName}
                    onChange={(event) => updateForm('accountName', event.target.value)}
                    placeholder="如：基本户"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>币种</Label>
                  <select
                    value={form.currency}
                    onChange={(event) => updateForm('currency', event.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    {CURRENCIES.map(currency => (
                      <option key={currency.code} value={currency.code}>{currency.name} ({currency.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>期初余额</Label>
                <Input
                  type="number"
                  value={form.openingBalance}
                  onChange={(event) => updateForm('openingBalance', event.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                />
              </div>
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  取消
                </Button>
                <Button type="button" onClick={handleFormSave}>
                  {editingIndex !== null ? '保存修改' : '添加'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
