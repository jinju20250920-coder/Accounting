'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  DollarSign,
  FileText,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { usePayrollStore } from '@/stores/usePayrollStore';
import type { AccountSet } from '@/stores/useAccountSetStore';
import type { BankTransaction } from '@/types';
import { sqliteService } from '@/lib/database/sqlite-service';
import { formatMoney } from '@/lib/accounting';
import {
  buildSmartAccountingSummaryFromMonthlyClosing,
  type SmartAccountingBankTransaction,
  type SmartTaskStatus,
  type SmartRiskSeverity,
} from '@/lib/smart-accounting-workbench';
import {
  buildMonthlyClosingSummary,
  createMonthlyCheckInstances,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
  type MonthlyClosingBankTransaction,
} from '@/lib/monthly-closing-checks';
import { useMonthlyClosingCheckStore } from '@/lib/monthly-closing-check-state';

const statusLabels: Record<SmartTaskStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  warning: '提醒',
  blocked: '阻塞',
  not_started: '未开始',
};

const statusClassNames: Record<SmartTaskStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
  not_started: 'bg-slate-50 text-slate-600 border-slate-200',
};

const severityLabels: Record<SmartRiskSeverity, string> = {
  blocker: '阻塞',
  warning: '提醒',
  info: '信息',
};

const severityClassNames: Record<SmartRiskSeverity, string> = {
  blocker: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

function getCurrentPeriodText(accountSet: AccountSet | undefined) {
  const currentPeriod = accountSet?.accountingPeriods?.find((period) => period.isCurrent);
  if (currentPeriod) {
    return {
      period: `${currentPeriod.year}-${String(currentPeriod.month).padStart(2, '0')}`,
      label: `${currentPeriod.year}年${currentPeriod.month}月`,
      status: currentPeriod.status,
    };
  }

  const fallback = accountSet?.currentPeriod || new Date().toISOString().slice(0, 7);
  const [year, month] = fallback.split('-');
  return {
    period: fallback,
    label: `${year}年${Number(month || 1)}月`,
    status: accountSet?.status === 'closed' ? 'closed' : 'open',
  };
}

export default function SmartAccountingWorkbench() {
  const router = useRouter();
  const { vouchers, initialize: initializeVouchers } = useVoucherStore();
  const { subjects, initializeSubjects } = useSubjectStore();
  const { invoices, initialize: initializeInvoices } = useInvoiceStore();
  const payrollBatches = usePayrollStore((state) => state.batches);
  const loadPayrollPeriod = usePayrollStore((state) => state.loadPeriod);
  const { getCurrentAccountSet } = useAccountSetStore();
  const monthlyOverridesByAccountSet = useMonthlyClosingCheckStore((state) => state.overridesByAccountSet);
  const monthlyRuleConfigsByAccountSet = useMonthlyClosingCheckStore((state) => state.ruleConfigsByAccountSet);
  const currentAccountSet = getCurrentAccountSet();
  const [bankTransactions, setBankTransactions] = useState<SmartAccountingBankTransaction[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const periodInfo = useMemo(() => getCurrentPeriodText(currentAccountSet), [currentAccountSet]);

  const refreshWorkbench = async () => {
    setLoading(true);
    try {
      await Promise.all([
        initializeVouchers(),
        initializeSubjects(),
        initializeInvoices(),
        loadPayrollPeriod(periodInfo.period),
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
        console.warn('加载银行流水失败:', error);
        setBankTransactions([]);
      }

      setLastCheckedAt(new Date().toLocaleString('zh-CN', { hour12: false }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshWorkbench();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodInfo.period, currentAccountSet?.id]);

  const smartAccountingInput = useMemo(() => ({
    period: periodInfo.period,
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
  }), [bankTransactions, invoices, periodInfo.period, vouchers]);

  const monthlyPeriodOverrides = useMemo(
    () => (currentAccountSet?.id ? monthlyOverridesByAccountSet[currentAccountSet.id]?.[periodInfo.period] || {} : {}),
    [currentAccountSet?.id, monthlyOverridesByAccountSet, periodInfo.period],
  );

  const monthlyRuleConfigs = useMemo(
    () => (currentAccountSet?.id ? monthlyRuleConfigsByAccountSet[currentAccountSet.id] || {} : {}),
    [currentAccountSet?.id, monthlyRuleConfigsByAccountSet],
  );

  const monthlyEnabledTemplates = useMemo(
    () => DEFAULT_MONTHLY_CLOSING_TEMPLATES.filter((template) => monthlyRuleConfigs[template.code]?.enabled !== false),
    [monthlyRuleConfigs],
  );

  const monthlyInstances = useMemo(() => createMonthlyCheckInstances(periodInfo.period, monthlyEnabledTemplates).map((instance) => {
    const override = monthlyPeriodOverrides[instance.code];
    const ruleConfig = monthlyRuleConfigs[instance.code];
    const configured = ruleConfig ? {
      ...instance,
      severity: ruleConfig.severity || instance.severity,
      blockClosing: ruleConfig.blockClosing ?? instance.blockClosing,
      allowManualConfirmation: ruleConfig.allowManualConfirmation ?? instance.allowManualConfirmation,
      owner: ruleConfig.owner ?? instance.owner,
    } : instance;
    return override ? { ...configured, ...override } : configured;
  }), [monthlyEnabledTemplates, monthlyPeriodOverrides, monthlyRuleConfigs, periodInfo.period]);

  const monthlySummary = useMemo(() => buildMonthlyClosingSummary({
    period: periodInfo.period,
    instances: monthlyInstances,
    vouchers: smartAccountingInput.vouchers,
    bankTransactions: smartAccountingInput.bankTransactions as MonthlyClosingBankTransaction[],
    invoices: smartAccountingInput.invoices,
    payrollBatches: payrollBatches.map((batch) => ({
      status: batch.status,
      taxTotal: batch.taxTotal,
      includesSocialFundCalculation: batch.employeeCount > 0,
    })),
    ruleConfigs: monthlyRuleConfigs,
  }), [monthlyInstances, monthlyRuleConfigs, payrollBatches, periodInfo.period, smartAccountingInput]);

  const workbenchSummary = useMemo(
    () => buildSmartAccountingSummaryFromMonthlyClosing(smartAccountingInput, monthlySummary),
    [monthlySummary, smartAccountingInput],
  );

  const workbenchView = workbenchSummary;

  const coreMetrics = useMemo(() => {
    const postedVouchers = vouchers.filter((voucher) => voucher.status === 'posted');
    const periodVouchers = postedVouchers.filter((voucher) => voucher.date.startsWith(periodInfo.period));

    let cashOnHand = 0;
    let monthlyRevenue = 0;
    let accountsReceivable = 0;
    let accountsPayable = 0;

    postedVouchers.forEach((voucher) => {
      voucher.entries.forEach((entry) => {
        const subject = subjects.find((item) => item.code === entry.subjectCode);
        if (!subject) return;

        if (subject.code.startsWith('1')) {
          cashOnHand += (entry.debit || 0) - (entry.credit || 0);
        }
        if (subject.isCustomer) {
          accountsReceivable += (entry.debit || 0) - (entry.credit || 0);
        }
        if (subject.isSupplier) {
          accountsPayable += (entry.credit || 0) - (entry.debit || 0);
        }
      });
    });

    periodVouchers.forEach((voucher) => {
      voucher.entries.forEach((entry) => {
        const subject = subjects.find((item) => item.code === entry.subjectCode);
        if (subject?.code.startsWith('6')) {
          monthlyRevenue += entry.credit || 0;
        }
      });
    });

    return {
      cashOnHand,
      monthlyRevenue,
      netPosition: accountsReceivable - accountsPayable,
      voucherCount: vouchers.length,
      postedVoucherCount: postedVouchers.length,
    };
  }, [periodInfo.period, subjects, vouchers]);

  const overviewCards = [
    {
      title: '做账进度',
      value: `${workbenchView.progress}%`,
      detail: `已完成 ${workbenchView.completedCount}/${workbenchView.totalCount} 项`,
      icon: Activity,
      className: 'border-blue-200 bg-blue-50/60',
    },
    {
      title: '待处理任务',
      value: `${workbenchView.pendingCount} 项`,
      detail: `今日建议 ${workbenchView.nextActions.length} 项`,
      icon: ListChecks,
      className: 'border-slate-200 bg-white',
    },
    {
      title: '风险事项',
      value: `${workbenchView.warningCount + workbenchView.blockerCount} 项`,
      detail: `阻塞 ${workbenchView.blockerCount} 项 / 提醒 ${workbenchView.warningCount} 项`,
      icon: ShieldAlert,
      className: workbenchView.blockerCount > 0 ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60',
    },
    {
      title: '月结状态',
      value: workbenchView.canClose ? '可月结' : '不可月结',
      detail: workbenchView.canClose ? '关键检查未发现阻塞项' : '需先处理阻塞项',
      icon: ClipboardCheck,
      className: workbenchView.canClose ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-950">智能做账工作台</h1>
            <Badge variant="outline" className="bg-slate-50 text-slate-700">
              {periodInfo.status === 'closed' ? '已关账' : '做账中'}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {currentAccountSet?.name || '当前账套'} / 当前账期：{periodInfo.label}
            {lastCheckedAt ? ` / 最近检查：${lastCheckedAt}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={refreshWorkbench} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {loading ? '刷新中' : '刷新状态'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/monthly-closing-checks')}>
            <ListChecks className="w-4 h-4 mr-2" />
            检查设置
          </Button>
          <Button onClick={refreshWorkbench} disabled={loading} className="bg-slate-900 hover:bg-slate-800">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            执行做账检查
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {overviewCards.map((item) => (
          <Card key={item.title} className={item.className}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{item.title}</p>
                  <p className="text-2xl font-bold text-slate-950 mt-2">{item.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{item.detail}</p>
                </div>
                <div className="p-2 rounded-md bg-white border border-slate-200">
                  <item.icon className="w-5 h-5 text-slate-700" />
                </div>
              </div>
              {item.title === '做账进度' && (
                <Progress value={workbenchView.progress} className="h-2 mt-4 bg-blue-100" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">本月做账任务</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-left py-3 font-medium">阶段</th>
                  <th className="text-left py-3 font-medium">任务</th>
                  <th className="text-left py-3 font-medium">状态</th>
                  <th className="text-right py-3 font-medium">异常</th>
                  <th className="text-right py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {workbenchView.tasks.map((item) => (
                  <tr key={item.code} className="border-b last:border-0">
                    <td className="py-3 text-slate-500">{item.stage}</td>
                    <td className="py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="py-3">
                      <Badge variant="outline" className={statusClassNames[item.status]}>
                        {statusLabels[item.status]}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-slate-700">
                      {item.exceptionCount > 0 ? `${item.exceptionCount} 项` : '-'}
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => router.push(item.targetRoute)}>
                        {item.actionLabel}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">月结准备</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-sm text-slate-500">当前状态</p>
              <p className={`text-xl font-bold mt-1 ${workbenchView.canClose ? 'text-emerald-700' : 'text-red-700'}`}>
                {workbenchView.canClose ? '可进入月结检查' : '当前不可月结'}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                阻塞项：{workbenchView.blockerCount} / 提醒项：{workbenchView.warningCount}
              </p>
            </div>

            <div className="space-y-2">
              <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={refreshWorkbench}>
                执行做账检查
              </Button>
              <Button className="w-full" variant="outline" onClick={() => router.push('/reports')}>
                查看报表
              </Button>
              <Button className="w-full" variant="outline" onClick={() => router.push('/monthly-closing-checks')}>
                检查设置
              </Button>
            </div>

            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              <p>固定资产原值：{formatMoney(workbenchView.metrics.fixedAssetOriginalBalance)}</p>
              <p>累计折旧余额：{formatMoney(workbenchView.metrics.accumulatedDepreciationBalance)}</p>
              <p>待摊费用余额：{formatMoney(workbenchView.metrics.prepaidBalance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            下一步建议
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workbenchView.nextActions.length === 0 ? (
            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div>
                <p className="font-medium text-emerald-800">本期关键检查暂未发现阻塞项</p>
                <p className="text-sm text-emerald-700 mt-1">可以继续生成报表或维护检查设置。</p>
              </div>
              <Button variant="outline" onClick={() => router.push('/reports')}>生成报表</Button>
            </div>
          ) : (
            workbenchView.nextActions.slice(0, 4).map((item, index) => (
              <div key={item.code} className="flex flex-col gap-3 rounded-md border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="font-medium text-slate-950">{item.title}</p>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 ml-8">{item.description}</p>
                </div>
                <Button variant="outline" className="shrink-0" onClick={() => router.push(item.targetRoute)}>
                  {item.actionLabel}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            异常与风险
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workbenchView.risks.length === 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800">
              暂未发现需要优先处理的风险事项。
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {workbenchView.risks.map((item) => (
                <div key={item.code} className="rounded-md border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className={severityClassNames[item.severity]}>
                      {severityLabels[item.severity]}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => router.push(item.targetRoute)}>
                      {item.actionLabel}
                    </Button>
                  </div>
                  <p className="font-medium text-slate-950 mt-3">{item.title}</p>
                  <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">经营概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-md border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">库存现金</span>
              </div>
              <p className="text-xl font-bold text-slate-950 mt-2">{formatMoney(coreMetrics.cashOnHand)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <Banknote className="w-4 h-4" />
                <span className="text-sm">应收应付净头寸</span>
              </div>
              <p className="text-xl font-bold text-slate-950 mt-2">{formatMoney(coreMetrics.netPosition)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">本月收入</span>
              </div>
              <p className="text-xl font-bold text-slate-950 mt-2">{formatMoney(coreMetrics.monthlyRevenue)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <FileText className="w-4 h-4" />
                <span className="text-sm">凭证数量</span>
              </div>
              <p className="text-xl font-bold text-slate-950 mt-2">{coreMetrics.voucherCount} 张</p>
              <p className="text-sm text-slate-500 mt-1">已记账 {coreMetrics.postedVoucherCount} 张</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
