'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  CheckCircle,
  Download,
  Calendar,
  Building2,
  BarChart3,
  Loader2,
  List,
} from 'lucide-react';
import { TransactionImport } from '@/components/transaction-import';
import { BankStatementsList } from '@/components/bank-statements-list';
import { getCurrentService } from '@/lib/database';

interface RecentImport {
  id: string;
  name: string;
  type: 'bank';
  date: string;
  status: 'success' | 'partial' | 'failed';
  recordCount: number;
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'list'>('import');
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    loadRecentImports();
  }, []);

  const loadRecentImports = async () => {
    setLoadingRecent(true);
    try {
      const service = getCurrentService();
      const allTransactions = await service.getAllBankTransactions();

      const batchMap = new Map<string, { batchId: string; date: string; count: number; statuses: Set<string> }>();
      for (const tx of allTransactions) {
        const batchId = tx.importBatchId || 'unknown';
        if (!batchMap.has(batchId)) {
          batchMap.set(batchId, {
            batchId,
            date: tx.createTime || tx.date,
            count: 0,
            statuses: new Set()
          });
        }
        const batch = batchMap.get(batchId)!;
        batch.count++;
        batch.statuses.add(tx.status);
        if (tx.createTime && tx.createTime < batch.date) {
          batch.date = tx.createTime;
        }
      }

      const imports: RecentImport[] = Array.from(batchMap.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map(batch => ({
          id: batch.batchId,
          name: batch.batchId.startsWith('batch_')
            ? `银行流水_${batch.date.split('T')[0].replace(/-/g, '')}`
            : batch.batchId,
          type: 'bank' as const,
          date: batch.date,
          status: batch.statuses.has('voucher_generated')
            ? 'success' as const
            : batch.statuses.has('pending')
              ? 'partial' as const
              : 'success' as const,
          recordCount: batch.count
        }));

      setRecentImports(imports);
    } catch (error) {
      console.error('加载最近导入记录失败:', error);
    } finally {
      setLoadingRecent(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题 + Tab 切换 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">资金管理</h1>
          <p className="text-slate-600 mt-1">导入银行流水，自动生成记账凭证</p>
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          <Button
            variant={activeTab === 'import' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('import')}
            className="rounded-none"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            流水导入
          </Button>
          <Button
            variant={activeTab === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('list')}
            className="rounded-none"
          >
            <List className="h-4 w-4 mr-1.5" />
            银行流水
          </Button>
        </div>
      </div>

      {/* 流水导入 - 始终渲染以保留数据状态 */}
      <div className={activeTab === 'import' ? '' : 'hidden'}>
        <div className="grid grid-cols-1 gap-6">
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>银行流水导入</CardTitle>
                  <Badge variant="outline">支持 Excel/CSV</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <TransactionImport importType="bank" />
              </CardContent>
            </Card>
          </div>

          {/* 导入说明 - 横向排列 */}
          <Card>
            <CardContent className="pt-5">
              <div className="grid grid-cols-3 gap-6">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">文件格式</p>
                    <p className="text-xs text-slate-500">.xlsx / .xls / .csv，不超过 10MB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">智能匹配</p>
                    <p className="text-xs text-slate-500">根据交易描述自动匹配会计科目</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">批量生成</p>
                    <p className="text-xs text-slate-500">自动生成记账凭证，支持批量过账</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 最近导入 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                最近导入
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loadingRecent ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : recentImports.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-400">
                    暂无导入记录
                  </div>
                ) : (
                  recentImports.map((imp) => (
                    <div key={imp.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">{imp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {imp.date ? new Date(imp.date).toLocaleString('zh-CN') : '-'}
                            {imp.recordCount > 0 && ` · ${imp.recordCount}条`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={imp.status === 'failed' ? 'destructive' : 'default'}>
                        {imp.status === 'success' ? '成功' : imp.status === 'partial' ? '部分成功' : '失败'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 银行流水 - 始终渲染以保留状态 */}
      <div className={activeTab === 'list' ? '' : 'hidden'}>
        <BankStatementsList />
      </div>
    </div>
  );
}
