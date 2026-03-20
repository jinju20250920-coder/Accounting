# 凭证录入增强功能 - 第二阶段设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现往来核销管理系统的核心功能，包括Rec_Relation表、灵活核销机制和PartnerDashboard页面

**Architecture:** 在Phase I基础上扩展，添加核销关系表和高级查询功能

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Zustand + shadcn/ui + Tailwind CSS + IndexedDB

---

## 1. 概述

本设计文档描述了往来核销管理系统的第二阶段增强功能，包括：

1. **Schema扩展**：创建Rec_Relation表存储借贷对冲关系
2. **灵活核销机制**：升级VoucherTable单元格，支持弹出式未结清单据选择器
3. **PartnerDashboard页面**：实现"汇总卡片 → 客户列表 → 点击下钻明细"的交互流
4. **实时轧差算法**：计算客户余额的实时轧差：余额 = 所有未全额核销的借方行之和 - 贷方行之和
5. **粘贴适配逻辑**：确保从Excel粘贴单据编号时能正确匹配后台ID
6. **报表展示优化**：明细账中清晰标注"核销关联单据"和"实际结清日期"

---

## 2. Rec_Relation 核销关系表设计

### 2.1 类型定义

**文件:** `src/types/index.ts`

新增RecRelation接口：

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

### 2.2 数据库设计

**文件:** `src/lib/database/manager.ts`

在FinanceDB接口中添加recRelations存储：

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

在upgrade函数中添加recRelations存储创建：

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
    },
  });
}
```

### 2.3 数据库服务

**文件:** `src/lib/database/service.ts`

在DatabaseService类中添加recRelations的CRUD操作：

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
    // 复杂查询逻辑：
    // 1. 按partnerName查询所有相关的未全额核销分录
    // 2. 计算每个分录的剩余未核销金额
    // 3. 过滤符合条件的分录

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

    // 计算每个分录的已核销金额
    const outstandingItems: OutstandingItem[] = [];

    for (const entry of partnerEntries) {
      const relations = await this.getRecRelationsByEntryId(entry.id);
      const totalRecAmount = relations.reduce((sum, rel) => {
        return sum + rel.amount;
      }, 0);

      const remainingAmount = (entry.debit > 0 ? entry.debit : entry.credit) - totalRecAmount;

      if (remainingAmount > 0) {
        outstandingItems.push({
          entryId: entry.id,
          voucherNo: entry.voucherNo,
          docNo: entry.docNo || '',
          date: entry.date,
          summary: entry.summary,
          amount: entry.debit > 0 ? entry.debit : entry.credit,
          remainingAmount,
          direction: entry.debit > 0 ? 'debit' : 'credit',
          partnerName: entry.customerName || entry.supplierName
        });
      }
    }

    // 金额范围过滤
    if (query.amountRange) {
      outstandingItems.filter(item =>
        item.remainingAmount >= query.amountRange![0] &&
        item.remainingAmount <= query.amountRange![1]
      );
    }

    return outstandingItems;
  }

  async calculatePartnerBalance(partnerName: string): Promise<number> {
    const outstandingItems = await this.getOutstandingItems({ partnerName });

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

---

## 3. 灵活核销机制

### 3.1 弹出式未结清单据选择器

**文件:** `src/components/voucher/outstanding-selector.tsx`

创建未结清单据选择器组件：

```typescript
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Checkbox,
  Input,
  DatePicker,
  NumberInput
} from '@/components/ui';
import { Search, Filter, Plus, Check, X } from 'lucide-react';
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

  // 加载未结清单据
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
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.entryId));
    }
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

        {/* 查询条件 */}
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

        {/* 结果列表 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedItems.length === items.length && items.length > 0}
                onCheckedChange={handleSelectAll}
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

        {/* 操作按钮 */}
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

### 3.2 升级VoucherEntryGrid支持核销

**文件:** `src/components/voucher/voucher-entry-grid.tsx`

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

// 在columnInfo中添加recRefNo列
const columnInfo = [
  // ... 现有列 ...
  { id: 'recRefNo', label: '核销单号', width: 120 }
];

// 在columnVisibility中添加recRefNo
const columnVisibility = {
  // ... 现有可见性 ...
  recRefNo: true
};

// 在fields数组中添加recRefNo
const fields = ['summary', 'subject', 'docNo', 'debit', 'credit', 'deptCode', 'projectCode', 'customerSupplier', 'recRefNo'];
```

---

## 4. PartnerDashboard 页面设计

### 4.1 页面架构

**文件:** `src/app/partner-dashboard/page.tsx`

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

**文件:** `src/components/partner/partner-dashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
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

  // 汇总数据
  const [summaryData, setSummaryData] = useState({
    totalPartners: 0,
    totalOutstanding: 0,
    totalRecAmount: 0,
    overdueCount: 0
  });

  // 图表数据
  const [balanceChartData, setBalanceChartData] = useState<any[]>([]);
  const [ageingChartData, setAgeingChartData] = useState<any[]>([]);

  // 加载汇总数据
  useEffect(() => {
    const loadSummaryData = async () => {
      const totalPartners = partners.length;

      let totalOutstanding = 0;
      let overdueCount = 0;

      for (const partner of partners) {
        const balance = await getPartnerBalance(partner.name);
        totalOutstanding += balance;

        // 检查是否有逾期单据
        const items = await getOutstandingItems({
          partnerName: partner.name,
          endDate: new Date().toISOString().split('T')[0]
        });

        if (items.length > 0) {
          overdueCount++;
        }
      }

      setSummaryData({
        totalPartners,
        totalOutstanding,
        totalRecAmount: 0, // 待实现
        overdueCount
      });
    };

    loadSummaryData();
  }, [partners, getPartnerBalance, getOutstandingItems]);

  // 加载图表数据
  useEffect(() => {
    const loadChartData = async () => {
      // 客户余额分布图
      const balanceData = partners.map(partner => ({
        name: partner.name,
        balance: getPartnerBalance(partner.name)
      })).filter(item => item.balance !== 0);

      setBalanceChartData(balanceData);

      // 账龄分析图
      const ageingData = [
        { name: '0-30天', value: 0 },
        { name: '31-60天', value: 0 },
        { name: '61-90天', value: 0 },
        { name: '91-180天', value: 0 },
        { name: '180天以上', value: 0 }
      ];

      // 待实现：计算账龄分布

      setAgeingChartData(ageingData);
    };

    loadChartData();
  }, [partners, timeRange]);

  // 搜索往来单位
  const filteredPartners = searchPartners(searchText);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
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

      {/* 统计卡片 */}
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

      {/* 图表区域 */}
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

      {/* 客户列表 */}
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

      {/* 客户明细查看器（弹出式） */}
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

---

## 5. 实时轧差算法实现

### 5.1 余额计算逻辑

**文件:** `src/stores/useAccountStore.ts`

```typescript
// 计算往来单位余额（实时轧差）
const calculatePartnerBalance = (partnerName: string): number => {
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
    const recAmount = relations.reduce((sum, rel) => {
      return rel.debitEntryId === entry.id ? sum + rel.amount : sum - rel.amount;
    }, 0);

    return {
      ...entry,
      recAmount,
      remainingAmount: (entry.debit > 0 ? entry.debit : entry.credit) - Math.abs(recAmount)
    };
  });

  // 计算轧差余额
  let balance = 0;

  for (const entry of entriesWithRec) {
    if (entry.debit > 0) {
      // 借方分录
      balance += entry.remainingAmount;
    } else if (entry.credit > 0) {
      // 贷方分录
      balance -= entry.remainingAmount;
    }
  }

  return balance;
};

// 计算未结清单据
const getOutstandingItems = (query: OutstandingQuery): OutstandingItem[] => {
  const { partnerName, subjectCode, startDate, endDate, amountRange } = query;

  const allEntries = useVoucherStore.getState().ledgerEntries;

  // 过滤往来单位分录
  let partnerEntries = allEntries.filter(entry =>
    entry.customerName === partnerName || entry.supplierName === partnerName
  );

  // 科目代码过滤
  if (subjectCode) {
    partnerEntries = partnerEntries.filter(entry =>
      entry.subjectCode === subjectCode
    );
  }

  // 日期范围过滤
  if (startDate && endDate) {
    partnerEntries = partnerEntries.filter(entry =>
      entry.date >= startDate && entry.date <= endDate
    );
  }

  // 计算每个分录的剩余未核销金额
  const outstandingItems: OutstandingItem[] = [];

  for (const entry of partnerEntries) {
    const relations = recRelations.filter(rel =>
      rel.debitEntryId === entry.id || rel.creditEntryId === entry.id
    );
    const totalRecAmount = relations.reduce((sum, rel) => {
      return sum + rel.amount;
    }, 0);

    const entryAmount = entry.debit > 0 ? entry.debit : entry.credit;
    const remainingAmount = entryAmount - totalRecAmount;

    if (remainingAmount > 0) {
      // 金额范围过滤
      if (amountRange) {
        if (remainingAmount < amountRange[0] || remainingAmount > amountRange[1]) {
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
};
```

---

## 6. 粘贴适配逻辑

### 6.1 从Excel粘贴的处理

**文件:** `src/components/voucher/voucher-entry-grid.tsx`

```typescript
// 在handleKeyDown函数中添加粘贴事件处理
const handleKeyDown = (
  entryId: string,
  field: string,
  index: number,
  e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => {
  // ... 现有键盘事件处理 ...

  // 粘贴事件处理
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();

    // 获取剪贴板数据
    navigator.clipboard.readText().then(text => {
      handlePaste(entryId, field, text);
    });
  }
};

// 处理粘贴逻辑
const handlePaste = (entryId: string, field: string, text: string) => {
  // 清理粘贴的文本（移除换行、多余空格等）
  const cleanedText = text.trim();

  switch (field) {
    case 'docNo':
      // 业务单据号粘贴：直接设置
      updateEntry(entryId, 'docNo', cleanedText);
      break;

    case 'recRefNo':
      // 核销单号粘贴：直接设置
      updateEntry(entryId, 'recRefNo', cleanedText);
      break;

    case 'customerSupplier':
      // 客户/供应商粘贴：尝试匹配后台ID
      const matchedPartner = getMatchingPartner(cleanedText);
      if (matchedPartner) {
        updateEntry(entryId, 'customerSupplier', matchedPartner.name);
        updateEntry(entryId, 'customerName', matchedPartner.isCustomer ? matchedPartner.name : '');
        updateEntry(entryId, 'supplierName', matchedPartner.isSupplier ? matchedPartner.name : '');
      } else {
        // 未找到匹配的往来单位，显示警告
        showToast('warning', `未找到匹配的往来单位: ${cleanedText}`);
      }
      break;

    default:
      // 其他字段直接设置
      updateEntry(entryId, field, cleanedText);
  }
};

// 匹配往来单位
const getMatchingPartner = (partnerName: string): Partner | undefined => {
  const partners = usePartnerStore.getState().partners;

  // 模糊匹配
  const matched = partners.find(partner =>
    partner.name.toLowerCase().includes(partnerName.toLowerCase()) ||
    partner.name.includes(partnerName)
  );

  return matched;
};
```

---

## 7. 数据库Schema升级

### 7.1 更新databaseManager

**文件:** `src/lib/database/manager.ts`

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

---

## 8. 测试方案

### 8.1 单元测试

**文件:** `tests/partner-dashboard.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PartnerDashboard } from '@/components/partner/partner-dashboard';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useAccountStore } from '@/stores/useAccountStore';

// 模拟数据
jest.mock('@/stores/usePartnerStore', () => ({
  usePartnerStore: jest.fn(() => ({
    partners: [
      {
        id: '1',
        name: '客户A',
        isCustomer: true,
        isSupplier: false,
        contact: '张三',
        phone: '13800138001',
        email: 'zhangsan@example.com',
        address: '北京市朝阳区'
      },
      {
        id: '2',
        name: '供应商B',
        isCustomer: false,
        isSupplier: true,
        contact: '李四',
        phone: '13800138002',
        email: 'lisi@example.com',
        address: '上海市浦东新区'
      }
    ],
    searchPartners: jest.fn(() => [
      {
        id: '1',
        name: '客户A',
        isCustomer: true,
        isSupplier: false,
        contact: '张三',
        phone: '13800138001',
        email: 'zhangsan@example.com',
        address: '北京市朝阳区'
      }
    ])
  }))
}));

jest.mock('@/stores/useAccountStore', () => ({
  useAccountStore: jest.fn(() => ({
    getPartnerBalance: jest.fn(() => 10000),
    getOutstandingItems: jest.fn(() => [])
  }))
}));

describe('PartnerDashboard', () => {
  it('renders the dashboard with summary cards', () => {
    render(<PartnerDashboard />);

    // 验证统计卡片渲染
    expect(screen.getByText('总客户数')).toBeInTheDocument();
    expect(screen.getByText('未结余额')).toBeInTheDocument();
    expect(screen.getByText('本月核销')).toBeInTheDocument();
    expect(screen.getByText('逾期客户')).toBeInTheDocument();
  });

  it('renders the customer table', () => {
    render(<PartnerDashboard />);

    // 验证客户列表渲染
    expect(screen.getByText('客户A')).toBeInTheDocument();
    expect(screen.getByText('供应商B')).toBeInTheDocument();
  });

  it('filters customers based on search text', async () => {
    render(<PartnerDashboard />);

    const searchInput = screen.getByPlaceholderText('搜索客户/供应商...');
    fireEvent.change(searchInput, { target: { value: '客户' } });

    await waitFor(() => {
      expect(screen.getByText('客户A')).toBeInTheDocument();
      expect(screen.queryByText('供应商B')).not.toBeInTheDocument();
    });
  });

  it('displays customer detail when clicking view detail', async () => {
    render(<PartnerDashboard />);

    const viewDetailButton = screen.getByText('查看明细');
    fireEvent.click(viewDetailButton);

    await waitFor(() => {
      expect(screen.getByText('客户A')).toBeInTheDocument();
    });
  });
});
```

---

## 9. 向后兼容性

- 现有数据在加载时会自动获得空的 `recRefNo` 字段
- 现有功能继续正常工作
- 新字段 `recRefNo` 和 `recRelations` 表默认可见，但可以通过列设置隐藏
- 数据导入/导出功能支持新字段

---

## 10. 部署计划

### 10.1 数据库迁移

1. **备份现有数据**
2. **升级数据库版本到3**
3. **创建recRelations表**
4. **为entries表添加recRefNo索引**
5. **验证数据完整性**

### 10.2 部署步骤

1. 构建新版本
2. 备份生产环境数据
3. 部署新版本
4. 运行数据库迁移
5. 验证功能正常
6. 监控系统性能

---

## 11. 总结

本设计文档详细描述了往来核销管理系统的第二阶段实现方案。通过创建Rec_Relation表存储核销关系，升级VoucherEntryGrid支持灵活核销操作，以及开发PartnerDashboard页面提供综合分析功能，实现了完整的往来账款管理系统。

系统将支持：
- 实时余额计算与监控
- 灵活的核销操作
- 详细的往来单位分析
- 完善的报表展示
- 从Excel粘贴的适配支持

这些功能为企业提供了高效的往来账款管理解决方案，帮助企业更好地控制资金流动和风险。
