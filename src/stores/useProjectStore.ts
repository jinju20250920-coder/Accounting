'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 项目文档结构
export interface ProjectDocument {
  id: string;
  title: string;
  content: string;
  category: 'requirements' | 'technical' | 'database' | 'progress' | 'tests' | 'changes';
  version: string;
  status: 'draft' | 'review' | 'approved' | 'rejected';
  author: string;
  createTime: string;
  updateTime: string;
  tags: string[];
  relatedChanges: string[];
}

// 任务类型
export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'bug' | 'refactor' | 'test' | 'docs';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  assignee: string;
  reporter: string;
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  dependencies: string[];
  relatedDocs: string[];
  relatedTests: string[];
}

// 需求变更
export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  type: 'functional' | 'non-functional' | 'emergency' | 'documentation';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'implemented';
  applicant: string;
  reviewer: string;
  submitDate: string;
  decisionDate?: string;
  implementationDate?: string;
  estimatedEffort: number;
  actualEffort?: number;
  impact: {
    technical: 'low' | 'medium' | 'high';
    business: 'low' | 'medium' | 'high';
    schedule: 'low' | 'medium' | 'high';
  };
  relatedTasks: string[];
  relatedDocs: string[];
}

// 里程碑
export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  actualDate?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  progress: number;
  tasks: string[];
  criteria: string[];
}

// 迭代
export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed';
  goals: string[];
  tasks: string[];
  completedTasks: number;
  totalTasks: number;
}

// 项目状态
export interface ProjectState {
  // 文档管理
  documents: ProjectDocument[];

  // 任务管理
  tasks: Task[];

  // 需求变更
  changes: ChangeRequest[];

  // 里程碑
  milestones: Milestone[];

  // 迭代
  sprints: Sprint[];

  // UI状态
  selectedCategory: string;
  searchQuery: string;
  filterStatus: string;
  filterPriority: string;

  // Actions
  // 文档管理
  addDocument: (doc: Omit<ProjectDocument, 'id' | 'createTime' | 'updateTime'>) => void;
  updateDocument: (id: string, updates: Partial<ProjectDocument>) => void;
  deleteDocument: (id: string) => void;
  getDocument: (id: string) => ProjectDocument | undefined;

  // 任务管理
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newStatus: Task['status']) => void;
  getTasksByStatus: (status: Task['status']) => Task[];
  getTasksByAssignee: (assignee: string) => Task[];

  // 需求变更
  submitChange: (change: Omit<ChangeRequest, 'id' | 'submitDate' | 'status'>) => void;
  reviewChange: (id: string, decision: 'approved' | 'rejected', comments: string) => void;
  implementChange: (id: string) => void;
  getChangeByStatus: (status: ChangeRequest['status']) => ChangeRequest[];

  // 里程碑管理
  addMilestone: (milestone: Omit<Milestone, 'id'>) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  updateMilestoneProgress: (id: string, progress: number) => void;

  // 迭代管理
  startSprint: (sprint: Omit<Sprint, 'id'>) => void;
  completeSprint: (id: string) => void;
  addTaskToSprint: (sprintId: string, taskId: string) => void;
  removeTaskFromSprint: (sprintId: string, taskId: string) => void;

  // UI管理
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: string) => void;
  setFilterPriority: (priority: string) => void;
}

// 初始数据
const initialDocuments: ProjectDocument[] = [
  {
    id: 'doc-001',
    title: '系统总体需求',
    content: '# 系统总体需求\n\n## 项目概述\nAI财务助手是一个基于Web的现代会计凭证录入系统...',
    category: 'requirements',
    version: 'v1.0',
    status: 'approved',
    author: '张三',
    createTime: '2026-03-10T00:00:00Z',
    updateTime: '2026-03-10T00:00:00Z',
    tags: ['需求', '系统', '概述'],
    relatedChanges: []
  },
  {
    id: 'doc-002',
    title: '凭证录入功能需求',
    content: '# 凭证录入功能需求\n\n## 功能描述\n1. Excel-like网格界面\n2. 凭证自动生成字号\n3. 借贷自动平衡...',
    category: 'requirements',
    version: 'v1.0',
    status: 'review',
    author: '李四',
    createTime: '2026-03-10T00:00:00Z',
    updateTime: '2026-03-10T00:00:00Z',
    tags: ['功能', '凭证', '录入'],
    relatedChanges: ['chg-001']
  }
];

const initialTasks: Task[] = [
  {
    id: 'task-001',
    title: '凭证状态机实现',
    description: '实现凭证状态管理：draft → review → posted → reversed',
    type: 'feature',
    priority: 'high',
    status: 'in_progress',
    assignee: '张三',
    reporter: '李四',
    createdAt: '2026-03-10T00:00:00Z',
    dueDate: '2026-03-15T00:00:00Z',
    estimatedHours: 8,
    actualHours: 4,
    dependencies: [],
    relatedDocs: ['doc-001', 'doc-002'],
    relatedTests: []
  },
  {
    id: 'task-002',
    title: 'AI科目匹配优化',
    description: '优化AI智能匹配算法，提升准确率',
    type: 'refactor',
    priority: 'medium',
    status: 'todo',
    assignee: '李四',
    reporter: '张三',
    createdAt: '2026-03-10T00:00:00Z',
    dueDate: '2026-03-20T00:00:00Z',
    estimatedHours: 16,
    dependencies: [],
    relatedDocs: ['doc-002'],
    relatedTests: ['test-001']
  }
];

const initialChanges: ChangeRequest[] = [
  {
    id: 'chg-001',
    title: '新增凭证冲销功能',
    description: '在已记账凭证上增加冲销功能，符合会计准则',
    type: 'functional',
    priority: 'high',
    status: 'in_review',
    applicant: '李四',
    reviewer: '张三',
    submitDate: '2026-03-10T00:00:00Z',
    estimatedEffort: 32,
    impact: {
      technical: 'high',
      business: 'medium',
      schedule: 'low'
    },
    relatedTasks: ['task-001'],
    relatedDocs: ['doc-002']
  }
];

const initialMilestones: Milestone[] = [
  {
    id: 'milestone-001',
    name: '基础框架搭建',
    description: '完成项目基础框架搭建，包括技术选型和架构设计',
    targetDate: '2026-02-28T00:00:00Z',
    actualDate: '2026-02-25T00:00:00Z',
    status: 'completed',
    progress: 100,
    tasks: ['task-001'],
    criteria: ['完成基础框架', '实现核心类型定义', '搭建UI组件库']
  },
  {
    id: 'milestone-002',
    name: '核心功能实现',
    description: '完成凭证录入和AI智能匹配核心功能',
    targetDate: '2026-03-15T00:00:00Z',
    status: 'in_progress',
    progress: 60,
    tasks: ['task-001', 'task-002'],
    criteria: ['凭证录入功能完整', 'AI匹配算法实现', '测试用例编写']
  }
];

// Store实现
export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // 初始状态
      documents: initialDocuments,
      tasks: initialTasks,
      changes: initialChanges,
      milestones: initialMilestones,
      sprints: [],
      selectedCategory: 'all',
      searchQuery: '',
      filterStatus: 'all',
      filterPriority: 'all',

      // 文档管理
      addDocument: (doc) => {
        const newDoc: ProjectDocument = {
          ...doc,
          id: `doc-${Date.now()}`,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString()
        };
        set((state) => ({
          documents: [...state.documents, newDoc]
        }));
      },

      updateDocument: (id, updates) => {
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id
              ? { ...doc, ...updates, updateTime: new Date().toISOString() }
              : doc
          )
        }));
      },

      deleteDocument: (id) => {
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id)
        }));
      },

      getDocument: (id) => {
        return get().documents.find((doc) => doc.id === id);
      },

      // 任务管理
      addTask: (task) => {
        const newTask: Task = {
          ...task,
          id: `task-${Date.now()}`,
          createdAt: new Date().toISOString()
        };
        set((state) => ({
          tasks: [...state.tasks, newTask]
        }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          )
        }));
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id)
        }));
      },

      moveTask: (taskId, newStatus) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: newStatus,
                  completedAt: newStatus === 'done' ? new Date().toISOString() : task.completedAt
                }
              : task
          )
        }));
      },

      getTasksByStatus: (status) => {
        return get().tasks.filter((task) => task.status === status);
      },

      getTasksByAssignee: (assignee) => {
        return get().tasks.filter((task) => task.assignee === assignee);
      },

      // 需求变更
      submitChange: (change) => {
        const newChange: ChangeRequest = {
          ...change,
          id: `chg-${Date.now()}`,
          submitDate: new Date().toISOString(),
          status: 'pending'
        };
        set((state) => ({
          changes: [...state.changes, newChange]
        }));
      },

      reviewChange: (id, decision, comments) => {
        set((state) => ({
          changes: state.changes.map((change) =>
            change.id === id
              ? {
                  ...change,
                  status: decision === 'approved' ? 'approved' : 'rejected',
                  decisionDate: new Date().toISOString()
                }
              : change
          )
        }));
      },

      implementChange: (id) => {
        set((state) => ({
          changes: state.changes.map((change) =>
            change.id === id
              ? {
                  ...change,
                  status: 'implemented',
                  implementationDate: new Date().toISOString()
                }
              : change
          )
        }));
      },

      getChangeByStatus: (status) => {
        return get().changes.filter((change) => change.status === status);
      },

      // 里程碑管理
      addMilestone: (milestone) => {
        const newMilestone: Milestone = {
          ...milestone,
          id: `milestone-${Date.now()}`
        };
        set((state) => ({
          milestones: [...state.milestones, newMilestone]
        }));
      },

      updateMilestone: (id, updates) => {
        set((state) => ({
          milestones: state.milestones.map((milestone) =>
            milestone.id === id ? { ...milestone, ...updates } : milestone
          )
        }));
      },

      updateMilestoneProgress: (id, progress) => {
        set((state) => ({
          milestones: state.milestones.map((milestone) =>
            milestone.id === id
              ? {
                  ...milestone,
                  progress,
                  status: progress === 100 ? 'completed' : 'in_progress',
                  actualDate: progress === 100 ? new Date().toISOString() : milestone.actualDate
                }
              : milestone
          )
        }));
      },

      // 迭代管理
      startSprint: (sprint) => {
        const newSprint: Sprint = {
          ...sprint,
          id: `sprint-${Date.now()}`
        };
        set((state) => ({
          sprints: [...state.sprints, newSprint]
        }));
      },

      completeSprint: (id) => {
        set((state) => ({
          sprints: state.sprints.map((sprint) =>
            sprint.id === id ? { ...sprint, status: 'completed' } : sprint
          )
        }));
      },

      addTaskToSprint: (sprintId, taskId) => {
        set((state) => ({
          sprints: state.sprints.map((sprint) =>
            sprint.id === sprintId
              ? { ...sprint, tasks: [...sprint.tasks, taskId] }
              : sprint
          )
        }));
      },

      removeTaskFromSprint: (sprintId, taskId) => {
        set((state) => ({
          sprints: state.sprints.map((sprint) =>
            sprint.id === sprintId
              ? { ...sprint, tasks: sprint.tasks.filter((id) => id !== taskId) }
              : sprint
          )
        }));
      },

      // UI管理
      setSelectedCategory: (category) => {
        set({ selectedCategory: category });
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      setFilterStatus: (status) => {
        set({ filterStatus: status });
      },

      setFilterPriority: (priority) => {
        set({ filterPriority: priority });
      }
    }),
    {
      name: 'ai-finance-project-storage'
    }
  )
);