'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useMounted } from '@/hooks/useMounted';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useReportConfigStore, type ReportRow } from '@/stores/useReportConfigStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Printer, Calendar, Settings, Edit3, Save, RotateCcw } from 'lucide-react';
import { SubjectLinkageConfigurator } from '@/components/reports/subject-linkage-configurator';
import * as XLSX from 'xlsx';

// 格式化金额（不带币种符号）
const formatAmount = (amount: number): string => {
  if (amount === 0) return '';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return amount < 0 ? `(${formatted})` : formatted;
};

export default function AssetsPage() {
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ReportRow | null>(null);
  const [openingBalanceDialogOpen, setOpeningBalanceDialogOpen] = useState(false);
  const [editingOpeningCode, setEditingOpeningCode] = useState<string>('');
  const [editingOpeningAmount, setEditingOpeningAmount] = useState<number>(0);
  const [showYearBeginning, setShowYearBeginning] = useState(true); // 是否显示年初余额
  const mounted = useMounted(); // 客户端挂载状态

  const voucherStore = useVoucherStore();
  const subjectStore = useSubjectStore();
  const accountSetStore = useAccountSetStore();

  // 期初余额存储
  const [openingBalances, setOpeningBalances] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem('opening_balances');
    return saved ? JSON.parse(saved) : {};
  });

  // 使用标准配置初始化
  useEffect(() => {
    if (voucherStore.vouchers.length === 0) voucherStore.initialize();
    if (subjectStore.subjects.length === 0) subjectStore.initializeSubjects();
  }, []);

  // 构建科目树
  const subjectTree = useMemo(() => {
    type SubjectNode = { code: string; name: string; children: SubjectNode[] };
    const roots: SubjectNode[] = [], map = new Map<string, SubjectNode>();
    subjectStore.subjects.forEach(s => map.set(s.code, { code: s.code, name: s.name, children: [] }));
    subjectStore.subjects.forEach(s => {
      const node = map.get(s.code)!;
      if (s.parentId && map.has(s.parentId)) map.get(s.parentId)!.children.push(node);
      else roots.push(node);
    });
    return roots;
  }, [subjectStore.subjects]);

  // 计算期末余额
  const calculateEndingBalances = useMemo(() => {
    const balanceMap = new Map<string, number>();
    Object.entries(openingBalances).forEach(([code, amount]) => balanceMap.set(code, amount));

    const postedVouchers = voucherStore.vouchers.filter(v => v.status === 'posted' && v.date <= reportDate);
    postedVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const current = balanceMap.get(entry.subjectCode) || 0;
        const subject = subjectStore.subjects.find(s => s.code === entry.subjectCode);
        const direction = subject?.direction || 'debit';
        const change = direction === 'debit' ? entry.debit - entry.credit : entry.credit - entry.debit;
        balanceMap.set(entry.subjectCode, current + change);
      });
    });
    return balanceMap;
  }, [openingBalances, voucherStore.vouchers, subjectStore.subjects, reportDate]);

  // 解析科目代码
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

  // 计算科目余额（含子科目）
  const getSubjectBalance = (code: string, balanceMap: Map<string, number>): number => {
    let balance = balanceMap.get(code) || 0;
    subjectStore.subjects.filter(s => s.parentId === code).forEach(child => {
      balance += getSubjectBalance(child.code, balanceMap);
    });
    return balance;
  };

  // 计算报表行金额
  const calculateRowAmount = (row: ReportRow, balanceMap: Map<string, number>, rows: ReportRow[]): number => {
    if (row.rowType === 'header') return 0;

    // 小计和总计行：累加前面的数据行
    if ((row.rowType === 'subtotal' || row.rowType === 'total') && row.linkedSubjectCodes.length === 0) {
      let total = 0;
      for (const r of rows) {
        if (r.order >= row.order) break;
        if (r.rowType === 'data' || r.rowType === 'subtotal') {
          // 只汇总同一section且在当前行之前的行
          if (r.section === row.section) {
            const amt = calculateRowAmount(r, balanceMap, rows);
            if (r.formula === 'sum') {
              total += amt;
            } else if (r.formula === 'subtract') {
              total -= amt;
            }
          }
        }
      }
      return total;
    }

    // 数据行：根据公式类型计算
    const subjectAmount = resolveSubjectCodes(row.linkedSubjectCodes)
      .reduce((sum, code) => sum + getSubjectBalance(code, balanceMap), 0);

    return row.formula === 'subtract' ? -subjectAmount : subjectAmount;
  };

  // 获取配置store
  const { assetsReportRows, updateRow, resetToDefault } = useReportConfigStore();

  // 重置报表配置
  const resetReportConfig = () => {
    if (confirm('确定要重置报表配置为默认格式吗？这将清除所有自定义配置。')) {
      resetToDefault('assets');
    }
  };

  // 获取所有行
  const allRows = assetsReportRows;

  // 计算报表数据
  const reportData = useMemo(() => {
    return assetsReportRows.map(row => ({
      ...row,
      openingAmount: calculateRowAmount(row, new Map(Object.entries(openingBalances)), assetsReportRows),
      endingAmount: calculateRowAmount(row, calculateEndingBalances, assetsReportRows)
    }));
  }, [assetsReportRows, openingBalances, calculateEndingBalances]);

  // 格式化行号
  const formatRowNo = (no: string) => isEditMode ? '' : no;

  // 导出Excel
  const handleExport = () => {
    try {
      const exportData: Array<Array<string | number>> = [];
      exportData.push(['资产', '行次', showYearBeginning ? '年初余额' : '期初余额', '期末余额', '负债和所有者权益', '行次', showYearBeginning ? '年初余额' : '期初余额', '期末余额']);

      reportData.forEach(row => {
        if (row.section === 'assets') {
          const matchingLeRow = reportData.find(r => r.rowNo === row.rowNo && r.section !== 'assets');
          exportData.push([
            row.rowName, row.rowNo, formatAmount(row.openingAmount), formatAmount(row.endingAmount),
            matchingLeRow?.rowName || '', matchingLeRow?.rowNo || '',
            matchingLeRow ? formatAmount(matchingLeRow.openingAmount) : '',
            matchingLeRow ? formatAmount(matchingLeRow.endingAmount) : ''
          ]);
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '资产负债表');
      XLSX.writeFile(workbook, `资产负债表_${reportDate}.xlsx`);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  // 打印
  const handlePrint = () => {
    // 添加打印时的body类
    document.body.classList.add('printing-balance-sheet');

    // 创建打印样式
    const printStyle = document.createElement('style');
    printStyle.setAttribute('id', 'print-styles-temp');
    printStyle.innerHTML = `
      @media print {
        @page {
          margin: 0.5cm;
          size: A4 landscape;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body.printing-balance-sheet > * {
          visibility: hidden;
        }
        body.printing-balance-sheet #balance-sheet-content {
          visibility: visible;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 0.5cm;
          box-sizing: border-box;
        }
        body.printing-balance-sheet #balance-sheet-content > * {
          visibility: visible;
        }
        /* 隐藏控制栏 */
        body.printing-balance-sheet #balance-sheet-content > div:first-child {
          display: none !important;
        }
        /* 隐藏底部提示 */
        body.printing-balance-sheet .no-print {
          display: none !important;
        }
        /* 显示打印标题 */
        body.printing-balance-sheet .print-header .hidden {
          display: flex !important;
        }
        body.printing-balance-sheet .print-header .screen-only {
          display: none !important;
        }
        body.printing-balance-sheet .print-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 12px;
        }
        body.printing-balance-sheet .print-info-row {
          display: flex !important;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 12px;
        }
        /* 表格样式 */
        body.printing-balance-sheet table {
          font-size: 9pt !important;
          width: 100% !important;
          border-collapse: collapse !important;
        }
        body.printing-balance-sheet th,
        body.printing-balance-sheet td {
          padding: 2px 4px !important;
          border: 1px solid #000 !important;
        }
        /* 中间分隔线 - 只显示左边框 */
        body.printing-balance-sheet th.border-l,
        body.printing-balance-sheet td.border-l {
          border: 1px solid #000 !important;
          border-right: none !important;
          border-top: none !important;
          border-bottom: none !important;
          padding: 0 !important;
          width: 1px !important;
        }
        /* 移除年初余额列的右边框 */
        body.printing-balance-sheet th.border-r-0,
        body.printing-balance-sheet td.border-r-0 {
          border-right: none !important;
        }
        body.printing-balance-sheet thead th {
          background: #f5f5f5 !important;
          -webkit-print-color-adjust: exact !important;
        }
        /* 移除Card样式 */
        body.printing-balance-sheet .Card {
          border: none !important;
          box-shadow: none !important;
        }
        body.printing-balance-sheet .CardHeader,
        body.printing-balance-sheet .CardContent {
          padding: 0 !important;
        }
      }
    `;
    document.head.appendChild(printStyle);

    // 打印后清理
    const cleanup = () => {
      document.body.classList.remove('printing-balance-sheet');
      const style = document.getElementById('print-styles-temp');
      if (style && document.head.contains(style)) {
        document.head.removeChild(style);
      }
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();
  };

  // 保存期初余额
  const saveOpeningBalance = () => {
    if (editingOpeningCode) {
      const newBalances = { ...openingBalances, [editingOpeningCode]: editingOpeningAmount };
      setOpeningBalances(newBalances);
      localStorage.setItem('opening_balances', JSON.stringify(newBalances));
    }
    setOpeningBalanceDialogOpen(false);
  };

  // 重置期初余额
  const resetOpeningBalances = () => {
    if (confirm('确定要清空所有期初余额吗？')) {
      setOpeningBalances({});
      localStorage.removeItem('opening_balances');
    }
  };

  // 打开科目关联配置器
  const openConfigDialog = (row: ReportRow) => {
    setEditingRow(row);
    setConfigDialogOpen(true);
  };

  const saveSubjectLinkage = (codes: string[]) => {
    if (editingRow) updateRow('assets', editingRow.id, { linkedSubjectCodes: codes });
    setConfigDialogOpen(false);
    setEditingRow(null);
  };

  // 负债和权益行配置
  const leRows = useMemo(() => {
    return reportData.filter(r => r.section === 'liabilities' || r.section === 'equity');
  }, [reportData]);

  const currentAccountSet = accountSetStore.getCurrentAccountSet();
  const assetsTotal = reportData.find(r => r.id === 'assets_total');
  const leTotal = reportData.find(r => r.section === 'liabilities' && r.rowType === 'total');
  const equityTotal = reportData.find(r => r.section === 'equity' && r.rowType === 'total');
  const leAndEquityTotal = reportData.find(r => r.id === 'le_total');
  const totalDiff = (assetsTotal?.endingAmount || 0) - ((leTotal?.endingAmount || 0) + (equityTotal?.endingAmount || 0));

  return (
    <div className="space-y-6" id="balance-sheet-content">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">资产负债表</h1>
        <div className="flex items-center gap-3 no-print">
          <ChineseDatePicker value={reportDate} onChange={(v) => setReportDate(v)} className="border border-slate-300 rounded px-2 py-1 text-sm" />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={showYearBeginning} onChange={(e) => setShowYearBeginning(e.target.checked)} /> 年初余额</label>
          <Button variant="outline" size="sm" onClick={() => setOpeningBalanceDialogOpen(true)}><Save className="h-4 w-4 mr-2" />期初余额</Button>
          <Button variant="outline" size="sm" onClick={() => setIsEditMode(!isEditMode)}><Edit3 className="h-4 w-4 mr-2" />{isEditMode ? '完成' : '编辑'}</Button>
          <Button variant="outline" size="sm" onClick={resetReportConfig}><RotateCcw className="h-4 w-4 mr-2" />重置格式</Button>
          <Button variant="outline" size="sm" onClick={resetOpeningBalances} title="重置期初余额"><RotateCcw className="h-4 w-4 mr-2" />重置期初</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" />导出</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />打印</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="print-header">
          {/* 打印时的标题区域 */}
          <div className="hidden print:flex flex-col print:block">
            <h1 className="print-title">资产负债表</h1>
            <div className="print-info-row">
              <div className="print-info-left">制表单位：{currentAccountSet?.name || ''}</div>
              <div className="print-info-center">报表日期：{reportDate}</div>
              <div className="print-info-right">单位：元</div>
            </div>
          </div>
          {/* 屏幕显示时的标题区域 */}
          <div className="text-center print:hidden screen-only">
            <CardTitle className="text-xl">{mounted ? (currentAccountSet?.name || '') : ''} 资产负债表</CardTitle>
            <p className="text-sm text-slate-600 mt-2">报表日期：{reportDate} | 单位：元</p>
          </div>
        </CardHeader>
        <CardContent>
          {isEditMode && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="font-medium">编辑模式：点击行右侧的设置图标配置关联科目，支持通配符（1002*）和区间（1001..1009）</p>
            </div>
          )}

          <table className="w-full border-collapse text-sm print-table">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 text-left border font-bold">资产</th>
                <th className="p-2 text-center border font-bold w-12">行次</th>
                <th className="p-2 text-right border font-bold w-28">期末余额</th>
                {showYearBeginning && <th className="p-2 pr-1 text-right border-r-0 border-t border-b font-bold w-28">年初余额</th>}
                <th className="p-0 pl-0 border-0 border-l" style={{ width: '1px' }}></th>
                <th className="p-2 text-left border font-bold">负债和所有者权益</th>
                <th className="p-2 text-center border font-bold w-12">行次</th>
                <th className="p-2 text-right border font-bold w-28">期末余额</th>
                {showYearBeginning && <th className="p-2 text-right border font-bold w-28">年初余额</th>}
              </tr>
            </thead>
            <tbody>
              {useMemo(() => {
                // 分离资产、负债和权益行
                const assetRows = reportData.filter(r => r.section === 'assets');
                const liabilityRows = reportData.filter(r => r.section === 'liabilities');
                const equityRows = reportData.filter(r => r.section === 'equity');

                // 合并负债和权益行
                const leRows = [...liabilityRows, ...equityRows];

                // 找到总计行
                const assetsTotalRow = assetRows.find(r => r.id === 'assets_total');
                const leTotalRow = leRows.find(r => r.id === 'le_total');

                // 移除总计行，避免重复渲染
                const otherAssetRows = assetRows.filter(r => r.id !== 'assets_total');
                const otherLeRows = leRows.filter(r => r.id !== 'le_total');

                // 获取最大行数（不包含总计行）
                const maxRows = Math.max(otherAssetRows.length, otherLeRows.length);

                // 构建行数组
                const rows: Array<{ assetRow: typeof reportData[0] | null; leRow: typeof reportData[0] | null }> = [];

                // 按顺序添加行，左侧不空，右侧可能空
                for (let i = 0; i < maxRows; i++) {
                  const assetRow = i < otherAssetRows.length ? otherAssetRows[i] : null;
                  const leRow = i < otherLeRows.length ? otherLeRows[i] : null;
                  rows.push({ assetRow, leRow });
                }

                // 最后添加总计行
                rows.push({ assetRow: assetsTotalRow || null, leRow: leTotalRow || null });

                return rows.map(({ assetRow, leRow }, i) => (
                  <tr key={i} className={(assetRow?.rowType === 'total' || leRow?.rowType === 'total') ? 'font-bold bg-slate-50 print-total-row' : (assetRow?.rowType === 'header' || leRow?.rowType === 'header') ? 'bg-slate-100' : ''}>
                    {/* 资产列 */}
                    <td className="p-2 border" style={{ paddingLeft: `${(assetRow?.indent || 0) * 12 + 8}px` }}>
                      {assetRow && isEditMode && assetRow.rowType !== 'header' ? (
                        <div className="flex items-center gap-1">
                          <Input value={assetRow.rowName} onChange={(e) => updateRow('assets', assetRow.id, { rowName: e.target.value })} className="h-7 text-sm flex-1" />
                          <Button size="sm" variant="ghost" onClick={() => openConfigDialog(assetRow)}><Settings className="h-3 w-3" /></Button>
                        </div>
                      ) : (assetRow?.rowName || '')}
                    </td>
                    <td className="p-2 border text-center">{assetRow ? formatRowNo(assetRow.rowNo) : ''}</td>
                    <td className="p-2 border text-right">{assetRow ? formatAmount(assetRow.endingAmount) : ''}</td>
                    {showYearBeginning && <td className="p-2 pr-1 border-r-0 border-t border-b text-right">{assetRow ? formatAmount(assetRow.openingAmount) : ''}</td>}

                    {/* 中间分隔线 */}
                    <td className="p-0 pl-0 border-0 border-l" style={{ width: '1px' }}></td>

                    {/* 负债和权益列 */}
                    <td className="p-2 border" style={{ paddingLeft: `${(leRow?.indent || 0) * 12 + 8}px` }}>
                      {leRow && isEditMode && leRow.rowType !== 'header' ? (
                        <div className="flex items-center gap-1">
                          <Input value={leRow.rowName} onChange={(e) => updateRow('assets', leRow.id, { rowName: e.target.value })} className="h-7 text-sm flex-1" />
                          <Button size="sm" variant="ghost" onClick={() => openConfigDialog(leRow)}><Settings className="h-3 w-3" /></Button>
                        </div>
                      ) : (leRow?.rowName || '')}
                    </td>
                    <td className="p-2 border text-center">{leRow ? formatRowNo(leRow.rowNo) : ''}</td>
                    <td className="p-2 border text-right">{leRow ? formatAmount(leRow.endingAmount) : ''}</td>
                    {showYearBeginning && <td className="p-2 border text-right">{leRow ? formatAmount(leRow.openingAmount) : ''}</td>}
                  </tr>
                ));
              }, [reportData, isEditMode])}
            </tbody>
          </table>

          <div className={`mt-4 p-3 rounded text-sm no-print ${Math.abs(totalDiff) < 0.01 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {Math.abs(totalDiff) < 0.01 ? '✓ 资产总计 = 负债和所有者权益总计' : `⚠️ 不平衡，差异：${formatAmount(totalDiff)}`}
          </div>
        </CardContent>
      </Card>

      {/* 期初余额对话框 */}
      <Dialog open={openingBalanceDialogOpen} onOpenChange={setOpeningBalanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>设置期初余额</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <select value={editingOpeningCode} onChange={(e) => { setEditingOpeningCode(e.target.value); setEditingOpeningAmount(openingBalances[e.target.value] || 0); }} className="w-full border rounded px-3 py-2">
              <option value="">-- 选择科目 --</option>
              {subjectTree.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
            </select>
            <Input type="number" value={editingOpeningAmount} onChange={(e) => setEditingOpeningAmount(parseFloat(e.target.value) || 0)} placeholder="期初余额" />
            <Button onClick={saveOpeningBalance} className="w-full">保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 科目关联配置器 */}
      <SubjectLinkageConfigurator isOpen={configDialogOpen} onClose={() => { setConfigDialogOpen(false); setEditingRow(null); }} linkedSubjectCodes={editingRow?.linkedSubjectCodes || []} allSubjects={subjectTree} onSave={saveSubjectLinkage} title={`配置关联科目 - ${editingRow?.rowName}`} />
    </div>
  );
}
