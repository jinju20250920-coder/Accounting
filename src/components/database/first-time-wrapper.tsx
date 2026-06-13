'use client';

import { useEffect, useState } from 'react';
import { FirstTimeWizard } from './first-time-wizard';
import { accountSetDbManager } from '@/lib/database/account-set-db-manager';

interface FirstTimeWrapperProps {
  children: React.ReactNode;
}

/**
 * 首次使用检测包装器
 * - 检测是否有账套存在
 * - 如果没有账套，显示首次使用向导
 * - 向导完成后才能访问主应用
 */
export function FirstTimeWrapper({ children }: FirstTimeWrapperProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const checkFirstTime = async () => {
      setIsLoading(true);

      try {
        // 检查 localStorage 是否已完成向导
        const hasCompletedWizard = localStorage.getItem('hasCompletedWizard');
        if (hasCompletedWizard) {
          setIsLoading(false);
          return;
        }

        // 检查数据库中是否有账套记录（权威数据源）
        const dbAccountSets = await accountSetDbManager.getAllAccountSets();
        if (dbAccountSets.length === 0) {
          setShowWizard(true);
        }
      } catch (error) {
        console.error('Failed to check first-time status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkFirstTime();
  }, []);

  const handleWizardComplete = () => {
    // 标记已完成向导
    localStorage.setItem('hasCompletedWizard', 'true');
    setShowWizard(false);
  };

  return (
    <>
      {children}
      <FirstTimeWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={handleWizardComplete}
      />
    </>
  );
}
