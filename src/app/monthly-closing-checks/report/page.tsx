'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAccountSetStore, type AccountSet } from '@/stores/useAccountSetStore';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { useVoucherStore } from '@/stores/useVoucherStore';
import type { BankTransaction } from '@/types';
import { sqliteService } from '@/lib/database/sqlite-service';
import {
  buildMonthlyClosingReport,
  buildMonthlyClosingSummary,
  createMonthlyCheckInstances,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
  type MonthlyClosingBankTransaction,
} from '@/lib/monthly-closing-checks';
import { useMonthlyClosingCheckStore } from '@/lib/monthly-closing-check-state';

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

export default function MonthlyClosingCheckReportPage() {
  const router = useRouter();
  const { vouchers, initialize: initializeVouchers } = useVoucherStore();
  const { invoices, initialize: initializeInvoices } = useInvoiceStore();
  const { getCurrentAccountSet } = useAccountSetStore();
  const { overridesByAccountSet, ruleConfigsByAccountSet } = useMonthlyClosingCheckStore();
  const currentAccountSet = getCurrentAccountSet();
  const periodInfo = useMemo(() => getCurrentPeriodText(currentAccountSet), [currentAccountSet]);
  const [bankTransactions, setBankTransactions] = useState<MonthlyClosingBankTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState('');

  const refreshReport = async () => {
    setLoading(true);
    try {
      await Promise.all([initializeVouchers(), initializeInvoices()]);
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
      setGeneratedAt(new Date().toLocaleString('zh-CN', { hour12: false }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodInfo.period, currentAccountSet?.id]);

  const periodOverrides = currentAccountSet?.id
    ? overridesByAccountSet[currentAccountSet.id]?.[periodInfo.period] || {}
    : {};
  const ruleConfigs = currentAccountSet?.id
    ? ruleConfigsByAccountSet[currentAccountSet.id] || {}
    : {};
  const enabledTemplates = useMemo(
    () => DEFAULT_MONTHLY_CLOSING_TEMPLATES.filter((template) => ruleConfigs[template.code]?.enabled !== false),
    [ruleConfigs],
  );
  const instances = useMemo(() => createMonthlyCheckInstances(periodInfo.period, enabledTemplates).map((instance) => {
    const ruleConfig = ruleConfigs[instance.code];
    const override = periodOverrides[instance.code];
    const configured = ruleConfig ? {
      ...instance,
      severity: ruleConfig.severity || instance.severity,
      blockClosing: ruleConfig.blockClosing ?? instance.blockClosing,
      allowManualConfirmation: ruleConfig.allowManualConfirmation ?? instance.allowManualConfirmation,
      owner: ruleConfig.owner ?? instance.owner,
    } : instance;
    return override ? { ...configured, ...override } : configured;
  }), [enabledTemplates, periodInfo.period, periodOverrides, ruleConfigs]);

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

  const report = useMemo(() => buildMonthlyClosingReport({
    accountSetName: currentAccountSet?.name || '当前账套',
    generatedAt: generatedAt || new Date().toLocaleString('zh-CN', { hour12: false }),
    summary,
  }), [currentAccountSet?.name, generatedAt, summary]);

  const downloadReport = () => {
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `月结检查报告_${periodInfo.period}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">月结检查报告</h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentAccountSet?.name || '当前账套'} / {periodInfo.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push('/monthly-closing-checks')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回明细
          </Button>
          <Button variant="outline" onClick={refreshReport} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新报告
          </Button>
          <Button onClick={downloadReport} className="bg-slate-900 hover:bg-slate-800">
            <Download className="w-4 h-4 mr-2" />
            导出 Markdown
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">检查项</p>
            <p className="text-2xl font-bold text-slate-950 mt-1">{summary.totalCount}</p>
          </CardContent>
        </Card>
        <Card className={summary.canClose ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'}>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">月结状态</p>
            <p className="text-xl font-bold text-slate-950 mt-1">{summary.canClose ? '可月结' : '不可月结'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">阻塞项</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{summary.blockerCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">完成率</p>
            <p className="text-2xl font-bold text-slate-950 mt-1">{summary.progress}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-slate-700" />
            报告正文
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={report} readOnly className="min-h-[560px] font-mono text-xs leading-5" />
        </CardContent>
      </Card>
    </div>
  );
}
