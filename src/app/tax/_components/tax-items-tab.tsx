'use client';

import React, { useState } from 'react';
import { Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTaxStore } from '@/stores/useTaxStore';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { TaxItem, TaxType, TaxDeadlineType, TaxApplicability } from '@/types';

const TAX_TYPE_LABELS: Record<TaxType, string> = {
  vat: '增值税',
  corporate: '企业所得税',
  personal: '个人所得税',
  consumption: '消费税',
  stamp: '印花税',
  property: '房产税',
  city_construction: '城市维护建设税',
  education_surcharge: '教育费附加',
  local_education: '地方教育附加',
  environmental: '环境保护税',
  disability: '残疾人就业保障金',
  land_value: '土地增值税',
  vehicle: '车船税',
  land_use: '城镇土地使用税',
  other: '其他',
};

const DEADLINE_TYPE_LABELS: Record<TaxDeadlineType, string> = {
  monthly: '按月',
  quarterly: '按季',
  half_yearly: '半年',
  annual: '按年',
};

const APPLICABLE_LABELS: Record<TaxApplicability, string> = {
  small: '小规模纳税人',
  general: '一般纳税人',
  both: '通用',
};

export function TaxItemsTab() {
  const taxItems = useTaxStore(s => s.taxItems);
  const toggleTaxItem = useTaxStore(s => s.toggleTaxItem);
  const updateTaxItem = useTaxStore(s => s.updateTaxItem);
  const deleteTaxItem = useTaxStore(s => s.deleteTaxItem);
  const addTaxItem = useTaxStore(s => s.addTaxItem);
  const hasSettingsPermission = usePermission('settings');
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<TaxItem | null>(null);

  // New item form state
  const [newItem, setNewItem] = useState({
    taxName: '',
    taxType: 'other' as TaxType,
    deadlineType: 'quarterly' as TaxDeadlineType,
    deadlineDays: 15,
    applicableTaxpayerType: 'both' as TaxApplicability,
  });

  // Edit item form state
  const [editForm, setEditForm] = useState({
    taxName: '',
    deadlineDays: 15,
    graceDays: 0,
  });

  const filteredItems = taxItems.filter(item => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.taxName.toLowerCase().includes(q) ||
      TAX_TYPE_LABELS[item.taxType].toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    // Sort by sortOrder first, then by taxName
    if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
      return a.sortOrder - b.sortOrder;
    }
    return a.taxName.localeCompare(b.taxName);
  });

  const handleToggle = async (item: TaxItem, enabled: boolean) => {
    if (!hasSettingsPermission) {
      toast({ type: 'error', title: '无权限修改税种配置' });
      return;
    }
    try {
      await toggleTaxItem(item.id, enabled);
      toast({ type: 'success', title: enabled ? '已启用税种' : '已禁用税种' });
    } catch (err) {
      toast({ type: 'error', title: '操作失败' });
    }
  };

  const handleDelete = async (item: TaxItem) => {
    if (!hasSettingsPermission) {
      toast({ type: 'error', title: '无权限删除税种' });
      return;
    }
    if (item.isBuiltIn) {
      toast({ type: 'warning', title: '预置税种不可删除' });
      return;
    }
    try {
      await deleteTaxItem(item.id);
      toast({ type: 'success', title: '已删除自定义税种' });
    } catch (err) {
      toast({ type: 'error', title: '删除失败' });
    }
  };

  const handleAdd = async () => {
    if (!hasSettingsPermission) {
      toast({ type: 'error', title: '无权限添加税种' });
      return;
    }
    if (!newItem.taxName.trim()) {
      toast({ type: 'warning', title: '请输入税种名称' });
      return;
    }
    try {
      await addTaxItem({
        ...newItem,
        isBuiltIn: false,
        isEnabled: true,
        graceDays: 0,
        sortOrder: 999,
        description: '',
      });
      toast({ type: 'success', title: '已添加自定义税种' });
      setNewItem({
        taxName: '',
        taxType: 'other',
        deadlineType: 'quarterly',
        deadlineDays: 15,
        applicableTaxpayerType: 'both',
      });
      setShowAddForm(false);
    } catch (err) {
      toast({ type: 'error', title: '添加失败' });
    }
  };

  const handleStartEdit = (item: TaxItem) => {
    if (!hasSettingsPermission) {
      toast({ type: 'error', title: '无权限编辑税种' });
      return;
    }
    setEditingItem(item);
    setEditForm({
      taxName: item.taxName,
      deadlineDays: item.deadlineDays,
      graceDays: item.graceDays,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await updateTaxItem(editingItem.id, {
        taxName: editForm.taxName,
        deadlineDays: editForm.deadlineDays,
        graceDays: editForm.graceDays,
      });
      toast({ type: 'success', title: '已更新税种配置' });
      setEditingItem(null);
    } catch (err) {
      toast({ type: 'error', title: '更新失败' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索税种名称或类型"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {hasSettingsPermission && (
          <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            新增自定义税种
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && hasSettingsPermission && (
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>税种名称</Label>
                <Input
                  value={newItem.taxName}
                  onChange={(e) => setNewItem({ ...newItem, taxName: e.target.value })}
                  placeholder="如：文化事业建设费"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label required>税种类型</Label>
                <Select value={newItem.taxType} onValueChange={(v: TaxType) => setNewItem({ ...newItem, taxType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAX_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label required>申报期限</Label>
                <Select value={newItem.deadlineType} onValueChange={(v: TaxDeadlineType) => setNewItem({ ...newItem, deadlineType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEADLINE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label required>截止天数</Label>
                <Input
                  type="number"
                  value={newItem.deadlineDays}
                  onChange={(e) => setNewItem({ ...newItem, deadlineDays: Number(e.target.value) || 0 })}
                  placeholder="如：15（次月15日）"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label required>适用纳税人</Label>
                <Select value={newItem.applicableTaxpayerType} onValueChange={(v: TaxApplicability) => setNewItem({ ...newItem, applicableTaxpayerType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(APPLICABLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleAdd} className="flex-1">
                  确认添加
                </Button>
                <Button onClick={() => setShowAddForm(false)} variant="outline">
                  取消
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <div className="border rounded-lg divide-y">
        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            暂无税种配置
          </div>
        )}
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`p-4 hover:bg-slate-50 transition-colors ${
              !item.isEnabled ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {/* Edit mode */}
                {editingItem?.id === item.id ? (
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <Input
                      value={editForm.taxName}
                      onChange={(e) => setEditForm({ ...editForm, taxName: e.target.value })}
                      autoComplete="off"
                    />
                    <div>
                      <Label>截止天数</Label>
                      <Input
                        type="number"
                        value={editForm.deadlineDays}
                        onChange={(e) => setEditForm({ ...editForm, deadlineDays: Number(e.target.value) || 0 })}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <Label>宽限天数</Label>
                      <Input
                        type="number"
                        value={editForm.graceDays}
                        onChange={(e) => setEditForm({ ...editForm, graceDays: Number(e.target.value) || 0 })}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className={`font-medium ${!item.isEnabled ? 'line-through text-slate-400' : ''}`}>
                        {item.taxName}
                      </div>
                      <Badge
                        className={
                          item.isBuiltIn
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-blue-50 text-blue-600'
                        }
                      >
                        {item.isBuiltIn ? '预置' : '自定义'}
                      </Badge>
                      <Badge className={item.isEnabled ? '' : 'bg-red-50 text-red-500'}>
                        {TAX_TYPE_LABELS[item.taxType]}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-500">
                      {DEADLINE_TYPE_LABELS[item.deadlineType]} · 次期{item.deadlineDays}日内
                      {item.graceDays > 0 && ` · 宽限期${item.graceDays}天`}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editingItem?.id === item.id ? (
                  <>
                    <Button onClick={handleSaveEdit} size="sm" variant="default">
                      保存
                    </Button>
                    <Button
                      onClick={() => setEditingItem(null)}
                      size="sm"
                      variant="outline"
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    {hasSettingsPermission && (
                      <Switch
                        checked={item.isEnabled}
                        onCheckedChange={(checked) => handleToggle(item, checked)}
                      />
                    )}
                    {hasSettingsPermission && (
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 hover:bg-slate-100 rounded"
                        title="编辑"
                      >
                        <Pencil className="h-4 w-4 text-slate-600" />
                      </button>
                    )}
                    {hasSettingsPermission && (
                      <button
                        onClick={() => handleDelete(item)}
                        className={`p-1.5 hover:bg-slate-100 rounded ${
                          item.isBuiltIn ? '' : 'hover:text-red-600'
                        }`}
                        title={item.isBuiltIn ? '预置税种不可删除' : '删除'}
                      >
                        <Trash2
                          className={`h-4 w-4 ${
                            item.isBuiltIn ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
