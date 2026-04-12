# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**AI 财务 Assistant（金桔财务系统）** - 基于Web的现代会计凭证录入系统

- 框架：Next.js + React + shadcn/ui + Zustand + Tailwind CSS
- 特性：Excel-like网格、凭证导入/流水生成、AI学习功能、凭证冲销、自动化模板引擎、状态机管理
- 数据存储：SQLite 数据库（默认，通过 sql.js + OPFS），支持多账套管理和数据持久化

---

## 关键约束

### 1. 凭证状态机
所有凭证必须经过状态管理：`draft`（草稿）→ `review`（审核）→ `posted`（记账）→ `reversed`（冲销）
- 冲销功能：对已记账凭证创建红冲凭证
- 状态验证：使用 `calculateVoucherStatus()` 验证状态转换合法性
- 状态锁定：已记账凭证（`posted`）不可修改，只能冲销

### 2. AI 智能匹配（L1 + L2）
- Level 1（规则先行）：利用 `keyword-rules.json` 进行关键词模糊匹配
- Level 2（上下文学习）：利用 `useUserPreferenceStore` 记忆用户偏好
- 匹配逻辑：`getSmartMatch()` 函数实现，支持双向匹配（摘要包含关键词/关键词包含摘要）
- 匹配优先级：用户偏好（L2）> 预设规则（L1）
- 已集成到银行流水智能匹配（`transaction-import.tsx` 的 `handleAutoMatch`）

### 3. 模板驱动自动化凭证生成
- 核心思路：使用 `TemplateEngine` 和 VoucherTemplate 而非硬编码逻辑
- 公式解释器：支持 `{total_amount} * 0.13` 这样的表达式，使用 `FormulaInterpreter` 类
- 模板类型：系统模板（不可修改）和用户自定义模板
- 自动匹配：导入数据时根据 `triggerType` 自动选择模板

### 4. 数据持久化架构（双层）
- **主数据层**：SQLite 数据库（`sqlite-service.ts`），存储凭证、科目、分录、银行流水、发票等所有业务数据
- **UI状态层**：Zustand persist 中间件（`persistence-config.ts`），仅保存 UI 配置和少量状态
- **数据库切换**：`lib/database/index.ts` 通过 `getCurrentService()` 返回 `sqliteService`（默认）或 `databaseService`（IndexedDB）
- **账套隔离**：每个账套通过 `accountSetId` 字段隔离数据

---

## 核心功能模块

1. **凭证录入系统** - Excel-like网格界面、分录管理、借贷自动平衡
2. **凭证状态机** - 严格的状态管理：draft → review → posted → reversed
3. **AI智能匹配** - L1关键词规则 + L2用户学习，智能科目推荐
4. **自动化模板引擎** - 基于模板自动生成凭证，支持公式计算
5. **流水导入** - 银行流水导入，AI智能匹配科目，批量/自动生成凭证
6. **发票管理** - 进项/销项发票导入，自动生成凭证，核销管理
7. **报表查询** - 科目余额表、明细账、资产负债表、损益表、现金流量表
8. **往来管理** - 应收账款账龄、应付账款账龄分析、核销
9. **账套管理** - 多账套支持、期初余额录入、期间管理、OPFS存储
10. **基础档案管理** - 科目层级树形显示、新增/编辑/删除/冻结、部门、项目、币别、往来单位
11. **固定资产管理** - 固定资产卡片、无形资产、待摊费用、折旧/摊销计算
12. **汇兑损益** - 外币科目、汇率管理、期末自动调汇
13. **期末结转** - 损益结转、年结处理

---

## 目录结构

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # 仪表盘首页
│   ├── balance/page.tsx            # 科目余额表
│   ├── voucher-entry-page/         # 凭证录入
│   ├── voucher-list/               # 凭证列表
│   ├── import/page.tsx             # 银行流水导入
│   ├── invoices/
│   │   ├── input/page.tsx          # 进项发票
│   │   ├── output/page.tsx         # 销项发票
│   │   └── summary/page.tsx        # 发票汇总
│   ├── sets/page.tsx               # 账套管理
│   ├── reports/                    # 报表
│   │   ├── assets/                 # 资产负债表
│   │   ├── profit/                 # 损益表
│   │   └── cashflow/               # 现金流量表
│   ├── aging/                      # 账龄分析
│   ├── assets/                     # 固定资产/无形资产/待摊费用
│   ├── settings/                   # 基础档案设置
│   │   ├── subjects/               # 科目管理
│   │   ├── auxiliary/              # 往来单位管理
│   │   ├── departments/            # 部门管理
│   │   ├── projects/               # 项目管理
│   │   ├── currencies/             # 币别管理
│   │   ├── summaries/              # 常用摘要
│   │   └── templates/              # 凭证模板
│   └── partner-dashboard/          # 往来单位详情
├── components/
│   ├── ui/                         # shadcn/ui 组件（16个）+ 中文日期/月份选择器
│   ├── layout/                     # 布局（sidebar, VoucherLayout）
│   ├── voucher/                    # 凭证相关组件（15个）
│   │   ├── voucher-entry-grid.tsx  # Excel-like 凭证录入网格
│   │   ├── subject-search.tsx      # 科目搜索
│   │   ├── smart-subject-selector.tsx # AI智能科目选择
│   │   ├── auxiliary-selector.tsx  # 辅助核算选择器
│   │   ├── clearing-manager.tsx    # 核销管理
│   │   ├── TemplateSelector.tsx    # 模板选择器
│   │   └── ...
│   ├── reports/                    # 报表组件（5个）
│   ├── database/                   # 数据库管理组件（7个）
│   ├── account-set/                # 账套管理组件（3个）
│   ├── partner/                    # 往来单位组件（2个）
│   ├── project/                    # 项目管理组件（9个）
│   ├── transaction-import.tsx      # 银行流水导入（支持AI智能匹配）
│   ├── import-history.tsx          # 导入历史
│   ├── ai-learning-dashboard.tsx   # AI学习看板
│   ├── ai-subject-recommendation.tsx # AI科目推荐
│   ├── bank-account-selector.tsx   # 银行账户选择器
│   ├── error-boundary.tsx          # 错误边界
│   ├── DatabaseSyncWrapper.tsx     # 数据库同步包装器
│   └── DatabaseManager.tsx         # 数据库管理器
├── stores/                         # Zustand 状态管理（22个Store）
│   ├── index.ts                    # Store 导出
│   ├── persistence-config.ts       # 持久化配置（UI状态用localStorage）
│   ├── useVoucherStore.ts          # 凭证录入
│   ├── useSubjectStore.ts          # 科目管理
│   ├── useInvoiceStore.ts          # 发票管理（含自动凭证生成）
│   ├── useAccountSetStore.ts       # 账套管理
│   ├── useUserPreferenceStore.ts   # 用户偏好（AI L2学习）
│   ├── useAuditStore.ts            # 审计日志
│   ├── usePartnerStore.ts          # 往来单位
│   ├── useDepartmentStore.ts       # 部门
│   ├── useCurrencyStore.ts         # 币别
│   ├── useVoucherTemplateStore.ts  # 凭证模板
│   ├── useSummaryStore.ts          # 常用摘要
│   ├── useClearingStore.ts         # 核销
│   ├── useAgingStore.ts            # 账龄分析
│   ├── useReportConfigStore.ts     # 报表配置
│   ├── useFixedAssetStore.ts       # 固定资产
│   ├── useIntangibleAssetStore.ts  # 无形资产
│   ├── usePrepaidExpenseStore.ts   # 待摊费用
│   ├── useSettingsStore.ts         # 系统设置
│   ├── useAccountStore.ts          # 账户管理
│   ├── useFinancialProjectStore.ts # 财务项目
│   └── useProjectStore.ts          # 项目管理
├── lib/                            # 核心业务逻辑
│   ├── accounting.ts               # 会计引擎核心（含 getSmartMatch）
│   ├── ai-learning.ts              # AI学习模块
│   ├── template-engine.ts          # 自动化模板引擎（4个系统模板）
│   ├── parser.ts                   # Excel解析器（银行流水等）
│   ├── depreciation.ts             # 折旧计算（直线法/双倍余额/年数总和/工作量法）
│   ├── amortization.ts             # 摊销计算
│   ├── financial-reports.ts        # 财务报表生成
│   ├── enhanced-formula-interpreter.ts # 增强公式解释器
│   ├── excel-utils.ts              # Excel工具
│   ├── paste-handler.ts            # 剪贴板粘贴处理
│   ├── print-utils.ts              # 打印工具
│   ├── chinese-number.ts           # 中文数字转换
│   ├── code-generator.ts           # 自动编码生成
│   ├── utils.ts                    # 通用工具函数
│   ├── bank-parsers/               # 银行流水解析器
│   │   └── ccb-parser.ts           # 建设银行
│   ├── data/                       # 数据配置
│   │   ├── keyword-rules.json      # AI L1关键词匹配规则
│   │   ├── subjects.json           # 默认科目
│   │   └── templates.json          # 凭证模板
│   └── database/                   # 数据库层
│       ├── index.ts                # 数据库服务工厂（SQLite/IndexedDB切换）
│       ├── sqlite-service.ts       # SQLite CRUD（核心数据持久化）
│       ├── sqlite-manager.ts       # SQLite 连接管理
│       ├── account-set-db-manager.ts # 账套数据库管理
│       ├── file-handle-manager.ts  # 文件句柄管理（OPFS/FSA）
│       ├── service.ts              # IndexedDB 服务（兼容层）
│       └── manager.ts              # IndexedDB 管理器
├── hooks/                          # 自定义Hooks
│   ├── useStorage.ts
│   ├── useVoucherSession.ts
│   ├── useErrorHandling.ts
│   ├── useAccountSetSwitch.ts
│   ├── useDatabaseSync.ts
│   └── use-toast.ts
└── types/
    ├── index.ts                    # 类型定义（1000+行）
    └── electron.d.ts               # Electron API 类型声明
```

---

## 开发命令

```bash
# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

---

## 关键技术点

### Zustand Store 设计
- 每个功能模块一个Store，已实现22个Store
- 状态管理：当前数据 + Actions方法组合
- 持久化策略：
  - 主数据通过 SQLite 数据库持久化（`sqlite-service.ts`）
  - UI配置通过 Zustand persist 中间件保存到 localStorage
  - `persistence-config.ts` 提供 UI 状态持久化配置
  - `DatabaseSyncWrapper` 负责同步 Zustand ↔ SQLite

### 会计引擎 (lib/accounting.ts)
核心会计函数集合：
- `calculateSubjectBalance()` - 计算科目余额（考虑借贷方向）
- `generateVoucherNo()` - 生成凭证字号（年月-序号格式）
- `isVoucherBalanced()` - 检查借贷平衡（0.01容差）
- `getSmartMatch()` - AI智能匹配（L1规则 + L2用户偏好）
- `calculateVoucherStatus()` - 凭证状态机验证
- `createReverseVoucher()` - 创建冲销凭证
- `calculateExchangeGainLoss()` - 汇兑损益计算

### 自动化模板引擎 (lib/template-engine.ts)
系统的核心创新点，实现"凭证工厂"概念：

#### 1. 核心组件
- `TemplateEngine` 类：模板管理和凭证生成
- `FormulaInterpreter` 类：安全公式解释器
- `VoucherTemplate` 接口：模板结构定义

#### 2. 预设系统模板
- 销售发票（`tpl_sale_invoice`，triggerType: `invoice_import`）：应收账款 + 主营业务收入 + 销项税
- 采购发票（`tpl_purchase_invoice`，triggerType: `invoice_import`）：材料采购 + 进项税 + 应付账款
- 银行收款（`tpl_bank_deposit`，triggerType: `bank_statement`）：银行存款
- 银行付款（`tpl_bank_payment`，triggerType: `bank_statement`）：管理费用 + 银行存款

#### 3. 公式解释器特性
- 支持变量：`{total_amount}`, `{tax_amount}`, `{base_amount}`
- 支持运算：`{total_amount} * 0.13`, `{total_amount} - {tax_amount}`
- 安全计算：过滤危险字符，使用Function构造函数
- 自动提取变量：`extractVariables()` 用于验证

#### 4. 自动化流程
1. 数据导入 → 2. 模板匹配（triggerType）→ 3. 数据验证 → 4. 公式计算 → 5. 借贷平衡检查 → 6. 生成凭证

### 发票自动凭证 (stores/useInvoiceStore.ts)
- `importInvoicesFromExcel()` 支持 `autoGenerateVoucher` 选项
- 导入发票时可选自动生成凭证（进项/销项发票页面均有开关）
- 凭证生成使用标准会计分录（非模板引擎，直接硬编码分录）
- 自动生成凭证字号：`记-YYYYMM-NNN` 格式

### 银行流水自动凭证 (components/transaction-import.tsx)
- `handleAutoMatch()` 使用 `getSmartMatch()` 进行AI智能匹配（L1 + L2）
- `handleGenerateVouchers()` 批量生成凭证，支持银行科目选择
- 银行流水数据通过 `sqliteService` 的 `bankTransactions` 表持久化
- 导入页 "最近导入" 侧栏从数据库读取真实数据

### AI智能匹配架构
实现于 `lib/accounting.ts` 的 `getSmartMatch()` 函数

#### 1. Level 1（规则先行）
- 数据源：`keyword-rules.json` 预设通用规则
- 匹配方式：关键词模糊匹配
- 优先级：1-10，数值越高置信度越高

#### 2. Level 2（上下文学习）
- 数据源：`useUserPreferenceStore` 用户历史行为
- 匹配逻辑：双向匹配（摘要包含/被包含）
- 时间权重：最近的偏好权重更高

### 数据库层 (lib/database/)

#### SQLite 服务 (sqlite-service.ts)
- 通过 sql.js 在浏览器端运行 SQLite
- 支持 OPFS（Origin Private File System）持久化
- 自动数据库迁移（添加新表、新列）
- 所有操作带 `accountSetId` 隔离

#### 数据库索引
- `lib/database/index.ts` 提供统一入口
- `getCurrentService()` 返回当前数据库服务（默认 SQLite）
- `getCurrentManager()` 返回当前数据库管理器

### 审计追踪 (useAuditStore)
- 记录所有凭证状态变更
- 追踪用户操作历史
- 支持操作回溯
- 数据通过 Zustand persist + SQLite 双重持久化

### UI组件约定
- 使用shadcn/ui组件
- 样式：Tailwind CSS（slate-50背景，white卡片，blue-600主色）
- 响应式：移动端友好
- 状态标识：使用Badge显示凭证状态和匹配来源
- 模板选择器：在导入时自动弹出模板选择对话框
- 页面宽度：使用 `max-w-4xl` 并居中，避免右侧大面积空白

#### 交互模式规范（参照银行流水匹配规则页重构）

1. **科目选择器** — 统一使用 Popover 模式（非内联展开）
   - 未选：虚线边框 + 搜索图标 `[🔍 选择科目]`
   - 已选：蓝色 Badge `[1002 银行存款 ×]`，点击 × 清除
   - 弹出层：`max-h-60` + 阴影，支持模糊搜索（按代码或名称实时过滤）
   - 参考 `transaction-import.tsx` 中的 `SubjectPopover` 组件

2. **编辑表单** — 使用行内展开抽屉（Drawer）模式，不用大面积折叠区
   - 默认隐藏，点击"编辑"时从该行底部展开（`border-t bg-slate-50`）
   - 新增同理，从列表底部展开
   - 不要使用全屏或大面积的编辑面板

3. **列表项标签** — 使用小号带背景色标签
   - 系统预设：紫色 `bg-purple-50 text-purple-600`
   - 用户自定义：蓝色 `bg-blue-50 text-blue-600`
   - 已禁用：红色 `bg-red-50 text-red-500` + 规则名称灰色删除线
   - 方向/类型：流入绿色、流出红色、通用灰色
   - 优先级：`P{n}` 格式 `bg-slate-100 text-slate-500`

4. **帮助/说明文字** — 默认折叠，点击展开
   - 用蓝色 `Info` 图标 + "查看说明" 链接
   - 展开后显示蓝色背景 Alert
   - 不要直接平铺说明文字

5. **规则/列表操作按钮** — 右侧紧凑排列
   - 开关（ToggleLeft/ToggleRight）+ 编辑（Pencil）+ 删除（Trash2）
   - 系统不可删的项：删除图标灰色，点击弹 Toast 提示
   - 用户可删的项：删除图标红色

6. **搜索/过滤** — 列表上方搜索框
   - `relative + Search图标 + input` 布局
   - 支持按关键词、名称、代码实时过滤

---

## 已实现功能清单

- ✅ 核心类型定义（types/index.ts，1000+行）
- ✅ 会计引擎基础功能（lib/accounting.ts）
- ✅ 自动化模板引擎（lib/template-engine.ts，4个系统模板）
- ✅ 基础UI组件和布局（shadcn/ui 16个组件）
- ✅ 凭证录入Store（useVoucherStore）+ Excel-like网格
- ✅ 科目管理Store（useSubjectStore）- 层级树形显示、CRUD、冻结
- ✅ AI智能匹配（L1关键词 + L2用户偏好）
- ✅ 用户偏好学习（useUserPreferenceStore）
- ✅ 审计日志（useAuditStore）
- ✅ 银行流水导入 - AI智能匹配、批量生成凭证
- ✅ 发票管理（进项/销项）- Excel导入、自动生成凭证、核销
- ✅ 报表查询 - 科目余额表、资产负债表、损益表、现金流量表
- ✅ 往来管理 - 账龄分析、核销
- ✅ 账套管理 - 多账套、OPFS存储、期初余额
- ✅ 数据持久化 - SQLite数据库 + OPFS
- ✅ 基础档案 - 科目、部门、项目、币别、往来单位、常用摘要、凭证模板
- ✅ 固定资产管理 - 折旧计算（4种方法）
- ✅ 无形资产管理 - 摊销计算
- ✅ 待摊费用管理
- ✅ 会计引擎 - 科目余额计算、凭证字号、借贷平衡
- ✅ 银行流水解析器 - 建设银行格式
- ✅ 资金管理页 - 多银行汇总表、按月/日筛选、凭证明细弹窗
- ✅ 流水去重 - 导入时按 date+voucherNo+transactionSerialNo 去重，入账时防重复
- ✅ 银行账户名校验 - 导入时检查银行户名与账套公司名是否一致
- ✅ 银行子科目自动匹配 - 导入时自动匹配/创建1002子科目（bankAccountNumber字段）
- ✅ 业务单据号 - 入账凭证docNo使用 账户明细编号-交易流水号
- ✅ 流水匹配规则页UI重构 - Popover科目选择、行内编辑抽屉、搜索过滤、标签化

### 待完善功能
1. **凭证记账/冲销** - `voucher-list/page.tsx` 中的 `handlePost`、`handleReverse` 仅弹提示，未调用会计引擎
2. **往来单位合并** - `settings/auxiliary/page.tsx` 显示"合并功能开发中..."
3. **项目删除** - `settings/projects/page.tsx` 未实现删除
4. **自定义报表** - `reports/page.tsx` 3个按钮无 onClick
5. **现金流量表** - 计算逻辑简化，需更复杂分析
6. **模板引擎集成** - `template-engine.ts` 已实现但未与发票/银行导入流程集成（当前使用硬编码分录）

---

## 设计理念

### 模板驱动 vs 硬编码
**传统方式（硬编码）**：
```typescript
// ❌ 销售发票需要写代码处理
if (type === 'sale_invoice') {
  entries.push({
    subject: '1122',
    debit: totalAmount
  });
  // ... 更多硬编码逻辑
}
```

**模板驱动方式**：
```typescript
// ✅ 配置即可，无需写代码
{
  "id": "tpl_sale_invoice",
  "triggerType": "invoice_import",
  "entries": [
    { "subject": "1122", "direction": "debit", "formula": "{total_amount}" }
  ]
}
```

### 扩展性优势
- **新增业务类型**：只需在UI中添加新模板，无需修改代码
- **税率调整**：修改模板中的公式即可
- **科目变更**：调整模板中的科目代码
- **无需开发**：财务人员可以在界面中配置自己的模板

---

## 代码质量与最佳实践

### 当前代码状态
- ✅ 类型定义完整：typescript严格模式
- ✅ 组件分离：UI组件与业务逻辑分离
- ✅ 数据持久化：SQLite数据库 + Zustand persist 双层架构
- ✅ 22个 Zustand Store 覆盖所有功能模块
- ⚠️ 错误处理：需要完善全局错误处理

### 代码规范
- 使用ESLint + TypeScript严格模式
- 组件使用PascalCase，文件使用kebab-case
- 常量使用UPPER_SNAKE_CASE
- 工具函数使用lowerCamelCase

### 注意事项

1. **数据持久化** - 主数据使用 SQLite 数据库（`sqlite-service.ts`），UI 状态使用 Zustand persist（`persistence-config.ts`）
2. **日期格式** - 存储使用ISO格式（YYYY-MM-DD / YYYY-MM），UI显示使用中文格式
   - 日期显示：`2026年4月10日`（使用 `ChineseDatePicker` 组件）
   - 月份显示：`2026年4月`（使用 `ChineseMonthPicker` 组件）
   - 日期/月份选择器：全系统统一使用自定义中文组件（`src/components/ui/chinese-date-picker.tsx`、`src/components/ui/chinese-month-picker.tsx`）
   - **禁止使用原生 `<input type="date">` 或 `<input type="month">`**，其弹出日历为英文且无法控制语言
3. **金额精度** - 所有金额保留2位小数，使用Math.round避免浮点误差
4. **科目验证** - 操作前验证科目是否存在，防止数据错误
5. **借贷平衡** - 保存前必须平衡，否则提示警告
6. **凭证状态** - 严格执行状态机，防止非法操作
7. **AI透明度** - 在UI中显示匹配来源，让用户了解推荐依据
8. **操作审计** - 重要操作必须记录，支持追踪
9. **模板验证** - 生成凭证前必须验证数据完整性
10. **公式安全** - 公式解释器需要防止注入攻击
11. **UI 提示规范** - 使用全局 Toast 组件替代原生 alert
    - ✅ 禁止使用原生 `alert()`、`confirm()`、`prompt()`
    - ✅ 使用 `useToast()` hook 调用 `showToast(type, message, duration)`
    - ✅ 支持类型：`'success'` | `'error'` | `'warning'` | `'info'`
12. **必填字段标识** - 使用红色 `*` 标记必填字段
    - ✅ 使用方式：`<Label required>字段名称</Label>` 自动显示红色 `*`
    - ✅ 禁止在 label 文本中直接写 `*`
13. **端口占用处理** - 不要使用 `taskkill /f /im node.exe` 终止所有 node 进程
    - ✅ Windows 示例：`netstat -ano | findstr :3000` 找到 PID，然后 `taskkill /f /pid <PID>`

---

## 创新特性

### 1. 科目层级树形显示
- 层级缩进：一级科目无缩进，二级科目向右缩进24px，三级科目继续缩进
- 展开/折叠：支持点击箭头展开或折叠子科目
- 冻结状态：支持科目冻结，冻结的科目显示特殊标识

### 2. 双层AI匹配架构
- L1规则库：行业通用规则（keyword-rules.json）
- L2学习库：用户个性化偏好（useUserPreferenceStore）
- 智能排序：用户偏好优先于预设规则
- 持续学习：用户每次修改都记录并优化
- 已集成到银行流水智能匹配

### 3. 严格的状态机管理
```
draft → review → posted → reversed
```
- 不可逆流程：已记账凭证不能直接修改
- 自动冲销：createReverseVoucher()生成红冲凭证
- 状态追踪：完整的状态变更历史
- 错误预防：calculateVoucherStatus()验证操作合法性

### 4. 发票导入自动凭证
- 导入发票时可选"导入后自动生成凭证"
- 进项发票：借-材料采购/进项税，贷-应付账款
- 销项发票：借-应收账款，贷-主营业务收入/销项税
- 自动生成凭证字号，批量处理

### 5. 统一往来单位管理架构
- **单一卡片原则**：一个公司在系统中只有一个唯一ID
- **多身份支持**：通过checkbox同时勾选"客户"、"供应商"或"两者皆是"
- **Tab切换**：全部 | 客户 | 供应商，支持按类型筛选
- **合并/关联功能**：解决历史数据重复问题（开发中）
- **明细账合并查看**：支持"显示全部往来"功能，将应收应付数据合并展示

### 6. 模块化架构
- 清晰分层：UI层（components）→ 业务层（lib）→ 数据层（stores + database）
- 松耦合：各模块独立，便于维护和扩展
- 类型安全：完整的TypeScript类型定义
- 组件复用：shadcn/ui组件库保证UI一致性
- 科目树组件：SubjectTreeNode 组件递归渲染层级结构，使用内联样式动态计算缩进

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
