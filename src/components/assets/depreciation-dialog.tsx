'use client';

import { useState, useMemo } from 'react';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  Search,
  Calculator,
  FileText,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { FixedAsset, DepreciationRecord, BatchDepreciationResult, AssetCategory } from '@/types';
import { getDepreciationMethodName } from '@/lib/depreciation';
import { validateAccountingPeriod } from '@/lib/accounting';

// 格式化金额（不带货币符号）
const formatAmount = (value: number | undefined | null): string => {
  if (value === undefined || value === null || value === 0) return '0.00';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface DepreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: AssetCategory[];
}

export function DepreciationDialog({
  open,
  onOpenChange,
  categories,
}: DepreciationDialogProps) {
  const {
    assets,
    depreciationRecords,
    loading,
    batchCalculateDepreciation,
    saveDepreciationRecords,
    postDepreciationRecords,
    generateDepreciationVoucher,
    initialize,
  } = useFixedAssetStore();

  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // 获取当前账期
  const currentPeriod = useMemo(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) {
      return `${currentPeriodData.year}-${String(currentPeriodData.month).padStart(2, '0')}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [period, setPeriod] = useState<string>(currentPeriod);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [previewResult, setPreviewResult] = useState<BatchDepreciationResult | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 凭证入账状态
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  const [voucherDate, setVoucherDate] = useState<string>(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) {
      return currentPeriodData.endDate;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`;
  });
  const [isPosting, setIsPosting] = useState(false);

  // 获取科目列表
  const subjects = useSubjectStore((s) => s.subjects);

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

    // 检查是否有本月已计提折旧的资产
    const alreadyDepreciated = Array.from(selectedAssetIds).filter(id => depreciatedAssetIdsThisPeriod.has(id));
    if (alreadyDepreciated.length > 0) {
      const assetMap = new Map(assets.map(a => [a.id, a]));
      const assetNames = alreadyDepreciated
        .map(id => assetMap.get(id)?.assetCode)
        .filter(Boolean)
        .slice(0, 3)
        .join('、');
      showToast('warning', `${alreadyDepreciated.length} 个资产本月已计提折旧（${assetNames}...），将自动跳过`);
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
      await saveDepreciationRecords(previewResult.records);
      showToast('success', `成功生成 ${previewResult.records.length} 条折旧记录`);

      // 清空选择
      setSelectedAssetIds(new Set());
      setPreviewResult(null);
      setShowPreviewDialog(false);
      initialize();
    } catch (error: any) {
      showToast('error', error.message || '折旧处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 本期草稿记录
  const draftRecords = depreciationRecords.filter(r => r.period === period && r.status === 'draft');
  const draftTotalAmount = draftRecords.reduce((sum, r) => sum + r.periodDepreciation, 0);

  // 记账
  const handlePost = async (recordIds: string[]) => {
    try {
      await postDepreciationRecords(recordIds);
      showToast('success', '记账成功');
      initialize();
    } catch (error: any) {
      showToast('error', error.message || '记账失败');
    }
  };

  // 打开凭证入账对话框
  const handleOpenVoucherDialog = () => {
    if (draftRecords.length === 0) {
      showToast('warning', '没有草稿折旧记录');
      return;
    }
    // 设置默认入账日期为当前账期最后一天
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) {
      setVoucherDate(currentPeriodData.endDate);
    }
    setShowVoucherDialog(true);
  };

  // 凭证预览数据
  const voucherPreviewData = useMemo(() => {
    if (draftRecords.length === 0) return null;

    const assetMap = new Map(assets.map(a => [a.id, a]));
    const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

    for (const record of draftRecords) {
      const asset = assetMap.get(record.assetId);
      if (!asset) continue;

      const expenseCode = asset.expenseSubjectCode || '660204';
      const expenseName = asset.expenseSubjectName || '管理费用-折旧费';

      const existing = expenseMap.get(expenseCode);
      if (existing) {
        existing.amount += record.periodDepreciation;
      } else {
        expenseMap.set(expenseCode, {
          code: expenseCode,
          name: expenseName,
          amount: record.periodDepreciation,
        });
      }
    }

    const totalDepreciation = draftRecords.reduce((sum, r) => sum + r.periodDepreciation, 0);

    return {
      expenseEntries: Array.from(expenseMap.values()),
      totalDepreciation,
      depreciationSubject: { code: '1502', name: '累计折旧' },
    };
  }, [draftRecords, assets]);

  // 科目校验
  const validateSubjects = () => {
    if (!voucherPreviewData) return { valid: false, errors: [] };

    const errors: string[] = [];

    // 校验费用科目
    for (const expense of voucherPreviewData.expenseEntries) {
      const subject = subjects.find(s => s.code === expense.code);
      if (!subject) {
        errors.push(`费用科目 ${expense.code} 不存在`);
      }
    }

    // 校验累计折旧科目
    const depreciationSubject = subjects.find(s => s.code === '1502');
    if (!depreciationSubject) {
      errors.push('累计折旧科目 1502 不存在');
    }

    return { valid: errors.length === 0, errors };
  };

  // 账期校验
  const validatePeriod = () => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    return validateAccountingPeriod(voucherDate, accountSet);
  };

  // 确认生成凭证并记账
  const handleConfirmVoucher = async () => {
    // 账期校验
    const periodValidation = validatePeriod();
    if (!periodValidation.valid) {
      showToast('error', periodValidation.error!);
      return;
    }

    // 科目校验
    const subjectValidation = validateSubjects();
    if (!subjectValidation.valid) {
      showToast('error', `科目校验失败: ${subjectValidation.errors.join(', ')}`);
      return;
    }

    setIsPosting(true);
    try {
      const result = await generateDepreciationVoucher(draftRecords.map(r => r.id), voucherDate);
      if (result) {
        // 更新凭证状态为已记账
        const { sqliteService } = await import('@/lib/database/sqlite-service');
        const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
        if (accountSet?.id) {
          sqliteService.setAccountSetId(accountSet.id);
          const db = await sqliteService.getDatabase();
          if (db) {
            const stmt = db.prepare('UPDATE vouchers SET status = ? WHERE id = ?');
            stmt.run(['posted', result.voucherId]);
            stmt.free();
          }
        }

        showToast('success', `凭证 ${result.voucherNo} 已生成并记账`);
        setShowVoucherDialog(false);
        initialize();
      }
    } catch (error: any) {
      showToast('error', error.message || '生成凭证失败');
    } finally {
      setIsPosting(false);
    }
  };

  // 生成凭证（保留原有功能，但改为打开入账对话框）
  const handleGenerateVoucher = () => {
    handleOpenVoucherDialog();
  };

  // 统计数据
  const totalOriginalValue = activeAssets.reduce((sum, a) => sum + a.originalValue, 0);
  const totalDepreciation = activeAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);

  // 获取分类名称
  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return '未分类';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || '未分类';
  };

  // 获取分类的折旧起始规则
  const getCategoryDepreciationRule = (categoryId?: string) => {
    if (!categoryId) return 'next_month';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.depreciationStartRule || 'next_month';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            折旧/摊销计算
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 期间选择和统计 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">计算期间:</span>
              <span className="text-sm font-medium text-blue-600">{period.replace('-', '年')}月</span>
              <span className="text-xs text-slate-500">(当前账期)</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-600">在用资产: <strong>{activeAssets.length}</strong></span>
              <span className="text-slate-600">原值合计: <strong>¥{formatAmount(totalOriginalValue)}</strong></span>
            </div>
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
                      合计金额: <strong>¥{formatAmount(draftTotalAmount)}</strong>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleGenerateVoucher}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    生成凭证并记账
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 筛选和操作 */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索资产编码或名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              {selectedAssetIds.size === filteredAssets.length ? '取消全选' : '全选'}
            </Button>
            <span className="text-sm text-slate-600">
              已选择 <strong>{selectedAssetIds.size}</strong> 项
            </span>
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
                  <th className="text-left p-3 font-medium text-sm">分类</th>
                  <th className="text-right p-3 font-medium text-sm">原值</th>
                  <th className="text-right p-3 font-medium text-sm">累计折旧</th>
                  <th className="text-right p-3 font-medium text-sm">净值</th>
                  <th className="text-left p-3 font-medium text-sm">折旧方法</th>
                  <th className="text-left p-3 font-medium text-sm">折旧规则</th>
                  <th className="text-left p-3 font-medium text-sm">状态</th>
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
                      暂无在用资产
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    const isDepreciated = depreciatedAssetIdsThisPeriod.has(asset.id);
                    const rule = getCategoryDepreciationRule(asset.categoryId);
                    const acquisitionAccountingMonth = asset.acquisitionAccountingDate?.substring(0, 7);
                    const acquisitionMonth = acquisitionAccountingMonth || asset.acquisitionDate?.substring(0, 7);

                    // 判断本月是否需要计提折旧
                    const shouldDepreciateThisMonth = (() => {
                      // 入账日期在当前账期之后，本月不计提
                      if (acquisitionMonth && acquisitionMonth > period) return false;
                      // 本月入账但规则是下月计提（固定资产），本月不计提
                      if (acquisitionMonth === period && rule === 'next_month') return false;
                      // 其他情况需要计提
                      return true;
                    })();

                    return (
                      <tr
                        key={asset.id}
                        className={`border-b hover:bg-slate-50 ${isDepreciated ? 'bg-slate-100' : ''}`}
                      >
                        <td className="w-10 p-3">
                          <Checkbox
                            checked={selectedAssetIds.has(asset.id)}
                            onCheckedChange={() => toggleAssetSelection(asset.id)}
                            disabled={isDepreciated || !shouldDepreciateThisMonth}
                          />
                        </td>
                        <td className="p-3 text-sm font-mono">{asset.assetCode}</td>
                        <td className="p-3 text-sm font-medium">{asset.assetName}</td>
                        <td className="p-3 text-sm">{getCategoryName(asset.categoryId)}</td>
                        <td className="p-3 text-sm text-right">¥{formatAmount(asset.originalValue)}</td>
                        <td className="p-3 text-sm text-right text-orange-600">¥{formatAmount(asset.accumulatedDepreciation)}</td>
                        <td className="p-3 text-sm text-right font-medium">¥{formatAmount(asset.netValue)}</td>
                        <td className="p-3 text-sm">{getDepreciationMethodName(asset.depreciationMethod)}</td>
                        <td className="p-3 text-sm">
                          {(() => {
                            const rule = getCategoryDepreciationRule(asset.categoryId);
                            const acquisitionAccountingMonth = asset.acquisitionAccountingDate?.substring(0, 7);
                            const acquisitionMonth = acquisitionAccountingMonth || asset.acquisitionDate?.substring(0, 7);

                            // 入账日期在当前账期之后，本月不计提
                            if (acquisitionMonth && acquisitionMonth > period) {
                              return <Badge variant="outline" className="bg-slate-50 text-slate-500">无需计提</Badge>;
                            }

                            // 如果是本月入账
                            if (acquisitionMonth === period) {
                              if (rule === 'current_month') {
                                // 无形资产：本月入账，本月计提
                                return <Badge variant="outline" className="bg-purple-50 text-purple-700">本月计提</Badge>;
                              } else {
                                // 固定资产：本月入账，下月计提
                                return <Badge variant="outline" className="bg-blue-50 text-blue-700">下月计提</Badge>;
                              }
                            }

                            // 入账日期在当前账期之前，本月应该计提
                            return <Badge variant="outline" className="bg-green-50 text-green-700">本月计提</Badge>;
                          })()}
                        </td>
                        <td className="p-3">
                          {(() => {
                            const acquisitionAccountingMonth = asset.acquisitionAccountingDate?.substring(0, 7);
                            const acquisitionMonth = acquisitionAccountingMonth || asset.acquisitionDate?.substring(0, 7);
                            const rule = getCategoryDepreciationRule(asset.categoryId);

                            // 入账日期在当前账期之后，本月不计提
                            if (acquisitionMonth && acquisitionMonth > period) {
                              return <Badge variant="outline" className="bg-slate-100 text-slate-500">无需</Badge>;
                            }

                            // 本月入账但规则是下月计提（固定资产）
                            if (acquisitionMonth === period && rule === 'next_month') {
                              return <Badge variant="outline" className="bg-slate-100 text-slate-500">无需</Badge>;
                            }

                            // 其他情况显示待折旧或已折旧
                            if (isDepreciated) {
                              return <Badge variant="outline" className="bg-green-100 text-green-800">已折旧</Badge>;
                            } else {
                              return <Badge>待折旧</Badge>;
                            }
                          })()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>

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
                    <div className="text-xl font-bold text-orange-600">¥{formatAmount(previewResult.totalDepreciation)}</div>
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
                            ¥{formatAmount(assets.find(a => a.id === record.assetId)?.originalValue || 0)}
                          </td>
                          <td className="p-3 text-sm text-right text-orange-600">
                            ¥{formatAmount(record.accumulatedDepreciation - record.periodDepreciation)}
                          </td>
                          <td className="p-3 text-sm text-right font-medium text-blue-600">
                            ¥{formatAmount(record.periodDepreciation)}
                          </td>
                          <td className="p-3 text-sm text-right font-medium">
                            ¥{formatAmount(record.netValueAfter)}
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

        {/* 凭证入账对话框 */}
        <Dialog open={showVoucherDialog} onOpenChange={setShowVoucherDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>生成折旧凭证并记账</DialogTitle>
            </DialogHeader>

            {voucherPreviewData && (
              <div className="space-y-4 py-4">
                {/* 入账日期选择 */}
                <div className="space-y-1.5">
                  <Label required>入账日期</Label>
                  <ChineseDatePicker
                    value={voucherDate}
                    onChange={setVoucherDate}
                  />
                  <p className="text-xs text-slate-500">
                    凭证将使用此日期生成，必须在当前账期内
                  </p>
                </div>

                {/* 凭证预览 */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-3 py-2 border-b flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">凭证预览</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left p-2 font-medium">科目</th>
                        <th className="text-right p-2 font-medium w-28">借方</th>
                        <th className="text-right p-2 font-medium w-28">贷方</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 借方：费用科目 */}
                      {voucherPreviewData.expenseEntries.map((entry, idx) => {
                        const subject = subjects.find(s => s.code === entry.code);
                        return (
                          <tr key={idx} className="border-b">
                            <td className="p-2">
                              <span className="font-mono text-xs text-slate-500">{entry.code}</span>
                              <span className="ml-1">{subject?.name || entry.name}</span>
                              {!subject && (
                                <span className="ml-1 text-red-500 text-xs">(不存在)</span>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              ¥{formatAmount(entry.amount)}
                            </td>
                            <td className="p-2 text-right"></td>
                          </tr>
                        );
                      })}
                      {/* 贷方：累计折旧 */}
                      <tr className="border-b">
                        <td className="p-2">
                          <span className="font-mono text-xs text-slate-500">1502</span>
                          <span className="ml-1">{subjects.find(s => s.code === '1502')?.name || '累计折旧'}</span>
                          {!subjects.find(s => s.code === '1502') && (
                            <span className="ml-1 text-red-500 text-xs">(不存在)</span>
                          )}
                        </td>
                        <td className="p-2 text-right"></td>
                        <td className="p-2 text-right">
                          ¥{formatAmount(voucherPreviewData.totalDepreciation)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    摘要: 固定资产折旧 | 合计: {draftRecords.length} 条记录
                  </div>
                </div>

                {/* 校验提示 */}
                {(() => {
                  const subjectValidation = validateSubjects();
                  const periodValidation = validatePeriod();

                  if (!subjectValidation.valid || !periodValidation.valid) {
                    return (
                      <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">
                        <div className="font-medium mb-1">校验失败:</div>
                        <ul className="list-disc list-inside">
                          {subjectValidation.errors.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                          {periodValidation.error && <li>{periodValidation.error}</li>}
                        </ul>
                      </div>
                    );
                  }

                  return (
                    <div className="p-3 bg-green-50 rounded-lg text-sm text-green-600">
                      校验通过，可以生成凭证并记账
                    </div>
                  );
                })()}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVoucherDialog(false)}>
                取消
              </Button>
              <Button
                onClick={handleConfirmVoucher}
                disabled={isPosting || !validateSubjects().valid || !validatePeriod().valid}
              >
                {isPosting ? '处理中...' : '确认入账'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
