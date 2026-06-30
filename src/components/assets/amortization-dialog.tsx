'use client';

import { useState, useMemo } from 'react';
import { usePrepaidExpenseStore } from '@/stores/usePrepaidExpenseStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Calculator,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { getAmortizationMethodName, getPrepaidExpenseTypeName } from '@/lib/amortization';
import { validateAccountingPeriod } from '@/lib/accounting';
import { formatNumber, refreshVoucherStore, getErrorMessage } from '@/lib/utils';
import type { PrepaidExpense, AmortizationRecord, BatchAmortizationResult } from '@/types';

const formatAmount = formatNumber;

interface VoucherEntry {
  key: string;
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
}

interface SubjectSummary {
  code: string;
  name: string;
  debit: number;
  credit: number;
}

function generateVoucherEntries(
  records: AmortizationRecord[],
  expenses: PrepaidExpense[]
): VoucherEntry[] {
  const entries: VoucherEntry[] = [];
  for (const record of records) {
    const expense = expenses.find(e => e.id === record.entityId);
    const expenseCode = expense?.expenseSubjectCode || '660205';
    const expenseName = expense?.expenseSubjectName || '管理费用-摊销费';
    const prepaidCode = expense?.prepaidSubjectCode || '1811';
    const prepaidName = expense?.prepaidSubjectName || '待摊费用';
    const amount = record.periodAmortization;

    entries.push({
      key: `${record.id}-debit`,
      summary: `${record.entityCode}摊销`,
      subjectCode: expenseCode,
      subjectName: expenseName,
      debit: amount,
      credit: 0,
    });
    entries.push({
      key: `${record.id}-credit`,
      summary: `${record.entityCode}摊销`,
      subjectCode: prepaidCode,
      subjectName: prepaidName,
      debit: 0,
      credit: amount,
    });
  }
  return entries;
}

function generateSubjectSummary(
  records: AmortizationRecord[],
  expenses: PrepaidExpense[]
): { debitSubjects: SubjectSummary[]; creditSubjects: SubjectSummary[] } {
  const subjectMap = new Map<string, SubjectSummary>();
  for (const record of records) {
    const expense = expenses.find(e => e.id === record.entityId);

    const expenseCode = expense?.expenseSubjectCode || '660205';
    const expenseName = expense?.expenseSubjectName || '管理费用-摊销费';
    const expenseKey = expenseCode + '_' + expenseName;
    const existingExpense = subjectMap.get(expenseKey);
    if (existingExpense) {
      existingExpense.debit += record.periodAmortization;
    } else {
      subjectMap.set(expenseKey, { code: expenseCode, name: expenseName, debit: record.periodAmortization, credit: 0 });
    }

    const prepaidCode = expense?.prepaidSubjectCode || '1811';
    const prepaidName = expense?.prepaidSubjectName || '待摊费用';
    const prepaidKey = prepaidCode + '_' + prepaidName;
    const existingPrepaid = subjectMap.get(prepaidKey);
    if (existingPrepaid) {
      existingPrepaid.credit += record.periodAmortization;
    } else {
      subjectMap.set(prepaidKey, { code: prepaidCode, name: prepaidName, debit: 0, credit: record.periodAmortization });
    }
  }
  const subjects = Array.from(subjectMap.values());
  return {
    debitSubjects: subjects.filter(s => s.debit > 0),
    creditSubjects: subjects.filter(s => s.credit > 0),
  };
}

interface AmortizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AmortizationDialog({ open, onOpenChange }: AmortizationDialogProps) {
  const {
    expenses,
    amortizationRecords,
    loading,
    batchCalculateAmortization,
    saveAmortizationRecords,
    postAmortizationRecords,
    generateAmortizationVoucher,
    initialize,
  } = usePrepaidExpenseStore();

  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const currentPeriod = useMemo(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) {
      return `${currentPeriodData.year}-${String(currentPeriodData.month).padStart(2, '0')}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [period] = useState<string>(currentPeriod);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [previewResult, setPreviewResult] = useState<BatchAmortizationResult | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDetailTable, setShowDetailTable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [voucherDate, setVoucherDate] = useState<string>(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    const currentPeriodData = accountSet?.accountingPeriods?.find(p => p.isCurrent);
    if (currentPeriodData) return currentPeriodData.endDate;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`;
  });

  const subjects = useSubjectStore(s => s.subjects);
  const activeExpenses = expenses.filter(e => e.status === 'active');

  const filteredExpenses = activeExpenses.filter(expense => {
    const matchesSearch = !searchQuery ||
      expense.expenseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.expenseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || expense.expenseType === typeFilter;
    return matchesSearch && matchesType;
  });

  const amortizedIdsThisPeriod = new Set(
    amortizationRecords
      .filter(r => r.period === period && r.status !== 'draft')
      .map(r => r.entityId)
  );

  const toggleExpenseSelection = (expenseId: string) => {
    const newSelected = new Set(selectedExpenseIds);
    if (newSelected.has(expenseId)) newSelected.delete(expenseId);
    else newSelected.add(expenseId);
    setSelectedExpenseIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedExpenseIds.size === filteredExpenses.length) {
      setSelectedExpenseIds(new Set());
    } else {
      setSelectedExpenseIds(new Set(filteredExpenses.map(e => e.id)));
    }
  };

  const handlePreview = () => {
    if (selectedExpenseIds.size === 0) {
      showToast('warning', '请先选择要摊销的费用');
      return;
    }
    const alreadyAmortized = Array.from(selectedExpenseIds).filter(id => amortizedIdsThisPeriod.has(id));
    if (alreadyAmortized.length > 0) {
      const names = alreadyAmortized
        .map(id => expenses.find(e => e.id === id)?.expenseCode)
        .filter(Boolean).slice(0, 3).join('、');
      showToast('warning', `${alreadyAmortized.length} 个费用本月已摊销（${names}...），将自动跳过`);
    }
    const result = batchCalculateAmortization(Array.from(selectedExpenseIds), period);
    setPreviewResult(result);
    setShowPreviewDialog(true);
  };

  const handleExecute = async () => {
    if (!previewResult || previewResult.records.length === 0) {
      showToast('warning', '没有可摊销的记录');
      return;
    }
    const periodValidation = validatePeriod();
    if (!periodValidation.valid) {
      showToast('error', periodValidation.error!);
      return;
    }
    setIsProcessing(true);
    try {
      await saveAmortizationRecords(previewResult.records);
      const result = await generateAmortizationVoucher(previewResult.records.map(r => r.id), voucherDate);
      if (result) {
        const { sqliteService } = await import('@/lib/database/sqlite-service');
        const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
        if (accountSet?.id) {
          sqliteService.setAccountSetId(accountSet.id);
          const db = await sqliteService.getDatabase();
          if (db) {
            const stmt = db.prepare('UPDATE vouchers SET status = ? WHERE id = ?');
            stmt.run(['posted', result.voucherId]);
            stmt.free();
          }
        }
        await postAmortizationRecords(previewResult.records.map(r => r.id));
        await refreshVoucherStore();
        showToast('success', `成功生成 ${previewResult.records.length} 条摊销记录，凭证 ${result.voucherNo} 已记账`);
      } else {
        showToast('success', `成功生成 ${previewResult.records.length} 条摊销记录`);
      }
      setSelectedExpenseIds(new Set());
      setPreviewResult(null);
      setShowPreviewDialog(false);
      initialize();
    } catch (error: unknown) {
      showToast('error', getErrorMessage(error) || '摊销处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const validatePeriod = () => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    return validateAccountingPeriod(voucherDate, accountSet);
  };

  const totalOriginalAmount = activeExpenses.reduce((sum, e) => sum + e.originalAmount, 0);
  const totalAmortized = activeExpenses.reduce((sum, e) => sum + e.amortizedAmount, 0);

  const expenseTypes = useMemo(() => {
    const types = new Set(activeExpenses.map(e => e.expenseType));
    return Array.from(types);
  }, [activeExpenses]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            摊销计算
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">计算期间:</span>
              <span className="text-sm font-medium text-blue-600">{period.replace('-', '年')}月</span>
              <span className="text-xs text-slate-500">(当前账期)</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-600">在用费用: <strong>{activeExpenses.length}</strong></span>
              <span className="text-slate-600">原值合计: <strong>¥{formatAmount(totalOriginalAmount)}</strong></span>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索费用编号或名称..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
                autoComplete="off"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">全部类型</option>
              {expenseTypes.map(t => (
                <option key={t} value={t}>{getPrepaidExpenseTypeName(t)}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              {selectedExpenseIds.size === filteredExpenses.length ? '取消全选' : '全选'}
            </Button>
            <span className="text-sm text-slate-600">
              已选择 <strong>{selectedExpenseIds.size}</strong> 项
            </span>
            <Button onClick={handlePreview} disabled={selectedExpenseIds.size === 0}>
              <Calculator className="h-4 w-4 mr-2" />
              预览摊销
            </Button>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="w-10 p-3">
                    <Checkbox
                      checked={selectedExpenseIds.size === filteredExpenses.length && filteredExpenses.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left p-3 font-medium text-sm">编号</th>
                  <th className="text-left p-3 font-medium text-sm">名称</th>
                  <th className="text-left p-3 font-medium text-sm">类型</th>
                  <th className="text-right p-3 font-medium text-sm">原值</th>
                  <th className="text-right p-3 font-medium text-sm">已摊</th>
                  <th className="text-right p-3 font-medium text-sm">剩余</th>
                  <th className="text-right p-3 font-medium text-sm">每期</th>
                  <th className="text-center p-3 font-medium text-sm">摊销期</th>
                  <th className="text-left p-3 font-medium text-sm">状态</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center p-8 text-slate-500">加载中...</td></tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr><td colSpan={10} className="text-center p-8 text-slate-500">暂无在用待摊费用</td></tr>
                ) : (
                  filteredExpenses.map(expense => {
                    const isAmortized = amortizedIdsThisPeriod.has(expense.id);
                    return (
                      <tr key={expense.id} className={`border-b hover:bg-slate-50 ${isAmortized ? 'bg-slate-100' : ''}`}>
                        <td className="w-10 p-3">
                          <Checkbox
                            checked={selectedExpenseIds.has(expense.id)}
                            onCheckedChange={() => toggleExpenseSelection(expense.id)}
                            disabled={isAmortized}
                          />
                        </td>
                        <td className="p-3 text-sm font-mono">{expense.expenseCode}</td>
                        <td className="p-3 text-sm font-medium">{expense.expenseName}</td>
                        <td className="p-3 text-sm">{getPrepaidExpenseTypeName(expense.expenseType)}</td>
                        <td className="p-3 text-sm text-right">¥{formatAmount(expense.originalAmount)}</td>
                        <td className="p-3 text-sm text-right text-orange-600">¥{formatAmount(expense.amortizedAmount)}</td>
                        <td className="p-3 text-sm text-right">¥{formatAmount(expense.remainingAmount)}</td>
                        <td className="p-3 text-sm text-right">¥{formatAmount(expense.periodAmount)}</td>
                        <td className="p-3 text-sm text-center">{expense.amortizedPeriods}/{expense.amortizationPeriods}</td>
                        <td className="p-3">
                          {isAmortized ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800">已摊销</Badge>
                          ) : (
                            <Badge>待摊销</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>

        {/* Preview dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>摊销预览 - {period}</DialogTitle>
            </DialogHeader>

            {previewResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-sm text-slate-500">摊销费用数</div>
                    <div className="text-xl font-bold">{previewResult.entityCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">本期摊销总额</div>
                    <div className="text-xl font-bold text-orange-600">¥{formatAmount(previewResult.totalAmortization)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">期间</div>
                    <div className="text-xl font-bold">{previewResult.period}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500 mb-1">入账日期</div>
                    <ChineseDatePicker value={voucherDate} onChange={setVoucherDate} />
                  </div>
                </div>

                {previewResult.errors.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-sm font-medium text-red-800 mb-2">以下费用无法摊销:</div>
                    <ul className="text-sm text-red-600 space-y-1">
                      {previewResult.errors.map((err, idx) => (
                        <li key={idx}>• {err.entityName}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Voucher entries preview */}
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-4 py-2 border-b">
                    <span className="font-semibold text-slate-700">凭证分录预览</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100/50 border-b">
                        <th className="text-left p-3 font-semibold text-sm">摘要</th>
                        <th className="text-left p-3 font-semibold text-sm">科目编码</th>
                        <th className="text-left p-3 font-semibold text-sm">科目名称</th>
                        <th className="text-right p-3 font-semibold text-sm">借方</th>
                        <th className="text-right p-3 font-semibold text-sm">贷方</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generateVoucherEntries(previewResult.records, expenses).map(entry => (
                        <tr key={entry.key} className="border-b hover:bg-slate-50">
                          <td className="p-3 text-sm">{entry.summary}</td>
                          <td className="p-3 text-sm font-mono text-slate-600">{entry.subjectCode}</td>
                          <td className="p-3 text-sm">{entry.subjectName}</td>
                          <td className="p-3 text-right font-mono text-sm">
                            {entry.debit > 0 ? formatAmount(entry.debit) : ''}
                          </td>
                          <td className="p-3 text-right font-mono text-sm">
                            {entry.credit > 0 ? formatAmount(entry.credit) : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-50 border-t-2 border-green-200">
                        <td colSpan={3} className="p-3 font-semibold text-green-700">合计</td>
                        <td className="p-3 text-right font-mono font-semibold text-green-700">
                          {formatAmount(previewResult.totalAmortization)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-green-700">
                          {formatAmount(previewResult.totalAmortization)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Subject summary cards */}
                {(() => {
                  const { debitSubjects, creditSubjects } = generateSubjectSummary(previewResult.records, expenses);
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-blue-600 mb-3">
                            <TrendingUp className="h-4 w-4" />
                            <span className="font-semibold">借方发生额</span>
                          </div>
                          <div className="space-y-3">
                            {debitSubjects.map((subject, idx) => (
                              <div key={idx} className="flex justify-between items-baseline">
                                <span className="text-sm text-slate-600">
                                  <span className="font-mono text-xs">{subject.code}</span> {subject.name}
                                </span>
                                <span className="text-xl font-bold text-slate-900 font-mono">{formatAmount(subject.debit)}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-emerald-600 mb-3">
                            <TrendingDown className="h-4 w-4" />
                            <span className="font-semibold">贷方发生额</span>
                          </div>
                          <div className="space-y-3">
                            {creditSubjects.map((subject, idx) => (
                              <div key={idx} className="flex justify-between items-baseline">
                                <span className="text-sm text-slate-600">
                                  <span className="font-mono text-xs">{subject.code}</span> {subject.name}
                                </span>
                                <span className="text-xl font-bold text-slate-900 font-mono">{formatAmount(subject.credit)}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* Detail table - collapsible */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDetailTable(!showDetailTable)}
                    className="w-full px-4 py-3 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium">查看摊销明细</span>
                    {showDetailTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showDetailTable && (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="text-left p-3 text-sm font-medium">编号</th>
                          <th className="text-left p-3 text-sm font-medium">名称</th>
                          <th className="text-right p-3 text-sm font-medium">原值</th>
                          <th className="text-right p-3 text-sm font-medium">已摊</th>
                          <th className="text-right p-3 text-sm font-medium">本期摊销</th>
                          <th className="text-right p-3 text-sm font-medium">摊销后剩余</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.records.map(record => (
                          <tr key={record.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 font-mono text-sm">{record.entityCode}</td>
                            <td className="p-3 text-sm">{record.entityName}</td>
                            <td className="p-3 text-right font-mono text-sm">
                              ¥{formatAmount(expenses.find(e => e.id === record.entityId)?.originalAmount || 0)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm text-orange-600">
                              ¥{formatAmount(record.accumulatedAmortization - record.periodAmortization)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm font-medium text-blue-600">
                              ¥{formatAmount(record.periodAmortization)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm font-medium">
                              ¥{formatAmount(record.remainingAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>取消</Button>
              <Button
                onClick={handleExecute}
                disabled={isProcessing || !previewResult || previewResult.records.length === 0}
                className="gap-1"
              >
                {isProcessing ? '处理中...' : '确认生成并记账'}
                {!isProcessing && <ArrowUpRight className="h-4 w-4" />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
