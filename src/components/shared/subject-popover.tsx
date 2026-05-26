'use client';

import { useState, useMemo } from 'react';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useDepartmentStore } from '@/stores/useDepartmentStore';
import { Popover } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Check, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── 科目搜索下拉 ──

interface SubjectPopoverProps {
  value: string;
  onSelect: (code: string, name: string) => void;
  placeholder?: string;
}

export function SubjectPopover({ value, onSelect, placeholder = '选择科目' }: SubjectPopoverProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const subjects = useSubjectStore(s => s.subjects);
  const addSubject = useSubjectStore(s => s.addSubject);
  const { showToast } = useToast();

  const filteredSubjects = useMemo(() => {
    const q = search.toLowerCase();
    return subjects
      .filter(s => !s.disabled)
      .filter(s => !q || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [subjects, search]);

  const selected = subjects.find(s => s.code === value);

  const handleAddSubject = async () => {
    const code = newCode.trim();
    const name = newName.trim();
    if (!code || !name) return;
    if (subjects.some(s => s.code === code)) { showToast('warning', `科目代码 ${code} 已存在`); return; }
    const level = Math.floor((code.length - 2) / 2);
    const parentCode = code.length > 4 ? code.substring(0, code.length - 2) : null;
    const parentSubject = parentCode ? subjects.find(ps => ps.code === parentCode) : null;
    try {
      await addSubject({ code, name, level, direction: parentSubject?.direction || 'debit', parentId: parentSubject?.id || null, isCustomer: false, isSupplier: false, isEmployee: false, enableDept: false, enableProject: false, enableForeign: false, enableCashFlow: false, disabled: false, block: false });
      onSelect(code, name);
      setOpen(false); setSearch(''); setShowAdd(false); setNewCode(''); setNewName('');
      showToast('success', `科目 ${code} ${name} 创建成功`);
    } catch { showToast('error', '创建科目失败'); }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) { setShowAdd(false); setSearch(''); } }}
      content={
        <div className="w-64 bg-white border border-zinc-200/80 rounded-xl shadow-2xl">
          <div className="p-2.5 border-b border-zinc-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索科目代码或名称..." className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-zinc-50/50" autoFocus />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {filteredSubjects.length === 0 && !showAdd ? (
              <div className="px-3 py-6 text-sm text-zinc-400 text-center">无匹配科目</div>
            ) : filteredSubjects.map((s) => (
              <button key={s.id} className={`w-full px-3 py-2.5 text-sm text-left hover:bg-zinc-50 flex items-center gap-2.5 transition-colors ${s.code === value ? 'bg-zinc-50 text-zinc-900' : ''}`}
                onClick={() => { onSelect(s.code, s.name); setOpen(false); setSearch(''); }}>
                <span className="font-mono text-xs w-16 text-zinc-500">{s.code}</span>
                <span className="flex-1">{s.name}</span>
                {s.code === value && <Check className="h-3.5 w-3.5 text-zinc-600" />}
              </button>
            ))}
          </div>
          {showAdd ? (
            <div className="p-2.5 border-t border-zinc-100 space-y-2">
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="科目代码" className="h-8 text-xs bg-zinc-50/50 border-zinc-200" autoComplete="off" />
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="科目名称" className="h-8 text-xs bg-zinc-50/50 border-zinc-200" autoComplete="off" />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 text-xs flex-1 bg-zinc-900 hover:bg-zinc-800" onClick={handleAddSubject}>确认</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-200" onClick={() => setShowAdd(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <div className="p-2.5 border-t border-zinc-100">
              <button className="w-full px-2.5 py-2 text-xs text-zinc-500 hover:bg-zinc-50 rounded-lg flex items-center gap-1.5 transition-colors"
                onClick={() => { setShowAdd(true); setNewCode(search.trim()); setNewName(''); }}>
                <Plus className="h-3 w-3" /> 新增科目
              </button>
            </div>
          )}
        </div>
      }
    >
      <button
        className={`h-9 w-full text-sm rounded-lg px-3.5 text-left flex items-center gap-2.5 transition-all ${
          selected
            ? 'bg-zinc-50 text-zinc-800 border border-zinc-200'
            : 'bg-zinc-50/50 border border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:bg-zinc-50'
        }`}
        onClick={() => setOpen(!open)}
      >
        {selected ? (
          <>
            <span className="font-mono text-xs font-semibold text-zinc-600">{selected.code}</span>
            <span className="flex-1 truncate">{selected.name}</span>
            <X className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 shrink-0" onClick={(e) => { e.stopPropagation(); onSelect('', ''); setOpen(false); }} />
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <span>{placeholder}</span>
          </>
        )}
      </button>
    </Popover>
  );
}

// ── 供应商/客户下拉 ──

interface PartnerPopoverProps {
  value: string;
  onSelect: (name: string) => void;
  placeholder?: string;
  filterType?: 'supplier' | 'customer' | 'all';
}

export function PartnerPopover({ value, onSelect, placeholder = '选择供应商', filterType = 'supplier' }: PartnerPopoverProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const partners = usePartnerStore(s => s.partners);

  const filteredPartners = useMemo(() => {
    let list = partners;
    if (filterType === 'supplier') list = list.filter(p => p.isSupplier);
    if (filterType === 'customer') list = list.filter(p => p.isCustomer);
    const q = search.toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
    return list;
  }, [partners, search, filterType]);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}
      content={
        <div className="w-56 bg-white border border-zinc-200/80 rounded-xl shadow-2xl">
          <div className="p-2.5 border-b border-zinc-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索名称..." className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-zinc-50/50" autoFocus />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {filteredPartners.length === 0 ? (
              <div className="px-3 py-6 text-sm text-zinc-400 text-center">无匹配</div>
            ) : filteredPartners.map((p) => (
              <button key={p.id} className={`w-full px-3 py-2.5 text-sm text-left hover:bg-zinc-50 flex items-center gap-2.5 transition-colors ${p.name === value ? 'bg-zinc-50 text-zinc-900' : ''}`}
                onClick={() => { onSelect(p.name); setOpen(false); setSearch(''); }}>
                <span className="flex-1">{p.name}</span>
                {p.name === value && <Check className="h-3.5 w-3.5 text-zinc-600" />}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <button
        className={`h-9 w-full text-sm rounded-lg px-3.5 text-left flex items-center gap-2.5 transition-all ${
          value
            ? 'bg-zinc-50 text-zinc-800 border border-zinc-200'
            : 'bg-zinc-50/50 border border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:bg-zinc-50'
        }`}
        onClick={() => setOpen(!open)}
      >
        {value ? (
          <>
            <span className="flex-1 truncate">{value}</span>
            <X className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 shrink-0" onClick={(e) => { e.stopPropagation(); onSelect(''); setOpen(false); }} />
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <span>{placeholder}</span>
          </>
        )}
      </button>
    </Popover>
  );
}

// ── 部门下拉 ──

interface DepartmentPopoverProps {
  value: string;
  onSelect: (code: string, name: string) => void;
  placeholder?: string;
}

export function DepartmentPopover({ value, onSelect, placeholder = '选择部门' }: DepartmentPopoverProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const departments = useDepartmentStore(s => s.departments);

  const filteredDepartments = useMemo(() => {
    const q = search.toLowerCase();
    let list = departments;
    if (q) list = list.filter(d => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
    return list;
  }, [departments, search]);

  const selected = departments.find(d => d.code === value || d.name === value);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}
      content={
        <div className="w-56 bg-white border border-zinc-200/80 rounded-xl shadow-2xl">
          <div className="p-2.5 border-b border-zinc-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索部门..." className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-zinc-50/50" autoFocus />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {filteredDepartments.length === 0 ? (
              <div className="px-3 py-6 text-sm text-zinc-400 text-center">无匹配部门</div>
            ) : filteredDepartments.map((d) => (
              <button key={d.id} className={`w-full px-3 py-2.5 text-sm text-left hover:bg-zinc-50 flex items-center gap-2.5 transition-colors ${d.code === value ? 'bg-zinc-50 text-zinc-900' : ''}`}
                onClick={() => { onSelect(d.code, d.name); setOpen(false); setSearch(''); }}>
                <span className="font-mono text-xs w-12 text-zinc-500">{d.code}</span>
                <span className="flex-1">{d.name}</span>
                {d.code === value && <Check className="h-3.5 w-3.5 text-zinc-600" />}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <button
        className={`h-9 w-full text-sm rounded-lg px-3.5 text-left flex items-center gap-2.5 transition-all ${
          selected
            ? 'bg-zinc-50 text-zinc-800 border border-zinc-200'
            : 'bg-zinc-50/50 border border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:bg-zinc-50'
        }`}
        onClick={() => setOpen(!open)}
      >
        {selected ? (
          <>
            <span className="flex-1 truncate">{selected.name}</span>
            <X className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 shrink-0" onClick={(e) => { e.stopPropagation(); onSelect('', ''); setOpen(false); }} />
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <span>{placeholder}</span>
          </>
        )}
      </button>
    </Popover>
  );
}
