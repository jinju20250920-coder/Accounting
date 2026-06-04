'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Link as LinkIcon, Upload, PenLine, Settings, FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { AccountSelector } from '@/components/cash-console/account-selector';
import { CashOverview } from '@/components/cash-console/cash-overview';
import { JournalTable } from '@/components/cash-console/journal-table';
import { ManualEntryDialog } from '@/components/cash-console/manual-entry-dialog';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { sqliteService } from '@/lib/database';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useUserPreferenceStore } from '@/stores/useUserPreferenceStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';
import { parseBankStatement } from '@/lib/parser';
import { detectBank, getBestDetection } from '@/lib/bank-parsers/detector';
import { getAllConfigs } from '@/lib/bank-parsers/bank-registry';
import { matchBankTransaction } from '@/lib/accounting';
import { autoMatchBankSubjects } from '@/lib/bank-match';
import { getCurrentService } from '@/lib/database';
import { waitForDbInit } from '@/hooks/useDatabaseSync';
import { BankRulesDialog } from '@/components/bank-rules-dialog';
import { VoucherPreviewDialog, generateDefaultSummary } from '@/components/voucher-preview-dialog';
import type { PreviewEntry } from '@/components/voucher-preview-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { BankAccountSelector, getDefaultBankAccounts } from '@/components/bank-account-selector';
import type { BankStatementParseResult, BankTransaction } from '@/types';

export default function ImportPage() {
  const { showToast } = useToast();
  const subjects = useSubjectStore(s => s.subjects);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zone 1 state
  const [periodFrom, setPeriodFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodTo, setPeriodTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedAccountNumber, setSelectedAccountNumber] = useState('');
  const [selectedAccountCurrency, setSelectedAccountCurrency] = useState<string | undefined>();
  const [journalSelectedIds, setJournalSelectedIds] = useState<Set<string>>(new Set());

  const periodStart = `${periodFrom}-01`;
  const periodEnd = (() => {
    const [year, month] = periodTo.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${periodTo}-${String(lastDay).padStart(2, '0')}`;
  })();

  // Zone 2 state
  const [openingBalance, setOpeningBalance] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Voucher generation state
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [previewEntries, setPreviewEntries] = useState<any[]>([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Duplicate confirmation state
  const [pendingParseResult, setPendingParseResult] = useState<BankStatementParseResult | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const confirmingRef = useRef(false);

  // Account name mismatch confirmation state
  const [showAccountNameConfirm, setShowAccountNameConfirm] = useState(false);
  const [accountNameMismatch, setAccountNameMismatch] = useState<{ bankName: string; companyName: string } | null>(null);

  useEffect(() => {
    loadOpeningBalance();
  }, [selectedAccountNumber, periodFrom, periodTo, refreshKey]);

  const loadOpeningBalance = async () => {
    try {
      const result = await sqliteService.getCashOverview(selectedAccountNumber, periodStart, periodEnd);
      setOpeningBalance(result.openingBalance);
    } catch (e) {
      console.error('Failed to load opening balance', e);
    }
  };

  const handleAccountSelect = (id: string, accountNumber: string, currency?: string) => {
    setSelectedAccountId(id);
    setSelectedAccountNumber(accountNumber);
    setSelectedAccountCurrency(currency);
    setStatusFilter('');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!validTypes.includes(file.type)) {
      showToast('error', '请选择Excel或CSV文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', '文件大小不能超过10MB');
      return;
    }

    setIsImporting(true);
    try {
      await waitForDbInit();
      const service = getCurrentService();

      let bankId: string | undefined;
      try {
        const results = await detectBank(file, getAllConfigs());
        const best = getBestDetection(results);
        if (best) bankId = best.bankId;
      } catch {}

      const result: BankStatementParseResult = await parseBankStatement(file, bankId);

      if (result.transactions.length === 0) {
        showToast('error', '未找到有效的交易记录');
        setIsImporting(false);
        return;
      }

      // Check account name mismatch
      const bankAccountName = result.bankInfo.accountName?.trim();
      if (bankAccountName) {
        const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
        const companyName = accountSet?.name?.trim();
        if (companyName && bankAccountName !== companyName) {
          setAccountNameMismatch({ bankName: bankAccountName, companyName });
          setPendingParseResult(result);
          setShowAccountNameConfirm(true);
          setIsImporting(false);
          return;
        }
      }

      let dupCount = 0;
      for (const tx of result.transactions) {
        if (tx.date && tx.voucherNo && tx.transactionSerialNo) {
          const exists = await service.existsBankTransaction(tx.date, tx.voucherNo, tx.transactionSerialNo);
          if (exists) dupCount++;
        }
      }

      if (dupCount > 0) {
        setPendingParseResult(result);
        setDuplicateCount(dupCount);
        setShowDuplicateConfirm(true);
        return;
      }

      await doImport(result, 0);
      setIsImporting(false);
    } catch (e) {
      console.error('Import failed', e);
      showToast('error', `导入失败: ${(e as Error).message}`);
      setIsImporting(false);
    }
  };

  const doImport = async (result: BankStatementParseResult, skipCount: number) => {
    const service = getCurrentService();
    const batchId = `batch_${Date.now()}`;

    const bankAccountNumber = result.bankInfo.accountNumber || '';
    console.log('[doImport] start:', {
      accountSetId: sqliteService.accountSetId,
      totalTransactions: result.transactions.length,
      bankAccountNumber,
      bankInfo: result.bankInfo,
      skipCount,
    });
    const dedupedTransactions: BankTransaction[] = [];
    for (const tx of result.transactions) {
      if (tx.date && tx.voucherNo && tx.transactionSerialNo) {
        const exists = await service.existsBankTransaction(tx.date, tx.voucherNo, tx.transactionSerialNo);
        if (exists) continue;
      }
      dedupedTransactions.push({
        ...tx,
        ourAccount: tx.ourAccount || bankAccountNumber,
        ourAccountName: tx.ourAccountName || result.bankInfo.accountName || '',
        importBatchId: batchId,
        status: 'pending',
      });
    }

    if (dedupedTransactions.length === 0) {
      showToast('warning', '所有流水已存在，无需重复导入');
      return;
    }

    await service.saveBankTransactions(dedupedTransactions);

    // Auto-match/create bank sub-subjects for each ourAccount
    await autoMatchBankSubjects(dedupedTransactions);

    const { useBankRuleStore } = await import('@/stores/useBankRuleStore');
    const { usePartnerStore } = await import('@/stores/usePartnerStore');
    const bankRuleStore = useBankRuleStore.getState();
    if (bankRuleStore.rules.length === 0) await bankRuleStore.initialize();

    const bankRules = useBankRuleStore.getState().getEnabledRules().map(r => ({
      keyword: r.keyword, subjectCode: r.subjectCode, subjectName: r.subjectName, direction: r.direction, priority: r.priority,
    }));
    const userPrefsData = useUserPreferenceStore.getState().preferences.map(p => ({
      summary: p.summary, subject: p.subject, subjectName: p.subjectName, timestamp: p.timestamp || 0,
    }));
    const partners = usePartnerStore.getState().partners.map(p => ({
      name: p.name, defaultSubjectCode: p.defaultSubjectCode, defaultSubjectName: p.defaultSubjectName,
    }));

    let matchedCount = 0;
    for (const tx of dedupedTransactions) {
      const match = matchBankTransaction(
        { summary: tx.summary || '', notes: tx.notes || '', counterpartyName: tx.counterpartyName || undefined, isDebit: !!tx.debit },
        bankRules, partners, userPrefsData,
      );
      if (match) {
        await service.updateBankTransaction(tx.id, {
          matchedSubject: match.subjectCode, matchedSubjectName: match.subjectName, confidence: match.confidence, status: 'matched',
        });
        matchedCount++;
      }
    }

    const baseMsg = `导入 ${dedupedTransactions.length} 条流水`;
    const matchMsg = matchedCount > 0 ? `，自动匹配 ${matchedCount} 条` : '';
    if (skipCount > 0) {
      showToast('warning', `${baseMsg}${matchMsg}，跳过 ${skipCount} 条重复`);
    } else {
      showToast('success', `${baseMsg}${matchMsg}`);
    }

    // Auto-switch period range to cover imported transactions
    const dates = dedupedTransactions.map(tx => tx.date).filter(Boolean).sort();
    if (dates.length > 0) {
      const firstPeriod = dates[0].substring(0, 7);
      const lastPeriod = dates[dates.length - 1].substring(0, 7);
      if (firstPeriod < periodFrom) setPeriodFrom(firstPeriod);
      if (lastPeriod > periodTo) setPeriodTo(lastPeriod);
    }

    setRefreshKey(k => k + 1);
  };

  const handleConfirmDuplicateImport = async () => {
    const result = pendingParseResult;
    const skipCount = duplicateCount;
    confirmingRef.current = true;
    setShowDuplicateConfirm(false);
    setPendingParseResult(null);
    if (!result) return;
    setIsImporting(true);
    try {
      await doImport(result, skipCount);
    } catch (e) {
      console.error('Import failed', e);
      showToast('error', `导入失败: ${(e as Error).message}`);
    } finally {
      setIsImporting(false);
      confirmingRef.current = false;
    }
  };

  const handleCancelDuplicateImport = () => {
    setShowDuplicateConfirm(false);
    setPendingParseResult(null);
    setIsImporting(false);
  };

  const handleConfirmAccountNameImport = async () => {
    setShowAccountNameConfirm(false);
    setAccountNameMismatch(null);
    if (!pendingParseResult) return;
    setIsImporting(true);
    try {
      await doImport(pendingParseResult, 0);
    } catch (e) {
      console.error('Import failed', e);
      showToast('error', `导入失败: ${(e as Error).message}`);
    } finally {
      setIsImporting(false);
      setPendingParseResult(null);
    }
  };

  const handleCancelAccountNameImport = () => {
    setShowAccountNameConfirm(false);
    setAccountNameMismatch(null);
    setPendingParseResult(null);
    setIsImporting(false);
  };

  // Preview and generate vouchers
  const handleOpenPreview = async () => {
    const service = getCurrentService();
    const result = await sqliteService.getJournalEntries(selectedAccountNumber, periodStart, periodEnd, {
      statusFilter: 'matched',
      pageSize: 1000,
    });

    if (result.entries.length === 0) {
      showToast('error', '没有已匹配待入账的流水');
      return;
    }

    // Filter by selected rows if any
    const sourceEntries = journalSelectedIds.size > 0
      ? result.entries.filter((tx: any) => journalSelectedIds.has(tx.id))
      : result.entries;

    if (sourceEntries.length === 0) {
      showToast('warning', '选中的流水没有匹配的科目，请先匹配');
      return;
    }

    // Check accounting period
    const { usePeriodManagementStore } = await import('@/stores/usePeriodManagementStore');
    const currentPeriod = usePeriodManagementStore.getState().getCurrentPeriod();
    if (currentPeriod) {
      const periodMonth = `${currentPeriod.year}-${String(currentPeriod.month).padStart(2, '0')}`;
      const outOfPeriod = sourceEntries.filter((tx: any) => {
        const txMonth = tx.date?.substring(0, 7);
        return txMonth && txMonth !== periodMonth;
      });
      if (outOfPeriod.length > 0) {
        const inPeriodCount = sourceEntries.length - outOfPeriod.length;
        showToast('warning', `当前账期为 ${periodMonth}，有 ${outOfPeriod.length} 条流水不在账期内，仅入账 ${inPeriodCount} 条`);
      }
    }

    if (!selectedBankAccountId) {
      const bankAccounts = getDefaultBankAccounts();
      if (bankAccounts.length > 0) setSelectedBankAccountId(bankAccounts[0].id);
    }

    const bankAccounts = getDefaultBankAccounts();
    const bankAccount = bankAccounts.find(a => a.id === selectedBankAccountId);
    const bankSubjectCode = bankAccount?.subjectCode || '1002';
    const bankSubjectName = bankAccount?.name || '银行存款';

    const { usePartnerStore } = await import('@/stores/usePartnerStore');
    const existingPartners = usePartnerStore.getState().partners;

    const entries = sourceEntries.map((tx: any) => {
      const isDebit = !!tx.debit;
      const amount = tx.debit || tx.credit || 0;
      const willCreatePartner = !!(tx.counterpartyName &&
        !existingPartners.some((p: any) =>
          p.name === tx.counterpartyName || tx.counterpartyName.includes(p.name) || p.name.includes(tx.counterpartyName)
        ));
      const originalSummary = tx.summary || tx.notes || '银行交易';
      const counterpartSubjectName = tx.matchedSubjectName || '财务费用';

      return {
        transactionId: tx.id,
        date: tx.date,
        postingDate: tx.date,
        originalSummary,
        summary: generateDefaultSummary({ isDebit, counterpartyName: tx.counterpartyName, counterpartSubjectName, amount }),
        counterpartyName: tx.counterpartyName,
        counterpartyAccount: tx.counterpartyAccount,
        counterpartSubjectCode: tx.matchedSubject || '6603',
        counterpartSubjectName,
        bankSubjectCode,
        bankSubjectName,
        amount,
        isDebit,
        willCreatePartner,
      };
    });

    setPreviewEntries(entries);
    setShowPreviewDialog(true);
  };

  const handleGenerateVouchers = async (editedEntries: PreviewEntry[]) => {
    setIsGenerating(true);
    try {
      const service = getCurrentService();
      const { usePartnerStore } = await import('@/stores/usePartnerStore');
      const { useAccountSetStore } = await import('@/stores/useAccountSetStore');
      const { useSubjectStore } = await import('@/stores/useSubjectStore');

      const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const partnerTrackingMethod = currentAccountSet?.accounting?.partnerTrackingMethod || 'card';

      const createdPartnerNames = new Set<string>();
      const partnersToCreate = editedEntries.filter(e => e.willCreatePartner && e.counterpartyName);

      if (partnerTrackingMethod === 'card') {
        for (const entry of partnersToCreate) {
          if (!entry.counterpartyName || createdPartnerNames.has(entry.counterpartyName)) continue;
          try {
            const isCustomer = !entry.isDebit;
            const isSupplier = entry.isDebit;
            const prefix = isCustomer && isSupplier ? 'B' : isCustomer ? 'C' : 'V';
            const existingCodes = usePartnerStore.getState().partners.map(p => p.code);
            let seq = 1;
            while (existingCodes.includes(`${prefix}${String(seq).padStart(3, '0')}`)) seq++;
            const code = `${prefix}${String(seq).padStart(3, '0')}`;
            await usePartnerStore.getState().addPartner({
              code, name: entry.counterpartyName, isCustomer, isSupplier, isEmployee: false,
              defaultSubjectCode: isCustomer ? '1122' : '2202', defaultSubjectName: isCustomer ? '应收账款' : '应付账款',
              bankAccount: entry.counterpartyAccount || '', frozen: false,
            });
            createdPartnerNames.add(entry.counterpartyName);
          } catch (error) {
            console.error('自动创建往来单位失败:', entry.counterpartyName, error);
          }
        }
      }

      const now = new Date().toISOString();
      let successCount = 0;
      let errorCount = 0;
      const processedIds = new Set<string>();
      const allVouchers = await service.getAllVouchers();
      const seqByMonth: Record<string, number> = {};

      for (const pe of editedEntries) {
        try {
          const isDebit = pe.isDebit;
          const amount = pe.amount;
          const voucherId = `voucher_${Date.now()}_${pe.transactionId}`;
          const postingDate = pe.postingDate || pe.date;
          const yearMonth = postingDate.substring(0, 7).replace('-', '');

          if (!seqByMonth[yearMonth]) {
            let maxSeq = 0;
            for (const v of allVouchers) {
              if (v.voucherNo?.startsWith(`记-${yearMonth}-`)) {
                const m = v.voucherNo.match(/-(\d{3})$/);
                if (m) { const s = parseInt(m[1], 10); if (s > maxSeq) maxSeq = s; }
              }
            }
            seqByMonth[yearMonth] = maxSeq;
          }
          seqByMonth[yearMonth]++;
          const voucherNo = `记-${yearMonth}-${String(seqByMonth[yearMonth]).padStart(3, '0')}`;

          let counterpartSubjectCode = pe.counterpartSubjectCode;
          let counterpartSubjectName = pe.counterpartSubjectName;
          let customerName = pe.counterpartyName;
          let supplierName = pe.counterpartyName;

          if (partnerTrackingMethod === 'subject' && (counterpartSubjectCode.startsWith('2202') || counterpartSubjectCode.startsWith('1122'))) {
            const partnerSubjectPrefix = isDebit ? '2202' : '1122';
            const partnerCode = pe.counterpartyName?.replace(/\s+/g, '').substring(0, 4) || '0001';
            counterpartSubjectCode = `${partnerSubjectPrefix}.${partnerCode}`;
            counterpartSubjectName = `${pe.counterpartSubjectName}-${pe.counterpartyName}`;
            const existingSubject = useSubjectStore.getState().subjects.find(s => s.code === counterpartSubjectCode);
            if (!existingSubject) {
              await useSubjectStore.getState().addSubject({
                code: counterpartSubjectCode, name: counterpartSubjectName,
                parentId: useSubjectStore.getState().subjects.find(s => s.code === partnerSubjectPrefix)?.id || null,
                level: 3, direction: counterpartSubjectCode.startsWith('1') ? 'debit' : 'credit' as const,
                enableDept: false, enableProject: false, enableForeign: false,
                isCustomer: !isDebit, isSupplier: isDebit, isEmployee: false, enableCashFlow: false,
                disabled: false, block: false,
              } as any);
            }
            customerName = '';
            supplierName = '';
          }

          const tx = await service.getBankTransaction(pe.transactionId);
          const entries = [
            {
              id: `entry_${voucherId}_0`, voucherId, date: postingDate, summary: pe.summary,
              subjectCode: counterpartSubjectCode, subjectName: counterpartSubjectName,
              debit: isDebit ? amount : 0, credit: isDebit ? 0 : amount,
              customerName, supplierName, auxiliary: {},
              docNo: `${tx?.voucherNo || ''}-${tx?.transactionSerialNo || ''}`,
            },
            {
              id: `entry_${voucherId}_1`, voucherId, date: postingDate, summary: pe.summary,
              subjectCode: pe.bankSubjectCode, subjectName: pe.bankSubjectName,
              debit: isDebit ? 0 : amount, credit: isDebit ? amount : 0,
            },
          ];

          await service.saveVoucher({
            id: voucherId, voucherNo, date: postingDate, summary: pe.summary,
            entries, status: 'posted', voucherType: isDebit ? 'payment' as const : 'receipt' as const,
            createdBy: 'system', createTime: now, updateTime: now,
          });

          await service.updateBankTransaction(pe.transactionId, {
            status: 'voucher_generated', voucherId, generatedVoucherNo: voucherNo,
          });

          processedIds.add(pe.transactionId);
          successCount++;
        } catch (error) {
          console.error('生成凭证失败:', pe.transactionId, error);
          errorCount++;
        }
      }

      setShowPreviewDialog(false);
      setRefreshKey(k => k + 1);

      const messages: string[] = [];
      if (successCount > 0) messages.push(`生成 ${successCount} 张凭证`);
      if (createdPartnerNames.size > 0) messages.push(`新建 ${createdPartnerNames.size} 个往来单位`);
      if (errorCount > 0) messages.push(`${errorCount} 条失败`);

      if (successCount > 0) {
        showToast('success', messages.join('，'));
      } else {
        showToast('error', messages.join('，') || '生成凭证失败');
      }

      const { useVoucherStore } = await import('@/stores');
      await useVoucherStore.getState().initialize();
    } catch (error) {
      console.error('Generate vouchers error:', error);
      showToast('error', '生成凭证失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // Clear pending transactions
  const handleClearTransactions = async () => {
    try {
      const service = getCurrentService();
      await service.clearBankTransactions();
      setRefreshKey(k => k + 1);
      showToast('success', '已清空未入账流水');
    } catch (error) {
      console.error('清空流水失败:', error);
      showToast('error', '清空流水失败');
    }
  };

  const handleManualSaved = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Zone 1: Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">资金管理控制台</h1>
        </div>
        <Link
          href="/fund-hub"
          className="text-sm text-slate-500 hover:text-blue-600 hover:underline flex items-center gap-1"
        >
          结算看板 <LinkIcon className="h-3 w-3" />
        </Link>
      </div>

      {/* Zone 2: Cash Overview */}
      <div className="mb-5">
        <CashOverview
          accountNumber={selectedAccountNumber}
          periodStart={periodStart}
          periodEnd={periodEnd}
          refreshKey={refreshKey}
        />
      </div>

      {/* Zone 3: Toolbar - period + account + actions (below card) */}
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-slate-500">期间</Label>
          <ChineseMonthPicker
            value={periodFrom}
            onChange={setPeriodFrom}
          />
          <span className="text-xs text-slate-400">~</span>
          <ChineseMonthPicker
            value={periodTo}
            onChange={setPeriodTo}
          />
        </div>
        <AccountSelector
          selectedAccountId={selectedAccountId}
          onSelectAccount={handleAccountSelect}
        />
        <div className="h-6 w-px bg-slate-200" />
        <Button onClick={handleImportClick} disabled={isImporting} className="gap-2">
          {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isImporting ? '导入中...' : '导入流水'}
        </Button>
        <Button variant="outline" onClick={() => setShowManualDialog(true)} className="gap-2">
          <PenLine className="h-4 w-4" />
          手动记一笔
        </Button>
        <Button variant="outline" onClick={() => setShowRulesDialog(true)} className="gap-2">
          <Settings className="h-4 w-4" />
          匹配规则
        </Button>
        <Button
          onClick={handleOpenPreview}
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {isGenerating ? '生成中...' : journalSelectedIds.size > 0 ? `预览并生成 (${journalSelectedIds.size})` : '预览并生成全部'}
        </Button>
        <Button variant="outline" onClick={handleClearTransactions} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
          清空未入账流水
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Zone 4: Journal Table */}
      <JournalTable
        accountNumber={selectedAccountNumber}
        periodStart={periodStart}
        periodEnd={periodEnd}
        openingBalance={openingBalance}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        refreshKey={refreshKey}
        onRefresh={() => setRefreshKey(k => k + 1)}
        onSelectionChange={setJournalSelectedIds}
      />

      {/* Manual Entry Dialog */}
      <ManualEntryDialog
        open={showManualDialog}
        onOpenChange={setShowManualDialog}
        accountNumber={selectedAccountNumber}
        period={periodTo}
        onSaved={handleManualSaved}
        defaultCurrency={selectedAccountCurrency}
        isAllAccounts={selectedAccountId === 'all-accounts'}
      />

      {/* Bank Rules Dialog */}
      <BankRulesDialog open={showRulesDialog} onOpenChange={setShowRulesDialog} />

      {/* Voucher Preview Dialog */}
      <VoucherPreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        entries={previewEntries}
        onConfirm={handleGenerateVouchers}
        isProcessing={isGenerating}
      />

      {/* Duplicate Import Confirmation Dialog */}
      <Dialog open={showDuplicateConfirm} onOpenChange={(open) => { if (!open && !confirmingRef.current) handleCancelDuplicateImport(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发现重复流水</DialogTitle>
            <DialogDescription>
              本次导入中有 {duplicateCount} 条流水已存在于数据库中。
              继续导入将自动跳过这些重复记录，仅导入新记录。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDuplicateImport}>
              取消导入
            </Button>
            <Button onClick={handleConfirmDuplicateImport}>
              继续导入（跳过重复）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Name Mismatch Confirmation Dialog */}
      <Dialog open={showAccountNameConfirm} onOpenChange={(open) => { if (!open) handleCancelAccountNameImport(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>银行账户名称不匹配</DialogTitle>
            <DialogDescription>
              导入文件的银行账户名称为「{accountNameMismatch?.bankName}」，
              当前账套公司名称为「{accountNameMismatch?.companyName}」，
              两者不一致。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelAccountNameImport}>
              取消导入
            </Button>
            <Button onClick={handleConfirmAccountNameImport}>
              继续导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}