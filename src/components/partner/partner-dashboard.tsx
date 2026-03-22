'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, Filter, ArrowRight, Building, Building2, User, Users, Factory, UserCheck } from 'lucide-react';
import { usePartnerStore } from '@/stores';
import { useAccountStore } from '@/stores/useAccountStore';
import { useVoucherStore } from '@/stores';
import { useClearingStore } from '@/stores/useClearingStore';
import type { Partner } from '@/types';
import { PartnerDetail } from './partner-detail';
import { formatMoney } from '@/lib/accounting';

export function PartnerDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview');
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [partnerTab, setPartnerTab] = useState<'all' | 'supplier' | 'customer' | 'employee'>('all');

  const { partners } = usePartnerStore();
  const { getPartnerBalance, getPartnerMonthlyAmount, getPartnerMonthlyClearing } = useAccountStore();
  const clearingStore = useClearingStore();

  const [summaryData, setSummaryData] = useState({
    totalPartners: 0,
    totalOutstanding: 0,
    totalRecAmount: 0,
    overdueCount: 0
  });

  // 确保 clearingStore 被初始化
  useEffect(() => {
    clearingStore.ensureInitialized();
  }, []);

  useEffect(() => {
    const loadSummaryData = async () => {
      const totalPartners = partners.length;
      let totalOutstanding = 0;
      let totalRecAmount = 0;
      let overdueCount = 0;

      const currentYearMonth = new Date().toISOString().slice(0, 7);

      for (const partner of partners) {
        const balance = getPartnerBalance(partner.name);
        totalOutstanding += balance;

        // 累加本月核销金额（取绝对值，因为可能是正数或负数）
        const monthlyClearing = getPartnerMonthlyClearing(partner.name, currentYearMonth);
        totalRecAmount += Math.abs(monthlyClearing);

        if (balance > 0) {
          overdueCount++;
        }
      }

      setSummaryData({
        totalPartners,
        totalOutstanding,
        totalRecAmount,
        overdueCount
      });
    };

    loadSummaryData();
  }, [partners, getPartnerBalance]); // 移除函数引用，只保留数据依赖

  // 根据tab和搜索条件过滤往来单位
  const filteredPartners = partners.filter(partner => {
    // 类型过滤
    const typeMatch = partnerTab === 'all' ||
      (partnerTab === 'customer' && partner.isCustomer) ||
      (partnerTab === 'supplier' && partner.isSupplier) ||
      (partnerTab === 'employee' && partner.isEmployee);

    // 搜索过滤
    const searchMatch = partner.name.toLowerCase().includes(searchText.toLowerCase()) ||
      partner.code.toLowerCase().includes(searchText.toLowerCase());

    return typeMatch && searchMatch;
  });

  // 获取往来单位类型的标签
  const getPartnerTypeLabel = (partner: Partner): string => {
    const types: string[] = [];
    if (partner.isCustomer) types.push('客户');
    if (partner.isSupplier) types.push('供应商');
    if (partner.isEmployee) types.push('雇员');
    return types.length > 0 ? types.join('/') : '其他';
  };

  // 获取往来单位类型的徽章样式
  const getPartnerTypeBadgeClass = (partner: Partner): string => {
    const hasMultiple = [partner.isCustomer, partner.isSupplier, partner.isEmployee].filter(Boolean).length > 1;

    if (hasMultiple) {
      return 'bg-purple-100 text-purple-800';
    } else if (partner.isCustomer) {
      return 'bg-blue-100 text-blue-800';
    } else if (partner.isSupplier) {
      return 'bg-red-100 text-red-800';
    } else if (partner.isEmployee) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">往来单位管理</h1>
          <p className="text-slate-600 mt-1">客户与供应商往来账款分析与管理</p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Download className="w-4 h-4 mr-2" />
            导出报表
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">总往来单位</CardTitle>
            <Building className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summaryData.totalPartners}</div>
            <p className="text-xs text-green-600 mt-1">+12% 较上月</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">未结余额</CardTitle>
            <Building2 className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatMoney(summaryData.totalOutstanding)}
            </div>
            <p className="text-xs text-red-600 mt-1">-8.5% 较上月</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">本月核销</CardTitle>
            <User className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatMoney(summaryData.totalRecAmount)}
            </div>
            <p className="text-xs text-green-600 mt-1">+23% 较上月</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">有余额单位</CardTitle>
            <Building className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summaryData.overdueCount}</div>
            <p className="text-xs text-yellow-600 mt-1">+3 较上月</p>
          </CardContent>
        </Card>
      </div>

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
          {/* 类型筛选tab */}
          <div className="mb-4">
            <Tabs value={partnerTab} onValueChange={(value: 'all' | 'supplier' | 'customer' | 'employee') => setPartnerTab(value)}>
              <TabsList className="grid w-full grid-cols-4 max-w-md">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  所有
                </TabsTrigger>
                <TabsTrigger value="customer" className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  客户
                </TabsTrigger>
                <TabsTrigger value="supplier" className="flex items-center gap-2">
                  <Factory className="w-4 h-4" />
                  供应商
                </TabsTrigger>
                <TabsTrigger value="employee" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  雇员
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100">
                <th className="p-2 text-left text-sm font-medium border-r border-slate-300">往来单位</th>
                <th className="p-2 text-left text-sm font-medium border-r border-slate-300">类型</th>
                <th className="p-2 text-right text-sm font-medium border-r border-slate-300">未结余额</th>
                <th className="p-2 text-right text-sm font-medium border-r border-slate-300">本月发生</th>
                <th className="p-2 text-right text-sm font-medium border-r border-slate-300">本月核销</th>
                <th className="p-2 text-right text-sm font-medium border-r border-slate-300">余额</th>
                <th className="p-2 text-center text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.map((partner) => (
                <tr
                  key={partner.id}
                  className={selectedPartner === partner.id ? 'bg-blue-50' : 'hover:bg-slate-50'}
                >
                  <td className="p-2 border-r border-slate-300 font-medium">{partner.name}</td>
                  <td className="p-2 border-r border-slate-300">
                    <span className={`px-2 py-1 rounded-full text-xs ${getPartnerTypeBadgeClass(partner)}`}>
                      {getPartnerTypeLabel(partner)}
                    </span>
                  </td>
                  <td className="p-2 text-right border-r border-slate-300">
                    {formatMoney(getPartnerBalance(partner.name))}
                  </td>
                  <td className="p-2 text-right border-r border-slate-300">
                    {formatMoney(getPartnerMonthlyAmount(partner.name, new Date().toISOString().slice(0, 7)))}
                  </td>
                  <td className="p-2 text-right border-r border-slate-300">
                    {formatMoney(getPartnerMonthlyClearing(partner.name, new Date().toISOString().slice(0, 7)))}
                  </td>
                  <td className="p-2 text-right border-r border-slate-300">
                    {formatMoney(getPartnerBalance(partner.name))}
                  </td>
                  <td className="p-2 text-center border-r border-slate-300">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedPartner && activeTab === 'detail' && (
        <PartnerDetail
          partner={partners.find(p => p.id === selectedPartner)!}
          onBack={() => setActiveTab('overview')}
        />
      )}
    </div>
  );
}
