
'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface BankAccountSelectorProps {
  accounts: BankAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  label?: string;
  disabled?: boolean;
}

interface BankAccount {
  id: string;
  code: string;
  name: string;
  subjectCode: string;
  accountNumber?: string;
  bankName?: string;
}

export function BankAccountSelector({
  accounts,
  selectedAccountId,
  onSelectAccount,
  label = '选择银行账户',
  disabled = false
}: BankAccountSelectorProps) {
  return (
    <div className="space-y-2">
      <Label required>{label}</Label>
      <Select
        value={selectedAccountId || ''}
        onValueChange={onSelectAccount}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="请选择银行账户" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex flex-col">
                <span className="font-medium">{account.name}</span>
                <span className="text-xs text-slate-500">
                  {account.subjectCode}
                  {account.accountNumber && ` | ${account.accountNumber}`}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// 默认银行账户列表（科目1002的子科目）
export const DEFAULT_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'bank_1002',
    code: '1002',
    name: '银行存款',
    subjectCode: '1002'
  },
  {
    id: 'bank_1002_01',
    code: '100201',
    name: '建设银行',
    subjectCode: '100201',
    accountNumber: '32250198648200001614',
    bankName: '中国建设银行股份有限公司昆山张浦支行'
  }
];
