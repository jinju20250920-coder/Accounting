# 发票管理系统设计文档

## 1. 概述

将现有的"流水导入"功能改造为"发票管理"系统，支持进项发票和销项发票的导入、管理、凭证生成及资金状态跟踪。

## 2. 核心功能

### 2.1 发票管理
- **进项发票**：从税务局Excel导入，支持自动生成凭证
- **销项发票**：从税务局Excel导入，仅做管理和收款状态跟踪

### 2.2 发票资金一览表
- 显示发票的收付款状态
- 支持按往来单位汇总
- 显示凭证生成状态

### 2.3 凭证关联与核销
- **自动匹配**：根据发票号/金额/往来单位自动匹配现有凭证
- **手动核销**：支持手动关联发票与收付款凭证

## 3. 数据结构

### 3.1 发票表 (invoices)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| invoiceType | TEXT | 发票类型: input(进项)/output(销项) |
| invoiceCode | TEXT | 发票号码 |
| invoiceDate | TEXT | 开票日期 |
| sellerName | TEXT | 销售方名称 |
| sellerTaxNo | TEXT | 销售方税号 |
| buyerName | TEXT | 购买方名称 |
| buyerTaxNo | TEXT | 购买方税号 |
| goodsName | TEXT | 货物或服务名称 |
| amount | REAL | 金额(不含税) |
| taxRate | REAL | 税率 |
| taxAmount | REAL | 税额 |
| totalAmount | REAL | 价税合计 |
| paymentStatus | TEXT | 收付款状态: unpaid/partial/paid |
| paidAmount | REAL | 已收/已付金额 |
| voucherId | TEXT | 关联凭证ID |
| voucherNo | TEXT | 关联凭证号 |
| partnerId | TEXT | 关联往来单位ID |
| accountSetId | TEXT | 账套ID |
| createTime | TEXT | 创建时间 |
| updateTime | TEXT | 更新时间 |

### 3.2 发票核销记录表 (invoiceReconciliations)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| invoiceId | TEXT | 发票ID |
| voucherId | TEXT | 凭证ID |
| entryId | TEXT | 凭证分录ID |
| amount | REAL | 核销金额 |
| reconcileDate | TEXT | 核销日期 |
| accountSetId | TEXT | 账套ID |
| createTime | TEXT | 创建时间 |

## 4. 页面结构

### 4.1 发票管理页面 (`/invoices`)
- Tab切换：进项发票 / 销项发票
- 功能按钮：导入Excel、新增、导出
- 列表展示：发票号、日期、往来单位、金额、税额、状态
- 操作：查看详情、生成凭证、核销

### 4.2 发票资金一览表 (`/reports/invoices`)
- 按往来单位汇总显示
- 筛选条件：期间、往来单位、状态
- 显示：应收/应付金额、已收/已付金额、未收/未付金额
- 凭证生成状态

## 5. 业务流程

### 5.1 进项发票处理流程
1. 导入发票Excel → 2. 自动匹配往来单位 → 3. 生成进项税凭证 → 4. 关联付款凭证(核销)

### 5.2 销项发票处理流程
1. 导入发票Excel → 2. 自动匹配往来单位 → 3. 跟踪收款状态 → 4. 关联收款凭证(核销)

## 6. 凭证生成规则

### 6.1 进项发票凭证模板
```
借: 材料采购 / 库存商品 (不含税金额)
借: 应交税费-进项税额 (税额)
贷: 应付账款 (价税合计)
```

### 6.2 销项发票凭证模板
```
借: 应收账款 (价税合计)
贷: 主营业务收入 (不含税金额)
贷: 应交税费-销项税额 (税额)
```

## 7. 自动匹配规则

优先级从高到低：
1. 发票号完全匹配
2. 往来单位名称匹配
3. 金额相近匹配 (误差±1元)

## 8. 技术实现

### 8.1 文件修改清单
- 新增：`src/stores/useInvoiceStore.ts`
- 新增：`src/app/invoices/page.tsx`
- 新增：`src/app/reports/invoices/page.tsx`
- 修改：`src/lib/database/sqlite-manager.ts` (添加发票表)
- 修改：`src/lib/parser.ts` (添加发票Excel解析)
- 修改：`src/components/layout/sidebar.tsx` (菜单更新)

### 8.2 复用组件
- 复用现有的Excel导入组件模式
- 复用现有的核销功能
- 复用现有的凭证生成逻辑
