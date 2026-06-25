// src/components/invoice-rule/purchase-invoice-rules.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Drawer, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover } from '@/components/ui/popover';
import { Settings2, Plus, Trash2, Edit2, Search, Info, ChevronDown, ChevronUp, GripVertical, ArrowUp, ArrowDown, Check, X, Zap, Shield, UserCheck } from 'lucide-react';
import { BusinessGroupEditor } from './components/business-group-drawer';
import { RuleConflictDetector } from './utils/rule-conflict-detector';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useToast } from '@/components/ui/toast';
import type { SupplierSubjectMapping } from '@/types';

interface BusinessGroup {
  id: string;
  name: string;
  debitSubject: string;
  taxSubject: string;
  taxSubjectName?: string;
  creditSubject: string;
  partnerType: string;
  assetThreshold: number;
  priority: number;
  description?: string;
  isPreset?: boolean;
  autoTax?: boolean;
  keywords?: string[];
  debitSubjectName?: string;
  creditSubjectName?: string;
  requirePartnerCard?: boolean;
}

interface KeywordRule {
  id: string;
  keywords: string;
  businessGroup: string;
  threshold: number;
}

interface GlobalSettings {
  assetThreshold: number;
  autoTaxSubject: boolean;
  autoCheckDuplicate: boolean;
  autoRecognizeReimburser: boolean;
}

interface PurchaseInvoiceRuleConfig {
  id: string;
  accountSetId: string;
  businessGroups: BusinessGroup[];
  keywordRules: KeywordRule[];
  globalSettings: GlobalSettings;
  updateTime: string;
}

interface PurchaseInvoiceRulesProps {
  open: boolean;
}

// 往来单位下拉选择器
function PartnerPopover({
  value,
  onChange,
  placeholder,
  filterSupplier,
}: {
  value: string;
  onChange: (name: string) => void;
  placeholder: string;
  filterSupplier?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const partners = usePartnerStore((s) => s.partners);

  const filteredPartners = useMemo(() => {
    const q = search.toLowerCase();
    return partners
      .filter((p) => !filterSupplier || p.isSupplier)
      .filter((p) => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [partners, search, filterSupplier]);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      content={
        <div className="w-56 bg-white border border-slate-200/80 rounded-lg shadow-xl">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索往来单位..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-slate-50"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {filteredPartners.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">无匹配往来单位</div>
            ) : (
              filteredPartners.map((p) => (
                <button
                  key={p.id}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-blue-50 flex items-center gap-2 ${
                    p.name === value ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                  onClick={() => {
                    onChange(p.name);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <span className="flex-1">{p.name}</span>
                  {p.isSupplier && <Badge variant="outline" className="text-xs px-1 py-0">供应商</Badge>}
                  {p.isCustomer && <Badge variant="outline" className="text-xs px-1 py-0">客户</Badge>}
                  {p.name === value && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      }
    >
      <button
        className={`h-8 w-full text-sm rounded-md px-3 text-left flex items-center gap-2 transition-colors ${
          value
            ? 'bg-slate-50 text-slate-800 border border-slate-200'
            : 'border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
        }`}
        onClick={() => setOpen(!open)}
      >
        {value ? (
          <>
            <span className="flex-1 truncate">{value}</span>
            <X
              className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setOpen(false);
              }}
            />
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span>{placeholder}</span>
          </>
        )}
      </button>
    </Popover>
  );
}

export function PurchaseInvoiceRules({ open }: PurchaseInvoiceRulesProps) {
  const [config, setConfig] = useState<PurchaseInvoiceRuleConfig>({
    id: '',
    accountSetId: '',
    businessGroups: [],
    keywordRules: [],
    globalSettings: {
      assetThreshold: 5000,
      autoTaxSubject: true,
      autoCheckDuplicate: true,
      autoRecognizeReimburser: true,
    },
    updateTime: new Date().toISOString(),
  });
  const [configLoaded, setConfigLoaded] = useState(false);

  const [editingGroup, setEditingGroup] = useState<BusinessGroup | null>(null);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [editingRule, setEditingRule] = useState<KeywordRule | null>(null);
  const [showKeywordEditor, setShowKeywordEditor] = useState(false);
  const [keywordForm, setKeywordForm] = useState({
    keywords: '',
    businessGroup: 'inventory',
    threshold: 0,
  });

  // 供应商白名单相关状态
  const [supplierMappings, setSupplierMappings] = useState<SupplierSubjectMapping[]>([]);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierForm, setSupplierForm] = useState({
    groupName: '',
    sellerName: '',
  });
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  // 从数据库加载配置
  useEffect(() => {
    if (!open) return;
    loadConfig();
  }, [open]);

  const loadConfig = async () => {
    try {
      const saved = await sqliteService.getPurchaseInvoiceRuleConfig();
      // 映射数据库类型到本地类型（补充可选字段的默认值）
      const mapped: PurchaseInvoiceRuleConfig = {
        ...saved,
        businessGroups: saved.businessGroups.map(g => ({
          assetThreshold: 0,
          priority: 0,
          ...g,
        })),
      };
      setConfig(mapped);
      setConfigLoaded(true);
    } catch (error) {
      console.error('加载采购发票规则配置失败:', error);
    }
  };

  // 保存配置到数据库
  const saveConfig = async (newConfig: PurchaseInvoiceRuleConfig) => {
    setConfig(newConfig);
    try {
      await sqliteService.savePurchaseInvoiceRuleConfig({
        ...newConfig,
        updateTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('保存采购发票规则配置失败:', error);
    }
  };

  // 检测规则冲突
  useEffect(() => {
    if (!configLoaded) return;
    const detectedConflicts = RuleConflictDetector.detectKeywordOverlaps(
      config.keywordRules,
      config.businessGroups
    );
    setConflicts(detectedConflicts);
  }, [config, configLoaded]);

  // 加载供应商白名单数据
  useEffect(() => {
    if (!open) return;
    loadSupplierMappings();
  }, [open]);

  const loadSupplierMappings = async () => {
    try {
      const mappings = await sqliteService.getSupplierMappings();
      setSupplierMappings(mappings);
    } catch (error) {
      console.error('加载供应商白名单失败:', error);
    }
  };

  // 保存新业务组或更新
  const handleSaveNewGroup = (group: any) => {
    if (editingGroup) {
      // 更新模式
      const newConfig = {
        ...config,
        businessGroups: config.businessGroups.map(g =>
          g.id === editingGroup.id
            ? {
                ...g,
                name: group.name.trim(),
                debitSubject: group.debitSubject,
                debitSubjectName: group.debitSubjectName,
                taxSubject: group.taxSubject,
                creditSubject: group.creditSubject,
                creditSubjectName: group.creditSubjectName,
                partnerType: group.partnerType,
                assetThreshold: group.assetThreshold,
                description: group.description,
                autoTax: group.autoTax,
                requirePartnerCard: group.requirePartnerCard,
                keywords: group.keywords,
              }
            : g
        ),
      };
      saveConfig(newConfig);
    } else {
      // 新增模式
      const newGroup: BusinessGroup = {
        id: `custom_${Date.now()}`,
        name: group.name.trim(),
        debitSubject: group.debitSubject,
        debitSubjectName: group.debitSubjectName,
        taxSubject: group.taxSubject,
        creditSubject: group.creditSubject,
        creditSubjectName: group.creditSubjectName,
        partnerType: group.partnerType,
        assetThreshold: group.assetThreshold,
        priority: 50,
        description: group.description,
        isPreset: false,
        autoTax: group.autoTax,
        requirePartnerCard: group.requirePartnerCard,
        keywords: group.keywords || [],
      };

      saveConfig({
        ...config,
        businessGroups: [...config.businessGroups, newGroup],
      });
    }
  };

  // 编辑业务组
  const handleEditBusinessGroup = (group: BusinessGroup) => {
    setEditingGroup(group);
    setShowGroupEditor(true);
  };

  // 删除业务组
  const handleDeleteBusinessGroup = (groupId: string) => {
    saveConfig({
      ...config,
      businessGroups: config.businessGroups.filter(g => g.id !== groupId),
    });
  };

  // 处理关键词规则编辑
  const handleEditKeywordRule = (rule: KeywordRule) => {
    setEditingRule(rule);
    setKeywordForm({
      keywords: rule.keywords,
      businessGroup: rule.businessGroup,
      threshold: rule.threshold,
    });
    setShowKeywordEditor(true);
  };

  // 处理关键词规则删除
  const handleDeleteKeywordRule = (ruleId: string) => {
    saveConfig({
      ...config,
      keywordRules: config.keywordRules.filter(r => r.id !== ruleId),
    });
  };

  // 处理关键词规则保存
  const handleSaveKeywordRule = () => {
    if (editingRule) {
      // 更新模式
      saveConfig({
        ...config,
        keywordRules: config.keywordRules.map(r =>
          r.id === editingRule.id
            ? {
                ...r,
                keywords: keywordForm.keywords,
                businessGroup: keywordForm.businessGroup,
                threshold: keywordForm.threshold,
              }
            : r
        ),
      });
    } else {
      // 新增模式
      const newRule = {
        id: Date.now().toString(),
        keywords: keywordForm.keywords,
        businessGroup: keywordForm.businessGroup,
        threshold: keywordForm.threshold,
      };
      saveConfig({
        ...config,
        keywordRules: [...config.keywordRules, newRule],
      });
    }
    setShowKeywordEditor(false);
    setEditingRule(null);
  };

  // 处理新增关键词规则
  const handleAddKeywordRule = () => {
    setEditingRule(null);
    setKeywordForm({
      keywords: '',
      businessGroup: 'inventory',
      threshold: 0,
    });
    setShowKeywordEditor(true);
  };

  // 更新业务组优先级
  const updateGroupPriority = (groupId: string, change: number) => {
    saveConfig({
      ...config,
      businessGroups: config.businessGroups.map(group =>
        group.id === groupId ? { ...group, priority: (group.priority || 0) + change } : group
      ),
    });
  };

  // 处理新增供应商（内联表格模式）
  const handleAddSupplierMapping = () => {
    setIsAddingSupplier(true);
    setSupplierForm({
      groupName: config.businessGroups[0]?.name || '',
      sellerName: '',
    });
    setEditingSupplierId(null);
  };

  // 处理编辑供应商（内联表格模式）
  const handleEditSupplierMapping = (mapping: SupplierSubjectMapping) => {
    setEditingSupplierId(mapping.id);
    setSupplierForm({
      groupName: mapping.groupName,
      sellerName: mapping.sellerName,
    });
    setIsAddingSupplier(false);
  };

  // 处理删除供应商白名单
  const handleDeleteSupplierMapping = async (id: string) => {
    try {
      await sqliteService.deleteSupplierMapping(id);
      await loadSupplierMappings();
    } catch (error) {
      console.error('删除供应商白名单失败:', error);
    }
  };

  // 内联保存供应商白名单
  const handleSaveSupplierMappingInline = async (id: string) => {
    if (!supplierForm.sellerName.trim() || !supplierForm.groupName.trim()) return;
    // 检查重复（排除自身）
    const duplicate = supplierMappings.find(m => m.sellerName === supplierForm.sellerName.trim() && m.id !== id);
    if (duplicate) {
      console.warn(`供应商"${supplierForm.sellerName.trim()}"已存在于业务组"${duplicate.groupName}"中`);
      return;
    }
    try {
      const now = new Date().toISOString();
      const existing = supplierMappings.find(m => m.id === id);
      const mapping: SupplierSubjectMapping = {
        id,
        accountSetId: useAccountSetStore.getState().currentAccountSetId || 'default',
        groupName: supplierForm.groupName,
        sellerName: supplierForm.sellerName.trim(),
        createTime: existing?.createTime || now,
        updateTime: now,
      };
      await sqliteService.saveSupplierMapping(mapping);
      await loadSupplierMappings();
      setEditingSupplierId(null);
    } catch (error) {
      console.error('保存供应商白名单失败:', error);
    }
  };

  // 内联保存新增供应商
  const handleSaveNewSupplierInline = async () => {
    if (!supplierForm.sellerName.trim() || !supplierForm.groupName.trim()) return;
    // 检查重复
    const duplicate = supplierMappings.find(m => m.sellerName === supplierForm.sellerName.trim());
    if (duplicate) {
      console.warn(`供应商"${supplierForm.sellerName.trim()}"已存在于业务组"${duplicate.groupName}"中`);
      return;
    }
    try {
      const now = new Date().toISOString();
      const mapping: SupplierSubjectMapping = {
        id: `ssm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        accountSetId: useAccountSetStore.getState().currentAccountSetId || 'default',
        groupName: supplierForm.groupName,
        sellerName: supplierForm.sellerName.trim(),
        createTime: now,
        updateTime: now,
      };
      await sqliteService.saveSupplierMapping(mapping);
      await loadSupplierMappings();
      setIsAddingSupplier(false);
    } catch (error) {
      console.error('保存供应商白名单失败:', error);
    }
  };

  // 取消编辑/新增供应商
  const handleCancelEditSupplier = () => {
    setEditingSupplierId(null);
    setIsAddingSupplier(false);
  };

  // 过滤供应商白名单
  const filteredSupplierMappings = supplierMappings.filter(mapping =>
    mapping.sellerName.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    mapping.groupName.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  // 处理导入业务单据
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);

    // 模拟解析文件内容并生成预览
    const mockPreview = [
      {
        sellerName: '阿里巴巴集团',
        estimatedGroup: '员工报销',
        confidence: 0.95,
      },
      {
        sellerName: '腾讯科技有限公司',
        estimatedGroup: '员工报销',
        confidence: 0.92,
      },
      {
        sellerName: '华为技术有限公司',
        estimatedGroup: '生产材料',
        confidence: 0.88,
      },
    ];
    setImportPreview(mockPreview);
  };

  const handleConfirmImport = async () => {
    // 模拟导入逻辑
    for (const item of importPreview) {
      const mapping: SupplierSubjectMapping = {
        id: `ssm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        accountSetId: useAccountSetStore.getState().currentAccountSetId || 'default',
        groupName: item.estimatedGroup,
        sellerName: item.sellerName,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      };
      await sqliteService.saveSupplierMapping(mapping);
    }

    // 重新加载数据
    await loadSupplierMappings();
    setShowImportDialog(false);
    setImportPreview([]);
    setImportFile(null);
  };

  return (
    <div className="space-y-6">
      {/* 冲突警告 */}
      {conflicts.length > 0 && (
        <Alert variant="warning">
          <Settings2 className="h-4 w-4" />
          <AlertTitle>规则冲突检测</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="space-y-2">
              {conflicts.map((conflict, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 mt-2" />
                  <div className="flex-1">
                    <p className="text-sm">{conflict.message}</p>
                    <p className="text-xs text-yellow-600">
                      重叠关键词: {conflict.overlappingKeywords.join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="templates" className="w-full" orientation="horizontal">
        {(() => {
          const acct = useAccountSetStore.getState().getCurrentAccountSet();
          const tType = acct?.accounting?.taxpayerType;
          if (tType === 'small') {
            return (
              <Alert className="mb-4 border-amber-200 bg-amber-50">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">当前为小规模纳税人</AlertTitle>
                <AlertDescription className="text-amber-700 text-sm">
                  进项发票生成凭证时不会产生进项税额分录，税额将并入费用/资产科目。业务组中配置的税金科目会被自动忽略。
                </AlertDescription>
              </Alert>
            );
          }
          return null;
        })()}
        <TabsList className="mb-6">
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            模板配置
          </TabsTrigger>
          <TabsTrigger value="matching" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            匹配策略
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            全局系统设置
          </TabsTrigger>
        </TabsList>

        {/* 模板配置 Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                智能科目模板
                <Button onClick={() => { setEditingGroup(null); setShowGroupEditor(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增业务组
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          业务组名称
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          业务组描述
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          选择类型
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          借方科目
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          税金科目
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          贷方科目
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {config.businessGroups
                        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                        .map((group) => (
                          <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-5 w-5 text-slate-300" />
                                <div className="font-medium text-sm">
                                  {group.name}
                                  {['inventory', 'material', 'reimbursement', 'fixed_asset'].includes(group.id) && (
                                    <Badge variant="outline" className="ml-2 text-xs bg-purple-50 text-purple-600 border-purple-200">
                                      系统预设
                                    </Badge>
                                  )}
                                  {group.id.startsWith('custom_') && (
                                    <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-600 border-blue-200">
                                      自定义
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    P{group.priority || 0}
                                  </Badge>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs text-slate-500">
                                {group.description || '-'}{' '}
                                {group.keywords && group.keywords.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {group.keywords.slice(0, 3).map((keyword, index) => (
                                      <span
                                        key={index}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                                      >
                                        {keyword}
                                      </span>
                                    ))}
                                    {group.keywords.length > 3 && (
                                      <span className="text-xs text-slate-500">+{group.keywords.length - 3}个关键词</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs">
                                {group.partnerType}
                              </Badge>
                              {group.requirePartnerCard === false && (
                                <span className="ml-1 text-xs text-orange-500">无往来</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">{group.debitSubject}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">
                                {group.taxSubject || <span className="text-orange-500 text-xs">无税金</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">{group.creditSubject}</div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => updateGroupPriority(group.id, 10)}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => updateGroupPriority(group.id, -10)}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleEditBusinessGroup(group)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                {!['inventory', 'material', 'reimbursement', 'fixed_asset'].includes(group.id) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                    onClick={() => handleDeleteBusinessGroup(group.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 匹配策略 Tab */}
        <TabsContent value="matching" className="space-y-6">
          {/* 供应商白名单 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>供应商白名单明细</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                  <Search className="h-4 w-4 mr-2" />
                  导入业务单据
                </Button>
                <Button onClick={handleAddSupplierMapping}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增供应商
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    placeholder="搜索供应商或业务组..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            供应商名称
                          </th>
                          {config.businessGroups.map((group) => (
                            <th key={group.id} className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                              {group.name}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {filteredSupplierMappings.length === 0 && !isAddingSupplier ? (
                          <tr>
                            <td colSpan={config.businessGroups.length + 2} className="px-4 py-8 text-center text-slate-500">
                              暂无供应商白名单数据，点击"新增供应商"添加
                            </td>
                          </tr>
                        ) : (
                          <>
                            {filteredSupplierMappings.map((mapping) => (
                              <tr key={mapping.id} className="hover:bg-slate-50 transition-colors">
                                {editingSupplierId === mapping.id ? (
                                  <>
                                    <td className="px-4 py-3">
                                      <PartnerPopover
                                        value={supplierForm.sellerName}
                                        onChange={(name) => setSupplierForm({ ...supplierForm, sellerName: name })}
                                        placeholder="选择供应商"
                                        filterSupplier
                                      />
                                    </td>
                                    {config.businessGroups.map((group) => (
                                      <td key={group.id} className="px-4 py-3 text-center">
                                        <input
                                          type="radio"
                                          name={`edit-group-${mapping.id}`}
                                          checked={supplierForm.groupName === group.name}
                                          onChange={() => setSupplierForm({ ...supplierForm, groupName: group.name })}
                                          className="h-4 w-4 text-blue-600"
                                        />
                                      </td>
                                    ))}
                                    <td className="px-4 py-3 text-right space-x-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-green-600"
                                        onClick={() => handleSaveSupplierMappingInline(mapping.id)}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={handleCancelEditSupplier}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-4 py-3 text-sm font-medium">{mapping.sellerName}</td>
                                    {config.businessGroups.map((group) => (
                                      <td key={group.id} className="px-4 py-3 text-center">
                                        {mapping.groupName === group.name ? (
                                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    ))}
                                    <td className="px-4 py-3 text-right space-x-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleEditSupplierMapping(mapping)}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-500"
                                        onClick={() => handleDeleteSupplierMapping(mapping.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                            {/* 新增供应商内联行 */}
                            {isAddingSupplier && (
                              <tr className="bg-blue-50/50">
                                <td className="px-4 py-3">
                                  <PartnerPopover
                                    value={supplierForm.sellerName}
                                    onChange={(name) => setSupplierForm({ ...supplierForm, sellerName: name })}
                                    placeholder="选择供应商"
                                    filterSupplier
                                  />
                                </td>
                                {config.businessGroups.map((group) => (
                                  <td key={group.id} className="px-4 py-3 text-center">
                                    <input
                                      type="radio"
                                      name="new-supplier-group"
                                      checked={supplierForm.groupName === group.name}
                                      onChange={() => setSupplierForm({ ...supplierForm, groupName: group.name })}
                                      className="h-4 w-4 text-blue-600"
                                    />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-green-600"
                                    onClick={handleSaveNewSupplierInline}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={handleCancelEditSupplier}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 关键词规则 */}
          <Card>
            <CardHeader>
              <CardTitle>关键词匹配规则</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 规则列表 */}
              <div className="space-y-3">
                {config.keywordRules.map((rule) => (
                  <div key={rule.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{rule.id}</Badge>
                        <span className="text-sm font-medium">
                          {rule.keywords}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {config.businessGroups.find(g => g.id === rule.businessGroup)?.name}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEditKeywordRule(rule)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500"
                          onClick={() => handleDeleteKeywordRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      阈值: ¥{rule.threshold} | 优先级: {rule.threshold > 0 ? '高' : '中'}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={handleAddKeywordRule}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增关键词规则
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 全局系统设置 Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>全局系统设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Zap className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">自动税金科目匹配</div>
                      <div className="text-xs text-slate-500">
                        根据发票税率自动匹配对应税金科目（如13%→进项税额(13%)）
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={config.globalSettings.autoTaxSubject}
                    onCheckedChange={(checked) =>
                      saveConfig({
                        ...config,
                        globalSettings: { ...config.globalSettings, autoTaxSubject: checked },
                      })
                    }
                  />
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <Shield className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">重复发票检查</div>
                      <div className="text-xs text-slate-500">
                        入账时自动检查发票号码是否已存在，避免重复入账
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={config.globalSettings.autoCheckDuplicate}
                    onCheckedChange={(checked) =>
                      saveConfig({
                        ...config,
                        globalSettings: { ...config.globalSettings, autoCheckDuplicate: checked },
                      })
                    }
                  />
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <UserCheck className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">报销人识别</div>
                      <div className="text-xs text-slate-500">
                        自动识别发票中的报销人信息，匹配员工往来卡片
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={config.globalSettings.autoRecognizeReimburser}
                    onCheckedChange={(checked) =>
                      saveConfig({
                        ...config,
                        globalSettings: { ...config.globalSettings, autoRecognizeReimburser: checked },
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 业务组编辑弹出面板 */}
      {showGroupEditor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-black/40" onClick={() => { setShowGroupEditor(false); setEditingGroup(null); }}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <BusinessGroupEditor
              onSave={(group) => { handleSaveNewGroup(group); setShowGroupEditor(false); setEditingGroup(null); }}
              onCancel={() => { setShowGroupEditor(false); setEditingGroup(null); }}
              defaultValues={
                editingGroup
                  ? {
                      name: editingGroup.name,
                      debitSubject: editingGroup.debitSubject,
                      debitSubjectName: editingGroup.debitSubjectName || '',
                      taxSubject: editingGroup.taxSubject,
                      taxSubjectName: editingGroup.taxSubjectName || '',
                      creditSubject: editingGroup.creditSubject,
                      creditSubjectName: editingGroup.creditSubjectName || '',
                      partnerType: editingGroup.partnerType,
                      assetThreshold: editingGroup.assetThreshold,
                      description: editingGroup.description,
                      isPreset: editingGroup.isPreset,
                      autoTax: editingGroup.autoTax,
                      requirePartnerCard: editingGroup.requirePartnerCard,
                      keywords: editingGroup.keywords,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* 关键词规则编辑抽屉 */}
      <Drawer open={showKeywordEditor} onOpenChange={setShowKeywordEditor}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editingRule ? '编辑关键词规则' : '新增关键词规则'}</DrawerTitle>
            <DrawerDescription>
              配置关键词匹配规则，用于自动匹配业务组
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div>
              <Label className="text-xs">关键词（多个关键词用逗号分隔）</Label>
              <Input
                value={keywordForm.keywords}
                onChange={(e) => setKeywordForm({ ...keywordForm, keywords: e.target.value })}
                placeholder="例如：电脑, 服务器, 设备"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">匹配业务组</Label>
              <Select
                value={keywordForm.businessGroup}
                onValueChange={(value) => setKeywordForm({ ...keywordForm, businessGroup: value })}
              >
                <SelectTrigger className="h-8 w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.businessGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">阈值（单位：元，0表示不设限）</Label>
              <Input
                type="number"
                value={keywordForm.threshold}
                onChange={(e) => setKeywordForm({ ...keywordForm, threshold: Number(e.target.value) || 0 })}
                placeholder="0"
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setShowKeywordEditor(false)}>
              取消
            </Button>
            <Button onClick={handleSaveKeywordRule}>
              保存
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 业务单据导入对话框 */}
      <Drawer open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>导入业务单据</DrawerTitle>
            <DrawerDescription>
              导入业务单据（如采购订单、合同等）以自动创建供应商白名单
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div>
              <Label className="text-xs">选择业务单据文件</Label>
              <div className="mt-2">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleImportFileSelect}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {importFile && (
                <div className="mt-2 text-sm text-slate-600">
                  已选择文件：{importFile.name}
                </div>
              )}
            </div>
            {importPreview.length > 0 && (
              <div>
                <Label className="text-xs">预览导入数据</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                          供应商名称
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                          预估业务组
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                          置信度
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {importPreview.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2 text-sm font-medium">{item.sellerName}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-xs">
                              {item.estimatedGroup}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${item.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">
                                {(item.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {importPreview.length > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-xs font-medium text-blue-700">智能识别说明</AlertTitle>
                <AlertDescription className="text-xs text-blue-600">
                  系统会根据业务单据内容自动识别供应商类型和预估业务组，识别结果已在预览中显示。
                  您可以在导入前确认或调整这些信息。
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importPreview.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              确认导入 ({importPreview.length} 条)
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}