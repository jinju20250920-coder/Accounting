'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { CurrentPeriodWrapper } from '@/components/layout/current-period-wrapper';
import { PageKeeper } from '@/components/layout/page-keeper';
import { GlobalErrorProvider } from '@/components/error-boundary';
import { DatabaseSyncWrapper } from '@/components/DatabaseSyncWrapper';
import { FirstTimeWrapper } from '@/components/database/first-time-wrapper';
import { TaxReminderOnLogin } from '@/components/layout/tax-reminder-on-login';
import { useTabStore } from '@/stores/useTabStore';
import { getRouteMeta } from '@/lib/nav-menu';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    useTabStore.getState().registerRoute(pathname, getRouteMeta(pathname));
  }, [pathname]);

  return (
    <GlobalErrorProvider>
      <FirstTimeWrapper>
        <DatabaseSyncWrapper />
        <TaxReminderOnLogin />
        <div className="flex h-screen bg-slate-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <CurrentPeriodWrapper />
            <div className="flex-1 overflow-auto">
              <PageKeeper pathname={pathname}>{children}</PageKeeper>
            </div>
          </div>
        </div>
      </FirstTimeWrapper>
    </GlobalErrorProvider>
  );
}
