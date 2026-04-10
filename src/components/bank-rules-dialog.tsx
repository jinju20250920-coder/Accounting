'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useBankRuleStore } from '@/stores/useBankRuleStore';
import { SubjectSearch } from '@/components/voucher/subject-search';
import { Settings, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { BankTransactionRule } from '@/types';

interface BankRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BankRulesDialog({ open, onOpenChange }: BankRulesDialogProps) {
  const { showToast } = useToast();
  const { rules, initialize, addRule, deleteRule, toggleRule, updateRule } = useBankRuleStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    keyword: '',
    subjectCode: '',
    subjectName: '',
    direction: 'both' as 'in' | 'out' | 'both',
    priority: 5,
  });

  useEffect(() => {
    if (open) {
      initialize();
    }
  }, [open, initialize]);

  const handleAdd = async () => {
    if (!newRule.name || !newRule.keyword || !newRule.subjectCode) {
      showToast('error', '请填写规则名称、关键词和科目');
      return;
    }

    await addRule({
      name: newRule.name,
      keyword: newRule.keyword,
      subjectCode: newRule.subjectCode,
      subjectName: newRule.subjectName,
      direction: newRule.direction,
      priority: newRule.priority,
      enabled: true,
    });

    showToast('success', `规则 "${newRule.name}" 添加成功`);
    setNewRule({ name: '', keyword: '', subjectCode: '', subjectName: '', direction: 'both', priority: 5 });
    setShowAddForm(false);
  };

  const directionLabel = (d: string) => {
    if (d === 'in') return '流入';
    if (d === 'out') return '流出';
    return '双向';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            流水匹配规则
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-slate-500 mb-4">
          匹配优先级：往来单位默认科目 &gt; 用户自定义规则 &gt; 系统默认规则 &gt; 用户偏好学习
        </div>

        {/* 规则列表 */}
        <div className="space-y-2">
          {rules
            .sort((a, b) => {
              // 系统规则排后面
              if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
              return b.priority - a.priority;
            })
            .map(rule => (
            <div
              key={rule.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                rule.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{rule.name}</span>
                  {rule.isSystem && <Badge variant="outline" className="text-xs">系统</Badge>}
                  <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">
                    {directionLabel(rule.direction)}
                  </Badge>
                  <span className="text-xs text-slate-400">优先级 {rule.priority}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  关键词 "<span className="text-blue-600 font-medium">{rule.keyword}</span>"
                  {" → "}
                  <span className="font-medium">{rule.subjectCode} {rule.subjectName}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleRule(rule.id)}
                  title={rule.enabled ? '禁用' : '启用'}
                >
                  {rule.enabled
                    ? <ToggleRight className="h-4 w-4 text-green-600" />
                    : <ToggleLeft className="h-4 w-4 text-gray-400" />
                  }
                </Button>
                {!rule.isSystem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(rule.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {rules.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              暂无规则，点击下方按钮添加
            </div>
          )}
        </div>

        {/* 添加规则表单 */}
        {showAddForm ? (
          <div className="border rounded-lg p-4 mt-4 bg-blue-50 space-y-3">
            <h4 className="font-medium text-sm">添加自定义规则</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>规则名称</Label>
                <Input
                  value={newRule.name}
                  onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="如：银行结息"
                />
              </div>
              <div>
                <Label required>匹配关键词</Label>
                <Input
                  value={newRule.keyword}
                  onChange={e => setNewRule({ ...newRule, keyword: e.target.value })}
                  placeholder="如：结息"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>对方科目</Label>
                <div className="border rounded-md">
                  <SubjectSearch
                    value={newRule.subjectCode ? `${newRule.subjectCode} ${newRule.subjectName}` : ''}
                    onSelect={(code, name) => setNewRule({ ...newRule, subjectCode: code, subjectName: name })}
                    placeholder="搜索科目..."
                  />
                </div>
              </div>
              <div>
                <Label>适用方向</Label>
                <select
                  value={newRule.direction}
                  onChange={e => setNewRule({ ...newRule, direction: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="both">双向（流入+流出）</option>
                  <option value="in">仅流入（收到的钱）</option>
                  <option value="out">仅流出（付出的钱）</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>取消</Button>
              <Button size="sm" onClick={handleAdd}>添加规则</Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            添加自定义规则
          </Button>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
