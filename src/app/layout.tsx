import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalErrorProvider } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { DatabaseSyncWrapper } from "@/components/DatabaseSyncWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 财务 Assistant",
  description: "现代化的Web会计凭证录入系统",
};

export const dynamic = 'force-dynamic';

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
            <DatabaseSyncWrapper />
            <div className="flex h-screen bg-slate-50">
              <Sidebar />
              <div className="flex-1 overflow-auto">
                {children}
              </div>
            </div>
          </GlobalErrorProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
