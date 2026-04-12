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
import { useSubjectStore } from '@/stores';

interface BankAccountSelectorProps {
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  label?: string;
  disabled?: boolean;
}

export interface BankAccount {
  id: string;
  code: string;
  name: string;
  subjectCode: string;
  accountNumber?: string;
  bankName?: string;
}

/**
 * 从科目表动态生成银行账户列表（1002 银行存款的子科目）
 */
export function getBankAccountsFromSubjects(subjects: any[]): BankAccount[] {
  // 找到 1002 科目
  const bankSubject = subjects.find(s => s.code === '1002');
  if (!bankSubject) return [];

  // 获取 1002 的所有子科目
  const children = subjects.filter(s => s.parentId === bankSubject.id && !s.disabled);

  // 如果没有子科目，返回 1002 本身
  if (children.length === 0) {
    return [{
      id: bankSubject.id,
      code: bankSubject.code,
      name: bankSubject.name,
      subjectCode: bankSubject.code,
    }];
  }

  // 返回子科目列表
  return children.map(child => ({
    id: child.id,
    code: child.code,
    name: child.name,
    subjectCode: child.code,
    accountNumber: child.bankAccountNumber || '',
    bankName: child.name,
  }));
}

export function BankAccountSelector({
  selectedAccountId,
  onSelectAccount,
  label = '选择银行账户',
  disabled = false
}: BankAccountSelectorProps) {
  const subjects = useSubjectStore(state => state.subjects);
  const accounts = getBankAccountsFromSubjects(subjects);

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
                  {account.accountNumber && ` | ...${account.accountNumber.slice(-4)}`}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** 兼容旧代码的 DEFAULT_BANK_ACCOUNTS 导出（动态版） */
export function getDefaultBankAccounts(): BankAccount[] {
  const subjects = useSubjectStore.getState().subjects;
  return getBankAccountsFromSubjects(subjects);
}
