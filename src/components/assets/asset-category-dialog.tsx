'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
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
  ChevronRight,
  Calculator,
  FileText,
  Package,
  Settings,
  Search,
  X,
} from 'lucide-react';
import type { AssetCategory, DepreciationMethod } from '@/types';

// 科目选择器组件 - Portal 模式
function SubjectSelector({
  value,
  onChange,
  placeholder,
  subjects,
  label,
  icon,
}: {
  value: string;
  onChange: (code: string, name: string) => void;
  placeholder: string;
  subjects: { code: string; name: string }[];
  label: string;
  icon: React.ReactNode;
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
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {selected ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-blue-600 text-xs truncate">
              {selected.code}
            </span>
            <span className="text-slate-600 text-xs truncate">
              {selected.name}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-100 rounded"
            >
              <X className="h-3 w-3 text-slate-400" />
            </button>
          )}
          <Search className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </button>

      {/* Portal 渲染下拉列表 */}
      {open && createPortal(
        <div
          className="fixed z-[9999] bg-white border rounded-lg shadow-xl max-h-48 overflow-auto"
          style={{
            top: position.top,
            left: position.left,
            width: Math.max(position.width, 280),
          }}
        >
          <div className="p-2 border-b sticky top-0 bg-white">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索科目..."
              className="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">无匹配科目</div>
          ) : (
            filtered.slice(0, 30).map(s => (
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: AssetCategory | null;
  subjects: { code: string; name: string }[];
  onSave: (data: Partial<AssetCategory>) => void;
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

        {/* 双栏布局 */}
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
  } = useFixedAssetStore();

  const { subjects, initializeSubjects } = useSubjectStore();
  const { showToast } = useToast();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);

  useEffect(() => {
    if (open) {
      initialize();
      initializeSubjects();
    }
  }, [open, initialize, initializeSubjects]);

  const availableSubjects = subjects
    .filter(s => !s.disabled && !s.block)
    .map(s => ({ code: s.code, name: s.name }));

  const handleSave = async (data: Partial<AssetCategory>) => {
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

  const handleDelete = async (category: AssetCategory) => {
    try {
      await deleteCategory(category.id);
      showToast('success', '分类删除成功');
    } catch (error: any) {
      showToast('error', error.message || '删除失败');
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            固定资产入账规则
          </DialogTitle>
          <DialogDescription>
            配置资产分类的折旧参数和科目映射
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
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
                      <td className="p-2 font-medium">{cat.name}</td>
                      <td className="p-2 text-center">{cat.defaultUsefulLifeYears}年</td>
                      <td className="p-2 text-xs">{getDepreciationMethodName(cat.defaultDepreciationMethod)}</td>
                      <td className="p-2"><code className="text-xs bg-slate-100 px-1 rounded">{cat.assetSubjectCode}</code></td>
                      <td className="p-2"><code className="text-xs bg-slate-100 px-1 rounded">{cat.depreciationSubjectCode}</code></td>
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
                            onClick={() => handleDelete(cat)}
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
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>

        {/* 编辑对话框 */}
        <CategoryEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          category={selectedCategory}
          subjects={availableSubjects}
          onSave={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}