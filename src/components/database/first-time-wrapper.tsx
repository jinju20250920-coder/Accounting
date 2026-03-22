'use client';

import { useEffect, useState } from 'react';
import { useAccountSetStore } from '@/stores';
import { FirstTimeWizard } from './first-time-wizard';
import { fileHandleManager } from '@/lib/database/file-handle-manager';

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
  const { accountSets } = useAccountSetStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const checkFirstTime = async () => {
      setIsLoading(true);

      try {
        // 检查 IndexedDB 中是否有账套文件信息
        const dbAccountSets = await fileHandleManager.getAllAccountSets();

        // 检查 localStorage 是否有首次使用标记
        const hasCompletedWizard = localStorage.getItem('hasCompletedWizard');

        // 判断是否需要显示向导
        const needsWizard =
          accountSets.length === 0 &&
          dbAccountSets.length === 0 &&
          !hasCompletedWizard;

        if (needsWizard) {
          setShowWizard(true);
        }
      } catch (error) {
        console.error('Failed to check first-time status:', error);
        // 出错时不阻止用户使用
      } finally {
        setIsLoading(false);
      }
    };

    checkFirstTime();
  }, [accountSets.length]);

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
