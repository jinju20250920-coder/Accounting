'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowLeft, Filter, Download, CheckCircle, XCircle } from 'lucide-react';
import { useVoucherStore } from '@/stores';
import type { Partner } from '@/types';
import { useClearingStore } from '@/stores/useClearingStore';
import { useAccountStore } from '@/stores/useAccountStore';

interface PartnerDetailProps {
  partner: Partner;
  onBack: () => void;
}

export function PartnerDetail({ partner, onBack }: PartnerDetailProps) {
  const { vouchers, currentEntries } = useVoucherStore();
  const { getClearingItems, ensureInitialized } = useClearingStore();
  const { getPartnerBalance } = useAccountStore();
  const [searchText, setSearchText] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化数据
  useEffect(() => {
    const init = async () => {
      await ensureInitialized();
    };
    init();
  }, [ensureInitialized]);

  // 加载交易数据
  useEffect(() => {
    const loadTransactions = () => {
      setLoading(true);

      const allEntries: any[] = [];

      // 添加已记账凭证的分录
      vouchers.forEach(voucher => {
        if (voucher.status === 'posted' || voucher.status === 'review' || voucher.status === 'draft') {
          voucher.entries.forEach(entry => {
            const isPartnerEntry =
              entry.customerName === partner.name ||
              entry.supplierName === partner.name ||
              entry.auxiliary?.customer === partner.name ||
              entry.auxiliary?.supplier === partner.name;

            if (isPartnerEntry) {
              allEntries.push({
                ...entry,
                voucherNo: voucher.voucherNo,
                voucherDate: voucher.date,
                status: voucher.status,
                isPosted: voucher.status === 'posted'
              });
            }
          });
        }
      });

      // 添加当前凭证的分录
      currentEntries.forEach(entry => {
        const isPartnerEntry =
          entry.customerName === partner.name ||
          entry.supplierName === partner.name ||
          entry.auxiliary?.customer === partner.name ||
          entry.auxiliary?.supplier === partner.name;

        if (isPartnerEntry) {
          allEntries.push({
            ...entry,
            voucherNo: '当前凭证',
            voucherDate: new Date().toISOString().split('T')[0],
            status: 'draft',
            isPosted: false
          });
        }
      });

      // 计算每个交易的已核销金额
      const transactionsWithRec = allEntries.map(entry => {
        const clearingItems = getClearingItems(entry.id);
        const recAmount = clearingItems.reduce((sum, item) => sum + item.amount, 0);
        const totalAmount = entry.debit > 0 ? entry.debit : entry.credit;
        const remainingAmount = totalAmount - recAmount;

        return {
          ...entry,
          recAmount,
          remainingAmount,
          isCleared: recAmount > 0
        };
      });

      setTransactions(transactionsWithRec);
      setLoading(false);
    };

    if (useClearingStore.getState().isInitialized) {
      loadTransactions();
    }
  }, [vouchers, currentEntries, partner.name, getClearingItems, ensureInitialized]);

  // 搜索过滤
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch =
      transaction.summary.toLowerCase().includes(searchText.toLowerCase()) ||
      transaction.docNo?.toLowerCase().includes(searchText.toLowerCase()) ||
      transaction.voucherNo?.includes(searchText);

    const matchesTimeRange = true; // 暂时不限制时间范围

    return matchesSearch && matchesTimeRange;
  });

  // 计算统计数据
  const statistics = filteredTransactions.reduce((stats, tx) => {
    if (tx.debit > 0) {
      stats.debitTotal += tx.debit;
      stats.debitCleared += tx.recAmount;
      stats.debitRemaining += tx.remainingAmount;
    } else if (tx.credit > 0) {
      stats.creditTotal += tx.credit;
      stats.creditCleared += tx.recAmount;
      stats.creditRemaining += tx.remainingAmount;
    }

    if (tx.isCleared) {
      stats.clearedCount++;
    } else if (tx.remainingAmount > 0.001) {
      stats.outstandingCount++;
    }

    return stats;
  }, {
    debitTotal: 0,
    debitCleared: 0,
    debitRemaining: 0,
    creditTotal: 0,
    creditCleared: 0,
    creditRemaining: 0,
    clearedCount: 0,
    outstandingCount: 0
  });

  const netBalance = statistics.debitRemaining - statistics.creditRemaining;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载交易数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 导航栏 */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">往来单位明细 - {partner.name}</h1>
        <Badge variant="outline" className="ml-2">
          {partner.isCustomer ? '客户' : '供应商'}
        </Badge>
        {partner.isCustomer && partner.isSupplier && (
          <Badge variant="secondary">客户/供应商</Badge>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">借方总额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statistics.debitTotal.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              已核销: {statistics.debitCleared.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              剩余: {statistics.debitRemaining.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">贷方总额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statistics.creditTotal.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              已核销: {statistics.creditCleared.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              剩余: {statistics.creditRemaining.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">净额余额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              netBalance > 0 ? 'text-blue-600' :
              netBalance < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {netBalance.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {netBalance > 0 ? '借方余额' : netBalance < 0 ? '贷方余额' : '余额为零'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">交易统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {transactions.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              已核销: {statistics.clearedCount}
            </p>
            <p className="text-xs text-gray-500">
              未结: {statistics.outstandingCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索摘要、单据号..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部时间</option>
              <option value="week">近一周</option>
              <option value="month">近一月</option>
              <option value="quarter">近三月</option>
              <option value="year">近一年</option>
            </select>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-1" />
              高级筛选
            </Button>
            <Button>
              <Download className="w-4 h-4 mr-1" />
              导出
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 交易列表 */}
      <Card>
        <CardHeader>
          <CardTitle>交易明细</CardTitle>
          <CardDescription>
            显示该往来单位的所有交易记录（含已核销和未结）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  <th className="w-12 p-2 text-center text-sm font-medium border-r border-slate-300">状态</th>
                  <th className="p-2 text-left text-sm font-medium border-r border-slate-300">日期</th>
                  <th className="p-2 text-left text-sm font-medium border-r border-slate-300">凭证号</th>
                  <th className="p-2 text-left text-sm font-medium border-r border-slate-300">摘要</th>
                  <th className="p-2 text-left text-sm font-medium border-r border-slate-300">业务单据号</th>
                  <th className="p-2 text-right text-sm font-medium border-r border-slate-300">借方金额</th>
                  <th className="p-2 text-right text-sm font-medium border-r border-slate-300">贷方金额</th>
                  <th className="p-2 text-center text-sm font-medium border-r border-slate-300">币别</th>
                  <th className="p-2 text-right text-sm font-medium border-r border-slate-300">原币金额</th>
                  <th className="p-2 text-right text-sm font-medium border-r border-slate-300">汇率</th>
                  <th className="p-2 text-right text-sm font-medium border-r border-slate-300">已核销金额</th>
                  <th className="p-2 text-right text-sm font-medium border-r border-slate-300">剩余金额</th>
                  <th className="p-2 text-center text-sm font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-8 text-gray-500">
                      没有找到相关交易记录
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className={transaction.isCleared ? 'opacity-60 bg-gray-50' : ''}
                    >
                      <td className="p-2 text-center border-r border-slate-300">
                        {transaction.isCleared ? (
                          <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400 mx-auto" />
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-300">{transaction.voucherDate}</td>
                      <td className="p-2 border-r border-slate-300 font-mono text-sm">
                        {transaction.voucherNo}
                      </td>
                      <td className="p-2 border-r border-slate-300 max-w-xs truncate" title={transaction.summary}>
                        {transaction.summary}
                      </td>
                      <td className="p-2 border-r border-slate-300 font-mono text-sm">
                        {transaction.docNo || '-'}
                      </td>
                      <td className="p-2 text-right text-blue-600 font-mono border-r border-slate-300">
                        {transaction.debit > 0 ? transaction.debit.toFixed(2) : '-'}
                      </td>
                      <td className="p-2 text-right text-red-600 font-mono border-r border-slate-300">
                        {transaction.credit > 0 ? transaction.credit.toFixed(2) : '-'}
                      </td>
                      <td className="p-2 text-center text-xs font-medium border-r border-slate-300">
                        {transaction.currencyCode && transaction.currencyCode !== 'CNY' && transaction.currencyCode !== 'RMB'
                          ? <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px]">{transaction.currencyCode}</Badge>
                          : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="p-2 text-right font-mono text-xs border-r border-slate-300 text-slate-600">
                        {transaction.originalAmount && transaction.currencyCode && transaction.currencyCode !== 'CNY' && transaction.currencyCode !== 'RMB'
                          ? transaction.originalAmount.toFixed(2)
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="p-2 text-right font-mono text-xs border-r border-slate-300 text-slate-600">
                        {transaction.exchangeRate && transaction.currencyCode && transaction.currencyCode !== 'CNY' && transaction.currencyCode !== 'RMB'
                          ? transaction.exchangeRate
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="p-2 text-right text-green-600 font-mono border-r border-slate-300">
                        {transaction.recAmount > 0 ? transaction.recAmount.toFixed(2) : '-'}
                      </td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">
                        {transaction.remainingAmount > 0 ? transaction.remainingAmount.toFixed(2) : '-'}
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => console.log('查看详情', transaction.id)}
                        >
                          详情
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
