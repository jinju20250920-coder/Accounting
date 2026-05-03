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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { AssetTimelineLedger } from '@/components/assets/asset-change-record-list';
import type { FixedAsset, DepreciationRecord, AssetChangeRecord } from '@/types';

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

// 事件类型配置
const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  acquisition: { label: '取得', color: 'bg-blue-50 text-blue-600' },
  depreciation: { label: '折旧', color: 'bg-green-50 text-green-600' },
  improvement: { label: '改造', color: 'bg-purple-50 text-purple-600' },
  disposal: { label: '处置', color: 'bg-red-50 text-red-500' },
  status_change: { label: '状态变更', color: 'bg-slate-50 text-slate-500' },
};

// 序时账视图组件
function AssetTimelineLedgerView({
  assets,
  period,
}: {
  assets: FixedAsset[];
  period: string;
}) {
  const { getAssetChangeRecords, depreciationRecords } = useFixedAssetStore();
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [allRecords, setAllRecords] = useState<AssetChangeRecord[]>([]);

  // 获取期间列表
  const periods = useMemo(() => {
    const set = new Set<string>();
    assets.forEach(a => {
      if (a.acquisitionDate) set.add(a.acquisitionDate.substring(0, 7));
      if (a.disposalDate) set.add(a.disposalDate.substring(0, 7));
    });
    depreciationRecords.forEach(r => {
      if (r.period) set.add(r.period);
    });
    return Array.from(set).sort();
  }, [assets, depreciationRecords]);

  // 加载所有资产的变动记录
  useEffect(() => {
    const loadAllRecords = async () => {
      const allChangeRecords: AssetChangeRecord[] = [];

      // 为每个资产生成变动记录
      for (const asset of assets) {
        // 取得记录
        if (asset.acquisitionDate) {
          allChangeRecords.push({
            id: `acq_${asset.id}`,
            assetId: asset.id,
            assetCode: asset.assetCode,
            assetName: asset.assetName,
            accountSetId: asset.accountSetId || '',
            changeType: 'acquisition',
            changeDate: asset.acquisitionDate,
            period: asset.acquisitionDate.substring(0, 7),
            fieldName: 'originalValue',
            beforeValue: '0',
            afterValue: String(asset.originalValue),
            originalValueChange: asset.originalValue,
            depreciationChange: 0,
            originalValueBalance: asset.originalValue,
            accumulatedDepreciationBalance: 0,
            netValueBalance: asset.originalValue,
            voucherId: asset.acquisitionVoucherId,
            voucherNo: asset.acquisitionVoucherNo,
            reason: '资产取得',
            createTime: asset.createTime,
          });
        }

        // 加载该资产的其他变动记录
        try {
          const records = await getAssetChangeRecords(asset.id);
          allChangeRecords.push(...records);
        } catch (e) {
          // 忽略错误
        }
      }

      // 按日期排序
      allChangeRecords.sort((a, b) => a.changeDate.localeCompare(b.changeDate));
      setAllRecords(allChangeRecords);
    };

    loadAllRecords();
  }, [assets, getAssetChangeRecords]);

  // 筛选记录
  const filteredRecords = useMemo(() => {
    let result = [...allRecords];

    if (selectedAssetId) {
      result = result.filter(r => r.assetId === selectedAssetId);
    }
    if (selectedPeriod) {
      result = result.filter(r => r.period?.startsWith(selectedPeriod));
    }
    if (selectedEventType) {
      result = result.filter(r => r.changeType === selectedEventType);
    }

    return result;
  }, [allRecords, selectedAssetId, selectedPeriod, selectedEventType]);

  // 计算时序账行（带余额累计）
  const timelineRows = useMemo(() => {
    // 按资产分组计算余额
    const assetBalances = new Map<string, { origBal: number; depBal: number }>();

    return filteredRecords.map((r) => {
      const assetId = r.assetId || '';

      // 获取或初始化该资产的余额
      let balance = assetBalances.get(assetId);
      if (!balance) {
        balance = { origBal: 0, depBal: 0 };
        assetBalances.set(assetId, balance);
      }

      let origChange = r.originalValueChange ?? 0;
      let depChange = r.depreciationChange ?? 0;

      // 从 changeType 推断变动
      switch (r.changeType) {
        case 'acquisition':
          origChange = r.originalValueChange ?? parseFloat(r.afterValue) ?? 0;
          break;
        case 'depreciation':
          depChange = r.depreciationChange ?? ((parseFloat(r.afterValue) - parseFloat(r.beforeValue)) || 0);
          break;
        case 'improvement':
          origChange = r.originalValueChange ?? ((parseFloat(r.afterValue) - parseFloat(r.beforeValue)) || 0);
          break;
        case 'disposal':
          origChange = r.originalValueChange ?? -(parseFloat(r.beforeValue) || 0);
          break;
      }

      // 更新余额
      if (r.originalValueBalance !== undefined) {
        balance.origBal = r.originalValueBalance;
        balance.depBal = r.accumulatedDepreciationBalance ?? 0;
      } else {
        balance.origBal += origChange;
        balance.depBal += depChange;
      }

      const netBal = r.netValueBalance ?? (balance.origBal - balance.depBal);

      return {
        id: r.id,
        assetId: r.assetId,
        assetCode: r.assetCode || assets.find(a => a.id === r.assetId)?.assetCode || '-',
        assetName: r.assetName || assets.find(a => a.id === r.assetId)?.assetName || '-',
        date: r.changeDate,
        eventType: r.changeType,
        eventDetail: r.voucherNo || r.reason || '-',
        origChange,
        depChange,
        origBal: balance.origBal,
        depBal: balance.depBal,
        netBal,
        voucherId: r.voucherId,
        voucherNo: r.voucherNo,
      };
    });
  }, [filteredRecords, assets]);

  const formatChange = (val: number) => {
    if (val === 0) return <span className="text-slate-300">-</span>;
    const str = Math.abs(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
    const color = val > 0 ? 'text-green-600' : 'text-red-500';
    const prefix = val > 0 ? '+' : '-';
    return <span className={color}>{prefix}{str}</span>;
  };

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex gap-3 items-center flex-wrap">
        <Select value={selectedAssetId || '__all__'} onValueChange={v => setSelectedAssetId(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="全部资产" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部资产</SelectItem>
            {assets.map(a => (
              <SelectItem key={a.id} value={a.id}>
                {a.assetCode} {a.assetName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPeriod || '__all__'} onValueChange={v => setSelectedPeriod(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部期间" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部期间</SelectItem>
            {periods.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedEventType || '__all__'} onValueChange={v => setSelectedEventType(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部类型</SelectItem>
            {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-slate-500 ml-auto">
          共 {timelineRows.length} 条记录
        </span>
      </div>

      {/* 时序账表格 */}
      <div className="border rounded-lg overflow-auto max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium text-slate-600 w-20">日期</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">资产编号</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600 w-40">事件类型</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">原值变动</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">折旧变动</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">原值余额</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">累计折旧</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">净值</th>
              <th className="px-3 py-2 text-center font-medium text-slate-600 w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {timelineRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  暂无变动记录
                </td>
              </tr>
            ) : (
              timelineRows.map((row) => {
                const eventCfg = EVENT_TYPE_CONFIG[row.eventType] || { label: row.eventType, color: 'bg-slate-50 text-slate-600' };
                return (
                  <tr key={row.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700">{row.date.substring(5)}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{row.assetCode}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge className={eventCfg.color}>{eventCfg.label}</Badge>
                        {row.eventDetail !== '-' && (
                          <span className="text-xs text-slate-500 font-mono truncate max-w-[100px]" title={row.eventDetail}>
                            {row.eventDetail}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatChange(row.origChange)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatChange(row.depChange)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{formatAmount(row.origBal)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{formatAmount(row.depBal)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{formatAmount(row.netBal)}</td>
                    <td className="px-3 py-2 text-center">
                      {row.voucherId ? (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                          修正
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

  // 客户端挂载状态
  const [mounted, setMounted] = useState(false);

  // 获取当前账期（仅在客户端计算）
  const currentPeriod = useMemo(() => {
    if (!mounted) return '';
    const accountSet = getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) {
      return `${currentPeriodData.year}-${String(currentPeriodData.month).padStart(2, '0')}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [mounted]);

  const [period, setPeriod] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'detail' | 'ledger'>('detail');
  const [showAlmostDoneDialog, setShowAlmostDoneDialog] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);

  // 初始化
  useEffect(() => {
    initialize();
    setMounted(true);
  }, [initialize]);

  // 设置初始期间
  useEffect(() => {
    if (mounted && !period && currentPeriod) {
      setPeriod(currentPeriod);
    }
  }, [mounted, period, currentPeriod]);

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
            {mounted && period ? (
              <ChineseMonthPicker
                value={period}
                onChange={setPeriod}
                className="w-36"
              />
            ) : (
              <div className="h-9 w-36 rounded-md border border-input bg-slate-100 px-3 py-1.5 text-sm text-slate-400">
                加载中...
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!mounted}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      {!mounted ? (
        <div className="text-center py-12 text-slate-500">
          加载中...
        </div>
      ) : (
      <>
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
            <AssetTimelineLedgerView
              assets={assets}
              period={period}
            />
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
      </>
      )}
    </div>
  );
}
