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
import { Download, Printer, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ARReportPage() {
  const [mode, setMode] = useState<AgingMode>('month');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [useCustomBuckets, setUseCustomBuckets] = useState<boolean>(false);
  const [customBuckets, setCustomBuckets] = useState<number[]>([30, 90, 180, 365, 730]);

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
  const ensureClearingInitialized = async () => {
    if (!clearingStore.isInitialized) {
      await clearingStore.ensureInitialized();
    }
  };

  // 初始化 clearingStore
  useEffect(() => {
    ensureClearingInitialized();
  }, [clearingStore.isInitialized]);

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
          '合计': formatMoney(item.totalAmount)
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
    return voucherStore.vouchers
      .filter(v => v.status === 'posted') // 仅显示已记账的凭证
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
      overdueThreshold: 30,
      useCustomBuckets,
      customBuckets
    };
    return calculateAgingData(arEntries, config, partnerStore.partners);
  }, [arEntries, mode, asOfDate, useCustomBuckets, customBuckets, partnerStore.partners]);

  // 获取明细数据
  const agingDetails = useMemo(() => {
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
  }, [arEntries, mode, asOfDate, selectedBucket, selectedPartner, useCustomBuckets, customBuckets, voucherStore.vouchers, clearingStore.recRelations, partnerStore.partners]);

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
          />
        </CardContent>
      </Card>
    </div>
  );
}
