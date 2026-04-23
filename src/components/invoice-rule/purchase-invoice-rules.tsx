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
import { Settings2, Plus, Trash2, Edit2, Search, Info, ChevronDown, ChevronUp, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { BusinessGroupDrawer } from './components/business-group-drawer';
import { RuleConflictDetector } from './utils/rule-conflict-detector';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';
import type { SupplierSubjectMapping } from '@/types';

interface BusinessGroup {
  id: string;
  name: string;
  debitSubject: string;
  taxSubject: string;
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

export function PurchaseInvoiceRules({ open }: PurchaseInvoiceRulesProps) {
  const [config, setConfig] = useState<PurchaseInvoiceRuleConfig>({
    id: '',
    accountSetId: '',
    businessGroups: [
      { id: 'inventory', name: '库存商品', debitSubject: '1403.02 库存商品', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 100, assetThreshold: 5000, description: '用于库存商品采购的发票处理', isPreset: true, autoTax: true, keywords: ['库存', '商品', '存货'] },
      { id: 'material', name: '生产材料', debitSubject: '1403.01 原材料', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 90, assetThreshold: 5000, description: '用于生产原材料采购的发票处理', isPreset: true, autoTax: true, keywords: ['材料', '原料', '配件'] },
      { id: 'reimbursement', name: '员工报销', debitSubject: '(匹配关键词)', taxSubject: '2221.01.{{税率}}', creditSubject: '2241 其他应付款', partnerType: '员工', priority: 80, assetThreshold: 0, description: '用于员工日常费用报销的发票处理', isPreset: true, autoTax: true, keywords: ['报销', '差旅', '办公'] },
      { id: 'fixed_asset', name: '固定资产', debitSubject: '1601 固定资产', taxSubject: '2221.01.{{税率}}', creditSubject: '2202 应付账款', partnerType: '供应商', priority: 70, assetThreshold: 5000, description: '用于固定资产采购的发票处理', isPreset: true, autoTax: true, keywords: ['设备', '固定资产', '机器'] },
    ],
    keywordRules: [
      { id: '1', keywords: '电脑, 服务器', businessGroup: 'fixed_asset', threshold: 5000 },
      { id: '2', keywords: '滴滴, 打车', businessGroup: 'reimbursement', threshold: 0 },
    ],
    globalSettings: {
      assetThreshold: 5000,
      autoTaxSubject: true,
      autoCheckDuplicate: true,
      autoRecognizeReimburser: true,
    },
    updateTime: new Date().toISOString(),
  });

  const [showAddGroupDrawer, setShowAddGroupDrawer] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [editingGroup, setEditingGroup] = useState<BusinessGroup | null>(null);
  const [editingRule, setEditingRule] = useState<KeywordRule | null>(null);
  const [showKeywordEditor, setShowKeywordEditor] = useState(false);
  const [keywordForm, setKeywordForm] = useState({
    keywords: '',
    businessGroup: 'inventory',
    threshold: 0,
  });

  // 供应商白名单相关状态
  const [supplierMappings, setSupplierMappings] = useState<SupplierSubjectMapping[]>([]);
  const [showSupplierDrawer, setShowSupplierDrawer] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierSubjectMapping | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierForm, setSupplierForm] = useState({
    groupName: '',
    sellerName: '',
    supplierType: 'material' as const as 'material' | 'inventory' | 'fixed_asset' | 'service' | 'other',
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  // 检测规则冲突
  useEffect(() => {
    const detectedConflicts = RuleConflictDetector.detectKeywordOverlaps(
      config.keywordRules,
      config.businessGroups
    );
    setConflicts(detectedConflicts);
  }, [config]);

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
      setConfig({
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
                keywords: group.keywords,
              }
            : g
        ),
      });
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
        keywords: group.keywords || [],
      };

      setConfig({
        ...config,
        businessGroups: [...config.businessGroups, newGroup],
      });
    }
  };

  // 编辑业务组
  const handleEditBusinessGroup = (group: BusinessGroup) => {
    setEditingGroup(group);
    setShowAddGroupDrawer(true);
  };

  // 删除业务组
  const handleDeleteBusinessGroup = (groupId: string) => {
    setConfig({
      ...config,
      businessGroups: config.businessGroups.filter(g => g.id !== groupId),
    });
  };

  // 处理抽屉关闭
  const handleDrawerOpenChange = (open: boolean) => {
    setShowAddGroupDrawer(open);
    if (!open) {
      setEditingGroup(null);
    }
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
    setConfig({
      ...config,
      keywordRules: config.keywordRules.filter(r => r.id !== ruleId),
    });
  };

  // 处理关键词规则保存
  const handleSaveKeywordRule = () => {
    if (editingRule) {
      // 更新模式
      setConfig({
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
      setConfig({
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
    setConfig({
      ...config,
      businessGroups: config.businessGroups.map(group =>
        group.id === groupId ? { ...group, priority: (group.priority || 0) + change } : group
      ),
    });
  };

  // 处理新增供应商白名单
  const handleAddSupplierMapping = () => {
    setEditingSupplier(null);
    setSupplierForm({
      groupName: config.businessGroups[0]?.name || '',
      sellerName: '',
      supplierType: 'material',
    });
    setShowSupplierDrawer(true);
  };

  // 处理编辑供应商白名单
  const handleEditSupplierMapping = (mapping: SupplierSubjectMapping) => {
    setEditingSupplier(mapping);
    setSupplierForm({
      groupName: mapping.groupName,
      sellerName: mapping.sellerName,
      supplierType: mapping.supplierType,
    });
    setShowSupplierDrawer(true);
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

  // 处理保存供应商白名单
  const handleSaveSupplierMapping = async () => {
    if (!supplierForm.sellerName.trim() || !supplierForm.groupName.trim()) {
      return;
    }

    try {
      const now = new Date().toISOString();
      const mapping: SupplierSubjectMapping = {
        id: editingSupplier?.id || `ssm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        accountSetId: useAccountSetStore.getState().currentAccountSetId || 'default',
        groupName: supplierForm.groupName,
        sellerName: supplierForm.sellerName.trim(),
        supplierType: supplierForm.supplierType,
        createTime: editingSupplier?.createTime || now,
        updateTime: now,
      };
      await sqliteService.saveSupplierMapping(mapping);
      await loadSupplierMappings();
      setShowSupplierDrawer(false);
      setEditingSupplier(null);
    } catch (error) {
      console.error('保存供应商白名单失败:', error);
    }
  };

  // 过滤供应商白名单
  const filteredSupplierMappings = supplierMappings.filter(mapping =>
    mapping.sellerName.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    mapping.groupName.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  // 获取供应商类型显示名称
  const getSupplierTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      material: '生产材料',
      inventory: '库存商品',
      fixed_asset: '固定资产',
      service: '服务',
      other: '其他',
    };
    return labels[type] || type;
  };

  // 处理导入业务单据
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);

    // 模拟解析文件内容并生成预览
    const mockPreview = [
      {
        sellerName: '阿里巴巴集团',
        supplierType: 'service' as const as 'material' | 'inventory' | 'fixed_asset' | 'service' | 'other',
        estimatedGroup: '员工报销',
        confidence: 0.95,
      },
      {
        sellerName: '腾讯科技有限公司',
        supplierType: 'service' as const as 'material' | 'inventory' | 'fixed_asset' | 'service' | 'other',
        estimatedGroup: '员工报销',
        confidence: 0.92,
      },
      {
        sellerName: '华为技术有限公司',
        supplierType: 'material' as const as 'material' | 'inventory' | 'fixed_asset' | 'service' | 'other',
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
        supplierType: item.supplierType,
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
                <Button onClick={() => setShowAddGroupDrawer(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增业务组
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.businessGroups
                .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                .map((group) => (
                  <div key={group.id} className="rounded-lg border bg-white p-4 hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-5 w-5 text-slate-300" />
                        <div>
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
                          <div className="text-xs text-slate-500">{group.partnerType}</div>
                          {group.description && (
                            <div className="text-xs text-slate-400 mt-1">{group.description}</div>
                          )}
                          {group.keywords && group.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
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
                      </div>
                      <div className="flex items-center gap-2">
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
                    </div>

                    {/* 科目配置 */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">借方科目</div>
                        <div className="font-medium text-sm">{group.debitSubject}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">贷方科目</div>
                        <div className="font-medium text-sm">{group.creditSubject}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-slate-500 mb-1">税金科目</div>
                        <div className="font-medium text-sm">{group.taxSubject}</div>
                      </div>
                    </div>

                    {/* 固定资产配置 */}
                    {group.partnerType === '供应商' && group.assetThreshold !== undefined && (
                      <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-orange-700">
                            固定资产阈值: ¥{group.assetThreshold}
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            修改
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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
              {/* 供应商列表 */}
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
                  {/* 表格内容 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            业务组
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            供应商名称
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            供应商类型
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {filteredSupplierMappings.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                              暂无供应商白名单数据
                            </td>
                          </tr>
                        ) : (
                          filteredSupplierMappings.map((mapping) => (
                            <tr key={mapping.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs">
                                  {mapping.groupName}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">{mapping.sellerName}</td>
                              <td className="px-4 py-3">
                                <Badge variant="secondary" className="text-xs">
                                  {getSupplierTypeLabel(mapping.supplierType)}
                                </Badge>
                              </td>
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
                            </tr>
                          ))
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
                  <div>
                    <div className="text-sm font-medium">自动税金科目匹配</div>
                    <div className="text-xs text-slate-500">
                      根据发票税率自动匹配对应税金科目
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    配置
                  </Button>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">重复发票检查</div>
                    <div className="text-xs text-slate-500">
                      自动检查重复发票，避免重复录入
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    配置
                  </Button>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">报销人识别</div>
                    <div className="text-xs text-slate-500">
                      自动识别发票中的报销人信息
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    配置
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 业务组新增/编辑抽屉 */}
      <BusinessGroupDrawer
        open={showAddGroupDrawer}
        onOpenChange={handleDrawerOpenChange}
        onSave={handleSaveNewGroup}
        defaultValues={
          editingGroup
            ? {
                name: editingGroup.name,
                debitSubject: editingGroup.debitSubject,
                debitSubjectName: '',
                taxSubject: editingGroup.taxSubject,
                creditSubject: editingGroup.creditSubject,
                creditSubjectName: '',
                partnerType: editingGroup.partnerType,
                assetThreshold: editingGroup.assetThreshold,
              }
            : undefined
        }
      />

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

      {/* 供应商白名单编辑抽屉 */}
      <Drawer open={showSupplierDrawer} onOpenChange={setShowSupplierDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editingSupplier ? '编辑供应商白名单' : '新增供应商白名单'}</DrawerTitle>
            <DrawerDescription>
              配置供应商与业务组的映射关系，用于智能匹配
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 p-4">
            <div>
              <Label className="text-xs">供应商名称</Label>
              <Input
                value={supplierForm.sellerName}
                onChange={(e) => setSupplierForm({ ...supplierForm, sellerName: e.target.value })}
                placeholder="例如：阿里巴巴集团"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">所属业务组</Label>
              <Select
                value={supplierForm.groupName}
                onValueChange={(value) => setSupplierForm({ ...supplierForm, groupName: value })}
              >
                <SelectTrigger className="h-8 w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.businessGroups.map((group) => (
                    <SelectItem key={group.id} value={group.name}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">供应商类型</Label>
              <Select
                value={supplierForm.supplierType}
                onValueChange={(value: any) => setSupplierForm({ ...supplierForm, supplierType: value })}
              >
                <SelectTrigger className="h-8 w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">生产材料</SelectItem>
                  <SelectItem value="inventory">库存商品</SelectItem>
                  <SelectItem value="fixed_asset">固定资产</SelectItem>
                  <SelectItem value="service">服务</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setShowSupplierDrawer(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSupplierMapping}>
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
                          供应商类型
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
                            <Badge variant="secondary" className="text-xs">
                              {getSupplierTypeLabel(item.supplierType)}
                            </Badge>
                          </td>
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