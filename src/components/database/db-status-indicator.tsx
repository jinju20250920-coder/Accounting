'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { HardDrive, Database, FolderOpen, AlertCircle } from 'lucide-react';
import { fileHandleManager, FileHandleManager } from '@/lib/database/file-handle-manager';

interface DbStatusIndicatorProps {
  accountSetId?: string;
  showDetails?: boolean;
  className?: string;
}

interface DbStatusInfo {
  storageType: 'fsa' | 'opfs' | 'local' | 'none';
  fileName?: string;
  fileSize?: number;
  lastModified?: number;
  isSupported: boolean;
}

export function DbStatusIndicator({
  accountSetId,
  showDetails = true,
  className = ''
}: DbStatusIndicatorProps) {
  const [status, setStatus] = useState<DbStatusInfo>({
    storageType: 'none',
    isSupported: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      setLoading(true);

      try {
        if (accountSetId) {
          const info = await fileHandleManager.getAccountSetInfo(accountSetId);
          if (info) {
            setStatus({
              storageType: info.storageType,
              fileName: info.fileName,
              lastModified: info.lastModified,
              isSupported: true
            });
          } else {
            setStatus({
              storageType: 'none',
              isSupported: false
            });
          }
        } else {
          // 没有指定账套，检测系统支持情况
          const storageType = FileHandleManager.getRecommendedStorageType();
          setStatus({
            storageType,
            isSupported: storageType !== 'local'
          });
        }
      } catch (error) {
        console.error('Failed to load database status:', error);
        setStatus({
          storageType: 'local',
          isSupported: false
        });
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, [accountSetId]);

  const formatSize = (bytes: number): string => {
    if (!bytes) return '未知';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '未知';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getStorageTypeBadge = (type: 'fsa' | 'opfs' | 'local' | 'none') => {
    switch (type) {
      case 'fsa':
        return (
          <Badge className="bg-green-100 text-green-800" variant="secondary">
            <Database className="w-3 h-3 mr-1" />
            磁盘文件
          </Badge>
        );
      case 'opfs':
        return (
          <Badge className="bg-blue-100 text-blue-800" variant="secondary">
            <HardDrive className="w-3 h-3 mr-1" />
            OPFS
          </Badge>
        );
      case 'local':
        return (
          <Badge className="bg-orange-100 text-orange-800" variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            本地存储
          </Badge>
        );
      case 'none':
        return (
          <Badge variant="outline">
            未初始化
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            未知
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-2 h-2 bg-slate-300 rounded-full animate-pulse" />
        <span className="text-sm text-slate-500">加载中...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {getStorageTypeBadge(status.storageType)}

      {showDetails && status.storageType !== 'none' && (
        <>
          {status.fileName && (
            <span className="text-sm text-slate-600 flex items-center gap-1">
              <FolderOpen className="w-3 h-3" />
              {status.fileName}
            </span>
          )}

          {status.lastModified && (
            <span className="text-xs text-slate-500">
              {formatDate(status.lastModified)}
            </span>
          )}
        </>
      )}

      {!status.isSupported && (
        <span className="text-xs text-orange-600">
          建议使用 Chrome/Edge 浏览器
        </span>
      )}
    </div>
  );
}

// 简化版本：只显示存储类型标签
export function StorageTypeBadge({
  storageType,
  className = ''
}: {
  storageType: 'fsa' | 'opfs' | 'local' | 'none';
  className?: string;
}) {
  switch (storageType) {
    case 'fsa':
      return (
        <Badge className={`bg-green-100 text-green-800 ${className}`}>
          <Database className="w-3 h-3 mr-1" />
          磁盘文件
        </Badge>
      );
    case 'opfs':
      return (
        <Badge className={`bg-blue-100 text-blue-800 ${className}`}>
          <HardDrive className="w-3 h-3 mr-1" />
          OPFS
        </Badge>
      );
    case 'local':
      return (
        <Badge className={`bg-orange-100 text-orange-800 ${className}`}>
          <AlertCircle className="w-3 h-3 mr-1" />
          本地存储
        </Badge>
      );
    case 'none':
      return (
        <Badge variant="outline" className={className}>
          未初始化
        </Badge>
      );
    default:
      return null;
  }
}
