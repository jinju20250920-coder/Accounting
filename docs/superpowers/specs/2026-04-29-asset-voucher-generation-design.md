# 固定资产凭证生成功能设计

## 1. 概述

### 1.1 背景
固定资产模块已实现处置、增值、减值、重分类等业务操作，但未生成对应的总账凭证。`AssetVoucherGenerator` 类已存在但未被激活使用。

### 1.2 目标
- 处置、增值、减值、重分类（科目变更）、拆分、合并操作自动生成会计凭证
- 提供凭证预览功能，用户确认后生成
- 支持全局财务规则配置

### 1.3 范围
| 业务类型 | 凭证生成 | 说明 |
|---------|---------|------|
| 处置 | ✅ 自动 | 转入清理 + 收入 + 费用 + 损益结转 |
| 增值 | ✅ 自动 | 借：固定资产，贷：银行存款 |
| 减值 | ✅ 自动 | 两种方式可配置 |
| 重分类（属性变更） | ❌ 不生成 | 仅更新资产属性 |
| 重分类（科目变更） | ✅ 自动 | 借：新科目，贷：旧科目 |
| 拆分 | ✅ 自动 | 借：新资产科目，贷：原资产科目 |
| 合并 | ✅ 自动 | 借：新资产科目，贷：原资产科目 |

---

## 2. 全局财务规则配置

### 2.1 配置项定义

```typescript
interface AssetFinancialSettings {
  // 减值处理方式
  impairmentMethod: 'provision' | 'direct_reduction';
  // provision: 计提减值准备
  // direct_reduction: 直接减少原值

  // 处置凭证生成方式
  disposalVoucherMode: 'single' | 'multiple' | 'auto';
  // single: 合并为一张凭证
  // multiple: 拆分多张凭证
  // auto: 简单处置合并，复杂处置拆分

  // 凭证科目配置
  disposalClearingSubjectCode: string;    // 固定资产清理科目，默认 1601
  impairmentLossSubjectCode: string;       // 资产减值损失科目，默认 6701
  impairmentProvisionSubjectCode: string;  // 减值准备科目，默认 1503
  gainSubjectCode: string;                 // 营业外收入科目，默认 6301
  lossSubjectCode: string;                 // 营业外支出科目，默认 6711
}
```

### 2.2 配置入口
- 位置：固定资产页面 → "核算规则"按钮 → "凭证规则"标签页
- 存储：`useSettingsStore.ts` 中的 `assetFinancialSettings` 字段

### 2.3 默认值
```typescript
const defaultAssetFinancialSettings: AssetFinancialSettings = {
  impairmentMethod: 'provision',
  disposalVoucherMode: 'auto',
  disposalClearingSubjectCode: '1601',
  impairmentLossSubjectCode: '6701',
  impairmentProvisionSubjectCode: '1503',
  gainSubjectCode: '6301',
  lossSubjectCode: '6711',
};
```

---

## 3. 凭证生成逻辑

### 3.1 处置凭证

**步骤一：转入清理**
```
借：固定资产清理（净值）
借：累计折旧
    贷：固定资产（原值）
```

**步骤二：清理收入**（有收入时）
```
借：银行存款
    贷：固定资产清理
```

**步骤三：清理费用**（有费用时）
```
借：固定资产清理
    贷：银行存款
```

**步骤四：结转损益**
```
净收益：
借：固定资产清理
    贷：营业外收入

净损失：
借：营业外支出
    贷：固定资产清理
```

**凭证生成方式**：
- `single`：合并为一张凭证
- `multiple`：每个步骤一张凭证
- `auto`：无收入无费用时合并，否则拆分

### 3.2 增值凭证

```
借：固定资产
    贷：银行存款
```

### 3.3 减值凭证

**方式一：计提减值准备**
```
借：资产减值损失
    贷：固定资产减值准备
```
- 后续折旧按（原值 - 累计折旧 - 减值准备）计算

**方式二：直接减少原值**
```
借：营业外支出
    贷：固定资产
```

### 3.4 重分类凭证（科目变更）

```
借：新固定资产科目
    贷：旧固定资产科目

借：新累计折旧科目
    贷：旧累计折旧科目
```

### 3.5 拆分凭证

```
借：固定资产-A（按比例）
借：固定资产-B（按比例）
借：固定资产-C（按比例）
    贷：固定资产-原
```

### 3.6 合并凭证

```
借：固定资产-新
    贷：固定资产-A
    贷：固定资产-B
    贷：固定资产-C
```

---

## 4. 数据模型扩展

### 4.1 资产变动记录扩展

```typescript
interface AssetChangeRecord {
  // 现有字段...

  // 新增凭证关联
  voucherIds?: string[];      // 关联的凭证ID
  voucherNos?: string[];      // 凭证字号

  // 拆分/合并专用
  relatedAssetIds?: string[]; // 关联的资产ID
  splitRatio?: number;        // 拆分比例
}
```

### 4.2 新增拆分记录类型

```typescript
interface AssetSplitRecord {
  id: string;
  sourceAssetId: string;      // 原资产ID
  targetAssetIds: string[];   // 目标资产ID列表
  splitDate: string;
  splitRatios: number[];      // 各目标资产的比例
  splitAmounts: number[];     // 各目标资产的金额
  voucherId: string;
  voucherNo: string;
  accountSetId: string;
  createTime: string;
}
```

### 4.3 新增合并记录类型

```typescript
interface AssetMergeRecord {
  id: string;
  sourceAssetIds: string[];   // 原资产ID列表
  targetAssetId: string;      // 目标资产ID
  mergeDate: string;
  sourceAmounts: number[];    // 各原资产的金额
  voucherId: string;
  voucherNo: string;
  accountSetId: string;
  createTime: string;
}
```

### 4.4 数据库表

```sql
-- 资产拆分记录表
CREATE TABLE IF NOT EXISTS assetSplitRecords (
  id TEXT PRIMARY KEY,
  sourceAssetId TEXT NOT NULL,
  targetAssetIds TEXT NOT NULL,  -- JSON array
  splitDate TEXT NOT NULL,
  splitRatios TEXT NOT NULL,     -- JSON array
  splitAmounts TEXT NOT NULL,    -- JSON array
  voucherId TEXT,
  voucherNo TEXT,
  accountSetId TEXT NOT NULL,
  createTime TEXT NOT NULL
);

-- 资产合并记录表
CREATE TABLE IF NOT EXISTS assetMergeRecords (
  id TEXT PRIMARY KEY,
  sourceAssetIds TEXT NOT NULL,  -- JSON array
  targetAssetId TEXT NOT NULL,
  mergeDate TEXT NOT NULL,
  sourceAmounts TEXT NOT NULL,   -- JSON array
  voucherId TEXT,
  voucherNo TEXT,
  accountSetId TEXT NOT NULL,
  createTime TEXT NOT NULL
);
```

---

## 5. UI 交互设计

### 5.1 处置对话框

**改造要点**：
1. 新增"预览凭证"按钮
2. 点击后弹出凭证预览弹窗
3. 预览确认后执行处置并生成凭证

**交互流程**：
```
填写处置信息 → 点击"预览凭证" → 显示凭证预览 → 确认处置 → 生成凭证 + 更新资产
```

### 5.2 增值/减值对话框

**改造要点**：
1. 减值类型时显示减值方式选择（计提准备/直接减少）
2. 新增"预览凭证"按钮
3. 预览确认后执行变动并生成凭证

### 5.3 重分类对话框（新建）

**功能**：
1. 属性变更：仅更新分类/部门，不生成凭证
2. 科目变更：生成转账凭证
3. 资产拆分：一个资产拆成多个
4. 资产合并：多个资产合成一个

**拆分表单**：
- 选择拆分数量
- 设置各目标资产的分类、名称
- 设置拆分比例或金额

**合并表单**：
- 选择要合并的资产列表
- 设置目标资产信息

### 5.4 凭证预览组件

**复用现有** `VoucherPreviewDialog`，扩展支持：
- 多张凭证预览（处置场景）
- 凭证日期可编辑
- 摘要可编辑

---

## 6. 实现计划

### Phase 1：基础设施（2天）

| 任务 | 文件 | 优先级 |
|-----|------|--------|
| 新增全局财务规则配置 | `stores/useSettingsStore.ts` | P0 |
| 新增配置 UI | `components/assets/asset-category-dialog.tsx` | P0 |
| 扩展变动记录类型 | `types/index.ts` | P0 |
| 数据库迁移 | `lib/database/sqlite-service.ts` | P0 |

### Phase 2：凭证生成核心（3天）

| 任务 | 文件 | 优先级 |
|-----|------|--------|
| 完善减值凭证生成 | `lib/asset-voucher-generator.ts` | P0 |
| 新增拆分凭证生成 | `lib/asset-voucher-generator.ts` | P1 |
| 新增合并凭证生成 | `lib/asset-voucher-generator.ts` | P1 |
| 集成处置凭证生成 | `stores/useFixedAssetStore.ts` | P0 |
| 集成增值凭证生成 | `stores/useFixedAssetStore.ts` | P0 |
| 集成减值凭证生成 | `stores/useFixedAssetStore.ts` | P0 |

### Phase 3：UI 改造（3天）

| 任务 | 文件 | 优先级 |
|-----|------|--------|
| 处置对话框改造 | `components/assets/asset-disposal-dialog.tsx` | P0 |
| 增值/减值对话框改造 | `components/assets/asset-improvement-dialog.tsx` | P0 |
| 凭证预览组件优化 | `components/voucher-preview-dialog.tsx` | P0 |
| 新建重分类对话框 | `components/assets/asset-reclassify-dialog.tsx` | P1 |

### Phase 4：拆分合并功能（2天）

| 任务 | 文件 | 优先级 |
|-----|------|--------|
| 拆分业务逻辑 | `stores/useFixedAssetStore.ts` | P1 |
| 合并业务逻辑 | `stores/useFixedAssetStore.ts` | P1 |
| 拆分 UI | `components/assets/asset-reclassify-dialog.tsx` | P1 |
| 合并 UI | `components/assets/asset-reclassify-dialog.tsx` | P1 |

---

## 7. 关键实现示例

### 7.1 处置凭证生成调用

```typescript
// useFixedAssetStore.ts - disposeAsset 改造
disposeAsset: async (assetId, disposal) => {
  const state = get();
  const asset = state.assets.find(a => a.id === assetId);
  if (!asset) throw new Error('资产不存在');

  // 1. 计算处置数据
  const disposalCalc = get().calculatePartialDisposal(assetId, disposal.quantity);

  // 2. 获取财务规则配置
  const settings = useSettingsStore.getState().assetFinancialSettings;

  // 3. 生成凭证
  const generator = new AssetVoucherGenerator(
    generateId,
    getVoucherNo,
    saveVoucherToDb
  );

  const vouchers = await generator.generateDisposalVouchers(
    asset,
    { ...disposal, ...disposalCalc, netGainLoss },
    disposal.date,
    accountSetId,
    settings
  );

  // 4. 更新资产（关联凭证）
  const updatedAsset = {
    ...asset,
    remainingQuantity: asset.remainingQuantity - disposal.quantity,
    // ... 其他更新
    disposalVoucherIds: vouchers.map(v => v.voucherId),
    disposalVoucherNos: vouchers.map(v => v.voucherNo),
  };

  await get().updateAsset(assetId, updatedAsset);

  // 5. 记录变动日志
  await get().logAssetChange({
    assetId,
    changeType: 'disposal',
    voucherIds: vouchers.map(v => v.voucherId),
    voucherNos: vouchers.map(v => v.voucherNo),
    // ...
  });

  return vouchers;
}
```

### 7.2 凭证预览数据结构

```typescript
interface VoucherPreviewData {
  date: string;
  entries: VoucherPreviewEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

interface VoucherPreviewEntry {
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
}
```

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 凭证科目不存在 | 凭证生成失败 | 自动创建科目或提示用户配置 |
| 凭证日期不在当前期间 | 违反会计规则 | 校验期间，提示用户调整日期 |
| 部分处置后折旧计算 | 折旧金额不准确 | 按剩余数量和净值重新计算 |
| 拆分后资产编码 | 编码规则冲突 | 自动生成新编码 |

---

## 9. 验收标准

1. **处置功能**：处置资产后自动生成凭证，可在凭证列表查看
2. **增值功能**：增值后自动生成凭证，资产原值正确更新
3. **减值功能**：两种减值方式均可生成正确凭证
4. **重分类功能**：科目变更生成转账凭证，属性变更不生成
5. **拆分功能**：拆分后生成新资产卡片和转账凭证
6. **合并功能**：合并后生成新资产卡片和转账凭证
7. **凭证预览**：所有操作均可预览凭证后再确认
8. **配置功能**：全局财务规则可正确保存和应用
