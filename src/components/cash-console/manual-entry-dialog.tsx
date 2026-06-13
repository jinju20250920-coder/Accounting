'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { sqliteService } from '@/lib/database';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';
import { Popover } from '@/components/ui/popover';
import { Search, X } from 'lucide-react';
import { useMemo, useEffect } from 'react';
import { BANK_BRANDS } from '@/lib/bank-parsers/bank-registry';

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountNumber: string;
  period: string;
  onSaved?: () => void;
  defaultCurrency?: string;
  isAllAccounts?: boolean;
}

function SubjectPopover({
  value,
  valueName,
  onSelect,
  onClear,
}: {
  value: string | undefined;
  valueName: string | undefined;
  onSelect: (code: string, name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { subjects } = useSubjectStore();

  const flatSubjects = useMemo(() => {
    return subjects.filter(s => !s.disabled);
  }, [subjects]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flatSubjects.slice(0, 50);
    const q = search.toLowerCase();
    return flatSubjects.filter(
      s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [search, flatSubjects]);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}
      content={
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 w-72 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索科目代码或名称..."
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">无匹配科目</div>
            ) : (
              filtered.map(subject => (
                <div
                  key={subject.id}
                  className="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 flex items-center gap-2"
                  onClick={() => { onSelect(subject.code, subject.name); setOpen(false); setSearch(''); }}
                >
                  <span className="font-mono text-slate-600">{subject.code}</span>
                  <span className="text-slate-800">{subject.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      }
    >
      <div className="cursor-pointer" onClick={() => setOpen(true)}>
        {value ? (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-md border border-blue-200 hover:bg-blue-100">
            {value} {valueName}
            <X className="h-3 w-3 ml-0.5 hover:text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClear(); }} />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400 text-xs border border-dashed border-slate-300 rounded-md px-2 py-0.5 hover:border-blue-400 hover:text-blue-500">
            <Search className="h-3 w-3" />
            选择科目
          </span>
        )}
      </div>
    </Popover>
  );
}

export function ManualEntryDialog({
  open,
  onOpenChange,
  accountNumber,
  period,
  onSaved,
  defaultCurrency,
  isAllAccounts,
}: ManualEntryDialogProps) {
  const { showToast } = useToast();
  const currencies = useCurrencyStore((s) => s.currencies);
  const baseCurrency = useAccountSetStore((s) => s.getCurrentAccountSet()?.baseCurrency) || 'CNY';
  const enabledCurrencies = useMemo(() => currencies.filter((c) => !c.disabled), [currencies]);

  const [date, setDate] = useState('');
  const [summary, setSummary] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [subjectCode, setSubjectCode] = useState<string | undefined>();
  const [subjectName, setSubjectName] = useState<string | undefined>();
  const [currency, setCurrency] = useState(defaultCurrency || baseCurrency);
  const [exchangeRate, setExchangeRate] = useState('');
  const [rateSource, setRateSource] = useState<'auto' | 'manual'>('auto');
  const [saving, setSaving] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [selectedBankAccountNumber, setSelectedBankAccountNumber] = useState('');
  const [selectedBankCurrency, setSelectedBankCurrency] = useState<string | undefined>();
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; bankId: string; accountNumber: string; bankName: string; currency?: string; subSubjectCode: string; subSubjectName: string }>>([]);

  // Load bank accounts when dialog opens (for "all accounts" mode)
  useEffect(() => {
    if (open && isAllAccounts) {
      sqliteService.getBankAccountBindings().then(bindings => {
        setBankAccounts(bindings.map(b => ({
          id: b.id || b.bankId,
          bankId: b.bankId || '',
          accountNumber: b.accountNumber || '',
          bankName: b.bankName || '',
          currency: b.currency,
          subSubjectCode: b.subSubjectCode || '',
          subSubjectName: b.subSubjectName || '',
        })));
      });
    }
  }, [open, isAllAccounts]);

  // Sync currency when defaultCurrency changes or bank account selection changes
  useEffect(() => {
    const cur = isAllAccounts ? selectedBankCurrency : defaultCurrency;
    if (cur) {
      setCurrency(cur);
    }
  }, [defaultCurrency, selectedBankCurrency, isAllAccounts]);

  const isForeignCurrency = currency && currency !== baseCurrency;

  // Auto-lookup rate from fxRates table when currency or date changes
  const lookupRate = useCallback(async (cur: string, d: string) => {
    if (!cur || cur === baseCurrency || !d) {
      setExchangeRate('');
      setRateSource('auto');
      return;
    }
    try {
      // First try exact date match
      const rates = await sqliteService.getFxRates(d);
      const match = rates.find((r: any) => r.currencyCode === cur);
      if (match) {
        setExchangeRate(String(match.middleRate));
        setRateSource('auto');
        return;
      }
      // Fallback: find the most recent rate before this date
      const allRates = await sqliteService.getFxRates();
      const before = allRates
        .filter((r: any) => r.currencyCode === cur && r.rateDate <= d)
        .sort((a: any, b: any) => b.rateDate.localeCompare(a.rateDate));
      if (before.length > 0) {
        setExchangeRate(String(before[0].middleRate));
        setRateSource('auto');
      } else {
        setExchangeRate('');
        setRateSource('auto');
      }
    } catch {
      setExchangeRate('');
      setRateSource('auto');
    }
  }, [baseCurrency]);

  const handleCurrencyChange = useCallback((newCurrency: string) => {
    setCurrency(newCurrency);
    if (newCurrency === baseCurrency) {
      setExchangeRate('');
      setRateSource('auto');
    } else {
      setRateSource('auto');
    }
  }, [baseCurrency]);

  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!isForeignCurrency || !date) return;
    if (rateSource !== 'auto') return;
    lookupRate(currency, date);
  }, [open, isForeignCurrency, date, currency, rateSource, lookupRate]);

  const resetForm = () => {
    setDate('');
    setSummary('');
    setAmount('');
    setDirection('credit');
    setSubjectCode(undefined);
    setSubjectName(undefined);
    setCurrency(defaultCurrency || baseCurrency);
    setExchangeRate('');
    setRateSource('auto');
    setSelectedBankAccountId('');
    setSelectedBankAccountNumber('');
    setSelectedBankCurrency(undefined);
  };

  const handleSave = async () => {
    if (isAllAccounts && !selectedBankAccountId) {
      showToast('error', '请先选择银行账户');
      return;
    }
    if (!date || !summary || !amount) {
      showToast('error', '请填写日期、摘要和金额');
      return;
    }

    if (isForeignCurrency && (!exchangeRate || parseFloat(exchangeRate) <= 0)) {
      showToast('error', '外币交易请输入有效汇率');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('error', '请输入有效金额');
      return;
    }

    setSaving(true);
    try {
      const credit = direction === 'credit' ? numAmount : 0;
      const debit = direction === 'debit' ? numAmount : 0;
      const rate = isForeignCurrency ? parseFloat(exchangeRate) : undefined;
      const localAmount = rate ? Math.round(numAmount * rate * 100) / 100 : numAmount;
      const summaryWithCurrency = isForeignCurrency ? `${summary} (${currency}@${rate?.toFixed(4)})` : summary;
      const ourAccount = isAllAccounts ? selectedBankAccountNumber : accountNumber;

      await sqliteService.saveBankTransaction({
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date,
        summary: summaryWithCurrency,
        credit: isForeignCurrency ? (direction === 'credit' ? localAmount : 0) : credit,
        debit: isForeignCurrency ? (direction === 'debit' ? localAmount : 0) : debit,
        amount: isForeignCurrency ? (direction === 'credit' ? localAmount : -localAmount) : (direction === 'credit' ? numAmount : -numAmount),
        exchangeRate: rate || undefined,
        originalAmount: isForeignCurrency ? numAmount : undefined,
        ourAccount,
        status: subjectCode ? 'matched' : 'pending',
        matchedSubject: subjectCode || '',
        matchedSubjectName: subjectName || '',
        source: 'manual',
        rowNumber: 0,
        accountSetId: sqliteService.accountSetId,
        importBatchId: `manual-${period}`,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      });

      showToast('success', '手动记录已保存');
      resetForm();
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      console.error('Failed to save manual entry', e);
      showToast('error', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>手动记一笔</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isAllAccounts && (
            <div className="space-y-2">
              <Label required>银行账户</Label>
              <select
                value={selectedBankAccountId}
                onChange={e => {
                  const acct = bankAccounts.find(a => a.id === e.target.value);
                  if (acct) {
                    setSelectedBankAccountId(acct.id);
                    setSelectedBankAccountNumber(acct.accountNumber);
                    setSelectedBankCurrency(acct.currency);
                  }
                }}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="">请选择银行账户</option>
                {bankAccounts.map(acct => {
                  const brand = BANK_BRANDS[acct.bankId];
                  const bankLabel = brand?.short || acct.bankName || '银行';
                  const lastFour = acct.accountNumber?.slice(-4) || '';
                  const showCurrency = acct.currency && acct.currency !== baseCurrency;
                  const label = `${acct.subSubjectName || '1002'} ${bankLabel}${lastFour ? `****${lastFour}` : ''}${showCurrency ? ` ${acct.currency}` : ''}`;
                  return (
                    <option key={acct.id} value={acct.id}>{label}</option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label required>日期</Label>
            <ChineseDatePicker value={date} onChange={handleDateChange} />
          </div>

          <div className="space-y-2">
            <Label required>摘要</Label>
            <Input
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="输入摘要"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label required>金额</Label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label required>方向</Label>
              <select
                value={direction}
                onChange={e => setDirection(e.target.value as 'credit' | 'debit')}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="credit">收入</option>
                <option value="debit">支出</option>
              </select>
            </div>
          </div>

          <div className={isForeignCurrency ? 'grid grid-cols-2 gap-4' : ''}>
            <div className="space-y-2">
              <Label>币种</Label>
              <select
                value={currency}
                onChange={e => handleCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                {enabledCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}{c.code === baseCurrency ? '（本位币）' : ''}
                  </option>
                ))}
              </select>
            </div>
            {isForeignCurrency && (
              <div className="space-y-2">
                <Label required>汇率 {rateSource === 'auto' && exchangeRate && <span className="text-xs font-normal text-slate-400">(自动填充)</span>}</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={e => { setExchangeRate(e.target.value); setRateSource('manual'); }}
                  placeholder="输入汇率，如 7.12"
                  autoComplete="off"
                />
              </div>
            )}
          </div>

          {isForeignCurrency && exchangeRate && amount && parseFloat(amount) > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md text-xs text-slate-600">
              <span>原币: {parseFloat(amount).toFixed(2)} {currency}</span>
              <span className="text-slate-300">|</span>
              <span>汇率: {parseFloat(exchangeRate).toFixed(4)}</span>
              <span className="text-slate-300">|</span>
              <span className="font-medium">本币: {(parseFloat(amount) * parseFloat(exchangeRate)).toFixed(2)} {baseCurrency}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>对应科目</Label>
            <SubjectPopover
              value={subjectCode}
              valueName={subjectName}
              onSelect={(code, name) => { setSubjectCode(code); setSubjectName(name); }}
              onClear={() => { setSubjectCode(undefined); setSubjectName(undefined); }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}