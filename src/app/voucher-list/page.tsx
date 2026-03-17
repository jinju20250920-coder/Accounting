'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Calendar,
  Printer,
  Download,
  Eye,
  Edit,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectOption as SelectOptionType } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { Voucher as VoucherType, VoucherEntry as VoucherEntryType } from '@/types';
import { toChineseAmount } from '@/lib/chinese-number';

// 状态配置
const statusConfig = {
  all: { label: '全部', color: 'bg-slate-100 text-slate-700' },
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-700' },
  review: { label: '审核中', color: 'bg-yellow-100 text-yellow-700' },
  posted: { label: '已记账', color: 'bg-green-100 text-green-700' },
  reversed: { label: '已冲销', color: 'bg-red-100 text-red-700' }
};

// 凭证类型配置
const typeConfig = {
  general: '记账凭证',
  receipt: '收款凭证',
  payment: '付款凭证',
  transfer: '转账凭证',
  closing: '结转凭证'
};

// 统计卡片组件
function StatsCard({ title, value, icon: Icon, color = 'blue', trend }: any) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    red: 'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50'
  };

  return (
    <Card className="border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
            {trend && (
              <p className={`text-sm mt-1 ${trend > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                {trend > 0 ? '+' : ''}{trend}% 较上月
              </p>
            )}
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 凭证明细组件
function VoucherDetail({ voucher, onClose, onEdit, onCopy, onPost, onReverse, currentAccountSet }: {
  voucher: VoucherType;
  onClose: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onPost: () => void;
  onReverse: () => void;
  currentAccountSet: any;
}) {
  const debitTotal = voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const creditTotal = voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const canEdit = voucher.status === 'draft' || voucher.status === 'review';
  const canPost = voucher.status === 'review';
  const canReverse = voucher.status === 'posted';

  // 打印凭证功能
  const handlePrintVoucher = () => {
    import('@/lib/print-utils').then(({ generateVoucherPrintHtml, executePrint }) => {
      const printHtml = generateVoucherPrintHtml(voucher, currentAccountSet?.name || '未知单位');
      executePrint(printHtml, `凭证打印 - ${voucher.voucherNo}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* 凭证头部信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-sm text-slate-500">凭证号</label>
          <p className="font-mono font-medium">{voucher.voucherNo}</p>
        </div>
        <div>
          <label className="text-sm text-slate-500">日期</label>
          <p className="font-medium">{voucher.date}</p>
        </div>
        <div>
          <label className="text-sm text-slate-500">类型</label>
          <p className="font-medium">{typeConfig[voucher.voucherType as keyof typeof typeConfig]}</p>
        </div>
        <div>
          <label className="text-sm text-slate-500">状态</label>
          <Badge className={statusConfig[voucher.status as keyof typeof statusConfig].color}>
            {statusConfig[voucher.status as keyof typeof statusConfig].label}
          </Badge>
        </div>
      </div>

      {voucher.summary && (
        <div>
          <label className="text-sm text-slate-500">摘要</label>
          <p className="font-medium">{voucher.summary}</p>
        </div>
      )}

      {/* 分录表格 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 border-b">摘要</th>
              <th className="text-left p-3 border-b">科目代码</th>
              <th className="text-left p-3 border-b">科目名称</th>
              <th className="text-right p-3 border-b">借方金额</th>
              <th className="text-right p-3 border-b">贷方金额</th>
            </tr>
          </thead>
          <tbody>
            {voucher.entries
              .filter(e => e.subjectCode || e.debit > 0 || e.credit > 0)
              .map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="p-3 border-b">{entry.summary || '-'}</td>
                  <td className="p-3 border-b font-mono">{entry.subjectCode || '-'}</td>
                  <td className="p-3 border-b">{entry.subjectName || '-'}</td>
                  <td className="p-3 border-b text-right font-mono">
                    {entry.debit > 0 ? entry.debit.toFixed(2) : ''}
                  </td>
                  <td className="p-3 border-b text-right font-mono">
                    {entry.credit > 0 ? entry.credit.toFixed(2) : ''}
                  </td>
                </tr>
              ))}
            {/* 合计行 */}
            <tr className="bg-slate-50 font-medium">
              <td className="p-3" colSpan={3}>合计</td>
              <td className="p-3 text-right font-mono text-blue-600">{debitTotal.toFixed(2)}</td>
              <td className="p-3 text-right font-mono text-blue-600">{creditTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 创建信息 */}
      <div className="flex justify-between text-sm text-slate-500">
        <span>创建人: {voucher.createdBy}</span>
        <span>创建时间: {new Date(voucher.createdAt).toLocaleString('zh-CN')}</span>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={handlePrintVoucher}>
          <Printer className="w-4 h-4 mr-2" />
          打印凭证
        </Button>
        {canEdit && (
          <Button variant="outline" onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            编辑
          </Button>
        )}
        <Button variant="outline" onClick={onCopy}>
          <Copy className="w-4 h-4 mr-2" />
          复制
        </Button>
        {canPost && (
          <Button className="bg-green-600 hover:bg-green-700" onClick={onPost}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            记账
          </Button>
        )}
        {canReverse && (
          <Button variant="destructive" onClick={onReverse}>
            <RotateCcw className="w-4 h-4 mr-2" />
            冲销
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
      </div>
    </div>
  );
}

// 将数字转换为中文大写金额
export default function VoucherListPage() {
  const router = useRouter();
  const { vouchers, loadVoucher, copyVoucher, deleteVoucher } = useVoucherStore();
  const { getCurrentAccountSet } = useAccountSetStore();
  const { showToast } = useToast();
  const currentAccountSet = getCurrentAccountSet();

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // 格式：YYYY-MM
  const [sortField, setSortField] = useState<'date' | 'voucherNo'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 批量选择
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<Set<string>>(new Set());

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 对话框状态
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherType | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<VoucherType | null>(null);

  // 筛选和排序凭证
  const filteredVouchers = vouchers
    .filter(v => {
      const matchesSearch = !searchQuery ||
        v.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.summary && v.summary.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = selectedStatus === 'all' || v.status === selectedStatus;
      const matchesType = selectedType === 'all' || v.voucherType === selectedType;
      // 月份筛选：YYYY-MM 格式匹配
      const matchesMonth = !selectedMonth || v.date.slice(0, 7) === selectedMonth;

      return matchesSearch && matchesStatus && matchesType && matchesMonth;
    })
    .sort((a, b) => {
      const aVal = sortField === 'date' ? a.date : a.voucherNo;
      const bVal = sortField === 'date' ? b.date : b.voucherNo;
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

  // 获取要打印的凭证
  const vouchersToPrint = filteredVouchers.filter(v => selectedVoucherIds.has(v.id));

  // 分页数据
  const totalPages = Math.ceil(filteredVouchers.length / pageSize);
  const paginatedVouchers = filteredVouchers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 统计数据
  const stats = {
    total: vouchers.length,
    draft: vouchers.filter(v => v.status === 'draft').length,
    review: vouchers.filter(v => v.status === 'review').length,
    posted: vouchers.filter(v => v.status === 'posted').length
  };

  // 批量选择处理
  const toggleSelectAll = () => {
    if (selectedVoucherIds.size === paginatedVouchers.length) {
      setSelectedVoucherIds(new Set());
    } else {
      setSelectedVoucherIds(new Set(paginatedVouchers.map(v => v.id)));
    }
  };

  const toggleSelectVoucher = (id: string) => {
    const newSelected = new Set(selectedVoucherIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedVoucherIds(newSelected);
  };

  const handleBatchPrint = () => {
    import('@/lib/print-utils').then(({ generateBatchPrintHtml, executePrint }) => {
      const vouchersToPrintFinal = vouchersToPrint.length > 0 ? vouchersToPrint : paginatedVouchers;
      const printHtml = generateBatchPrintHtml(vouchersToPrintFinal, currentAccountSet?.name || '未知单位');
      executePrint(printHtml, '批量凭证打印');
    });
  };

  // 操作处理
  const handleView = (voucher: VoucherType) => {
    setSelectedVoucher(voucher);
    setShowDetailDialog(true);
  };

  const handleEdit = (voucher: VoucherType) => {
    loadVoucher(voucher.id);
    router.push('/voucher-entry-page');
  };

  const handleCopy = (voucher: VoucherType) => {
    copyVoucher(voucher.id);
    setShowDetailDialog(false);
    router.push('/voucher-entry-page');
  };

  const handleDelete = (voucher: VoucherType) => {
    if (voucher.status === 'posted' || voucher.status === 'reversed') {
      showToast('warning', '已记账或已冲销的凭证不能删除');
      return;
    }
    setShowDeleteDialog(voucher);
  };

  const confirmDelete = () => {
    if (showDeleteDialog) {
      deleteVoucher(showDeleteDialog.id);
      setShowDeleteDialog(null);
    }
  };

  const handlePost = (voucher: VoucherType) => {
    // 记账逻辑
    showToast('info', '记账功能需要调用完整的会计引擎');
  };

  const handleReverse = (voucher: VoucherType) => {
    // 冲销逻辑
    showToast('info', '冲销功能需要调用完整的会计引擎');
  };

  const handleExport = () => {
    // 导出为CSV
    const headers = ['凭证号', '日期', '摘要', '状态', '类型', '借方合计', '贷方合计'];
    const rows = filteredVouchers.map(v => {
      const debitTotal = v.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
      const creditTotal = v.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
      return [
        v.voucherNo,
        v.date,
        v.summary || '',
        statusConfig[v.status as keyof typeof statusConfig].label,
        typeConfig[v.voucherType as keyof typeof typeConfig],
        debitTotal.toFixed(2),
        creditTotal.toFixed(2)
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `凭证列表_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (field: 'date' | 'voucherNo') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* 页面标题 */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">凭证管理</h1>
          <p className="text-slate-500 mt-1">查看和管理所有凭证记录</p>
        </div>
        <div className="flex gap-2">
          {selectedVoucherIds.size > 0 && (
            <Button
              style={{ backgroundColor: '#1967D2' }}
              className="hover:bg-[#1557B0]"
              onClick={handleBatchPrint}
            >
              <Printer className="w-4 h-4 mr-2" />
              批量打印 ({selectedVoucherIds.size})
            </Button>
          )}
          <Button
            style={{ backgroundColor: '#1967D2' }}
            className="hover:bg-[#1557B0]"
            onClick={() => router.push('/voucher-entry-page')}
          >
            <Plus className="w-4 h-4 mr-2" />
            新增凭证
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <StatsCard
          title="全部凭证"
          value={stats.total}
          icon={FileText}
          color="blue"
        />
        <StatsCard
          title="草稿"
          value={stats.draft}
          icon={FileText}
          color="slate"
        />
        <StatsCard
          title="审核中"
          value={stats.review}
          icon={FileText}
          color="yellow"
        />
        <StatsCard
          title="已记账"
          value={stats.posted}
          icon={CheckCircle2}
          color="green"
        />
      </div>

      {/* 筛选栏 */}
      <Card className="border-slate-200 no-print">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                <Input
                  placeholder="搜索凭证号或摘要"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'draft', label: '草稿' },
                  { value: 'review', label: '审核中' },
                  { value: 'posted', label: '已记账' },
                  { value: 'reversed', label: '已冲销' }
                ]}
              />
            </div>
            <div>
              <Select
                value={selectedType}
                onChange={setSelectedType}
                options={[
                  { value: 'all', label: '全部类型' },
                  { value: 'general', label: '记账凭证' },
                  { value: 'receipt', label: '收款凭证' },
                  { value: 'payment', label: '付款凭证' },
                  { value: 'transfer', label: '转账凭证' },
                  { value: 'closing', label: '结转凭证' }
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <Input
                type="month"
                placeholder="选择月份"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 凭证列表 */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {filteredVouchers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium mb-2">暂无凭证记录</p>
              <p className="text-sm">点击"新增凭证"开始创建第一张凭证</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 border-b w-12 no-print">
                        <button
                          onClick={toggleSelectAll}
                          className="hover:text-blue-600"
                        >
                          {selectedVoucherIds.size === paginatedVouchers.length && paginatedVouchers.length > 0 ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left p-3 border-b">
                        <button
                          className="flex items-center gap-1 hover:text-blue-600"
                          onClick={() => toggleSort('voucherNo')}
                        >
                          凭证号
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 border-b">
                        <button
                          className="flex items-center gap-1 hover:text-blue-600"
                          onClick={() => toggleSort('date')}
                        >
                          日期
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left p-3 border-b">摘要</th>
                      <th className="text-left p-3 border-b">类型</th>
                      <th className="text-left p-3 border-b">状态</th>
                      <th className="text-right p-3 border-b">借方合计</th>
                      <th className="text-right p-3 border-b">贷方合计</th>
                      <th className="text-center p-3 border-b no-print">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVouchers.map((voucher) => {
                      const debitTotal = voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                      const creditTotal = voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0);

                      return (
                        <React.Fragment key={voucher.id}>
                          {/* 凭证信息行 */}
                          <tr className="bg-slate-50 font-medium">
                            <td className="p-3 border-b no-print">
                              <button
                                onClick={() => toggleSelectVoucher(voucher.id)}
                                className="hover:text-blue-600"
                              >
                                {selectedVoucherIds.has(voucher.id) ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="p-3 border-b font-mono text-blue-600">
                              <button
                                className="hover:underline"
                                onClick={() => handleView(voucher)}
                              >
                                {voucher.voucherNo}
                              </button>
                            </td>
                            <td className="p-3 border-b">{voucher.date}</td>
                            <td className="p-3 border-b truncate max-w-xs">{voucher.summary || '-'}</td>
                            <td className="p-3 border-b">
                              {typeConfig[voucher.voucherType as keyof typeof typeConfig]}
                            </td>
                            <td className="p-3 border-b">
                              <Badge className={statusConfig[voucher.status as keyof typeof statusConfig].color}>
                                {statusConfig[voucher.status as keyof typeof statusConfig].label}
                              </Badge>
                            </td>
                            <td className="p-3 border-b text-right font-mono">
                              {debitTotal.toFixed(2)}
                            </td>
                            <td className="p-3 border-b text-right font-mono">
                              {creditTotal.toFixed(2)}
                            </td>
                            <td className="p-3 border-b text-center no-print">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleView(voucher)}
                                  title="查看"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {(voucher.status === 'draft' || voucher.status === 'review') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(voucher)}
                                    title="编辑"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(voucher)}
                                  title="复制"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                {(voucher.status === 'draft' || voucher.status === 'review') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(voucher)}
                                    title="删除"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* 凭证明细行 */}
                          {voucher.entries
                            .filter(e => e.subjectCode || e.debit > 0 || e.credit > 0)
                            .map((entry) => (
                              <tr key={`${voucher.id}_${entry.id}`} className="hover:bg-slate-100">
                                <td className="p-3 border-b no-print"></td>
                                <td className="p-3 border-b pl-6" colSpan={2}>{entry.summary || '-'}</td>
                                <td className="p-3 border-b font-mono">{entry.subjectCode || '-'}</td>
                                <td className="p-3 border-b">{entry.subjectName || '-'}</td>
                                <td className="p-3 border-b"></td>
                                <td className="p-3 border-b text-right font-mono">
                                  {entry.debit > 0 ? entry.debit.toFixed(2) : ''}
                                </td>
                                <td className="p-3 border-b text-right font-mono">
                                  {entry.credit > 0 ? entry.credit.toFixed(2) : ''}
                                </td>
                                <td className="p-3 border-b no-print"></td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t no-print">
                  <div className="text-sm text-slate-500">
                    共 {filteredVouchers.length} 条记录，第 {currentPage} / {totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5) {
                        if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === currentPage ? 'default' : 'outline'}
                          size="sm"
                          className={pageNum === currentPage ? 'bg-blue-600' : ''}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 凭证明细对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>凭证详情</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto pr-2">
            {selectedVoucher && (
              <VoucherDetail
                voucher={selectedVoucher}
                onClose={() => setShowDetailDialog(false)}
                onEdit={() => handleEdit(selectedVoucher)}
                onCopy={() => handleCopy(selectedVoucher)}
                onPost={() => handlePost(selectedVoucher)}
                onReverse={() => handleReverse(selectedVoucher)}
                currentAccountSet={currentAccountSet}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!showDeleteDialog} onOpenChange={(open) => !open && setShowDeleteDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除凭证 <span className="font-mono font-medium">{showDeleteDialog?.voucherNo}</span> 吗？
              <br />此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}
