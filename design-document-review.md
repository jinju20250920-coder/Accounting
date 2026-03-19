# 数据存储架构设计文档 - 审阅报告

**文档路径**: docs/superpowers/specs/2026-03-18-data-storage-architecture-design.md
**审阅日期**: 2026-03-18

---

## 一、总体评价

设计文档整体思路清晰，目标明确，提出了从 Zustand persist 中间件向纯 IndexedDB 存储迁移的方案。然而，文档存在多处**技术不一致、架构描述混乱、与现有代码实现脱节**的问题。

---

## 二、详细问题清单

### 🔴 严重问题

#### 1. **架构描述自相矛盾**

**位置**: 文档多个章节

**问题描述**:
- 概述部分（第16行）说："每个账套使用独立的 IndexedDB 数据库"
- 架构图部分（第61-69行）显示单一数据库 + 键前缀
- 2.1节（第84-96行）又推荐键前缀方案

**实际情况**: 现有代码（persistence-config.ts）已经实现了键前缀方案，无需重新设计

**建议**: 统一架构描述，明确说明使用**单一数据库 + 键前缀**方案

---

#### 2. **数据库 Schema 与现有实现不一致**

**位置**: 3.1节（第127-239行）

**问题描述**:
设计文档中的 Schema 与 `src/lib/database/index.ts` 中的现有实现存在重大差异：

| 对象存储 | 设计文档 | 现有实现 | 状态 |
|---------|---------|---------|------|
| currencies | ✅ 有 | ❌ 无 | 缺失 |
| partners | ✅ 有 | ❌ 无 | 缺失 |
| voucherTemplates | ✅ 有 | ❌ 无 | 缺失 |
| commonSummaries | ✅ 有 | ❌ 无 | 缺失 |
| userPreferences | ✅ 有 | ❌ preferences | 命名不同 |
| departments | ✅ 有 | ✅ 有 | ✓ |
| projects | ✅ 有 | ✅ 有 | ✓ |
| keyValues | ❌ 无 | ✅ 有 | 设计遗漏 |

**建议**:
- 更新设计文档以反映现有实现
- 或明确说明这是未来的重构目标

---

#### 3. **与现有代码架构严重脱节**

**位置**: 整个文档

**问题描述**:
设计文档似乎完全忽略了项目中**已有的实现**：

1. **persistence-config.ts** - 已实现：
   - ✅ 键前缀隔离（`getAccountSetScopedKey`）
   - ✅ 多账套支持（`createAccountSetStorage`）
   - ✅ IndexedDB 集成（`createIndexedDBStorage`）

2. **database/index.ts** - 已实现：
   - ✅ 结构化数据库操作
   - ✅ 事务支持
   - ✅ 数据导出/导入

3. **各 Store 文件** - 已使用 persist 中间件

**建议**: 重新定位文档为"**重构方案**"而非"新设计"，明确说明：
- 哪些是现有的
- 哪些需要修改
- 迁移路径是什么

---

#### 4. **键前缀格式不一致**

**位置**: 2.1节（第88-96行）

**问题描述**:
- 文档示例: `finance-vouchers:set_001`
- 现有代码: `${baseKey}:${accountSetId}`（如 `finance-vouchers:default`）
- 现有 keyValues 存储: `key-${key}` 格式

**建议**: 统一键格式规范，明确说明：
```
格式: {namespace}:{type}:{accountSetId}
示例: finance:vouchers:set_001
```

---

### 🟡 中等问题

#### 5. **章节编号重复**

**位置**: 文档末尾

**问题**:
- 第七章出现两次：
  - 第363行: "七、事务处理和数据一致性"
  - 第423行: "七、实施步骤"
- 第八章也出现两次：
  - 第395行: "八、数据备份和恢复"
  - 第434行: "八、优势总结"

**建议**: 重新编号章节

---

#### 6. **事务处理代码示例错误**

**位置**: 7.1节（第371-383行）

**问题代码**:
```typescript
async saveVoucherWithTransaction(voucher: Voucher) {
  const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');
  await tx.objectStore('vouchers').put(voucher);
  for (const entry of voucher.entries) {
    await tx.objectStore('entries').put(entry);
  }
  await tx.done;  // ❌ idb 库使用 tx.complete，不是 tx.done
}
```

**正确代码**（参考现有实现）:
```typescript
async saveVoucherWithTransaction(voucher: Voucher) {
  const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');
  await tx.objectStore('vouchers').put(voucher);
  for (const entry of voucher.entries) {
    await tx.objectStore('entries').put(entry);
  }
  await tx.complete;  // ✅
}
```

**建议**: 修正代码示例，参考 `src/lib/database/index.ts` 第316-321行的正确用法

---

#### 7. **缺少数据迁移详细方案**

**位置**: 第六章（第339-361行）

**问题**:
- 6.1节说"测试环境可以直接清空旧数据"
- 但项目中已经有真实的测试数据和用户使用

**实际风险**:
- localStorage 中有旧数据
- IndexedDB 中已有数据
- 多个账套的数据需要迁移

**建议**:
提供详细的迁移方案：
```typescript
// 迁移步骤示例
1. 备份现有数据
2. 读取旧格式数据
3. 转换为新格式
4. 写入新格式
5. 验证完整性
6. 清理旧数据（可选）
```

---

#### 8. **性能问题考虑不足**

**位置**: 整个文档

**问题**:
- 文档提到"移除 Zustand persist 中间件"，但没有考虑：
  - Zustand persist 提供了**内存缓存**，读取速度快
  - 完全绕过会导致每次都从 IndexedDB 读取，性能下降
  - 大额凭证列表加载会很慢

**现有代码的做法**（更好）:
- Zustand 作为内存缓存
- persist 中间件异步持久化到 IndexedDB
- 两者结合，兼顾速度和持久化

**建议**:
重新考虑架构，采用**混合方案**：
```
UI ↔ Zustand Store (内存缓存)
         ↓↑ 异步同步
    IndexedDB (持久化)
```

---

### 🟢 轻微问题

#### 9. **缺少错误处理策略**

**位置**: 事务处理部分

**建议**: 添加错误处理和回滚策略：
```typescript
try {
  const tx = this.db.transaction(['vouchers', 'entries'], 'readwrite');
  // ... 操作
  await tx.complete;
} catch (error) {
  // 自动回滚，记录日志
  console.error('Transaction failed:', error);
  throw error;
}
```

---

#### 10. **缺少安全考虑**

**位置**: 整个文档

**建议**: 添加：
- 数据加密（敏感财务数据）
- 访问控制（账套级权限）
- 操作审计日志（已在 schema 中，但需要说明）

---

#### 11. **代码示例不完整**

**位置**: 4.3节 Zustand Store 改造

**问题**: 只有接口定义，没有实现示例

**建议**: 添加简单的实现示例：
```typescript
const useVoucherStore = create<VoucherStore>((set, get) => ({
  vouchers: [],
  initialize: async () => {
    const vouchers = await databaseService.getAllVouchers();
    set({ vouchers });
  },
  saveVoucher: async (voucher) => {
    await databaseService.saveVoucher(voucher);
    set((state) => ({
      vouchers: state.vouchers.map(v =>
        v.id === voucher.id ? voucher : v
      )
    }));
  }
}));
```

---

## 三、架构一致性检查

### 与 CLAUDE.md 的一致性

| 项目 | CLAUDE.md 要求 | 设计文档 | 状态 |
|-----|--------------|---------|------|
| 状态机 | ✅ 要求实现 | ❌ 未提及 | 缺失 |
| AI 智能匹配 | ✅ 要求实现 | ❌ 未提及 | 缺失 |
| 模板引擎 | ✅ 要求实现 | ❌ 未提及 | 缺失 |
| Zustand | ✅ 作为状态管理 | ⚠️ 建议移除 persist | 有分歧 |

**建议**: 设计文档应与 CLAUDE.md 保持一致

---

### 与现有代码的一致性

| 模块 | 现有实现 | 设计文档 | 一致性 |
|-----|---------|---------|--------|
| 多账套隔离 | 键前缀 | 键前缀（推荐） | ✅ |
| 数据库 | 单一数据库 | 单一数据库 | ✅ |
| Zustand | 使用 persist | 建议移除 persist | ❌ |
| keyValues 表 | 有 | 设计中缺失 | ❌ |

---

## 四、安全问题检查

| 检查项 | 状态 | 说明 |
|-------|------|------|
| SQL 注入 | ✅ 无风险 | IndexedDB 不使用 SQL |
| XSS | ⚠️ 需注意 | 导入数据时需验证 |
| 数据加密 | ❌ 缺失 | 财务数据应考虑加密 |
| 访问控制 | ❌ 缺失 | 账套级权限未提及 |
| 审计日志 | ⚠️ 部分 | Schema 中有，但使用未说明 |

---

## 五、性能问题检查

| 检查项 | 状态 | 说明 |
|-------|------|------|
| 内存缓存 | ❌ 有风险 | 建议移除 Zustand persist 可能导致性能下降 |
| 批量操作 | ⚠️ 需注意 | 大数量凭证导入应使用游标 |
| 索引使用 | ✅ 良好 | Schema 中定义了适当的索引 |
| 初始化加载 | ❌ 未优化 | 应用启动时加载所有数据可能慢 |

**建议**: 保持 Zustand persist 作为内存缓存，IndexedDB 作为持久化层

---

## 六、修改建议优先级

### 🔴 立即修改（阻塞实施）
1. 统一架构描述，明确使用"单一数据库 + 键前缀"
2. 修正章节编号重复问题
3. 修正事务代码示例（tx.done → tx.complete）
4. 明确文档定位：是"重构方案"还是"新设计"

### 🟡 尽快修改
5. 更新 Schema 以反映现有实现
6. 添加详细的数据迁移方案
7. 重新考虑性能架构（保留内存缓存）
8. 添加错误处理策略

### 🟢 后续完善
9. 添加安全考虑
10. 补充完整的代码示例
11. 添加测试策略
12. 添加回滚方案

---

## 七、总结

这份设计文档有良好的**目标方向**（统一使用 IndexedDB），但在以下方面需要重大改进：

1. **与现实脱节** - 忽略了项目中已有的大量实现
2. **架构描述混乱** - 多个地方描述不一致
3. **代码示例错误** - 事务处理代码无法直接使用
4. **性能考虑不足** - 建议的架构可能导致性能回退
5. **缺少迁移方案** - 从现有架构迁移的路径不清晰

**建议**:
1. 首先对现有代码进行全面梳理
2. 明确文档定位为"**重构方案**"
3. 详细对比"现状" vs "目标"
4. 提供清晰的迁移步骤和回滚方案
5. 保持与 CLAUDE.md 的一致性

---

**审阅者**: AI Assistant
**审阅日期**: 2026-03-18
