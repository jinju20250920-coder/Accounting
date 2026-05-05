'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, FolderOpen, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { sqliteService } from '@/lib/database/sqlite-service';
import { fileHandleManager, FileHandleManager } from '@/lib/database/file-handle-manager';
import { FilePickerDialog } from './file-picker-dialog';

export type FileAccessErrorType =
  | 'handle_invalid'
  | 'permission_revoked'
  | 'file_not_found'
  | 'file_read_error'
  | 'file_write_error'
  | 'unknown';

interface FileAccessError {
  accountSetId: string;
  accountSetName: string;
  errorType: FileAccessErrorType;
  errorMessage: string;
  timestamp: number;
  retryCount: number;
}

interface FileAccessErrorHandlerProps {
  onError?: (error: FileAccessError) => void;
  onResolved?: (accountSetId: string) => void;
}

/**
 * 文件访问错误处理器
 * 处理文件句柄无效、权限被撤销等错误
 * 提供用户友好的错误信息和恢复选项
 */
export function FileAccessErrorHandler({ onError, onResolved }: FileAccessErrorHandlerProps) {
  const { showToast } = useToast();
  const [currentError, setCurrentError] = useState<FileAccessError | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // 检测文件访问错误
  const detectAndHandleError = async (accountSetId: string, accountSetName: string) => {
    try {
      // 验证文件句柄是否有效
      const isValid = await fileHandleManager.verifyHandle(accountSetId);

      if (!isValid) {
        const error: FileAccessError = {
          accountSetId,
          accountSetName,
          errorType: 'handle_invalid',
          errorMessage: '数据库文件句柄已失效，可能文件被移动或重命名',
          timestamp: Date.now(),
          retryCount: 0
        };

        setCurrentError(error);
        setShowRecoveryDialog(true);
        onError?.(error);
      }
    } catch (err) {
      // 检测错误类型
      const errorMsg = (err as Error).message;
      let errorType: FileAccessErrorType = 'unknown';

      if (errorMsg.includes('NotAllowedError') || errorMsg.includes('Permission')) {
        errorType = 'permission_revoked';
      } else if (errorMsg.includes('NotFoundError')) {
        errorType = 'file_not_found';
      } else if (errorMsg.includes('read')) {
        errorType = 'file_read_error';
      } else if (errorMsg.includes('write')) {
        errorType = 'file_write_error';
      }

      const error: FileAccessError = {
        accountSetId,
        accountSetName,
        errorType,
        errorMessage: errorMsg,
        timestamp: Date.now(),
        retryCount: 0
      };

      setCurrentError(error);
      setShowRecoveryDialog(true);
      onError?.(error);
    }
  };

  // 重试访问
  const handleRetry = async () => {
    if (!currentError) return;

    setIsRetrying(true);
    try {
      // 确保数据库可用
      await sqliteService.getDatabase();

      showToast('success', '文件访问已恢复');
      setShowRecoveryDialog(false);
      setCurrentError(null);
      onResolved?.(currentError.accountSetId);
    } catch (err) {
      // 重试失败，增加重试计数
      setCurrentError(prev => prev ? { ...prev, retryCount: (prev.retryCount || 0) + 1 } : null);

      if ((currentError.retryCount || 0) >= 2) {
        showToast('error', '重试失败，请选择其他恢复方式');
      } else {
        showToast('warning', '重试失败，请尝试其他方式');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // 重新选择文件
  const handleReSelectFile = () => {
    setShowRecoveryDialog(false);
    setShowFilePicker(true);
  };

  // 确认重新选择文件
  const handleConfirmReSelect = async (handle: FileSystemFileHandle, fileName: string) => {
    if (!currentError) return;

    setIsRetrying(true);
    try {
      // 验证新文件
      const file = await handle.getFile();

      // 保存新句柄
      await fileHandleManager.saveHandle(
        currentError.accountSetId,
        currentError.accountSetName,
        fileName,
        handle,
        'fsa'
      );

      // 确保数据库可用
      await sqliteService.getDatabase();

      showToast('success', '数据库文件已重新关联');
      setShowFilePicker(false);
      setCurrentError(null);
      onResolved?.(currentError.accountSetId);
    } catch (err) {
      showToast('error', '文件关联失败: ' + (err as Error).message);
    } finally {
      setIsRetrying(false);
    }
  };

  // 创建新数据库
  const handleCreateNew = () => {
    if (!currentError) return;

    // TODO: 实现创建新数据库的流程
    showToast('info', '请联系管理员创建新的账套数据库');
  };

  // 获取错误类型描述
  const getErrorDescription = (errorType: FileAccessErrorType): string => {
    switch (errorType) {
      case 'handle_invalid':
        return '文件句柄已失效，通常是因为文件被移动、重命名或删除';
      case 'permission_revoked':
        return '文件访问权限被撤销，请重新授权访问';
      case 'file_not_found':
        return '找不到数据库文件，可能已被删除或移动';
      case 'file_read_error':
        return '读取文件时出错，文件可能已损坏';
      case 'file_write_error':
        return '写入文件时出错，请检查磁盘空间';
      default:
        return '未知的文件访问错误';
    }
  };

  // 获取错误类型徽章
  const getErrorBadge = (errorType: FileAccessErrorType) => {
    const severity = ['permission_revoked', 'handle_invalid'].includes(errorType)
      ? 'warning'
      : 'destructive';

    return (
      <Badge variant={severity === 'warning' ? 'secondary' : 'destructive'}>
        {errorType === 'handle_invalid' && '句柄失效'}
        {errorType === 'permission_revoked' && '权限被撤销'}
        {errorType === 'file_not_found' && '文件不存在'}
        {errorType === 'file_read_error' && '读取错误'}
        {errorType === 'file_write_error' && '写入错误'}
        {errorType === 'unknown' && '未知错误'}
      </Badge>
    );
  };

  return (
    <>
      {/* 恢复对话框 */}
      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <DialogTitle>数据库文件访问错误</DialogTitle>
            </div>
          </DialogHeader>

          {currentError && (
            <div className="py-4 space-y-4">
              {/* 错误信息 */}
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-900">
                    账套: {currentError.accountSetName}
                  </span>
                  {getErrorBadge(currentError.errorType)}
                </div>
                <p className="text-sm text-orange-800">
                  {getErrorDescription(currentError.errorType)}
                </p>
              </div>

              {/* 错误详情 */}
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded">
                <p className="font-medium mb-1">错误详情:</p>
                <p className="break-all">{currentError.errorMessage}</p>
                <p className="mt-2 text-slate-500">
                  时间: {new Date(currentError.timestamp).toLocaleString('zh-CN')}
                </p>
              </div>

              {/* 恢复选项 */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">请选择恢复方式:</p>

                <Button
                  variant="outline"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="w-full justify-start"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                  重试访问 ({currentError.retryCount}/3)
                </Button>

                {currentError.errorType !== 'permission_revoked' && (
                  <Button
                    variant="outline"
                    onClick={handleReSelectFile}
                    disabled={isRetrying}
                    className="w-full justify-start"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    重新选择数据库文件
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={handleCreateNew}
                  disabled={isRetrying}
                  className="w-full justify-start"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  创建新数据库（需要重新初始化）
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowRecoveryDialog(false)}
            >
              稍后处理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 文件选择对话框 */}
      {currentError && (
        <FilePickerDialog
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          mode="open"
          accountSetName={currentError.accountSetName}
          onFileSelected={handleConfirmReSelect}
        />
      )}
    </>
  );
}

/**
 * Hook to use file access error handler
 */
export function useFileAccessErrorHandler() {
  const [errorState, setErrorState] = useState<{
    hasError: boolean;
    error: FileAccessError | null;
  }>({
    hasError: false,
    error: null
  });

  const handleError = (error: FileAccessError) => {
    setErrorState({
      hasError: true,
      error
    });
  };

  const handleResolved = (accountSetId: string) => {
    setErrorState(prev => ({
      hasError: false,
      error: prev.error?.accountSetId === accountSetId ? null : prev.error
    }));
  };

  const clearError = () => {
    setErrorState({
      hasError: false,
      error: null
    });
  };

  return {
    errorState,
    handleError,
    handleResolved,
    clearError
  };
}
