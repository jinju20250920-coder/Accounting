'use client';

import { useState, useEffect, useCallback } from 'react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import {
  Settings2,
  Plus,
  Trash2,
  Edit2,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import type {
  InvoiceSmartRule,
  SmartRuleCondition,
  SmartRuleAction,
  TextCondition,
  NumericCondition,
  SupplierListCondition,
  OverrideSubjectAction,
  AssignAuxiliaryAction,
  MarkAsAction,
  CreateFixedAssetAction,
  SupplierSubjectAction,
  ReimbursementSubjectAction,
  AuxiliaryStrategyConfig,
  ExpenseKeywordCategory,
  DepreciationMethod,
} from '@/types';

// ─── Props ──────────────────────────────────────────────────
interface InvoiceSmartRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceType: 'input' | 'output';
}

// ─── Constants ──────────────────────────────────────────────
const CONDITION_FIELD_LABELS: Record<string, string> = {
  goodsName: '货物名称',
  sellerName: '销方名称',
  notes: '备注',
  totalAmount: '金额',
  taxRate: '税率',
  supplierInList: '供应商白名单',
};

const TEXT_OPERATORS: { value: 'contains' | 'equals'; label: string }[] = [
  { value: 'contains', label: '包含' },
  { value: 'equals', label: '等于' },
];

const NUMERIC_OPERATORS: { value: '>' | '<' | '>=' | '<=' | 'equals'; label: string }[] = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'equals', label: '=' },
];

const ACTION_TYPE_LABELS: Record<string, string> = {
  overrideSubject: '科目覆盖',
  assignAuxiliary: '辅助核算分配',
  markAs: '分类标记',
  createFixedAsset: '创建固定资产',
  supplierSubject: '供应商科目',
  reimbursementSubject: '报销科目',
};

const TEXT_FIELDS = ['goodsName', 'sellerName', 'notes'];
const NUMERIC_FIELDS = ['totalAmount', 'taxRate'];

// ─── Main Component ─────────────────────────────────────────
export function InvoiceSmartRuleDialog({ open, onOpenChange, invoiceType }: InvoiceSmartRuleDialogProps) {
  const [activeTab, setActiveTab] = useState('strategy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            智能规则配置
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="strategy">辅助核算策略</TabsTrigger>
            <TabsTrigger value="rules">规则配置</TabsTrigger>
            <TabsTrigger value="suppliers">供应商映射</TabsTrigger>
            <TabsTrigger value="expenses">费用清单</TabsTrigger>
            <TabsTrigger value="assets">资产类别</TabsTrigger>
          </TabsList>

          <TabsContent value="strategy" className="mt-4">
            <StrategyTab />
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <RulesTab invoiceType={invoiceType} />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-4">
            <PlaceholderTab title="供应商映射" />
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <PlaceholderTab title="费用清单" />
          </TabsContent>

          <TabsContent value="assets" className="mt-4">
            <PlaceholderTab title="资产类别" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Placeholder Tab ────────────────────────────────────────
function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Settings2 className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{title} — 待实现</p>
      <p className="text-xs mt-1">该功能将在后续版本中提供</p>
    </div>
  );
}

// ─── Tab 0: Strategy ────────────────────────────────────────
function StrategyTab() {
  const { showToast } = useToast();
  const accountSetId = useAccountSetStore((s) => s.currentAccountSetId);
  const { subjects } = useSubjectStore();

  const [strategy, setStrategy] = useState<AuxiliaryStrategyConfig | null>(null);
  const [categories, setCategories] = useState<ExpenseKeywordCategory[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Category edit form
  const [catKeywords, setCatKeywords] = useState('');
  const [catSubjectCode, setCatSubjectCode] = useState('');
  const [catSubjectName, setCatSubjectName] = useState('');

  useEffect(() => {
    if (accountSetId) loadData();
  }, [accountSetId]);

  const loadData = async () => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      const [s, c] = await Promise.all([
        sqliteService.getAuxiliaryStrategy(),
        sqliteService.getExpenseKeywordCategories(),
      ]);
      if (s) setStrategy(s);
      else {
        // Create default strategy
        const defaultStrategy: AuxiliaryStrategyConfig = {
          id: `strategy_${accountSetId}`,
          accountSetId: accountSetId!,
          mode: 'auxiliary',
          autoCreatePartner: true,
          autoDisableAuxiliaryOnSubAccount: true,
          updateTime: new Date().toISOString(),
        };
        setStrategy(defaultStrategy);
      }
      setCategories(c);
    } catch (e) {
      console.error('加载策略失败:', e);
    }
  };

  const saveStrategy = async (updates: Partial<AuxiliaryStrategyConfig>) => {
    if (!strategy) return;
    const updated: AuxiliaryStrategyConfig = {
      ...strategy,
      ...updates,
      updateTime: new Date().toISOString(),
    };
    setStrategy(updated);
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveAuxiliaryStrategy(updated);
      showToast('success', '策略已保存');
    } catch (e) {
      showToast('error', '保存失败: ' + e);
    }
  };

  const saveCategory = async (cat: ExpenseKeywordCategory) => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveExpenseKeywordCategory(cat);
      await loadData();
      setEditingCategoryId(null);
      showToast('success', '分类已保存');
    } catch (e) {
      showToast('error', '保存失败: ' + e);
    }
  };

  const toggleCategoryEnabled = async (cat: ExpenseKeywordCategory) => {
    await saveCategory({ ...cat, enabled: !cat.enabled });
  };

  const startEditCategory = (cat: ExpenseKeywordCategory) => {
    setEditingCategoryId(cat.id);
    setCatKeywords(cat.keywords.join(', '));
    setCatSubjectCode(cat.expenseSubjectCode || '');
    setCatSubjectName(cat.expenseSubjectName || '');
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
  };

  const saveEditCategory = async (cat: ExpenseKeywordCategory) => {
    const keywords = catKeywords.split(/[,，]/).map(k => k.trim()).filter(Boolean);
    if (keywords.length === 0) {
      showToast('error', '请输入至少一个关键词');
      return;
    }
    await saveCategory({
      ...cat,
      keywords,
      expenseSubjectCode: catSubjectCode || undefined,
      expenseSubjectName: catSubjectName || undefined,
      updateTime: new Date().toISOString(),
    });
  };

  const handleSubjectCodeChange = (code: string) => {
    setCatSubjectCode(code);
    const found = subjects.find(s => s.code === code);
    setCatSubjectName(found ? found.name : '');
  };

  if (!strategy) return null;

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">辅助核算模式</Label>
        <RadioGroup
          value={strategy.mode}
          onValueChange={(v) => saveStrategy({ mode: v as 'auxiliary' | 'sub_account' })}
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="auxiliary" id="mode-auxiliary" />
            <Label htmlFor="mode-auxiliary" className="text-sm cursor-pointer">辅助核算</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sub_account" id="mode-sub-account" />
            <Label htmlFor="mode-sub-account" className="text-sm cursor-pointer">科目明细化</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={strategy.autoCreatePartner}
            onCheckedChange={(checked) => saveStrategy({ autoCreatePartner: !!checked })}
          />
          <span className="text-sm cursor-pointer">
            自动创建往来单位卡片（报销人未找到时自动创建）
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={strategy.autoDisableAuxiliaryOnSubAccount}
            onCheckedChange={(checked) => saveStrategy({ autoDisableAuxiliaryOnSubAccount: !!checked })}
          />
          <span className="text-sm cursor-pointer">
            科目明细化时自动禁用辅助核算
          </span>
        </div>
      </div>

      {/* Help toggle */}
      <div>
        <button
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          onClick={() => setShowHelp(!showHelp)}
        >
          <Info className="h-3.5 w-3.5" />
          {showHelp ? '收起说明' : '查看说明'}
        </button>
        {showHelp && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-700 space-y-1">
            <p><strong>辅助核算模式：</strong>往来信息记录在科目辅助核算项中，科目本身不变。</p>
            <p><strong>科目明细化模式：</strong>为每个往来对象自动创建二级子科目，辅助核算自动禁用。</p>
            <p className="pt-1 font-medium">规则匹配逻辑：</p>
            <div className="space-y-1 pl-2">
              <p>- 采购/原材料 → 供应商在白名单中 → 辅助核算取销方名称</p>
              <p>- 报销/差旅 → 类别:餐饮/交通/通讯 → 辅助核算取报销人</p>
              <p>- 资产/设备 → 金额&gt;5000+关键词 → 自动生成资产卡片</p>
            </div>
          </div>
        )}
      </div>

      {/* Expense Keyword Categories Table */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">费用关键词分类</Label>
        <p className="text-xs text-slate-500">配置各类费用的关键词匹配规则，用于报销类发票的智能分类。</p>

        {categories.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-6 border rounded-md">
            暂无分类数据
          </div>
        ) : (
          <div className="border rounded-md divide-y">
            {categories.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge className={cat.isSystem
                      ? 'bg-purple-50 text-purple-600 text-xs shrink-0'
                      : 'bg-blue-50 text-blue-600 text-xs shrink-0'
                    }>
                      {cat.isSystem ? '系统' : '自定义'}
                    </Badge>
                    <span className="text-sm font-medium shrink-0">{cat.category}</span>
                    <span className="text-xs text-slate-500 truncate">
                      {cat.keywords.slice(0, 5).join('、')}
                      {cat.keywords.length > 5 && ` 等${cat.keywords.length}个`}
                    </span>
                    {cat.expenseSubjectCode && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {cat.expenseSubjectCode} {cat.expenseSubjectName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={cat.enabled}
                      onCheckedChange={() => toggleCategoryEnabled(cat)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => startEditCategory(cat)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Inline edit drawer */}
                {editingCategoryId === cat.id && (
                  <div className="border-t bg-slate-50 px-3 py-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">关键词（逗号分隔）</Label>
                        <Input
                          value={catKeywords}
                          onChange={(e) => setCatKeywords(e.target.value)}
                          className="h-8 text-xs mt-1"
                          placeholder="餐费,餐饮,食品"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">费用科目</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input
                            value={catSubjectCode}
                            onChange={(e) => handleSubjectCodeChange(e.target.value)}
                            className="w-28 h-8 text-xs"
                            placeholder="科目代码"
                          />
                          <span className="text-xs text-slate-500 truncate max-w-[120px]">
                            {catSubjectName}
                          </span>
                          <SubjectPopoverPopup
                            code={catSubjectCode}
                            name={catSubjectName}
                            onSelect={(code, name) => {
                              setCatSubjectCode(code);
                              setCatSubjectName(name);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={cancelEditCategory}>取消</Button>
                      <Button size="sm" onClick={() => saveEditCategory(cat)}>保存</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 1: Rules ───────────────────────────────────────────
function RulesTab({ invoiceType }: { invoiceType: 'input' | 'output' }) {
  const { showToast } = useToast();
  const accountSetId = useAccountSetStore((s) => s.currentAccountSetId);
  const { subjects } = useSubjectStore();

  const [rules, setRules] = useState<InvoiceSmartRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formInvoiceType, setFormInvoiceType] = useState<'input' | 'output' | 'both'>('both');
  const [formPriority, setFormPriority] = useState(50);
  const [formConditions, setFormConditions] = useState<SmartRuleCondition[]>([]);
  const [formActions, setFormActions] = useState<SmartRuleAction[]>([]);

  useEffect(() => {
    if (accountSetId) loadRules();
  }, [accountSetId]);

  const loadRules = async () => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      const data = await sqliteService.getSmartRules();
      setRules(data);
    } catch (e) {
      console.error('加载规则失败:', e);
    }
  };

  const filteredRules = rules.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  const resetForm = () => {
    setFormName('');
    setFormInvoiceType('both');
    setFormPriority(50);
    setFormConditions([]);
    setFormActions([]);
  };

  const startAdd = () => {
    resetForm();
    setEditingRuleId(null);
    setShowAddForm(true);
  };

  const startEdit = (rule: InvoiceSmartRule) => {
    setFormName(rule.name);
    setFormInvoiceType(rule.invoiceType);
    setFormPriority(rule.priority);
    setFormConditions(JSON.parse(JSON.stringify(rule.conditions || [])));
    setFormActions(JSON.parse(JSON.stringify(rule.actions || [])));
    setEditingRuleId(rule.id);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingRuleId(null);
    setShowAddForm(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('error', '请输入规则名称');
      return;
    }
    if (formConditions.length === 0) {
      showToast('error', '请至少添加一个条件');
      return;
    }
    if (formActions.length === 0) {
      showToast('error', '请至少添加一个动作');
      return;
    }

    const now = new Date().toISOString();
    const id = editingRuleId || `rule_${Date.now()}`;
    const existing = rules.find(r => r.id === editingRuleId);

    const rule: InvoiceSmartRule = {
      id,
      accountSetId: accountSetId!,
      name: formName.trim(),
      invoiceType: formInvoiceType,
      priority: formPriority,
      conditions: formConditions,
      actions: formActions,
      enabled: existing ? existing.enabled : true,
      createTime: existing?.createTime || now,
      updateTime: now,
    };

    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveSmartRule(rule);
      await loadRules();
      cancelEdit();
      showToast('success', '规则已保存');
    } catch (e) {
      showToast('error', '保存失败: ' + e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.deleteSmartRule(id);
      await loadRules();
      showToast('success', '规则已删除');
    } catch (e) {
      showToast('error', '删除失败');
    }
  };

  const toggleEnabled = async (rule: InvoiceSmartRule) => {
    const updated = { ...rule, enabled: !rule.enabled, updateTime: new Date().toISOString() };
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveSmartRule(updated);
      await loadRules();
    } catch (e) {
      showToast('error', '更新失败');
    }
  };

  // Type badge for rules
  const typeBadge = (type: string) => {
    switch (type) {
      case 'input': return <Badge className="bg-green-50 text-green-600 text-xs">进项</Badge>;
      case 'output': return <Badge className="bg-red-50 text-red-500 text-xs">销项</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-500 text-xs">通用</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Help info */}
      <div>
        <button
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          onClick={() => {}}
        >
          <Info className="h-3.5 w-3.5" />
          <span>条件与动作匹配：导入发票时，系统按优先级依次匹配规则，首个满足全部条件的规则生效。</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="搜索规则名称..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Rule list */}
      <div className="space-y-2">
        {filteredRules.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-6">
            暂无规则，点击下方按钮添加
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div key={rule.id} className="border rounded-md">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-medium text-sm truncate">{rule.name}</span>
                  {typeBadge(rule.invoiceType)}
                  <Badge className="bg-slate-100 text-slate-500 text-xs">
                    P{rule.priority}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {rule.conditions.length}个条件 · {rule.actions.length}个动作
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="p-1.5 rounded hover:bg-slate-100"
                    onClick={() => toggleEnabled(rule)}
                    title={rule.enabled ? '点击禁用' : '点击启用'}
                  >
                    {rule.enabled
                      ? <ToggleRight className="h-4 w-4 text-green-500" />
                      : <ToggleLeft className="h-4 w-4 text-slate-400" />
                    }
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => startEdit(rule)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Inline edit drawer */}
              {editingRuleId === rule.id && (
                <div className="border-t bg-slate-50 px-3 py-3">
                  <RuleForm
                    formName={formName}
                    setFormName={setFormName}
                    formInvoiceType={formInvoiceType}
                    setFormInvoiceType={setFormInvoiceType}
                    formPriority={formPriority}
                    setFormPriority={setFormPriority}
                    formConditions={formConditions}
                    setFormConditions={setFormConditions}
                    formActions={formActions}
                    setFormActions={setFormActions}
                    onSave={handleSave}
                    onCancel={cancelEdit}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add button */}
      {!showAddForm && !editingRuleId && (
        <Button variant="outline" onClick={startAdd} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          新增规则
        </Button>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="border rounded-md ring-2 ring-blue-400">
          <div className="px-3 py-2.5 bg-slate-50 border-b">
            <span className="text-sm font-medium text-blue-600">新增规则</span>
          </div>
          <div className="px-3 py-3">
            <RuleForm
              formName={formName}
              setFormName={setFormName}
              formInvoiceType={formInvoiceType}
              setFormInvoiceType={setFormInvoiceType}
              formPriority={formPriority}
              setFormPriority={setFormPriority}
              formConditions={formConditions}
              setFormConditions={setFormConditions}
              formActions={formActions}
              setFormActions={setFormActions}
              onSave={handleSave}
              onCancel={cancelEdit}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rule Form ──────────────────────────────────────────────
function RuleForm({
  formName, setFormName,
  formInvoiceType, setFormInvoiceType,
  formPriority, setFormPriority,
  formConditions, setFormConditions,
  formActions, setFormActions,
  onSave, onCancel,
}: {
  formName: string; setFormName: (v: string) => void;
  formInvoiceType: 'input' | 'output' | 'both'; setFormInvoiceType: (v: 'input' | 'output' | 'both') => void;
  formPriority: number; setFormPriority: (v: number) => void;
  formConditions: SmartRuleCondition[]; setFormConditions: (v: SmartRuleCondition[]) => void;
  formActions: SmartRuleAction[]; setFormActions: (v: SmartRuleAction[]) => void;
  onSave: () => void; onCancel: () => void;
}) {
  const addCondition = () => {
    const newCond: TextCondition = {
      field: 'goodsName',
      operator: 'contains',
      values: [],
    };
    setFormConditions([...formConditions, newCond]);
  };

  const removeCondition = (idx: number) => {
    setFormConditions(formConditions.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx: number, updates: Partial<SmartRuleCondition>) => {
    const updated = formConditions.map((c, i): SmartRuleCondition => {
      if (i !== idx) return c;

      // If field type changed, reset operator and values
      if (updates.field && updates.field !== c.field) {
        if (NUMERIC_FIELDS.includes(updates.field)) {
          return {
            field: updates.field,
            operator: '>' as const,
            value: 0,
          } as NumericCondition;
        } else if (updates.field === 'supplierInList') {
          return {
            field: 'supplierInList',
            groupName: '',
          } as SupplierListCondition;
        } else {
          return {
            field: updates.field as 'goodsName' | 'sellerName' | 'notes',
            operator: 'contains' as const,
            values: [],
          } as TextCondition;
        }
      }

      return { ...c, ...updates } as SmartRuleCondition;
    });
    setFormConditions(updated);
  };

  const addAction = () => {
    const newAction: OverrideSubjectAction = {
      type: 'overrideSubject',
      slot: 'debit',
      subjectCode: '',
      subjectName: '',
    };
    setFormActions([...formActions, newAction]);
  };

  const removeAction = (idx: number) => {
    setFormActions(formActions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, updates: Partial<SmartRuleAction>) => {
    const updated = formActions.map((a, i): SmartRuleAction => {
      if (i !== idx) return a;

      // If action type changed, create a new default action of that type
      if (updates.type && updates.type !== a.type) {
        switch (updates.type) {
          case 'overrideSubject':
            return { type: 'overrideSubject', slot: 'debit', subjectCode: '', subjectName: '' } as OverrideSubjectAction;
          case 'assignAuxiliary':
            return { type: 'assignAuxiliary', auxiliaryType: 'employee', nameList: [], sourceField: 'notes' as const } as AssignAuxiliaryAction;
          case 'markAs':
            return { type: 'markAs', category: 'purchase' } as MarkAsAction;
          case 'createFixedAsset':
            return {
              type: 'createFixedAsset',
              assetCategory: '',
              depreciationYears: 5,
              depreciationMethod: 'straight_line' as DepreciationMethod,
              assetSubjectCode: '',
              depreciationSubjectCode: '',
              expenseSubjectCode: '',
              residualRate: 0.05,
            } as CreateFixedAssetAction;
          case 'supplierSubject':
            return { type: 'supplierSubject', groupName: '' } as SupplierSubjectAction;
          case 'reimbursementSubject':
            return { type: 'reimbursementSubject', creditSubjectCode: '', creditSubjectName: '' } as ReimbursementSubjectAction;
          default:
            return a;
        }
      }

      return { ...a, ...updates } as SmartRuleAction;
    });
    setFormActions(updated);
  };

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-slate-500">规则名称 *</Label>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="如：差旅费规则" className="h-8 text-xs mt-1" />
        </div>
        <div>
          <Label className="text-xs text-slate-500">发票类型</Label>
          <Select value={formInvoiceType} onValueChange={(v) => setFormInvoiceType(v as any)}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="input">进项</SelectItem>
              <SelectItem value="output">销项</SelectItem>
              <SelectItem value="both">通用</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500">优先级（数字越大越优先）</Label>
          <Input type="number" value={formPriority} onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)} className="h-8 text-xs mt-1" />
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-slate-600">匹配条件</Label>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addCondition}>
            <Plus className="h-3 w-3 mr-1" /> 添加条件
          </Button>
        </div>
        {formConditions.length === 0 && (
          <p className="text-xs text-slate-400 py-2 text-center">暂无条件，请点击"添加条件"</p>
        )}
        {formConditions.map((cond, idx) => (
          <ConditionRow
            key={idx}
            condition={cond}
            onChange={(updates) => updateCondition(idx, updates)}
            onRemove={() => removeCondition(idx)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-slate-600">执行动作</Label>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addAction}>
            <Plus className="h-3 w-3 mr-1" /> 添加动作
          </Button>
        </div>
        {formActions.length === 0 && (
          <p className="text-xs text-slate-400 py-2 text-center">暂无动作，请点击"添加动作"</p>
        )}
        {formActions.map((action, idx) => (
          <ActionRow
            key={idx}
            action={action}
            onChange={(updates) => updateAction(idx, updates)}
            onRemove={() => removeAction(idx)}
          />
        ))}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={onSave}>保存</Button>
      </div>
    </div>
  );
}

// ─── Condition Row ──────────────────────────────────────────
function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: SmartRuleCondition;
  onChange: (updates: Partial<SmartRuleCondition>) => void;
  onRemove: () => void;
}) {
  const [valuesText, setValuesText] = useState(
    condition.field === 'supplierInList'
      ? (condition as SupplierListCondition).groupName
      : (condition as TextCondition).values?.join(', ') || ''
  );

  const handleFieldChange = (field: string) => {
    setValuesText('');
    onChange({ field: field as any });
  };

  const handleValuesChange = (text: string) => {
    setValuesText(text);
    if (condition.field === 'supplierInList') {
      onChange({ groupName: text } as Partial<SupplierListCondition>);
    } else if (TEXT_FIELDS.includes(condition.field)) {
      const values = text.split(/[,，]/).map(v => v.trim()).filter(Boolean);
      onChange({ values } as Partial<TextCondition>);
    }
  };

  const handleNumericChange = (text: string) => {
    const value = parseFloat(text) || 0;
    onChange({ value } as Partial<NumericCondition>);
  };

  const handleOperatorChange = (op: string) => {
    if (NUMERIC_FIELDS.includes(condition.field)) {
      onChange({ operator: op as NumericCondition['operator'] });
    } else {
      onChange({ operator: op as TextCondition['operator'] });
    }
  };

  const isNumeric = NUMERIC_FIELDS.includes(condition.field);
  const isSupplierList = condition.field === 'supplierInList';

  return (
    <div className="flex items-center gap-2 bg-white rounded border p-2">
      <Select value={condition.field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-32 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CONDITION_FIELD_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isNumeric ? (
        <>
          <Select value={(condition as NumericCondition).operator} onValueChange={handleOperatorChange}>
            <SelectTrigger className="w-16 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NUMERIC_OPERATORS.map(op => (
                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={(condition as NumericCondition).value || 0}
            onChange={(e) => handleNumericChange(e.target.value)}
            className="w-24 h-7 text-xs"
            step={condition.field === 'taxRate' ? '0.01' : '1'}
          />
        </>
      ) : isSupplierList ? (
        <Input
          value={valuesText}
          onChange={(e) => handleValuesChange(e.target.value)}
          placeholder="白名单分组名"
          className="flex-1 h-7 text-xs"
        />
      ) : (
        <>
          <Select value={(condition as TextCondition).operator} onValueChange={handleOperatorChange}>
            <SelectTrigger className="w-16 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_OPERATORS.map(op => (
                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={valuesText}
            onChange={(e) => handleValuesChange(e.target.value)}
            placeholder="关键词（逗号分隔）"
            className="flex-1 h-7 text-xs"
          />
        </>
      )}

      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 shrink-0" onClick={onRemove}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Action Row ─────────────────────────────────────────────
function ActionRow({
  action,
  onChange,
  onRemove,
}: {
  action: SmartRuleAction;
  onChange: (updates: Partial<SmartRuleAction>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white rounded border p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Select value={action.type} onValueChange={(v) => onChange({ type: v as SmartRuleAction['type'] })}>
          <SelectTrigger className="w-36 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 shrink-0" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Action-specific config */}
      <ActionConfig action={action} onChange={onChange} />
    </div>
  );
}

// ─── Action Config ──────────────────────────────────────────
function ActionConfig({
  action,
  onChange,
}: {
  action: SmartRuleAction;
  onChange: (updates: Partial<SmartRuleAction>) => void;
}) {
  switch (action.type) {
    case 'overrideSubject':
      return <OverrideSubjectConfig action={action} onChange={onChange} />;
    case 'assignAuxiliary':
      return <AssignAuxiliaryConfig action={action} onChange={onChange} />;
    case 'markAs':
      return <MarkAsConfig action={action} onChange={onChange} />;
    case 'createFixedAsset':
      return <CreateFixedAssetConfig action={action} onChange={onChange} />;
    case 'supplierSubject':
      return <SupplierSubjectConfig action={action} onChange={onChange} />;
    case 'reimbursementSubject':
      return <ReimbursementSubjectConfig action={action} onChange={onChange} />;
    default:
      return null;
  }
}

function OverrideSubjectConfig({
  action,
  onChange,
}: {
  action: OverrideSubjectAction;
  onChange: (updates: Partial<SmartRuleAction>) => void;
}) {
  const { subjects } = useSubjectStore();

  return (
    <div className="flex items-center gap-2 pl-2">
      <Select value={action.slot} onValueChange={(v) => onChange({ slot: v as 'debit' | 'tax' | 'credit' })}>
        <SelectTrigger className="w-20 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="debit">借方</SelectItem>
          <SelectItem value="tax">税额</SelectItem>
          <SelectItem value="credit">贷方</SelectItem>
        </SelectContent>
      </Select>
      <SubjectPopoverPopup
        code={action.subjectCode}
        name={action.subjectName}
        onSelect={(code, name) => onChange({ subjectCode: code, subjectName: name })}
      />
    </div>
  );
}

function AssignAuxiliaryConfig({
  action,
  onChange,
}: {
  action: AssignAuxiliaryAction;
  onChange: (updates: Partial<SmartRuleAction>) => void;
}) {
  const [nameListText, setNameListText] = useState(action.nameList?.join(', ') || '');

  const handleNameListChange = (text: string) => {
    setNameListText(text);
    const list = text.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    onChange({ nameList: list });
  };

  return (
    <div className="flex items-center gap-2 pl-2">
      <Select value={action.auxiliaryType} onValueChange={(v) => onChange({ auxiliaryType: v as 'employee' | 'project' })}>
        <SelectTrigger className="w-20 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="employee">雇员</SelectItem>
          <SelectItem value="project">项目</SelectItem>
        </SelectContent>
      </Select>
      <Select value={action.sourceField} onValueChange={(v) => onChange({ sourceField: v as 'notes' | 'sellerName' })}>
        <SelectTrigger className="w-24 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="notes">备注字段</SelectItem>
          <SelectItem value="sellerName">销方名称</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={nameListText}
        onChange={(e) => handleNameListChange(e.target.value)}
        placeholder="名称列表（逗号分隔）"
        className="flex-1 h-7 text-xs"
      />
    </div>
  );
}

function MarkAsConfig({
  action,
  onChange,
}: {
  action: MarkAsAction;
  onChange: (updates: Partial<SmartRuleAction>) => void;
}) {
  return (
    <div className="flex items-center gap-2 pl-2">
      <Label className="text-xs text-slate-500">标记为</Label>
      <Select value={action.category} onValueChange={(v) => onChange({ category: v as 'purchase' | 'reimbursement' | 'fixed_asset' })}>
        <SelectTrigger className="w-28 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="purchase">采购</SelectItem>
          <SelectItem value="reimbursement">报销</SelectItem>
          <SelectItem value="fixed_asset">固定资产</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateFixedAssetConfig({
  action,
  onChange,
}: {
  action: CreateFixedAssetAction;
  onChange: (updates: Partial<SmartRuleAction>) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 pl-2">
      <div>
        <Label className="text-xs text-slate-500">资产类别</Label>
        <Input
          value={action.assetCategory}
          onChange={(e) => onChange({ assetCategory: e.target.value })}
          placeholder="如：电子设备"
          className="h-7 text-xs mt-0.5"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-500">折旧年限</Label>
        <Input
          type="number"
          value={action.depreciationYears}
          onChange={(e) => onChange({ depreciationYears: parseInt(e.target.value) || 5 })}
          className="h-7 text-xs mt-0.5"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-500">残值率（%）</Label>
        <Input
          type="number"
          value={(action.residualRate * 100).toFixed(1)}
          onChange={(e) => onChange({ residualRate: parseFloat(e.target.value) / 100 || 0.05 })}
          step="0.1"
          className="h-7 text-xs mt-0.5"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-500">折旧方法</Label>
        <Select value={action.depreciationMethod} onValueChange={(v) => onChange({ depreciationMethod: v as DepreciationMethod })}>
          <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="straight_line">直线法</SelectItem>
            <SelectItem value="double_declining">双倍余额递减法</SelectItem>
            <SelectItem value="sum_of_years">年数总和法</SelectItem>
            <SelectItem value="units_of_production">工作量法</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-slate-500">资产科目</Label>
        <div className="mt-0.5">
          <SubjectPopoverPopup
            code={action.assetSubjectCode}
            name=""
            onSelect={(code, name) => onChange({ assetSubjectCode: code })}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-500">折旧科目</Label>
        <div className="mt-0.5">
          <SubjectPopoverPopup
            code={action.depreciationSubjectCode}
            name=""
            onSelect={(code, name) => onChange({ depreciationSubjectCode: code })}
          />
        </div>
      </div>
    </div>
  );
}

function SupplierSubjectConfig({
  action,
  onChange,
}: {
  action: SupplierSubjectAction;
  onChange: (updates: Partial<SmartRuleAction>) => void;
}) {
  return (
    <div className="flex items-center gap-2 pl-2">
      <Label className="text-xs text-slate-500">供应商分组</Label>
      <Input
        value={action.groupName}
        onChange={(e) => onChange({ groupName: e.target.value })}
        placeholder="白名单分组名称"
        className="flex-1 h-7 text-xs"
      />
    </div>
  );
}

function ReimbursementSubjectConfig({
  action,
  onChange,
}: {
  action: ReimbursementSubjectAction;
  onChange: (updates: Partial<SmartRuleAction>) => void;
}) {
  return (
    <div className="flex items-center gap-2 pl-2">
      <Label className="text-xs text-slate-500">报销贷方科目</Label>
      <SubjectPopoverPopup
        code={action.creditSubjectCode}
        name={action.creditSubjectName}
        onSelect={(code, name) => onChange({ creditSubjectCode: code, creditSubjectName: name })}
      />
    </div>
  );
}

// ─── Subject Popover Popup ──────────────────────────────────
function SubjectPopoverPopup({
  code,
  name,
  onSelect,
}: {
  code: string;
  name: string;
  onSelect: (code: string, name: string) => void;
}) {
  const { subjects } = useSubjectStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredSubjects = subjects.filter(s =>
    s.code.includes(search) || s.name.includes(search)
  ).slice(0, 50);

  if (code && name) {
    return (
      <Badge className="bg-blue-50 text-blue-600 text-xs cursor-pointer" onClick={() => onSelect('', '')}>
        {code} {name}
        <X className="h-3 w-3 ml-1" />
      </Badge>
    );
  }

  if (code) {
    const found = subjects.find(s => s.code === code);
    if (found) {
      return (
        <Badge className="bg-blue-50 text-blue-600 text-xs cursor-pointer" onClick={() => onSelect('', '')}>
          {found.code} {found.name}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      );
    }
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1 px-2 py-1 border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:border-blue-400 hover:text-blue-500"
        onClick={() => setOpen(!open)}
      >
        <Search className="h-3 w-3" />
        选择科目
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-50 w-56 bg-white border rounded-md shadow-lg p-2">
            <Input
              placeholder="搜索科目..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs mb-2"
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto">
              {filteredSubjects.map(s => (
                <button
                  key={s.id}
                  className="w-full text-left px-2 py-1 text-xs hover:bg-slate-100 rounded flex items-center gap-2"
                  onClick={() => {
                    onSelect(s.code, s.name);
                    setOpen(false);
                    setSearch('');
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
  );
}
