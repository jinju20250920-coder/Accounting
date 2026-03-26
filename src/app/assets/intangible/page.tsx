'use client';

import { useState, useEffect } from 'react';
import { useIntangibleAssetStore } from '@/stores/useIntangibleAssetStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Search,
  Edit,
  Trash2,
  Download,
  Upload,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';
import type { IntangibleAsset, IntangibleAssetType } from '@/types';
import { getAmortizationMethodName, getIntangibleAssetTypeName } from '@/lib/amortization';

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 资产类型选项
const assetTypeOptions: { value: IntangibleAssetType; label: string }[] = [
  { value: 'patent', label: '专利权' },
  { value: 'trademark', label: '商标权' },
  { value: 'software', label: '软件' },
  { value: 'copyright', label: '著作权' },
  { value: 'goodwill', label: '商誉' },
  { value: 'other', label: '其他' },
];

// 资产卡片对话框组件
function IntangibleAssetDialog({
  open,
  onOpenChange,
  asset,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: IntangibleAsset | null;
  onSave: (data: Partial<IntangibleAsset>) => void;
}) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<Partial<IntangibleAsset>>({
    assetCode: '',
    assetName: '',
    assetType: 'software',
    originalValue: 0,
    residualValue: 0,
    accumulatedAmortization: 0,
    amortizationMethod: 'straight_line',
    usefulLifeYears: 10,
    usefulLifeMonths: 120,
    acquisitionDate: new Date().toISOString().split('T')[0],
    registrationNo: '',
    departmentCode: '',
    expenseSubjectCode: '660205',
    notes: '',
  });

  useEffect(() => {
    if (asset) {
      setFormData(asset);
    } else {
      setFormData({
        assetCode: '',
        assetName: '',
        assetType: 'software',
        originalValue: 0,
        residualValue: 0,
        accumulatedAmortization: 0,
        amortizationMethod: 'straight_line',
        usefulLifeYears: 10,
        usefulLifeMonths: 120,
        acquisitionDate: new Date().toISOString().split('T')[0],
        registrationNo: '',
        departmentCode: '',
        expenseSubjectCode: '660205',
        notes: '',
      });
    }
  }, [asset, open]);

  const handleSubmit = () => {
    if (!formData.assetName) {
      showToast('error', '请输入资产名称');
      return;
    }
    if (!formData.originalValue || formData.originalValue <= 0) {
      showToast('error', '请输入有效的原值');
      return;
    }
    if (!formData.acquisitionDate) {
      showToast('error', '请选择购置日期');
      return;
    }

    onSave({
      ...formData,
      assetCode: formData.assetCode || `IA-${Date.now()}`,
      usefulLifeMonths: (formData.usefulLifeYears || 10) * 12,
      assetSubjectCode: '1701',
      assetSubjectName: '无形资产',
      amortizationSubjectCode: '1702',
      amortizationSubjectName: '累计摊销',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? '编辑无形资产' : '新增无形资产'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>资产编码</Label>
            <Input
              value={formData.assetCode || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, assetCode: e.target.value }))}
              placeholder="自动生成或手动输入"
            />
          </div>

          <div className="space-y-2">
            <Label required>资产名称</Label>
            <Input
              value={formData.assetName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, assetName: e.target.value }))}
              placeholder="请输入资产名称"
            />
          </div>

          <div className="space-y-2">
            <Label>资产类型</Label>
            <Select
              value={formData.assetType || 'software'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, assetType: v as IntangibleAssetType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assetTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>登记号</Label>
            <Input
              value={formData.registrationNo || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, registrationNo: e.target.value }))}
              placeholder="专利号/商标号等"
            />
          </div>

          <div className="space-y-2">
            <Label required>原值</Label>
            <Input
              type="number"
              value={formData.originalValue || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                originalValue: parseFloat(e.target.value) || 0
              }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>残值</Label>
            <Input
              type="number"
              value={formData.residualValue || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                residualValue: parseFloat(e.target.value) || 0
              }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>摊销方法</Label>
            <Select
              value={formData.amortizationMethod || 'straight_line'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, amortizationMethod: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="straight_line">直线法</SelectItem>
                <SelectItem value="units_of_production">产量法</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>使用年限（年）</Label>
            <Input
              type="number"
              value={formData.usefulLifeYears || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                usefulLifeYears: parseInt(e.target.value) || 10
              }))}
              placeholder="10"
            />
          </div>

          <div className="space-y-2">
            <Label required>购置日期</Label>
            <Input
              type="date"
              value={formData.acquisitionDate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, acquisitionDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>到期日期</Label>
            <Input
              type="date"
              value={formData.expiryDate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>费用科目</Label>
            <Input
              value={formData.expenseSubjectCode || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, expenseSubjectCode: e.target.value }))}
              placeholder="660205"
            />
          </div>

          <div className="space-y-2">
            <Label>使用部门</Label>
            <Input
              value={formData.departmentCode || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, departmentCode: e.target.value }))}
              placeholder="请输入部门代码"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>备注</Label>
            <Input
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="请输入备注"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 确认删除对话框
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="py-4 text-sm text-slate-600">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="destructive" onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function IntangibleAssetsPage() {
  const {
    assets,
    loading,
    addAsset,
    updateAsset,
    deleteAsset,
    initialize,
  } = useIntangibleAssetStore();

  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<IntangibleAsset | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 应用筛选
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = !searchQuery ||
      asset.assetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.assetName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || asset.assetType === typeFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleSave = async (data: Partial<IntangibleAsset>) => {
    try {
      if (selectedAsset) {
        await updateAsset(selectedAsset.id, data);
        showToast('success', '资产更新成功');
      } else {
        await addAsset(data as any);
        showToast('success', '资产添加成功');
      }
      setShowAddDialog(false);
      setSelectedAsset(null);
    } catch (error: any) {
      showToast('error', error.message || '操作失败');
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;
    try {
      await deleteAsset(selectedAsset.id);
      showToast('success', '资产删除成功');
      setSelectedAsset(null);
    } catch (error: any) {
      showToast('error', error.message || '删除失败');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: '在用', variant: 'default' },
      disposed: { label: '已处置', variant: 'secondary' },
      fully_amortized: { label: '已摊完', variant: 'outline' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 统计数据
  const totalOriginalValue = assets.reduce((sum, a) => sum + a.originalValue, 0);
  const totalAmortization = assets.reduce((sum, a) => sum + a.accumulatedAmortization, 0);
  const totalNetValue = assets.reduce((sum, a) => sum + a.netValue, 0);
  const activeCount = assets.filter(a => a.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6" />
            无形资产管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">管理专利、商标、软件等无形资产</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            导入
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button onClick={() => {
            setSelectedAsset(null);
            setShowAddDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            新增资产
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">资产数量</div>
            <div className="text-2xl font-bold">{assets.length} <span className="text-sm font-normal text-slate-400">在用 {activeCount}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">原值合计</div>
            <div className="text-2xl font-bold">¥{formatMoney(totalOriginalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">累计摊销</div>
            <div className="text-2xl font-bold text-orange-600">¥{formatMoney(totalAmortization)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">净值合计</div>
            <div className="text-2xl font-bold text-blue-600">¥{formatMoney(totalNetValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索资产编码或名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {assetTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">在用</SelectItem>
                <SelectItem value="disposed">已处置</SelectItem>
                <SelectItem value="fully_amortized">已摊完</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 资产列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-4 font-medium text-sm">资产编码</th>
                  <th className="text-left p-4 font-medium text-sm">资产名称</th>
                  <th className="text-left p-4 font-medium text-sm">类型</th>
                  <th className="text-right p-4 font-medium text-sm">原值</th>
                  <th className="text-right p-4 font-medium text-sm">累计摊销</th>
                  <th className="text-right p-4 font-medium text-sm">净值</th>
                  <th className="text-left p-4 font-medium text-sm">摊销方法</th>
                  <th className="text-left p-4 font-medium text-sm">购置日期</th>
                  <th className="text-left p-4 font-medium text-sm">状态</th>
                  <th className="text-center p-4 font-medium text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center p-8 text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center p-8 text-slate-500">
                      暂无资产数据
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="border-b hover:bg-slate-50">
                      <td className="p-4 text-sm font-mono">{asset.assetCode}</td>
                      <td className="p-4 text-sm font-medium">{asset.assetName}</td>
                      <td className="p-4 text-sm text-slate-600">{getIntangibleAssetTypeName(asset.assetType)}</td>
                      <td className="p-4 text-sm text-right">¥{formatMoney(asset.originalValue)}</td>
                      <td className="p-4 text-sm text-right text-orange-600">¥{formatMoney(asset.accumulatedAmortization)}</td>
                      <td className="p-4 text-sm text-right font-medium">¥{formatMoney(asset.netValue)}</td>
                      <td className="p-4 text-sm">{getAmortizationMethodName(asset.amortizationMethod)}</td>
                      <td className="p-4 text-sm">{asset.acquisitionDate}</td>
                      <td className="p-4">{getStatusBadge(asset.status)}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowAddDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 资产卡片对话框 */}
      <IntangibleAssetDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        asset={selectedAsset}
        onSave={handleSave}
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认删除"
        message={`确定要删除无形资产 "${selectedAsset?.assetName}" 吗？此操作不可撤销。`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
