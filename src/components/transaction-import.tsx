'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Trash2,
  Filter,
  Calendar,
  DollarSign,
  Loader2,
  BarChart3,
  Zap,
  RefreshCw,
  Settings,
  Search,
  X
} from 'lucide-react';
import { useVoucherStore, useSubjectStore, useAccountSetStore } from '@/stores';
import { generateVoucherNo } from '@/stores/useVoucherStore';
import { BankFormatSelector } from '@/components/bank-format-selector';
import { detectBank, getBestDetection } from '@/lib/bank-parsers/detector';
import { getAllConfigs } from '@/lib/bank-parsers/bank-registry';
import type { DetectionResult, CustomBankConfig } from '@/lib/bank-parsers/types';
import type { Subject } from '@/types';
import { Popover } from '@/components/ui/popover';
import { parseBankStatement } from '@/lib/parser';
import { BankAccountSelector, getDefaultBankAccounts } from '@/components/bank-account-selector';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { getCurrentService } from '@/lib/database';
import { sqliteService } from '@/lib/database/sqlite-service';
import { waitForDbInit } from '@/hooks/useDatabaseSync';

type SqliteServiceType = typeof sqliteService;
import { matchBankTransaction } from '@/lib/accounting';
import { autoMatchBankSubjects } from '@/lib/bank-match';
import { BankRulesDialog } from '@/components/bank-rules-dialog';
import { FieldMappingCoach } from '@/components/field-mapping-coach';
import { VoucherPreviewDialog, generateDefaultSummary } from '@/components/voucher-preview-dialog';
import type { PreviewEntry } from '@/components/voucher-preview-dialog';
import type { BankTransaction, BankStatementParseResult, BankAccountBinding, VoucherEntry } from '@/types';

interface TransactionRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  type: 'debit' | 'credit';
  matchedSubject?: string;
  matchedSubjectName?: string;
  confidence?: number;
  status: 'pending' | 'matched' | 'unmatched' | 'error';
}

  // 将 BankTransaction 转换为 TransactionRecord 用于显示
  const toTransactionRecord = (tx: BankTransaction): TransactionRecord => {
    const amount = tx.debit || tx.credit || 0;
    const type = tx.debit ? 'debit' : 'credit';

    return {
      id: tx.id,
      date: tx.date,
      description: tx.summary || tx.notes || '',
      amount: tx.debit || 0,
      balance: tx.balance,
      type,
      status: (tx.status === 'voucher_generated' ? 'pending' : tx.status) || 'pending'
    };
  };

/** 对方科目 Popover 选择器 */
function SubjectPopover({
  value,
  valueName,
  onSelect,
  onClear,
}: {
  value: string | undefined;
  valueName: string | undefined;
  onSelect: (code: string, name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { subjects } = useSubjectStore();

  const flatSubjects = useMemo(() => {
    return subjects.filter(s => !s.disabled);
  }, [subjects]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flatSubjects.slice(0, 50);
    const q = search.toLowerCase();
    return flatSubjects.filter(
      s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [search, flatSubjects]);

  const handleSelect = (code: string, name: string) => {
    onSelect(code, name);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}
      content={
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 w-72 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索科目代码或名称..."
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">无匹配科目</div>
            ) : (
              filtered.map(subject => (
                <div
                  key={subject.id}
                  className="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 flex items-center gap-2"
                  onClick={() => handleSelect(subject.code, subject.name)}
                >
                  <span className="font-mono text-slate-600">{subject.code}</span>
                  <span className="text-slate-800">{subject.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      }
    >
      <div className="cursor-pointer" onClick={() => setOpen(true)}>
        {value ? (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors">
            {value} {valueName}
            <X
              className="h-3 w-3 ml-0.5 hover:text-red-500 cursor-pointer"
              onClick={handleClear}
            />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400 text-xs border border-dashed border-slate-300 rounded-md px-2 py-0.5 hover:border-blue-400 hover:text-blue-500 transition-colors">
            <Search className="h-3 w-3" />
            选择科目
          </span>
        )}
      </div>
    </Popover>
  );
}

interface TransactionImportProps {
  importType: 'bank' | 'tax';
  defaultBankAccountId?: string;
  onImportComplete?: (importedCount: number, voucherCount: number) => void;
}

export function TransactionImport({ importType, defaultBankAccountId, onImportComplete }: TransactionImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(defaultBankAccountId || null);
  const [parseErrors, setParseErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [showRulesDialog, setShowRulesDialog] = useState(false);

  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [bankInfo, setBankInfo] = useState<{ bankName: string; accountName: string; accountNumber: string } | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [showAccountNameConfirm, setShowAccountNameConfirm] = useState(false);
  const [pendingParseResult, setPendingParseResult] = useState<BankStatementParseResult | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>('auto');
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [bankSelectorKey, setBankSelectorKey] = useState(0);
  const { showToast } = useToast();

  // 组件加载时从数据库读取已保存的流水
  useEffect(() => {
    loadSavedTransactions();
  }, []);

  const loadSavedTransactions = async () => {
    setIsLoading(true);
    try {
      // 等待全局数据库初始化完成
      await waitForDbInit();
      const service = getCurrentService();
      const savedTransactions = await service.getAllBankTransactions();

      if (savedTransactions.length > 0) {
        // 只加载未生成凭证的流水
        const pendingTransactions = savedTransactions.filter(
          tx => tx.status === 'pending' || tx.status === 'matched'
        );

        if (pendingTransactions.length > 0) {
          setTransactions(pendingTransactions);
          setShowPreview(true);

          // 恢复批次ID
          const batchIds = [...new Set(pendingTransactions.map(tx => tx.importBatchId).filter(Boolean))] as string[];
          if (batchIds.length > 0) {
            setCurrentBatchId(batchIds[0] as string);
          }

          // 自动选择默认银行科目
          const bankAccounts = getDefaultBankAccounts();
          if (!selectedBankAccountId && bankAccounts.length > 0) {
            setSelectedBankAccountId(bankAccounts[0].id);
          }
        }
      }
    } catch (error) {
      console.error('加载已保存的流水失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = importType === 'bank'
        ? ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'application/vnd.ms-excel',
           'text/csv']
        : ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'application/vnd.ms-excel'];

      if (!validTypes.includes(file.type)) {
        showToast('error', `请选择${importType === 'bank' ? 'Excel或CSV' : 'Excel'}文件`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        showToast('error', '文件大小不能超过10MB');
        return;
      }

      setSelectedFile(file);
      setDetectionResult(null);

      // Auto-detect bank format
      try {
        const results = await detectBank(file, getAllConfigs());
        const best = getBestDetection(results);
        setDetectionResult(best);
        if (best) setSelectedBankId(best.bankId);
      } catch {
        // Detection failed, user will select manually
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // New custom format: show coach wizard
    if (selectedBankId === 'custom_new') {
      setShowCoach(true);
      return;
    }

    // Saved custom config: use it directly
    if (selectedBankId.startsWith('custom_')) {
      setIsProcessing(true);
      setParseErrors([]);
      try {
        const customConfigId = selectedBankId.replace('custom_', '');
        await waitForDbInit();
        const service = getCurrentService() as SqliteServiceType;
        const configs: CustomBankConfig[] = await service.getCustomBankConfigs();
        const saved = configs.find(c => c.id === customConfigId);
        if (!saved) {
          showToast('error', '自定义格式配置未找到，请重新配置');
          setIsProcessing(false);
          return;
        }
        const { parseWithConfig } = await import('@/lib/bank-parsers/engine');
        const result = await parseWithConfig(selectedFile, saved.config);
        setBankInfo(result.bankInfo);
        if (result.transactions.length > 0) {
          await saveParsedTransactions(result);
        } else {
          showToast('error', '未找到有效的交易记录');
        }
      } catch (e) {
        showToast('error', `解析失败: ${(e as Error).message}`);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    setIsProcessing(true);
    setParseErrors([]);

    try {
      if (importType === 'bank') {
        const bankId = selectedBankId === 'auto' ? undefined : selectedBankId;
        const result: BankStatementParseResult = await parseBankStatement(selectedFile, bankId);

        setBankInfo(result.bankInfo);

        if (result.transactions.length === 0) {
          showToast('error', '未找到有效的交易记录');
          setIsProcessing(false);
          return;
        }

        // 校验银行账户名称是否与账套公司名一致
        const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
        const bankAccountName = result.bankInfo.accountName?.trim();
        const companyNames = accountSet?.name?.trim();

        if (bankAccountName && companyNames && bankAccountName !== companyNames) {
          // 名称不一致，弹出确认框
          setPendingParseResult(result);
          setShowAccountNameConfirm(true);
          setIsProcessing(false);
          return;
        }

        // 名称一致或无法比较，直接保存
        await saveParsedTransactions(result);
      }
    } catch (error) {
      console.error('Parse error:', error);
      showToast('error', '解析文件失败，请检查格式是否正确');
    } finally {
      setIsProcessing(false);
    }
  };

  /** 将解析结果保存到数据库（与确认逻辑分离） */
  const saveParsedTransactions = async (result: BankStatementParseResult) => {
    // Auto-match/create bank sub-subjects
    const matchedBankId = await autoMatchBankSubjects(result.transactions);
    if (matchedBankId && !selectedBankAccountId) {
      setSelectedBankAccountId(matchedBankId);
    }

    // 生成批次ID
    const batchId = `batch_${Date.now()}`;
    setCurrentBatchId(batchId);

    // 为每条交易添加批次ID和初始状态，并去除已存在的重复流水
    const service = getCurrentService();
    const dedupedTransactions: typeof result.transactions = [];
    let skippedCount = 0;

    for (const tx of result.transactions) {
      if (tx.date && tx.voucherNo && tx.transactionSerialNo) {
        const exists = await service.existsBankTransaction(tx.date, tx.voucherNo, tx.transactionSerialNo);
        if (exists) {
          skippedCount++;
          continue;
        }
      }
      dedupedTransactions.push({
        ...tx,
        importBatchId: batchId,
        status: 'pending' as const
      });
    }

    if (dedupedTransactions.length === 0) {
      showToast('warning', `所有 ${result.transactions.length} 条流水已存在，无需重复导入`);
      return;
    }

    // 保存到数据库
    await service.saveBankTransactions(dedupedTransactions);

    setTransactions(dedupedTransactions);
    setParseErrors(result.errors);

    const baseMsg = `成功解析并保存 ${dedupedTransactions.length} 条记录`;
    if (skippedCount > 0) {
      showToast('warning', `${baseMsg}，跳过 ${skippedCount} 条重复流水`);
    } else if (result.errors.length > 0) {
      showToast('warning', `解析完成，有 ${result.errors.length} 个警告`);
    } else {
      showToast('success', baseMsg);
    }

    setShowPreview(true);

    // 自动选择默认银行科目
    const bankAccounts = getDefaultBankAccounts();
    if (!selectedBankAccountId && bankAccounts.length > 0) {
      setSelectedBankAccountId(bankAccounts[0].id);
    }
  };

  /** 确认继续导入（账户名不一致时） */
  const handleConfirmImport = async () => {
    setShowAccountNameConfirm(false);
    setIsProcessing(true);
    try {
      if (pendingParseResult) {
        await saveParsedTransactions(pendingParseResult);
      }
    } finally {
      setPendingParseResult(null);
      setIsProcessing(false);
    }
  };

  const handleMatchSubject = async (id: string, subject: string, subjectName: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === id
        ? { ...t, matchedSubject: subject, matchedSubjectName: subjectName, status: 'matched' }
        : t
    ));

    // 更新数据库
    try {
      const service = getCurrentService();
      await service.updateBankTransaction(id, {
        matchedSubject: subject,
        matchedSubjectName: subjectName,
        status: 'matched'
      });
    } catch (error) {
      console.error('更新交易匹配失败:', error);
    }
  };

  const handleAutoMatch = async () => {
    // 四层匹配：往来单位默认科目 > 自定义规则 > 系统规则 > 用户偏好
    const { useUserPreferenceStore } = await import('@/stores/useUserPreferenceStore');
    const { usePartnerStore } = await import('@/stores/usePartnerStore');
    const { useBankRuleStore } = await import('@/stores/useBankRuleStore');

    // 先确保规则已初始化，再获取
    const bankRuleStore = useBankRuleStore.getState();
    if (bankRuleStore.rules.length === 0) {
      await bankRuleStore.initialize();
    }

    const bankRules = useBankRuleStore.getState().getEnabledRules().map(r => ({
      keyword: r.keyword,
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      direction: r.direction,
      priority: r.priority,
    }));

    const userPrefs = useUserPreferenceStore.getState().preferences.map(p => ({
      summary: p.summary,
      subject: p.subject,
      subjectName: p.subjectName,
      timestamp: p.timestamp || 0
    }));

    const partners = usePartnerStore.getState().partners.map(p => ({
      name: p.name,
      defaultSubjectCode: p.defaultSubjectCode,
      defaultSubjectName: p.defaultSubjectName,
    }));

    const updatedTransactions = transactions.map(t => {
      const match = matchBankTransaction(
        {
          summary: t.summary || '',
          notes: t.notes || '',
          counterpartyName: t.counterpartyName || undefined,
          isDebit: !!t.debit,
        },
        bankRules,
        partners,
        userPrefs
      );

      if (match) {
        return {
          ...t,
          matchedSubject: match.subjectCode,
          matchedSubjectName: match.subjectName,
          confidence: match.confidence,
          status: 'matched' as const
        };
      }

      return t;
    });

    setTransactions(updatedTransactions);

    // 批量更新数据库
    try {
      const service = getCurrentService();
      for (const tx of updatedTransactions.filter(t => t.status === 'matched')) {
        await service.updateBankTransaction(tx.id, {
          matchedSubject: tx.matchedSubject,
          matchedSubjectName: tx.matchedSubjectName,
          confidence: tx.confidence,
          status: 'matched'
        });
      }
      showToast('success', '智能匹配完成');
    } catch (error) {
      console.error('更新匹配状态失败:', error);
      showToast('error', '保存匹配结果失败');
    }
  };

  // 构建预览数据并打开预览弹窗
  const handleOpenPreview = async () => {
    const targetIds = selectedTxIds.size > 0 ? selectedTxIds : null;
    const matchedTransactions = transactions.filter(t =>
      (targetIds ? targetIds.has(t.id) : true) &&
      (t.matchedSubject || t.debit || t.credit) &&
      t.status !== 'voucher_generated'
    );
    if (matchedTransactions.length === 0) {
      showToast('error', targetIds ? '选中的记录中没有可生成的交易' : '没有有效的交易记录');
      return;
    }

    if (!selectedBankAccountId) {
      showToast('error', '请先选择银行账户');
      return;
    }

    // 获取银行科目信息
    const bankAccounts = getDefaultBankAccounts();
    const bankAccount = bankAccounts.find(a => a.id === selectedBankAccountId);
    const bankSubjectCode = bankAccount?.subjectCode || '1002';
    const bankSubjectName = bankAccount?.name || '银行存款';

    // 预加载银行账户绑定，用于推断外币币别/汇率/原币金额
    const service = getCurrentService();
    const bankBindings = (await service.getBankAccountBindings?.()) || [];
    const bindingsByAccount = new Map<string, BankAccountBinding>();
    for (const b of bankBindings) {
      if (b.accountNumber) bindingsByAccount.set(b.accountNumber, b);
    }
    const txBinding = bankInfo?.accountNumber ? bindingsByAccount.get(bankInfo.accountNumber) : null;
    const bindingCurrency = txBinding?.currency || txBinding?.currencyCode || 'CNY';

    // 检查往来单位是否存在
    const { usePartnerStore } = await import('@/stores/usePartnerStore');
    const existingPartners = usePartnerStore.getState().partners;

    const previewEntries = matchedTransactions.map(transaction => {
      const isDebit = !!transaction.debit;
      const amount = transaction.debit || transaction.credit || 0;
      const willCreatePartner = !!(transaction.counterpartyName &&
        !existingPartners.some(p =>
          p.name === transaction.counterpartyName ||
          transaction.counterpartyName.includes(p.name) ||
          p.name.includes(transaction.counterpartyName)
        ));
      const originalSummary = transaction.summary || transaction.notes || '银行交易';
      const counterpartSubjectName = transaction.matchedSubjectName || '财务费用';

      // 外币字段：优先从交易自带 FX 字段推断；其次从银行账户绑定的币别推断；最后从摘要解析 (USD@rate) 兜底
      const txOriginal = transaction.originalAmount;
      const txRate = transaction.exchangeRate;
      const summaryFxMatch = (transaction.summary || '').match(/\(([A-Z]{3})@([\d.]+)\)/);
      const summaryCurrency = summaryFxMatch ? summaryFxMatch[1] : undefined;
      const summaryRate = summaryFxMatch ? parseFloat(summaryFxMatch[2]) : undefined;

      const effectiveCurrency =
        (bindingCurrency && bindingCurrency !== 'CNY')
          ? bindingCurrency
          : ((txOriginal && txOriginal > 0) || (txRate && txRate > 0)
              ? (summaryCurrency || 'USD')
              : summaryCurrency);

      const isForeign = !!effectiveCurrency && effectiveCurrency !== 'CNY'
        && ((txOriginal && txOriginal > 0) || (txRate && txRate > 0) || (summaryRate && summaryRate > 0));

      const originalAmount = isForeign
        ? (txOriginal && txOriginal > 0
            ? txOriginal
            : (summaryRate && summaryRate > 0
                ? Math.round((amount / summaryRate) * 100) / 100
                : 0))
        : undefined;
      const exchangeRate = isForeign
        ? (txRate && txRate > 0
            ? txRate
            : (summaryRate && summaryRate > 0
                ? summaryRate
                : (originalAmount && originalAmount > 0
                    ? Math.round((amount / originalAmount) * 10000) / 10000
                    : 0)))
        : undefined;
      const currencyCode = isForeign ? effectiveCurrency : undefined;
      const currencyName = isForeign ? effectiveCurrency : undefined;

      return {
        transactionId: transaction.id,
        date: transaction.date,
        postingDate: transaction.date,
        originalSummary,
        summary: generateDefaultSummary({
          isDebit,
          counterpartyName: transaction.counterpartyName,
          counterpartSubjectName,
          amount,
        }),
        counterpartyName: transaction.counterpartyName,
        counterpartyAccount: transaction.counterpartyAccount,
        counterpartSubjectCode: transaction.matchedSubject || '6603',
        counterpartSubjectName,
        bankSubjectCode,
        bankSubjectName,
        amount,
        isDebit,
        willCreatePartner,
        currencyCode,
        currencyName,
        exchangeRate,
        originalAmount,
      };
    });

    setPreviewEntries(previewEntries);
    setShowPreviewDialog(true);
  };

  // 确认生成凭证（从预览弹窗回调，接收用户编辑后的数据）
  const handleGenerateVouchers = async (editedEntries: PreviewEntry[]) => {
    setIsProcessing(true);

    try {
      const service = getCurrentService();
      const { usePartnerStore } = await import('@/stores/usePartnerStore');
      const { useAccountSetStore } = await import('@/stores/useAccountSetStore');
      const { useSubjectStore } = await import('@/stores/useSubjectStore');

      // 获取当前账套的往来核算方式
      const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const partnerTrackingMethod = currentAccountSet?.accounting?.partnerTrackingMethod || 'card';

      // 预加载银行账户绑定，用于外币凭证分录的币别/汇率/原币金额透传
      const bankBindings = (await service.getBankAccountBindings?.()) || [];
      const bindingsByAccount = new Map<string, BankAccountBinding>();
      for (const b of bankBindings) {
        if (b.accountNumber) bindingsByAccount.set(b.accountNumber, b);
      }

      // 1. 根据往来核算方式处理往来单位
      const createdPartnerNames = new Set<string>();
      const partnersToCreate = editedEntries.filter(e => e.willCreatePartner && e.counterpartyName);

      if (partnerTrackingMethod === 'card') {
        // 往来卡片方式：创建往来单位卡片
        for (const entry of partnersToCreate) {
          if (!entry.counterpartyName || createdPartnerNames.has(entry.counterpartyName)) continue;

          try {
            const isCustomer = !entry.isDebit; // 贷方(收款)=客户(应收账款)
            const isSupplier = entry.isDebit;  // 借方(付款)=供应商(应付账款)

            // 生成编码：客户C001/C002..., 供应商V001/V002..., 两者都是B001...
            const prefix = isCustomer && isSupplier ? 'B' : isCustomer ? 'C' : 'V';
            const existingCodes = usePartnerStore.getState().partners.map(p => p.code);
            let seq = 1;
            while (existingCodes.includes(`${prefix}${String(seq).padStart(3, '0')}`)) {
              seq++;
            }
            const code = `${prefix}${String(seq).padStart(3, '0')}`;

            await usePartnerStore.getState().addPartner({
              code,
              name: entry.counterpartyName,
              isCustomer,
              isSupplier,
              isEmployee: false,
              defaultSubjectCode: isCustomer ? '1122' : '2202',
              defaultSubjectName: isCustomer ? '应收账款' : '应付账款',
              bankAccount: entry.counterpartyAccount || '',
              frozen: false,
            });

            createdPartnerNames.add(entry.counterpartyName);
          } catch (error) {
            console.error('自动创建往来单位失败:', entry.counterpartyName, error);
          }
        }
      }

      // 2. 生成凭证
      const now = new Date().toISOString();
      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const processedIds = new Set<string>();

      for (const previewEntry of editedEntries) {
        try {
          // 防重复入账：检查该流水是否已生成过凭证
          const tx = transactions.find(t => t.id === previewEntry.transactionId);
          if (!tx || tx.status === 'voucher_generated') {
            duplicateCount++;
            continue;
          }

          // 数据库级别去重：按 date + voucherNo + transactionSerialNo 检查
          if (tx.date && tx.voucherNo && tx.transactionSerialNo) {
            const existing = await service.findPostedBankTransaction(tx.date, tx.voucherNo, tx.transactionSerialNo);
            if (existing) {
              showToast('warning', `流水 ${tx.date} ${tx.voucherNo}-${tx.transactionSerialNo} 已入账（凭证号：${existing.generatedVoucherNo || '未知'}），跳过`);
              duplicateCount++;
              continue;
            }
          }

          const isDebit = previewEntry.isDebit;
          const amount = previewEntry.amount;
          const voucherId = `voucher_${Date.now()}_${previewEntry.transactionId}`;
          const postingDate = previewEntry.postingDate || previewEntry.date;
          const voucherType = isDebit ? 'payment' as const : 'receipt' as const;
          const voucherNo = await generateVoucherNo(postingDate, voucherType);

          // 创建凭证分录
          const entries: VoucherEntry[] = [];

          // isDebit=true: 银行流水借方=付款(钱流出)
          //   → 银行存款减少(贷方), 对方科目增加(借方,如应付账款)
          // isDebit=false: 银行流水贷方=收款(钱流入)
          //   → 银行存款增加(借方), 对方科目减少(贷方,如应收账款)

          // 外币判定：银行卡片币别非 CNY 即为外币交易
          // 优先级：流水自带 originalAmount/exchangeRate > 银行卡片币别反推
          const binding = tx.ourAccount ? bindingsByAccount.get(tx.ourAccount) : null;
          const bindingCurrency = binding?.currency || binding?.currencyCode || 'CNY';
          const txOriginalAmount = tx.originalAmount;
          const txExchangeRate = tx.exchangeRate;
          const isForeignCurrency = bindingCurrency !== 'CNY'
            && ((txOriginalAmount && txOriginalAmount > 0) || (txExchangeRate && txExchangeRate > 0));
          const fxOriginal = isForeignCurrency && txOriginalAmount && txOriginalAmount > 0
            ? txOriginalAmount
            : (isForeignCurrency && txExchangeRate && txExchangeRate > 0
                ? Math.round((amount / txExchangeRate) * 100) / 100
                : 0);
          const fxRate = isForeignCurrency
            ? (txExchangeRate && txExchangeRate > 0
                ? txExchangeRate
                : (fxOriginal > 0 ? Math.round((amount / fxOriginal) * 10000) / 10000 : 0))
            : 0;
          const fxFields = isForeignCurrency
            ? {
                currencyCode: bindingCurrency,
                currencyName: bindingCurrency,
                exchangeRate: fxRate,
                originalAmount: fxOriginal,
              }
            : {};

          let counterpartSubjectCode = previewEntry.counterpartSubjectCode;
          let counterpartSubjectName = previewEntry.counterpartSubjectName;
          let customerName = previewEntry.counterpartyName;
          let supplierName = previewEntry.counterpartyName;

          // 根据往来核算方式处理科目和往来信息
          if (partnerTrackingMethod === 'subject') {
            // 科目方式：为往来单位创建明细科目
            const partnerSubjectPrefix = isDebit ? '2202' : '1122'; // 应付账款/应收账款
            if (counterpartSubjectCode.startsWith('2202') || counterpartSubjectCode.startsWith('1122')) {
              // 为往来科目创建明细科目
              const partnerCode = previewEntry.counterpartyName?.replace(/\s+/g, '').substring(0, 4) || '0001';
              counterpartSubjectCode = `${partnerSubjectPrefix}.${partnerCode}`;
              counterpartSubjectName = `${previewEntry.counterpartSubjectName}-${previewEntry.counterpartyName}`;

              // 检查科目是否已存在，不存在则创建
              const existingSubject = useSubjectStore.getState().subjects.find(s => s.code === counterpartSubjectCode);
              if (!existingSubject) {
                await useSubjectStore.getState().addSubject({
                  code: counterpartSubjectCode,
                  name: counterpartSubjectName,
                  parentId: useSubjectStore.getState().subjects.find(s => s.code === partnerSubjectPrefix)?.id || null,
                  level: counterpartSubjectCode.length <= 3 ? 1 : counterpartSubjectCode.length <= 4 ? 2 : 3,
                  direction: counterpartSubjectCode.startsWith('1') ? 'debit' : 'credit', // 资产借方，负债贷方
                  enableDept: false,
                  enableProject: false,
                  enableForeign: false,
                  isCustomer: !isDebit,
                  isSupplier: isDebit,
                  isEmployee: false,
                  enableCashFlow: false,
                  disabled: false,
                  block: false,
                });
              }

              // 科目方式下，清空往来卡片信息
              customerName = '';
              supplierName = '';
            }
          } else {
            // 往来卡片方式：保持原科目，只记录往来单位信息
            // 已经在上面设置好了 customerName 和 supplierName
          }

          // 交易分录（对方科目）
          entries.push({
            id: `entry_${voucherId}_0`,
            voucherId,
            date: postingDate,
            summary: previewEntry.summary,
            subjectCode: counterpartSubjectCode,
            subjectName: counterpartSubjectName,
            debit: isDebit ? amount : 0,
            credit: isDebit ? 0 : amount,
            customerName,
            supplierName,
            auxiliary: {},
            docNo: `${tx.voucherNo || ''}-${tx.transactionSerialNo || ''}`,
            ...fxFields,
          });

          // 银行存款分录（平衡分录）
          entries.push({
            id: `entry_${voucherId}_1`,
            voucherId,
            date: postingDate,
            summary: previewEntry.summary,
            subjectCode: previewEntry.bankSubjectCode,
            subjectName: previewEntry.bankSubjectName,
            debit: isDebit ? 0 : amount,
            credit: isDebit ? amount : 0,
            ...fxFields,
          });

          // 创建并保存凭证
          const voucher = {
            id: voucherId,
            voucherNo,
            date: postingDate,
            summary: previewEntry.summary,
            entries,
            status: 'posted' as const,
            voucherType: isDebit ? 'payment' as const : 'receipt' as const,
            createdBy: 'system',
            createTime: now,
            updateTime: now,
          };

          await service.saveVoucher(voucher);

          // 更新银行流水状态
          await service.updateBankTransaction(previewEntry.transactionId, {
            status: 'voucher_generated',
            voucherId,
            generatedVoucherNo: voucherNo,
          });

          processedIds.add(previewEntry.transactionId);
          successCount++;
        } catch (error) {
          console.error('生成凭证失败:', previewEntry.transactionId, error);
          errorCount++;
        }
      }

      // 从列表中移除已生成凭证的流水（按 ID 集合移除，不依赖 state 中的 status）
      setTransactions(prev => prev.filter(t => !processedIds.has(t.id)));

      // 关闭预览弹窗
      setShowPreviewDialog(false);

      const messages: string[] = [];
      if (successCount > 0) messages.push(`生成 ${successCount} 张凭证`);
      if (createdPartnerNames.size > 0) messages.push(`新建 ${createdPartnerNames.size} 个往来单位`);
      if (duplicateCount > 0) messages.push(`跳过 ${duplicateCount} 条重复`);
      if (errorCount > 0) messages.push(`${errorCount} 条失败`);

      if (successCount > 0) {
        showToast('success', messages.join('，'));
        // Call onImportComplete callback if provided
        if (onImportComplete) {
          const totalImported = transactions.length;
          onImportComplete(totalImported, successCount);
        }
      } else {
        showToast('error', messages.join('，') || '生成凭证失败');
      }

      // 刷新凭证列表
      const { useVoucherStore } = await import('@/stores');
      await useVoucherStore.getState().initialize();

    } catch (error) {
      console.error('Generate vouchers error:', error);
      showToast('error', '生成凭证失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubjectSelect = async (txId: string, code: string, name: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === txId
        ? { ...t, matchedSubject: code, matchedSubjectName: name, status: 'matched' as const }
        : t
    ));

    // 更新数据库
    try {
      const service = getCurrentService();
      await service.updateBankTransaction(txId, {
        matchedSubject: code,
        matchedSubjectName: name,
        status: 'matched'
      });
    } catch (error) {
      console.error('更新交易匹配失败:', error);
    }

    // 记录为 L2 用户偏好
    try {
      const tx = transactions.find(t => t.id === txId);
      if (tx) {
        const { useUserPreferenceStore } = await import('@/stores/useUserPreferenceStore');
        useUserPreferenceStore.getState().savePreference(
          tx.summary || tx.notes || '',
          code,
          name
        );
      }
    } catch (error) {
      console.error('保存用户偏好失败:', error);
    }
  };

  const handleClearSubject = async (txId: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === txId
        ? { ...t, matchedSubject: undefined, matchedSubjectName: undefined, status: 'pending' as const }
        : t
    ));
    try {
      const service = getCurrentService();
      await service.updateBankTransaction(txId, {
        matchedSubject: null,
        matchedSubjectName: null,
        status: 'pending'
      });
    } catch (error) {
      console.error('清除科目匹配失败:', error);
    }
  };

  const handleClearTransactions = async () => {
    try {
      const service = getCurrentService();
      await service.clearBankTransactions();
      setTransactions([]);
      setShowPreview(false);
      setCurrentBatchId(null);
      showToast('success', '已清空未入账流水');
    } catch (error) {
      console.error('清空流水失败:', error);
      showToast('error', '清空流水失败');
    }
  };

  const getStatusBadge = (status: TransactionRecord['status']) => {
    switch (status) {
      case 'matched':
        return <Badge variant="default" className="bg-green-100 text-green-800">已匹配</Badge>;
      case 'unmatched':
        return <Badge variant="destructive">未匹配</Badge>;
      case 'error':
        return <Badge variant="destructive">错误</Badge>;
      default:
        return <Badge variant="outline">待处理</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 文件上传区域 */}
      {!showPreview && (
        <Card>
          <CardContent className="p-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-2">
                {importType === 'bank' ? '上传银行流水文件' : '上传税务流水文件'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                支持 .xlsx, .xls{importType === 'bank' ? ', .csv' : ''} 格式
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={importType === 'bank' ? '.xlsx,.xls,.csv' : '.xlsx,.xls'}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} className="mb-2">
                选择文件
              </Button>
              <p className="text-xs text-gray-400">
                或拖拽文件到此区域
              </p>
            </div>

            {selectedFile && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BankFormatSelector
                      key={bankSelectorKey}
                      value={selectedBankId}
                      onChange={setSelectedBankId}
                      detectionResult={detectionResult}
                    />
                    <Button variant="outline" size="sm" onClick={() => setSelectedFile(null)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleUpload} disabled={isProcessing}>
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        '开始解析'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 预览和匹配 */}
      {showPreview && (
        <>
          {/* 银行信息 + 科目选择（醒目位置） */}
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              {bankInfo && (
                <div className="mb-3 p-3 bg-white rounded-md border">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">账户信息:</span> {bankInfo.bankName} | {bankInfo.accountName} | {bankInfo.accountNumber}
                  </p>
                </div>
              )}
              <BankAccountSelector
                selectedAccountId={selectedBankAccountId}
                onSelectAccount={setSelectedBankAccountId}
                label="选择银行科目（生成凭证时的平衡分录）"
              />
            </CardContent>
          </Card>

          {/* 统计信息 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">总记录数</p>
                    <p className="text-2xl font-bold">{transactions.length}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-gray-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">已匹配</p>
                    <p className="text-2xl font-bold text-green-600">
                      {transactions.filter(t => t.status === 'matched').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">待匹配</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {transactions.filter(t => t.status === 'pending').length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-yellow-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">总金额</p>
                    <p className="text-2xl font-bold">
                      ¥{transactions.reduce((sum, t) => sum + (t.debit || t.credit || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-gray-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 操作栏 */}
          <div className="flex gap-2 flex-wrap items-center">
            <label className="flex items-center gap-2 text-sm cursor-pointer mr-2">
              <input
                type="checkbox"
                checked={selectedTxIds.size > 0 && selectedTxIds.size === transactions.length}
                ref={el => {
                  if (el) {
                    el.indeterminate = selectedTxIds.size > 0 && selectedTxIds.size < transactions.length;
                  }
                }}
                onChange={() => {
                  if (selectedTxIds.size === transactions.length) {
                    setSelectedTxIds(new Set());
                  } else {
                    setSelectedTxIds(new Set(transactions.map(t => t.id)));
                  }
                }}
                className="rounded border-slate-300"
              />
              <span className="text-slate-600">
                {selectedTxIds.size > 0 ? `已选 ${selectedTxIds.size} 条` : '全选'}
              </span>
            </label>
            <Button onClick={handleAutoMatch} disabled={isProcessing}>
              <Zap className="h-4 w-4 mr-2" />
              智能匹配
            </Button>
            <Button variant="outline" onClick={() => setShowRulesDialog(true)} title="匹配规则设置">
              <Settings className="h-4 w-4 mr-2" />
              匹配规则
            </Button>
            <Button
              onClick={handleOpenPreview}
              disabled={isProcessing || transactions.filter(t => t.status === 'matched').length === 0}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {selectedTxIds.size > 0
                    ? `预览并生成 (${selectedTxIds.size}条)`
                    : '预览并生成 (全部)'}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={loadSavedTransactions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Button variant="outline" onClick={() => { setShowPreview(false); setSelectedFile(null); }}>
              重新上传
            </Button>
            <Button variant="outline" onClick={handleClearTransactions} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-2" />
              清空未入账流水
            </Button>
          </div>

          {/* 交易记录列表 */}
          <Card>
            <CardHeader>
              <CardTitle>交易记录预览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.map((transaction) => {
                  const record = toTransactionRecord(transaction);
                  return (
                    <div key={transaction.id} className={`border rounded-lg p-4 hover:bg-gray-50 ${selectedTxIds.has(transaction.id) ? 'bg-blue-50 border-blue-200' : ''}`}>
                      <div className="flex items-center justify-between">
                        {/* 左侧：勾选框 + 日期 + 摘要 + 对方 + 科目选择器 */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedTxIds.has(transaction.id)}
                            onChange={() => {
                              setSelectedTxIds(prev => {
                                const next = new Set(prev);
                                if (next.has(transaction.id)) {
                                  next.delete(transaction.id);
                                } else {
                                  next.add(transaction.id);
                                }
                                return next;
                              });
                            }}
                            className="rounded border-slate-300 flex-shrink-0"
                          />
                          <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="font-mono text-sm flex-shrink-0">{transaction.date}</span>
                          <span className="text-sm truncate max-w-[200px]" title={transaction.summary || transaction.notes || ''}>
                            {transaction.summary || transaction.notes}
                          </span>
                          {transaction.counterpartyName && (
                            <span className="text-sm text-slate-500 flex-shrink-0">
                              对方: {transaction.counterpartyName}
                              {transaction.counterpartyAccount && (
                                <span className="text-slate-400 ml-1">{transaction.counterpartyAccount}</span>
                              )}
                            </span>
                          )}
                          <div className="flex-shrink-0">
                            <SubjectPopover
                              value={transaction.matchedSubject}
                              valueName={transaction.matchedSubjectName}
                              onSelect={(code, name) => handleManualSubjectSelect(transaction.id, code, name)}
                              onClear={() => handleClearSubject(transaction.id)}
                            />
                          </div>
                        </div>
                        {/* 右侧：金额 + 状态 */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          {transaction.debit ? (
                            <span className="font-medium text-blue-600 text-sm">
                              借: ¥{(transaction.debit ?? 0).toLocaleString()}
                            </span>
                          ) : null}
                          {transaction.credit ? (
                            <span className="font-medium text-red-600 text-sm">
                              贷: ¥{(transaction.credit ?? 0).toLocaleString()}
                            </span>
                          ) : null}
                          {transaction.balance != null && (
                            <span className="text-sm text-slate-400 flex-shrink-0">
                              余额: ¥{(transaction.balance ?? 0).toLocaleString()}
                            </span>
                          )}
                          {getStatusBadge(record.status)}
                        </div>
                      </div>
                      {/* 备注 */}
                      {transaction.notes && (
                        <div className="mt-2 text-sm text-slate-500 bg-slate-50 p-2 rounded">
                          <span className="text-slate-600 font-medium">备注: </span>
                          {transaction.notes}
                        </div>
                      )}
                      {/* 已生成凭证提示 */}
                      {transaction.status === 'voucher_generated' && transaction.generatedVoucherNo && (
                        <div className="mt-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                          <CheckCircle className="h-4 w-4 inline mr-1" />
                          已生成凭证: {transaction.generatedVoucherNo}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 规则管理弹窗 */}
      <BankRulesDialog open={showRulesDialog} onOpenChange={setShowRulesDialog} />

      {/* 字段映射教练 */}
      <FieldMappingCoach
        open={showCoach}
        onClose={() => setShowCoach(false)}
        file={selectedFile}
        onConfigCreated={async (config) => {
          // Refresh the selector so new custom config appears
          setBankSelectorKey(k => k + 1);
          const { parseWithConfig } = await import('@/lib/bank-parsers/engine');
          const result = await parseWithConfig(selectedFile!, config);
          setBankInfo(result.bankInfo);
          if (result.transactions.length > 0) {
            await saveParsedTransactions(result);
          } else {
            showToast('error', '未找到有效的交易记录');
          }
        }}
      />

      {/* 账户名称不一致确认弹窗 */}
      <Dialog open={showAccountNameConfirm} onOpenChange={(open) => { if (!open) { setShowAccountNameConfirm(false); setPendingParseResult(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>银行账户名称不匹配</DialogTitle>
            <DialogDescription>
              导入文件的银行账户名称为「{pendingParseResult?.bankInfo?.accountName}」，
              当前账套公司名称为「{useAccountSetStore.getState().getCurrentAccountSet()?.name}」，
              两者不一致。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAccountNameConfirm(false); setPendingParseResult(null); }}>
              取消导入
            </Button>
            <Button onClick={handleConfirmImport}>
              继续导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 凭证预览弹窗 */}
      <VoucherPreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        entries={previewEntries}
        onConfirm={handleGenerateVouchers}
        isProcessing={isProcessing}
      />
    </div>
  );
}
