# 凭证录入增强功能 - 第一阶段实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现凭证录入页面的业务单据号字段、余额实时更新和键盘导航优化功能

**Architecture:** 在现有代码基础上逐步扩展，保持向后兼容性，每个功能独立实现并测试

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Zustand + shadcn/ui + Tailwind CSS

---

## 文件结构分析

需要修改的文件：

1. `src/types/index.ts` - 类型定义，添加新字段
2. `src/stores/useVoucherStore.ts` - 凭证状态管理，支持新字段
3. `src/stores/useAccountStore.ts` - 余额计算，包含当前凭证金额
4. `src/components/voucher/voucher-entry-grid.tsx` - 凭证录入表格，添加新列和键盘导航
5. `src/lib/database/service.ts` - 数据库服务，保存新字段

---

### Task 1: 更新类型定义

**Files:**
- Modify: `src/types/index.ts`

**步骤:**

- [ ] **Step 1: 读取当前类型定义**

读取 `src/types/index.ts` 文件，找到 `VoucherEntry` 和 `LedgerEntry` 接口。

- [ ] **Step 2: 添加新字段到 VoucherEntry**

在 `VoucherEntry` 接口中添加：
```typescript
docNo?: string;           // 业务单据号（发票号、银行流水号等）
recRefNo?: string;        // 核销单号（为后续核销系统预留）
```

- [ ] **Step 3: 添加新字段到 LedgerEntry**

在 `LedgerEntry` 接口中添加：
```typescript
docNo?: string;           // 业务单据号（发票号、银行流水号等）
recRefNo?: string;        // 核销单号（为后续核销系统预留）
```

- [ ] **Step 4: 验证类型定义**

确保 TypeScript 编译通过，没有类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add docNo and recRefNo fields to types"
```

---

### Task 2: 更新 useVoucherStore 支持新字段

**Files:**
- Modify: `src/stores/useVoucherStore.ts`

**步骤:**

- [ ] **Step 1: 读取 useVoucherStore.ts**

读取 `src/stores/useVoucherStore.ts` 文件，了解当前结构。

- [ ] **Step 2: 更新 addEntry 方法**

在 `addEntry` 方法中，确保新创建的分录包含 `docNo` 和 `recRefNo` 字段（初始化为 undefined 或空字符串）。

- [ ] **Step 3: 更新 updateEntry 方法**

确保 `updateEntry` 方法支持更新 `docNo` 和 `recRefNo` 字段。

- [ ] **Step 4: 更新 saveVoucher 方法**

在 `saveVoucher` 方法中，将 `docNo` 和 `recRefNo` 从 `currentEntries` 保存到 `ledgerEntries`。

- [ ] **Step 5: 更新 loadTemplate 方法（如果有）**

如果有 `loadTemplate` 方法，确保它也处理新字段。

- [ ] **Step 6: 验证 Store 更新**

检查 TypeScript 编译通过，确保所有方法正确处理新字段。

- [ ] **Step 7: Commit**

```bash
git add src/stores/useVoucherStore.ts
git commit -m "feat: update useVoucherStore to support docNo and recRefNo"
```

---

### Task 3: 更新 useAccountStore 实现余额实时更新

**Files:**
- Modify: `src/stores/useAccountStore.ts`

**步骤:**

- [ ] **Step 1: 读取 useAccountStore.ts**

读取 `src/stores/useAccountStore.ts` 文件，找到 `calculateBalanceFromLedger` 函数。

- [ ] **Step 2: 修改 calculateBalanceFromLedger 函数**

更新函数，使其包含当前凭证的未入账金额：

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

- [ ] **Step 3: 验证余额计算**

确保函数正确计算包含当前凭证金额的余额。

- [ ] **Step 4: Commit**

```bash
git add src/stores/useAccountStore.ts
git commit -m "feat: update balance calculation to include current voucher amounts"
```

---

### Task 4: 更新 voucher-entry-grid 添加业务单据号列

**Files:**
- Modify: `src/components/voucher/voucher-entry-grid.tsx`

**步骤:**

- [ ] **Step 1: 读取 voucher-entry-grid.tsx**

读取 `src/components/voucher/voucher-entry-grid.tsx` 文件，了解当前列配置结构。

- [ ] **Step 2: 更新 columnInfo 数组**

在 `columnInfo` 数组中添加新列：
```typescript
{ id: 'docNo', label: '业务单据号' }
```

位置建议：在 `subject` 列之后，`debit` 列之前。

- [ ] **Step 3: 更新 columnVisibility 初始状态**

在 `columnVisibility` 初始状态中添加：
```typescript
docNo: true
```

- [ ] **Step 4: 更新 columnOrder 初始状态**

在 `columnOrder` 初始状态中添加 `'docNo'`，位置与 `columnInfo` 一致。

- [ ] **Step 5: 更新 renderCell 函数**

在 `renderCell` 函数的 `switch` 语句中添加 `docNo`  case：

```typescript
case 'docNo':
  return (
    <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
      <Input
        variant="excel"
        data-field="docNo"
        data-entry-id={entry.id}
        value={entry.docNo || ''}
        onChange={(e) => updateEntry(entry.id, 'docNo', e.target.value)}
        onKeyDown={(e) => handleKeyDown(entry.id, 'docNo', index, e)}
        onFocus={() => handleFocus(entry.id, 'docNo')}
        onBlur={handleBlur}
        placeholder="单据号"
        className={isCellFocused ? 'border-2 border-blue-500 z-10 relative' : ''}
        style={{ height: ROW_HEIGHT, borderRadius: 0 }}
      />
    </td>
  );
```

- [ ] **Step 6: 更新 fields 数组（用于键盘导航）**

在 `handleKeyDown` 函数中的 `fields` 数组添加 `'docNo'`：

```typescript
const fields = ['summary', 'subject', 'docNo', 'debit', 'credit', 'deptCode', 'projectCode', 'customerSupplier'];
```

- [ ] **Step 7: 验证列添加**

确保新列正确显示，输入框正常工作。

- [ ] **Step 8: Commit**

```bash
git add src/components/voucher/voucher-entry-grid.tsx
git commit -m "feat: add docNo column to voucher entry grid"
```

---

### Task 5: 更新 voucher-entry-grid 优化键盘导航

**Files:**
- Modify: `src/components/voucher/voucher-entry-grid.tsx`

**步骤:**

- [ ] **Step 1: 读取 voucher-entry-grid.tsx 中的 handleKeyDown 函数**

找到 `handleKeyDown` 函数，了解当前实现。

- [ ] **Step 2: 增强 handleKeyDown 函数支持方向键**

在函数开头添加方向键处理逻辑：

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

  // 原有 Tab 和 Enter 键逻辑保持不变...
  // [保留原有的 Tab 和 Enter 键处理代码]
};
```

- [ ] **Step 3: 确保所有输入组件有正确的 data 属性**

检查所有输入组件（Input、Select、Textarea 等）都设置了：
- `data-field={fieldName}`
- `data-entry-id={entry.id}`

特别是 `docNo` 字段的输入框，确保它有这些属性。

- [ ] **Step 4: 测试键盘导航**

测试：
- 左右方向键在同一行的字段间移动
- 上下方向键在不同行的同字段间移动
- Tab 和 Enter 键继续正常工作

- [ ] **Step 5: Commit**

```bash
git add src/components/voucher/voucher-entry-grid.tsx
git commit -m "feat: enhance keyboard navigation with arrow keys"
```

---

### Task 6: 更新数据库服务保存新字段

**Files:**
- Modify: `src/lib/database/service.ts`

**步骤:**

- [ ] **Step 1: 读取 database/service.ts**

读取 `src/lib/database/service.ts` 文件，找到 `saveVoucher` 或相关保存方法。

- [ ] **Step 2: 确保新字段被保存**

检查保存凭证的方法，确保 `docNo` 和 `recRefNo` 字段被正确保存到数据库中。

- [ ] **Step 3: 确保新字段被读取**

检查读取凭证的方法，确保 `docNo` 和 `recRefNo` 字段被正确读取。

- [ ] **Step 4: Commit（如果有修改）**

```bash
git add src/lib/database/service.ts
git commit -m "feat: ensure docNo and recRefNo are saved to database"
```

---

### Task 7: 综合测试

**Files:**
- 测试手动进行

**步骤:**

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试业务单据号字段**

1. 打开凭证录入页面
2. 验证"业务单据号"列显示
3. 在业务单据号输入框中输入文本
4. 保存凭证
5. 刷新页面，验证业务单据号被正确保存和加载

- [ ] **Step 3: 测试余额实时更新**

1. 选择一个已有余额的科目
2. 注意显示的余额
3. 输入借方金额
4. 验证余额立即更新（增加借方金额）
5. 输入贷方金额
6. 验证余额立即更新（减少贷方金额）

- [ ] **Step 4: 测试键盘导航**

1. 点击任意单元格
2. 按 ArrowRight 键，验证焦点移动到右侧单元格
3. 按 ArrowLeft 键，验证焦点移动到左侧单元格
4. 按 ArrowDown 键，验证焦点移动到下方同列单元格
5. 按 ArrowUp 键，验证焦点移动到上方同列单元格
6. 验证 Tab 和 Enter 键继续正常工作

- [ ] **Step 5: 测试列设置**

1. 打开列设置
2. 验证"业务单据号"列可以隐藏和显示
3. 验证隐藏/显示立即生效

- [ ] **Step 6: 测试向后兼容性**

1. 加载旧的凭证数据
2. 验证旧数据正常显示
3. 验证旧数据可以正常编辑和保存

---

## 完成检查

所有任务完成后，验证：

- [ ] 业务单据号字段可以正常输入、保存、加载
- [ ] 余额在输入借方/贷方金额时实时更新
- [ ] 键盘方向键可以正常在单元格间移动
- [ ] 所有 TypeScript 编译通过
- [ ] 所有现有功能继续正常工作
- [ ] 提交历史清晰，每个功能独立提交
