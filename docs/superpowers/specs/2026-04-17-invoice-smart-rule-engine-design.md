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
  priority INTEGER DEFAULT 0,
  conditionLogic TEXT DEFAULT 'AND',
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
interface SmartRuleCondition {
  field: 'goodsName' | 'sellerName' | 'remark' | 'amount' | 'invoiceType';
  operator: 'contains' | 'equals' | '>' | '<' | '>=' | '<=';
  values?: string[];    // for contains/equals
  value?: number;       // for amount comparisons
}

interface SmartRuleAction {
  type: 'overrideSubject' | 'assignAuxiliary' | 'markAs' | 'createFixedAsset';

  // overrideSubject
  slot?: 'debit' | 'tax' | 'credit';
  subjectCode?: string;
  subjectName?: string;

  // assignAuxiliary
  auxiliaryType?: 'employee' | 'project';
  nameList?: string[];
  sourceField?: 'remark' | 'sellerName';

  // markAs
  category?: 'purchase' | 'reimbursement' | 'fixed_asset';

  // createFixedAsset
  assetCategory?: string;
  depreciationYears?: number;
  depreciationMethod?: 'straight_line' | 'double_declining' | 'sum_of_years';
  subjectCode?: string;
  residualRate?: number;
}

interface InvoiceSmartRule {
  id: string;
  accountSetId: string;
  name: string;
  priority: number;
  conditionLogic: 'AND';
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
    → evaluateConditions(invoice, conditions)
      → AND 逻辑：全部条件为 true 才命中
      → 命中 → 收集该规则所有 actions → 跳出循环（单规则命中）
    → 未命中 → 继续下一条
  → 无命中 → 使用默认科目
  → executeActions(actions, invoice, context)
    → overrideSubject → 组装科目覆盖映射
    → assignAuxiliary → 从白名单匹配辅助核算对象
    → markAs → 更新发票分类标签
    → createFixedAsset → 生成固定资产卡片（草稿）
  → 调用模板引擎生成凭证
```

### 4.2 Condition Evaluation

```typescript
function evaluateCondition(invoice, condition: SmartRuleCondition): boolean {
  switch (condition.field) {
    case 'goodsName':
    case 'sellerName':
    case 'remark': {
      const text = (invoice[condition.field] || '').toLowerCase();
      return condition.operator === 'contains'
        ? (condition.values || []).some(v => text.includes(v.toLowerCase()))
        : (condition.values || []).some(v => text === v.toLowerCase());
    }
    case 'amount': {
      const amount = invoice.totalAmount ?? 0;
      return compare(amount, condition.operator, condition.value ?? 0);
    }
    case 'invoiceType':
      return invoice.invoiceType === condition.value;
  }
}

function evaluateConditions(invoice, conditions: SmartRuleCondition[], logic: 'AND'): boolean {
  if (conditions.length === 0) return false; // 空条件不命中
  return conditions.every(c => evaluateCondition(invoice, c));
}
```

### 4.3 Auxiliary Accounting Resolution

```typescript
function resolveAuxiliary(
  invoice, action: SmartRuleAction, accountSetConfig
): { value: string | null; needsPrompt: boolean } {
  // 账套未启用辅助核算 → 静默跳过
  if (!accountSetConfig.auxiliaryEnabled) {
    return { value: null, needsPrompt: false };
  }

  const source = invoice[action.sourceField] || '';
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

```typescript
function buildAssetCard(invoice, action: SmartRuleAction): FixedAssetCard {
  return {
    name: invoice.goodsName,
    originalValue: invoice.totalAmount,
    purchaseDate: invoice.invoiceDate,
    depreciationStartDate: invoice.invoiceDate,
    category: action.assetCategory,
    depreciationYears: action.depreciationYears ?? 5,
    depreciationMethod: action.depreciationMethod || 'straight_line',
    supplierName: invoice.sellerName,
    invoiceNo: invoice.invoiceNumber,
    residualRate: action.residualRate ?? 0.05,
    status: 'draft',
  };
}
```

### 4.5 Engine API

```typescript
// src/lib/invoice-rule-engine.ts

export interface ActionResult {
  subjectOverrides: Record<string, { code: string; name: string }>;
  auxiliaryValue: string | null;
  auxiliaryNeedsPrompt: boolean;
  markCategory: 'purchase' | 'reimbursement' | 'fixed_asset' | null;
  fixedAssetCard: FixedAssetCard | null;
}

export function matchRule(
  invoice: Invoice,
  rules: InvoiceSmartRule[]
): InvoiceSmartRule | null;

export function evaluateConditions(
  invoice: Invoice,
  conditions: SmartRuleCondition[],
  logic: 'AND'
): boolean;

export function executeActions(
  actions: SmartRuleAction[],
  invoice: Invoice,
  context: { accountSetConfig: any }
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
  → result = invoiceRuleEngine.matchRule(invoice, rules)
  → if matched:
      actionResult = invoiceRuleEngine.executeActions(rule.actions, invoice, ctx)
      → subjectOverrides → template engine
      → auxiliaryNeedsPrompt → prompt user with auxiliary selector
      → fixedAssetCard → fixedAssetStore.createFromInvoice(card)
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
3. **Fixed asset cards always draft**: Auto-created but require manual confirmation before depreciation starts
4. **Auxiliary accounting**: White list matching + accountSet config controls prompting behavior
5. **Auxiliary not matched + accountSet enabled**: Prompt user to select from partner list, do not block voucher creation

---

## 8. Out of Scope (YAGNI)

- OR condition logic (v2.0 AND only)
- Rule grouping/nesting
- Rule version management
- Rule import/export
- Rule simulation/testing UI

These may be added in future iterations based on user feedback.
