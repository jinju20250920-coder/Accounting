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

interface TransactionRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  type: 'debit' | 'credit';
  matchedSubject?: string;
  matchedSubjectName?: string;
  confidence?: number;
  status: 'pending' | 'matched' | 'unmatched' | 'error';
}

interface TransactionImportProps {
  importType: 'bank' | 'tax';
}

export function TransactionImport({ importType }: TransactionImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { addVoucherFromTransactions } = useVoucherStore();

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

    // 模拟文件处理延迟
    setTimeout(() => {
      const mockData = importType === 'bank' ? mockBankTransactions : mockTaxTransactions;
      setTransactions(mockData);
      setIsProcessing(false);
      setShowPreview(true);
    }, 2000);
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
      if (t.status === 'pending') {
        // 简单的匹配逻辑
        let subject = '';
        let subjectName = '';
        let confidence = 0.8;

        if (t.description.includes('收入') || t.description.includes('销售')) {
          subject = '6001';
          subjectName = '主营业务收入';
          confidence = 0.9;
        } else if (t.description.includes('采购') || t.description.includes('材料')) {
          subject = '1405';
          subjectName = '原材料';
          confidence = 0.85;
        } else if (t.description.includes('工资')) {
          subject = '6602';
          subjectName = '管理费用-工资';
          confidence = 0.95;
        } else if (t.description.includes('税')) {
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
      }
      return t;
    }));
  };

  const handleGenerateVouchers = async () => {
    const matchedTransactions = transactions.filter(t => t.status === 'matched');
    if (matchedTransactions.length === 0) {
      alert('请先匹配科目');
      return;
    }

    setIsProcessing(true);

    // 模拟生成凭证
    setTimeout(() => {
      const vouchers = matchedTransactions.map(t => ({
        id: `voucher_${Date.now()}_${t.id}`,
        date: t.date,
        description: t.description,
        entries: [{
          subject: t.matchedSubject!,
          subjectName: t.matchedSubjectName!,
          debit: t.type === 'debit' ? Math.abs(t.amount) : 0,
          credit: t.type === 'credit' ? Math.abs(t.amount) : 0
        }]
      }));

      // 添加到凭证存储
      vouchers.forEach(voucher => {
        addVoucherFromTransactions(voucher);
      });

      setIsProcessing(false);
      alert(`成功生成 ${vouchers.length} 张凭证`);
    }, 1500);
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
                      ¥{transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0).toLocaleString()}
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
              disabled={isProcessing || transactions.filter(t => t.status === 'matched').length === 0}
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
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="font-mono text-sm">{transaction.date}</span>
                        <span className="flex-1">{transaction.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount > 0 ? '+' : ''}¥{Math.abs(transaction.amount).toLocaleString()}
                        </span>
                        {getStatusBadge(transaction.status)}
                      </div>
                    </div>

                    {/* AI推荐 */}
                    {transaction.status === 'pending' && (
                      <div className="mt-3 pt-3 border-t">
                        <AISubjectRecommendation
                          summary={transaction.description}
                          amount={Math.abs(transaction.amount)}
                          onSelect={(subject, subjectName) =>
                            handleMatchSubject(transaction.id, subject, subjectName)
                          }
                        />
                      </div>
                    )}

                    {/* 已匹配显示结果 */}
                    {transaction.status === 'matched' && (
                      <div className="mt-3 pt-3 border-t bg-green-50 rounded">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">
                            已匹配至：{transaction.matchedSubject} - {transaction.matchedSubjectName}
                          </span>
                          {transaction.confidence && (
                            <Badge variant="outline" className="text-xs">
                              匹配度: {Math.round(transaction.confidence * 100)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}