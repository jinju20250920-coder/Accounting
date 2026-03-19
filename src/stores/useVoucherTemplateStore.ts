import { create } from 'zustand';
import { databaseService } from '@/lib/database/service';
import type { VoucherFullTemplate, VoucherTemplateEntry } from '@/types';
import { useAccountSetStore } from './useAccountSetStore';

// 校验数据类型
interface TemplateValidationData {
  subjects: { code: string }[];
  departments: { code: string }[];
  projects: { code: string }[];
  currencies: { code: string }[];
}

// 凭证模版存储
interface VoucherTemplateStore {
  templates: VoucherFullTemplate[];

  // 模版操作
  addTemplate: (template: Omit<VoucherFullTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTemplate: (id: string, template: Partial<VoucherFullTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  getTemplate: (id: string) => VoucherFullTemplate | undefined;
  getAllTemplates: () => VoucherFullTemplate[];

  // 从凭证保存为模版
  saveAsTemplate: (name: string, description?: string, voucherType?: string) => void;

  // 导出导入
  exportTemplates: () => string;
  importTemplates: (data: string) => Promise<boolean>;
  exportTemplateToJSON: (id: string) => string;

  // Excel 导入导出
  importTemplatesFromExcel: (data: any[], validationData?: TemplateValidationData) => Promise<{ success: number; failed: number; errors: string[] }>;
  exportTemplatesToExcel: () => any[];

  // 初始化
  initializeTemplates: () => Promise<void>;
}

export const useVoucherTemplateStore = create<VoucherTemplateStore>((set, get) => ({
  templates: [],

  // 初始化模版
  initializeTemplates: async () => {
    try {
      const templates = await databaseService.getAllVoucherTemplates();
      set({ templates });
    } catch (error) {
      console.error('Failed to initialize templates:', error);
      throw error;
    }
  },

  // 模版操作
  addTemplate: async (templateData) => {
    try {
      // 获取当前账套ID
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const newTemplate: VoucherFullTemplate = {
        id: Date.now().toString(),
        ...templateData,
        voucherType: templateData.voucherType || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountSetId: currentAccountSet?.id
      };

      await databaseService.saveVoucherTemplates([...get().templates, newTemplate]);
      set((state) => ({
        templates: [...state.templates, newTemplate]
      }));
    } catch (error) {
      console.error('Failed to add template:', error);
      throw error;
    }
  },

  updateTemplate: async (id: string, templateData: Partial<VoucherFullTemplate>) => {
    try {
      const state = get();
      const updatedTemplates = state.templates.map(template =>
        template.id === id
          ? { ...template, ...templateData, updatedAt: new Date().toISOString() }
          : template
      );
      await databaseService.saveVoucherTemplates(updatedTemplates);
      set({ templates: updatedTemplates });
    } catch (error) {
      console.error('Failed to update template:', error);
      throw error;
    }
  },

  deleteTemplate: async (id: string) => {
    try {
      const state = get();
      const updatedTemplates = state.templates.filter(template => template.id !== id);
      await databaseService.saveVoucherTemplates(updatedTemplates);
      set({ templates: updatedTemplates });
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  },

  getTemplate: (id: string) => {
    const state = get();
    return state.templates.find(template => template.id === id);
  },

  getAllTemplates: () => {
    const state = get();
    return [...state.templates];
  },

  // 从凭证保存为模版
  saveAsTemplate: (name: string, description?: string, voucherType?: string) => {
    // 这个方法会在凭证录入页面调用，需要访问当前凭证数据
    // 这里只是一个占位，实际实现需要与 useVoucherStore 集成
  },

  // 导出所有模版
  exportTemplates: () => {
    const state = get();
    return JSON.stringify({
      version: '1.0',
      exportTime: new Date().toISOString(),
      templates: state.templates
    }, null, 2);
  },

  // 导入模版
  importTemplates: async (data: string) => {
    try {
      const parsed = JSON.parse(data);

      if (!parsed.templates || !Array.isArray(parsed.templates)) {
        throw new Error('Invalid template data format');
      }

      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      // 验证模版数据
      const validTemplates: VoucherFullTemplate[] = parsed.templates.map((template: any) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: template.name || '未命名模版',
        description: template.description || '',
        voucherType: template.voucherType || 'general',
        entries: template.entries || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountSetId: currentAccountSet?.id
      }));

      await databaseService.saveVoucherTemplates([...get().templates, ...validTemplates]);
      set((state) => ({
        templates: [...state.templates, ...validTemplates]
      }));

      return true;
    } catch (error) {
      console.error('Failed to import templates:', error);
      return false;
    }
  },

  // 导出单个模版为 JSON
  exportTemplateToJSON: (id: string) => {
    const template = get().templates.find(t => t.id === id);
    if (!template) {
      throw new Error('Template not found');
    }

    return JSON.stringify({
      version: '1.0',
      exportTime: new Date().toISOString(),
      template
    }, null, 2);
  },

  // Excel 导入凭证模版
  importTemplatesFromExcel: async (data: any[], validationData?: {
    subjects: { code: string }[];
    departments: { code: string }[];
    projects: { code: string }[];
    currencies: { code: string }[];
  }) => {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    const newTemplates: VoucherFullTemplate[] = [];

    // 按模版分组处理
    const templateMap = new Map<string, any[]>();
    data.forEach((row, index) => {
      const templateName = row['模版名称'];
      if (!templateName) {
        failed++;
        errors.push(`第${index + 2}行：模版名称不能为空`);
        return;
      }

      if (!templateMap.has(templateName)) {
        templateMap.set(templateName, []);
      }
      templateMap.get(templateName)?.push({ row, index });
    });

    // 提取校验数据 - 如果没有传递 validationData，则不进行校验
    const subjectCodes = validationData?.subjects ? new Set(validationData.subjects.map(s => s.code)) : new Set<string>();
    const departmentCodes = validationData?.departments ? new Set(validationData.departments.map(d => d.code)) : new Set<string>();
    const projectCodes = validationData?.projects ? new Set(validationData.projects.map(p => p.code)) : new Set<string>();
    const currencyCodes = validationData?.currencies ? new Set(validationData.currencies.map(c => c.code)) : new Set<string>();

    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();

    // 处理每个模版
    templateMap.forEach((templateRows, templateName) => {
      const templateDescription = templateRows[0].row['模版描述'];
      const voucherType = templateRows[0].row['凭证类型'];

      const entries: VoucherTemplateEntry[] = [];
      let hasValidEntries = false;
      let templateValid = true;

      templateRows.forEach(({ row, index }) => {
        const subjectCode = row['科目代码'];
        const subjectName = row['科目名称'];
        const debit = Number(row['借方']);
        const credit = Number(row['贷方']);
        const deptCode = row['部门代码'];
        const projectCode = row['项目代码'];
        const currencyCode = row['币别代码'];

        // 校验科目代码（仅在 validationData 存在时）
        if (validationData && subjectCode && subjectCode.trim()) {
          if (!subjectCodes.has(subjectCode.trim())) {
            templateValid = false;
            errors.push(`模版"${templateName}"第${index + 2}行：科目代码"${subjectCode}"不存在`);
          }
        }

        // 校验部门代码（仅在 validationData 存在时）
        if (validationData && deptCode && deptCode.trim()) {
          if (!departmentCodes.has(deptCode.trim())) {
            templateValid = false;
            errors.push(`模版"${templateName}"第${index + 2}行：部门代码"${deptCode}"不存在`);
          }
        }

        // 校验项目代码（仅在 validationData 存在时）
        if (validationData && projectCode && projectCode.trim()) {
          if (!projectCodes.has(projectCode.trim())) {
            templateValid = false;
            errors.push(`模版"${templateName}"第${index + 2}行：项目代码"${projectCode}"不存在`);
          }
        }

        // 校验币别代码（仅在 validationData 存在时）
        if (validationData && currencyCode && currencyCode.trim()) {
          if (!currencyCodes.has(currencyCode.trim())) {
            templateValid = false;
            errors.push(`模版"${templateName}"第${index + 2}行：币别代码"${currencyCode}"不存在`);
          }
        }

        if (subjectCode || subjectName) {
          const entry: VoucherTemplateEntry = {
            id: `entry_${Date.now()}_${index}`,
            subjectCode: subjectCode || '',
            subjectName: subjectName || '',
            debit: !isNaN(debit) ? debit : 0,
            credit: !isNaN(credit) ? credit : 0,
            deptCode: row['部门代码'] || '',
            projectCode: row['项目代码'] || '',
            summary: row['摘要'] || '',
            currencyCode: row['币别代码'] || '',
            currencyName: row['币别名称'] || '',
            cashFlowItem: row['现金流量项目'] || '',
            customerName: row['客户名称'] || '',
            supplierName: row['供应商名称'] || ''
          };

          entries.push(entry);
          hasValidEntries = true;
        }
      });

      if (templateValid && hasValidEntries) {
        const newTemplate: VoucherFullTemplate = {
          id: Date.now().toString() + '_' + templateName,
          name: templateName,
          description: templateDescription || '',
          voucherType: voucherType || 'general',
          entries,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          accountSetId: currentAccountSet?.id
        };

        newTemplates.push(newTemplate);
        success++;
      } else {
        failed++;
        if (!templateValid) {
          errors.push(`模版"${templateName}"导入失败：存在无效的科目、部门、项目或币别代码`);
        } else if (!hasValidEntries) {
          errors.push(`模版"${templateName}"没有有效的分录`);
        }
      }
    });

    if (newTemplates.length > 0) {
      await databaseService.saveVoucherTemplates([...get().templates, ...newTemplates]);
      set((state) => ({
        templates: [...state.templates, ...newTemplates]
      }));
    }

    return { success, failed, errors };
  },

  // Excel 导出凭证模版
  exportTemplatesToExcel: () => {
    const state = get();
    const exportData: any[] = [];

    state.templates.forEach(template => {
      template.entries.forEach(entry => {
        exportData.push({
          '模版名称': template.name,
          '模版描述': template.description,
          '凭证类型': template.voucherType,
          '摘要': entry.summary,
          '科目代码': entry.subjectCode,
          '科目名称': entry.subjectName,
          '借方': entry.debit,
          '贷方': entry.credit,
          '部门代码': entry.deptCode,
          '部门名称': '',
          '项目代码': entry.projectCode,
          '项目名称': '',
          '币别代码': entry.currencyCode,
          '币别名称': entry.currencyName,
          '现金流量项目': entry.cashFlowItem,
          '客户名称': entry.customerName,
          '供应商名称': entry.supplierName
        });
      });
    });

    return exportData;
  }
}));
