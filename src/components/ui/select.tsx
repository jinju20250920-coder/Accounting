'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  code?: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  variant?: 'default' | 'excel';
  onKeyDown?: (e: React.KeyboardEvent<HTMLSelectElement>) => void;
  'data-field'?: string;
  'data-entry-id'?: string;
  showCode?: boolean;
}

export function Select({ options, placeholder = '请选择', value, onChange, className, variant = 'default', onKeyDown, 'data-field': dataField, 'data-entry-id': dataEntryId, showCode = true, ...props }: SelectProps) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
      data-field={dataField}
      data-entry-id={dataEntryId}
      className={cn(
        variant === 'excel'
          ? // Excel 风格：无圆角、无阴影、紧凑、共用边框（无边框，让表格处理边框）
            'flex h-7 w-full rounded-none border-0 bg-white px-1.5 py-0.5 text-sm focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50'
          : // 默认风格
            'flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      autoComplete="off"
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {showCode && option.code ? `${option.code} ${option.label}` : option.label}
        </option>
      ))}
    </select>
  );
}
