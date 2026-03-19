# 数据存储架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构数据存储架构，使用纯结构化 IndexedDB + 单一 accountSetId 字段实现账套隔离，移除 Zustand persist 中间件和 keyValues 表。

**Architecture:** 使用 DatabaseManager 管理账套切换，DatabaseService 提供统一操作接口，所有结构化表都添加 accountSetId 字段，查询时自动过滤。

**Tech Stack:** IndexedDB (idb 库), Zustand (内存状态管理), React 19, TypeScript.

---

## 文件结构

### 新增文件
- `src/lib/database/manager.ts` - DatabaseManager 类
- `src/lib/database/service.ts` - DatabaseService 类

### 重构文件
- `src/lib/database/index.ts` - 统一导出
- `src/stores/useVoucherStore.ts` - 移除 persist 中间件
- `src/stores/useSubjectStore.ts`
- `src/stores/useDepartmentStore.ts`
- `src/stores/useFinancialProjectStore.ts`
- `src/stores/useCurrencyStore.ts`
- `src/stores/useVoucherTemplateStore.ts`
- `src/stores/useSummaryStore.ts`
- `src/stores/usePartnerStore.ts`
- `src/app/layout.tsx` - 添加初始化逻辑

### 删除文件
- `src/stores/persistence-config.ts`

---

## 任务分解

### 任务 1: 创建 DatabaseManager

**Files:**
- Create: `src/lib/database/manager.ts`
- Modify: `src/lib/database/index.ts:1-20`

- [ ] **Step 1: 编写 DatabaseManager 类**
- [ ] **Step 2: 更新 database/index.ts 导出**
- [ ] **Step 3: Commit**

---

### 任务 2: 创建 DatabaseService

**Files:**
- Create: `src/lib/database/service.ts`

- [ ] **Step 1: 编写 DatabaseService 类**
- [ ] **Step 2: Commit**

---

### 任务 3: 重构 useVoucherStore

**Files:**
- Modify: `src/stores/useVoucherStore.ts`

- [ ] **Step 1: 重构 useVoucherStore**
- [ ] **Step 2: Commit**

---

### 任务 4: 重构其他 Store

**Files:**
- Modify: `src/stores/useSubjectStore.ts`
- Modify: `src/stores/useDepartmentStore.ts`
- Modify: `src/stores/useFinancialProjectStore.ts`
- Modify: `src/stores/useCurrencyStore.ts`
- Modify: `src/stores/useVoucherTemplateStore.ts`
- Modify: `src/stores/useSummaryStore.ts`
- Modify: `src/stores/usePartnerStore.ts`

- [ ] **Step 1: 重构 useSubjectStore**
- [ ] **Step 2: 重构其他 Store...**
- [ ] **Step 3: Commit**

---

### 任务 5: 更新应用启动流程

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 更新 app/layout.tsx**
- [ ] **Step 2: Commit**

---

### 任务 6: 删除旧代码

**Files:**
- Delete: `src/stores/persistence-config.ts`

- [ ] **Step 1: 删除 persistence-config.ts**
- [ ] **Step 2: 清理其他文件中的导入**
- [ ] **Step 3: Commit**

---

### 任务 7: 测试

**Files:**
- Create: `tests/database.test.ts`

- [ ] **Step 1: 编写数据库测试**
- [ ] **Step 2: 运行测试**
- [ ] **Step 3: Commit**
