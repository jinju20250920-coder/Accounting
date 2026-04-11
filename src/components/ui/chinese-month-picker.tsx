'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChineseMonthPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function ChineseMonthPicker({ value, onChange, className, placeholder = '选择月份', disabled }: ChineseMonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.split('-')[0]);
    return new Date().getFullYear();
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // sync viewYear when value changes externally
  useEffect(() => {
    if (value) {
      const y = parseInt(value.split('-')[0]);
      if (!isNaN(y)) setViewYear(y);
    }
  }, [value]);

  const displayValue = value
    ? `${value.split('-')[0]}年${parseInt(value.split('-')[1])}月`
    : placeholder;

  const handleSelect = (monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, '0');
    onChange(`${viewYear}-${mm}`);
    setOpen(false);
  };

  const selectedMonth = value ? parseInt(value.split('-')[1]) : -1;
  const selectedYear = value ? parseInt(value.split('-')[0]) : -1;

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-left',
          'transition-colors outline-none hover:border-slate-400',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50',
          !value && 'text-slate-400',
          open && 'border-ring ring-3 ring-ring/50'
        )}
      >
        {displayValue}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[240px]">
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewYear(y => y - 1)}
              className="p-1 rounded hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">{viewYear}年</span>
            <button
              type="button"
              onClick={() => setViewYear(y => y + 1)}
              className="p-1 rounded hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((label, idx) => {
              const isSelected = viewYear === selectedYear && idx + 1 === selectedMonth;
              const isCurrentMonth = (() => {
                const now = new Date();
                return viewYear === now.getFullYear() && idx + 1 === now.getMonth() + 1;
              })();

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className={cn(
                    'px-2 py-1.5 text-sm rounded-md transition-colors',
                    isSelected
                      ? 'bg-blue-600 text-white font-medium'
                      : isCurrentMonth
                        ? 'bg-blue-50 text-blue-700 font-medium hover:bg-blue-100'
                        : 'hover:bg-slate-100'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
