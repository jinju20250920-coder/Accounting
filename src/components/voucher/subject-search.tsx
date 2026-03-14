'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ChevronRight, Building2, FolderTree, Hash } from 'lucide-react';

interface Subject {
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  direction: 'debit' | 'credit';
  enableDept: boolean;
  enableProject: boolean;
  enableForeign: boolean;
  isAR: boolean;
  isAP: boolean;
  disabled: boolean;
  children?: Subject[];
}

interface SubjectSearchProps {
  value: string;
  onSelect: (code: string, name: string) => void;
  placeholder?: string;
  showDirection?: boolean;
  showType?: boolean;
}

// 默认科目数据
const DEFAULT_SUBJECTS: Subject[] = [
  // 资产类
  {
    code: '1001',
    name: '库存现金',
    parentId: null,
    level: 1,
    direction: 'debit',
    enableDept: true,
    enableProject: false,
    enableForeign: false,
    isAR: false,
    isAP: false,
    disabled: false
  },
  {
    code: '1002',
    name: '银行存款',
    parentId: null,
    level: 1,
    direction: 'debit',
    enableDept: true,
    enableProject: false,
    enableForeign: true,
    isAR: false,
    isAP: false,
    disabled: false,
    children: [
      {
        code: '100201',
        name: '工商银行',
        parentId: '1002',
        level: 2,
        direction: 'debit',
        enableDept: true,
        enableProject: false,
        enableForeign: true,
        isAR: false,
        isAP: false,
        disabled: false
      },
      {
        code: '100202',
        name: '建设银行',
        parentId: '1002',
        level: 2,
        direction: 'debit',
        enableDept: true,
        enableProject: false,
        enableForeign: true,
        isAR: false,
        isAP: false,
        disabled: false
      }
    ]
  },
  // 负债类
  {
    code: '2001',
    name: '短期借款',
    parentId: null,
    level: 1,
    direction: 'credit',
    enableDept: true,
    enableProject: false,
    enableForeign: false,
    isAR: false,
    isAP: false,
    disabled: false
  },
  // 所有者权益类
  {
    code: '4001',
    name: '实收资本',
    parentId: null,
    level: 1,
    direction: 'credit',
    enableDept: false,
    enableProject: false,
    enableForeign: false,
    isAR: false,
    isAP: false,
    disabled: false
  },
  // 成本类
  {
    code: '5001',
    name: '生产成本',
    parentId: null,
    level: 1,
    direction: 'debit',
    enableDept: true,
    enableProject: true,
    enableForeign: false,
    isAR: false,
    isAP: false,
    disabled: false
  },
  // 损益类
  {
    code: '6001',
    name: '主营业务收入',
    parentId: null,
    level: 1,
    direction: 'credit',
    enableDept: false,
    enableProject: true,
    enableForeign: false,
    isAR: false,
    isAP: false,
    disabled: false
  },
  {
    code: '6601',
    name: '销售费用',
    parentId: null,
    level: 1,
    direction: 'debit',
    enableDept: true,
    enableProject: true,
    enableForeign: false,
    isAR: false,
    isAP: false,
    disabled: false,
    children: [
      {
        code: '660101',
        name: '运输费',
        parentId: '6601',
        level: 2,
        direction: 'debit',
        enableDept: true,
        enableProject: true,
        enableForeign: false,
        isAR: false,
        isAP: false,
        disabled: false
      },
      {
        code: '660102',
        name: '广告费',
        parentId: '6601',
        level: 2,
        direction: 'debit',
        enableDept: true,
        enableProject: true,
        enableForeign: false,
        isAR: false,
        isAP: false,
        disabled: false
      }
    ]
  },
  {
    code: '6602',
    name: '管理费用',
    parentId: null,
    level: 1,
    direction: 'debit',
    enableDept: true,
    enableProject: true,
    enableForeign: false,
    isAR: false,
    isAP: false,
    disabled: false
  },
  {
    code: '6603',
    name: '财务费用',
    parentId: null,
    level: 1,
    direction: 'debit',
    enableDept: false,
    enableProject: true,
    enableForeign: true,
    isAR: false,
    isAP: false,
    disabled: false
  }
];

export function SubjectSearch({
  value,
  onSelect,
  placeholder = '搜索科目代码或名称...',
  showDirection = true,
  showType = true
}: SubjectSearchProps) {
  const [searchText, setSearchText] = useState(value || '');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(['1002', '6601']));

  // 当外部 value 变化时更新搜索文本
  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  // 将科目展开为扁平列表
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
    return flatten(DEFAULT_SUBJECTS);
  }, []);

  // 过滤科目
  const filteredSubjects = useMemo(() => {
    if (!searchText.trim()) {
      return DEFAULT_SUBJECTS;
    }

    const searchLower = searchText.toLowerCase();
    return flatSubjects.filter(subject =>
      subject.code.toLowerCase().includes(searchLower) ||
      subject.name.toLowerCase().includes(searchLower)
    );
  }, [searchText, flatSubjects]);

  // 切换展开/收起
  const toggleExpand = useCallback((code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  // 递归渲染科目树
  const renderSubjectTree = (subjects: Subject[], depth: number = 0): React.JSX.Element[] => {
    return subjects.map(subject => {
      const isExpanded = expandedSubjects.has(subject.code);
      const hasChildren = subject.children && subject.children.length > 0;

      return (
        <div key={subject.code} className="select-none">
          <div
            className={`
              flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100
              ${depth > 0 ? 'ml-4' : ''}
              ${subject.disabled ? 'opacity-50' : ''}
            `}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => !hasChildren && onSelect(subject.code, subject.name)}
          >
            {hasChildren ? (
              <ChevronRight
                className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                onClick={(e) => toggleExpand(subject.code, e)}
              />
            ) : (
              <Hash className="w-4 h-4 text-gray-400" />
            )}
            <span className="flex-1">{subject.code} {subject.name}</span>
            {showDirection && (
              <Badge variant="outline" className="text-xs">
                {subject.direction === 'debit' ? '借' : '贷'}
              </Badge>
            )}
            {showType && subject.enableDept && (
              <Badge variant="outline" className="text-xs">
                <FolderTree className="w-3 h-3 mr-1" />
                部门
              </Badge>
            )}
            {showType && subject.enableProject && (
              <Badge variant="outline" className="text-xs">
                <Building2 className="w-3 h-3 mr-1" />
                项目
              </Badge>
            )}
            {!hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={subject.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(subject.code, subject.name);
                }}
              >
                选择
              </Button>
            )}
          </div>

          {/* 递归渲染子科目 */}
          {isExpanded && hasChildren && (
            <div>
              {renderSubjectTree(subject.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder={placeholder}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>

      {/* 科目树 */}
      <div className="border rounded-lg max-h-[500px] overflow-y-auto">
        {filteredSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Search className="w-12 h-12 mb-2 opacity-50" />
            <p>没有找到匹配的科目</p>
          </div>
        ) : searchText ? (
          // 搜索结果 - 扁平显示
          <div>
            {filteredSubjects.map(subject => (
              <div
                key={subject.code}
                className="flex items-center gap-2 p-3 border-b cursor-pointer hover:bg-blue-50"
                onClick={() => onSelect(subject.code, subject.name)}
              >
                <span className="font-mono text-sm">{subject.code}</span>
                <span className="flex-1">{subject.name}</span>
                {showDirection && (
                  <Badge variant="outline" className="text-xs">
                    {subject.direction === 'debit' ? '借' : '贷'}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          // 树形显示
          <div>{renderSubjectTree(DEFAULT_SUBJECTS)}</div>
        )}
      </div>
    </div>
  );
}
