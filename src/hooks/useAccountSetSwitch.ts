'use client';

import { useEffect } from 'react';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useDepartmentStore } from '@/stores/useDepartmentStore';
import { useFinancialProjectStore } from '@/stores/useFinancialProjectStore';

// 账套数据切换 Hook
export function useAccountSetSwitch() {
  const { currentAccountSetId, getCurrentAccountSet } = useAccountSetStore();

  useEffect(() => {
    if (!currentAccountSetId) return;

    const accountSet = getCurrentAccountSet();
    console.log('切换到账套:', accountSet?.name, currentAccountSetId);

    // 检查是否是第一次加载（避免无限刷新）
    const lastAccountSetId = sessionStorage.getItem('lastAccountSetId');

    // 第一次加载时，保存当前账套ID
    if (!lastAccountSetId) {
      sessionStorage.setItem('lastAccountSetId', currentAccountSetId);
      return;
    }

    // 如果账套真的改变了
    if (lastAccountSetId !== currentAccountSetId) {
      sessionStorage.setItem('lastAccountSetId', currentAccountSetId);

      console.log('检测到账套切换，正在重新加载所有数据...');

      // 重新初始化所有 store 的数据
      try {
        const voucherStore = useVoucherStore.getState();
        voucherStore.clearVoucher();
        // 重新初始化凭证数据
        voucherStore.initialize();
        console.log('凭证数据已重新加载');
      } catch (e) {
        console.warn('重新加载凭证数据失败:', e);
      }

      // 重新初始化科目数据
      try {
        const subjectStore = useSubjectStore.getState();
        subjectStore.initializeSubjects();
        console.log('科目数据已重新加载');
      } catch (e) {
        console.warn('重新加载科目数据失败:', e);
      }

      // 重新初始化部门数据
      try {
        const departmentStore = useDepartmentStore.getState();
        if (departmentStore.initializeDepartments) {
          departmentStore.initializeDepartments();
        }
        console.log('部门数据已重新加载');
      } catch (e) {
        console.warn('重新加载部门数据失败:', e);
      }

      // 重新初始化项目数据
      try {
        const projectStore = useFinancialProjectStore.getState();
        if (projectStore.initializeProjects) {
          projectStore.initializeProjects();
        }
        console.log('项目数据已重新加载');
      } catch (e) {
        console.warn('重新加载项目数据失败:', e);
      }

      console.log('所有数据重新加载完成');
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
