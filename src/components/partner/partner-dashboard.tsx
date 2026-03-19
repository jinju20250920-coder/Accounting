'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Filter, ArrowRight, Building, Building2, User } from 'lucide-react';
import { usePartnerStore } from '@/stores';
import { useAccountStore } from '@/stores/useAccountStore';
import { useVoucherStore } from '@/stores';

export function PartnerDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview');
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const { partners } = usePartnerStore();
  const { getPartnerBalance } = useAccountStore();

  const [summaryData, setSummaryData] = useState({
    totalPartners: 0,
    totalOutstanding: 0,
    totalRecAmount: 0,
    overdueCount: 0
  });

  useEffect(() => {
    const loadSummaryData = async () => {
      const totalPartners = partners.length;
      let totalOutstanding = 0;
      let overdueCount = 0;

      for (const partner of partners) {
        const balance = getPartnerBalance(partner.name);
        totalOutstanding += balance;

        if (balance > 0) {
          overdueCount++;
        }
      }

      setSummaryData({
        totalPartners,
        totalOutstanding,
        totalRecAmount: 0,
        overdueCount
      });
    };

    loadSummaryData();
  }, [partners, getPartnerBalance]);

  const filteredPartners = partners.filter(partner =>
    partner.name.toLowerCase().includes(searchText.toLowerCase()) ||
    partner.code.toLowerCase().includes(searchText.toLowerCase())
  );

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
              {summaryData.totalOutstanding.toFixed(2)}
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
              {summaryData.totalRecAmount.toFixed(2)}
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
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      partner.isCustomer && partner.isSupplier
                        ? 'bg-purple-100 text-purple-800'
                        : partner.isCustomer
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {partner.isCustomer && partner.isSupplier
                        ? '客户/供应商'
                        : partner.isCustomer
                          ? '客户'
                          : '供应商'}
                    </span>
                  </td>
                  <td className="p-2 text-right border-r border-slate-300">
                    {getPartnerBalance(partner.name).toFixed(2)}
                  </td>
                  <td className="p-2 text-right border-r border-slate-300">0.00</td>
                  <td className="p-2 text-right border-r border-slate-300">0.00</td>
                  <td className="p-2 text-right border-r border-slate-300">
                    {getPartnerBalance(partner.name).toFixed(2)}
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
        <Card>
          <CardHeader>
            <CardTitle>
              往来单位明细 - {partners.find(p => p.id === selectedPartner)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500">
              往来单位明细功能开发中...
            </div>
          </CardContent>
          <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
            <Button variant="outline" onClick={() => setActiveTab('overview')}>
              返回
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
