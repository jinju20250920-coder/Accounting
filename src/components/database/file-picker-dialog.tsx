'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FolderOpen,
  Save,
  FileJson,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { fileHandleManager, FileHandleManager } from '@/lib/database/file-handle-manager';
import { useToast } from '@/components/ui/toast';

interface FilePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'open';
  accountSetName: string;
  defaultFileName?: string;
  onFileSelected: (handle: FileSystemFileHandle, fileName: string) => void;
}

export function FilePickerDialog({
  open,
  onOpenChange,
  mode,
  accountSetName,
  defaultFileName,
  onFileSelected
}: FilePickerDialogProps) {
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState(
    defaultFileName || `${accountSetName}_${new Date().toISOString().slice(0, 10)}.db`
  );

  const fsaSupported = FileHandleManager.isFileSystemAccessAPISupported();
  const opfsSupported = FileHandleManager.isOPFSSupported();

  const handleSelectFile = async () => {
    if (!fsaSupported) {
      setError('您的浏览器不支持文件系统访问，请使用 Chrome、Edge 或 Opera 浏览器');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let handle: FileSystemFileHandle;
      let fileName: string;

      if (mode === 'create') {
        // 创建新文件
        const result = await fileHandleManager.requestNewFile(selectedFileName);
        handle = result.handle;
        fileName = result.fileName;
      } else {
        // 打开现有文件
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{
            description: 'SQLite Database',
            accept: { 'application/x-sqlite3': ['.db'] }
          }]
        });
        handle = fileHandle;
        fileName = handle.name;
      }

      // 验证文件
      if (mode === 'open') {
        const file = await handle.getFile();
        if (file.size === 0) {
          setError('选择的文件是空的，请选择有效的数据库文件');
          setIsProcessing(false);
          return;
        }
      }

      // 回调
      onFileSelected(handle, fileName);
      onOpenChange(false);

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用户取消
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : '文件选择失败');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseOPFS = async () => {
    if (!opfsSupported) {
      setError('您的浏览器不支持 OPFS，请升级浏览器');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // OPFS 方式不需要用户选择文件
      // 创建 OPFS 文件句柄
      const opfsRoot = await (navigator.storage as any).getDirectory();
      const fileName = selectedFileName || `${accountSetName}_${new Date().toISOString().slice(0, 10)}.db`;
      const handle = await opfsRoot.getFileHandle(fileName, { create: true });

      onFileSelected(handle, fileName);
      onOpenChange(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : '创建 OPFS 文件失败');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '创建数据库文件' : '选择数据库文件'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '为账套选择数据库文件的保存位置和名称'
              : '选择现有的数据库文件'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* 文件名输入 */}
          <div className="space-y-2">
            <Label htmlFor="fileName">数据库文件名</Label>
            <div className="flex items-center gap-2">
              <Input
                id="fileName"
                value={selectedFileName}
                onChange={(e) => setSelectedFileName(e.target.value)}
                placeholder="database.db"
              />
              <span className="text-sm text-slate-500">.db</span>
            </div>
          </div>

          {/* 存储方式选项 */}
          <div className="space-y-3">
            <Label>存储方式</Label>

            {/* File System Access API */}
            {fsaSupported && (
              <button
                onClick={handleSelectFile}
                disabled={isProcessing}
                className="w-full p-4 border-2 rounded-lg text-left hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FolderOpen className="w-5 h-5 text-blue-500" />
                      <h4 className="font-semibold text-slate-900">磁盘文件存储</h4>
                      <Badge className="bg-green-100 text-green-800 text-xs">推荐</Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      {mode === 'create'
                        ? '选择文件保存位置，数据存储在您指定的位置'
                        : '从您的计算机中选择现有的数据库文件'}
                    </p>
                  </div>
                  {mode === 'create' ? (
                    <Save className="w-5 h-5 text-slate-400" />
                  ) : (
                    <FileJson className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>
            )}

            {/* OPFS */}
            {opfsSupported && (
              <button
                onClick={handleUseOPFS}
                disabled={isProcessing}
                className="w-full p-4 border-2 rounded-lg text-left hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <HardDrive className="w-5 h-5 text-purple-500" />
                      <h4 className="font-semibold text-slate-900">浏览器私有存储</h4>
                      <Badge variant="secondary" className="text-xs">备选</Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      数据存储在浏览器的私有文件系统中，无需手动管理文件
                    </p>
                  </div>
                </div>
              </button>
            )}

            {/* 不支持提示 */}
            {!fsaSupported && !opfsSupported && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-orange-800 font-medium">
                      您的浏览器不支持高级文件存储功能
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      建议使用 Chrome、Edge 或 Opera 浏览器获得最佳体验
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 处理中提示 */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>处理中...</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
