'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getCurrentService } from '@/lib/database';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { generateVoucherNo as generateConfiguredVoucherNo } from '@/stores/useVoucherStore';
import { formatVoucherNoForDisplay } from '@/lib/voucher-numbering';
import {
  buildFxRevaluationPreview,
  buildFxRevaluationVoucher,
  type FxRevaluationVoucherEntry,
  hasFinalizedFxRevaluationRun,
  getFxRevaluationRunGainLoss,
  type FxRevaluationBankBalance,
  type FxRevaluationOpenItem,
} from '@/lib/fx-revaluation';
import type { FxRate, FxRevaluationRun, FxRevaluationRunLine } from '@/types';

// ─── 工具 ───

const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
const fmtMoney = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type TabValue = 'preview' | 'history';

// ─── 页面组件 ───

export default function ExchangePage() {
  const { showToast } = useToast();
  const accountSetId = useAccountSetStore((s) => s.currentAccountSetId);
  const currentAccountSet = useAccountSetStore((s) => s.getCurrentAccountSet());
  const baseCurrency = currentAccountSet?.baseCurrency || 'CNY';

  const {
    revaluationRuns,
    initializeFxRates,
    initializeRevaluationRuns,
    saveRevaluationRun,
    deleteRevaluationRun,
    getRevaluationRunLines,
  } = useCurrencyStore();

  const [tab, setTab] = useState<TabValue>('preview');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [previewLines, setPreviewLines] = useState<FxRevaluationRunLine[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{ totalGain: number; totalLoss: number; net: number } | null>(null);
  const [voucherEntries, setVoucherEntries] = useState<FxRevaluationVoucherEntry[]>([]);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [detailLines, setDetailLines] = useState<FxRevaluationRunLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [runsReady, setRunsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { waitForDbInit } = await import('@/hooks/useDatabaseSync');
        await waitForDbInit();
      } catch {}
      if (cancelled) return;
      initializeFxRates();
      await initializeRevaluationRuns();
      if (!cancelled) setRunsReady(true);
    })();
    return () => { cancelled = true; };
  }, [accountSetId]);

  // ─── 预览计算 ───

  const periodRuns = useMemo(() => {
    return revaluationRuns.filter((r) => r.period === period);
  }, [revaluationRuns, period]);

  const [historyScope, setHistoryScope] = useState<'current' | 'all'>('current');
  const allRuns = useMemo(() => {
    const sorted = [...revaluationRuns].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (historyScope === 'all') return sorted;
    return sorted.filter(r => r.period === period);
  }, [revaluationRuns, historyScope, period]);

  const handlePreview = useCallback(async () => {
    if (!period) return;
    if (hasFinalizedFxRevaluationRun(periodRuns, period)) {
      showToast('warning', `${period} 的汇兑损益已经入账，不能重复重估`);
      return;
    }
    setLoading(true);
    setPreviewLines([]);
    setPreviewSummary(null);
    setVoucherEntries([]);

    try {
      // 1. 获取期末汇率（自动回退到最近日期）
      const periodEnd = getMonthEndDate(period);
      const service = getCurrentService() as any;
      const rates: FxRate[] = await (service.getFxRates?.(periodEnd) || []);

      if (rates.length === 0) {
        showToast('warning', `${periodEnd} 及之前均未录入汇率，请先在币别管理中录入汇率`);
        setLoading(false);
        return;
      }

      // Show warning if using fallback rates (not exact period-end date)
      const usingFallback = rates.some(r => r.rateDate !== periodEnd);
      if (usingFallback) {
        const usedDates = [...new Set(rates.map(r => r.rateDate))].join('、');
        showToast('info', `未找到 ${periodEnd} 的汇率，已使用最近日期（${usedDates}）的汇率`);
      }

      // 2. 获取所有外币货币性项目余额（基于 subjects.isMonetary 字段）
      const { bankBalances, openItems } = await loadMonetaryBalances(period);

      if (bankBalances.length === 0 && openItems.length === 0) {
        showToast('info', '当前期间无外币余额需要重估');
        setLoading(false);
        return;
      }

      // 4. 计算预览
      const preview = buildFxRevaluationPreview({
        period,
        baseCurrency,
        fxRates: rates,
        bankBalances,
        openItems,
        gainLossSubjectCode: '550301',
        gainLossSubjectName: '财务费用-汇兑损失',
      });

      if (preview.items.length === 0) {
        showToast('info', '所有外币余额无汇兑差异');
        setLoading(false);
        return;
      }

      // 5. 转换为 RunLine 格式
      const runId = genId();
      const lines: FxRevaluationRunLine[] = preview.items.map((item, idx) => ({
        id: `${runId}-L${idx}`,
        runId,
        accountSetId: accountSetId || '',
        sourceType: item.sourceType === 'receivable' ? 'receivable' : item.sourceType === 'payable' ? 'payable' : 'bank',
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        currencyCode: item.currencyCode,
        originalAmount: item.originalAmount,
        originalRate: item.originalRate,
        revaluationRate: item.revaluationRate,
        bookValueBase: item.bookValueBase,
        revaluedBase: item.revaluedBase,
        gainLossAmount: item.gainLossAmount,
        gainLossDirection: item.gainLossDirection,
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
      }));

      setPreviewLines(lines);
      setPreviewSummary({ totalGain: preview.totalGain, totalLoss: preview.totalLoss, net: preview.netDifference });

      // 6. 构建凭证预览
      const entries = buildFxRevaluationVoucher(preview, '550301', '财务费用-汇兑损失');
      setVoucherEntries(entries);
    } catch (error) {
      console.error('Preview failed:', error);
      showToast('error', '预览计算失败');
    } finally {
      setLoading(false);
    }
  }, [period, accountSetId, baseCurrency, periodRuns, showToast]);

  // 月份/账套切换时自动预览（revaluation runs 就绪 + 当前期间未入账时）
  const autoPreviewRanRef = useRef<string>('');
  useEffect(() => {
    if (!runsReady || !period) return;
    const key = `${accountSetId}|${period}`;
    if (autoPreviewRanRef.current === key) return;
    if (hasFinalizedFxRevaluationRun(periodRuns, period)) return;
    autoPreviewRanRef.current = key;
    void handlePreview();
  }, [runsReady, period, accountSetId, periodRuns, handlePreview]);

  // ─── 确认并生成凭证 ───

  const handleConfirm = useCallback(async () => {
    if (previewLines.length === 0 || !previewSummary) return;
    setLoading(true);

    try {
      const runId = previewLines[0]?.runId || genId();
      const now = new Date().toISOString();

      // 1. 创建凭证
      const voucherId = genId();
      const voucherDate = getMonthEndDate(period);
      const voucherNo = await generateConfiguredVoucherNo(voucherDate, 'general');
      const entries = voucherEntries.map((e, idx) => ({
        id: `${voucherId}-E${idx}`,
        voucherId,
        date: voucherDate,
        subjectCode: e.subjectCode,
        subjectName: e.subjectName,
        debit: e.debit,
        credit: e.credit,
        summary: e.summary,
        // 透传往来字段，让明细账/账龄表能读到调整分录（总账与明细账相符）
        customerName: e.customerName || '',
        supplierName: e.supplierName || '',
        auxiliary: e.auxiliary || {},
        currencyCode: '',
        currencyName: '',
        exchangeRate: 0,
        originalAmount: 0,
      }));

      const voucher = {
        id: voucherId,
        voucherNo,
        date: voucherDate,
        status: 'posted' as const,
        summary: `期末汇兑损益调整 ${period}`,
        voucherType: 'general' as const,
        createdBy: 'user',
        entries,
        createTime: now,
        updateTime: now,
      };

      await getCurrentService().saveVoucher(voucher);

      // 2. 保存重估运行
      const run: FxRevaluationRun = {
        id: runId,
        accountSetId: accountSetId || '',
        period,
        baseCurrency,
        status: 'posted',
        previewData: JSON.stringify({ totalGain: previewSummary.totalGain, totalLoss: previewSummary.totalLoss }),
        voucherId,
        voucherNo,
        createdAt: now,
        confirmedAt: now,
        createTime: now,
        updateTime: now,
      };

      await saveRevaluationRun(run, previewLines);

      // 3. 清空预览
      setPreviewLines([]);
      setPreviewSummary(null);
      setVoucherEntries([]);
      showToast('success', `已生成凭证 ${voucherNo}`);
    } catch (error) {
      console.error('Confirm failed:', error);
      // 把底层错误透传到前端（如期间关账、科目缺失等），避免只显示"确认失败"让人摸不着头脑
      const message = error instanceof Error && error.message
        ? error.message
        : (typeof error === 'string' ? error : '确认失败');
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  }, [previewLines, previewSummary, voucherEntries, period, accountSetId, baseCurrency, saveRevaluationRun, showToast]);

  // ─── 查看历史详情 ───

  const handleViewDetail = useCallback(async (runId: string) => {
    setDetailRunId(runId);
    setDetailLoading(true);
    const lines = await getRevaluationRunLines(runId);
    setDetailLines(lines);
    setDetailLoading(false);
  }, [getRevaluationRunLines]);

  const handleDeleteRun = useCallback(async (id: string) => {
    await deleteRevaluationRun(id);
    if (detailRunId === id) {
      setDetailRunId(null);
      setDetailLines([]);
    }
    showToast('success', '已删除重估记录');
  }, [deleteRevaluationRun, detailRunId]);

  // ─── 渲染 ───

  const detailGainLossTotal = useMemo(() => {
    return detailLines.reduce((sum, line) => {
      return sum + (line.gainLossDirection === 'gain' ? line.gainLossAmount : -line.gainLossAmount);
    }, 0);
  }, [detailLines]);

  const runGainLossMap = useMemo(() => {
    return new Map(allRuns.map(run => [run.id, getFxRevaluationRunGainLoss(run)]));
  }, [allRuns]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">期末汇兑损益</h1>
              <p className="text-sm text-slate-500 mt-1">
                按期末汇率对外币余额进行重估，自动生成调汇凭证
              </p>
            </div>
            <Link
              href="/settings/currencies"
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              币种与汇率
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm text-slate-600">会计期间</Label>
            <ChineseMonthPicker value={period} onChange={setPeriod} />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="preview">重估预览</TabsTrigger>
            <TabsTrigger value="history">
              历史记录
            </TabsTrigger>
          </TabsList>

          {/* 预览 Tab */}
          <TabsContent value="preview" className="space-y-4">
            {/* 操作按钮 */}
            <div className="flex items-center gap-3">
              <Button onClick={handlePreview} disabled={loading || !period}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                预览重估
              </Button>
              {previewLines.length > 0 && (
                <Button variant="default" onClick={handleConfirm} disabled={loading}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  确认并生成凭证
                </Button>
              )}
              {previewLines.length > 0 && (
                <Button variant="outline" onClick={() => { setPreviewLines([]); setPreviewSummary(null); setVoucherEntries([]); }}>
                  清除预览
                </Button>
              )}
            </div>

            {/* 汇总卡片 */}
            {previewSummary && (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs text-slate-500 mb-1">汇兑收益</div>
                  <div className="text-lg font-semibold text-green-600">+{fmtMoney(previewSummary.totalGain)}</div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs text-slate-500 mb-1">汇兑损失</div>
                  <div className="text-lg font-semibold text-red-600">-{fmtMoney(previewSummary.totalLoss)}</div>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs text-slate-500 mb-1">净差异</div>
                  <div className={cn('text-lg font-semibold', previewSummary.net >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {previewSummary.net >= 0 ? '+' : ''}{fmtMoney(previewSummary.net)}
                  </div>
                </div>
              </div>
            )}

            {/* 明细表 */}
            {previewLines.length > 0 && (
              <div className="rounded-lg border bg-white">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 w-14 px-2 py-1.5 text-xs">类型</TableHead>
                      <TableHead className="h-8 w-[18rem] px-2 py-1.5 text-xs">来源</TableHead>
                      <TableHead className="h-8 w-14 px-2 py-1.5 text-xs">币种</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">原币余额</TableHead>
                      <TableHead className="h-8 w-[5.5rem] px-2 py-1.5 text-right text-xs">账面汇率</TableHead>
                      <TableHead className="h-8 w-[5.5rem] px-2 py-1.5 text-right text-xs">期末汇率</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">账面本币</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">重估本币</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">损益金额</TableHead>
                      <TableHead className="h-8 w-14 px-2 py-1.5 text-xs">方向</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="px-2 py-2">
                          <Badge variant="outline" className="text-xs">
                            {line.sourceType === 'bank' ? '银行' : line.sourceType === 'receivable' ? '资产' : '负债'}
                          </Badge>
                        </TableCell>
                        <TableCell className="truncate px-2 py-2 text-xs" title={line.sourceName}>{line.sourceName}</TableCell>
                        <TableCell className="px-2 py-2 text-xs font-mono">{line.currencyCode}</TableCell>
                        <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.originalAmount)}</TableCell>
                        <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{line.originalRate.toFixed(4)}</TableCell>
                        <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{line.revaluationRate.toFixed(4)}</TableCell>
                        <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.bookValueBase)}</TableCell>
                        <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.revaluedBase)}</TableCell>
                        <TableCell className={cn('px-2 py-2 text-right text-xs tabular-nums font-medium', line.gainLossDirection === 'gain' ? 'text-green-600' : 'text-red-600')}>
                          {line.gainLossDirection === 'gain' ? '+' : '-'}{fmtMoney(line.gainLossAmount)}
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge className={cn('text-xs', line.gainLossDirection === 'gain' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                            {line.gainLossDirection === 'gain' ? '收益' : '损失'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* 凭证预览 */}
            {voucherEntries.length > 0 && (
              <div className="rounded-lg border bg-white">
                <div className="px-4 py-3 border-b bg-blue-50/50">
                  <h3 className="text-sm font-medium text-blue-800">凭证预览</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">科目代码</TableHead>
                      <TableHead>科目名称</TableHead>
                      <TableHead className="text-right w-28">借方</TableHead>
                      <TableHead className="text-right w-28">贷方</TableHead>
                      <TableHead>摘要</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {voucherEntries.map((e, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm font-mono">{e.subjectCode}</TableCell>
                        <TableCell className="text-sm">{e.subjectName}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{e.debit > 0 ? fmtMoney(e.debit) : ''}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{e.credit > 0 ? fmtMoney(e.credit) : ''}</TableCell>
                        <TableCell className="text-sm text-slate-500">{e.summary}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {previewLines.length === 0 && !loading && (
              <div className="rounded-lg border bg-white p-12 text-center text-slate-400">
                <RefreshCw className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>{period} 无外币余额需要重估，或该期间已入账</p>
                <p className="mt-1 text-xs">切换月份会自动重新预览</p>
              </div>
            )}
          </TabsContent>

          {/* 历史 Tab */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                历史记录 ({allRuns.length})
                {historyScope === 'current' && (
                  <span className="ml-2 text-xs font-normal text-slate-500">仅 {period}</span>
                )}
              </h2>
              <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setHistoryScope('current')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs transition-colors',
                    historyScope === 'current' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  当前期间
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryScope('all')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs transition-colors',
                    historyScope === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  全部期间
                </button>
              </div>
            </div>
            {allRuns.length === 0 ? (
              <div className="rounded-lg border bg-white p-10 text-center text-slate-400">
                <p>暂无重估记录</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-white">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 w-24 px-2 py-1.5 text-xs">期间</TableHead>
                      <TableHead className="h-8 w-20 px-2 py-1.5 text-xs">状态</TableHead>
                      <TableHead className="h-8 w-20 px-2 py-1.5 text-xs">本位币</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">汇兑收益</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">汇兑损失</TableHead>
                      <TableHead className="h-8 w-32 px-2 py-1.5 text-xs">凭证</TableHead>
                      <TableHead className="h-8 px-2 py-1.5 text-xs">创建时间</TableHead>
                      <TableHead className="h-8 w-24 px-2 py-1.5 text-right text-xs">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allRuns.map((run) => {
                      const gl = runGainLossMap.get(run.id) || { gain: 0, loss: 0 };
                      return (
                        <TableRow key={run.id}>
                          <TableCell className="px-2 py-2 text-xs font-mono">{run.period}</TableCell>
                          <TableCell className="px-2 py-2">
                            <Badge className="text-xs bg-blue-50 text-blue-700">
                              {run.status === 'confirmed' ? '已确认' : run.status === 'posted' ? '已过账' : run.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2 py-2 text-xs">{run.baseCurrency}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums font-medium text-green-600">
                            {gl.gain > 0 ? `+${fmtMoney(gl.gain)}` : '-'}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums font-medium text-red-600">
                            {gl.loss > 0 ? `-${fmtMoney(gl.loss)}` : '-'}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-xs font-mono">
                            {run.voucherNo
                              ? formatVoucherNoForDisplay(
                                  {
                                    voucherNo: run.voucherNo,
                                    date: getMonthEndDate(run.period),
                                    voucherType: 'general',
                                  },
                                  currentAccountSet?.voucherNumbering,
                                )
                              : '-'}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-xs text-slate-500">{formatDateTime(run.createdAt)}</TableCell>
                          <TableCell className="space-x-1 px-2 py-1.5 text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleViewDetail(run.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteRun(run.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* 明细展开 */}
            {detailRunId && (
              <div className="rounded-lg border bg-white">
                <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-medium">重估明细</h3>
                  <Button variant="ghost" size="sm" onClick={() => { setDetailRunId(null); setDetailLines([]); }}>收起</Button>
                </div>
                {detailLoading ? (
                  <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" /></div>
                ) : detailLines.length > 0 ? (
                  <>
                    <div className="border-b bg-slate-50 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">汇兑损益调整金额</span>
                        <span className={cn('font-semibold tabular-nums', detailGainLossTotal >= 0 ? 'text-green-600' : 'text-red-600')}>
                          {detailGainLossTotal >= 0 ? '+' : '-'}{fmtMoney(Math.abs(detailGainLossTotal))}
                        </span>
                      </div>
                    </div>
                    <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 w-14 px-2 py-1.5 text-xs">类型</TableHead>
                      <TableHead className="h-8 w-[20rem] px-2 py-1.5 text-xs">来源</TableHead>
                      <TableHead className="h-8 w-14 px-2 py-1.5 text-xs">币种</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">原币余额</TableHead>
                      <TableHead className="h-8 w-[5.5rem] px-2 py-1.5 text-right text-xs">入账汇率</TableHead>
                      <TableHead className="h-8 w-[5.5rem] px-2 py-1.5 text-right text-xs">调整汇率</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">账面本币</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">重估本币</TableHead>
                      <TableHead className="h-8 w-28 px-2 py-1.5 text-right text-xs">汇兑损益调整金额</TableHead>
                      <TableHead className="h-8 w-14 px-2 py-1.5 text-xs">方向</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="px-2 py-2">
                            <Badge variant="outline" className="text-xs">
                              {line.sourceType === 'bank' ? '银行' : line.sourceType === 'receivable' ? '资产' : '负债'}
                            </Badge>
                          </TableCell>
                          <TableCell className="truncate px-2 py-2 text-xs" title={line.sourceName}>{line.sourceName}</TableCell>
                          <TableCell className="px-2 py-2 text-xs font-mono">{line.currencyCode}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.originalAmount)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{line.originalRate.toFixed(4)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{line.revaluationRate.toFixed(4)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.bookValueBase)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.revaluedBase)}</TableCell>
                          <TableCell className={cn('px-2 py-2 text-right text-xs tabular-nums font-medium', line.gainLossDirection === 'gain' ? 'text-green-600' : 'text-red-600')}>
                            {fmtMoney(line.gainLossAmount)}
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <Badge className={cn('text-xs', line.gainLossDirection === 'gain' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                              {line.gainLossDirection === 'gain' ? '收益' : '损失'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="border-t bg-slate-50">
                      <TableRow className="hover:bg-slate-50">
                        <TableCell colSpan={8} className="px-2 py-2 text-right text-xs font-semibold text-slate-700">
                          汇兑损益调整金额
                        </TableCell>
                        <TableCell
                          className={cn(
                            'px-2 py-2 text-right text-xs font-bold tabular-nums',
                            detailGainLossTotal >= 0 ? 'text-green-600' : 'text-red-600',
                          )}
                        >
                          {detailGainLossTotal >= 0 ? '+' : '-'}{fmtMoney(Math.abs(detailGainLossTotal))}
                        </TableCell>
                        <TableCell className="px-2 py-2" />
                      </TableRow>
                    </TableFooter>
                    </Table>
                  </>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-sm">无明细数据</div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── 辅助函数 ───

function getMonthEndDate(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 加载所有外币货币性项目余额（按 subjects.isMonetary 字段过滤）
 *
 * 数据来源：凭证分录（voucher entries）中 currencyCode ≠ CNY 且科目为货币性项目的分录
 *
 * 分类规则（基于科目代码前缀）：
 *   - 1001/1002/1012 → 'bank'（银行/现金类，使用 FxRevaluationBankBalance 类型）
 *   - 其他 1xxx（资产类）→ 'receivable'（资产类货币性项目）
 *   - 2xxx（负债类）→ 'payable'（负债类货币性项目）
 *
 * 引擎 fx-revaluation.ts 用 sourceType='receivable' 判断 isAsset=true（资产类，
 * 正差额=收益），sourceType='payable' 判断 isAsset=false（负债类，正差额=损失）。
 *
 * 银行账户绑定（bank_account_bindings）用于元数据反查，补全 accountNumber/bankName
 * 让预览行更直观。期初外币余额从 bank_opening_balances 回退补齐。
 */
async function loadMonetaryBalances(
  period: string,
): Promise<{ bankBalances: FxRevaluationBankBalance[]; openItems: FxRevaluationOpenItem[] }> {
  const service = getCurrentService() as any;
  const periodEnd = getMonthEndDate(period);

  // 1. 加载货币性科目集合，建立 code → { direction, name } 映射
  const monetarySubjects = new Map<string, { direction: string; name: string }>();
  try {
    const subjects = service.getAllSubjects ? await service.getAllSubjects() : [];
    for (const s of subjects || []) {
      if (s.isMonetary) {
        monetarySubjects.set(s.code, { direction: s.direction || 'debit', name: s.name || s.code });
      }
    }
  } catch (e) {
    console.warn('loadMonetaryBalances: 科目加载失败', e);
  }

  // 2. 预加载银行账户绑定
  const bindingsBySubject = new Map<string, any>();
  const bindingsByAccount = new Map<string, any>();
  try {
    const bindings = service.getBankAccountBindings ? await service.getBankAccountBindings() : [];
    for (const b of bindings || []) {
      if (b.subSubjectCode) bindingsBySubject.set(b.subSubjectCode, b);
      if (b.accountNumber) bindingsByAccount.set(b.accountNumber, b);
    }
  } catch (e) {
    console.warn('loadMonetaryBalances: 银行绑定加载失败', e);
  }

  // 3. 聚合外币分录 by (subjectCode, currencyCode, partnerName)
  // 必须保留往来单位名，否则后续 buildFxRevaluationVoucher 无法把调整分录挂到客户/供应商，
  // 期末调汇后总账与明细账无法相符（CAS 19）。
  const agg = new Map<string, {
    subjectCode: string;
    subjectName: string;
    currencyCode: string;
    partnerName: string; // customerName 或 supplierName，空串表示无往来
    totalOriginal: number;
    totalBase: number;
  }>();

  try {
    const allVouchers = service.getAllVouchers ? await service.getAllVouchers() : [];

    for (const voucher of allVouchers) {
      const voucherDate = (voucher.date || '').slice(0, 10);
      if (!voucherDate || voucherDate > periodEnd) continue;
      const entries = voucher.entries || [];
      for (const entry of entries) {
        if (!entry.currencyCode || entry.currencyCode === 'CNY') continue;
        const code = (entry.subjectCode || '');
        if (!code || !monetarySubjects.has(code)) continue;

        // 提取往来单位名：优先 customerName/supplierName，回退到 auxiliary.customer/supplier
        const partnerName = String(
          entry.customerName
          || entry.supplierName
          || entry.auxiliary?.customer
          || entry.auxiliary?.supplier
          || '',
        );

        const key = `${code}-${entry.currencyCode}-${partnerName}`;
        const subjectInfo = monetarySubjects.get(code)!;
        const existing = agg.get(key) || {
          subjectCode: code,
          subjectName: entry.subjectName || subjectInfo.name,
          currencyCode: entry.currencyCode,
          partnerName,
          totalOriginal: 0,
          totalBase: 0,
        };
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        const sign = debit > 0 ? 1 : -1;
        existing.totalOriginal += (entry.originalAmount || 0) * sign;
        existing.totalBase += (debit - credit);
        agg.set(key, existing);
      }
    }

    // Fallback: bank_opening_balances 期初外币余额回退（仅银行类）
    try {
      const openingRows: Array<{ accountNumber: string; periodStart: string; balance: number; foreignBalance?: number | null; exchangeRate?: number | null }> =
        service.getAllBankOpeningBalances ? await service.getAllBankOpeningBalances() : [];
      for (const row of openingRows || []) {
        if (!row.accountNumber || row.periodStart > period) continue;
        if (!row.foreignBalance || !row.exchangeRate) continue;
        const binding = bindingsByAccount.get(row.accountNumber);
        const code = binding?.subSubjectCode || '1002';
        if (!monetarySubjects.has(code)) continue;
        const currency = binding?.currency || '';
        if (!currency || currency === 'CNY') continue;
        // 与凭证聚合的 key 格式保持一致：${code}-${currency}-${partnerName}
        // 银行回退不带往来单位，partnerName 固定为空串
        const key = `${code}-${currency}-`;
        const existing = agg.get(key) || {
          subjectCode: code,
          subjectName: binding?.subSubjectName || '银行存款',
          currencyCode: currency,
          partnerName: '',
          totalOriginal: 0,
          totalBase: 0,
        };
        if (Math.abs(existing.totalOriginal) < 0.005) existing.totalOriginal = row.foreignBalance;
        if (Math.abs(existing.totalBase) < 0.005) existing.totalBase = row.balance;
        agg.set(key, existing);
      }
    } catch (e) {
      console.warn('loadMonetaryBalances: 期初外币余额回退失败', e);
    }
  } catch (e) {
    console.error('loadMonetaryBalances: 凭证聚合失败', e);
  }

  // 4. 按 sourceType 分类输出
  const bankBalances: FxRevaluationBankBalance[] = [];
  const openItems: FxRevaluationOpenItem[] = [];

  for (const [key, data] of agg) {
    if (Math.abs(data.totalOriginal) < 0.005 && Math.abs(data.totalBase) < 0.005) continue;

    const isBankPrefix = data.subjectCode.startsWith('1001') || data.subjectCode.startsWith('1002') || data.subjectCode.startsWith('1012');
    const subjectInfo = monetarySubjects.get(data.subjectCode);
    const isAsset = subjectInfo?.direction !== 'credit'; // direction='debit' = 资产类

    if (isBankPrefix) {
      const binding = bindingsBySubject.get(data.subjectCode);
      bankBalances.push({
        accountId: binding?.id || `voucher-${key}`,
        accountNumber: binding?.accountNumber || data.subjectCode,
        bankName: binding?.bankName || binding?.aliasName || data.subjectName,
        currencyCode: data.currencyCode,
        originalAmount: Math.abs(data.totalOriginal) >= 0.005 ? data.totalOriginal : data.totalBase,
        bookValueBase: Math.round(data.totalBase * 100) / 100,
        subjectCode: data.subjectCode,
        subjectName: data.subjectName,
      });
    } else {
      openItems.push({
        itemId: key,
        moduleName: isAsset ? 'receivable' : 'payable',
        partnerName: data.partnerName || data.subjectName,
        currencyCode: data.currencyCode,
        originalAmount: data.totalOriginal,
        bookValueBase: data.totalBase,
        subjectCode: data.subjectCode,
        subjectName: data.subjectName,
      });
    }
  }

  return { bankBalances, openItems };
}
