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
    }
  }), {
    name: 'finance-voucher-templates'
  })
);
