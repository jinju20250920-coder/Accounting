'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverItem } from '@/components/ui/popover';
import { Search, Sparkles, Wallet, Landmark, TrendingUp, Hash, ChevronRight } from 'lucide-react';
import { toChineseAmount } from '@/lib/chinese-number';
import { useSubjectStore } from '@/stores';
import { useAccountStore } from '@/stores/useAccountStore';

// 科目类型（使用与 store 相同的类型）
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

interface SmartSubjectSelectorProps {
  value: string;
  subjectName?: string;
  onSelect: (code: string, name: string, subject?: any) => void;
  placeholder?: string;
  balance?: number;
  aiRecommendations?: string[];
  variant?: 'default' | 'excel';
  'data-field'?: string;
  'data-entry-id'?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

// 拼音首字母映射（简化版）
const PINYIN_MAP: Record<string, string> = {
  '库存现金': 'kcxj',
  '银行存款': 'yhck',
  '应收账款': 'yszk',
  '原材料': 'ycl',
  '库存商品': 'kcsp',
  '固定资产': 'gdzc',
  '累计折旧': 'ljzj',
  '短期借款': 'dqjk',
  '应付账款': 'yfzk',
  '应付职工薪酬': 'yfzgyc',
  '应交税费': 'yjsf',
  '实收资本': 'sszb',
  '资本公积': 'zbgj',
  '本年利润': 'bnlr',
  '利润分配': 'lrfp',
  '生产成本': 'sccb',
  '制造费用': 'zzfy',
  '主营业务收入': 'zyywysr',
  '其他业务收入': 'qtywsr',
  '主营业务成本': 'zyywcb',
  '其他业务成本': 'qtywcb',
  '销售费用': 'xsfy',
  '管理费用': 'glfy',
  '财务费用': 'cwfy',
  '营业外收入': 'yywsr',
  '营业外支出': 'yywzc',
  '所得税费用': 'sdsfy',
  '以前年度损益调整': 'yqndsy',
  '农业银行': 'nyyh',
  '中国银行': 'zgyh',
  '招商银行': 'zsyy',
  '运输费': 'ysf',
  '广告费': 'ggf',
  '办公费': 'bgf',
  '差旅费': 'clf',
  '工资': 'gz',
  '福利费': 'flf',
  '折旧费': 'zjf',
  '招待费': 'zdf'
};

export function SmartSubjectSelector({
  value,
  subjectName = '',
  onSelect,
  placeholder = '',
  balance,
  aiRecommendations = [],
  variant = 'excel',
  'data-field': dataField,
  'data-entry-id': dataEntryId,
  onKeyDown
}: SmartSubjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<'ai' | '资产' | '负债' | '权益' | '成本' | '损益' | 'all'>('ai');
  const [showTooltip, setShowTooltip] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 使用 store 中的科目数据
  const { subjects, searchSubjects, getSubjectsWithChildren, initializeSubjects } = useSubjectStore();
  const { getBalance } = useAccountStore();

  // 初始化科目数据
  useEffect(() => {
    if (subjects.length === 0) {
      initializeSubjects();
    }
  }, [subjects.length, initializeSubjects]);

  // 当 value 变化时，退出编辑模式
  useEffect(() => {
    if (value) {
      setIsEditing(false);
      setSearchText('');
    }
  }, [value]);

  // 显示文本
  const displayText = useMemo(() => {
    if (value && !isEditing) {
      return `${value} ${subjectName}`;
    }
    return searchText;
  }, [value, subjectName, isEditing, searchText]);

  // 获取科目的拼音首字母
  const getPinyin = (name: string): string => {
    return PINYIN_MAP[name] || '';
  };

  // 过滤科目
  const filteredSubjects = useMemo(() => {
    const allSubjectsWithChildren = getSubjectsWithChildren();

    if (!searchText.trim()) {
      if (activeTab === 'ai') {
        // AI 推荐：常用科目（仅末级）
        const aiSubjects = subjects.filter(s =>
          (aiRecommendations?.includes(s.code) || ['1001', '1002', '1122', '2202', '6602', '6601'].includes(s.code)) &&
          !subjects.some(child => child.parentId === s.id)
        );
        return aiSubjects;
      } else if (activeTab === 'all') {
        // 仅显示末级科目
        return subjects.filter(s => !subjects.some(child => child.parentId === s.id));
      } else {
        // 按科目类型筛选（仅末级）
        const filtered = subjects.filter(subject => {
          const typeMatch = (
            (activeTab === '资产' && subject.code.startsWith('1')) ||
            (activeTab === '负债' && subject.code.startsWith('2')) ||
            (activeTab === '权益' && subject.code.startsWith('4')) ||
            (activeTab === '成本' && subject.code.startsWith('5')) ||
            (activeTab === '损益' && subject.code.startsWith('6'))
          );
          return typeMatch && !subjects.some(child => child.parentId === subject.id);
        });
        return filtered;
      }
    }

    // 实时搜索（仅末级）
    return subjects.filter(subject => {
      const lowerQuery = searchText.toLowerCase();
      const match = (
        subject.code.toLowerCase().includes(lowerQuery) ||
        subject.name.toLowerCase().includes(lowerQuery) ||
        getPinyin(subject.name).toLowerCase().includes(lowerQuery)
      );
      return match && !subjects.some(child => child.parentId === subject.id);
    });
  }, [searchText, activeTab, subjects, aiRecommendations, getSubjectsWithChildren]);

  // 处理输入框聚焦
  const handleFocus = () => {
    setOpen(true);
    inputRef.current?.focus();
  };

  // 处理选中科目
  const handleSelect = useCallback((subject: Subject) => {
    onSelect(subject.code, subject.name, subject);
    setOpen(false);
    setActiveIndex(-1);
    setSearchText('');
    setIsEditing(false);
  }, [onSelect]);

  // 渲染科目列表（末级科目，扁平显示）
  const renderSubjectList = (subjects: Subject[]): React.JSX.Element[] => {
    return subjects.map((subject, index) => {
      return (
        <PopoverItem
          key={subject.code}
          onClick={() => handleSelect(subject)}
          active={activeIndex === index}
          onMouseEnter={() => setActiveIndex(index)}
        >
          <div className="flex items-center gap-2">
            <Hash className="w-3 h-3 text-slate-300 flex-shrink-0" />
            <span className="font-mono text-xs text-slate-500 w-16 flex-shrink-0">{subject.code}</span>
            <span className="flex-1 text-sm">{subject.name}</span>
          </div>
        </PopoverItem>
      );
    });
  };

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 允许复制、粘贴、全选等快捷键
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'a', 'x', 'z', 'y'].includes(e.key.toLowerCase())) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => {
          const nextIndex = prev < filteredSubjects.length - 1 ? prev + 1 : 0;
          return nextIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => {
          const prevIndex = prev > 0 ? prev - 1 : filteredSubjects.length - 1;
          return prevIndex;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredSubjects.length) {
          handleSelect(filteredSubjects[activeIndex]);
        } else if (filteredSubjects.length === 1) {
          // 如果只有一个匹配结果，直接选中
          handleSelect(filteredSubjects[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  }, [filteredSubjects, activeIndex, handleSelect]);

  // 科目列表内容
  const subjectList = (
    <PopoverContent className="w-full max-h-[280px] overflow-y-auto">
      {/* Tab 切换 */}
      <div className="flex border-b border-slate-200">
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'ai'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          onClick={() => {
            setActiveTab('ai');
            setActiveIndex(-1);
          }}
        >
          <div className="flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI推荐
          </div>
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === '资产'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          onClick={() => {
            setActiveTab('资产');
            setActiveIndex(-1);
          }}
        >
          <div className="flex items-center justify-center gap-1">
            <Wallet className="w-3 h-3" />
            资产
          </div>
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === '负债'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          onClick={() => {
            setActiveTab('负债');
            setActiveIndex(-1);
          }}
        >
          <div className="flex items-center justify-center gap-1">
            <Landmark className="w-3 h-3" />
            负债
          </div>
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === '损益'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          onClick={() => {
            setActiveTab('损益');
            setActiveIndex(-1);
          }}
        >
          <div className="flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" />
            损益
          </div>
        </button>
      </div>

      {/* 科目列表 */}
      <div className="max-h-[230px] overflow-y-auto">
        {filteredSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-slate-500 py-4">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">没有找到匹配的科目</p>
          </div>
        ) : (
          // 扁平显示（仅末级科目）
          <div className="py-1">{renderSubjectList(filteredSubjects)}</div>
        )}
      </div>
    </PopoverContent>
  );

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Input
        ref={inputRef}
        variant={variant}
        placeholder={placeholder}
        value={displayText}
        data-field={dataField}
        data-entry-id={dataEntryId}
        onChange={(e) => {
          const text = e.target.value;
          // 只要用户开始输入，就进入编辑模式
          setIsEditing(true);
          setSearchText(text);
          setOpen(true);
        }}
        onFocus={handleFocus}
        onKeyDown={(e) => {
          // 如果是 Tab 键，直接调用外部的 onKeyDown 进行导航
          if (e.key === 'Tab') {
            onKeyDown?.(e);
            return;
          }
          // 处理特殊情况：当有值且不在编辑模式时，按退格键进入编辑模式
          if ((e.key === 'Backspace' || e.key === 'Delete') && value && !isEditing) {
            e.preventDefault();
            setIsEditing(true);
            // 设置搜索文本为当前显示值，让用户可以编辑
            setSearchText(displayText);
            setOpen(true);
            return;
          }
          handleKeyDown(e);
        }}
        onBlur={() => {
          // 失去焦点时，如果没有选中值，退出编辑模式
          // 不立即清除，让用户有时间点击下拉项
        }}
        className="w-full pr-16 pt-3"
        style={{ height: '56px', borderRadius: 0 }}
      />

      {/* 科目选择 Popover */}
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setActiveIndex(-1);
            // 如果没有选中值，保持编辑状态以便用户继续输入
          }
        }}
        content={subjectList}
        side="bottom"
        align="start"
      >
        {/* 占位元素，确保 Popover 正确定位 */}
        <div className="absolute inset-0" />
      </Popover>

      {/* 鼠标悬停提示 - 显示在输入框内部上方 */}
      {showTooltip && !value && (
        <div className="absolute left-1 top-1 text-[9px] text-slate-400 whitespace-nowrap z-10 pointer-events-none">
          请输入科目编码/科目描述/科目首字母
        </div>
      )}
      {/* 余额标签 - 使用真正的余额数据 */}
      {value && !showTooltip && (
        <div className="absolute right-2 bottom-0 text-[10px] text-slate-500 whitespace-nowrap z-10 pointer-events-none">
          余额：¥{getBalance(value).toFixed(2)}
        </div>
      )}
    </div>
  );
}

// 金额输入框带大写预览
export function AmountInputWithPreview({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  variant = 'excel',
  placeholder = '',
  className = '',
  'data-field': dataField,
  'data-entry-id': dataEntryId
}: {
  value: number | '';
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  variant?: 'default' | 'excel';
  placeholder?: string;
  className?: string;
  'data-field'?: string;
  'data-entry-id'?: string;
}) {
  const numericValue = typeof value === 'number' ? value : 0;
  const chineseAmount = useMemo(() => {
    if (numericValue > 0) {
      return toChineseAmount(numericValue);
    }
    return '';
  }, [numericValue]);

  return (
    <div className="relative w-full h-full">
      <Input
        type="number"
        variant={variant}
        value={value}
        data-field={dataField}
        data-entry-id={dataEntryId}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`text-right font-mono ${className}`}
        style={{ height: '56px', borderRadius: 0 }}
      />
      {/* 大写金额预览 - 右对齐 */}
      {chineseAmount && (
        <div className="absolute right-2 bottom-0 text-[10px] text-slate-400 whitespace-nowrap z-10 pointer-events-none">
          {chineseAmount}
        </div>
      )}
    </div>
  );
}
