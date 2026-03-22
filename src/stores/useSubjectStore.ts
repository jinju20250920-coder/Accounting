'use client';

import { create } from 'zustand';
import { getCurrentService } from '@/lib/database';
import type { Subject } from '@/lib/database/service';
import { useAccountSetStore } from './useAccountSetStore';
import defaultSubjects from '@/lib/data/subjects.json';

// 科目树节点
interface SubjectTreeNode extends Subject {
  children: SubjectTreeNode[];
  expanded: boolean;
}

interface SubjectStore {
  // 状态
  subjects: Subject[];
  dataVersion: number; // 数据版本，用于检测默认科目更新
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filterDisabled: boolean;
  selectedSubjectId: string | null;

  // CRUD 操作
  addSubject: (subject: Omit<Subject, 'id'>) => Promise<void>;
  updateSubject: (id: string, updates: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  toggleSubjectDisabled: (id: string) => Promise<void>;
  toggleSubjectBlocked: (id: string) => Promise<void>;

  // 查询操作
  getSubjectById: (id: string) => Subject | undefined;
  getSubjectByCode: (code: string) => Subject | undefined;
  getSubjectsByParentId: (parentId: string | null) => Subject[];
  searchSubjects: (query: string) => Subject[];

  // 树形结构操作
  buildSubjectTree: () => SubjectTreeNode[];
  getSubjectPath: (id: string) => Subject[];

  // 获取带子科目的科目列表（用于下拉选择）
  getSubjectsWithChildren: () => Subject[];

  // 批量操作
  importSubjects: (subjects: Subject[]) => Promise<void>;
  exportSubjects: () => string;
  resetToDefault: () => Promise<void>;

  // 数据管理
  setSearchQuery: (query: string) => void;
  setFilterDisabled: (filter: boolean) => void;
  setSelectedSubjectId: (id: string | null) => void;
  clearError: () => void;
  initializeSubjects: () => Promise<void>; // 初始化默认科目数据
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 验证科目代码
const validateSubjectCode = (code: string, existingCodes: string[]): { isValid: boolean; error?: string } => {
  if (!/^\d{4}(\d{2})?$/.test(code)) {
    return { isValid: false, error: '科目代码必须是4位或6位数字' };
  }
  if (existingCodes.includes(code)) {
    return { isValid: false, error: '科目代码已存在' };
  }
  return { isValid: true };
};

// 计算科目层级
const calculateSubjectLevel = (code: string): number => {
  return Math.ceil(code.length / 2);
};

// 检查科目是否可以禁用
const canDisableSubject = (subjectCode: string, allSubjects: Subject[]): { canDisable: boolean; reason?: string } => {
  const hasChildren = allSubjects.some(s => s.parentId === subjectCode);
  if (hasChildren) {
    return { canDisable: false, reason: '该科目有下级科目，请先禁用或删除下级科目' };
  }
  return { canDisable: true };
};

// 默认科目数据版本（每次更新默认科目时递增此版本号）
const DEFAULT_SUBJECTS_VERSION = 2;

export const useSubjectStore = create<SubjectStore>((set, get) => ({
  // 初始状态
  subjects: [],
  dataVersion: 0,
  loading: false,
  error: null,
  searchQuery: '',
  filterDisabled: false,
  selectedSubjectId: null,

  // 添加科目
  addSubject: async (subject) => {
    console.log('Store - 添加科目调用:', subject);
    const state = get();
    const existingCodes = state.subjects.map(s => s.code);
    console.log('已存在的科目代码:', existingCodes);
    const validation = validateSubjectCode(subject.code, existingCodes);
    console.log('验证结果:', validation);

    if (!validation.isValid) {
      console.error('科目添加失败:', validation.error);
      alert(`科目添加失败: ${validation.error}`);
      set({ error: validation.error || '添加失败' });
      return;
    }

    // 计算层级
    const level = calculateSubjectLevel(subject.code);

    // 查找父科目
    let parentSubject: Subject | undefined;
    if (subject.parentId) {
      parentSubject = state.subjects.find(s => s.id === subject.parentId);
    }

    // 获取当前账套ID
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();

    const newSubject: Subject = {
      ...subject,
      id: generateId(),
      level,
      disabled: false,
      block: false, // 初始化为未冻结
      accountSetId: currentAccountSet?.id,
      // 继承父科目的部分属性
      enableDept: parentSubject?.enableDept || false,
      enableProject: parentSubject?.enableProject || false,
      isCustomer: (subject as any).isCustomer || parentSubject?.isCustomer || false,
      isSupplier: (subject as any).isSupplier || parentSubject?.isSupplier || false,
      isEmployee: (subject as any).isEmployee || false,
      enableCashFlow: (subject as any).enableCashFlow || false,
    };

    console.log('准备添加的新科目:', newSubject);
    console.log('当前科目列表:', state.subjects);

    try {
      await getCurrentService().saveSubjects([newSubject]);
      set((state) => {
        const newSubjects = [...state.subjects, newSubject];
        console.log('更新后的科目列表:', newSubjects);
        console.log('科目数量变化:', state.subjects.length, '->', newSubjects.length);
        return {
          subjects: newSubjects,
          error: null
        };
      });
    } catch (error) {
      console.error('Failed to add subject:', error);
      set({ error: '添加科目失败' });
    }
  },

  // 更新科目
  updateSubject: async (id, updates) => {
    try {
      const state = get();
      const subject = state.subjects.find(s => s.id === id);
      if (!subject) {
        set({ error: '科目不存在' });
        return;
      }

      const updatedSubject = { ...subject, ...updates };
      await getCurrentService().saveSubjects([updatedSubject]);

      set((state) => ({
        subjects: state.subjects.map(s =>
          s.id === id ? updatedSubject : s
        ),
        error: null
      }));
    } catch (error) {
      console.error('Failed to update subject:', error);
      set({ error: '更新科目失败' });
    }
  },

  // 删除科目
  deleteSubject: async (id) => {
    try {
      const state = get();
      const subject = state.subjects.find(s => s.id === id);

      if (!subject) {
        set({ error: '科目不存在' });
        return;
      }

      // 检查是否有子科目
      const hasChildren = state.subjects.some(s => s.parentId === id);
      if (hasChildren) {
        set({ error: '该科目有下级科目，请先删除或移动下级科目' });
        return;
      }

      await getCurrentService().saveSubjects(state.subjects.filter(s => s.id !== id));
      set((state) => ({
        subjects: state.subjects.filter(s => s.id !== id),
        selectedSubjectId: state.selectedSubjectId === id ? null : state.selectedSubjectId,
        error: null
      }));
    } catch (error) {
      console.error('Failed to delete subject:', error);
      set({ error: '删除科目失败' });
    }
  },

  // 切换科目禁用状态
  toggleSubjectDisabled: async (id) => {
    try {
      const state = get();
      const check = canDisableSubject(id, state.subjects);

      if (!check.canDisable) {
        set({ error: check.reason });
        return;
      }

      const subject = state.subjects.find(s => s.id === id);
      if (!subject) {
        set({ error: '科目不存在' });
        return;
      }

      const updatedSubject = { ...subject, disabled: !subject.disabled };
      await getCurrentService().saveSubjects([updatedSubject]);

      set((state) => ({
        subjects: state.subjects.map(s =>
          s.id === id ? updatedSubject : s
        ),
        error: null
      }));
    } catch (error) {
      console.error('Failed to toggle subject disabled:', error);
      set({ error: '操作失败' });
    }
  },

  // 切换科目冻结状态
  toggleSubjectBlocked: async (id) => {
    try {
      const state = get();
      const subject = state.subjects.find(s => s.id === id);
      if (!subject) {
        set({ error: '科目不存在' });
        return;
      }

      const updatedSubject = { ...subject, block: !subject.block };
      await getCurrentService().saveSubjects([updatedSubject]);

      set((state) => ({
        subjects: state.subjects.map(s =>
          s.id === id ? updatedSubject : s
        ),
        error: null
      }));
    } catch (error) {
      console.error('Failed to toggle subject blocked:', error);
      set({ error: '操作失败' });
    }
  },

  // 根据ID获取科目
  getSubjectById: (id) => {
    return get().subjects.find(s => s.id === id);
  },

  // 根据代码获取科目
  getSubjectByCode: (code) => {
    return get().subjects.find(s => s.code === code);
  },

  // 根据父ID获取科目
  getSubjectsByParentId: (parentId) => {
    return get().subjects.filter(s => s.parentId === parentId);
  },

  // 搜索科目
  searchSubjects: (query) => {
    if (!query.trim()) return get().subjects;

    const lowerQuery = query.toLowerCase();
    return get().subjects.filter(s =>
      s.code.toLowerCase().includes(lowerQuery) ||
      s.name.toLowerCase().includes(lowerQuery)
    );
  },

  // 构建科目树
  buildSubjectTree: () => {
    const state = get();
    const map = new Map<string, SubjectTreeNode>();
    const roots: SubjectTreeNode[] = [];

    // 初始化map
    state.subjects.forEach(subject => {
      const isDisabledFiltered = state.filterDisabled && subject.disabled;
      const isSelected = state.selectedSubjectId === subject.id;

      map.set(subject.id, {
        ...subject,
        children: [],
        expanded: isSelected
      } as SubjectTreeNode);
    });

    // 构建树
    state.subjects.forEach(subject => {
      const isDisabledFiltered = state.filterDisabled && subject.disabled;
      if (!isDisabledFiltered) {
        const node = map.get(subject.id);
        if (subject.parentId) {
          const parent = map.get(subject.parentId);
          if (parent) {
            parent.children!.push(node!);
          }
        } else {
          roots.push(node!);
        }
      }
    });

    return roots;
  },

  // 获取科目路径
  getSubjectPath: (id) => {
    const state = get();
    const path: Subject[] = [];
    let currentId: string | null = id;
    const map = new Map(state.subjects.map(s => [s.id, s]));

    while (currentId) {
      const node = map.get(currentId);
      if (node) {
        path.unshift(node);
        currentId = node.parentId;
      } else {
        break;
      }
    }

    return path;
  },

  // 获取带子科目的科目列表（用于下拉选择）
  getSubjectsWithChildren: () => {
    const state = get();
    const map = new Map<string, Subject & { children: Subject[] }>();

    // 初始化所有科目
    state.subjects.forEach(subject => {
      map.set(subject.id, { ...subject, children: [] });
    });

    const roots: (Subject & { children: Subject[] })[] = [];

    // 构建树
    state.subjects.forEach(subject => {
      const node = map.get(subject.id)!;
      if (subject.parentId) {
        const parent = map.get(subject.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  },

  // 批量导入科目
  importSubjects: async (subjects) => {
    try {
      const state = get();

      // 验证代码唯一性
      const existingCodes = state.subjects.map(s => s.code);
      const invalidSubjects: string[] = [];
      const validSubjects = subjects.filter(subject => {
        const validation = validateSubjectCode(subject.code, existingCodes);
        if (!validation.isValid) {
          invalidSubjects.push(`${subject.code}: ${validation.error}`);
          return false;
        }
        existingCodes.push(subject.code);
        return true;
      });

      if (invalidSubjects.length > 0) {
        set({ error: `导入失败：${invalidSubjects.join('; ')}` });
        return;
      }

      await getCurrentService().saveSubjects([...state.subjects, ...validSubjects]);
      set((state) => ({
        subjects: [...state.subjects, ...validSubjects],
        error: null
      }));
    } catch (error) {
      console.error('Failed to import subjects:', error);
      set({ error: '导入科目失败' });
    }
  },

  // 导出科目
  exportSubjects: () => {
    const state = get();
    return JSON.stringify(state.subjects, null, 2);
  },

  // 重置为默认数据
  resetToDefault: async () => {
    try {
      // 获取当前账套ID
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      // 为默认科目添加缺失的字段
      const initializedSubjects = (defaultSubjects as any[]).map((subject, index) => {
        // 根据科目代码确定科目类型
        let subjectType: 'Asset' | 'Liability' | 'Equity' | 'Cost' | 'Profit/Loss';
        if (subject.code.startsWith('1')) {
          subjectType = 'Asset'; // 资产类科目以 1 开头
        } else if (subject.code.startsWith('2')) {
          subjectType = 'Liability'; // 负债类科目以 2 开头
        } else if (subject.code.startsWith('4')) {
          subjectType = 'Equity'; // 权益类科目以 4 开头
        } else if (subject.code.startsWith('5')) {
          subjectType = 'Cost'; // 成本类科目以 5 开头
        } else if (subject.code.startsWith('6')) {
          subjectType = 'Profit/Loss'; // 损益类科目以 6 开头
        } else {
          subjectType = 'Profit/Loss'; // 默认值
        }

        const now = new Date().toISOString();
        return {
          ...subject,
          id: subject.code, // 使用科目代码作为 ID，确保 parentId 能正确匹配
          block: false, // 初始化为未冻结
          enableForeign: subject.enableForeign || false,
          foreignCurrency: subject.foreignCurrency || '',
          subjectType: subject.subjectType || subjectType,
          isCustomer: subject.isCustomer || (subject.code.startsWith('1122') || subject.code.startsWith('1121')), // 应收账款相关科目
          isSupplier: subject.isSupplier || (subject.code.startsWith('2202') || subject.code.startsWith('2201')), // 应付账款相关科目
          isEmployee: subject.isEmployee || subject.code.startsWith('2211'), // 应付职工薪酬相关科目
          enableCashFlow: subject.enableCashFlow || false,
          accountSetId: currentAccountSet?.id,
          createTime: now,
          updateTime: now,
        };
      });
      await getCurrentService().saveSubjects(initializedSubjects);
      set({
        subjects: initializedSubjects,
        error: null
      });
    } catch (error) {
      console.error('Failed to reset subjects:', error);
      set({ error: '重置科目失败' });
    }
  },

  // 设置搜索查询
  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  // 设置禁用过滤
  setFilterDisabled: (filter) => {
    set({ filterDisabled: filter });
  },

  // 设置选中科目
  setSelectedSubjectId: (id) => {
    set({ selectedSubjectId: id });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 初始化默认科目数据
  initializeSubjects: async () => {
    try {
      // 获取当前账套ID
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      const state = get();
      console.log('初始化检查 - 当前科目:', state.subjects);
      console.log('初始化检查 - 科目数量:', state.subjects.length);
      console.log('初始化检查 - 科目类型:', typeof state.subjects);
      console.log('初始化检查 - 是否为数组:', Array.isArray(state.subjects));
      console.log('初始化检查 - 当前数据版本:', state.dataVersion);
      console.log('初始化检查 - 默认科目版本:', DEFAULT_SUBJECTS_VERSION);

      // 从数据库加载科目数据（迁移会在这里运行）
      const subjects = await getCurrentService().getAllSubjects();
      console.log('从数据库加载的科目数据:', subjects);
      console.log('科目 1122 的 isCustomer 值:', subjects.find((s: any) => s.code === '1122')?.isCustomer);
      console.log('科目 2202 的 isSupplier 值:', subjects.find((s: any) => s.code === '2202')?.isSupplier);

      if (subjects.length > 0) {
        // 如果科目存在但没有 isCustomer/isSupplier 字段（或者值不正确），强制更新
        const subject1122 = subjects.find((s: any) => s.code === '1122');
        const subject2202 = subjects.find((s: any) => s.code === '2202');

        if (subject1122 && !subject1122.isCustomer) {
          console.log('检测到科目 1122 缺少 isCustomer 标记，正在更新...');
          await getCurrentService().saveSubjects([{ ...subject1122, isCustomer: true, enableDept: true, enableProject: true }]);
          // 重新加载
          const updatedSubjects = await getCurrentService().getAllSubjects();
          set({ subjects: updatedSubjects, dataVersion: DEFAULT_SUBJECTS_VERSION });
          console.log('科目数据已更新');
          return;
        }

        if (subject2202 && !subject2202.isSupplier) {
          console.log('检测到科目 2202 缺少 isSupplier 标记，正在更新...');
          await getCurrentService().saveSubjects([{ ...subject2202, isSupplier: true }]);
          // 重新加载
          const updatedSubjects = await getCurrentService().getAllSubjects();
          set({ subjects: updatedSubjects, dataVersion: DEFAULT_SUBJECTS_VERSION });
          console.log('科目数据已更新');
          return;
        }

        set({ subjects, dataVersion: DEFAULT_SUBJECTS_VERSION });
        console.log('科目数据已从数据库加载');
        return;
      }

      console.log('开始初始化默认科目数据:', defaultSubjects);

      // 为默认科目添加缺失的字段
      const initializedSubjects = (defaultSubjects as any[]).map((subject, index) => {
        // 根据科目代码确定科目类型
        let subjectType: 'Asset' | 'Liability' | 'Equity' | 'Cost' | 'Profit/Loss';
        if (subject.code.startsWith('1')) {
          subjectType = 'Asset'; // 资产类科目以 1 开头
        } else if (subject.code.startsWith('2')) {
          subjectType = 'Liability'; // 负债类科目以 2 开头
        } else if (subject.code.startsWith('4')) {
          subjectType = 'Equity'; // 权益类科目以 4 开头
        } else if (subject.code.startsWith('5')) {
          subjectType = 'Cost'; // 成本类科目以 5 开头
        } else if (subject.code.startsWith('6')) {
          subjectType = 'Profit/Loss'; // 损益类科目以 6 开头
        } else {
          subjectType = 'Profit/Loss'; // 默认值
        }

        const now = new Date().toISOString();
        return {
          ...subject,
          id: subject.code, // 使用科目代码作为 ID，确保 parentId 能正确匹配
          block: false, // 初始化为未冻结
          enableForeign: subject.enableForeign || false,
          foreignCurrency: subject.foreignCurrency || '',
          subjectType: subject.subjectType || subjectType,
          isCustomer: subject.isCustomer || (subject.code.startsWith('1122') || subject.code.startsWith('1121')), // 应收账款相关科目
          isSupplier: subject.isSupplier || (subject.code.startsWith('2202') || subject.code.startsWith('2201')), // 应付账款相关科目
          isEmployee: subject.isEmployee || subject.code.startsWith('2211'), // 应付职工薪酬相关科目
          enableCashFlow: subject.enableCashFlow || false,
          accountSetId: currentAccountSet?.id,
          createTime: now,
          updateTime: now,
        };
      });

      console.log('准备设置的科目数据:', initializedSubjects);

      // 保存到数据库
      await getCurrentService().saveSubjects(initializedSubjects);

      set((state) => {
        console.log('设置前的科目列表:', state.subjects);

        const newState = {
          subjects: initializedSubjects,
          dataVersion: DEFAULT_SUBJECTS_VERSION
        };

        console.log('设置后的科目列表:', newState.subjects);
        return newState;
      });

      console.log('科目数据初始化完成');
    } catch (error) {
      console.error('Failed to initialize subjects:', error);
      set({ error: '初始化科目数据失败' });
    }
  }
}));
