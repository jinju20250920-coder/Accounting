'use client';

import { useEffect } from 'react';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';

// 账套数据切换 Hook
export function useAccountSetSwitch() {
  const { currentAccountSetId, getCurrentAccountSet } = useAccountSetStore();

  useEffect(() => {
    if (!currentAccountSetId) return;

    const accountSet = getCurrentAccountSet();
    console.log('切换到账套:', accountSet?.name, currentAccountSetId);

    // 触发各个 store 的数据重置/重新加载
    // 注意：实际的数据隔离是通过 persist 中间件的 storage 层处理的
    // 这里我们通过重置 store 状态来触发重新加载

    // 重置凭证 store
    try {
      const voucherStore = useVoucherStore.getState();
      // 清空当前编辑状态
      voucherStore.clearVoucher();
      // 注意：实际的数据重新加载由 persist 中间件的 storage 处理
    } catch (e) {
      console.warn('重置凭证 store 失败:', e);
    }

    // 重置科目 store - 重新初始化科目数据
    try {
      const subjectStore = useSubjectStore.getState();
      // 科目初始化会在 store 内部处理
      // 这里只是确保科目数据正确加载
      setTimeout(() => {
        subjectStore.initializeSubjects();
      }, 0);
    } catch (e) {
      console.warn('重置科目 store 失败:', e);
    }

  }, [currentAccountSetId, getCurrentAccountSet]);
}

// 初始化 Hook - 在应用启动时调用
export function useAccountSetInit() {
  const {
    accountSets,
    currentAccountSetId,
    setCurrentAccountSet,
    getCurrentAccountSet
  } = useAccountSetStore();

  useEffect(() => {
    // 如果没有当前选中的账套，但有账套列表，自动选择第一个
    if (!currentAccountSetId && accountSets.length > 0) {
      console.log('自动选择第一个账套:', accountSets[0].name);
      setCurrentAccountSet(accountSets[0].id);
    }
  }, [currentAccountSetId, accountSets, setCurrentAccountSet]);

  // 返回初始化状态
  return {
    isReady: currentAccountSetId !== null || accountSets.length === 0,
    currentAccountSet: getCurrentAccountSet(),
    currentAccountSetId
  };
}
