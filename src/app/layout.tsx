'use client';

import '@/app/globals.css';
import { usePathname } from 'next/navigation';
import { ToastProvider } from '@/components/ui/toast';
import { AuthGuard } from '@/components/layout/auth-guard';
import { AppLayout } from '@/components/layout/app-layout';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname.startsWith('/login');
  const isSelectTenantPage = pathname.startsWith('/select-tenant');
  const isStandalonePage = isLoginPage || isSelectTenantPage;

  return (
    <html lang="zh-CN">
      <head>
        <title>金桔财务系统</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <ToastProvider>
          <AuthGuard>
            {isStandalonePage ? (
              children
            ) : (
              <AppLayout>{children}</AppLayout>
            )}
          </AuthGuard>
        </ToastProvider>
      </body>
    </html>
  );
}