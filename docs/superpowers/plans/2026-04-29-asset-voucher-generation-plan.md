# 固定资产凭证生成功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现固定资产处置、增值、减值、重分类、拆分、合并操作自动生成会计凭证，并提供凭证预览功能。

**Architecture:** 扩展现有 `AssetVoucherGenerator` 类，在 `useFixedAssetStore` 中集成凭证生成，改造 UI 对话框添加凭证预览，新增全局财务规则配置。

**Tech Stack:** React, TypeScript, Zustand, SQLite (sql.js), shadcn/ui

---

## 文件结构

### 新建文件
- `src/components/assets/asset-voucher-preview-dialog.tsx` - 资产凭证预览组件
- `src/components/assets/asset-reclassify-dialog.tsx` - 重分类对话框（拆分/合并）

### 修改文件
- `src/types/index.ts` - 新增 `AssetSplitRecord`、`AssetMergeRecord`、`AssetFinancialSettings` 类型
- `src/stores/useSettingsStore.ts` - 新增 `assetFinancialSettings` 配置
- `src/lib/asset-voucher-generator.ts` - 完善减值、拆分、合并凭证生成
- `src/stores/useFixedAssetStore.ts` - 集成凭证生成到 `disposeAsset`、`improveAsset`
- `src/lib/database/sqlite-service.ts` - 新增拆分/合并记录表
- `src/components/assets/asset-disposal-dialog.tsx` - 添加凭证预览
- `src/components/assets/asset-improvement-dialog.tsx` - 添加减值方式选择和凭证预览
- `src/components/assets/asset-category-dialog.tsx` - 新增"凭证规则"标签页

---

## Phase 1: 基础设施

### Task 1: 类型定义扩展

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 添加 AssetFinancialSettings 类型定义**

在 `types/index.ts` 文件末尾（约第 1000 行附近）添加：

```typescript
// ============================================
// 资产财务规则配置
// ============================================

export interface AssetFinancialSettings {
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
  disposalClearingSubjectCode: string;
  impairmentLossSubjectCode: string;
  impairmentProvisionSubjectCode: string;
  gainSubjectCode: string;
  lossSubjectCode: string;
}

// 资产拆分记录
export interface AssetSplitRecord {
  id: string;
  sourceAssetId: string;
  targetAssetIds: string[];
  splitDate: string;
  splitRatios: number[];
  splitAmounts: number[];
  voucherId?: string;
  voucherNo?: string;
  accountSetId: string;
  createTime: string;
}

// 资产合并记录
export interface AssetMergeRecord {
  id: string;
  sourceAssetIds: string[];
  targetAssetId: string;
  mergeDate: string;
  sourceAmounts: number[];
  voucherId?: string;
  voucherNo?: string;
  accountSetId: string;
  createTime: string;
}
```

- [ ] **Step 2: 扩展 AssetChangeRecord 类型**

找到 `AssetChangeRecord` 接口（约第 724 行），在 `voucherNo` 字段后添加：

```typescript
  // 凭证关联（扩展为多凭证支持）
  voucherId?: string;
  voucherNo?: string;
  voucherIds?: string[];      // 关联的凭证ID列表
  voucherNos?: string[];      // 凭证字号列表

  // 拆分/合并专用
  relatedAssetIds?: string[];
  splitRatio?: number;
```

- [ ] **Step 3: 提交类型定义**

```bash
git add src/types/index.ts
git commit -m "feat: 新增资产财务规则配置和拆分合并记录类型定义"
```

---

### Task 2: 全局财务规则配置存储

**Files:**
- Modify: `src/stores/useSettingsStore.ts`

- [ ] **Step 1: 导入 AssetFinancialSettings 类型**

在文件顶部导入区域添加：

```typescript
import type { AssetFinancialSettings } from '@/types';
```

- [ ] **Step 2: 在 AppSettings 接口中添加 assetFinancialSettings 字段**

在 `AppSettings` 接口的 `shortcuts` 字段后添加：

```typescript
  // 资产财务规则设置
  assetFinancialSettings: AssetFinancialSettings;
```

- [ ] **Step 3: 添加默认配置**

在 `defaultSettings` 对象的 `shortcuts` 字段后添加：

```typescript
  assetFinancialSettings: {
    impairmentMethod: 'provision',
    disposalVoucherMode: 'auto',
    disposalClearingSubjectCode: '1601',
    impairmentLossSubjectCode: '6701',
    impairmentProvisionSubjectCode: '1503',
    gainSubjectCode: '6301',
    lossSubjectCode: '6711',
  }
```

- [ ] **Step 4: 更新 updateSettings 方法**

在 `updateSettings` 方法的嵌套对象合并部分添加：

```typescript
      ...(newSettings.assetFinancialSettings && {
        assetFinancialSettings: { ...state.settings.assetFinancialSettings, ...newSettings.assetFinancialSettings }
      }),
```

- [ ] **Step 5: 在 SettingsStore 接口中添加 getter**

在 `SettingsStore` 接口中添加：

```typescript
  getAssetFinancialSettings: () => AssetFinancialSettings;
```

- [ ] **Step 6: 实现 getAssetFinancialSettings 方法**

在 store 实现中添加：

```typescript
    getAssetFinancialSettings: () => get().settings.assetFinancialSettings,
```

- [ ] **Step 7: 提交配置存储**

```bash
git add src/stores/useSettingsStore.ts
git commit -m "feat: 新增资产财务规则全局配置存储"
```

---

### Task 3: 数据库迁移

**Files:**
- Modify: `src/lib/database/sqlite-service.ts`

- [ ] **Step 1: 找到资产相关迁移代码位置**

搜索 `assetChangeRecords` 表创建位置，在其后添加新表。

- [ ] **Step 2: 添加拆分记录表迁移**

在资产变动记录表创建后添加：

```typescript
      // 资产拆分记录表
      const splitTableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='assetSplitRecords'"
      );

      if (!splitTableCheck[0]?.values?.length) {
        console.log('Migrating database: creating assetSplitRecords table...');
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS assetSplitRecords (
            id TEXT PRIMARY KEY,
            sourceAssetId TEXT NOT NULL,
            targetAssetIds TEXT NOT NULL,
            splitDate TEXT NOT NULL,
            splitRatios TEXT NOT NULL,
            splitAmounts TEXT NOT NULL,
            voucherId TEXT,
            voucherNo TEXT,
            accountSetId TEXT NOT NULL,
            createTime TEXT NOT NULL
          )
        `);
      }
```

- [ ] **Step 3: 添加合并记录表迁移**

```typescript
      // 资产合并记录表
      const mergeTableCheck = this.dbInstance.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='assetMergeRecords'"
      );

      if (!mergeTableCheck[0]?.values?.length) {
        console.log('Migrating database: creating assetMergeRecords table...');
        this.dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS assetMergeRecords (
            id TEXT PRIMARY KEY,
            sourceAssetIds TEXT NOT NULL,
            targetAssetId TEXT NOT NULL,
            mergeDate TEXT NOT NULL,
            sourceAmounts TEXT NOT NULL,
            voucherId TEXT,
            voucherNo TEXT,
            accountSetId TEXT NOT NULL,
            createTime TEXT NOT NULL
          )
        `);
      }
```

- [ ] **Step 4: 提交数据库迁移**

```bash
git add src/lib/database/sqlite-service.ts
git commit -m "feat: 新增资产拆分合并记录数据库表"
```

---

## Phase 2: 凭证生成核心

### Task 4: 完善资产凭证生成器

**Files:**
- Modify: `src/lib/asset-voucher-generator.ts`

- [ ] **Step 1: 添加减值凭证生成方法**

在 `generateDepreciationVoucher` 方法后添加：

```typescript
  /**
   * 生成减值凭证
   * 方式一（计提准备）：借：资产减值损失，贷：减值准备
   * 方式二（直接减少）：借：营业外支出，贷：固定资产
   */
  async generateImpairmentVoucher(
    asset: FixedAsset,
    impairmentAmount: number,
    method: 'provision' | 'direct_reduction',
    date: string,
    accountSetId: string,
    settings: { lossCode: string; provisionCode: string }
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    if (method === 'provision') {
      // 计提减值准备
      entries.push({
        subjectCode: settings.lossCode,
        subjectName: '资产减值损失',
        debit: impairmentAmount,
        credit: 0,
        summary: `${asset.assetName}计提减值准备`,
      });
      entries.push({
        subjectCode: settings.provisionCode,
        subjectName: '固定资产减值准备',
        debit: 0,
        credit: impairmentAmount,
        summary: `${asset.assetName}减值准备`,
      });
    } else {
      // 直接减少原值
      entries.push({
        subjectCode: '6711',
        subjectName: '营业外支出',
        debit: impairmentAmount,
        credit: 0,
        summary: `${asset.assetName}减值损失`,
      });
      entries.push({
        subjectCode: asset.assetSubjectCode || '1501',
        subjectName: asset.assetSubjectName || '固定资产',
        debit: 0,
        credit: impairmentAmount,
        summary: `${asset.assetName}减值`,
      });
    }

    await this.saveVoucher(voucherNo, date, entries, accountSetId);
    return { voucherNo, entries };
  }
```

- [ ] **Step 2: 添加重分类凭证生成方法**

```typescript
  /**
   * 生成重分类凭证（科目变更）
   * 借：新固定资产科目，贷：旧固定资产科目
   * 借：新累计折旧科目，贷：旧累计折旧科目
   */
  async generateReclassifyVoucher(
    asset: FixedAsset,
    oldAssetSubjectCode: string,
    oldAssetSubjectName: string,
    oldDepreciationSubjectCode: string,
    oldDepreciationSubjectName: string,
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 固定资产科目转账
    entries.push({
      subjectCode: asset.assetSubjectCode || '1501',
      subjectName: asset.assetSubjectName || '固定资产',
      debit: asset.originalValue,
      credit: 0,
      summary: `${asset.assetName}重分类转入`,
    });
    entries.push({
      subjectCode: oldAssetSubjectCode,
      subjectName: oldAssetSubjectName,
      debit: 0,
      credit: asset.originalValue,
      summary: `${asset.assetName}重分类转出`,
    });

    // 累计折旧科目转账（如有）
    if (asset.accumulatedDepreciation > 0) {
      entries.push({
        subjectCode: oldDepreciationSubjectCode,
        subjectName: oldDepreciationSubjectName,
        debit: asset.accumulatedDepreciation,
        credit: 0,
        summary: `${asset.assetName}累计折旧重分类转出`,
      });
      entries.push({
        subjectCode: asset.depreciationSubjectCode || '1502',
        subjectName: asset.depreciationSubjectName || '累计折旧',
        debit: 0,
        credit: asset.accumulatedDepreciation,
        summary: `${asset.assetName}累计折旧重分类转入`,
      });
    }

    await this.saveVoucher(voucherNo, date, entries, accountSetId);
    return { voucherNo, entries };
  }
```

- [ ] **Step 3: 添加拆分凭证生成方法**

```typescript
  /**
   * 生成拆分凭证
   * 借：固定资产-A/B/C，贷：固定资产-原
   */
  async generateSplitVoucher(
    sourceAsset: FixedAsset,
    targetAssets: { id: string; code: string; name: string; subjectCode: string; subjectName: string; amount: number }[],
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 借方：各目标资产
    for (const target of targetAssets) {
      entries.push({
        subjectCode: target.subjectCode,
        subjectName: target.subjectName,
        debit: target.amount,
        credit: 0,
        summary: `${sourceAsset.assetName}拆分转入${target.name}`,
      });
    }

    // 贷方：原资产
    entries.push({
      subjectCode: sourceAsset.assetSubjectCode || '1501',
      subjectName: sourceAsset.assetSubjectName || '固定资产',
      debit: 0,
      credit: sourceAsset.originalValue,
      summary: `${sourceAsset.assetName}拆分转出`,
    });

    await this.saveVoucher(voucherNo, date, entries, accountSetId);
    return { voucherNo, entries };
  }
```

- [ ] **Step 4: 添加合并凭证生成方法**

```typescript
  /**
   * 生成合并凭证
   * 借：固定资产-新，贷：固定资产-A/B/C
   */
  async generateMergeVoucher(
    sourceAssets: { id: string; code: string; name: string; subjectCode: string; subjectName: string; amount: number }[],
    targetAsset: FixedAsset,
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 借方：目标资产
    const totalAmount = sourceAssets.reduce((sum, a) => sum + a.amount, 0);
    entries.push({
      subjectCode: targetAsset.assetSubjectCode || '1501',
      subjectName: targetAsset.assetSubjectName || '固定资产',
      debit: totalAmount,
      credit: 0,
      summary: `资产合并转入${targetAsset.assetName}`,
    });

    // 贷方：各原资产
    for (const source of sourceAssets) {
      entries.push({
        subjectCode: source.subjectCode,
        subjectName: source.subjectName,
        debit: 0,
        credit: source.amount,
        summary: `${source.name}合并转出`,
      });
    }

    await this.saveVoucher(voucherNo, date, entries, accountSetId);
    return { voucherNo, entries };
  }
```

- [ ] **Step 5: 提交凭证生成器完善**

```bash
git add src/lib/asset-voucher-generator.ts
git commit -m "feat: 完善资产凭证生成器，支持减值、重分类、拆分、合并凭证"
```

---

### Task 5: 创建资产凭证预览组件

**Files:**
- Create: `src/components/assets/asset-voucher-preview-dialog.tsx`

- [ ] **Step 1: 创建凭证预览组件文件**

```typescript
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';

export interface AssetVoucherPreviewEntry {
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
}

export interface AssetVoucherPreviewData {
  voucherDate: string;
  entries: AssetVoucherPreviewEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

interface AssetVoucherPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vouchers: AssetVoucherPreviewData[];
  onConfirm: (updatedVouchers: AssetVoucherPreviewData[]) => void;
  isProcessing: boolean;
  title?: string;
}

export function AssetVoucherPreviewDialog({
  open,
  onOpenChange,
  vouchers,
  onConfirm,
  isProcessing,
  title = '凭证预览',
}: AssetVoucherPreviewDialogProps) {
  const [editedVouchers, setEditedVouchers] = React.useState<AssetVoucherPreviewData[]>([]);

  React.useEffect(() => {
    if (open && vouchers.length > 0) {
      setEditedVouchers(vouchers.map(v => ({ ...v, entries: v.entries.map(e => ({ ...e })) })));
    }
  }, [open, vouchers]);

  const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const updateVoucherDate = (index: number, date: string) => {
    setEditedVouchers(prev => prev.map((v, i) => i === index ? { ...v, voucherDate: date } : v));
  };

  const handleConfirm = () => {
    onConfirm(editedVouchers);
  };

  const allBalanced = editedVouchers.every(v => v.isBalanced);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}（{editedVouchers.length} 张）
          </DialogTitle>
        </DialogHeader>

        {!allBalanced && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-red-800">凭证借贷不平衡，请检查数据</span>
          </div>
        )}

        <div className="space-y-4 max-h-[55vh] overflow-y-auto">
          {editedVouchers.map((voucher, vIdx) => (
            <div key={vIdx} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">凭证 {vIdx + 1}</Badge>
                  {voucher.isBalanced ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      平衡
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      不平衡
                    </Badge>
                  )}
                </div>
                <ChineseDatePicker
                  value={voucher.voucherDate}
                  onChange={(date) => updateVoucherDate(vIdx, date)}
                  className="w-36"
                />
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b">
                    <th className="text-left py-2 font-medium">摘要</th>
                    <th className="text-left py-2 font-medium">科目</th>
                    <th className="text-right py-2 font-medium w-28">借方</th>
                    <th className="text-right py-2 font-medium w-28">贷方</th>
                  </tr>
                </thead>
                <tbody>
                  {voucher.entries.map((entry, eIdx) => (
                    <tr key={eIdx} className="border-b border-dashed">
                      <td className="py-2 text-slate-700">{entry.summary}</td>
                      <td className="py-2">
                        <span className="font-mono text-blue-600">{entry.subjectCode}</span>
                        {' '}
                        <span className="text-slate-600">{entry.subjectName}</span>
                      </td>
                      <td className="text-right py-2 font-mono">
                        {entry.debit > 0 ? fmt(entry.debit) : ''}
                      </td>
                      <td className="text-right py-2 font-mono">
                        {entry.credit > 0 ? fmt(entry.credit) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium bg-slate-50">
                    <td colSpan={2} className="py-2 text-right">合计</td>
                    <td className="text-right py-2 font-mono">{fmt(voucher.totalDebit)}</td>
                    <td className="text-right py-2 font-mono">{fmt(voucher.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !allBalanced}>
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            确认生成凭证
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 提交凭证预览组件**

```bash
git add src/components/assets/asset-voucher-preview-dialog.tsx
git commit -m "feat: 新增资产凭证预览对话框组件"
```

---

### Task 6: 集成处置凭证生成

**Files:**
- Modify: `src/stores/useFixedAssetStore.ts`

- [ ] **Step 1: 导入必要依赖**

在文件顶部添加：

```typescript
import { useSettingsStore } from './useSettingsStore';
import { AssetVoucherGenerator } from '@/lib/asset-voucher-generator';
```

- [ ] **Step 2: 添加凭证预览数据生成辅助函数**

在 store 定义前添加：

```typescript
// 生成处置凭证预览数据
function generateDisposalPreviewData(
  asset: FixedAsset,
  disposal: { disposedOriginalValue: number; disposedAccumulatedDepreciation: number; disposedNetValue: number; disposalIncome: number; disposalExpense: number; netGainLoss: number },
  date: string,
  settings: AssetFinancialSettings
): AssetVoucherPreviewData[] {
  const vouchers: AssetVoucherPreviewData[] = [];
  const mode = settings.disposalVoucherMode;
  const isSimple = disposal.disposalIncome === 0 && disposal.disposalExpense === 0;
  const useSingle = mode === 'single' || (mode === 'auto' && isSimple);

  if (useSingle) {
    // 合并为一张凭证
    const entries: AssetVoucherPreviewEntry[] = [
      {
        summary: `${asset.assetName}处置转入清理`,
        subjectCode: settings.disposalClearingSubjectCode,
        subjectName: '固定资产清理',
        debit: disposal.disposedNetValue,
        credit: 0,
      },
      {
        summary: `${asset.assetName}处置结转累计折旧`,
        subjectCode: asset.depreciationSubjectCode || '1502',
        subjectName: asset.depreciationSubjectName || '累计折旧',
        debit: disposal.disposedAccumulatedDepreciation,
        credit: 0,
      },
      {
        summary: `${asset.assetName}处置减少`,
        subjectCode: asset.assetSubjectCode || '1501',
        subjectName: asset.assetSubjectName || '固定资产',
        debit: 0,
        credit: disposal.disposedOriginalValue,
      },
    ];

    if (disposal.disposalIncome > 0) {
      entries.push({
        summary: `${asset.assetName}处置收入`,
        subjectCode: '1002',
        subjectName: '银行存款',
        debit: disposal.disposalIncome,
        credit: 0,
      });
      entries.push({
        summary: `${asset.assetName}处置收入`,
        subjectCode: settings.disposalClearingSubjectCode,
        subjectName: '固定资产清理',
        debit: 0,
        credit: disposal.disposalIncome,
      });
    }

    if (disposal.disposalExpense > 0) {
      entries.push({
        summary: `${asset.assetName}处置费用`,
        subjectCode: settings.disposalClearingSubjectCode,
        subjectName: '固定资产清理',
        debit: disposal.disposalExpense,
        credit: 0,
      });
      entries.push({
        summary: `支付${asset.assetName}处置费用`,
        subjectCode: '1002',
        subjectName: '银行存款',
        debit: 0,
        credit: disposal.disposalExpense,
      });
    }

    if (disposal.netGainLoss !== 0) {
      if (disposal.netGainLoss > 0) {
        entries.push({
          summary: `${asset.assetName}处置净收益`,
          subjectCode: settings.disposalClearingSubjectCode,
          subjectName: '固定资产清理',
          debit: 0,
          credit: disposal.netGainLoss,
        });
        entries.push({
          summary: `${asset.assetName}处置收益`,
          subjectCode: settings.gainSubjectCode,
          subjectName: '营业外收入',
          debit: 0,
          credit: disposal.netGainLoss,
        });
      } else {
        const lossAmount = Math.abs(disposal.netGainLoss);
        entries.push({
          summary: `${asset.assetName}处置损失`,
          subjectCode: settings.lossSubjectCode,
          subjectName: '营业外支出',
          debit: lossAmount,
          credit: 0,
        });
        entries.push({
          summary: `${asset.assetName}处置净损失`,
          subjectCode: settings.disposalClearingSubjectCode,
          subjectName: '固定资产清理',
          debit: 0,
          credit: lossAmount,
        });
      }
    }

    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
    vouchers.push({ voucherDate: date, entries, totalDebit, totalCredit, isBalanced: totalDebit === totalCredit });
  } else {
    // 拆分为多张凭证（简化版，实际可按步骤拆分）
    // ... 多凭证逻辑
  }

  return vouchers;
}
```

- [ ] **Step 3: 在 store 接口中添加预览方法**

在 `FixedAssetStore` 接口中添加：

```typescript
  // 凭证预览
  getDisposalVoucherPreview: (assetId: string, disposal: Omit<AssetDisposal, 'id' | 'createTime'>) => AssetVoucherPreviewData[];
  getImprovementVoucherPreview: (assetId: string, improvement: Omit<AssetImprovement, 'id' | 'createTime'>) => AssetVoucherPreviewData[];
```

- [ ] **Step 4: 实现预览方法**

在 store 实现中添加：

```typescript
  getDisposalVoucherPreview: (assetId, disposal) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset) return [];
    
    const settings = useSettingsStore.getState().getAssetFinancialSettings();
    const disposalCalc = get().calculatePartialDisposal(assetId, disposal.quantity);
    if (!disposalCalc) return [];

    const netGainLoss = disposal.disposalIncome - disposal.disposalExpense - disposalCalc.disposedNetValue;
    
    return generateDisposalPreviewData(
      asset,
      { ...disposalCalc, disposalIncome: disposal.disposalIncome, disposalExpense: disposal.disposalExpense, netGainLoss },
      disposal.date,
      settings
    );
  },

  getImprovementVoucherPreview: (assetId, improvement) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset) return [];

    const settings = useSettingsStore.getState().getAssetFinancialSettings();
    const entries: AssetVoucherPreviewEntry[] = [
      {
        summary: `${asset.assetName}增值`,
        subjectCode: asset.assetSubjectCode || '1501',
        subjectName: asset.assetSubjectName || '固定资产',
        debit: improvement.addedValue,
        credit: 0,
      },
      {
        summary: `支付${asset.assetName}增值费用`,
        subjectCode: '1002',
        subjectName: '银行存款',
        debit: 0,
        credit: improvement.addedValue,
      },
    ];

    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    return [{ voucherDate: improvement.date, entries, totalDebit, totalCredit, isBalanced: totalDebit === totalCredit }];
  },
```

- [ ] **Step 5: 修改 disposeAsset 方法集成凭证生成**

找到 `disposeAsset` 方法，在 `updateAsset` 调用前添加凭证生成逻辑：

```typescript
    // 生成凭证
    const settings = useSettingsStore.getState().getAssetFinancialSettings();
    const accountSetId = useAccountSetStore.getState().getCurrentAccountSet()?.id || '';
    
    // 这里调用实际的凭证保存逻辑
    // const vouchers = await saveVouchers(...);
    // disposalRecord.voucherIds = vouchers.map(v => v.id);
    // disposalRecord.voucherNos = vouchers.map(v => v.no);
```

- [ ] **Step 6: 提交 store 集成**

```bash
git add src/stores/useFixedAssetStore.ts
git commit -m "feat: 集成处置和增值凭证预览生成"
```

---

## Phase 3: UI 改造

### Task 7: 改造处置对话框

**Files:**
- Modify: `src/components/assets/asset-disposal-dialog.tsx`

- [ ] **Step 1: 导入凭证预览组件**

在文件顶部添加：

```typescript
import { AssetVoucherPreviewDialog, AssetVoucherPreviewData } from './asset-voucher-preview-dialog';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
```

- [ ] **Step 2: 添加预览状态**

在组件内添加状态：

```typescript
  const { getDisposalVoucherPreview } = useFixedAssetStore();
  const [showPreview, setShowPreview] = useState(false);
  const [previewVouchers, setPreviewVouchers] = useState<AssetVoucherPreviewData[]>([]);
```

- [ ] **Step 3: 添加预览按钮点击处理**

```typescript
  const handlePreview = () => {
    if (!disposalCalc) {
      showToast('error', '处置数量无效');
      return;
    }

    const vouchers = getDisposalVoucherPreview(asset.id, {
      date: disposalDate,
      type: disposalType,
      quantity,
      disposalIncome,
      disposalExpense,
      reason,
    });

    if (vouchers.length === 0) {
      showToast('error', '无法生成凭证预览');
      return;
    }

    setPreviewVouchers(vouchers);
    setShowPreview(true);
  };
```

- [ ] **Step 4: 修改对话框按钮**

将原来的"确定"按钮改为"预览凭证"：

```typescript
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handlePreview} disabled={loading}>
            预览凭证
          </Button>
```

- [ ] **Step 5: 添加凭证预览对话框**

在组件末尾的 return 中添加：

```typescript
      <AssetVoucherPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        vouchers={previewVouchers}
        onConfirm={async (updatedVouchers) => {
          setLoading(true);
          try {
            await disposeAsset(asset.id, {
              date: disposalDate,
              type: disposalType,
              quantity,
              disposalIncome,
              disposalExpense,
              reason,
            });
            showToast('success', `资产处置成功`);
            setShowPreview(false);
            onOpenChange(false);
            onSuccess?.();
          } catch (error: any) {
            showToast('error', error.message || '处置失败');
          } finally {
            setLoading(false);
          }
        }}
        isProcessing={loading}
        title="处置凭证预览"
      />
```

- [ ] **Step 6: 提交处置对话框改造**

```bash
git add src/components/assets/asset-disposal-dialog.tsx
git commit -m "feat: 处置对话框添加凭证预览功能"
```

---

### Task 8: 改造增值/减值对话框

**Files:**
- Modify: `src/components/assets/asset-improvement-dialog.tsx`

- [ ] **Step 1: 导入凭证预览组件和设置 Store**

```typescript
import { AssetVoucherPreviewDialog, AssetVoucherPreviewData } from './asset-voucher-preview-dialog';
import { useSettingsStore } from '@/stores/useSettingsStore';
```

- [ ] **Step 2: 添加减值方式选择状态**

```typescript
  const [impairmentMethod, setImpairmentMethod] = useState<'provision' | 'direct_reduction'>('provision');
  const [showPreview, setShowPreview] = useState(false);
  const [previewVouchers, setPreviewVouchers] = useState<AssetVoucherPreviewData[]>([]);
```

- [ ] **Step 3: 在减值类型时显示减值方式选择**

在变动金额输入框后添加：

```typescript
              {changeType === 'depreciation' && (
                <div className="space-y-2">
                  <Label>减值方式</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={impairmentMethod === 'provision'}
                        onChange={() => setImpairmentMethod('provision')}
                      />
                      <span className="text-sm">计提减值准备</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={impairmentMethod === 'direct_reduction'}
                        onChange={() => setImpairmentMethod('direct_reduction')}
                      />
                      <span className="text-sm">直接减少原值</span>
                    </label>
                  </div>
                </div>
              )}
```

- [ ] **Step 4: 添加凭证预览生成逻辑**

```typescript
  const handlePreview = () => {
    if (changeType === 'reclassify') {
      // 重分类不生成凭证，直接提交
      handleSubmit();
      return;
    }

    const settings = useSettingsStore.getState().getAssetFinancialSettings();
    const amount = changeType === 'appreciation' ? Math.abs(changeAmount) : -Math.abs(changeAmount);
    
    let entries: AssetVoucherPreviewEntry[] = [];

    if (changeType === 'appreciation') {
      entries = [
        {
          summary: `${asset.assetName}增值`,
          subjectCode: asset.assetSubjectCode || '1501',
          subjectName: asset.assetSubjectName || '固定资产',
          debit: Math.abs(changeAmount),
          credit: 0,
        },
        {
          summary: `支付${asset.assetName}增值费用`,
          subjectCode: '1002',
          subjectName: '银行存款',
          debit: 0,
          credit: Math.abs(changeAmount),
        },
      ];
    } else if (changeType === 'depreciation') {
      if (impairmentMethod === 'provision') {
        entries = [
          {
            summary: `${asset.assetName}计提减值准备`,
            subjectCode: settings.impairmentLossSubjectCode,
            subjectName: '资产减值损失',
            debit: Math.abs(changeAmount),
            credit: 0,
          },
          {
            summary: `${asset.assetName}减值准备`,
            subjectCode: settings.impairmentProvisionSubjectCode,
            subjectName: '固定资产减值准备',
            debit: 0,
            credit: Math.abs(changeAmount),
          },
        ];
      } else {
        entries = [
          {
            summary: `${asset.assetName}减值损失`,
            subjectCode: settings.lossSubjectCode,
            subjectName: '营业外支出',
            debit: Math.abs(changeAmount),
            credit: 0,
          },
          {
            summary: `${asset.assetName}减值`,
            subjectCode: asset.assetSubjectCode || '1501',
            subjectName: asset.assetSubjectName || '固定资产',
            debit: 0,
            credit: Math.abs(changeAmount),
          },
        ];
      }
    }

    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    setPreviewVouchers([{
      voucherDate: changeDate,
      entries,
      totalDebit,
      totalCredit,
      isBalanced: totalDebit === totalCredit,
    }]);
    setShowPreview(true);
  };
```

- [ ] **Step 5: 修改按钮为预览凭证**

- [ ] **Step 6: 添加凭证预览对话框**

- [ ] **Step 7: 提交增值/减值对话框改造**

```bash
git add src/components/assets/asset-improvement-dialog.tsx
git commit -m "feat: 增值/减值对话框添加减值方式选择和凭证预览"
```

---

### Task 9: 新增财务规则配置 UI

**Files:**
- Modify: `src/components/assets/asset-category-dialog.tsx`

- [ ] **Step 1: 添加"凭证规则"标签页**

在现有的 Tabs 组件中添加新的 Tab：

```typescript
              <TabsTrigger value="voucher">凭证规则</TabsTrigger>
```

- [ ] **Step 2: 添加凭证规则配置表单**

```typescript
            <TabsContent value="voucher" className="space-y-4">
              <div className="space-y-2">
                <Label>减值处理方式</Label>
                <Select
                  value={settings.assetFinancialSettings.impairmentMethod}
                  onValueChange={(v) => updateAssetFinancialSettings({ impairmentMethod: v as 'provision' | 'direct_reduction' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provision">计提减值准备</SelectItem>
                    <SelectItem value="direct_reduction">直接减少原值</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>处置凭证生成方式</Label>
                <Select
                  value={settings.assetFinancialSettings.disposalVoucherMode}
                  onValueChange={(v) => updateAssetFinancialSettings({ disposalVoucherMode: v as 'single' | 'multiple' | 'auto' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动（推荐）</SelectItem>
                    <SelectItem value="single">合并为一张凭证</SelectItem>
                    <SelectItem value="multiple">拆分多张凭证</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>固定资产清理科目</Label>
                  <Input
                    value={settings.assetFinancialSettings.disposalClearingSubjectCode}
                    onChange={(e) => updateAssetFinancialSettings({ disposalClearingSubjectCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>资产减值损失科目</Label>
                  <Input
                    value={settings.assetFinancialSettings.impairmentLossSubjectCode}
                    onChange={(e) => updateAssetFinancialSettings({ impairmentLossSubjectCode: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
```

- [ ] **Step 3: 提交配置 UI**

```bash
git add src/components/assets/asset-category-dialog.tsx
git commit -m "feat: 核算规则对话框添加凭证规则配置标签页"
```

---

## Phase 4: 验收测试

### Task 10: 功能验收

- [ ] **Step 1: 测试处置凭证生成**
  1. 打开固定资产页面
  2. 选择一个资产，点击"处置"
  3. 填写处置信息，点击"预览凭证"
  4. 确认凭证分录正确
  5. 确认生成，检查凭证列表

- [ ] **Step 2: 测试增值凭证生成**
  1. 选择资产，点击"变动"
  2. 选择"增值"，填写金额
  3. 点击"预览凭证"
  4. 确认凭证正确

- [ ] **Step 3: 测试减值凭证生成**
  1. 选择资产，点击"变动"
  2. 选择"减值"，选择减值方式
  3. 点击"预览凭证"
  4. 验证两种方式的凭证分录

- [ ] **Step 4: 测试财务规则配置**
  1. 打开"核算规则"对话框
  2. 切换到"凭证规则"标签页
  3. 修改配置，保存
  4. 刷新页面，验证配置持久化

---

## 提交历史

```
feat: 新增资产财务规则配置和拆分合并记录类型定义
feat: 新增资产财务规则全局配置存储
feat: 新增资产拆分合并记录数据库表
feat: 完善资产凭证生成器，支持减值、重分类、拆分、合并凭证
feat: 新增资产凭证预览对话框组件
feat: 集成处置和增值凭证预览生成
feat: 处置对话框添加凭证预览功能
feat: 增值/减值对话框添加减值方式选择和凭证预览
feat: 核算规则对话框添加凭证规则配置标签页
```
