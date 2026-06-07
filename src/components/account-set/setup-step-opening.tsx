'use client';

/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Upload,
  Download,
  Users,
  Landmark,
  Building2,
  FileText,
} from 'lucide-react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useToast } from '@/components/ui/toast';
import { importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { SubjectPopover } from '@/components/shared/subject-popover';
import {
  analyzeOpeningBalance,
  buildOpeningAdjustmentEntry,
  buildPartnerOpeningEntriesFromPartners,
  hasSubledgerSourceForSubject,
} from '@/lib/opening-balance-rules';
import type { VoucherEntry } from '@/types';
import { MonthlyClosingWizard } from './monthly-closing-wizard';

// ==================== Types ====================

interface OpeningEntry {
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
}

interface PartnerOpeningEntry {
  name: string;
  type: 'receivable' | 'payable';
  amount: number;
  remark: string;
}

interface BankBalanceEntry {
  accountNumber: string;
  bankName: string;
  balance: number;
}

interface AssetBalanceEntry {
  assetCode: string;
  assetName: string;
  originalValue: number;
  accumulatedDepreciation: number;
  netValue: number;
  included: boolean;
}

interface BankBindingForOpening {
  accountNumber?: string;
  bankName?: string;
  aliasName?: string;
  subjectCode?: string;
}

interface AccountingConfig {
  partnerTrackingMethod?: 'card' | 'subject';
  bankTrackingMethod?: 'card' | 'subject';
  assetTrackingMethod?: 'card' | 'subject';
}

interface SetupStepOpeningProps {
  accountSetId: string;
  onBalancedChange: (balanced: boolean) => void;
  accounting?: AccountingConfig;
}

// ==================== Import Headers ====================

const SUBJECT_IMPORT_HEADERS = [
  { key: 'subjectCode' as const, label: '科目代码', required: true },
  { key: 'subjectName' as const, label: '科目名称', required: false },
  { key: 'debit' as const, label: '借方金额', required: false },
  { key: 'credit' as const, label: '贷方金额', required: false },
];

const PARTNER_OPENING_HEADERS = [
  { key: 'name' as const, label: '往来单位名称', required: true },
  { key: 'type' as const, label: '类型(应收/应付)', required: true },
  { key: 'amount' as const, label: '金额', required: true },
  { key: 'remark' as const, label: '备注', required: false },
];

// ==================== Component ====================

export function SetupStepOpening({ accountSetId, onBalancedChange, accounting }: SetupStepOpeningProps) {
  const { showToast } = useToast();
  const subjects = useSubjectStore(s => s.subjects);
  const partners = usePartnerStore(s => s.partners);
  const initializePartners = usePartnerStore(s => s.initializePartners);

  // Tab 1: 科目余额
  const [entries, setEntries] = useState<OpeningEntry[]>([]);
  // Tab 2: 往来明细 (balances only — partner cards created in previous step)
  const [partnerEntries, setPartnerEntries] = useState<PartnerOpeningEntry[]>([]);
  // Tab 3: 银行余额 (balances only — bank accounts created in previous step)
  const [bankEntries, setBankEntries] = useState<BankBalanceEntry[]>([]);
  // Tab 4: 固定资产余额 (reads from asset cards created in previous step)
  const [assetEntries, setAssetEntries] = useState<AssetBalanceEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('subject');
  const [saved, setSaved] = useState(false);
  const [showClosingWizard, setShowClosingWizard] = useState(false);
  const [adjustmentSubject, setAdjustmentSubject] = useState({ code: '', name: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<string>('subject');

  useEffect(() => {
    if (sqliteService.accountSetId !== accountSetId) {
      sqliteService.setAccountSetId(accountSetId);
    }
  }, [accountSetId]);

  const fixedAssets = useFixedAssetStore(s => s.assets);

  useEffect(() => {
    initializePartners();
  }, [initializePartners]);

  useEffect(() => {
    setPartnerEntries(prev => {
      if (prev.length > 0) return prev;
      return buildPartnerOpeningEntriesFromPartners(partners);
    });
  }, [partners]);

  // Load bank accounts from previous step
  useEffect(() => {
    const loadBankAccounts = async () => {
      try {
        const bindings = await sqliteService.getBankAccountBindings();
        if (bindings && bindings.length > 0) {
          setBankEntries((bindings as BankBindingForOpening[]).map((b) => ({
            accountNumber: b.accountNumber || '',
            bankName: b.bankName || b.aliasName || '',
            balance: 0,
          })));
        }
      } catch { /* Bank accounts may not exist yet */ }
    };
    loadBankAccounts();
  }, []);

  // Load fixed asset cards from previous step
  useEffect(() => {
    if (fixedAssets.length > 0) {
      setAssetEntries(fixedAssets.map(a => ({
        assetCode: a.assetCode,
        assetName: a.assetName,
        originalValue: a.originalValue,
        accumulatedDepreciation: a.accumulatedDepreciation,
        netValue: a.netValue,
        included: true,
      })));
    }
  }, [fixedAssets]);

  const validSubjects = useMemo(() => subjects.filter(s => !s.disabled && !s.block), [subjects]);

  // Balance check
  const openingAnalysis = useMemo(() => analyzeOpeningBalance({
    subjectEntries: entries,
    partnerEntries,
    bankEntries,
    assetEntries,
  }), [entries, partnerEntries, bankEntries, assetEntries]);
  const totalDebit = openingAnalysis.totalDebit;
  const totalCredit = openingAnalysis.totalCredit;
  const diff = openingAnalysis.balanceDifference;
  const isBalanced = openingAnalysis.isBalanced;
  const canBalanceWithAdjustment = !isBalanced && Boolean(adjustmentSubject.code);
  const canSaveOpening = isBalanced || canBalanceWithAdjustment;
  const subledgerDifferences = openingAnalysis.subledgerDifferences;

  const balancedRef = React.useRef(onBalancedChange);
  balancedRef.current = onBalancedChange;
  useEffect(() => { balancedRef.current(canSaveOpening); }, [canSaveOpening]);

  // Get the opening period for monthly closing
  const openingPeriod = useMemo(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (!accountSet?.enableDate) return null;
    const [year, month] = accountSet.enableDate.split('-').map(Number);
    const period = (accountSet.accountingPeriods || []).find(
      (p: { year: number; month: number }) => p.year === year && p.month === month
    );
    return period || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]); // recalculate after save since periods may change

  // Tab visibility — default to 'card'
  const showPartnerTab = (accounting?.partnerTrackingMethod ?? 'card') === 'card';
  const showBankTab = (accounting?.bankTrackingMethod ?? 'card') === 'card';
  const showAssetTab = (accounting?.assetTrackingMethod ?? 'card') === 'card';

  // ==================== Asset Balance Handlers ====================

  const toggleAssetIncluded = useCallback((index: number) => {
    setAssetEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], included: !next[index].included };
      return next;
    });
  }, []);

  // ==================== Subject Tab Handlers ====================

  const addEntry = useCallback(() => {
    setEntries(prev => [...prev, { subjectCode: '', subjectName: '', debit: 0, credit: 0 }]);
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubjectSelect = useCallback((index: number, code: string, name: string) => {
    setEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], subjectCode: code, subjectName: name };
      return next;
    });
  }, []);

  const updateEntry = useCallback((index: number, field: 'debit' | 'credit', value: number) => {
    setEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  // ==================== Partner Opening Handlers ====================

  const addPartnerEntry = useCallback(() => {
    setPartnerEntries(prev => [...prev, { name: '', type: 'receivable', amount: 0, remark: '' }]);
  }, []);

  const removePartnerEntry = useCallback((index: number) => {
    setPartnerEntries(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updatePartnerEntry = useCallback((index: number, field: keyof PartnerOpeningEntry, value: PartnerOpeningEntry[keyof PartnerOpeningEntry]) => {
    setPartnerEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  // ==================== Bank Balance Handlers ====================

  const updateBankBalance = useCallback((index: number, balance: number) => {
    setBankEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], balance };
      return next;
    });
  }, []);

  // ==================== Excel Import/Export ====================

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (importTarget === 'subject') await handleSubjectImport(file);
      else if (importTarget === 'partner-opening') await handlePartnerOpeningImport(file);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToast('error', `导入失败：${message}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubjectImport = async (file: File) => {
    const rawData = await importFromExcel<OpeningEntry>(file, SUBJECT_IMPORT_HEADERS);
    let imported = 0, skipped = 0;
    const newEntries: OpeningEntry[] = [];

    for (const row of rawData) {
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;
      if (!row.subjectCode) { skipped++; continue; }
      const code = String(row.subjectCode).trim();
      const subject = validSubjects.find(s => s.code === code);
      if (!subject || (debit === 0 && credit === 0)) { skipped++; continue; }
      newEntries.push({ subjectCode: subject.code, subjectName: subject.name, debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100 });
      imported++;
    }

    if (newEntries.length > 0) setEntries(prev => [...prev, ...newEntries]);
    if (skipped > 0) showToast('warning', `导入 ${imported} 条，跳过 ${skipped} 条`);
    else if (imported > 0) showToast('success', `成功导入 ${imported} 条`);
    else showToast('warning', '未找到有效数据');
  };

  const handlePartnerOpeningImport = async (file: File) => {
    const rawData = await importFromExcel<PartnerOpeningEntry>(file, PARTNER_OPENING_HEADERS);
    let imported = 0, skipped = 0;
    const newEntries: PartnerOpeningEntry[] = [];

    for (const row of rawData) {
      if (!row.name || !row.amount) { skipped++; continue; }
      const type = String(row.type).trim().includes('应付') ? 'payable' : 'receivable';
      newEntries.push({ name: String(row.name).trim(), type, amount: Math.round(Number(row.amount) * 100) / 100, remark: String(row.remark || '').trim() });
      imported++;
    }

    if (newEntries.length > 0) setPartnerEntries(prev => [...prev, ...newEntries]);
    if (skipped > 0) showToast('warning', `导入 ${imported} 条，跳过 ${skipped} 条`);
    else showToast(imported > 0 ? 'success' : 'warning', imported > 0 ? `成功导入 ${imported} 条` : '未找到有效数据');
  };

  const handleDownloadTemplate = () => {
    if (importTarget === 'subject') {
      exportTemplate<OpeningEntry>('期初余额导入模板', { subjectCode: '1001', subjectName: '库存现金', debit: 10000, credit: 0 }, SUBJECT_IMPORT_HEADERS);
    } else if (importTarget === 'partner-opening') {
      exportTemplate<PartnerOpeningEntry>('往来明细导入模板', { name: '示例客户', type: 'receivable', amount: 5000, remark: '' }, PARTNER_OPENING_HEADERS);
    }
  };

  const triggerImport = (target: string) => {
    setImportTarget(target);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  // ==================== Summary Stats ====================

  const partnerTotalReceivable = partnerEntries.filter(e => e.type === 'receivable').reduce((s, e) => s + e.amount, 0);
  const partnerTotalPayable = partnerEntries.filter(e => e.type === 'payable').reduce((s, e) => s + e.amount, 0);
  const bankTotalBalance = bankEntries.reduce((s, e) => s + e.balance, 0);
  const assetTotalOriginal = assetEntries.filter(e => e.included).reduce((s, e) => s + e.originalValue, 0);
  const assetTotalDep = assetEntries.filter(e => e.included).reduce((s, e) => s + e.accumulatedDepreciation, 0);
  const hasAnyData = entries.length > 0 || partnerEntries.length > 0 || bankEntries.some(b => b.balance !== 0) || assetEntries.some(a => a.included);

  // ==================== Unified Save ====================

  const handleSave = async () => {
    if (!canSaveOpening && entries.length > 0) {
      showToast('error', '期初余额不平衡，借方合计必须等于贷方合计');
      return;
    }

    setLoading(true);
    try {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const voucherDate = accountSet?.enableDate ? `${accountSet.enableDate}-01` : new Date().toISOString().substring(0, 10);
      const now = new Date().toISOString();
      const allEntries: VoucherEntry[] = [];

      // 1. Subject balance entries
      const validEntries = entries.filter(e => e.subjectCode && (e.debit > 0 || e.credit > 0));
      const subjectEntriesForVoucher = validEntries.filter(e => !hasSubledgerSourceForSubject(e.subjectCode, {
        partnerEntries,
        bankEntries,
        assetEntries,
      }));
      for (const e of subjectEntriesForVoucher) {
        allEntries.push({
          id: `oe_s_${Date.now()}_${allEntries.length}`, voucherId: '',
          date: voucherDate, summary: '期初余额',
          subjectCode: e.subjectCode, subjectName: e.subjectName,
          debit: e.debit || 0, credit: e.credit || 0,
        });
      }

      // 2. Partner opening balances → 1122/2202 entries (partner cards already exist)
      const validPartnerEntries = partnerEntries.filter(e => e.name && e.amount > 0);
      for (const e of validPartnerEntries) {
        if (e.type === 'receivable') {
          allEntries.push({
            id: `oe_p_${Date.now()}_${allEntries.length}`, voucherId: '',
            date: voucherDate, summary: `期初应收-${e.name}`,
            subjectCode: '1122', subjectName: '应收账款', debit: e.amount, credit: 0,
            auxiliary: { customer: e.name },
          });
        } else {
          allEntries.push({
            id: `oe_p_${Date.now()}_${allEntries.length}`, voucherId: '',
            date: voucherDate, summary: `期初应付-${e.name}`,
            subjectCode: '2202', subjectName: '应付账款', debit: 0, credit: e.amount,
            auxiliary: { supplier: e.name },
          });
        }
      }

      // 3. Bank balances → 1002 entries (bank accounts already exist)
      const validBankEntries = bankEntries.filter(e => e.accountNumber && e.balance !== 0);
      for (const e of validBankEntries) {
        allEntries.push({
          id: `oe_b_${Date.now()}_${allEntries.length}`, voucherId: '',
          date: voucherDate, summary: `期初银行-${e.bankName || e.accountNumber}`,
          subjectCode: '1002', subjectName: '银行存款',
          debit: Math.max(e.balance, 0), credit: Math.max(-e.balance, 0),
        });

        try {
          await sqliteService.saveBankOpeningBalance({
            accountNumber: e.accountNumber,
            periodStart: voucherDate.substring(0, 7),
            balance: e.balance,
            createdBy: 'system',
          });
        } catch (err) { console.warn('Bank opening balance save failed:', err); }
      }

      // 4. Bridge: bank subject entries from subject tab → bank_opening_balances
      const bankSubjectEntries = validEntries.filter(e => e.subjectCode.startsWith('1002'));
      if (bankSubjectEntries.length > 0) {
        try {
          const bindings = await sqliteService.getBankAccountBindings();
          for (const entry of bankSubjectEntries) {
            const binding = (bindings as BankBindingForOpening[]).find((b) => b.subjectCode === entry.subjectCode);
            if (binding?.accountNumber) {
              await sqliteService.saveBankOpeningBalance({
                accountNumber: binding.accountNumber,
                periodStart: voucherDate.substring(0, 7),
                balance: (entry.debit || 0) - (entry.credit || 0),
                createdBy: 'system',
              });
            }
          }
        } catch (err) { console.warn('Bank bridge failed:', err); }
      }

      // 5. Fixed asset balances → 1601/1602 entries (asset cards already exist)
      const includedAssets = assetEntries.filter(e => e.included);
      for (const e of includedAssets) {
        // 1601 借方（原值）
        allEntries.push({
          id: `oe_a_${Date.now()}_${allEntries.length}`, voucherId: '',
          date: voucherDate, summary: `期初资产-${e.assetName}`,
          subjectCode: '1601', subjectName: '固定资产',
          debit: e.originalValue, credit: 0,
        });
        // 1602 贷方（累计折旧）
        if (e.accumulatedDepreciation > 0) {
          allEntries.push({
            id: `oe_ad_${Date.now()}_${allEntries.length}`, voucherId: '',
            date: voucherDate, summary: `期初累计折旧-${e.assetName}`,
            subjectCode: '1602', subjectName: '累计折旧',
            debit: 0, credit: e.accumulatedDepreciation,
          });
        }
      }

      if (!isBalanced && adjustmentSubject.code) {
        const adjustmentEntry = buildOpeningAdjustmentEntry({
          subjectCode: adjustmentSubject.code,
          subjectName: adjustmentSubject.name,
          analysis: openingAnalysis,
          id: `oe_adj_${Date.now()}_${allEntries.length}`,
          date: voucherDate,
        });
        if (adjustmentEntry) {
          allEntries.push(adjustmentEntry);
        }
      }

      // Save unified voucher
      if (allEntries.length > 0) {
        const voucherId = `opening_${Date.now()}`;
        for (const entry of allEntries) entry.voucherId = voucherId;

        await sqliteService.saveVoucher({
          id: voucherId, voucherNo: '记-期初-0001', date: voucherDate,
          status: 'posted', voucherType: 'general', summary: '期初余额',
          createdBy: 'system', createTime: now, updateTime: now,
          entries: allEntries,
        });
      }

      const totalItems = subjectEntriesForVoucher.length + validPartnerEntries.length + validBankEntries.length + includedAssets.length + (!isBalanced && adjustmentSubject.code ? 1 : 0);
      setSaved(true);
      showToast('success', `期初数据已保存，共 ${totalItems} 条`);
    } catch (error) {
      console.error('Save opening balance failed:', error);
      showToast('error', '保存期初数据失败');
    } finally {
      setLoading(false);
    }
  };

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">期初余额录入</h2>
        <p className="text-sm text-slate-500 mt-1">
          录入各科目的期初余额。往来卡片和固定资产卡片已在前面步骤中录入
        </p>
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="w-full justify-start gap-0 border-b">
          <TabsTrigger value="subject" className="gap-1">
            <FileText className="h-3.5 w-3.5" /> 科目余额
          </TabsTrigger>
          {showPartnerTab && (
            <TabsTrigger value="partner-opening" className="gap-1">
              <Users className="h-3.5 w-3.5" /> 往来余额
            </TabsTrigger>
          )}
          {showBankTab && (
            <TabsTrigger value="bank" className="gap-1">
              <Landmark className="h-3.5 w-3.5" /> 银行余额
            </TabsTrigger>
          )}
          {showAssetTab && (
            <TabsTrigger value="asset" className="gap-1">
              <Building2 className="h-3.5 w-3.5" /> 固定资产
            </TabsTrigger>
          )}
        </TabsList>

        {/* ========== Tab 1: 科目余额 ========== */}
        <TabsContent value="subject" className="space-y-4 mt-4">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
            <div className="flex-1 text-center">
              <p className="text-sm text-slate-500">借方合计</p>
              <p className="text-lg font-semibold">{totalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-2xl text-slate-300">=</div>
            <div className="flex-1 text-center">
              <p className="text-sm text-slate-500">贷方合计</p>
              <p className="text-lg font-semibold">{totalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="ml-4">
              {entries.length === 0 ? (
                <Badge variant="outline" className="bg-slate-100">未录入</Badge>
              ) : isBalanced ? (
                <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> 平衡</Badge>
              ) : (
                <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> 差额 {diff.toFixed(2)}</Badge>
              )}
            </div>
          </div>

          {!isBalanced && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">期初借贷不平，差额 {diff.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                  <div className="text-amber-700">如确认用期初调整承接，请明确选择补平科目；系统不会静默自动补平。</div>
                </div>
              </div>
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <span className="text-sm font-medium text-slate-700">补平科目</span>
                <SubjectPopover
                  value={adjustmentSubject.code}
                  onSelect={(code, name) => setAdjustmentSubject({ code, name })}
                  placeholder="选择期初平衡调整科目"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => triggerImport('subject')}>
              <Upload className="h-4 w-4 mr-1" /> 导入Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setImportTarget('subject'); handleDownloadTemplate(); }}>
              <Download className="h-4 w-4 mr-1" /> 下载模板
            </Button>
            {entries.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setEntries([])} className="text-red-500 hover:text-red-700 ml-auto">
                <Trash2 className="h-4 w-4 mr-1" /> 清空
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 w-48">科目</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-36">借方金额</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-36">贷方金额</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index} className="border-t hover:bg-slate-50">
                    <td className="px-2 py-1">
                      <SubjectPopover value={entry.subjectCode} onSelect={(code, name) => handleSubjectSelect(index, code, name)} placeholder="选择科目" />
                    </td>
                    <td className="px-3 py-1">
                      <Input type="number" value={entry.debit || ''} onChange={(e) => updateEntry(index, 'debit', parseFloat(e.target.value) || 0)} className="h-8 text-sm text-right" placeholder="0.00" autoComplete="off" />
                    </td>
                    <td className="px-3 py-1">
                      <Input type="number" value={entry.credit || ''} onChange={(e) => updateEntry(index, 'credit', parseFloat(e.target.value) || 0)} className="h-8 text-sm text-right" placeholder="0.00" autoComplete="off" />
                    </td>
                    <td className="px-3 py-1">
                      <Button variant="ghost" size="sm" onClick={() => removeEntry(index)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t p-2 bg-slate-50">
              <Button variant="outline" size="sm" onClick={addEntry} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> 添加科目
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ========== Tab 2: 往来余额 ========== */}
        {showPartnerTab && (
          <TabsContent value="partner-opening" className="space-y-4 mt-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
              <div className="flex-1 text-center">
                <p className="text-sm text-slate-500">应收合计</p>
                <p className="text-lg font-semibold text-blue-700">{partnerTotalReceivable.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm text-slate-500">应付合计</p>
                <p className="text-lg font-semibold text-red-700">{partnerTotalPayable.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => triggerImport('partner-opening')}>
                <Upload className="h-4 w-4 mr-1" /> 导入Excel
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setImportTarget('partner-opening'); handleDownloadTemplate(); }}>
                <Download className="h-4 w-4 mr-1" /> 下载模板
              </Button>
              {partnerEntries.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setPartnerEntries([])} className="text-red-500 hover:text-red-700 ml-auto">
                  <Trash2 className="h-4 w-4 mr-1" /> 清空
                </Button>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">往来单位</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">类型</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 w-36">金额</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">备注</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {partnerEntries.map((entry, index) => (
                    <tr key={index} className="border-t hover:bg-slate-50">
                      <td className="px-2 py-1">
                        <Input value={entry.name} onChange={(e) => updatePartnerEntry(index, 'name', e.target.value)} className="h-8 text-sm" placeholder="往来单位名称" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <select value={entry.type} onChange={(e) => updatePartnerEntry(index, 'type', e.target.value)} className="h-8 text-sm border rounded px-2 w-full">
                          <option value="receivable">应收</option>
                          <option value="payable">应付</option>
                        </select>
                      </td>
                      <td className="px-3 py-1">
                        <Input type="number" value={entry.amount || ''} onChange={(e) => updatePartnerEntry(index, 'amount', parseFloat(e.target.value) || 0)} className="h-8 text-sm text-right" placeholder="0.00" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={entry.remark} onChange={(e) => updatePartnerEntry(index, 'remark', e.target.value)} className="h-8 text-sm" placeholder="备注" autoComplete="off" />
                      </td>
                      <td className="px-3 py-1">
                        <Button variant="ghost" size="sm" onClick={() => removePartnerEntry(index)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t p-2 bg-slate-50">
                <Button variant="outline" size="sm" onClick={addPartnerEntry} className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> 添加往来余额
                </Button>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ========== Tab 3: 银行余额 ========== */}
        {showBankTab && (
          <TabsContent value="bank" className="space-y-4 mt-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
              <div className="flex-1 text-center">
                <p className="text-sm text-slate-500">银行余额合计</p>
                <p className="text-lg font-semibold">{bankTotalBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-sm text-slate-400">{bankEntries.length} 个账户</div>
            </div>

            {bankEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Landmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无银行账户</p>
                <p className="text-sm">请先在"银行账户"步骤中添加</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">银行</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">账号</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 w-40">期初余额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankEntries.map((entry, index) => (
                      <tr key={index} className="border-t hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{entry.bankName || '-'}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-xs">{entry.accountNumber}</td>
                        <td className="px-3 py-1">
                          <Input type="number" value={entry.balance || ''} onChange={(e) => updateBankBalance(index, parseFloat(e.target.value) || 0)} className="h-8 text-sm text-right" placeholder="0.00" autoComplete="off" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        )}

        {/* ========== Tab 4: 固定资产余额 ========== */}
        {showAssetTab && (
          <TabsContent value="asset" className="space-y-4 mt-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
              <div className="flex-1 text-center">
                <p className="text-sm text-slate-500">原值合计</p>
                <p className="text-lg font-semibold">{assetTotalOriginal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm text-slate-500">累计折旧</p>
                <p className="text-lg font-semibold text-slate-600">{assetTotalDep.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm text-slate-500">净值合计</p>
                <p className="text-lg font-semibold text-blue-700">{(assetTotalOriginal - assetTotalDep).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {assetEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无固定资产卡片</p>
                <p className="text-sm">请先在"固定资产"步骤中导入资产清单</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 w-10"></th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">编码</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">资产名称</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">原值</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">累计折旧</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">净值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetEntries.map((entry, index) => (
                      <tr key={index} className={`border-t ${entry.included ? 'hover:bg-slate-50' : 'opacity-50 line-through'}`}>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={entry.included}
                            onChange={() => toggleAssetIncluded(index)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{entry.assetCode}</td>
                        <td className="px-3 py-2 font-medium">{entry.assetName}</td>
                        <td className="px-3 py-2 text-right">{entry.originalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{entry.accumulatedDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-medium">{entry.netValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {subledgerDifferences.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
            <AlertTriangle className="h-4 w-4" />
            子账明细与总账余额存在差异
          </div>
          <div className="space-y-1 text-sm text-blue-700">
            {subledgerDifferences.map(item => (
              <div key={`${item.source}-${item.subjectCode}`} className="flex items-center justify-between gap-3">
                <span>{item.subjectCode} {item.subjectName}</span>
                <span>
                  总账 {item.subjectBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  {' / '}
                  明细 {item.detailBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  {' / '}
                  差异 {item.difference.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600">这类差异不会用补平科目自动处理，请补齐银行、往来或固定资产明细。</p>
        </div>
      )}

      {/* Save & Monthly Closing */}
      {hasAnyData && (
        <div className="flex items-center justify-between">
          {saved && isBalanced && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">期初数据已保存</span>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {!saved ? (
              <Button onClick={handleSave} disabled={loading || (entries.length > 0 && !canSaveOpening)} className="bg-blue-600 hover:bg-blue-700">
                {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 保存中...</> : '保存期初数据'}
              </Button>
            ) : openingPeriod ? (
              <Button onClick={() => setShowClosingWizard(true)} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                完成期初并月结
              </Button>
            ) : (
              <Button onClick={() => setSaved(false)} variant="outline">
                重新编辑
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Monthly Closing Wizard Dialog */}
      {openingPeriod && (
        <MonthlyClosingWizard
          open={showClosingWizard}
          onOpenChange={(open) => {
            setShowClosingWizard(open);
            if (!open) {
              showToast('success', '期初月结完成，可以开始日常凭证录入');
            }
          }}
          period={openingPeriod}
        />
      )}
    </div>
  );
}
