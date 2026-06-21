'use client';

import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AgingResult, AgingDetail, AgingMode } from '@/lib/accounting';
import { formatMoney, formatAging, getOverdueColor } from '@/lib/accounting';

interface AgingReportProps {
  data: AgingResult[];
  details: AgingDetail[];
  mode: AgingMode;
  onBucketClick: (bucket: string) => void;
  onPartnerClick: (partner: string) => void;
  useCustomBuckets?: boolean;
  customBuckets?: number[];
  onBatchWriteOff?: (selectedIds: string[]) => Promise<void>;
  summaryStats?: {
    totalBalance: number;
    current: number;
    overdue1: number;
    overdue2: number;
    overdue3: number;
    overdue6: number;
  };
}

function getBucketColor(index: number): string {
  const colors = [
    'bg-green-100',
    'bg-yellow-100',
    'bg-orange-100',
    'bg-red-100',
    'bg-red-200'
  ];
  return colors[index] || 'bg-gray-100';
}

function getBucketLabels(mode: AgingMode, useCustomBuckets: boolean = false, customBuckets: number[] = [30, 90, 180, 365, 730]): Record<string, string> {
  if (useCustomBuckets) {
    // 使用用户自定义的5个区间，不进行排序，保持用户输入的顺序
    return {
      current: `0-${customBuckets[0]}天`,
      overdue1: `${customBuckets[0] + 1}-${customBuckets[1]}天`,
      overdue2: `${customBuckets[1] + 1}-${customBuckets[2]}天`,
      overdue3: `${customBuckets[2] + 1}-${customBuckets[3]}天`,
      overdue6: `${customBuckets[3] + 1}-${customBuckets[4]}天, ${customBuckets[4]}天以上`
    };
  }

  switch (mode) {
    case 'month':
      return {
        current: '0-30天',
        overdue1: '31-90天',
        overdue2: '91-180天',
        overdue3: '181-365天',
        overdue6: '365天以上'
      };

    case 'year':
      return {
        current: '0-1年',
        overdue1: '1-2年',
        overdue2: '2-3年',
        overdue3: '3-5年',
        overdue6: '5年以上'
      };

    case 'day':
      return {
        current: '0-30天',
        overdue1: '31-60天',
        overdue2: '61-90天',
        overdue3: '91-120天',
        overdue6: '120天以上'
      };

    default:
      return {
        current: '当前',
        overdue1: '1期',
        overdue2: '2期',
        overdue3: '3期',
        overdue6: '6期以上'
      };
  }
}

export function AgingReport({
  data,
  details,
  mode,
  onBucketClick,
  onPartnerClick,
  useCustomBuckets = false,
  customBuckets = [30, 90, 180, 365],
  onBatchWriteOff,
  summaryStats
}: AgingReportProps) {
  const bucketLabels = getBucketLabels(mode, useCustomBuckets, customBuckets);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedPartnerName, setSelectedPartnerName] = useState<string | null>(null);

  // 切换选择状态
  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id)
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedItems.length === details.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(details.map(detail => detail.id));
    }
  };

  // 批量核销
  const handleBatchWriteOff = async () => {
    if (onBatchWriteOff && selectedItems.length > 0) {
      try {
        await onBatchWriteOff(selectedItems);
        // 核销成功后，清空选择
        setSelectedItems([]);
      } catch (error) {
        console.error('批量核销失败:', error);
      }
    }
  };

  // 处理客户点击 - 显示明细弹窗
  const handlePartnerClick = (partnerName: string) => {
    setSelectedPartnerName(partnerName);
    setShowDetailsDialog(true);
    if (onPartnerClick) {
      onPartnerClick(partnerName);
    }
  };

  // 关闭明细弹窗
  const handleCloseDetailsDialog = () => {
    setShowDetailsDialog(false);
    setSelectedPartnerName(null);
    // 清除筛选，恢复显示全部明细
    if (onPartnerClick) {
      onPartnerClick(null); // 传递 null 表示清除筛选
    }
  };

  // 导出明细数据到 Excel
  const handleExportDetails = () => {
    try {
      const exportData = details.map(detail => ({
        '凭证号': detail.voucherNo,
        '单据号': detail.docNo,
        '日期': detail.date,
        '摘要': detail.summary,
        '科目代码': detail.subjectCode,
        '科目名称': detail.subjectName,
        '金额': detail.amount,
        '币别': detail.currencyCode && detail.currencyCode !== 'CNY' && detail.currencyCode !== 'RMB' ? detail.currencyCode : 'CNY',
        '原币金额': detail.originalAmount && detail.currencyCode && detail.currencyCode !== 'CNY' && detail.currencyCode !== 'RMB' ? detail.originalAmount : '',
        '汇率': detail.exchangeRate && detail.currencyCode && detail.currencyCode !== 'CNY' && detail.currencyCode !== 'RMB' ? detail.exchangeRate : '',
        '剩余金额': detail.remainingAmount,
        '账龄': formatAging(detail.daysOverdue, mode),
        '状态': Math.abs(detail.remainingAmount) < 0.01 ? '已核销' :
               Math.abs(detail.remainingAmount - detail.amount) >= 0.01 ? '部分核销' : '未核销'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `账龄明细-${selectedPartnerName}`);

      const fileName = `账龄明细_${selectedPartnerName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('导出明细失败:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 汇总表 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left text-sm font-medium">往来单位</th>
              <th className="p-2 text-right text-sm font-medium">余额</th>
              <th className="p-2 text-right text-sm font-medium">{bucketLabels.current}</th>
              <th className="p-2 text-right text-sm font-medium">{bucketLabels.overdue1}</th>
              <th className="p-2 text-right text-sm font-medium">{bucketLabels.overdue2}</th>
              <th className="p-2 text-right text-sm font-medium">{bucketLabels.overdue3}</th>
              <th className="p-2 text-right text-sm font-medium">{bucketLabels.overdue6}</th>
              <th className="p-2 text-center text-sm font-medium">账龄分布</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.partner} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <button
                    onClick={() => handlePartnerClick(item.partner)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {item.partner}
                  </button>
                </td>
                <td className="p-2 text-right font-medium">
                  {formatMoney(item.totalAmount)}
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('current')}
                    className="text-gray-700 hover:text-blue-600"
                  >
                    {formatMoney(item.buckets.current)}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('overdue1')}
                    className="text-yellow-600 hover:text-blue-600"
                  >
                    {formatMoney(item.buckets.overdue1)}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('overdue2')}
                    className="text-orange-600 hover:text-blue-600"
                  >
                    {formatMoney(item.buckets.overdue2)}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('overdue3')}
                    className="text-red-600 hover:text-blue-600"
                  >
                    {formatMoney(item.buckets.overdue3)}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('overdue6')}
                    className="text-red-700 hover:text-blue-600 font-medium"
                  >
                    {formatMoney(item.buckets.overdue6)}
                  </button>
                </td>
                <td className="p-2">
                  <div className="flex gap-1 h-4">
                    {item.agingDistribution.map((percent, index) => (
                      <div
                        key={index}
                        className={`h-full rounded ${getBucketColor(index)}`}
                        style={{ width: `${percent * 100}%` }}
                        title={`${(percent * 100).toFixed(0)}%`}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {/* 汇总行 */}
            {summaryStats && (
              <tr className="border-b-2 border-slate-300 bg-slate-100 font-bold">
                <td className="p-2">合计</td>
                <td className="p-2 text-right">{formatMoney(summaryStats.totalBalance)}</td>
                <td className="p-2 text-right">{formatMoney(summaryStats.current)}</td>
                <td className="p-2 text-right">{formatMoney(summaryStats.overdue1)}</td>
                <td className="p-2 text-right">{formatMoney(summaryStats.overdue2)}</td>
                <td className="p-2 text-right">{formatMoney(summaryStats.overdue3)}</td>
                <td className="p-2 text-right">{formatMoney(summaryStats.overdue6)}</td>
                <td className="p-2">
                  <div className="flex gap-1 h-4">
                    {summaryStats.totalBalance > 0 ? [
                      summaryStats.current / summaryStats.totalBalance,
                      summaryStats.overdue1 / summaryStats.totalBalance,
                      summaryStats.overdue2 / summaryStats.totalBalance,
                      summaryStats.overdue3 / summaryStats.totalBalance,
                      summaryStats.overdue6 / summaryStats.totalBalance
                    ].map((percent, index) => (
                      <div
                        key={index}
                        className={`h-full rounded ${getBucketColor(index)}`}
                        style={{ width: `${Math.max(0, percent * 100)}%` }}
                        title={`${(Math.max(0, percent * 100)).toFixed(0)}%`}
                      />
                    )): null}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 明细弹窗 */}
      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        if (!open) handleCloseDetailsDialog();
        setShowDetailsDialog(open);
      }}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <DialogTitle>明细数据 - {selectedPartnerName}</DialogTitle>
              <p className="text-sm text-slate-500 mt-1">
                共 {details.length} 条记录
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDetails}
              >
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseDetailsDialog}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4">
            {selectedItems.length > 0 && (
              <div className="mb-4 flex justify-end">
                <Button
                  onClick={handleBatchWriteOff}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  批量核销 ({selectedItems.length})
                </Button>
              </div>
            )}

            <table className="w-full border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-2 text-center text-sm font-medium w-8">
                    <Checkbox
                      checked={selectedItems.length === details.length}
                      onCheckedChange={toggleSelectAll}
                      className="mx-auto"
                    />
                  </th>
                  <th className="p-2 text-left text-sm font-medium">凭证号</th>
                  <th className="p-2 text-left text-sm font-medium">单据号</th>
                  <th className="p-2 text-left text-sm font-medium">日期</th>
                  <th className="p-2 text-left text-sm font-medium">摘要</th>
                  <th className="p-2 text-left text-sm font-medium">科目代码</th>
                  <th className="p-2 text-left text-sm font-medium">科目名称</th>
                  <th className="p-2 text-right text-sm font-medium">金额</th>
                  <th className="p-2 text-center text-sm font-medium">币别</th>
                  <th className="p-2 text-right text-sm font-medium">原币金额</th>
                  <th className="p-2 text-right text-sm font-medium">汇率</th>
                  <th className="p-2 text-right text-sm font-medium">剩余金额</th>
                  <th className="p-2 text-right text-sm font-medium">账龄</th>
                  <th className="p-2 text-left text-sm font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {details.map((detail) => (
                  <tr key={detail.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-center">
                      <Checkbox
                        checked={selectedItems.includes(detail.id)}
                        onCheckedChange={() => toggleItemSelection(detail.id)}
                        disabled={detail.isWriteOff}
                        className="mx-auto"
                      />
                    </td>
                    <td className="p-2 text-sm">{detail.voucherNo}</td>
                    <td className="p-2 text-sm">{detail.docNo}</td>
                    <td className="p-2 text-sm">{detail.date}</td>
                    <td className="p-2 text-sm">{detail.summary}</td>
                    <td className="p-2 text-sm">{detail.subjectCode}</td>
                    <td className="p-2 text-sm">{detail.subjectName}</td>
                    <td className={`p-2 text-right text-sm ${detail.amount < 0 ? 'text-red-600' : ''}`}>
                      {formatMoney(detail.amount)}
                    </td>
                    <td className="p-2 text-center text-xs">
                      {detail.currencyCode && detail.currencyCode !== 'CNY' && detail.currencyCode !== 'RMB'
                        ? <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px]">{detail.currencyCode}</Badge>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-2 text-right text-xs text-slate-600 font-mono">
                      {detail.originalAmount && detail.currencyCode && detail.currencyCode !== 'CNY' && detail.currencyCode !== 'RMB'
                        ? formatMoney(detail.originalAmount)
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-2 text-right text-xs text-slate-600 font-mono">
                      {detail.exchangeRate && detail.currencyCode && detail.currencyCode !== 'CNY' && detail.currencyCode !== 'RMB'
                        ? detail.exchangeRate
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className={`p-2 text-right text-sm ${detail.remainingAmount < 0 ? 'text-red-600' : ''}`}>
                      {formatMoney(detail.remainingAmount)}
                    </td>
                    <td className={`p-2 text-right text-sm font-medium ${
                      getOverdueColor(detail.daysOverdue, detail.isWriteOff)
                    }`}>
                      {formatAging(detail.daysOverdue, mode)}
                    </td>
                    <td className="p-2">
                      {Math.abs(detail.remainingAmount) < 0.01 ? (
                        <Badge variant="outline" className="text-xs">已核销</Badge>
                      ) : Math.abs(detail.remainingAmount - detail.amount) >= 0.01 ? (
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">部分核销</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs bg-yellow-100 text-yellow-800">
                          未核销
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {details.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                暂无明细数据
              </div>
            )}
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button variant="outline" onClick={handleCloseDetailsDialog}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
