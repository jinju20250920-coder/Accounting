'use client';

import React, { useState, useEffect } from 'react';
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
import { BANK_BRANDS } from '@/lib/bank-parsers/bank-registry';
import { useToast } from '@/components/ui/toast';

interface BankAccountEntry {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  currency: string;
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

export function SetupStepBank({ accountSetId }: SetupStepBankProps) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<BankAccountEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const bankOptions = Object.entries(BANK_BRANDS).map(([id, brand]) => ({
    id,
    name: brand.short,
    shortName: brand.short,
  }));

  const addEntry = () => {
    setEntries(prev => [
      ...prev,
      {
        id: `bank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        bankName: '',
        accountNumber: '',
        accountName: '',
        currency: 'CNY',
        subjectCode: '',
      },
    ]);
  };

  const removeEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof BankAccountEntry, value: string) => {
    setEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    const validEntries = entries.filter(e => e.bankName && e.accountNumber);
    if (validEntries.length === 0) {
      showToast('warning', '请至少添加一个银行账户');
      return;
    }

    setSaving(true);
    try {
      if (sqliteService.accountSetId !== accountSetId) {
        sqliteService.setAccountSetId(accountSetId);
      }

      for (const entry of validEntries) {
        // Save bank account binding
        await sqliteService.saveBankAccountBinding?.({
          id: entry.id,
          bankId: entry.bankName,
          accountNumber: entry.accountNumber,
          accountName: entry.accountName,
          currency: entry.currency,
          subjectCode: entry.subjectCode || `1002${String(entries.indexOf(entry) + 1).padStart(2, '0')}`,
          accountSetId,
        });

        // Auto-create bank sub-subject under 1002
        const subjectCode = entry.subjectCode || `1002${String(entries.indexOf(entry) + 1).padStart(2, '0')}`;
        const bank = bankOptions.find(b => b.id === entry.bankName);
        const existingSubjects = await sqliteService.getAllSubjects();
        if (!existingSubjects.find(s => s.code === subjectCode)) {
          await sqliteService.saveSubjects([{
            id: subjectCode,
            code: subjectCode,
            name: `${bank?.shortName || entry.bankName} ${entry.accountNumber.slice(-4)}`,
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
                  <Label>银行</Label>
                  <select
                    value={entry.bankName}
                    onChange={(e) => updateEntry(index, 'bankName', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">选择银行</option>
                    {bankOptions.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label required>账号</Label>
                  <Input
                    value={entry.accountNumber}
                    onChange={(e) => updateEntry(index, 'accountNumber', e.target.value)}
                    placeholder="银行账号"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>户名</Label>
                  <Input
                    value={entry.accountName}
                    onChange={(e) => updateEntry(index, 'accountName', e.target.value)}
                    placeholder="与公司名称一致"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>币种</Label>
                  <select
                    value={entry.currency}
                    onChange={(e) => updateEntry(index, 'currency', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
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
