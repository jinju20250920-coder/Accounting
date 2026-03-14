# 数据库文档

## 数据库文档列表

| 文档 | 描述 | 版本 | 状态 | 最后更新 |
|------|------|------|------|----------|
| [001-data-model.md](./001-data-model.md) | 数据模型设计 | v1.0 | ✅ 已完成 | 2026-03-10 |
| [002-table-schemas.md](./002-table-schemas.md) | 表结构定义 | v1.0 | ✅ 已完成 | 2026-03-10 |
| [003-index-optimization.md](./003-index-optimization.md) | 索引优化策略 | v1.0 | 🔄 待审核 | 2026-03-10 |

## 数据存储架构

### 当前状态
- **存储方式**：浏览器本地存储（IndexedDB + localStorage）
- **数据同步**：无，仅本地使用
- **备份机制**：导出/导入JSON文件

### 未来计划
- **数据库**：PostgreSQL
- **ORM**：Prisma
- **备份策略**：定时自动备份

## 表结构清单

| 表名 | 用途 | 主键 | 状态 |
|------|------|------|------|
| vouchers | 凭证主表 | id | ✅ 已实现 |
| voucher_entries | 凭证分录表 | id | ✅ 已实现 |
| subjects | 科目表 | code | ✅ 已实现 |
| accounts | 账套表 | id | 🔄 待实现 |
| departments | 部门表 | id | 🔄 待实现 |
| projects | 项目表 | id | 🔄 待实现 |
| exchange_rates | 汇率表 | id | 🔄 待实现 |
| audit_logs | 审计日志表 | id | ✅ 已实现 |

## 数据模型关系

```
┌─────────────┐       ┌──────────────────┐
│   accounts  │       │     subjects      │
│  (账套表)    │       │     (科目表)      │
└──────┬──────┘       └─────────┬────────┘
       │                         │
       │ 1                       │ 1
       │                         │
       │ N                       │ N
       │                         │
┌──────▼───────────────┐  ┌──────▼─────────┐
│      vouchers        │  │  departments   │
│     (凭证表)          │  │   (部门表)      │
└──────┬───────────────┘  └────────────────┘
       │ 1
       │
       │ N
       │
┌──────▼───────────────┐
│   voucher_entries    │
│   (凭证分录表)        │
└──────────────────────┘
```

## 字段命名规范

### 命名原则
- 使用 snake_case：`voucher_no`, `create_time`
- 日期字段：以 `_date` 结尾：`voucher_date`
- 时间字段：以 `_time` 结尾：`create_time`
- 金额字段：以 `_amount` 结尾：`debit_amount`
- 布尔字段：以 `_flag` 结尾或使用 `is_` 前缀：`is_reversed`

### 数据类型规范

| 数据类型 | 说明 | 示例 |
|---------|------|------|
| VARCHAR(n) | 变长字符串 | `VARCHAR(50)` |
| TEXT | 长文本 | `description TEXT` |
| INTEGER | 整数 | `sequence_no INTEGER` |
| DECIMAL(p,s) | 精确小数 | `amount DECIMAL(18,2)` |
| DATE | 日期 | `voucher_date DATE` |
| DATETIME | 日期时间 | `create_time DATETIME` |
| BOOLEAN | 布尔值 | `is_deleted BOOLEAN` |

## 数据字典

### vouchers 表

| 字段名 | 类型 | 是否必填 | 说明 |
|--------|------|---------|------|
| id | UUID | 是 | 凭证ID |
| account_id | UUID | 是 | 所属账套ID |
| voucher_no | VARCHAR(50) | 是 | 凭证字号 |
| voucher_date | DATE | 是 | 凭证日期 |
| summary | TEXT | 否 | 摘要 |
| status | VARCHAR(20) | 是 | 状态：draft/review/posted/reversed |
| create_time | DATETIME | 是 | 创建时间 |
| update_time | DATETIME | 是 | 更新时间 |
| create_by | VARCHAR(50) | 否 | 创建人 |
| reverse_voucher_id | UUID | 否 | 冲销凭证ID |

### voucher_entries 表

| 字段名 | 类型 | 是否必填 | 说明 |
|--------|------|---------|------|
| id | UUID | 是 | 分录ID |
| voucher_id | UUID | 是 | 凭证ID |
| line_no | INTEGER | 是 | 分录行号 |
| subject_code | VARCHAR(20) | 是 | 科目代码 |
| subject_name | VARCHAR(100) | 是 | 科目名称 |
| summary | VARCHAR(500) | 否 | 摘要 |
| debit_amount | DECIMAL(18,2) | 否 | 借方金额 |
| credit_amount | DECIMAL(18,2) | 否 | 贷方金额 |
| direction | VARCHAR(10) | 是 | 借贷方向：debit/credit |
| department_id | VARCHAR(50) | 否 | 部门代码 |
| project_id | VARCHAR(50) | 否 | 项目代码 |
| auxiliary | JSON | 否 | 辅助核算数据 |

### subjects 表

| 字段名 | 类型 | 是否必填 | 说明 |
|--------|------|---------|------|
| code | VARCHAR(20) | 是 | 科目代码（主键） |
| name | VARCHAR(100) | 是 | 科目名称 |
| parent_code | VARCHAR(20) | 否 | 上级科目代码 |
| level | INTEGER | 是 | 科目级次：1-4 |
| direction | VARCHAR(10) | 是 | 借贷方向：debit/credit |
| is_leaf | BOOLEAN | 是 | 是否明细科目 |
| is_active | BOOLEAN | 是 | 是否启用 |

## 索引策略

### 必建索引
```sql
-- 凭证表索引
CREATE INDEX idx_vouchers_account ON vouchers(account_id);
CREATE INDEX idx_vouchers_date ON vouchers(voucher_date);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_no ON vouchers(voucher_no);

-- 凭证分录表索引
CREATE INDEX idx_entries_voucher ON voucher_entries(voucher_id);
CREATE INDEX idx_entries_subject ON voucher_entries(subject_code);
CREATE INDEX idx_entries_dept ON voucher_entries(department_id);

-- 科目表索引
CREATE INDEX idx_subjects_parent ON subjects(parent_code);
CREATE INDEX idx_subjects_level ON subjects(level);
```

## 数据迁移管理

### 变更脚本命名
```
migrations/
├── YYYYMMDD_HHMMSS_create_initial_tables.sql
├── YYYYMMDD_HHMMSS_add_department_field.sql
└── YYYYMMDD_HHMMSS_modify_amount_precision.sql
```

### 版本管理
- 每次表结构变更创建新的迁移脚本
- 迁移脚本按时间顺序执行
- 记录每个迁移脚本的执行状态

## 备份与恢复

### 备份策略
- 全量备份：每周一次
- 增量备份：每日一次
- 备份保留：最近30天

### 恢复流程
1. 确认备份文件完整性
2. 停止应用服务
3. 恢复数据库
4. 验证数据完整性
5. 启动应用服务

## 查看指南

1. **数据模型**：阅读 [001-data-model.md](./001-data-model.md)
2. **表结构**：参考 [002-table-schemas.md](./002-table-schemas.md)
3. **索引优化**：查看 [003-index-optimization.md](./003-index-optimization.md)

## 联系方式

- DBA：[待填写]
- 数据分析师：[待填写]

---

*数据库文档管理工具 - AI 财务助手项目*
*最后更新：2026-03-10*
