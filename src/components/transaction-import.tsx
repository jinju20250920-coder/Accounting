'use client';

import React, { useState, useRef } from 'react';
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
  Zap
} from 'lucide-react';
import { useVoucherStore } from '@/stores';
import { AISubjectRecommendation } from '@/components/ai-subject-recommendation';
import { parseBankStatement } from '@/lib/parser';
import { BankAccountSelector, DEFAULT_BANK_ACCOUNTS } from '@/components/bank-account-selector';
import { useToast } from '@/components/ui/toast';
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
      status: 'pending'
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
  const [bankInfo, setBankInfo] = useState<{ bankName: string; accountName: string; accountNumber: string } | null>(null);
  const { addVoucherFromTransactions } = useVoucherStore();
  const { showToast } = useToast();

  // 模拟银行流水数据
  const mockBankTransactions: TransactionRecord[] = [
    {
      id: '1',
      date: '2026-03-10',
      description: '销售收入-客户A',
      amount: 50000,
      balance: 250000,
      type: 'debit',
      status: 'pending'
    },
    {
      id: '2',
      date: '2026-03-09',
      description: '采购材料-供应商B',
      amount: -30000,
      balance: 200000,
      type: 'credit',
      status: 'pending'
    },
    {
      id: '3',
      date: '2026-03-08',
      description: '工资发放',
      amount: -50000,
      balance: 230000,
      type: 'credit',
      status: 'pending'
    },
    {
      id: '4',
      date: '2026-03-07',
      description: '收到投资款',
      amount: 100000,
      balance: 280000,
      type: 'debit',
      status: 'pending'
    }
  ];

  // 模拟税务流水数据
  const mockTaxTransactions: TransactionRecord[] = [
    {
      id: '1',
      date: '2026-03-15',
      description: '增值税进项税',
      amount: 13000,
      balance: 13000,
      type: 'debit',
      status: 'pending'
    },
    {
      id: '2',
      date: '2026-03-10',
      description: '增值税销项税',
      amount: -8500,
      balance: 21500,
      type: 'credit',
      status: 'pending'
    },
    {
      id: '3',
      date: '2026-03-05',
      description: '企业所得税',
      amount: 25000,
      balance: 30000,
      type: 'credit',
      status: 'pending'
    }
  ];

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
        alert(`请选择${importType === 'bank' ? 'Excel或CSV' : 'Excel'}文件`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('文件大小不能超过10MB');
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
        setTransactions(result.transactions);
        setParseErrors(result.errors);

        if (result.transactions.length === 0) {
          showToast('error', '未找到有效的交易记录');
          setIsProcessing(false);
          return;
        }

        if (result.errors.length > 0) {
          showToast('warning', `解析完成，有 ${result.errors.length} 个警告`);
        } else {
          showToast('success', `成功解析 ${result.transactions.length} 条记录`);
        }

        setShowPreview(true);
      } else {
        // 税务流水 - 保留原有的 mock 逻辑
        setTimeout(() => {
          const mockData = mockTaxTransactions;
          setTransactions(mockData as any);
          setIsProcessing(false);
          setShowPreview(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Parse error:', error);
      showToast('error', '解析文件失败，请检查格式是否正确');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMatchSubject = (id: string, subject: string, subjectName: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === id
        ? { ...t, matchedSubject: subject, matchedSubjectName: subjectName, status: 'matched' }
        : t
    ));
  };

  const handleAutoMatch = () => {
    // 模拟自动匹配
    setTransactions(prev => prev.map(t => {
      // 简单的匹配逻辑
      let subject = '';
      let subjectName = '';
      let confidence = 0.8;

      const description = t.summary || t.notes || '';

      if (description.includes('收入') || description.includes('销售')) {
        subject = '6001';
        subjectName = '主营业务收入';
        confidence = 0.9;
      } else if (description.includes('采购') || description.includes('材料')) {
        subject = '1405';
        subjectName = '原材料';
        confidence = 0.85;
      } else if (description.includes('工资')) {
        subject = '6602';
        subjectName = '管理费用-工资';
        confidence = 0.95;
      } else if (description.includes('税')) {
        subject = '2221';
        subjectName = '应交税费';
        confidence = 0.9;
      }

      if (subject) {
        return {
          ...t,
          matchedSubject: subject,
          matchedSubjectName: subjectName,
          confidence,
          status: 'matched'
        };
      }

      return { ...t, status: t.status || 'pending' };
    }));
  };

  const handleGenerateVouchers = async () => {
    const matchedTransactions = transactions.filter(t => t.debit || t.credit);
    if (matchedTransactions.length === 0) {
      showToast('error', '没有有效的交易记录');
      return;
    }

    if (!selectedBankAccountId) {
      showToast('error', '请先选择银行账户');
      return;
    }

    setIsProcessing(true);

    try {
      // 这里需要实现从银行交易生成凭证的逻辑
      // 暂时显示成功消息
      showToast('success', `准备生成 ${matchedTransactions.length} 张凭证`);

      // TODO: 实际的凭证生成逻辑
      // 1. 对每笔交易进行AI科目匹配
      // 2. 创建凭证分录
      // 3. 生成平衡分录（银行存款）
      // 4. 保存凭证

    } catch (error) {
      console.error('Generate vouchers error:', error);
      showToast('error', '生成凭证失败');
    } finally {
      setIsProcessing(false);
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
          {/* 银行账户选择 */}
          <Card className="mb-4">
            <CardContent className="p-4">
              {bankInfo && (
                <div className="mb-4 p-3 bg-slate-50 rounded-md">
                  <p className="text-sm text-slate-600 mb-1">
                    <span className="font-medium">账户信息:</span> {bankInfo.bankName} | {bankInfo.accountName} | {bankInfo.accountNumber}
                  </p>
                </div>
              )}
              <BankAccountSelector
                accounts={DEFAULT_BANK_ACCOUNTS}
                selectedAccountId={selectedBankAccountId}
                onSelectAccount={setSelectedBankAccountId}
                label="请选择对应的银行科目（用于平衡分录）"
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
                      {transactions.filter(t => (t as any).status === 'matched').length}
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
                      {transactions.filter(t => !(t as any).status || (t as any).status === 'pending').length}
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
          <div className="flex gap-2">
            <Button onClick={handleAutoMatch} disabled={isProcessing}>
              <Zap className="h-4 w-4 mr-2" />
              智能匹配
            </Button>
            <Button
              onClick={handleGenerateVouchers}
              disabled={isProcessing || transactions.filter(t => (t as any).status === 'matched').length === 0}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  生成凭证
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              重新上传
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
                    <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1">
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
                            <span className="font-medium text-blue-700">
                              {transaction.matchedSubject ? `${transaction.matchedSubject} - ${transaction.matchedSubjectName}` : '待匹配'}
                            </span>
                          </div>
                          {/* 金额 */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {transaction.debit && (
                              <span className="font-medium text-blue-600">
                                借: ¥{transaction.debit.toLocaleString()}
                              </span>
                            )}
                            {transaction.credit && (
                              <span className="font-medium text-red-600">
                                贷: ¥{transaction.credit.toLocaleString()}
                              </span>
                            )}
                            {getStatusBadge(record.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}