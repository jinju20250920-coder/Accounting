'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Trash2,
  Filter,
  Download,
  BarChart3,
  TrendingUp,
  Search
} from 'lucide-react';

interface ImportRecord {
  id: string;
  name: string;
  type: 'bank' | 'tax';
  uploadDate: string;
  status: 'success' | 'partial' | 'failed';
  recordCount: number;
  matchedCount: number;
  voucherCount: number;
  fileSize: number;
  processingTime: number;
  errorCount?: number;
  previewUrl?: string;
}

export function ImportHistory({ importType }: { importType: 'bank' | 'tax' }) {
  // 模拟导入历史数据
  const importRecords: ImportRecord[] = ([
    {
      id: '1',
      name: '建设银行流水_202603.xlsx',
      type: 'bank' as const,
      uploadDate: '2026-03-10 14:30:25',
      status: 'success' as const,
      recordCount: 156,
      matchedCount: 156,
      voucherCount: 45,
      fileSize: 2.5,
      processingTime: 3.2
    },
    {
      id: '1',
      name: '建设银行流水_202603.xlsx',
      type: 'bank',
      uploadDate: '2026-03-10 14:30:25',
      status: 'success',
      recordCount: 156,
      matchedCount: 156,
      voucherCount: 45,
      fileSize: 2.5,
      processingTime: 3.2
    },
    {
      id: '2',
      name: '增值税申报表_202603.xlsx',
      type: 'tax' as const,
      uploadDate: '2026-03-09 10:15:42',
      status: 'success' as const,
      recordCount: 89,
      matchedCount: 89,
      voucherCount: 23,
      fileSize: 1.8,
      processingTime: 2.1
    },
    {
      id: '3',
      name: '工商银行流水_202603.csv',
      type: 'bank' as const,
      uploadDate: '2026-03-08 16:45:18',
      status: 'partial' as const,
      recordCount: 203,
      matchedCount: 198,
      voucherCount: 58,
      errorCount: 5,
      fileSize: 3.2,
      processingTime: 4.5
    },
    {
      id: '4',
      name: '企业所得税预缴_202602.xlsx',
      type: 'tax' as const,
      uploadDate: '2026-03-05 09:20:15',
      status: 'failed' as const,
      recordCount: 45,
      matchedCount: 0,
      voucherCount: 0,
      errorCount: 45,
      fileSize: 1.2,
      processingTime: 0.8
    }
  ] as ImportRecord[]).filter(record => importType === 'bank' ? record.type === 'bank' : record.type === 'tax');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'partial' | 'failed'>('all');
  const [selectedRecord, setSelectedRecord] = useState<ImportRecord | null>(null);

  // 过滤记录
  const filteredRecords = useMemo(() => {
    return importRecords.filter(record => {
      const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [importRecords, searchTerm, statusFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const total = importRecords.length;
    const success = importRecords.filter(r => r.status === 'success').length;
    const partial = importRecords.filter(r => r.status === 'partial').length;
    const failed = importRecords.filter(r => r.status === 'failed').length;
    const totalRecords = importRecords.reduce((sum, r) => sum + r.recordCount, 0);
    const totalMatched = importRecords.reduce((sum, r) => sum + r.matchedCount, 0);
    const totalVouchers = importRecords.reduce((sum, r) => sum + r.voucherCount, 0);

    return { total, success, partial, failed, totalRecords, totalMatched, totalVouchers };
  }, [importRecords]);

  const getStatusBadge = (status: ImportRecord['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">成功</Badge>;
      case 'partial':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">部分成功</Badge>;
      case 'failed':
        return <Badge variant="destructive">失败</Badge>;
    }
  };

  const formatFileSize = (size: number) => {
    return `${size.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    return `${seconds.toFixed(1)} 秒`;
  };

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">导入次数</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">成功率</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(0) : 0}%
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
                <p className="text-sm text-muted-foreground">处理记录</p>
                <p className="text-2xl font-bold">
                  {stats.totalRecords.toLocaleString()}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">生成凭证</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.totalVouchers}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="搜索文件名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                全部
              </Button>
              <Button
                variant={statusFilter === 'success' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('success')}
              >
                成功
              </Button>
              <Button
                variant={statusFilter === 'partial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('partial')}
              >
                部分
              </Button>
              <Button
                variant={statusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('failed')}
              >
                失败
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 导入记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>导入历史记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredRecords.map((record) => (
              <div key={record.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">{record.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {record.uploadDate}
                        </span>
                        <span>{formatFileSize(record.fileSize)}</span>
                        <span>处理时间: {formatDuration(record.processingTime)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(record.status)}
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(record)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 处理结果 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-sm text-muted-foreground">记录数</p>
                    <p className="font-bold">{record.recordCount}</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <p className="text-sm text-muted-foreground">已匹配</p>
                    <p className="font-bold text-green-600">{record.matchedCount}</p>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <p className="text-sm text-muted-foreground">生成凭证</p>
                    <p className="font-bold text-blue-600">{record.voucherCount}</p>
                  </div>
                  {record.errorCount && (
                    <div className="text-center p-2 bg-red-50 rounded">
                      <p className="text-sm text-muted-foreground">错误数</p>
                      <p className="font-bold text-red-600">{record.errorCount}</p>
                    </div>
                  )}
                </div>

                {/* 错误信息 */}
                {record.status === 'failed' && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800">导入失败</p>
                        <p className="text-xs text-red-600 mt-1">
                          文件格式不正确或数据缺失，请检查后重新上传
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {record.status === 'partial' && record.errorCount && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">
                          {record.errorCount} 条记录未匹配成功
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          请检查未匹配的记录或手动调整科目
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>暂无导入记录</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">导入详情</h3>
                <Button variant="ghost" onClick={() => setSelectedRecord(null)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">基本信息</h4>
                  <div className="bg-gray-50 p-4 rounded">
                    <p><strong>文件名：</strong>{selectedRecord.name}</p>
                    <p><strong>上传时间：</strong>{selectedRecord.uploadDate}</p>
                    <p><strong>文件大小：</strong>{formatFileSize(selectedRecord.fileSize)}</p>
                    <p><strong>处理时间：</strong>{formatDuration(selectedRecord.processingTime)}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">处理结果</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded">
                      <p className="text-sm text-green-600">成功匹配</p>
                      <p className="text-2xl font-bold text-green-700">{selectedRecord.matchedCount}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded">
                      <p className="text-sm text-blue-600">生成凭证</p>
                      <p className="text-2xl font-bold text-blue-700">{selectedRecord.voucherCount}</p>
                    </div>
                    {selectedRecord.errorCount && (
                      <div className="bg-red-50 p-4 rounded">
                        <p className="text-sm text-red-600">匹配失败</p>
                        <p className="text-2xl font-bold text-red-700">{selectedRecord.errorCount}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button className="flex-1">
                    重新处理
                  </Button>
                  <Button variant="outline" className="flex-1">
                    导出日志
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}