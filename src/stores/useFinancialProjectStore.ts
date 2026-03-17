import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project } from '@/types';
import { STORAGE_KEYS, DATA_VERSIONS, createAccountSetPersistConfig } from './persistence-config';

interface FinancialProjectStore {
  // 状态
  projects: Project[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filterType: 'all' | 'income' | 'cost' | 'other';
  selectedProjectId: string | null;

  // CRUD 操作
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  closeProject: (id: string, endDate?: string) => void;
  reopenProject: (id: string) => void;
  toggleProjectFrozen: (id: string) => void;

  // 查询操作
  getProjectById: (id: string) => Project | undefined;
  getProjectByCode: (code: string) => Project | undefined;
  searchProjects: (query: string) => Project[];
  getProjectsByType: (type: Project['type']) => Project[];
  getActiveProjects: () => Project[];
  getClosedProjects: () => Project[];

  // 统计操作
  getProjectStatistics: () => {
    total: number;
    active: number;
    closed: number;
    expired: number;
    byType: Record<Project['type'], number>;
  };

  // 批量操作
  importProjects: (projects: Project[]) => void;
  exportProjects: () => string;

  // 数据管理
  setSearchQuery: (query: string) => void;
  setFilterType: (type: FinancialProjectStore['filterType']) => void;
  setSelectedProjectId: (id: string | null) => void;
  clearError: () => void;
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 生成项目代码
const generateProjectCode = (allProjects: Project[]): string => {
  const count = allProjects.length;
  return `PRJ${String(count + 1).padStart(3, '0')}`;
};

// 验证项目代码
const validateProjectCode = (code: string, existingCodes: string[]): { isValid: boolean; error?: string } => {
  if (!code || code.trim() === '') {
    return { isValid: false, error: '项目代码不能为空' };
  }
  if (existingCodes.includes(code)) {
    return { isValid: false, error: '项目代码已存在' };
  }
  return { isValid: true };
};

// 计算项目状态
const calculateProjectStatus = (project: Project): 'active' | 'closed' | 'expired' => {
  if (project.endDate && new Date(project.endDate) < new Date()) {
    return 'expired';
  }
  return project.endDate ? 'closed' : 'active';
};

// 默认项目数据
const DEFAULT_PROJECTS: Omit<Project, 'id'>[] = [
  {
    code: 'PRJ001',
    name: '客户管理系统',
    type: 'income',
    parentId: null,
    level: 1,
    startDate: '2024-01-01',
    endDate: null,
    frozen: false
  },
  {
    code: 'PRJ002',
    name: '数据分析平台',
    type: 'cost',
    parentId: null,
    level: 1,
    startDate: '2024-02-01',
    endDate: null,
    frozen: false
  },
  {
    code: 'PRJ003',
    name: '移动APP开发',
    type: 'income',
    parentId: null,
    level: 1,
    startDate: '2024-03-01',
    endDate: null,
    frozen: false
  },
  {
    code: 'PRJ004',
    name: '内部培训项目',
    type: 'other',
    parentId: null,
    level: 1,
    startDate: '2024-01-15',
    endDate: '2024-03-31',
    frozen: false
  }
];

export const useFinancialProjectStore = create<FinancialProjectStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      projects: [...DEFAULT_PROJECTS.map(p => ({ ...p, id: generateId() }))],
      loading: false,
      error: null,
      searchQuery: '',
      filterType: 'all',
      selectedProjectId: null,

      // 添加项目
      addProject: (project) => {
        const state = get();
        const existingCodes = state.projects.map(p => p.code);
        const validation = validateProjectCode(project.code, existingCodes);

        if (!validation.isValid) {
          set({ error: validation.error || '添加失败' });
          return;
        }

        // 如果没有提供代码，自动生成
        const code = project.code || generateProjectCode(state.projects);

        const newProject: Project = {
          ...project,
          id: generateId(),
          code
        };

        set((state) => ({
          projects: [...state.projects, newProject],
          error: null
        }));
      },

      // 更新项目
      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === id ? { ...p, ...updates } : p
          ),
          error: null
        }));
      },

      // 删除项目
      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter(p => p.id !== id),
          selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
          error: null
        }));
      },

      // 关闭项目
      closeProject: (id, endDate) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === id ? { ...p, endDate } : p
          ),
          error: null
        }));
      },

      // 重新打开项目
      reopenProject: (id) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === id ? { ...p, endDate: null } : p
          ),
          error: null
        }));
      },

      // 切换项目冻结状态
      toggleProjectFrozen: (id) => {
        const state = get();
        const project = state.projects.find(p => p.id === id);

        if (!project) {
          set({ error: '项目不存在' });
          return;
        }

        set((state) => ({
          projects: state.projects.map(p =>
            p.id === id ? { ...p, frozen: !p.frozen } : p
          ),
          error: null
        }));
      },

      // 根据ID获取项目
      getProjectById: (id) => {
        return get().projects.find(p => p.id === id);
      },

      // 根据代码获取项目
      getProjectByCode: (code) => {
        return get().projects.find(p => p.code === code);
      },

      // 搜索项目
      searchProjects: (query) => {
        if (!query.trim()) return get().projects;

        const lowerQuery = query.toLowerCase();
        return get().projects.filter(p =>
          p.code.toLowerCase().includes(lowerQuery) ||
          p.name.toLowerCase().includes(lowerQuery)
        );
      },

      // 按类型获取项目
      getProjectsByType: (type) => {
        return get().projects.filter(p => p.type === type);
      },

      // 获取活跃项目
      getActiveProjects: () => {
        return get().projects.filter(p => !p.endDate);
      },

      // 获取已关闭项目
      getClosedProjects: () => {
        return get().projects.filter(p => !!p.endDate);
      },

      // 获取项目统计
      getProjectStatistics: () => {
        const state = get();
        const projects = state.projects;

        const total = projects.length;
        const active = projects.filter(p => !p.endDate).length;
        const closed = projects.filter(p => !!p.endDate).length;
        const expired = projects.filter(p => p.endDate && new Date(p.endDate) < new Date()).length;

        const byType: Record<Project['type'], number> = {
          income: projects.filter(p => p.type === 'income').length,
          cost: projects.filter(p => p.type === 'cost').length,
          other: projects.filter(p => p.type === 'other').length
        };

        return { total, active, closed, expired, byType };
      },

      // 批量导入项目
      importProjects: (projects) => {
        const state = get();

        // 验证代码唯一性
        const existingCodes = state.projects.map(p => p.code);
        const invalidProjects: string[] = [];
        const validProjects = projects.filter(project => {
          const code = project.code || generateProjectCode([...state.projects, ...projects]);
          const validation = validateProjectCode(code, existingCodes);
          if (!validation.isValid) {
            invalidProjects.push(`${project.code || code}: ${validation.error}`);
            return false;
          }
          existingCodes.push(code);
          return true;
        });

        if (invalidProjects.length > 0) {
          set({ error: `导入失败：${invalidProjects.join('; ')}` });
          return;
        }

        const projectsWithIds = validProjects.map(p => ({
          ...p,
          id: generateId()
        }));

        set((state) => ({
          projects: [...state.projects, ...projectsWithIds],
          error: null
        }));
      },

      // 导出项目
      exportProjects: () => {
        const state = get();
        return JSON.stringify(state.projects, null, 2);
      },

      // 设置搜索查询
      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      // 设置类型筛选
      setFilterType: (type) => {
        set({ filterType: type });
      },

      // 设置选中项目
      setSelectedProjectId: (id) => {
        set({ selectedProjectId: id });
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      }
    }),
    createAccountSetPersistConfig(STORAGE_KEYS.PROJECTS)
  )
);
