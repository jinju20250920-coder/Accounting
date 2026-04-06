
# 银行流水导入功能设计 - Bank Statement Import Feature Design

## 概述

完善银行流水导入功能，支持解析中国建设银行（和其他常见银行）格式的银行流水文件，实现完整的导入 → 预览 → 匹配 → 生成凭证的端到端工作流程。

## 功能需求

### 核心功能
- **文件上传**：支持 .xls, .xlsx, .csv 格式的银行流水文件
- **解析**：解析银行流水格式，提取交易数据
- **预览**：显示解析后的交易记录预览
- **智能匹配**：使用L1规则和L2学习匹配会计科目
- **银行账户选择**：让用户选择对应的银行账户作为平衡分录
- **凭证生成**：从交易记录生成会计凭证

### 支持的银行格式
- 中国建设银行（当前支持）
- 扩展性设计，支持添加其他银行格式

## 技术实现方案

### 1. 解析器增强 (`src/lib/parser.ts`)

#### 建设银行格式解析
```typescript
// 更新 parseBankStatement 函数
export async function parseBankStatement(file: File): Promise<ParseResult> {
  // 1. 读取Excel文件
  // 2. 跳过前7行表头信息
  // 3. 提取账户信息（账户名、账号、开户行）
  // 4. 解析交易数据（从第10行开始）
  // 5. 处理借方/贷方金额
  // 6. 验证数据完整性
}
```

#### 解析器架构
```typescript
interface BankStatementParseResult {
  fileName: string;
  type: 'bank';
  accountInfo: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branch: string;
  };
  transactions: Transaction[];
  errors: ParseError[];
}
```

### 2. UI组件增强 (`src/components/transaction-import.tsx`)

#### 主要改进
- 替换mock数据，使用真实解析器
- 添加银行账户选择功能
- 增强错误处理和用户反馈
- 优化预览展示

#### 银行账户选择
```typescript
// 在预览阶段添加银行账户选择
function BankAccountSelector({ 
  accounts, 
  selected, 
  onChange 
}: { 
  accounts: BankAccount[];
  selected: string;
  onChange: (accountId: string) => void;
}) {
  // 渲染银行账户选择下拉框
}
```

### 3. 数据流程

#### 导入工作流程
```
1. 文件上传
   ↓
2. 格式验证和解析
   ↓
3. 数据预览和错误检查
   ↓
4. 银行账户选择（平衡分录）
   ↓
5. AI科目智能匹配
   ↓
6. 凭证生成确认
   ↓
7. 生成凭证并保存
```

### 4. 错误处理

#### 解析错误
- **格式识别**：识别文件是否符合银行流水格式
- **字段验证**：验证日期、金额等字段的有效性
- **完整性检查**：确保每行交易至少有借方或贷方金额

#### 用户反馈
- 错误信息显示（含行号）
- 视觉指示器（红色高亮）
- 错误统计摘要

### 5. 测试策略

#### 单元测试
```typescript
// 测试 parseBankStatement 函数
test('parse valid bank statement', async () => {
  const result = await parseBankStatement(file);
  expect(result.transactions.length).toBeGreaterThan(0);
  expect(result.errors).toEqual([]);
});

// 测试交易解析
test('parse transaction debit/credit', () => {
  // 测试借方和贷方金额解析
});
```

#### 集成测试
- 文件上传到解析的完整流程
- 预览和选择交互
- 凭证生成验证

## 代码修改清单

### 需要修改的文件
1. `src/lib/parser.ts` - 更新银行流水解析器
2. `src/components/transaction-import.tsx` - 增强导入组件
3. `src/app/import/page.tsx` - 调整导入页面
4. `src/stores/useVoucherStore.ts` - 可能需要添加交易处理方法
5. `src/types/index.ts` - 添加相关类型定义

### 需要创建的文件
1. `src/lib/bank-parsers/ccb-parser.ts` - 建设银行专用解析器
2. `src/components/bank-account-selector.tsx` - 银行账户选择组件
3. `tests/bank-import.test.ts` - 测试文件

## 功能验证

### 验证要点
- [ ] 正确解析中国建设银行格式的银行流水
- [ ] 处理各种交易类型（转账、缴税、结息等）
- [ ] 智能匹配会计科目
- [ ] 正确生成凭证
- [ ] 处理解析和验证错误
- [ ] 支持中文和英文文件名
- [ ] 处理大文件导入（>1000条记录）

## 扩展考虑

### 支持其他银行格式
- 创建银行格式解析器接口
- 实现其他银行（如工商银行、农业银行）的解析器
- 格式检测和自动选择解析器

### 未来优化
- 银行流水模板下载
- 导入历史记录和重复检查
- 批量导入和自动化

---

**最后更新时间**：2026-04-06  
**作者**：Claude Code  
**状态**：待审核
