# 数据存储架构完整重构设计文档

**日期**：2026-03-18
**版本**：v3.0（完整重构）
**状态**：待审核
**数据策略**：测试数据可清空，不需要迁移

---

## 概述

### 目标
- ❌ 移除 Zustand persist 中间件
- ❌ 移除 keyValues 通用表
- ✅ 使用纯结构化 IndexedDB 表
- ✅ 保留键前缀账套隔离方案
- ✅ 简化架构，提升查询性能

### 核心原则
1. **单一数据源**：IndexedDB 结构化表是唯一数据源
2. **内存缓存**：Zustand Store 只做内存状态管理
3. **同步更新**：数据变更同时更新内存和 IndexedDB
4. **键前缀隔离**：每个账套的数据用键前缀隔离

---

## 一、新架构

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        UI 层 (React)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ 读取/调用 actions
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Zustand Store 层 (仅内存状态)                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐│
│  │ useVoucherStore │  │ useSubjectStore │  │ use...Store ││
│  │  - 内存状态      │  │  - 内存状态      │  │  - 内存状态  ││
│  │  - actions      │  │  - actions      │  │  - actions   ││
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘│
└───────────┼────────────────────┼──────────────────────┼───────┘
            │ 调用               │ 调用                │ 调用
            └────────────────────┴──────────────────────┘
                                 ↓
              ┌──────────────────────────────────┐
              │      DatabaseManager             │
              │  - 管理账套数据库切换            │
              │  - 提供统一操作接口              │
              └────────────────┬─────────────────┘
                                 ↓
              ┌──────────────────────────────────┐
              │    DatabaseService (单例)       │
              │  ┌───────────────────────────┐  │
              │  │ saveVoucher()             │  │
              │  │ getVoucher()              │  │
              │  │ getAllVouchers()          │  │
              │  │ deleteVoucher()           │  │
              │  │ saveSubjects()            │  │
              │  │ getAllSubjects()          │  │
              │  │ ... (结构化操作)          │  │
              │  └───────────────────────────┘  │
              └────────────────┬─────────────────┘
                                 ↓
              ┌──────────────────────────────────┐
              │    IndexedDB (单一数据库)        │
              │     DB: finance-assistant-db     │
              │  ┌───────────────────────────┐  │
              │  │ vouchers (by-date, status)│  │
              │  │ entries (by-voucher)      │  │
              │  │ subjects (by-code, parent)│  │
              │  │ departments, projects,... │  │
              │  │ + accountSetId 字段       │  │
              │  └───────────────────────────┘  │
              └──────────────────────────────────┘
```

---

## 二、数据隔离策略

### 2.1 账套隔离方案

**采用键前缀 + accountSetId 字段方案**：

```typescript
// 1. 每个结构化表都添加 accountSetId 字段
interface Voucher {
  id: string;
  voucherNo: string;
  accountSetId: string;  // 新增：账套ID
  // ... 其他字段
}

// 2. 每个查询都通过 accountSetId 过滤
async function getAllVouchers(accountSetId: string): Promise<Voucher[]> {
  const db = await getDatabase();
  const allVouchers = await db.getAll('vouchers');
  return allVouchers.filter(v => v.accountSetId === accountSetId);
}

// 3. 写入时自动设置 accountSetId
async function saveVoucher(voucher: Voucher, accountSetId: string): Promise<void> {
  voucher.accountSetId = accountSetId;
  await db.put('vouchers', voucher);
}
```

**优点**：
- 单一数据库，管理简单
- accountSetId 字段清晰
- 查询时可以用索引优化

---

## 三、IndexedDB 数据库 Schema

### 3.1 数据库结构

```typescript
interface FinanceDB extends DBSchema {
  // 账套元数据（全局存储）
  accountSets: {
    key: string;
    value: AccountingSet;
    indexes: {
      'by-code': string;
    };
  };

  // 凭证表
  vouchers: {
    key: string;
    value: Voucher & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-date': string;
      'by-status': string;
      'by-voucherNo': string;
    };
  };

  // 分录表
  entries: {
    key: string;
    value: VoucherEntry & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-voucher': string;
      'by-subject': string;
      'by-date': string;
    };
  };

  // 科目表
  subjects: {
    key: string;
    value: Subject & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-code': string;
      'by-parent': string;
    };
  };

  // 部门表
  departments: {
    key: string;
    value: Department & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };

  // 项目表
  projects: {
    key: string;
    value: Project & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };

  // 币别表
  currencies: {
    key: string;
    value: Currency & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };

  // 往来单位表
  partners: {
    key: string;
    value: Partner & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-code': string;
    };
  };

  // 凭证模板表
  voucherTemplates: {
    key: string;
    value: VoucherFullTemplate & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-name': string;
    };
  };

  // 常用摘要表
  commonSummaries: {
    key: string;
    value: CommonSummary & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-sortOrder': number;
    };
  };

  // 用户偏好表
  userPreferences: {
    key: string;
    value: UserPreference & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-summary': string;
      'by-subject': string;
    };
  };

  // 审计日志表
  auditLogs: {
    key: string;
    value: AuditLog & { accountSetId: string };
    indexes: {
      'by-accountSet': string;
      'by-timestamp': number;
      'by-entityType': string;
    };
  };
}
```

---

## 四、DatabaseManager 设计

### 4.1 账套管理

```typescript
class DatabaseManager {
  private static instance: DatabaseManager;
  private db: IDBPDatabase<FinanceDB> | null = null;
  private currentAccountSetId: string | null = null;

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<FinanceDB>('finance-assistant-db', 1, {
      upgrade(db) {
        // 创建所有表...
      },
    });
  }

  async switchAccountSet(accountSetId: string): Promise<void> {
    this.currentAccountSetId = accountSetId;
  }

  getCurrentAccountSetId(): string | null {
    return this.currentAccountSetId;
  }

  getDatabase(): IDBPDatabase<FinanceDB> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }
}

export const databaseManager = DatabaseManager.getInstance();
```

---

## 五、DatabaseService 设计

### 5.1 凭证操作

```typescript
class DatabaseService {
  private get db() {
    return databaseManager.getDatabase();
  }

  private get accountSetId() {
    const id = databaseManager.getCurrentAccountSetId();
    if (!id) {
      throw new Error('No account set selected');
    }
    return id;
  }

  // ========== 凭证操作 ==========

  async saveVoucher(voucher: Voucher): Promise<void> {
    const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');

    // 保存凭证（自动添加 accountSetId）
    const voucherWithAccountSet = {
      ...voucher,
      accountSetId: this.accountSetId
    };
    await tx.store('vouchers').put(voucherWithAccountSet);

    // 保存分录
    for (const entry of voucher.entries) {
      const entryWithAccountSet = {
        ...entry,
        accountSetId: this.accountSetId
      };
      await tx.store('entries').put(entryWithAccountSet);
    }

    await tx.done;
  }

  async getVoucher(id: string): Promise<Voucher | undefined> {
    const voucher = await this.db.get('vouchers', id);

    if (!voucher || voucher.accountSetId !== this.accountSetId) {
      return undefined;
    }

    // 获取关联的分录
    const entries = await this.db.getAllFromIndex('entries', 'by-voucher',
      [this.accountSetId, id]);

    return {
      ...voucher,
      entries
    };
  }

  async getAllVouchers(): Promise<Voucher[]> {
    const tx = this.db.transaction(['vouchers', 'entries'], 'readonly');

    // 获取当前账套的所有凭证
    const allVouchers = await tx.store('vouchers').getAll();
    const accountVouchers = allVouchers.filter(v => v.accountSetId === this.accountSetId);

    // 获取每个凭证的分录
    const result: Voucher[] = [];
    for (const voucher of accountVouchers) {
      const entries = await tx.store('entries').getAllFromIndex('by-voucher',
        [this.accountSetId, voucher.id]);
      result.push({
        ...voucher,
        entries
      });
    }

    await tx.done;
    return result;
  }

  async deleteVoucher(id: string): Promise<void> {
    const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');

    // 删除凭证
    await tx.store('vouchers').delete(id);

    // 删除关联的分录
    const entries = await tx.store('entries').getAllFromIndex('by-voucher',
      [this.accountSetId, id]);
    for (const entry of entries) {
      await tx.store('entries').delete(entry.id);
    }

    await tx.done;
  }

  // ========== 科目操作 ==========

  async saveSubjects(subjects: Subject[]): Promise<void> {
    const tx = this.db.transaction('subjects', 'readwrite');

    for (const subject of subjects) {
      const subjectWithAccountSet = {
        ...subject,
        accountSetId: this.accountSetId
      };
      await tx.store('subjects').put(subjectWithAccountSet);
    }

    await tx.done;
  }

  async getAllSubjects(): Promise<Subject[]> {
    const allSubjects = await this.db.getAll('subjects');
    return allSubjects.filter(s => s.accountSetId === this.accountSetId);
  }

  // ========== 其他表操作（类似） ==========
  // saveDepartments, getAllDepartments, etc.
}

export const databaseService = new DatabaseService();
```

---

## 六、Zustand Store 改造（以 VoucherStore 为例）

### 6.1 移除 persist 中间件

```typescript
// src/stores/useVoucherStore.ts
import { create } from 'zustand';
import { databaseManager, databaseService } from '@/lib/database';

interface VoucherStore {
  // 内存状态
  vouchers: Voucher[];
  currentVoucher: Voucher | null;
  isLoading: boolean;
  error: string | null;

  // 初始化
  initialize: () => Promise<void>;

  // Actions（自动持久化）
  createVoucher: () => Promise<Voucher>;
  saveVoucher: (voucher: Voucher) => Promise<void>;
  deleteVoucher: (id: string) => Promise<void>;
  loadVoucher: (id: string) => Promise<Voucher | null>;
}

const useVoucherStore = create<VoucherStore>((set, get) => ({
  vouchers: [],
  currentVoucher: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const vouchers = await databaseService.getAllVouchers();
      set({ vouchers, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '初始化失败',
        isLoading: false
      });
    }
  },

  createVoucher: async () => {
    const newVoucher: Voucher = {
      id: generateId(),
      voucherNo: generateVoucherNo(),
      date: new Date().toISOString().split('T')[0],
      summary: '',
      entries: [],
      status: 'draft',
      voucherType: 'general',
      createdBy: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 持久化到 IndexedDB
    await databaseService.saveVoucher(newVoucher);

    // 更新内存状态
    set((state) => ({
      vouchers: [...state.vouchers, newVoucher],
      currentVoucher: newVoucher
    }));

    return newVoucher;
  },

  saveVoucher: async (voucher: Voucher) => {
    // 持久化到 IndexedDB
    await databaseService.saveVoucher(voucher);

    // 更新内存状态
    set((state) => ({
      vouchers: state.vouchers.map(v => v.id === voucher.id ? voucher : v),
      currentVoucher: voucher
    }));
  },

  deleteVoucher: async (id: string) => {
    // 从 IndexedDB 删除
    await databaseService.deleteVoucher(id);

    // 更新内存状态
    set((state) => ({
      vouchers: state.vouchers.filter(v => v.id !== id),
      currentVoucher: state.currentVoucher?.id === id ? null : state.currentVoucher
    }));
  },

  loadVoucher: async (id: string) => {
    const voucher = await databaseService.getVoucher(id);
    if (voucher) {
      set({ currentVoucher: voucher });
    }
    return voucher;
  }
}));

export { useVoucherStore };
```

---

## 七、应用启动流程

### 7.1 初始化

```typescript
// src/app/layout.tsx
import { useEffect } from 'react';
import { databaseManager } from '@/lib/database';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { initialize: initializeVouchers } = useVoucherStore();
  const { initialize: initializeSubjects } = useSubjectStore();
  const { currentAccountSetId } = useAccountSetStore();

  // 应用启动时初始化数据库
  useEffect(() => {
    databaseManager.init();
  }, []);

  // 选择账套后加载数据
  useEffect(() => {
    if (currentAccountSetId) {
      databaseManager.switchAccountSet(currentAccountSetId);
      initializeVouchers();
      initializeSubjects();
    }
  }, [currentAccountSetId, initializeVouchers, initializeSubjects]);

  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

---

## 八、实施步骤

### 阶段 1：创建新的数据库层
1. 创建 `src/lib/database/manager.ts` - DatabaseManager
2. 创建 `src/lib/database/service.ts` - DatabaseService
3. 重构 `src/lib/database/index.ts` - 统一导出

### 阶段 2：重构各 Store
1. 重构 `useVoucherStore.ts` - 移除 persist，添加 initialize
2. 重构 `useSubjectStore.ts`
3. 重构 `useDepartmentStore.ts`
4. 重构 `useFinancialProjectStore.ts`
5. 重构 `useCurrencyStore.ts`
6. 重构 `useVoucherTemplateStore.ts`
7. 重构 `useSummaryStore.ts`
8. 重构 `usePartnerStore.ts`

### 阶段 3：更新应用启动
1. 更新 `app/layout.tsx` - 添加初始化逻辑
2. 更新 `app/sets/page.tsx` - 添加账套切换逻辑

### 阶段 4：清理旧代码
1. 删除 `persistence-config.ts`
2. 删除 keyValues 表相关代码
3. 清理旧的 localStorage 数据

---

## 九、文件清单

### 新增文件
- `src/lib/database/manager.ts` - DatabaseManager
- `src/lib/database/service.ts` - DatabaseService

### 重构文件
- `src/lib/database/index.ts` - 统一导出
- `src/stores/useVoucherStore.ts`
- `src/stores/useSubjectStore.ts`
- `src/stores/useDepartmentStore.ts`
- `src/stores/useFinancialProjectStore.ts`
- `src/stores/useCurrencyStore.ts`
- `src/stores/useVoucherTemplateStore.ts`
- `src/stores/useSummaryStore.ts`
- `src/stores/usePartnerStore.ts`
- `src/app/layout.tsx`

### 删除文件
- `src/stores/persistence-config.ts`

---

## 十、总结

本重构方案的核心是：

- ✅ **简单直接**：移除 persist 中间件，架构清晰
- ✅ **查询性能好**：充分利用 IndexedDB 索引
- ✅ **数据隔离清晰**：accountSetId 字段 + 复合索引
- ✅ **易于维护**：职责明确，代码简单
- ✅ **测试友好**：测试数据可清空，无需迁移
