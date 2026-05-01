'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  code?: string;
  description?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string, option?: SearchableOption) => void;
  options: SearchableOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  emptyText = '无匹配结果',
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() =>
    options.find(o => o.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.code && o.code.toLowerCase().includes(q)) ||
      (o.description && o.description.toLowerCase().includes(q))
    );
  }, [options, search]);

  const handleOpen = (isOpen: boolean) => {
    if (disabled) return;
    setOpen(isOpen);
    if (!isOpen) {
      setSearch('');
    }
  };

  const handleSelect = (option: SearchableOption) => {
    onChange(option.value, option);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
  };

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // 计算下拉框位置 - 强制向下展开
  const dropdownStyle = useMemo((): React.CSSProperties | null => {
    if (!open || !buttonRef.current) return null;

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const maxHeight = Math.min(280, spaceBelow - 8); // 留8px底部空间

    return {
      position: 'fixed' as const,
      top: rect.bottom + 4, // 始终向下，sideOffset=4
      left: rect.left,
      width: rect.width, // 与输入框宽度一致
      zIndex: 9999,
      maxHeight: Math.max(maxHeight, 120), // 最小120px高度
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`h-9 w-full text-sm rounded-md px-3 text-left flex items-center gap-2 transition-colors border ${
          disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
            : selectedOption
              ? 'bg-slate-50 text-slate-800 border-slate-200'
              : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
        }`}
        onClick={() => handleOpen(!open)}
      >
        <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="flex-1 truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption && !disabled && (
          <X
            className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 flex-shrink-0"
            onClick={handleClear}
          />
        )}
      </button>

      {open && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          className="bg-white border border-slate-200 rounded-lg shadow-lg"
          style={dropdownStyle}
        >
          {/* 搜索框 */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-slate-50"
                autoFocus
              />
            </div>
          </div>
          {/* 选项列表 - 可滚动 */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: `${(dropdownStyle.maxHeight as number) - 60}px` }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-blue-50 flex items-center gap-2 ${
                    option.value === value ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  <span className="flex-1 truncate">
                    {option.code ? (
                      <span>
                        <span className="font-mono text-slate-600 mr-2">{option.code}</span>
                        {option.label}
                      </span>
                    ) : (
                      option.label
                    )}
                  </span>
                  {option.description && (
                    <span className="text-xs text-slate-400 truncate max-w-[100px]">
                      {option.description}
                    </span>
                  )}
                  {option.value === value && <Check className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default SearchableSelect;