'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  Users,
  Package,
  FileText,
  Type,
  Database,
  Download,
  Upload,
  RotateCcw,
  HardDrive,
  FolderOpen as FolderIcon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  useSubjectStore,
  useDepartmentStore,
  useFinancialProjectStore,
  useSummaryStore,
  useVoucherTemplateStore,
  useAccountSetStore
} from '@/stores';
import { accountSetDbManager } from '@/lib/database/account-set-db-manager';
import { fileHandleManager, FileHandleManager } from '@/lib/database/file-handle-manager';
import { DbStatusIndicator } from '@/components/database/db-status-indicator';
import { FilePickerDialog } from '@/components/database/file-picker-dialog';
import type { AccountSetHandleInfo } from '@/lib/database/file-handle-manager';

export default function SettingsPage() {
  const { showToast } = useToast();
  const { subjects } = useSubjectStore();
  const { departments } = useDepartmentStore();
  const { projects } = useFinancialProjectStore();
  const { commonSummaries } = useSummaryStore();
  const { templates } = useVoucherTemplateStore();
  const { currentAccountSetId, accountSets } = useAccountSetStore();

  // 获取当前账套对象
  const currentAccountSet = currentAccountSetId
    ? accountSets.find(as => as.id === currentAccountSetId)
    : null;

  // 数据库状态
  const [dbInfo, setDbInfo] = useState<AccountSetHandleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const stats = [
    {
      label: '科目管理',
      value: 'subjects',
      icon: <FolderOpen className="h-5 w-5" />,
      count: subjects.length,
      description: '管理会计科目体系，支持多级科目和辅助核算',
      color: 'bg-blue-500'
    },
    {
      label: '部门管理',
      value: 'departments',
      icon: <Users className="h-5 w-5" />,
      count: departments.length,
      description: '管理组织架构，支持多级部门设置',
      color: 'bg-green-500'
    },
    {
      label: '项目管理',
      value: 'projects',
      icon: <Package className="h-5 w-5" />,
      count: projects.length,
      description: '管理财务项目档案，支持收入、成本、其他类型',
      color: 'bg-purple-500'
    },
    {
      label: '常用摘要库',
      value: 'summaries',
      icon: <Type className="h-5 w-5" />,
      count: commonSummaries.length,
      description: '管理常用摘要，快速录入凭证摘要',
      color: 'bg-orange-500'
    },
    {
      label: '凭证模版',
      value: 'templates',
      icon: <FileText className="h-5 w-5" />,
      count: templates.length,
      description: '管理凭证模版，支持Excel导入导出',
      color: 'bg-cyan-500'
    }
  ];

  // 获取当前账套的数据库信息
  useEffect(() => {
    const loadDbInfo = async () => {
      if (!currentAccountSet) {
        setDbInfo(null);
        return;
      }

      try {
        const info = await accountSetDbManager.getAccountSetInfo(currentAccountSet.id);
        setDbInfo(info);
      } catch (error) {
        console.error('Failed to load database info:', error);
        setDbInfo(null);
      }
    };

    loadDbInfo();
  }, [currentAccountSet]);

  // 下载备份数据库
  const handleDownloadDatabase = async () => {
    if (!currentAccountSet) {
      showToast('error', '请先选择一个账套');
      return;
    }

    setIsLoading(true);
    try {
      const db = accountSetDbManager.getDatabase(currentAccountSet.id);
      if (!db) {
        showToast('error', '数据库未打开');
        return;
      }

      const data = db.export();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentAccountSet.name}_${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('success', '数据库已下载');
    } catch (error) {
      console.error('Download failed:', error);
      showToast('error', '下载失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 上传数据库
  const handleUploadDatabase = () => {
    if (!currentAccountSet) {
      showToast('error', '请先选择一个账套');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsLoading(true);
        try {
          const arrayBuffer = await file.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);

          // 保存到当前数据库
          const db = accountSetDbManager.getDatabase(currentAccountSet.id);
          if (!db) {
            showToast('error', '数据库未打开');
            return;
          }

          // 导入数据
          const SQL = await (await import('sql.js')).default;
          const newDb = new SQL.Database(data);
          const exported = newDb.export();

          // 更新当前数据库
          const currentDb = accountSetDbManager.getDatabase(currentAccountSet.id);
          if (currentDb) {
            // 保存更改
            await accountSetDbManager.saveAccountSetDatabase(currentAccountSet.id);
          }

          showToast('success', '数据库导入成功，页面将刷新');
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          console.error('Upload failed:', error);
          showToast('error', '导入失败');
        } finally {
          setIsLoading(false);
        }
      }
    };
    input.click();
  };

  // 更换数据库文件位置
  const handleChangeDatabaseFile = () => {
    if (!currentAccountSet) {
      showToast('error', '请先选择一个账套');
      return;
    }
    setShowFilePicker(true);
  };

  // 确认更换数据库文件
  const handleConfirmChangeFile = async (handle: FileSystemFileHandle, fileName: string) => {
    if (!currentAccountSet) return;

    setIsLoading(true);
    try {
      // 保存句柄
      await fileHandleManager.saveHandle(
        currentAccountSet.id,
        currentAccountSet.name,
        fileName,
        handle,
        'fsa'
      );

      // 读取现有数据库
      const currentDb = accountSetDbManager.getDatabase(currentAccountSet.id);
      if (currentDb) {
        // 写入新文件
        const writable = await handle.createWritable();
        await writable.write(currentDb.export());
        await writable.close();
      }

      showToast('success', '数据库文件位置已更改');
      // 刷新信息
      const info = await accountSetDbManager.getAccountSetInfo(currentAccountSet.id);
      setDbInfo(info);
    } catch (error) {
      console.error('Change file failed:', error);
      showToast('error', '更换文件位置失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 重置数据库
  const handleResetDatabase = async () => {
    if (!currentAccountSet) {
      showToast('error', '请先选择一个账套');
      return;
    }

    setIsLoading(true);
    try {
      await accountSetDbManager.deleteAccountSetDatabase(currentAccountSet.id);
      showToast('success', '数据库已重置，页面将刷新');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Reset failed:', error);
      showToast('error', '重置失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '未知';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // 格式化日期
  const formatDate = (timestamp: number | null | undefined): string => {
    if (!timestamp) return '未知';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const isFSA = dbInfo?.storageType === 'fsa';
  const isOPFS = dbInfo?.storageType === 'opfs';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">基础档案</h1>
        <p className="text-slate-600 mt-1">管理会计科目、部门组织、项目档案</p>
      </div>

      {/* 功能卡片 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">基础档案管理</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {stats.map((item) => (
            <Link
              key={item.value}
              href={`/settings/${item.value}`}
              className="group"
            >
              <Card className="h-full transition-all hover:shadow-lg hover:-translate-y-1">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg text-white ${item.color}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {item.label}
                      </h3>
                      <p className="text-sm text-slate-600 mb-4">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {item.count} 项
                        </Badge>
                        <span className="text-sm text-slate-500">管理</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 快速统计 */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">数据概览</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{subjects.length}</p>
              <p className="text-sm text-slate-600">会计科目</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{departments.length}</p>
              <p className="text-sm text-slate-600">部门组织</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">{projects.length}</p>
              <p className="text-sm text-slate-600">财务项目</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{commonSummaries.length}</p>
              <p className="text-sm text-slate-600">常用摘要</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-cyan-600">{templates.length}</p>
              <p className="text-sm text-slate-600">凭证模版</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据库管理 */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">数据库管理</h3>
            </div>
            {currentAccountSet && (
              <DbStatusIndicator accountSetId={currentAccountSet.id} showDetails={false} />
            )}
          </div>

          {/* 当前账套信息 */}
          {currentAccountSet ? (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FolderIcon className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">当前账套</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{currentAccountSet.name}</p>
              <p className="text-sm text-slate-600">账套编码: {currentAccountSet.code}</p>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">未选择账套，请先在账套管理中选择一个账套</p>
            </div>
          )}

          {/* 数据库文件信息 */}
          {dbInfo && (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">数据库文件信息</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">存储类型</p>
                  <p className="font-medium text-slate-900">
                    {FileHandleManager.getStorageTypeName(dbInfo.storageType)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">文件名</p>
                  <p className="font-medium text-slate-900">{dbInfo.fileName}</p>
                </div>
                <div>
                  <p className="text-slate-500">创建时间</p>
                  <p className="font-medium text-slate-900">{formatDate(parseInt(dbInfo.created))}</p>
                </div>
                <div>
                  <p className="text-slate-500">更新时间</p>
                  <p className="font-medium text-slate-900">{formatDate(dbInfo.lastModified)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              onClick={handleDownloadDatabase}
              disabled={!currentAccountSet || isLoading}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              下载备份
            </Button>
            <Button
              variant="outline"
              onClick={handleUploadDatabase}
              disabled={!currentAccountSet || isLoading}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              导入数据库
            </Button>
            {isFSA && (
              <Button
                variant="outline"
                onClick={handleChangeDatabaseFile}
                disabled={!currentAccountSet || isLoading}
                className="flex items-center gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                更换文件位置
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleResetDatabase}
              disabled={!currentAccountSet || isLoading}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              重置数据库
            </Button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-1">
              {isFSA && '磁盘文件存储模式'}
              {isOPFS && '浏览器私有存储模式'}
              {!isFSA && !isOPFS && '本地存储模式'}
            </p>
            <p className="text-xs text-blue-800">
              {isFSA && '数据存储在您指定的磁盘文件中，即使重启开发服务器也不会丢失。建议定期下载备份。'}
              {isOPFS && '数据存储在浏览器的私有文件系统中，数据持久化保存，重启开发服务器不会丢失。建议定期下载备份。'}
              {!isFSA && !isOPFS && '警告：当前使用 localStorage 存储，数据可能在某些情况下丢失。建议使用支持 FSA 的浏览器（Chrome 86+, Edge 86+）。'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 文件选择对话框 */}
      {currentAccountSet && (
        <FilePickerDialog
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          mode="create"
          accountSetName={currentAccountSet.name}
          defaultFileName={`${currentAccountSet.name}.db`}
          onFileSelected={handleConfirmChangeFile}
        />
      )}
    </div>
  );
}
