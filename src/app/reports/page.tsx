'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  FileText,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Percent
} from 'lucide-react';
import { BalanceSheet } from '@/components/reports/balance-sheet';
import { TrialBalance } from '@/components/reports/trial-balance';
import { IncomeStatement } from '@/components/reports/income-statement';
import { CashFlowStatement } from '@/components/reports/cash-flow-statement';

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">财务报表</h1>
          <p className="text-slate-600 mt-1">查询和导出各类财务报表</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline">2026年3月</Badge>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-600">数据已同步</span>
          </div>
        </div>
      </div>

      {/* 报表选择 */}
      <Tabs defaultValue="trial-balance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trial-balance" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>科目余额表</span>
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span>资产负债表</span>
          </TabsTrigger>
          <TabsTrigger value="income-statement" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>损益表</span>
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span>现金流量表</span>
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>自定义报表</span>
          </TabsTrigger>
        </TabsList>

        {/* 科目余额表 */}
        <TabsContent value="trial-balance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>科目余额表</CardTitle>
                  <CardDescription>
                    显示所有科目的期初余额、本期发生额和期末余额
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新数据
                  </Button>
                  <Button variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    打印报表
                  </Button>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    导出Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TrialBalance />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 资产负债表 */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>资产负债表</CardTitle>
                  <CardDescription>
                    反映企业在特定日期的财务状况
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新数据
                  </Button>
                  <Button variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    打印报表
                  </Button>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    导出PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <BalanceSheet />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 损益表 */}
        <TabsContent value="income-statement">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>损益表</CardTitle>
                  <CardDescription>
                    反映企业在一定期间的经营成果
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新数据
                  </Button>
                  <Button variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    打印报表
                  </Button>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    导出Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <IncomeStatement />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 现金流量表 */}
        <TabsContent value="cash-flow">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>现金流量表</CardTitle>
                  <CardDescription>
                    反映企业一定期间现金和现金等价物的流入和流出
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新数据
                  </Button>
                  <Button variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    打印报表
                  </Button>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    导出PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CashFlowStatement />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 自定义报表 */}
        <TabsContent value="custom">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">自定义资产负债表</CardTitle>
                <CardDescription>
                  选择特定科目和时间范围生成报表
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  创建自定义报表
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">自定义损益表</CardTitle>
                <CardDescription>
                  选择损益类科目生成定制报表
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  创建自定义报表
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">比较分析报表</CardTitle>
                <CardDescription>
                  对比不同期间的财务数据
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  创建对比报表
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}