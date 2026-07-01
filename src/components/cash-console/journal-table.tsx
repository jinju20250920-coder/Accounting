'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { sqliteService } from '@/lib/database';
import { BANK_BRANDS } from '@/lib/bank-parsers/bank-registry';
import { formatMoney } from '@/lib/accounting';
import { VoucherStamp } from '@/components/shared/voucher-stamp';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';
import { Search, X, ChevronLeft, ChevronRight, FileText, Lock, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { isMonetarySubject } from '@/lib/fx-monetary';
import { waitForDbInit } from '@/hooks/useDatabaseSync';

interface JournalTableProps {
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
  directionFilter?: string;
  onDirectionFilterChange?: (filter: string) => void;
  refreshKey: number;
  onRefresh?: () => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

interface JournalEntry {
  id: string;
  date: string;
  summary: string;
  counterpartyName?: string;
  counterpartyAccount?: string;
  matchedSubject?: string;
  matchedSubjectName?: string;
  credit: number;
  debit: number;
  balance?: number;
  status: string;
  source?: string;
  notes?: string;
  voucherNo?: string;
  generatedVoucherNo?: string;
  confidence?: number;
  rowNumber?: number;
  ourAccount?: string;
  ourAccountName?: string;
  currency?: string;
  exchangeRate?: number;
  originalAmount?: number;
}

function SubjectSearchPortal({
  search,
  setSearch,
  filtered,
  onSelect,
  onClose,
}: {
  search: string;
  setSearch: (v: string) => void;
  filtered: { id: string; code: string; name: string }[];
  onSelect: (code: string, name: string) => void;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/20" />
      <div
        className="fixed bg-white rounded-lg shadow-xl border border-slate-200 w-72 overflow-hidden"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        onClick={e => e.stopPropagation()}
      >
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
                onClick={() => { onSelect(subject.code, subject.name); onClose(); }}
              >
                <span className="font-mono text-slate-600">{subject.code}</span>
                <span className="text-slate-800">{subject.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function SubjectInlineSelector({
  value,
  valueName,
  confidence,
  onSelect,
  onClear,
}: {
  value?: string;
  valueName?: string;
  confidence?: number;
  onSelect: (code: string, name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const subjects = useSubjectStore(s => s.subjects);

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

  const confidenceColor = confidence && confidence > 0.7
    ? 'text-green-600' : confidence && confidence > 0.4
    ? 'text-yellow-600' : 'text-slate-400';

  const closePortal = () => { setOpen(false); setSearch(''); };

  if (value) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer hover:bg-blue-100" onClick={() => setOpen(true)}>
          {value} {valueName}
          {confidence !== undefined && (
            <span className={`text-[10px] ${confidenceColor}`}>
              {Math.round(confidence * 100)}%
            </span>
          )}
        </span>
        <X className="h-3 w-3 text-slate-400 hover:text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClear(); }} />
        {open && <SubjectSearchPortal search={search} setSearch={setSearch} filtered={filtered} onSelect={onSelect} onClose={closePortal} />}
      </span>
    );
  }

  return (
    <span className="relative">
      <span
        className="inline-flex items-center gap-1 text-slate-400 text-xs border border-dashed border-slate-300 rounded px-1.5 py-0.5 cursor-pointer hover:border-blue-400 hover:text-blue-500"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3 w-3" />
        选择科目
      </span>
      {open && <SubjectSearchPortal search={search} setSearch={setSearch} filtered={filtered} onSelect={onSelect} onClose={closePortal} />}
    </span>
  );
}

interface VoucherDetail {
  id: string;
  voucherNo: string;
  date: string;
  summary: string;
  status: string;
  entries: {
    subjectCode: string;
    subjectName: string;
    debit: number;
    credit: number;
    summary: string;
    currencyCode?: string;
    originalAmount?: number;
    exchangeRate?: number;
  }[];
}

function VoucherDetailDialog({
  open,
  onOpenChange,
  voucherNo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucherNo: string | null;
}) {
  const [detail, setDetail] = useState<VoucherDetail | null>(null);
  const subjects = useSubjectStore(s => s.subjects);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch-on-open: setDetail(null) clears stale state synchronously while the new fetch is in flight; cannot derive from props because voucher history is async server data. */
  useEffect(() => {
    if (!open || !voucherNo) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vouchers = await sqliteService.getAllVouchers();
        const voucher = vouchers.find(v => v.voucherNo === voucherNo);
        if (cancelled) return;
        if (!voucher) { setDetail(null); return; }

        const subjectMap = new Map(subjects.map(s => [s.code, s.name]));

        setDetail({
          id: voucher.id,
          voucherNo: voucher.voucherNo,
          date: voucher.date,
          summary: voucher.summary || '',
          status: voucher.status || 'draft',
          entries: (voucher.entries || []).map(e => ({
            subjectCode: e.subjectCode || '',
            subjectName: subjectMap.get(e.subjectCode) || e.subjectName || '',
            debit: e.debit || 0,
            credit: e.credit || 0,
            summary: e.summary || '',
            currencyCode: e.currencyCode || '',
            originalAmount: e.originalAmount || 0,
            exchangeRate: e.exchangeRate || 0,
          })),
        });
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load voucher', e);
          setDetail(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, voucherNo, subjects]);
  /* eslint-enable react-hooks/set-state-in-effect */


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-600" />
            {detail?.voucherNo || voucherNo}
          </DialogTitle>
        </DialogHeader>
        {detail ? (
          <div className="space-y-3 relative">
            {/* 印章标志 */}
            <VoucherStamp status={detail.status} />
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>日期: {detail.date}</span>
              {detail.summary && <span>摘要: {detail.summary}</span>}
            </div>
            {(() => {
              const showFxColumns = detail.entries.some(e => e.currencyCode && e.currencyCode !== 'CNY');
              const fmtRate = (r?: number) => r && r > 0 ? r.toFixed(4) : '-';
              const fmtOriginal = (e: { subjectCode?: string; currencyCode?: string; originalAmount?: number; exchangeRate?: number }) => {
                if (!isMonetarySubject(e.subjectCode)) return '-';
                if (!e.currencyCode || e.currencyCode === 'CNY') return '-';
                return e.originalAmount && e.originalAmount > 0 ? formatMoney(e.originalAmount) : '-';
              };
              const fxCellStyle = (e: { subjectCode: string; currencyCode?: string }) => {
                const isMonetary = isMonetarySubject(e.subjectCode);
                const hasFx = !!e.currencyCode && e.currencyCode !== 'CNY';
                return isMonetary && hasFx ? 'text-slate-600' : 'text-slate-300';
              };
              return (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs">
                      <th className="py-1.5 text-left font-medium">科目</th>
                      <th className="py-1.5 text-right font-medium">借方</th>
                      <th className="py-1.5 text-right font-medium">贷方</th>
                      {showFxColumns && <th className="py-1.5 text-right font-medium">币别</th>}
                      {showFxColumns && <th className="py-1.5 text-right font-medium">原币金额</th>}
                      {showFxColumns && <th className="py-1.5 text-right font-medium">汇率</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.entries.map((e, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1.5">
                          <span className="font-mono text-slate-600">{e.subjectCode}</span>
                          <span className="ml-1">{e.subjectName}</span>
                        </td>
                        <td className="py-1.5 text-right text-red-600">{e.debit ? formatMoney(e.debit) : '-'}</td>
                        <td className="py-1.5 text-right text-green-600">{e.credit ? formatMoney(e.credit) : '-'}</td>
                        {showFxColumns && (
                          <td className={`py-1.5 text-right ${fxCellStyle(e)}`}>
                            {isMonetarySubject(e.subjectCode) && e.currencyCode && e.currencyCode !== 'CNY'
                              ? e.currencyCode : '-'}
                          </td>
                        )}
                        {showFxColumns && (
                          <td className={`py-1.5 text-right ${fxCellStyle(e)}`}>{fmtOriginal(e)}</td>
                        )}
                        {showFxColumns && (
                          <td className={`py-1.5 text-right ${fxCellStyle(e)}`}>
                            {isMonetarySubject(e.subjectCode) && e.currencyCode && e.currencyCode !== 'CNY'
                              ? fmtRate(e.exchangeRate) : '-'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 font-medium">
                      <td className="py-1.5">合计</td>
                      <td className="py-1.5 text-right">{formatMoney(detail.entries.reduce((s, e) => s + e.debit, 0))}</td>
                      <td className="py-1.5 text-right">{formatMoney(detail.entries.reduce((s, e) => s + e.credit, 0))}</td>
                      {showFxColumns && <td colSpan={3} />}
                    </tr>
                  </tfoot>
                </table>
              );
            })()}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-sm">加载中...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function JournalTable({
  accountNumber,
  periodStart,
  periodEnd,
  openingBalance,
  statusFilter,
  onStatusFilterChange,
  directionFilter,
  onDirectionFilterChange,
  refreshKey,
  onRefresh,
  onSelectionChange,
}: JournalTableProps) {
  const { showToast } = useToast();
  const baseCurrency = useAccountSetStore((s) => s.getCurrentAccountSet()?.baseCurrency) || 'CNY';
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [voucherDialogNo, setVoucherDialogNo] = useState<string | null>(null);
  const [bankNameMap, setBankNameMap] = useState<Record<string, string>>({});
  const [accountCurrencyMap, setAccountCurrencyMap] = useState<Record<string, string>>({});
  const [openingFx, setOpeningFx] = useState<{ foreignBalance: number | null; exchangeRate: number | null }>({ foreignBalance: null, exchangeRate: null });
  const pageSize = 50;

  const isForeignAccount = !!accountNumber && !!accountCurrencyMap[accountNumber] && accountCurrencyMap[accountNumber] !== baseCurrency;

  // Load bank name mapping from bindings
  useEffect(() => {
    loadBankNames();
  }, []);

  const loadBankNames = async () => {
    try {
      const bindings = await sqliteService.getBankAccountBindings();
      const nameMap: Record<string, string> = {};
      const currencyMap: Record<string, string> = {};
      for (const b of bindings) {
        const brand = BANK_BRANDS[b.bankId];
        const name = brand?.short || b.bankName || '';
        if (b.accountNumber && name) {
          nameMap[b.accountNumber] = name;
        }
        if (b.accountNumber && b.currency) {
          currencyMap[b.accountNumber] = b.currency;
        }
      }
      setBankNameMap(nameMap);
      setAccountCurrencyMap(currencyMap);
    } catch { /* ignore */ }
  };

  // Load foreign-balance info for the opening row when the account is foreign currency
  useEffect(() => {
    if (!accountNumber || !periodStart) {
      setOpeningFx({ foreignBalance: null, exchangeRate: null });
      return;
    }
    (async () => {
      try {
        await waitForDbInit();
        const detail = await sqliteService.getBankOpeningBalanceDetail(accountNumber, periodStart.substring(0, 7));
        if (detail && (detail.foreignBalance != null || detail.exchangeRate != null)) {
          setOpeningFx({ foreignBalance: detail.foreignBalance ?? null, exchangeRate: detail.exchangeRate ?? null });
        } else {
          setOpeningFx({ foreignBalance: null, exchangeRate: null });
        }
      } catch {
        setOpeningFx({ foreignBalance: null, exchangeRate: null });
      }
    })();
  }, [accountNumber, periodStart]);

  useEffect(() => {
    loadEntries();
  }, [accountNumber, periodStart, periodEnd, statusFilter, page, refreshKey]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      // Wait for DatabaseSyncWrapper to set the real accountSetId before querying,
      // otherwise we get empty results from the placeholder 'default' accountSetId.
      await waitForDbInit();
      const result = await sqliteService.getJournalEntries(accountNumber || '', periodStart, periodEnd, {
        statusFilter: statusFilter || undefined,
        page,
        pageSize,
      });
      setEntries(result.entries || []);
      setTotal(result.total || 0);
      const emptySet = new Set<string>();
      setSelectedIds(emptySet);
      setTimeout(() => onSelectionChange?.(emptySet), 0);
    } catch (e) {
      console.error('Failed to load journal entries', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter by direction (receipt/payment)
  const directionFilteredEntries = useMemo(() => {
    const dir = directionFilter || '';
    if (!dir) return entries;
    if (dir === 'receipt') return entries.filter(e => (e.credit || 0) > 0);
    if (dir === 'payment') return entries.filter(e => (e.debit || 0) > 0);
    return entries;
  }, [entries, directionFilter]);

  const entriesWithBalance = useMemo(() => {
    let runningBalance = openingBalance;
    const accountCurrency = accountNumber ? accountCurrencyMap[accountNumber] : undefined;
    return directionFilteredEntries.map(entry => {
      runningBalance = runningBalance + (entry.credit || 0) - (entry.debit || 0);
      return {
        ...entry,
        balance: runningBalance,
        currency: accountCurrency || 'CNY',
        exchangeRate: entry.exchangeRate || undefined,
        originalAmount: entry.originalAmount || undefined,
      };
    });
  }, [directionFilteredEntries, openingBalance, accountNumber, accountCurrencyMap]);

  const totalPages = Math.ceil(total / pageSize);

  const [statusCounts, setStatusCounts] = useState({ pending: 0, matched: 0, posted: 0, unmatched: 0 });
  useEffect(() => {
    loadStatusCounts();
  }, [accountNumber, periodStart, periodEnd, refreshKey]);

  const loadStatusCounts = async () => {
    try {
      const counts = await sqliteService.getTransactionStatusCounts(accountNumber || '', periodStart, periodEnd);
      setStatusCounts({
        pending: counts.pending || 0,
        matched: counts.matched || 0,
        posted: counts.voucher_generated || 0,
        unmatched: 0,
      });
    } catch {
      // ignore
    }
  };

  const handleSubjectSelect = async (entryId: string, code: string, name: string) => {
    try {
      await sqliteService.updateBankTransaction(entryId, {
        matchedSubject: code,
        matchedSubjectName: name,
        confidence: 1.0,
        status: 'matched',
      });
      setEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, matchedSubject: code, matchedSubjectName: name, confidence: 1.0, status: 'matched' } : e
      ));
    } catch (e) {
      console.error('Failed to update subject', e);
      showToast('error', '科目更新失败');
    }
  };

  const handleSubjectClear = async (entryId: string) => {
    try {
      await sqliteService.updateBankTransaction(entryId, {
        matchedSubject: '',
        matchedSubjectName: '',
        status: 'pending',
      });
      setEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, matchedSubject: '', matchedSubjectName: '', status: 'pending' } : e
      ));
    } catch (e) {
      console.error('Failed to clear subject', e);
      showToast('error', '科目清除失败');
    }
  };

  const toggleSelect = useCallback((id: string) => {
    let next: Set<string>;
    setSelectedIds(prev => {
      next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Call outside state updater to avoid setState-during-render
    setTimeout(() => onSelectionChange?.(next!), 0);
  }, [onSelectionChange]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === entries.length) {
      const empty = new Set<string>();
      setSelectedIds(empty);
      setTimeout(() => onSelectionChange?.(empty), 0);
    } else {
      const next = new Set(entries.map(e => e.id));
      setSelectedIds(next);
      setTimeout(() => onSelectionChange?.(next), 0);
    }
  }, [entries, selectedIds, onSelectionChange]);

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    try {
      for (const id of selectedIds) {
        await sqliteService.deleteBankTransaction(id);
      }
      showToast('success', `已删除 ${count} 条流水`);
      const emptySet = new Set<string>();
      setSelectedIds(emptySet);
      setTimeout(() => onSelectionChange?.(emptySet), 0);
      onRefresh?.();
      loadEntries();
    } catch (e) {
      console.error('Batch delete failed', e);
      showToast('error', '批量删除失败');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
    return dateStr;
  };

  const getStatusBadge = (entry: JournalEntry) => {
    if (entry.status === 'voucher_generated') {
      return <Badge variant="outline" className="text-[10px] h-5 bg-green-50 text-green-700 border-green-200">已入账</Badge>;
    }
    if (entry.status === 'matched') {
      return <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-200">已匹配</Badge>;
    }
    if (entry.status === 'pending') {
      return <Badge variant="outline" className="text-[10px] h-5 bg-yellow-50 text-yellow-700 border-yellow-200">待处理</Badge>;
    }
    if (entry.source === 'manual') {
      return <Badge variant="outline" className="text-[10px] h-5 bg-purple-50 text-purple-700 border-purple-200">手动</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] h-5 bg-slate-50 text-slate-600 border-slate-200">{entry.status}</Badge>;
  };

  const filterTabs = [
    { key: '', label: '全部' },
    { key: 'pending', label: `待入账(${statusCounts.pending})` },
    { key: 'voucher_generated', label: `已入账(${statusCounts.posted})` },
    { key: 'matched', label: `已匹配(${statusCounts.matched})` },
  ];

  const hasAnyData = statusCounts.pending + statusCounts.matched + statusCounts.posted > 0;
  const hasOpening = openingBalance !== 0;
  // In "全部账户" mode the aggregated opening row is always meaningful —
  // don't hide the table just because no transactions exist in the period.
  const isAllAccounts = !accountNumber;

  if (!isAllAccounts && !hasAnyData && !hasOpening && !loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-400">
        暂无流水数据，请导入银行流水
      </div>
    );
  }

  return (
    <div>
      {/* Title */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-slate-700">资金日记账明细</h3>
        <span className="text-xs text-slate-400">记录银行收支流水及科目匹配情况</span>
      </div>

      {/* Filter tabs + batch actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { onStatusFilterChange(tab.key); setPage(1); }}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                statusFilter === tab.key
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="h-4 w-px bg-slate-200 mx-1" />
          {[
            { key: '', label: '全部' },
            { key: 'receipt', label: '收款' },
            { key: 'payment', label: '付款' },
          ].map(tab => (
            <button
              key={`dir-${tab.key}`}
              onClick={() => { onDirectionFilterChange?.(tab.key); setPage(1); }}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                (directionFilter || '') === tab.key
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">已选 {selectedIds.size} 条</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleBatchDelete}
            >
              <Trash2 className="h-3 w-3" />
              批量删除
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          <span className="w-8 flex justify-center shrink-0">
            <Checkbox
              checked={entries.length > 0 && selectedIds.size === entries.length}
              onCheckedChange={toggleSelectAll}
              className="h-3.5 w-3.5"
            />
          </span>
          <span className="w-10 shrink-0">序号</span>
          <span className="w-14 shrink-0">日期</span>
          <span className="w-28 shrink-0">摘要</span>
          <span className="w-24 shrink-0">对方账号</span>
          <span className="flex-1 min-w-[120px] shrink-0">对应科目</span>
          <span className="w-24 text-right shrink-0">收入</span>
          <span className="w-24 text-right shrink-0">支出</span>
          <span className="w-28 text-right shrink-0">余额</span>
          <span className="w-20 flex justify-center shrink-0">状态</span>
          {isForeignAccount && <span className="w-14 text-center shrink-0">币种</span>}
          <span className="w-20 shrink-0">银行</span>
          <span className="w-24 shrink-0">备注</span>
          <span className="w-24 shrink-0">凭证编号</span>
        </div>

        {/* Opening balance row */}
        <div className="flex items-center px-3 py-2.5 bg-amber-50/70 border-b border-amber-200 text-sm text-slate-700">
          <span className="w-8 shrink-0" />
          <span className="w-10 shrink-0" />
          <span className="w-14 shrink-0">{formatDate(periodStart)}</span>
          <span className="w-28 font-semibold text-amber-800 shrink-0">银行期初余额</span>
          <span className="w-24 shrink-0" />
          <span className="flex-1 min-w-[120px] text-slate-400 text-xs shrink-0">(账套设置录入)</span>
          <span className="w-24 text-right shrink-0">-</span>
          <span className="w-24 text-right shrink-0">-</span>
          <span className="w-28 text-right font-semibold text-slate-800 shrink-0">{formatMoney(openingBalance)}</span>
          <span className="w-20 flex justify-center shrink-0"><Lock className="h-3.5 w-3.5 text-amber-500" /></span>
          {isForeignAccount && (
            <span
              className="w-14 text-center shrink-0"
              title={openingFx.exchangeRate ? `币别: ${accountCurrencyMap[accountNumber!] || ''}\n入账汇率: ${openingFx.exchangeRate.toFixed(4)}\n原币余额: ${openingFx.foreignBalance != null ? formatMoney(openingFx.foreignBalance) : '-'}` : undefined}
            >
              <div className="text-xs font-semibold text-amber-800">
                {accountCurrencyMap[accountNumber!] || ''}
              </div>
              {openingFx.exchangeRate ? (
                <div className="text-[10px] text-amber-700 mt-0.5 leading-tight">
                  汇率 {openingFx.exchangeRate.toFixed(4)}
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 mt-0.5">汇率 -</div>
              )}
              {openingFx.foreignBalance != null ? (
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  原 {formatMoney(openingFx.foreignBalance)}
                </div>
              ) : null}
            </span>
          )}
          <span className="w-20 truncate text-slate-500 shrink-0" title={accountNumber ? (bankNameMap[accountNumber] || '') : '全部账户汇总'}>
            {accountNumber ? (bankNameMap[accountNumber] || '') : '汇总'}
          </span>
          <span className="w-24 shrink-0" />
          <span className="w-24 shrink-0" />
        </div>

        {/* Data rows */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">加载中...</div>
        ) : entriesWithBalance.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {openingBalance !== 0 ? '本期暂无银行流水（仅显示期初余额）' : '暂无流水数据，请导入银行流水'}
          </div>
        ) : (
          entriesWithBalance.map((entry, idx) => {
            const globalNo = (page - 1) * pageSize + idx + 1;
            const voucherNo = entry.generatedVoucherNo || entry.voucherNo || '';

            return (
              <div
                key={entry.id}
                className={`flex items-center px-3 py-2 border-b border-slate-100 hover:bg-slate-50/50 text-xs group ${
                  selectedIds.has(entry.id) ? 'bg-blue-50/40' : ''
                }`}
              >
                <span className="w-8 flex justify-center shrink-0">
                  <Checkbox
                    checked={selectedIds.has(entry.id)}
                    onCheckedChange={() => toggleSelect(entry.id)}
                    className="h-3.5 w-3.5"
                  />
                </span>
                <span className="w-10 text-slate-500 shrink-0">{globalNo}</span>
                <span className="w-14 text-slate-600 shrink-0">{formatDate(entry.date)}</span>
                <span className="w-28 truncate shrink-0" title={entry.summary}>{entry.summary}</span>
                <span className="w-24 truncate text-slate-500 shrink-0" title={entry.counterpartyName || ''}>
                  {entry.counterpartyName || ''}
                </span>
                <span className="flex-1 min-w-[120px] shrink-0">
                  {entry.status === 'voucher_generated' ? (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-xs font-medium px-1.5 py-0.5 rounded border border-slate-200">
                      {entry.matchedSubject} {entry.matchedSubjectName}
                      <Lock className="h-3 w-3 ml-0.5" />
                    </span>
                  ) : (
                    <SubjectInlineSelector
                      value={entry.matchedSubject}
                      valueName={entry.matchedSubjectName}
                      confidence={entry.confidence}
                      onSelect={(code, name) => handleSubjectSelect(entry.id, code, name)}
                      onClear={() => handleSubjectClear(entry.id)}
                    />
                  )}
                </span>
                <span className="w-24 text-right shrink-0">
                  {entry.credit > 0 ? (
                    <span className="text-green-600 font-medium">{formatMoney(entry.credit)}</span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </span>
                <span className="w-24 text-right shrink-0">
                  {entry.debit > 0 ? (
                    <span className="text-red-600 font-medium">{formatMoney(entry.debit)}</span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </span>
                <span className="w-28 text-right shrink-0 text-slate-700 font-medium">
                  {formatMoney(entry.balance || 0)}
                </span>
                <span className="w-20 flex justify-center shrink-0">
                  {getStatusBadge(entry)}
                </span>
                {isForeignAccount && (
                  <span className="w-14 text-center shrink-0" title={entry.exchangeRate ? `原币: ${entry.originalAmount || '-'} 汇率: ${entry.exchangeRate}` : undefined}>
                    <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">
                      {entry.currency || 'CNY'}
                      {entry.exchangeRate ? `@${entry.exchangeRate}` : ''}
                    </Badge>
                    {entry.originalAmount ? (
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatMoney(entry.originalAmount)}</div>
                    ) : null}
                  </span>
                )}
                <span className="w-20 truncate text-slate-500 shrink-0" title={entry.ourAccount ? (bankNameMap[entry.ourAccount] || '') : ''}>
                  {entry.ourAccount ? (bankNameMap[entry.ourAccount] || '') : ''}
                </span>
                <span className="w-24 truncate text-slate-400 shrink-0" title={entry.notes || ''}>
                  {entry.notes || ''}
                </span>
                <span className="w-24 truncate shrink-0" title={voucherNo}>
                  {voucherNo ? (
                    <button
                      className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                      onClick={() => setVoucherDialogNo(voucherNo)}
                    >
                      {voucherNo}
                    </button>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </span>
              </div>
            );
          })
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
            <span className="text-xs text-slate-500">共 {total} 条</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-slate-600">{page}/{totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <VoucherDetailDialog
        open={!!voucherDialogNo}
        onOpenChange={(open) => { if (!open) setVoucherDialogNo(null); }}
        voucherNo={voucherDialogNo}
      />
    </div>
  );
}