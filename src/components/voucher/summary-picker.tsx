'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverItem } from '@/components/ui/popover';
import { History, Type, ChevronRight } from 'lucide-react';
import { useSummaryStore } from '@/stores';

interface SummaryPickerProps {
  value: string;
  onSelect: (summary: string) => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function SummaryPicker({ value, onSelect, onOpenChange, children }: SummaryPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const { getSummaryList, addRecentSummary } = useSummaryStore();
  const { common, recent } = getSummaryList();

  // 合并摘要列表，最近使用在前
  const allSummaries = useCallback(() => {
    const result: Array<{ text: string; isRecent: boolean }> = [];
    const seen = new Set<string>();

    // 添加最近使用
    recent.forEach((s) => {
      if (!seen.has(s.text)) {
        seen.add(s.text);
        result.push({ text: s.text, isRecent: true });
      }
    });

    // 添加常用摘要
    common.forEach((s) => {
      if (!seen.has(s.text)) {
        seen.add(s.text);
        result.push({ text: s.text, isRecent: false });
      }
    });

    return result;
  }, [common, recent]);

  const summaries = allSummaries();

  // 处理选择
  const handleSelect = (text: string) => {
    onSelect(text);
    addRecentSummary(text);
    setOpen(false);
    setActiveIndex(-1);
  };

  // 键盘导航
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < summaries.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : summaries.length - 1
        );
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < summaries.length) {
          e.preventDefault();
          e.stopPropagation();
          handleSelect(summaries[activeIndex].text);
        }
        break;
      case 'Escape':
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  }, [open, activeIndex, summaries, handleSelect]);

  // 添加键盘事件监听
  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [open, handleKeyDown]);

  // 监听容器内的 focus 事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = () => {
      setOpen(true);
    };

    const handleFocusOut = (e: FocusEvent) => {
      setTimeout(() => {
        const relatedTarget = e.relatedTarget as Node;
        const popoverElement = document.querySelector('.summary-picker-popover');
        if (!popoverElement?.contains(relatedTarget) && !container.contains(relatedTarget)) {
          setOpen(false);
        }
      }, 150);
    };

    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);

    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // 渲染分组列表
  const renderList = () => {
    const recentList = summaries.filter(s => s.isRecent);
    const commonList = summaries.filter(s => !s.isRecent);

    return (
      <div className="max-h-[280px] overflow-y-auto summary-picker-popover">
        {summaries.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无常用摘要</p>
          </div>
        ) : (
          <div className="py-1">
            {recentList.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-slate-500 flex items-center gap-1">
                  <History className="w-3 h-3" />
                  最近使用
                </div>
                {recentList.map((summary, idx) => {
                  const overallIndex = summaries.findIndex(s => s.text === summary.text && s.isRecent);
                  return (
                    <PopoverItem
                      key={`recent-${idx}`}
                      onClick={() => handleSelect(summary.text)}
                      active={activeIndex === overallIndex}
                      onMouseEnter={() => setActiveIndex(overallIndex)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <span className="text-sm">{summary.text}</span>
                      </div>
                    </PopoverItem>
                  );
                })}
              </>
            )}

            {commonList.length > 0 && (
              <>
                {recentList.length > 0 && (
                  <div className="my-1 border-t border-slate-100" />
                )}
                <div className="px-2 py-1 text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Type className="w-3 h-3" />
                  常用摘要
                </div>
                {commonList.map((summary, idx) => {
                  const overallIndex = summaries.findIndex(s => s.text === summary.text && !s.isRecent);
                  return (
                    <PopoverItem
                      key={`common-${idx}`}
                      onClick={() => handleSelect(summary.text)}
                      active={activeIndex === overallIndex}
                      onMouseEnter={() => setActiveIndex(overallIndex)}
                    >
                      <div className="flex items-center gap-2">
                        <Type className="w-3 h-3 text-slate-400" />
                        <span className="text-sm">{summary.text}</span>
                      </div>
                    </PopoverItem>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {children}

      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          onOpenChange?.(isOpen);
          if (!isOpen) {
            setActiveIndex(-1);
          }
        }}
        content={
          <PopoverContent className="w-64 p-0">
            {renderList()}
          </PopoverContent>
        }
        side="bottom"
        align="start"
      >
        <div className="absolute inset-0 pointer-events-none" />
      </Popover>
    </div>
  );
}
