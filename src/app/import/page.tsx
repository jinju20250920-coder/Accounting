'use client';

import React, { useState, useRef } from 'react';
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
  BarChart3
} from 'lucide-react';
import { TransactionImport } from '@/components/transaction-import';
import { ImportHistory } from '@/components/import-history';

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [importType, setImportType] = useState<'bank' | 'tax'>('bank');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">流水导入</h1>
        <p className="text-slate-600 mt-1">导入银行流水和税务流水，自动生成记账凭证</p>
      </div>

      {/* 导入类型选择 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            导入类型
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={importType === 'bank' ? 'default' : 'outline'}
              onClick={() => setImportType('bank')}
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              银行流水导入
            </Button>
            <Button
              variant={importType === 'tax' ? 'default' : 'outline'}
              onClick={() => setImportType('tax')}
              className="flex items-center gap-2"
            >
              <Receipt className="h-4 w-4" />
              税务流水导入
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 主要内容 */}
      <div className="grid grid-cols-1 gap-6">
        {/* 左侧：导入功能 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {importType === 'bank' ? '银行流水导入' : '税务流水导入'}
                </CardTitle>
                <Badge variant="outline">
                  {importType === 'bank' ? '支持 Excel/CSV' : '支持 Excel'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'upload' && (
                <TransactionImport importType={importType} />
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
                <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">建设银行流水</p>
                      <p className="text-xs text-muted-foreground">2026-03-10 14:30</p>
                    </div>
                  </div>
                  <Badge variant="default">成功</Badge>
                </div>
                <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">增值税发票</p>
                      <p className="text-xs text-muted-foreground">2026-03-09 10:15</p>
                    </div>
                  </div>
                  <Badge variant="default">成功</Badge>
                </div>
                <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">工商银行流水</p>
                      <p className="text-xs text-muted-foreground">2026-03-08 16:45</p>
                    </div>
                  </div>
                  <Badge variant="destructive">部分失败</Badge>
                </div>
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
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  下载税务流水模板
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