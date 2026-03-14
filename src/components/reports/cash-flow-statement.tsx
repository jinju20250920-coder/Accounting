'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  Filter,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface CashFlowItem {
  code: string;
  name: string;
  amount: number;
  isPositive: boolean;
  parentCode?: string;
  children?: CashFlowItem[];
}

interface CashFlowData {
  operating: CashFlowItem[];
  investing: CashFlowItem[];
  financing: CashFlowItem[];
  beginningCash: number;
  netCashFromOperating: number;
  netCashFromInvesting: number;
  netCashFromFinancing: number;
  endingCash: number;
  cashFlowSummary: {
    operating: number;
    investing: number;
    financing: number;
    totalChange: number;
  };
}

export function CashFlowStatement() {
  const [date, setDate] = useState('2026-03-31');
  const [showDetails, setShowDetails] = useState(false);

  // 模拟现金流量表数据
  const cashFlowData: CashFlowData = useMemo(() => {
    const operatingItems: CashFlowItem[] = [
      {
        code: '1',
        name: '销售商品、提供劳务收到的现金',
        amount: 9500000,
        isPositive: true
      },
      {
        code: '2',
        name: '收到的税费返还',
        amount: 300000,
        isPositive: true
      },
      {
        code: '3',
        name: '收到其他与经营活动有关的现金',
        amount: 200000,
        isPositive: true
      },
      {
        code: '4',
        name: '购买商品、接受劳务支付的现金',
        amount: -6000000,
        isPositive: false
      },
      {
        code: '5',
        name: '支付给职工以及为职工支付的现金',
        amount: -1800000,
        isPositive: false
      },
      {
        code: '6',
        name: '支付的各项税费',
        amount: -850000,
        isPositive: false
      },
      {
        code: '7',
        name: '支付其他与经营活动有关的现金',
        amount: -400000,
        isPositive: false
      }
    ];

    const investingItems: CashFlowItem[] = [
      {
        code: '8',
        name: '收回投资收到的现金',
        amount: 500000,
        isPositive: true
      },
      {
        code: '9',
        name: '处置固定资产、无形资产和其他长期资产收回的现金净额',
        amount: 300000,
        isPositive: true
      },
      {
        code: '10',
        name: '购建固定资产、无形资产和其他长期资产支付的现金',
        amount: -1200000,
        isPositive: false
      },
      {
        code: '11',
        name: '投资支付的现金',
        amount: -800000,
        isPositive: false
      }
    ];

    const financingItems: CashFlowItem[] = [
      {
        code: '12',
        name: '吸收投资收到的现金',
        amount: 1000000,
        isPositive: true
      },
      {
        code: '13',
        name: '取得借款收到的现金',
        amount: 2000000,
        isPositive: true
      },
      {
        code: '14',
        name: '偿还债务支付的现金',
        amount: -1500000,
        isPositive: false
      },
      {
        code: '15',
        name: '分配股利、利润或偿付利息支付的现金',
        amount: -300000,
        isPositive: false
      }
    ];

    const netCashFromOperating = operatingItems.reduce((sum, item) => sum + item.amount, 0);
    const netCashFromInvesting = investingItems.reduce((sum, item) => sum + item.amount, 0);
    const netCashFromFinancing = financingItems.reduce((sum, item) => sum + item.amount, 0);
    const beginningCash = 2500000;
    const endingCash = beginningCash + netCashFromOperating + netCashFromInvesting + netCashFromFinancing;

    return {
      operating: operatingItems,
      investing: investingItems,
      financing: financingItems,
      beginningCash,
      netCashFromOperating,
      netCashFromInvesting,
      netCashFromFinancing,
      endingCash,
      cashFlowSummary: {
        operating: netCashFromOperating,
        investing: netCashFromInvesting,
        financing: netCashFromFinancing,
        totalChange: netCashFromOperating + netCashFromInvesting + netCashFromFinancing
      }
    };
  }, []);

  // 渲染现金流项目
  const renderCashFlowItem = (item: CashFlowItem, category: string) => {
    return (
      <div key={item.code} className="flex items-center justify-between p-3 border-b hover:bg-gray-50">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-mono text-sm w-16">{item.code}</span>
          <span className="flex-1">{item.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`text-right font-medium ${item.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {item.amount > 0 ? '+' : ''}¥{Math.abs(item.amount).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>
    );
  };

  // 格式化金额
  const formatMoney = (amount: number) => {
    return amount.toLocaleString('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0
    });
  };

  // 计算分类汇总
  const calculateCategoryTotal = (items: CashFlowItem[]) => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  // 现金流分析
  const cashFlowAnalysis = useMemo(() => {
    const total = cashFlowData.cashFlowSummary.totalChange;
    const operating = cashFlowData.cashFlowSummary.operating;
    const investing = cashFlowData.cashFlowSummary.investing;
    const financing = cashFlowData.cashFlowSummary.financing;

    return {
      isHealthy: total > 0 && operating > 0,
      trend: total > 0 ? 'positive' : 'negative',
      selfSufficiency: Math.abs(operating) / Math.abs(total) * 100,
      investmentRatio: Math.abs(investing) / Math.abs(operating) * 100,
      debtCoverage: financing > 0 ? 'good' : 'concern'
    };
  }, [cashFlowData]);

  return (
    <div className="space-y-6">
      {/* 报表标题和操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>现金流量表</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  期间: 2026年1月1日 - {date}
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant="default">现金流量</Badge>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                筛选
              </Button>
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                打印
              </Button>
              <Button size="sm">
                <Download className="h-4 w-4 mr-2" />
                导出PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 现金流量表主体 */}
      <div className="grid grid-cols-1 gap-6">
        {/* 经营活动现金流 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-700">
              <TrendingUp className="h-5 w-5" />
              经营活动产生的现金流量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {cashFlowData.operating.map(item => renderCashFlowItem(item, 'operating'))}
              <div className="flex items-center justify-between p-3 border-t-2 border-green-700 bg-green-50 mt-4">
                <span className="font-bold">经营活动现金流入小计</span>
                <span className="font-bold text-green-700">
                  +{formatMoney(cashFlowData.operating.filter(i => i.amount > 0).reduce((sum, i) => sum + i.amount, 0))}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border-t-2 border-red-700 bg-red-50">
                <span className="font-bold">经营活动现金流出小计</span>
                <span className="font-bold text-red-700">
                  {formatMoney(Math.abs(cashFlowData.operating.filter(i => i.amount < 0).reduce((sum, i) => sum + Math.abs(i.amount), 0)))}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border-t-2 border-gray-700 bg-gray-50 font-bold">
                <span>经营活动产生的现金流量净额</span>
                <span className={cashFlowData.netCashFromOperating > 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatMoney(cashFlowData.netCashFromOperating)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 投资活动现金流 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <ArrowRight className="h-5 w-5" />
              投资活动产生的现金流量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {cashFlowData.investing.map(item => renderCashFlowItem(item, 'investing'))}
              <div className="flex items-center justify-between p-3 border-t-2 border-gray-700 bg-gray-50 font-bold">
                <span>投资活动产生的现金流量净额</span>
                <span className={cashFlowData.netCashFromInvesting > 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatMoney(cashFlowData.netCashFromInvesting)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 筹资活动现金流 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <ArrowLeft className="h-5 w-5" />
              筹资活动产生的现金流量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {cashFlowData.financing.map(item => renderCashFlowItem(item, 'financing'))}
              <div className="flex items-center justify-between p-3 border-t-2 border-gray-700 bg-gray-50 font-bold">
                <span>筹资活动产生的现金流量净额</span>
                <span className={cashFlowData.netCashFromFinancing > 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatMoney(cashFlowData.netCashFromFinancing)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 现金流量汇总 */}
      <Card>
        <CardHeader>
          <CardTitle>现金流量汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded">
              <p className="text-sm text-muted-foreground">期初现金余额</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {formatMoney(cashFlowData.beginningCash)}
              </p>
            </div>
            <div className="text-center p-4 border rounded">
              <p className="text-sm text-muted-foreground">现金净增加额</p>
              <p className={`text-2xl font-bold mt-2 ${cashFlowData.cashFlowSummary.totalChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(cashFlowData.cashFlowSummary.totalChange)}
              </p>
            </div>
            <div className="text-center p-4 border rounded">
              <p className="text-sm text-muted-foreground">期末现金余额</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatMoney(cashFlowData.endingCash)}
              </p>
            </div>
            <div className="text-center p-4 border rounded">
              <p className="text-sm text-muted-foreground">现金变动率</p>
              <p className={`text-2xl font-bold mt-2 ${cashFlowData.cashFlowSummary.totalChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {((cashFlowData.cashFlowSummary.totalChange / cashFlowData.beginningCash) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 现金流分析 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              现金流分析
            </CardTitle>
            {cashFlowAnalysis.isHealthy ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium mb-3">经营能力</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">自给率</span>
                  <span className="font-medium text-green-600">
                    {cashFlowAnalysis.selfSufficiency.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">经营现金流</span>
                  <span className={cashFlowData.netCashFromOperating > 0 ? 'text-green-600' : 'text-red-600'}>
                    {cashFlowData.netCashFromOperating > 0 ? '正向' : '负向'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">投资状况</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">投资比例</span>
                  <span className="font-medium">
                    {cashFlowAnalysis.investmentRatio.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">投资现金流</span>
                  <span className={cashFlowData.netCashFromInvesting > 0 ? 'text-green-600' : 'text-red-600'}>
                    {cashFlowData.netCashFromInvesting > 0 ? '正向' : '负向'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">融资状况</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">偿债能力</span>
                  <Badge variant={cashFlowAnalysis.debtCoverage === 'good' ? 'default' : 'destructive'}>
                    {cashFlowAnalysis.debtCoverage === 'good' ? '良好' : '关注'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">融资现金流</span>
                  <span className={cashFlowData.netCashFromFinancing > 0 ? 'text-green-600' : 'text-red-600'}>
                    {cashFlowData.netCashFromFinancing > 0 ? '正向' : '负向'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 现金流预警 */}
      <Card className={cashFlowAnalysis.isHealthy ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              cashFlowAnalysis.isHealthy ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
            }`}>
              {cashFlowAnalysis.isHealthy ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </div>
            <div>
              <h4 className="font-medium mb-1">
                {cashFlowAnalysis.isHealthy ? '现金流状况良好' : '现金流需要关注'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {cashFlowAnalysis.isHealthy
                  ? '公司现金流状况健康，经营活动现金流为正，能够支持日常运营和投资活动。'
                  : '公司现金流出现负向变动，建议加强应收账款回收，控制现金支出。'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}