'use client';

import { useState, useMemo } from 'react';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
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
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { FixedAsset, DepreciationRecord, BatchDepreciationResult, AssetCategory } from '@/types';
import { getDepreciationMethodName, getDepreciationStartRule } from '@/lib/depreciation';
import { validateAccountingPeriod } from '@/lib/accounting';

// 格式化金额（不带货币符号）
const formatAmount = (value: number | undefined | null): string => {
  if (value === undefined || value === null || value === 0) return '0.00';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// 凭证分录数据结构
interface VoucherEntry {
  key: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
}

// 科目汇总数据结构
interface SubjectSummary {
  code: string;
  name: string;
  debit: number;
  credit: number;
}

// 生成凭证分录数据
function generateVoucherEntries(
  records: DepreciationRecord[],
  assets: FixedAsset[]
): VoucherEntry[] {
  const entries: VoucherEntry[] = [];

  for (const record of records) {
    const asset = assets.find(a => a.id === record.assetId);
    const expenseCode = asset?.expenseSubjectCode || '660204';
    const expenseName = asset?.expenseSubjectName || '管理费用-折旧费';
    const depreciationCode = asset?.depreciationSubjectCode || '1502';
    const amount = record.periodDepreciation;

    // 借方分录
    entries.push({
      key: `${record.id}-debit`,
      summary: `${record.assetCode}折旧`,
      subjectCode: expenseCode,
      subjectName: expenseName,
      debit: amount,
      credit: 0,
    });

    // 贷方分录
    entries.push({
      key: `${record.id}-credit`,
      summary: `${record.assetCode}折旧`,
      subjectCode: depreciationCode,
      subjectName: '累计折旧',
      debit: 0,
      credit: amount,
    });
  }

  return entries;
}

// 生成科目汇总数据
function generateSubjectSummary(
  records: DepreciationRecord[],
  assets: FixedAsset[]
): { debitSubjects: SubjectSummary[]; creditSubjects: SubjectSummary[] } {
  const subjectMap = new Map<string, SubjectSummary>();

  for (const record of records) {
    const asset = assets.find(a => a.id === record.assetId);

    // 费用科目（借方）
    const expenseCode = asset?.expenseSubjectCode || '660204';
    const expenseName = asset?.expenseSubjectName || '管理费用-折旧费';
    const expenseKey = expenseCode + '_' + expenseName;
    const existingExpense = subjectMap.get(expenseKey);
    if (existingExpense) {
      existingExpense.debit += record.periodDepreciation;
    } else {
      subjectMap.set(expenseKey, { code: expenseCode, name: expenseName, debit: record.periodDepreciation, credit: 0 });
    }

    // 累计折旧科目（贷方）
    const depreciationCode = asset?.depreciationSubjectCode || '1502';
    const depreciationKey = depreciationCode + '_累计折旧';
    const existingDep = subjectMap.get(depreciationKey);
    if (existingDep) {
      existingDep.credit += record.periodDepreciation;
    } else {
      subjectMap.set(depreciationKey, { code: depreciationCode, name: '累计折旧', debit: 0, credit: record.periodDepreciation });
    }
  }

  const subjects = Array.from(subjectMap.values());
  return {
    debitSubjects: subjects.filter(s => s.debit > 0),
    creditSubjects: subjects.filter(s => s.credit > 0),
  };
}

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
  const [showDetailTable, setShowDetailTable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 凭证入账日期
  const [voucherDate, setVoucherDate] = useState<string>(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) {
      return currentPeriodData.endDate;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`;
  });

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

  // 执行折旧并生成凭证
  const handleExecute = async () => {
    if (!previewResult || previewResult.records.length === 0) {
      showToast('warning', '没有可折旧的记录');
      return;
    }

    // 账期校验
    const periodValidation = validatePeriod();
    if (!periodValidation.valid) {
      showToast('error', periodValidation.error!);
      return;
    }

    // 科目校验（使用预览数据）
    const subjectValidation = validateSubjectsForPreview();
    if (!subjectValidation.valid) {
      showToast('error', `科目校验失败: ${subjectValidation.errors.join(', ')}`);
      return;
    }

    setIsProcessing(true);
    try {
      // 1. 保存折旧记录
      await saveDepreciationRecords(previewResult.records);

      // 2. 生成凭证并记账
      const result = await generateDepreciationVoucher(previewResult.records.map(r => r.id), voucherDate);
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

        showToast('success', `成功生成 ${previewResult.records.length} 条折旧记录，凭证 ${result.voucherNo} 已记账`);
      } else {
        showToast('success', `成功生成 ${previewResult.records.length} 条折旧记录`);
      }

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

  // 凭证预览数据（基于预览结果）
  const previewVoucherData = useMemo(() => {
    if (!previewResult || previewResult.records.length === 0) return null;

    const assetMap = new Map(assets.map(a => [a.id, a]));
    const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

    for (const record of previewResult.records) {
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

    const totalDepreciation = previewResult.totalDepreciation;

    return {
      expenseEntries: Array.from(expenseMap.values()),
      totalDepreciation,
      depreciationSubject: { code: '1502', name: '累计折旧' },
    };
  }, [previewResult, assets]);

  // 科目校验（基于预览结果）
  const validateSubjectsForPreview = () => {
    if (!previewVoucherData) return { valid: false, errors: [] };

    const errors: string[] = [];

    // 校验费用科目
    for (const expense of previewVoucherData.expenseEntries) {
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
    return cat?.depreciationStartRule || getDepreciationStartRule(cat?.assetType || 'fixed');
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
                    const depreciationStartMonth = asset.depreciationStartDate?.substring(0, 7);

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
                <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
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
                  <div>
                    <div className="text-sm text-slate-500 mb-1">入账日期</div>
                    <ChineseDatePicker
                      value={voucherDate}
                      onChange={setVoucherDate}
                    />
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

                {/* 凭证分录预览 - 表格 */}
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-4 py-2 border-b">
                    <span className="font-semibold text-slate-700">凭证分录预览</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100/50 border-b">
                        <th className="text-left p-3 font-semibold text-sm">摘要</th>
                        <th className="text-left p-3 font-semibold text-sm">科目编码</th>
                        <th className="text-left p-3 font-semibold text-sm">科目名称</th>
                        <th className="text-right p-3 font-semibold text-sm">借方</th>
                        <th className="text-right p-3 font-semibold text-sm">贷方</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generateVoucherEntries(previewResult.records, assets).map((entry) => (
                        <tr key={entry.key} className="border-b hover:bg-slate-50">
                          <td className="p-3 text-sm">{entry.summary}</td>
                          <td className="p-3 text-sm font-mono text-slate-600">{entry.subjectCode}</td>
                          <td className="p-3 text-sm">{entry.subjectName}</td>
                          <td className="p-3 text-right font-mono text-sm">
                            {entry.debit > 0 ? formatAmount(entry.debit) : ''}
                          </td>
                          <td className="p-3 text-right font-mono text-sm">
                            {entry.credit > 0 ? formatAmount(entry.credit) : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-50 border-t-2 border-green-200">
                        <td colSpan={3} className="p-3 font-semibold text-green-700">合计</td>
                        <td className="p-3 text-right font-mono font-semibold text-green-700">
                          {formatAmount(previewResult.totalDepreciation)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-green-700">
                          {formatAmount(previewResult.totalDepreciation)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 科目汇总 - Card 布局 */}
                {(() => {
                  const { debitSubjects, creditSubjects } = generateSubjectSummary(previewResult.records, assets);
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      {/* 借方发生额 */}
                      <Card className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-blue-600 mb-3">
                            <TrendingUp className="h-4 w-4" />
                            <span className="font-semibold">借方发生额</span>
                          </div>
                          <div className="space-y-3">
                            {debitSubjects.map((subject, idx) => (
                              <div key={idx} className="flex justify-between items-baseline">
                                <span className="text-sm text-slate-600">
                                  <span className="font-mono text-xs">{subject.code}</span> {subject.name}
                                </span>
                                <span className="text-xl font-bold text-slate-900 font-mono">
                                  {formatAmount(subject.debit)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      {/* 贷方发生额 */}
                      <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-emerald-600 mb-3">
                            <TrendingDown className="h-4 w-4" />
                            <span className="font-semibold">贷方发生额</span>
                          </div>
                          <div className="space-y-3">
                            {creditSubjects.map((subject, idx) => (
                              <div key={idx} className="flex justify-between items-baseline">
                                <span className="text-sm text-slate-600">
                                  <span className="font-mono text-xs">{subject.code}</span> {subject.name}
                                </span>
                                <span className="text-xl font-bold text-slate-900 font-mono">
                                  {formatAmount(subject.credit)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* 折旧明细 - 可折叠 */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDetailTable(!showDetailTable)}
                    className="w-full px-4 py-3 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium">查看折旧明细</span>
                    {showDetailTable ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {showDetailTable && (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="text-left p-3 text-sm font-medium">资产编码</th>
                          <th className="text-left p-3 text-sm font-medium">资产名称</th>
                          <th className="text-right p-3 text-sm font-medium">原值</th>
                          <th className="text-right p-3 text-sm font-medium">累计折旧</th>
                          <th className="text-right p-3 text-sm font-medium">本期折旧</th>
                          <th className="text-right p-3 text-sm font-medium">折旧后净值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.records.map((record) => (
                          <tr key={record.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 font-mono text-sm">{record.assetCode}</td>
                            <td className="p-3 text-sm">{record.assetName}</td>
                            <td className="p-3 text-right font-mono text-sm">
                              ¥{formatAmount(assets.find(a => a.id === record.assetId)?.originalValue || 0)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm text-orange-600">
                              ¥{formatAmount(record.accumulatedDepreciation - record.periodDepreciation)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm font-medium text-blue-600">
                              ¥{formatAmount(record.periodDepreciation)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm font-medium">
                              ¥{formatAmount(record.netValueAfter)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                取消
              </Button>
              <Button
                onClick={handleExecute}
                disabled={isProcessing || !previewResult || previewResult.records.length === 0}
                className="gap-1"
              >
                {isProcessing ? '处理中...' : '确认生成并记账'}
                {!isProcessing && <ArrowUpRight className="h-4 w-4" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
