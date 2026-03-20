# 往来核销管理系统 - 第二阶段实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现往来核销管理系统的核心功能：Rec_Relation表、灵活核销机制、实时轧差算法、PartnerDashboard页面

**Architecture:** 在Phase I基础上扩展，添加核销关系表和高级查询功能

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Zustand + shadcn/ui + Tailwind CSS + IndexedDB

---

## 文件结构分析

需要修改和创建的文件：

1. `src/types/index.ts` - 类型定义，添加RecRelation和相关接口
2. `src/lib/database/manager.ts` - IndexedDB架构，添加recRelations存储
3. `src/lib/database/service.ts` - 数据库服务，添加recRelations的CRUD操作
4. `src/stores/useVoucherStore.ts` - 凭证状态管理，支持recRefNo字段
5. `src/stores/useAccountStore.ts` - 账户余额计算，添加实时轧差算法
6. `src/components/voucher/voucher-entry-grid.tsx` - 凭证录入表格，支持方向键导航
7. `src/components/voucher/outstanding-selector.tsx` - 未结清单据选择器组件
8. `src/components/partner/partner-dashboard.tsx` - 往来单位管理页面
9. `src/app/partner-dashboard/page.tsx` - PartnerDashboard页面路由

---

### Task 1: 更新类型定义

**Files:**
- Modify: `src/types/index.ts`

**步骤:**

- [ ] **Step 1: 添加RecRelation接口**

```typescript
// 核销关系表
export interface RecRelation {
  id: string;
  debitEntryId: string;        // 借方分录ID
  creditEntryId: string;       // 贷方分录ID
  amount: number;              // 核销金额
  recRefNo: string;            // 核销单号
  recDate: string;             // 核销日期
  createdBy: string;           // 创建人
  createdAt: string;           // 创建时间
  accountSetId?: string;       // 所属账套ID
}

// 未结清单据查询参数
export interface OutstandingQuery {
  partnerName: string;         // 往来单位名称
  subjectCode?: string;        // 科目代码（可选）
  startDate?: string;          // 开始日期（可选）
  endDate?: string;            // 结束日期（可选）
  amountRange?: [number, number]; // 金额范围（可选）
}

// 未结清单据项
export interface OutstandingItem {
  entryId: string;             // 分录ID
  voucherNo: string;           // 凭证号
  docNo: string;               // 业务单据号
  date: string;                // 日期
  summary: string;             // 摘要
  amount: number;              // 金额
  remainingAmount: number;     // 剩余未核销金额
  direction: 'debit' | 'credit'; // 方向
  partnerName?: string;        // 往来单位名称
}
```

- [ ] **Step 2: 更新VoucherEntry接口**

```typescript
export interface VoucherEntry {
  // ... 现有字段 ...
  docNo?: string;           // 业务单据号（发票号、银行流水号等）
  recRefNo?: string;        // 核销单号（为后续核销系统预留）
}
```

- [ ] **Step 3: 更新LedgerEntry接口**

```typescript
export interface LedgerEntry {
  // ... 现有字段 ...
  docNo?: string;           // 业务单据号（发票号、银行流水号等）
  recRefNo?: string;        // 核销单号（为后续核销系统预留）
}
```

- [ ] **Step 4: 验证类型定义**

确保 TypeScript 编译通过，没有类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add RecRelation and related types for reconciliation system"
```

---

### Task 2: 更新数据库架构

**Files:**
- Modify: `src/lib/database/manager.ts`
- Modify: `src/lib/database/service.ts`

**步骤:**

- [ ] **Step 1: 更新FinanceDB接口**

```typescript
export interface FinanceDB extends DBSchema {
  // ... 现有存储 ...
  recRelations: {
    key: string;
    value: any;
    indexes: {
      'by-accountSet': string;
      'by-recRefNo': string;
      'by-debitEntry': string;
      'by-creditEntry': string;
      'by-partner': string;
      'by-date': string;
    };
  };
}
```

- [ ] **Step 2: 更新数据库初始化**

```typescript
async init(): Promise<void> {
  // ... 现有初始化 ...
  this.db = await openDB<FinanceDB>('finance-assistant-db', 3, {
    upgrade(db) {
      // ... 现有升级逻辑 ...

      // 创建核销关系表（版本3）
      if (!db.objectStoreNames.contains('recRelations')) {
        const recRelationsStore = db.createObjectStore('recRelations', { keyPath: 'id' });
        recRelationsStore.createIndex('by-accountSet', 'accountSetId');
        recRelationsStore.createIndex('by-recRefNo', 'recRefNo');
        recRelationsStore.createIndex('by-debitEntry', 'debitEntryId');
        recRelationsStore.createIndex('by-creditEntry', 'creditEntryId');
        recRelationsStore.createIndex('by-partner', 'partnerName');
        recRelationsStore.createIndex('by-date', 'recDate');
      }

      // 为entries表添加recRefNo字段的索引
      const entriesStore = db.transaction('entries', 'readwrite').objectStore('entries');
      if (!entriesStore.indexNames.contains('by-recRefNo')) {
        entriesStore.createIndex('by-recRefNo', 'recRefNo');
      }
    },
  });
}
```

- [ ] **Step 3: 添加RecRelations的CRUD操作**

```typescript
class DatabaseService {
  // ... 现有方法 ...

  // ========== 核销关系操作 ==========

  async saveRecRelations(relations: RecRelation[]): Promise<void> {
    const tx = this.db.transaction('recRelations', 'readwrite');

    for (const relation of relations) {
      const relationWithAccountSet = {
        ...relation,
        accountSetId: this.accountSetId
      };
      await tx.objectStore('recRelations').put(relationWithAccountSet);
    }

    await tx.done;
  }

  async getRecRelationsByRecRefNo(recRefNo: string): Promise<RecRelation[]> {
    return await this.getAllFromIndexSafe('recRelations', 'by-recRefNo', recRefNo);
  }

  async getRecRelationsByEntryId(entryId: string): Promise<RecRelation[]> {
    const debitRelations = await this.getAllFromIndexSafe('recRelations', 'by-debitEntry', entryId);
    const creditRelations = await this.getAllFromIndexSafe('recRelations', 'by-creditEntry', entryId);
    return [...debitRelations, ...creditRelations];
  }

  async getOutstandingItems(query: OutstandingQuery): Promise<OutstandingItem[]> {
    const allEntries = await this.getAllFromIndexSafe('entries', 'by-accountSet', this.accountSetId);

    // 过滤往来单位分录
    let partnerEntries = allEntries.filter(entry =>
      entry.customerName === query.partnerName || entry.supplierName === query.partnerName
    );

    // 科目代码过滤
    if (query.subjectCode) {
      partnerEntries = partnerEntries.filter(entry =>
        entry.subjectCode === query.subjectCode
      );
    }

    // 日期范围过滤
    if (query.startDate && query.endDate) {
      partnerEntries = partnerEntries.filter(entry =>
        entry.date >= query.startDate && entry.date <= query.endDate
      );
    }

    const outstandingItems: OutstandingItem[] = [];

    for (const entry of partnerEntries) {
      const relations = await this.getRecRelationsByEntryId(entry.id);
      const totalRecAmount = relations.reduce((sum, rel) => {
        return sum + rel.amount;
      }, 0);

      const entryAmount = entry.debit > 0 ? entry.debit : entry.credit;
      const remainingAmount = entryAmount - totalRecAmount;

      if (remainingAmount > 0) {
        if (query.amountRange) {
          if (remainingAmount < query.amountRange[0] || remainingAmount > query.amountRange[1]) {
            continue;
          }
        }

        outstandingItems.push({
          entryId: entry.id,
          voucherNo: entry.voucherNo,
          docNo: entry.docNo || '',
          date: entry.date,
          summary: entry.summary,
          amount: entryAmount,
          remainingAmount,
          direction: entry.debit > 0 ? 'debit' : 'credit',
          partnerName: entry.customerName || entry.supplierName
        });
      }
    }

    return outstandingItems;
  }

  async calculatePartnerBalance(partnerName: string): Promise<number> {
    const outstandingItems = await this.getOutstandingItems({
      partnerName,
      subjectCode: '',
      startDate: '',
      endDate: '',
      amountRange: [0, Infinity]
    });

    const debitSum = outstandingItems
      .filter(item => item.direction === 'debit')
      .reduce((sum, item) => sum + item.remainingAmount, 0);

    const creditSum = outstandingItems
      .filter(item => item.direction === 'credit')
      .reduce((sum, item) => sum + item.remainingAmount, 0);

    return debitSum - creditSum;
  }
}
```

- [ ] **Step 4: 更新数据导出/导入功能**

```typescript
// 在exportData和importData方法中添加recRelations
async exportData() {
  return {
    // ... 现有导出 ...
    recRelations: await this.db.getAllFromIndex('recRelations', 'by-accountSet', this.accountSetId),
    exportDate: new Date().toISOString(),
    version: '2.2'
  };
}

async importData(data: any) {
  // ... 现有导入 ...

  if (data.recRelations) {
    for (const relation of data.recRelations) {
      await tx.objectStore('recRelations').put({ ...relation, accountSetId });
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/database/manager.ts src/lib/database/service.ts
git commit -m "feat: add recRelations storage and database operations"
```

---

### Task 3: 更新状态管理

**Files:**
- Modify: `src/stores/useVoucherStore.ts`
- Modify: `src/stores/useAccountStore.ts`

**步骤:**

- [ ] **Step 1: 更新useVoucherStore支持recRefNo**

```typescript
// 在addEntry方法中初始化recRefNo
const addEntry = (entry: Partial<VoucherEntry>) => {
  const newEntry: VoucherEntry = {
    id: generateId(),
    voucherId: currentVoucherId,
    date: currentDate,
    summary: '',
    subjectCode: '',
    subjectName: '',
    debit: 0,
    credit: 0,
    docNo: '',            // 新增字段
    recRefNo: '',         // 新增字段
    accountSetId: currentAccountSetId,
    ...entry
  };

  currentEntries.push(newEntry);
};

// 更新updateEntry方法支持recRefNo
const updateEntry = (id: string, field: keyof VoucherEntry, value: any) => {
  const index = currentEntries.findIndex(entry => entry.id === id);
  if (index !== -1) {
    currentEntries[index][field] = value;

    if (['debit', 'credit'].includes(field)) {
      // 当修改借方/贷方金额时，更新余额
      const subjectCode = currentEntries[index].subjectCode;
      if (subjectCode) {
        const balance = useAccountStore.getState().getAccountBalance(subjectCode, id);
        console.log(`科目 ${subjectCode} 余额更新:`, balance);
      }
    }
  }
};
```

- [ ] **Step 2: 更新useAccountStore添加实时轧差算法**

```typescript
// 实时余额计算（包含未入账金额）
const getAccountBalance = (subjectCode: string, excludeEntryId?: string): number => {
  const { ledgerEntries } = useVoucherStore.getState();
  const { currentEntries } = useVoucherStore.getState();

  // 从ledgerEntries计算历史余额
  const subjectEntries = ledgerEntries.filter(entry => entry.subjectCode === subjectCode);
  const debitTotal = subjectEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const creditTotal = subjectEntries.reduce((sum, entry) => sum + entry.credit, 0);

  // 加上当前凭证中该科目的未入账金额（排除指定分录）
  const currentSubjectEntries = currentEntries.filter(entry =>
    entry.subjectCode === subjectCode && entry.id !== excludeEntryId
  );
  const currentDebit = currentSubjectEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const currentCredit = currentSubjectEntries.reduce((sum, entry) => sum + entry.credit, 0);

  // 假设所有科目期初余额为0，实际应用中应从设置获取
  const openingBalance = 0;
  const direction = subjectCode.startsWith('1') || subjectCode.startsWith('5') || subjectCode.startsWith('6') ? 'debit' : 'credit';
  const closingBalance = direction === 'debit'
    ? openingBalance + debitTotal + currentDebit - (creditTotal + currentCredit)
    : openingBalance + creditTotal + currentCredit - (debitTotal + currentDebit);

  return closingBalance;
};

// 计算往来单位余额（实时轧差）
const getPartnerBalance = (partnerName: string): number => {
  const allEntries = useVoucherStore.getState().ledgerEntries;

  // 过滤该往来单位的所有分录
  const partnerEntries = allEntries.filter(entry =>
    entry.customerName === partnerName || entry.supplierName === partnerName
  );

  // 计算每个分录的已核销金额
  const entriesWithRec = partnerEntries.map(entry => {
    const relations = recRelations.filter(rel =>
      rel.debitEntryId === entry.id || rel.creditEntryId === entry.id
    );
    const recAmount = relations.reduce((sum, rel) => sum + rel.amount, 0);
    return {
      ...entry,
      recAmount,
      remainingAmount: (entry.debit > 0 ? entry.debit : entry.credit) - recAmount
    };
  });

  const debitSum = entriesWithRec
    .filter(entry => entry.debit > 0)
    .reduce((sum, entry) => sum + entry.remainingAmount, 0);

  const creditSum = entriesWithRec
    .filter(entry => entry.credit > 0)
    .reduce((sum, entry) => sum + entry.remainingAmount, 0);

  return debitSum - creditSum;
};

// 获取未结清单据
const getOutstandingItems = (query: OutstandingQuery): OutstandingItem[] => {
  const { partnerName, subjectCode, startDate, endDate, amountRange } = query;

  const allEntries = useVoucherStore.getState().ledgerEntries;
  const recRelations = useVoucherStore.getState().recRelations;

  const partnerEntries = allEntries.filter(entry =>
    entry.customerName === partnerName || entry.supplierName === partnerName
  );

  return partnerEntries.filter(entry => {
    const entryAmount = entry.debit > 0 ? entry.debit : entry.credit;
    const relations = recRelations.filter(rel =>
      rel.debitEntryId === entry.id || rel.creditEntryId === entry.id
    );
    const totalRecAmount = relations.reduce((sum, rel) => sum + rel.amount, 0);
    const remainingAmount = entryAmount - totalRecAmount;

    return remainingAmount > 0;
  }).map(entry => ({
    entryId: entry.id,
    voucherNo: entry.voucherNo,
    docNo: entry.docNo || '',
    date: entry.date,
    summary: entry.summary,
    amount: entry.debit > 0 ? entry.debit : entry.credit,
    remainingAmount: (entry.debit > 0 ? entry.debit : entry.credit) -
      recRelations.filter(rel =>
        rel.debitEntryId === entry.id || rel.creditEntryId === entry.id
      ).reduce((sum, rel) => sum + rel.amount, 0),
    direction: entry.debit > 0 ? 'debit' : 'credit',
    partnerName: entry.customerName || entry.supplierName
  }));
};
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/useVoucherStore.ts src/stores/useAccountStore.ts
git commit -m "feat: add real-time balance calculation and recRefNo field support"
```

---

### Task 4: 实现未结清单据选择器

**Files:**
- Create: `src/components/voucher/outstanding-selector.tsx`

**步骤:**

- [ ] **Step 1: 创建OutstandingSelector组件**

```typescript
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Checkbox, Input, DatePicker, NumberInput } from '@/components/ui';
import { Search, Filter, Check, X } from 'lucide-react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useAccountStore } from '@/stores/useAccountStore';

interface OutstandingSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName: string;
  onSelect: (items: OutstandingItem[]) => void;
}

export function OutstandingSelector({
  isOpen,
  onClose,
  partnerName,
  onSelect
}: OutstandingSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OutstandingItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useState<OutstandingQuery>({
    partnerName,
    subjectCode: '',
    startDate: '',
    endDate: '',
    amountRange: [0, Infinity]
  });

  const { getOutstandingItems } = useAccountStore();

  useEffect(() => {
    if (isOpen && partnerName) {
      loadOutstandingItems();
    }
  }, [isOpen, partnerName]);

  const loadOutstandingItems = async () => {
    setLoading(true);
    try {
      const results = await getOutstandingItems(searchParams);
      setItems(results);
      setSelectedItems([]);
    } catch (error) {
      console.error('加载未结清单据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleConfirm = () => {
    const selected = items.filter(item => selectedItems.includes(item.entryId));
    onSelect(selected);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>选择未结清单据</DialogTitle>
        </DialogHeader>

        <div className="p-4 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="科目代码"
              value={searchParams.subjectCode || ''}
              onChange={(e) => setSearchParams(prev => ({
                ...prev,
                subjectCode: e.target.value
              }))}
            />
            <DatePicker
              placeholder="开始日期"
              value={searchParams.startDate}
              onChange={(date) => setSearchParams(prev => ({
                ...prev,
                startDate: date
              }))}
            />
            <DatePicker
              placeholder="结束日期"
              value={searchParams.endDate}
              onChange={(date) => setSearchParams(prev => ({
                ...prev,
                endDate: date
              }))}
            />
            <div className="flex gap-2">
              <NumberInput
                placeholder="最小金额"
                value={searchParams.amountRange![0]}
                onChange={(value) => setSearchParams(prev => ({
                  ...prev,
                  amountRange: [value, prev.amountRange![1]]
                }))}
              />
              <NumberInput
                placeholder="最大金额"
                value={searchParams.amountRange![1]}
                onChange={(value) => setSearchParams(prev => ({
                  ...prev,
                  amountRange: [prev.amountRange![0], value]
                }))}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={loadOutstandingItems} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              查询
            </Button>
            <Button variant="outline" onClick={() => setSearchParams({
              partnerName,
              subjectCode: '',
              startDate: '',
              endDate: '',
              amountRange: [0, Infinity]
            })}>
              <X className="w-4 h-4 mr-2" />
              清空
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedItems.length === items.length && items.length > 0}
                onCheckedChange={() => selectedItems.length === items.length
                  ? setSelectedItems([])
                  : setSelectedItems(items.map(item => item.entryId))
                }
              />
              <span className="text-sm text-slate-600">
                已选 {selectedItems.length} / {items.length} 条
              </span>
            </div>
            <div className="text-sm text-slate-600">
              总金额:
              {items
                .filter(item => selectedItems.includes(item.entryId))
                .reduce((sum, item) => sum + item.remainingAmount, 0)
                .toFixed(2)}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>凭证号</TableHead>
                  <TableHead>单据号</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>剩余金额</TableHead>
                  <TableHead>方向</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      没有找到未结清单据
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow
                      key={item.entryId}
                      className={selectedItems.includes(item.entryId) ? 'bg-blue-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.entryId)}
                          onCheckedChange={() => handleSelect(item.entryId)}
                        />
                      </TableCell>
                      <TableCell>{item.voucherNo}</TableCell>
                      <TableCell>{item.docNo}</TableCell>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.summary}</TableCell>
                      <TableCell className="text-right">{item.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {item.remainingAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.direction === 'debit'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.direction === 'debit' ? '借方' : '贷方'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedItems.length === 0}
          >
            <Check className="w-4 h-4 mr-2" />
            确认核销
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/voucher/outstanding-selector.tsx
git commit -m "feat: add outstanding items selector component"
```

---

### Task 5: 实现PartnerDashboard页面

**Files:**
- Create: `src/components/partner/partner-dashboard.tsx`
- Create: `src/app/partner-dashboard/page.tsx`

**步骤:**

- [ ] **Step 1: 创建PartnerDashboard组件**

```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Search, ArrowRight, Download, Filter } from 'lucide-react';
import { Input, Button, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useVoucherStore } from '@/stores/useVoucherStore';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function PartnerDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview');
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const { partners, searchPartners } = usePartnerStore();
  const { getPartnerBalance, getOutstandingItems } = useAccountStore();
  const { getPartnerLedgerEntries } = useVoucherStore();

  const [summaryData, setSummaryData] = useState({
    totalPartners: 0,
    totalOutstanding: 0,
    totalRecAmount: 0,
    overdueCount: 0
  });

  const [balanceChartData, setBalanceChartData] = useState<any[]>([]);
  const [ageingChartData, setAgeingChartData] = useState<any[]>([]);

  useEffect(() => {
    const loadSummaryData = async () => {
      const totalPartners = partners.length;

      let totalOutstanding = 0;
      let overdueCount = 0;

      for (const partner of partners) {
        const balance = await getPartnerBalance(partner.name);
        totalOutstanding += balance;

        const items = await getOutstandingItems({
          partnerName: partner.name,
          subjectCode: '',
          startDate: '',
          endDate: new Date().toISOString().split('T')[0],
          amountRange: [0, Infinity]
        });

        if (items.length > 0) {
          overdueCount++;
        }
      }

      setSummaryData({
        totalPartners,
        totalOutstanding,
        totalRecAmount: 0,
        overdueCount
      });
    };

    loadSummaryData();
  }, [partners]);

  useEffect(() => {
    const loadChartData = async () => {
      const balanceData = partners.map(partner => ({
        name: partner.name,
        balance: await getPartnerBalance(partner.name)
      })).filter(item => item.balance !== 0);

      setBalanceChartData(balanceData);

      const ageingData = [
        { name: '0-30天', value: 0 },
        { name: '31-60天', value: 0 },
        { name: '61-90天', value: 0 },
        { name: '91-180天', value: 0 },
        { name: '180天以上', value: 0 }
      ];

      setAgeingChartData(ageingData);
    };

    loadChartData();
  }, [partners, timeRange]);

  const filteredPartners = searchPartners(searchText);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">往来单位管理</h1>
          <p className="text-slate-600 mt-1">客户与供应商往来账款分析与管理</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onChange={setTimeRange}>
            <option value="week">近7天</option>
            <option value="month">本月</option>
            <option value="quarter">本季度</option>
            <option value="year">本年</option>
          </Select>
          <Button>
            <Download className="w-4 h-4 mr-2" />
            导出报表
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">总客户数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summaryData.totalPartners}</div>
            <p className="text-xs text-green-600 mt-1">+12% 较上月</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">未结余额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {summaryData.totalOutstanding.toFixed(2)}
            </div>
            <p className="text-xs text-red-600 mt-1">-8.5% 较上月</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">本月核销</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {summaryData.totalRecAmount.toFixed(2)}
            </div>
            <p className="text-xs text-green-600 mt-1">+23% 较上月</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">逾期客户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summaryData.overdueCount}</div>
            <p className="text-xs text-yellow-600 mt-1">+3 较上月</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>客户余额分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={balanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="balance" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>账龄分析</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ageingChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {ageingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>往来单位明细</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="搜索客户/供应商..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64"
            />
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              筛选
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>往来单位</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>未结余额</TableHead>
                <TableHead>本月发生</TableHead>
                <TableHead>本月核销</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPartners.map((partner) => (
                <TableRow
                  key={partner.id}
                  className={selectedPartner === partner.id ? 'bg-blue-50' : ''}
                >
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      partner.isCustomer && partner.isSupplier
                        ? 'bg-purple-100 text-purple-800'
                        : partner.isCustomer
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {partner.isCustomer && partner.isSupplier
                        ? '客户/供应商'
                        : partner.isCustomer
                          ? '客户'
                          : '供应商'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {getPartnerBalance(partner.name).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">0.00</TableCell>
                  <TableCell className="text-right">0.00</TableCell>
                  <TableCell className="text-right">
                    {getPartnerBalance(partner.name).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPartner(partner.id);
                        setActiveTab('detail');
                      }}
                    >
                      查看明细 <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedPartner && activeTab === 'detail' && (
        <PartnerDetailViewer
          partnerId={selectedPartner}
          onClose={() => setActiveTab('overview')}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建页面路由**

```typescript
import { Suspense } from 'react';
import { PartnerDashboard } from '@/components/partner/partner-dashboard';

export default function PartnerDashboardPage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <PartnerDashboard />
    </Suspense>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/partner/partner-dashboard.tsx src/app/partner-dashboard/page.tsx
git commit -m "feat: add PartnerDashboard page with overview and detail views"
```

---

### Task 6: 优化键盘导航

**Files:**
- Modify: `src/components/voucher/voucher-entry-grid.tsx`

**步骤:**

- [ ] **Step 1: 增强handleKeyDown支持方向键**

```typescript
const handleKeyDown = (
  entryId: string,
  field: string,
  index: number,
  e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => {
  const isLastRow = index === entries.length - 1;
  const fields = ['summary', 'subject', 'docNo', 'debit', 'credit', 'deptCode', 'projectCode', 'customerSupplier', 'recRefNo'];
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

  // 原有Tab和Enter键逻辑保持不变
  if (e.key === 'Tab') {
    e.preventDefault();

    if (isLastRow && isLastField) {
      addVoucherRow();
    } else if (currentIndex < fields.length - 1) {
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
      addVoucherRow();
    }
  }
};
```

- [ ] **Step 2: 更新fields数组**

```typescript
// 在renderCell函数中添加recRefNo字段的渲染
case 'recRefNo':
  return (
    <td key={colId} className="p-0 border-r border-slate-300 last:border-r-0" style={{ padding: 0 }}>
      <Input
        variant="excel"
        data-field="recRefNo"
        data-entry-id={entry.id}
        value={entry.recRefNo || ''}
        onChange={(e) => updateEntry(entry.id, 'recRefNo', e.target.value)}
        onKeyDown={(e) => handleKeyDown(entry.id, 'recRefNo', index, e)}
        onFocus={() => handleFocus(entry.id, 'recRefNo')}
        onBlur={handleBlur}
        placeholder="核销单号"
        className={isCellFocused ? 'border-2 border-blue-500 z-10 relative' : ''}
        style={{ height: ROW_HEIGHT, borderRadius: 0 }}
      />
    </td>
  );
```

- [ ] **Step 3: Commit**

```bash
git add src/components/voucher/voucher-entry-grid.tsx
git commit -m "feat: enhance keyboard navigation with arrow keys support"
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

- [ ] **Step 3: 测试实时余额更新**

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

- [ ] **Step 5: 测试PartnerDashboard**

1. 打开 http://localhost:3000/partner-dashboard
2. 验证页面加载和渲染
3. 测试搜索功能
4. 点击查看明细，验证下钻功能
5. 验证图表和统计数据展示

- [ ] **Step 6: 测试从Excel粘贴**

1. 打开Excel文件，复制一些数据
2. 在凭证录入页面选择一个单元格
3. 使用 Ctrl+V 粘贴
4. 验证数据正确匹配到相应字段

- [ ] **Step 7: 验证数据完整性**

1. 添加多条分录，包含业务单据号
2. 保存凭证
3. 查看明细账，验证业务单据号显示
4. 在PartnerDashboard页面查看数据

---

## 完成检查

所有任务完成后，验证：

- [ ] 业务单据号字段可以正常输入、保存、加载
- [ ] 余额在输入借方/贷方金额时实时更新（包含当前凭证未入账金额）
- [ ] 键盘方向键可以正常在单元格间移动
- [ ] PartnerDashboard页面功能完整
- [ ] 从Excel粘贴功能正常工作
- [ ] 所有TypeScript编译通过
- [ ] 所有现有功能继续正常工作
- [ ] 提交历史清晰，每个功能独立提交
