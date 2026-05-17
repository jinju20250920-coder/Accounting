'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { SimpleSelect } from '@/components/ui/select';
import { useAccountSetStore, type AccountSet } from '@/stores/useAccountSetStore';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { useVoucherStore } from '@/stores/useVoucherStore';
import type { BankTransaction } from '@/types';
import { sqliteService } from '@/lib/database/sqlite-service';
import {
  buildMonthlyClosingSummary,
  createMonthlyCheckInstances,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
  MONTHLY_CHECK_MODULE_LABELS,
  type MonthlyCheckManualStatus,
  type MonthlyCheckModule,
  type MonthlyCheckSeverity,
  type MonthlyCheckSystemStatus,
  type MonthlyClosingBankTransaction,
  type MonthlyClosingCheckResult,
} from '@/lib/monthly-closing-checks';
import { useMonthlyClosingCheckStore } from '@/lib/monthly-closing-check-state';

const systemStatusLabels: Record<MonthlyCheckSystemStatus, string> = {
  unchecked: '待维护',
  passed: '已通过',
  warning: '提醒',
  blocked: '阻塞',
  no_data: '无数据',
};

const manualStatusLabels: Record<MonthlyCheckManualStatus, string> = {
  unchecked: '未确认',
  completed: '已处理',
  confirmed_not_needed: '确认无须处理',
  explained: '已说明',
  recheck: '待复查',
};

const severityLabels: Record<MonthlyCheckSeverity, string> = {
  info: '信息',
  warning: '提醒',
  blocker: '阻塞',
};

const systemStatusClassNames: Record<MonthlyCheckSystemStatus, string> = {
  unchecked: 'bg-slate-50 text-slate-600 border-slate-200',
  passed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
  no_data: 'bg-blue-50 text-blue-700 border-blue-200',
};

const severityClassNames: Record<MonthlyCheckSeverity, string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  blocker: 'bg-red-50 text-red-700 border-red-200',
};

function getCurrentPeriodText(accountSet: AccountSet | undefined) {
  const currentPeriod = accountSet?.accountingPeriods?.find((period) => period.isCurrent);
  if (currentPeriod) {
    return {
      period: `${currentPeriod.year}-${String(currentPeriod.month).padStart(2, '0')}`,
      label: `${currentPeriod.year}年${currentPeriod.month}月`,
    };
  }

  const fallback = accountSet?.currentPeriod || new Date().toISOString().slice(0, 7);
  const [year, month] = fallback.split('-');
  return {
    period: fallback,
    label: `${year}年${Number(month || 1)}月`,
  };
}

function groupByModule(items: MonthlyClosingCheckResult[]) {
  return items.reduce<Record<MonthlyCheckModule, MonthlyClosingCheckResult[]>>((groups, item) => {
    groups[item.module] = [...(groups[item.module] || []), item];
    return groups;
  }, {} as Record<MonthlyCheckModule, MonthlyClosingCheckResult[]>);
}

export default function MonthlyClosingChecksPage() {
  const { vouchers, initialize: initializeVouchers } = useVoucherStore();
  const { invoices, initialize: initializeInvoices } = useInvoiceStore();
  const { getCurrentAccountSet } = useAccountSetStore();
  const { overridesByAccountSet, setCheckOverride, clearCheckOverride } = useMonthlyClosingCheckStore();
  const currentAccountSet = getCurrentAccountSet();
  const periodInfo = useMemo(() => getCurrentPeriodText(currentAccountSet), [currentAccountSet]);
  const [bankTransactions, setBankTransactions] = useState<MonthlyClosingBankTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState('');

  const refreshChecks = async () => {
    setLoading(true);
    try {
      await Promise.all([
        initializeVouchers(),
        initializeInvoices(),
      ]);

      try {
        const transactions = await sqliteService.getAllBankTransactions();
        setBankTransactions((transactions as BankTransaction[]).map((tx) => ({
          id: tx.id,
          date: tx.date,
          status: tx.status,
          voucherId: tx.voucherId,
        })));
      } catch (error) {
        console.warn('Load bank transactions failed:', error);
        setBankTransactions([]);
      }

      setLastCheckedAt(new Date().toLocaleString('zh-CN', { hour12: false }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodInfo.period, currentAccountSet?.id]);

  const periodOverrides = currentAccountSet?.id
    ? overridesByAccountSet[currentAccountSet.id]?.[periodInfo.period] || {}
    : {};

  const instances = useMemo(() => createMonthlyCheckInstances(periodInfo.period, DEFAULT_MONTHLY_CLOSING_TEMPLATES).map((instance) => {
    const override = periodOverrides[instance.code];
    return override ? { ...instance, ...override } : instance;
  }), [periodInfo.period, periodOverrides]);

  const summary = useMemo(() => buildMonthlyClosingSummary({
    period: periodInfo.period,
    instances,
    vouchers: vouchers.map((voucher) => ({
      id: voucher.id,
      voucherNo: voucher.voucherNo,
      date: voucher.date,
      status: voucher.status,
      entries: voucher.entries.map((entry) => ({
        id: entry.id,
        subjectCode: entry.subjectCode,
        subjectName: entry.subjectName,
        debit: entry.debit,
        credit: entry.credit,
      })),
    })),
    bankTransactions,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceDate: invoice.invoiceDate,
      invoiceType: invoice.invoiceType,
      voucherId: invoice.voucherId,
      paymentStatus: invoice.paymentStatus,
    })),
  }), [bankTransactions, instances, invoices, periodInfo.period, vouchers]);

  const groupedItems = useMemo(() => groupByModule(summary.items), [summary.items]);

  const setOverride = (code: string, patch: Partial<{ manualStatus: MonthlyCheckManualStatus; owner: string; note: string }>) => {
    if (!currentAccountSet?.id) return;
    const item = summary.items.find((check) => check.code === code);
    if (!item) return;

    setCheckOverride(currentAccountSet.id, periodInfo.period, code, {
      manualStatus: patch.manualStatus || item.manualStatus,
      owner: patch.owner ?? item.owner,
      note: patch.note ?? item.note,
    });
  };

  const manualOptions = Object.entries(manualStatusLabels).map(([value, label]) => ({ value, label }));

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">月结检查明细</h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentAccountSet?.name || '当前账套'} / {periodInfo.label}
            {lastCheckedAt ? ` / 最近检查：${lastCheckedAt}` : ''}
          </p>
        </div>
        <Button onClick={refreshChecks} disabled={loading} className="bg-slate-900 hover:bg-slate-800">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          执行月结检查
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">总检查项</p>
            <p className="text-2xl font-bold text-slate-950 mt-1">{summary.totalCount}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">已完成</p>
            <p className="text-2xl font-bold text-slate-950 mt-1">{summary.completedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">未完成</p>
            <p className="text-2xl font-bold text-slate-950 mt-1">{summary.pendingCount}</p>
          </CardContent>
        </Card>
        <Card className={summary.blockerCount > 0 ? 'border-red-200 bg-red-50/60' : 'border-emerald-200 bg-emerald-50/60'}>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">阻塞项</p>
            <p className="text-2xl font-bold text-slate-950 mt-1">{summary.blockerCount}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/60">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">完成率</p>
            <p className="text-2xl font-bold text-slate-950 mt-1">{summary.progress}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-[160px_1fr_80px] items-center gap-4">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <ClipboardCheck className="w-5 h-5 text-slate-600" />
              整体进度
            </div>
            <Progress value={summary.progress} className="h-3" />
            <div className="text-right font-semibold text-slate-900">{summary.progress}%</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">模块进度总览</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="text-left py-3 font-medium">模块</th>
                <th className="text-right py-3 font-medium">检查项数</th>
                <th className="text-right py-3 font-medium">已完成</th>
                <th className="text-right py-3 font-medium">完成率</th>
                <th className="text-right py-3 font-medium">阻塞</th>
                <th className="text-right py-3 font-medium">提醒</th>
                <th className="text-left py-3 pl-6 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MONTHLY_CHECK_MODULE_LABELS).map(([module, label]) => {
                const items = groupedItems[module as MonthlyCheckModule] || [];
                const completed = items.filter((item) => item.completed).length;
                const blockers = items.filter((item) => item.systemStatus === 'blocked' && !item.completed).length;
                const warnings = items.filter((item) => item.systemStatus === 'warning' && !item.completed).length;
                const progress = items.length === 0 ? 0 : Math.round((completed / items.length) * 100);
                const status = blockers > 0 ? '有阻塞' : warnings > 0 ? '待确认' : progress === 100 ? '完成' : '进行中';

                return (
                  <tr key={module} className="border-b last:border-0">
                    <td className="py-3 font-medium text-slate-900">{label}</td>
                    <td className="py-3 text-right">{items.length}</td>
                    <td className="py-3 text-right">{completed}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex w-32 items-center gap-2">
                        <Progress value={progress} className="h-2" />
                        <span className="w-10 text-right">{progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-red-700">{blockers}</td>
                    <td className="py-3 text-right text-amber-700">{warnings}</td>
                    <td className="py-3 pl-6">
                      <Badge variant="outline" className={blockers > 0 ? severityClassNames.blocker : warnings > 0 ? severityClassNames.warning : severityClassNames.info}>
                        {status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-slate-700" />
            月结步骤检查明细
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="text-left py-3 pr-3 font-medium">检查模块</th>
                <th className="text-left py-3 pr-3 font-medium">检查内容</th>
                <th className="text-left py-3 pr-3 font-medium">数据来源</th>
                <th className="text-left py-3 pr-3 font-medium">系统判断</th>
                <th className="text-left py-3 pr-3 font-medium">异常等级</th>
                <th className="text-left py-3 pr-3 font-medium">人工状态</th>
                <th className="text-left py-3 pr-3 font-medium">负责人</th>
                <th className="text-left py-3 pr-3 font-medium">异常备注</th>
                <th className="text-right py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item) => (
                <tr key={item.code} className="border-b last:border-0 align-top">
                  <td className="py-3 pr-3 font-medium text-slate-900">{MONTHLY_CHECK_MODULE_LABELS[item.module]}</td>
                  <td className="py-3 pr-3">
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.systemMessage}</div>
                  </td>
                  <td className="py-3 pr-3 text-slate-600">{item.dataSource}</td>
                  <td className="py-3 pr-3">
                    <Badge variant="outline" className={systemStatusClassNames[item.systemStatus]}>
                      {systemStatusLabels[item.systemStatus]}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant="outline" className={severityClassNames[item.systemSeverity]}>
                      {severityLabels[item.systemSeverity]}
                    </Badge>
                    {item.blockClosing && item.systemStatus === 'blocked' ? (
                      <div className="mt-1 text-xs text-red-600">阻塞月结</div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    <SimpleSelect
                      value={item.manualStatus}
                      onChange={(value) => setOverride(item.code, { manualStatus: value as MonthlyCheckManualStatus })}
                      options={manualOptions}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Input
                      value={item.owner || ''}
                      onChange={(event) => setOverride(item.code, { owner: event.target.value })}
                      placeholder="负责人"
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Input
                      value={item.note || ''}
                      onChange={(event) => setOverride(item.code, { note: event.target.value })}
                      placeholder="异常说明或处理结果"
                    />
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => currentAccountSet?.id && clearCheckOverride(currentAccountSet.id, periodInfo.period, item.code)}
                    >
                      清除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className={summary.canClose ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'}>
        <CardContent className="p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            {summary.canClose ? <CheckCircle2 className="w-6 h-6 text-emerald-700 mt-0.5" /> : <AlertTriangle className="w-6 h-6 text-red-700 mt-0.5" />}
            <div>
              <p className={`font-semibold ${summary.canClose ? 'text-emerald-800' : 'text-red-800'}`}>
                {summary.canClose ? '当前没有阻塞项，可进入月结' : '当前存在阻塞项，暂不可月结'}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                阻塞项必须处理后才能关闭期间；提醒项可以填写说明或确认无须处理。
              </p>
            </div>
          </div>
          <Badge variant="outline" className={summary.canClose ? severityClassNames.info : severityClassNames.blocker}>
            阻塞 {summary.blockerCount} / 提醒 {summary.warningCount}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
