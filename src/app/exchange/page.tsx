'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getCurrentService } from '@/lib/database';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { generateVoucherNo } from '@/lib/accounting';
import {
  buildFxRevaluationPreview,
  buildFxRevaluationVoucher,
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
    fxRates,
    revaluationRuns,
    initializeFxRates,
    initializeRevaluationRuns,
    saveRevaluationRun,
    deleteRevaluationRun,
    getRevaluationRunLines,
  } = useCurrencyStore();

  const { vouchers } = useVoucherStore();

  const [tab, setTab] = useState<TabValue>('preview');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [previewLines, setPreviewLines] = useState<FxRevaluationRunLine[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{ totalGain: number; totalLoss: number; net: number } | null>(null);
  const [voucherEntries, setVoucherEntries] = useState<{ subjectCode: string; subjectName: string; debit: number; credit: number; summary: string }[]>([]);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [detailLines, setDetailLines] = useState<FxRevaluationRunLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    initializeFxRates();
    initializeRevaluationRuns();
  }, [accountSetId]);

  // TEMP DEBUG HOOK: 在浏览器控制台调用
  // 用法1: await window.__fixVoucherFx('收-202606-003', 'USD', 6.8109)
  //   仅写入货币性项目分录（1001/1002/1122/2202 等），非货币性（库存/收入/费用）跳过
  // 用法2: await window.__fixVoucherFx('收-202606-003', 'USD', 6.8109, { clearNonMonetary: true })
  //   同时清掉非货币性分录上残留的 FX 字段
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__fixVoucherFx = async (
      voucherNo: string,
      currency: string,
      rate: number,
      opts?: { clearNonMonetary?: boolean },
    ) => {
      const isMonetary = (code: string) => {
        if (!code) return false;
        const prefixes = ['1001','1002','1012','1101','1121','1122','1123','1131','1132','1221','1231','1401','1471','1501','1502','1503','1504','2001','2002','2101','2201','2202','2203','2211','2221','2231','2232','2241','2501','2502','2701','2702'];
        return prefixes.some(p => code.startsWith(p));
      };
      const service = getCurrentService() as any;
      const all = await service.getAllVouchers();
      const target = all.find((v: any) => (v.voucherNo || v.no) === voucherNo);
      if (!target) {
        console.error(`[fixVoucherFx] 凭证号 ${voucherNo} 未找到。现有凭证号:`, all.map((v: any) => v.voucherNo));
        return { ok: false, error: 'not-found' };
      }
      const updatedEntries = (target.entries || []).map((e: any) => {
        if (!isMonetary(e.subjectCode)) {
          if (!opts?.clearNonMonetary) return e;
          const { currencyCode, currencyName, exchangeRate, originalAmount, ...rest } = e;
          return rest;
        }
        const cnyAmount = (e.debit || 0) + (e.credit || 0);
        const originalAmount = cnyAmount > 0 ? Math.round((cnyAmount / rate) * 100) / 100 : 0;
        return {
          ...e,
          currencyCode: currency,
          currencyName: currency === 'USD' ? '美元' : currency,
          exchangeRate: rate,
          originalAmount,
        };
      });
      const updated = { ...target, entries: updatedEntries };
      await service.saveVoucher(updated);
      const monetary = updatedEntries.filter((e: any) => isMonetary(e.subjectCode));
      console.log(`[fixVoucherFx] 已修复 ${voucherNo}。货币性分录 ${monetary.length} 条写入 FX，其他 ${updatedEntries.length - monetary.length} 条保持不变。`, updatedEntries);
      return { ok: true, fixed: monetary.length, total: updatedEntries.length };
    };
    return () => { delete (window as any).__fixVoucherFx; };
  }, []);

  // ─── 预览计算 ───

  const handlePreview = useCallback(async () => {
    if (!period) return;
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

      // 2. 获取外币银行账户余额
      const bankBalances: FxRevaluationBankBalance[] = await loadBankBalances(period, rates);

      // 3. 获取外币应收/应付余额
      const openItems: FxRevaluationOpenItem[] = await loadOpenItems(period, rates);

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
  }, [period, accountSetId, baseCurrency, fxRates]);

  // ─── 确认并生成凭证 ───

  const handleConfirm = useCallback(async () => {
    if (previewLines.length === 0 || !previewSummary) return;
    setLoading(true);

    try {
      const runId = previewLines[0]?.runId || genId();
      const now = new Date().toISOString();

      // 1. 创建凭证
      const voucherId = genId();
      const [yearStr, monthStr] = period.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const existingCount = vouchers.filter((v) => {
        const d = v.date || '';
        return d.startsWith(period);
      }).length;
      const voucherNo = generateVoucherNo(year, month, existingCount + 1);

      const voucherDate = getMonthEndDate(period);
      const entries = voucherEntries.map((e, idx) => ({
        id: `${voucherId}-E${idx}`,
        voucherId,
        date: voucherDate,
        subjectCode: e.subjectCode,
        subjectName: e.subjectName,
        debit: e.debit,
        credit: e.credit,
        summary: e.summary,
      }));

      const voucher = {
        id: voucherId,
        voucherNo,
        date: voucherDate,
        status: 'draft' as const,
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
        status: 'confirmed',
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
      showToast('error', '确认失败');
    } finally {
      setLoading(false);
    }
  }, [previewLines, previewSummary, voucherEntries, period, accountSetId, baseCurrency, vouchers]);

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

  const periodRuns = useMemo(() => {
    return revaluationRuns.filter((r) => r.period === period);
  }, [revaluationRuns, period]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
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
              {periodRuns.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{periodRuns.length}</Badge>
              )}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">类型</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead className="w-16">币种</TableHead>
                      <TableHead className="text-right w-24">原币余额</TableHead>
                      <TableHead className="text-right w-20">账面汇率</TableHead>
                      <TableHead className="text-right w-20">期末汇率</TableHead>
                      <TableHead className="text-right w-24">账面本币</TableHead>
                      <TableHead className="text-right w-24">重估本币</TableHead>
                      <TableHead className="text-right w-24">损益金额</TableHead>
                      <TableHead className="w-16">方向</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {line.sourceType === 'bank' ? '银行' : line.sourceType === 'receivable' ? '应收' : '应付'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{line.sourceName}</TableCell>
                        <TableCell className="text-sm font-mono">{line.currencyCode}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmtMoney(line.originalAmount)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{line.originalRate.toFixed(4)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{line.revaluationRate.toFixed(4)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmtMoney(line.bookValueBase)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmtMoney(line.revaluedBase)}</TableCell>
                        <TableCell className={cn('text-right text-sm tabular-nums font-medium', line.gainLossDirection === 'gain' ? 'text-green-600' : 'text-red-600')}>
                          {line.gainLossDirection === 'gain' ? '+' : '-'}{fmtMoney(line.gainLossAmount)}
                        </TableCell>
                        <TableCell>
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
                <p>选择会计期间后点击"预览重估"</p>
              </div>
            )}
          </TabsContent>

          {/* 历史 Tab */}
          <TabsContent value="history" className="space-y-4">
            {periodRuns.length === 0 ? (
              <div className="rounded-lg border bg-white p-12 text-center text-slate-400">
                <p>当前期间无重估记录</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>期间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>本位币</TableHead>
                      <TableHead>凭证</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="text-sm font-mono">{run.period}</TableCell>
                        <TableCell>
                          <Badge className="text-xs bg-blue-50 text-blue-700">
                            {run.status === 'confirmed' ? '已确认' : run.status === 'posted' ? '已过账' : run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{run.baseCurrency}</TableCell>
                        <TableCell className="text-sm font-mono">{run.voucherNo || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-500">{formatDateTime(run.createdAt)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(run.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteRun(run.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">类型</TableHead>
                        <TableHead>来源</TableHead>
                        <TableHead className="w-16">币种</TableHead>
                        <TableHead className="text-right w-24">原币余额</TableHead>
                        <TableHead className="text-right w-24">账面本币</TableHead>
                        <TableHead className="text-right w-24">重估本币</TableHead>
                        <TableHead className="text-right w-24">损益金额</TableHead>
                        <TableHead className="w-16">方向</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {line.sourceType === 'bank' ? '银行' : line.sourceType === 'receivable' ? '应收' : '应付'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{line.sourceName}</TableCell>
                          <TableCell className="text-sm font-mono">{line.currencyCode}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmtMoney(line.originalAmount)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmtMoney(line.bookValueBase)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmtMoney(line.revaluedBase)}</TableCell>
                          <TableCell className={cn('text-right text-sm tabular-nums font-medium', line.gainLossDirection === 'gain' ? 'text-green-600' : 'text-red-600')}>
                            {fmtMoney(line.gainLossAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-xs', line.gainLossDirection === 'gain' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                              {line.gainLossDirection === 'gain' ? '收益' : '损失'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
 * 加载外币银行账户余额
 *
 * 单一数据源：凭证分录（1001 库存现金 / 1002 银行存款 + currencyCode≠CNY）
 *
 * 银行账户绑定（bank_account_bindings）仅用于元数据反查：
 * 通过 subSubjectCode 关联到对应银行户，补全 accountNumber/bankName 让预览行更直观。
 *
 * 优势：
 * - 用户无论是用银行流水导入还是手工录入凭证，只要分录带了币别，都会被识别
 * - 不会出现"流水来源 + 凭证来源"双重计数
 */
async function loadBankBalances(period: string, rates: FxRate[]): Promise<FxRevaluationBankBalance[]> {
  const service = getCurrentService() as any;
  const periodEnd = getMonthEndDate(period);

  // 预加载银行账户绑定，按 subSubjectCode 索引，用于元数据反查
  const bindingsBySubject = new Map<string, any>();
  try {
    const bindings = service.getBankAccountBindings ? await service.getBankAccountBindings() : [];
    for (const b of bindings || []) {
      if (b.subSubjectCode) bindingsBySubject.set(b.subSubjectCode, b);
    }
  } catch (e) {
    console.warn('loadBankBalances: 银行绑定加载失败', e);
  }

  const results: FxRevaluationBankBalance[] = [];
  const agg = new Map<string, { subjectCode: string; subjectName: string; currencyCode: string; totalOriginal: number; totalBase: number }>();

  try {
    const allVouchers = service.getAllVouchers ? await service.getAllVouchers() : [];

    for (const voucher of allVouchers) {
      const voucherDate = (voucher.date || '').slice(0, 10);
      if (!voucherDate || voucherDate > periodEnd) continue;
      const entries = voucher.entries || [];
      for (const entry of entries) {
        if (!entry.currencyCode || entry.currencyCode === 'CNY') continue;
        const code = (entry.subjectCode || '');
        if (!code.startsWith('1001') && !code.startsWith('1002')) continue;

        const key = `${code}-${entry.currencyCode}`;
        const existing = agg.get(key) || {
          subjectCode: code,
          subjectName: entry.subjectName || '银行存款',
          currencyCode: entry.currencyCode,
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

    for (const [key, data] of agg) {
      if (Math.abs(data.totalOriginal) < 0.005 && Math.abs(data.totalBase) < 0.005) continue;
      const binding = bindingsBySubject.get(data.subjectCode);
      results.push({
        accountId: binding?.id || `voucher-${key}`,
        accountNumber: binding?.accountNumber || data.subjectCode,
        bankName: binding?.bankName || binding?.aliasName || data.subjectName,
        currencyCode: data.currencyCode,
        originalAmount: Math.abs(data.totalOriginal) >= 0.005 ? data.totalOriginal : data.totalBase,
        bookValueBase: Math.round(data.totalBase * 100) / 100,
        subjectCode: data.subjectCode,
        subjectName: data.subjectName,
      });
    }
  } catch (e) {
    console.error('loadBankBalances: 凭证聚合失败', e);
  }

  return results;
}

/**
 * 加载外币应收/应付未核销余额
 * 从 vouchers 中的 entries 查找外币应收/应付科目余额
 */
async function loadOpenItems(period: string, rates: FxRate[]): Promise<FxRevaluationOpenItem[]> {
  const service = getCurrentService() as any;
  const results: FxRevaluationOpenItem[] = [];

  try {
    // 从凭证分录中汇总外币应收/应付余额
    const allVouchers = service.getAllVouchers ? await service.getAllVouchers() : [];
    const periodEnd = getMonthEndDate(period);

    const fxEntries = new Map<string, { totalOriginal: number; totalBase: number; subjectCode: string; subjectName: string; currencyCode: string }>();

    for (const voucher of allVouchers) {
      if (voucher.date > periodEnd) continue;
      const entries = voucher.entries || [];
      for (const entry of entries) {
        if (!entry.currencyCode || entry.currencyCode === 'CNY') continue;
        // 应收科目 1122 / 应付科目 2202
        const isReceivable = (entry.subjectCode || '').startsWith('1122');
        const isPayable = (entry.subjectCode || '').startsWith('2202');
        if (!isReceivable && !isPayable) continue;

        const key = `${entry.subjectCode}-${entry.currencyCode}-${isReceivable ? 'rec' : 'pay'}`;
        const existing = fxEntries.get(key) || { totalOriginal: 0, totalBase: 0, subjectCode: entry.subjectCode, subjectName: entry.subjectName, currencyCode: entry.currencyCode };
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        existing.totalOriginal += (entry.originalAmount || 0) * (debit > 0 ? 1 : -1);
        existing.totalBase += (debit - credit);
        fxEntries.set(key, existing);
      }
    }

    for (const [key, data] of fxEntries) {
      if (Math.abs(data.totalOriginal) < 0.005) continue;
      const rate = rates.find((r) => r.currencyCode === data.currencyCode);
      if (!rate) continue;

      const isReceivable = key.includes('-rec-');
      results.push({
        itemId: key,
        moduleName: isReceivable ? 'receivable' : 'payable',
        partnerName: data.subjectName,
        currencyCode: data.currencyCode,
        originalAmount: data.totalOriginal,
        bookValueBase: data.totalBase,
        subjectCode: data.subjectCode,
        subjectName: data.subjectName,
      });
    }
  } catch (error) {
    console.error('Failed to load open items:', error);
  }

  return results;
}
