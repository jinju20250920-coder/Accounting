'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  RotateCcw,
  FileText,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square,
  RefreshCw,
  LayoutList,
  Table2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { Voucher as VoucherType } from '@/types';
import { formatMoney, calculateVoucherStatus, createReverseVoucher, VoucherStatus } from '@/lib/accounting';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { DatabaseManager } from '@/components/DatabaseManager';
import { getCurrentService } from '@/lib/database';
import { assertAccountingDateEditable } from '@/lib/period-closing';
import { ReverseVoucherDialog } from '@/components/voucher/reverse-voucher-dialog';


// 状态配置
const statusConfig = {
  all: { label: '全部', color: 'bg-slate-100 text-slate-700' },
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-700' },
  review: { label: '审核中', color: 'bg-yellow-100 text-yellow-700' },
  posted: { label: '已记账', color: 'bg-green-100 text-green-700' },
  reversed: { label: '已冲销', color: 'bg-red-100 text-red-700' },
  posted_reversed: { label: '已记账/已冲销', color: 'bg-blue-100 text-blue-700' }
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
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  trend?: number;
}

function StatsCard({ title, value, icon: Icon, color = 'blue', trend }: StatsCardProps) {
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
interface VoucherDetailProps {
  voucher: VoucherType;
  onClose: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onPost: () => void;
  onReverse: () => void;
  currentAccountSet: { name?: string } | null;
}

function VoucherDetail({ voucher, onClose, onEdit, onCopy, onPost, onReverse, currentAccountSet }: VoucherDetailProps) {
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
              <th className="text-left p-3 border-b">往来/辅助</th>
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
                  <td className="p-3 border-b text-xs text-slate-500">
                    {entry.auxiliary?.customer || entry.auxiliary?.supplier || entry.customerName || entry.supplierName || ''}
                  </td>
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
        <span>创建时间: {new Date(voucher.createTime).toLocaleString('zh-CN')}</span>
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
  // 使用 selector 订阅 vouchers 状态，确保数据更新时页面重新渲染
  const vouchers = useVoucherStore(state => state.vouchers);
  const { loadVoucher, copyVoucher, deleteVoucher } = useVoucherStore();
  const { getCurrentAccountSet } = useAccountSetStore();
  const { showToast } = useToast();
  const currentAccountSet = getCurrentAccountSet();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gl'>('list');
  const handleViewModeChange = (mode: 'list' | 'gl') => {
    setViewMode(mode);
    setCurrentPage(1);
  };

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'subject'>('all'); // 搜索模式：全部或科目
  // 从 URL 参数获取初始状态，如果URL有status参数则使用该参数
  // 默认显示已记账/已冲销状态
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('status') || 'posted_reversed';
    }
    return 'posted_reversed';
  });
  // 默认显示当前系统月份的凭证
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const [startMonth, setStartMonth] = useState<string>(currentMonth);
  const [endMonth, setEndMonth] = useState<string>(currentMonth);
  const [sortField, setSortField] = useState<'date' | 'voucherNo'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 确保开始月份不晚于结束月份
  const handleStartMonthChange = (value: string) => {
    setStartMonth(value);
    if (value && endMonth && value > endMonth) {
      setEndMonth(value);
    }
  };

  // 监听 URL 参数变化，自动切换筛选状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get('status');
      if (statusParam && statusParam !== selectedStatus) {
        setSelectedStatus(statusParam);
        // 清除 URL 参数，避免影响后续操作
        window.history.replaceState({}, '', '/voucher-list');
      }
    }
  }, [selectedStatus]);

  useEffect(() => {
    void useVoucherStore.getState().initialize();
  }, []);

  const handleEndMonthChange = (value: string) => {
    setEndMonth(value);
    if (value && startMonth && value < startMonth) {
      setStartMonth(value);
    }
  };

  // 批量选择
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<Set<string>>(new Set());

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 对话框状态
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherType | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<VoucherType | null>(null);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<VoucherType | null>(null);

  // 筛选和排序凭证
  const filteredVouchers = vouchers
    .filter(v => {
      let matchesSearch = true;

      if (searchQuery) {
        if (searchMode === 'all') {
          // 全模式搜索：凭证号、摘要、科目代码或科目名称
          matchesSearch =
            v.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.summary && v.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
            v.entries.some(entry =>
              (entry.subjectCode && entry.subjectCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (entry.subjectName && entry.subjectName.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        } else {
          // 科目模式搜索：仅搜索科目代码或科目名称
          matchesSearch = v.entries.some(entry =>
            (entry.subjectCode && entry.subjectCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (entry.subjectName && entry.subjectName.toLowerCase().includes(searchQuery.toLowerCase()))
          );
        }
      }

      // 状态筛选：支持 'posted_reversed' 特殊值
      const matchesStatus = selectedStatus === 'all' ||
        (selectedStatus === 'posted_reversed' && (v.status === 'posted' || v.status === 'reversed')) ||
        v.status === selectedStatus;

      // 月份区间筛选：凭证日期在开始月份和结束月份之间（包含两端）
      const voucherMonth = v.date.slice(0, 7);
      const matchesMonthRange = (!startMonth || !endMonth) ||
        (voucherMonth >= startMonth && voucherMonth <= endMonth);

      return matchesSearch && matchesStatus && matchesMonthRange;
    })
    .sort((a, b) => {
      const aVal = sortField === 'date' ? a.date : a.voucherNo;
      const bVal = sortField === 'date' ? b.date : b.voucherNo;
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

  const voucherMap = useMemo(() => {
    const m = new Map<string, VoucherType>();
    filteredVouchers.forEach(v => m.set(v.id, v));
    return m;
  }, [filteredVouchers]);

  const glRows = useMemo(() => filteredVouchers.flatMap(voucher =>
    voucher.entries
      .filter(e => e.subjectCode || e.debit > 0 || e.credit > 0)
      .map((entry, idx) => ({
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        date: voucher.date,
        voucherType: voucher.voucherType,
        status: voucher.status,
        createdBy: voucher.createdBy,
        subjectCode: entry.subjectCode,
        subjectName: entry.subjectName,
        summary: entry.summary,
        debit: entry.debit,
        credit: entry.credit,
        originalAmount: Number((entry as { originalAmount?: number }).originalAmount || 0),
        currencyCode: entry.currencyCode,
        auxiliary: entry.auxiliary,
        customerName: entry.customerName,
        supplierName: entry.supplierName,
        deptCode: entry.deptCode,
        projectCode: entry.projectCode,
        cashFlowItem: entry.cashFlowItem,
        docNo: entry.docNo,
        recRefNo: entry.recRefNo,
        _isFirst: idx === 0,
      }))
  ), [filteredVouchers]);

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

  const handleEdit = async (voucher: VoucherType) => {
    await loadVoucher(voucher.id);
    router.push('/voucher-entry-page');
  };

  const handleCopy = async (voucher: VoucherType) => {
    await copyVoucher(voucher.id);
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
      try {
        deleteVoucher(showDeleteDialog.id);
        showToast('success', `凭证 ${showDeleteDialog.voucherNo} 删除成功`);
      } catch (error) {
        console.error('Delete voucher error:', error);
        showToast('error', '删除凭证失败');
      }
      setShowDeleteDialog(null);
    }
  };

  // 获取选中的草稿凭证
  const selectedDraftVouchers = useMemo(() => {
    return filteredVouchers.filter(v =>
      selectedVoucherIds.has(v.id) && v.status === 'draft'
    );
  }, [filteredVouchers, selectedVoucherIds]);

  // 批量删除草稿凭证
  const handleBatchDeleteDraft = () => {
    if (selectedDraftVouchers.length === 0) {
      showToast('warning', '请选择草稿状态的凭证');
      return;
    }
    setShowBatchDeleteDialog(true);
  };

  const confirmBatchDelete = async () => {
    try {
      await Promise.all(selectedDraftVouchers.map(v => deleteVoucher(v.id)));
      showToast('success', `成功删除 ${selectedDraftVouchers.length} 张草稿凭证`);
      setSelectedVoucherIds(new Set());
    } catch (error) {
      console.error('Batch delete error:', error);
      showToast('error', '批量删除失败');
    }
    setShowBatchDeleteDialog(false);
  };

  // 执行凭证操作的通用方法
  const executeVoucherAction = async (
    voucher: VoucherType,
    action: 'post' | 'reverse',
    actionName: string,
    callback: () => Promise<void>
  ) => {
    try {
      // 检查状态转换合法性
      const statusResult = calculateVoucherStatus(voucher.status as VoucherStatus, action);
      if (!statusResult.isValid) {
        showToast('error', statusResult.message);
        return;
      }

      // 执行具体操作
      assertAccountingDateEditable(
        currentAccountSet?.accountingPeriods,
        voucher.date,
        action === 'post' ? '过账凭证' : '冲销凭证',
      );

      await callback();

      // 更新本地store
      await useVoucherStore.getState().initialize();

      showToast('success', `凭证 ${voucher.voucherNo} ${actionName}成功`);
    } catch (error) {
      console.error(`${actionName}失败:`, error);
      showToast('error', `${actionName}失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handlePost = async (voucher: VoucherType) => {
    await executeVoucherAction(
      voucher,
      'post',
      '记账',
      async () => {
        // 更新凭证状态为已记账
        await getCurrentService().updateVoucherStatus(voucher.id, 'posted');
      }
    );
  };

  const handleReverse = (voucher: VoucherType) => {
    setReverseTarget(voucher);
  };

  const handleReverseConfirm = async (reversalDate: string) => {
    const voucher = reverseTarget;
    if (!voucher) return;
    // 创建并保存冲销凭证
    const reversedVoucher = createReverseVoucher(voucher, reversalDate);
    await getCurrentService().saveVoucher(reversedVoucher);
    // 更新原凭证状态为已冲销
    await getCurrentService().updateVoucherStatus(voucher.id, 'reversed');
    // 联动固定资产/无形资产/待摊费用：原凭证若涉及资产变动或摊销，
    // 写抵消行 + 回退资产余额 + 折旧/摊销记录回退 draft
    const { useFixedAssetStore } = await import('@/stores/useFixedAssetStore');
    const { useIntangibleAssetStore } = await import('@/stores/useIntangibleAssetStore');
    const { usePrepaidExpenseStore } = await import('@/stores/usePrepaidExpenseStore');
    await Promise.all([
      useFixedAssetStore.getState().reverseAssetChangesByVoucherId(
        voucher.id, reversedVoucher.id, reversedVoucher.voucherNo, reversalDate,
      ),
      useIntangibleAssetStore.getState().reverseAmortizationByVoucherId(voucher.id),
      usePrepaidExpenseStore.getState().reverseAmortizationByVoucherId(voucher.id),
    ]);
    // 如果是工资计提凭证，解除工资批次与凭证的绑定，便于回到工资管理重新生成
    const { sqliteService } = await import('@/lib/database/sqlite-service');
    const payrollBatch = await sqliteService.getPayrollBatchByVoucherId(voucher.id);
    const cleared = await sqliteService.clearPayrollBatchVoucherByVoucherId(voucher.id);
    setReverseTarget(null);
    await useVoucherStore.getState().initialize();
    if (cleared && payrollBatch) {
      showToast('info', '工资计提凭证已冲销，系统将返回工资管理重新生成。');
      router.push(`/payroll?period=${payrollBatch.payrollPeriod}`);
    } else if (cleared) {
      showToast('info', '工资计提凭证已冲销，已解除工资批次绑定，请返回工资管理重新生成。');
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 重新初始化 voucher store
      const { useVoucherStore } = await import('@/stores/useVoucherStore');
      const { useAccountSetStore } = await import('@/stores/useAccountSetStore');
      const { sqliteService } = await import('@/lib/database/sqlite-service');

      // 确保 accountSetId 正确设置
      const accountSetStore = useAccountSetStore.getState();
      const currentAccountSet = accountSetStore.getCurrentAccountSet();

      if (currentAccountSet) {
        sqliteService.setAccountSetId(currentAccountSet.id);
      }

      // 重新加载 vouchers
      await useVoucherStore.getState().initialize();
      showToast('success', '数据已刷新');
    } catch (error) {
      console.error('Refresh failed:', error);
      showToast('error', '刷新失败');
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  const handleExport = () => {
    if (viewMode === 'gl') {
      // 序时账视图导出：每行一条分录，全字段
      const headers = ['序号', '凭证号', '日期', '凭证类型', '状态', '摘要', '科目代码', '科目名称', '借方金额', '贷方金额', '币别', '往来单位', '部门', '项目', '现金流量', '业务单据号', '核销单号', '创建人'];
      const glRows = filteredVouchers.flatMap(voucher =>
        voucher.entries
          .filter(e => e.subjectCode || e.debit > 0 || e.credit > 0)
          .map(entry => ({
            voucherNo: voucher.voucherNo,
            date: voucher.date,
            voucherType: voucher.voucherType,
            status: voucher.status,
            createdBy: voucher.createdBy,
            ...entry,
          }))
      );
      const rows = glRows.map((row, idx) => [
        idx + 1,
        row.voucherNo,
        row.date,
        typeConfig[row.voucherType as keyof typeof typeConfig],
        statusConfig[row.status as keyof typeof statusConfig].label,
        row.summary || '',
        row.subjectCode || '',
        row.subjectName || '',
        row.debit > 0 ? row.debit.toFixed(2) : '',
        row.credit > 0 ? row.credit.toFixed(2) : '',
        row.currencyCode || '',
        row.auxiliary?.customer || row.auxiliary?.supplier || row.customerName || row.supplierName || '',
        row.auxiliary?.department || row.deptCode || '',
        row.auxiliary?.project || row.projectCode || '',
        row.cashFlowItem || '',
        row.docNo || '',
        row.recRefNo || '',
        row.createdBy || '',
      ]);
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `凭证序时账_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // 列表视图导出
      const headers = ['凭证号', '日期', '摘要', '往来单位', '项目', '创建人', '创建时间', '状态', '借方合计', '贷方合计'];
      const rows = filteredVouchers.map(v => {
        const debitTotal = v.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const creditTotal = v.entries.reduce((sum, e) => sum + (e.credit || 0), 0);

        const partnerNames = new Set<string>();
        v.entries.forEach(entry => {
          if (entry.auxiliary?.customer) partnerNames.add(entry.auxiliary.customer);
          if (entry.auxiliary?.supplier) partnerNames.add(entry.auxiliary.supplier);
          if (entry.customerName) partnerNames.add(entry.customerName);
          if (entry.supplierName) partnerNames.add(entry.supplierName);
        });

        const projectNames = new Set<string>();
        v.entries.forEach(entry => {
          if (entry.projectCode) projectNames.add(entry.projectCode);
          if (entry.auxiliary?.project) projectNames.add(entry.auxiliary.project);
        });

        return [
          v.voucherNo,
          v.date,
          v.summary || '',
          Array.from(partnerNames).join('; '),
          Array.from(projectNames).join('; '),
          v.createdBy || '',
          v.createTime ? new Date(v.createTime).toLocaleString('zh-CN') : '',
          statusConfig[v.status as keyof typeof statusConfig].label,
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
    }
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
          {/* 视图切换 */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className={`rounded-none ${viewMode === 'list' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              onClick={() => handleViewModeChange('list')}
            >
              <LayoutList className="w-4 h-4 mr-1" />
              列表
            </Button>
            <Button
              variant={viewMode === 'gl' ? 'default' : 'ghost'}
              size="sm"
              className={`rounded-none ${viewMode === 'gl' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              onClick={() => handleViewModeChange('gl')}
            >
              <Table2 className="w-4 h-4 mr-1" />
              序时账
            </Button>
          </div>
          {selectedDraftVouchers.length > 0 && (
            <Button variant="destructive" onClick={handleBatchDeleteDraft}>
              <Trash2 className="w-4 h-4 mr-2" />
              删除草稿 ({selectedDraftVouchers.length})
            </Button>
          )}
          {selectedVoucherIds.size > 0 && (
            <Button onClick={handleBatchPrint}>
              <Printer className="w-4 h-4 mr-2" />
              批量打印 ({selectedVoucherIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
          <DatabaseManager />
          <Button onClick={() => router.push('/voucher-entry-page')}>
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
          color="blue"
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
            <div className="flex-1 min-w-[300px]">
              <div className="flex items-center gap-2">
                <SimpleSelect
                  value={searchMode}
                  onChange={(value) => setSearchMode(value as 'all' | 'subject')}
                  options={[
                    { value: 'all', label: '全部' },
                    { value: 'subject', label: '科目' }
                  ]}
                  className="w-24"
                />
                <div className="flex items-center gap-2 flex-1">
                  <Search className="w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={searchMode === 'all' ? "搜索凭证号、摘要或科目" : "搜索科目代码或科目名称"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <SimpleSelect
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={[
                  { value: 'posted_reversed', label: '已记账/已冲销' },
                  { value: 'all', label: '全部状态' },
                  { value: 'draft', label: '草稿' },
                  { value: 'review', label: '审核中' },
                  { value: 'posted', label: '已记账' },
                  { value: 'reversed', label: '已冲销' }
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <ChineseMonthPicker
                value={startMonth}
                onChange={(v) => handleStartMonthChange(v)}
                className="w-36"
              />
              <span className="text-slate-400">至</span>
              <ChineseMonthPicker
                value={endMonth}
                onChange={(v) => handleEndMonthChange(v)}
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

      {/* 凭证列表 / 序时账视图 */}
      {viewMode === 'list' ? (
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {filteredVouchers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium mb-2">暂无凭证记录</p>
              <p className="text-sm">点击&quot;新增凭证&quot;开始创建第一张凭证</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup><col style={{ width: '40px' }} /><col style={{ width: '110px' }} /><col style={{ width: '100px' }} /><col /><col style={{ width: '180px' }} /><col style={{ width: '120px' }} /><col style={{ width: '80px' }} /><col style={{ width: '110px' }} /><col style={{ width: '110px' }} /><col style={{ width: '100px' }} /></colgroup>
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 px-2 no-print">
                        <button onClick={toggleSelectAll} className="hover:text-blue-600">
                          {selectedVoucherIds.size === paginatedVouchers.length && paginatedVouchers.length > 0 ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">
                        <button className="flex items-center gap-1 hover:text-blue-600" onClick={() => toggleSort('voucherNo')}>
                          凭证号 <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">
                        <button className="flex items-center gap-1 hover:text-blue-600" onClick={() => toggleSort('date')}>
                          日期 <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">摘要</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">科目</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">往来单位</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-700">状态</th>
                      <th className="text-right py-3 px-3 font-semibold text-slate-700">借方金额</th>
                      <th className="text-right py-3 px-3 font-semibold text-slate-700">贷方金额</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-700 no-print">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVouchers.map((voucher) => {
                      const debitTotal = voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                      const creditTotal = voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0);

                      // Extract partner & project from entries
                      const partnerNames = new Set<string>();
                      const projectNames = new Set<string>();
                      voucher.entries.forEach(entry => {
                        if (entry.auxiliary?.customer) partnerNames.add(entry.auxiliary.customer);
                        if (entry.auxiliary?.supplier) partnerNames.add(entry.auxiliary.supplier);
                        if (entry.customerName) partnerNames.add(entry.customerName);
                        if (entry.supplierName) partnerNames.add(entry.supplierName);
                        if (entry.projectCode) projectNames.add(entry.projectCode);
                        if (entry.auxiliary?.project) projectNames.add(entry.auxiliary.project);
                      });
                      const partnerText = Array.from(partnerNames).join('; ') || '';

                      const entries = voucher.entries.filter(e => e.subjectCode || e.debit > 0 || e.credit > 0);
                      const statusKey = voucher.status as keyof typeof statusConfig;

                      return (
                        <React.Fragment key={voucher.id}>
                          {/* 凭证主行 */}
                          <tr className="bg-white hover:bg-blue-50/30 border-b border-slate-100">
                            <td className="py-3 px-2 no-print">
                              <button onClick={() => toggleSelectVoucher(voucher.id)} className="hover:text-blue-600">
                                {selectedVoucherIds.has(voucher.id) ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-3 font-mono">
                              <button className="text-blue-600 hover:underline font-semibold" onClick={() => handleView(voucher)}>
                                {voucher.voucherNo}
                              </button>
                            </td>
                            <td className="py-3 px-3 text-slate-700">{voucher.date}</td>
                            <td className="py-3 px-3">
                              <span className="block truncate" title={voucher.summary || ''}>
                                {voucher.summary || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-xs">{entries.length} 条分录</td>
                            <td className="py-3 px-3">
                              <span className="block truncate" title={partnerText}>
                                {partnerText || <span className="text-slate-300">-</span>}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Badge className={`${statusConfig[statusKey].color} text-xs`}>
                                {statusConfig[statusKey].label}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-800">
                              {debitTotal > 0 ? debitTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : ''}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-800">
                              {creditTotal > 0 ? creditTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : ''}
                            </td>
                            <td className="py-3 px-3 text-center no-print">
                              <div className="flex justify-center items-center gap-0.5">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleView(voucher)} title="查看">
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                {(voucher.status === 'draft' || voucher.status === 'review') && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(voucher)} title="编辑">
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCopy(voucher)} title="复制">
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                                {voucher.status === 'posted' ? (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleReverse(voucher)} title="冲销">
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                                  </Button>
                                ) : (voucher.status === 'draft' || voucher.status === 'review') ? (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(voucher)} title="删除">
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>

                          {/* 凭证分录明细行 */}
                          {entries.map((entry) => {
                            const entryPartner = entry.auxiliary?.customer || entry.auxiliary?.supplier || entry.customerName || entry.supplierName || '';
                            return (
                              <tr key={`${voucher.id}_${entry.id}`} className="bg-slate-50/60 border-b border-slate-100 hover:bg-slate-100/60">
                                <td className="py-2 px-2 no-print"></td>
                                <td className="py-2 px-3"></td>
                                <td className="py-2 px-3"></td>
                                <td className="py-2 px-3 pl-8">
                                  <span className="block truncate text-slate-500 text-xs" title={entry.summary || ''}>
                                    {entry.summary || '-'}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="block truncate" title={`${entry.subjectCode || ''} ${entry.subjectName || ''}`}>
                                    <span className="font-mono text-blue-500 text-xs">{entry.subjectCode}</span>
                                    <span className="text-slate-600 text-xs ml-1">{entry.subjectName}</span>
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="block truncate text-slate-500 text-xs" title={entryPartner}>
                                    {entryPartner || ''}
                                  </span>
                                </td>
                                <td className="py-2 px-3"></td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">
                                  {entry.debit > 0 ? entry.debit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : ''}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">
                                  {entry.credit > 0 ? entry.credit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : ''}
                                </td>
                                <td className="py-2 px-3 no-print"></td>
                              </tr>
                            );
                          })}
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
      ) : (
      /* 序时账视图 */
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {glRows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Table2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium mb-2">暂无凭证记录</p>
              <p className="text-sm">点击&quot;新增凭证&quot;开始创建第一张凭证</p>
            </div>
          ) : (
            (() => {
              const glPageSize = 50;
              const glTotalPages = Math.ceil(glRows.length / glPageSize);
              const safePage = Math.min(currentPage, glTotalPages);
              const glPaginatedRows = glRows.slice((safePage - 1) * glPageSize, safePage * glPageSize);
              const glDebitTotal = glPaginatedRows.reduce((s, r) => s + (r.debit || 0), 0);
              const glCreditTotal = glPaginatedRows.reduce((s, r) => s + (r.credit || 0), 0);

              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: '1800px' }}>
                      <colgroup>
                        <col style={{ width: '50px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '150px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '140px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '60px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '150px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '70px' }} />
                      </colgroup>
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr className="border-b-2 border-slate-200">
                          <th className="text-center py-3 px-2 font-semibold text-slate-700 text-xs">序号</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">凭证号</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">日期</th>
                          <th className="text-center py-3 px-2 font-semibold text-slate-700 text-xs">凭证类型</th>
                          <th className="text-center py-3 px-2 font-semibold text-slate-700 text-xs">状态</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">摘要</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">科目代码</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">科目名称</th>
                          <th className="text-right py-3 px-2 font-semibold text-slate-700 text-xs">借方金额</th>
                          <th className="text-right py-3 px-2 font-semibold text-slate-700 text-xs">贷方金额</th>
                          <th className="text-center py-3 px-2 font-semibold text-slate-700 text-xs">币别</th>
                          <th className="text-right py-3 px-2 font-semibold text-slate-700 text-xs">原币金额</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">往来单位</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">部门</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">项目</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">现金流量</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">业务单据号</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">核销单号</th>
                          <th className="text-left py-3 px-2 font-semibold text-slate-700 text-xs">创建人</th>
                        </tr>
                      </thead>
                      <tbody>
                        {glPaginatedRows.map((row, idx) => {
                          const globalIdx = (safePage - 1) * glPageSize + idx + 1;
                          const partner = row.auxiliary?.customer || row.auxiliary?.supplier || row.customerName || row.supplierName || '';
                          const dept = row.auxiliary?.department || row.deptCode || '';
                          const project = row.auxiliary?.project || row.projectCode || '';
                          const statusKey = row.status as keyof typeof statusConfig;
                          return (
                            <tr
                              key={`${row.voucherId}_${row.subjectCode}_${idx}`}
                              className={`hover:bg-blue-50/30 border-b border-slate-100 ${row._isFirst && idx > 0 ? 'border-t-2 border-t-slate-300' : ''}`}
                            >
                              <td className="py-2 px-2 text-center text-xs text-slate-400">{globalIdx}</td>
                              <td className="py-2 px-2">
                                <button
                                  className="text-blue-600 hover:underline font-mono text-xs font-semibold"
                                  onClick={() => {
                                    const v = voucherMap.get(row.voucherId);
                                    if (v) handleView(v);
                                  }}
                                >
                                  {row.voucherNo}
                                </button>
                              </td>
                              <td className="py-2 px-2 text-xs text-slate-700">{row.date}</td>
                              <td className="py-2 px-2 text-center text-xs text-slate-600">{typeConfig[row.voucherType as keyof typeof typeConfig]}</td>
                              <td className="py-2 px-2 text-center">
                                <Badge className={`${statusConfig[statusKey].color} text-xs`}>
                                  {statusConfig[statusKey].label}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-xs">
                                <span className="block truncate" title={row.summary || ''}>{row.summary || ''}</span>
                              </td>
                              <td className="py-2 px-2 font-mono text-xs text-blue-500">{row.subjectCode || ''}</td>
                              <td className="py-2 px-2 text-xs text-slate-700">
                                <span className="block truncate" title={row.subjectName || ''}>{row.subjectName || ''}</span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs text-slate-800">
                                {row.debit > 0 ? formatMoney(row.debit) : ''}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs text-slate-800">
                                {row.credit > 0 ? formatMoney(row.credit) : ''}
                              </td>
                              <td className="py-2 px-2 text-center text-xs text-slate-500">{row.currencyCode || ''}</td>
                              <td className="py-2 px-2 text-right font-mono text-xs text-slate-600">
                                {row.originalAmount > 0 ? formatMoney(row.originalAmount) : ''}
                              </td>
                              <td className="py-2 px-2 text-xs text-slate-600">
                                <span className="block truncate" title={partner}>{partner}</span>
                              </td>
                              <td className="py-2 px-2 text-xs text-slate-600">
                                <span className="block truncate" title={dept}>{dept}</span>
                              </td>
                              <td className="py-2 px-2 text-xs text-slate-600">
                                <span className="block truncate" title={project}>{project}</span>
                              </td>
                              <td className="py-2 px-2 text-xs text-slate-600">
                                <span className="block truncate" title={row.cashFlowItem || ''}>{row.cashFlowItem || ''}</span>
                              </td>
                              <td className="py-2 px-2 text-xs font-mono text-slate-500">
                                <span className="block truncate" title={row.docNo || ''}>{row.docNo || ''}</span>
                              </td>
                              <td className="py-2 px-2 text-xs font-mono text-slate-500">
                                <span className="block truncate" title={row.recRefNo || ''}>{row.recRefNo || ''}</span>
                              </td>
                              <td className="py-2 px-2 text-xs text-slate-500">{row.createdBy || ''}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-medium border-t-2 border-slate-300">
                          <td className="py-2 px-2" colSpan={8}>合计</td>
                          <td className="py-2 px-2 text-right font-mono text-xs text-blue-600">{formatMoney(glDebitTotal)}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs text-blue-600">{formatMoney(glCreditTotal)}</td>
                          <td colSpan={9}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {glTotalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                      <div className="text-sm text-slate-500">
                        共 {glRows.length} 行（{filteredVouchers.length} 张凭证），第 {safePage} / {glTotalPages} 页
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        {Array.from({ length: Math.min(5, glTotalPages) }, (_, i) => {
                          let pageNum = i + 1;
                          if (glTotalPages > 5) {
                            if (safePage <= 3) pageNum = i + 1;
                            else if (safePage >= glTotalPages - 2) pageNum = glTotalPages - 4 + i;
                            else pageNum = safePage - 2 + i;
                          }
                          return (
                            <Button key={pageNum} variant={pageNum === safePage ? 'default' : 'outline'} size="sm" className={pageNum === safePage ? 'bg-blue-600' : ''} onClick={() => setCurrentPage(pageNum)}>
                              {pageNum}
                            </Button>
                          );
                        })}
                        <Button variant="outline" size="sm" disabled={safePage === glTotalPages} onClick={() => setCurrentPage(p => p + 1)}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </CardContent>
      </Card>
      )}
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

      {/* 批量删除草稿凭证确认对话框 */}
      <Dialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
            <DialogDescription>
              确定要删除选中的 <span className="font-medium text-slate-900">{selectedDraftVouchers.length}</span> 张草稿凭证吗？
              <br />
              <span className="text-red-600">此操作不可撤销。</span>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-48 overflow-y-auto border rounded-lg bg-slate-50">
            <ul className="p-2 space-y-1 text-sm">
              {selectedDraftVouchers.map(v => (
                <li key={v.id} className="flex justify-between text-slate-600">
                  <span className="font-mono">{v.voucherNo}</span>
                  <span className="text-slate-400">{v.date}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowBatchDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmBatchDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReverseVoucherDialog
        open={!!reverseTarget}
        onOpenChange={(o) => !o && setReverseTarget(null)}
        originalVoucher={reverseTarget}
        onConfirm={handleReverseConfirm}
      />

    </div>
  );
}
