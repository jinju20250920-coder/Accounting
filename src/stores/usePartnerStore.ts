'use client';

import { create } from 'zustand';
import { getCurrentService } from '@/lib/database';
import type { Partner } from '@/types';
import { useAccountSetStore } from './useAccountSetStore';

// 默认数据
const defaultPartners: Omit<Partner, 'id' | 'createTime' | 'updateTime' | 'accountSetId'>[] = [
  {
    code: 'ABC001',
    name: '上海科技有限公司',
    isCustomer: true,
    isSupplier: false,
    isEmployee: false,
    contact: '张三',
    phone: '021-12345678',
    email: 'zhangsan@example.com',
    address: '上海市浦东新区张江高科技园区',
    taxNumber: '310115XXXXXXXX',
    bankAccount: '622588XXXXXXXXXXX',
    bankName: '中国工商银行',
    frozen: false
  },
  {
    code: 'XYZ001',
    name: '北京商贸有限公司',
    isCustomer: true,
    isSupplier: true,
    isEmployee: false,
    contact: '李四',
    phone: '010-87654321',
    email: 'lisi@example.com',
    address: '北京市朝阳区建国路88号',
    taxNumber: '110115XXXXXXXX',
    bankAccount: '622202XXXXXXXXXXX',
    bankName: '中国建设银行',
    frozen: false
  },
  {
    code: 'SUP001',
    name: '广州电子科技有限公司',
    isCustomer: false,
    isSupplier: true,
    isEmployee: false,
    contact: '王五',
    phone: '020-87654321',
    email: 'wangwu@example.com',
    address: '广州市天河区天河路123号',
    taxNumber: '440115XXXXXXXX',
    bankAccount: '621700XXXXXXXXXXX',
    bankName: '中国农业银行',
    frozen: false
  },
  {
    code: 'EMP001',
    name: '赵六',
    isCustomer: false,
    isSupplier: false,
    isEmployee: true,
    contact: '赵六',
    phone: '13800138000',
    email: 'zhaoliu@example.com',
    address: '上海市黄浦区南京东路100号',
    taxNumber: '',
    bankAccount: '622848XXXXXXXXXXX',
    bankName: '中国银行',
    frozen: false
  }
];

const legacyEmployeePayrollSubjects = {
  payrollSalaryExpenseSubjectCode: '660201',
  payrollSalaryExpenseSubjectName: '管理费用-工资',
  payrollContributionExpenseSubjectCode: '660203',
  payrollContributionExpenseSubjectName: '管理费用-社保公积金',
  payrollSalaryPayableSubjectCode: '2211',
  payrollSalaryPayableSubjectName: '应付职工薪酬',
  payrollTaxPayableSubjectCode: '2221',
  payrollTaxPayableSubjectName: '应交税费-个人所得税',
  payrollEmployeeContributionPayableSubjectCode: '2241',
  payrollEmployeeContributionPayableSubjectName: '其他应付款-个人社保公积金',
} as const;

function stripLegacyEmployeePayrollSubjects(partner: Partner): Partner {
  if (
    !partner.isEmployee
    || partner.payrollSalaryExpenseSubjectCode !== legacyEmployeePayrollSubjects.payrollSalaryExpenseSubjectCode
    || partner.payrollContributionExpenseSubjectCode !== legacyEmployeePayrollSubjects.payrollContributionExpenseSubjectCode
    || partner.payrollSalaryPayableSubjectCode !== legacyEmployeePayrollSubjects.payrollSalaryPayableSubjectCode
    || partner.payrollTaxPayableSubjectCode !== legacyEmployeePayrollSubjects.payrollTaxPayableSubjectCode
    || partner.payrollEmployeeContributionPayableSubjectCode !== legacyEmployeePayrollSubjects.payrollEmployeeContributionPayableSubjectCode
  ) {
    return partner;
  }

  return {
    ...partner,
    payrollSalaryExpenseSubjectCode: undefined,
    payrollSalaryExpenseSubjectName: undefined,
    payrollContributionExpenseSubjectCode: undefined,
    payrollContributionExpenseSubjectName: undefined,
    payrollSalaryPayableSubjectCode: undefined,
    payrollSalaryPayableSubjectName: undefined,
    payrollTaxPayableSubjectCode: undefined,
    payrollTaxPayableSubjectName: undefined,
    payrollEmployeeContributionPayableSubjectCode: undefined,
    payrollEmployeeContributionPayableSubjectName: undefined,
  };
}

// 状态接口
interface PartnerStore {
  partners: Partner[];
  searchQuery: string;
  selectedPartnerId: string | null;

  // CRUD 操作
  addPartner: (partner: Omit<Partner, 'id' | 'createTime' | 'updateTime'>) => Promise<Partner>;
  updatePartner: (id: string, updates: Partial<Partner>) => Promise<void>;
  deletePartner: (id: string) => Promise<void>;
  toggleFrozen: (id: string) => Promise<void>;
  setSelectedPartnerId: (id: string | null) => void;

  // 查询操作
  findByName: (name: string) => Partner | undefined;
  getPartnerById: (id: string) => Partner | undefined;
  getPartnersByType: (type: 'customer' | 'supplier' | 'employee') => Partner[];
  searchPartners: (query: string) => Partner[];
  getAllPartners: () => Partner[];

  // 导入导出
  importPartners: (partners: Omit<Partner, 'id' | 'createTime' | 'updateTime'>[]) => Promise<void>;
  exportPartners: () => string;

  // 批量操作
  clearAllPartners: () => Promise<void>;
  initializePartners: () => Promise<void>;
}

export const usePartnerStore = create<PartnerStore>((set, get) => ({
  partners: [],
  searchQuery: '',
  selectedPartnerId: null,

  // 添加往来单位
  addPartner: async (partnerData) => {
    try {
      const state = get();
      const normalizedPartnerData = stripLegacyEmployeePayrollSubjects(partnerData as Partner);

      // 检查代码是否重复
      const existing = state.partners.find(p => p.code === normalizedPartnerData.code);
      if (existing) {
        throw new Error(`往来单位代码 ${normalizedPartnerData.code} 已存在，请使用其他代码`);
      }

      // 检查必须至少选择一种身份
      if (!normalizedPartnerData.isCustomer && !normalizedPartnerData.isSupplier && !normalizedPartnerData.isEmployee) {
        throw new Error('请至少勾选一种身份：客户、供应商或雇员');
      }

      // 获取当前账套ID
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const newPartner: Partner = {
        ...normalizedPartnerData,
        id: `partner_${Date.now()}`,
        frozen: normalizedPartnerData.frozen || false,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        accountSetId: currentAccountSet?.id
      };

      await getCurrentService().savePartners([...state.partners, newPartner]);
      set({
        partners: [...state.partners, newPartner]
      });

      return newPartner;
    } catch (error) {
      console.error('Failed to add partner:', error);
      throw error;
    }
  },

  // 更新往来单位
  updatePartner: async (id, updates) => {
    try {
      const state = get();

      // 如果修改了代码，检查是否重复
      if (updates.code) {
        const existing = state.partners.find(p => p.code === updates.code && p.id !== id);
        if (existing) {
          throw new Error(`往来单位代码 ${updates.code} 已存在，请使用其他代码`);
        }
      }

      // 如果修改了身份，确保至少有一个身份
      if (updates.isCustomer !== undefined || updates.isSupplier !== undefined || updates.isEmployee !== undefined) {
        const current = state.partners.find(p => p.id === id);
        const newCustomer = updates.isCustomer ?? current?.isCustomer ?? false;
        const newSupplier = updates.isSupplier ?? current?.isSupplier ?? false;
        const newEmployee = updates.isEmployee ?? current?.isEmployee ?? false;

        if (!newCustomer && !newSupplier && !newEmployee) {
          throw new Error('请至少勾选一种身份：客户、供应商或雇员');
        }
      }

      const updatedPartners = state.partners.map(partner =>
        partner.id === id ? { ...partner, ...updates } : partner
      );
      await getCurrentService().savePartners(updatedPartners);
      set({
        partners: updatedPartners
      });
    } catch (error) {
      console.error('Failed to update partner:', error);
      throw error;
    }
  },

  // 删除往来单位
  deletePartner: async (id) => {
    try {
      const state = get();
      const partner = state.partners.find(p => p.id === id);

      if (!partner) {
        throw new Error('往来单位不存在');
      }

      if (partner.frozen) {
        throw new Error('该往来单位已冻结，无法删除');
      }

      await getCurrentService().savePartners(state.partners.filter(p => p.id !== id));
      set({
        partners: state.partners.filter(p => p.id !== id),
        selectedPartnerId: state.selectedPartnerId === id ? null : state.selectedPartnerId
      });
    } catch (error) {
      console.error('Failed to delete partner:', error);
      throw error;
    }
  },

  // 切换冻结状态
  toggleFrozen: async (id) => {
    try {
      const state = get();
      const updatedPartners = state.partners.map(partner =>
        partner.id === id ? { ...partner, frozen: !partner.frozen } : partner
      );
      await getCurrentService().savePartners(updatedPartners);
      set((state) => ({
        partners: updatedPartners
      }));
    } catch (error) {
      console.error('Failed to toggle frozen:', error);
      throw error;
    }
  },

  // 设置选中的往来单位
  setSelectedPartnerId: (id) => {
    set({ selectedPartnerId: id });
  },

  // 查询方法
  findByName: (name) => {
    return get().partners.find(p => p.name === name);
  },

  getPartnerById: (id) => {
    return get().partners.find(p => p.id === id);
  },

  getPartnersByType: (type) => {
    const state = get();
    switch (type) {
      case 'customer':
        return state.partners.filter(p => p.isCustomer);
      case 'supplier':
        return state.partners.filter(p => p.isSupplier);
      case 'employee':
        return state.partners.filter(p => p.isEmployee);
      default:
        return [];
    }
  },

  searchPartners: (query) => {
    const state = get();
    const lowerQuery = query.toLowerCase();
    return state.partners.filter(partner =>
      partner.code.toLowerCase().includes(lowerQuery) ||
      partner.name.toLowerCase().includes(lowerQuery) ||
      (partner.contact && partner.contact.toLowerCase().includes(lowerQuery))
    );
  },

  getAllPartners: () => {
    return get().partners;
  },

  // 导入往来单位
  importPartners: async (partnersData) => {
    try {
      const state = get();
      const existingCodes = new Set(state.partners.map(p => p.code));
      const validPartners: Partner[] = [];

      // 获取当前账套ID
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      partnersData.forEach(partnerData => {
        const normalizedPartnerData = stripLegacyEmployeePayrollSubjects(partnerData as Partner);
        if (!existingCodes.has(normalizedPartnerData.code)) {
          existingCodes.add(normalizedPartnerData.code);
          validPartners.push({
            ...normalizedPartnerData,
            id: `partner_${Date.now()}_${Math.random()}`,
            frozen: normalizedPartnerData.frozen || false,
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            accountSetId: currentAccountSet?.id
          });
        }
      });

      await getCurrentService().savePartners([...state.partners, ...validPartners]);
      set({
        partners: [...state.partners, ...validPartners]
      });
    } catch (error) {
      console.error('Failed to import partners:', error);
      throw error;
    }
  },

  // 导出往来单位
  exportPartners: () => {
    const state = get();
    return JSON.stringify({
      version: '1.0',
      exportTime: new Date().toISOString(),
      partners: state.partners
    }, null, 2);
  },

  // 清除所有往来单位
  clearAllPartners: async () => {
    try {
      await getCurrentService().savePartners([]);
      set({
        partners: [],
        selectedPartnerId: null
      });
    } catch (error) {
      console.error('Failed to clear all partners:', error);
      throw error;
    }
  },

  // 初始化往来单位数据
  initializePartners: async () => {
    try {
      const partners = (await getCurrentService().getAllPartners()).map(stripLegacyEmployeePayrollSubjects);

      if (partners.length > 0) {
        set({ partners });
        await getCurrentService().savePartners(partners);
        return;
      }

      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const now = new Date().toISOString();
      const initializedPartners = defaultPartners.map(partnerData => ({
        ...partnerData,
        id: `partner_${Date.now()}_${Math.random()}`,
        frozen: partnerData.frozen || false,
        createTime: now,
        updateTime: now,
        accountSetId: currentAccountSet?.id
      })).map(stripLegacyEmployeePayrollSubjects);

      await getCurrentService().savePartners(initializedPartners);
      set({ partners: initializedPartners });
    } catch (error) {
      console.error('Failed to initialize partners:', error);
      throw error;
    }
  }
}));
