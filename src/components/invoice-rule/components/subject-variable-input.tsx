// src/components/invoice-rule/components/subject-variable-input.tsx

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SubjectVariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// 支持的变量类型
const SUPPORTED_VARIABLES = [
  { key: '{{税率}}', label: '税率', color: 'blue' },
  { key: '{{供应商}}', label: '供应商', color: 'green' },
  { key: '{{商品类型}}', label: '商品类型', color: 'purple' },
  { key: '{{日期}}', label: '日期', color: 'orange' },
  { key: '{{部门}}', label: '部门', color: 'red' },
];

export function SubjectVariableInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: SubjectVariableInputProps) {
  // 检测变量并渲染为 Badge（纯派生，用 useMemo）
  const displayValue = useMemo(() => {
    const variableRegex = /{{[\u4e00-\u9fa5a-zA-Z0-9]+}}/g;
    let match;
    let lastIndex = 0;
    const parts = [];

    while ((match = variableRegex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push(value.slice(lastIndex, match.index));
      }

      const variable = SUPPORTED_VARIABLES.find(v => v.key === match[0]);
      if (variable) {
        parts.push(`<badge-${variable.color}>${variable.key}</badge-${variable.color}>`);
      } else {
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < value.length) {
      parts.push(value.slice(lastIndex));
    }

    return parts.join('');
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // 过滤可能的HTML标签，只允许文本和变量格式
    const filtered = rawValue.replace(/<[^>]+>/g, '');
    onChange(filtered);
  };

  const renderDisplay = () => {
    const badgeRegex = /<badge-([a-z]+)>(.*?)<\/badge-[a-z]+>/g;
    let match;
    let lastIndex = 0;
    const elements = [];

    while ((match = badgeRegex.exec(displayValue)) !== null) {
      if (match.index > lastIndex) {
        elements.push(displayValue.slice(lastIndex, match.index));
      }

      const [, color, content] = match;
      elements.push(
        <Badge
          key={match.index}
          variant="secondary"
          className={cn(
            'ml-1 mr-1',
            color === 'blue' && 'bg-blue-100 text-blue-800',
            color === 'green' && 'bg-green-100 text-green-800',
            color === 'purple' && 'bg-purple-100 text-purple-800',
            color === 'orange' && 'bg-orange-100 text-orange-800',
            color === 'red' && 'bg-red-100 text-red-800',
          )}
        >
          {content}
        </Badge>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < displayValue.length) {
      elements.push(displayValue.slice(lastIndex));
    }

    return elements;
  };

  return (
    <div className={cn('relative', className)}>
      <Input
        value={value}
        onChange={handleInput}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'pr-32',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
        {SUPPORTED_VARIABLES.slice(0, 3).map((variable) => (
          <Badge
            key={variable.key}
            variant="outline"
            className={cn(
              'cursor-pointer hover:bg-slate-100',
              variable.color === 'blue' && 'text-blue-600 border-blue-200',
              variable.color === 'green' && 'text-green-600 border-green-200',
              variable.color === 'purple' && 'text-purple-600 border-purple-200',
              variable.color === 'orange' && 'text-orange-600 border-orange-200',
              variable.color === 'red' && 'text-red-600 border-red-200',
            )}
            onClick={() => onChange(value + variable.key)}
          >
            {variable.key}
          </Badge>
        ))}
      </div>
    </div>
  );
}