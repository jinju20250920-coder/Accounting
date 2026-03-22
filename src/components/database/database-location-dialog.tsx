'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HardDrive,
  Database,
  Download,
  Upload,
  FolderOpen,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { accountSetDbManager } from '@/lib/database/account-set-db-manager';
import { fileHandleManager, FileHandleManager } from '@/lib/database/file-handle-manager';
import type { AccountSetHandleInfo } from '@/lib/database/file-handle-manager';
import initSqlJs from 'sql.js';

interface DatabaseLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountSetId: string;
  accountSetName: string;
}

export function DatabaseLocationDialog({
  open,
  onOpenChange,
  accountSetId,
  accountSetName
}: DatabaseLocationDialogProps) {
  const { showToast } = useToast();
  const [dbInfo, setDbInfo] = useState<AccountSetHandleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 加载数据库信息
  useEffect(() => {
    const loadDbInfo = async () => {
      if (!open) return;

      setIsLoading(true);
      try {
        const info = await fileHandleManager.getAccountSetInfo(accountSetId);

        // 验证文件句柄是否有效
        if (info) {
          const isValid = await fileHandleManager.verifyHandle(accountSetId);
          if (!isValid) {
            // 文件句柄无效，视为未初始化
            console.warn('File handle is invalid, treating as uninitialized');
            setDbInfo(null);
          } else {
            setDbInfo(info);
          }
        } else {
          setDbInfo(null);
        }
      } catch (error) {
        console.error('Failed to load database info:', error);
        setDbInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadDbInfo();
  }, [open, accountSetId]);

  // 下载数据库备份
  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      const db = accountSetDbManager.getDatabase(accountSetId);
      if (!db) {
        showToast('error', '数据库未打开，请先切换到该账套');
        return;
      }

      const data = db.export();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${accountSetName}_${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('success', '数据库备份已下载');
    } catch (error) {
      console.error('Download failed:', error);
      showToast('error', '下载失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 更改数据库文件位置（FSA）
  const handleChangeLocation = async () => {
    if (!FileHandleManager.isFileSystemAccessAPISupported()) {
      showToast('error', '您的浏览器不支持文件系统访问 API');
      return;
    }

    setIsProcessing(true);
    try {
      // 让用户选择新的文件位置
      const handle = await window.showSaveFilePicker({
        suggestedName: `${accountSetName}.db`,
        types: [{
          description: 'SQLite Database',
          accept: { 'application/x-sqlite3': ['.db'] }
        }]
      });

      // 获取当前数据库
      const db = accountSetDbManager.getDatabase(accountSetId);
      if (!db) {
        showToast('error', '数据库未打开');
        return;
      }

      // 写入新文件
      const data = db.export();
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();

      // 更新文件句柄
      await fileHandleManager.saveHandle(
        accountSetId,
        accountSetName,
        handle.name,
        handle,
        'fsa'
      );

      // 更新本地状态
      setDbInfo({
        accountSetId,
        accountSetName,
        fileName: handle.name,
        lastModified: Date.now(),
        storageType: 'fsa',
        created: dbInfo?.created || '',
        updated: new Date().toISOString()
      });

      showToast('success', '数据库文件位置已更改');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // 用户取消
        return;
      }
      console.error('Change location failed:', error);
      showToast('error', '更改文件位置失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 迁移到 OPFS
  const handleMigrateToOPFS = async () => {
    if (!FileHandleManager.isOPFSSupported()) {
      showToast('error', '您的浏览器不支持 OPFS');
      return;
    }

    setIsProcessing(true);
    try {
      // 获取当前数据库
      const db = accountSetDbManager.getDatabase(accountSetId);
      if (!db) {
        showToast('error', '数据库未打开');
        return;
      }

      // 在 OPFS 中创建新文件
      const opfsRoot = await (navigator.storage as any).getDirectory();
      const fileName = `${accountSetName}_${accountSetId}.db`;
      const handle = await opfsRoot.getFileHandle(fileName, { create: true });

      // 写入数据
      const data = db.export();
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();

      // 更新文件句柄
      await fileHandleManager.saveHandle(
        accountSetId,
        accountSetName,
        fileName,
        handle,
        'opfs'
      );

      // 更新本地状态
      setDbInfo({
        accountSetId,
        accountSetName,
        fileName,
        lastModified: Date.now(),
        storageType: 'opfs',
        created: dbInfo?.created || '',
        updated: new Date().toISOString()
      });

      showToast('success', '已迁移到浏览器私有存储');
    } catch (error) {
      console.error('Migrate to OPFS failed:', error);
      showToast('error', '迁移失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 验证数据库完整性
  const handleVerify = async () => {
    setIsProcessing(true);
    try {
      const isValid = await fileHandleManager.verifyHandle(accountSetId);

      if (isValid) {
        showToast('success', '数据库文件有效');
      } else {
        showToast('error', '数据库文件已失效，请重新选择文件位置');
      }
    } catch (error) {
      console.error('Verify failed:', error);
      showToast('error', '验证失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 初始化数据库
  const handleInitializeDatabase = async () => {
    setIsProcessing(true);
    try {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sqljs/${file}`,
      });

      // 创建新数据库
      const db = new SQL.Database();

      // 创建表结构（完整的表结构）
      const tables = `
        CREATE TABLE IF NOT EXISTS vouchers (
          id TEXT PRIMARY KEY,
          voucherNo TEXT,
          date TEXT,
          status TEXT,
          summary TEXT,
          creator TEXT,
          reviewer TEXT,
          poster TEXT,
          reverseVoucherId TEXT,
          referenceNumber TEXT,
          attachmentCount INTEGER DEFAULT 0,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          voucherId TEXT,
          subjectCode TEXT,
          subjectName TEXT,
          direction TEXT,
          debit REAL,
          credit REAL,
          summary TEXT,
          customerName TEXT,
          supplierName TEXT,
          auxiliary TEXT,
          recRefNo TEXT,
          departmentCode TEXT,
          departmentName TEXT,
          projectCode TEXT,
          projectName TEXT,
          currencyCode TEXT,
          exchangeRate REAL DEFAULT 1.0,
          originalAmount REAL DEFAULT 0,
          date TEXT,
          createTime TEXT,
          updateTime TEXT,
          FOREIGN KEY (voucherId) REFERENCES vouchers(id)
        );

        CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          parentId TEXT,
          level INTEGER DEFAULT 1,
          type TEXT,
          direction TEXT DEFAULT 'debit',
          balance REAL DEFAULT 0,
          enabled INTEGER DEFAULT 1,
          frozen INTEGER DEFAULT 0,
          description TEXT,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          parentId TEXT,
          level INTEGER DEFAULT 1,
          enabled INTEGER DEFAULT 1,
          description TEXT,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          description TEXT,
          enabled INTEGER DEFAULT 1,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS currencies (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          symbol TEXT,
          exchangeRate REAL DEFAULT 1.0,
          enabled INTEGER DEFAULT 1,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS partners (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          type TEXT DEFAULT 'customer',
          contact TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          taxNo TEXT,
          bankAccount TEXT,
          enabled INTEGER DEFAULT 1,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS voucherTemplates (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          entries TEXT,
          validations TEXT,
          variables TEXT,
          isSystem INTEGER DEFAULT 0,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS commonSummaries (
          id TEXT PRIMARY KEY,
          content TEXT,
          frequency INTEGER DEFAULT 0,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS userPreferences (
          id TEXT PRIMARY KEY,
          userId TEXT,
          type TEXT,
          key TEXT,
          value TEXT,
          createTime TEXT,
          updateTime TEXT
        );

        CREATE TABLE IF NOT EXISTS auditLogs (
          id TEXT PRIMARY KEY,
          type TEXT,
          entityType TEXT,
          entityId TEXT,
          details TEXT,
          userId TEXT,
          timestamp TEXT
        );

        CREATE TABLE IF NOT EXISTS recRelations (
          id TEXT PRIMARY KEY,
          recRefNo TEXT,
          debitEntryId TEXT,
          creditEntryId TEXT,
          amount REAL,
          recDate TEXT,
          partnerName TEXT,
          createTime TEXT,
          updateTime TEXT,
          FOREIGN KEY (debitEntryId) REFERENCES entries(id),
          FOREIGN KEY (creditEntryId) REFERENCES entries(id)
        );
      `;

      db.exec(tables);

      // 创建索引
      const indexes = `
        CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);
        CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
        CREATE INDEX IF NOT EXISTS idx_vouchers_voucherNo ON vouchers(voucherNo);
        CREATE INDEX IF NOT EXISTS idx_entries_voucherId ON entries(voucherId);
        CREATE INDEX IF NOT EXISTS idx_entries_subjectCode ON entries(subjectCode);
        CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
        CREATE INDEX IF NOT EXISTS idx_entries_recRefNo ON entries(recRefNo);
        CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code);
        CREATE INDEX IF NOT EXISTS idx_subjects_parentId ON subjects(parentId);
        CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(code);
        CREATE INDEX IF NOT EXISTS idx_recRelations_recRefNo ON recRelations(recRefNo);
      `;

      db.exec(indexes);

      const dbFileName = `${accountSetName}_${accountSetId}.db`;
      let storageType: 'fsa' | 'opfs' | 'local' = 'local';
      let handle: FileSystemFileHandle | null = null;

      // 优先使用 OPFS（无需用户交互）
      if (FileHandleManager.isOPFSSupported()) {
        try {
          const opfsRoot = await (navigator.storage as any).getDirectory();
          handle = await opfsRoot.getFileHandle(dbFileName, { create: true });
          const writable = await handle.createWritable();
          await writable.write(db.export());
          await writable.close();
          storageType = 'opfs';
        } catch (opfsError) {
          console.warn('OPFS save failed:', opfsError);
          handle = null;
        }
      }

      // 如果 OPFS 失败，尝试使用 FSA
      if (!handle && FileHandleManager.isFileSystemAccessAPISupported()) {
        try {
          handle = await window.showSaveFilePicker({
            suggestedName: dbFileName,
            types: [{
              description: 'SQLite Database',
              accept: { 'application/x-sqlite3': ['.db'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(db.export());
          await writable.close();
          storageType = 'fsa';
        } catch (fsaError) {
          if ((fsaError as Error).name !== 'AbortError') {
            console.warn('FSA save failed:', fsaError);
          }
          handle = null;
        }
      }

      // 如果都有文件句柄，保存到 IndexedDB
      if (handle) {
        await fileHandleManager.saveHandle(
          accountSetId,
          accountSetName,
          dbFileName,
          handle,
          storageType
        );

        // 更新本地状态
        setDbInfo({
          accountSetId,
          accountSetName,
          fileName: dbFileName,
          lastModified: Date.now(),
          storageType,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        });

        showToast('success', `数据库初始化成功 (${storageType === 'opfs' ? 'OPFS' : '磁盘文件'})`);
      } else {
        showToast('error', '初始化失败：无法保存数据库文件');
      }
    } catch (error) {
      console.error('Initialize database failed:', error);
      showToast('error', '初始化数据库失败: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
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

  const getStorageTypeBadge = (type: 'fsa' | 'opfs' | 'local' | undefined) => {
    switch (type) {
      case 'fsa':
        return (
          <Badge className="bg-green-100 text-green-800">
            <Database className="w-3 h-3 mr-1" />
            磁盘文件
          </Badge>
        );
      case 'opfs':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <HardDrive className="w-3 h-3 mr-1" />
            OPFS
          </Badge>
        );
      case 'local':
        return (
          <Badge className="bg-orange-100 text-orange-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            本地存储
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            未初始化
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>数据库位置管理</DialogTitle>
          <DialogDescription>
            管理账套 "{accountSetName}" 的数据库文件位置
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600">加载中...</p>
          </div>
        ) : dbInfo ? (
          <div className="py-4 space-y-4">
            {/* 当前存储信息 */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700">当前存储位置</span>
                {getStorageTypeBadge(dbInfo.storageType)}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">文件名:</span>
                  <span className="font-medium text-slate-900">{dbInfo.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">最后修改:</span>
                  <span className="font-medium">{formatDate(dbInfo.lastModified)}</span>
                </div>
              </div>
            </div>

            {/* 存储类型说明 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <Database className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 mb-1">存储类型说明</p>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• <strong>磁盘文件</strong>: 存储在用户指定位置，可手动备份</li>
                    <li>• <strong>OPFS</strong>: 浏览器私有存储，自动持久化</li>
                    <li>• <strong>本地存储</strong>: localStorage，可能受限</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">可用操作:</p>

              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isProcessing}
                className="w-full justify-start"
              >
                <Download className="w-4 h-4 mr-2" />
                下载数据库备份
              </Button>

              {FileHandleManager.isFileSystemAccessAPISupported() && (
                <Button
                  variant="outline"
                  onClick={handleChangeLocation}
                  disabled={isProcessing}
                  className="w-full justify-start"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  更改文件位置 (磁盘文件)
                </Button>
              )}

              {dbInfo.storageType !== 'opfs' && FileHandleManager.isOPFSSupported() && (
                <Button
                  variant="outline"
                  onClick={handleMigrateToOPFS}
                  disabled={isProcessing}
                  className="w-full justify-start"
                >
                  <HardDrive className="w-4 h-4 mr-2" />
                  迁移到 OPFS
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleVerify}
                disabled={isProcessing}
                className="w-full justify-start"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                验证数据库完整性
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <p className="text-sm text-slate-600">该账套尚未初始化数据库</p>
            <p className="text-xs text-slate-500 mt-4 mb-4">点击下方按钮初始化账套数据库</p>
            <Button
              onClick={handleInitializeDatabase}
              disabled={isProcessing}
              className="gap-2"
            >
              <Database className="w-4 h-4" />
              {isProcessing ? '初始化中...' : '初始化数据库'}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
