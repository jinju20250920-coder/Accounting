'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Download,
  Printer,
  Package,
  DollarSign,
  Calculator,
  FileText,
} from 'lucide-react';
import type { FixedAsset, DepreciationRecord } from '@/types';

// 格式化金额
const formatAmount = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0.00';
  return Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// 格式化金额带符号
const formatAmountWithSign = (value: number): string => {
  if (value === 0) return '0.00';
  const formatted = formatAmount(value);
  return value > 0 ? `+¥${formatted}` : `-¥${formatted}`;
};

// 折旧状态类型
type DepreciationStatus = 'depreciated' | 'pending' | 'almost_done' | 'terminated';

// 折旧状态配置
const DEPRECIATION_STATUS_CONFIG = {
  depreciated: { label: '已计提', color: 'bg-green-100 text-green-700', dot: '●' },
  pending: { label: '待计提', color: 'bg-yellow-100 text-yellow-700', dot: '○' },
  almost_done: { label: '即将提足', color: 'bg-orange-100 text-orange-700', dot: '!' },
  terminated: { label: '已终止', color: 'bg-slate-100 text-slate-500', dot: '-' },
};

// 指标卡片组件
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  onClick,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'orange' | 'slate';
  onClick?: () => void;
}) {
  const colorClasses = {
    blue: 'border-l-blue-500 bg-blue-50/50',
    green: 'border-l-green-500 bg-green-50/50',
    yellow: 'border-l-yellow-500 bg-yellow-50/50',
    red: 'border-l-red-500 bg-red-50/50',
    orange: 'border-l-orange-500 bg-orange-50/50',
    slate: 'border-l-slate-500 bg-slate-50/50',
  };

  const iconColors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    orange: 'text-orange-600',
    slate: 'text-slate-600',
  };

  return (
    <Card
      className={`border-l-4 ${colorClasses[color]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${iconColors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 预警卡片组件
function AlertCard({
  title,
  value,
  subtitle,
  alertText,
  icon: Icon,
  color = 'yellow',
  onClick,
}: {
  title: string;
  value: string;
  subtitle?: string;
  alertText?: string;
  icon: React.ElementType;
  color?: 'yellow' | 'orange' | 'red';
  onClick?: () => void;
}) {
  const colorClasses = {
    yellow: 'border-yellow-200 bg-yellow-50',
    orange: 'border-orange-200 bg-orange-50',
    red: 'border-red-200 bg-red-50',
  };

  const iconColors = {
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
  };

  return (
    <Card
      className={`border ${colorClasses[color]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${iconColors[color]} bg-white`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-1">{title}</p>
            <p className="text-xl font-bold text-slate-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}
            {alertText && (
              <Badge variant="outline" className={`mt-2 ${iconColors[color]} border-current`}>
                {alertText}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AssetSummaryPage() {
  const { assets, depreciationRecords, categories, initialize } = useFixedAssetStore();
  const { getCurrentAccountSet } = useAccountSetStore();

  // 获取当前账期
  const currentPeriod = useMemo(() => {
    const accountSet = getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) {
      return `${currentPeriodData.year}-${String(currentPeriodData.month).padStart(2, '0')}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [period, setPeriod] = useState<string>(currentPeriod);
  const [activeTab, setActiveTab] = useState<'detail' | 'ledger'>('detail');
  const [showAlmostDoneDialog, setShowAlmostDoneDialog] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);

  // 初始化
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 核心指标计算
  const metrics = useMemo(() => {
    const periodStart = `${period}-01`;

    // 期初原值：期初已存在的资产（购置日期 < 期间开始）
    const periodStartAssets = assets.filter(a => a.acquisitionDate < periodStart);
    const periodStartOriginalValue = periodStartAssets.reduce((sum, a) => sum + a.originalValue, 0);

    // 本期新增
    const newAssetsThisPeriod = assets.filter(a => a.acquisitionDate.startsWith(period));
    const newAssetsValue = newAssetsThisPeriod.reduce((sum, a) => sum + a.originalValue, 0);

    // 本期处置
    const disposedAssetsThisPeriod = assets.filter(a => a.disposalDate?.startsWith(period));
    const disposedValue = disposedAssetsThisPeriod.reduce((sum, a) => sum + a.originalValue, 0);

    // 本期净变动
    const netChange = newAssetsValue - disposedValue;

    // 本期折旧额（已记账）
    const periodDepreciationAmount = depreciationRecords
      .filter(r => r.period === period && r.status === 'posted')
      .reduce((sum, r) => sum + r.periodDepreciation, 0);

    // 期末净值 = 期初原值 + 本期净变动 - 累计折旧（截至期末）
    const totalAccumulatedDepreciation = assets
      .filter(a => a.status !== 'disposed' || a.disposalDate?.startsWith(period))
      .reduce((sum, a) => sum + a.accumulatedDepreciation, 0);

    const totalOriginalValue = assets
      .filter(a => a.status !== 'disposed' || a.disposalDate?.startsWith(period))
      .reduce((sum, a) => sum + a.originalValue, 0);

    const endingNetValue = totalOriginalValue - totalAccumulatedDepreciation;

    return {
      periodStartOriginalValue,
      netChange,
      periodDepreciationAmount,
      endingNetValue,
      totalOriginalValue,
      totalAccumulatedDepreciation,
    };
  }, [assets, depreciationRecords, period]);

  // 监控预警计算
  const alerts = useMemo(() => {
    // 累计折旧
    const totalAccumulatedDepreciation = metrics.totalAccumulatedDepreciation;

    // 损耗率
    const depreciationRate = metrics.totalOriginalValue > 0
      ? (totalAccumulatedDepreciation / metrics.totalOriginalValue) * 100
      : 0;

    // 待处理折旧（草稿状态）
    const draftRecords = depreciationRecords.filter(r => r.period === period && r.status === 'draft');
    const pendingDepreciation = draftRecords.reduce((sum, r) => sum + r.periodDepreciation, 0);

    // 即将提足的资产（剩余折旧月数 <= 3）
    const activeAssets = assets.filter(a => a.status === 'active');
    const almostDoneAssets = activeAssets.filter(a => {
      const remaining = a.remainingDepreciationMonths || 0;
      return remaining > 0 && remaining <= 3;
    });

    return {
      totalAccumulatedDepreciation,
      depreciationRate,
      pendingDepreciation,
      pendingCount: draftRecords.length,
      almostDoneAssets,
      almostDoneCount: almostDoneAssets.length,
    };
  }, [assets, depreciationRecords, period, metrics]);

  // 获取资产折旧状态
  const getDepreciationStatus = (asset: FixedAsset): DepreciationStatus => {
    if (asset.status === 'disposed') return 'terminated';
    if (asset.remainingDepreciationMonths && asset.remainingDepreciationMonths <= 3) return 'almost_done';

    const thisPeriodRecord = depreciationRecords.find(r =>
      r.assetId === asset.id && r.period === period
    );
    if (thisPeriodRecord) return 'depreciated';
    return 'pending';
  };

  // 计算预计提足账期
  const getEstimatedEndPeriod = (asset: FixedAsset): string => {
    if (asset.status === 'disposed') return '-';
    if (!asset.remainingDepreciationMonths) return '-';

    const [year, month] = period.split('-').map(Number);
    const endMonth = month + asset.remainingDepreciationMonths;
    const endYear = year + Math.floor((endMonth - 1) / 12);
    const actualEndMonth = ((endMonth - 1) % 12) + 1;

    return `${endYear}-${String(actualEndMonth).padStart(2, '0')}`;
  };

  // 明细表数据
  const detailData = useMemo(() => {
    const activeAssets = assets.filter(a => a.status === 'active' || a.status === 'disposed');

    return activeAssets.map(asset => {
      const status = getDepreciationStatus(asset);
      const thisPeriodRecord = depreciationRecords.find(r =>
        r.assetId === asset.id && r.period === period
      );

      // 判断业务类型
      let businessType = '常规';
      let amount = 0;

      if (asset.acquisitionDate.startsWith(period)) {
        businessType = '资产入库';
        amount = asset.originalValue;
      } else if (asset.disposalDate?.startsWith(period)) {
        businessType = '资产处置';
        amount = asset.netValue;
      } else if (thisPeriodRecord) {
        businessType = '计提折旧';
        amount = -thisPeriodRecord.periodDepreciation;
      }

      return {
        ...asset,
        businessType,
        amount,
        depreciationStatus: status,
        estimatedEndPeriod: getEstimatedEndPeriod(asset),
      };
    });
  }, [assets, depreciationRecords, period]);

  // 序时账数据（按折旧日期排序）
  const ledgerData = useMemo(() => {
    return depreciationRecords
      .filter(r => r.period === period)
      .sort((a, b) => a.depreciationDate.localeCompare(b.depreciationDate))
      .map(record => {
        const asset = assets.find(a => a.id === record.assetId);
        return {
          ...record,
          assetCode: asset?.assetCode || record.assetCode || '-',
          assetName: asset?.assetName || record.assetName || '-',
        };
      });
  }, [depreciationRecords, assets, period]);

  // 导出功能
  const handleExport = () => {
    const headers = ['资产编号', '资产名称', '业务类型', '金额', '折旧状态', '预计提足账期'];
    const rows = detailData.map(item => [
      item.assetCode,
      item.assetName,
      item.businessType,
      item.amount.toFixed(2),
      DEPRECIATION_STATUS_CONFIG[item.depreciationStatus].label,
      item.estimatedEndPeriod,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `固定资产汇总表_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">固定资产汇总表</h1>
          <p className="text-slate-500 mt-1">财务视角的核心指标与管理视角的监控预警</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">期间：</span>
            <ChineseMonthPicker
              value={period}
              onChange={setPeriod}
              className="w-36"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      {/* 核心指标层（财务视角） */}
      <div>
        <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          核心指标层（财务视角）
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="账期期初原值"
            value={`¥${formatAmount(metrics.periodStartOriginalValue)}`}
            icon={Package}
            color="blue"
          />
          <MetricCard
            title="本期净变动"
            value={formatAmountWithSign(metrics.netChange)}
            subtitle={metrics.netChange > 0 ? '新增超过处置' : metrics.netChange < 0 ? '处置超过新增' : '无变动'}
            icon={metrics.netChange >= 0 ? TrendingUp : TrendingDown}
            color={metrics.netChange >= 0 ? 'green' : 'red'}
          />
          <MetricCard
            title="本期折旧额"
            value={`-¥${formatAmount(metrics.periodDepreciationAmount)}`}
            icon={Calculator}
            color="orange"
          />
          <MetricCard
            title="账期期末净值"
            value={`¥${formatAmount(metrics.endingNetValue)}`}
            icon={DollarSign}
            color="green"
          />
        </div>
      </div>

      {/* 监控预警层（管理视角） */}
      <div>
        <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          监控预警层（管理视角）
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="累计折旧（已提）"
            value={`¥${formatAmount(alerts.totalAccumulatedDepreciation)}`}
            subtitle={`总资产已损耗 ${alerts.depreciationRate.toFixed(1)}%`}
            icon={Calculator}
            color="slate"
          />
          <AlertCard
            title="待处理折旧（未提）"
            value={`¥${formatAmount(alerts.pendingDepreciation)}`}
            subtitle={`${alerts.pendingCount} 笔未过账业务`}
            alertText={alerts.pendingCount > 0 ? '需要处理' : undefined}
            icon={Clock}
            color="yellow"
            onClick={alerts.pendingCount > 0 ? () => setShowPendingDialog(true) : undefined}
          />
          <AlertCard
            title="即将提足（提醒）"
            value={`${alerts.almostDoneCount} 项`}
            subtitle="3 个月内将停止计提"
            alertText={alerts.almostDoneCount > 0 ? '查看明细' : undefined}
            icon={AlertTriangle}
            color="orange"
            onClick={alerts.almostDoneCount > 0 ? () => setShowAlmostDoneDialog(true) : undefined}
          />
        </div>
      </div>

      {/* 明细表/序时账 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">明细表</CardTitle>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'detail' | 'ledger')}>
              <TabsList>
                <TabsTrigger value="detail">明细表</TabsTrigger>
                <TabsTrigger value="ledger">序时账</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'detail' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-3 font-medium">资产编号</th>
                    <th className="text-left p-3 font-medium">资产名称</th>
                    <th className="text-left p-3 font-medium">业务类型</th>
                    <th className="text-right p-3 font-medium">金额</th>
                    <th className="text-center p-3 font-medium">折旧状态</th>
                    <th className="text-center p-3 font-medium">预计提足账期</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-slate-500">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    detailData.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-mono">{item.assetCode}</td>
                        <td className="p-3">{item.assetName}</td>
                        <td className="p-3">{item.businessType}</td>
                        <td className="p-3 text-right font-mono">
                          {item.amount !== 0 ? formatAmountWithSign(item.amount) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={DEPRECIATION_STATUS_CONFIG[item.depreciationStatus].color}>
                            {DEPRECIATION_STATUS_CONFIG[item.depreciationStatus].dot} {DEPRECIATION_STATUS_CONFIG[item.depreciationStatus].label}
                          </Badge>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {item.estimatedEndPeriod}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-3 font-medium">折旧日期</th>
                    <th className="text-left p-3 font-medium">资产编号</th>
                    <th className="text-left p-3 font-medium">资产名称</th>
                    <th className="text-right p-3 font-medium">本期折旧</th>
                    <th className="text-right p-3 font-medium">累计折旧</th>
                    <th className="text-right p-3 font-medium">折后净值</th>
                    <th className="text-center p-3 font-medium">状态</th>
                    <th className="text-left p-3 font-medium">凭证号</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-8 text-slate-500">
                        暂无折旧记录
                      </td>
                    </tr>
                  ) : (
                    ledgerData.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-slate-50">
                        <td className="p-3">{record.depreciationDate}</td>
                        <td className="p-3 font-mono">{record.assetCode}</td>
                        <td className="p-3">{record.assetName}</td>
                        <td className="p-3 text-right font-mono text-orange-600">
                          -{formatAmount(record.periodDepreciation)}
                        </td>
                        <td className="p-3 text-right font-mono">{formatAmount(record.accumulatedDepreciation)}</td>
                        <td className="p-3 text-right font-mono">{formatAmount(record.netValueAfter)}</td>
                        <td className="p-3 text-center">
                          <Badge className={record.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                            {record.status === 'posted' ? '已记账' : '草稿'}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-blue-600">{record.voucherNo || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 即将提足明细对话框 */}
      <Dialog open={showAlmostDoneDialog} onOpenChange={setShowAlmostDoneDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>即将提足的资产明细</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-medium">资产编号</th>
                  <th className="text-left p-3 font-medium">资产名称</th>
                  <th className="text-right p-3 font-medium">原值</th>
                  <th className="text-right p-3 font-medium">累计折旧</th>
                  <th className="text-right p-3 font-medium">剩余月数</th>
                </tr>
              </thead>
              <tbody>
                {alerts.almostDoneAssets.map((asset) => (
                  <tr key={asset.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-mono">{asset.assetCode}</td>
                    <td className="p-3">{asset.assetName}</td>
                    <td className="p-3 text-right font-mono">¥{formatAmount(asset.originalValue)}</td>
                    <td className="p-3 text-right font-mono">¥{formatAmount(asset.accumulatedDepreciation)}</td>
                    <td className="p-3 text-right font-mono text-orange-600">{asset.remainingDepreciationMonths} 个月</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 待处理折旧明细对话框 */}
      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>待处理的折旧记录</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-medium">资产编号</th>
                  <th className="text-left p-3 font-medium">资产名称</th>
                  <th className="text-right p-3 font-medium">本期折旧</th>
                  <th className="text-left p-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {depreciationRecords
                  .filter(r => r.period === period && r.status === 'draft')
                  .map((record) => (
                    <tr key={record.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-mono">{record.assetCode}</td>
                      <td className="p-3">{record.assetName}</td>
                      <td className="p-3 text-right font-mono">¥{formatAmount(record.periodDepreciation)}</td>
                      <td className="p-3">
                        <Badge className="bg-yellow-100 text-yellow-700">草稿</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
