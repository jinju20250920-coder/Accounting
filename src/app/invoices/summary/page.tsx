'use client';

import { useState, useEffect } from 'react';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
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
import {
  FileText,
  Search,
  Download,
  TrendingUp,
  TrendingDown,
  Building2,
  CheckCircle,
} from 'lucide-react';
import type { InvoiceSummaryItem } from '@/types';
import * as XLSX from 'xlsx';

export default function InvoiceSummaryPage() {
  const {
    invoices,
    loading,
    initialize,
    getInvoiceSummary,
  } = useInvoiceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('partnerName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const currentAccountSetId = useAccountSetStore((state) => state.currentAccountSetId);

  // 初始化
  useEffect(() => {
    if (currentAccountSetId) {
      initialize();
    }
  }, [currentAccountSetId, initialize]);

  // 获取汇总数据
  const summaryData = getInvoiceSummary();

  // 筛选和排序
  const filteredAndSortedData = summaryData
    .filter(item =>
      !searchQuery ||
      item.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'partnerName':
          comparison = a.partnerName.localeCompare(b.partnerName);
          break;
        case 'totalInputAmount':
          comparison = a.totalInputAmount - b.totalInputAmount;
          break;
        case 'totalOutputAmount':
          comparison = a.totalOutputAmount - b.totalOutputAmount;
          break;
        case 'unpaidInputAmount':
          comparison = a.unpaidInputAmount - b.unpaidInputAmount;
          break;
        case 'unreceivedOutputAmount':
          comparison = a.unreceivedOutputAmount - b.unreceivedOutputAmount;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // 总计
  const totals = summaryData.reduce(
    (acc, item) => ({
      totalInputAmount: acc.totalInputAmount + item.totalInputAmount,
      totalOutputAmount: acc.totalOutputAmount + item.totalOutputAmount,
      paidInputAmount: acc.paidInputAmount + item.paidInputAmount,
      receivedOutputAmount: acc.receivedOutputAmount + item.receivedOutputAmount,
      unpaidInputAmount: acc.unpaidInputAmount + item.unpaidInputAmount,
      unreceivedOutputAmount: acc.unreceivedOutputAmount + item.unreceivedOutputAmount,
      inputInvoiceCount: acc.inputInvoiceCount + item.inputInvoiceCount,
      outputInvoiceCount: acc.outputInvoiceCount + item.outputInvoiceCount,
      hasVoucherInputCount: acc.hasVoucherInputCount + item.hasVoucherInputCount,
      hasVoucherOutputCount: acc.hasVoucherOutputCount + item.hasVoucherOutputCount,
    }),
    {
      totalInputAmount: 0,
      totalOutputAmount: 0,
      paidInputAmount: 0,
      receivedOutputAmount: 0,
      unpaidInputAmount: 0,
      unreceivedOutputAmount: 0,
      inputInvoiceCount: 0,
      outputInvoiceCount: 0,
      hasVoucherInputCount: 0,
      hasVoucherOutputCount: 0,
    }
  );

  // 导出Excel
  const handleExport = () => {
    const exportData = filteredAndSortedData.map(item => ({
      '往来单位': item.partnerName,
      '进项发票数量': item.inputInvoiceCount,
      '进项发票总额': item.totalInputAmount.toFixed(2),
      '已付金额': item.paidInputAmount.toFixed(2),
      '未付金额': item.unpaidInputAmount.toFixed(2),
      '进项凭证生成': `${item.hasVoucherInputCount}/${item.inputInvoiceCount}`,
      '销项发票数量': item.outputInvoiceCount,
      '销项发票总额': item.totalOutputAmount.toFixed(2),
      '已收金额': item.receivedOutputAmount.toFixed(2),
      '未收金额': item.unreceivedOutputAmount.toFixed(2),
      '销项凭证生成': `${item.hasVoucherOutputCount}/${item.outputInvoiceCount}`,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '发票资金一览表');
    XLSX.writeFile(wb, `发票资金一览表_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            发票资金一览表
          </h1>
          <p className="text-slate-500 mt-1">按往来单位汇总显示发票及收付款状态</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          导出Excel
        </Button>
      </div>

      {/* 汇总统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 进项统计 */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-blue-500" />
              进项发票
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{totals.inputInvoiceCount} 张</div>
            <div className="text-sm text-slate-500">¥{totals.totalInputAmount.toFixed(2)}</div>
          </CardContent>
        </Card>

        {/* 销项统计 */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              销项发票
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{totals.outputInvoiceCount} 张</div>
            <div className="text-sm text-slate-500">¥{totals.totalOutputAmount.toFixed(2)}</div>
          </CardContent>
        </Card>

        {/* 待付款 */}
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">待付款（进项）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-yellow-600">¥{totals.unpaidInputAmount.toFixed(2)}</div>
            <div className="text-sm text-slate-500">
              已付: ¥{totals.paidInputAmount.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        {/* 待收款 */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">待收款（销项）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-purple-600">¥{totals.unreceivedOutputAmount.toFixed(2)}</div>
            <div className="text-sm text-slate-500">
              已收: ¥{totals.receivedOutputAmount.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 凭证生成进度 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">进项凭证生成进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: totals.inputInvoiceCount > 0
                      ? `${(totals.hasVoucherInputCount / totals.inputInvoiceCount) * 100}%`
                      : '0%'
                  }}
                />
              </div>
              <span className="text-sm text-slate-600">
                {totals.hasVoucherInputCount}/{totals.inputInvoiceCount}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">销项凭证生成进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: totals.outputInvoiceCount > 0
                      ? `${(totals.hasVoucherOutputCount / totals.outputInvoiceCount) * 100}%`
                      : '0%'
                  }}
                />
              </div>
              <span className="text-sm text-slate-600">
                {totals.hasVoucherOutputCount}/{totals.outputInvoiceCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索往来单位..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partnerName">按单位名称</SelectItem>
                <SelectItem value="totalInputAmount">按进项金额</SelectItem>
                <SelectItem value="totalOutputAmount">按销项金额</SelectItem>
                <SelectItem value="unpaidInputAmount">按未付金额</SelectItem>
                <SelectItem value="unreceivedOutputAmount">按未收金额</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '升序' : '降序'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 汇总表格 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500" rowSpan={2}>
                    <Building2 className="h-4 w-4 inline mr-1" />
                    往来单位
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500 border-l" colSpan={4}>
                    <TrendingDown className="h-4 w-4 inline mr-1 text-blue-500" />
                    进项发票
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500 border-l" colSpan={4}>
                    <TrendingUp className="h-4 w-4 inline mr-1 text-green-500" />
                    销项发票
                  </th>
                </tr>
                <tr className="bg-slate-50 border-t">
                  {/* 进项子列 */}
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 border-l">数量</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">发票金额</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">已付金额</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">未付金额</th>
                  {/* 销项子列 */}
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 border-l">数量</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">发票金额</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">已收金额</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">未收金额</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredAndSortedData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedData.map((item, idx) => (
                    <tr key={idx} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{item.partnerName}</td>
                      {/* 进项 */}
                      <td className="px-3 py-3 text-center border-l">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {item.inputInvoiceCount}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right">¥{item.totalInputAmount.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-green-600">¥{item.paidInputAmount.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-yellow-600 font-medium">
                        ¥{item.unpaidInputAmount.toFixed(2)}
                      </td>
                      {/* 销项 */}
                      <td className="px-3 py-3 text-center border-l">
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {item.outputInvoiceCount}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right">¥{item.totalOutputAmount.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-green-600">¥{item.receivedOutputAmount.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-purple-600 font-medium">
                        ¥{item.unreceivedOutputAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
                {/* 合计行 */}
                {filteredAndSortedData.length > 0 && (
                  <tr className="border-t-2 bg-slate-100 font-bold">
                    <td className="px-4 py-3">合计</td>
                    <td className="px-3 py-3 text-center border-l">
                      <Badge className="bg-blue-500">{totals.inputInvoiceCount}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">¥{totals.totalInputAmount.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-green-600">¥{totals.paidInputAmount.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-yellow-600">¥{totals.unpaidInputAmount.toFixed(2)}</td>
                    <td className="px-3 py-3 text-center border-l">
                      <Badge className="bg-green-500">{totals.outputInvoiceCount}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">¥{totals.totalOutputAmount.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-green-600">¥{totals.receivedOutputAmount.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-purple-600">¥{totals.unreceivedOutputAmount.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 凭证生成状态表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            凭证生成状态
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">往来单位</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">进项凭证</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">销项凭证</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.map((item, idx) => {
                  const inputComplete = item.inputInvoiceCount === 0 || item.hasVoucherInputCount === item.inputInvoiceCount;
                  const outputComplete = item.outputInvoiceCount === 0 || item.hasVoucherOutputCount === item.outputInvoiceCount;
                  const allComplete = inputComplete && outputComplete;

                  return (
                    <tr key={idx} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3">{item.partnerName}</td>
                      <td className="px-4 py-3 text-center">
                        {item.hasVoucherInputCount}/{item.inputInvoiceCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.hasVoucherOutputCount}/{item.outputInvoiceCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {allComplete ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            已完成
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                            待处理
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
