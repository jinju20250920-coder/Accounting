'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { sqliteService } from '@/lib/database';
import { useAccountSetStore } from '@/stores/useAccountSetStore';

const PUBLIC_PATHS = ['/login', '/select-tenant'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentTenantId = useAuthStore((s) => s.currentTenantId);
  const currentUser = useAuthStore((s) => s.currentUser);
  const loadUserPermissions = useAuthStore((s) => s.loadUserPermissions);
  const currentAccountSetId = useAccountSetStore((s) => s.currentAccountSetId);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 等待 store 从 localStorage 恢复
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 启动时同步 sqliteService 的 tenantId
  useEffect(() => {
    if (isReady && currentTenantId && currentUser) {
      sqliteService.setTenantId(currentTenantId);
      if (currentAccountSetId) sqliteService.setAccountSetId(currentAccountSetId);
      void loadUserPermissions(currentUser.id, currentTenantId, currentAccountSetId || undefined)
        .catch((error) => console.error('Failed to restore user permissions:', error));
    }
  }, [isReady, currentTenantId, currentUser, currentAccountSetId, loadUserPermissions]);

  useEffect(() => {
    if (!isReady) return;

    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    const isTenantSelectPage = pathname.startsWith('/select-tenant');

    if (!isAuthenticated && !isPublic) {
      router.replace('/login');
    } else if (isAuthenticated && pathname.startsWith('/login')) {
      // 已登录访问登录页 → 重定向
      router.replace(currentTenantId ? '/' : '/select-tenant');
    } else if (isAuthenticated && !currentTenantId && !isTenantSelectPage) {
      // 已登录但未选租户 → 选租户页
      router.replace('/select-tenant');
    }
  }, [isAuthenticated, currentTenantId, pathname, router, isReady]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (!isAuthenticated && !isPublic) return null;
  if (isAuthenticated && pathname.startsWith('/login')) return null;

  return <>{children}</>;
}
