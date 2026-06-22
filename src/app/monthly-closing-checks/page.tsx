'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAccountSetStore, type AccountSet } from '@/stores/useAccountSetStore';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { usePrepaidExpenseStore } from '@/stores/usePrepaidExpenseStore';
import type { BankTransaction } from '@/types';
import { sqliteService } from '@/lib/database/sqlite-service';
import {
  buildMonthlyClosingSummary,
  createMonthlyCheckInstances,
  DEFAULT_MONTHLY_CLOSING_TEMPLATES,
  MONTHLY_CHECK_MODULE_LABELS,
  type MonthlyCheckManualStatus,
  type MonthlyCheckSeverity,
  type MonthlyCheckSystemStatus,
  type MonthlyClosingBankTransaction,
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

export default function MonthlyClosingChecksPage() {
  const router = useRouter();
  const { vouchers, initialize: initializeVouchers } = useVoucherStore();
  const { invoices, initialize: initializeInvoices } = useInvoiceStore();
  const { getCurrentAccountSet } = useAccountSetStore();
  const { overridesByAccountSet, ruleConfigsByAccountSet, setCheckOverride, clearCheckOverride, setRuleConfig } = useMonthlyClosingCheckStore();
  const assetCategories = useFixedAssetStore((state) => state.categories);
  const initializeFixedAssets = useFixedAssetStore((state) => state.initialize);
  const prepaidExpenses = usePrepaidExpenseStore((state) => state.expenses);
  const initializePrepaidExpenses = usePrepaidExpenseStore((state) => state.initialize);
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
        initializeFixedAssets(),
        initializePrepaidExpenses(),
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

  const periodOverrides = useMemo(
    () => (currentAccountSet?.id ? overridesByAccountSet[currentAccountSet.id]?.[periodInfo.period] || {} : {}),
    [currentAccountSet?.id, overridesByAccountSet, periodInfo.period],
  );
  const ruleConfigs = useMemo(
    () => (currentAccountSet?.id ? ruleConfigsByAccountSet[currentAccountSet.id] || {} : {}),
    [currentAccountSet?.id, ruleConfigsByAccountSet],
  );

  const enabledTemplates = useMemo(
    () => DEFAULT_MONTHLY_CLOSING_TEMPLATES.filter((template) => ruleConfigs[template.code]?.enabled !== false),
    [ruleConfigs],
  );

  const instances = useMemo(() => createMonthlyCheckInstances(periodInfo.period, enabledTemplates).map((instance) => {
    const override = periodOverrides[instance.code];
    const ruleConfig = ruleConfigs[instance.code];
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
    assetCategories,
    prepaidSubjectCodes: Array.from(new Set(prepaidExpenses.map((item) => item.prepaidSubjectCode).filter(Boolean))),
  }), [assetCategories, bankTransactions, instances, invoices, periodInfo.period, prepaidExpenses, vouchers]);

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
  const severityOptions = [
    { value: 'blocker', label: '阻塞' },
    { value: 'warning', label: '提醒' },
    { value: 'info', label: '信息' },
  ];

  const updateRuleConfig = (code: string, patch: Partial<{ enabled: boolean; severity: MonthlyCheckSeverity; blockClosing: boolean }>) => {
    if (!currentAccountSet?.id) return;
    setRuleConfig(currentAccountSet.id, code, patch);
  };

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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回智能做账
          </Button>
          <Button onClick={refreshChecks} disabled={loading} className="bg-slate-900 hover:bg-slate-800">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            执行月结检查
          </Button>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">检查规则配置</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="text-left py-3 pr-3 font-medium">启用</th>
                <th className="text-left py-3 pr-3 font-medium">检查项</th>
                <th className="text-left py-3 pr-3 font-medium">模块</th>
                <th className="text-left py-3 pr-3 font-medium">等级</th>
                <th className="text-left py-3 pr-3 font-medium">阻塞月结</th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_MONTHLY_CLOSING_TEMPLATES.map((template) => {
                const config = ruleConfigs[template.code] || {};
                const enabled = config.enabled !== false;
                const severity = config.severity || template.severity;
                const blockClosing = config.blockClosing ?? template.blockClosing;

                return (
                  <tr key={template.code} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => updateRuleConfig(template.code, { enabled: checked })}
                      />
                    </td>
                    <td className="py-3 pr-3 font-medium text-slate-900">{template.title}</td>
                    <td className="py-3 pr-3 text-slate-600">{MONTHLY_CHECK_MODULE_LABELS[template.module]}</td>
                    <td className="py-3 pr-3">
                      <SimpleSelect
                        value={severity}
                        onChange={(value) => updateRuleConfig(template.code, { severity: value as MonthlyCheckSeverity })}
                        options={severityOptions}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <Switch
                        checked={blockClosing}
                        onCheckedChange={(checked) => updateRuleConfig(template.code, { blockClosing: checked })}
                      />
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
    </div>
  );
}
