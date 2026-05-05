'use client';

import { useEffect, useState, useRef } from 'react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useToast } from '@/hooks/use-toast';
import { useAccountSetStore } from '@/stores/useAccountSetStore';

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

  // 监听账套切换
  const currentAccountSetId = useAccountSetStore((s) => s.currentAccountSetId);
  const lastAccountSetIdRef = useRef<string | null>(null);

  // 重新加载所有 store 数据
  const reloadAllStores = async () => {
    const { useVoucherStore } = await import('@/stores/useVoucherStore');
    const { useSubjectStore } = await import('@/stores/useSubjectStore');
    const { useDepartmentStore } = await import('@/stores/useDepartmentStore');
    const { useFinancialProjectStore } = await import('@/stores/useFinancialProjectStore');
    const { useCurrencyStore } = await import('@/stores/useCurrencyStore');
    const { useVoucherTemplateStore } = await import('@/stores/useVoucherTemplateStore');
    const { useSummaryStore } = await import('@/stores/useSummaryStore');
    const { usePartnerStore } = await import('@/stores/usePartnerStore');
    const { useFixedAssetStore } = await import('@/stores/useFixedAssetStore');

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
  };

  // 监听账套切换
  useEffect(() => {
    if (!currentAccountSetId || !isInitialized) return;

    // 首次加载时记录当前账套
    if (!lastAccountSetIdRef.current) {
      lastAccountSetIdRef.current = currentAccountSetId;
      return;
    }

    // 账套切换时重新加载数据
    if (lastAccountSetIdRef.current !== currentAccountSetId) {
      lastAccountSetIdRef.current = currentAccountSetId;
      console.log('检测到账套切换，正在重新加载数据...', currentAccountSetId);

      (async () => {
        try {
          // 更新 sqliteService 的账套ID
          sqliteService.setAccountSetId(currentAccountSetId);
          console.log('sqliteService.accountSetId 已更新:', sqliteService.accountSetId);

          // 重新加载所有数据
          await reloadAllStores();
          console.log('账套切换后数据重新加载完成');
        } catch (error) {
          console.error('账套切换后数据重新加载失败:', error);
        }
      })();
    }
  }, [currentAccountSetId, isInitialized]);

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

        // 1. 初始化全局数据库
        const { sqliteManager } = await import('@/lib/database/sqlite-manager');
        await sqliteManager.init();

        // 2. 设置当前账套ID
        const accountSetStore = useAccountSetStore.getState();
        const currentAccountSet = accountSetStore.getCurrentAccountSet();
        if (currentAccountSet) {
          sqliteService.setAccountSetId(currentAccountSet.id);
          console.log('Database sync: Set account set ID to', currentAccountSet.id);
        }

        // 3. 从 SQLite 加载数据到各个 store
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

  // 导出数据功能
  const exportData = async () => {
    try {
      const data = await sqliteService.exportData();

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

  // 导入数据功能
  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await sqliteService.importData(data);

      await reloadAllStores();

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