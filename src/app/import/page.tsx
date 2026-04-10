'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Eye,
  Trash2,
  Filter,
  Calendar,
  Building2,
  Receipt,
  BarChart3,
  Loader2
} from 'lucide-react';
import { TransactionImport } from '@/components/transaction-import';
import { ImportHistory } from '@/components/import-history';
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
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [importType, setImportType] = useState<'bank' | 'tax'>('bank');
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // 加载最近导入记录
  useEffect(() => {
    loadRecentImports();
  }, []);

  const loadRecentImports = async () => {
    setLoadingRecent(true);
    try {
      const service = getCurrentService();
      const allTransactions = await service.getAllBankTransactions();

      // 按批次分组，获取最近的导入记录
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
        // 使用最早的createTime作为导入时间
        if (tx.createTime && tx.createTime < batch.date) {
          batch.date = tx.createTime;
        }
      }

      // 转换为 RecentImport 格式，按日期倒序排列，取最近5条
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
      {/* 标题栏 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">银行流水导入</h1>
        <p className="text-slate-600 mt-1">导入银行流水，自动生成记账凭证</p>
      </div>


      {/* 主要内容 */}
      <div className="grid grid-cols-1 gap-6">
        {/* 左侧：导入功能 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>银行流水导入</CardTitle>
                <Badge variant="outline">支持 Excel/CSV</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'upload' && (
                <TransactionImport importType="bank" />
              )}
              {activeTab === 'history' && (
                <ImportHistory importType={importType} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：帮助信息 */}
        <div className="space-y-4">
          {/* 导入说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">导入说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">文件格式</p>
                  <p className="text-xs text-muted-foreground">
                    支持 .xlsx, .xls, .csv 格式，文件大小不超过 10MB
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">自动匹配</p>
                  <p className="text-xs text-muted-foreground">
                    系统会根据交易描述智能匹配会计科目
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">批量生成</p>
                  <p className="text-xs text-muted-foreground">
                    导入成功后自动生成记账凭证，支持批量审核
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 最近导入记录 */}
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

          {/* 下载模板 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">下载模板</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  下载银行流水模板
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 标签页切换 */}
      <div className="flex gap-4 mt-6 border-t pt-4">
        <Button
          variant={activeTab === 'upload' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('upload')}
        >
          上传导入
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('history')}
        >
          导入历史
        </Button>
      </div>
    </div>
  );
}