'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Search, Plus, Trash2 } from 'lucide-react';

interface Subject {
  code: string;
  name: string;
  children?: Subject[];
}

interface SubjectLinkageConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  linkedSubjectCodes: string[];
  allSubjects: Subject[];
  onSave: (codes: string[]) => void;
  title?: string;
}

// 展平科目树用于搜索和显示
const flattenSubjects = (subjects: Subject[]): Subject[] => {
  const result: Subject[] = [];
  const traverse = (items: Subject[]) => {
    items.forEach(item => {
      result.push(item);
      if (item.children) {
        traverse(item.children);
      }
    });
  };
  traverse(subjects);
  return result;
};

// 解析科目代码（支持通配符和区间）
const parseSubjectPattern = (pattern: string, allCodes: string[]): string[] => {
  const result: Set<string> = new Set();

  // 处理区间语法，如 "1001..1009"
  if (pattern.includes('..')) {
    const [start, end] = pattern.split('..');
    allCodes.forEach(code => {
      if (code >= start && code <= end) {
        result.add(code);
      }
    });
    return Array.from(result);
  }

  // 处理通配符，如 "1002*" 或 "1002.*"
  if (pattern.includes('*')) {
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\./g, '\\.');
    const regex = new RegExp(`^${regexPattern}$`);
    allCodes.forEach(code => {
      if (regex.test(code)) {
        result.add(code);
      }
    });
    return Array.from(result);
  }

  // 精确匹配
  return [pattern];
};

// 检查代码是否匹配模式
const isCodeMatched = (code: string, pattern: string): boolean => {
  // 区间匹配
  if (pattern.includes('..')) {
    const [start, end] = pattern.split('..');
    return code >= start && code <= end;
  }
  // 通配符匹配
  if (pattern.includes('*')) {
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\./g, '\\.');
    return new RegExp(`^${regexPattern}$`).test(code);
  }
  // 精确匹配
  return code === pattern;
};

export function SubjectLinkageConfigurator({
  isOpen,
  onClose,
  linkedSubjectCodes,
  allSubjects,
  onSave,
  title = '关联科目配置'
}: SubjectLinkageConfiguratorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customPattern, setCustomPattern] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<string[]>(linkedSubjectCodes);

  const flatSubjects = useMemo(() => flattenSubjects(allSubjects), [allSubjects]);
  const allCodes = useMemo(() => flatSubjects.map(s => s.code), [flatSubjects]);

  // 计算当前选中的所有科目（展开通配符和区间）
  const expandedSelectedCodes = useMemo(() => {
    const expanded: string[] = [];
    selectedCodes.forEach(pattern => {
      expanded.push(...parseSubjectPattern(pattern, allCodes));
    });
    return [...new Set(expanded)].sort();
  }, [selectedCodes, allCodes]);

  // 过滤科目
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return flatSubjects;

    const query = searchQuery.toLowerCase();
    return flatSubjects.filter(s =>
      s.code.toLowerCase().includes(query) ||
      s.name.toLowerCase().includes(query)
    );
  }, [flatSubjects, searchQuery]);

  // 检查科目是否被选中
  const isSubjectSelected = (code: string): boolean => {
    return expandedSelectedCodes.includes(code);
  };

  // 切换科目选中状态
  const toggleSubject = (code: string) => {
    if (isSubjectSelected(code)) {
      // 从选中中移除
      // 需要找到哪个模式包含了这个科目，然后移除
      const newSelected = selectedCodes.filter(pattern => {
        const matched = parseSubjectPattern(pattern, allCodes);
        return !matched.includes(code);
      });
      setSelectedCodes(newSelected);
    } else {
      // 添加精确匹配
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  // 添加自定义模式
  const addCustomPattern = () => {
    if (!customPattern.trim()) return;

    // 验证模式
    const isValid = /^[0-9*.]+$/.test(customPattern);
    if (!isValid) {
      alert('请输入有效的科目代码模式（数字、*、..）');
      return;
    }

    if (selectedCodes.includes(customPattern)) {
      alert('该模式已存在');
      return;
    }

    setSelectedCodes([...selectedCodes, customPattern]);
    setCustomPattern('');
  };

  // 移除模式
  const removePattern = (pattern: string) => {
    setSelectedCodes(selectedCodes.filter(p => p !== pattern));
  };

  // 全选/取消全选当前筛选结果
  const toggleSelectAllFiltered = () => {
    const allFilteredSelected = filteredSubjects.every(s => isSubjectSelected(s.code));

    if (allFilteredSelected) {
      // 取消全选
      const filteredCodes = filteredSubjects.map(s => s.code);
      const newSelected = selectedCodes.filter(pattern => {
        const matched = parseSubjectPattern(pattern, allCodes);
        return !matched.some(code => filteredCodes.includes(code));
      });
      setSelectedCodes(newSelected);
    } else {
      // 全选 - 添加精确代码
      const newCodes = filteredSubjects
        .filter(s => !isSubjectSelected(s.code))
        .map(s => s.code);
      setSelectedCodes([...selectedCodes, ...newCodes]);
    }
  };

  const handleSave = () => {
    onSave(selectedCodes);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 p-4">
          {/* 已选模式显示 */}
          <div>
            <label className="text-sm font-medium mb-2 block">已配置的科目关联</label>
            <div className="flex flex-wrap gap-2">
              {selectedCodes.length === 0 ? (
                <span className="text-sm text-slate-500">暂无关联科目</span>
              ) : (
                selectedCodes.map(pattern => {
                  const expandedCount = parseSubjectPattern(pattern, allCodes).length;
                  return (
                    <Badge key={pattern} variant="secondary" className="gap-1">
                      {pattern}
                      {pattern.includes('*') || pattern.includes('..') ? (
                        <span className="text-xs text-slate-500">({expandedCount}个科目)</span>
                      ) : null}
                      <button
                        onClick={() => removePattern(pattern)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })
              )}
            </div>
          </div>

          {/* 自定义模式输入 */}
          <div>
            <label className="text-sm font-medium mb-2 block">添加科目模式</label>
            <div className="flex gap-2">
              <Input
                placeholder="输入科目代码，如：1001、1002*、1001..1009"
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomPattern();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={addCustomPattern} type="button" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              <div>• 精确匹配：<code>1001</code></div>
              <div>• 通配符：<code>1002*</code> 匹配所有1002开头的科目</div>
              <div>• 区间：<code>1001..1009</code> 匹配1001到1009之间的科目</div>
            </div>
          </div>

          {/* 搜索和科目列表 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">选择科目</label>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAllFiltered}
                type="button"
              >
                {filteredSubjects.length > 0 && filteredSubjects.every(s => isSubjectSelected(s.code))
                  ? '取消全选'
                  : '全选当前'}
              </Button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索科目代码或名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="border rounded-lg max-h-64 overflow-auto">
              {filteredSubjects.length === 0 ? (
                <div className="p-4 text-center text-slate-500">未找到匹配的科目</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left w-10">
                        <Checkbox
                          checked={filteredSubjects.length > 0 && filteredSubjects.every(s => isSubjectSelected(s.code))}
                          onCheckedChange={toggleSelectAllFiltered}
                        />
                      </th>
                      <th className="p-2 text-left text-sm font-medium">科目代码</th>
                      <th className="p-2 text-left text-sm font-medium">科目名称</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubjects.map(subject => (
                      <tr
                        key={subject.code}
                        className={`border-t hover:bg-slate-50 cursor-pointer ${
                          isSubjectSelected(subject.code) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleSubject(subject.code)}
                      >
                        <td className="p-2">
                          <Checkbox
                            checked={isSubjectSelected(subject.code)}
                            onCheckedChange={() => toggleSubject(subject.code)}
                          />
                        </td>
                        <td className="p-2 text-sm">{subject.code}</td>
                        <td className="p-2 text-sm">{subject.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 统计信息 */}
          <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
            已选择 <strong>{expandedSelectedCodes.length}</strong> 个科目
            {selectedCodes.some(p => p.includes('*') || p.includes('..')) && '（包含通配符展开）'}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} type="button">取消</Button>
          <Button onClick={handleSave} type="button">保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
