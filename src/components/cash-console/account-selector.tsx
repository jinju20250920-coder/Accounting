'use client';

import { useState, useEffect } from 'react';
import { sqliteService } from '@/lib/database';
import { BANK_BRANDS } from '@/lib/bank-parsers/bank-registry';
import { useSubjectStore } from '@/stores/useSubjectStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface AccountOption {
  id: string;
  label: string;
  bankName: string;
  accountNumber: string;
  brandColor?: string;
  icon?: string;
  isCash?: boolean;
  currency?: string;
}

interface AccountSelectorProps {
  selectedAccountId: string;
  onSelectAccount: (id: string, accountNumber: string, currency?: string) => void;
}

export function AccountSelector({ selectedAccountId, onSelectAccount }: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const subjects = useSubjectStore(s => s.subjects);

  useEffect(() => {
    loadAccounts();
  }, [subjects]);

  const loadAccounts = async () => {
    const options: AccountOption[] = [];

    // "全部账户" option — no ourAccount filter, shows all transactions
    options.push({
      id: 'all-accounts',
      label: '全部账户',
      bankName: '全部',
      accountNumber: '',
      icon: '📊',
    });

    // 加载银行账户绑定
    try {
      const bindings = await sqliteService.getBankAccountBindings();
      for (const binding of bindings) {
        const brand = BANK_BRANDS[binding.bankId];
        const lastFour = binding.accountNumber?.slice(-4) || '';
        const bankShort = brand?.short || binding.bankName || '银行';
        const alias = binding.aliasName?.trim();
        // 统一格式：银行简称 + 账户别名 + 账号后四位
        const parts = [bankShort];
        if (alias) parts.push(alias);
        if (lastFour) parts.push(`****${lastFour}`);
        const label = parts.join(' ');
        options.push({
          id: binding.id || binding.bankId,
          label,
          bankName: bankShort,
          accountNumber: binding.accountNumber || '',
          brandColor: brand?.color,
          icon: '🏦',
          currency: binding.currency,
        });
      }
    } catch (e) {
      console.warn('Failed to load bank account bindings', e);
    }

    // 添加现金日记账选项
    const cashSubject = subjects.find(s => s.code === '1001');
    if (cashSubject) {
      options.push({
        id: 'cash-journal',
        label: '现金日记账',
        bankName: '现金',
        accountNumber: '1001',
        isCash: true,
      });
    }

    setAccounts(options);

    // 自动选择"全部账户"
    if (options.length > 0 && !selectedAccountId) {
      const first = options[0];
      onSelectAccount(first.id, first.accountNumber, first.currency);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedAccountId}
        onValueChange={(value) => {
          const account = accounts.find(a => a.id === value);
          if (account) {
            onSelectAccount(account.id, account.accountNumber, account.currency);
          }
        }}
      >
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="选择账户" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <span className="flex items-center gap-2">
                <span>{account.icon || (account.isCash ? '💴' : '🏦')}</span>
                <span>{account.label}</span>
                {account.currency && account.currency !== 'CNY' && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                    {account.currency}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link href="/settings/bank-accounts">
        <button className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600">
          <Plus className="h-3.5 w-3.5" />
          新增账户
        </button>
      </Link>
    </div>
  );
}
