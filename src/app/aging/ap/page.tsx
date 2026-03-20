'use client';

import { useState, useMemo, useRef } from 'react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { calculateAgingData, getAgingDetails, type AgingMode, type AgingConfig, formatMoney } from '@/lib/accounting';
import { AgingReport } from '../components/aging-report';
import { AgingFilter } from '../components/aging-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function APReportPage() {
  const [mode, setMode] = useState<AgingMode>('month');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [useCustomBuckets, setUseCustomBuckets] = useState<boolean>(false);
  const [customBuckets, setCustomBuckets] = useState<number[]>([30, 90, 180, 365, 730]);

  const voucherStore = useVoucherStore();
  const subjectStore = useSubjectStore();

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
      XLSX.utils.book_append_sheet(workbook, worksheet, '应付账款账龄分析');

      // 导出文件
      XLSX.writeFile(workbook, `应付账款账龄分析_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      overdueThreshold: 30,
      useCustomBuckets,
      customBuckets
    };
    return calculateAgingData(apEntries, config);
  }, [apEntries, mode, asOfDate, useCustomBuckets, customBuckets]);

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
    return getAgingDetails(apEntries, config);
  }, [apEntries, mode, asOfDate, selectedBucket, selectedPartner, useCustomBuckets, customBuckets]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">应付账款账龄分析</h1>
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
