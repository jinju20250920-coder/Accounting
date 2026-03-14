# AI 财务助手 - 数据模型设计

## 1. 数据模型概述

### 1.1 设计原则
- **标准化**：遵循数据库设计范式
- **可扩展**：预留扩展字段和关联
- **性能优化**：合理设置索引
- **数据安全**：敏感数据加密

### 1.2 数据存储策略
- **当前阶段**：使用浏览器本地存储（IndexedDB + localStorage）
- **未来阶段**：迁移到PostgreSQL数据库
- **同步策略**：本地优先，云端备份

## 2. 核心实体关系

### 2.1 ER图

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│   accounts  │       │     vouchers      │       │   subjects  │
│  (账套表)    │       │     (凭证表)      │       │   (科目表)   │
├─────────────┤       ├──────────────────┤       ├─────────────┤
│ id          │◄───────┤ id               │       │ code        │
│ name        │        │ account_id       │       │ name        │
│ start_date  │        │ voucher_no       │       │ parent_code  │
│ status      │        │ voucher_date     │       │ level       │
│ created_at  │        │ summary          │       │ direction   │
│ updated_at  │        │ status           │       │ is_leaf     │
└──────┬──────┘        │ create_time      │       │ is_active   │
       │ 1              │ update_time      │       └──────┬──────┘
       │ N              │ create_by        │            │ 1
       │                │ reverse_voucher_id│            │ N
       │                └──────────────────┘            │
       │                                              │
┌──────▼───────────────────────┐                      │
│    voucher_entries           │                      │
│   (凭证分录表)                │                      │
├───────────────────────────────┤                      │
│ id                           │                      │
│ voucher_id                   │                      │
│ line_no                      │                      │
│ subject_code                 │─────┐                 │
│ subject_name                 │     │                 │
│ debit_amount                 │     │                 │
│ credit_amount                │     ▼                 │
│ direction                    │┌─────────────┐       │
│ department_id                ││ departments │       │
│ project_id                   ││  (部门表)   │       │
│ auxiliary                    │└─────────────┘       │
└───────────────────────────────┘                      │
       │ 1                                             │
       │ N                                             │
       │                                               │
┌──────▼───────────────────────┐                      │
│      audit_logs              │                      │
│     (审计日志表)              │                      │
├───────────────────────────────┤                      │
│ id                           │                      │
│ entity_type                  │                      │
│ entity_id                    │                      │
│ action                       │                      │
│ old_data                     │                      │
│ new_data                     │                      │
│ created_by                   │                      │
│ created_at                   │                      │
└───────────────────────────────┘                      │
```

## 3. 实体详细设计

### 3.1 账套表 (accounts)

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL COMMENT '账套名称',
    code VARCHAR(50) UNIQUE NOT NULL COMMENT '账套代码',
    description TEXT COMMENT '账套描述',
    start_date DATE NOT NULL COMMENT '启用日期',
    fiscal_year INTEGER NOT NULL COMMENT '会计年度',
    fiscal_period VARCHAR(20) NOT NULL COMMENT '会计期间',
    currency VARCHAR(10) NOT NULL DEFAULT 'CNY' COMMENT '币种',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/inactive',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 字段说明
- **id**：主键，唯一标识
- **name**：账套名称，如"2024年度账套"
- **code**：账套代码，用于业务标识
- **start_date**：账套启用日期
- **fiscal_year**：会计年度
- **fiscal_period**：会计期间，如"01-12"
- **currency**：币种，默认人民币
- **status**：状态标识

### 3.2 科目表 (subjects)

```sql
CREATE TABLE subjects (
    code VARCHAR(20) PRIMARY KEY COMMENT '科目代码',
    name VARCHAR(100) NOT NULL COMMENT '科目名称',
    parent_code VARCHAR(20) COMMENT '上级科目代码',
    level INTEGER NOT NULL DEFAULT 1 COMMENT '科目级次：1-4',
    direction VARCHAR(10) NOT NULL DEFAULT 'debit' COMMENT '借贷方向：debit/credit',
    is_leaf BOOLEAN NOT NULL DEFAULT true COMMENT '是否明细科目',
    is_active BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
    sort_order INTEGER DEFAULT 0 COMMENT '排序号',
    full_name VARCHAR(200) COMMENT '全路径名称',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_code) REFERENCES subjects(code)
);
```

#### 科目层级结构
```
1级科目：1001 - 现金
  └─ 2级科目：100101 - 人民币现金
      └─ 3级科目：10010101 - 库存现金
```

### 3.3 凭证表 (vouchers)

```sql
CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    voucher_no VARCHAR(50) NOT NULL COMMENT '凭证字号',
    voucher_date DATE NOT NULL COMMENT '凭证日期',
    summary TEXT COMMENT '摘要',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态：draft/review/posted/reversed',
    amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '凭证金额',
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    create_by VARCHAR(50) COMMENT '创建人',
    update_by VARCHAR(50) COMMENT '更新人',
    reverse_voucher_id UUID REFERENCES vouchers(id) COMMENT '冲销凭证ID',
    period VARCHAR(7) NOT NULL COMMENT '期间：YYYY-MM',
    is_system_generated BOOLEAN DEFAULT false COMMENT '是否系统生成',
    tags TEXT[] DEFAULT '{}' COMMENT '标签数组',
    INDEX idx_account_id (account_id),
    INDEX idx_voucher_date (voucher_date),
    INDEX idx_status (status),
    INDEX idx_period (period)
);
```

#### 凭证状态机
```
draft → review → posted → reversed
```

### 3.4 凭证分录表 (voucher_entries)

```sql
CREATE TABLE voucher_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id),
    line_no INTEGER NOT NULL COMMENT '分录行号',
    subject_code VARCHAR(20) NOT NULL REFERENCES subjects(code),
    subject_name VARCHAR(100) NOT NULL COMMENT '科目名称快照',
    summary VARCHAR(500) COMMENT '摘要',
    debit_amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '借方金额',
    credit_amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '贷方金额',
    direction VARCHAR(10) NOT NULL COMMENT '借贷方向',
    department_id VARCHAR(50) COMMENT '部门代码',
    project_id VARCHAR(50) COMMENT '项目代码',
    auxiliary JSONB DEFAULT '{}' COMMENT '辅助核算数据',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(voucher_id, line_no),
    INDEX idx_voucher_id (voucher_id),
    INDEX idx_subject_code (subject_code),
    INDEX idx_department_id (department_id)
);
```

### 3.5 部门表 (departments)

```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL COMMENT '部门代码',
    name VARCHAR(100) NOT NULL COMMENT '部门名称',
    parent_id UUID REFERENCES departments(id) COMMENT '上级部门ID',
    manager VARCHAR(50) COMMENT '负责人',
    phone VARCHAR(20) COMMENT '联系电话',
    email VARCHAR(100) COMMENT '邮箱',
    is_active BOOLEAN DEFAULT true COMMENT '是否启用',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 3.6 项目表 (projects)

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL COMMENT '项目代码',
    name VARCHAR(100) NOT NULL COMMENT '项目名称',
    type VARCHAR(50) COMMENT '项目类型',
    start_date DATE COMMENT '开始日期',
    end_date DATE COMMENT '结束日期',
    manager VARCHAR(50) COMMENT '负责人',
    budget DECIMAL(18,2) COMMENT '预算金额',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态',
    is_active BOOLEAN DEFAULT true COMMENT '是否启用',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 3.7 审计日志表 (audit_logs)

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL COMMENT '实体类型：voucher/subject/user',
    entity_id VARCHAR(50) NOT NULL COMMENT '实体ID',
    action VARCHAR(50) NOT NULL COMMENT '操作类型：create/update/delete',
    old_data JSONB COMMENT '旧数据',
    new_data JSONB COMMENT '新数据',
    created_by VARCHAR(50) NOT NULL COMMENT '操作人',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET COMMENT 'IP地址',
    user_agent TEXT COMMENT '用户代理'
);
```

## 4. 关键业务规则

### 4.1 凭证规则
1. **借贷平衡**：每张借方金额必须等于贷方金额
2. **日期有效性**：凭证日期不能超过会计期间
3. **科目有效性**：只能使用启用状态的非叶子科目
4. **行号唯一**：同一张凭证的分录行号不能重复

### 4.2 科目规则
1. **层级约束**：4级科目结构，必须逐级创建
2. **方向约束**：科目借贷方向决定分录方向
3. **删除限制**：已使用过的科目不能删除

### 4.3 账套规则
1. **期间管理**：凭证日期必须属于当前账套期间
2. **数据隔离**：不同账套数据完全隔离
3. **年度结转**：年末必须进行结转操作

## 5. 数据字典

### 5.1 状态枚举

#### 凭证状态
- `draft`：草稿
- `review`：审核中
- `posted`：已记账
- `reversed`：已冲销

#### 科目方向
- `debit`：借方
- `credit`：贷方

#### 部门/项目状态
- `active`：启用
- `inactive`：停用
- `archived`：归档

### 5.2 金额字段规范
- 所有金额字段使用 `DECIMAL(18,2)`
- 最小单位：分
- 显示格式：#,##0.00

### 5.3 日期时间格式
- 数据库存储：ISO 8601格式
- 显示格式：YYYY-MM-DD
- 时间显示：HH:mm:ss

## 6. 数据安全

### 6.1 敏感数据加密
- 用户密码：使用bcrypt加密
- 凭证数据：本地存储时使用AES加密
- 审计日志：记录操作人IP和用户代理

### 6.2 数据备份策略
1. **自动备份**：每日凌晨自动备份
2. **增量备份**：只备份变更数据
3. **异地备份**：备份存储在不同地理位置
4. **版本管理**：保留最近30个备份版本

### 6.3 数据恢复
1. **点对点恢复**：恢复到指定时间点
2. **验证机制**：恢复后数据完整性验证
3. **恢复演练**：定期进行恢复演练

## 7. 性能优化

### 7.1 索引策略
- 主键索引：所有表都设置主键索引
- 外键索引：所有外键字段建立索引
- 复合索引：根据查询需求建立复合索引

### 7.2 查询优化
1. **分页查询**：大数据量查询使用分页
2. **延迟加载**：非必要数据延迟加载
3. **缓存策略**：热点数据使用缓存

### 7.3 数据归档
- 凭证数据：超过5年的数据迁移到归档表
- 日志数据：超过1年的日志数据压缩存储
- 定期清理：定期清理无用数据

---

## 附录

### A. SQL脚本示例
```sql
-- 创建科目索引
CREATE INDEX idx_subjects_full_path ON subjects(full_name);

-- 创建凭证复合索引
CREATE INDEX idx_voucher_account_period ON vouchers(account_id, period);

-- 创建审计日志复合索引
CREATE INDEX idx_audit_log_entity ON audit_logs(entity_type, entity_id);
```

### B. 数据迁移示例
```sql
-- 从JSON文件导入科目
COPY subjects (code, name, parent_code, level, direction)
FROM '/path/to/subjects.csv'
WITH CSV HEADER;
```

---

*版本：v1.0*
*创建日期：2026-03-10*
*作者：DBA*
*审核人：[待填写]*