'use client';

import { useEffect, useState, useRef } from 'react';
import { getCurrentManager } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';

// 全局初始化 Promise：其他组件可以通过 waitForDbInit() 等待数据库就绪
let _initResolve: (() => void) | null = null;
const _initPromise = new Promise<void>((resolve) => { _initResolve = resolve; });
let _initDone = false;

/** 等待 DatabaseSyncWrapper 完成初始化。已完成后立即返回。 */
export async function waitForDbInit(): Promise<void> {
  if (_initDone) return;
  await _initPromise;
}

export function useDatabaseSync() {
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const initStartedRef = useRef(false);

  useEffect(() => {
    // 防止重复初始化
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const initDatabase = async () => {
      try {
        // 动态导入 stores 以避免循环依赖和过早订阅
        const { useVoucherStore } = await import('@/stores/useVoucherStore');
        const { useSubjectStore } = await import('@/stores/useSubjectStore');
        const { useDepartmentStore } = await import('@/stores/useDepartmentStore');
        const { useFinancialProjectStore } = await import('@/stores/useFinancialProjectStore');
        const { useCurrencyStore } = await import('@/stores/useCurrencyStore');
        const { useVoucherTemplateStore } = await import('@/stores/useVoucherTemplateStore');
        const { useSummaryStore } = await import('@/stores/useSummaryStore');
        const { usePartnerStore } = await import('@/stores/usePartnerStore');
        const { useFixedAssetStore } = await import('@/stores/useFixedAssetStore');
        const { useAccountSetStore } = await import('@/stores/useAccountSetStore');

        // 1. 初始化当前配置的数据库
        const manager = getCurrentManager();
        await manager.init();

        // 2. 设置当前账套并打开其数据库
        const accountSetStore = useAccountSetStore.getState();
        const currentAccountSet = accountSetStore.getCurrentAccountSet();
        if (currentAccountSet) {
          manager.setCurrentAccountSet(currentAccountSet.id);

          // 对于 SQLite，需要打开账套数据库
          const { accountSetDbManager } = await import('@/lib/database/account-set-db-manager');
          const { fileHandleManager } = await import('@/lib/database/file-handle-manager');

          try {
            await accountSetDbManager.openAccountSetDatabase(currentAccountSet.id);
            console.log('Account set database opened:', currentAccountSet.id);
          } catch (error) {
            console.warn('Failed to open account set database:', error);
            // 数据库可能不存在，检查是否需要创建
            const dbInfo = await fileHandleManager.getAccountSetInfo(currentAccountSet.id);
            if (!dbInfo) {
              console.log('Account set database does not exist, will be created on first save');
            }
          }

          // 重要：同时更新 sqliteService 的账套ID
          const { sqliteService } = await import('@/lib/database/sqlite-service');
          sqliteService.setAccountSetId(currentAccountSet.id);
          console.log('Database sync: Set account set ID to', currentAccountSet.id);
        }

        // 3. 从 SQLite 加载数据到各个 store（使用 getState 避免订阅）
        await Promise.all([
          useSubjectStore.getState().initializeSubjects(),
          useDepartmentStore.getState().initializeDepartments(),
          useFinancialProjectStore.getState().initializeProjects(),
          useCurrencyStore.getState().initializeCurrencies(),
          useVoucherTemplateStore.getState().initializeTemplates(),
          useSummaryStore.getState().initializeSummaries(),
          usePartnerStore.getState().initializePartners(),
          useVoucherStore.getState().initialize(),
          useFixedAssetStore.getState().initialize()
        ]);

        setIsInitialized(true);
        _initDone = true;
        _initResolve?.();
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Database initialization error:', error);
        toast({
          title: "初始化失败",
          description: "应用将在本地模式下运行，数据保存在浏览器中",
          type: "warning",
        });
      }
    };

    initDatabase();
  }, [toast]);

  // 导出数据功能 - 从当前配置的数据库获取数据
  const exportData = async () => {
    try {
      const data = await getCurrentManager().exportData();

      // 创建下载链接
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "数据导出成功",
        description: "财务数据已成功导出到本地文件",
        type: "success",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "数据导出失败",
        description: "无法导出数据，请重试",
        type: "error",
      });
    }
  };

  // 导入数据功能 - 直接导入到 IndexedDB
  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await getCurrentManager().importData(data);

      // 重新加载所有数据（动态导入以避免循环依赖）
      const { useVoucherStore } = await import('@/stores/useVoucherStore');
      const { useSubjectStore } = await import('@/stores/useSubjectStore');
      const { useDepartmentStore } = await import('@/stores/useDepartmentStore');
      const { useFinancialProjectStore } = await import('@/stores/useFinancialProjectStore');
      const { useCurrencyStore } = await import('@/stores/useCurrencyStore');
      const { useVoucherTemplateStore } = await import('@/stores/useVoucherTemplateStore');
      const { useSummaryStore } = await import('@/stores/useSummaryStore');
      const { usePartnerStore } = await import('@/stores/usePartnerStore');

      await Promise.all([
        useSubjectStore.getState().initializeSubjects(),
        useDepartmentStore.getState().initializeDepartments(),
        useFinancialProjectStore.getState().initializeProjects(),
        useCurrencyStore.getState().initializeCurrencies(),
        useVoucherTemplateStore.getState().initializeTemplates(),
        useSummaryStore.getState().initializeSummaries(),
        usePartnerStore.getState().initializePartners(),
        useVoucherStore.getState().initialize()
      ]);

      toast({
        title: "数据导入成功",
        description: `成功导入数据`,
        type: "success",
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "数据导入失败",
        description: "导入文件格式错误或数据损坏",
        type: "error",
      });
    }
  };

  return {
    isInitialized,
    exportData,
    importData
  };
}
