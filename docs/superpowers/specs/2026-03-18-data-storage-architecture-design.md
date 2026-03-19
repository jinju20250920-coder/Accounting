# 数据存储架构设计文档

**日期**：2026-03-18
**版本**：v2.0
**状态**：待审核

---

## 概述

本文档描述了 AI 财务 Assistant 系统的纯结构化 IndexedDB 数据存储架构设计，解决当前架构混乱问题，并为未来的订阅模式（账套计费）做好准备。

### 设计目标

1. **解决架构混乱**：移除 Zustand persist 中间件，统一使用结构化 IndexedDB
2. **多账套数据隔离**：每个账套使用独立的 IndexedDB 数据库
3. **数据持久化保证**：刷新页面数据不丢失
4. **订阅模式友好**：支持按账套数量计费

---

## 一、整体架构

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        UI 层 (React)                        │
│  (VoucherEntry, SubjectList, VoucherList, etc.)            │
└────────────────────────┬────────────────────────────────────┘
                         │ 读取/调用 actions
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Zustand Store 层 (内存状态)               │
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
              │      DatabaseManager (账套管理)   │
              │  - getCurrentDatabase()          │
              │  - switchAccountSet()            │
              │  - getScopedKey()                │
              └───────────────┬──────────────────┘
                              ↓
              ┌──────────────────────────────────┐
              │   DatabaseService (结构化操作)     │
              │  - saveVoucher()                 │
              │  - getVoucher()                  │
              │  - saveSubjects()                │
              │  - ... (结构化操作)              │
              │  (所有操作自动带账套前缀)         │
              └────────────────┬─────────────────┘
                               ↓
              ┌──────────────────────────────────┐
              │      IndexedDB (单一数据库)        │
              │    finance-assistant-db-v2        │
              │  ┌─────────────────────────────┐ │
              │  │ keyValues (带账套前缀)       │ │
              │  │   key: finance-vouchers:set_001│ │
              │  │   key: finance-subjects:set_001│ │
              │  │   ...                         │ │
              │  └─────────────────────────────┘ │
              └──────────────────────────────────┘
```

### 1.2 核心原则

1. **单数据源**：IndexedDB 是唯一真实数据源
2. **内存缓存**：Zustand Store 只做内存状态，用于 UI 响应
3. **同步更新**：数据变更时同时更新内存和 IndexedDB
4. **初始化加载**：应用启动时从 IndexedDB 加载数据到 Store
5. **账套隔离**：每个账套使用独立的 IndexedDB 数据库

---

## 二、多账套隔离策略

### 2.1 键前缀隔离方案（推荐）

采用键前缀方案实现账套隔离：

```typescript
// 存储键格式
const scopedKey = `${baseKey}:${accountSetId}`;

示例：
- finance-vouchers:default      // 默认账套
- finance-vouchers:set_001      // 账套 001
- finance-subjects:set_002      // 账套 002 的科目
```

### 2.2 优势

- **轻量级**：不需要创建多个数据库
- **浏览器限制少**：避免了 IndexedDB 数据库数量限制
- **易于管理**：删除账套只需删除对应键前缀的数据
- **查询优化**：可以通过索引进行跨账套查询
- **兼容性好**：与现有代码架构一致

### 2.3 全局元数据存储

账套列表等全局信息需要存储在无账套前缀的位置：

```typescript
// 全局配置存储
const GLOBAL_KEYS = {
  ACCOUNT_SETS: 'finance-account-sets',
  LICENSE_INFO: 'finance-license',
  APP_SETTINGS: 'finance-app-settings'
};
```

---

## 三、IndexedDB 数据库结构

每个账套数据库包含以下表：

### 3.1 数据库 Schema

```typescript
interface FinanceDB extends DBSchema {
  // 凭证表
  vouchers: {
    key: string;
    value: Voucher;
    indexes: {
      'by-date': string;
      'by-status': string;
      'by-voucherNo': string;
    };
  };

  // 分录表
  entries: {
    key: string;
    value: VoucherEntry;
    indexes: {
      'by-voucher': string;    // voucherId
      'by-subject': string;     // subjectCode
      'by-date': string;        // entry date
    };
  };

  // 科目表
  subjects: {
    key: string;
    value: Subject;
    indexes: {
      'by-code': string;
      'by-parent': string;
      'by-level': number;
    };
  };

  // 部门表
  departments: {
    key: string;
    value: Department;
    indexes: {
      'by-code': string;
      'by-parent': string;
    };
  };

  // 项目表
  projects: {
    key: string;
    value: Project;
    indexes: {
      'by-code': string;
      'by-parent': string;
    };
  };

  // 币别表
  currencies: {
    key: string;
    value: Currency;
    indexes: {
      'by-code': string;
    };
  };

  // 往来单位表
  partners: {
    key: string;
    value: Partner;
    indexes: {
      'by-code': string;
      'by-type': string;  // isCustomer/isSupplier
    };
  };

  // 凭证模板表
  voucherTemplates: {
    key: string;
    value: VoucherFullTemplate;
    indexes: {
      'by-name': string;
    };
  };

  // 常用摘要表
  commonSummaries: {
    key: string;
    value: CommonSummary;
    indexes: {
      'by-sortOrder': number;
    };
  };

  // 用户偏好表
  userPreferences: {
    key: string;
    value: UserPreference;
    indexes: {
      'by-summary': string;
      'by-subject': string;
    };
  };

  // 审计日志表
  auditLogs: {
    key: string;
    value: AuditLog;
    indexes: {
      'by-timestamp': number;
      'by-entityType': string;
    };
  };
}
```

---

## 四、核心组件设计

### 4.1 DatabaseManager（账套管理）

负责账套切换和数据库实例管理。

```typescript
class DatabaseManager {
  private currentAccountSetId: string | null = null;
  private databaseService: DatabaseService | null = null;

  // 获取当前账套的数据库实例
  async getCurrentDatabase(): Promise<DatabaseService>;

  // 切换账套
  async switchAccountSet(accountSetId: string): Promise<DatabaseService>;

  // 删除账套的数据库
  async deleteAccountSetDatabase(accountSetId: string): Promise<void>;
}
```

### 4.2 DatabaseService（单账套操作）

负责单个账套数据库的所有 CRUD 操作。

主要方法：
- `saveVoucher(voucher: Voucher): Promise<void>`
- `getVoucher(id: string): Promise<Voucher | undefined>`
- `getAllVouchers(): Promise<Voucher[]>`
- `deleteVoucher(id: string): Promise<void>`
- `saveSubjects(subjects: Subject[]): Promise<void>`
- `getAllSubjects(): Promise<Subject[]>`
- ... 其他表操作

### 4.3 Zustand Store 改造

**核心变更**：
- 移除 persist 中间件
- 添加 `initialize()` 方法在应用启动时加载数据
- 所有 actions 直接调用 `databaseManager` 进行持久化

**以 useVoucherStore 为例**：

```typescript
interface VoucherStore {
  // 内存状态
  vouchers: Voucher[];
  currentVoucher: Voucher | null;
  isLoading: boolean;
  error: string | null;

  // Actions（带持久化）
  initialize: () => Promise<void>;
  createVoucher: () => Promise<Voucher>;
  saveVoucher: (voucher: Voucher) => Promise<void>;
  deleteVoucher: (id: string) => Promise<void>;
  loadVoucher: (id: string) => Promise<Voucher | null>;
}
```

---

## 五、应用启动流程

### 5.1 启动初始化

```typescript
// src/app/layout.tsx
useEffect(() => {
  initializeVouchers();
  initializeSubjects();
  initializeDepartments();
  initializeProjects();
  initializeCurrencies();
  initializeTemplates();
  initializeSummaries();
  initializePartners();
}, []);
```

### 5.2 账套切换流程

```typescript
// 监听账套变化
useEffect(() => {
  if (currentAccountSetId) {
    initializeVouchers();
    initializeSubjects();
    // ... 重新加载所有数据
  }
}, [currentAccountSetId]);
```

---

## 六、数据迁移策略

### 6.1 测试环境迁移

由于是测试数据，可以直接清空旧数据，重新开始：

1. 删除旧的 localStorage 数据（`finance-*` 开头的键）
2. 删除旧的 IndexedDB 数据库（`finance-assistant-db`）
3. 应用使用新架构创建新的数据库

### 6.2 生产环境迁移策略（预留）

为未来生产环境准备的迁移方案：

1. **自动备份**：迁移前自动导出全部数据到 JSON 文件
2. **渐进迁移**：
   - 步骤 1：数据保持在原地，读取时优先从新架构读取
   - 步骤 2：后台异步迁移旧数据到新架构
   - 步骤 3：校验数据完整性
   - 步骤 4：切换到新架构
3. **回滚支持**：保留旧数据 7 天，支持快速回滚

---

## 七、事务处理和数据一致性

### 7.1 IndexedDB 事务使用

所有相关操作必须使用事务：

```typescript
// 凭证保存事务示例
async saveVoucherWithTransaction(voucher: Voucher) {
  const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');

  // 保存凭证
  await tx.objectStore('vouchers').put(voucher);

  // 保存分录
  for (const entry of voucher.entries) {
    await tx.objectStore('entries').put(entry);
  }

  await tx.done;
}
```

### 7.2 数据完整性校验

- 凭证保存前校验借贷平衡
- 科目引用校验
- 金额精度校验
- 外键引用完整性校验

---

## 八、数据备份和恢复

### 8.1 账套备份

```typescript
async exportAccountSetData(accountSetId: string): Promise<Blob> {
  const data = {
    accountSetId,
    exportDate: new Date().toISOString(),
    vouchers: await this.getVouchers(accountSetId),
    subjects: await this.getSubjects(accountSetId),
    // ... 其他数据
  };

  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}
```

### 8.2 删除前自动备份

删除账套前自动创建备份并提示用户下载。

### 8.3 账套归档

支持"归档"状态，账套数据保留但不可修改。

---

## 七、实施步骤

1. 重构 DatabaseService，支持多数据库实例
2. 实现 DatabaseManager 账套管理
3. 重构各 Store，移除 persist，添加 initialize 和持久化调用
4. 更新应用启动流程
5. 实现账套切换时的数据重新加载
6. 添加旧数据清理逻辑

---

## 八、优势总结

### 8.1 架构优势

- **清晰简单**：移除了 Zustand persist 的复杂性
- **职责明确**：Store 管理内存，Database 管理持久化
- **性能更好**：直接使用结构化查询和索引
- **易于测试**：各层可独立测试

### 8.2 业务优势

- **数据安全**：账套完全隔离，符合财务要求
- **订阅友好**：便于实现账套数量限制和计费
- **扩展性强**：未来支持云同步时，每个账套可独立同步

---

## 附录

### A. 受影响的文件清单

- `src/lib/database/index.ts` - 重构 DatabaseService
- `src/lib/database/manager.ts` - 新增 DatabaseManager
- `src/stores/useVoucherStore.ts` - 移除 persist，添加持久化
- `src/stores/useSubjectStore.ts` - 移除 persist，添加持久化
- `src/stores/useDepartmentStore.ts` - 移除 persist，添加持久化
- `src/stores/useFinancialProjectStore.ts` - 移除 persist，添加持久化
- `src/stores/useCurrencyStore.ts` - 移除 persist，添加持久化
- `src/stores/useVoucherTemplateStore.ts` - 移除 persist，添加持久化
- `src/stores/useSummaryStore.ts` - 移除 persist，添加持久化
- `src/stores/usePartnerStore.ts` - 移除 persist，添加持久化
- `src/app/layout.tsx` - 添加初始化逻辑
- `src/stores/persistence-config.ts` - 可以删除
