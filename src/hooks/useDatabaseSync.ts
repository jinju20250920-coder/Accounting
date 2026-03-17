import { useEffect } from 'react';
import { database } from '@/lib/database';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useDepartmentStore } from '@/stores/useDepartmentStore';
import { useFinancialProjectStore } from '@/stores/useFinancialProjectStore';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { useVoucherTemplateStore } from '@/stores/useVoucherTemplateStore';
import { useSummaryStore } from '@/stores/useSummaryStore';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useToast } from '@/hooks/use-toast';

export function useDatabaseSync() {
  const { toast } = useToast();
  const voucherStore = useVoucherStore();
  const subjectStore = useSubjectStore();
  const departmentStore = useDepartmentStore();
  const projectStore = useFinancialProjectStore();
  const currencyStore = useCurrencyStore();
  const templateStore = useVoucherTemplateStore();
  const summaryStore = useSummaryStore();
  const partnerStore = usePartnerStore();

  useEffect(() => {
    const syncData = async () => {
      try {
        await database.init();

        // 检查是否有需要迁移的 localStorage 数据
        const hasVoucherData = localStorage.getItem('finance-vouchers');
        if (hasVoucherData) {
          console.log('Found localStorage data, checking if migration is needed...');
          try {
            const migratedFlag = await database.get('finance-vouchers-migrated');
            if (!migratedFlag) {
              console.log('Migrating data from localStorage to IndexedDB...');

              // 从各存储中恢复数据并保存到 IndexedDB
              await database.syncAllData([
                {
                  vouchers: voucherStore.vouchers,
                  subjects: subjectStore.subjects,
                  departments: departmentStore.departments,
                  projects: projectStore.projects
                }
              ]);

              // 标记为已迁移
              await database.set('finance-vouchers-migrated', true);

              toast({
                title: "数据迁移完成",
                description: "您的数据已从本地存储成功迁移到数据库",
                type: "success",
              });
            }
          } catch (migrationError) {
            console.error('Migration error:', migrationError);
            toast({
              title: "数据迁移失败",
              description: "部分数据未能成功迁移，但应用仍可正常使用",
              type: "error",
            });
          }
        }

        // 从 IndexedDB 恢复数据
        console.log('Restoring data from IndexedDB...');
        const restoredData = await database.restoreAllData();

        // 更新各存储
        if (restoredData.vouchers.length > 0 && voucherStore.vouchers.length === 0) {
          voucherStore.vouchers = restoredData.vouchers;
        }

        if (restoredData.subjects.length > 0 && subjectStore.subjects.length === 0) {
          // 迁移数据：为旧数据添加新字段
          const migratedSubjects = restoredData.subjects.map((s: any) => ({
            ...s,
            isCustomer: s.isCustomer ?? s.isAR ?? false,
            isSupplier: s.isSupplier ?? s.isAP ?? false,
            isEmployee: s.isEmployee ?? false,
            enableCashFlow: s.enableCashFlow ?? false,
            cashFlowItem: s.cashFlowItem ?? ''
          }));
          subjectStore.subjects = migratedSubjects as any;
        }

        if (restoredData.departments.length > 0 && departmentStore.departments.length === 0) {
          departmentStore.departments = restoredData.departments;
        }

        if (restoredData.projects.length > 0 && projectStore.projects.length === 0) {
          projectStore.projects = restoredData.projects;
        }

        // 恢复币别数据
        if (restoredData.currencies && restoredData.currencies.length > 0 && currencyStore.currencies.length === 0) {
          currencyStore.currencies = restoredData.currencies;
        }

        // 恢复凭证模板数据
        if (restoredData.templates && restoredData.templates.length > 0 && templateStore.templates.length === 0) {
          templateStore.templates = restoredData.templates;
        }

        // 恢复摘要数据
        if (restoredData.commonSummaries && restoredData.commonSummaries.length > 0 && summaryStore.commonSummaries.length === 0) {
          summaryStore.commonSummaries = restoredData.commonSummaries;
        }

        if (restoredData.recentSummaries && restoredData.recentSummaries.length > 0 && summaryStore.recentSummaries.length === 0) {
          summaryStore.recentSummaries = restoredData.recentSummaries;
        }

        // 恢复往来单位数据
        if (restoredData.partners && restoredData.partners.length > 0 && partnerStore.partners.length === 0) {
          partnerStore.importPartners(restoredData.partners);
        }

        // 检查数据完整性
        const integrity = await database.checkDataIntegrity();
        console.log('Data integrity check:', integrity);

        // 初始化币别数据（如果需要）
        if (currencyStore.currencies.length === 0) {
          currencyStore.initializeCurrencies();
        }

      } catch (error) {
        console.error('Database sync error:', error);
        toast({
          title: "数据库同步失败",
          description: "应用将在本地模式下运行，数据保存在浏览器中",
          type: "warning",
        });
      }
    };

    syncData();
  }, [voucherStore, subjectStore, departmentStore, projectStore, toast]);

  // 自动保存数据到数据库
  useEffect(() => {
    const saveInterval = setInterval(async () => {
      try {
        await database.init();

        // 保存凭证数据
        if (voucherStore.vouchers.length > 0) {
          for (const voucher of voucherStore.vouchers) {
            await database.saveVoucher(voucher);
          }
        }

        // 保存其他重要数据
        if (subjectStore.subjects.length > 0) {
          await database.saveSubjects(subjectStore.subjects);
        }

        if (departmentStore.departments.length > 0) {
          await database.saveDepartments(departmentStore.departments);
        }

        if (projectStore.projects.length > 0) {
          await database.saveProjects(projectStore.projects);
        }

        // 保存币别数据
        if (currencyStore.currencies.length > 0) {
          await database.set('currencies', currencyStore.currencies);
        }

        // 保存凭证模板数据
        if (templateStore.templates.length > 0) {
          await database.set('templates', templateStore.templates);
        }

        // 保存摘要数据
        if (summaryStore.commonSummaries.length > 0) {
          await database.set('commonSummaries', summaryStore.commonSummaries);
        }
        if (summaryStore.recentSummaries.length > 0) {
          await database.set('recentSummaries', summaryStore.recentSummaries);
        }

        // 保存往来单位数据
        if (partnerStore.partners.length > 0) {
          await database.set('partners', partnerStore.partners);
        }

      } catch (error) {
        console.error('Auto-save error:', error);
      }
    }, 30000); // 每30秒自动保存一次

    return () => clearInterval(saveInterval);
  }, [
    voucherStore.vouchers,
    subjectStore.subjects,
    departmentStore.departments,
    projectStore.projects,
    currencyStore.currencies,
    templateStore.templates,
    summaryStore.commonSummaries,
    summaryStore.recentSummaries,
    partnerStore.partners
  ]);

  // 导出数据功能
  const exportData = async () => {
    try {
      await database.init();
      const data = await database.exportData();

      // 创建下载链接
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "数据导出成功",
        description: "财务数据已成功导出到本地文件",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "数据导出失败",
        description: "无法导出数据，请重试",
        type: "error",
      });
    }
  };

  // 导入数据功能
  const importData = async (file: File) => {
    try {
      await database.init();
      const text = await file.text();
      const data = JSON.parse(text);

      await database.importData(data);

      // 更新本地状态
      voucherStore.vouchers = data.vouchers || [];
      subjectStore.subjects = data.subjects || [];
      departmentStore.departments = data.departments || [];
      projectStore.projects = data.projects || [];

      // 更新新增数据类型
      if (data.currencies) currencyStore.currencies = data.currencies;
      if (data.templates) templateStore.templates = data.templates;
      if (data.commonSummaries) summaryStore.commonSummaries = data.commonSummaries;
      if (data.recentSummaries) summaryStore.recentSummaries = data.recentSummaries;
      if (data.partners) partnerStore.importPartners(data.partners);

      toast({
        title: "数据导入成功",
        description: `成功导入 ${data.vouchers?.length || 0} 张凭证`,
        type: "success",
      });
    } catch (error) {
      toast({
        title: "数据导入失败",
        description: "导入文件格式错误或数据损坏",
        type: "error",
      });
    }
  };

  return {
    exportData,
    importData
  };
}
