'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { CurrentPeriodWrapper } from '@/components/layout/current-period-wrapper';
import { GlobalErrorProvider } from '@/components/error-boundary';
import { DatabaseSyncWrapper } from '@/components/DatabaseSyncWrapper';
import { FirstTimeWrapper } from '@/components/database/first-time-wrapper';
import { TaxReminderOnLogin } from '@/components/layout/tax-reminder-on-login';

export function AppLayout({ children }: { children: React.ReactNode }) {
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
              {children}
            </div>
          </div>
        </div>
      </FirstTimeWrapper>
    </GlobalErrorProvider>
  );
}