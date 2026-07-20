'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Popover } from '@/components/ui/popover';
import { Search, X } from 'lucide-react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import type { Voucher } from '@/types';

interface VoucherSearchPopoverProps {
  value?: { voucherId: string; voucherNo: string } | null;
  onSelect: (voucherId: string, voucherNo: string) => void;
  onClear?: () => void;
}

export function VoucherSearchPopover({ value, onSelect, onClear }: VoucherSearchPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const vouchers = useVoucherStore(s => s.vouchers ?? []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vouchers.slice(0, 50);
    return vouchers.filter(v => {
      const voucherNo = v.voucherNo?.toLowerCase() ?? '';
      const summary = v.summary?.toLowerCase() ?? '';
      const date = v.date ?? '';
      return (
        voucherNo.includes(q) ||
        summary.includes(q) ||
        date.includes(q)
      );
    }).slice(0, 50);
  }, [query, vouchers]);

  const handleSelect = (voucher: Voucher) => {
    onSelect(voucher.id, voucher.voucherNo);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery('');
      }}
      content={
        <div className="w-80 bg-white border border-slate-200/80 rounded-xl shadow-xl">
          <div className="relative p-2 border-b">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索凭证号 / 摘要 / 日期"
              className="w-full pl-8 pr-2 py-1 text-sm outline-none bg-transparent"
              autoComplete="off"
            />
          </div>
          <div className="max-h-60 overflow-auto">
            {filtered.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-400">
                无匹配凭证
              </div>
            )}
            {filtered.map((v: Voucher) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelect(v)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                <span className="font-mono text-blue-600">{v.voucherNo}</span>
                <span className="text-slate-500 truncate ml-2">
                  {v.date}
                  {v.summary ? ` · ${v.summary}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      }
    >
      {value ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
          onClick={() => setOpen(!open)}
        >
          <span className="font-mono">{value.voucherNo}</span>
          {onClear && (
            <X
              className="h-3 w-3 hover:text-red-500"
              onClick={handleClear}
            />
          )}
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:border-blue-400"
          onClick={() => setOpen(!open)}
        >
          <Search className="h-3 w-3" /> 关联凭证
        </button>
      )}
    </Popover>
  );
}