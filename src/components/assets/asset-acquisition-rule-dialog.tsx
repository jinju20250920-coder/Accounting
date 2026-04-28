'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  Settings,
  Search,
  X,
  Plus,
  Trash2,
  Edit,
} from 'lucide-react';
import {
  DEFAULT_ACQUISITION_RULES,
  ACQUISITION_TYPE_NAMES,
  type AssetAcquisitionRule,
} from '@/lib/asset-acquisition-rule';

// 科目选择器组件
function SubjectSelector({
  value,
  onChange,
  placeholder,
  subjects,
}: {
  value: string;
  onChange: (code: string, name: string) => void;
  placeholder: string;
  subjects: { code: string; name: string }[];
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const filtered = subjects.filter(
    s => s.code.includes(search) || s.name.includes(search)
  );

  const selected = subjects.find(s => s.code === value);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
    setOpen(!open);
  };

  const handleSelect = (code: string, name: string) => {
    onChange(code, name);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
  };

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={e => e.key === 'Enter' && handleToggle(e as any)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs border rounded hover:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer"
      >
        {selected ? (
          <span className="font-mono text-blue-600 truncate">{selected.code} {selected.name}</span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <button type="button" onClick={handleClear} className="p-0.5 hover:bg-slate-100 rounded">
              <X className="h-3 w-3 text-slate-400" />
            </button>
          )}
          <Search className="h-3 w-3 text-slate-400" />
        </div>
      </div>

      {open && createPortal(
        <div
          className="fixed z-[9999] bg-white border rounded-lg shadow-xl max-h-48 overflow-auto"
          style={{ top: position.top, left: position.left, width: Math.max(position.width, 250) }}
        >
          <div className="p-2 border-b sticky top-0 bg-white">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索科目..."
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">无匹配</div>
          ) : (
            filtered.slice(0, 20).map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => handleSelect(s.code, s.name)}
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-blue-50 flex items-center gap-2"
              >
                <span className="font-mono text-blue-600 w-14">{s.code}</span>
                <span className="text-slate-700 truncate">{s.name}</span>
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export function AssetAcquisitionRuleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { subjects, initializeSubjects } = useSubjectStore();
  const { showToast } = useToast();
  const [rules, setRules] = useState<AssetAcquisitionRule[]>(DEFAULT_ACQUISITION_RULES);

  useEffect(() => {
    if (open) {
      initializeSubjects();
    }
  }, [open, initializeSubjects]);

  const availableSubjects = subjects
    .filter(s => !s.disabled && !s.block)
    .map(s => ({ code: s.code, name: s.name }));

  const handleUpdateRule = (id: string, updates: Partial<AssetAcquisitionRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleSave = () => {
    // TODO: 保存到数据库
    showToast('success', '规则保存成功');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            取得规则配置
          </DialogTitle>
          <DialogDescription>
            配置各来源类型的借贷科目映射规则
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left p-2 font-medium">来源类型</th>
                  <th className="text-left p-2 font-medium">借方科目</th>
                  <th className="text-left p-2 font-medium">贷方科目</th>
                  <th className="text-center p-2 font-medium">启用</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium">
                      {ACQUISITION_TYPE_NAMES[rule.acquisitionType] || rule.acquisitionType}
                    </td>
                    <td className="p-2">
                      <SubjectSelector
                        value={rule.debitSubjectCode}
                        onChange={(code, name) => handleUpdateRule(rule.id, {
                          debitSubjectCode: code,
                          debitSubjectName: name,
                        })}
                        placeholder="借方科目"
                        subjects={availableSubjects}
                      />
                    </td>
                    <td className="p-2">
                      {rule.acquisitionType === 'opening_balance' ? (
                        <span className="text-xs text-slate-500">不生成凭证</span>
                      ) : (
                        <SubjectSelector
                          value={rule.creditSubjectCode}
                          onChange={(code, name) => handleUpdateRule(rule.id, {
                            creditSubjectCode: code,
                            creditSubjectName: name,
                          })}
                          placeholder="贷方科目"
                          subjects={availableSubjects}
                        />
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={checked => handleUpdateRule(rule.id, { enabled: checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 说明 */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
            <p className="font-medium mb-1">规则说明</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600">
              <li>借方科目：默认为固定资产科目</li>
              <li>贷方科目：根据来源类型自动选择对应科目</li>
              <li>期初导入：不生成取得凭证，直接入账</li>
              <li>发票取得：在进项税发票管理中处理</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
