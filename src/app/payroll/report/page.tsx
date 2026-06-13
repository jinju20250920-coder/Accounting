'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { SimpleSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useDepartmentStore } from '@/stores/useDepartmentStore';
import { usePayrollStore } from '@/stores/usePayrollStore';
import { useVoucherStore } from '@/stores/useVoucherStore';
import type { PayrollBatch, PayrollItem } from '@/lib/payroll';
import {
  buildPayrollReportData,
  type PayrollEmployeeMonthRow,
  type PayrollReportFilters,
  type PayrollReportStatusFilter,
} from '@/lib/payroll-report';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isMonetarySubject } from '@/lib/fx-monetary';

type ReportTab = 'batch' | 'detail';

const reportStatusOptions: Array<{ value: PayrollReportStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'calculated', label: '已计算' },
  { value: 'confirmed', label: '已确认' },
  { value: 'invoiced', label: '已入账' },
];

const voucherStatusConfig = {
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-700' },
  review: { label: '审核中', color: 'bg-amber-50 text-amber-700' },
  posted: { label: '已入账', color: 'bg-emerald-50 text-emerald-700' },
  reversed: { label: '已冲销', color: 'bg-red-50 text-red-700' },
} as const;

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  if (!year || !month) return period;
  return `${year}年${month}月`;
}

function getStatusBadgeClass(statusLabel: string): string {
  switch (statusLabel) {
    case '已入账':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case '已确认':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case '已计算':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function getSummaryCardClass(label: string): string {
  if (label === '实发工资合计') return 'border-blue-200 bg-blue-50 shadow-blue-100/50';
  if (label === '公司成本合计') return 'border-slate-900 bg-slate-900 text-white shadow-slate-200/40';
  return 'border-slate-200 bg-white';
}

function getSummaryValueClass(label: string): string {
  if (label === '实发工资合计') return 'mt-2 text-3xl font-semibold tabular-nums text-blue-700';
  if (label === '公司成本合计') return 'mt-2 text-3xl font-semibold tabular-nums text-white';
  return 'mt-2 text-2xl font-semibold tabular-nums text-slate-900';
}

function isManualBatch(sourceFileName?: string): boolean {
  const source = sourceFileName?.trim();
  if (!source) return true;
  return source.startsWith('paybatch_');
}

function getBatchSubtitle(sourceFileName?: string): string {
  const source = sourceFileName?.trim();
  if (!source || isManualBatch(sourceFileName)) return '';
  return source;
}

function getDetailKey(row: PayrollEmployeeMonthRow): string {
  return `${row.batchId}:${row.employeeCode}`;
}

function buildPayslipWorkbook(row: PayrollEmployeeMonthRow): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ['工资明细', `${formatPeriodLabel(row.batchPeriod)} ${row.employeeName}`],
    ['工号', row.employeeCode],
    ['姓名', row.employeeName],
    ['部门', row.departmentName],
    ['批次', row.batchName],
    ['状态', row.statusLabel],
    ['凭证', row.voucherLabel],
  ];

  const earningRows = [
    ['应发项目', '金额'],
    ['基本工资', row.inputData.basicSalary || 0],
    ['奖金', row.inputData.bonus || 0],
    ['津贴补贴', row.inputData.allowance || 0],
    ['其他应发', row.inputData.otherEarnings || 0],
    ['请假扣款', row.inputData.leaveDeduction || 0],
    ['其他税前扣减', row.inputData.otherPreTaxDeduction || 0],
  ];

  const deductionRows = [
    ['扣款项目', '金额'],
    ['个人社保', row.employeeSocialInsurance],
    ['个人公积金', row.employeeHousingFund],
    ['个人所得税', row.individualIncomeTax],
    ['实发工资', row.netSalary],
  ];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), '工资摘要');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(earningRows), '应发项目');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(deductionRows), '扣款项目');
  return workbook;
}

function VoucherDetailDialog({
  open,
  onOpenChange,
  voucherLoading,
  voucherId,
  voucher,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucherLoading: boolean;
  voucherId: string | null;
  voucher: ReturnType<typeof useVoucherStore.getState>['currentVoucher'];
  onRefresh: () => void;
}) {
  const displayVoucher = voucher && voucherId && voucher.id === voucherId ? voucher : null;
  const entries = displayVoucher?.entries ?? [];
  const debitTotal = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const creditTotal = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  const status = displayVoucher?.status ? voucherStatusConfig[displayVoucher.status] : null;
  const showFxColumns = entries.some(e => !!e.currencyCode && e.currencyCode !== 'CNY');
  const fxCellStyle = (entry: { subjectCode: string; currencyCode?: string }) => {
    const isMonetary = isMonetarySubject(entry.subjectCode);
    const hasFx = !!entry.currencyCode && entry.currencyCode !== 'CNY';
    return isMonetary && hasFx ? 'text-slate-600' : 'text-slate-300';
  };
  const fmtOriginal = (entry: { subjectCode: string; currencyCode?: string; originalAmount?: number }) => {
    if (!isMonetarySubject(entry.subjectCode)) return '-';
    if (!entry.currencyCode || entry.currencyCode === 'CNY') return '-';
    return entry.originalAmount && entry.originalAmount > 0 ? formatMoney(entry.originalAmount) : '-';
  };
  const fmtRate = (entry: { subjectCode: string; currencyCode?: string; exchangeRate?: number }) => {
    if (!isMonetarySubject(entry.subjectCode)) return '-';
    if (!entry.currencyCode || entry.currencyCode === 'CNY') return '-';
    return entry.exchangeRate && entry.exchangeRate > 0 ? entry.exchangeRate.toFixed(4) : '-';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden p-0">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="text-xl">凭证明细</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              点击工资批次凭证号后打开的系统凭证详情
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {voucherLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在加载凭证...
              </div>
            ) : displayVoucher ? (
              <div className="space-y-6">
                <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-4">
                  <div>
                    <div className="text-xs text-slate-500">凭证号</div>
                    <div className="mt-1 font-mono text-sm font-medium text-slate-900">{displayVoucher.voucherNo}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">日期</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{displayVoucher.date}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">状态</div>
                    <Badge className={cn('mt-1 rounded-full', status?.color ?? 'bg-slate-100 text-slate-700')}>
                      {status?.label ?? displayVoucher.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">摘要</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{displayVoucher.summary || '-'}</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">借方合计</div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{formatMoney(debitTotal)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">贷方合计</div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{formatMoney(creditTotal)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">平衡状态</div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                      {Math.abs(debitTotal - creditTotal) < 0.01 ? '平衡' : '不平衡'}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>摘要</TableHead>
                        <TableHead>科目</TableHead>
                        <TableHead>往来/辅助</TableHead>
                        <TableHead className="text-right">借方</TableHead>
                        <TableHead className="text-right">贷方</TableHead>
                        {showFxColumns && <TableHead className="text-right">币别</TableHead>}
                        {showFxColumns && <TableHead className="text-right">原币金额</TableHead>}
                        {showFxColumns && <TableHead className="text-right">汇率</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.filter((entry) => entry.subjectCode || entry.debit || entry.credit).length > 0 ? (
                        entries
                          .filter((entry) => entry.subjectCode || entry.debit || entry.credit)
                          .map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>{entry.summary || '-'}</TableCell>
                              <TableCell>
                                <div className="font-mono text-sm">{entry.subjectCode || '-'}</div>
                                <div className="text-xs text-slate-500">{entry.subjectName || '-'}</div>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {entry.auxiliary?.department || entry.auxiliary?.customer || entry.auxiliary?.supplier || '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{entry.debit ? formatMoney(entry.debit) : '-'}</TableCell>
                              <TableCell className="text-right tabular-nums">{entry.credit ? formatMoney(entry.credit) : '-'}</TableCell>
                              {showFxColumns && (
                                <TableCell className={`text-right tabular-nums ${fxCellStyle(entry)}`}>
                                  {isMonetarySubject(entry.subjectCode) && entry.currencyCode && entry.currencyCode !== 'CNY'
                                    ? entry.currencyCode : '-'}
                                </TableCell>
                              )}
                              {showFxColumns && (
                                <TableCell className={`text-right tabular-nums ${fxCellStyle(entry)}`}>
                                  {fmtOriginal(entry)}
                                </TableCell>
                              )}
                              {showFxColumns && (
                                <TableCell className={`text-right tabular-nums ${fxCellStyle(entry)}`}>
                                  {fmtRate(entry)}
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={showFxColumns ? 8 : 5} className="py-10 text-center text-slate-400">
                            当前凭证没有可展示的分录
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500">
                未找到凭证{voucherId ? `：${voucherId}` : ''}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <Button variant="outline" onClick={onRefresh} disabled={!voucherId || voucherLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              重新加载
            </Button>
            <Button onClick={() => onOpenChange(false)}>关闭</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PayrollReportPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const currentAccountSetId = useAccountSetStore((state) => state.currentAccountSetId);
  const currentAccountSet = useAccountSetStore((state) => state.getCurrentAccountSet());
  const recalculateBatch = usePayrollStore((state) => state.recalculateBatch);
  const departments = useDepartmentStore((state) => state.departments);
  const initializeDepartments = useDepartmentStore((state) => state.initializeDepartments);
  const loadVoucher = useVoucherStore((state) => state.loadVoucher);
  const currentVoucher = useVoucherStore((state) => state.currentVoucher);

  const currentPeriod = currentAccountSet?.currentPeriod || new Date().toISOString().slice(0, 7);
  const defaultStartPeriod = `${currentPeriod.slice(0, 4)}-01`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allBatches, setAllBatches] = useState<PayrollBatch[]>([]);
  const [itemsByBatchId, setItemsByBatchId] = useState<Map<string, PayrollItem[]>>(new Map());
  const [activeTab, setActiveTab] = useState<ReportTab>('batch');
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());
  const [expandedDetailKeys, setExpandedDetailKeys] = useState<Set<string>>(new Set());
  const [draftFilters, setDraftFilters] = useState<PayrollReportFilters>({
    startPeriod: defaultStartPeriod,
    endPeriod: currentPeriod,
    employeeQuery: '',
    departmentName: '',
    status: 'all',
  });
  const [appliedFilters, setAppliedFilters] = useState<PayrollReportFilters>({
    startPeriod: defaultStartPeriod,
    endPeriod: currentPeriod,
    employeeQuery: '',
    departmentName: '',
    status: 'all',
  });
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  const loadReportData = useCallback(async () => {
    if (!currentAccountSetId) {
      setLoading(false);
      setError('请先选择账套后查看工资报表。');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      sqliteService.setAccountSetId(currentAccountSetId);
      const batches = await sqliteService.getPayrollBatches();
      const batchPairs = await Promise.all(
        batches.map(async (batch) => [batch.id, await sqliteService.getPayrollItems(batch.id)] as const),
      );
      setAllBatches(batches);
      setItemsByBatchId(new Map(batchPairs));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '工资报表加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentAccountSetId]);

  useEffect(() => {
    if (!currentAccountSetId) return;
    void initializeDepartments();
  }, [currentAccountSetId, initializeDepartments]);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  const report = useMemo(
    () =>
      buildPayrollReportData({
        batches: allBatches,
        itemsByBatchId,
        filters: appliedFilters,
      }),
    [allBatches, appliedFilters, itemsByBatchId],
  );

  const applyFilters = useCallback((nextFilters: PayrollReportFilters) => {
    if (nextFilters.startPeriod && nextFilters.endPeriod && nextFilters.startPeriod > nextFilters.endPeriod) {
      setError('起始期间不能晚于结束期间。');
      return;
    }
    setError(null);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, []);

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = new Map<string, string>();
    departments
      .filter((department) => department.name.trim())
      .forEach((department) => {
        uniqueDepartments.set(department.name.trim(), department.code);
      });

    return Array.from(uniqueDepartments.entries())
      .map(([name, code]) => ({ value: name, label: name, code }))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  }, [departments]);

  const employeeOptions = useMemo(() => {
    const uniqueEmployees = new Map<string, { employeeCode: string; employeeName: string; departmentName: string }>();
    allBatches.forEach((batch) => {
      (itemsByBatchId.get(batch.id) || []).forEach((item) => {
        const key = item.employeeCode || item.employeeName;
        if (!key) return;
        if (!uniqueEmployees.has(key)) {
          uniqueEmployees.set(key, {
            employeeCode: item.employeeCode,
            employeeName: item.employeeName,
            departmentName: item.departmentName || '',
          });
        }
      });
    });

    return Array.from(uniqueEmployees.values()).sort((left, right) => {
      const codeCompare = left.employeeCode.localeCompare(right.employeeCode, 'zh-CN');
      if (codeCompare !== 0) return codeCompare;
      return left.employeeName.localeCompare(right.employeeName, 'zh-CN');
    });
  }, [allBatches, itemsByBatchId]);

  useEffect(() => {
    setExpandedBatchIds(new Set());
    setExpandedDetailKeys(new Set());
  }, [appliedFilters, activeTab]);

  const handleApplyFilters = () => {
    if (draftFilters.startPeriod && draftFilters.endPeriod && draftFilters.startPeriod > draftFilters.endPeriod) {
      setError('起始期间不能晚于结束期间。');
      return;
    }
    setError(null);
    setAppliedFilters({ ...draftFilters });
  };

  const handleResetFilters = () => {
    const reset = {
      startPeriod: defaultStartPeriod,
      endPeriod: currentPeriod,
      employeeQuery: '',
      departmentName: '',
      status: 'all' as PayrollReportStatusFilter,
    };
    setDraftFilters(reset);
    setAppliedFilters(reset);
  };

  const handleExport = () => {
    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['指标', '金额'],
      ['税前工资合计', report.summary.grossTotal],
      ['个人社保公积金合计', report.summary.employeeContributionTotal],
      ['个税合计', report.summary.taxTotal],
      ['实发工资合计', report.summary.netTotal],
      ['公司成本合计', report.summary.employerCostTotal],
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总');

    if (activeTab === 'batch') {
      const rows = report.batchRows.map((row) => ({
        批次期间: row.batchPeriod,
        批次名称: row.batchName,
        状态: row.statusLabel,
        凭证号: row.voucherLabel,
        员工数: row.employeeCount,
        税前工资合计: row.grossTotal,
        个人社保公积金合计: row.employeeContributionTotal,
        个税合计: row.taxTotal,
        实发工资合计: row.netTotal,
        公司成本合计: row.employerCostTotal,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '按批次汇总');
    } else {
      const rows = report.detailRows.map((row) => ({
        月份: row.batchPeriod,
        工号: row.employeeCode,
        姓名: row.employeeName,
        部门: row.departmentName,
        批次: row.batchName,
        状态: row.statusLabel,
        凭证号: row.voucherLabel,
        税前工资: row.grossSalary,
        个人社保: row.employeeSocialInsurance,
        个人公积金: row.employeeHousingFund,
        个税: row.individualIncomeTax,
        实发工资: row.netSalary,
        公司社保: row.employerSocialInsurance,
        公司公积金: row.employerHousingFund,
        公司成本: row.employerCostTotal,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '按员工月份明细');
    }

    XLSX.writeFile(workbook, `工资报表_${currentPeriod}_${activeTab === 'batch' ? '批次' : '明细'}.xlsx`);
  };

  const handleRecalculate = async (batchId: string) => {
    try {
      await recalculateBatch(batchId);
      await loadReportData();
      showToast('success', '工资批次重新计算成功');
    } catch (recalcError) {
      showToast('error', recalcError instanceof Error ? recalcError.message : '工资批次重新计算失败');
    }
  };

  const toggleBatchExpand = (batchId: string) => {
    setExpandedBatchIds((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const toggleDetailExpand = (row: PayrollEmployeeMonthRow) => {
    const key = getDetailKey(row);
    setExpandedDetailKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openVoucherDetail = useCallback(
    async (voucherId: string) => {
      if (!voucherId) return;
      setSelectedVoucherId(voucherId);
      setVoucherDialogOpen(true);
      setVoucherLoading(true);
      try {
        await loadVoucher(voucherId);
        const loadedVoucher = useVoucherStore.getState().currentVoucher;
        if (!loadedVoucher || loadedVoucher.id !== voucherId) {
          showToast('error', '未找到对应凭证。');
        }
      } catch (loadError) {
        showToast('error', loadError instanceof Error ? loadError.message : '凭证加载失败');
      } finally {
        setVoucherLoading(false);
      }
    },
    [loadVoucher, showToast],
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">工资统计汇总</h1>
                <p className="mt-1 text-sm text-slate-500">按批次和按员工月份查看工资数据，可跨期间筛选与导出。</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => router.push('/payroll')} className="gap-2">
                  返回工资页
                </Button>
                <Button variant="outline" onClick={loadReportData} className="gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  刷新
                </Button>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 px-5 py-4">
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">期间范围</Label>
                <div className="flex items-center gap-2">
                  <div className="w-[120px]">
                    <ChineseMonthPicker
                      value={draftFilters.startPeriod}
                      onChange={(value) => applyFilters({ ...draftFilters, startPeriod: value })}
                    />
                  </div>
                  <span className="text-slate-400">至</span>
                  <div className="w-[120px]">
                    <ChineseMonthPicker
                      value={draftFilters.endPeriod}
                      onChange={(value) => applyFilters({ ...draftFilters, endPeriod: value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">员工</Label>
                <SimpleSelect
                  placeholder=""
                  value={draftFilters.employeeQuery}
                  onChange={(value) => applyFilters({ ...draftFilters, employeeQuery: value })}
                  options={[
                    { value: '', label: '全部员工' },
                    ...employeeOptions.map((employee) => ({
                      value: employee.employeeCode,
                      label: `${employee.employeeCode} ${employee.employeeName}`,
                    })),
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">部门</Label>
                <SimpleSelect
                  placeholder=""
                  value={draftFilters.departmentName}
                  onChange={(value) => applyFilters({ ...draftFilters, departmentName: value })}
                  options={[
                    { value: '', label: '全部部门' },
                    ...departmentOptions,
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">状态</Label>
                <SimpleSelect
                  placeholder=""
                  value={draftFilters.status}
                  onChange={(value) => applyFilters({ ...draftFilters, status: (value as PayrollReportStatusFilter) || 'all' })}
                  options={reportStatusOptions.map((option) => ({ value: option.value, label: option.label }))}
                />
              </div>

              <div className="flex items-end gap-2">
                <Button onClick={handleApplyFilters} className="gap-2">
                  <Search className="h-4 w-4" />
                  查询
                </Button>
                <Button variant="outline" onClick={handleResetFilters}>
                  重置
                </Button>
                <Button variant="outline" onClick={handleExport} className="gap-2">
                  <Download className="h-4 w-4" />
                  导出
                </Button>
              </div>
            </div>

            {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          </div>

          <div className="grid gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: '批次数', value: report.summary.batchCount },
              { label: '员工数', value: report.summary.employeeCount },
              { label: '税前工资合计', value: formatMoney(report.summary.grossTotal) },
              { label: '实发工资合计', value: formatMoney(report.summary.netTotal) },
              { label: '公司成本合计', value: formatMoney(report.summary.employerCostTotal) },
            ].map((card) => (
              <div key={card.label} className={cn('rounded-2xl border p-4 shadow-sm', getSummaryCardClass(card.label))}>
                <div className={cn('text-sm font-medium', card.label === '公司成本合计' ? 'text-white/80' : 'text-slate-500')}>
                  {card.label}
                </div>
                <div className={getSummaryValueClass(card.label)}>{card.value}</div>
              </div>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)} className="w-full">
            <div className="border-b border-slate-100 px-5 py-4">
              <TabsList className="grid w-fit grid-cols-2 bg-slate-100">
                <TabsTrigger value="batch" className="px-5">
                  按批次汇总
                </TabsTrigger>
                <TabsTrigger value="detail" className="px-5">
                  按员工月份明细
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="batch" className="m-0 p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-14" />
                      <TableHead>期间</TableHead>
                      <TableHead>批次</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>凭证号</TableHead>
                      <TableHead className="text-right">员工数</TableHead>
                      <TableHead className="text-right">税前工资</TableHead>
                      <TableHead className="text-right">个人社保</TableHead>
                      <TableHead className="text-right">个人公积金</TableHead>
                      <TableHead className="text-right">个税</TableHead>
                      <TableHead className="text-right">实发工资</TableHead>
                      <TableHead className="text-right">公司成本</TableHead>
                      <TableHead className="w-28 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={13} className="py-12 text-center text-slate-400">
                          正在加载工资统计报表...
                        </TableCell>
                      </TableRow>
                    ) : report.batchRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="py-12 text-center text-slate-400">
                          暂无符合条件的批次数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.batchRows.map((batch) => {
                        const expanded = expandedBatchIds.has(batch.batchId);
                        const subtitle = getBatchSubtitle(batch.sourceFileName);
                        return (
                          <TableRow key={batch.batchId} className="hover:bg-slate-50/80" aria-expanded={expanded}>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleBatchExpand(batch.batchId)}
                                aria-label="展开批次"
                              >
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell>{formatPeriodLabel(batch.batchPeriod)}</TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">{batch.batchName}</div>
                              {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('rounded-full', getStatusBadgeClass(batch.statusLabel))}>
                                {batch.statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {batch.voucherLabel !== '-' && batch.voucherId ? (
                                <button
                                  type="button"
                                  onClick={() => void openVoucherDetail(batch.voucherId!)}
                                  className="font-mono text-sm text-blue-600 underline-offset-4 hover:underline"
                                >
                                  {batch.voucherLabel}
                                </button>
                              ) : (
                                <span className="text-sm text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{batch.employeeCount}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(batch.grossTotal)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(batch.items.reduce((sum, item) => sum + item.employeeSocialInsurance, 0))}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(batch.items.reduce((sum, item) => sum + item.employeeHousingFund, 0))}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(batch.taxTotal)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(batch.netTotal)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(batch.employerCostTotal)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => handleRecalculate(batch.batchId)} className="gap-1">
                                <RotateCcw className="h-3.5 w-3.5" />
                                重算
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {report.batchRows.some((batch) => expandedBatchIds.has(batch.batchId)) ? (
                <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                  {report.batchRows
                    .filter((batch) => expandedBatchIds.has(batch.batchId))
                    .map((batch) => (
                      <div key={batch.batchId} className="mb-4 rounded-xl border border-slate-200 bg-white p-3 last:mb-0">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{batch.batchName}</div>
                            <div className="text-xs text-slate-500">
                              {formatPeriodLabel(batch.batchPeriod)} · {batch.employeeCount} 人
                            </div>
                          </div>
                          <Badge variant="outline" className={cn('rounded-full', getStatusBadgeClass(batch.statusLabel))}>
                            {batch.statusLabel}
                          </Badge>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead>工号</TableHead>
                                <TableHead>姓名</TableHead>
                                <TableHead>部门</TableHead>
                                <TableHead className="text-right">税前工资</TableHead>
                                <TableHead className="text-right">个人社保</TableHead>
                                <TableHead className="text-right">个人公积金</TableHead>
                                <TableHead className="text-right">个税</TableHead>
                                <TableHead className="text-right">实发工资</TableHead>
                                <TableHead>状态</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {batch.items.map((item) => (
                                <TableRow key={`${batch.batchId}-${item.employeeCode}`}>
                                  <TableCell className="font-mono">{item.employeeCode}</TableCell>
                                  <TableCell>{item.employeeName}</TableCell>
                                  <TableCell>{item.departmentName}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatMoney(item.grossSalary)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatMoney(item.employeeSocialInsurance)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatMoney(item.employeeHousingFund)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatMoney(item.individualIncomeTax)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatMoney(item.netSalary)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cn('rounded-full', getStatusBadgeClass(batch.statusLabel))}>
                                      {batch.statusLabel}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="detail" className="m-0 p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-14" />
                      <TableHead>月份</TableHead>
                      <TableHead>工号</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>部门</TableHead>
                      <TableHead className="text-right">税前工资</TableHead>
                      <TableHead className="text-right">个人社保</TableHead>
                      <TableHead className="text-right">个人公积金</TableHead>
                      <TableHead className="text-right">个税</TableHead>
                      <TableHead className="text-right">实发工资</TableHead>
                      <TableHead className="text-right">公司社保</TableHead>
                      <TableHead className="text-right">公司公积金</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-44">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-12 text-center text-slate-400">
                          正在加载工资明细...
                        </TableCell>
                      </TableRow>
                    ) : report.detailRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-12 text-center text-slate-400">
                          暂无符合条件的员工月份明细
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.detailRows.map((row) => {
                        const expanded = expandedDetailKeys.has(getDetailKey(row));
                        return (
                          <TableRow key={getDetailKey(row)} className="hover:bg-slate-50/80" aria-expanded={expanded}>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleDetailExpand(row)}
                                aria-label="展开明细"
                              >
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell>{formatPeriodLabel(row.batchPeriod)}</TableCell>
                            <TableCell className="font-mono">{row.employeeCode}</TableCell>
                            <TableCell>{row.employeeName}</TableCell>
                            <TableCell>{row.departmentName}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(row.grossSalary)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(row.employeeSocialInsurance)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(row.employeeHousingFund)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(row.individualIncomeTax)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(row.netSalary)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(row.employerSocialInsurance)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(row.employerHousingFund)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('rounded-full', getStatusBadgeClass(row.statusLabel))}>
                                {row.statusLabel}
                              </Badge>
                              {row.voucherLabel !== '-' && row.voucherId ? (
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    onClick={() => void openVoucherDetail(row.voucherId!)}
                                    className="font-mono text-xs text-blue-600 underline-offset-4 hover:underline"
                                  >
                                    {row.voucherLabel}
                                  </button>
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void openVoucherDetail(row.voucherId || '')}
                                  className="gap-1"
                                  disabled={!row.voucherId}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  查看凭证
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.batchId)} className="gap-1">
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  重算
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const workbook = buildPayslipWorkbook(row);
                                    XLSX.writeFile(workbook, `工资条_${row.batchPeriod}_${row.employeeCode}.xlsx`);
                                  }}
                                  className="gap-1"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  导出工资条
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {report.detailRows.some((row) => expandedDetailKeys.has(getDetailKey(row))) ? (
                <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                  {report.detailRows
                    .filter((row) => expandedDetailKeys.has(getDetailKey(row)))
                    .map((row) => (
                      <div
                        key={`${row.batchId}-${row.employeeCode}-detail`}
                        className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-2 last:mb-0"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-700">应发项目</div>
                          <div className="mt-3 space-y-2 text-sm">
                            {[
                              ['基本工资', row.inputData.basicSalary],
                              ['奖金', row.inputData.bonus],
                              ['津贴补贴', row.inputData.allowance],
                              ['其他应发', row.inputData.otherEarnings],
                              ['请假扣款', row.inputData.leaveDeduction],
                              ['其他税前扣减', row.inputData.otherPreTaxDeduction],
                            ].map(([label, value]) => (
                              <div key={String(label)} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                <span className="text-slate-600">{label}</span>
                                <span className="font-medium tabular-nums">{formatMoney(Number(value || 0))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-700">扣款项目</div>
                          <div className="mt-3 space-y-2 text-sm">
                            {[
                              ['个人社保', row.employeeSocialInsurance],
                              ['个人公积金', row.employeeHousingFund],
                              ['个人所得税', row.individualIncomeTax],
                              ['实发工资', row.netSalary],
                              ['公司社保', row.employerSocialInsurance],
                              ['公司公积金', row.employerHousingFund],
                              ['公司成本', row.employerCostTotal],
                            ].map(([label, value]) => (
                              <div key={String(label)} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                <span className="text-slate-600">{label}</span>
                                <span className="font-medium tabular-nums">{formatMoney(Number(value || 0))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <VoucherDetailDialog
        open={voucherDialogOpen}
        onOpenChange={(open) => {
          setVoucherDialogOpen(open);
          if (!open) {
            setSelectedVoucherId(null);
            setVoucherLoading(false);
          }
        }}
        voucherLoading={voucherLoading}
        voucherId={selectedVoucherId}
        voucher={currentVoucher}
        onRefresh={() => {
          if (selectedVoucherId) {
            void openVoucherDetail(selectedVoucherId);
          }
        }}
      />
    </div>
  );
}
