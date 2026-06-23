'use client';

import { useState, useEffect } from 'react';
import { sqliteService } from '@/lib/database';
import { formatMoney } from '@/lib/accounting';
import { TrendingUp, TrendingDown, Wallet, Scale, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { waitForDbInit } from '@/hooks/useDatabaseSync';

interface CashOverviewProps {
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  refreshKey?: number;
}

interface OverviewData {
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  lastBankBalance: number | null;
  computedOpening?: number;
  manualOpening?: number | null;
}

export function CashOverview({ accountNumber, periodStart, periodEnd, refreshKey }: CashOverviewProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadOverview();
  }, [accountNumber, periodStart, periodEnd, refreshKey]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      // Wait for DatabaseSyncWrapper to finish initializing and set the real
      // accountSetId. Without this, the first render queries with the
      // placeholder 'default' accountSetId and returns 0 for everything.
      await waitForDbInit();

      const result = await sqliteService.getCashOverview(accountNumber, periodStart, periodEnd);

      let manualOpening: number | null = null;
      if (accountNumber) {
        manualOpening = await sqliteService.getBankOpeningBalance(accountNumber, periodStart);
      }

      // Diagnostic: surface the underlying query parameters and result so the
      // user can verify why cards show 0 in devtools when balances look empty.
      const bindings = await sqliteService.getBankAccountBindings();
      console.info('[CashOverview]', {
        accountSetId: sqliteService.accountSetId,
        accountNumber,
        periodStart,
        periodEnd,
        result,
        bindingsCount: bindings.length,
        bindings,
      });

      setData({
        ...result,
        manualOpening,
      });
    } catch (e) {
      console.error('Failed to load cash overview', e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditOpening = () => {
    if (!data) return;
    setEditAmount(String(data.openingBalance));
    setEditOpen(true);
  };

  const handleSaveOpening = async () => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount)) {
      showToast('error', '请输入有效金额');
      return;
    }

    if (!accountNumber) {
      showToast('warning', '请先选择一个银行账户');
      return;
    }

    setSaving(true);
    try {
      await sqliteService.saveBankOpeningBalance({
        accountNumber,
        periodStart,
        balance: amount,
      });
      showToast('success', '期初余额已更新');
      setEditOpen(false);
      await loadOverview();
    } catch (e) {
      console.error('Failed to save opening balance', e);
      showToast('error', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => formatMoney(n);

  // Reconciliation diff only makes sense for a specific bank account —
  // comparing aggregated balance against one bank's last balance is misleading.
  const reconciliationDiff = (accountNumber && data?.lastBankBalance != null)
    ? Math.round((data.closingBalance - data.lastBankBalance) * 100) / 100
    : null;

  const isReconciled = reconciliationDiff !== null && Math.abs(reconciliationDiff) < 0.01;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
            <div className="h-4 w-20 bg-slate-100 rounded mb-2" />
            <div className="h-8 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const isAllAccounts = !accountNumber;
  const scopeLabel = isAllAccounts ? '全部账户合计' : '当前账户';
  const periodLabel = periodStart.substring(0, 7) === periodEnd.substring(0, 7)
    ? `${periodStart.substring(0, 7)} 期间`
    : `${periodStart.substring(0, 7)} ~ ${periodEnd.substring(0, 7)}`;

  const cards = [
    {
      label: '期初余额',
      value: fmt(data.openingBalance),
      icon: Wallet,
      color: 'text-slate-800',
      editable: true,
      isManual: data.manualOpening !== null,
    },
    {
      label: '本期收入',
      value: `+${fmt(data.totalCredit)}`,
      icon: TrendingUp,
      color: 'text-green-600',
    },
    {
      label: '本期支出',
      value: `-${fmt(data.totalDebit)}`,
      icon: TrendingDown,
      color: 'text-red-600',
    },
    {
      label: '当前余额',
      value: fmt(data.closingBalance),
      icon: Scale,
      color: 'text-blue-600',
      recon: true,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${isAllAccounts ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
            {scopeLabel}
          </span>
          <span className="text-xs text-slate-400">{periodLabel}</span>
        </div>
        {isAllAccounts && (
          <span className="text-[11px] text-slate-400">汇总所有银行账户 + 现金日记账</span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-500">{card.label}</span>
              <card.icon className="h-4 w-4 text-slate-300" />
            </div>
            <div className={`text-2xl font-bold ${card.color} flex items-center gap-2`}>
              <span>{card.value}</span>
              {card.editable && accountNumber && (
                <button
                  onClick={handleEditOpening}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100"
                  title="编辑期初余额"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-blue-500" />
                </button>
              )}
            </div>
            {card.editable && card.isManual && (
              <span className="text-[10px] text-blue-500 mt-0.5 block">手动录入</span>
            )}
            {card.recon && reconciliationDiff !== null && (
              <div className={`mt-2 text-xs flex items-center gap-1 ${isReconciled ? 'text-green-600' : 'text-amber-600'}`}>
                {isReconciled ? (
                  <><Scale className="h-3 w-3" /> 与银行对账: 平</>
                ) : (
                  <><Scale className="h-3 w-3" /> 差 {fmt(Math.abs(reconciliationDiff))}</>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑期初余额</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-slate-500">
              账户: <span className="font-medium text-slate-700">{accountNumber}</span> | 期间起始: <span className="font-medium text-slate-700">{periodStart}</span>
            </div>
            <div className="space-y-2">
              <Label required>期初余额</Label>
              <Input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                autoComplete="off"
              />
            </div>
            <div className="p-2 bg-slate-50 rounded text-xs text-slate-500">
              <p>直接录入金额，不自动生成凭证。</p>
              <p>系统将以录入值作为此账户在此期间的期初余额，覆盖自动计算值。</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSaveOpening} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
