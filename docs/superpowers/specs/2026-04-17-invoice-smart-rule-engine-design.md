# Invoice Smart Rule Engine v2.0 Design

**Date:** 2026-04-17
**Status:** Draft
**Scope:** 发票智能规则引擎升级 — 从单一关键词匹配进化为多条件组合引擎

---

## 1. Background

当前发票科目匹配系统（v1.0）仅根据 `goodsName`（货物名称）进行关键词子串匹配，存在以下局限：

- 无法区分同一销方不同用途的发票（如滴滴打车：差旅 vs 通勤）
- 无法利用备注字段信息（报销人、项目名等）
- 无法自动认领辅助核算对象（人员/项目）
- 无法对发票预分拣（采购/报销/固定资产）
- 无法自动生成固定资产卡片

v2.0 将匹配维度从单一字段扩展为多条件组合，并引入动作执行机制。

---

## 2. Architecture Decision

**方案选择：条件 + 动作分离模型（方案 B）**

一条规则 = 一组匹配条件（Conditions）+ 一组执行动作（Actions）。

```
Rule {
  conditions: [
    { field: "goodsName", operator: "contains", values: ["打车","运输"] },
    { field: "sellerName", operator: "contains", values: ["滴滴","出行"] },
    { field: "remark", operator: "contains", values: ["加班"] },
  ],
  conditionLogic: "AND",
  actions: [
    { type: "overrideSubject", slot: "debit", subjectCode: "6602.01" },
    { type: "assignAuxiliary", source: "remark", entityType: "employee", nameList: [...] },
    { type: "markAs", category: "reimbursement" },
    { type: "createFixedAsset", assetCategory: "电子设备", depreciationYears: 3 }
  ]
}
```

**选择理由：**
- 条件/动作分离是经典规则引擎模式，符合 IF/THEN 直觉
- JSON 存储灵活但不过度，财务人员通过 UI 配置无需接触 JSON
- 固定资产卡片生成作为 `createFixedAsset` 动作类型自然融入
- 高度可扩展：新增匹配维度只需加 condition field，新增动作只需加 action type

---

## 3. Data Model

### 3.1 `invoice_smart_rules` 表（替代原 `invoice_subject_rules`）

```sql
CREATE TABLE invoice_smart_rules (
  id TEXT PRIMARY KEY,
  accountSetId TEXT NOT NULL,
  name TEXT NOT NULL,
  invoiceType TEXT NOT NULL DEFAULT 'both',  -- 'input' | 'output' | 'both'，规则级别过滤
  priority INTEGER DEFAULT 0,
  conditions TEXT NOT NULL,     -- JSON array of SmartRuleCondition
  actions TEXT NOT NULL,        -- JSON array of SmartRuleAction
  enabled INTEGER DEFAULT 1,
  createTime TEXT,
  updateTime TEXT
);
CREATE INDEX idx_isr_smart_accountSetId ON invoice_smart_rules(accountSetId);
```

### 3.2 `asset_category_mapping` 表（关键词→资产类别映射）

```sql
CREATE TABLE asset_category_mapping (
  id TEXT PRIMARY KEY,
  accountSetId TEXT NOT NULL,
  keywords TEXT NOT NULL,       -- JSON array, e.g. ["电脑","笔记本"]
  assetCategory TEXT NOT NULL,  -- e.g. "电子设备"
  depreciationYears INTEGER NOT NULL,
  depreciationMethod TEXT DEFAULT 'straight_line',
  subjectCode TEXT NOT NULL,    -- e.g. "1601"
  residualRate REAL DEFAULT 0.05,
  isSystem INTEGER DEFAULT 0,
  createTime TEXT,
  updateTime TEXT
);
CREATE INDEX idx_acm_accountSetId ON asset_category_mapping(accountSetId);
```

### 3.3 TypeScript Types

```typescript
// 匹配条件字段名映射到 Invoice 接口的实际字段名
// 'notes' 对应 Invoice.notes（备注），UI 显示为"备注"
type ConditionField = 'goodsName' | 'sellerName' | 'notes' | 'totalAmount' | 'taxRate';
// 注意：Invoice 接口中备注字段为 'notes'（非 remark），金额字段为 'totalAmount'（非 amount）

interface SmartRuleCondition {
  field: ConditionField;
  operator: 'contains' | 'equals' | '>' | '<' | '>=' | '<=';
  values?: string[];    // for contains/equals (文本匹配)
  value?: number;       // for 数值比较 (totalAmount/taxRate)
}

// 动作类型使用 discriminated union，避免字段名冲突
type SmartRuleAction =
  | OverrideSubjectAction
  | AssignAuxiliaryAction
  | MarkAsAction
  | CreateFixedAssetAction;

interface OverrideSubjectAction {
  type: 'overrideSubject';
  slot: 'debit' | 'tax' | 'credit';   // 必填，语义槽位
  subjectCode: string;                  // 必填
  subjectName: string;                  // 必填
}

interface AssignAuxiliaryAction {
  type: 'assignAuxiliary';
  auxiliaryType: 'employee' | 'project';
  nameList: string[];                   // 白名单
  sourceField: 'notes' | 'sellerName';  // 从哪个字段提取（notes 对应 Invoice.notes）
}

interface MarkAsAction {
  type: 'markAs';
  category: 'purchase' | 'reimbursement' | 'fixed_asset';
}

interface CreateFixedAssetAction {
  type: 'createFixedAsset';
  assetCategory: string;                // 资产类别名称
  depreciationYears: number;
  depreciationMethod: DepreciationMethod; // 使用现有类型
  assetSubjectCode: string;             // 固定资产科目代码
  depreciationSubjectCode: string;      // 累计折旧科目代码
  expenseSubjectCode: string;           // 费用科目代码
  residualRate: number;                 // 残值率（如 0.05）
}

interface InvoiceSmartRule {
  id: string;
  accountSetId: string;
  name: string;
  invoiceType: 'input' | 'output' | 'both';  // 规则级别过滤，同 v1.0
  priority: number;
  conditions: SmartRuleCondition[];
  actions: SmartRuleAction[];
  enabled: boolean;
  createTime: string;
  updateTime: string;
}

interface AssetCategoryMapping {
  id: string;
  accountSetId: string;
  keywords: string[];
  assetCategory: string;
  depreciationYears: number;
  depreciationMethod: string;
  subjectCode: string;
  residualRate: number;
  isSystem: boolean;
  createTime: string;
  updateTime: string;
}
```

---

## 4. Matching Engine

### 4.1 Execution Flow

```
发票导入
  → 遍历规则（按 priority DESC, createTime ASC 排序）
    → 过滤 invoiceType：rule.invoiceType !== 'both' && rule.invoiceType !== invoice.invoiceType → 跳过
    → evaluateConditions(invoice, conditions)
      → AND 逻辑：全部条件为 true 才命中
      → 命中 → 收集该规则所有 actions → 跳出循环（单规则命中）
    → 未命中 → 继续下一条
  → 无命中 → 使用默认科目
  → executeActions(actions, invoice, context)
    → overrideSubject → 通过 slot map 转换为 entry ID，组装科目覆盖映射
    → assignAuxiliary → 查目标科目辅助核算配置 + 从白名单匹配
    → markAs → 更新发票分类标签
    → createFixedAsset → 生成完整 FixedAsset 对象
  → 调用模板引擎生成凭证
```

### 4.2 Condition Evaluation

```typescript
// 字段名映射：条件字段名 → Invoice 接口字段名
const FIELD_MAP: Record<ConditionField, keyof Invoice> = {
  goodsName: 'goodsName',
  sellerName: 'sellerName',
  notes: 'notes',           // Invoice.notes（备注）
  totalAmount: 'totalAmount',
  taxRate: 'taxRate',
};

function evaluateCondition(invoice: Invoice, condition: SmartRuleCondition): boolean {
  const fieldName = FIELD_MAP[condition.field];

  // 文本字段：contains / equals
  if (['goodsName', 'sellerName', 'notes'].includes(condition.field)) {
    const text = (invoice[fieldName] || '').toString().toLowerCase();
    if (condition.operator === 'contains') {
      return (condition.values || []).some(v => text.includes(v.toLowerCase()));
    }
    return (condition.values || []).some(v => text === v.toLowerCase());
  }

  // 数值字段：> / < / >= / <= / equals
  if (['totalAmount', 'taxRate'].includes(condition.field)) {
    const numVal = Number(invoice[fieldName]) || 0;
    return compare(numVal, condition.operator, condition.value ?? 0);
  }

  return false;
}

function evaluateConditions(invoice: Invoice, conditions: SmartRuleCondition[]): boolean {
  if (conditions.length === 0) return false; // 空条件不命中
  return conditions.every(c => evaluateCondition(invoice, c));
}
```

### 4.3 Auxiliary Accounting Resolution

辅助核算的启用判断基于**科目配置**：如果覆盖的目标科目（如 6602.01）配置了辅助核算（`auxiliaryItems` 非空），则该科目需要辅助核算。

```typescript
function resolveAuxiliary(
  invoice: Invoice,
  action: AssignAuxiliaryAction,
  targetSubject: Subject | null  // 覆盖的目标科目
): { value: string | null; needsPrompt: boolean } {
  // 目标科目未配置辅助核算 → 静默跳过
  if (!targetSubject?.auxiliaryItems || targetSubject.auxiliaryItems.length === 0) {
    return { value: null, needsPrompt: false };
  }

  const fieldName = FIELD_MAP[action.sourceField];
  const source = (invoice[fieldName] || '').toString();
  const matched = (action.nameList || []).find(name => source.includes(name));

  // 白名单命中 → 自动填充
  if (matched) {
    return { value: matched, needsPrompt: false };
  }

  // 未命中 → 提示用户手动选择
  return { value: null, needsPrompt: true };
}
```

### 4.4 Fixed Asset Card Generation

生成完整的 `FixedAsset` 对象（匹配 `src/types/index.ts` 第 604 行的接口定义），初始状态为 `active`（未开始折旧即为事实上的草稿）。

```typescript
function buildAssetCard(invoice: Invoice, action: CreateFixedAssetAction): Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> {
  const salvageValue = Math.round(invoice.totalAmount * (action.residualRate ?? 0.05) * 100) / 100;
  const depreciableValue = invoice.totalAmount - salvageValue;

  return {
    assetCode: generateAssetCode(),           // 自动编码，如 FA-YYYYMM-NNN
    assetName: invoice.goodsName || '未命名资产',
    categoryName: action.assetCategory,
    quantity: invoice.quantity ?? 1,
    unit: invoice.unit || '台',
    specification: invoice.specification || '',
    // 财务数据
    originalValue: invoice.totalAmount,
    salvageValue,
    depreciableValue,
    accumulatedDepreciation: 0,
    netValue: invoice.totalAmount,             // 初始净值 = 原值
    // 折旧设置
    depreciationMethod: action.depreciationMethod,
    usefulLifeYears: action.depreciationYears,
    usefulLifeMonths: action.depreciationYears * 12,
    // 日期
    acquisitionDate: invoice.invoiceDate,
    depreciationStartDate: undefined,          // 人工确认后设置
    // 状态
    status: 'active',                         // active 但 depreciationStartDate 为空 = 事实草稿
    // 科目映射
    assetSubjectCode: action.assetSubjectCode,
    depreciationSubjectCode: action.depreciationSubjectCode,
    expenseSubjectCode: action.expenseSubjectCode,
    // 来源信息
    supplierName: invoice.sellerName,
    invoiceNo: invoice.invoiceCode,           // Invoice.invoiceCode（发票号码）
  };
}
```

### 4.5 Subject Override Slot → Template Entry ID Mapping

槽位名称 `debit`/`tax`/`credit` 需要映射到模板引擎的 `entry_1`/`entry_2`/`entry_3`：

```typescript
// 进项发票模板 (tpl_purchase_invoice):
//   entry_1 = debit(费用/采购), entry_2 = debit(进项税), entry_3 = credit(应付)
const INPUT_SLOT_MAP: Record<string, string> = {
  debit: 'entry_1',
  tax: 'entry_2',
  credit: 'entry_3',
};

// 销项发票模板 (tpl_sale_invoice):
//   entry_1 = debit(应收), entry_2 = credit(收入), entry_3 = credit(销项税)
const OUTPUT_SLOT_MAP: Record<string, string> = {
  debit: 'entry_1',
  credit: 'entry_2',
  tax: 'entry_3',
};

function getSlotMap(invoiceType: 'input' | 'output') {
  return invoiceType === 'input' ? INPUT_SLOT_MAP : OUTPUT_SLOT_MAP;
}
```

### 4.6 Engine API

```typescript
// src/lib/invoice-rule-engine.ts

export interface ActionResult {
  subjectOverrides: Record<string, { code: string; name: string }>;
  auxiliaryValue: string | null;
  auxiliaryNeedsPrompt: boolean;
  markCategory: 'purchase' | 'reimbursement' | 'fixed_asset' | null;
  fixedAssetCard: Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> | null;
}

export function matchRule(
  invoice: Invoice,
  rules: InvoiceSmartRule[]
): InvoiceSmartRule | null;

export function evaluateConditions(
  invoice: Invoice,
  conditions: SmartRuleCondition[]
): boolean;

export function executeActions(
  actions: SmartRuleAction[],
  invoice: Invoice,
  context: {
    invoiceType: 'input' | 'output';
    getSubject: (code: string) => Subject | null;
  }
): ActionResult;
```

---

## 5. UI Design

### 5.1 Rule Configuration Dialog (`InvoiceSmartRuleDialog`)

三区域布局：

**区域 1 — 基本信息：** 规则名称、发票类型（进项/销项/通用）、优先级、启用开关

**区域 2 — 匹配条件：** 动态增删条件行
- 字段下拉：货物名称 / 销方名称 / 备注 / 金额 / 发票类型
- 金额条件：操作 `> / < / >= / <=` + 数值输入
- 文本条件：操作 `包含/等于` + 标签式关键词输入
- `[+ 添加条件]` 按钮

**区域 3 — 执行动作：** 动态增删动作面板
- 覆盖科目：借方/税/贷方 三个科目槽位
- 辅助核算认领：类型（人员/项目）、提取来源（备注/销方）、白名单
- 预分拣标记：采购 / 报销 / 固定资产
- 生成固定资产卡片：资产类别（下拉）、折旧年限、折旧方法、残值率

### 5.2 Asset Category Mapping Tab

在配置对话框中新增 Tab「资产类别映射」：

| 资产类别 | 折旧年限 | 方法   | 关键词                 | 标签   |
|---------|---------|--------|----------------------|--------|
| 电子设备 | 3年     | 直线法 | 电脑,笔记本,服务器    | 系统预设 |
| 办公家具 | 5年     | 直线法 | 办公桌,文件柜         | 系统预设 |
| 装修     | 5年     | 直线法 | 装修费,装修工程       | 系统预设 |
| 运输工具 | 4年     | 直线法 | 车辆,汽车             | 系统预设 |

- 系统预设行：紫色标签，不可删除，可编辑折旧年限
- 用户自定义行：蓝色标签，可删除

### 5.3 Rule List Display

每条规则卡片：
- 规则名称 + 优先级（P99）+ 启用状态开关
- 条件摘要：`货物名∈[滴滴,出行] + 销方∈[滴滴] + 备注∈[加班]`
- 动作摘要：`科目→6602.01/2241.01 | 辅助→人员 | 标记→报销`
- 操作：编辑（行内抽屉展开）/ 删除

---

## 6. Integration Points

### 6.1 File Changes

| File | Change | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modify | Add `InvoiceSmartRule`, `SmartRuleCondition`, `SmartRuleAction`, `AssetCategoryMapping` types |
| `src/lib/database/sqlite-service.ts` | Modify | Replace `invoice_subject_rules` with `invoice_smart_rules`, add `asset_category_mapping` table, update CRUD |
| `src/lib/invoice-rule-engine.ts` | **New** | Standalone matching engine: condition evaluation, action execution, asset card generation |
| `src/stores/useInvoiceStore.ts` | Modify | `generateInvoiceVoucher` calls new engine, handles `assignAuxiliary` and `createFixedAsset` |
| `src/components/invoice-subject-config-dialog.tsx` | Rewrite | → `InvoiceSmartRuleDialog`, 3-zone layout + asset mapping tab |
| `src/stores/useFixedAssetStore.ts` | Modify | Add `createFromInvoice()` method |
| `src/app/invoices/input/page.tsx` | Modify | Replace dialog component reference |
| `src/app/invoices/output/page.tsx` | Modify | Replace dialog component reference |

### 6.2 Call Chain

```
useInvoiceStore.generateInvoiceVoucher(invoice)
  → rules = sqliteService.getSmartRules()
  → matchedRule = invoiceRuleEngine.matchRule(invoice, rules)
     // matchRule 内部先按 invoiceType 过滤规则，再评估 conditions
  → if matchedRule:
      actionResult = invoiceRuleEngine.executeActions(
        matchedRule.actions, invoice,
        { invoiceType: invoice.invoiceType, getSubject: subjectStore.getByCode }
      )
      → subjectOverrides → template engine (key = slot map 转换后的 entry_1/2/3)
      → auxiliaryNeedsPrompt → prompt user with auxiliary selector
      → fixedAssetCard → fixedAssetStore.addAsset(card)
      → markCategory → update invoice.category field
  → templateEngine.generateVoucherWithOverrides(...)
```

### 6.3 Database Migration

```typescript
// Development stage: direct DROP and recreate
DROP TABLE IF EXISTS invoice_subject_rules;
CREATE TABLE invoice_smart_rules (...);
CREATE TABLE asset_category_mapping (...);
INSERT INTO asset_category_mapping -- 4 system presets (电子设备/办公家具/装修/运输工具)
```

---

## 7. Edge Cases and Error Handling

### 7.1 Edge Cases

| Scenario | Handling |
|----------|----------|
| Empty conditions array | Skip rule, never match |
| Multiple rules with same priority | Sort by createTime ASC, first wins |
| Amount condition with null invoice amount | Condition evaluates false |
| Empty auxiliary nameList | Skip assignment, check accountSet config for prompt |
| Empty remark/sellerName on invoice | contains on empty string, no match |
| Fixed asset action with amount ≤ 0 | Skip card generation, Toast warning |
| Asset category not found in mapping | Default to 5 years depreciation |
| Subject code does not exist | Auto-create with direction from first digit |

### 7.2 Error Handling

- Rule evaluation exceptions: catch per-rule, skip, continue matching
- Action execution exceptions: catch per-action, skip, earlier actions not rolled back
- Template engine failure: return error, no voucher generated

### 7.3 Key Design Decisions

1. **Single rule match**: Only the highest-priority matched rule applies (no multi-rule stacking)
2. **Actions execute in order**: overrideSubject → assignAuxiliary → markAs → createFixedAsset
3. **Fixed asset cards use `status: 'active'`**: `AssetStatus` 类型无 `draft` 值，使用 `active` + `depreciationStartDate` 为空表示未开始折旧（事实草稿）
4. **Auxiliary accounting**: White list matching + 目标科目的 auxiliaryItems 配置决定是否需要提示
5. **Auxiliary not matched + subject requires auxiliary**: Prompt user to select from partner list, do not block voucher creation
6. **overrideSubject without slot**: Discriminated union 使 slot 为必填，不会出现缺失情况
7. **Field name alignment**: 条件字段 `notes` 对应 `Invoice.notes`（非 remark），`totalAmount` 对应 `Invoice.totalAmount`（非 amount）

---

## 8. Out of Scope (YAGNI)

- OR condition logic (v2.0 AND only)
- Rule grouping/nesting
- Rule version management
- Rule import/export
- Rule simulation/testing UI

These may be added in future iterations based on user feedback.
