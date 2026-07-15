'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTaxStore } from '@/stores/useTaxStore';
import { useToast } from '@/hooks/use-toast';

/**
 * 登录成功且税务 store 加载完成后，若本周内有未申报/已逾期项，弹一次汇总 Toast。
 * 每会话只弹一次（firedRef 防重复）。
 */
export function TaxReminderOnLogin() {
  const firedRef = useRef(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const taxLoading = useTaxStore((s) => s.loading);
  const getCurrentAlerts = useTaxStore((s) => s.getCurrentAlerts);
  const { toast } = useToast();

  useEffect(() => {
    if (firedRef.current) return;
    if (!isAuthenticated || taxLoading) return;
    firedRef.current = true;

    const alerts = getCurrentAlerts();
    const urgent = alerts.filter((a) => a.status !== 'filed' && a.daysRemaining <= 7);
    if (urgent.length > 0) {
      const overdue = urgent.filter((a) => a.daysRemaining < 0).length;
      toast({
        type: 'warning',
        title: `您有 ${urgent.length} 项税务申报需尽快处理${overdue ? `（${overdue} 项已逾期）` : ''}`,
      });
    }
  }, [isAuthenticated, taxLoading, getCurrentAlerts, toast]);

  return null;
}
