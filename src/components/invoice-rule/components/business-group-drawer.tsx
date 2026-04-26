// src/components/invoice-rule/components/business-group-drawer.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Check, X, FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover } from '@/components/ui/popover';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useToast } from '@/components/ui/toast';

interface BusinessGroupEditorProps {
  onSave: (group: any) => void;
  onCancel: () => void;
  defaultValues?: any;
}

const PRESET_PARTNER_TYPES = ['供应商', '客户', '员工', '其他'];

const COMMON_VARIABLES = [
  { name: '税率', value: '{{税率}}' },
  { name: '供应商', value: '{{供应商}}' },
  { name: '商品类型', value: '{{商品类型}}' },
];

// ── 科目下拉选择器 ──
function SubjectPopover({ value, name, onChange, placeholder }: {
  value: string; name: string; onChange: (code: string, name: string) => void; placeholder: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const subjects = useSubjectStore((s) => s.subjects);
  const addSubject = useSubjectStore((s) => s.addSubject);
  const { showToast } = useToast();

  const filteredSubjects = useMemo(() => {
    const q = search.toLowerCase();
    return subjects
      .filter((s) => !s.disabled)
      .filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [subjects, search]);

  const selected = subjects.find((s) => s.code === value);

  const handleAddSubject = async () => {
    const code = newCode.trim();
    const subjectName = newName.trim();
    if (!code || !subjectName) return;
    if (subjects.some(s => s.code === code)) { showToast('warning', `科目代码 ${code} 已存在`); return; }
    const level = Math.floor((code.length - 2) / 2);
    const parentCode = code.length > 4 ? code.substring(0, code.length - 2) : null;
    const parentSubject = parentCode ? subjects.find(ps => ps.code === parentCode) : null;
    try {
      await addSubject({ code, name: subjectName, level, direction: parentSubject?.direction || 'debit', parentId: parentSubject?.id || null, isCustomer: false, isSupplier: false, isEmployee: false, enableDept: false, enableProject: false, enableForeign: false, enableCashFlow: false, disabled: false, block: false });
      onChange(code, subjectName);
      setOpen(false); setSearch(''); setShowAdd(false); setNewCode(''); setNewName('');
      showToast('success', `科目 ${code} ${subjectName} 创建成功`);
    } catch (e) { showToast('error', '创建科目失败'); }
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
            ) : (
              filteredSubjects.map((s) => (
                <button key={s.id} className={`w-full px-3 py-2.5 text-sm text-left hover:bg-zinc-50 flex items-center gap-2.5 transition-colors ${s.code === value ? 'bg-zinc-50 text-zinc-900' : ''}`}
                  onClick={() => { onChange(s.code, s.name); setOpen(false); setSearch(''); }}>
                  <span className="font-mono text-xs w-16 text-zinc-500">{s.code}</span>
                  <span className="flex-1">{s.name}</span>
                  {s.code === value && <Check className="h-3.5 w-3.5 text-zinc-600" />}
                </button>
              ))
            )}
          </div>
          {showAdd ? (
            <div className="p-2.5 border-t border-zinc-100 space-y-2">
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="科目代码" className="h-8 text-xs bg-zinc-50/50 border-zinc-200" autoComplete="off" />
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="科目名称" className="h-8 text-xs bg-zinc-50/50 border-zinc-200" autoComplete="off" />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 text-xs flex-1 bg-zinc-900 hover:bg-zinc-800">确认</Button>
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
            <X className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 shrink-0" onClick={(e) => { e.stopPropagation(); onChange('', ''); setOpen(false); }} />
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

// ── 凭证预览条目动画 ──
const entryVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function BusinessGroupEditor({ onSave, onCancel, defaultValues }: BusinessGroupEditorProps) {
  const [formData, setFormData] = useState({
    name: '', debitSubject: '', debitSubjectName: '',
    taxSubject: '2221.01.{{税率}}', taxSubjectName: '',
    creditSubject: '', creditSubjectName: '',
    partnerType: '供应商', customPartnerType: '',
    assetThreshold: 5000, description: '',
    isPreset: false, autoTax: true,
    keywords: [] as string[], keywordInput: '',
  });
  const [showCustomPartnerType, setShowCustomPartnerType] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flashDone, setFlashDone] = useState(false);

  useEffect(() => {
    if (defaultValues) {
      const isCustom = !PRESET_PARTNER_TYPES.includes(defaultValues.partnerType);
      setFormData({
        name: defaultValues.name || '',
        debitSubject: defaultValues.debitSubject || '',
        debitSubjectName: defaultValues.debitSubjectName || '',
        taxSubject: defaultValues.taxSubject !== undefined ? defaultValues.taxSubject : '2221.01.{{税率}}',
        taxSubjectName: defaultValues.taxSubjectName || '',
        creditSubject: defaultValues.creditSubject || '',
        creditSubjectName: defaultValues.creditSubjectName || '',
        partnerType: isCustom ? '其他' : defaultValues.partnerType,
        customPartnerType: isCustom ? defaultValues.partnerType : '',
        assetThreshold: defaultValues.assetThreshold ?? 5000,
        description: defaultValues.description || '',
        isPreset: defaultValues.isPreset || false,
        autoTax: defaultValues.autoTax !== undefined ? defaultValues.autoTax : true,
        keywords: defaultValues.keywords || [],
        keywordInput: '',
      });
      setShowCustomPartnerType(isCustom);
    } else {
      setFormData({ name: '', debitSubject: '', debitSubjectName: '', taxSubject: '2221.01.{{税率}}', taxSubjectName: '', creditSubject: '', creditSubjectName: '', partnerType: '供应商', customPartnerType: '', assetThreshold: 5000, description: '', isPreset: false, autoTax: true, keywords: [], keywordInput: '' });
      setShowCustomPartnerType(false);
    }
  }, [defaultValues]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    const finalPartnerType = showCustomPartnerType ? formData.customPartnerType.trim() : formData.partnerType;
    await new Promise(r => setTimeout(r, 400));
    onSave({
      name: formData.name.trim(), debitSubject: formData.debitSubject, debitSubjectName: formData.debitSubjectName,
      taxSubject: formData.taxSubject, creditSubject: formData.creditSubject, creditSubjectName: formData.creditSubjectName,
      partnerType: finalPartnerType, assetThreshold: formData.assetThreshold, description: formData.description,
      isPreset: formData.isPreset, autoTax: formData.autoTax, keywords: formData.keywords,
    });
    setFlashDone(true);
    setTimeout(() => { setSaving(false); setFlashDone(false); }, 600);
  };

  const handlePartnerTypeChange = (value: string) => {
    if (value === '其他') { setShowCustomPartnerType(true); setFormData(prev => ({ ...prev, partnerType: value })); }
    else { setShowCustomPartnerType(false); setFormData(prev => ({ ...prev, partnerType: value, customPartnerType: '' })); }
  };

  const handleAddKeyword = () => {
    if (formData.keywordInput.trim() && !formData.keywords.includes(formData.keywordInput.trim())) {
      setFormData(prev => ({ ...prev, keywords: [...prev.keywords, prev.keywordInput.trim()], keywordInput: '' }));
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== keyword) }));
  };

  const insertVariable = (variable: string) => {
    setFormData(prev => ({ ...prev, taxSubject: prev.taxSubject + variable }));
  };

  const getPreviewEntries = () => {
    const entries: { id: string; subject: string; subjectName: string; debit: number; credit: number }[] = [];
    if (formData.debitSubject) {
      entries.push({ id: 'debit', subject: formData.debitSubject, subjectName: formData.debitSubjectName || formData.debitSubject, debit: 1000.00, credit: 0 });
    }
    if (formData.taxSubject) {
      entries.push({ id: 'tax', subject: formData.taxSubject, subjectName: formData.autoTax ? '税金科目(自动)' : '税金科目', debit: 130.00, credit: 0 });
    }
    if (formData.creditSubject) {
      const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
      entries.push({ id: 'credit', subject: formData.creditSubject, subjectName: formData.creditSubjectName || formData.creditSubject, debit: 0, credit: totalDebit });
    }
    return entries;
  };

  const partnerType = showCustomPartnerType ? formData.customPartnerType : formData.partnerType;

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden">
      {/* ── 标题栏 ── */}
      <div className="px-8 py-5 flex items-center justify-between border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800">
          {defaultValues ? '编辑业务组' : '新增业务组'}
        </h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── 主体双栏 ── */}
      <div className="p-6">
        <div className="grid grid-cols-[1fr_320px] gap-6 items-start">

          {/* ========== 左侧 ========== */}
          <div className="space-y-5">

            {/* ── 基础信息 ── */}
            <section className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">基础信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500" required>业务组名称</Label>
                  <Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="例如：办公用品采购" className="h-8 text-sm bg-slate-50/50 border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">合作伙伴类型</Label>
                  <Select value={formData.partnerType} onValueChange={handlePartnerTypeChange}>
                    <SelectTrigger className="h-8 w-full bg-slate-50/50 border-slate-200"><SelectValue placeholder="选择合作伙伴类型" /></SelectTrigger>
                    <SelectContent>
                      {PRESET_PARTNER_TYPES.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {showCustomPartnerType && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500" required>自定义类型名称</Label>
                  <Input value={formData.customPartnerType} onChange={(e) => setFormData(prev => ({ ...prev, customPartnerType: e.target.value }))} placeholder="例如：服务商、承包商" className="h-8 text-sm bg-slate-50/50 border-slate-200" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">业务描述</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="描述业务组用途" className="h-14 text-sm resize-none bg-slate-50/50 border-slate-200" />
              </div>
            </section>

            {/* ── 科目规则 ── */}
            <section className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">科目规则</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500" required>借方科目</Label>
                  <SubjectPopover value={formData.debitSubject} name={formData.debitSubjectName} onChange={(code, name) => setFormData(prev => ({ ...prev, debitSubject: code, debitSubjectName: name }))} placeholder="选择借方科目" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500" required>贷方科目</Label>
                  <SubjectPopover value={formData.creditSubject} name={formData.creditSubjectName} onChange={(code, name) => setFormData(prev => ({ ...prev, creditSubject: code, creditSubjectName: name }))} placeholder="选择贷方科目" />
                </div>
              </div>
              {partnerType === '供应商' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">固定资产阈值（元）</Label>
                  <Input type="number" value={formData.assetThreshold} onChange={(e) => setFormData(prev => ({ ...prev, assetThreshold: Number(e.target.value) }))} placeholder="5000" className="h-8 text-sm bg-slate-50/50 border-slate-200" />
                  <p className="text-xs text-slate-400">超过此金额的采购自动识别为固定资产</p>
                </div>
              )}
            </section>

            {/* ── 关联关键词 ── */}
            <section className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">关联关键词</h3>
              <div className="flex gap-2">
                <Input value={formData.keywordInput} onChange={(e) => setFormData(prev => ({ ...prev, keywordInput: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()} placeholder="输入关键词，按 Enter 添加" className="h-8 text-sm flex-1 bg-slate-50/50 border-slate-200" />
                <Button type="button" size="sm" onClick={handleAddKeyword} className="h-8 px-3 bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4" /></Button>
              </div>
              {formData.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formData.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs gap-1 pr-1">
                      {keyword}
                      <button type="button" onClick={() => handleRemoveKeyword(keyword)} className="text-slate-400 hover:text-slate-600 ml-0.5"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            {formData.isPreset && (
              <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-100/80">
                <Badge className="bg-purple-100 text-purple-700 text-xs">系统预设</Badge>
                <p className="text-xs text-purple-500 mt-1.5">此业务组为系统预设，建议保留以获得最佳匹配效果</p>
              </div>
            )}
          </div>

          {/* ========== 右侧 ========== */}
          <div className="space-y-5 sticky top-8">

            {/* ── 凭证预览（蓝色主题） ── */}
            <div className={`rounded-xl border border-blue-800 shadow-lg overflow-hidden transition-all duration-500 ${flashDone ? 'ring-2 ring-emerald-400/60' : ''}`}>
              <div className="px-5 py-3.5 bg-blue-900 border-b border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold text-blue-200 tracking-wide">凭证预览</span>
                  </div>
                  <span className="text-xs font-mono text-blue-500">#2026-001</span>
                </div>
              </div>
              <div className="px-5 py-4 bg-blue-900 space-y-0.5">
                <AnimatePresence mode="popLayout">
                  {getPreviewEntries().length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm text-blue-400/60 py-8">
                      选择科目后显示预览
                    </motion.div>
                  ) : (
                    getPreviewEntries().map((entry) => (
                      <motion.div
                        key={entry.id}
                        variants={entryVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        layout
                        className="flex items-center gap-3 py-2.5 border-b border-blue-800/60 last:border-0"
                      >
                        <span className={`text-xs font-bold w-5 text-center ${entry.debit > 0 ? 'text-blue-300' : 'text-orange-300'}`}>
                          {entry.debit > 0 ? '借' : '贷'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-blue-100 truncate">{entry.subject || '(未选择)'}</div>
                          <div className="text-xs text-blue-400 truncate">{entry.subjectName}</div>
                        </div>
                        <div className="text-sm font-semibold text-blue-100 text-right font-mono tabular-nums">
                          {entry.debit > 0 ? entry.debit.toFixed(2) : entry.credit.toFixed(2)}
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
              <div className="px-5 py-2 bg-blue-950 border-t border-blue-800">
                <p className="text-xs text-blue-500">* 实时模拟结果</p>
              </div>
            </div>

            {/* ── 税金逻辑 ── */}
            <section className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">税金逻辑</h3>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2.5">
                  <Label className="text-xs text-slate-500 shrink-0">计税</Label>
                  <Switch
                    checked={!!formData.taxSubject}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      taxSubject: checked ? (prev.taxSubject || '2221.01.{{税率}}') : '',
                      taxSubjectName: checked ? prev.taxSubjectName : '',
                      autoTax: checked ? prev.autoTax : false,
                    }))}
                  />
                </div>
                {!!formData.taxSubject && (
                  <div className="flex items-center gap-2.5">
                    <div className="h-4 w-px bg-slate-200" />
                    <Label className="text-xs text-slate-500 shrink-0">自动匹配</Label>
                    <Switch
                      checked={formData.autoTax}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoTax: checked }))}
                      className="data-[state=checked]:bg-slate-500 data-[state=unchecked]:bg-slate-300"
                    />
                  </div>
                )}
              </div>
              <AnimatePresence>
                {formData.taxSubject ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">税金科目</Label>
                        <SubjectPopover value={formData.taxSubject} name={formData.taxSubjectName} onChange={(code, name) => setFormData(prev => ({ ...prev, taxSubject: code, taxSubjectName: name }))} placeholder="选择税金科目" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_VARIABLES.map((v) => (
                          <button
                            key={v.name}
                            type="button"
                            className="inline-flex items-center px-2.5 py-1 text-xs rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            onClick={() => insertVariable(v.value)}
                          >
                            {v.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <p className="text-xs text-slate-400">不计税，凭证中不生成税金分录</p>
                )}
              </AnimatePresence>
            </section>

            {/* ── 操作按钮 ── */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-9 text-sm border-slate-200 text-slate-500 hover:text-slate-700" onClick={onCancel}>
                取消
              </Button>
              <Button
                className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all"
                onClick={handleSubmit}
                disabled={saving || !formData.name.trim()}
              >
                {saving ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <>
                    {flashDone && <Sparkles className="h-4 w-4 mr-1.5 text-emerald-300" />}
                    {defaultValues ? '更新业务组' : '保存业务组'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
