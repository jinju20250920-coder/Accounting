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

### 3.2 `supplier_subject_mapping` 表（供应商白名单 + 类型 + 科目映射）

以供应商白名单为第一道分水岭：在白名单中 → 采购类；不在白名单中 → 报销/固定资产类。供应商类型决定具体科目。

```sql
CREATE TABLE supplier_subject_mapping (
  id TEXT PRIMARY KEY,
  accountSetId TEXT NOT NULL,
  groupName TEXT NOT NULL,          -- 映射组名，如"原材料供应商"、"库存商品供应商"
  sellerName TEXT NOT NULL,         -- 供应商全称（精确匹配）
  supplierType TEXT NOT NULL DEFAULT 'material',  -- 供应商类型：
                                   -- 'material'(原材料) | 'inventory'(库存商品) | 'fixed_asset'(固定资产) | 'service'(服务) | 'other'(其他)
  -- 该供应商的默认科目覆盖（可选，不填则由 supplierType 的默认配置决定）
  defaultDebitSubject TEXT,
  defaultDebitSubjectName TEXT,
  defaultTaxSubject TEXT,
  defaultTaxSubjectName TEXT,
  defaultCreditSubject TEXT,
  defaultCreditSubjectName TEXT,
  createTime TEXT,
  updateTime TEXT
);
CREATE INDEX idx_ssm_accountSetId ON supplier_subject_mapping(accountSetId);
CREATE INDEX idx_ssm_groupName ON supplier_subject_mapping(accountSetId, groupName);
CREATE INDEX idx_ssm_sellerName ON supplier_subject_mapping(accountSetId, sellerName);
```

**供应商类型与默认科目映射**：

| supplierType | 说明 | 默认借方 | 默认贷方 |
|-------------|------|---------|---------|
| `material` | 原材料供应商 | 1403 原材料 | 2202 应付账款 |
| `inventory` | 库存商品供应商 | 1405 库存商品 | 2202 应付账款 |
| `fixed_asset` | 固定资产供应商 | 1601 固定资产 | 2202 应付账款 |
| `service` | 服务供应商 | 6602 管理费用 | 2202 应付账款 |
| `other` | 其他 | 1401 材料采购 | 2202 应付账款 |

### 3.3 `expense_reimbursement` 表（费用发票清单 — 报销人关联）

独立导入费用清单（Excel），按发票号关联报销人。导入顺序不固定，凭证生成时合并。

```sql
CREATE TABLE expense_reimbursement (
  id TEXT PRIMARY KEY,
  accountSetId TEXT NOT NULL,
  invoiceCode TEXT NOT NULL,        -- 发票号码（关联 Invoice.invoiceCode）
  reimburserName TEXT NOT NULL,     -- 报销人姓名
  reimburserId TEXT,                -- 往来单位ID（关联 partner，自动匹配/创建）
  notes TEXT,                       -- 备注
  importBatchId TEXT,               -- 导入批次ID
  createTime TEXT,
  updateTime TEXT
);
CREATE INDEX idx_er_accountSetId ON expense_reimbursement(accountSetId);
CREATE INDEX idx_er_invoiceCode ON expense_reimbursement(accountSetId, invoiceCode);
```

### 3.4 `expense_keyword_categories` 表（报销关键词库）

内置常见报销关键词分类表，用于判断发票是否属于报销类，触发辅助核算偏移。

```sql
CREATE TABLE expense_keyword_categories (
  id TEXT PRIMARY KEY,
  accountSetId TEXT NOT NULL,
  category TEXT NOT NULL,           -- 分类：餐饮/交通/通讯/住宿/办公
  keywords TEXT NOT NULL,           -- JSON array, e.g. ["打车","滴滴","出行"]
  expenseSubjectCode TEXT,          -- 默认费用科目，如 6602.03(差旅费)
  expenseSubjectName TEXT,
  isSystem INTEGER DEFAULT 0,       -- 系统预设不可删
  enabled INTEGER DEFAULT 1,
  createTime TEXT,
  updateTime TEXT
);
CREATE INDEX idx_ekc_accountSetId ON expense_keyword_categories(accountSetId);
```

系统预设分类：

| 分类 | 关键词 | 默认费用科目 |
|------|--------|-------------|
| 交通 | 打车,滴滴,出行,运输,加油,油费 | 6602.01 差旅费 |
| 餐饮 | 餐费,餐饮,招待,宴请,食品 | 6602.02 业务招待费 |
| 通讯 | 话费,通讯,电信,移动,联通 | 6602.03 办公费 |
| 住宿 | 住宿,酒店,宾馆,旅馆 | 6602.01 差旅费 |
| 办公 | 办公,文具,打印,耗材 | 6602.03 办公费 |

### 3.5 `auxiliary_strategy_config` 表（全局辅助核算策略）

```sql
CREATE TABLE auxiliary_strategy_config (
  id TEXT PRIMARY KEY,
  accountSetId TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'auxiliary',  -- 'auxiliary'(辅助核算) | 'sub_account'(科目明细化)
  autoCreatePartner INTEGER DEFAULT 1,     -- 往来卡片不存在时自动创建
  autoDisableAuxiliaryOnSubAccount INTEGER DEFAULT 1, -- 子科目存在时自动关闭辅助核算
  updateTime TEXT
);
```

**两种互斥模式**：
- `auxiliary`：使用辅助核算维度，如 `1201 应收账款` + 辅助核算 `A公司`
- `sub_account`：科目明细化，如 `112201 应收-A公司`，每家供应商一个末级科目

### 3.6 `asset_category_mapping` 表（关键词→资产类别映射）

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

### 3.4 TypeScript Types

```typescript
// 匹配条件字段
// 'notes' 对应 Invoice.notes（备注），UI 显示为"备注"
// 'totalAmount' 对应 Invoice.totalAmount，'taxRate' 对应 Invoice.taxRate
// 'supplierInList' 特殊条件：精确匹配供应商映射表中的名单
type ConditionField = 'goodsName' | 'sellerName' | 'notes' | 'totalAmount' | 'taxRate' | 'supplierInList';

// 条件类型使用 discriminated union
type SmartRuleCondition =
  | TextCondition
  | NumericCondition
  | SupplierListCondition;

interface TextCondition {
  field: 'goodsName' | 'sellerName' | 'notes';
  operator: 'contains' | 'equals';
  values: string[];    // 关键词列表
}

interface NumericCondition {
  field: 'totalAmount' | 'taxRate';
  operator: '>' | '<' | '>=' | '<=' | 'equals';
  value: number;
}

interface SupplierListCondition {
  field: 'supplierInList';
  groupName: string;   // 引用 supplier_subject_mapping 中的映射组名
}

// 动作类型使用 discriminated union，避免字段名冲突
type SmartRuleAction =
  | OverrideSubjectAction
  | AssignAuxiliaryAction
  | MarkAsAction
  | CreateFixedAssetAction
  | SupplierSubjectAction
  | ReimbursementSubjectAction;

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

// 供应商映射科目覆盖：使用供应商映射表中的默认科目，优先于规则中其他 overrideSubject
interface SupplierSubjectAction {
  type: 'supplierSubject';
  groupName: string;                    // 引用 supplier_subject_mapping 映射组名
}

// 报销科目覆盖：将贷方科目替换为"其他应付款-报销人"，并自动关联/创建往来卡片
// 仅当费用清单中存在该发票号的报销人记录时生效
interface ReimbursementSubjectAction {
  type: 'reimbursementSubject';
  creditSubjectCode: string;            // 报销贷方科目（如 "2241" 其他应付款）
  creditSubjectName: string;            // 科目名称
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

interface ExpenseKeywordCategory {
  id: string;
  accountSetId: string;
  category: string;              // 餐饮/交通/通讯/住宿/办公
  keywords: string[];
  expenseSubjectCode?: string;   // 默认费用科目
  expenseSubjectName?: string;
  isSystem: boolean;
  enabled: boolean;
  createTime: string;
  updateTime: string;
}

interface AuxiliaryStrategyConfig {
  id: string;
  accountSetId: string;
  mode: 'auxiliary' | 'sub_account';
  autoCreatePartner: boolean;
  autoDisableAuxiliaryOnSubAccount: boolean;
  updateTime: string;
}

type SupplierType = 'material' | 'inventory' | 'fixed_asset' | 'service' | 'other';

interface SupplierSubjectMapping {
  id: string;
  accountSetId: string;
  groupName: string;                    // 映射组名
  sellerName: string;                   // 供应商全称（精确匹配）
  supplierType: SupplierType;           // 供应商类型
  defaultDebitSubject?: string;
  defaultDebitSubjectName?: string;
  defaultTaxSubject?: string;
  defaultTaxSubjectName?: string;
  defaultCreditSubject?: string;
  defaultCreditSubjectName?: string;
  createTime: string;
  updateTime: string;
}

interface ExpenseReimbursement {
  id: string;
  accountSetId: string;
  invoiceCode: string;                  // 发票号码，关联 Invoice.invoiceCode
  reimburserName: string;               // 报销人姓名
  reimburserId?: string;                // 往来单位ID（自动匹配/创建）
  notes?: string;
  importBatchId?: string;
  createTime: string;
  updateTime: string;
}
```

---

## 4. Matching Engine

### 4.1 Execution Flow

```
发票导入
  → 第一道分水岭：查供应商白名单
    → 销方在白名单中 → 采购类
      → 根据 supplierType 决定科目（material→原材料, inventory→库存商品, fixed_asset→固定资产...）
      → 固定资产类型 → 额外生成资产卡片
      → 贷方辅助核算指向供应商
    → 销方不在白名单中 → 检查关键词库
      → 命中固定资产关键词 → 固定资产类 → 生成资产卡片
      → 命中报销关键词 → 报销类 → 贷方偏移至报销人
      → 都未命中 → 默认报销类（兜底）
  → 遍历规则（按 priority DESC, createTime ASC 排序）
    → 过滤 invoiceType
    → evaluateConditions(invoice, conditions, supplierMappings)
      → 命中 → 收集 actions → 跳出循环
  → executeActions(actions, invoice, context)
    → resolveAuxiliaryStrategy → 根据全局策略 + 分类结果决定辅助核算
    → supplierSubject / reimbursementSubject → 科目覆盖
    → overrideSubject → 规则级科目覆盖
    → markAs → 标记分类（purchase / reimbursement / fixed_asset）
    → createFixedAsset → 生成资产卡片
  → 调用模板引擎生成凭证
```

### 4.2 Condition Evaluation

```typescript
// 字段名映射：文本/数值条件字段 → Invoice 接口字段名
const FIELD_MAP = {
  goodsName: 'goodsName',
  sellerName: 'sellerName',
  notes: 'notes',           // Invoice.notes（备注）
  totalAmount: 'totalAmount',
  taxRate: 'taxRate',
} as const;

function evaluateCondition(
  invoice: Invoice,
  condition: SmartRuleCondition,
  supplierMappings: SupplierSubjectMapping[]
): boolean {
  // 供应商名单匹配：精确匹配 invoice.sellerName 是否在指定映射组中
  if (condition.field === 'supplierInList') {
    return supplierMappings
      .filter(m => m.groupName === condition.groupName)
      .some(m => m.sellerName === invoice.sellerName);
  }

  // 文本字段：contains / equals
  if ('values' in condition && ['goodsName', 'sellerName', 'notes'].includes(condition.field)) {
    const fieldName = FIELD_MAP[condition.field as keyof typeof FIELD_MAP];
    const text = (invoice[fieldName] || '').toString().toLowerCase();
    const op = (condition as TextCondition).operator;
    if (op === 'contains') {
      return condition.values.some(v => text.includes(v.toLowerCase()));
    }
    return condition.values.some(v => text === v.toLowerCase());
  }

  // 数值字段：> / < / >= / <= / equals
  if ('value' in condition && ['totalAmount', 'taxRate'].includes(condition.field)) {
    const fieldName = FIELD_MAP[condition.field as keyof typeof FIELD_MAP];
    const numVal = Number(invoice[fieldName]) || 0;
    return compare(numVal, condition.operator, condition.value);
  }

  return false;
}

function evaluateConditions(
  invoice: Invoice,
  conditions: SmartRuleCondition[],
  supplierMappings: SupplierSubjectMapping[]
): boolean {
  if (conditions.length === 0) return false; // 空条件不命中
  return conditions.every(c => evaluateCondition(invoice, c, supplierMappings));
}
```

### 4.3 Auxiliary Accounting Resolution（辅助核算偏移策略）

辅助核算行为由**全局策略**（`auxiliary_strategy_config`）和**科目配置**共同决定。

#### 三种场景的核算对象偏移

| 发票类型 | 核算对象指向 | 逻辑 |
|---------|------------|------|
| 采购/原材料 | 销方（供应商） | 贷方辅助核算 = 发票销方名称 |
| 报销/差旅 | 报销人（员工） | 贷方辅助核算 = 费用清单中的报销人 |
| 资产/设备 | 资产卡片 | 固定资产卡片，无辅助核算 |

#### 报销类判断

```typescript
function detectExpenseCategory(
  invoice: Invoice,
  expenseKeywords: ExpenseKeywordCategory[]
): ExpenseKeywordCategory | null {
  const goodsName = (invoice.goodsName || '').toLowerCase();
  return expenseKeywords
    .filter(ek => ek.enabled)
    .find(ek => ek.keywords.some(kw => goodsName.includes(kw.toLowerCase())))
    ?? null;
}
```

#### 辅助核算解析

```typescript
interface AuxiliaryResult {
  debitAuxiliary: string | null;     // 借方辅助核算值
  creditAuxiliary: string | null;    // 贷方辅助核算值
  debitNeedsPrompt: boolean;
  creditNeedsPrompt: boolean;
  auxiliaryDisabled: boolean;        // 子科目模式，该行不需要辅助核算
}

function resolveAuxiliaryStrategy(
  invoice: Invoice,
  context: {
    strategy: AuxiliaryStrategyConfig;
    debitSubject: Subject | null;
    creditSubject: Subject | null;
    expenseCategory: ExpenseKeywordCategory | null;  // 报销关键词库匹配结果
    reimburserName: string | null;                     // 费用清单中的报销人
    supplierMappings: SupplierSubjectMapping[];
  }
): AuxiliaryResult {
  const result: AuxiliaryResult = {
    debitAuxiliary: null,
    creditAuxiliary: null,
    debitNeedsPrompt: false,
    creditNeedsPrompt: false,
    auxiliaryDisabled: false,
  };

  // === 子科目模式 ===
  if (context.strategy.mode === 'sub_account') {
    // 科目已是子科目（如 112201 应收-A公司）→ 不需要辅助核算
    // 判断依据：科目代码长度 > 父级代码 且 无 auxiliaryItems 配置
    const isSubAccount = (subject: Subject | null) =>
      subject && !subject.auxiliaryItems?.length;

    if (isSubAccount(context.debitSubject)) {
      result.auxiliaryDisabled = true; // 借方不需要辅助
    }
    if (isSubAccount(context.creditSubject)) {
      result.auxiliaryDisabled = true; // 贷方不需要辅助
    }
    return result;
  }

  // === 辅助核算模式 ===
  // 借方辅助核算：报销类 → 费用类型对应的辅助维度
  if (context.debitSubject?.auxiliaryItems?.length) {
    if (context.expenseCategory) {
      // 报销类：借方辅助核算 = 费用类型（餐饮/交通/住宿...）
      result.debitAuxiliary = context.expenseCategory.category;
    } else {
      result.debitNeedsPrompt = true;
    }
  }

  // 贷方辅助核算：根据发票类型决定指向
  if (context.creditSubject?.auxiliaryItems?.length) {
    if (context.expenseCategory && context.reimburserName) {
      // 报销类 + 有报销人 → 偏移至报销人
      result.creditAuxiliary = context.reimburserName;
    } else {
      // 采购类 → 指向销方
      result.creditAuxiliary = invoice.sellerName || null;
      if (!result.creditAuxiliary) {
        result.creditNeedsPrompt = true;
      }
    }
  }

  return result;
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

### 4.5 Reimbursement Subject Resolution

报销类发票的核心逻辑：贷方科目从"应付账款-供应商"变为"其他应付款-报销人"。

```typescript
interface ReimbursementResult {
  creditOverride: { code: string; name: string } | null;
  reimburserName: string | null;
  partnerCreated: boolean;            // 是否自动创建了往来卡片
}

function resolveReimbursement(
  invoice: Invoice,
  action: ReimbursementSubjectAction,
  expenseList: ExpenseReimbursement[],
  slotMap: Record<string, string>
): ReimbursementResult {
  // 按发票号查找报销人
  const record = expenseList.find(
    r => r.invoiceCode === invoice.invoiceCode
  );

  if (!record) {
    // 费用清单中没有该发票 → 跳过报销处理
    return { creditOverride: null, reimburserName: null, partnerCreated: false };
  }

  // 确保报销人存在往来卡片
  let partnerId = record.reimburserId;
  let partnerCreated = false;

  if (!partnerId) {
    // 查找或创建往来卡片
    const existing = partnerStore.findByName(record.reimburserName);
    if (existing) {
      partnerId = existing.id;
    } else {
      // 自动创建个人类型往来卡片
      const newPartner = partnerStore.addPartner({
        name: record.reimburserName,
        type: 'individual',       // 个人类型
        isCustomer: false,
        isSupplier: false,
        isEmployee: true,         // 标记为员工
      });
      partnerId = newPartner.id;
      partnerCreated = true;
    }
    // 更新报销记录的 reimburserId
    sqliteService.updateExpenseReimbursement(record.id, { reimburserId: partnerId });
  }

  return {
    creditOverride: {
      code: action.creditSubjectCode,      // e.g. "2241"
      name: `${action.creditSubjectName}-${record.reimburserName}`,  // "其他应付款-张三"
    },
    reimburserName: record.reimburserName,
    partnerCreated,
  };
}
```

### 4.6 Subject Override Slot → Template Entry ID Mapping

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

### 4.6 Supplier Subject Resolution

供应商映射表的科目覆盖优先级高于规则中的 `overrideSubject`，因为供应商级别的配置更具体：

```typescript
function resolveSupplierSubject(
  invoice: Invoice,
  action: SupplierSubjectAction,
  supplierMappings: SupplierSubjectMapping[],
  slotMap: Record<string, string>
): Record<string, { code: string; name: string }> {
  const mapping = supplierMappings.find(
    m => m.groupName === action.groupName && m.sellerName === invoice.sellerName
  );
  if (!mapping) return {};

  const overrides: Record<string, { code: string; name: string }> = {};
  if (mapping.defaultDebitSubject) {
    overrides[slotMap['debit']] = { code: mapping.defaultDebitSubject, name: mapping.defaultDebitSubjectName || '' };
  }
  if (mapping.defaultTaxSubject) {
    overrides[slotMap['tax']] = { code: mapping.defaultTaxSubject, name: mapping.defaultTaxSubjectName || '' };
  }
  if (mapping.defaultCreditSubject) {
    overrides[slotMap['credit']] = { code: mapping.defaultCreditSubject, name: mapping.defaultCreditSubjectName || '' };
  }
  return overrides;
}
```

**科目覆盖优先级**：报销科目 (`reimbursementSubject`) > 供应商映射 (`supplierSubject`) > 规则内 `overrideSubject` > 模板默认

报销科目仅覆盖 credit 槽位，不影响 debit/tax。供应商映射和 overrideSubject 可覆盖所有槽位。

### 4.8 Engine API

```typescript
// src/lib/invoice-rule-engine.ts

export interface ActionResult {
  subjectOverrides: Record<string, { code: string; name: string }>;
  auxiliaryValue: string | null;
  auxiliaryNeedsPrompt: boolean;
  markCategory: 'purchase' | 'reimbursement' | 'fixed_asset' | null;
  fixedAssetCard: Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> | null;
  reimburserName: string | null;       // 报销人姓名（来自费用清单）
  partnerCreated: boolean;             // 是否自动创建了往来卡片
}

export function matchRule(
  invoice: Invoice,
  rules: InvoiceSmartRule[],
  supplierMappings: SupplierSubjectMapping[]
): InvoiceSmartRule | null;

export function evaluateConditions(
  invoice: Invoice,
  conditions: SmartRuleCondition[],
  supplierMappings: SupplierSubjectMapping[]
): boolean;

export function executeActions(
  actions: SmartRuleAction[],
  invoice: Invoice,
  context: {
    invoiceType: 'input' | 'output';
    getSubject: (code: string) => Subject | null;
    supplierMappings: SupplierSubjectMapping[];
    expenseList: ExpenseReimbursement[];  // 费用清单
  }
): ActionResult;
```

---

## 5. UI Design

### 5.1 Rule Configuration Dialog (`InvoiceSmartRuleDialog`)

五个 Tab 页布局：

**Tab 0 — 辅助核算策略**（全局设置）

```
┌──────────────────────────────────────────────────────┐
│ 全局辅助核算策略                                       │
│                                                        │
│ 核算模式: (●) 辅助核算  ( ) 科目明细化                  │
│                                                        │
│ [X] 子科目存在时自动关闭辅助核算                         │
│ [X] 往来卡片不存在时自动创建                             │
│                                                        │
│ 核算对象偏移规则                                        │
│ ┌──────────┬──────────────────┬──────────────┐       │
│ │ 发票类型  │ 触发条件          │ 核算对象指向   │       │
│ ├──────────┼──────────────────┼──────────────┤       │
│ │ 采购/原材料│ 供应商在白名单中   │ → 销方       │       │
│ │ 报销/差旅  │ 类别:餐饮/交通/通讯 │ → 报销人     │       │
│ │ 资产/设备  │ 金额>5000+关键词  │ → 资产卡片   │       │
│ └──────────┴──────────────────┴──────────────┘       │
│                                                        │
│ 报销关键词库（内置）                                     │
│ ┌──────────┬────────────────────┬──────────────┐     │
│ │ 分类      │ 关键词              │ 默认费用科目   │     │
│ ├──────────┼────────────────────┼──────────────┤     │
│ │ 交通 [系统]│ 打车,滴滴,出行,加油  │ 6602.01 差旅 │     │
│ │ 餐饮 [系统]│ 餐费,餐饮,招待,宴请  │ 6602.02 招待 │     │
│ │ 通讯 [系统]│ 话费,通讯,电信      │ 6602.03 办公 │     │
│ │ [+ 添加分类]                                   │     │
│ └──────────┴────────────────────┴──────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Tab 1 — 规则配置**（核心编辑页）

**区域 1 — 基本信息：** 规则名称、发票类型（进项/销项/通用）、优先级、启用开关

**区域 2 — 匹配条件：** 动态增删条件行
- 字段下拉：货物名称 / 销方名称 / 备注 / 金额 / 税率 / 供应商名单
- 文本条件：操作 `包含/等于` + 标签式关键词输入
- 数值条件：操作 `> / < / >= / <=` + 数值输入
- 供应商名单条件：下拉选择已有的供应商映射组名
- `[+ 添加条件]` 按钮

**区域 3 — 执行动作：** 动态增删动作面板
- 覆盖科目：借方/税/贷方 三个科目槽位
- 供应商科目覆盖：下拉选择映射组名（使用该供应商的默认科目）
- 报销科目覆盖：贷方科目（如"其他应付款"），自动按发票号查费用清单替换
- 辅助核算认领：类型（人员/项目）、提取来源（备注/销方）、白名单
- 预分拣标记：采购 / 报销 / 固定资产
- 生成固定资产卡片：资产类别（下拉）、折旧年限、折旧方法、残值率

**Tab 2 — 供应商映射**（独立管理供应商名单）

```
┌──────────────────────────────────────────────────────┐
│ 映射组: [原材料供应商 ▼]   [+ 新建组]               │
│                                                        │
│ 供应商名称         │ 类型     │ 借方科目      │ 贷方科目│
│ 上海材料有限公司   │ 原材料   │ 1403 原材料   │ 2202   │
│ 北京钢铁集团       │ 原材料   │ 1403 原材料   │ 2202   │
│ 深圳电子科技       │ 库存商品 │ 1405 库存商品 │ 2202   │
│ XX机械制造         │ 固定资产 │ 1601 固定资产 │ 2202   │
│                                                        │
│ [+ 添加供应商]  [批量导入]                             │
└──────────────────────────────────────────────────────┘
```

- 映射组切换：下拉选择已有组，或新建组
- 供应商类型下拉：原材料 / 库存商品 / 固定资产 / 服务 / 其他
- 选择类型后自动填充默认科目（可手动覆盖）
- 供应商行：精确名称 + 类型 + 三个科目槽位
- 批量导入：Excel 模板 → 填写供应商名称+类型+科目 → 上传导入
- 规则条件中 `supplierInList` 引用映射组名，实现跨规则复用
- **核心逻辑**：在白名单中 → 采购类（按类型分科目），不在白名单中 → 报销/固定资产

**Tab 3 — 费用清单**（导入报销人与发票号的关联）

```
┌──────────────────────────────────────────────────────┐
│ [导入费用清单]                      [下载模板]        │
│                                                        │
│ 已导入清单 (共 23 条)                                  │
│ ┌────────────┬──────┬──────────────┬────────┐        │
│ │ 发票号码    │ 报销人 │ 备注         │ 状态   │        │
│ ├────────────┼──────┼──────────────┼────────┤        │
│ │ 12345678   │ 张三  │ 加班打车     │ ● 已匹配│        │
│ │ 12345679   │ 李四  │ 客户招待     │ ● 已匹配│        │
│ │ 12345680   │ 王五  │ 办公用品     │ ○ 未匹配│        │
│ └────────────┴──────┴──────────────┴────────┘        │
└──────────────────────────────────────────────────────┘
```

- 状态：已匹配（发票已导入且发票号对应）/ 未匹配（发票尚未导入）
- 支持多次导入追加，按发票号去重（后导入覆盖先导入）
- 清空按钮：删除当前账套所有费用清单记录

### 5.2 Asset Category Mapping Tab（Tab 4）

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
- 条件摘要：`货物名∈[滴滴,出行] + 销方∈[滴滴] + 备注∈[加班]` 或 `供应商∈[原材料供应商组]`
- 动作摘要：`科目→6602.01/2241.01 | 供应商科目→原材料组 | 辅助→人员 | 标记→报销`
- 操作：编辑（行内抽屉展开）/ 删除

---

## 6. Integration Points

### 6.1 File Changes

| File | Change | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modify | Add all new types incl. `ExpenseKeywordCategory`, `AuxiliaryStrategyConfig`, `ExpenseReimbursement`, `ReimbursementSubjectAction` |
| `src/lib/database/sqlite-service.ts` | Modify | Replace `invoice_subject_rules` with `invoice_smart_rules`, add `supplier_subject_mapping`, `asset_category_mapping`, `expense_reimbursement`, `expense_keyword_categories`, `auxiliary_strategy_config` tables |
| `src/lib/invoice-rule-engine.ts` | **New** | Standalone matching engine: condition evaluation, expense category detection, auxiliary strategy resolution, all action types |
| `src/stores/useInvoiceStore.ts` | Modify | `generateInvoiceVoucher` calls new engine with full context |
| `src/components/invoice-subject-config-dialog.tsx` | Rewrite | → `InvoiceSmartRuleDialog`, 5-tab layout (辅助核算策略/规则配置/供应商映射/费用清单/资产类别映射) |
| `src/stores/useFixedAssetStore.ts` | Modify | Add `createFromInvoice()` method |
| `src/stores/usePartnerStore.ts` | Modify | Add `findByName()`, support `isEmployee` type for auto-created reimburser cards |
| `src/app/invoices/input/page.tsx` | Modify | Replace dialog component reference, add expense list import button |
| `src/app/invoices/output/page.tsx` | Modify | Replace dialog component reference |

### 6.2 Call Chain

```
useInvoiceStore.generateInvoiceVoucher(invoice)
  → rules = sqliteService.getSmartRules()
  → supplierMappings = sqliteService.getSupplierMappings()
  → expenseList = sqliteService.getExpenseReimbursements()
  → strategy = sqliteService.getAuxiliaryStrategy()
  → expenseKeywords = sqliteService.getExpenseKeywordCategories()
  → matchedRule = invoiceRuleEngine.matchRule(invoice, rules, supplierMappings)
  → expenseCategory = detectExpenseCategory(invoice, expenseKeywords)
  → if matchedRule:
      actionResult = invoiceRuleEngine.executeActions(
        matchedRule.actions, invoice,
        { invoiceType, getSubject, supplierMappings, expenseList, strategy, expenseCategory }
      )
      → resolveAuxiliaryStrategy (根据全局策略 + 科目配置 + 报销类型)
        → 辅助核算模式：报销类贷方偏移至报销人，采购类贷方指向销方
        → 子科目模式：自动关闭辅助核算，避免重复
      → reimbursementSubject → 替换贷方
      → supplierSubject → 覆盖 debit/tax/credit
      → overrideSubject → template engine
      → fixedAssetCard → fixedAssetStore.addAsset(card)
      → markCategory → update invoice.category
  → templateEngine.generateVoucherWithOverrides(...)
```

### 6.3 Database Migration

```typescript
// Development stage: direct DROP and recreate
DROP TABLE IF EXISTS invoice_subject_rules;
CREATE TABLE invoice_smart_rules (...);
CREATE TABLE supplier_subject_mapping (...);
CREATE TABLE asset_category_mapping (...);
CREATE TABLE expense_reimbursement (...);
CREATE TABLE expense_keyword_categories (...);
CREATE TABLE auxiliary_strategy_config (...);
INSERT INTO asset_category_mapping -- 4 system presets
INSERT INTO expense_keyword_categories -- 5 system presets (交通/餐饮/通讯/住宿/办公)
INSERT INTO auxiliary_strategy_config -- default: mode='auxiliary'
```

### 6.4 Expense List Import

费用清单 Excel 格式：

| 发票号码 | 报销人 | 备注 |
|---------|--------|------|
| 12345678 | 张三 | 加班打车 |
| 12345679 | 李四 | 客户招待 |

- 导入流程：进项发票页面 → "费用清单" 按钮 → 上传 Excel → 预览匹配 → 确认导入
- 按发票号自动匹配已导入的进项发票，显示匹配状态（已匹配/未找到）
- 导入顺序不固定：费用清单可先于发票导入，凭证生成时合并
- 凭证生成时才检查费用清单，不在导入时触发

---

## 7. Edge Cases and Error Handling

### 7.1 Edge Cases

| Scenario | Handling |
|----------|----------|
| Empty conditions array | Skip rule, never match |
| Multiple rules with same priority | Sort by createTime ASC, first wins |
| Amount condition with null invoice amount | Condition evaluates false |
| Empty auxiliary nameList | Skip assignment, check subject auxiliary config for prompt |
| Empty notes/sellerName on invoice | contains on empty string, no match |
| Fixed asset action with amount ≤ 0 | Skip card generation, Toast warning |
| Asset category not found in mapping | Default to 5 years depreciation |
| Subject code does not exist | Auto-create with direction from first digit |
| `supplierInList` condition but mapping group empty | Condition evaluates false, rule not matched |
| `supplierSubject` action but no matching supplier entry | Skip supplier override, fall through to `overrideSubject` |
| Same supplier in multiple mapping groups | First match wins (by group creation order) |
| Invoice sellerName not in any mapping group | `supplierInList` condition false, rule not matched via supplier |
| `reimbursementSubject` action but no expense list entry | Skip reimbursement override, use original credit subject |
| Reimburser name not in partner list | Auto-create partner card (individual type, `isEmployee: true`) |
| Multiple expense list entries with same invoice code | Use first imported record, log warning |
| Expense list imported before invoices | Stored in DB, matched at voucher generation time |

### 7.2 Error Handling

- Rule evaluation exceptions: catch per-rule, skip, continue matching
- Action execution exceptions: catch per-action, skip, earlier actions not rolled back
- Template engine failure: return error, no voucher generated

### 7.3 Key Design Decisions

1. **Single rule match**: Only the highest-priority matched rule applies (no multi-rule stacking)
2. **Actions execute in order**: resolveExpenseCategory → resolveAuxiliaryStrategy → reimbursementSubject → supplierSubject → overrideSubject → markAs → createFixedAsset
3. **Two auxiliary modes (mutually exclusive)**: `auxiliary`（辅助核算维度）vs `sub_account`（科目明细化），由全局策略决定
4. **Auxiliary offset for reimbursements**: 报销类发票贷方辅助核算从"销方"偏移至"报销人"，由报销关键词库自动判断
5. **Sub-account auto-disable**: 子科目模式（如 `112201 应收-A公司`）自动关闭辅助核算，避免重复核算
6. **Reimbursement credit override**: `reimbursementSubject` 仅覆盖 credit 槽位
7. **Supplier subject priority**: `supplierSubject` > `overrideSubject` for same slot
8. **Fixed asset cards use `status: 'active'`**: `depreciationStartDate` 为空表示事实草稿
9. **Expense keyword categories**: 内置 5 类（交通/餐饮/通讯/住宿/办公），用户可扩展
10. **Auto-create partner card**: 往来卡片不存在时自动创建（`isEmployee: true`）
11. **Expense list import order agnostic**: 费用清单和发票导入顺序不固定
12. **Supplier matching is exact**: 供应商映射使用精确匹配（`===`）

---

## 8. Out of Scope (YAGNI)

- OR condition logic (v2.0 AND only)
- Rule grouping/nesting
- Rule version management
- Rule import/export
- Rule simulation/testing UI

These may be added in future iterations based on user feedback.
