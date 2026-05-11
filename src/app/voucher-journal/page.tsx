'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { useToast } from '@/components/ui/toast';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import {
  buildVoucherJournalCsv,
  buildVoucherJournalRows,
  VOUCHER_STATUS_LABELS,
  VOUCHER_TYPE_LABELS,
} from '@/lib/voucher-journal';

function formatAmount(value: number): string {
  if (!value) return '';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function VoucherJournalPage() {
  const vouchers = useVoucherStore((state) => state.vouchers);
  const { getCurrentAccountSet } = useAccountSetStore();
  const { showToast } = useToast();
  const currentAccountSet = getCurrentAccountSet();
  const defaultPeriod = currentAccountSet?.currentPeriod || currentMonth();

  const [searchQuery, setSearchQuery] = useState('');
  const [startMonth, setStartMonth] = useState(defaultPeriod);
  const [endMonth, setEndMonth] = useState(defaultPeriod);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    useVoucherStore.getState().initialize();
  }, []);

  const rows = useMemo(
    () =>
      buildVoucherJournalRows(vouchers, {
        startMonth,
        endMonth,
        searchQuery,
      }),
    [vouchers, startMonth, endMonth, searchQuery],
  );

  const debitTotal = rows.reduce((sum, row) => sum + row.debit, 0);
  const creditTotal = rows.reduce((sum, row) => sum + row.credit, 0);
  const journalVoucherCount = new Set(rows.map((row) => row.voucherId)).size;

  const handleStartMonthChange = (value: string) => {
    setStartMonth(value);
    if (value && endMonth && value > endMonth) {
      setEndMonth(value);
    }
  };

  const handleEndMonthChange = (value: string) => {
    setEndMonth(value);
    if (value && startMonth && value < startMonth) {
      setStartMonth(value);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const accountSetStore = useAccountSetStore.getState();
      const activeAccountSet = accountSetStore.getCurrentAccountSet();

      if (activeAccountSet) {
        sqliteService.setAccountSetId(activeAccountSet.id);
      }

      await useVoucherStore.getState().initialize();
      showToast('success', '凭证序时账已刷新');
    } catch (error) {
      console.error('Refresh voucher journal failed:', error);
      showToast('error', '刷新凭证序时账失败');
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  const handleExport = () => {
    const csvContent = buildVoucherJournalCsv(rows);
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `凭证序时账_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">凭证序时账</h1>
          <p className="text-slate-500 mt-1">
            按 Excel 表格展示已记账和已冲销凭证流水，每条凭证分录单独成行。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出 CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">序时账凭证</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{journalVoucherCount}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">分录行数</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">借贷合计</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">
              {formatAmount(debitTotal)} / {formatAmount(creditTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[280px]">
              <label className="text-sm font-medium text-slate-600">搜索</label>
              <div className="flex items-center gap-2 mt-2">
                <Search className="w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="凭证号、摘要、科目、往来单位、单据号"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">会计期间</label>
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <ChineseMonthPicker value={startMonth} onChange={handleStartMonthChange} className="w-36" />
                <span className="text-slate-400">至</span>
                <ChineseMonthPicker value={endMonth} onChange={handleEndMonthChange} className="w-36" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">状态</label>
              <div className="mt-2">
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">已记账/已冲销</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-700">暂无凭证序时账流水</p>
              <p className="text-sm mt-1">请确认筛选期间，或先完成凭证记账。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: '1840px' }}>
                <colgroup>
                  <col style={{ width: '60px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '90px' }} />
                </colgroup>
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="border-b-2 border-slate-200">
                    {[
                      '序号',
                      '凭证号',
                      '日期',
                      '凭证类型',
                      '状态',
                      '摘要',
                      '科目代码',
                      '科目名称',
                      '借方金额',
                      '贷方金额',
                      '币别',
                      '原币金额',
                      '往来单位',
                      '部门',
                      '项目',
                      '现金流量',
                      '业务单据号',
                      '核销单号',
                      '创建人',
                    ].map((header) => (
                      <th key={header} className="py-3 px-2 text-left text-xs font-semibold text-slate-700 border-r border-slate-200">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.voucherId}_${row.entryId}`} className="border-b border-slate-100 hover:bg-blue-50/40">
                      <td className="py-2 px-2 text-center text-xs text-slate-500 border-r border-slate-100">{row.lineNo}</td>
                      <td className="py-2 px-2 border-r border-slate-100">
                        <Link href="/voucher-list?status=posted_reversed" className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                          {row.voucherNo}
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-xs border-r border-slate-100">{row.date}</td>
                      <td className="py-2 px-2 text-xs border-r border-slate-100">{VOUCHER_TYPE_LABELS[row.voucherType]}</td>
                      <td className="py-2 px-2 border-r border-slate-100">
                        <Badge className="bg-green-100 text-green-700 text-xs hover:bg-green-100">
                          {VOUCHER_STATUS_LABELS[row.status]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-xs border-r border-slate-100">
                        <span className="block truncate" title={row.summary}>{row.summary}</span>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs text-blue-600 border-r border-slate-100">{row.subjectCode}</td>
                      <td className="py-2 px-2 text-xs border-r border-slate-100">
                        <span className="block truncate" title={row.subjectName}>{row.subjectName}</span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs border-r border-slate-100">{formatAmount(row.debit)}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs border-r border-slate-100">{formatAmount(row.credit)}</td>
                      <td className="py-2 px-2 text-center text-xs border-r border-slate-100">{row.currencyCode}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs border-r border-slate-100">{formatAmount(row.originalAmount)}</td>
                      <td className="py-2 px-2 text-xs border-r border-slate-100">
                        <span className="block truncate" title={row.partner}>{row.partner}</span>
                      </td>
                      <td className="py-2 px-2 text-xs border-r border-slate-100">{row.department}</td>
                      <td className="py-2 px-2 text-xs border-r border-slate-100">{row.project}</td>
                      <td className="py-2 px-2 text-xs border-r border-slate-100">
                        <span className="block truncate" title={row.cashFlowItem}>{row.cashFlowItem}</span>
                      </td>
                      <td className="py-2 px-2 text-xs font-mono border-r border-slate-100">
                        <span className="block truncate" title={row.docNo}>{row.docNo}</span>
                      </td>
                      <td className="py-2 px-2 text-xs font-mono border-r border-slate-100">
                        <span className="block truncate" title={row.recRefNo}>{row.recRefNo}</span>
                      </td>
                      <td className="py-2 px-2 text-xs">{row.createdBy}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 border-t-2 border-slate-300 font-semibold">
                    <td className="py-2 px-2" colSpan={8}>合计</td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-blue-600">{formatAmount(debitTotal)}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-blue-600">{formatAmount(creditTotal)}</td>
                    <td colSpan={9}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
