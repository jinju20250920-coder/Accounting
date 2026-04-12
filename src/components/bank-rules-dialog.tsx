'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useBankRuleStore } from '@/stores/useBankRuleStore';
import { useSubjectStore } from '@/stores';
import {
  Settings, Plus, Trash2, ToggleLeft, ToggleRight, Pencil,
  Search, GripVertical, Info, X,
} from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import type { BankTransactionRule } from '@/types';

interface BankRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 紧凑科目选择器：Popover + 模糊搜索 + Badge 已选状态 */
function RuleSubjectPicker({
  value,
  valueName,
  onSelect,
  onClear,
}: {
  value: string;
  valueName: string;
  onSelect: (code: string, name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { subjects } = useSubjectStore();

  const filtered = useMemo(() => {
    const active = subjects.filter(s => !s.disabled);
    if (!search.trim()) return active.slice(0, 40);
    const q = search.toLowerCase();
    return active.filter(
      s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [search, subjects]);

  return (
    <Popover
      open={open}
      onOpenChange={v => { setOpen(v); if (!v) setSearch(''); }}
      content={
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 w-64 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索科目..."
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">无匹配科目</div>
            ) : (
              filtered.map(s => (
                <div
                  key={s.id}
                  className="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 flex items-center gap-2"
                  onClick={() => { onSelect(s.code, s.name); setOpen(false); setSearch(''); }}
                >
                  <span className="font-mono text-slate-600">{s.code}</span>
                  <span className="text-slate-800">{s.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      }
    >
      <div className="cursor-pointer" onClick={() => setOpen(true)}>
        {value ? (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-md border border-blue-200">
            {value} {valueName}
            <X className="h-3 w-3 hover:text-red-500" onClick={e => { e.stopPropagation(); onClear(); }} />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400 text-xs border border-dashed border-slate-300 rounded-md px-2 py-1 hover:border-blue-400 hover:text-blue-500">
            <Search className="h-3 w-3" />
            选择科目
          </span>
        )}
      </div>
    </Popover>
  );
}

/** 抽屉式编辑面板 */
function RuleEditDrawer({
  title,
  form,
  setForm,
  onSave,
  onCancel,
}: {
  title: string;
  form: { name: string; keyword: string; subjectCode: string; subjectName: string; direction: 'in' | 'out' | 'both'; priority: number };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
      <h4 className="font-medium text-sm text-slate-700">{title}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label required className="text-xs">规则名称</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：银行结息" className="h-8 text-sm" />
        </div>
        <div>
          <Label required className="text-xs">匹配关键词</Label>
          <Input value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value })} placeholder="如：结息" className="h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <Label required className="text-xs">对方科目</Label>
          <RuleSubjectPicker
            value={form.subjectCode}
            valueName={form.subjectName}
            onSelect={(code, name) => setForm({ ...form, subjectCode: code, subjectName: name })}
            onClear={() => setForm({ ...form, subjectCode: '', subjectName: '' })}
          />
        </div>
        <div>
          <Label className="text-xs">适用方向</Label>
          <select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value as any })} className="w-full px-2 py-1.5 border rounded-md text-xs h-8">
            <option value="both">双向</option>
            <option value="in">仅流入</option>
            <option value="out">仅流出</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">优先级</Label>
          <select value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded-md text-xs h-8">
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={onSave}>{title.includes('编辑') ? '保存' : '添加'}</Button>
      </div>
    </div>
  );
}

export function BankRulesDialog({ open, onOpenChange }: BankRulesDialogProps) {
  const { showToast } = useToast();
  const { rules, initialize, addRule, deleteRule, toggleRule, updateRule } = useBankRuleStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', keyword: '', subjectCode: '', subjectName: '', direction: 'both' as 'in' | 'out' | 'both', priority: 5 });
  const [newRule, setNewRule] = useState({ name: '', keyword: '', subjectCode: '', subjectName: '', direction: 'both' as 'in' | 'out' | 'both', priority: 5 });
  const [searchFilter, setSearchFilter] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (open) initialize();
  }, [open, initialize]);

  // 关闭时重置状态
  const handleClose = () => {
    setShowAddForm(false);
    setEditingId(null);
    setSearchFilter('');
    onOpenChange(false);
  };

  const handleAdd = async () => {
    if (!newRule.name || !newRule.keyword || !newRule.subjectCode) {
      showToast('error', '请填写规则名称、关键词和科目');
      return;
    }
    await addRule({ ...newRule, enabled: true });
    showToast('success', `规则 "${newRule.name}" 添加成功`);
    setNewRule({ name: '', keyword: '', subjectCode: '', subjectName: '', direction: 'both', priority: 5 });
    setShowAddForm(false);
  };

  const handleStartEdit = (rule: BankTransactionRule) => {
    setEditingId(rule.id);
    setShowAddForm(false);
    setEditForm({ name: rule.name, keyword: rule.keyword, subjectCode: rule.subjectCode, subjectName: rule.subjectName, direction: rule.direction, priority: rule.priority });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name || !editForm.keyword || !editForm.subjectCode) {
      showToast('error', '请填写规则名称、关键词和科目');
      return;
    }
    await updateRule(editingId, editForm);
    showToast('success', '规则已更新');
    setEditingId(null);
  };

  const handleDelete = async (rule: BankTransactionRule) => {
    if (rule.isSystem) { showToast('warning', '系统规则不能删除，只能禁用'); return; }
    await deleteRule(rule.id);
    showToast('success', `规则 "${rule.name}" 已删除`);
  };

  const directionLabel = (d: string) => d === 'in' ? '流入' : d === 'out' ? '流出' : '双向';
  const directionColor = (d: string) => d === 'in' ? 'bg-green-50 text-green-700' : d === 'out' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600';

  const sortedRules = useMemo(() =>
    rules
      .filter(r => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.keyword.toLowerCase().includes(q) || r.subjectName?.toLowerCase().includes(q) || r.subjectCode.includes(q);
      })
      .sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
        return b.priority - a.priority;
      }),
    [rules, searchFilter]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="h-5 w-5 text-blue-600" />
            流水匹配规则
            <span className="text-xs text-slate-400 font-normal ml-2">{rules.length} 条规则</span>
          </DialogTitle>
        </DialogHeader>

        {/* 帮助提示（可折叠） */}
        <div>
          <button
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            onClick={() => setShowHelp(!showHelp)}
          >
            <Info className="h-3.5 w-3.5" />
            {showHelp ? '隐藏匹配说明' : '查看匹配优先级说明'}
          </button>
          {showHelp && (
            <div className="mt-1.5 text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-100">
              匹配优先级：往来单位默认科目 &gt; 用户自定义规则 &gt; 系统默认规则 &gt; 用户偏好学习
            </div>
          )}
        </div>

        {/* 搜索 + 新增按钮 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="搜索规则名称、关键词或科目..."
              className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          {!showAddForm && (
            <Button size="sm" onClick={() => { setShowAddForm(true); setEditingId(null); }}>
              <Plus className="h-4 w-4 mr-1" />
              新增规则
            </Button>
          )}
        </div>

        {/* 规则列表 */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {sortedRules.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {searchFilter ? '没有匹配的规则' : '暂无规则，点击上方按钮添加'}
            </div>
          ) : (
            sortedRules.map(rule => (
              <div
                key={rule.id}
                className={`rounded-lg border transition-colors ${rule.enabled ? 'bg-white hover:border-slate-300' : 'bg-slate-50 border-dashed border-slate-200'}`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  {/* 拖拽图标（视觉） */}
                  <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0" />

                  {/* 主内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-medium text-sm ${!rule.enabled ? 'text-slate-400 line-through' : ''}`}>{rule.name}</span>
                      {rule.isSystem && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">系统</span>
                      )}
                      {!rule.isSystem && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">自定义</span>
                      )}
                      {!rule.enabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium">已禁用</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${directionColor(rule.direction)}`}>
                        {directionLabel(rule.direction)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        P{rule.priority}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      &quot;<span className="text-blue-600 font-medium">{rule.keyword}</span>&quot;
                      {' → '}
                      <span className="font-mono">{rule.subjectCode}</span> {rule.subjectName}
                    </div>
                  </div>

                  {/* 操作区 */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleRule(rule.id)} title={rule.enabled ? '点击禁用' : '点击启用'} className="h-7 w-7 p-0">
                      {rule.enabled
                        ? <ToggleRight className="h-4 w-4 text-green-600" />
                        : <ToggleLeft className="h-4 w-4 text-slate-400" />
                      }
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleStartEdit(rule)} title="编辑" className="h-7 w-7 p-0">
                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(rule)} title={rule.isSystem ? '系统规则不可删除' : '删除'} className="h-7 w-7 p-0">
                      <Trash2 className={`h-3.5 w-3.5 ${rule.isSystem ? 'text-slate-300' : 'text-red-400 hover:text-red-600'}`} />
                    </Button>
                  </div>
                </div>

                {/* 行内编辑抽屉 */}
                {editingId === rule.id && (
                  <RuleEditDrawer
                    title="编辑规则"
                    form={editForm}
                    setForm={setEditForm}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* 新增规则抽屉（底部） */}
        {showAddForm && (
          <RuleEditDrawer
            title="新增自定义规则"
            form={newRule}
            setForm={setNewRule}
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
