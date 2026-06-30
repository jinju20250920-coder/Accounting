'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover } from '@/components/ui/popover';
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
  Download,
  Upload,
  FileText,
  ArrowRight,
  CheckCircle,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { ExpenseListImportDialog } from './expense-list-import-dialog';
import { PurchaseInvoiceRules as NewPurchaseInvoiceRules } from './invoice-rule/purchase-invoice-rules';
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
  SupplierSubjectMapping,
  ExpenseReimbursement,
  AssetCategoryMapping,
  SupplierType,
  PurchaseInvoiceRuleConfig,
} from '@/types';

/** 紧凑科目选择器：Popover + 模糊搜索 + Badge 已选状态 */
function SubjectPopover({
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <form autoComplete="off" onSubmit={e => e.preventDefault()} className="contents" data-form-type="other">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {invoiceType === 'input' ? '采购发票规则设置' : '销售发票规则设置'}
            </DialogTitle>
          </DialogHeader>

          {invoiceType === 'input' ? (
            <PurchaseInvoiceRules open={open} />
          ) : (
            <SalesInvoiceRules />
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 采购发票规则设置 ────────────────────────────────────────
function PurchaseInvoiceRules({ open }: { open: boolean }) {
  return <NewPurchaseInvoiceRules open={open} />;
}


// ─── 销售发票规则设置 ────────────────────────────────────────
function SalesInvoiceRules() {
  const { showToast } = useToast();
  const accountSetId = useAccountSetStore((s) => s.currentAccountSetId);
  const { subjects } = useSubjectStore();

  const [defaultCreditSubject, setDefaultCreditSubject] = useState('6001');
  const [defaultDebitSubject, setDefaultDebitSubject] = useState('1122');
  const [autoCustomerTracking, setAutoCustomerTracking] = useState(true);
  const [autoCustomerCreation, setAutoCustomerCreation] = useState(true);
  const [autoTaxSubject, setAutoTaxSubject] = useState(true);
  const [revenueRules, setRevenueRules] = useState<any[]>([]);
  const [enableProjectTracking, setEnableProjectTracking] = useState(false);
  const [autoExtractInvoiceNo, setAutoExtractInvoiceNo] = useState(true);

  useEffect(() => {
    if (accountSetId) loadData();
  }, [accountSetId]);

  const loadData = async () => {
    try {
      // 加载收入分类规则（模拟）
      setRevenueRules([
        { id: 1, keywords: '*', subject: '6001.01 商品销售收入', taxSubject: '2221.02.01 销项税', notes: '默认' },
        { id: 2, keywords: '咨询, 维护, 服务', subject: '6051.01 服务收入', taxSubject: '2221.02.02 销项税', notes: '劳务类' },
        { id: 3, keywords: '废料, 材料', subject: '6051.99 其他业务收入', taxSubject: '2221.02.01 销项税', notes: '杂项' },
      ]);
    } catch (e) {
      console.error('加载数据失败:', e);
      showToast('error', '加载数据失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 客户核算策略 */}
      <section>
        <h3 className="text-lg font-semibold mb-2">客户核算策略</h3>
        <div className="border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">默认贷方科目</label>
              <Select
                value={defaultCreditSubject}
                onValueChange={setDefaultCreditSubject}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6001">6001 主营业务收入</SelectItem>
                  <SelectItem value="6051">6051 其他业务收入</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">默认借方科目</label>
              <Select
                value={defaultDebitSubject}
                onValueChange={setDefaultDebitSubject}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1122">1122 应收账款</SelectItem>
                  <SelectItem value="1001">1001 库存现金</SelectItem>
                  <SelectItem value="1002">1002 银行存款</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={autoCustomerTracking}
                onCheckedChange={setAutoCustomerTracking}
              />
              <span className="text-sm">自动以 [购货单位名称] 作为应收账款辅助核算项</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={autoCustomerCreation}
                onCheckedChange={setAutoCustomerCreation}
              />
              <span className="text-sm">客户档案自动维护 (系统中无此客户时自动创建)</span>
            </label>
          </div>
        </div>
      </section>

      {/* 销项税自动分流 */}
      <section>
        <h3 className="text-lg font-semibold mb-2">销项税自动分流</h3>
        <div className="border rounded-lg p-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">父级科目</label>
              <Select defaultValue="2221.02">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2221.02">2221.02 销项税额</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={autoTaxSubject}
                onCheckedChange={setAutoTaxSubject}
              />
              <span className="text-sm">动态模式：自动根据 Excel 税率创建并匹配子科目 (如 .13%, .9%, .6%)</span>
            </label>
          </div>
        </div>
      </section>

      {/* 收入分类规则 */}
      <section>
        <h3 className="text-lg font-semibold mb-2">收入分类规则</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 text-left">关键词 (商品名称)</th>
                <th className="p-3 text-left">对应收入科目</th>
                <th className="p-3 text-left">对应税金科目</th>
                <th className="p-3 text-left">备注</th>
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {revenueRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50">
                  <td className="p-3">{rule.keywords}</td>
                  <td className="p-3">{rule.subject}</td>
                  <td className="p-3">{rule.taxSubject}</td>
                  <td className="p-3">{rule.notes}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 bg-slate-50 border-t">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新增收入规则
            </Button>
          </div>
        </div>
      </section>

      {/* 辅助核算策略 */}
      <section>
        <h3 className="text-lg font-semibold mb-2">辅助核算策略</h3>
        <div className="border rounded-lg p-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={enableProjectTracking}
                onCheckedChange={setEnableProjectTracking}
              />
              <span className="text-sm">启用项目核算 (匹配 Excel 中的 [项目名称] 字段)</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={autoExtractInvoiceNo}
                onCheckedChange={setAutoExtractInvoiceNo}
              />
              <span className="text-sm">自动提取 [发票号码] 写入凭证摘要</span>
            </label>
          </div>
        </div>
      </section>

      {/* 保存按钮 */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => {}}>取消</Button>
        <Button type="submit">保存设置</Button>
      </div>
    </div>
  );
}

// ─── 原 StrategyTab 保持 (用于兼容) ────────────────────────────────
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

  // New category
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatKeywords, setNewCatKeywords] = useState('');
  const [newCatSubjectCode, setNewCatSubjectCode] = useState('');
  const [newCatSubjectName, setNewCatSubjectName] = useState('');

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    const keywords = newCatKeywords.split(/[,，]/).map(k => k.trim()).filter(Boolean);
    if (!name) { showToast('error', '请输入分类名称'); return; }
    if (keywords.length === 0) { showToast('error', '请输入至少一个关键词'); return; }
    await saveCategory({
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      accountSetId: accountSetId!,
      category: name,
      keywords,
      expenseSubjectCode: newCatSubjectCode || undefined,
      expenseSubjectName: newCatSubjectName || undefined,
      isSystem: false,
      enabled: true,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    });
    setShowNewCategory(false);
    setNewCatName('');
    setNewCatKeywords('');
    setNewCatSubjectCode('');
    setNewCatSubjectName('');
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
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={strategy.enableSmartRouting ?? true}
            onCheckedChange={(checked) => saveStrategy({ enableSmartRouting: !!checked })}
          />
          <span className="text-sm cursor-pointer">
            智能路由（自动识别费用/供应商/资产）
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={strategy.enableMultiAction ?? true}
            onCheckedChange={(checked) => saveStrategy({ enableMultiAction: !!checked })}
          />
          <span className="text-sm cursor-pointer">
            多动作执行（同时执行科目覆盖、辅助核算、资产生成）
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
                            autoComplete="off"
                            data-1p-ignore
                            data-lpignore="true"
                            data-form-type="other"
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

        {/* Add new category */}
        {showNewCategory ? (
          <div className="border rounded-md bg-slate-50 px-3 py-3 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-500">分类名称</Label>
                <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="h-8 text-xs mt-1" placeholder="如：通讯" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">关键词（逗号分隔）</Label>
                <Input value={newCatKeywords} onChange={(e) => setNewCatKeywords(e.target.value)} className="h-8 text-xs mt-1" placeholder="话费,通讯,流量" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">费用科目</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Input value={newCatSubjectCode} onChange={(e) => { setNewCatSubjectCode(e.target.value); const f = subjects.find(s => s.code === e.target.value); setNewCatSubjectName(f ? f.name : ''); }} className="w-28 h-8 text-xs" placeholder="科目代码" autoComplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
                  <span className="text-xs text-slate-500 truncate max-w-[100px]">{newCatSubjectName}</span>
                  <SubjectPopoverPopup code={newCatSubjectCode} name={newCatSubjectName} onSelect={(code, name) => { setNewCatSubjectCode(code); setNewCatSubjectName(name); }} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowNewCategory(false); setNewCatName(''); setNewCatKeywords(''); }}>取消</Button>
              <Button size="sm" onClick={handleAddCategory}>保存</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowNewCategory(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> 新增分类
          </Button>
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

// ─── Subject Popover Popup (Portal + Auto Placement) ─────────
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');

  // Common accounts shown first
  const PRIORITY_CODES = ['2202', '1403', '1405', '1501', '2221', '222101', '6602', '1002'];
  const filteredSubjects = subjects
    .filter(s => s.code.includes(search) || s.name.includes(search))
    .sort((a, b) => {
      const ai = PRIORITY_CODES.indexOf(a.code);
      const bi = PRIORITY_CODES.indexOf(b.code);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    })
    .slice(0, 50);

  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const panelHeight = 280;
    const goTop = spaceBelow < panelHeight && spaceAbove > spaceBelow;
    setPlacement(goTop ? 'top' : 'bottom');
    setPanelStyle(goTop
      ? { position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: Math.max(rect.width, 240), zIndex: 9999 }
      : { position: 'fixed', top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240), zIndex: 9999 }
    );
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- positioning side-effect on open; reposition reads layout from refs */
  useEffect(() => {
    if (open) {
      reposition();
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      return () => {
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
      };
    }
  }, [open, reposition]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (code && name) {
    return (
      <Badge className="bg-blue-50 text-blue-700 text-[11px] rounded-full px-2 py-0.5 cursor-pointer hover:bg-blue-100 transition-colors leading-tight" onClick={() => onSelect('', '')}>
        {code} {name}
        <X className="h-2.5 w-2.5 ml-1 opacity-60" />
      </Badge>
    );
  }

  if (code) {
    const found = subjects.find(s => s.code === code);
    if (found) {
      return (
        <Badge className="bg-blue-50 text-blue-700 text-[11px] rounded-full px-2 py-0.5 cursor-pointer hover:bg-blue-100 transition-colors leading-tight" onClick={() => onSelect('', '')}>
          {found.code} {found.name}
          <X className="h-2.5 w-2.5 ml-1 opacity-60" />
        </Badge>
      );
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="flex items-center gap-1 px-2 py-1 border border-dashed border-slate-300 rounded-md text-[11px] text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
        onClick={() => { setOpen(!open); setSearch(''); }}
      >
        <Search className="h-3 w-3" />
        选择科目
      </button>
      {open && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => { setOpen(false); setSearch(''); }} />
          <div
            ref={panelRef}
            style={panelStyle}
            className="bg-white border border-slate-200 rounded-lg shadow-xl"
          >
            <div className="p-2 border-b border-slate-100">
              <Input
                placeholder="搜索科目代码或名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs focus-visible:ring-blue-400 focus-visible:ring-2"
                autoFocus
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
              />
            </div>
            <div className="max-h-60 overflow-y-auto overscroll-contain py-1">
              {filteredSubjects.map(s => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors flex items-center gap-2"
                  onClick={() => {
                    onSelect(s.code, s.name);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <span className="font-mono text-blue-600 shrink-0">{s.code}</span>
                  <span className="truncate text-slate-700">{s.name}</span>
                </button>
              ))}
              {filteredSubjects.length === 0 && (
                <div className="text-xs text-slate-400 py-4 text-center">无匹配科目</div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// ─── Tab 2: Supplier Mapping ──────────────────────────────────
const SUPPLIER_TYPE_OPTIONS: { value: SupplierType; label: string }[] = [
  { value: 'material', label: '原材料' },
  { value: 'inventory', label: '库存商品' },
  { value: 'fixed_asset', label: '固定资产' },
  { value: 'service', label: '服务' },
  { value: 'other', label: '其他' },
];

const SUPPLIER_TYPE_DEFAULTS: Record<SupplierType, {
  debitCode: string; debitName: string;
  taxCode: string; taxName: string;
  creditCode: string; creditName: string;
}> = {
  material: { debitCode: '1401', debitName: '材料采购', taxCode: '2221.01', taxName: '进项税额', creditCode: '2202', creditName: '应付账款' },
  inventory: { debitCode: '1402', debitName: '库存商品', taxCode: '2221.01', taxName: '进项税额', creditCode: '2202', creditName: '应付账款' },
  fixed_asset: { debitCode: '1601', debitName: '固定资产', taxCode: '2221.01', taxName: '进项税额', creditCode: '2202', creditName: '应付账款' },
  service: { debitCode: '6602', debitName: '管理费用', taxCode: '2221.02', taxName: '进项税额-6%', creditCode: '2202', creditName: '应付账款' },
  other: { debitCode: '', debitName: '', taxCode: '', taxName: '', creditCode: '', creditName: '' },
};

function SupplierMappingTab() {
  const { showToast } = useToast();
  const accountSetId = useAccountSetStore((s) => s.currentAccountSetId);

  const [allMappings, setAllMappings] = useState<SupplierSubjectMapping[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingRow, setAddingRow] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [existingSellers, setExistingSellers] = useState<string[]>([]);
  const [editForm, setEditForm] = useState<{
    sellerName: string;
    supplierType: SupplierType;
    debitCode: string; debitName: string;
    taxCode: string; taxName: string;
    creditCode: string; creditName: string;
  }>({
    sellerName: '', supplierType: 'material',
    debitCode: '', debitName: '',
    taxCode: '', taxName: '',
    creditCode: '', creditName: '',
  });

  useEffect(() => {
    if (accountSetId) loadMappings();
  }, [accountSetId]);

  const loadMappings = async () => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      const data = await sqliteService.getSupplierMappings();
      setAllMappings(data);
      const groups = [...new Set(data.map(m => m.groupName))];
      if (groups.length > 0 && !selectedGroup) {
        setSelectedGroup(groups[0]);
      }
      // Load existing seller names from invoice store for autocomplete
      const invoices = useInvoiceStore.getState().invoices;
      const sellers = [...new Set(invoices.map(inv => inv.sellerName).filter(Boolean))].sort();
      setExistingSellers(sellers);
    } catch (e) {
      console.error('加载供应商映射失败:', e);
    }
  };

  const groups = [...new Set(allMappings.map(m => m.groupName))].sort();
  const currentMappings = allMappings
    .filter(m => m.groupName === selectedGroup && m.sellerName !== '__placeholder__')
    .filter(m => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return m.sellerName.toLowerCase().includes(q);
    });

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      showToast('error', '请输入分组名称');
      return;
    }
    if (groups.includes(name)) {
      showToast('error', '该分组已存在');
      return;
    }
    // Persist a placeholder entry so the group survives reload
    const now = new Date().toISOString();
    const placeholder: SupplierSubjectMapping = {
      id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      accountSetId: accountSetId!,
      groupName: name,
      sellerName: `__placeholder__`,
      createTime: now,
      updateTime: now,
    };
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveSupplierMapping(placeholder);
      await loadMappings();
    } catch (e) {
      console.error('创建分组失败:', e);
    }
    setSelectedGroup(name);
    setNewGroupName('');
    setShowNewGroupInput(false);
    showToast('success', `分组"${name}"已创建，请添加供应商`);
  };

  const handleDeleteGroup = async () => {
    if (currentMappings.length > 0) {
      showToast('error', '该分组下还有供应商，请先删除所有供应商');
      return;
    }
    try {
      sqliteService.setAccountSetId(accountSetId!);
      // Delete placeholder and any remaining entries for this group
      const groupEntries = allMappings.filter(m => m.groupName === selectedGroup);
      for (const entry of groupEntries) {
        await sqliteService.deleteSupplierMapping(entry.id);
      }
      await loadMappings();
      setSelectedGroup(groups.find(g => g !== selectedGroup) || '');
      showToast('success', '分组已删除');
    } catch (e) {
      showToast('error', '删除分组失败');
    }
  };

  const resetEditForm = () => {
    setEditForm({
      sellerName: '', supplierType: 'material',
      debitCode: '', debitName: '',
      taxCode: '', taxName: '',
      creditCode: '', creditName: '',
    });
  };

  const handleTypeChange = (type: SupplierType) => {
    const defaults = SUPPLIER_TYPE_DEFAULTS[type];
    setEditForm(prev => ({
      ...prev,
      supplierType: type,
      debitCode: prev.debitCode || defaults.debitCode,
      debitName: prev.debitName || defaults.debitName,
      taxCode: prev.taxCode || defaults.taxCode,
      taxName: prev.taxName || defaults.taxName,
      creditCode: prev.creditCode || defaults.creditCode,
      creditName: prev.creditName || defaults.creditName,
    }));
  };

  const startAddSupplier = () => {
    resetEditForm();
    const defaults = SUPPLIER_TYPE_DEFAULTS['material'];
    setEditForm({
      sellerName: '', supplierType: 'material',
      debitCode: defaults.debitCode, debitName: defaults.debitName,
      taxCode: defaults.taxCode, taxName: defaults.taxName,
      creditCode: defaults.creditCode, creditName: defaults.creditName,
    });
    setAddingRow(true);
  };

  const handleSaveNew = async () => {
    if (!selectedGroup) {
      showToast('error', '请先选择或创建分组');
      return;
    }
    if (!editForm.sellerName.trim()) {
      showToast('error', '请输入供应商名称');
      return;
    }
    const now = new Date().toISOString();
    const mapping: SupplierSubjectMapping = {
      id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      accountSetId: accountSetId!,
      groupName: selectedGroup,
      sellerName: editForm.sellerName.trim(),
      defaultDebitSubject: editForm.debitCode || undefined,
      defaultDebitSubjectName: editForm.debitName || undefined,
      defaultTaxSubject: editForm.taxCode || undefined,
      defaultTaxSubjectName: editForm.taxName || undefined,
      defaultCreditSubject: editForm.creditCode || undefined,
      defaultCreditSubjectName: editForm.creditName || undefined,
      createTime: now,
      updateTime: now,
    };
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveSupplierMapping(mapping);
      await loadMappings();
      setAddingRow(false);
      resetEditForm();
      showToast('success', '供应商已添加');
    } catch (e) {
      showToast('error', '保存失败: ' + e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.deleteSupplierMapping(id);
      await loadMappings();
      showToast('success', '供应商已删除');
    } catch (e) {
      showToast('error', '删除失败');
    }
  };

  const handleBatchImport = async () => {
    if (!selectedGroup) {
      showToast('error', '请先选择或创建分组');
      return;
    }
    const names = batchText.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) {
      showToast('error', '请输入供应商名称');
      return;
    }
    const now = new Date().toISOString();
    const defaults = SUPPLIER_TYPE_DEFAULTS['material'];
    try {
      sqliteService.setAccountSetId(accountSetId!);
      for (const sellerName of names) {
        const mapping: SupplierSubjectMapping = {
          id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          accountSetId: accountSetId!,
          groupName: selectedGroup,
          sellerName,
          defaultDebitSubject: defaults.debitCode || undefined,
          defaultDebitSubjectName: defaults.debitName || undefined,
          defaultTaxSubject: defaults.taxCode || undefined,
          defaultTaxSubjectName: defaults.taxName || undefined,
          defaultCreditSubject: defaults.creditCode || undefined,
          defaultCreditSubjectName: defaults.creditName || undefined,
          createTime: now,
          updateTime: now,
        };
        await sqliteService.saveSupplierMapping(mapping);
      }
      await loadMappings();
      setBatchImportOpen(false);
      setBatchText('');
      showToast('success', `已导入 ${names.length} 个供应商`);
    } catch (e) {
      showToast('error', '批量导入失败: ' + e);
    }
  };

  return (
    <div className="space-y-3">
      {/* Helper text */}
      <p className="text-[11px] text-slate-400 leading-relaxed">
        配置供应商与科目的映射关系，发票匹配时将自动生成对应分录。供应商名称来源于已导入的进项发票销方。
      </p>

      {/* Toolbar: group selector + search + actions, one line */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="选择分组" />
          </SelectTrigger>
          <SelectContent>
            {groups.map(g => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!showNewGroupInput ? (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowNewGroupInput(true)}>
            <Plus className="h-3 w-3 mr-1" /> 新建组
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="组名" className="w-28 h-7 text-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()} />
            <Button size="sm" className="h-7 text-xs px-2" onClick={handleCreateGroup}>确定</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }}>取消</Button>
          </div>
        )}

        {selectedGroup && currentMappings.length === 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-700" onClick={handleDeleteGroup}>
            <Trash2 className="h-3 w-3 mr-1" /> 删除组
          </Button>
        )}

        <div className="flex-1" />

        {selectedGroup && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            <Input
              placeholder="搜索供应商..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-8 text-xs w-44 focus-visible:ring-blue-400 focus-visible:ring-2"
            />
          </div>
        )}
      </div>

      {selectedGroup ? (
        <>
          {/* Supplier table */}
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 w-44">供应商名称</th>
                  <th className="px-2 py-2.5 w-6"></th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 w-28">类型</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">借方科目</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">税科目</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">贷方科目</th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentMappings.map((m) => (
                  <SupplierRow key={m.id} mapping={m} onDelete={() => handleDelete(m.id)} />
                ))}
                {currentMappings.length === 0 && !addingRow && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                      该分组暂无供应商，点击下方按钮添加
                    </td>
                  </tr>
                )}
                {addingRow && (
                  <tr className="bg-blue-50/40">
                    <td className="px-4 py-3">
                      <div className="relative">
                        <Input
                          value={editForm.sellerName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, sellerName: e.target.value }))}
                          placeholder="选择或输入供应商"
                          className="h-7 text-xs focus-visible:ring-blue-400 focus-visible:ring-2"
                          autoFocus
                          list="seller-suggestions"
                        />
                        <datalist id="seller-suggestions">
                          {existingSellers
                            .filter(s => !editForm.sellerName || s.toLowerCase().includes(editForm.sellerName.toLowerCase()))
                            .slice(0, 20)
                            .map(s => <option key={s} value={s} />)}
                        </datalist>
                      </div>
                    </td>
                    <td className="px-2 py-3"><ArrowRight className="h-3 w-3 text-slate-300" /></td>
                    <td className="px-4 py-3">
                      <Select value={editForm.supplierType} onValueChange={(v) => handleTypeChange(v as SupplierType)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUPPLIER_TYPE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <SubjectPopoverPopup code={editForm.debitCode} name={editForm.debitName} onSelect={(code, name) => setEditForm(prev => ({ ...prev, debitCode: code, debitName: name }))} />
                    </td>
                    <td className="px-4 py-3">
                      <SubjectPopoverPopup code={editForm.taxCode} name={editForm.taxName} onSelect={(code, name) => setEditForm(prev => ({ ...prev, taxCode: code, taxName: name }))} />
                    </td>
                    <td className="px-4 py-3">
                      <SubjectPopoverPopup code={editForm.creditCode} name={editForm.creditName} onSelect={(code, name) => setEditForm(prev => ({ ...prev, creditCode: code, creditName: name }))} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" onClick={handleSaveNew}><Plus className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400" onClick={() => { setAddingRow(false); resetEditForm(); }}><X className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add buttons */}
          {!addingRow && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={startAddSupplier} className="flex-1 h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> 添加供应商
              </Button>
              <Button variant="outline" onClick={() => setBatchImportOpen(true)} className="h-8 text-xs">
                <FileText className="h-3.5 w-3.5 mr-1" /> 批量导入
              </Button>
            </div>
          )}

          {/* Batch import dialog */}
          {batchImportOpen && (
            <div className="border rounded-md p-3 space-y-2 bg-slate-50">
              <Label className="text-xs font-medium">批量导入供应商</Label>
              <p className="text-[11px] text-slate-400">每行一个供应商名称，使用默认类型和科目。</p>
              <Textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} placeholder={"供应商A\n供应商B\n供应商C"} rows={5} className="text-xs" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setBatchImportOpen(false); setBatchText(''); }}>取消</Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleBatchImport}>导入 ({batchText.split('\n').filter(n => n.trim()).length})</Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-sm text-slate-400 py-8">
          请先创建或选择一个供应商分组
        </div>
      )}
    </div>
  );
}

function SupplierRow({ mapping, onDelete }: { mapping: SupplierSubjectMapping; onDelete: () => void }) {
  const typeLabel = mapping.groupName;

  return (
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-4 py-3 text-sm font-medium">{mapping.sellerName}</td>
      <td className="px-2 py-3"><ArrowRight className="h-3 w-3 text-slate-300" /></td>
      <td className="px-4 py-3">
        <Badge className="bg-slate-100 text-slate-600 text-[11px] rounded-full">{typeLabel}</Badge>
      </td>
      <td className="px-4 py-3">
        {mapping.defaultDebitSubject ? (
          <Badge className="bg-blue-50 text-blue-700 text-[11px] rounded-full px-2 py-0.5">{mapping.defaultDebitSubject} {mapping.defaultDebitSubjectName}</Badge>
        ) : <span className="text-[11px] text-slate-300">-</span>}
      </td>
      <td className="px-4 py-3">
        {mapping.defaultTaxSubject ? (
          <Badge className="bg-blue-50 text-blue-700 text-[11px] rounded-full px-2 py-0.5">{mapping.defaultTaxSubject} {mapping.defaultTaxSubjectName}</Badge>
        ) : <span className="text-[11px] text-slate-300">-</span>}
      </td>
      <td className="px-4 py-3">
        {mapping.defaultCreditSubject ? (
          <Badge className="bg-blue-50 text-blue-700 text-[11px] rounded-full px-2 py-0.5">{mapping.defaultCreditSubject} {mapping.defaultCreditSubjectName}</Badge>
        ) : <span className="text-[11px] text-slate-300">-</span>}
      </td>
      <td className="px-3 py-3">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

// ─── Tab 3: Asset Category Mapping ────────────────────────────
const DEPRECIATION_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'straight_line', label: '直线法' },
  { value: 'double_declining', label: '双倍余额递减法' },
  { value: 'sum_of_years', label: '年数总和法' },
  { value: 'units_of_production', label: '工作量法' },
];

function AssetCategoryTab() {
  const { showToast } = useToast();
  const accountSetId = useAccountSetStore((s) => s.currentAccountSetId);

  const [mappings, setMappings] = useState<AssetCategoryMapping[]>([]);
  const [addingRow, setAddingRow] = useState(false);
  const [newForm, setNewForm] = useState({
    assetCategory: '',
    depreciationYears: 5,
    depreciationMethod: 'straight_line' as string,
    keywords: '',
    residualRate: 5,
  });

  useEffect(() => {
    if (accountSetId) loadMappings();
  }, [accountSetId]);

  const loadMappings = async () => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      const data = await sqliteService.getAssetCategoryMappings();
      setMappings(data);
    } catch (e) {
      console.error('加载资产类别映射失败:', e);
    }
  };

  const handleSaveNew = async () => {
    if (!newForm.assetCategory.trim()) {
      showToast('error', '请输入资产类别名称');
      return;
    }
    const now = new Date().toISOString();
    const mapping: AssetCategoryMapping = {
      id: `acm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      accountSetId: accountSetId!,
      assetCategory: newForm.assetCategory.trim(),
      depreciationYears: newForm.depreciationYears,
      depreciationMethod: newForm.depreciationMethod,
      keywords: newForm.keywords.split(/[,，]/).map(k => k.trim()).filter(Boolean),
      subjectCode: '',
      residualRate: (newForm.residualRate || 5) / 100,
      isSystem: false,
      createTime: now,
      updateTime: now,
    };
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveAssetCategoryMapping(mapping);
      await loadMappings();
      setAddingRow(false);
      setNewForm({ assetCategory: '', depreciationYears: 5, depreciationMethod: 'straight_line', keywords: '', residualRate: 5 });
      showToast('success', '资产类别已添加');
    } catch (e) {
      showToast('error', '保存失败: ' + e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.deleteAssetCategoryMapping(id);
      await loadMappings();
      showToast('success', '资产类别已删除');
    } catch (e) {
      showToast('error', '删除失败');
    }
  };

  const handleUpdateField = async (mapping: AssetCategoryMapping, field: string, value: any) => {
    const updated = { ...mapping, [field]: value, updateTime: new Date().toISOString() };
    if (field === 'keywords' && typeof value === 'string') {
      updated.keywords = (value as string).split(/[,，]/).map(k => k.trim()).filter(Boolean);
    }
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.saveAssetCategoryMapping(updated);
      await loadMappings();
    } catch (e) {
      showToast('error', '更新失败');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">配置资产类别的折旧参数和识别关键词。导入发票时，系统会根据关键词自动匹配资产类别。</p>

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">资产类别</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-24">折旧年限(年)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-36">折旧方法</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">关键词</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-24">残值率(%)</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mappings.map(m => (
              <AssetRow key={m.id} mapping={m} onUpdate={handleUpdateField} onDelete={() => handleDelete(m.id)} />
            ))}
            {mappings.length === 0 && !addingRow && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                  暂无资产类别，点击下方按钮添加
                </td>
              </tr>
            )}
            {addingRow && (
              <tr className="bg-blue-50/50">
                <td className="px-3 py-2">
                  <Input
                    value={newForm.assetCategory}
                    onChange={(e) => setNewForm(prev => ({ ...prev, assetCategory: e.target.value }))}
                    placeholder="如：电子设备"
                    className="h-7 text-xs"
                    autoFocus
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={newForm.depreciationYears}
                    onChange={(e) => setNewForm(prev => ({ ...prev, depreciationYears: parseInt(e.target.value) || 5 }))}
                    className="h-7 text-xs w-20"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select value={newForm.depreciationMethod} onValueChange={(v) => setNewForm(prev => ({ ...prev, depreciationMethod: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPRECIATION_METHOD_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={newForm.keywords}
                    onChange={(e) => setNewForm(prev => ({ ...prev, keywords: e.target.value }))}
                    placeholder="关键词（逗号分隔）"
                    className="h-7 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={newForm.residualRate}
                    onChange={(e) => setNewForm(prev => ({ ...prev, residualRate: parseFloat(e.target.value) || 5 }))}
                    step="0.1"
                    className="h-7 text-xs w-20"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" onClick={handleSaveNew}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400" onClick={() => { setAddingRow(false); setNewForm({ assetCategory: '', depreciationYears: 5, depreciationMethod: 'straight_line', keywords: '', residualRate: 5 }); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      {!addingRow && (
        <Button variant="outline" onClick={() => setAddingRow(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> 添加资产类别
        </Button>
      )}
    </div>
  );
}

function AssetRow({ mapping, onUpdate, onDelete }: {
  mapping: AssetCategoryMapping;
  onUpdate: (m: AssetCategoryMapping, field: string, value: any) => void;
  onDelete: () => void;
}) {
  const [editingKeywords, setEditingKeywords] = useState(false);
  const [keywordsText, setKeywordsText] = useState(mapping.keywords.join(', '));

  const handleKeywordsSave = () => {
    onUpdate(mapping, 'keywords', keywordsText);
    setEditingKeywords(false);
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge className={mapping.isSystem
            ? 'bg-purple-50 text-purple-600 text-xs shrink-0'
            : 'bg-blue-50 text-blue-600 text-xs shrink-0'
          }>
            {mapping.isSystem ? '系统' : '自定义'}
          </Badge>
          <span className="text-sm">{mapping.assetCategory}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          value={mapping.depreciationYears}
          onChange={(e) => onUpdate(mapping, 'depreciationYears', parseInt(e.target.value) || 5)}
          className="h-7 text-xs w-20"
        />
      </td>
      <td className="px-3 py-2">
        <Select
          value={mapping.depreciationMethod || 'straight_line'}
          onValueChange={(v) => onUpdate(mapping, 'depreciationMethod', v)}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEPRECIATION_METHOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        {editingKeywords ? (
          <div className="flex items-center gap-1">
            <Input
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              className="h-7 text-xs flex-1"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleKeywordsSave()}
              onBlur={handleKeywordsSave}
            />
          </div>
        ) : (
          <span
            className="text-xs text-slate-600 cursor-pointer hover:text-blue-600 hover:underline"
            onClick={() => { setEditingKeywords(true); setKeywordsText(mapping.keywords.join(', ')); }}
            title="点击编辑关键词"
          >
            {mapping.keywords.length > 0 ? mapping.keywords.join('、') : '(点击添加关键词)'}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          value={((mapping.residualRate || 0.05) * 100).toFixed(1)}
          onChange={(e) => onUpdate(mapping, 'residualRate', parseFloat(e.target.value) / 100 || 0.05)}
          step="0.1"
          className="h-7 text-xs w-20"
        />
      </td>
      <td className="px-3 py-2">
        {mapping.isSystem ? (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-300 cursor-not-allowed" onClick={() => {}}>
            <Trash2 className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </td>
    </tr>
  );
}
