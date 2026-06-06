'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Shield,
  FileText,
  Landmark,
  Receipt,
  Users,
  Building2,
  Wallet,
  Package,
  ArrowRightLeft,
  Calculator,
  BookOpen,
  Lock,
} from 'lucide-react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { useAccountSetStore, type AccountingPeriod } from '@/stores/useAccountSetStore';
import { usePeriodManagementStore } from '@/stores/usePeriodManagementStore';
import { useMonthlyClosingCheckStore } from '@/lib/monthly-closing-check-state';
import {
  buildMonthlyClosingSummary,
  createMonthlyCheckInstances,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
  MONTHLY_CHECK_MODULE_LABELS,
  applyMonthlyCheckRuleConfigs,
  type MonthlyClosingSummary,
  type MonthlyClosingCheckResult,
  type MonthlyCheckModule,
} from '@/lib/monthly-closing-checks';
import { createPeriodClosingAuditLog } from '@/lib/period-closing';
import { useToast } from '@/components/ui/toast';

interface MonthlyClosingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: AccountingPeriod;
}

const MODULE_ICONS: Record<MonthlyCheckModule, React.ReactNode> = {
  bank: <Landmark className="h-4 w-4" />,
  invoice: <Receipt className="h-4 w-4" />,
  expense: <Wallet className="h-4 w-4" />,
  payroll: <Users className="h-4 w-4" />,
  asset: <Building2 className="h-4 w-4" />,
  prepaid: <Calculator className="h-4 w-4" />,
  inventory: <Package className="h-4 w-4" />,
  settlement: <ArrowRightLeft className="h-4 w-4" />,
  tax: <FileText className="h-4 w-4" />,
  general_ledger: <BookOpen className="h-4 w-4" />,
};

export function MonthlyClosingWizard({ open, onOpenChange, period }: MonthlyClosingWizardProps) {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<MonthlyClosingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState(false);

  const accountSetId = useAccountSetStore((s) => s.currentAccountSetId);

  const periodText = `${period.year}-${String(period.month).padStart(2, '0')}`;

  const loadChecks = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setClosed(false);
    try {
      const vouchers = useVoucherStore.getState().vouchers;
      const invoices = useInvoiceStore.getState().invoices;
      const bankTxs = await sqliteService.getBankTransactionsByDateRange(period.startDate, period.endDate);

      const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const ruleConfigs = currentAccountSet?.id
        ? useMonthlyClosingCheckStore.getState().getRuleConfigs(currentAccountSet.id)
        : undefined;
      const checkOverrides = currentAccountSet?.id
        ? useMonthlyClosingCheckStore.getState().getPeriodOverrides(currentAccountSet.id, periodText)
        : undefined;

      const templates = applyMonthlyCheckRuleConfigs(DEFAULT_MONTHLY_CLOSING_TEMPLATES, ruleConfigs);
      const instances = createMonthlyCheckInstances(periodText, templates).map((inst) => {
        const override = checkOverrides?.[inst.code];
        return override ? { ...inst, ...override } : inst;
      });

      const result = buildMonthlyClosingSummary({
        period: periodText,
        instances,
        vouchers: vouchers.map((v) => ({
          id: v.id,
          voucherNo: v.voucherNo,
          date: v.date,
          status: v.status,
          entries: v.entries.map((e) => ({
            id: e.id,
            subjectCode: e.subjectCode,
            subjectName: e.subjectName,
            debit: e.debit,
            credit: e.credit,
          })),
        })),
        invoices: invoices.map((inv) => ({
          id: inv.id,
          invoiceDate: inv.invoiceDate,
          invoiceType: inv.invoiceType,
          voucherId: inv.voucherId,
          paymentStatus: inv.paymentStatus,
        })),
        bankTransactions: bankTxs.map((tx) => ({
          id: tx.id,
          date: tx.date,
          status: tx.status,
          voucherId: tx.voucherId,
        })),
      });

      setSummary(result);
    } catch (error) {
      console.error('Load monthly closing checks failed:', error);
      showToast('error', '加载月结检查失败');
    } finally {
      setLoading(false);
    }
  }, [open, period, periodText, showToast]);

  useEffect(() => {
    loadChecks();
  }, [loadChecks]);

  // Group results by module
  const moduleGroups = useMemo(() => {
    if (!summary) return [];
    const groups = new Map<MonthlyCheckModule, MonthlyClosingCheckResult[]>();
    for (const item of summary.items) {
      if (!groups.has(item.module)) groups.set(item.module, []);
      groups.get(item.module)!.push(item);
    }
    return [...groups.entries()];
  }, [summary]);

  const toggleModule = (module: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const handleConfirmClose = async () => {
    if (!summary || !accountSetId) return;

    setClosing(true);
    try {
      await usePeriodManagementStore.getState().closePeriod(period.id);
      await sqliteService.addAuditLog(createPeriodClosingAuditLog(period, 'close', {
        accountSetId,
        blockerCount: summary.blockerCount,
        warningCount: summary.warningCount,
      }));
      setClosed(true);
      showToast('success', `${period.name} 月结完成`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '月结失败');
    } finally {
      setClosing(false);
    }
  };

  const getStatusIcon = (item: MonthlyClosingCheckResult) => {
    switch (item.systemStatus) {
      case 'passed': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'blocked': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'no_data': return <Clock className="h-4 w-4 text-slate-400" />;
      default: return <Clock className="h-4 w-4 text-slate-300" />;
    }
  };

  const getStatusBadge = (item: MonthlyClosingCheckResult) => {
    switch (item.systemStatus) {
      case 'passed': return <Badge className="bg-green-50 text-green-700 text-xs">通过</Badge>;
      case 'blocked': return <Badge variant="destructive" className="text-xs">阻塞</Badge>;
      case 'warning': return <Badge className="bg-amber-50 text-amber-700 text-xs">警告</Badge>;
      case 'no_data': return <Badge variant="outline" className="text-xs text-slate-400">无数据</Badge>;
      default: return <Badge variant="outline" className="text-xs">未检查</Badge>;
    }
  };

  const getModuleStatus = (items: MonthlyClosingCheckResult[]) => {
    if (items.every(i => i.systemStatus === 'passed' || i.systemStatus === 'no_data'))
      return 'passed';
    if (items.some(i => i.systemStatus === 'blocked'))
      return 'blocked';
    if (items.some(i => i.systemStatus === 'warning'))
      return 'warning';
    return 'unchecked';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            月结向导 — {period.name}
          </DialogTitle>
          <DialogDescription>
            执行月结前检查，确认所有业务处理完毕后关闭本期
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-slate-600">正在执行月结检查...</span>
          </div>
        ) : summary ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Progress Overview */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                <p className="text-2xl font-bold text-green-700">{summary.completedCount}</p>
                <p className="text-xs text-green-600">已完成</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                <p className="text-2xl font-bold text-amber-600">{summary.warningCount}</p>
                <p className="text-xs text-amber-600">警告</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                <p className="text-2xl font-bold text-red-600">{summary.blockerCount}</p>
                <p className="text-xs text-red-600">阻塞</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <p className="text-2xl font-bold text-slate-600">{summary.pendingCount}</p>
                <p className="text-xs text-slate-500">待处理</p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">月结进度</span>
                <span className="font-medium">{summary.progress.toFixed(0)}%</span>
              </div>
              <Progress value={summary.progress} className="h-2" />
            </div>

            {/* Module Groups */}
            <div className="space-y-2">
              {moduleGroups.map(([module, items]) => {
                const moduleStatus = getModuleStatus(items);
                const isExpanded = expandedModules.has(module);
                const completedInModule = items.filter(i => i.completed).length;

                return (
                  <div key={module} className="border rounded-lg">
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                      onClick={() => toggleModule(module)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={moduleStatus === 'passed' ? 'text-green-600' : moduleStatus === 'blocked' ? 'text-red-600' : moduleStatus === 'warning' ? 'text-amber-500' : 'text-slate-400'}>
                          {MODULE_ICONS[module]}
                        </span>
                        <span className="font-medium text-sm text-slate-900">
                          {MONTHLY_CHECK_MODULE_LABELS[module]}
                        </span>
                        <span className="text-xs text-slate-400">
                          {completedInModule}/{items.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {moduleStatus === 'passed' && <Badge className="bg-green-50 text-green-700 text-xs">全部通过</Badge>}
                        {moduleStatus === 'blocked' && <Badge variant="destructive" className="text-xs">有阻塞</Badge>}
                        {moduleStatus === 'warning' && <Badge className="bg-amber-50 text-amber-700 text-xs">有警告</Badge>}
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t">
                        {items.map((item) => (
                          <div key={item.code} className="flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-slate-50">
                            <div className="mt-0.5">{getStatusIcon(item)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-900">{item.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{item.systemMessage}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {getStatusBadge(item)}
                              {item.route && (
                                <a href={item.route} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={loadChecks} disabled={loading}>
              重新检查
            </Button>
            {closed ? (
              <Badge className="bg-green-100 text-green-700 px-4 py-2">
                <CheckCircle2 className="h-4 w-4 mr-1" /> 已完成月结
              </Badge>
            ) : (
              <Button
                onClick={handleConfirmClose}
                disabled={closing || !summary?.canClose}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {closing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    月结中...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-1" />
                    确认月结
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>

        {summary && !summary.canClose && (
          <p className="text-xs text-red-600 text-center">
            存在 {summary.blockerCount} 个阻塞项，请先处理后再月结
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
