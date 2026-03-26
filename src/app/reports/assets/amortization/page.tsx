'use client';

import { useState, useEffect, useMemo } from 'react';
import { useIntangibleAssetStore } from '@/stores/useIntangibleAssetStore';
import { usePrepaidExpenseStore } from '@/stores/usePrepaidExpenseStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowDownCircle,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { exportAmortizationRecordsToExcel } from '@/lib/parser';

export default function AmortizationReportPage() {
  const {
    assets: intangibleAssets,
    amortizationRecords: intangibleRecords,
    loading: intangibleLoading,
    initialize: initIntangible,
  } = useIntangibleAssetStore();

  const {
    expenses: prepaidExpenses,
    amortizationRecords: prepaidRecords,
    loading: prepaidLoading,
    initialize: initPrepaid,
  } = usePrepaidExpenseStore();

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'intangible' | 'prepaid'>('intangible');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    initIntangible();
    initPrepaid();
  }, [initIntangible, initPrepaid]);

  // 获取所有期间
  const intangiblePeriods = useMemo(() => {
    const periods = new Set<string>();
    intangibleRecords.forEach(r => periods.add(r.period));
    return Array.from(periods).sort().reverse();
  }, [intangibleRecords]);

  const prepaidPeriods = useMemo(() => {
    const periods = new Set<string>();
    prepaidRecords.forEach(r => periods.add(r.period));
    return Array.from(periods).sort().reverse();
  }, [prepaidRecords]);

  // 筛选无形资产记录
  const filteredIntangibleRecords = useMemo(() => {
    return intangibleRecords.filter(record => {
      if (periodFilter !== 'all' && record.period !== periodFilter) return false;
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      return true;
    });
  }, [intangibleRecords, periodFilter, statusFilter]);

  // 筛选待摊费用记录
  const filteredPrepaidRecords = useMemo(() => {
    return prepaidRecords.filter(record => {
      if (periodFilter !== 'all' && record.period !== periodFilter) return false;
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      return true;
    });
  }, [prepaidRecords, periodFilter, statusFilter]);

  // 统计数据
  const intangibleStats = useMemo(() => {
    const totalAmortization = filteredIntangibleRecords.reduce((sum, r) => sum + r.periodAmortization, 0);
    const draftCount = filteredIntangibleRecords.filter(r => r.status === 'draft').length;
    const postedCount = filteredIntangibleRecords.filter(r => r.status === 'posted').length;
    return { totalAmortization, draftCount, postedCount, total: filteredIntangibleRecords.length };
  }, [filteredIntangibleRecords]);

  const prepaidStats = useMemo(() => {
    const totalAmortization = filteredPrepaidRecords.reduce((sum, r) => sum + r.periodAmortization, 0);
    const draftCount = filteredPrepaidRecords.filter(r => r.status === 'draft').length;
    const postedCount = filteredPrepaidRecords.filter(r => r.status === 'posted').length;
    return { totalAmortization, draftCount, postedCount, total: filteredPrepaidRecords.length };
  }, [filteredPrepaidRecords]);

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
  const handleExport = (type: 'intangible' | 'prepaid') => {
    const records = type === 'intangible' ? filteredIntangibleRecords : filteredPrepaidRecords;
    if (records.length === 0) {
      showToast('warning', '没有可导出的数据');
      return;
    }
    exportAmortizationRecordsToExcel(records);
    showToast('success', `成功导出 ${records.length} 条记录`);
  };

  // 打印
  const handlePrint = () => {
    window.print();
  };

  const allPeriods = activeTab === 'intangible' ? intangiblePeriods : prepaidPeriods;
  const currentStats = activeTab === 'intangible' ? intangibleStats : prepaidStats;

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowDownCircle className="h-6 w-6" />
            摊销明细表
          </h1>
          <p className="text-slate-500 text-sm mt-1">无形资产和待摊费用摊销记录汇总报表</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport(activeTab)}>
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
        <h1 className="text-xl font-bold">
          {activeTab === 'intangible' ? '无形资产摊销明细表' : '待摊费用摊销明细表'}
        </h1>
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
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'intangible' | 'prepaid')}>
        <TabsList className="print:hidden">
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
          <div className="grid grid-cols-4 gap-4 print:hidden">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">记录数</div>
                <div className="text-2xl font-bold">{intangibleStats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">本期摊销总额</div>
                <div className="text-2xl font-bold text-orange-600">¥{formatMoney(intangibleStats.totalAmortization)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">草稿记录</div>
                <div className="text-2xl font-bold text-yellow-600">{intangibleStats.draftCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">已记账记录</div>
                <div className="text-2xl font-bold text-green-600">{intangibleStats.postedCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* 明细表格 */}
          <Card>
            <CardHeader className="print:hidden">
              <CardTitle className="text-lg">无形资产摊销明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-3 font-medium border">期间</th>
                      <th className="text-left p-3 font-medium border">资产编码</th>
                      <th className="text-left p-3 font-medium border">资产名称</th>
                      <th className="text-right p-3 font-medium border">原值</th>
                      <th className="text-right p-3 font-medium border">本期摊销</th>
                      <th className="text-right p-3 font-medium border">累计摊销</th>
                      <th className="text-right p-3 font-medium border">剩余金额</th>
                      <th className="text-center p-3 font-medium border print:hidden">状态</th>
                      <th className="text-left p-3 font-medium border print:hidden">凭证号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intangibleLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-slate-500 border">
                          加载中...
                        </td>
                      </tr>
                    ) : filteredIntangibleRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-slate-500 border">
                          暂无摊销记录
                        </td>
                      </tr>
                    ) : (
                      filteredIntangibleRecords.map((record) => {
                        const asset = intangibleAssets.find(a => a.id === record.entityId);
                        return (
                          <tr key={record.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 border">{record.period}</td>
                            <td className="p-3 border font-mono">{record.entityCode}</td>
                            <td className="p-3 border font-medium">{record.entityName}</td>
                            <td className="p-3 border text-right">¥{formatMoney(asset?.originalValue || 0)}</td>
                            <td className="p-3 border text-right font-medium text-blue-600">¥{formatMoney(record.periodAmortization)}</td>
                            <td className="p-3 border text-right text-orange-600">¥{formatMoney(record.accumulatedAmortization)}</td>
                            <td className="p-3 border text-right">¥{formatMoney(record.remainingAmount)}</td>
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
                  {filteredIntangibleRecords.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold">
                        <td className="p-3 border" colSpan={4}>合计</td>
                        <td className="p-3 border text-right text-blue-600">¥{formatMoney(intangibleStats.totalAmortization)}</td>
                        <td className="p-3 border" colSpan={4}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 待摊费用Tab */}
        <TabsContent value="prepaid" className="space-y-4">
          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4 print:hidden">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">记录数</div>
                <div className="text-2xl font-bold">{prepaidStats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">本期摊销总额</div>
                <div className="text-2xl font-bold text-orange-600">¥{formatMoney(prepaidStats.totalAmortization)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">草稿记录</div>
                <div className="text-2xl font-bold text-yellow-600">{prepaidStats.draftCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500">已记账记录</div>
                <div className="text-2xl font-bold text-green-600">{prepaidStats.postedCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* 明细表格 */}
          <Card>
            <CardHeader className="print:hidden">
              <CardTitle className="text-lg">待摊费用摊销明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-3 font-medium border">期间</th>
                      <th className="text-left p-3 font-medium border">费用编码</th>
                      <th className="text-left p-3 font-medium border">费用名称</th>
                      <th className="text-right p-3 font-medium border">原始金额</th>
                      <th className="text-right p-3 font-medium border">本期摊销</th>
                      <th className="text-right p-3 font-medium border">累计摊销</th>
                      <th className="text-right p-3 font-medium border">剩余金额</th>
                      <th className="text-center p-3 font-medium border print:hidden">状态</th>
                      <th className="text-left p-3 font-medium border print:hidden">凭证号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepaidLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-slate-500 border">
                          加载中...
                        </td>
                      </tr>
                    ) : filteredPrepaidRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-slate-500 border">
                          暂无摊销记录
                        </td>
                      </tr>
                    ) : (
                      filteredPrepaidRecords.map((record) => {
                        const expense = prepaidExpenses.find(e => e.id === record.entityId);
                        return (
                          <tr key={record.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 border">{record.period}</td>
                            <td className="p-3 border font-mono">{record.entityCode}</td>
                            <td className="p-3 border font-medium">{record.entityName}</td>
                            <td className="p-3 border text-right">¥{formatMoney(expense?.originalAmount || 0)}</td>
                            <td className="p-3 border text-right font-medium text-blue-600">¥{formatMoney(record.periodAmortization)}</td>
                            <td className="p-3 border text-right text-orange-600">¥{formatMoney(record.accumulatedAmortization)}</td>
                            <td className="p-3 border text-right">¥{formatMoney(record.remainingAmount)}</td>
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
                  {filteredPrepaidRecords.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold">
                        <td className="p-3 border" colSpan={4}>合计</td>
                        <td className="p-3 border text-right text-blue-600">¥{formatMoney(prepaidStats.totalAmortization)}</td>
                        <td className="p-3 border" colSpan={4}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
