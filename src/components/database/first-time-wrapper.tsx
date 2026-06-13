'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { accountSetDbManager } from '@/lib/database/account-set-db-manager';
import { useAccountSetStore } from '@/stores';
import { sqliteService } from '@/lib/database/sqlite-service';

interface FirstTimeWrapperProps {
  children: React.ReactNode;
}

/**
 * 首次使用检测包装器
 * 检测数据库中是否有账套，如果没有则自动创建一个最小账套记录
 * 并跳转到完整的设置向导 (/setup)
 */
export function FirstTimeWrapper({ children }: FirstTimeWrapperProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        // 已完成过向导则跳过
        if (localStorage.getItem('hasCompletedWizard')) {
          setIsChecking(false);
          return;
        }

        // 检查数据库中是否有账套记录
        const dbAccountSets = await accountSetDbManager.getAllAccountSets();
        if (dbAccountSets.length > 0) {
          // 有账套数据，标记已完成（可能是从导入恢复的）
          localStorage.setItem('hasCompletedWizard', 'true');
          setIsChecking(false);
          return;
        }

        // 首次使用：创建最小账套记录，然后跳转到完整设置向导
        const now = new Date();
        const enableDate = now.toISOString().slice(0, 7);
        const startDate = now.toISOString().split('T')[0];

        const store = useAccountSetStore.getState();
        const newSet = await store.addAccountSet({
          code: 'SET001',
          name: '我的公司',
          unifiedSocialCreditCode: '',
          taxNo: '',
          address: '',
          currentPeriod: enableDate,
          status: 'active',
          startDate,
          enableDate,
          baseCurrency: '人民币',
          accountingStandard: 'small-enterprise',
        });

        if (newSet) {
          // 同步 sqliteService 的 accountSetId
          sqliteService.setAccountSetId(newSet.id);

          // 标记已完成（防止重复触发）
          localStorage.setItem('hasCompletedWizard', 'true');

          // 跳转到完整设置向导
          const params = new URLSearchParams({
            id: newSet.id,
            name: newSet.name,
            code: newSet.code,
            startDate: newSet.startDate || startDate,
            enableDate: newSet.enableDate || enableDate,
          });
          router.replace(`/setup?${params.toString()}`);
          return;
        }
      } catch (error) {
        console.error('Failed to check first-time status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkFirstTime();
  }, [router]);

  if (isChecking) {
    return (
      <>
        {children}
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-3" />
            <p className="text-sm text-slate-600">正在准备初始设置...</p>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
