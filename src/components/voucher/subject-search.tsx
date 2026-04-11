'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight, ArrowRight, FolderTree, Hash } from 'lucide-react';
import { useSubjectStore } from '@/stores';

interface Subject {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  direction: 'debit' | 'credit';
  enableDept: boolean;
  enableProject: boolean;
  enableForeign: boolean;
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  enableCashFlow: boolean;
  cashFlowItem?: string;
  disabled: boolean;
  children?: Subject[];
}

interface SubjectSearchProps {
  value: string;
  onSelect: (code: string, name: string) => void;
  placeholder?: string;
  showDirection?: boolean;
  showType?: boolean;
  /** 紧凑模式：更小的字体、更短的行高、更矮的列表 */
  compact?: boolean;
}

export function SubjectSearch({
  value,
  onSelect,
  placeholder = '搜索科目代码或名称...',
  showDirection = true,
  showType = true,
  compact = false
}: SubjectSearchProps) {
  const [searchText, setSearchText] = useState(value || '');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(['1002', '6601']));

  const { subjects } = useSubjectStore();

  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  const subjectTree = useMemo(() => {
    const map = new Map<string, Subject & { children: Subject[] }>();
    subjects.forEach(subject => {
      map.set(subject.id, { ...subject, children: [] });
    });
    const roots: (Subject & { children: Subject[] })[] = [];
    subjects.forEach(subject => {
      const node = map.get(subject.id)!;
      if (subject.parentId) {
        const parent = map.get(subject.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [subjects]);

  const flatSubjects = useMemo(() => {
    const flatten = (subjects: Subject[]): Subject[] => {
      const result: Subject[] = [];
      for (const subject of subjects) {
        if (subject.children) {
          result.push(subject);
          result.push(...flatten(subject.children));
        } else {
          result.push(subject);
        }
      }
      return result;
    };
    return flatten(subjectTree);
  }, [subjectTree]);

  const filteredSubjects = useMemo(() => {
    if (!searchText.trim()) return subjectTree;
    const searchLower = searchText.toLowerCase();
    return flatSubjects.filter(subject =>
      subject.code.toLowerCase().includes(searchLower) ||
      subject.name.toLowerCase().includes(searchLower)
    );
  }, [searchText, flatSubjects, subjectTree]);

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderSubjectTree = (subjects: Subject[], depth: number = 0): React.JSX.Element[] => {
    return subjects.map(subject => {
      const isExpanded = expandedSubjects.has(subject.id);
      const hasChildren = subject.children && subject.children.length > 0;

      return (
        <div key={subject.id} className="select-none">
          <div
            className={`
              flex items-center gap-1.5 cursor-pointer hover:bg-gray-100
              ${compact ? 'px-2 py-1 text-xs' : 'p-2'}
              ${subject.disabled ? 'opacity-50' : ''}
            `}
            style={{ paddingLeft: `${depth * (compact ? 12 : 16) + (compact ? 6 : 8)}px` }}
            onClick={() => !hasChildren && onSelect(subject.code, subject.name)}
          >
            {hasChildren ? (
              <ChevronRight
                className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                onClick={(e) => toggleExpand(subject.id, e)}
              />
            ) : (
              <Hash className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-gray-400`} />
            )}
            <span className={`flex-1 font-mono ${compact ? 'text-xs' : 'text-sm'}`}>
              {subject.code} <span className="font-sans">{subject.name}</span>
            </span>
            {showDirection && !compact && (
              <Badge variant="outline" className="text-xs">
                {subject.direction === 'debit' ? '借' : '贷'}
              </Badge>
            )}
            {showType && !compact && subject.enableDept && (
              <Badge variant="outline" className="text-xs">
                <FolderTree className="w-3 h-3 mr-1" />
                部门
              </Badge>
            )}
            {showType && !compact && subject.enableProject && (
              <Badge variant="outline" className="text-xs">
                部门
              </Badge>
            )}
            {!hasChildren && (
              compact ? (
                <ArrowRight
                  className="w-3 h-3 text-blue-500 shrink-0"
                  onClick={(e) => { e.stopPropagation(); onSelect(subject.code, subject.name); }}
                />
              ) : (
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 shrink-0"
                  disabled={subject.disabled}
                  onClick={(e) => { e.stopPropagation(); onSelect(subject.code, subject.name); }}
                >
                  选择
                </button>
              )
            )}
          </div>

          {isExpanded && hasChildren && (
            <div>{renderSubjectTree(subject.children!, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      {/* 搜索框 */}
      <div className="relative">
        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
        <Input
          placeholder={placeholder}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className={compact ? 'pl-8 h-7 text-xs' : 'pl-10'}
          autoFocus={!compact}
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          name={`subject-search-${Math.random().toString(36).substr(2, 9)}`}
        />
      </div>

      {/* 科目列表 */}
      <div className={`border rounded-lg overflow-y-auto ${compact ? 'max-h-48' : 'max-h-[500px]'}`}>
        {filteredSubjects.length === 0 ? (
          <div className={`flex flex-col items-center justify-center text-gray-500 ${compact ? 'py-6' : 'h-64'}`}>
            <Search className={`${compact ? 'w-6 h-6' : 'w-12 h-12'} mb-1 opacity-50`} />
            <p className={compact ? 'text-xs' : ''}>没有找到匹配的科目</p>
          </div>
        ) : searchText ? (
          <div>
            {filteredSubjects.map(subject => (
              <div
                key={subject.id}
                className={`flex items-center gap-2 cursor-pointer hover:bg-blue-50 border-b border-slate-50
                  ${compact ? 'px-2 py-1 text-xs' : 'p-3 border-b'}`}
                onClick={() => onSelect(subject.code, subject.name)}
              >
                <span className={`font-mono ${compact ? 'text-xs' : 'text-sm'}`}>{subject.code}</span>
                <span className="flex-1">{subject.name}</span>
                {showDirection && !compact && (
                  <Badge variant="outline" className="text-xs">
                    {subject.direction === 'debit' ? '借' : '贷'}
                  </Badge>
                )}
                {compact && (
                  <ArrowRight className="w-3 h-3 text-blue-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>{renderSubjectTree(subjectTree)}</div>
        )}
      </div>
    </div>
  );
}
