'use client';

/**
 * TenantContext — 提供当前租户 ID + 切换方法。
 *
 * 切换租户时：
 *   1. 调用 sqliteService.setTenantId()
 *   2. 触发 useDatabaseSync 监听 → 重载所有 store
 *   3. 写入 sessionStorage 持久化（页面刷新后恢复）
 *
 * 注意：本 Context 仅持有 currentTenantId 状态。真正的 SQL 同步由 useDatabaseSync 完成。
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { sqliteService } from '@/lib/database';

interface TenantContextValue {
  currentTenantId: string | null;
  setCurrentTenantId: (tenantId: string | null) => void;
}

const TenantContext = createContext<TenantContextValue>({
  currentTenantId: null,
  setCurrentTenantId: () => {},
});

const STORAGE_KEY = 'currentTenantId';

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(STORAGE_KEY);
  });

  const setCurrentTenantId = (tenantId: string | null) => {
    setCurrentTenantIdState(tenantId);
    if (tenantId) {
      sessionStorage.setItem(STORAGE_KEY, tenantId);
      sqliteService.setTenantId(tenantId);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  // 启动时同步 sqliteService 的初始 tenantId
  useEffect(() => {
    if (currentTenantId) {
      sqliteService.setTenantId(currentTenantId);
    }
  }, [currentTenantId]);

  return (
    <TenantContext.Provider value={{ currentTenantId, setCurrentTenantId }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
