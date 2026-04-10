'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Settings
} from 'lucide-react';
import { useVoucherStore } from '@/stores';
import { parseBankStatement } from '@/lib/parser';
import { BankAccountSelector, DEFAULT_BANK_ACCOUNTS } from '@/components/bank-account-selector';
import { useToast } from '@/components/ui/toast';
import { getCurrentService } from '@/lib/database';
import { matchBankTransaction } from '@/lib/accounting';
import { BankRulesDialog } from '@/components/bank-rules-dialog';
import { SubjectSearch } from '@/components/voucher/subject-search';
import type { BankTransaction, BankStatementParseResult } from '@/types';

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
      status: (tx.status as any) || 'pending'
    };
  };

interface TransactionImportProps {
  importType: 'bank' | 'tax';
}

export function TransactionImport({ importType }: TransactionImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [editingSubjectTxId, setEditingSubjectTxId] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState<{ bankName: string; accountName: string; accountNumber: string } | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  // 组件加载时从数据库读取已保存的流水
  useEffect(() => {
    loadSavedTransactions();
  }, []);

  const loadSavedTransactions = async () => {
    setIsLoading(true);
    try {
      const service = getCurrentService();
      const savedTransactions = await service.getAllBankTransactions();

      if (savedTransactions.length > 0) {
        // 只加载未生成凭证的流水
        const pendingTransactions = savedTransactions.filter(
          (tx: any) => tx.status === 'pending' || tx.status === 'matched'
        );

        if (pendingTransactions.length > 0) {
          setTransactions(pendingTransactions);
          setShowPreview(true);

          // 恢复批次ID
          const batchIds = [...new Set(pendingTransactions.map((tx: any) => tx.importBatchId).filter(Boolean))];
          if (batchIds.length > 0) {
            setCurrentBatchId(batchIds[0] as string);
          }

          // 自动选择默认银行科目
          if (!selectedBankAccountId && DEFAULT_BANK_ACCOUNTS.length > 0) {
            setSelectedBankAccountId(DEFAULT_BANK_ACCOUNTS[0].id);
          }
        }
      }
    } catch (error) {
      console.error('加载已保存的流水失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setParseErrors([]);

    try {
      if (importType === 'bank') {
        const result: BankStatementParseResult = await parseBankStatement(selectedFile);

        setBankInfo(result.bankInfo);

        // 生成批次ID
        const batchId = `batch_${Date.now()}`;
        setCurrentBatchId(batchId);

        // 为每条交易添加批次ID和初始状态
        const transactionsWithMeta = result.transactions.map(tx => ({
          ...tx,
          importBatchId: batchId,
          status: 'pending' as const
        }));

        // 保存到数据库
        const service = getCurrentService();
        await service.saveBankTransactions(transactionsWithMeta);

        setTransactions(transactionsWithMeta);
        setParseErrors(result.errors);

        if (result.transactions.length === 0) {
          showToast('error', '未找到有效的交易记录');
          setIsProcessing(false);
          return;
        }

        if (result.errors.length > 0) {
          showToast('warning', `解析完成，有 ${result.errors.length} 个警告`);
        } else {
          showToast('success', `成功解析并保存 ${result.transactions.length} 条记录`);
        }

        setShowPreview(true);

        // 自动选择默认银行科目
        if (!selectedBankAccountId && DEFAULT_BANK_ACCOUNTS.length > 0) {
          setSelectedBankAccountId(DEFAULT_BANK_ACCOUNTS[0].id);
        }
      }
    } catch (error) {
      console.error('Parse error:', error);
      showToast('error', '解析文件失败，请检查格式是否正确');
    } finally {
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

  const handleGenerateVouchers = async () => {
    // 优先使用勾选的交易，否则使用全部匹配的交易
    const targetIds = selectedTxIds.size > 0 ? selectedTxIds : null;
    const matchedTransactions = transactions.filter(t =>
      (targetIds ? targetIds.has(t.id) : true) &&
      (t.matchedSubject || t.debit || t.credit)
    );
    if (matchedTransactions.length === 0) {
      showToast('error', targetIds ? '选中的记录中没有可生成的交易' : '没有有效的交易记录');
      return;
    }

    if (!selectedBankAccountId) {
      showToast('error', '请先选择银行账户');
      return;
    }

    setIsProcessing(true);

    try {
      const service = getCurrentService();
      const now = new Date().toISOString();
      let successCount = 0;
      let errorCount = 0;

      // 为每笔匹配的交易生成凭证
      for (const transaction of matchedTransactions) {
        try {
          // 获取银行科目信息
          const bankAccount = DEFAULT_BANK_ACCOUNTS.find(a => a.id === selectedBankAccountId);
          const bankSubjectCode = bankAccount?.subjectCode || '1002';
          const bankSubjectName = bankAccount?.name || '银行存款';

          // 确定金额和方向
          const isDebit = !!transaction.debit;
          const amount = transaction.debit || transaction.credit || 0;

          // 生成凭证ID和凭证号
          const voucherId = `voucher_${Date.now()}_${transaction.id}`;
          const voucherNo = await generateVoucherNo(transaction.date);

          // 创建凭证分录
          const entries: any[] = [];

          // 交易分录（对方科目）
          const transactionEntry: any = {
            id: `entry_${voucherId}_0`,
            voucherId,
            date: transaction.date,
            summary: transaction.summary || transaction.notes || '银行交易',
            subjectCode: transaction.matchedSubject || '6603',
            subjectName: transaction.matchedSubjectName || '财务费用',
            debit: isDebit ? 0 : amount,
            credit: isDebit ? amount : 0,
            customerName: transaction.counterpartyName,
            supplierName: transaction.counterpartyName,
            auxiliary: {},
            docNo: transaction.transactionSerialNo
          };
          entries.push(transactionEntry);

          // 银行存款分录（平衡分录）
          const bankEntry: any = {
            id: `entry_${voucherId}_1`,
            voucherId,
            date: transaction.date,
            summary: transaction.summary || '银行存款',
            subjectCode: bankSubjectCode,
            subjectName: bankSubjectName,
            debit: isDebit ? amount : 0,
            credit: isDebit ? 0 : amount
          };
          entries.push(bankEntry);

          // 创建凭证对象
          const voucher = {
            id: voucherId,
            voucherNo,
            date: transaction.date,
            summary: transaction.summary || transaction.notes || '银行交易',
            entries,
            status: 'draft' as const,
            voucherType: isDebit ? 'receipt' as const : 'payment' as const,
            createdBy: 'system',
            createTime: now,
            updateTime: now
          };

          // 保存凭证
          await service.saveVoucher(voucher);

          // 更新银行流水状态
          await service.updateBankTransaction(transaction.id, {
            status: 'voucher_generated',
            voucherId,
            generatedVoucherNo: voucherNo
          });

          successCount++;
        } catch (error) {
          console.error('生成凭证失败:', transaction.id, error);
          errorCount++;
        }
      }

      // 从列表中移除已生成凭证的流水
      setTransactions(prev => prev.filter(t => t.status !== 'voucher_generated'));

      if (successCount > 0) {
        showToast('success', `成功生成 ${successCount} 张凭证${errorCount > 0 ? `，${errorCount} 条失败` : ''}`);
      } else {
        showToast('error', '生成凭证失败');
      }

      // 刷新凭证列表
      const { useVoucherStore } = await import('@/stores');
      const voucherStore = useVoucherStore.getState();
      await voucherStore.initialize();

    } catch (error) {
      console.error('Generate vouchers error:', error);
      showToast('error', '生成凭证失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 生成凭证号的辅助函数
  const generateVoucherNo = async (date: string): Promise<string> => {
    const yearMonth = date.substring(0, 7).replace('-', '');
    const service = getCurrentService();

    // 获取当前月份的所有凭证
    const allVouchers = await service.getAllVouchers();
    const currentMonthVouchers = allVouchers.filter((v: any) =>
      v.voucherNo && v.voucherNo.startsWith(`记-${yearMonth}-`)
    );

    let maxSeq = 0;
    for (const v of currentMonthVouchers) {
      const match = v.voucherNo?.match(/-(\d{3})$/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    const newSeq = maxSeq + 1;
    return `记-${yearMonth}-${String(newSeq).padStart(3, '0')}`;
  };

  const handleManualSubjectSelect = async (txId: string, code: string, name: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === txId
        ? { ...t, matchedSubject: code, matchedSubjectName: name, status: 'matched' as const }
        : t
    ));
    setEditingSubjectTxId(null);

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

  const handleClearTransactions = async () => {
    try {
      const service = getCurrentService();
      await service.clearBankTransactions();
      setTransactions([]);
      setShowPreview(false);
      setCurrentBatchId(null);
      showToast('success', '已清空所有流水');
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
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
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
                accounts={DEFAULT_BANK_ACCOUNTS}
                selectedAccountId={selectedBankAccountId}
                onSelectAccount={setSelectedBankAccountId}
                label="选择银行科目（生成凭证时的平衡分录）"
              />
            </CardContent>
          </Card>

          {/* 统计信息 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              onClick={handleGenerateVouchers}
              disabled={isProcessing || transactions.filter(t => t.status === 'matched').length === 0}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {selectedTxIds.size > 0
                    ? `生成凭证 (${selectedTxIds.size}条)`
                    : '生成凭证 (全部)'}
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
              清空流水
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
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1">
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
                            className="rounded border-slate-300"
                          />
                          <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="font-mono text-sm flex-shrink-0">{transaction.date}</span>
                          <span className="flex-1">{transaction.summary || transaction.notes}</span>
                          {transaction.counterpartyName && (
                            <span className="text-sm text-slate-500 flex-shrink-0">
                              对方: {transaction.counterpartyName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          {/* 对方科目列 */}
                          <div className="text-sm flex-shrink-0">
                            <span className="text-slate-500">对方科目: </span>
                            {editingSubjectTxId === transaction.id ? (
                              <div className="border rounded-md w-56" onClick={e => e.stopPropagation()}>
                                <SubjectSearch
                                  value=""
                                  onSelect={(code, name) => handleManualSubjectSelect(transaction.id, code, name)}
                                  placeholder="搜索科目..."
                                  showDirection={false}
                                  showType={false}
                                />
                              </div>
                            ) : (
                              <span
                                className={`font-medium ${transaction.matchedSubject ? 'text-blue-700' : 'text-slate-400 cursor-pointer hover:text-blue-500 underline decoration-dashed'}`}
                                onClick={() => setEditingSubjectTxId(transaction.id)}
                              >
                                {transaction.matchedSubject ? `${transaction.matchedSubject} - ${transaction.matchedSubjectName}` : '点击选择'}
                              </span>
                            )}
                          </div>
                          {/* 金额 */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {transaction.debit ? (
                              <span className="font-medium text-blue-600">
                                借: ¥{transaction.debit.toLocaleString()}
                              </span>
                            ) : null}
                            {transaction.credit ? (
                              <span className="font-medium text-red-600">
                                贷: ¥{transaction.credit.toLocaleString()}
                              </span>
                            ) : null}
                            {getStatusBadge(record.status)}
                          </div>
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
    </div>
  );
}
