'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import type { FxRate, FxRevaluationRun, FxRevaluationRunLine, Voucher } from '@/types';

// ─── 工具 ───

const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
const fmtMoney = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 统一的损益金额展示：0 显示浅灰，>0 收益绿，损失红
type SignedKind = 'gain' | 'loss' | 'net';
function formatSignedAmount(amount: number, kind: SignedKind): { text: string; color: string } {
  if (Math.abs(amount) < 0.005) return { text: '0.00', color: 'text-slate-400' };
  if (kind === 'gain') return { text: `+${fmtMoney(amount)}`, color: 'text-emerald-600' };
  if (kind === 'loss') return { text: `-${fmtMoney(amount)}`, color: 'text-rose-600' };
  // net：正=净收益，负=净损失
  return amount > 0
    ? { text: `+${fmtMoney(amount)}`, color: 'text-emerald-600' }
    : { text: `-${fmtMoney(Math.abs(amount))}`, color: 'text-rose-600' };
}

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
  // 跟踪当前查看的 period/状态摘要，让用户在切换行时看到明确的视觉反馈
  const [detailRunMeta, setDetailRunMeta] = useState<{ period: string; status: string } | null>(null);
  // 防止快速切换多行时 race condition：只采纳最新一次请求的结果
  const detailRequestRef = useRef<string | null>(null);

  // 明细 Dialog 弹窗：替代行内展开，每行点击都打开独立弹窗，避免视觉混淆
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  // 凭证详情 Dialog：凭证号点击时弹出只读详情
  const [voucherDialogVoucher, setVoucherDialogVoucher] = useState<Voucher | null>(null);
  const [voucherDialogLoading, setVoucherDialogLoading] = useState(false);

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

      // 即使 preview.items 全为 0 损益也展示明细，让用户看到原币余额和重估结果
      // 仅在 netDifference 为 0 时，凭证预览会被清空（无需入账）

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

  const handleViewDetail = useCallback(async (runId: string, meta?: { period: string; status: string }) => {
    // 立即清空旧明细 + 标记 loading，让用户看到明显的"切换"反馈
    // （否则切换行时旧数据还在显示，用户会以为没反应）
    setDetailLines([]);
    setDetailRunMeta(meta ?? null);
    setDetailRunId(runId);
    setDetailLoading(true);
    setDetailDialogOpen(true);

    // race condition 保护：连续点击多行时，只采纳最新请求的结果
    const reqKey = `${runId}-${Date.now()}`;
    detailRequestRef.current = reqKey;

    try {
      const lines = await getRevaluationRunLines(runId);
      if (detailRequestRef.current !== reqKey) return; // 已被后续点击覆盖
      setDetailLines(lines);
    } catch (e) {
      console.error('Failed to load revaluation run lines:', e);
      if (detailRequestRef.current !== reqKey) return;
      setDetailLines([]);
    } finally {
      if (detailRequestRef.current === reqKey) {
        setDetailLoading(false);
      }
    }
  }, [getRevaluationRunLines]);

  // 凭证详情：根据 voucherId 加载完整凭证并打开 Dialog
  const handleViewVoucher = useCallback(async (voucherId?: string) => {
    if (!voucherId) return;
    setVoucherDialogLoading(true);
    setVoucherDialogVoucher(null);
    try {
      const service = getCurrentService() as any;
      const voucher = service.getVoucher ? await service.getVoucher(voucherId) : null;
      setVoucherDialogVoucher(voucher || null);
    } catch (e) {
      console.error('Failed to load voucher:', e);
      setVoucherDialogVoucher(null);
    } finally {
      setVoucherDialogLoading(false);
    }
  }, []);

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
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
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
                <Button
                  variant="default"
                  onClick={handleConfirm}
                  disabled={loading || !previewSummary || Math.abs(previewSummary.net) < 0.005}
                  title={previewSummary && Math.abs(previewSummary.net) < 0.005 ? '净差异为 0，无需生成调汇凭证' : undefined}
                >
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
                {(() => {
                  const gain = formatSignedAmount(previewSummary.totalGain, 'gain');
                  const loss = formatSignedAmount(previewSummary.totalLoss, 'loss');
                  const net = formatSignedAmount(previewSummary.net, 'net');
                  const cards = [
                    { label: '汇兑收益', ...gain },
                    { label: '汇兑损失', ...loss },
                    { label: '净差异', ...net },
                  ];
                  return cards.map((c) => (
                    <div key={c.label} className="rounded-lg border bg-white p-4">
                      <div className="text-xs text-slate-500 mb-2">{c.label}</div>
                      <div className={cn('text-2xl font-bold tabular-nums', c.color)}>{c.text}</div>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* 明细表 */}
            {previewLines.length > 0 && (
              <div className="rounded-lg border bg-white overflow-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9 w-[70px] px-2 py-1.5 text-xs text-center">类型</TableHead>
                      <TableHead className="h-9 w-[130px] px-2 py-1.5 text-xs">来源</TableHead>
                      <TableHead className="h-9 w-[70px] px-2 py-1.5 text-xs text-center">币种</TableHead>
                      <TableHead className="h-9 px-2 py-1.5 text-right text-xs">原币余额</TableHead>
                      <TableHead className="h-9 px-2 py-1.5 text-right text-xs">账面汇率</TableHead>
                      <TableHead className="h-9 px-2 py-1.5 text-right text-xs">期末汇率</TableHead>
                      <TableHead className="h-9 px-2 py-1.5 text-right text-xs">账面本币</TableHead>
                      <TableHead className="h-9 px-2 py-1.5 text-right text-xs">重估本币</TableHead>
                      <TableHead className="h-9 px-2 py-1.5 text-right text-xs">损益金额</TableHead>
                      <TableHead className="h-9 w-[70px] px-2 py-1.5 text-xs text-center">方向</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewLines.map((line) => {
                      const dir = line.gainLossDirection;
                      const amountText = dir === 'none'
                        ? '0.00'
                        : `${dir === 'gain' ? '+' : '-'}${fmtMoney(line.gainLossAmount)}`;
                      const amountColor = dir === 'gain' ? 'text-emerald-600'
                        : dir === 'loss' ? 'text-rose-600'
                        : 'text-slate-400';
                      return (
                        <TableRow key={line.id}>
                          <TableCell className="px-2 py-2 text-center">
                            <Badge variant="outline" className="text-xs">
                              {line.sourceType === 'bank' ? '银行' : line.sourceType === 'receivable' ? '资产' : '负债'}
                            </Badge>
                          </TableCell>
                          <TableCell className="truncate px-2 py-2 text-xs" title={line.sourceName}>{line.sourceName}</TableCell>
                          <TableCell className="px-2 py-2 text-center text-xs font-mono">{line.currencyCode}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.originalAmount)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{line.originalRate.toFixed(4)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{line.revaluationRate.toFixed(4)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.bookValueBase)}</TableCell>
                          <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.revaluedBase)}</TableCell>
                          <TableCell className={cn('px-2 py-2 text-right text-xs tabular-nums font-medium', amountColor)}>
                            {amountText}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-center">
                            <Badge className={cn('text-xs',
                              dir === 'gain' ? 'bg-emerald-50 text-emerald-700'
                              : dir === 'loss' ? 'bg-rose-50 text-rose-700'
                              : 'bg-gray-100 text-gray-500')}>
                              {dir === 'gain' ? '收益' : dir === 'loss' ? '损失' : '无差异'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
                <p>{period} 无外币货币性项目余额</p>
                <p className="mt-1 text-xs">若有外币业务未入账，请先在凭证中录入；切换月份会自动重新预览</p>
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
                              {run.status === 'confirmed'
                                ? '已确认'
                                : run.status === 'posted'
                                  ? '已过账'
                                  : (run.status as string) === 'reversed'
                                    ? '已红冲'
                                    : run.status}
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
                            {run.voucherNo ? (
                              <button
                                type="button"
                                className="text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                                title="查看凭证详情"
                                disabled={!run.voucherId}
                                onClick={() => handleViewVoucher(run.voucherId)}
                              >
                                {formatVoucherNoForDisplay(
                                  {
                                    voucherNo: run.voucherNo,
                                    date: getMonthEndDate(run.period),
                                    voucherType: 'general',
                                  },
                                  currentAccountSet?.voucherNumbering,
                                )}
                              </button>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-xs text-slate-500">{formatDateTime(run.createdAt)}</TableCell>
                          <TableCell className="px-2 py-1.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              title="查看明细"
                              onClick={() => handleViewDetail(run.id, { period: run.period, status: run.status })}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

          </TabsContent>
        </Tabs>

        {/* 明细 Dialog：每行点击都打开独立弹窗，避免行内展开的视觉混淆 */}
        <Dialog open={detailDialogOpen} onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) {
            setDetailRunId(null);
            setDetailLines([]);
            setDetailRunMeta(null);
            detailRequestRef.current = null;
          }
        }}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-600" />
                重估明细
                {detailRunMeta && (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {detailRunMeta.period}
                    <Badge className="ml-2 text-xs bg-blue-50 text-blue-700">
                      {detailRunMeta.status === 'confirmed'
                        ? '已确认'
                        : detailRunMeta.status === 'posted'
                          ? '已过账'
                          : (detailRunMeta.status as string) === 'reversed'
                            ? '已红冲'
                            : detailRunMeta.status}
                    </Badge>
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {detailLoading ? (
                <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div>
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
                        <TableHead className="h-8 w-[70px] px-2 py-1.5 text-xs text-center">类型</TableHead>
                        <TableHead className="h-8 w-[130px] px-2 py-1.5 text-xs">来源</TableHead>
                        <TableHead className="h-8 w-[70px] px-2 py-1.5 text-xs text-center">币种</TableHead>
                        <TableHead className="h-8 px-2 py-1.5 text-right text-xs">原币余额</TableHead>
                        <TableHead className="h-8 px-2 py-1.5 text-right text-xs">入账汇率</TableHead>
                        <TableHead className="h-8 px-2 py-1.5 text-right text-xs">调整汇率</TableHead>
                        <TableHead className="h-8 px-2 py-1.5 text-right text-xs">账面本币</TableHead>
                        <TableHead className="h-8 px-2 py-1.5 text-right text-xs">重估本币</TableHead>
                        <TableHead className="h-8 px-2 py-1.5 text-right text-xs">汇兑损益调整金额</TableHead>
                        <TableHead className="h-8 w-[70px] px-2 py-1.5 text-xs text-center">方向</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailLines.map((line) => {
                        const dir = line.gainLossDirection;
                        const amountColor = dir === 'gain' ? 'text-emerald-600'
                          : dir === 'loss' ? 'text-rose-600'
                          : 'text-slate-400';
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="px-2 py-2 text-center">
                              <Badge variant="outline" className="text-xs">
                                {line.sourceType === 'bank' ? '银行' : line.sourceType === 'receivable' ? '资产' : '负债'}
                              </Badge>
                            </TableCell>
                            <TableCell className="truncate px-2 py-2 text-xs" title={line.sourceName}>{line.sourceName}</TableCell>
                            <TableCell className="px-2 py-2 text-center text-xs font-mono">{line.currencyCode}</TableCell>
                            <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.originalAmount)}</TableCell>
                            <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{line.originalRate.toFixed(4)}</TableCell>
                            <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{line.revaluationRate.toFixed(4)}</TableCell>
                            <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.bookValueBase)}</TableCell>
                            <TableCell className="px-2 py-2 text-right text-xs tabular-nums">{fmtMoney(line.revaluedBase)}</TableCell>
                            <TableCell className={cn('px-2 py-2 text-right text-xs tabular-nums font-medium', amountColor)}>
                              {dir === 'none' ? '0.00' : `${dir === 'gain' ? '+' : '-'}${fmtMoney(line.gainLossAmount)}`}
                            </TableCell>
                            <TableCell className="px-2 py-2 text-center">
                              <Badge className={cn('text-xs',
                                dir === 'gain' ? 'bg-emerald-50 text-emerald-700'
                                : dir === 'loss' ? 'bg-rose-50 text-rose-700'
                                : 'bg-gray-100 text-gray-500')}>
                                {dir === 'gain' ? '收益' : dir === 'loss' ? '损失' : '无差异'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter className="border-t bg-slate-50">
                      <TableRow className="hover:bg-slate-50">
                        <TableCell colSpan={8} className="px-2 py-2 text-right text-xs font-semibold text-slate-700">
                          汇兑损益调整金额
                        </TableCell>
                        <TableCell
                          className={cn(
                            'px-2 py-2 text-right text-xs font-bold tabular-nums',
                            detailGainLossTotal >= 0 ? 'text-emerald-600' : 'text-rose-600',
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
                <div className="p-8 text-center text-slate-400 text-sm">无明细数据</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 凭证详情 Dialog */}
        <Dialog open={!!voucherDialogVoucher || voucherDialogLoading} onOpenChange={(open) => {
          if (!open) { setVoucherDialogVoucher(null); setVoucherDialogLoading(false); }
        }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                {voucherDialogVoucher?.voucherNo || '凭证详情'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {voucherDialogLoading ? (
                <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div>
              ) : voucherDialogVoucher ? (
                <VoucherReadOnlyView voucher={voucherDialogVoucher} />
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">未找到凭证</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── 只读凭证视图（用于历史详情） ───

function VoucherReadOnlyView({ voucher }: { voucher: Voucher }) {
  const entries = voucher.entries || [];
  const debitTotal = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const creditTotal = entries.reduce((s, e) => s + (e.credit || 0), 0);
  const statusLabel = voucher.status === 'posted' ? '已记账'
    : voucher.status === 'reversed' ? '已冲销'
    : voucher.status === 'review' ? '已审核'
    : voucher.status === 'draft' ? '草稿'
    : voucher.status;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-slate-500">日期</div>
          <div className="font-medium">{voucher.date}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">状态</div>
          <Badge className="text-xs bg-slate-100 text-slate-700">{statusLabel}</Badge>
        </div>
        <div>
          <div className="text-xs text-slate-500">摘要</div>
          <div className="font-medium truncate" title={voucher.summary || ''}>{voucher.summary || '-'}</div>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-9 text-xs">科目代码</TableHead>
              <TableHead className="h-9 text-xs">科目名称</TableHead>
              <TableHead className="h-9 text-xs">摘要</TableHead>
              <TableHead className="h-9 text-xs">往来</TableHead>
              <TableHead className="h-9 text-xs text-right">借方</TableHead>
              <TableHead className="h-9 text-xs text-right">贷方</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.filter(e => e.subjectCode || e.debit > 0 || e.credit > 0).map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs font-mono">{e.subjectCode || '-'}</TableCell>
                <TableCell className="text-xs">{e.subjectName || '-'}</TableCell>
                <TableCell className="text-xs text-slate-500">{e.summary || '-'}</TableCell>
                <TableCell className="text-xs text-slate-500">{e.auxiliary?.customer || e.auxiliary?.supplier || e.customerName || e.supplierName || ''}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{e.debit > 0 ? fmtMoney(e.debit) : ''}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{e.credit > 0 ? fmtMoney(e.credit) : ''}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-slate-50 font-medium">
              <TableCell colSpan={4} className="text-xs">合计</TableCell>
              <TableCell className="text-xs text-right tabular-nums text-blue-600">{fmtMoney(debitTotal)}</TableCell>
              <TableCell className="text-xs text-right tabular-nums text-blue-600">{fmtMoney(creditTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {voucher.createTime && (
        <div className="text-xs text-slate-400 text-right">
          创建时间：{new Date(voucher.createTime).toLocaleString('zh-CN')}
        </div>
      )}
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
  //
  // 双 map 策略：
  // - foreignAgg：仅累加外币分录（带 currencyCode），记录原币余额 + 币种 + 往来
  // - baseAgg：累加该科目该往来所有分录的本币借贷差（含调汇分录，调汇分录 currencyCode=''）
  //   否则 5 月已调汇过的余额在 6 月重估时账面本币还是原始值，会重复计算汇兑损益。
  const foreignAgg = new Map<string, {
    subjectCode: string;
    subjectName: string;
    currencyCode: string;
    partnerName: string; // customerName 或 supplierName，空串表示无往来
    totalOriginal: number;
  }>();
  const baseAgg = new Map<string, number>(); // key: `${subjectCode}-${partnerName}` → 本币累计

  try {
    const allVouchers = service.getAllVouchers ? await service.getAllVouchers() : [];

    for (const voucher of allVouchers) {
      const voucherDate = (voucher.date || '').slice(0, 10);
      if (!voucherDate || voucherDate > periodEnd) continue;
      const entries = voucher.entries || [];
      for (const entry of entries) {
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

        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        const baseDelta = debit - credit;

        // 本币账面：所有分录都计入（含 currencyCode 为空的调汇分录）
        const baseKey = `${code}-${partnerName}`;
        baseAgg.set(baseKey, (baseAgg.get(baseKey) || 0) + baseDelta);

        // 原币：仅外币分录
        const cur = entry.currencyCode;
        if (cur && cur !== 'CNY') {
          const key = `${code}-${cur}-${partnerName}`;
          const subjectInfo = monetarySubjects.get(code)!;
          const existing = foreignAgg.get(key) || {
            subjectCode: code,
            subjectName: entry.subjectName || subjectInfo.name,
            currencyCode: cur,
            partnerName,
            totalOriginal: 0,
          };
          const sign = debit > 0 ? 1 : -1;
          existing.totalOriginal += (entry.originalAmount || 0) * sign;
          foreignAgg.set(key, existing);
        }
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
        const existing = foreignAgg.get(key) || {
          subjectCode: code,
          subjectName: binding?.subSubjectName || '银行存款',
          currencyCode: currency,
          partnerName: '',
          totalOriginal: 0,
        };
        if (Math.abs(existing.totalOriginal) < 0.005) existing.totalOriginal = row.foreignBalance;
        foreignAgg.set(key, existing);

        // 同步回退本币账面（仅当凭证侧未累计过时）
        const baseKey = `${code}-`;
        if (!baseAgg.has(baseKey) || Math.abs(baseAgg.get(baseKey) || 0) < 0.005) {
          baseAgg.set(baseKey, row.balance);
        }
      }
    } catch (e) {
      console.warn('loadMonetaryBalances: 期初外币余额回退失败', e);
    }
  } catch (e) {
    console.error('loadMonetaryBalances: 凭证聚合失败', e);
  }

  // 4. 合并 foreignAgg + baseAgg → 最终桶
  const agg = new Map<string, {
    subjectCode: string;
    subjectName: string;
    currencyCode: string;
    partnerName: string;
    totalOriginal: number;
    totalBase: number;
  }>();
  for (const [key, data] of foreignAgg) {
    const baseKey = `${data.subjectCode}-${data.partnerName}`;
    const totalBase = baseAgg.get(baseKey) || 0;
    agg.set(key, { ...data, totalBase });
  }

  // 5. 按 sourceType 分类输出
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
