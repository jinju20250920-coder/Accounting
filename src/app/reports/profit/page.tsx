'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useReportConfigStore } from '@/stores/useReportConfigStore';
import { useMounted } from '@/hooks/useMounted';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Printer, Calendar, Settings, Edit3, Save } from 'lucide-react';
import { SubjectLinkageConfigurator } from '@/components/reports/subject-linkage-configurator';
import type { ReportRow } from '@/stores/useReportConfigStore';
import * as XLSX from 'xlsx';

const formatAmount = (amount: number): string => {
  if (amount === 0) return '';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return amount < 0 ? `(${formatted})` : formatted;
};

export default function ProfitPage() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ReportRow | null>(null);
  const mounted = useMounted();

  const voucherStore = useVoucherStore();
  const subjectStore = useSubjectStore();
  const accountSetStore = useAccountSetStore();
  const reportConfigStore = useReportConfigStore();

  useEffect(() => {
    if (voucherStore.vouchers.length === 0) voucherStore.initialize();
    if (subjectStore.subjects.length === 0) subjectStore.initializeSubjects();
  }, []);

  const subjectTree = useMemo(() => {
    type SubjectNode = { code: string; name: string; children: SubjectNode[] };
    const roots: SubjectNode[] = [];
    const map = new Map<string, SubjectNode>();
    subjectStore.subjects.forEach(s => map.set(s.code, { code: s.code, name: s.name, children: [] }));
    subjectStore.subjects.forEach(s => {
      const node = map.get(s.code);
      if (!node) return;
      if (s.parentId && map.has(s.parentId)) map.get(s.parentId)!.children.push(node);
      else roots.push(node);
    });
    return roots;
  }, [subjectStore.subjects]);

  // 计算期间发生额
  const periodAmounts = useMemo(() => {
    const amountMap = new Map<string, { debit: number; credit: number }>();
    const postedVouchers = voucherStore.vouchers.filter(v => v.status === 'posted' && v.date >= startDate && v.date <= endDate);
    postedVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const current = amountMap.get(entry.subjectCode) || { debit: 0, credit: 0 };
        amountMap.set(entry.subjectCode, {
          debit: current.debit + (entry.debit || 0),
          credit: current.credit + (entry.credit || 0)
        });
      });
    });
    return amountMap;
  }, [voucherStore.vouchers, startDate, endDate]);

  // 年初到期末发生额
  const yearPeriodAmounts = useMemo(() => {
    const yearStart = startDate.substring(0, 4) + '-01-01';
    const amountMap = new Map<string, { debit: number; credit: number }>();
    const postedVouchers = voucherStore.vouchers.filter(v => v.status === 'posted' && v.date >= yearStart && v.date <= endDate);
    postedVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const current = amountMap.get(entry.subjectCode) || { debit: 0, credit: 0 };
        amountMap.set(entry.subjectCode, {
          debit: current.debit + (entry.debit || 0),
          credit: current.credit + (entry.credit || 0)
        });
      });
    });
    return amountMap;
  }, [voucherStore.vouchers, startDate, endDate]);

  const resolveSubjectCodes = (linkedCodes: string[]): string[] => {
    const result: Set<string> = new Set();
    const allCodes = subjectStore.subjects.map(s => s.code);
    linkedCodes.forEach(pattern => {
      if (pattern.includes('..')) {
        const [start, end] = pattern.split('..');
        allCodes.forEach(code => { if (code >= start && code <= end) result.add(code); });
      } else if (pattern.includes('*')) {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\./g, '\\.')}$`);
        allCodes.forEach(code => { if (regex.test(code)) result.add(code); });
      } else {
        result.add(pattern);
      }
    });
    return Array.from(result);
  };

  const getSubjectNetAmount = (code: string, amountMap: Map<string, { debit: number; credit: number }>): number => {
    const amounts = amountMap.get(code);
    if (!amounts) return 0;
    // 收入类：净额 = 贷方 - 借方
    if (code.startsWith('6001') || code.startsWith('6051') || code.startsWith('6052') || code.startsWith('6111') || code.startsWith('6301')) {
      return amounts.credit - amounts.debit;
    }
    // 费用类：净额 = 借方 - 贷方
    return amounts.debit - amounts.credit;
  };

  const calculateRowAmount = (row: ReportRow, amountMap: Map<string, { debit: number; credit: number }>, rows: ReportRow[]): number => {
    if (row.rowType === 'header') return 0;

    // 小计和总计行：累加前面的数据行
    if ((row.rowType === 'subtotal' || row.rowType === 'total') && row.linkedSubjectCodes.length === 0) {
      let total = 0;
      for (const r of rows) {
        if (r.order >= row.order) break;
        if (r.rowType === 'data' || r.rowType === 'subtotal') {
          const amt = calculateRowAmount(r, amountMap, rows);
          if (r.formula === 'sum') {
            total += amt;
          } else if (r.formula === 'subtract') {
            total -= amt;
          }
        }
      }
      return total;
    }

    // 数据行：计算科目金额并根据公式处理
    const subjectAmount = resolveSubjectCodes(row.linkedSubjectCodes)
      .reduce((sum, code) => sum + getSubjectNetAmount(code, amountMap), 0);

    return row.formula === 'subtract' ? -subjectAmount : subjectAmount;
  };

  // 标准利润表配置
  const standardProfitRows: ReportRow[] = [
    { id: 'revenue_header', rowName: '一、营业收入', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 1, section: 'revenue', rowNo: '1', indent: 0 },
    { id: 'main_revenue', rowName: '减：营业成本', rowType: 'data', formula: 'subtract', linkedSubjectCodes: ['6401'], order: 2, section: 'cost', rowNo: '2', indent: 0 },
    { id: 'tax_surcharges', rowName: '税金及附加', rowType: 'data', formula: 'subtract', linkedSubjectCodes: ['6402'], order: 3, section: 'expense', rowNo: '3', indent: 0 },
    { id: 'consumption_tax', rowName: '其中：消费税', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 4, section: 'expense', rowNo: '4', indent: 1 },
    { id: 'business_tax', rowName: '营业税', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 5, section: 'expense', rowNo: '5', indent: 1 },
    { id: 'city_maint_tax', rowName: '城市维护建设税', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 6, section: 'expense', rowNo: '6', indent: 1 },
    { id: 'resource_tax', rowName: '资源税', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 7, section: 'expense', rowNo: '7', indent: 1 },
    { id: 'land_tax', rowName: '城镇土地使用税、房产税、车船税、印花税', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 8, section: 'expense', rowNo: '8', indent: 1 },
    { id: 'education_fee', rowName: '教育费附加、矿产资源补偿费、排污费', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 9, section: 'expense', rowNo: '9', indent: 1 },
    { id: 'sales_expense', rowName: '销售费用', rowType: 'data', formula: 'subtract', linkedSubjectCodes: ['6601'], order: 10, section: 'expense', rowNo: '11', indent: 0 },
    { id: 'mg_repair', rowName: '其中：商品维修费', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 11, section: 'expense', rowNo: '12', indent: 1 },
    { id: 'ad_expense', rowName: '广告费和业务宣传费', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 12, section: 'expense', rowNo: '13', indent: 1 },
    { id: 'admin_expense', rowName: '管理费用', rowType: 'data', formula: 'subtract', linkedSubjectCodes: ['6602'], order: 13, section: 'expense', rowNo: '14', indent: 0 },
    { id: 'startup_cost', rowName: '其中：开办费', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 14, section: 'expense', rowNo: '15', indent: 1 },
    { id: 'business_entertainment', rowName: '业务招待费', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 15, section: 'expense', rowNo: '16', indent: 1 },
    { id: 'research_expense', rowName: '研究费用', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 16, section: 'expense', rowNo: '17', indent: 1 },
    { id: 'finance_expense', rowName: '财务费用', rowType: 'data', formula: 'subtract', linkedSubjectCodes: ['6603'], order: 17, section: 'expense', rowNo: '18', indent: 0 },
    { id: 'interest_expense', rowName: '其中：利息费用（收入以"-"号填列）', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 18, section: 'expense', rowNo: '19', indent: 1 },
    { id: 'investment_income', rowName: '加：投资收益（损失以"-"号填列）', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6111'], order: 19, section: 'revenue', rowNo: '20', indent: 0 },
    { id: 'operating_profit', rowName: '二、营业利润（亏损以"-"号填列）', rowType: 'subtotal', formula: 'sum', linkedSubjectCodes: [], order: 20, section: 'profit', rowNo: '21', indent: 0 },
    { id: 'non_operating_income', rowName: '加：营业外收入', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6301'], order: 21, section: 'revenue', rowNo: '22', indent: 0 },
    { id: 'government_subsidy', rowName: '其中：政府补助', rowType: 'data', formula: 'sum', linkedSubjectCodes: [], order: 22, section: 'revenue', rowNo: '23', indent: 1 },
    { id: 'non_operating_expense', rowName: '减：营业外支出', rowType: 'data', formula: 'subtract', linkedSubjectCodes: ['6711'], order: 23, section: 'expense', rowNo: '24', indent: 0 },
    { id: 'bad_debt_loss', rowName: '其中：坏账损失', rowType: 'data', formula: 'subtract', linkedSubjectCodes: [], order: 24, section: 'expense', rowNo: '25', indent: 1 },
    { id: 'total_profit', rowName: '三、利润总额（亏损总额以"-"号填列）', rowType: 'subtotal', formula: 'sum', linkedSubjectCodes: [], order: 25, section: 'profit', rowNo: '30', indent: 0 },
    { id: 'income_tax', rowName: '减：所得税费用', rowType: 'data', formula: 'subtract', linkedSubjectCodes: ['6801'], order: 26, section: 'expense', rowNo: '31', indent: 0 },
    { id: 'net_profit', rowName: '四、净利润（净亏损以"-"号填列）', rowType: 'total', formula: 'sum', linkedSubjectCodes: [], order: 27, section: 'profit', rowNo: '32', indent: 0 },
  ];

  const reportData = useMemo(() => {
    return standardProfitRows.map(row => ({
      ...row,
      yearAmount: calculateRowAmount(row, yearPeriodAmounts, standardProfitRows),
      periodAmount: calculateRowAmount(row, periodAmounts, standardProfitRows)
    }));
  }, [periodAmounts, yearPeriodAmounts]);

  const formatRowNo = (no: string) => isEditMode ? '' : no;

  const handleExport = () => {
    try {
      const exportData: (string | number)[][] = [];
      exportData.push(['项目', '行次', '本年累计金额', '本月(季)金额']);
      reportData.forEach(row => {
        exportData.push([row.rowName, row.rowNo ?? '', formatAmount(row.yearAmount), formatAmount(row.periodAmount)]);
      });
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '利润表');
      XLSX.writeFile(workbook, `利润表_${startDate}_${endDate}.xlsx`);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const handlePrint = () => {
    // 添加打印时的body类
    document.body.classList.add('printing-profit-sheet');

    // 创建打印样式
    const printStyle = document.createElement('style');
    printStyle.setAttribute('id', 'print-styles-temp');
    printStyle.innerHTML = `
      @media print {
        @page {
          margin: 0.5cm;
          size: A4 portrait;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body.printing-profit-sheet > * {
          visibility: hidden;
        }
        body.printing-profit-sheet #profit-sheet-content {
          visibility: visible;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 0.5cm;
          box-sizing: border-box;
        }
        body.printing-profit-sheet #profit-sheet-content > * {
          visibility: visible;
        }
        /* 隐藏控制栏 */
        body.printing-profit-sheet #profit-sheet-content > div:first-child {
          display: none !important;
        }
        /* 隐藏底部提示 */
        body.printing-profit-sheet .no-print {
          display: none !important;
        }
        /* 显示打印标题 */
        body.printing-profit-sheet .print-header .hidden {
          display: flex !important;
        }
        body.printing-profit-sheet .print-header .screen-only {
          display: none !important;
        }
        body.printing-profit-sheet .print-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 12px;
        }
        body.printing-profit-sheet .print-info-row {
          display: flex !important;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 12px;
        }
        /* 表格样式 */
        body.printing-profit-sheet table {
          font-size: 9pt !important;
          width: 100% !important;
          border-collapse: collapse !important;
        }
        body.printing-profit-sheet th,
        body.printing-profit-sheet td {
          padding: 2px 4px !important;
          border: 1px solid #000 !important;
        }
        body.printing-profit-sheet thead th {
          background: #f5f5f5 !important;
          -webkit-print-color-adjust: exact !important;
        }
        /* 移除Card样式 */
        body.printing-profit-sheet .Card {
          border: none !important;
          box-shadow: none !important;
        }
        body.printing-profit-sheet .CardHeader,
        body.printing-profit-sheet .CardContent {
          padding: 0 !important;
        }
      }
    `;
    document.head.appendChild(printStyle);

    // 打印后清理
    const cleanup = () => {
      document.body.classList.remove('printing-profit-sheet');
      const style = document.getElementById('print-styles-temp');
      if (style && document.head.contains(style)) {
        document.head.removeChild(style);
      }
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();
  };

  const openConfigDialog = (row: ReportRow) => {
    setEditingRow(row);
    setConfigDialogOpen(true);
  };

  const saveSubjectLinkage = (codes: string[]) => {
    if (editingRow) reportConfigStore.updateRow('profit', editingRow.id, { linkedSubjectCodes: codes });
    setConfigDialogOpen(false);
    setEditingRow(null);
  };

  const currentAccountSet = accountSetStore.getCurrentAccountSet();

  return (
    <div className="space-y-6" id="profit-sheet-content">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">利润表</h1>
        <div className="flex items-center gap-3 no-print">
          <ChineseDatePicker value={startDate} onChange={(v) => setStartDate(v)} className="border border-slate-300 rounded px-2 py-1 text-sm" />
          <span className="text-slate-500">至</span>
          <ChineseDatePicker value={endDate} onChange={(v) => setEndDate(v)} className="border border-slate-300 rounded px-2 py-1 text-sm" />
          <Button variant="outline" size="sm" onClick={() => setIsEditMode(!isEditMode)}><Edit3 className="h-4 w-4 mr-2" />{isEditMode ? '完成' : '编辑'}</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" />导出</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />打印</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="print-header">
          {/* 打印时的标题区域 */}
          <div className="hidden print:flex flex-col print:block">
            <h1 className="print-title">利润表</h1>
            <div className="print-info-row">
              <div className="print-info-left">制表单位：{currentAccountSet?.name || ''}</div>
              <div className="print-info-center">报告期间：{startDate} 至 {endDate}</div>
              <div className="print-info-right">单位：元</div>
            </div>
          </div>
          {/* 屏幕显示时的标题区域 */}
          <div className="text-center print:hidden screen-only">
            <CardTitle className="text-xl">{mounted ? (currentAccountSet?.name || '') : ''} 利润表</CardTitle>
            <p className="text-sm text-slate-600 mt-2">报告期间：{startDate} 至 {endDate} | 单位：元</p>
          </div>
        </CardHeader>
        <CardContent>
          {isEditMode && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="font-medium">编辑模式：点击行右侧的设置图标配置关联科目</p>
            </div>
          )}

          <table className="w-full border-collapse text-sm print-table">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 text-left border font-bold">项目</th>
                <th className="p-2 text-center border font-bold w-12">行次</th>
                <th className="p-2 text-right border font-bold w-32">本年累计金额</th>
                <th className="p-2 text-right border font-bold w-32">本月(季)金额</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(row => (
                <tr key={row.id} className={row.rowType === 'total' ? 'font-bold bg-slate-50' : row.rowType === 'header' ? 'bg-slate-100' : ''}>
                  <td className="p-2 border" style={{ paddingLeft: `${(row.indent || 0) * 12 + 8}px` }}>
                    {isEditMode && row.rowType !== 'header' ? (
                      <div className="flex items-center gap-1">
                        <Input value={row.rowName} onChange={(e) => reportConfigStore.updateRow('profit', row.id, { rowName: e.target.value })} className="h-7 text-sm flex-1" />
                        <Button size="sm" variant="ghost" onClick={() => openConfigDialog(row)}><Settings className="h-3 w-3" /></Button>
                      </div>
                    ) : row.rowName}
                  </td>
                  <td className="p-2 border text-center">{formatRowNo(row.rowNo)}</td>
                  <td className="p-2 border text-right">{formatAmount(row.yearAmount)}</td>
                  <td className="p-2 border text-right">{formatAmount(row.periodAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SubjectLinkageConfigurator
        isOpen={configDialogOpen}
        onClose={() => { setConfigDialogOpen(false); setEditingRow(null); }}
        linkedSubjectCodes={editingRow?.linkedSubjectCodes || []}
        allSubjects={subjectTree}
        onSave={saveSubjectLinkage}
        title={`配置关联科目 - ${editingRow?.rowName}`}
      />
    </div>
  );
}
