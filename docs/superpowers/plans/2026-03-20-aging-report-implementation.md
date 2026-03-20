# 往来账龄分析报告 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI 财务 Assistant 系统添加往来账龄分析功能，支持应收账款（AR）和应付账款（AP）的多维度账龄分析。

**Architecture:** 遵循项目架构风格，使用 Next.js 16 + React 19 + shadcn/ui + Zustand 技术栈。实现账龄计算核心函数、报表组件和页面，支持多刻度账龄切换和穿透过滤功能。

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui, Zustand, Tailwind CSS

---

## 项目结构规划

### 新增/修改的文件

```
src/
├── app/
│   ├── aging/
│   │   ├── ar/
│   │   │   └── page.tsx                          # 应收账款账龄分析页面
│   │   ├── ap/
│   │   │   └── page.tsx                          # 应付账款账龄分析页面
│   │   └── components/
│   │       ├── aging-report.tsx                  # 账龄分析报表组件
│   │       └── aging-filter.tsx                  # 筛选组件
├── lib/
│   └── accounting.ts                             # 新增账龄计算函数
└── stores/
    └── useAgingStore.ts                          # 账龄分析状态管理
```

---

## 任务分解

### Task 1: 核心账龄计算函数

**Files:**
- Modify: `src/lib/accounting.ts`

- [ ] **Step 1: 添加账龄计算相关类型定义**

```typescript
// src/lib/accounting.ts

// 账龄模式
export type AgingMode = 'month' | 'year' | 'day';

// 账龄结果类型
export interface AgingResult {
  partner: string;
  partnerType: 'customer' | 'supplier';
  totalAmount: number;
  buckets: {
    current: number;
    overdue1: number;
    overdue2: number;
    overdue3: number;
    overdue6: number;
  };
  agingDistribution: number[];
  lastActivityDate?: string;
  isWriteOff: boolean;
}

export interface AgingDetail {
  id: string;
  voucherNo: string;
  docNo: string;
  date: string;
  summary: string;
  amount: number;
  remainingAmount: number;
  daysOverdue: number;
  bucket: string;
  partnerName: string;
  isWriteOff: boolean;
}

export interface AgingConfig {
  mode: AgingMode;
  asOfDate: string;
  showWriteOff: boolean;
  overdueThreshold: number;
}
```

- [ ] **Step 2: 实现账龄计算核心函数**

```typescript
// 计算天数差
export function calculateDaysDifference(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// 获取账龄区间
export function getAgingBucket(days: number, mode: AgingMode): string {
  switch (mode) {
    case 'month':
      if (days <= 30) return 'current';
      if (days <= 90) return 'overdue1';
      if (days <= 180) return 'overdue2';
      if (days <= 365) return 'overdue3';
      return 'overdue6';

    case 'year':
      if (days <= 365) return 'current';
      if (days <= 730) return 'overdue1';
      if (days <= 1095) return 'overdue2';
      return 'overdue6';

    case 'day':
      if (days <= 30) return 'current';
      if (days <= 60) return 'overdue1';
      if (days <= 90) return 'overdue2';
      if (days <= 120) return 'overdue3';
      return 'overdue6';

    default:
      return 'current';
  }
}

// 计算账龄分布
export function calculateAgingDistribution(amounts: number[]): number[] {
  const total = amounts.reduce((sum, amt) => sum + amt, 0);
  return amounts.map(amt => total > 0 ? amt / total : 0);
}

// 获取逾期颜色
export function getOverdueColor(days: number, isWriteOff: boolean): string {
  if (isWriteOff) return 'text-gray-400';
  if (days <= 30) return 'text-gray-600';
  if (days <= 90) return 'text-yellow-600';
  if (days <= 180) return 'text-orange-600';
  return 'text-red-600';
}

// 格式化账龄显示
export function formatAging(days: number, mode: AgingMode): string {
  if (mode === 'month') {
    if (days <= 30) return '1个月内';
    if (days <= 90) return '1-3个月';
    if (days <= 180) return '3-6个月';
    if (days <= 365) return '6个月-1年';
    return '1年以上';
  }

  if (mode === 'year') {
    if (days <= 365) return '1年以内';
    if (days <= 730) return '1-2年';
    if (days <= 1095) return '2-3年';
    return '3年以上';
  }

  if (mode === 'day') {
    if (days <= 30) return '1-30天';
    if (days <= 60) return '31-60天';
    if (days <= 90) return '61-90天';
    if (days <= 120) return '91-120天';
    return '120天以上';
  }

  return `${days}天`;
}

// 格式化金额
export function formatMoney(amount: number): string {
  if (amount === 0) return '-';
  return amount.toLocaleString('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  });
}
```

- [ ] **Step 3: 实现账龄计算主函数**

```typescript
// 计算账龄数据
export function calculateAgingData(
  entries: VoucherEntry[],
  config: AgingConfig
): AgingResult[] {
  // 1. 按往来单位分组
  const partnerMap = new Map<string, VoucherEntry[]>();

  entries.forEach(entry => {
    const partner = entry.customerName || entry.supplierName;
    if (partner) {
      if (!partnerMap.has(partner)) {
        partnerMap.set(partner, []);
      }
      partnerMap.get(partner)!.push(entry);
    }
  });

  // 2. 计算每个往来单位的账龄
  const agingResults: AgingResult[] = [];

  partnerMap.forEach((entries, partner) => {
    const result: AgingResult = {
      partner,
      partnerType: entries[0].customerName ? 'customer' : 'supplier',
      totalAmount: 0,
      buckets: { current: 0, overdue1: 0, overdue2: 0, overdue3: 0, overdue6: 0 },
      agingDistribution: [],
      isWriteOff: false,
    };

    // 计算每个分录的账龄
    entries.forEach(entry => {
      const days = calculateDaysDifference(entry.date, config.asOfDate);
      const bucket = getAgingBucket(days, config.mode);
      const remainingAmount = entry.debit > 0 ? entry.debit : entry.credit;

      result.totalAmount += remainingAmount;
      result.buckets[bucket as keyof typeof result.buckets] += remainingAmount;

      // 检查是否有核销记录
      if (entry.recRefNo) {
        result.isWriteOff = true;
      }
    });

    // 计算分布
    result.agingDistribution = calculateAgingDistribution([
      result.buckets.current,
      result.buckets.overdue1,
      result.buckets.overdue2,
      result.buckets.overdue3,
      result.buckets.overdue6
    ]);

    agingResults.push(result);
  });

  return agingResults.sort((a, b) => b.totalAmount - a.totalAmount);
}

// 获取明细数据
export function getAgingDetails(
  entries: VoucherEntry[],
  config: AgingConfig & { bucket?: string; partner?: string }
): AgingDetail[] {
  const details: AgingDetail[] = [];

  entries.forEach(entry => {
    const partner = entry.customerName || entry.supplierName;

    // 按合作伙伴筛选
    if (config.partner && partner !== config.partner) {
      return;
    }

    const days = calculateDaysDifference(entry.date, config.asOfDate);
    const bucket = getAgingBucket(days, config.mode);

    // 按账龄区间筛选
    if (config.bucket && bucket !== config.bucket) {
      return;
    }

    details.push({
      id: entry.id,
      voucherNo: entry.voucherId,
      docNo: entry.docNo || '',
      date: entry.date,
      summary: entry.summary,
      amount: entry.debit > 0 ? entry.debit : entry.credit,
      remainingAmount: entry.debit > 0 ? entry.debit : entry.credit,
      daysOverdue: days,
      bucket,
      partnerName: partner,
      isWriteOff: !!entry.recRefNo
    });
  });

  return details.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
```

- [ ] **Step 4: 验证函数正确性**

测试计算结果：

```bash
# 运行类型检查
npm run build
```

---

### Task 2: 账龄分析报表组件

**Files:**
- Create: `src/app/aging/components/aging-report.tsx`

- [ ] **Step 1: 创建报表组件**

```typescript
// src/app/aging/components/aging-report.tsx

'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgingResult, AgingDetail, AgingMode } from '@/lib/accounting';
import { formatMoney, formatAging, getOverdueColor } from '@/lib/accounting';

interface AgingReportProps {
  data: AgingResult[];
  details: AgingDetail[];
  mode: AgingMode;
  onBucketClick: (bucket: string) => void;
  onPartnerClick: (partner: string) => void;
}

function getBucketColor(index: number): string {
  const colors = [
    'bg-green-100',
    'bg-yellow-100',
    'bg-orange-100',
    'bg-red-100',
    'bg-red-200'
  ];
  return colors[index] || 'bg-gray-100';
}

export function AgingReport({ data, details, mode, onBucketClick, onPartnerClick }: AgingReportProps) {
  return (
    <div className="space-y-6">
      {/* 汇总表 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left text-sm font-medium">往来单位</th>
              <th className="p-2 text-right text-sm font-medium">当前</th>
              <th className="p-2 text-right text-sm font-medium">1期</th>
              <th className="p-2 text-right text-sm font-medium">2期</th>
              <th className="p-2 text-right text-sm font-medium">3期</th>
              <th className="p-2 text-right text-sm font-medium">6期以上</th>
              <th className="p-2 text-right text-sm font-medium">合计</th>
              <th className="p-2 text-center text-sm font-medium">账龄分布</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.partner} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <button
                    onClick={() => onPartnerClick(item.partner)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {item.partner}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('current')}
                    className="text-gray-700 hover:text-blue-600"
                  >
                    {formatMoney(item.buckets.current)}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('overdue1')}
                    className="text-yellow-600 hover:text-blue-600"
                  >
                    {formatMoney(item.buckets.overdue1)}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('overdue2')}
                    className="text-orange-600 hover:text-blue-600"
                  >
                    {formatMoney(item.buckets.overdue2)}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('overdue3')}
                    className="text-red-600 hover:text-blue-600"
                  >
                    {formatMoney(item.buckets.overdue3)}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onBucketClick('overdue6')}
                    className="text-red-700 hover:text-blue-600 font-medium"
                  >
                    {formatMoney(item.buckets.overdue6)}
                  </button>
                </td>
                <td className="p-2 text-right font-medium">
                  {formatMoney(item.totalAmount)}
                </td>
                <td className="p-2">
                  <div className="flex gap-1 h-4">
                    {item.agingDistribution.map((percent, index) => (
                      <div
                        key={index}
                        className={`h-full rounded ${getBucketColor(index)}`}
                        style={{ width: `${percent * 100}%` }}
                        title={`${(percent * 100).toFixed(0)}%`}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 明细表 */}
      {details.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4">明细数据</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left text-sm font-medium">凭证号</th>
                  <th className="p-2 text-left text-sm font-medium">单据号</th>
                  <th className="p-2 text-left text-sm font-medium">日期</th>
                  <th className="p-2 text-left text-sm font-medium">摘要</th>
                  <th className="p-2 text-right text-sm font-medium">金额</th>
                  <th className="p-2 text-right text-sm font-medium">剩余金额</th>
                  <th className="p-2 text-right text-sm font-medium">账龄</th>
                  <th className="p-2 text-left text-sm font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {details.map((detail) => (
                  <tr key={detail.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-sm">{detail.voucherNo}</td>
                    <td className="p-2 text-sm">{detail.docNo}</td>
                    <td className="p-2 text-sm">{detail.date}</td>
                    <td className="p-2 text-sm">{detail.summary}</td>
                    <td className="p-2 text-right text-sm">{formatMoney(detail.amount)}</td>
                    <td className="p-2 text-right text-sm">{formatMoney(detail.remainingAmount)}</td>
                    <td className={`p-2 text-right text-sm font-medium ${
                      getOverdueColor(detail.daysOverdue, detail.isWriteOff)
                    }`}>
                      {formatAging(detail.daysOverdue, mode)}
                    </td>
                    <td className="p-2">
                      {detail.isWriteOff ? (
                        <Badge variant="outline" className="text-xs">已核销</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs bg-yellow-100 text-yellow-800">
                          未核销
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Task 3: 筛选组件

**Files:**
- Create: `src/app/aging/components/aging-filter.tsx`

- [ ] **Step 1: 创建筛选组件**

```typescript
// src/app/aging/components/aging-filter.tsx

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { AgingMode } from '@/lib/accounting';

interface AgingFilterProps {
  mode: AgingMode;
  onModeChange: (mode: AgingMode) => void;
  asOfDate: string;
  onAsOfDateChange: (date: string) => void;
}

export function AgingFilter({ mode, onModeChange, asOfDate, onAsOfDateChange }: AgingFilterProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Label>账龄刻度:</Label>
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value as AgingMode)}
              className="border rounded p-2 text-sm"
            >
              <option value="month">按月</option>
              <option value="year">按年</option>
              <option value="day">按天</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Label>截止日期:</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => onAsOfDateChange(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### Task 4: 应收账款分析页面

**Files:**
- Create: `src/app/aging/ar/page.tsx`

- [ ] **Step 1: 创建应收账款分析页面**

```typescript
// src/app/aging/ar/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { calculateAgingData, getAgingDetails, type AgingMode, type AgingConfig } from '@/lib/accounting';
import { AgingReport } from '../components/aging-report';
import { AgingFilter } from '../components/aging-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, Filter } from 'lucide-react';

export default function ARReportPage() {
  const [mode, setMode] = useState<AgingMode>('month');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  const voucherStore = useVoucherStore();
  const subjectStore = useSubjectStore();

  // 获取应收账款相关的凭证分录
  const arEntries = useMemo(() => {
    return voucherStore.vouchers
      .filter(v => v.status === 'posted' || v.status === 'reversed')
      .flatMap(v => v.entries)
      .filter(entry => {
        const subject = subjectStore.subjects.find(s => s.code === entry.subjectCode);
        return subject?.isCustomer;
      });
  }, [voucherStore.vouchers, subjectStore.subjects]);

  // 计算账龄数据
  const agingData = useMemo(() => {
    const config: AgingConfig = {
      mode,
      asOfDate,
      showWriteOff: true,
      overdueThreshold: 30
    };
    return calculateAgingData(arEntries, config);
  }, [arEntries, mode, asOfDate]);

  // 获取明细数据
  const agingDetails = useMemo(() => {
    const config: AgingConfig & { bucket?: string; partner?: string } = {
      mode,
      asOfDate,
      showWriteOff: true,
      overdueThreshold: 30,
      bucket: selectedBucket,
      partner: selectedPartner
    };
    return getAgingDetails(arEntries, config);
  }, [arEntries, mode, asOfDate, selectedBucket, selectedPartner]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">应收账款账龄分析</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            高级筛选
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            打印
          </Button>
        </div>
      </div>

      <AgingFilter
        mode={mode}
        onModeChange={setMode}
        asOfDate={asOfDate}
        onAsOfDateChange={setAsOfDate}
      />

      <Card>
        <CardHeader>
          <CardTitle>账龄分析汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <AgingReport
            data={agingData}
            details={agingDetails}
            mode={mode}
            onBucketClick={setSelectedBucket}
            onPartnerClick={setSelectedPartner}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Task 5: 应付账款分析页面

**Files:**
- Create: `src/app/aging/ap/page.tsx`

- [ ] **Step 1: 创建应付账款分析页面**

```typescript
// src/app/aging/ap/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { calculateAgingData, getAgingDetails, type AgingMode, type AgingConfig } from '@/lib/accounting';
import { AgingReport } from '../components/aging-report';
import { AgingFilter } from '../components/aging-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, Filter } from 'lucide-react';

export default function APReportPage() {
  const [mode, setMode] = useState<AgingMode>('month');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  const voucherStore = useVoucherStore();
  const subjectStore = useSubjectStore();

  // 获取应付账款相关的凭证分录
  const apEntries = useMemo(() => {
    return voucherStore.vouchers
      .filter(v => v.status === 'posted' || v.status === 'reversed')
      .flatMap(v => v.entries)
      .filter(entry => {
        const subject = subjectStore.subjects.find(s => s.code === entry.subjectCode);
        return subject?.isSupplier;
      });
  }, [voucherStore.vouchers, subjectStore.subjects]);

  // 计算账龄数据
  const agingData = useMemo(() => {
    const config: AgingConfig = {
      mode,
      asOfDate,
      showWriteOff: true,
      overdueThreshold: 30
    };
    return calculateAgingData(apEntries, config);
  }, [apEntries, mode, asOfDate]);

  // 获取明细数据
  const agingDetails = useMemo(() => {
    const config: AgingConfig & { bucket?: string; partner?: string } = {
      mode,
      asOfDate,
      showWriteOff: true,
      overdueThreshold: 30,
      bucket: selectedBucket,
      partner: selectedPartner
    };
    return getAgingDetails(apEntries, config);
  }, [apEntries, mode, asOfDate, selectedBucket, selectedPartner]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">应付账款账龄分析</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            高级筛选
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            打印
          </Button>
        </div>
      </div>

      <AgingFilter
        mode={mode}
        onModeChange={setMode}
        asOfDate={asOfDate}
        onAsOfDateChange={setAsOfDate}
      />

      <Card>
        <CardHeader>
          <CardTitle>账龄分析汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <AgingReport
            data={agingData}
            details={agingDetails}
            mode={mode}
            onBucketClick={setSelectedBucket}
            onPartnerClick={setSelectedPartner}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Task 6: 状态管理（可选）

**Files:**
- Create: `src/stores/useAgingStore.ts` (可选)

- [ ] **Step 1: 创建账龄分析状态管理**

```typescript
// src/stores/useAgingStore.ts

import { create } from 'zustand';
import type { AgingResult, AgingDetail, AgingMode, AgingConfig } from '@/lib/accounting';

interface AgingStore {
  // 状态
  mode: AgingMode;
  asOfDate: string;
  selectedBucket: string | null;
  selectedPartner: string | null;
  agingData: AgingResult[];
  agingDetails: AgingDetail[];
  isLoading: boolean;

  // Actions
  setMode: (mode: AgingMode) => void;
  setAsOfDate: (date: string) => void;
  setSelectedBucket: (bucket: string | null) => void;
  setSelectedPartner: (partner: string | null) => void;
  setAgingData: (data: AgingResult[]) => void;
  setAgingDetails: (details: AgingDetail[]) => void;
  setLoading: (loading: boolean) => void;
  clearFilters: () => void;
}

export const useAgingStore = create<AgingStore>((set) => ({
  mode: 'month',
  asOfDate: new Date().toISOString().split('T')[0],
  selectedBucket: null,
  selectedPartner: null,
  agingData: [],
  agingDetails: [],
  isLoading: false,

  setMode: (mode) => set({ mode }),
  setAsOfDate: (asOfDate) => set({ asOfDate }),
  setSelectedBucket: (selectedBucket) => set({ selectedBucket }),
  setSelectedPartner: (selectedPartner) => set({ selectedPartner }),
  setAgingData: (agingData) => set({ agingData }),
  setAgingDetails: (agingDetails) => set({ agingDetails }),
  setLoading: (isLoading) => set({ isLoading }),
  clearFilters: () => set({ selectedBucket: null, selectedPartner: null }),
}));
```

---

### Task 7: 验证和测试

**Files:**
- Run existing tests

- [ ] **Step 1: 运行构建验证**

```bash
# 运行类型检查
npm run build

# 运行开发服务器验证页面是否可访问
npm run dev
```

- [ ] **Step 2: 验证页面功能**

1. 访问 `http://localhost:3000/aging/ar` 验证应收账款分析页面
2. 访问 `http://localhost:3000/aging/ap` 验证应付账款分析页面
3. 测试账龄刻度切换功能
4. 测试穿透过滤功能
5. 验证数据格式和计算正确性

---

## 执行方式

**Plan complete and saved to `docs/superpowers/plans/2026-03-20-aging-report-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
