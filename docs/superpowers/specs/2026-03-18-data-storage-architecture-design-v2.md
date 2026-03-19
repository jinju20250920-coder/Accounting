# 数据存储架构重构设计文档

**日期**：2026-03-18
**版本**：v2.0（重构方案）
**状态**：待审核
**定位**：这是对当前架构的重构方案，不是从零设计

---

## 概述

当前项目存在**架构混杂**问题：同时使用了两种存储方式：

1. **Zustand persist + keyValues 表**：简单，开发效率高，但查询性能差
2. **IndexedDB 结构化表**：查询性能好，但未被充分利用

本方案的目标是**统一架构**，采用混合策略：

**核心原则**：
- ✅ **保留键前缀账套隔离**：现有方案轻量且管理简单
- ✅ **保留 persist 中间件**：提供内存缓存，提升读取速度
- ✅ **充分利用 IndexedDB 结构化查询**：优化复杂查询性能
- ✅ **统一架构描述**：清晰说明各组件关系

---

## 一、现状分析

### 1.1 当前架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        UI 层 (React)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ 读取/调用 actions
                         ↓
┌─────────────────────────────────────────────────────────────┐
│            Zustand Store 层 (内存状态 + persist)            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐│
│  │ useVoucherStore │  │ useSubjectStore │  │ use...Store ││
│  │  - 内存状态      │  │  - 内存状态      │  │  - 内存状态  ││
│  │  - actions      │  │  - actions      │  │  - actions   ││
│  │  - persist 中间件 │  - persist 中间件   - persist 中间件 │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘│
└───────────┼────────────────────┼──────────────────────┼───────┘
            │ 调用               │ 调用                │ 调用
            └────────────────────┴──────────────────────┘
                                 ↓
              ┌──────────────────────────────────┐
              │    persistence-config.ts         │
              │  - createAccountSetStorage()     │
              │  - getAccountSetScopedKey()      │
              │  - createIndexedDBStorage()      │
              └────────────────┬─────────────────┘
                               ↓
              ┌──────────────────────────────────┐
              │       DatabaseService            │
              │  - 通用 keyValues 操作           │
              │  - 结构化 vouchers/entries 操作   │
              └────────────────┬─────────────────┘
                               ↓
              ┌──────────────────────────────────┐
              │         IndexedDB                │
              │  ┌───────────────────────────┐  │
              │  │ keyValues (通用存储)        │  │
              │  │   key: finance-vouchers:set_001│ │
              │  │   key: finance-subjects:set_001│ │
              │  └───────────────────────────┘  │
              │  ┌───────────────────────────┐  │
              │  │ vouchers (by-date, status)│  │
              │  │ entries (by-voucher)      │  │
              │  │ subjects (by-code, parent)│  │
              │  │ departments, projects,... │  │
              │  └───────────────────────────┘  │
              └──────────────────────────────────┘
```

### 1.2 问题列表

| 问题 | 现象 | 影响 |
|-----|-----|-----|
| **架构混杂** | keyValues 表与结构化表共存 | 查询优化困难 |
| **查询性能差** | 所有查询都是全表扫描 | 大数据量下慢 |
| **代码重复** | 同一操作有两种实现方式 | 维护成本高 |
| **元数据混乱** | 文档与代码描述不一致 | 理解困难 |

---

## 二、重构目标架构

### 2.1 目标架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        UI 层 (React)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ 读取/调用 actions
                         ↓
┌─────────────────────────────────────────────────────────────┐
│            Zustand Store 层 (内存状态 + persist)            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐│
│  │ useVoucherStore │  │ useSubjectStore │  │ use...Store ││
│  │  - 内存状态      │  │  - 内存状态      │  │  - 内存状态  ││
│  │  - actions      │  │  - actions      │  │  - actions   ││
│  │  - persist 中间件 │  - persist 中间件   - persist 中间件 │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘│
└───────────┼────────────────────┼──────────────────────┼───────┘
            │ 调用               │ 调用                │ 调用
            └────────────────────┴──────────────────────┘
                                 ↓
              ┌──────────────────────────────────┐
              │      Store Actions (统一接口)    │
              │  - 简单操作走 keyValues 存储      │
              │  - 复杂查询走结构化表            │
              └────────────────┬─────────────────┘
                               ↓
              ┌──────────────────────────────────┐
              │    persistence-config.ts         │
              │  - getAccountSetScopedKey()      │
              │  - ScopedIndexedDBStorage        │
              └────────────────┬─────────────────┘
                               ↓
              ┌──────────────────────────────────┐
              │       DatabaseService            │
              │  - 通用 keyValues 操作           │
              │  - 结构化 vouchers/entries 操作   │
              └────────────────┬─────────────────┘
                               ↓
              ┌──────────────────────────────────┐
              │         IndexedDB                │
              │  ┌───────────────────────────┐  │
              │  │ keyValues (简单存储)        │  │
              │  │   finance-vouchers:set_001│  │
              │  └───────────────────────────┘  │
              │  ┌───────────────────────────┐  │
              │  │ vouchers (by-date, status)│  │
              │  │ entries (by-voucher)      │  │
              │  │ subjects (by-code, parent)│  │
              │  │ departments, projects,... │  │
              │  └───────────────────────────┘  │
              └──────────────────────────────────┘
```

### 2.2 各组件职责

#### 2.2.1 Zustand Store 层

**职责**：
- 管理内存状态（响应式）
- 提供 actions 接口
- 自动持久化到 IndexedDB（通过 persist）
- 支持批量操作和状态快照

**关键改进**：
- 统一命名：`voucherStore.vouchers` 而非 `voucherStore.state.vouchers`
- 简化 API：`getAllVouchers()` 而非 `get().vouchers`

#### 2.2.2 ScopedIndexedDBStorage（统一存储适配器）

**职责**：
- 处理键前缀账套隔离
- 路由到对应的存储方式
- 提供统一的存储接口

```typescript
class ScopedIndexedDBStorage {
  async getItem(key: string): Promise<string | null> {
    const scopedKey = getAccountSetScopedKey(key);

    if (isSimpleQuery(key)) {
      // 简单查询走 keyValues 表（速度快）
      return this.getKeyValue(scopedKey);
    }

    // 复杂查询走结构化表（使用索引）
    return this.getStructured(scopedKey);
  }

  async setItem(key: string, value: string): Promise<void> {
    const scopedKey = getAccountSetScopedKey(key);

    // 同时写入 keyValues 和结构化表（数据一致性）
    await Promise.all([
      this.setKeyValue(scopedKey, value),
      this.setStructured(scopedKey, value)
    ]);
  }

  async removeItem(key: string): Promise<void> {
    const scopedKey = getAccountSetScopedKey(key);
    await Promise.all([
      this.deleteKeyValue(scopedKey),
      this.deleteStructured(scopedKey)
    ]);
  }
}
```

#### 2.2.3 数据一致性策略

**关键问题**：同时写入 keyValues 和结构化表可能导致不一致。

**解决方案**：使用 IndexedDB 事务：

```typescript
async setItemWithTransaction(key: string, value: string) {
  const scopedKey = getAccountSetScopedKey(key);
  const tx = this.db.transaction(['keyValues', 'vouchers', 'entries'], 'readwrite');

  // 写入 keyValues 表（保持与 persist 中间件兼容性）
  await tx.objectStore('keyValues').put({
    id: scopedKey,
    key: scopedKey,
    value: JSON.parse(value),
    timestamp: Date.now()
  });

  // 解析数据并写入结构化表（优化查询）
  if (key.includes('vouchers')) {
    const vouchers = JSON.parse(value).state?.vouchers;
    if (vouchers) {
      const voucherStore = tx.objectStore('vouchers');
      const entryStore = tx.objectStore('entries');

      for (const voucher of vouchers) {
        await voucherStore.put(voucher);
        for (const entry of voucher.entries) {
          await entryStore.put(entry);
        }
      }
    }
  }

  await tx.complete; // 正确的事务完成方法
}
```

---

## 二、多账套隔离策略（保留现有方案）

### 2.1 键前缀方案

使用已实现的 `getAccountSetScopedKey()` 方案：

```typescript
// src/stores/persistence-config.ts
export function getAccountSetScopedKey(baseKey: string, accountSetId: string | null): string {
  if (!accountSetId) {
    return `${baseKey}:default`;
  }
  return `${baseKey}:${accountSetId}`;
}
```

**优点**：
- ✅ 轻量级，管理简单
- ✅ 避免浏览器 IndexedDB 数量限制
- ✅ 跨账套查询通过遍历前缀实现
- ✅ 删除账套只需删除对应前缀的 keyValues 记录

---

## 三、IndexedDB 数据库结构

### 3.1 数据库 Schema（与现有实现一致）

```typescript
interface FinanceDB extends DBSchema {
  // 通用键值存储（Zustand persist 使用）
  keyValues: {
    key: string;
    value: {
      id: string;
      key: string;
      value: any;
      timestamp: number;
    };
    indexes: {
      'by-key': string;
    };
  };

  // 凭证表（结构化存储）
  vouchers: {
    key: string;
    value: Voucher;
    indexes: {
      'by-date': string;
      'by-status': string;
      'by-voucherNo': string;
    };
  };

  // 分录表（结构化存储）
  entries: {
    key: string;
    value: VoucherEntry;
    indexes: {
      'by-voucher': string;
      'by-subject': string;
      'by-date': string;
    };
  };

  // 科目表（结构化存储）
  subjects: {
    key: string;
    value: Subject;
    indexes: {
      'by-code': string;
      'by-parent': string;
      'by-level': number;
    };
  };

  // 部门表（结构化存储）
  departments: {
    key: string;
    value: Department;
    indexes: {
      'by-code': string;
      'by-parent': string;
    };
  };

  // 项目表（结构化存储）
  projects: {
    key: string;
    value: Project;
    indexes: {
      'by-code': string;
      'by-parent': string;
    };
  };

  // 其他表（根据需要添加）
  partners: {
    key: string;
    value: Partner;
    indexes: {
      'by-code': string;
      'by-type': string;
    };
  };
}
```

---

## 四、重构实施步骤

### 4.1 阶段一：统一架构描述（立即）

1. 更新文档，明确"现状" vs "目标"
2. 统一代码注释和架构说明
3. 修复章节编号和代码示例错误

### 4.2 阶段二：优化 persist 中间件（1周）

1. 重构 `ScopedIndexedDBStorage`，支持路由到不同存储方式
2. 实现事务一致性保证
3. 优化 keyValues 表查询性能

### 4.3 阶段三：充分利用结构化表（2周）

1. 为复杂查询添加 IndexedDB 结构化查询方法
2. 在需要高性能查询的页面使用结构化表
3. 优化大数据量场景的查询速度

### 4.4 阶段四：数据同步和验证（1周）

1. 添加后台异步同步 keyValues 到结构化表
2. 实现数据完整性校验
3. 添加错误恢复机制

---

## 五、风险评估和缓解措施

### 5.1 数据一致性风险

**风险**：同时写入两个位置可能导致数据不一致。

**缓解**：
- 使用 IndexedDB 事务保证原子性
- 添加定期数据一致性检查
- 提供数据修复工具

### 5.2 性能风险

**风险**：事务可能会降低写入速度。

**缓解**：
- 简单操作仍走 keyValues 表（无事务）
- 复杂操作使用事务
- 后台异步同步，不影响主线程

### 5.3 数据迁移风险

**风险**：现有数据需要同步到新架构。

**缓解**：
- 开发时保留原有存储方式
- 运行时检测并自动迁移
- 提供数据备份和恢复工具

---

## 六、优势总结

### 6.1 架构优势

- **统一简单**：架构描述清晰，开发效率高
- **性能平衡**：简单查询快，复杂查询也有优化
- **向后兼容**：不破坏现有功能
- **易于维护**：组件职责明确，调试简单

### 6.2 业务优势

- **查询性能提升**：复杂报表查询更快速
- **开发效率保持**：保留 persist 中间件的便捷性
- **数据安全保证**：事务提供一致性保证
- **可扩展性好**：为未来的功能添加奠定基础

---

## 七、架构一致性检查

### 7.1 与 CLAUDE.md 一致性

| 项目 | CLAUDE.md 要求 | 本方案 | 状态 |
|-----|--------------|---------|------|
| 状态机 | ✅ 要求实现 | ✅ 保持现有实现 | ✓ |
| AI 智能匹配 | ✅ 要求实现 | ✅ 保持现有实现 | ✓ |
| 模板引擎 | ✅ 要求实现 | ✅ 保持现有实现 | ✓ |
| Zustand | ✅ 作为状态管理 | ✅ 保留 persist 中间件 | ✓ |
| 数据持久化 | ✅ 使用 IndexedDB | ✅ 使用 IndexedDB + persist | ✓ |

---

## 八、技术规范

### 8.1 文件结构

```
src/
├── stores/
│   ├── persistence-config.ts      # 存储配置和适配器
│   ├── useVoucherStore.ts         # 凭证状态管理
│   ├── useSubjectStore.ts         # 科目状态管理
│   ├── ...
├── lib/
│   ├── database/
│   │   ├── index.ts              # 数据库连接和管理
│   │   ├── service.ts            # 数据库操作服务
│   │   └── adapter.ts            # 统一存储适配器
```

### 8.2 命名规范

```typescript
// 统一的存储键前缀
const ACCOUNT_SET_PREFIX = `${baseKey}:${accountSetId}`;

// 示例：
const VOUCHER_KEY = `finance-vouchers:${accountSetId}`;
const SUBJECT_KEY = `finance-subjects:${accountSetId}`;

// 数据库表名使用复数形式
interface FinanceDB {
  keyValues: ...;
  vouchers: ...;
  entries: ...;
  subjects: ...;
}
```

---

## 九、测试策略

### 9.1 单元测试

- 测试存储适配器的路由逻辑
- 测试 keyValues 和结构化表的一致性
- 测试事务的原子性

### 9.2 集成测试

- 测试整个数据流程：UI → Store → Storage → IndexedDB
- 测试账套切换时的数据隔离
- 测试大量数据场景的性能

### 9.3 迁移测试

- 测试从旧架构到新架构的迁移
- 测试数据一致性验证
- 测试回滚方案

---

## 十、回滚方案

如果重构出现问题，可回滚到当前架构：

1. 恢复原始的 `persistence-config.ts`
2. 重新部署应用
3. 运行数据修复工具
4. 监控系统运行情况

---

## 十一、总结

本重构方案的核心是**统一架构**，采用混合策略：

- ✅ **保留现有方案的优点**：键前缀隔离、persist 中间件的便捷性
- ✅ **解决查询性能问题**：充分利用 IndexedDB 结构化查询
- ✅ **统一架构描述**：清晰说明各组件关系
- ✅ **风险可控**：分阶段实施，有回滚方案

这是一个**渐进式重构**，不会破坏现有功能，而是逐步优化。
