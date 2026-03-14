'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FileText,
  Calculator,
  FileSpreadsheet,
  TrendingUp,
  Users,
  Building2,
  RefreshCw,
  Upload,
  Settings,
  ChevronDown,
  ChevronRight,
  FolderKanban,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const menuItems = [
  { icon: FileText, label: '记账凭证', path: '/voucher-entry-page' },
  { icon: Calculator, label: '科目余额', path: '/balance' },
  { icon: FileSpreadsheet, label: '报表查询', path: '/reports', children: [
    { label: '资产负债表', path: '/reports/assets' },
    { label: '损益表', path: '/reports/profit' },
    { label: '现金流量表', path: '/reports/cashflow' },
  ]},
  { icon: Users, label: '往来管理', path: '/aging', children: [
    { label: '应收明细', path: '/aging/ar' },
    { label: '应付明细', path: '/aging/ap' },
  ]},
  { icon: Building2, label: '账套管理', path: '/sets' },
  { icon: RefreshCw, label: '汇兑损益', path: '/exchange' },
  { icon: Upload, label: '流水导入', path: '/import' },
  { icon: Settings, label: '基础档案', path: '/settings', children: [
    { label: '科目管理', path: '/settings/subjects' },
    { label: '部门管理', path: '/settings/departments' },
    { label: '项目管理', path: '/settings/projects' },
    { label: '辅助核算基础数据', path: '/settings/auxiliary' },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (label: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col text-white">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-blue-400" />
          AI 财务 Assistant
        </h1>
      </div>

      {/* 账套选择 */}
      <div className="p-4 border-b border-slate-700">
        <Button variant="ghost" className="w-full justify-between text-slate-300 hover:text-white hover:bg-slate-800">
          <span>上海乐茜信息技术有限公司</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* 菜单 */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.label}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-2.5 text-sm',
                      'text-slate-300 hover:text-white hover:bg-slate-800 transition-colors'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {expandedItems.has(item.label) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedItems.has(item.label) && (
                    <ul className="mt-1 space-y-1 bg-slate-800/50">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <Link
                            href={child.path}
                            className={cn(
                              'flex items-center px-4 py-2 text-sm pl-12',
                              isActive(child.path)
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm',
                    isActive(item.path)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 底部信息 */}
      <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
        <div className="flex items-center justify-between mb-2">
          <span>期间: 2026-03</span>
          <span>记-001</span>
        </div>
        <div>操作员: 管理员</div>
      </div>
    </div>
  );
}
