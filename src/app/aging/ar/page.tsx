'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useClearingStore } from '@/stores/useClearingStore';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useToast } from '@/components/ui/toast';
import { calculateAgingData, getAgingDetails, type AgingMode, type AgingConfig, formatMoney } from '@/lib/accounting';
import { AgingReport } from '../components/aging-report';
import { AgingFilter } from '../components/aging-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Download, Printer, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ARReportPage() {
  const [mode, setMode] = useState<AgingMode>('month');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [useCustomBuckets, setUseCustomBuckets] = useState<boolean>(false);
  const [customBuckets, setCustomBuckets] = useState<number[]>([30, 90, 180, 365, 730]);
  const [isClearingReady, setIsClearingReady] = useState(false);

  const voucherStore = useVoucherStore();
  const subjectStore = useSubjectStore();
  const clearingStore = useClearingStore();
  const partnerStore = usePartnerStore();
  const { showToast } = useToast();

  // 确保 partnerStore 被初始化
  useEffect(() => {
    if (partnerStore.partners.length === 0) {
      partnerStore.initializePartners();
    }
  }, [partnerStore.partners.length]);

  // 确保 clearingStore 被初始化
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await clearingStore.ensureInitialized();
      if (mounted) {
        setIsClearingReady(true);
      }
    };
    init();
    return () => { mounted = false; };
  }, []); // 只在组件挂载时执行一次

  // 批量核销处理函数
  const handleBatchWriteOff = async (selectedIds: string[]) => {
    try {
      // 调用批量核销方法
      const clearedEntries = await clearingStore.processBatchClearing(selectedIds, arEntries);

      if (clearedEntries.length > 0) {
        // 显示成功提示
        showToast('success', `批量核销成功：已成功核销 ${clearedEntries.length} 条记录`);

        // 确保核销关系数据已加载
        await clearingStore.ensureInitialized();

        // 可以在这里添加其他刷新逻辑，比如重新获取凭证数据
      } else {
        showToast('warning', '未找到可核销的记录：请选择相反方向的分录进行核销');
      }
    } catch (error) {
      console.error('批量核销失败:', error);
      showToast('error', '批量核销失败：请稍后重试');
    }
  };

  // 添加按钮点击处理函数
  const handleAdvancedFilter = () => {
    console.log('高级筛选功能');
  };

  const handleExport = () => {
    try {
      // 准备导出数据
      const exportData = agingData.map(item => {
        const entry: any = {
          '往来单位': item.partner,
          '当前': formatMoney(item.buckets.current),
          '1期': formatMoney(item.buckets.overdue1),
          '2期': formatMoney(item.buckets.overdue2),
          '3期': formatMoney(item.buckets.overdue3),
          '6期以上': formatMoney(item.buckets.overdue6),
          '余额': formatMoney(item.totalAmount)
        };
        return entry;
      });

      // 创建工作簿和工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '应收账款账龄分析');

      // 导出文件
      XLSX.writeFile(workbook, `应收账款账龄分析_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const handlePrint = () => {
    const content = document.getElementById('aging-report-content');
    if (content) {
      // 创建打印样式
      const printStyle = document.createElement('style');
      printStyle.innerHTML = `
        @media print {
          body * {
            visibility: hidden;
          }
          #aging-report-content, #aging-report-content * {
            visibility: visible;
          }
          #aging-report-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }
          @page {
            margin: 2cm;
          }
        }
      `;
      document.head.appendChild(printStyle);

      // 执行打印
      window.print();

      // 移除打印样式
      setTimeout(() => {
        document.head.removeChild(printStyle);
      }, 100);
    } else {
      window.print();
    }
  };

  // 获取应收账款相关的凭证分录（仅包括已记账的凭证）
  const arEntries = useMemo(() => {
    const postedVouchers = voucherStore.vouchers.filter(v => v.status === 'posted');
    console.log('AR Aging - 已记账凭证数量:', postedVouchers.length);
    console.log('AR Aging - 所有凭证数量:', voucherStore.vouchers.length);
    console.log('AR Aging - 科目列表:', subjectStore.subjects.map((s: any) => ({ code: s.code, name: s.name, isCustomer: s.isCustomer })));

    const allEntries = postedVouchers.flatMap(v => v.entries);
    console.log('AR Aging - 已记账凭证的所有分录:', allEntries.map(e => ({ subjectCode: e.subjectCode, debit: e.debit, credit: e.credit })));

    const filtered = allEntries.filter(entry => {
      const subject = subjectStore.subjects.find(s => s.code === entry.subjectCode);
      if (!subject) {
        console.log('AR Aging - 未找到科目:', entry.subjectCode);
        return false;
      }
      const isCustomer = subject.isCustomer === true;
      if (!isCustomer) {
        console.log('AR Aging - 非客户科目分录:', entry.subjectCode, subject.name, 'isCustomer:', subject.isCustomer);
      }
      return isCustomer;
    });

    console.log('AR Aging - 过滤后的客户分录数量:', filtered.length);
    return filtered;
  }, [voucherStore.vouchers, subjectStore.subjects]);

  // 计算账龄数据
  const agingData = useMemo(() => {
    if (!isClearingReady) return [];
    const config: AgingConfig = {
      mode,
      asOfDate,
      showWriteOff: true,
      overdueThreshold: 30,
      useCustomBuckets,
      customBuckets
    };
    return calculateAgingData(arEntries, config, partnerStore.partners, clearingStore.recRelations, true); // true = 应收账款
  }, [isClearingReady, arEntries, mode, asOfDate, useCustomBuckets, customBuckets, partnerStore.partners, clearingStore.recRelations]);

  // 获取明细数据
  const agingDetails = useMemo(() => {
    if (!isClearingReady) return [];
    const config: AgingConfig & { bucket?: string; partner?: string } = {
      mode,
      asOfDate,
      showWriteOff: true,
      overdueThreshold: 30,
      bucket: selectedBucket,
      partner: selectedPartner,
      useCustomBuckets,
      customBuckets
    };
    return getAgingDetails(arEntries, config, true, voucherStore.vouchers, clearingStore.recRelations, partnerStore.partners);
  }, [isClearingReady, arEntries, mode, asOfDate, selectedBucket, selectedPartner, useCustomBuckets, customBuckets, voucherStore.vouchers, clearingStore.recRelations, partnerStore.partners]);

  // 计算汇总统计数据
  const summaryStats = useMemo(() => {
    if (!isClearingReady || agingData.length === 0) {
      return { totalBalance: 0, current: 0, overdue1: 0, overdue2: 0, overdue3: 0, overdue6: 0, partnerCount: 0 };
    }

    return agingData.reduce((acc, item) => ({
      totalBalance: acc.totalBalance + item.totalAmount,
      current: acc.current + item.buckets.current,
      overdue1: acc.overdue1 + item.buckets.overdue1,
      overdue2: acc.overdue2 + item.buckets.overdue2,
      overdue3: acc.overdue3 + item.buckets.overdue3,
      overdue6: acc.overdue6 + item.buckets.overdue6,
      partnerCount: acc.partnerCount + 1
    }), { totalBalance: 0, current: 0, overdue1: 0, overdue2: 0, overdue3: 0, overdue6: 0, partnerCount: 0 });
  }, [isClearingReady, agingData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">应收账款账龄分析</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAdvancedFilter}>
            <Filter className="h-4 w-4 mr-2" />
            高级筛选
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
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
        useCustomBuckets={useCustomBuckets}
        onUseCustomBucketsChange={setUseCustomBuckets}
        customBuckets={customBuckets}
        onCustomBucketsChange={setCustomBuckets}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">总余额</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatMoney(summaryStats.totalBalance)}</div>
            <p className="text-xs text-slate-500 mt-1">共 {summaryStats.partnerCount} 个客户</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">当前</CardTitle>
            <Clock className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">{formatMoney(summaryStats.current)}</div>
            <p className="text-xs text-slate-500 mt-1">未逾期</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">1期</CardTitle>
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-yellow-600">{formatMoney(summaryStats.overdue1)}</div>
            <p className="text-xs text-slate-500 mt-1">逾期1期内</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">2期</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">{formatMoney(summaryStats.overdue2)}</div>
            <p className="text-xs text-slate-500 mt-1">逾期2期内</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">3期</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">{formatMoney(summaryStats.overdue3)}</div>
            <p className="text-xs text-slate-500 mt-1">逾期3期内</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">6期以上</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-700" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-700">{formatMoney(summaryStats.overdue6)}</div>
            <p className="text-xs text-slate-500 mt-1">严重逾期</p>
          </CardContent>
        </Card>
      </div>

      <Card id="aging-report-content">
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
            useCustomBuckets={useCustomBuckets}
            customBuckets={customBuckets}
            onBatchWriteOff={handleBatchWriteOff}
            summaryStats={summaryStats}
          />
        </CardContent>
      </Card>
    </div>
  );
}
