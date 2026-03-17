import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS, createAccountSetPersistConfig } from './persistence-config';

// 往来单位接口 - 统一模型
interface Partner {
  id: string;
  code: string;
  name: string;
  isCustomer: boolean; // 客户勾选
  isSupplier: boolean; // 供应商勾选
  isEmployee: boolean; // 雇员勾选
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string; // 税号
  bankAccount?: string; // 银行账号
  bankName?: string; // 开户银行
  frozen: boolean;
  createdAt: string;
  // 合并相关字段
  mergedFrom?: string[]; // 从哪些ID合并而来
  parentId?: string; // 关联的集团ID（用于合并到集团）
}

// 默认数据
const defaultPartners: Partner[] = [
  {
    id: 'p1',
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
    frozen: false,
    createdAt: '2024-01-01'
  },
  {
    id: 'p2',
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
    frozen: false,
    createdAt: '2024-02-01'
  },
  {
    id: 'p3',
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
    frozen: false,
    createdAt: '2024-01-15'
  },
  {
    id: 'e1',
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
    frozen: false,
    createdAt: '2024-03-01'
  }
];

// 状态接口
interface PartnerStore {
  partners: Partner[];
  searchQuery: string;
  selectedPartnerId: string | null;

  // CRUD 操作
  addPartner: (partner: Omit<Partner, 'id' | 'createdAt'>) => void;
  updatePartner: (id: string, updates: Partial<Partner>) => void;
  deletePartner: (id: string) => void;
  toggleFrozen: (id: string) => void;
  setSelectedPartnerId: (id: string | null) => void;

  // 查询操作
  getPartnerById: (id: string) => Partner | undefined;
  getPartnersByType: (type: 'customer' | 'supplier' | 'employee') => Partner[];
  searchPartners: (query: string) => Partner[];
  getAllPartners: () => Partner[];

  // 导入导出
  importPartners: (partners: Omit<Partner, 'id' | 'createdAt'>[]) => void;
  exportPartners: () => string;

  // 批量操作
  clearAllPartners: () => void;
}

export const usePartnerStore = create<PartnerStore>()(
  persist((set, get) => ({
    partners: defaultPartners,
    searchQuery: '',
    selectedPartnerId: null,

    // 添加往来单位
    addPartner: (partnerData) => {
      const state = get();

      // 检查代码是否重复
      const existing = state.partners.find(p => p.code === partnerData.code);
      if (existing) {
        throw new Error(`往来单位代码 ${partnerData.code} 已存在，请使用其他代码`);
      }

      // 检查必须至少选择一种身份
      if (!partnerData.isCustomer && !partnerData.isSupplier && !partnerData.isEmployee) {
        throw new Error('请至少勾选一种身份：客户、供应商或雇员');
      }

      const newPartner: Partner = {
        ...partnerData,
        id: `partner_${Date.now()}`,
        frozen: partnerData.frozen || false,
        createdAt: new Date().toISOString().split('T')[0]
      };

      set({
        partners: [...state.partners, newPartner]
      });
    },

    // 更新往来单位
    updatePartner: (id, updates) => {
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

      set({
        partners: state.partners.map(partner =>
          partner.id === id ? { ...partner, ...updates } : partner
        )
      });
    },

    // 删除往来单位
    deletePartner: (id) => {
      const state = get();
      const partner = state.partners.find(p => p.id === id);

      if (!partner) {
        throw new Error('往来单位不存在');
      }

      if (partner.frozen) {
        throw new Error('该往来单位已冻结，无法删除');
      }

      set({
        partners: state.partners.filter(p => p.id !== id),
        selectedPartnerId: state.selectedPartnerId === id ? null : state.selectedPartnerId
      });
    },

    // 切换冻结状态
    toggleFrozen: (id) => {
      set((state) => ({
        partners: state.partners.map(partner =>
          partner.id === id ? { ...partner, frozen: !partner.frozen } : partner
        )
      }));
    },

    // 设置选中的往来单位
    setSelectedPartnerId: (id) => {
      set({ selectedPartnerId: id });
    },

    // 查询方法
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
    importPartners: (partnersData) => {
      const state = get();
      const existingCodes = new Set(state.partners.map(p => p.code));
      const validPartners: Partner[] = [];

      partnersData.forEach(partnerData => {
        if (!existingCodes.has(partnerData.code)) {
          existingCodes.add(partnerData.code);
          validPartners.push({
            ...partnerData,
            id: `partner_${Date.now()}_${Math.random()}`,
            frozen: partnerData.frozen || false,
            createdAt: new Date().toISOString().split('T')[0]
          });
        }
      });

      set({
        partners: [...state.partners, ...validPartners]
      });
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
    clearAllPartners: () => {
      set({
        partners: [],
        selectedPartnerId: null
      });
    }
  }),
    createAccountSetPersistConfig(STORAGE_KEYS.PARTNERS)
  )
);
