import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 功能权限类型
export interface FeaturePermission {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'reports' | 'management' | 'advanced';
}

// 套餐功能配置类型
export interface PlanFeatureConfig {
  planId: string;
  features: string[]; // 功能ID列表
}

// 账套数据类型
export interface AccountSet {
  id: string; // 系统自动生成的唯一标识符
  code: string; // 用户自定义编码
  name: string; // 账套名称
  unifiedSocialCreditCode: string; // 统一社会信用代码
  address: string; // 公司地址
  baseCurrency: string;
  currentPeriod: string;
  startDate: string; // 账套开始日期
  accountingStandard: 'small-enterprise' | 'enterprise' | 'other'; // 会计准则
  enableDate: string; // 账套启用年月
  status: 'active' | 'closed' | 'archived' | 'trial'; // 新增 trial 状态
  createdDate: string;
  lastModifiedDate: string;
  isInitialized: boolean;
  trialEndDate?: string; // 试用结束日期
  licensedCount?: number; // 授权的凭证数量（可选）
  lastVoucherNo?: number; // 最后一个凭证号（序号部分）
  lastVoucherFullNo?: string; // 完整的最后一个凭证号（含前缀）
}

// 授权信息类型
export interface AccountLicense {
  id: string;
  accountSetId: string;
  licenseKey: string; // 授权码
  licenseType: 'trial' | 'basic' | 'pro' | 'enterprise'; // 授权类型
  status: 'active' | 'expired' | 'suspended'; // 授权状态
  validFrom: string;
  validTo: string;
  maxVoucherCount?: number; // 最大凭证数限制
  maxSubjectCount?: number; // 最大科目数限制
  features: string[]; // 支持的功能ID列表
  activatedDate?: string; // 激活日期
  activationToken?: string; // 激活令牌
}

// 支付套餐类型
export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  description: string;
  accountSetLimit: number; // 最大账套数量
  featureIds: string[]; // 功能ID列表
  duration: 'monthly' | 'yearly';
  trialPeriodDays?: number; // 试用期天数
  isPopular?: boolean; // 是否推荐套餐
}

// 配置开关：是否启用账套数量限制
const ENABLE_ACCOUNT_SET_LIMIT = false; // 设为 true 启用限制

// Store 接口
interface AccountSetStore {
  // 账套列表
  accountSets: AccountSet[];
  // 当前选中的账套ID
  currentAccountSetId: string | null;
  // 授权信息
  licenses: AccountLicense[];
  // 支付套餐信息
  pricingPlans: PricingPlan[];
  // 当前选择的套餐
  currentPricingPlanId: string | null;
  // 授权状态
  isLicenseValid: boolean;
  // 剩余可用账套数
  availableAccountSetCount: number;
  // 功能权限定义（可配置）
  featureDefinitions: FeaturePermission[];
  // 套餐功能配置（可配置）
  planFeatureConfigs: PlanFeatureConfig[];

  // Actions - 功能权限管理
  addFeatureDefinition: (feature: Omit<FeaturePermission, 'enabled'>) => void;
  updateFeatureDefinition: (featureId: string, updates: Partial<FeaturePermission>) => void;
  deleteFeatureDefinition: (featureId: string) => void;
  setPlanFeatureConfig: (planId: string, featureIds: string[]) => void;
  getFeaturesForPlan: (planId: string) => FeaturePermission[];
  getAllFeatureDefinitions: () => FeaturePermission[];

  // Actions - 账套管理
  addAccountSet: (accountSet: Omit<AccountSet, 'id' | 'createdDate' | 'lastModifiedDate' | 'isInitialized'>) => Promise<AccountSet | null>;
  updateAccountSet: (id: string, updates: Partial<AccountSet>) => void;
  deleteAccountSet: (id: string) => void;
  setCurrentAccountSet: (id: string) => void;
  getCurrentAccountSet: () => AccountSet | null;
  getAccountSetById: (id: string) => AccountSet | null;

  // Actions - 授权管理
  activateLicense: (licenseKey: string, activationToken?: string) => Promise<boolean>;
  renewLicense: (planId: string) => Promise<boolean>;
  cancelLicense: () => Promise<boolean>;
  getLicenseForAccountSet: (accountSetId: string) => AccountLicense | null;
  checkLicenseValidity: () => boolean;
  getCurrentLicense: () => AccountLicense | null;

  // Actions - 支付管理
  getPricingPlans: () => PricingPlan[];
  selectPricingPlan: (planId: string) => void;
  purchasePlan: (planId: string, paymentToken: string) => Promise<boolean>;
  applyDiscountCode: (discountCode: string) => Promise<{ valid: boolean; discount: number; description: string }>;

  // Actions - 试用管理
  startTrial: (accountSetData: Omit<AccountSet, 'id' | 'createdDate' | 'lastModifiedDate' | 'isInitialized' | 'status'>) => Promise<AccountSet | null>;
  extendTrial: (days: number) => Promise<boolean>;

  // Actions - 验证
  canAddAccountSet: () => boolean;
  checkFeatureAccess: (featureId: string) => boolean;
  getCurrentAvailableFeatures: () => FeaturePermission[];

  // 内部辅助方法
  calculateAvailableAccountSetCount: () => number;
}

// 初始化默认功能权限定义
const defaultFeatureDefinitions: FeaturePermission[] = [
  { id: 'voucher-entry', name: '凭证录入', description: '创建和编辑会计凭证', enabled: true, category: 'core' },
  { id: 'balance-report', name: '余额查询', description: '查看科目余额表', enabled: true, category: 'reports' },
  { id: 'subject-management', name: '科目管理', description: '管理会计科目', enabled: true, category: 'management' },
  { id: 'basic-reports', name: '基础报表', description: '资产负债表、损益表', enabled: true, category: 'reports' },
  { id: 'advanced-reports', name: '高级报表', description: '现金流量表、财务分析', enabled: false, category: 'reports' },
  { id: 'multi-currency', name: '多币种', description: '支持外币核算', enabled: false, category: 'advanced' },
  { id: 'import-export', name: '导入导出', description: 'Excel导入导出功能', enabled: false, category: 'management' },
  { id: 'audit-trail', name: '审计追踪', description: '操作日志追踪', enabled: false, category: 'advanced' },
  { id: 'custom-templates', name: '自定义模板', description: '自定义凭证模板', enabled: false, category: 'advanced' },
  { id: 'department-management', name: '部门管理', description: '部门档案管理', enabled: true, category: 'management' },
  { id: 'project-management', name: '项目管理', description: '项目档案管理', enabled: true, category: 'management' },
  { id: 'customer-supplier', name: '往来单位', description: '客户供应商管理', enabled: true, category: 'management' },
  { id: 'currency-management', name: '币别管理', description: '币种汇率管理', enabled: true, category: 'management' },
  { id: 'summary-library', name: '摘要库', description: '常用摘要管理', enabled: true, category: 'management' },
  { id: 'voucher-templates', name: '凭证模板', description: '凭证模板管理', enabled: true, category: 'management' }
];

// 初始化套餐配置
const defaultPricingPlans: PricingPlan[] = [
  {
    id: 'plan_basic',
    name: '基础版',
    price: 29.9,
    description: '适合小微企业，支持1个账套，基础功能',
    accountSetLimit: 1,
    featureIds: ['voucher-entry', 'balance-report', 'subject-management', 'basic-reports', 'department-management', 'project-management', 'customer-supplier', 'currency-management', 'summary-library', 'voucher-templates'],
    duration: 'monthly'
  },
  {
    id: 'plan_pro',
    name: '专业版',
    price: 59.9,
    description: '适合中小型企业，支持5个账套，高级功能',
    accountSetLimit: 5,
    featureIds: ['voucher-entry', 'balance-report', 'subject-management', 'basic-reports', 'advanced-reports', 'multi-currency', 'import-export', 'department-management', 'project-management', 'customer-supplier', 'currency-management', 'summary-library', 'voucher-templates'],
    duration: 'monthly',
    isPopular: true
  },
  {
    id: 'plan_enterprise',
    name: '企业版',
    price: 99.9,
    description: '适合大型企业，支持无限账套，所有功能',
    accountSetLimit: -1, // -1 表示无限制
    featureIds: ['voucher-entry', 'balance-report', 'subject-management', 'basic-reports', 'advanced-reports', 'multi-currency', 'import-export', 'audit-trail', 'custom-templates', 'department-management', 'project-management', 'customer-supplier', 'currency-management', 'summary-library', 'voucher-templates'],
    duration: 'monthly'
  }
];

// 初始化套餐功能配置
const defaultPlanFeatureConfigs: PlanFeatureConfig[] = defaultPricingPlans.map(plan => ({
  planId: plan.id,
  features: plan.featureIds
}));

// 创建store
const useAccountSetStoreBase = create<AccountSetStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      accountSets: [
        {
          id: 'set_001',
          code: 'SET001',
          name: '上海乐茜信息技术有限公司',
          unifiedSocialCreditCode: '91310000MA1FL3XG12',
          address: '上海市浦东新区张江高科技园区博云路2号',
          baseCurrency: '人民币',
          currentPeriod: '2026-03',
          startDate: '2024-01-01',
          accountingStandard: 'small-enterprise',
          enableDate: '2024-01',
          status: 'active',
          createdDate: '2024-01-01',
          lastModifiedDate: '2026-03-10',
          isInitialized: true,
          lastVoucherNo: 0,  // 最后一个凭证号（序号部分）
          lastVoucherFullNo: '记-202603-000'  // 完整的最后一个凭证号
        }
      ],
      currentAccountSetId: 'set_001',

      // 授权信息
      licenses: [
        {
          id: 'license_001',
          accountSetId: 'set_001',
          licenseKey: 'LIVE-299-SET1',
          licenseType: 'basic',
          status: 'active',
          validFrom: '2024-01-01',
          validTo: '2025-01-01',
          maxVoucherCount: 1000,
          features: ['voucher-entry', 'balance-report', 'subject-management', 'basic-reports'],
          activatedDate: '2024-01-01',
          activationToken: 'ACT-20240101-SET001'
        }
      ],

      // 支付套餐信息
      pricingPlans: defaultPricingPlans,

      currentPricingPlanId: 'plan_enterprise',
      isLicenseValid: true,
      availableAccountSetCount: 0, // 会动态计算

      // 功能权限定义
      featureDefinitions: defaultFeatureDefinitions,
      planFeatureConfigs: defaultPlanFeatureConfigs,

      // ========== 功能权限管理方法 ==========

      // 添加功能权限定义
      addFeatureDefinition: (feature) => {
        set((state) => ({
          featureDefinitions: [...state.featureDefinitions, { ...feature, enabled: true }]
        }));
      },

      // 更新功能权限定义
      updateFeatureDefinition: (featureId, updates) => {
        set((state) => ({
          featureDefinitions: state.featureDefinitions.map(feature =>
            feature.id === featureId ? { ...feature, ...updates } : feature
          )
        }));
      },

      // 删除功能权限定义
      deleteFeatureDefinition: (featureId) => {
        set((state) => ({
          featureDefinitions: state.featureDefinitions.filter(feature => feature.id !== featureId),
          // 同时从套餐配置中移除该功能
          planFeatureConfigs: state.planFeatureConfigs.map(config => ({
            ...config,
            features: config.features.filter(id => id !== featureId)
          }))
        }));
      },

      // 设置套餐功能配置
      setPlanFeatureConfig: (planId, featureIds) => {
        set((state) => {
          const existingIndex = state.planFeatureConfigs.findIndex(c => c.planId === planId);
          if (existingIndex >= 0) {
            const newConfigs = [...state.planFeatureConfigs];
            newConfigs[existingIndex] = { planId, features: featureIds };
            return { planFeatureConfigs: newConfigs };
          } else {
            return {
              planFeatureConfigs: [...state.planFeatureConfigs, { planId, features: featureIds }]
            };
          }
        });
      },

      // 获取套餐的功能权限列表
      getFeaturesForPlan: (planId) => {
        const state = get();
        const config = state.planFeatureConfigs.find(c => c.planId === planId);
        if (!config) return [];
        return state.featureDefinitions.filter(feature => config.features.includes(feature.id));
      },

      // 获取所有功能权限定义
      getAllFeatureDefinitions: () => {
        return get().featureDefinitions;
      },

      // ========== 计算方法 ==========

      // 计算可用账套数量
      calculateAvailableAccountSetCount: () => {
        // 根据配置决定是否启用限制
        if (!ENABLE_ACCOUNT_SET_LIMIT) {
          return Number.MAX_SAFE_INTEGER;
        }

        const state = get();
        const currentPlan = state.pricingPlans.find(plan => plan.id === state.currentPricingPlanId);

        if (!currentPlan) return 0;

        // 企业版支持无限账套
        if (currentPlan.accountSetLimit === -1) {
          return Number.MAX_SAFE_INTEGER;
        }

        return currentPlan.accountSetLimit - state.accountSets.length;
      },

      // ========== 账套管理方法 ==========

      // 添加账套
      addAccountSet: async (accountSet) => {
        const state = get();

        // 检查是否有可用的账套数量
        if (ENABLE_ACCOUNT_SET_LIMIT) {
          const availableCount = state.calculateAvailableAccountSetCount();
          if (availableCount <= 0) {
            throw new Error('账套数量已达到当前套餐限制，请升级套餐');
          }
        }

        // 系统自动生成ID
        const now = new Date().toISOString().split('T')[0];
        const yearMonth = now.substring(0, 7).replace('-', '');
        const newAccountSet: AccountSet = {
          ...accountSet,
          id: `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 系统自动生成
          createdDate: now,
          lastModifiedDate: now,
          isInitialized: true,
          lastVoucherNo: 0, // 最后一个凭证号（序号部分）
          lastVoucherFullNo: `记-${yearMonth}-000` // 完整的最后一个凭证号
        };

        // 获取当前套餐的功能配置
        const currentPlan = state.pricingPlans.find(p => p.id === state.currentPricingPlanId);
        const currentFeatures = currentPlan?.featureIds || ['voucher-entry', 'balance-report', 'subject-management'];

        // 添加授权信息
        const newLicense: AccountLicense = {
          id: `license_${newAccountSet.id}`,
          accountSetId: newAccountSet.id,
          licenseKey: `TEMP-${Date.now()}`,
          licenseType: currentPlan?.id === 'plan_enterprise' ? 'enterprise' :
                     currentPlan?.id === 'plan_pro' ? 'pro' : 'basic',
          status: 'active',
          validFrom: now,
          validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30天试用期
          features: currentFeatures,
          activatedDate: now
        };

        set((prevState) => ({
          accountSets: [...prevState.accountSets, newAccountSet],
          licenses: [...prevState.licenses, newLicense],
          currentAccountSetId: prevState.currentAccountSetId || newAccountSet.id,
          availableAccountSetCount: prevState.calculateAvailableAccountSetCount()
        }));

        return newAccountSet;
      },

      // 更新账套
      updateAccountSet: (id, updates) => {
        const now = new Date().toISOString().split('T')[0];
        set((state) => ({
          accountSets: state.accountSets.map(set =>
            set.id === id
              ? { ...set, ...updates, lastModifiedDate: now }
              : set
          )
        }));
      },

      // 删除账套
      deleteAccountSet: (id) => {
        set((state) => {
          const newSets = state.accountSets.filter(s => s.id !== id);
          const newLicenses = state.licenses.filter(l => l.accountSetId !== id);
          return {
            accountSets: newSets,
            licenses: newLicenses,
            currentAccountSetId: state.currentAccountSetId === id
              ? (newSets.length > 0 ? newSets[0].id : null)
              : state.currentAccountSetId
          };
        });
      },

      // 设置当前账套
      setCurrentAccountSet: (id) => set({ currentAccountSetId: id }),

      // 获取当前账套
      getCurrentAccountSet: () => {
        const state = get();
        if (!state.currentAccountSetId) return null;
        return state.accountSets.find(s => s.id === state.currentAccountSetId) || null;
      },

      // 根据ID获取账套
      getAccountSetById: (id) => {
        const state = get();
        return state.accountSets.find(s => s.id === id) || null;
      },

      // ========== 授权管理方法 ==========

      // 激活授权
      activateLicense: async (licenseKey, activationToken) => {
        const state = get();

        // 简单的授权码验证逻辑
        const isValidKey = /^LIVE-(\d+)-SET(\d+|X)$/.test(licenseKey);

        if (!isValidKey) {
          throw new Error('无效的授权码格式');
        }

        // 解析授权码信息
        const matches = licenseKey.match(/^LIVE-(\d+)-SET(\d+|X)$/);
        const price = matches![1];
        const setCount = matches![2];

        // 根据授权码确定套餐
        let planId = 'plan_basic';
        if (setCount === 'X') {
          planId = 'plan_enterprise';
        } else if (parseInt(setCount) >= 5) {
          planId = 'plan_pro';
        }

        const now = new Date().toISOString().split('T')[0];
        const validTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 1年有效期

        // 更新当前账套的授权信息
        const currentAccountSet = state.getCurrentAccountSet();
        const currentFeatures = state.pricingPlans.find(p => p.id === planId)?.featureIds || [];

        if (currentAccountSet) {
          set((prevState) => {
            const newLicenses = prevState.licenses.map(license => {
              if (license.accountSetId === currentAccountSet.id) {
                const licenseType: AccountLicense['licenseType'] = planId === 'plan_enterprise' ? 'enterprise' :
                                                                      planId === 'plan_pro' ? 'pro' : 'basic';
                const status: AccountLicense['status'] = 'active';
                return {
                  ...license,
                  licenseKey,
                  licenseType,
                  status,
                  validFrom: now,
                  validTo,
                  features: currentFeatures,
                  activationToken
                };
              }
              return license;
            });
            return {
              licenses: newLicenses,
              isLicenseValid: true,
              currentPricingPlanId: planId,
              availableAccountSetCount: prevState.calculateAvailableAccountSetCount()
            } as Partial<AccountSetStore>;
          });
        }

        return true;
      },

      // 续费授权
      renewLicense: async (planId) => {
        const state = get();
        const plan = state.pricingPlans.find(p => p.id === planId);

        if (!plan) {
          throw new Error('无效的套餐ID');
        }

        const now = new Date().toISOString().split('T')[0];
        const validTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 更新授权信息
        set((prevState) => {
          const currentAccountSet = prevState.getCurrentAccountSet();
          const newLicenses = currentAccountSet
            ? prevState.licenses.map(license => {
                if (license.accountSetId === currentAccountSet.id) {
                  const status: AccountLicense['status'] = 'active';
                  return {
                    ...license,
                    validFrom: now,
                    validTo,
                    status,
                    features: plan.featureIds
                  };
                }
                return license;
              })
            : prevState.licenses;

          return {
            licenses: newLicenses,
            currentPricingPlanId: planId,
            isLicenseValid: true,
            availableAccountSetCount: prevState.calculateAvailableAccountSetCount()
          } as Partial<AccountSetStore>;
        });

        return true;
      },

      // 取消授权
      cancelLicense: async () => {
        set((prevState) => ({
          isLicenseValid: false,
          currentPricingPlanId: null,
          availableAccountSetCount: 0
        }));

        return true;
      },

      // 获取账套的授权信息
      getLicenseForAccountSet: (accountSetId) => {
        const state = get();
        return state.licenses.find(license => license.accountSetId === accountSetId) || null;
      },

      // 检查授权有效性
      checkLicenseValidity: () => {
        const state = get();

        if (!state.isLicenseValid) {
          return false;
        }

        // 检查授权是否过期
        const now = new Date();
        const currentLicense = state.getCurrentLicense();

        if (!currentLicense || new Date(currentLicense.validTo) < now) {
          return false;
        }

        return true;
      },

      // 获取当前授权信息
      getCurrentLicense: () => {
        const state = get();
        const currentAccountSet = state.getCurrentAccountSet();

        if (!currentAccountSet) {
          return null;
        }

        return state.licenses.find(license => license.accountSetId === currentAccountSet.id) || null;
      },

      // ========== 支付管理方法 ==========

      // 获取支付套餐信息
      getPricingPlans: () => {
        const state = get();
        return state.pricingPlans;
      },

      // 选择支付套餐
      selectPricingPlan: (planId) => {
        set({ currentPricingPlanId: planId });
      },

      // 购买套餐
      purchasePlan: async (planId, paymentToken) => {
        // 简单的支付验证
        const isValidPayment = paymentToken.startsWith('PAY-');

        if (!isValidPayment) {
          throw new Error('无效的支付凭证');
        }

        // 更新套餐信息
        set((prevState) => ({
          currentPricingPlanId: planId,
          isLicenseValid: true,
          availableAccountSetCount: prevState.calculateAvailableAccountSetCount()
        }));

        return true;
      },

      // 应用折扣码
      applyDiscountCode: async (discountCode) => {
        // 简单的折扣码验证
        const validCodes = [
          { code: 'SAVE10', discount: 0.1, description: '享受10%折扣' },
          { code: 'WELCOME20', discount: 0.2, description: '新用户享受20%折扣' },
          { code: 'B2B50', discount: 0.5, description: '企业用户享受50%折扣' }
        ];

        const discount = validCodes.find(d => d.code === discountCode);

        if (discount) {
          return {
            valid: true,
            discount: discount.discount,
            description: discount.description
          };
        }

        return {
          valid: false,
          discount: 0,
          description: '无效的折扣码'
        };
      },

      // ========== 试用管理方法 ==========

      // 开始试用
      startTrial: async (accountSetData) => {
        const state = get();

        // 检查是否已经有试用账套
        const existingTrial = state.accountSets.find(set => set.status === 'trial');

        if (existingTrial) {
          throw new Error('您已经有一个试用账套');
        }

        const now = new Date().toISOString().split('T')[0];
        const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 14天试用期

        const yearMonth = now.substring(0, 7).replace('-', '');
        const newAccountSet: AccountSet = {
          ...accountSetData,
          id: `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdDate: now,
          lastModifiedDate: now,
          isInitialized: true,
          status: 'trial',
          trialEndDate,
          lastVoucherNo: 0, // 最后一个凭证号（序号部分）
          lastVoucherFullNo: `记-${yearMonth}-000` // 完整的最后一个凭证号
        };

        const newLicense: AccountLicense = {
          id: `license_${newAccountSet.id}`,
          accountSetId: newAccountSet.id,
          licenseKey: `TRIAL-${Date.now()}`,
          licenseType: 'trial',
          status: 'active',
          validFrom: now,
          validTo: trialEndDate,
          features: ['voucher-entry', 'balance-report', 'subject-management'],
          activatedDate: now
        };

        set((prevState) => ({
          accountSets: [...prevState.accountSets, newAccountSet],
          licenses: [...prevState.licenses, newLicense],
          currentAccountSetId: prevState.currentAccountSetId || newAccountSet.id,
          availableAccountSetCount: prevState.calculateAvailableAccountSetCount()
        }));

        return newAccountSet;
      },

      // 延长试用期
      extendTrial: async (days) => {
        const state = get();
        const currentAccountSet = state.getCurrentAccountSet();

        if (!currentAccountSet || currentAccountSet.status !== 'trial') {
          throw new Error('当前账套不是试用状态');
        }

        const currentLicense = state.getLicenseForAccountSet(currentAccountSet.id);

        if (!currentLicense) {
          throw new Error('找不到授权信息');
        }

        const newValidTo = new Date(Date.parse(currentLicense.validTo) + days * 24 * 60 * 60 * 1000);

        set((prevState) => ({
          licenses: prevState.licenses.map(license =>
            license.id === currentLicense.id
              ? { ...license, validTo: newValidTo.toISOString().split('T')[0] }
              : license
          )
        }));

        return true;
      },

      // ========== 验证方法 ==========

      // 检查是否可以添加账套
      canAddAccountSet: () => {
        const state = get();
        return state.calculateAvailableAccountSetCount() > 0;
      },

      // 检查功能访问权限
      checkFeatureAccess: (featureId) => {
        const state = get();
        const currentLicense = state.getCurrentLicense();

        if (!currentLicense || !state.isLicenseValid) {
          return false;
        }

        return currentLicense.features.includes(featureId);
      },

      // 获取当前可用的功能列表
      getCurrentAvailableFeatures: () => {
        const state = get();
        const currentLicense = state.getCurrentLicense();

        if (!currentLicense || !state.isLicenseValid) {
          return [];
        }

        return state.featureDefinitions.filter(feature =>
          currentLicense.features.includes(feature.id)
        );
      }
    }),
    {
      name: 'finance-account-sets',
      partialize: (state) => ({
        accountSets: state.accountSets,
        currentAccountSetId: state.currentAccountSetId,
        licenses: state.licenses,
        pricingPlans: state.pricingPlans,
        currentPricingPlanId: state.currentPricingPlanId,
        isLicenseValid: state.isLicenseValid,
        availableAccountSetCount: state.availableAccountSetCount,
        featureDefinitions: state.featureDefinitions,
        planFeatureConfigs: state.planFeatureConfigs
      })
    }
  )
);

// 导出 store
export { useAccountSetStoreBase as useAccountSetStore };
