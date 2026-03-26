'use client';

import { useState, useEffect } from 'react';
import { useIntangibleAssetStore } from '@/stores/useIntangibleAssetStore';
import { usePrepaidExpenseStore } from '@/stores/usePrepaidExpenseStore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import {
  Search,
  ArrowDownCircle,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Clock,
  FileText,
} from 'lucide-react';
import type { BatchAmortizationResult } from '@/types';
import { getIntangibleAssetTypeName, getPrepaidExpenseTypeName } from '@/lib/amortization';

export default function BatchAmortizationPage() {
  const {
    assets: intangibleAssets,
    amortizationRecords: intangibleRecords,
    loading: intangibleLoading,
    initialize: initIntangible,
    batchCalculateAmortization: batchCalcIntangible,
    saveAmortizationRecords: saveIntangibleRecords,
    postAmortizationRecords: postIntangibleRecords,
    generateAmortizationVoucher: generateIntangibleVoucher,
  } = useIntangibleAssetStore();

  const {
    expenses: prepaidExpenses,
    amortizationRecords: prepaidRecords,
    loading: prepaidLoading,
    initialize: initPrepaid,
    batchCalculateAmortization: batchCalcPrepaid,
    saveAmortizationRecords: savePrepaidRecords,
    postAmortizationRecords: postPrepaidRecords,
    generateAmortizationVoucher: generatePrepaidVoucher,
  } = usePrepaidExpenseStore();

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'intangible' | 'prepaid'>('intangible');
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedIntangibleIds, setSelectedIntangibleIds] = useState<Set<string>>(new Set());
  const [selectedPrepaidIds, setSelectedPrepaidIds] = useState<Set<string>>(new Set());
  const [previewResult, setPreviewResult] = useState<BatchAmortizationResult | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    initIntangible();
    initPrepaid();
  }, [initIntangible, initPrepaid]);

  // 获取在用资产
  const activeIntangibles = intangibleAssets.filter(a => a.status === 'active');
  const activePrepaid = prepaidExpenses.filter(e => e.status === 'active');

  // 应用筛选
  const filteredIntangibles = activeIntangibles.filter(asset => {
    return !searchQuery ||
      asset.assetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.assetName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredPrepaid = activePrepaid.filter(expense => {
    return !searchQuery ||
      expense.expenseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.expenseName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 获取本期已摊销的ID
  const amortizedIntangibleIds = new Set(
    intangibleRecords
      .filter(r => r.period === period && r.status !== 'draft')
      .map(r => r.entityId)
  );
  const amortizedPrepaidIds = new Set(
    prepaidRecords
      .filter(r => r.period === period && r.status !== 'draft')
      .map(r => r.entityId)
  );

  // 切换选择
  const toggleIntangibleSelection = (id: string) => {
    const newSelected = new Set(selectedIntangibleIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIntangibleIds(newSelected);
  };

  const togglePrepaidSelection = (id: string) => {
    const newSelected = new Set(selectedPrepaidIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPrepaidIds(newSelected);
  };

  // 全选
  const toggleSelectAllIntangible = () => {
    if (selectedIntangibleIds.size === filteredIntangibles.length) {
      setSelectedIntangibleIds(new Set());
    } else {
      setSelectedIntangibleIds(new Set(filteredIntangibles.map(a => a.id)));
    }
  };

  const toggleSelectAllPrepaid = () => {
    if (selectedPrepaidIds.size === filteredPrepaid.length) {
      setSelectedPrepaidIds(new Set());
    } else {
      setSelectedPrepaidIds(new Set(filteredPrepaid.map(e => e.id)));
    }
  };

  // 预览摊销
  const handlePreview = () => {
    if (activeTab === 'intangible') {
      if (selectedIntangibleIds.size === 0) {
        showToast('warning', '请先选择要摊销的资产');
        return;
      }
      const result = batchCalcIntangible(Array.from(selectedIntangibleIds), period);
      setPreviewResult(result);
    } else {
      if (selectedPrepaidIds.size === 0) {
        showToast('warning', '请先选择要摊销的费用');
        return;
      }
      const result = batchCalcPrepaid(Array.from(selectedPrepaidIds), period);
      setPreviewResult(result);
    }
    setShowPreviewDialog(true);
  };

  // 执行摊销
  const handleExecute = async () => {
    if (!previewResult || previewResult.records.length === 0) {
      showToast('warning', '没有可摊销的记录');
      return;
    }

    setIsProcessing(true);
    try {
      if (activeTab === 'intangible') {
        await saveIntangibleRecords(previewResult.records);
        setSelectedIntangibleIds(new Set());
      } else {
        await savePrepaidRecords(previewResult.records);
        setSelectedPrepaidIds(new Set());
      }
      showToast('success', `成功生成 ${previewResult.records.length} 条摊销记录`);
      setPreviewResult(null);
      setShowPreviewDialog(false);
    } catch (error: any) {
      showToast('error', error.message || '摊销处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 记账
  const handlePost = async (recordIds: string[], type: 'intangible' | 'prepaid') => {
    try {
      if (type === 'intangible') {
        await postIntangibleRecords(recordIds);
      } else {
        await postPrepaidRecords(recordIds);
      }
      showToast('success', '记账成功');
    } catch (error: any) {
      showToast('error', error.message || '记账失败');
    }
  };

  // 生成凭证
  const handleGenerateVoucher = async (recordIds: string[], type: 'intangible' | 'prepaid') => {
    try {
      const voucherDate = `${period}-28`; // 默认使用期间末日期
      if (type === 'intangible') {
        const result = await generateIntangibleVoucher(recordIds, voucherDate);
        if (result) {
          showToast('success', `凭证 ${result.voucherNo} 生成成功`);
        }
      } else {
        const result = await generatePrepaidVoucher(recordIds, voucherDate);
        if (result) {
          showToast('success', `凭证 ${result.voucherNo} 生成成功`);
        }
      }
    } catch (error: any) {
      showToast('error', error.message || '生成凭证失败');
    }
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 本期草稿记录
  const draftIntangibleRecords = intangibleRecords.filter(r => r.period === period && r.status === 'draft');
  const draftPrepaidRecords = prepaidRecords.filter(r => r.period === period && r.status === 'draft');

  // 统计数据
  const intangibleTotalOriginal = activeIntangibles.reduce((sum, a) => sum + a.originalValue, 0);
  const intangibleTotalAmort = activeIntangibles.reduce((sum, a) => sum + a.accumulatedAmortization, 0);
  const prepaidTotalOriginal = activePrepaid.reduce((sum, e) => sum + e.originalAmount, 0);
  const prepaidTotalAmort = activePrepaid.reduce((sum, e) => sum + e.amortizedAmount, 0);

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowDownCircle className="h-6 w-6" />
            批量摊销处理
          </h1>
          <p className="text-slate-500 text-sm mt-1">选择无形资产或待摊费用进行批量摊销</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">摊销期间:</span>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* 本期草稿记录提示 */}
      {(draftIntangibleRecords.length > 0 || draftPrepaidRecords.length > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm">
                  本期有 <strong>{draftIntangibleRecords.length + draftPrepaidRecords.length}</strong> 条草稿摊销记录
                </span>
              </div>
              <div className="flex gap-2">
                {draftIntangibleRecords.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateVoucher(draftIntangibleRecords.map(r => r.id), 'intangible')}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      生成凭证
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePost(draftIntangibleRecords.map(r => r.id), 'intangible')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      记账
                    </Button>
                  </>
                )}
                {draftPrepaidRecords.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateVoucher(draftPrepaidRecords.map(r => r.id), 'prepaid')}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      生成凭证
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePost(draftPrepaidRecords.map(r => r.id), 'prepaid')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      记账
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'intangible' | 'prepaid')}>
        <TabsList>
          <TabsTrigger value="intangible" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            无形资产
          </TabsTrigger>
          <TabsTrigger value="prepaid" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            待摊费用
          </TabsTrigger>
        </TabsList>

        {/* 无形资产Tab */}
        <TabsContent value="intangible" className="space-y-4">
          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">在用资产</div>
                <div className="text-2xl font-bold">{activeIntangibles.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">原值合计</div>
                <div className="text-2xl font-bold">¥{formatMoney(intangibleTotalOriginal)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">累计摊销</div>
                <div className="text-2xl font-bold text-orange-600">¥{formatMoney(intangibleTotalAmort)}</div>
              </CardContent>
            </Card>
          </div>

          {/* 资产选择 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">选择摊销资产</CardTitle>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={toggleSelectAllIntangible}>
                    {selectedIntangibleIds.size === filteredIntangibles.length ? '取消全选' : '全选'}
                  </Button>
                  <span className="text-sm text-slate-600">
                    已选择 <strong>{selectedIntangibleIds.size}</strong> 项
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
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
                <Button onClick={handlePreview} disabled={selectedIntangibleIds.size === 0}>
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  预览摊销
                </Button>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="w-10 p-3">
                        <Checkbox
                          checked={selectedIntangibleIds.size === filteredIntangibles.length && filteredIntangibles.length > 0}
                          onCheckedChange={toggleSelectAllIntangible}
                        />
                      </th>
                      <th className="text-left p-3 font-medium text-sm">资产编码</th>
                      <th className="text-left p-3 font-medium text-sm">资产名称</th>
                      <th className="text-left p-3 font-medium text-sm">类型</th>
                      <th className="text-right p-3 font-medium text-sm">原值</th>
                      <th className="text-right p-3 font-medium text-sm">累计摊销</th>
                      <th className="text-right p-3 font-medium text-sm">净值</th>
                      <th className="text-left p-3 font-medium text-sm">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intangibleLoading ? (
                      <tr>
                        <td colSpan={8} className="text-center p-8 text-slate-500">加载中...</td>
                      </tr>
                    ) : filteredIntangibles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center p-8 text-slate-500">暂无在用资产</td>
                      </tr>
                    ) : (
                      filteredIntangibles.map((asset) => {
                        const isAmortized = amortizedIntangibleIds.has(asset.id);
                        return (
                          <tr key={asset.id} className={`border-b hover:bg-slate-50 ${isAmortized ? 'bg-slate-100' : ''}`}>
                            <td className="w-10 p-3">
                              <Checkbox
                                checked={selectedIntangibleIds.has(asset.id)}
                                onCheckedChange={() => toggleIntangibleSelection(asset.id)}
                                disabled={isAmortized}
                              />
                            </td>
                            <td className="p-3 text-sm font-mono">{asset.assetCode}</td>
                            <td className="p-3 text-sm font-medium">{asset.assetName}</td>
                            <td className="p-3 text-sm">{getIntangibleAssetTypeName(asset.assetType)}</td>
                            <td className="p-3 text-sm text-right">¥{formatMoney(asset.originalValue)}</td>
                            <td className="p-3 text-sm text-right text-orange-600">¥{formatMoney(asset.accumulatedAmortization)}</td>
                            <td className="p-3 text-sm text-right font-medium">¥{formatMoney(asset.netValue)}</td>
                            <td className="p-3">
                              {isAmortized ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800">已摊销</Badge>
                              ) : (
                                <Badge>待摊销</Badge>
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
        </TabsContent>

        {/* 待摊费用Tab */}
        <TabsContent value="prepaid" className="space-y-4">
          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">在摊费用</div>
                <div className="text-2xl font-bold">{activePrepaid.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">原始金额</div>
                <div className="text-2xl font-bold">¥{formatMoney(prepaidTotalOriginal)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">已摊销金额</div>
                <div className="text-2xl font-bold text-orange-600">¥{formatMoney(prepaidTotalAmort)}</div>
              </CardContent>
            </Card>
          </div>

          {/* 费用选择 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">选择摊销费用</CardTitle>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={toggleSelectAllPrepaid}>
                    {selectedPrepaidIds.size === filteredPrepaid.length ? '取消全选' : '全选'}
                  </Button>
                  <span className="text-sm text-slate-600">
                    已选择 <strong>{selectedPrepaidIds.size}</strong> 项
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="搜索费用编码或名称..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button onClick={handlePreview} disabled={selectedPrepaidIds.size === 0}>
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  预览摊销
                </Button>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="w-10 p-3">
                        <Checkbox
                          checked={selectedPrepaidIds.size === filteredPrepaid.length && filteredPrepaid.length > 0}
                          onCheckedChange={toggleSelectAllPrepaid}
                        />
                      </th>
                      <th className="text-left p-3 font-medium text-sm">费用编码</th>
                      <th className="text-left p-3 font-medium text-sm">费用名称</th>
                      <th className="text-left p-3 font-medium text-sm">类型</th>
                      <th className="text-right p-3 font-medium text-sm">原始金额</th>
                      <th className="text-right p-3 font-medium text-sm">已摊销</th>
                      <th className="text-right p-3 font-medium text-sm">剩余金额</th>
                      <th className="text-left p-3 font-medium text-sm">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepaidLoading ? (
                      <tr>
                        <td colSpan={8} className="text-center p-8 text-slate-500">加载中...</td>
                      </tr>
                    ) : filteredPrepaid.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center p-8 text-slate-500">暂无在摊费用</td>
                      </tr>
                    ) : (
                      filteredPrepaid.map((expense) => {
                        const isAmortized = amortizedPrepaidIds.has(expense.id);
                        return (
                          <tr key={expense.id} className={`border-b hover:bg-slate-50 ${isAmortized ? 'bg-slate-100' : ''}`}>
                            <td className="w-10 p-3">
                              <Checkbox
                                checked={selectedPrepaidIds.has(expense.id)}
                                onCheckedChange={() => togglePrepaidSelection(expense.id)}
                                disabled={isAmortized}
                              />
                            </td>
                            <td className="p-3 text-sm font-mono">{expense.expenseCode}</td>
                            <td className="p-3 text-sm font-medium">{expense.expenseName}</td>
                            <td className="p-3 text-sm">{getPrepaidExpenseTypeName(expense.expenseType)}</td>
                            <td className="p-3 text-sm text-right">¥{formatMoney(expense.originalAmount)}</td>
                            <td className="p-3 text-sm text-right text-orange-600">¥{formatMoney(expense.amortizedAmount)}</td>
                            <td className="p-3 text-sm text-right font-medium">¥{formatMoney(expense.remainingAmount)}</td>
                            <td className="p-3">
                              {isAmortized ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800">已摊销</Badge>
                              ) : (
                                <Badge>待摊销</Badge>
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
        </TabsContent>
      </Tabs>

      {/* 预览对话框 */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>摊销预览 - {period}</DialogTitle>
          </DialogHeader>

          {previewResult && (
            <div className="space-y-4">
              {/* 汇总信息 */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <div className="text-sm text-slate-500">摊销数量</div>
                  <div className="text-xl font-bold">{previewResult.entityCount}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">本期摊销总额</div>
                  <div className="text-xl font-bold text-orange-600">¥{formatMoney(previewResult.totalAmortization)}</div>
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
                    以下项目无法摊销:
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {previewResult.errors.map((err, idx) => (
                      <li key={idx}>• {err.entityName}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 摊销明细 */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-3 font-medium text-sm">编码</th>
                      <th className="text-left p-3 font-medium text-sm">名称</th>
                      <th className="text-right p-3 font-medium text-sm">本期摊销</th>
                      <th className="text-right p-3 font-medium text-sm">累计摊销</th>
                      <th className="text-right p-3 font-medium text-sm">剩余金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.records.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="p-3 text-sm font-mono">{record.entityCode}</td>
                        <td className="p-3 text-sm font-medium">{record.entityName}</td>
                        <td className="p-3 text-sm text-right font-medium text-blue-600">
                          ¥{formatMoney(record.periodAmortization)}
                        </td>
                        <td className="p-3 text-sm text-right text-orange-600">
                          ¥{formatMoney(record.accumulatedAmortization)}
                        </td>
                        <td className="p-3 text-sm text-right font-medium">
                          ¥{formatMoney(record.remainingAmount)}
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
