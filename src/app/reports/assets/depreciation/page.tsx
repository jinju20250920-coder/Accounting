'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  Download,
  Printer,
  FileText,
  Calculator,
} from 'lucide-react';
import { exportDepreciationRecordsToExcel } from '@/lib/parser';
import { getDepreciationMethodName } from '@/lib/depreciation';

export default function DepreciationReportPage() {
  const {
    assets,
    depreciationRecords,
    loading,
    initialize,
  } = useFixedAssetStore();

  const { showToast } = useToast();
  const [periodFilter, setPeriodFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 获取所有期间（用于筛选）
  const allPeriods = useMemo(() => {
    const periods = new Set<string>();
    depreciationRecords.forEach(r => periods.add(r.period));
    return Array.from(periods).sort().reverse();
  }, [depreciationRecords]);

  // 获取所有分类
  const allCategories = useMemo(() => {
    const categories = new Map<string, string>();
    assets.forEach(a => {
      if (a.categoryId && a.categoryName) {
        categories.set(a.categoryId, a.categoryName);
      }
    });
    return Array.from(categories.entries());
  }, [assets]);

  // 筛选记录
  const filteredRecords = useMemo(() => {
    return depreciationRecords.filter(record => {
      if (periodFilter !== 'all' && record.period !== periodFilter) return false;
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (categoryFilter !== 'all') {
        const asset = assets.find(a => a.id === record.assetId);
        if (!asset || asset.categoryId !== categoryFilter) return false;
      }
      return true;
    });
  }, [depreciationRecords, periodFilter, statusFilter, categoryFilter, assets]);

  // 统计数据
  const statistics = useMemo(() => {
    const totalDepreciation = filteredRecords.reduce((sum, r) => sum + r.periodDepreciation, 0);
    const draftCount = filteredRecords.filter(r => r.status === 'draft').length;
    const postedCount = filteredRecords.filter(r => r.status === 'posted').length;
    return { totalDepreciation, draftCount, postedCount, total: filteredRecords.length };
  }, [filteredRecords]);

  const formatMoney = (value: number) => {
    return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      draft: { label: '草稿', variant: 'outline' },
      posted: { label: '已记账', variant: 'default' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // 导出Excel
  const handleExport = () => {
    if (filteredRecords.length === 0) {
      showToast('warning', '没有可导出的数据');
      return;
    }
    exportDepreciationRecordsToExcel(filteredRecords);
    showToast('success', `成功导出 ${filteredRecords.length} 条记录`);
  };

  // 打印
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            折旧明细表
          </h1>
          <p className="text-slate-500 text-sm mt-1">固定资产折旧记录汇总报表</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            打印
          </Button>
        </div>
      </div>

      {/* 打印标题 */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">折旧明细表</h1>
        <p className="text-sm text-slate-600">
          {periodFilter !== 'all' ? `期间：${periodFilter}` : '全部期间'}
        </p>
      </div>

      {/* 筛选条件 */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm text-slate-600">期间</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="全部期间" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部期间</SelectItem>
                  {allPeriods.map(period => (
                    <SelectItem key={period} value={period}>{period}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">状态</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="posted">已记账</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">分类</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="全部分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {allCategories.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 print:hidden">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">记录数</div>
            <div className="text-2xl font-bold">{statistics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">本期折旧总额</div>
            <div className="text-2xl font-bold text-orange-600">¥{formatMoney(statistics.totalDepreciation)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">草稿记录</div>
            <div className="text-2xl font-bold text-yellow-600">{statistics.draftCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">已记账记录</div>
            <div className="text-2xl font-bold text-green-600">{statistics.postedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* 明细表格 */}
      <Card>
        <CardHeader className="print:hidden">
          <CardTitle className="text-lg">折旧明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-slate-50 print:bg-gray-100">
                  <th className="text-left p-3 font-medium border">期间</th>
                  <th className="text-left p-3 font-medium border">资产编码</th>
                  <th className="text-left p-3 font-medium border">资产名称</th>
                  <th className="text-right p-3 font-medium border">原值</th>
                  <th className="text-right p-3 font-medium border">本期折旧</th>
                  <th className="text-right p-3 font-medium border">累计折旧</th>
                  <th className="text-right p-3 font-medium border">折旧后净值</th>
                  <th className="text-center p-3 font-medium border print:hidden">状态</th>
                  <th className="text-left p-3 font-medium border print:hidden">凭证号</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-slate-500 border">
                      加载中...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-slate-500 border">
                      暂无折旧记录
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const asset = assets.find(a => a.id === record.assetId);
                    return (
                      <tr key={record.id} className="border-b hover:bg-slate-50 print:hover:none">
                        <td className="p-3 border">{record.period}</td>
                        <td className="p-3 border font-mono">{record.assetCode}</td>
                        <td className="p-3 border font-medium">{record.assetName}</td>
                        <td className="p-3 border text-right">¥{formatMoney(asset?.originalValue || 0)}</td>
                        <td className="p-3 border text-right font-medium text-blue-600">¥{formatMoney(record.periodDepreciation)}</td>
                        <td className="p-3 border text-right text-orange-600">¥{formatMoney(record.accumulatedDepreciation)}</td>
                        <td className="p-3 border text-right">¥{formatMoney(record.netValueAfter)}</td>
                        <td className="p-3 border text-center print:hidden">{getStatusBadge(record.status)}</td>
                        <td className="p-3 border print:hidden">
                          {record.voucherNo ? (
                            <span className="text-blue-600 font-mono text-sm">{record.voucherNo}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredRecords.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold">
                    <td className="p-3 border" colSpan={4}>合计</td>
                    <td className="p-3 border text-right text-blue-600">¥{formatMoney(statistics.totalDepreciation)}</td>
                    <td className="p-3 border" colSpan={4}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
