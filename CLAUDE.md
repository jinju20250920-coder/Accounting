# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**AI 财务 Assistant** - 基于Web的现代会计凭证录入系统

- 框架：Next.js 16 + React 19 + shadcn/ui + Zustand + Tailwind CSS
- 特性：Excel-like网格、凭证导入/流水生成、AI学习功能、凭证冲销、自动化模板引擎、状态机管理
- 数据存储：本地内存存储（当前），支持扩展IndexedDB

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

### 3. 模板驱动自动化凭证生成
- 核心思路：使用 `TemplateEngine` 和 VoucherTemplate 而非硬编码逻辑
- 公式解释器：支持 `{total_amount} * 0.13` 这样的表达式，使用 `FormulaInterpreter` 类
- 模板类型：系统模板（不可修改）和用户自定义模板
- 自动匹配：导入数据时根据 `triggerType` 自动选择模板

---

## 核心功能模块

1. **凭证录入系统** - Excel-like网格界面、分录管理、借贷自动平衡
2. **凭证状态机** - 严格的状态管理：draft → review → posted → reversed
3. **AI智能匹配** - L1关键词规则 + L2用户学习，智能科目推荐
4. **自动化模板引擎** - 基于模板自动生成凭证，支持公式计算
5. **流水导入** - 银行/税务流水导入，智能匹配科目，批量生成凭证
6. **报表查询** - 科目余额表、明细账、资产负债表、损益表、现金流量表
7. **往来管理** - 应收账款账龄、应付账款账龄分析
8. **账套管理** - 多账套支持、期初余额录入、期间管理
9. **基础档案管理** - 科目层级树形显示、新增/编辑/删除/冻结、部门、项目
10. **汇兑损益** - 外币科目、汇率管理、期末自动调汇
11. **期末结转** - 损益结转、年结处理

---

## 目录结构

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── balance/page.tsx
│   ├── reports/
│   ├── sets/page.tsx
│   ├── exchange/page.tsx
│   ├── import/page.tsx
│   └── closing/page.tsx
├── components/
│   ├── ui/          # shadcn/ui组件
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── separator.tsx
│   │   └── tabs.tsx
│   ├── layout/      # 布局组件
│   │   └── sidebar.tsx
│   └── voucher/     # 凭证相关组件
│       ├── auxiliary-selector.tsx
│       └── subject-search.tsx
├── stores/          # Zustand状态管理
│   ├── useVoucherStore.ts
│   ├── useUserPreferenceStore.ts
│   ├── useAuditStore.ts
│   └── useSubjectStore.ts  # 科目管理状态
├── lib/            # 核心业务逻辑
│   ├── accounting.ts      # 会计引擎核心
│   ├── ai-learning.ts    # AI学习模块
│   ├── parser.ts         # Excel解析器
│   ├── template-engine.ts # 自动化模板引擎
│   └── data/             # 数据配置
│       ├── keyword-rules.json  # 关键词匹配规则
│       ├── subjects.json       # 默认科目
│       └── templates.json      # 凭证模板
└── types/
    └── index.ts          # 类型定义
```

---

## 开发命令

```bash
# 安装依赖
npm install @tanstack/react-table lucide-react clsx tailwind-merge

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
- 每个功能模块一个Store，当前已实现：
  - `useVoucherStore`: 凭证录入状态管理
  - `useUserPreferenceStore`: 用户偏好记忆
  - `useAuditStore`: 审计日志追踪
  - `useSubjectStore`: 科目管理状态管理
- 状态管理：当前数据 + Actions方法组合
- 注意：当前版本使用persist中间件，数据保存到localStorage

### 会计引擎 (lib/accounting.ts)
核心会计函数集合：
- `calculateSubjectBalance()` - 计算科目余额（考虑借贷方向）
- `generateVoucherNo()` - 生成凭证字号（年月-序号格式）
- `isVoucherBalanced()` - 检查借贷平衡（0.01容差）
- `getSmartMatch()` - AI智能匹配（L1规则 + L2用户偏好）
- `calculateVoucherStatus()` - 凭证状态机验证
- `createReverseVoucher()` - 创建冲销凭证
- `calculateExchangeGainLoss()` - 汇兑损益计算
- `VoucherStatus` 枚举：DRAFT, REVIEW, POSTED, REVERSED

### 自动化模板引擎 (lib/template-engine.ts)
系统的核心创新点，实现"凭证工厂"概念：

#### 1. 核心组件
- `TemplateEngine` 类：模板管理和凭证生成
- `FormulaInterpreter` 类：安全公式解释器
- `VoucherTemplate` 接口：模板结构定义

#### 2. 模板结构 (VoucherTemplate)
```typescript
{
  id: 'tpl_sale_invoice',
  name: '销售发票确认收入',
  triggerType: 'invoice_import',  // 触发类型
  isSystem: true,                // 系统模板不可修改
  entries: [                     // 模板分录
    {
      id: 'entry_1',
      subject: '1122',
      subjectName: '应收账款',
      direction: 'debit',
      formula: '{total_amount}'   // 支持表达式
    }
  ],
  validations: [                 // 验证规则
    { field: 'total_amount', condition: 'required', message: '金额不能为空' }
  ],
  variables: [                   // 变量定义
    { name: 'total_amount', type: 'number', source: 'extracted' }
  ]
}
```

#### 3. 公式解释器特性
- 支持变量：`{total_amount}`, `{tax_amount}`, `{base_amount}`
- 支持运算：`{total_amount} * 0.13`, `{total_amount} - {tax_amount}`
- 安全计算：过滤危险字符，使用Function构造函数
- 自动提取变量：`extractVariables()` 用于验证

#### 4. 自动化流程
1. 数据导入 → 2. 模板匹配（triggerType）→ 3. 数据验证 → 4. 公式计算 → 5. 借贷平衡检查 → 6. 生成凭证

#### 5. 预设系统模板
- 销售发票（`tpl_sale_invoice`）：应收账款 + 主营业务收入 + 销项税
- 采购发票（`tpl_purchase_invoice`）：材料采购 + 进项税 + 应付账款
- 银行收款（`tpl_bank_deposit`）：银行存款
- 银行付款（`tpl_bank_payment`）：管理费用 + 银行存款

### AI智能匹配架构
实现于 `lib/accounting.ts` 的 `getSmartMatch()` 函数

#### 1. Level 1（规则先行）
- 数据源：`keyword-rules.json` 预设通用规则
- 匹配方式：关键词模糊匹配
- 优先级：1-10，数值越高置信度越高
- 示例规则：
  ```json
  {
    "id": "rule_001",
    "keyword": "房租",
    "subject": "6603",
    "direction": "debit",
    "priority": 9
  }
  ```

#### 2. Level 2（上下文学习）
- 数据源：`useUserPreferenceStore` 用户历史行为
- 记录内容：用户手动修改科目的偏好
- 匹配逻辑：双向匹配
  - 摘要包含用户偏好摘要
  - 用户偏好摘要包含当前摘要
  - 摘要包含用户科目代码
- 时间权重：最近的偏好权重更高

#### 3. 匹配算法
```typescript
// L2匹配优先级更高
const l2Matches = userPrefs.filter(pref =>
  summary.includes(pref.summary) ||
  pref.summary.includes(summary) ||
  summary.includes(pref.subject)
);

// L1规则匹配
const l1Match = rules.find(rule =>
  summary.includes(rule.keyword) ||
  rule.keyword.includes(summary)
);

// 返回结果包含来源信息（rule/user-preference）和置信度
```

### 审计追踪 (useAuditStore)
- 记录所有凭证状态变更
- 追踪用户操作历史
- 支持操作回溯

### UI组件约定
- 使用shadcn/ui组件
- 样式：Tailwind CSS（slate-50背景，white卡片，blue-600主色）
- 响应式：移动端友好
- 状态标识：使用Badge显示凭证状态和匹配来源
- 模板选择器：在导入时自动弹出模板选择对话框

---

## 开发优先级（基于当前代码状态）

### 已实现功能
- ✅ 核心类型定义（types/index.ts）
- ✅ 会计引擎基础功能（lib/accounting.ts）
- ✅ 自动化模板引擎（lib/template-engine.ts）
- ✅ 基础UI组件和布局
- ✅ 凭证录入Store（useVoucherStore）
- ✅ 科目管理Store（useSubjectStore） - 科目层级树形显示、新增/编辑/删除/冻结功能
- ✅ 关键词规则配置

### 待实现功能（按优先级）
1. **凭证录入界面** - 完善voucher-entry-grid组件
2. **科目搜索组件** - 实现subject-search功能
3. **状态机集成** - 将凭证状态管理集成到UI
4. **AI学习功能** - 实现useUserPreferenceStore
5. **审计日志** - 完善useAuditStore
6. **报表查询功能**
7. **流水导入功能**
8. **数据持久化** - 集成IndexedDB
9. **账套管理**
10. **高级功能**（汇兑损益、年结）

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
- ⚠️ 状态管理：部分Store实现，缺少persist中间件
- ⚠️ 错误处理：需要完善全局错误处理
- ❌ 数据持久化：当前仅内存存储

### 代码规范
- 使用ESLint + TypeScript严格模式
- 组件使用PascalCase，文件使用kebab-case
- 常量使用UPPER_SNAKE_CASE
- 接口使用IPascalCase（如IVoucher）
- 工具函数使用lowerCamelCase

### 注意事项

1. **数据持久化** - 使用IndexedDB + localStorage存储所有数据，刷新不丢失
2. **日期格式** - 所有日期使用ISO格式（YYYY-MM-DD）
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
   - ✅ 示例：`showToast('success', '操作成功'); showToast('error', '操作失败');`
   - ✅ Toast 显示在屏幕中央，自动 3 秒后关闭
12. **必填字段标识** - 使用红色 `*` 标记必填字段
   - ✅ 在 `components/ui/label.tsx` 中已实现 `required` 属性支持
   - ✅ 使用方式：`<Label required>字段名称</Label>` 自动显示红色 `*`
   - ✅ 禁止在 label 文本中直接写 `*`，如 `<Label>部门代码 *</Label>` 错误
   - ✅ 红色样式：`text-red-500` (Tailwind CSS)

---

## 创新特性

### 1. 科目层级树形显示
- 层级缩进：一级科目无缩进，二级科目向右缩进24px，三级科目继续缩进
- 展开/折叠：支持点击箭头展开或折叠子科目
- 冻结状态：支持科目冻结，冻结的科目显示特殊标识
- 数据持久化：使用zustand persist中间件，刷新页面不丢失数据

### 2. 双层AI匹配架构
- L1规则库：行业通用规则（keyword-rules.json）
- L2学习库：用户个性化偏好（useUserPreferenceStore）
- 智能排序：用户偏好优先于预设规则
- 持续学习：用户每次修改都记录并优化

### 2. 严格的状态机管理
```mermaid
graph LR
    A[draft] --> B[submit]
    B --> C[approve/post]
    C --> D[posted]
    D --> E[reverse]
    E --> F[reversed]
```
- 不可逆流程：已记账凭证不能直接修改
- 自动冲销：createReverseVoucher()生成红冲凭证
- 状态追踪：完整的状态变更历史
- 错误预防：calculateVoucherStatus()验证操作合法性

### 3. 模板驱动的自动化
- 配置即代码：通过VoucherTemplate配置代替硬编码
- 公式引擎：支持复杂数学表达式和变量计算
- 自动验证：内置验证规则确保数据完整性
- 扩展性强：新增业务类型只需添加模板

### 4. 统一往来单位管理架构
- **单一卡片原则**：一个公司在系统中只有一个唯一ID
- **多身份支持**：通过checkbox同时勾选"客户"、"供应商"或"两者皆是"
- **Tab切换**：全部 | 客户 | 供应商，支持按类型筛选
- **合并/关联功能**：解决历史数据重复问题，可将多个关联ID合并到同一主体
- **明细账合并查看**：支持"显示全部往来"功能，将应收应付数据合并展示

### 5. 模块化架构
- 清晰分层：UI层（components）→ 业务层（lib）→ 数据层（stores）
- 松耦合：各模块独立，便于维护和扩展
- 类型安全：完整的TypeScript类型定义
- 组件复用：shadcn/ui组件库保证UI一致性
- 科目树组件：SubjectTreeNode 组件递归渲染层级结构，使用内联样式动态计算缩进
