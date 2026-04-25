import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalErrorProvider } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { DatabaseSyncWrapper } from "@/components/DatabaseSyncWrapper";
import { FirstTimeWrapper } from "@/components/database/first-time-wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "金桔财务系统",
  description: "现代化的Web会计凭证录入系统",
};

import { CurrentPeriodWrapper } from "@/components/layout/current-period-wrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <GlobalErrorProvider>
            <FirstTimeWrapper>
              <DatabaseSyncWrapper />
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
        </ToastProvider>
      </body>
    </html>
  );
}
