# 凭证录入增强功能 - 第一阶段设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现凭证录入页面的基础增强功能，包括业务单据号字段、余额实时更新和键盘导航优化

**Architecture:** 在现有凭证录入系统基础上扩展，保持向后兼容

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Zustand + shadcn/ui + Tailwind CSS

---

## 1. 概述

本设计文档描述了凭证录入系统的第一阶段增强功能，包括：

1. **业务单据号字段** - 在凭证行中添加业务单据号（发票号、银行流水号等）
2. **余额实时更新** - 当输入借方/贷方金额时，科目余额实时更新（包含当前凭证的未入账金额）
3. **键盘导航优化** - 支持使用上下左右方向键在表格单元格之间移动

这些功能是后续往来核销管理系统的基础。

---

## 2. 业务单据号字段

### 2.1 类型定义更新

**文件:** `src/types/index.ts`

在 `VoucherEntry` 和 `LedgerEntry` 接口中添加新字段：

```typescript
// 凭证分录类型
interface VoucherEntry {
  id: string;
  voucherId: string;
  date: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  deptCode?: string;
  projectCode?: string;
  debit: number;
  credit: number;
  auxiliary?: {
    department?: string;
    project?: string;
    customer?: string;
    supplier?: string;
  };

  // 新增字段
  docNo?: string;           // 业务单据号（发票号、银行流水号等）
  recRefNo?: string;        // 核销单号（为后续核销系统预留）
}

// 记账记录类型
interface LedgerEntry {
  id: string;
  voucherId: string;
  voucherNo: string;
  date: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  deptCode?: string;
  projectCode?: string;
  debit: number;
  credit: number;
  status: 'draft' | 'review' | 'posted' | 'reversed';

  // 新增字段
  docNo?: string;           // 业务单据号（发票号、银行流水号等）
  recRefNo?: string;        // 核销单号（为后续核销系统预留）
}
```

### 2.2 Store 更新

**文件:** `src/stores/useVoucherStore.ts`

1. 在 `addEntry` 方法中初始化新字段
2. 在 `updateEntry` 方法中支持更新新字段
3. 在 `saveVoucher` 方法中将新字段保存到 ledgerEntries

### 2.3 UI 更新

**文件:** `src/components/voucher/voucher-entry-grid.tsx`

1. 在列配置中添加 `docNo` 列：
   - 列ID: `docNo`
   - 列标题: "业务单据号"
   - 默认可见: true
   - 宽度: 150px

2. 在列设置中添加该列的显示/隐藏选项

3. 渲染单元格:
   - 使用 Input 组件
   - variant="excel"
   - 支持输入任意文本
   - data-field="docNo"
   - data-entry-id={entry.id}

---

## 3. 余额实时更新

### 3.1 计算逻辑改进

**文件:** `src/stores/useAccountStore.ts`

修改 `calculateBalanceFromLedger` 函数，使其包含当前凭证的未入账金额：

```typescript
const calculateBalanceFromLedger = (subjectCode: string): SubjectBalance => {
  // 从 useVoucherStore 获取历史数据和当前数据
  const { ledgerEntries, currentEntries } = useVoucherStore.getState();

  // 从 ledgerEntries 计算历史余额
  const subjectEntries = ledgerEntries.filter(entry => entry.subjectCode === subjectCode);
  const debitTotal = subjectEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const creditTotal = subjectEntries.reduce((sum, entry) => sum + entry.credit, 0);

  // 加上当前凭证中该科目的金额（未入账金额）
  const currentSubjectEntries = currentEntries.filter(entry => entry.subjectCode === subjectCode);
  const currentDebit = currentSubjectEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const currentCredit = currentSubjectEntries.reduce((sum, entry) => sum + entry.credit, 0);

  // 假设所有科目期初余额为0，实际应用中应从设置获取
  const openingBalance = 0;
  const direction = subjectCode.startsWith('1') || subjectCode.startsWith('5') || subjectCode.startsWith('6') ? 'debit' : 'credit';
  const closingBalance = direction === 'debit'
    ? openingBalance + debitTotal + currentDebit - (creditTotal + currentCredit)
    : openingBalance + creditTotal + currentCredit - (debitTotal + currentDebit);

  // 获取科目名称（从科目表获取）
  let subjectName = subjectCode;
  try {
    const subjects = require('../lib/data/subjects.json');
    const subject = subjects.find((s: any) => s.code === subjectCode);
    if (subject) {
      subjectName = subject.name;
    }
  } catch (error) {
    console.error('Failed to load subjects:', error);
  }

  return {
    subjectCode,
    subjectName,
    openingBalance,
    debitTotal: debitTotal + currentDebit,
    creditTotal: creditTotal + currentCredit,
    closingBalance,
    direction
  };
};
```

### 3.2 UI 更新触发

**文件:** `src/components/voucher/voucher-entry-grid.tsx`

由于余额计算函数现在依赖 `currentEntries`，当 `currentEntries` 更新时，React 会自动重新渲染显示余额的组件。无需额外的触发逻辑。

---

## 4. 键盘导航优化

### 4.1 导航逻辑

**文件:** `src/components/voucher/voucher-entry-grid.tsx`

增强 `handleKeyDown` 函数，支持上下左右方向键：

```typescript
const handleKeyDown = (
  entryId: string,
  field: string,
  index: number,
  e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => {
  const isLastRow = index === entries.length - 1;
  const fields = ['summary', 'subject', 'docNo', 'debit', 'credit', 'deptCode', 'projectCode', 'customerSupplier'];
  const currentIndex = fields.indexOf(field);
  const isLastField = currentIndex === fields.length - 1;
  const isSummaryField = field === 'summary';
  const entryIndex = entries.findIndex(e => e.id === entryId);

  // 方向键导航
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (currentIndex < fields.length - 1) {
      const nextField = fields[currentIndex + 1];
      const nextInput = document.querySelector(`[data-entry-id="${entryId}"][data-field="${nextField}"]`) as HTMLElement;
      if (nextInput) {
        nextInput.focus();
        if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
          (nextInput as any).select();
        }
      }
    }
    return;
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (currentIndex > 0) {
      const prevField = fields[currentIndex - 1];
      const prevInput = document.querySelector(`[data-entry-id="${entryId}"][data-field="${prevField}"]`) as HTMLElement;
      if (prevInput) {
        prevInput.focus();
        if ('select' in prevInput && typeof (prevInput as any).select === 'function') {
          (prevInput as any).select();
        }
      }
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (entryIndex < entries.length - 1) {
      const nextEntry = entries[entryIndex + 1];
      const nextInput = document.querySelector(`[data-entry-id="${nextEntry.id}"][data-field="${field}"]`) as HTMLElement;
      if (nextInput) {
        nextInput.focus();
        if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
          (nextInput as any).select();
        }
      }
    }
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (entryIndex > 0) {
      const prevEntry = entries[entryIndex - 1];
      const prevInput = document.querySelector(`[data-entry-id="${prevEntry.id}"][data-field="${field}"]`) as HTMLElement;
      if (prevInput) {
        prevInput.focus();
        if ('select' in prevInput && typeof (prevInput as any).select === 'function') {
          (prevInput as any).select();
        }
      }
    }
    return;
  }

  // 原有 Tab 和 Enter 键逻辑
  if (e.key === 'Tab') {
    e.preventDefault();

    if (isLastRow && isLastField) {
      // 最后一行最后一个字段按 Tab，新增一行
      addVoucherRow();
    } else if (currentIndex < fields.length - 1) {
      // 跳到下一个字段
      const nextField = fields[currentIndex + 1];
      const nextInput = document.querySelector(`[data-entry-id="${entryId}"][data-field="${nextField}"]`) as HTMLElement;
      if (nextInput) {
        nextInput.focus();
        if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
          (nextInput as any).select();
        }
      }
    }
  } else if (e.key === 'Enter' && !e.shiftKey && !isSummaryField) {
    e.preventDefault();

    if (isLastRow) {
      // 最后一行按 Enter，新增一行
      addVoucherRow();
    }
  }
};
```

### 4.2 组件更新

确保所有输入组件都正确设置 `data-field` 和 `data-entry-id` 属性，以便导航器能找到它们。

---

## 5. 数据库更新

### 5.1 数据库版本迁移

**文件:** `src/lib/database/manager.ts`

如果需要，更新数据库版本以支持新字段：

```typescript
const DB_VERSION = 2; // 从 1 升级到 2
```

在 `upgradeneeded` 事件中添加迁移逻辑，为现有记录添加新字段。

### 5.2 数据库服务更新

**文件:** `src/lib/database/service.ts`

确保 `saveVoucher` 和其他相关方法正确保存和读取新字段。

---

## 6. 测试方案

### 6.1 单元测试

1. **类型测试**: 验证新字段在 TypeScript 中正确工作
2. **余额计算测试**: 验证余额计算包含当前凭证的金额
3. **键盘导航测试**: 验证方向键正确移动焦点

### 6.2 集成测试

1. **业务单据号输入测试**: 输入、保存、显示验证
2. **余额实时更新测试**: 输入金额后验证余额立即更新
3. **完整流程测试**: 凭证录入 → 保存 → 查看业务单据号

---

## 7. 向后兼容性

- 现有凭证数据在加载时会自动获得空的 `docNo` 和 `recRefNo` 字段
- 现有功能继续正常工作
- 新列默认显示，但可以通过列设置隐藏

---

## 8. 后续阶段预览

第二阶段将实现：
- Rec_Relation 核销关联表
- 灵活核销机制（未结清单据选择器）

第三阶段将实现：
- PartnerDashboard 三级穿透页面
- 账龄分析矩阵
- 预收冲应收自动结转
- 异常核销预警
