'use client';

import { useState, useEffect } from 'react';
import { usePrepaidExpenseStore } from '@/stores/usePrepaidExpenseStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Upload,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { PrepaidExpense, PrepaidExpenseType } from '@/types';
import { getPrepaidExpenseTypeName } from '@/lib/amortization';

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 费用类型选项
const expenseTypeOptions: { value: PrepaidExpenseType; label: string }[] = [
  { value: 'rent', label: '租金' },
  { value: 'insurance', label: '保险费' },
  { value: 'subscription', label: '订阅费' },
  { value: 'maintenance', label: '维护费' },
  { value: 'advertising', label: '广告费' },
  { value: 'other', label: '其他' },
];

// 费用卡片对话框组件
function PrepaidExpenseDialog({
  open,
  onOpenChange,
  expense,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: PrepaidExpense | null;
  onSave: (data: Partial<PrepaidExpense>) => void;
}) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<Partial<PrepaidExpense>>({
    expenseCode: '',
    expenseName: '',
    expenseType: 'other',
    originalAmount: 0,
    amortizedAmount: 0,
    amortizationMethod: 'straight_line',
    amortizationPeriods: 12,
    paymentDate: new Date().toISOString().split('T')[0],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    prepaidSubjectCode: '1811',
    expenseSubjectCode: '660205',
    supplierName: '',
    invoiceNo: '',
    departmentCode: '',
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData(expense);
    } else {
      setFormData({
        expenseCode: '',
        expenseName: '',
        expenseType: 'other',
        originalAmount: 0,
        amortizedAmount: 0,
        amortizationMethod: 'straight_line',
        amortizationPeriods: 12,
        paymentDate: new Date().toISOString().split('T')[0],
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        prepaidSubjectCode: '1811',
        expenseSubjectCode: '660205',
        supplierName: '',
        invoiceNo: '',
        departmentCode: '',
        notes: '',
      });
    }
  }, [expense, open]);

  const handleSubmit = () => {
    if (!formData.expenseName) {
      showToast('error', '请输入费用名称');
      return;
    }
    if (!formData.originalAmount || formData.originalAmount <= 0) {
      showToast('error', '请输入有效的原值');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      showToast('error', '请选择摊销起止日期');
      return;
    }
    if (!formData.amortizationPeriods || formData.amortizationPeriods <= 0) {
      showToast('error', '请输入有效的摊销期数');
      return;
    }

    onSave({
      ...formData,
      expenseCode: formData.expenseCode || `PE-${Date.now()}`,
      prepaidSubjectName: formData.prepaidSubjectCode === '1801' ? '长期待摊费用' : '待摊费用',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? '编辑待摊费用' : '新增待摊费用'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>费用编码</Label>
            <Input
              value={formData.expenseCode || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, expenseCode: e.target.value }))}
              placeholder="自动生成或手动输入"
            />
          </div>

          <div className="space-y-2">
            <Label required>费用名称</Label>
            <Input
              value={formData.expenseName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, expenseName: e.target.value }))}
              placeholder="请输入费用名称"
            />
          </div>

          <div className="space-y-2">
            <Label>费用类型</Label>
            <Select
              value={formData.expenseType || 'other'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, expenseType: v as PrepaidExpenseType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {expenseTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label required>原始金额</Label>
            <Input
              type="number"
              value={formData.originalAmount || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                originalAmount: parseFloat(e.target.value) || 0
              }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>摊销期数（月）</Label>
            <Input
              type="number"
              value={formData.amortizationPeriods || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                amortizationPeriods: parseInt(e.target.value) || 12
              }))}
              placeholder="12"
            />
          </div>

          <div className="space-y-2">
            <Label>付款日期</Label>
            <Input
              type="date"
              value={formData.paymentDate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label required>摊销开始日期</Label>
            <Input
              type="date"
              value={formData.startDate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label required>摊销结束日期</Label>
            <Input
              type="date"
              value={formData.endDate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>待摊科目</Label>
            <Select
              value={formData.prepaidSubjectCode || '1811'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, prepaidSubjectCode: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1811">1811 待摊费用</SelectItem>
                <SelectItem value="1801">1801 长期待摊费用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>费用科目</Label>
            <Input
              value={formData.expenseSubjectCode || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, expenseSubjectCode: e.target.value }))}
              placeholder="660205"
            />
          </div>

          <div className="space-y-2">
            <Label>供应商</Label>
            <Input
              value={formData.supplierName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
              placeholder="请输入供应商"
            />
          </div>

          <div className="space-y-2">
            <Label>发票号码</Label>
            <Input
              value={formData.invoiceNo || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, invoiceNo: e.target.value }))}
              placeholder="请输入发票号码"
            />
          </div>

          <div className="space-y-2">
            <Label>使用部门</Label>
            <Input
              value={formData.departmentCode || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, departmentCode: e.target.value }))}
              placeholder="请输入部门代码"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>备注</Label>
            <Input
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="请输入备注"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 确认删除对话框
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="py-4 text-sm text-slate-600">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="destructive" onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PrepaidExpensesPage() {
  const {
    expenses,
    loading,
    addExpense,
    updateExpense,
    deleteExpense,
    initialize,
  } = usePrepaidExpenseStore();

  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<PrepaidExpense | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 应用筛选
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = !searchQuery ||
      expense.expenseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.expenseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || expense.expenseType === typeFilter;
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleSave = async (data: Partial<PrepaidExpense>) => {
    try {
      if (selectedExpense) {
        await updateExpense(selectedExpense.id, data);
        showToast('success', '费用更新成功');
      } else {
        await addExpense(data as any);
        showToast('success', '费用添加成功');
      }
      setShowAddDialog(false);
      setSelectedExpense(null);
    } catch (error: any) {
      showToast('error', error.message || '操作失败');
    }
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    try {
      await deleteExpense(selectedExpense.id);
      showToast('success', '费用删除成功');
      setSelectedExpense(null);
    } catch (error: any) {
      showToast('error', error.message || '删除失败');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: '在摊', variant: 'default' },
      fully_amortized: { label: '已摊完', variant: 'outline' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 统计数据
  const totalOriginalAmount = expenses.reduce((sum, e) => sum + e.originalAmount, 0);
  const totalAmortizedAmount = expenses.reduce((sum, e) => sum + e.amortizedAmount, 0);
  const totalRemainingAmount = expenses.reduce((sum, e) => sum + e.remainingAmount, 0);
  const activeCount = expenses.filter(e => e.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            待摊费用管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">管理租金、保险费等待摊销费用</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            导入
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button onClick={() => {
            setSelectedExpense(null);
            setShowAddDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            新增费用
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">费用数量</div>
            <div className="text-2xl font-bold">{expenses.length} <span className="text-sm font-normal text-slate-400">在摊 {activeCount}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">原始金额</div>
            <div className="text-2xl font-bold">¥{formatMoney(totalOriginalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">已摊销金额</div>
            <div className="text-2xl font-bold text-orange-600">¥{formatMoney(totalAmortizedAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">剩余金额</div>
            <div className="text-2xl font-bold text-blue-600">¥{formatMoney(totalRemainingAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索费用编码或名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {expenseTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">在摊</SelectItem>
                <SelectItem value="fully_amortized">已摊完</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 费用列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-4 font-medium text-sm">费用编码</th>
                  <th className="text-left p-4 font-medium text-sm">费用名称</th>
                  <th className="text-left p-4 font-medium text-sm">类型</th>
                  <th className="text-right p-4 font-medium text-sm">原始金额</th>
                  <th className="text-right p-4 font-medium text-sm">已摊销</th>
                  <th className="text-right p-4 font-medium text-sm">剩余金额</th>
                  <th className="text-left p-4 font-medium text-sm">摊销进度</th>
                  <th className="text-left p-4 font-medium text-sm">每期金额</th>
                  <th className="text-left p-4 font-medium text-sm">状态</th>
                  <th className="text-center p-4 font-medium text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center p-8 text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center p-8 text-slate-500">
                      暂无费用数据
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="border-b hover:bg-slate-50">
                      <td className="p-4 text-sm font-mono">{expense.expenseCode}</td>
                      <td className="p-4 text-sm font-medium">{expense.expenseName}</td>
                      <td className="p-4 text-sm text-slate-600">{getPrepaidExpenseTypeName(expense.expenseType)}</td>
                      <td className="p-4 text-sm text-right">¥{formatMoney(expense.originalAmount)}</td>
                      <td className="p-4 text-sm text-right text-orange-600">¥{formatMoney(expense.amortizedAmount)}</td>
                      <td className="p-4 text-sm text-right font-medium">¥{formatMoney(expense.remainingAmount)}</td>
                      <td className="p-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, (expense.amortizedPeriods / expense.amortizationPeriods) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {expense.amortizedPeriods}/{expense.amortizationPeriods}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm">¥{formatMoney(expense.periodAmount)}</td>
                      <td className="p-4">{getStatusBadge(expense.status)}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedExpense(expense);
                              setShowAddDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              setSelectedExpense(expense);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 费用卡片对话框 */}
      <PrepaidExpenseDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        expense={selectedExpense}
        onSave={handleSave}
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认删除"
        message={`确定要删除待摊费用 "${selectedExpense?.expenseName}" 吗？此操作不可撤销。`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
