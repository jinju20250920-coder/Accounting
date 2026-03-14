import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Department } from '@/types';
import { STORAGE_KEYS, DATA_VERSIONS } from './persistence-config';

// 部门树节点
interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
  expanded: boolean;
}

interface DepartmentStore {
  // 状态
  departments: Department[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedDepartmentId: string | null;

  // CRUD 操作
  addDepartment: (department: Omit<Department, 'id'>) => void;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  toggleDepartmentFrozen: (id: string) => void;

  // 查询操作
  getDepartmentById: (id: string) => Department | undefined;
  getDepartmentByCode: (code: string) => Department | undefined;
  getDepartmentsByParentId: (parentId: string | null) => Department[];
  searchDepartments: (query: string) => Department[];

  // 树形结构操作
  buildDepartmentTree: () => DepartmentTreeNode[];
  getDepartmentPath: (id: string) => Department[];

  // 批量操作
  importDepartments: (departments: Department[]) => void;
  exportDepartments: () => string;
  addDefaultDepartments: () => void;

  // 数据管理
  setSearchQuery: (query: string) => void;
  setSelectedDepartmentId: (id: string | null) => void;
  clearError: () => void;
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 生成部门代码
const generateDepartmentCode = (parentId: string | null, allDepartments: Department[]): string => {
  const siblingCount = allDepartments.filter(d => d.parentId === parentId).length;
  const prefix = parentId || 'DEPT';
  const suffix = String(siblingCount + 1).padStart(3, '0');
  return `${prefix}${suffix}`;
};

// 验证部门代码
const validateDepartmentCode = (code: string, existingCodes: string[]): { isValid: boolean; error?: string } => {
  if (!code || code.trim() === '') {
    return { isValid: false, error: '部门代码不能为空' };
  }
  if (existingCodes.includes(code)) {
    return { isValid: false, error: '部门代码已存在' };
  }
  return { isValid: true };
};

// 默认部门数据
const DEFAULT_DEPARTMENTS: Omit<Department, 'id'>[] = [
  { code: 'DEPT001', name: '销售部', parentId: null, level: 1, frozen: false },
  { code: 'DEPT002', name: '市场部', parentId: null, level: 1, frozen: false },
  { code: 'DEPT003', name: '技术部', parentId: null, level: 1, frozen: false },
  { code: 'DEPT004', name: '财务部', parentId: null, level: 1, frozen: false },
  { code: 'DEPT005', name: '人力资源部', parentId: null, level: 1, frozen: false }
];

export const useDepartmentStore = create<DepartmentStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      departments: [...DEFAULT_DEPARTMENTS.map(d => ({ ...d, id: generateId() }))],
      loading: false,
      error: null,
      searchQuery: '',
      selectedDepartmentId: null,

      // 添加部门
      addDepartment: (department) => {
        const state = get();
        const existingCodes = state.departments.map(d => d.code);
        const validation = validateDepartmentCode(department.code, existingCodes);

        if (!validation.isValid) {
          set({ error: validation.error || '添加失败' });
          return;
        }

        // 如果没有提供代码，自动生成
        const code = department.code || generateDepartmentCode(department.parentId, state.departments);

        const newDepartment: Department = {
          ...department,
          id: generateId(),
          code
        };

        set((state) => ({
          departments: [...state.departments, newDepartment],
          error: null
        }));
      },

      // 更新部门
      updateDepartment: (id, updates) => {
        set((state) => ({
          departments: state.departments.map(d =>
            d.id === id ? { ...d, ...updates } : d
          ),
          error: null
        }));
      },

      // 删除部门
      deleteDepartment: (id) => {
        const state = get();
        const department = state.departments.find(d => d.id === id);

        if (!department) {
          set({ error: '部门不存在' });
          return;
        }

        // 检查是否有子部门
        const hasChildren = state.departments.some(d => d.parentId === id);
        if (hasChildren) {
          set({ error: '该部门有下级部门，请先删除或移动下级部门' });
          return;
        }

        set((state) => ({
          departments: state.departments.filter(d => d.id !== id),
          selectedDepartmentId: state.selectedDepartmentId === id ? null : state.selectedDepartmentId,
          error: null
        }));
      },

      // 切换部门冻结状态
      toggleDepartmentFrozen: (id) => {
        const state = get();
        const department = state.departments.find(d => d.id === id);

        if (!department) {
          set({ error: '部门不存在' });
          return;
        }

        // 检查是否有子部门
        const hasChildren = state.departments.some(d => d.parentId === id);
        if (hasChildren && !department.frozen) {
          set({ error: '该部门有下级部门，请先冻结下级部门' });
          return;
        }

        set((state) => ({
          departments: state.departments.map(d =>
            d.id === id ? { ...d, frozen: !d.frozen } : d
          ),
          error: null
        }));
      },

      // 根据ID获取部门
      getDepartmentById: (id) => {
        return get().departments.find(d => d.id === id);
      },

      // 根据代码获取部门
      getDepartmentByCode: (code) => {
        return get().departments.find(d => d.code === code);
      },

      // 根据父ID获取部门
      getDepartmentsByParentId: (parentId) => {
        return get().departments.filter(d => d.parentId === parentId);
      },

      // 搜索部门
      searchDepartments: (query) => {
        if (!query.trim()) return get().departments;

        const lowerQuery = query.toLowerCase();
        return get().departments.filter(d =>
          d.code.toLowerCase().includes(lowerQuery) ||
          d.name.toLowerCase().includes(lowerQuery)
        );
      },

      // 构建部门树
      buildDepartmentTree: () => {
        const state = get();
        const map = new Map<string, DepartmentTreeNode>();
        const roots: DepartmentTreeNode[] = [];

        // 初始化map
        state.departments.forEach(department => {
          const isSelected = state.selectedDepartmentId === department.id;
          map.set(department.id, {
            ...department,
            children: [],
            expanded: isSelected
          } as DepartmentTreeNode);
        });

        // 构建树
        state.departments.forEach(department => {
          const node = map.get(department.id);
          if (department.parentId) {
            const parent = map.get(department.parentId);
            if (parent) {
              parent.children!.push(node!);
            }
          } else {
            roots.push(node!);
          }
        });

        return roots;
      },

      // 获取部门路径
      getDepartmentPath: (id) => {
        const state = get();
        const path: Department[] = [];
        let currentId: string | null = id;
        const map = new Map(state.departments.map(d => [d.id, d]));

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

      // 批量导入部门
      importDepartments: (departments) => {
        const state = get();

        // 验证代码唯一性
        const existingCodes = state.departments.map(d => d.code);
        const invalidDepartments: string[] = [];
        const validDepartments = departments.filter(department => {
          const code = department.code || generateDepartmentCode(department.parentId, [...state.departments, ...departments]);
          const validation = validateDepartmentCode(code, existingCodes);
          if (!validation.isValid) {
            invalidDepartments.push(`${department.code || code}: ${validation.error}`);
            return false;
          }
          existingCodes.push(code);
          return true;
        });

        if (invalidDepartments.length > 0) {
          set({ error: `导入失败：${invalidDepartments.join('; ')}` });
          return;
        }

        const departmentsWithIds = validDepartments.map(d => ({
          ...d,
          id: generateId()
        }));

        set((state) => ({
          departments: [...state.departments, ...departmentsWithIds],
          error: null
        }));
      },

      // 导出部门
      exportDepartments: () => {
        const state = get();
        return JSON.stringify(state.departments, null, 2);
      },

      // 添加默认部门
      addDefaultDepartments: () => {
        const state = get();
        const existingCodes = state.departments.map(d => d.code);
        const validDepartments = DEFAULT_DEPARTMENTS.filter(dept => {
          return !existingCodes.includes(dept.code);
        });

        const departmentsWithIds = validDepartments.map(d => ({
          ...d,
          id: generateId()
        }));

        set((state) => ({
          departments: [...state.departments, ...departmentsWithIds],
          error: null
        }));
      },

      // 设置搜索查询
      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      // 设置选中部门
      setSelectedDepartmentId: (id) => {
        set({ selectedDepartmentId: id });
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: STORAGE_KEYS.DEPARTMENTS,
      version: DATA_VERSIONS.CURRENT,
      partialize: (state) => ({
        departments: state.departments
      })
    }
  )
);
