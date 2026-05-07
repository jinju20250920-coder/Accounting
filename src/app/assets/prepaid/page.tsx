'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePrepaidExpenseStore } from '@/stores/usePrepaidExpenseStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { SubjectPopover, PartnerPopover, DepartmentPopover } from '@/components/shared/subject-popover';
import { VoucherStamp } from '@/components/shared/voucher-stamp';
import { AmortizationDialog } from '@/components/assets/amortization-dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Calculator, History, Pencil, Trash2, FileText, RotateCcw } from 'lucide-react';
import { sqliteService } from '@/lib/database';
import { formatNumber } from '@/lib/utils';
import { getPrepaidExpenseTypeName } from '@/lib/amortization';
import type { PrepaidExpense, PrepaidExpenseType, AmortizationMethod, AmortizationRecord } from '@/types';

// Voucher detail dialog
interface VoucherDetail {
  id: string;
  voucherNo: string;
  date: string;
  summary: string;
  status: string;
  entries: { subjectCode: string; subjectName: string; debit: number; credit: number; summary: string }[];
}

function VoucherDetailDialog({ open, onOpenChange, voucherNo }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucherNo: string | null;
}) {
  const [detail, setDetail] = useState<VoucherDetail | null>(null);
  const subjects = useSubjectStore(s => s.subjects);

  useEffect(() => {
    if (open && voucherNo) {
      loadVoucher(voucherNo);
    } else {
      setDetail(null);
    }
  }, [open, voucherNo]);

  const loadVoucher = async (vNo: string) => {
    try {
      const db = await sqliteService.getDatabase();
      if (!db) { setDetail(null); return; }
      const result = db.exec(
        'SELECT id, voucherNo, date, status, summary FROM vouchers WHERE voucherNo = ? LIMIT 1',
        [vNo]
      );
      if (!result[0]?.values?.length) { setDetail(null); return; }
      const row = result[0].values[0];
      const voucherId = row[0] as string;
      const subjectMap = new Map(subjects.map(s => [s.code, s.name]));
      const entriesResult = db.exec(
        'SELECT subjectCode, subjectName, debit, credit, summary FROM entries WHERE voucherId = ?',
        [voucherId]
      );
      const entries = (entriesResult[0]?.values || []).map((e: any[]) => ({
        subjectCode: e[0] || '',
        subjectName: subjectMap.get(e[0]) || e[1] || '',
        debit: e[2] || 0,
        credit: e[3] || 0,
        summary: e[4] || '',
      }));
      setDetail({
        id: voucherId,
        voucherNo: row[1] as string,
        date: row[2] as string,
        summary: (row[4] as string) || '',
        status: (row[3] as string) || 'draft',
        entries,
      });
    } catch { setDetail(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-600" />
            {detail?.voucherNo || voucherNo}
          </DialogTitle>
        </DialogHeader>
        {detail ? (
          <div className="space-y-3 relative">
            <VoucherStamp status={detail.status} />
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>日期: {detail.date}</span>
              {detail.summary && <span>摘要: {detail.summary}</span>}
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-1.5 text-left font-medium">科目</th>
                  <th className="py-1.5 text-right font-medium">借方</th>
                  <th className="py-1.5 text-right font-medium">贷方</th>
                </tr>
              </thead>
              <tbody>
                {detail.entries.map((e, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5">
                      <span className="font-mono text-slate-600">{e.subjectCode}</span>
                      <span className="ml-1">{e.subjectName}</span>
                    </td>
                    <td className="py-1.5 text-right text-red-600">{e.debit ? formatAmount(e.debit) : '-'}</td>
                    <td className="py-1.5 text-right text-green-600">{e.credit ? formatAmount(e.credit) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td className="py-1.5">合计</td>
                  <td className="py-1.5 text-right">{formatAmount(detail.entries.reduce((s, e) => s + e.debit, 0))}</td>
                  <td className="py-1.5 text-right">{formatAmount(detail.entries.reduce((s, e) => s + e.credit, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-sm">加载中...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type FormData = {
  expenseCode: string;
  expenseName: string;
  expenseType: PrepaidExpenseType;
  originalAmount: number;
  amortizationMethod: AmortizationMethod;
  amortizationPeriods: number;
  paymentDate: string;
  startDate: string;
  endDate: string;
  prepaidSubjectCode: string;
  prepaidSubjectName: string;
  expenseSubjectCode: string;
  expenseSubjectName: string;
  supplierName: string;
  invoiceNo: string;
  contractNo: string;
  departmentCode: string;
  departmentName: string;
  notes: string;
};

const INITIAL_FORM: FormData = {
  expenseCode: '',
  expenseName: '',
  expenseType: 'other',
  originalAmount: 0,
  amortizationMethod: 'straight_line',
  amortizationPeriods: 12,
  paymentDate: '',
  startDate: '',
  endDate: '',
  prepaidSubjectCode: '',
  prepaidSubjectName: '',
  expenseSubjectCode: '',
  expenseSubjectName: '',
  supplierName: '',
  invoiceNo: '',
  contractNo: '',
  departmentCode: '',
  departmentName: '',
  notes: '',
};

const formatAmount = formatNumber;

export default function PrepaidExpensePage() {
  const { expenses, amortizationRecords, addExpense, updateExpense, deleteExpense, initialize,
          getAmortizationHistory, correctAmortizationRecord } = usePrepaidExpenseStore();
  const { initializeSubjects } = useSubjectStore();
  const { showToast } = useToast();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<PrepaidExpense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [showAmortizationDialog, setShowAmortizationDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyExpenseId, setHistoryExpenseId] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AmortizationRecord[]>([]);
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  const [selectedVoucherNo, setSelectedVoucherNo] = useState<string | null>(null);
  const [showCorrectDialog, setShowCorrectDialog] = useState(false);
  const [correctTarget, setCorrectTarget] = useState<AmortizationRecord | null>(null);
  const [correctDate, setCorrectDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [correcting, setCorrecting] = useState(false);

  useEffect(() => {
    if (formData.startDate && formData.amortizationPeriods > 0) {
      const start = new Date(formData.startDate);
      const endDateObj = new Date(start.getFullYear(), start.getMonth() + formData.amortizationPeriods, 0);
      const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, endDate }));
    }
  }, [formData.startDate, formData.amortizationPeriods]);

  useEffect(() => {
    initialize();
    initializeSubjects();
  }, [initialize, initializeSubjects]);

  const filteredExpenses = useMemo(() => {
    if (!searchTerm) return expenses;
    const q = searchTerm.toLowerCase();
    return expenses.filter(e =>
      e.expenseName?.toLowerCase().includes(q) ||
      e.expenseCode?.toLowerCase().includes(q) ||
      e.supplierName?.toLowerCase().includes(q)
    );
  }, [expenses, searchTerm]);

  const handleSave = async () => {
    if (!formData.expenseName) { showToast('error', '请输入费用名称'); return; }
    if (!formData.originalAmount || formData.originalAmount <= 0) { showToast('error', '请输入有效的费用金额'); return; }
    if (!formData.amortizationPeriods || formData.amortizationPeriods <= 0) { showToast('error', '请输入有效的摊销期数'); return; }

    const periodAmount = Math.round((formData.originalAmount / formData.amortizationPeriods) * 100) / 100;

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          ...formData,
          periodAmount,
          amortizedAmount: editingExpense.amortizedAmount,
          remainingAmount: formData.originalAmount - editingExpense.amortizedAmount,
          amortizedPeriods: editingExpense.amortizedPeriods,
        });
        showToast('success', '待摊费用已更新');
      } else {
        await addExpense({
          ...formData,
          periodAmount,
          amortizedAmount: 0,
          remainingAmount: formData.originalAmount,
          amortizedPeriods: 0,
          lastAmortizationDate: '',
          status: 'active',
        } as Omit<PrepaidExpense, 'id' | 'createTime' | 'updateTime' | 'accountSetId'>);
        showToast('success', '待摊费用已添加');
      }
      setShowAddDialog(false);
      setEditingExpense(null);
      setFormData(INITIAL_FORM);
    } catch (error) {
      showToast('error', '保存失败：' + (error as Error).message);
    }
  };

  const handleEdit = (expense: PrepaidExpense) => {
    setEditingExpense(expense);
    setFormData({
      expenseCode: expense.expenseCode || '',
      expenseName: expense.expenseName || '',
      expenseType: expense.expenseType || 'other',
      originalAmount: expense.originalAmount || 0,
      amortizationMethod: expense.amortizationMethod || 'straight_line',
      amortizationPeriods: expense.amortizationPeriods || 12,
      paymentDate: expense.paymentDate || '',
      startDate: expense.startDate || '',
      endDate: expense.endDate || '',
      prepaidSubjectCode: expense.prepaidSubjectCode || '',
      prepaidSubjectName: expense.prepaidSubjectName || '',
      expenseSubjectCode: expense.expenseSubjectCode || '',
      expenseSubjectName: expense.expenseSubjectName || '',
      supplierName: expense.supplierName || '',
      invoiceNo: expense.invoiceNo || '',
      contractNo: expense.contractNo || '',
      departmentCode: expense.departmentCode || '',
      departmentName: expense.departmentName || '',
      notes: expense.notes || '',
    });
    setShowAddDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpense(deleteTarget);
      showToast('success', '待摊费用已删除');
    } catch (error) {
      showToast('error', '删除失败：' + (error as Error).message);
    }
    setDeleteTarget(null);
    setShowDeleteConfirm(false);
  };

  const handleViewHistory = async (expenseId: string) => {
    setHistoryExpenseId(expenseId);
    try {
      const records = getAmortizationHistory(expenseId);
      setHistoryRecords(records);
    } catch {
      setHistoryRecords([]);
    }
    setShowHistoryDialog(true);
  };

  const handleCorrect = async () => {
    if (!correctTarget) return;
    setCorrecting(true);
    try {
      const result = await correctAmortizationRecord(correctTarget.id, correctDate);
      if (result) {
        showToast('success', `更正成功，红字凭证 ${result.voucherNo} 已生成并记账`);
      }
      setShowCorrectDialog(false);
      setCorrectTarget(null);
      // Refresh history
      if (historyExpenseId) {
        const records = getAmortizationHistory(historyExpenseId);
        setHistoryRecords(records);
      }
      initialize();
    } catch (error: any) {
      showToast('error', error.message || '更正失败');
    } finally {
      setCorrecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_started': return <Badge className="bg-slate-100 text-slate-600">未摊销</Badge>;
      case 'active': return <Badge className="bg-green-50 text-green-600">摊销中</Badge>;
      case 'fully_amortized': return <Badge className="bg-blue-50 text-blue-600">已完毕</Badge>;
      case 'disposed': return <Badge className="bg-red-50 text-red-600">已处置</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalOriginal = filteredExpenses.reduce((s, e) => s + (e.originalAmount || 0), 0);
  const totalAmortized = filteredExpenses.reduce((s, e) => s + (e.amortizedAmount || 0), 0);
  const totalRemaining = filteredExpenses.reduce((s, e) => s + (e.remainingAmount || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">待摊费用管理</h1>
          <p className="text-muted-foreground mt-1">管理待摊费用卡片，自动计算摊销</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAmortizationDialog(true)}>
            <Calculator className="h-4 w-4 mr-2" />
            摊销计算
          </Button>
          <Button onClick={() => { setFormData(INITIAL_FORM); setEditingExpense(null); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            新增待摊费用
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-slate-500">原值合计</div>
          <div className="text-xl font-bold">¥{formatAmount(totalOriginal)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-slate-500">已摊合计</div>
          <div className="text-xl font-bold text-orange-600">¥{formatAmount(totalAmortized)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-slate-500">剩余合计</div>
          <div className="text-xl font-bold text-blue-600">¥{formatAmount(totalRemaining)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索费用名称、编号、供应商..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="text-left p-3 font-medium text-sm">编号</th>
              <th className="text-left p-3 font-medium text-sm">名称</th>
              <th className="text-left p-3 font-medium text-sm">类型</th>
              <th className="text-right p-3 font-medium text-sm">原值</th>
              <th className="text-right p-3 font-medium text-sm">已摊</th>
              <th className="text-right p-3 font-medium text-sm">剩余</th>
              <th className="text-right p-3 font-medium text-sm">每期</th>
              <th className="text-center p-3 font-medium text-sm">摊销期</th>
              <th className="text-left p-3 font-medium text-sm">起止日期</th>
              <th className="text-left p-3 font-medium text-sm">状态</th>
              <th className="text-center p-3 font-medium text-sm">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-12 text-muted-foreground">暂无待摊费用数据</td>
              </tr>
            ) : (
              filteredExpenses.map(expense => (
                <tr key={expense.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-sm font-mono text-slate-600">{expense.expenseCode}</td>
                  <td className="p-3 text-sm font-medium">{expense.expenseName}</td>
                  <td className="p-3 text-sm">
                    <Badge variant="outline" className="text-xs">{getPrepaidExpenseTypeName(expense.expenseType)}</Badge>
                  </td>
                  <td className="p-3 text-sm text-right font-mono">¥{formatAmount(expense.originalAmount)}</td>
                  <td className="p-3 text-sm text-right font-mono text-orange-600">¥{formatAmount(expense.amortizedAmount)}</td>
                  <td className="p-3 text-sm text-right font-mono">¥{formatAmount(expense.remainingAmount)}</td>
                  <td className="p-3 text-sm text-right font-mono">¥{formatAmount(expense.periodAmount)}</td>
                  <td className="p-3 text-sm text-center">{expense.amortizedPeriods}/{expense.amortizationPeriods}</td>
                  <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                    {expense.startDate && expense.endDate
                      ? `${expense.startDate} ~ ${expense.endDate}`
                      : '-'}
                  </td>
                  <td className="p-3">{getStatusBadge(expense.status)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="摊销历史"
                        onClick={() => handleViewHistory(expense.id)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="编辑"
                        onClick={() => handleEdit(expense)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" title="删除"
                        onClick={() => { setDeleteTarget(expense.id); setShowDeleteConfirm(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filteredExpenses.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t font-medium text-sm">
                <td className="p-3" colSpan={3}>合计</td>
                <td className="p-3 text-right font-mono">¥{formatAmount(totalOriginal)}</td>
                <td className="p-3 text-right font-mono text-orange-600">¥{formatAmount(totalAmortized)}</td>
                <td className="p-3 text-right font-mono">¥{formatAmount(totalRemaining)}</td>
                <td className="p-3" colSpan={5}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Amortization dialog */}
      <AmortizationDialog open={showAmortizationDialog} onOpenChange={setShowAmortizationDialog} />

      {/* Amortization history dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-3xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>摊销历史</DialogTitle>
          </DialogHeader>
          {historyRecords.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">暂无摊销记录</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-medium text-sm">期间</th>
                  <th className="text-right p-3 font-medium text-sm">本期摊销</th>
                  <th className="text-right p-3 font-medium text-sm">累计摊销</th>
                  <th className="text-right p-3 font-medium text-sm">剩余</th>
                  <th className="text-left p-3 font-medium text-sm">凭证号</th>
                  <th className="text-left p-3 font-medium text-sm">状态</th>
                  <th className="text-center p-3 font-medium text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {historyRecords.map(record => (
                  <tr key={record.id} className={`border-b hover:bg-slate-50 ${record.periodAmortization < 0 ? 'bg-red-50' : ''}`}>
                    <td className="p-3 text-sm">{record.period}</td>
                    <td className={`p-3 text-sm text-right font-mono ${record.periodAmortization < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {record.periodAmortization < 0 ? '-' : ''}¥{formatAmount(Math.abs(record.periodAmortization))}
                    </td>
                    <td className="p-3 text-sm text-right font-mono text-orange-600">¥{formatAmount(record.accumulatedAmortization)}</td>
                    <td className="p-3 text-sm text-right font-mono">¥{formatAmount(record.remainingAmount)}</td>
                    <td className="p-3 text-sm font-mono">
                      {record.voucherNo ? (
                        <button
                          className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                          onClick={() => { setSelectedVoucherNo(record.voucherNo); setShowVoucherDialog(true); }}
                        >
                          {record.voucherNo}
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {record.periodAmortization < 0 ? (
                        <Badge className="bg-red-50 text-red-600">红字冲销</Badge>
                      ) : record.status === 'posted' ? (
                        <Badge className="bg-green-50 text-green-600">已记账</Badge>
                      ) : record.status === 'draft' ? (
                        <Badge className="bg-yellow-50 text-yellow-600">草稿</Badge>
                      ) : (
                        <Badge variant="outline">{record.status}</Badge>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {(() => {
                        const alreadyCorrected = historyRecords.some(
                          r => r.periodAmortization < 0 && r.notes?.includes(record.id)
                        );
                        return record.status === 'posted' && record.periodAmortization > 0 && !alreadyCorrected;
                      })() && (
                        <Button variant="ghost" size="sm" className="h-7 text-red-600 hover:text-red-800"
                          onClick={() => { setCorrectTarget(record); setCorrectDate(new Date().toISOString().split('T')[0]); setShowCorrectDialog(true); }}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          更正
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction dialog */}
      <Dialog open={showCorrectDialog} onOpenChange={setShowCorrectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              更正摊销
            </DialogTitle>
          </DialogHeader>
          {correctTarget && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 rounded-lg text-sm space-y-1">
                <div className="font-medium text-red-800">即将冲销以下摊销记录：</div>
                <div className="text-red-600">期间: {correctTarget.period}</div>
                <div className="text-red-600">摊销金额: ¥{formatAmount(correctTarget.periodAmortization)}</div>
                {correctTarget.voucherNo && <div className="text-red-600">原凭证号: {correctTarget.voucherNo}</div>}
              </div>
              <div className="space-y-2">
                <Label required>更正入账日期</Label>
                <ChineseDatePicker value={correctDate} onChange={setCorrectDate} />
                <p className="text-xs text-slate-500">红字凭证将在此日期入账，需在当前账期内</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700 space-y-1">
                <div>系统将自动执行以下操作：</div>
                <div>1. 生成红字冲销凭证（借贷反转），状态为已记账</div>
                <div>2. 生成负数摊销记录（金额: -¥{formatAmount(correctTarget.periodAmortization)}）</div>
                <div>3. 回退待摊费用累计摊销额和摊销期数</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCorrectDialog(false)} disabled={correcting}>取消</Button>
            <Button variant="destructive" onClick={handleCorrect} disabled={correcting}>
              {correcting ? '处理中...' : '确认更正'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher detail dialog */}
      <VoucherDetailDialog
        open={showVoucherDialog}
        onOpenChange={setShowVoucherDialog}
        voucherNo={selectedVoucherNo}
      />

      {/* 新增/编辑对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? '编辑待摊费用' : '新增待摊费用'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label required>费用名称</Label>
              <Input value={formData.expenseName} onChange={e => setFormData(prev => ({ ...prev, expenseName: e.target.value }))} placeholder="输入费用名称" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>费用编号</Label>
              <Input value={formData.expenseCode} readOnly className="bg-slate-50 text-muted-foreground" placeholder="自动生成" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>费用类型</Label>
              <select value={formData.expenseType} onChange={e => setFormData(prev => ({ ...prev, expenseType: e.target.value as PrepaidExpenseType }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="rent">租金</option>
                <option value="insurance">保险</option>
                <option value="subscription">订阅</option>
                <option value="maintenance">维修</option>
                <option value="advertising">广告</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label required>费用金额</Label>
              <Input type="number" value={formData.originalAmount || ''} onChange={e => setFormData(prev => ({ ...prev, originalAmount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>摊销方法</Label>
              <select value={formData.amortizationMethod} onChange={e => setFormData(prev => ({ ...prev, amortizationMethod: e.target.value as AmortizationMethod }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="straight_line">直线法</option>
                <option value="units_of_production">工作量法</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label required>摊销期数（月）</Label>
              <Input type="number" value={formData.amortizationPeriods || ''} onChange={e => setFormData(prev => ({ ...prev, amortizationPeriods: parseInt(e.target.value) || 0 }))} placeholder="12" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>支付日期</Label>
              <ChineseDatePicker value={formData.paymentDate} onChange={v => setFormData(prev => ({ ...prev, paymentDate: v }))} />
            </div>
            <div className="space-y-2">
              <Label required>摊销开始日期</Label>
              <ChineseDatePicker value={formData.startDate} onChange={v => setFormData(prev => ({ ...prev, startDate: v }))} />
            </div>
            <div className="space-y-2">
              <Label>摊销结束日期</Label>
              <Input value={formData.endDate} readOnly className="bg-slate-50 text-muted-foreground" autoComplete="off" />
              {formData.startDate && formData.amortizationPeriods > 0 && (
                <p className="text-xs text-muted-foreground">根据开始日期和摊销期数自动计算</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>待摊科目</Label>
              <SubjectPopover value={formData.prepaidSubjectCode} onSelect={(code, name) => setFormData(prev => ({ ...prev, prepaidSubjectCode: code, prepaidSubjectName: name }))} placeholder="搜索待摊科目" />
            </div>
            <div className="space-y-2">
              <Label>费用科目</Label>
              <SubjectPopover value={formData.expenseSubjectCode} onSelect={(code, name) => setFormData(prev => ({ ...prev, expenseSubjectCode: code, expenseSubjectName: name }))} placeholder="搜索费用科目" />
            </div>
            <div className="space-y-2">
              <Label>供应商</Label>
              <PartnerPopover value={formData.supplierName} onSelect={(name) => setFormData(prev => ({ ...prev, supplierName: name }))} placeholder="选择供应商" />
            </div>
            <div className="space-y-2">
              <Label>发票号</Label>
              <Input value={formData.invoiceNo} onChange={e => setFormData(prev => ({ ...prev, invoiceNo: e.target.value }))} placeholder="发票号" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>合同号</Label>
              <Input value={formData.contractNo} onChange={e => setFormData(prev => ({ ...prev, contractNo: e.target.value }))} placeholder="合同号" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>部门</Label>
              <DepartmentPopover value={formData.departmentCode} onSelect={(code, name) => setFormData(prev => ({ ...prev, departmentCode: code, departmentName: name }))} placeholder="选择部门" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>备注</Label>
              <Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="备注信息" autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm text-slate-600">确定要删除此待摊费用吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
