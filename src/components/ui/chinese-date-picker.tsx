'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChineseDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function ChineseDatePicker({ value, onChange, className, placeholder = '选择日期', disabled, min, max }: ChineseDatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.split('-')[0]);
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return parseInt(value.split('-')[1]);
    return new Date().getMonth() + 1;
  });

  // 计算弹出位置（Portal 挂载到 body）
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const panelHeight = 320;

    let top: number;
    if (spaceBelow >= panelHeight || spaceBelow >= spaceAbove) {
      top = rect.bottom + 4;
    } else {
      top = rect.top - panelHeight - 4;
    }

    setPanelStyle({
      position: 'fixed',
      top,
      left: rect.left,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      const onScroll = () => updatePosition();
      const onResize = () => updatePosition();
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onResize);
      };
    }
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m);
      }
    }
  }, [value]);

  const displayValue = value
    ? `${value.split('-')[0]}年${parseInt(value.split('-')[1])}月${parseInt(value.split('-')[2])}日`
    : placeholder;

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth - 1, 0).getDate();

    const days: Array<{ day: number; month: 'prev' | 'current' | 'next'; fullDate: string }> = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const m = viewMonth === 1 ? 12 : viewMonth - 1;
      const y = viewMonth === 1 ? viewYear - 1 : viewYear;
      days.push({ day, month: 'prev', fullDate: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, month: 'current', fullDate: `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 12 ? 1 : viewMonth + 1;
      const y = viewMonth === 12 ? viewYear + 1 : viewYear;
      days.push({ day: d, month: 'next', fullDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    return days;
  }, [viewYear, viewMonth]);

  const handleSelect = (fullDate: string) => {
    if (min && fullDate < min) return;
    if (max && fullDate > max) return;
    onChange(fullDate);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else { setViewMonth(m => m - 1); }
  };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else { setViewMonth(m => m + 1); }
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth() + 1);
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    onChange(today);
    setOpen(false);
  };

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <div className={cn('inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-left',
          'transition-colors outline-none hover:border-slate-400',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50',
          !value && 'text-slate-400',
          open && 'border-ring ring-2 ring-ring/20'
        )}
      >
        {displayValue}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="bg-white border border-slate-200 rounded-lg shadow-xl p-3 w-[280px]"
        >
          {/* Month/Year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-slate-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">{viewYear}年{viewMonth}月</span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-slate-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((item, idx) => {
              const isSelected = value === item.fullDate;
              const isToday = today === item.fullDate;
              const isDisabled = (min && item.fullDate < min) || (max && item.fullDate > max);

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelect(item.fullDate)}
                  className={cn(
                    'h-8 w-8 text-sm rounded-full mx-auto flex items-center justify-center transition-colors',
                    item.month !== 'current' && 'text-slate-300',
                    isSelected && 'bg-blue-600 text-white font-medium',
                    !isSelected && isToday && 'bg-blue-50 text-blue-700 font-medium',
                    !isSelected && !isToday && item.month === 'current' && 'hover:bg-slate-100',
                    isDisabled && 'opacity-30 cursor-not-allowed'
                  )}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <div className="mt-2 pt-2 border-t flex justify-end">
            <button
              type="button"
              onClick={goToday}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
            >
              今天
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
