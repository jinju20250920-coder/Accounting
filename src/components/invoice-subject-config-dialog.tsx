'use client';

import { useState, useEffect } from 'react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  Settings2,
  Plus,
  Trash2,
  Edit2,
  Search,
  Info,
} from 'lucide-react';
import type { InvoiceSubjectRule } from '@/types';

// 默认科目
const DEFAULT_SUBJECTS = {
  inputDebit: { code: '1401', name: '材料采购' },
  inputTax: { code: '222101', name: '应交税费-增值税-进项税额' },
  inputCredit: { code: '2202', name: '应付账款' },
  outputDebit: { code: '1122', name: '应收账款' },
  outputCredit: { code: '6001', name: '主营业务收入' },
  outputTax: { code: '222102', name: '应交税费-增值税-销项税额' },
};

// 科目槽位定义
const INPUT_SLOTS = [
  { key: 'inputDebitSubject', label: '进项-借方（费用/采购）', default: DEFAULT_SUBJECTS.inputDebit },
  { key: 'inputTaxSubject', label: '进项-进项税', default: DEFAULT_SUBJECTS.inputTax },
  { key: 'inputCreditSubject', label: '进项-贷方（应付）', default: DEFAULT_SUBJECTS.inputCredit },
] as const;

const OUTPUT_SLOTS = [
  { key: 'outputDebitSubject', label: '销项-借方（应收）', default: DEFAULT_SUBJECTS.outputDebit },
  { key: 'outputCreditSubject', label: '销项-贷方（收入）', default: DEFAULT_SUBJECTS.outputCredit },
  { key: 'outputTaxSubject', label: '销项-销项税', default: DEFAULT_SUBJECTS.outputTax },
] as const;

interface SubjectInputProps {
  label: string;
  code: string;
  name: string;
  defaultCode: string;
  defaultName: string;
  onCodeChange: (code: string) => void;
  onNameChange: (name: string) => void;
}

function SubjectInput({ label, code, name, defaultCode, defaultName, onCodeChange, onNameChange }: SubjectInputProps) {
  const { subjects } = useSubjectStore();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const existsInDb = subjects.some(s => s.code === code);
  const willAutoCreate = code && code !== defaultCode && !existsInDb;

  // 当代码改变时自动查找名称
  const handleCodeInput = (val: string) => {
    onCodeChange(val);
    const found = subjects.find(s => s.code === val);
    onNameChange(found ? found.name : '');
  };

  const filteredSubjects = subjects.filter(s =>
    s.code.includes(search) || s.name.includes(search)
  ).slice(0, 50);

  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          value={code}
          onChange={(e) => handleCodeInput(e.target.value)}
          placeholder={defaultCode}
          className="w-28 h-8 text-xs"
        />
        <div className="relative">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setOpen(!open)}>
            <Search className="h-3 w-3" />
          </Button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-9 z-50 w-56 bg-white border rounded-md shadow-lg p-2">
                <Input
                  placeholder="搜索科目..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs mb-2"
                  autoFocus
                />
                <div className="max-h-40 overflow-y-auto">
                  {filteredSubjects.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-2 py-1 text-xs hover:bg-slate-100 rounded flex items-center gap-2"
                      onClick={() => {
                        onCodeChange(s.code);
                        onNameChange(s.name);
                        setOpen(false);
                      }}
                    >
                      <span className="font-mono text-blue-600">{s.code}</span>
                      <span className="truncate">{s.name}</span>
                    </button>
                  ))}
                  {filteredSubjects.length === 0 && (
                    <div className="text-xs text-slate-400 py-2 text-center">无匹配科目</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <span className="text-xs text-slate-500 truncate max-w-[100px]">
          {name || defaultName}
        </span>
        {willAutoCreate && (
          <span className="text-xs text-orange-500 whitespace-nowrap">
            自动创建
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceSubjectConfigDialog({ open, onOpenChange }: Props) {
  const { showToast } = useToast();
  const accountSetId = useAccountSetStore((s) => s.currentAccountSetId);
  const [rules, setRules] = useState<InvoiceSubjectRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // 编辑表单
  const [formName, setFormName] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formType, setFormType] = useState<'input' | 'output' | 'both'>('input');
  const [formPriority, setFormPriority] = useState(0);
  const [formTaxRate, setFormTaxRate] = useState<string>('');
  const [formSubjects, setFormSubjects] = useState<Record<string, string>>({});
  const [formSubjectNames, setFormSubjectNames] = useState<Record<string, string>>({});

  // 加载规则
  const loadRules = async () => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      const data = await sqliteService.getInvoiceSubjectRules();
      setRules(data);
    } catch (e) {
      console.error('加载规则失败:', e);
    }
  };

  useEffect(() => {
    if (!open || !accountSetId) return;
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountSetId]);

  // 开始编辑
  const startEdit = (rule: InvoiceSubjectRule) => {
    setEditingId(rule.id);
    setShowAdd(false);
    setFormName(rule.name);
    setFormKeywords((rule.keywords || []).join(', '));
    setFormType(rule.invoiceType);
    setFormPriority(rule.priority || 0);
    setFormTaxRate(rule.matchTaxRate != null ? String(rule.matchTaxRate * 100) : '');
    const subs: Record<string, string> = {};
    const names: Record<string, string> = {};
    for (const slot of [...INPUT_SLOTS, ...OUTPUT_SLOTS]) {
      const code = rule[slot.key] as string | undefined;
      const nameKey = (slot.key + 'Name') as keyof InvoiceSubjectRule;
      const name = rule[nameKey] as string | undefined;
      if (code) subs[slot.key] = code;
      if (name) names[slot.key] = name;
    }
    setFormSubjects(subs);
    setFormSubjectNames(names);
  };

  // 开始新增
  const startAdd = () => {
    setShowAdd(true);
    setEditingId(null);
    setFormName('');
    setFormKeywords('');
    setFormType('input');
    setFormPriority(0);
    setFormTaxRate('');
    setFormSubjects({});
    setFormSubjectNames({});
  };

  // 保存
  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('error', '请输入规则名称');
      return;
    }
    if (!formKeywords.trim()) {
      showToast('error', '请输入至少一个关键词');
      return;
    }

    const keywords = formKeywords.split(/[,，]/).map(k => k.trim()).filter(Boolean);
    const now = new Date().toISOString();
    const id = editingId || `rule_${Date.now()}`;

    const slotAssignments: Record<string, string | null> = {};
    for (const slot of [...INPUT_SLOTS, ...OUTPUT_SLOTS]) {
      const code = formSubjects[slot.key] || null;
      const name = formSubjectNames[slot.key] || null;
      slotAssignments[slot.key] = code;
      slotAssignments[slot.key + 'Name'] = name;
    }

    const existingCreateTime = rules.find(r => r.id === editingId)?.createTime;
    const rule: InvoiceSubjectRule = {
      id,
      accountSetId: accountSetId!,
      name: formName.trim(),
      keywords,
      invoiceType: formType,
      priority: formPriority,
      matchTaxRate: formTaxRate ? parseFloat(formTaxRate) / 100 : undefined,
      createTime: existingCreateTime || now,
      updateTime: now,
      ...slotAssignments,
    } as InvoiceSubjectRule;

    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveInvoiceSubjectRule(rule);
      await loadRules();
      setEditingId(null);
      setShowAdd(false);
      showToast('success', '规则已保存');
    } catch (e) {
      showToast('error', '保存失败: ' + e);
    }
  };

  // 删除
  const handleDelete = async (id: string) => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.deleteInvoiceSubjectRule(id);
      await loadRules();
      showToast('success', '规则已删除');
    } catch (e) {
      showToast('error', '删除失败');
    }
  };

  const updateFormSubject = (key: string, code: string) => {
    setFormSubjects(prev => {
      const next = { ...prev };
      if (code) next[key] = code; else delete next[key];
      return next;
    });
  };

  const updateFormSubjectName = (key: string, name: string) => {
    setFormSubjectNames(prev => {
      const next = { ...prev };
      if (name) next[key] = name; else delete next[key];
      return next;
    });
  };

  const typeBadge = (type: string) => {
    switch (type) {
      case 'input': return <Badge className="bg-blue-100 text-blue-700 text-xs">进项</Badge>;
      case 'output': return <Badge className="bg-green-100 text-green-700 text-xs">销项</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-700 text-xs">双向</Badge>;
    }
  };

  // 获取规则摘要
  const getSubjectPreview = (rule: InvoiceSubjectRule) => {
    const parts: string[] = [];
    for (const slot of rule.invoiceType !== 'output' ? INPUT_SLOTS : OUTPUT_SLOTS) {
      const code = rule[slot.key] as string | undefined;
      if (code) parts.push(code);
    }
    return parts.join(' / ') || '默认';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            发票科目映射规则
          </DialogTitle>
        </DialogHeader>

        {/* 说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-700">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium mb-1">匹配逻辑</p>
              <p>导入发票生成凭证时，系统根据「货物名称」匹配关键词规则，覆盖默认科目。</p>
              <p className="mt-1">优先级：关键词规则（优先级数字越大越先） &gt; 默认科目。未配置的科目槽位使用默认值。</p>
              <p className="mt-1">不存在的科目代码会在生成凭证时自动创建。</p>
            </div>
          </div>
        </div>

        {/* 默认科目提示 */}
        <div className="bg-slate-50 rounded-md p-3 text-xs">
          <p className="font-medium text-slate-600 mb-2">默认科目（无规则匹配时使用）</p>
          <div className="grid grid-cols-3 gap-2">
            <div>进项: <span className="font-mono text-blue-600">1401</span> / <span className="font-mono text-blue-600">222101</span> / <span className="font-mono text-blue-600">2202</span></div>
            <div>销项: <span className="font-mono text-green-600">1122</span> / <span className="font-mono text-green-600">6001</span> / <span className="font-mono text-green-600">222102</span></div>
          </div>
        </div>

        {/* 规则列表 */}
        <div className="space-y-2">
          {rules.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-4">
              暂无规则，点击下方按钮添加
            </div>
          ) : (
            rules.map(rule => (
              <Card key={rule.id} className={editingId === rule.id ? 'ring-2 ring-blue-400' : ''}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{rule.name}</span>
                      {typeBadge(rule.invoiceType)}
                      <div className="flex gap-1">
                        {(rule.keywords || []).slice(0, 5).map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                        ))}
                        {(rule.keywords || []).length > 5 && (
                          <Badge variant="outline" className="text-xs">+{rule.keywords.length - 5}</Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        P{rule.priority}
                        {rule.matchTaxRate != null && ` · ${rule.matchTaxRate * 100}%`}
                        {' · '}{getSubjectPreview(rule)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(rule)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {editingId === rule.id && (
                    <div className="mt-3 border-t pt-3">
                      <RuleForm
                        formName={formName} setFormName={setFormName}
                        formKeywords={formKeywords} setFormKeywords={setFormKeywords}
                        formType={formType} setFormType={setFormType}
                        formPriority={formPriority} setFormPriority={setFormPriority}
                        formTaxRate={formTaxRate} setFormTaxRate={setFormTaxRate}
                        formSubjects={formSubjects} updateFormSubject={updateFormSubject}
                        formSubjectNames={formSubjectNames} updateFormSubjectName={updateFormSubjectName}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* 新增按钮 / 新增表单 */}
        {!showAdd && !editingId && (
          <Button variant="outline" onClick={startAdd} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            添加规则
          </Button>
        )}

        {showAdd && (
          <Card className="ring-2 ring-blue-400">
            <CardContent className="py-3 px-4">
              <RuleForm
                formName={formName} setFormName={setFormName}
                formKeywords={formKeywords} setFormKeywords={setFormKeywords}
                formType={formType} setFormType={setFormType}
                formPriority={formPriority} setFormPriority={setFormPriority}
                formTaxRate={formTaxRate} setFormTaxRate={setFormTaxRate}
                formSubjects={formSubjects} updateFormSubject={updateFormSubject}
                formSubjectNames={formSubjectNames} updateFormSubjectName={updateFormSubjectName}
                onSave={handleSave}
                onCancel={() => setShowAdd(false)}
              />
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 规则编辑表单
function RuleForm({
  formName, setFormName,
  formKeywords, setFormKeywords,
  formType, setFormType,
  formPriority, setFormPriority,
  formTaxRate, setFormTaxRate,
  formSubjects, updateFormSubject,
  formSubjectNames, updateFormSubjectName,
  onSave, onCancel,
}: {
  formName: string; setFormName: (v: string) => void;
  formKeywords: string; setFormKeywords: (v: string) => void;
  formType: 'input' | 'output' | 'both'; setFormType: (v: 'input' | 'output' | 'both') => void;
  formPriority: number; setFormPriority: (v: number) => void;
  formTaxRate: string; setFormTaxRate: (v: string) => void;
  formSubjects: Record<string, string>; updateFormSubject: (key: string, code: string) => void;
  formSubjectNames: Record<string, string>; updateFormSubjectName: (key: string, name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* 基本信息 */}
      <div className="grid grid-cols-5 gap-3">
        <div>
          <Label className="text-xs">规则名称 *</Label>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="如：差旅费" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">关键词（逗号分隔）*</Label>
          <Input value={formKeywords} onChange={e => setFormKeywords(e.target.value)} placeholder="滴滴,打车,出行" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">发票类型</Label>
          <Select value={formType} onValueChange={setFormType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="input">进项</SelectItem>
              <SelectItem value="output">销项</SelectItem>
              <SelectItem value="both">双向</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">优先级</Label>
          <Input type="number" value={formPriority} onChange={e => setFormPriority(parseInt(e.target.value) || 0)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">匹配税率（%）</Label>
          <Input
            type="number"
            value={formTaxRate}
            onChange={e => setFormTaxRate(e.target.value)}
            placeholder="不填=不限"
            className="h-8 text-xs"
            step="0.1"
          />
        </div>
      </div>

      {/* 进项科目 */}
      {(formType === 'input' || formType === 'both') && (
        <div>
          <p className="text-xs font-medium text-blue-600 mb-2">进项科目覆盖</p>
          <div className="grid grid-cols-3 gap-3">
            {INPUT_SLOTS.map(slot => (
              <SubjectInput
                key={slot.key}
                label={slot.label}
                code={formSubjects[slot.key] || ''}
                name={formSubjectNames[slot.key] || ''}
                defaultCode={slot.default.code}
                defaultName={slot.default.name}
                onCodeChange={(code) => updateFormSubject(slot.key, code)}
                onNameChange={(name) => updateFormSubjectName(slot.key, name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 销项科目 */}
      {(formType === 'output' || formType === 'both') && (
        <div>
          <p className="text-xs font-medium text-green-600 mb-2">销项科目覆盖</p>
          <div className="grid grid-cols-3 gap-3">
            {OUTPUT_SLOTS.map(slot => (
              <SubjectInput
                key={slot.key}
                label={slot.label}
                code={formSubjects[slot.key] || ''}
                name={formSubjectNames[slot.key] || ''}
                defaultCode={slot.default.code}
                defaultName={slot.default.name}
                onCodeChange={(code) => updateFormSubject(slot.key, code)}
                onNameChange={(name) => updateFormSubjectName(slot.key, name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 操作 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={onSave}>保存</Button>
      </div>
    </div>
  );
}
