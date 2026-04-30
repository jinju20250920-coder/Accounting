'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  Plus,
  Edit,
  Trash2,
  Calculator,
  FileText,
  Package,
  Settings,
  Search,
  X,
  BookOpen,
} from 'lucide-react';
import {
  DEFAULT_ACQUISITION_RULES,
  ACQUISITION_TYPE_NAMES,
  type AssetAcquisitionRule,
} from '@/lib/asset-acquisition-rule';
import type { AssetCategory, DepreciationMethod, AssetFinancialSettings } from '@/types';

// 科目选择器组件 - Portal 模式（compact 模式用于表格内）
function SubjectSelector({
  value,
  onChange,
  placeholder,
  subjects,
  label,
  icon,
  compact = false,
}: {
  value: string;
  onChange: (code: string, name: string) => void;
  placeholder: string;
  subjects: { code: string; name: string }[];
  label?: string;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const filtered = subjects.filter(
    s => s.code.includes(search) || s.name.includes(search)
  );

  const selected = subjects.find(s => s.code === value);

  const handleToggle = (e: React.MouseEvent<HTMLDivElement>) => {
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

  const trigger = (
    <div
      role="button"
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={e => e.key === 'Enter' && handleToggle(e as any)}
      className={`w-full flex items-center justify-between border rounded cursor-pointer bg-white ${
        compact
          ? 'px-2 py-1.5 text-xs hover:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500'
          : 'px-3 py-2 text-sm hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
      }`}
    >
      {selected ? (
        compact ? (
          <span className="font-mono text-blue-600 truncate">{selected.code} {selected.name}</span>
        ) : (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-blue-600 text-xs truncate">{selected.code}</span>
            <span className="text-slate-600 text-xs truncate">{selected.name}</span>
          </div>
        )
      ) : (
        <span className={compact ? 'text-slate-400' : 'text-slate-400 text-xs'}>{placeholder}</span>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        {selected && (
          <button type="button" onClick={handleClear} className="p-0.5 hover:bg-slate-100 rounded">
            <X className={compact ? 'h-3 w-3 text-slate-400' : 'h-3 w-3 text-slate-400'} />
          </button>
        )}
        <Search className={compact ? 'h-3 w-3 text-slate-400' : 'h-3.5 w-3.5 text-slate-400'} />
      </div>
    </div>
  );

  return (
    <div className={compact ? 'relative' : 'space-y-1.5'}>
      {!compact && label && (
        <Label className="text-xs flex items-center gap-1">
          {icon}
          {label}
        </Label>
      )}
      {trigger}
      {open && createPortal(
        <div
          className="fixed z-[9999] bg-white border rounded-lg shadow-xl max-h-48 overflow-auto"
          style={{
            top: position.top,
            left: position.left,
            width: Math.max(position.width, compact ? 250 : 280),
          }}
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
            <div className="p-3 text-xs text-slate-500 text-center">无匹配科目</div>
          ) : (
            filtered.slice(0, compact ? 20 : 30).map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => handleSelect(s.code, s.name)}
                className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 flex items-center gap-2"
              >
                <span className="font-mono text-blue-600 w-16">{s.code}</span>
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

// 分类编辑对话框 - 双栏布局
function CategoryEditDialog({
  open,
  onOpenChange,
  category,
  subjects,
  onSave,
  subjectSplitEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: AssetCategory | null;
  subjects: { code: string; name: string }[];
  onSave: (data: Partial<AssetCategory>) => void;
  subjectSplitEnabled: boolean;
}) {
  const [formData, setFormData] = useState<Partial<AssetCategory>>({
    name: '',
    defaultUsefulLifeYears: 5,
    defaultDepreciationMethod: 'straight_line',
    defaultSalvageRate: 0.05,
    assetSubjectCode: '1501',
    depreciationSubjectCode: '1502',
    expenseSubjectCode: '660204',
    enabled: true,
  });

  useEffect(() => {
    if (category) {
      setFormData(category);
    } else {
      setFormData({
        name: '',
        defaultUsefulLifeYears: 5,
        defaultDepreciationMethod: 'straight_line',
        defaultSalvageRate: 0.05,
        assetSubjectCode: '1501',
        depreciationSubjectCode: '1502',
        expenseSubjectCode: '660204',
        enabled: true,
      });
    }
  }, [category, open]);

  const handleSubmit = () => {
    if (!formData.name?.trim()) return;
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{category ? '编辑分类' : '新增分类'}</DialogTitle>
          <DialogDescription>
            定义资产类别的核算规则与折旧参数
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-6 py-4">
          {/* 左栏：折旧参数配置 (60%) */}
          <div className="col-span-3 space-y-4">
            {/* 基础信息 */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Package className="h-3 w-3" />
                基础信息
              </div>
              <div className="space-y-1.5">
                <Label required className="text-xs">分类名称</Label>
                <Input
                  value={formData.name || ''}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="如：电子设备、运输工具"
                  className="text-sm"
                />
              </div>
            </div>

            {/* 折旧规则 */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Calculator className="h-3 w-3" />
                折旧规则
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">使用年限 (年)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.defaultUsefulLifeYears || 5}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      defaultUsefulLifeYears: parseInt(e.target.value) || 5
                    }))}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">折旧方法</Label>
                  <Select
                    value={formData.defaultDepreciationMethod || 'straight_line'}
                    onValueChange={v => setFormData(prev => ({
                      ...prev,
                      defaultDepreciationMethod: v as DepreciationMethod
                    }))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">直线法</SelectItem>
                      <SelectItem value="double_declining">双倍余额</SelectItem>
                      <SelectItem value="sum_of_years">年数总和</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">残值率 (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={(formData.defaultSalvageRate || 0.05) * 100}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      defaultSalvageRate: (parseFloat(e.target.value) || 0) / 100
                    }))}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 状态设置 */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Settings className="h-3 w-3" />
                状态设置
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">是否启用</span>
                <Switch
                  checked={formData.enabled ?? true}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
              </div>
            </div>
          </div>

          {/* 右栏：科目映射与操作 (40%) */}
          <div className="col-span-2 space-y-4">
            {/* 自动关联科目 */}
            <div className="p-3 bg-blue-50 rounded-lg space-y-3 border border-blue-100">
              <div className="text-xs font-medium text-blue-700 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                自动关联科目
                {subjectSplitEnabled && (
                  <Badge variant="secondary" className="ml-1 text-[10px] bg-orange-100 text-orange-700">
                    子科目拆分
                  </Badge>
                )}
              </div>
              <div className="space-y-3">
                <SubjectSelector
                  value={formData.assetSubjectCode || ''}
                  onChange={(code, name) => setFormData(prev => ({
                    ...prev,
                    assetSubjectCode: code,
                    assetSubjectName: name
                  }))}
                  placeholder="1501"
                  subjects={subjects}
                  label="资产科目"
                  icon={<Package className="h-3 w-3 text-blue-500" />}
                />
                <SubjectSelector
                  value={formData.depreciationSubjectCode || ''}
                  onChange={(code, name) => setFormData(prev => ({
                    ...prev,
                    depreciationSubjectCode: code,
                    depreciationSubjectName: name
                  }))}
                  placeholder="1502"
                  subjects={subjects}
                  label="折旧科目"
                  icon={<Calculator className="h-3 w-3 text-orange-500" />}
                />
                <SubjectSelector
                  value={formData.expenseSubjectCode || ''}
                  onChange={(code, name) => setFormData(prev => ({
                    ...prev,
                    expenseSubjectCode: code,
                    expenseSubjectName: name
                  }))}
                  placeholder="660204"
                  subjects={subjects}
                  label="费用科目"
                  icon={<FileText className="h-3 w-3 text-green-500" />}
                />
              </div>
              {subjectSplitEnabled && (
                <div className="text-[10px] text-orange-600 bg-orange-50 p-1.5 rounded border border-orange-100">
                  开启子科目拆分后，系统将根据编码格式自动创建子科目
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={handleSubmit}>
                保存
              </Button>
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                取消
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Tab 类型
type TabType = 'category' | 'acquisition' | 'voucher';

// 统一核算规则对话框
export function AssetCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    categories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    initialize,
    subjectSplitEnabled,
    setSubjectSplitEnabled,
    subSubjectSeparator,
    setSubSubjectSeparator,
    requireDepartment,
    setRequireDepartment,
  } = useFixedAssetStore();

  const { subjects, initializeSubjects } = useSubjectStore();
  const { showToast } = useToast();
  const { settings, updateSettings } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<TabType>('category');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);
  const [rules, setRules] = useState<AssetAcquisitionRule[]>(DEFAULT_ACQUISITION_RULES);

  useEffect(() => {
    if (open) {
      initialize();
      initializeSubjects();
    }
  }, [open, initialize, initializeSubjects]);

  const availableSubjects = subjects
    .filter(s => !s.disabled && !s.block)
    .map(s => ({ code: s.code, name: s.name }));

  // 分类相关操作
  const handleSaveCategory = async (data: Partial<AssetCategory>) => {
    try {
      if (selectedCategory) {
        await updateCategory(selectedCategory.id, data);
        showToast('success', '分类更新成功');
      } else {
        const accountSetStore = useAccountSetStore.getState();
        const currentAccountSet = accountSetStore.getCurrentAccountSet();
        await addCategory({
          ...data,
          code: data.code || `CAT${Date.now()}`,
          assetType: 'fixed',
          sortOrder: categories.length,
          accountSetId: currentAccountSet?.id,
        } as any);
        showToast('success', '分类添加成功');
      }
      setShowEditDialog(false);
      setSelectedCategory(null);
    } catch (error: any) {
      showToast('error', error.message || '操作失败');
    }
  };

  const handleDeleteCategory = async (category: AssetCategory) => {
    try {
      await deleteCategory(category.id);
      showToast('success', '分类删除成功');
    } catch (error: any) {
      showToast('error', error.message || '删除失败');
    }
  };

  // 取得规则相关操作
  const handleUpdateRule = (id: string, updates: Partial<AssetAcquisitionRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleSaveRules = () => {
    // TODO: 保存到数据库
    showToast('success', '规则保存成功');
  };

  // 更新资产财务规则设置
  const updateAssetFinancialSettings = (updates: Partial<AssetFinancialSettings>) => {
    updateSettings({
      assetFinancialSettings: {
        ...settings.assetFinancialSettings,
        ...updates
      }
    });
  };

  const getDepreciationMethodName = (method: DepreciationMethod) => {
    const map: Record<DepreciationMethod, string> = {
      straight_line: '直线法',
      double_declining: '双倍余额',
      sum_of_years: '年数总和',
      units_of_production: '工作量法',
    };
    return map[method] || method;
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'category', label: '折旧与科目', icon: <Calculator className="h-3.5 w-3.5" /> },
    { key: 'acquisition', label: '取得成本规则', icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'voucher', label: '处置减值过账', icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            固定资产核算规则
          </DialogTitle>
          <DialogDescription>
            配置资产分类的折旧参数、科目映射和取得规则
          </DialogDescription>
        </DialogHeader>

        {/* Tab 切换 */}
        <div className="flex border-b">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: 折旧与科目 */}
        {activeTab === 'category' && (
          <div className="space-y-3 py-3">
            {/* 全局设置 */}
            <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg space-y-3">
              {/* 科目拆分明细开关 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-orange-600" />
                  <div>
                    <div className="text-sm font-medium text-orange-800">科目拆分明细</div>
                    <div className="text-xs text-orange-600">
                      开启后，每个资产分类将自动创建子科目
                    </div>
                  </div>
                </div>
                <Switch
                  checked={subjectSplitEnabled}
                  onCheckedChange={setSubjectSplitEnabled}
                />
              </div>
              {subjectSplitEnabled && (
                <div className="flex items-center gap-3 pl-6">
                  <span className="text-xs text-orange-700">子科目编码格式</span>
                  <div className="flex gap-1">
                    {([
                      { value: '', label: '无', example: '150201' },
                      { value: '.', label: '.', example: '1502.01' },
                      { value: '_', label: '_', example: '1502_01' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSubSubjectSeparator(opt.value)}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                          subSubjectSeparator === opt.value
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white text-orange-700 border-orange-200 hover:border-orange-400'
                        }`}
                      >
                        {opt.label}
                        <span className="ml-1 opacity-60">{opt.example}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 入账时部门必填开关 */}
              <div className="flex items-center justify-between border-t border-orange-200 pt-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-orange-600" />
                  <div>
                    <div className="text-sm font-medium text-orange-800">入账时部门必填</div>
                    <div className="text-xs text-orange-600">
                      开启后，固定资产入账时必须填写部门编号
                    </div>
                  </div>
                </div>
                <Switch
                  checked={requireDepartment}
                  onCheckedChange={setRequireDepartment}
                />
              </div>
            </div>

            {/* 快速新增 */}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => {
                setSelectedCategory(null);
                setShowEditDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-1" />
                新增分类
              </Button>
            </div>

            {/* 分类列表 */}
            {loading ? (
              <div className="text-center py-8 text-slate-500">加载中...</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-slate-500">暂无分类数据</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left p-2 font-medium">分类名称</th>
                      <th className="text-center p-2 font-medium">年限</th>
                      <th className="text-left p-2 font-medium">折旧方法</th>
                      <th className="text-left p-2 font-medium">资产科目</th>
                      <th className="text-left p-2 font-medium">折旧科目</th>
                      <th className="text-left p-2 font-medium">费用科目</th>
                      <th className="text-center p-2 font-medium">状态</th>
                      <th className="text-center p-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => (
                      <tr key={cat.id} className="border-b hover:bg-slate-50">
                        <td className="p-2 font-medium">
                          {cat.name}
                          {subjectSplitEnabled && (
                            <span className="ml-1 text-[10px] text-orange-600">子科目</span>
                          )}
                        </td>
                        <td className="p-2 text-center">{cat.defaultUsefulLifeYears}年</td>
                        <td className="p-2 text-xs">{getDepreciationMethodName(cat.defaultDepreciationMethod)}</td>
                        <td className="p-2">
                          <code className="text-xs bg-slate-100 px-1 rounded">{cat.assetSubjectCode}</code>
                        </td>
                        <td className="p-2">
                          <code className="text-xs bg-slate-100 px-1 rounded">{cat.depreciationSubjectCode}</code>
                        </td>
                        <td className="p-2"><code className="text-xs bg-slate-100 px-1 rounded">{cat.expenseSubjectCode}</code></td>
                        <td className="p-2 text-center">
                          {cat.enabled ? (
                            <Badge variant="default" className="bg-green-100 text-green-700 text-xs">启用</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">禁用</Badge>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setSelectedCategory(cat);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => handleDeleteCategory(cat)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 说明 */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              <p className="font-medium mb-1">科目说明</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>资产科目：固定资产取得时借方入账科目（如 1501）</li>
                <li>折旧科目：折旧凭证贷方科目（如 1502 累计折旧）</li>
                <li>费用科目：折旧凭证借方费用科目（如 660204）</li>
                {subjectSplitEnabled && (
                  <li className="text-orange-600">子科目拆分：开启后每个分类自动创建子科目，凭证使用子科目入账</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: 取得成本规则 */}
        {activeTab === 'acquisition' && (
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
                          compact
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
                            compact
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
        )}

        {/* Tab 3: 处置减值过账规则 */}
        {activeTab === 'voucher' && (
          <div className="space-y-4 py-3">
            {/* 减值处理方式 */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Calculator className="h-3 w-3" />
                减值处理方式
              </div>
              <div className="space-y-2">
                <Select
                  value={settings.assetFinancialSettings.impairmentMethod}
                  onValueChange={(v) => updateAssetFinancialSettings({ impairmentMethod: v as 'provision' | 'direct_reduction' })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provision">计提减值准备</SelectItem>
                    <SelectItem value="direct_reduction">直接减少原值</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  {settings.assetFinancialSettings.impairmentMethod === 'provision'
                    ? '计提准备：借记资产减值损失，贷记减值准备'
                    : '直接减少：借记营业外支出，贷记固定资产'}
                </p>
              </div>
            </div>

            {/* 处置凭证生成方式 */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                处置凭证生成方式
              </div>
              <div className="space-y-2">
                <Select
                  value={settings.assetFinancialSettings.disposalVoucherMode}
                  onValueChange={(v) => updateAssetFinancialSettings({ disposalVoucherMode: v as 'single' | 'multiple' | 'auto' })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动（推荐）</SelectItem>
                    <SelectItem value="single">合并为一张凭证</SelectItem>
                    <SelectItem value="multiple">拆分多张凭证</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  自动模式：简单处置合并为一张凭证，复杂处置拆分为多张
                </p>
              </div>
            </div>

            {/* 过账科目配置 */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
              <div className="text-xs font-medium text-blue-700 flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                过账科目配置
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">固定资产清理科目</Label>
                  <Input
                    value={settings.assetFinancialSettings.disposalClearingSubjectCode}
                    onChange={(e) => updateAssetFinancialSettings({ disposalClearingSubjectCode: e.target.value })}
                    placeholder="1601"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">资产减值损失科目</Label>
                  <Input
                    value={settings.assetFinancialSettings.impairmentLossSubjectCode}
                    onChange={(e) => updateAssetFinancialSettings({ impairmentLossSubjectCode: e.target.value })}
                    placeholder="6701"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">减值准备科目</Label>
                  <Input
                    value={settings.assetFinancialSettings.impairmentProvisionSubjectCode}
                    onChange={(e) => updateAssetFinancialSettings({ impairmentProvisionSubjectCode: e.target.value })}
                    placeholder="1503"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">处置收益科目</Label>
                  <Input
                    value={settings.assetFinancialSettings.gainSubjectCode}
                    onChange={(e) => updateAssetFinancialSettings({ gainSubjectCode: e.target.value })}
                    placeholder="6301"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">处置损失科目</Label>
                  <Input
                    value={settings.assetFinancialSettings.lossSubjectCode}
                    onChange={(e) => updateAssetFinancialSettings({ lossSubjectCode: e.target.value })}
                    placeholder="6711"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 说明 */}
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
              <p className="font-medium mb-1">科目来源说明</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-600">
                <li><strong>固定资产科目、累计折旧科目</strong>：根据资产分类，从"取得成本规则"页面获取</li>
                <li><strong>固定资产清理科目</strong>：处置时结转资产价值的过渡科目</li>
                <li><strong>资产减值损失科目</strong>：计提减值时的损失科目</li>
                <li><strong>减值准备科目</strong>：计提减值时的准备科目</li>
                <li><strong>处置收益/损失科目</strong>：处置净损益结转科目</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          {activeTab === 'acquisition' && (
            <Button onClick={handleSaveRules}>保存规则</Button>
          )}
          {activeTab === 'voucher' && (
            <Button onClick={() => showToast('success', '凭证规则保存成功')}>保存规则</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>

        {/* 编辑分类对话框 */}
        <CategoryEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          category={selectedCategory}
          subjects={availableSubjects}
          onSave={handleSaveCategory}
          subjectSplitEnabled={subjectSplitEnabled}
        />
      </DialogContent>
    </Dialog>
  );
}
