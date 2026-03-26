'use client';

import { useState, useEffect } from 'react';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import {
  Search,
  Calculator,
  FileText,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { FixedAsset, DepreciationRecord, BatchDepreciationResult } from '@/types';
import { getDepreciationMethodName } from '@/lib/depreciation';

export default function BatchDepreciationPage() {
  const {
    assets,
    depreciationRecords,
    loading,
    initialize,
    batchCalculateDepreciation,
    saveDepreciationRecords,
    postDepreciationRecords,
    generateDepreciationVoucher,
  } = useFixedAssetStore();

  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [previewResult, setPreviewResult] = useState<BatchDepreciationResult | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 获取在用资产
  const activeAssets = assets.filter(a => a.status === 'active');

  // 应用筛选
  const filteredAssets = activeAssets.filter(asset => {
    const matchesSearch = !searchQuery ||
      asset.assetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.assetName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || asset.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // 获取本月已折旧的资产ID
  const depreciatedAssetIdsThisPeriod = new Set(
    depreciationRecords
      .filter(r => r.period === period && r.status !== 'draft')
      .map(r => r.assetId)
  );

  // 切换资产选择
  const toggleAssetSelection = (assetId: string) => {
    const newSelected = new Set(selectedAssetIds);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssetIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedAssetIds.size === filteredAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  // 预览折旧
  const handlePreview = () => {
    if (selectedAssetIds.size === 0) {
      showToast('warning', '请先选择要折旧的资产');
      return;
    }

    const result = batchCalculateDepreciation(Array.from(selectedAssetIds), period);
    setPreviewResult(result);
    setShowPreviewDialog(true);
  };

  // 执行折旧
  const handleExecute = async () => {
    if (!previewResult || previewResult.records.length === 0) {
      showToast('warning', '没有可折旧的记录');
      return;
    }

    setIsProcessing(true);
    try {
      // 保存折旧记录
      await saveDepreciationRecords(previewResult.records);
      showToast('success', `成功生成 ${previewResult.records.length} 条折旧记录`);

      // 清空选择
      setSelectedAssetIds(new Set());
      setPreviewResult(null);
      setShowPreviewDialog(false);
    } catch (error: any) {
      showToast('error', error.message || '折旧处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 记账
  const handlePost = async (recordIds: string[]) => {
    try {
      await postDepreciationRecords(recordIds);
      showToast('success', '记账成功');
    } catch (error: any) {
      showToast('error', error.message || '记账失败');
    }
  };

  // 生成凭证
  const handleGenerateVoucher = async (recordIds: string[]) => {
    try {
      const voucherDate = `${period}-28`; // 默认使用期间末日期
      const result = await generateDepreciationVoucher(recordIds, voucherDate);
      if (result) {
        showToast('success', `凭证 ${result.voucherNo} 生成成功`);
      }
    } catch (error: any) {
      showToast('error', error.message || '生成凭证失败');
    }
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 本期草稿记录
  const draftRecords = depreciationRecords.filter(r => r.period === period && r.status === 'draft');
  const draftTotalAmount = draftRecords.reduce((sum, r) => sum + r.periodDepreciation, 0);

  // 统计数据
  const totalOriginalValue = activeAssets.reduce((sum, a) => sum + a.originalValue, 0);
  const totalDepreciation = activeAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);
  const totalNetValue = activeAssets.reduce((sum, a) => sum + a.netValue, 0);

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            批量折旧处理
          </h1>
          <p className="text-slate-500 text-sm mt-1">选择资产进行批量折旧计算</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">折旧期间:</span>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">在用资产</div>
            <div className="text-2xl font-bold">{activeAssets.length}</div>
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
            <div className="text-sm text-slate-500">累计折旧</div>
            <div className="text-2xl font-bold text-orange-600">¥{formatMoney(totalDepreciation)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">净值合计</div>
            <div className="text-2xl font-bold text-blue-600">¥{formatMoney(totalNetValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 本期草稿记录提示 */}
      {draftRecords.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm">
                  本期有 <strong>{draftRecords.length}</strong> 条草稿折旧记录，
                  合计金额: <strong>¥{formatMoney(draftTotalAmount)}</strong>
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateVoucher(draftRecords.map(r => r.id))}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  生成凭证
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePost(draftRecords.map(r => r.id))}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  记账
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 资产选择区域 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">选择折旧资产</CardTitle>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedAssetIds.size === filteredAssets.length ? '取消全选' : '全选'}
              </Button>
              <span className="text-sm text-slate-600">
                已选择 <strong>{selectedAssetIds.size}</strong> 项
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {/* 筛选 */}
          <div className="flex gap-4 mb-4">
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {/* 可以从store获取分类列表 */}
              </SelectContent>
            </Select>
            <Button onClick={handlePreview} disabled={selectedAssetIds.size === 0}>
              <Calculator className="h-4 w-4 mr-2" />
              预览折旧
            </Button>
          </div>

          {/* 资产列表 */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="w-10 p-3">
                    <Checkbox
                      checked={selectedAssetIds.size === filteredAssets.length && filteredAssets.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left p-3 font-medium text-sm">资产编码</th>
                  <th className="text-left p-3 font-medium text-sm">资产名称</th>
                  <th className="text-right p-3 font-medium text-sm">原值</th>
                  <th className="text-right p-3 font-medium text-sm">累计折旧</th>
                  <th className="text-right p-3 font-medium text-sm">净值</th>
                  <th className="text-left p-3 font-medium text-sm">折旧方法</th>
                  <th className="text-left p-3 font-medium text-sm">状态</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-slate-500">
                      暂无在用资产
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    const isDepreciated = depreciatedAssetIdsThisPeriod.has(asset.id);
                    return (
                      <tr
                        key={asset.id}
                        className={`border-b hover:bg-slate-50 ${isDepreciated ? 'bg-slate-100' : ''}`}
                      >
                        <td className="w-10 p-3">
                          <Checkbox
                            checked={selectedAssetIds.has(asset.id)}
                            onCheckedChange={() => toggleAssetSelection(asset.id)}
                            disabled={isDepreciated}
                          />
                        </td>
                        <td className="p-3 text-sm font-mono">{asset.assetCode}</td>
                        <td className="p-3 text-sm font-medium">{asset.assetName}</td>
                        <td className="p-3 text-sm text-right">¥{formatMoney(asset.originalValue)}</td>
                        <td className="p-3 text-sm text-right text-orange-600">¥{formatMoney(asset.accumulatedDepreciation)}</td>
                        <td className="p-3 text-sm text-right font-medium">¥{formatMoney(asset.netValue)}</td>
                        <td className="p-3 text-sm">{getDepreciationMethodName(asset.depreciationMethod)}</td>
                        <td className="p-3">
                          {isDepreciated ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800">已折旧</Badge>
                          ) : (
                            <Badge>待折旧</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 预览对话框 */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>折旧预览 - {period}</DialogTitle>
          </DialogHeader>

          {previewResult && (
            <div className="space-y-4">
              {/* 汇总信息 */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <div className="text-sm text-slate-500">折旧资产数</div>
                  <div className="text-xl font-bold">{previewResult.assetCount}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">本期折旧总额</div>
                  <div className="text-xl font-bold text-orange-600">¥{formatMoney(previewResult.totalDepreciation)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">期间</div>
                  <div className="text-xl font-bold">{previewResult.period}</div>
                </div>
              </div>

              {/* 错误信息 */}
              {previewResult.errors.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm font-medium text-red-800 mb-2">
                    以下资产无法折旧:
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {previewResult.errors.map((err, idx) => (
                      <li key={idx}>• {err.assetName}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 折旧明细 */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-3 font-medium text-sm">资产编码</th>
                      <th className="text-left p-3 font-medium text-sm">资产名称</th>
                      <th className="text-right p-3 font-medium text-sm">原值</th>
                      <th className="text-right p-3 font-medium text-sm">累计折旧</th>
                      <th className="text-right p-3 font-medium text-sm">本期折旧</th>
                      <th className="text-right p-3 font-medium text-sm">折旧后净值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.records.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="p-3 text-sm font-mono">{record.assetCode}</td>
                        <td className="p-3 text-sm font-medium">{record.assetName}</td>
                        <td className="p-3 text-sm text-right">
                          ¥{formatMoney(assets.find(a => a.id === record.assetId)?.originalValue || 0)}
                        </td>
                        <td className="p-3 text-sm text-right text-orange-600">
                          ¥{formatMoney(record.accumulatedDepreciation - record.periodDepreciation)}
                        </td>
                        <td className="p-3 text-sm text-right font-medium text-blue-600">
                          ¥{formatMoney(record.periodDepreciation)}
                        </td>
                        <td className="p-3 text-sm text-right font-medium">
                          ¥{formatMoney(record.netValueAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              取消
            </Button>
            <Button onClick={handleExecute} disabled={isProcessing || !previewResult || previewResult.records.length === 0}>
              {isProcessing ? '处理中...' : '确认生成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
