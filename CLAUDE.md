# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**AI 财务 Assistant（金桔财务系统）** - 基于Web的现代会计凭证录入系统

- 框架：Next.js + React + shadcn/ui + Zustand + Tailwind CSS
- 特性：Excel-like网格、凭证导入/流水生成、AI学习功能、凭证冲销、自动化模板引擎、状态机管理
- 数据存储：SQLite 数据库（默认，通过 sql.js + OPFS），支持多账套管理和数据持久化
- 用户管理：本地账号密码登录，预设角色（管理员/会计/出纳），权限矩阵，账套级用户授权

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
- **数据库切换**：`lib/database/index.ts` 通过 `getCurrentService()` 返回 `sqliteService`
- **账套隔离**：统一使用"共享全局数据库 + accountSetId 过滤"模式，所有账套数据存储在同一个 SQLite 文件中，通过 `WHERE accountSetId = ?` 隔离

### 5. 账套隔离架构（统一模式）
- **单一数据库**：所有账套共享一个全局 SQLite 文件，不再为每个账套创建独立文件
- **accountSetId 过滤**：所有业务表均有 `accountSetId` 列，查询时统一使用 `WHERE accountSetId = ?` 过滤
- **账套切换**：`sqliteService.setAccountSetId()` 设置当前账套 ID，不涉及数据库文件切换
- **账套管理**：`account-set-db-manager.ts` 负责账套 CRUD（创建/删除/重命名/导出/导入），均在全局数据库内操作
- **删除安全**：`deleteAccountSet()` 使用事务（BEGIN/COMMIT/ROLLBACK）确保原子性
- **多租户扩展路径**：未来加 `tenantId` 只需 `WHERE tenantId = ? AND accountSetId = ?`，层级：Tenant → AccountSet → 业务数据

### 6. 用户与权限管理
- **本地认证**：用户账号密码存储在 SQLite `users` 表，密码使用 SHA-256 + salt 哈希
- **登录流程**：`useAuthStore` 管理登录状态，`AuthGuard` 组件拦截未登录访问，重定向到 `/login`
- **默认管理员**：首次启动自动创建 admin/admin123 用户，分配管理员角色
- **预设角色**：管理员（全部权限）、会计（凭证+报表+发票+资产）、出纳（资金+凭证查看+报表）
- **自定义角色**：支持创建自定义角色并分配权限，权限按 category 分组（voucher/fund/invoice/report/asset/partner/settings/accountset/user）
- **权限检查**：`usePermission` Hook 检查当前用户权限，Sidebar 菜单和页面按钮根据权限显示/隐藏
- **账套授权**：`account_set_users` 表控制用户对账套的访问权限和角色，优先于全局 `user_roles`
- **审计日志联动**：`logVoucherAction` 和 `logExport` 使用 `useAuthStore.currentUser` 记录真实用户

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
10. **会计期间管理** - 当前期间指示、期间切换、结账/反结账
10. **基础档案管理** - 科目层级树形显示、新增/编辑/删除/冻结、部门、项目、币别、往来单位
11. **固定资产管理** - 固定资产卡片、无形资产、待摊费用、折旧/摊销计算
12. **汇兑损益** - 外币科目、汇率管理、期末自动调汇
13. **期末结转** - 损益结转、年结处理
14. **资金中心** - 资金头寸总览、多银行汇总、现金流图表、账龄分布、结算预警、到期日历、往来单位结算
15. **资金管理控制台** - 4区布局（账户选择器+概览卡片+操作中心+日记账明细表），期间范围选择，银行科目自动匹配/创建，手动记一笔，凭证印章，对方账号，银行列

---

## 目录结构

```
src/
├── app/
│   ├── layout.tsx
│   ├── login/page.tsx              # 登录页面
│   ├── layout.tsx                  # 根布局（AuthGuard + AppLayout）
│   ├── page.tsx                    # 仪表盘首页
│   ├── balance/page.tsx            # 科目余额表
│   ├── voucher-entry-page/         # 凭证录入
│   ├── voucher-list/               # 凭证列表
│   ├── import/page.tsx             # 资金管理控制台（4区布局：账户选择+概览+操作+日记账）
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
│   │   ├── templates/              # 凭证模板
│   │   ├── users/                  # 用户管理
│   │   ├── roles/                  # 角色权限管理
│   │   └── bank-accounts/          # 银行账户管理（含格式配置向导）
│   └── partner-dashboard/          # 往来单位详情
│   └── fund-hub/                   # 资金中心（结算看板）
├── components/
│   ├── ui/                         # shadcn/ui 组件（16个）+ 中文日期/月份选择器
│   ├── layout/                     # 布局（sidebar, VoucherLayout）
│   │   ├── app-layout.tsx          # 应用布局（Sidebar + 内容区）
│   │   ├── auth-guard.tsx          # 认证守卫（未登录重定向）
│   │   ├── current-period-bar.tsx   # 当前期间指示栏
│   │   └── current-period-wrapper.tsx # 当前期间包装器
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
│   ├── account-set/                # 账套管理组件（14个）
│   │   ├── account-set-members-dialog.tsx # 账套成员管理对话框
│   │   ├── setup-wizard.tsx         # 设置向导（9步条件流程，自由导航）
│   │   ├── setup-step-company.tsx   # 公司信息（含纳税人类型选择）
│   │   ├── setup-step-template.tsx  # 行业模板选择
│   │   ├── setup-step-rules.tsx     # 业务规则（税率推荐+核算方式+工资社保+资产+发票）
│   │   ├── setup-step-currency.tsx  # 币种汇率管理
│   │   ├── setup-step-bank.tsx      # 银行账户设置
│   │   ├── setup-step-partners.tsx  # 往来单位卡片
│   │   ├── setup-step-fixed-assets.tsx # 固定资产卡片
│   │   ├── setup-step-projects.tsx # 项目核算管理（条件步骤）
│   │   ├── setup-step-opening.tsx   # 期初余额（多Tab：科目/往来/银行/资产）
│   │   ├── setup-step-complete.tsx  # 完成确认
│   │   ├── monthly-closing-wizard.tsx # 月结向导
│   │   ├── period-management.tsx    # 期间管理
│   │   └── current-period-indicator.tsx # 当前期间指示
│   ├── invoice-rule/               # 发票智能规则组件
│   │   ├── purchase-invoice-rules.tsx # 采购发票规则设置（业务组表格、供应商矩阵）
│   │   └── components/
│   │       ├── business-group-drawer.tsx # 业务组编辑面板（弹出式双栏布局、凭证预览、Framer Motion动画）
│   │       ├── subject-variable-input.tsx # 科目变量输入
│   │       └── utils/              # 规则工具函数
│   ├── partner/                    # 往来单位组件（2个）
│   ├── project/                    # 项目管理组件（9个）
│   ├── transaction-import.tsx      # 银行流水导入（支持AI智能匹配）
│   ├── cash-console/               # 资金管理控制台组件（4个）
│   │   ├── account-selector.tsx    # 账户选择器（含"全部账户"选项）
│   │   ├── cash-overview.tsx       # 概览卡片（期初/收入/支出/余额+对账差异）
│   │   ├── action-center.tsx       # 操作中心（导入/手动记一笔/智能对账）
│   │   ├── journal-table.tsx       # 日记账明细表（全字段+内联科目编辑+凭证印章+批量删除）
│   │   └── manual-entry-dialog.tsx # 手动记一笔对话框
│   ├── import-history.tsx          # 导入历史
│   ├── ai-learning-dashboard.tsx   # AI学习看板
│   ├── ai-subject-recommendation.tsx # AI科目推荐
│   ├── bank-account-selector.tsx   # 银行账户选择器
│   ├── bank-format-selector.tsx    # 银行格式选择器（含自定义配置）
│   ├── bank-format-test-dialog.tsx # 银行格式测试对话框
│   ├── field-mapping-coach.tsx     # 自定义格式映射向导（5步，含模糊自动匹配）
│   ├── invoice-subject-config-dialog.tsx # 发票科目映射规则配置
│   ├── error-boundary.tsx          # 错误边界
│   ├── DatabaseSyncWrapper.tsx     # 数据库同步包装器
│   └── DatabaseManager.tsx         # 数据库管理器
│   └── fund-hub/                   # 资金中心组件（8个）
│       ├── settlement-dashboard.tsx # 结算总看板
│       ├── cash-position-card.tsx  # 资金头寸卡片
│       ├── bank-summary-table.tsx  # 多银行汇总表
│       ├── cash-flow-chart.tsx     # 现金流图表
│       ├── aging-distribution.tsx  # 账龄分布
│       ├── settlement-alerts.tsx   # 结算预警
│       ├── due-date-calendar.tsx   # 到期日历
│       └── counterparty-settlement.tsx # 往来单位结算
├── stores/                         # Zustand 状态管理（24个Store）
│   ├── index.ts                    # Store 导出
│   ├── persistence-config.ts       # 持久化配置（UI状态用localStorage）
│   ├── useAuthStore.ts             # 认证状态（登录/登出/权限检查）
│   ├── useUserStore.ts             # 用户/角色/权限 CRUD
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
│   ├── usePeriodManagementStore.ts # 期间管理
│   ├── useAccountStore.ts          # 账户管理
│   ├── useFinancialProjectStore.ts # 财务项目
│   └── useProjectStore.ts          # 项目管理
├── lib/                            # 核心业务逻辑
│   ├── accounting.ts               # 会计引擎核心（含 getSmartMatch、formatMoney）
│   ├── auth-utils.ts               # 密码哈希/验证（SHA-256 + salt）
│   ├── bank-match.ts               # 银行科目自动匹配/创建（共享模块，供导入页和流水导入组件复用）
│   ├── invoice-rule-engine.ts      # 发票智能规则引擎（条件匹配、动作执行、税金科目自动生成）
│   ├── ai-learning.ts              # AI学习模块
│   ├── template-engine.ts          # 自动化模板引擎（4个系统模板，支持科目覆盖）
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
│   ├── bank-parsers/               # 银行流水解析器（配置驱动，14家内置银行）
│   │   ├── engine.ts               # 通用解析引擎（合并表头、dataStartRow）
│   │   ├── detector.ts             # 自动识别银行格式（评分检测）
│   │   ├── types.ts                # BankParserConfig、BankAccountBinding 等类型
│   │   ├── bank-registry.ts        # 内置银行注册表 + BANK_BRANDS 品牌色
│   │   ├── date-handlers.ts        # 日期处理器（ISO/Excel序列号/紧凑/自定义）
│   │   ├── meta-extractor.ts       # 元数据提取（户名、账号、银行名）
│   │   └── configs/                # 14家银行配置
│   │       ├── ccb.ts              # 建设银行（双层表头）
│   │       ├── icbc.ts             # 工商银行
│   │       ├── abc.ts              # 农业银行
│   │       ├── cmb.ts              # 招商银行
│   │       ├── boc.ts              # 中国银行
│   │       ├── citic.ts            # 中信银行
│   │       ├── bocom.ts            # 交通银行
│   │       ├── industrial.ts       # 兴业银行
│   │       ├── czb.ts              # 浙商银行
│   │       ├── spdb.ts             # 浦发银行
│   │       ├── cmbc.ts             # 民生银行
│   │       ├── pingan.ts           # 平安银行
│   │       ├── huaxia.ts           # 华夏银行
│   │       └── shanghai.ts         # 上海银行
│   ├── data/                       # 数据配置
│   │   ├── keyword-rules.json      # AI L1关键词匹配规则
│   │   ├── subjects.json           # 默认科目
│   │   ├── templates.json          # 凭证模板
│   │   └── industry-templates/     # 行业模板（科技/制造/服务/餐饮/商贸/建筑）
│   └── database/                   # 数据库层
│       ├── index.ts                # 数据库服务工厂（SQLite/IndexedDB切换）
│       ├── sqlite-service.ts       # SQLite 委托外壳（薄壳，业务逻辑在 services/）
│       ├── sqlite-manager.ts       # SQLite 连接管理
│       ├── account-set-db-manager.ts # 账套管理（CRUD、导出/导入，全局数据库内操作）
│       ├── file-handle-manager.ts  # 全局数据库文件句柄管理（OPFS/FSA）
│       ├── service.ts              # IndexedDB 服务（兼容层）
│       ├── manager.ts              # IndexedDB 管理器
│       └── services/               # 类型化服务模块（从 sqlite-service 提取）
│           ├── voucher-sqlite-service.ts         # 凭证 CRUD
│           ├── reconciliation-sqlite-service.ts  # 核销关系
│           ├── subject-sqlite-service.ts         # 科目管理
│           ├── dept-project-currency-sqlite-service.ts # 部门/项目/币别
│           ├── audit-preference-summary-sqlite-service.ts # 审计/偏好/摘要
│           ├── voucher-template-fx-sqlite-service.ts  # 凭证模板/汇率/汇兑损益
│           ├── export-import-sqlite-service.ts   # 数据导出/导入/完整性检查
│           ├── fixed-asset-sqlite-service.ts     # 固定资产 + 共享类型（SqliteDatabaseLike）
│           ├── bank-transaction-sqlite-service.ts # 银行流水 CRUD
│           ├── bank-account-sqlite-service.ts    # 银行账户绑定
│           ├── partner-sqlite-service.ts         # 往来单位
│           ├── bank-cash-sqlite-service.ts       # 银行期初/资金概览/日记账
│           ├── invoice-rule-sqlite-service.ts    # 智能规则/供应商映射/费用报销/辅助策略
│           └── payroll-sqlite-service.ts         # 工资批次/明细/计算配置
├── hooks/                          # 自定义Hooks
│   ├── useStorage.ts
│   ├── useVoucherSession.ts
│   ├── useErrorHandling.ts
│   ├── useAccountSetSwitch.ts
│   ├── useDatabaseSync.ts
│   ├── usePermission.ts            # 权限检查Hook（usePermission/usePermissions/useAnyPermission）
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
- `TemplateEngine` 类：模板管理和凭证生成（export）
- `FormulaInterpreter` 类：安全公式解释器（export）
- `VoucherTemplate` / `TemplateEntry` / `InputData` 接口（export）

#### 2. 预设系统模板
- 销售发票（`tpl_sale_invoice`，triggerType: `invoice_import`，invoiceType: `output`）：应收账款 + 主营业务收入 + 销项税
- 采购发票（`tpl_purchase_invoice`，triggerType: `invoice_import`，invoiceType: `input`）：材料采购 + 进项税 + 应付账款
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
- 凭证生成通过模板引擎 `templateEngine.generateVoucherWithOverrides()` 驱动
- 科目映射：关键词规则（goodsName 匹配）→ 覆盖模板中的默认科目
- 支持税率匹配：规则可指定 `matchTaxRate`，按发票税率精确匹配
- 不存在的科目代码自动创建（direction 按代码首位判断）
- 自动生成凭证字号：`记-YYYYMM-NNN` 格式
- 所有数据库操作统一使用 `sqliteService`（`getDb()` helper）
- 生成凭证时记录匹配的业务组名称到 `invoice.groupName`

#### 发票科目映射规则（业务组驱动）
配置入口：进项/销项发票页面 → "科目配置" 按钮

```
匹配优先级：业务组优先级（priority 最高者）> 默认科目
业务组维度：关键词(goodsName) + 合作伙伴类型 → 覆盖3个科目槽位
  进项：借方(费用/采购) + 税金(自动按税率生成) + 贷方(应付)
  销项：借方(应收) + 贷方(收入) + 税金(自动按税率生成)
```

业务组配置：
- 科目选择：借方/贷方/税金科目均使用 `SubjectPopover` 下拉选择器（支持模糊搜索）
- 供应商白名单：矩阵表格模式（行=供应商，列=业务组，单选按钮），供应商名称从往来卡片下拉选择
- 税金科目：支持自动模式（基础科目 + 税率自动生成）和手动选择两种方式
- 优先级管理：支持上移/下移调整业务组优先级，列表按优先级排序
- 重复检查：防止添加重复供应商到同一业务组
- 往来卡片开关：`requirePartnerCard` 控制自动学习时是否创建往来卡片（员工报销默认关闭）

供应商自动学习：
- 用户手动修改发票业务组时，自动保存 `sellerName → groupName` 到 `supplier_subject_mapping` 表
- 下次导入同一供应商的发票时，白名单匹配（最高优先级）自动选择业务组
- 根据 `requirePartnerCard` 开关决定是否自动创建往来卡片
- 进项发票：学习 `sellerName → groupName`，创建供应商卡片
- 销项发票：学习 `buyerName → groupName`，创建客户卡片
- 发票导入流程也支持自动创建往来卡片

示例：
- 业务组"办公用品采购" → 借方=管理费用，税金=2221（自动→22210113），贷方=应付账款
- 业务组"差旅报销" → 借方=差旅费，贷方=其他应付款
- 供应商"滴滴出行" → 自动匹配到"差旅报销"业务组

持久化：`invoice_subject_rules` SQLite 表，`InvoiceSubjectRule` 类型定义

### 银行流水自动凭证 (components/transaction-import.tsx)
- `handleAutoMatch()` 使用 `getSmartMatch()` 进行AI智能匹配（L1 + L2）
- `handleGenerateVouchers()` 批量生成凭证，支持银行科目选择
- 银行流水数据通过 `sqliteService` 的 `bankTransactions` 表持久化
- 导入页 "最近导入" 侧栏从数据库读取真实数据

### 多银行解析引擎 (lib/bank-parsers/)
配置驱动的银行流水解析系统，支持14家内置银行 + 用户自定义格式：

#### 1. 架构设计
- `BankParserConfig` — 每家银行一份配置（表头行、列映射、日期格式、标识符）
- `engine.ts` — 通用解析引擎：读取 Excel → 匹配列 → 解析行
- `detector.ts` — 自动检测银行格式，基于 sheetKeywords + columnKeywords 评分
- `bank-registry.ts` — 14家内置银行注册表 + `BANK_BRANDS` 品牌色常量
- `configs/*.ts` — 各银行配置文件（ccb、icbc、abc 等14家）

#### 2. 关键特性
- **双层表头合并**：engine.ts 自动合并前一行表头（如建行 "借方" + "发生额" → "借方发生额"）
- **数据起始行**：`dataStartRow` 可选字段，支持表头与数据间有空行/小计行
- **模糊列匹配**：`matchColumns()` 使用子串匹配，一个字段可配多个关键词
- **日期处理器插件**：ISO / Excel序列号 / 紧凑格式 / 自定义模式
- **元数据提取**：从表头前几行自动提取户名、账号、银行名

#### 3. 自定义格式流程（FieldMappingCoach）
5步向导：选择表头行 → 列映射 → 日期格式 → 测试预览 → 保存
- **模糊自动匹配**：`autoMatch()` 基于关键词库评分，自动填充映射并显示置信度（绿/黄/橙）
- **相邻行合并**：`getMergedHeaders()` 合并选中行与上下相邻行，解决双层表头问题
- **配置持久化**：保存到 SQLite `custom_bank_configs` 表，下次导入时自动加载
- **编辑模式**：`initialConfig` + `editingRecordId` 支持修改已有自定义配置

#### 4. 银行账户管理页 (/settings/bank-accounts)
- 14家内置银行卡片网格，带品牌色 + 已绑定标记
- 引导式新增：选银行 → 填账号 → 格式配置（非内置银行）
- 编辑模式：显示格式配置状态，可配置/重新配置/测试
- Excel批量导入：下载模板 → 填写 → 上传预览 → 确认导入
- 第15+银行：选择"+ 新增银行"，输入名称后走格式配置向导
- `__new__` 哨兵值标识新增银行，自动生成 `custom_bank_*` ID

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
- 所有操作带 `accountSetId` 隔离（统一模式，共享全局数据库）
- `sqliteService` 通过 `@/lib/database` 导出，供 store 直接访问（如 `accountSetId` 同步）
- `setAccountSetId()` 仅设置当前账套 ID，不切换数据库文件
- **类型化委托架构**：业务逻辑和 SQL 已提取到 14 个 `services/` 模块，sqlite-service.ts 仅保留薄壳（ensureInitialized + 委托调用）
- 每个服务模块定义 Row 接口 + mapper 函数，消除 `any` 类型
- 写操作使用 `SqliteDatabaseLike`（db.prepare/run/free），读操作使用 `SimpleQueryService`（queryAllAsync/querySingleAsync）

#### 账套管理器 (account-set-db-manager.ts)
- 统一在全局数据库内操作，不再管理独立数据库文件
- `createAccountSet()` — 在 accountSets 表插入记录
- `deleteAccountSet()` — 事务删除该账套所有数据（30+表）
- `updateAccountSetName()` — 更新账套名称
- `getAccountSetInfo()` / `getAllAccountSets()` — 查询账套信息
- `exportAccountSetData()` / `importAccountSetData()` — 按账套导出/导入数据

#### 数据库索引
- `lib/database/index.ts` 提供统一入口
- `getCurrentService()` 返回 `sqliteService`
- `getCurrentManager()` 返回 `sqliteManager`
- `sqliteService` 直接导出，用于 store 层同步 `accountSetId`

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

1. **科目选择器** — 统一使用 Popover + Portal 模式（非内联展开）
   - 未选：虚线边框 + 搜索图标 `[🔍 选择科目]`
   - 已选：蓝色代码 + 名称 + × 清除按钮
   - 弹出层：`shadow-xl` + `border-slate-200/80`，支持模糊搜索（按代码或名称实时过滤）
   - Portal渲染：使用 `createPortal` 渲染到 `document.body`，避免被父级 overflow 截断
   - 参考 `business-group-drawer.tsx` 中的 `SubjectPopover` 组件和 `BusinessGroupEditor` 组件

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
- ✅ 银行流水解析器 - 配置驱动，14家内置银行（建行/工行/农行/招行/中行等）
- ✅ 银行格式自动识别 - detectBank 评分检测，自动匹配最佳配置
- ✅ 自定义格式映射向导 - FieldMappingCoach 5步向导，模糊自动匹配列字段（置信度评分）
- ✅ 双层表头合并 - 解析引擎自动合并相邻行表头（如建行格式）
- ✅ 数据起始行设置 - 支持表头与数据之间有空行/小计行的格式
- ✅ 银行账户管理 - 引导式新增向导，编辑模式，Excel批量导入，第15+银行支持
- ✅ 资金管理页 - 多银行汇总表、按月/日筛选、凭证明细弹窗
- ✅ 流水去重 - 导入时按 date+voucherNo+transactionSerialNo 去重，入账时防重复
- ✅ 银行账户名校验 - 导入时检查银行户名与账套公司名是否一致
- ✅ 银行子科目自动匹配 - 导入时自动匹配/创建1002子科目（bankAccountNumber字段）
- ✅ 业务单据号 - 入账凭证docNo使用 账户明细编号-交易流水号
- ✅ 流水匹配规则页UI重构 - Popover科目选择、行内编辑抽屉、搜索过滤、标签化
- ✅ 发票凭证模板引擎集成 - generateInvoiceVoucher 走模板引擎+规则引擎，关键词科目映射，税率匹配，科目校验
- ✅ 发票科目映射规则配置 - InvoiceSubjectConfigDialog 组件，invoice_subject_rules 表持久化，业务组驱动
- ✅ 发票Store数据库统一 - 全部 CRUD 使用 sqliteService（getDb() helper），修复列名不匹配问题，accountSetId同步
- ✅ 业务组优先级功能 - 支持业务组优先级配置，上移/下移调整优先级，列表按优先级排序显示
- ✅ 发票智能规则引擎 - 纯逻辑模块，6种动作类型，条件匹配+动作执行分离
- ✅ 科目下拉选择器 - SubjectPopover组件，支持模糊搜索、Portal渲染、清空选择
- ✅ 供应商矩阵表格 - 白名单改为行=供应商、列=业务组的单选矩阵模式
- ✅ 往来卡片下拉选择 - PartnerPopover组件，供应商名称从往来卡片下拉选择
- ✅ Popover Portal渲染 - 使用createPortal渲染到body，避免overflow截断
- ✅ 业务组编辑面板重构 - 从Drawer抽屉改为弹出式双栏布局（左：基础信息+科目规则+关键词，右：蓝色凭证预览+税金逻辑+操作按钮），Framer Motion动画，计税/自动匹配开关，灰色自动匹配开关
- ✅ 全局设置功能开关 - 配置按钮改为Switch开关（自动税金科目、重复检查、报销人识别）
- ✅ 税金科目自动生成 - 基础科目+税率自动生成完整税金科目代码
- ✅ 供应商重复检查 - 防止添加重复供应商到同一业务组
- ✅ 科目accountSetId同步 - initializeSubjects前同步sqliteService.accountSetId，修复刷新后数据丢失
- ✅ 发票业务组字段 - Invoice.groupName记录匹配的业务组名称，进项/销项发票页面可编辑选择业务组
- ✅ 科目自动创建 - 凭证生成时自动创建不存在的科目（如税金子科目），避免生成失败
- ✅ 发票删除保护 - 已生成凭证的发票不可删除，删除按钮置灰+Toast提示
- ✅ 发票导入业务组匹配 - 3级匹配：供应商白名单→业务组关键词(按优先级)→keywordRules
- ✅ 员工报销不计税 - 业务组taxSubject为空时跳过税金分录，模板引擎过滤空科目
- ✅ 编辑业务组重置修复 - taxSubject/autoTax使用!==undefined替代||，避免空字符串被重置
- ✅ 发票日期显示 - 仅显示年月日(YYYY-MM-DD)，不显示时间
- ✅ 业务组编辑面板重构 - 从Drawer抽屉改为弹出式双栏布局（左：基础信息+科目规则+关键词，右：蓝色凭证预览+税金逻辑+操作按钮），Framer Motion动画，计税/自动匹配开关，灰色自动匹配开关
- ✅ TypeScript错误修复 - supplierType、中文变量名、重复currentPeriod等14个预存错误
- ✅ 供应商自动学习 - 用户手动修改发票业务组时自动保存供应商→业务组映射，下次导入自动匹配
- ✅ 往来卡片联动 - 业务组requirePartnerCard开关控制是否自动创建往来卡片（员工报销默认关闭）
- ✅ 模板引擎自动平衡 - 借贷不平衡时自动调整较小侧而非报错
- ✅ 科目覆盖falsy修复 - 空字符串科目覆盖不再被||回退到默认科目
- ✅ 关键词多词拆分匹配 - "维修费用"拆为"维修"+"费用"分别匹配
- ✅ 凭证摘要业务组名称 - 使用业务组名称替代科目编号作为摘要
- ✅ 凭证列表往来列 - 详情弹窗增加往来/辅助列，显示供应商/客户名称
- ✅ 发票导入自动创建往来卡片 - 匹配业务组后根据requirePartnerCard决定是否创建
- ✅ sql.js参数化查询修复 - 所有Store统一使用db.prepare().run().free()模式，修复固定资产/待摊费用/无形资产Store的数据库操作
- ✅ 固定资产批量标签打印 - 数量>1的资产生成多个标签，格式如"FA0001 1/10"
- ✅ 固定资产入账规则配置 - 双栏布局对话框，Portal科目选择器，折旧参数与科目映射
- ✅ 会计期间endDate修复 - 使用本地日期方法避免toISOString时区问题，提取getMonthEndDate工具函数
- ✅ 资产编号持久化 - 从现有编码提取最大值+1，避免重复编号
- ✅ 资产时序账凭证修正 - VoucherCorrectionDialog组件，红字冲销+蓝字重录引导
- ✅ 固定资产导出优化 - 导出模板使用中文列标题，增加折旧开始/结束日期字段
- ✅ 资产导入模板简化 - 移除费用科目字段，简化导入流程
- ✅ 科目层级计算优化 - 添加科目时优先基于上级科目计算层级（上级层级+1），而非仅根据代码长度
- ✅ 科目分类结转保护 - 科目有下级科目时禁止修改分类/借贷方向，防止会计核算混乱
- ✅ 科目凭证数据保护 - 已有凭证数据的科目禁止修改上级科目，只能禁用
- ✅ 科目编辑警告提示 - 选择上级科目时显示黄色警告，已有凭证时显示红色警告并禁用上级科目选择
- ✅ 工资页面 - 工资计算明细网格、批量导入、计提凭证生成、设置对话框（地区/科目/税率）、员工下拉选择器（Portal渲染）
- ✅ 工资默认设置 - 地区根据公司地址自动推断（inferRegionFromAddress）、计提凭证科目从科目列表自动匹配预填、账套默认科目4级回退
- ✅ 往来单位字段持久化修复 - isEmployee角色丢失（resolvePartnerType未处理）、bankName/defaultSubjectCode/defaultSubjectName未写入INSERT SQL、部门/证件/雇佣日期/工资科目字段全链路持久化
- ✅ 雇员卡片扩展 - 证件类型/证件号码/雇佣开始日期/雇佣结束日期、导入/导出模板含4个新字段、编码自动大写+唯一性校验
- ✅ 数据库迁移补全 - departments/projects表创建迁移加入ensureInitialized()链、partners表bankName列迁移、subjects表type/balance/description/frozen列迁移
- ✅ 快速添加子科目 - 科目树每个节点右侧增加"+"按钮，点击自动生成子科目（继承父科目属性）
- ✅ 默认科目层级修复 - 1503/1702/1703 改为一级科目，避免错误缩进显示
- ✅ 资金管理控制台 - 4区布局（账户选择器+概览卡片+操作中心+日记账明细表），替代原导入页
- ✅ 日记账明细表 - 全字段（序号/日期/摘要/对方账号/对应科目/收入/支出/余额/状态/银行/备注/凭证编号/复选框），内联科目编辑，已入账锁定
- ✅ 凭证印章 - VoucherStamp组件（已入账=红/草稿=灰/审核=蓝/已冲销=深红），凭证详情弹窗右上角显示
- ✅ 期间范围选择 - 从单月选择改为起止期间范围，导入后自动扩展范围覆盖流水日期
- ✅ 凭证生成账期校验 - 预览生成凭证时检查交易日期是否在当前会计期间内
- ✅ 银行科目自动匹配/创建 - 导入时自动匹配ourAccount到1002子科目，不存在则创建（提取为bank-match.ts共享模块）
- ✅ 手动记一笔 - ManualEntryDialog组件，支持手动录入银行流水（source='manual'）
- ✅ 银行列显示 - 通过bank_account_bindings查找BANK_BRANDS显示银行简称（如"建行"）
- ✅ 对方账号字段 - 日记账明细表显示对方户名
- ✅ 状态标签修复 - 已生成凭证显示"已入账"Badge而非凭证号，凭证号改为可点击链接
- ✅ Tab切换修复 - 空数据tab不再隐藏整个tab栏，使用statusCounts判断hasAnyData
- ✅ 代码简化 - 提取bank-match.ts共享模块消除重复，统一formatMoney替代内联formatAmount，清除debug日志
- ✅ 账套隔离架构统一 - 移除独立文件模式，改为共享全局数据库 + accountSetId 过滤单一模式，删除2152行冗余代码
- ✅ 用户管理 - 本地账号密码登录、用户CRUD、启用/禁用、密码重置
- ✅ 权限管理 - 预设角色（管理员/会计/出纳）、自定义角色、权限矩阵配置
- ✅ 权限控制 - usePermission Hook、Sidebar菜单权限过滤、页面按钮权限控制
- ✅ 账套用户授权 - account_set_users 表控制用户对账套的访问和角色
- ✅ 审计日志联动 - 操作记录关联真实用户信息
- ✅ 设置向导 - 10步条件流程（公司→模板→规则→币种→银行→往来→资产→项目→期初→完成），自由导航，条件步骤
- ✅ 纳税人类型与行业税率推荐 - 小规模(3%/1%)、一般纳税人按行业推荐(商贸13%/服务业6%/建筑业9%等)，可手动调整
- ✅ 行业模板 - 科技/制造/服务/餐饮/商贸/建筑6个预设模板，包含科目体系和默认配置
- ✅ 科目自行导入 - 除预设模板外，支持Excel自行导入科目列表（科目代码/名称/借贷方向）
- ✅ 凭证编号设置 - 公司信息步骤可选凭证字（记/收/付/转）、编号周期（按月/按年/连续）、序号位数（3/4/5位），实时预览编号格式，配置写入 voucherNumbering 字段
- ✅ 凭证编号生成集成 - generateVoucherNo 从 currentAccountSet.voucherNumbering 读取配置（word/period/digits），支持按月/按年/连续三种编号周期，按周期自动重置序号
- ✅ 分类凭证字 - 可选开启分类模式：收款用「收」、付款用「付」、转账用「记」，各凭证字独立编号；业务规则步骤配置 useClassified + classifiedWords；generateVoucherNo 支持 voucherType 参数自动选取凭证字
- ✅ 凭证号硬编码统一 - import/page.tsx 和 transaction-import.tsx 统一使用 store 的 generateVoucherNo，消灭 3 处硬编码 `记-` 前缀
- ✅ 资金管理页收款/付款筛选 - 日记账明细表增加全部/收款/付款 Tab 筛选（directionFilter）
- ✅ 期初月结集成 - 期初余额保存后弹出月结向导，对启用月份执行结账确认
- ✅ 核算方式配置 - 往来/银行/固定资产三个维度可选卡片管理或明细科目管理
- ✅ sqlite-service 类型化重构 - 14个域提取到 services/ 模块，`any` 从 169 降到 53，文件从 4634 行降到 3427 行
- ✅ 部门/项目核算开关 - 业务规则步骤可选启用部门核算（含内联部门列表）和项目核算（条件步骤），项目核算启用后新增项目维护步骤

### 待完善功能
1. **凭证记账/冲销** - `voucher-list/page.tsx` 中的 `handlePost`、`handleReverse` 仅弹提示，未调用会计引擎
2. **往来单位合并** - `settings/auxiliary/page.tsx` 显示"合并功能开发中..."
3. **项目删除** - `settings/projects/page.tsx` 未实现删除
4. **自定义报表** - `reports/page.tsx` 3个按钮无 onClick
5. **现金流量表** - 计算逻辑简化，需更复杂分析
6. **模板引擎与银行流水集成** - `template-engine.ts` 的银行模板（bank_deposit/bank_payment）未与银行导入流程集成
7. **往来卡片辅助核算** - 生成凭证时往来科目分录未写入auxiliary字段中的供应商/客户卡片信息（已部分实现：auxiliary存储名称，凭证列表显示往来列）
8. **销项发票业务组** - 销项发票页面暂未实现业务组配置（仅进项发票有业务组规则）
9. **DataAdapter 适配层** - 未来 Electron/服务器双部署需抽象 DataAdapter（LocalAdapter=better-sqlite3, RemoteAdapter=PostgreSQL API）
10. **后端认证** - 当前为本地账号密码，后续对接后端 API 实现手机/邮箱登录
11. **行级权限** - 当前仅菜单/按钮级权限，未来可扩展到数据行级隔离

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
14. **sql.js 参数化查询** - 必须使用 `db.prepare(sql).run(params).free()` 模式
    - ❌ 错误：`db.run(sql, params)` - sql.js 不支持此语法
    - ✅ 正确：`const stmt = db.prepare(sql); stmt.run(params); stmt.free();`
    - 所有 Store（useInvoiceStore、useFixedAssetStore、usePrepaidExpenseStore、useIntangibleAssetStore）已统一使用正确模式

15. **全局 UI 实现标准**
    - **禁用自动填充**：所有 `<Input/>` 和 `<form />` 必须设置 `autoComplete="off"` 或 `autoComplete="new-password"`
    - **关系型字段可搜索**：科目、供应商、部门、项目等字段必须使用 Searchable Combobox（基于 Shadcn Command）
    - **模糊搜索**：支持按名称或代码部分匹配
    - **视觉提示**：可搜索字段必须有放大镜图标前缀
    - **Portal 渲染**：下拉列表必须通过 Portal 渲染，避免被父容器 `overflow: hidden` 截断
    - ✅ 已有组件：`SubjectPopover`（科目）、`PartnerPopover`（往来单位）
    - ✅ 待改造：固定资产卡片中的部门、供应商、科目字段

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
- 智能规则引擎：6种动作类型，按优先级匹配业务组
- 税金科目自动生成：基础科目代码 + 税率 → 完整税金科目（如 2221 + 13%进项 → 22210113）

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
