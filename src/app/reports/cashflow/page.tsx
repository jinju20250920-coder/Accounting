'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Search,
  Download,
  Calendar,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  Users,
  Printer
} from 'lucide-react';
import { useVoucherStore } from '@/stores';
import { useSubjectStore } from '@/stores';
import { useAccountSetStore } from '@/stores';
import { useToast } from '@/components/ui/toast';
import { exportToExcel } from '@/lib/excel-utils';

// 现金流量项目配置
const CASH_FLOW_ITEMS = {
  operating: {
    label: '一、经营活动产生的现金流量',
    items: [
      { key: 'sales_goods', label: '销售商品、提供劳务收到的现金', type: 'inflow' },
      { key: 'tax_refund', label: '收到的税费返还', type: 'inflow' },
      { key: 'other_operating_receipts', label: '收到其他与经营活动有关的现金', type: 'inflow' },
      { key: '_operating_inflow_subtotal', label: '经营活动现金流入小计', type: 'subtotal' },
      { key: 'purchase_goods', label: '购买商品、接受劳务支付的现金', type: 'outflow' },
      { key: 'pay_staff', label: '支付给职工以及为职工支付的现金', type: 'outflow' },
      { key: 'pay_taxes', label: '支付的各项税费', type: 'outflow' },
      { key: 'other_operating_payments', label: '支付其他与经营活动有关的现金', type: 'outflow' },
      { key: '_operating_outflow_subtotal', label: '经营活动现金流出小计', type: 'subtotal' },
      { key: '_operating_net', label: '经营活动产生的现金流量净额', type: 'net' },
    ]
  },
  investing: {
    label: '二、投资活动产生的现金流量',
    items: [
      { key: 'invest_recover', label: '收回投资收到的现金', type: 'inflow' },
      { key: 'invest_income', label: '取得投资收益收到的现金', type: 'inflow' },
      { key: 'fixed_asset_recover', label: '处置固定资产、无形资产和其他长期资产收回的现金净额', type: 'inflow' },
      { key: 'other_invest_receipts', label: '收到其他与投资活动有关的现金', type: 'inflow' },
      { key: '_investing_inflow_subtotal', label: '投资活动现金流入小计', type: 'subtotal' },
      { key: 'fixed_asset_pay', label: '购建固定资产、无形资产和其他长期资产支付的现金', type: 'outflow' },
      { key: 'invest_pay', label: '投资支付的现金', type: 'outflow' },
      { key: 'other_invest_payments', label: '支付其他与投资活动有关的现金', type: 'outflow' },
      { key: '_investing_outflow_subtotal', label: '投资活动现金流出小计', type: 'subtotal' },
      { key: '_investing_net', label: '投资活动产生的现金流量净额', type: 'net' },
    ]
  },
  financing: {
    label: '三、筹资活动产生的现金流量',
    items: [
      { key: 'capital_receipts', label: '吸收投资收到的现金', type: 'inflow' },
      { key: 'loan_receipts', label: '取得借款收到的现金', type: 'inflow' },
      { key: 'other_finance_receipts', label: '收到其他与筹资活动有关的现金', type: 'inflow' },
      { key: '_financing_inflow_subtotal', label: '筹资活动现金流入小计', type: 'subtotal' },
      { key: 'debt_pay', label: '偿还债务支付的现金', type: 'outflow' },
      { key: 'dividend_pay', label: '分配股利、利润或偿付利息支付的现金', type: 'outflow' },
      { key: 'other_finance_payments', label: '支付其他与筹资活动有关的现金', type: 'outflow' },
      { key: '_financing_outflow_subtotal', label: '筹资活动现金流出小计', type: 'subtotal' },
      { key: '_financing_net', label: '筹资活动产生的现金流量净额', type: 'net' },
    ]
  },
  summary: {
    label: '四、现金及现金等价物净增加额',
    items: [
      { key: '_net_increase', label: '现金及现金等价物净增加额', type: 'net' },
      { key: '_opening_balance', label: '加：期初现金及现金等价物余额', type: 'balance' },
      { key: '_closing_balance', label: '期末现金及现金等价物余额', type: 'balance' },
    ]
  }
};

export default function CashflowPage() {
  const { showToast } = useToast();
  const { vouchers, ledgerEntries } = useVoucherStore();
  const { subjects, initializeSubjects } = useSubjectStore();
  const accountSetStore = useAccountSetStore();
  const currentAccountSet = accountSetStore.getCurrentAccountSet();

  const [period, setPeriod] = useState({
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: new Date().toISOString().split('T')[0]
  });

  // 初始化数据
  useEffect(() => {
    initializeSubjects();
  }, [initializeSubjects]);

  // 计算现金流量数据
  const cashFlowData = useMemo(() => {
    const data: Record<string, number> = {};
    const openingCashBalance = 0;
    const closingCashBalance = 0;

    // 识别现金及现金等价物科目（1001库存现金、1002银行存款）
    const cashSubjects = subjects.filter(s =>
      s.code.startsWith('1001') || s.code.startsWith('1002')
    ).map(s => s.code);

    // 初始化所有项目为0
    Object.values(CASH_FLOW_ITEMS).forEach(category => {
      category.items.forEach(item => {
        data[item.key] = 0;
      });
    });

    // 筛选期间内的已记账凭证
    const periodVouchers = vouchers.filter(v =>
      v.date >= period.startDate &&
      v.date <= period.endDate &&
      (v.status === 'posted' || v.status === 'reversed')
    );

    // 简单示例：基于凭证数据计算现金流量
    periodVouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        const subject = subjects.find(s => s.code === entry.subjectCode);
        const cashFlowItem = (subject as any)?.cashFlowItem;

        // 如果该科目指定了现金流量项目，则计入对应项目
        if (cashFlowItem && data[cashFlowItem] !== undefined) {
          const isCashSubject = cashSubjects.some(cs => entry.subjectCode.startsWith(cs));

          if (isCashSubject) {
            // 现金科目本身：借方是流入，贷方是流出
            if (entry.debit > 0) {
              data[cashFlowItem] += entry.debit;
            }
            if (entry.credit > 0) {
              data[cashFlowItem] -= entry.credit;
            }
          } else {
            // 对方科目：借方是流出（现金减少），贷方是流入（现金增加）
            // 这里简化处理，实际需要更复杂的分析
            if (entry.debit > 0) {
              data[cashFlowItem] -= entry.debit;
            }
            if (entry.credit > 0) {
              data[cashFlowItem] += entry.credit;
            }
          }
        }
      });
    });

    // 计算小计和净额
    // 经营活动
    data['_operating_inflow_subtotal'] =
      data['sales_goods'] +
      data['tax_refund'] +
      data['other_operating_receipts'];

    data['_operating_outflow_subtotal'] =
      Math.abs(data['purchase_goods']) +
      Math.abs(data['pay_staff']) +
      Math.abs(data['pay_taxes']) +
      Math.abs(data['other_operating_payments']);

    data['_operating_net'] =
      data['_operating_inflow_subtotal'] -
      data['_operating_outflow_subtotal'];

    // 投资活动
    data['_investing_inflow_subtotal'] =
      data['invest_recover'] +
      data['invest_income'] +
      data['fixed_asset_recover'] +
      data['other_invest_receipts'];

    data['_investing_outflow_subtotal'] =
      Math.abs(data['fixed_asset_pay']) +
      Math.abs(data['invest_pay']) +
      Math.abs(data['other_invest_payments']);

    data['_investing_net'] =
      data['_investing_inflow_subtotal'] -
      data['_investing_outflow_subtotal'];

    // 筹资活动
    data['_financing_inflow_subtotal'] =
      data['capital_receipts'] +
      data['loan_receipts'] +
      data['other_finance_receipts'];

    data['_financing_outflow_subtotal'] =
      Math.abs(data['debt_pay']) +
      Math.abs(data['dividend_pay']) +
      Math.abs(data['other_finance_payments']);

    data['_financing_net'] =
      data['_financing_inflow_subtotal'] -
      data['_financing_outflow_subtotal'];

    // 净增加额
    data['_net_increase'] =
      data['_operating_net'] +
      data['_investing_net'] +
      data['_financing_net'];

    // 期初和期末余额（示例值）
    data['_opening_balance'] = openingCashBalance;
    data['_closing_balance'] = openingCashBalance + data['_net_increase'];

    return data;
  }, [vouchers, subjects, period]);

  const handleExport = () => {
    const exportData: any[] = [];

    Object.entries(CASH_FLOW_ITEMS).forEach(([categoryKey, category]) => {
      exportData.push({ '项目': category.label, '行次': '', '金额': '' });

      category.items.forEach((item, index) => {
        const amount = cashFlowData[item.key] || 0;
        exportData.push({
          '项目': item.label,
          '行次': '',
          '金额': item.type === 'outflow' ? Math.abs(amount) : amount
        });
      });
    });

    exportToExcel(exportData, '现金流量表');
    showToast('success', '现金流量表导出成功');
  };

  const handlePrint = () => {
    document.body.classList.add('printing-cashflow-sheet');

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
        body.printing-cashflow-sheet > * {
          visibility: hidden;
        }
        body.printing-cashflow-sheet #cashflow-sheet-content {
          visibility: visible;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 0.5cm;
          box-sizing: border-box;
        }
        body.printing-cashflow-sheet #cashflow-sheet-content > * {
          visibility: visible;
        }
        /* 隐藏不需要打印的元素 */
        body.printing-cashflow-sheet .no-print {
          display: none !important;
        }
        /* 只显示现金流量表Card (第4个子元素) */
        body.printing-cashflow-sheet #cashflow-sheet-content > div:nth-child(1),
        body.printing-cashflow-sheet #cashflow-sheet-content > div:nth-child(2),
        body.printing-cashflow-sheet #cashflow-sheet-content > div:nth-child(3) {
          display: none !important;
        }
        /* 表格样式 */
        body.printing-cashflow-sheet table {
          font-size: 9pt !important;
          width: 100% !important;
          border-collapse: collapse !important;
        }
        body.printing-cashflow-sheet th,
        body.printing-cashflow-sheet td {
          padding: 2px 4px !important;
          border: 1px solid #000 !important;
        }
        body.printing-cashflow-sheet thead th {
          background: #f5f5f5 !important;
          -webkit-print-color-adjust: exact !important;
        }
        /* 移除Card样式 */
        body.printing-cashflow-sheet .Card {
          border: none !important;
          box-shadow: none !important;
        }
        body.printing-cashflow-sheet .CardHeader,
        body.printing-cashflow-sheet .CardContent {
          padding: 0 !important;
        }
        /* 打印标题 */
        body.printing-cashflow-sheet .print-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 12px;
        }
        body.printing-cashflow-sheet .print-info-row {
          display: flex !important;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 12px;
        }
        /* 隐藏说明区域 */
        body.printing-cashflow-sheet .mt-6 {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(printStyle);

    const cleanup = () => {
      document.body.classList.remove('printing-cashflow-sheet');
      const style = document.getElementById('print-styles-temp');
      if (style && document.head.contains(style)) {
        document.head.removeChild(style);
      }
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();
  };

  const formatAmount = (amount: number, type?: string) => {
    const num = type === 'outflow' ? Math.abs(amount) : amount;
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const renderCashFlowRow = (item: any) => {
    const amount = cashFlowData[item.key] || 0;
    const isSubtotal = item.type === 'subtotal' || item.type === 'net' || item.type === 'balance';
    const isPositive = amount >= 0;

    return (
      <tr key={item.key} className={isSubtotal ? 'bg-slate-50 font-medium' : ''}>
        <td className={`py-2 px-4 ${isSubtotal ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
          {item.label}
        </td>
        <td className="py-2 px-4 text-right">
          {item.type === 'subtotal' || item.type === 'net' || item.type === 'balance' ? (
            <Badge className={isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {formatAmount(amount)}
            </Badge>
          ) : (
            <span className={isPositive ? 'text-green-700' : 'text-red-700'}>
              {formatAmount(amount, item.type)}
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" id="cashflow-sheet-content">
      {/* 标题栏 */}
      <div className="mb-6 no-print">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Landmark className="h-8 w-8 text-blue-600" />
          现金流量表
        </h1>
        <p className="text-slate-600 mt-1">
          反映企业在一定会计期间现金和现金等价物流入和流出的报表
        </p>
      </div>

      {/* 筛选栏 */}
      <Card className="mb-4 no-print">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <Label>期间</Label>
            </div>
            <ChineseDatePicker
              value={period.startDate}
              onChange={(v) => setPeriod(prev => ({ ...prev, startDate: v }))}
              className="w-40"
            />
            <span className="text-slate-400">至</span>
            <ChineseDatePicker
              value={period.endDate}
              onChange={(v) => setPeriod(prev => ({ ...prev, endDate: v }))}
              className="w-40"
            />
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              打印
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 no-print">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">经营活动现金流量净额</p>
                <p className={`text-2xl font-bold ${cashFlowData['_operating_net'] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{formatAmount(cashFlowData['_operating_net'] || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">投资活动现金流量净额</p>
                <p className={`text-2xl font-bold ${cashFlowData['_investing_net'] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{formatAmount(cashFlowData['_investing_net'] || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">现金及现金等价物净增加额</p>
                <p className={`text-2xl font-bold ${cashFlowData['_net_increase'] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{formatAmount(cashFlowData['_net_increase'] || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 现金流量表主体 */}
      <Card>
        <CardHeader className="print-header">
          {/* 打印时的标题区域 */}
          <div className="hidden print:flex flex-col print:block">
            <h1 className="print-title">现金流量表</h1>
            <div className="print-info-row">
              <div className="print-info-left">制表单位：{currentAccountSet?.name || ''}</div>
              <div className="print-info-center">报告期间：{period.startDate} 至 {period.endDate}</div>
              <div className="print-info-right">单位：元</div>
            </div>
          </div>
          {/* 屏幕显示时的标题区域 */}
          <div className="print:hidden">
            <CardTitle className="flex items-center gap-2">
              <span>现金流量表</span>
              <Badge variant="outline" className="ml-2">
                {period.startDate} 至 {period.endDate}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 w-3/4">项目</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 w-1/4">金额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(CASH_FLOW_ITEMS).map(([categoryKey, category]) => (
                  <React.Fragment key={categoryKey}>
                    {/* 分类标题 */}
                    <tr className="bg-slate-100">
                      <td colSpan={2} className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{category.label}</span>
                      </td>
                    </tr>
                    {/* 分类项目 */}
                    {category.items.map(item => renderCashFlowRow(item))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* 说明 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg no-print">
            <h4 className="font-medium text-blue-800 mb-2">说明</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 现金流量表数据基于已记账凭证自动计算生成</li>
              <li>• 请在科目管理中为相关科目设置现金流量项目，以便更准确地归集现金流量</li>
              <li>• 正数表示现金流入，负数表示现金流出</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
