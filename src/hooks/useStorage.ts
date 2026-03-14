import { useEffect, useState } from 'react';

// 存储监控hook
export function useStorageMonitor() {
  const [storageSize, setStorageSize] = useState(0);
  const [storageStatus, setStorageStatus] = useState<{
    size: number;
    maxSize: number;
    usage: number;
    isOverLimit: boolean;
  }>({
    size: 0,
    maxSize: 10 * 1024 * 1024, // 10MB
    usage: 0,
    isOverLimit: false
  });

  useEffect(() => {
    const updateStorageInfo = () => {
      // 估算存储使用情况
      let totalSize = 0;
      const keys = ['finance-vouchers', 'finance-preferences', 'finance-audit', 'finance-settings'];

      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += item.length;
        }
      });

      const maxSize = 10 * 1024 * 1024; // 10MB
      const usage = (totalSize / maxSize) * 100;
      const isOverLimit = totalSize > maxSize;

      setStorageSize(totalSize);
      setStorageStatus({
        size: totalSize,
        maxSize,
        usage: Math.round(usage),
        isOverLimit
      });
    };

    updateStorageInfo();
    const interval = setInterval(updateStorageInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  const clearStorage = (type?: 'all' | 'vouchers' | 'preferences' | 'audit' | 'settings') => {
    if (type === 'all') {
      localStorage.clear();
    } else if (type) {
      localStorage.removeItem(`finance-${type}`);
    } else {
      // 清除所有数据
      const keys = ['finance-vouchers', 'finance-preferences', 'finance-audit', 'finance-settings'];
      keys.forEach(key => localStorage.removeItem(key));
    }

    // 重新计算存储信息
    let totalSize = 0;
    const keys = ['finance-vouchers', 'finance-preferences', 'finance-audit', 'finance-settings'];
    keys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length;
      }
    });
    setStorageSize(totalSize);

    const maxSize = 10 * 1024 * 1024;
    const usage = (totalSize / maxSize) * 100;
    setStorageStatus({
      size: totalSize,
      maxSize,
      usage: Math.round(usage),
      isOverLimit: totalSize > maxSize
    });
  };

  const exportStorage = () => {
    const data: Record<string, any> = {};
    const keys = ['finance-vouchers', 'finance-preferences', 'finance-audit', 'finance-settings'];

    keys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          data[key] = JSON.parse(item);
        } catch (e) {
          data[key] = item;
        }
      }
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    storageSize,
    storageStatus,
    clearStorage,
    exportStorage
  };
}

// 存储清理工具
export const storageUtils = {
  // 获取存储大小
  getStorageSize: (): number => {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('finance-')) {
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += item.length;
        }
      }
    }
    return totalSize;
  },

  // 检查存储空间
  checkStorageSpace: (maxMB: number): { size: number; maxSize: number; usage: number; isOverLimit: boolean } => {
    const maxSize = maxMB * 1024 * 1024;
    const size = storageUtils.getStorageSize();
    const usage = (size / maxSize) * 100;

    return {
      size,
      maxSize,
      usage: Math.round(usage),
      isOverLimit: size > maxSize
    };
  },

  // 清理旧数据
  cleanupOldData: <T>(data: T[], maxCount: number): T[] => {
    if (data.length <= maxCount) {
      return data;
    }
    return data.slice(0, maxCount);
  },

  // 压缩审计日志
  compressAuditLog: (records: any[], maxRecords: number): any[] => {
    // 按时间倒序排序
    const sorted = [...records].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // 限制数量
    return sorted.slice(0, maxRecords);
  }
};