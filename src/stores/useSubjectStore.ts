'use client';

import { create } from 'zustand';
import { getCurrentService, sqliteService } from '@/lib/database';
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

// 根据科目代码确定科目类型
const getSubjectTypeFromCode = (code: string): 'Asset' | 'Liability' | 'Equity' | 'Cost' | 'Profit/Loss' => {
  if (code.startsWith('1')) return 'Asset';
  if (code.startsWith('2')) return 'Liability';
  if (code.startsWith('4')) return 'Equity';
  if (code.startsWith('5')) return 'Cost';
  if (code.startsWith('6')) return 'Profit/Loss';
  return 'Profit/Loss';
};

// 验证科目代码
const validateSubjectCode = (code: string, existingCodes: string[]): { isValid: boolean; error?: string } => {
  // 允许的科目代码格式：纯数字
  // - 4位：一级科目
  // - 6位：二级科目（4位+2位）
  // - 8位：三级科目（6位+2位），以此类推
  const isValidFormat = /^\d{4,12}$/.test(code);

  if (!isValidFormat) {
    return { isValid: false, error: `科目代码格式无效: ${code}` };
  }
  if (existingCodes.includes(code)) {
    return { isValid: false, error: '科目代码已存在' };
  }
  return { isValid: true };
};

// 计算科目层级
const calculateSubjectLevel = (code: string): number => {
  // 基于科目代码长度计算层级：
  // - 4位：1级
  // - 6位：2级
  // - 8位：3级
  // - 10位：4级
  // - 12位：5级
  return Math.floor((code.length - 2) / 2);
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
    const state = get();
    const existingCodes = state.subjects.map(s => s.code);
    const validation = validateSubjectCode(subject.code, existingCodes);

    if (!validation.isValid) {
      set({ error: validation.error || '添加失败' });
      return;
    }

    // 检查数据库中是否已存在该科目代码
    try {
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      if (db && currentAccountSet?.id) {
        sqliteService.setAccountSetId(currentAccountSet.id);
        const result = db.exec(
          'SELECT code FROM subjects WHERE code = ? AND accountSetId = ?',
          [subject.code, currentAccountSet.id]
        );
        if (result[0]?.values?.length > 0) {
          set({ error: '科目代码已存在（数据库）' });
          return;
        }
      }
    } catch (e) {
      console.warn('检查数据库科目失败:', e);
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

    try {
      await getCurrentService().saveSubjects([newSubject]);
      set((state) => {
        return {
          subjects: [...state.subjects, newSubject],
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
        const now = new Date().toISOString();
        return {
          ...subject,
          id: subject.code, // 使用科目代码作为 ID，确保 parentId 能正确匹配
          block: false, // 初始化为未冻结
          enableForeign: subject.enableForeign || false,
          foreignCurrency: subject.foreignCurrency || '',
          subjectType: subject.subjectType || getSubjectTypeFromCode(subject.code),
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

      // 确保 sqliteService 的 accountSetId 与当前账套一致
      if (currentAccountSet && sqliteService.accountSetId !== currentAccountSet.id) {
        sqliteService.setAccountSetId(currentAccountSet.id);
      }

      const state = get();

      // 从数据库加载科目数据（迁移会在这里运行）
      const subjects = await getCurrentService().getAllSubjects();

      if (subjects.length > 0) {
        // 检查是否缺少基础科目（如1001库存现金、1002银行存款等）
        const defaultCodes = (defaultSubjects as any[]).map(s => s.code);
        const existingCodes = new Set(subjects.map(s => s.code));
        const missingCodes = defaultCodes.filter((code: string) => !existingCodes.has(code));

        if (missingCodes.length > 0) {
          // 补充缺失的默认科目
          const missingSubjects = (defaultSubjects as any[])
            .filter(s => !existingCodes.has(s.code))
            .map(subject => {
              const now = new Date().toISOString();
              return {
                ...subject,
                id: subject.code,
                block: false,
                enableForeign: subject.enableForeign || false,
                foreignCurrency: subject.foreignCurrency || '',
                subjectType: subject.subjectType || getSubjectTypeFromCode(subject.code),
                isCustomer: subject.isCustomer || false,
                isSupplier: subject.isSupplier || false,
                isEmployee: subject.isEmployee || false,
                enableCashFlow: subject.enableCashFlow || false,
                accountSetId: currentAccountSet?.id,
                createTime: now,
                updateTime: now,
              };
            });

          if (missingSubjects.length > 0) {
            await getCurrentService().saveSubjects(missingSubjects);
            // 重新加载
            const updatedSubjects = await getCurrentService().getAllSubjects();
            set({ subjects: updatedSubjects, dataVersion: DEFAULT_SUBJECTS_VERSION });
            return;
          }
        }

        // 如果科目存在但没有 isCustomer/isSupplier 字段（或者值不正确），强制更新
        const subject1122 = subjects.find((s: any) => s.code === '1122');
        const subject2202 = subjects.find((s: any) => s.code === '2202');

        if (subject1122 && !subject1122.isCustomer) {
          await getCurrentService().saveSubjects([{ ...subject1122, isCustomer: true, enableDept: true, enableProject: true }]);
          // 重新加载
          const updatedSubjects = await getCurrentService().getAllSubjects();
          set({ subjects: updatedSubjects, dataVersion: DEFAULT_SUBJECTS_VERSION });
          return;
        }

        if (subject2202 && !subject2202.isSupplier) {
          await getCurrentService().saveSubjects([{ ...subject2202, isSupplier: true }]);
          // 重新加载
          const updatedSubjects = await getCurrentService().getAllSubjects();
          set({ subjects: updatedSubjects, dataVersion: DEFAULT_SUBJECTS_VERSION });
          return;
        }

        set({ subjects, dataVersion: DEFAULT_SUBJECTS_VERSION });
        return;
      }

      // 为默认科目添加缺失的字段
      const initializedSubjects = (defaultSubjects as any[]).map((subject, index) => {
        const now = new Date().toISOString();
        return {
          ...subject,
          id: subject.code, // 使用科目代码作为 ID，确保 parentId 能正确匹配
          block: false, // 初始化为未冻结
          enableForeign: subject.enableForeign || false,
          foreignCurrency: subject.foreignCurrency || '',
          subjectType: subject.subjectType || getSubjectTypeFromCode(subject.code),
          isCustomer: subject.isCustomer || (subject.code.startsWith('1122') || subject.code.startsWith('1121')), // 应收账款相关科目
          isSupplier: subject.isSupplier || (subject.code.startsWith('2202') || subject.code.startsWith('2201')), // 应付账款相关科目
          isEmployee: subject.isEmployee || subject.code.startsWith('2211'), // 应付职工薪酬相关科目
          enableCashFlow: subject.enableCashFlow || false,
          accountSetId: currentAccountSet?.id,
          createTime: now,
          updateTime: now,
        };
      });

      // 保存到数据库
      await getCurrentService().saveSubjects(initializedSubjects);

      set({
        subjects: initializedSubjects,
        dataVersion: DEFAULT_SUBJECTS_VERSION
      });
    } catch (error) {
      console.error('Failed to initialize subjects:', error);
      set({ error: '初始化科目数据失败' });
    }
  }
}));
