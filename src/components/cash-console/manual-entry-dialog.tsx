'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { sqliteService } from '@/lib/database';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useToast } from '@/components/ui/toast';
import { Popover } from '@/components/ui/popover';
import { Search, X } from 'lucide-react';
import { useMemo } from 'react';

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountNumber: string;
  period: string;
  onSaved?: () => void;
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
}: ManualEntryDialogProps) {
  const { showToast } = useToast();
  const [date, setDate] = useState('');
  const [summary, setSummary] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [subjectCode, setSubjectCode] = useState<string | undefined>();
  const [subjectName, setSubjectName] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setDate('');
    setSummary('');
    setAmount('');
    setDirection('credit');
    setSubjectCode(undefined);
    setSubjectName(undefined);
  };

  const handleSave = async () => {
    if (!date || !summary || !amount) {
      showToast('error', '请填写日期、摘要和金额');
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

      await sqliteService.saveBankTransaction({
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date,
        summary,
        credit,
        debit,
        amount: direction === 'credit' ? numAmount : -numAmount,
        ourAccount: accountNumber,
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
          <div className="space-y-2">
            <Label required>日期</Label>
            <ChineseDatePicker value={date} onChange={setDate} />
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