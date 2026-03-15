import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { VoucherFullTemplate, VoucherTemplateEntry } from '@/types';

// 凭证模版存储
interface VoucherTemplateStore {
  templates: VoucherFullTemplate[];

  // 模版操作
  addTemplate: (template: Omit<VoucherFullTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTemplate: (id: string, template: Partial<VoucherFullTemplate>) => void;
  deleteTemplate: (id: string) => void;
  getTemplate: (id: string) => VoucherFullTemplate | undefined;
  getAllTemplates: () => VoucherFullTemplate[];

  // 从凭证保存为模版
  saveAsTemplate: (name: string, description?: string, voucherType?: string) => void;

  // 导出导入
  exportTemplates: () => string;
  importTemplates: (data: string) => boolean;
  exportTemplateToJSON: (id: string) => string;

  // Excel 导入导出
  importTemplatesFromExcel: (data: any[]) => { success: number; failed: number; errors: string[] };
  exportTemplatesToExcel: () => any[];
}

export const useVoucherTemplateStore = create<VoucherTemplateStore>()(
  persist((set, get) => ({
    templates: [],

    // 模版操作
    addTemplate: (templateData) => set((state) => {
      const newTemplate: VoucherFullTemplate = {
        id: Date.now().toString(),
        ...templateData,
        voucherType: templateData.voucherType || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return {
        templates: [...state.templates, newTemplate]
      };
    }),

    updateTemplate: (id: string, templateData: Partial<VoucherFullTemplate>) => set((state) => ({
      templates: state.templates.map(template =>
        template.id === id
          ? { ...template, ...templateData, updatedAt: new Date().toISOString() }
          : template
      )
    })),

    deleteTemplate: (id: string) => set((state) => ({
      templates: state.templates.filter(template => template.id !== id)
    })),

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
    importTemplates: (data: string) => {
      try {
        const parsed = JSON.parse(data);

        if (!parsed.templates || !Array.isArray(parsed.templates)) {
          throw new Error('Invalid template data format');
        }

        // 验证模版数据
        const validTemplates: VoucherFullTemplate[] = parsed.templates.map((template: any) => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: template.name || '未命名模版',
          description: template.description || '',
          voucherType: template.voucherType || 'general',
          entries: template.entries || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

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
    importTemplatesFromExcel: (data: any[]) => {
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

      // 处理每个模版
      templateMap.forEach((templateRows, templateName) => {
        const templateDescription = templateRows[0].row['模版描述'];
        const voucherType = templateRows[0].row['凭证类型'];

        const entries: VoucherTemplateEntry[] = [];
        let hasValidEntries = false;

        templateRows.forEach(({ row, index }) => {
          const subjectCode = row['科目代码'];
          const subjectName = row['科目名称'];
          const debit = Number(row['借方']);
          const credit = Number(row['贷方']);

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

        if (hasValidEntries) {
          const newTemplate: VoucherFullTemplate = {
            id: Date.now().toString() + '_' + templateName,
            name: templateName,
            description: templateDescription || '',
            voucherType: voucherType || 'general',
            entries,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          newTemplates.push(newTemplate);
          success++;
        } else {
          failed++;
          errors.push(`模版"${templateName}"没有有效的分录`);
        }
      });

      if (newTemplates.length > 0) {
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
  }), {
    name: 'finance-voucher-templates'
  })
);
