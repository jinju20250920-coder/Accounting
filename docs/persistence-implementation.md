# 数据持久化实现文档

## 概述

本项目已完整实现了基于 Zustand persist 中间件的数据持久化方案，包括版本控制、数据迁移、安全性增强和错误处理。

## 已实现功能

### 1. 核心持久化配置 (`persistence-config.ts`)

创建了统一的持久化配置模块，提供以下功能：

#### 版本控制
- `DATA_VERSIONS`: 定义数据版本（V1, V2, V3, CURRENT）
- 支持自动数据迁移

#### 数据迁移
- `createVersionedStorage()`: 创建带版本控制的存储
- 支持增量迁移（V1→V2→V3）

#### 存储工具
```typescript
storageUtils = {
  compressAuditLog: (records, maxRecords) // 压缩审计日志
  cleanupOldData: (data, cutoffDate) // 清理旧数据
  getStorageSize: () // 获取存储大小
  checkStorageSpace: (maxSizeMB) // 检查存储空间
}
```

### 2. 凭证 Store (`useVoucherStore.ts`)

增强的凭证管理功能：

#### 数据结构
```typescript
interface Voucher {
  id: string
  voucherNo: string
  date: string
  summary?: string
  entries: VoucherEntry[]
  status: 'draft' | 'review' | 'posted' | 'reversed'
  voucherType: 'general' | 'receipt' | 'payment' | 'transfer'
  createdBy: string
  createdAt: string
  updatedAt: string
}
```

#### 持久化数据
- `vouchers[]`: 所有历史凭证
- `subjectBalances[]`: 科目余额
- `settings`: 用户设置（自动平衡、默认科目等）

#### 新增功能
- `loadVoucher(id)`: 加载历史凭证
- `getVouchersByStatus(status)`: 按状态查询
- `getVouchersByDateRange(start, end)`: 按日期范围查询
- `getVoucherStatistics()`: 统计信息
- `calculateSubjectBalances()`: 计算科目余额
- `cleanupOldData(cutoffDate)`: 清理旧数据

### 3. 用户偏好 Store (`useUserPreferenceStore.ts`)

增强的 AI 学习功能：

#### 数据结构
```typescript
interface Preference {
  id: string
  summary: string // 摘要匹配模式
  subject: string
  subjectName?: string
  timestamp: number
  matchedCount: number // 匹配次数
  successRate: number // 成功率
}
```

#### 新增功能
- `updatePreferenceSuccess(id, success)`: 更新匹配成功率
- `exportPreferences()`: 导出偏好数据
- `importPreferences(data)`: 导入偏好数据
- `cleanupOldPreferences(days)`: 清理旧偏好

### 4. 审计 Store (`useAuditStore.ts`)

完整的审计追踪系统：

#### 数据结构
```typescript
interface AuditRecord {
  id: string
  timestamp: string
  userId: string
  userName: string
  operation: OperationType
  entityType: 'voucher' | 'subject' | 'account_set' | 'template' | 'system'
  entityId: string
  entityName?: string
  details: any
  oldValue?: any
  newValue?: any
  ipAddress: string
  userAgent: string
  result: 'success' | 'failed' | 'pending'
  errorMessage?: string
}
```

#### 新增功能
- `updateSettings(settings)`: 更新审计设置
- `cleanupExpiredRecords()`: 清理过期记录
- `searchRecords(keyword)`: 搜索审计记录
- `getRecentActivity(limit)`: 获取最近活动

#### 审计设置
```typescript
settings = {
  maxRecords: 5000,
  retentionDays: 365,
  enableExport: true
}
```

### 5. 设置 Store (`useSettingsStore.ts`)

全局应用设置：

#### 设置分类
- **用户设置**: 用户名、公司、会计年度、货币、日期格式
- **功能设置**: 自动平衡、自动保存、AI 功能等
- **界面设置**: 主题、语言、布局
- **数据设置**: 最大凭证数、审计记录数、保留天数
- **快捷键设置**: 自定义快捷键

#### 功能
- `updateSettings(settings)`: 更新设置
- `resetSettings()`: 重置默认设置
- `exportSettings()`: 导出设置
- `importSettings(data)`: 导入设置

### 6. 数据管理 Hooks (`hooks/useStorage.ts`)

#### Storage Monitor
```typescript
useStorageMonitor() => {
  storageSize: number
  storageStatus: {
    size: number
    maxSize: number
    usage: number // 百分比
    isOverLimit: boolean
  }
}
```

#### Data Backup
```typescript
useDataBackup() => {
  isBackingUp: boolean
  backupProgress: number
  createBackup(): Promise<Backup>
  restoreBackup(file): Promise<Backup>
}
```

#### Data Cleanup
```typescript
useDataCleanup() => {
  isCleaning: boolean
  cleanup(options): Promise<Results>
}
```

### 7. 全局错误处理 (`components/error-boundary.tsx`)

完整的错误边界组件：

#### 功能
- 捕获 React 组件错误
- 记录错误到审计日志
- 显示友好的错误提示
- 支持刷新页面、返回首页、复制错误信息
- 开发者模式显示详细堆栈

#### 使用方式
```tsx
<GlobalErrorProvider>
  <App />
</GlobalErrorProvider>
```

### 8. 增强的公式解释器 (`lib/enhanced-formula-interpreter.ts`)

安全性增强的公式计算：

#### 安全配置
```typescript
interface SecurityConfig {
  maxExpressionLength: number // 表达式最大长度
  allowedFunctions: string[] // 允许的函数
  allowedConstants: string[] // 允许的常数
  maxDecimalPlaces: number // 最大小数位数
  enableTrigonometry: boolean // 是否启用三角函数
  enableLogarithm: boolean // 是否启用对数
  enablePower: boolean // 是否启用幂运算
}
```

#### 安全措施
- 检测潜在危险字符
- 验证函数白名单
- 验证常数白名单
- 检查嵌套深度
- 过滤控制字符
- 禁止访问全局对象

#### 主要方法
```typescript
evaluate(formula, variables): FormulaResult
extractVariables(formula): string[]
batchEvaluate(formulas, variables): FormulaResult[]
validateSyntax(formula): { valid, error }
getDependencies(formula): string[]
```

## 存储键名

```typescript
STORAGE_KEYS = {
  VOUCHERS: 'finance-vouchers',
  PREFERENCES: 'finance-preferences',
  AUDIT: 'finance-audit',
  SETTINGS: 'finance-settings',
  ACCOUNT_SETS: 'finance-account-sets',
  SUBJECTS: 'finance-subjects',
  TEMPLATES: 'finance-templates'
}
```

## 数据迁移

### V1 → V2
- 添加 `status` 字段到凭证（默认 'draft'）
- 添加 `voucherType` 字段（默认 'general'）
- 添加 `result` 字段到审计记录（默认 'success'）

### V2 → V3
- 添加辅助核算字段到凭证分录
- 添加 `updatedAt` 字段到凭证
- 添加默认设置对象

## 使用示例

### 基本用法
```typescript
import { useVoucherStore } from '@/stores/useVoucherStore';

export default function MyComponent() {
  const {
    currentEntries,
    totalDebit,
    totalCredit,
    isBalanced,
    addEntry,
    updateEntry,
    saveVoucher
  } = useVoucherStore();

  return (
    <div>
      <button onClick={addEntry}>添加分录</button>
      <button onClick={() => saveVoucher('draft')}>保存凭证</button>
    </div>
  );
}
```

### 数据备份
```typescript
import { useDataBackup } from '@/hooks/useStorage';

export default function BackupPage() {
  const { isBackingUp, backupProgress, createBackup } = useDataBackup();

  return (
    <button
      onClick={() => createBackup()}
      disabled={isBackingUp}
    >
      {isBackingUp ? `备份中 ${backupProgress}%` : '创建备份'}
    </button>
  );
}
```

### 数据清理
```typescript
import { useDataCleanup } from '@/hooks/useStorage';

export default function CleanupPage() {
  const { isCleaning, cleanup } = useDataCleanup();

  return (
    <button
      onClick={() => cleanup({
        voucherBefore: '2024-01-01',
        preferencesOlderThan: 180 // 天数
      })}
      disabled={isCleaning}
    >
      清理旧数据
    </button>
  );
}
```

## 性能优化

1. **数据压缩**: 自动压缩审计日志和偏好数据
2. **分页加载**: 使用 `slice()` 限制加载数据量
3. **按需查询**: 提供多种查询方法，避免加载全部数据
4. **存储限制**: 自动删除最旧的数据

## 安全特性

1. **公式安全**: 白名单机制、危险字符检测
2. **数据验证**: 导入数据时验证格式
3. **错误隔离**: 错误边界防止错误扩散
4. **审计追踪**: 完整的操作日志记录

## 测试

已创建测试页面 `test-persistence.tsx` 用于验证持久化功能。

## 待完善

1. IndexedDB 集成（用于大量数据）
2. 云端同步支持
3. 自动备份调度
4. 更详细的迁移策略

## 文件清单

| 文件 | 说明 |
|------|------|
| `src/stores/persistence-config.ts` | 持久化配置和工具 |
| `src/stores/useVoucherStore.ts` | 凭证数据存储 |
| `src/stores/useUserPreferenceStore.ts` | 用户偏好存储 |
| `src/stores/useAuditStore.ts` | 审计日志存储 |
| `src/stores/useSettingsStore.ts` | 应用设置存储 |
| `src/hooks/useStorage.ts` | 存储管理 Hooks |
| `src/components/error-boundary.tsx` | 全局错误边界 |
| `src/lib/enhanced-formula-interpreter.ts` | 安全公式解释器 |
| `src/test-persistence.tsx` | 持久化测试页面 |
