'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Upload,
  Download,
  Edit,
  Trash2,
  Save,
  X,
  DollarSign,
  Lock,
  Unlock,
  Star,
  RefreshCw
} from 'lucide-react';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { useSubjectStore } from '@/stores';
import { Currency } from '@/types';
import { useToast } from '@/components/ui/toast';
import { exportToExcel, importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { SubjectSearch } from '@/components/voucher/subject-search';
import { Popover } from '@/components/ui/popover';

export default function CurrenciesPage() {
  const { showToast } = useToast();
  const {
    currencies,
    error,
    searchQuery,
    selectedCurrencyId,
    addCurrency,
    updateCurrency,
    deleteCurrency,
    toggleCurrencyDisabled,
    setBaseCurrency,
    setSearchQuery,
    setSelectedCurrencyId,
    clearError,
    initializeCurrencies,
    importCurrencies,
    exportCurrencies,
    resetToDefault
  } = useCurrencyStore();

  const { subjects, initializeSubjects } = useSubjectStore();

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // 科目搜索弹出框状态
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: '',
    precision: 2,
    exchangeRate: 1,
    rateStartDate: new Date().toISOString().split('T')[0],
    gainLossSubjectCode: '',
    gainLossSubjectName: '',
    isBase: false,
    disabled: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化数据
  useEffect(() => {
    initializeCurrencies();
    initializeSubjects();
  }, [initializeCurrencies, initializeSubjects]);

  // 获取过滤后的币别
  const getFilteredCurrencies = () => {
    if (!searchQuery.trim()) return currencies;
    const query = searchQuery.toLowerCase();
    return currencies.filter(c =>
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query) ||
      c.symbol.includes(query)
    );
  };

  const filteredCurrencies = getFilteredCurrencies();

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      showToast('error', '请填写必填字段：币别代码和币别名称');
      return;
    }

    if (!formData.gainLossSubjectCode) {
      showToast('error', '请选择币别损益科目');
      return;
    }

    // 清除之前的错误
    clearError();

    const currencyData = {
      code: formData.code,
      name: formData.name,
      symbol: formData.symbol,
      precision: formData.precision,
      exchangeRate: formData.exchangeRate,
      rateStartDate: formData.rateStartDate,
      gainLossSubjectCode: formData.gainLossSubjectCode,
      gainLossSubjectName: formData.gainLossSubjectName,
      isBase: formData.isBase,
      disabled: formData.disabled
    };

    if (editingId) {
      updateCurrency(editingId, currencyData);
      showToast('success', '币别更新成功');
    } else {
      addCurrency(currencyData);
      showToast('success', '币别添加成功');
    }
    setShowDialog(false);
    resetFormData();
    setEditingId(null);
  };

  const handleEdit = (currency: Currency) => {
    setEditingId(currency.id);
    setFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      precision: currency.precision,
      exchangeRate: currency.exchangeRate,
      rateStartDate: currency.rateStartDate,
      gainLossSubjectCode: currency.gainLossSubjectCode,
      gainLossSubjectName: currency.gainLossSubjectName,
      isBase: currency.isBase,
      disabled: currency.disabled
    });
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    const currency = currencies.find(c => c.id === id);
    if (!currency) return;

    // 显示确认对话框
    setConfirmDialog({
      open: true,
      title: '确认删除',
      description: `确定要删除币别 ${currency.code} - ${currency.name} 吗？`,
      onConfirm: () => {
        deleteCurrency(id);
        showToast('success', '币别删除成功');
        if (selectedCurrencyId === id) setSelectedCurrencyId(null);
      }
    });
  };

  const handleSetBase = (id: string) => {
    const currency = currencies.find(c => c.id === id);
    if (!currency) return;

    setConfirmDialog({
      open: true,
      title: '确认设置记账本位币',
      description: `确定要将 ${currency.code} - ${currency.name} 设为记账本位币吗？`,
      onConfirm: () => {
        setBaseCurrency(id);
        showToast('success', `已将 ${currency.code} 设为记账本位币`);
      }
    });
  };

  const handleResetDefault = () => {
    setConfirmDialog({
      open: true,
      title: '确认重置',
      description: '确定要重置为默认币别数据吗？所有自定义币别将被删除。',
      onConfirm: () => {
        resetToDefault();
        showToast('success', '已重置为默认币别数据');
      }
    });
  };

  const handleExport = () => {
    if (currencies.length === 0) {
      showToast('warning', '没有可导出的币别数据');
      return;
    }

    // 准备导出数据
    const exportData = currencies.map(c => ({
      '币别代码': c.code,
      '币别名称': c.name,
      '货币符号': c.symbol,
      '精度': c.precision,
      '汇率': c.exchangeRate,
      '汇率开始日期': c.rateStartDate,
      '损益科目代码': c.gainLossSubjectCode,
      '损益科目名称': c.gainLossSubjectName,
      '记账本位币': c.isBase ? '是' : '否',
      '状态': c.disabled ? '已禁用' : '正常'
    }));

    exportToExcel(exportData, '币别数据');
    showToast('success', '导出成功');
  };

  const handleExportTemplate = () => {
    const sampleData = {
      '币别代码': 'USD',
      '币别名称': '美元',
      '货币符号': '$',
      '精度': 2,
      '汇率': 7.25,
      '汇率开始日期': '2026-01-01',
      '损益科目代码': '6603',
      '损益科目名称': '财务费用',
      '记账本位币': '否',
      '状态': '正常'
    };
    const headers = [
      { key: '币别代码' as any, label: '币别代码', placeholder: '如：USD、EUR' },
      { key: '币别名称' as any, label: '币别名称', placeholder: '如：美元、欧元' },
      { key: '货币符号' as any, label: '货币符号', placeholder: '如：$、€' },
      { key: '精度' as any, label: '精度', placeholder: '0/1/2/4' },
      { key: '汇率' as any, label: '汇率', placeholder: '7.25' },
      { key: '汇率开始日期' as any, label: '汇率开始日期', placeholder: 'YYYY-MM-DD' },
      { key: '损益科目代码' as any, label: '损益科目代码', placeholder: '如：6603' },
      { key: '损益科目名称' as any, label: '损益科目名称', placeholder: '如：财务费用' },
      { key: '记账本位币' as any, label: '记账本位币', placeholder: '是/否' },
      { key: '状态' as any, label: '状态', placeholder: '正常/已禁用' }
    ];
    exportTemplate('币别数据', sampleData, headers);
    showToast('success', '模板导出成功');
  };

  const handleImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      showToast('info', '正在导入数据...');

      // 定义Excel表格头映射
      const headers = [
        { key: 'code' as any, label: '币别代码', required: true },
        { key: 'name' as any, label: '币别名称', required: true },
        { key: 'symbol' as any, label: '货币符号', required: false },
        { key: 'precision' as any, label: '精度', required: false },
        { key: 'exchangeRate' as any, label: '汇率', required: false },
        { key: 'rateStartDate' as any, label: '汇率开始日期', required: false },
        { key: 'gainLossSubjectCode' as any, label: '损益科目代码', required: false },
        { key: 'gainLossSubjectName' as any, label: '损益科目名称', required: false },
        { key: 'isBase' as any, label: '记账本位币', required: false },
        { key: 'disabled' as any, label: '状态', required: false }
      ];

      const importedData = await importFromExcel<Omit<Currency, 'id' | 'createdAt' | 'updatedAt'>>(file, headers);

      // 处理导入数据
      const validData = importedData.map(item => ({
        code: item.code!,
        name: item.name!,
        symbol: item.symbol || '',
        precision: typeof item.precision === 'number' ? item.precision : 2,
        exchangeRate: typeof item.exchangeRate === 'number' ? item.exchangeRate : 1,
        rateStartDate: item.rateStartDate || new Date().toISOString().split('T')[0],
        gainLossSubjectCode: item.gainLossSubjectCode || '6603',
        gainLossSubjectName: item.gainLossSubjectName || '财务费用',
        isBase: String(item.isBase).toLowerCase() === '是' || !!item.isBase,
        disabled: String(item.disabled).toLowerCase() === '已禁用' || !!item.disabled
      }));

      importCurrencies(validData);
      showToast('success', `成功导入 ${validData.length} 个币别`);
    } catch (error) {
      showToast('error', `导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resetFormData = () => {
    setFormData({
      code: '',
      name: '',
      symbol: '',
      precision: 2,
      exchangeRate: 1,
      rateStartDate: new Date().toISOString().split('T')[0],
      gainLossSubjectCode: '',
      gainLossSubjectName: '',
      isBase: false,
      disabled: false
    });
  };

  const handleSubjectSelect = (subjectCode: string, subjectName: string) => {
    setFormData(prev => ({
      ...prev,
      gainLossSubjectCode: subjectCode,
      gainLossSubjectName: subjectName
    }));
    setSubjectSearchOpen(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">币别管理</h1>
          <p className="text-slate-600 mt-1">维护外币信息、汇率及币别损益科目</p>
        </div>
        <div className="flex gap-2">
          {error && (
            <Badge variant="destructive" className="text-sm">
              {error}
            </Badge>
          )}
          <Badge variant="outline">
            币别总数: {currencies.length}
          </Badge>
        </div>
      </div>

      {/* 操作栏 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索币别代码、名称或符号..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    clearError();
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { resetFormData(); setEditingId(null); setShowDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              新增币别
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefault}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              重置默认
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              导出模板
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
            >
              <Upload className="h-4 w-4 mr-2" />
              导入Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
              导出Excel
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 币别列表 */}
      <Card>
        <CardHeader>
          <CardTitle>币别列表</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCurrencies.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无币别数据</p>
              <Button variant="outline" className="mt-4" onClick={() => { resetFormData(); setShowDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                添加第一个币别
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">币别代码</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">币别名称</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">符号</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">精度</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">汇率</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">汇率开始日期</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">损益科目</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">状态</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCurrencies.map((currency) => (
                    <tr key={currency.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{currency.code}</span>
                          {currency.isBase && (
                            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                              <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                              本位币
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{currency.name}</td>
                      <td className="py-3 px-4">{currency.symbol}</td>
                      <td className="py-3 px-4">{currency.precision} 位</td>
                      <td className="py-3 px-4">
                        <span className={currency.isBase ? 'text-slate-400' : ''}>
                          {currency.isBase ? '-' : currency.exchangeRate.toFixed(currency.precision)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={currency.isBase ? 'text-slate-400' : ''}>
                          {currency.isBase ? '-' : currency.rateStartDate}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-600">
                          {currency.gainLossSubjectCode} - {currency.gainLossSubjectName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {currency.disabled ? (
                          <Badge variant="destructive">
                            <Lock className="h-3 w-3 mr-1" />
                            已禁用
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                            <Unlock className="h-3 w-3 mr-1" />
                            正常
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!currency.isBase && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleSetBase(currency.id)}
                              title="设为记账本位币"
                            >
                              <Star className="h-3.5 w-3.5 text-yellow-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(currency)}
                            title="编辑"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {!currency.isBase && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleCurrencyDisabled(currency.id)}
                              title={currency.disabled ? '启用' : '禁用'}
                            >
                              {currency.disabled ? (
                                <Unlock className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Lock className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          {!currency.isBase && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => handleDelete(currency.id)}
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑币别对话框 */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          resetFormData();
          setEditingId(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑币别' : '新增币别'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>币别代码</Label>
                <Input
                  placeholder="如：USD、EUR"
                  value={formData.code}
                  onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  disabled={editingId !== null}
                />
              </div>
              <div className="space-y-2">
                <Label required>币别名称</Label>
                <Input
                  placeholder="如：美元、欧元"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>货币符号</Label>
                <Input
                  placeholder="如：$、€"
                  value={formData.symbol}
                  onChange={e => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>小数精度</Label>
                <select
                  value={formData.precision}
                  onChange={e => setFormData(prev => ({ ...prev, precision: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value={0}>0 位</option>
                  <option value={1}>1 位</option>
                  <option value={2}>2 位</option>
                  <option value={4}>4 位</option>
                </select>
              </div>
            </div>

            {!formData.isBase && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>汇率（对本位币）</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="7.25"
                    value={formData.exchangeRate}
                    onChange={e => setFormData(prev => ({ ...prev, exchangeRate: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>汇率开始日期</Label>
                  <Input
                    type="date"
                    value={formData.rateStartDate}
                    onChange={e => setFormData(prev => ({ ...prev, rateStartDate: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label required>币别损益科目</Label>
              <Popover
                open={subjectSearchOpen}
                onOpenChange={setSubjectSearchOpen}
                content={
                  <div className="w-[400px] p-0">
                    <SubjectSearch
                      value={formData.gainLossSubjectCode}
                      onSelect={handleSubjectSelect}
                    />
                  </div>
                }
              >
                <Button
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  {formData.gainLossSubjectCode ? (
                    <span>{formData.gainLossSubjectCode} - {formData.gainLossSubjectName}</span>
                  ) : (
                    <span className="text-slate-400">请选择科目</span>
                  )}
                </Button>
              </Popover>
            </div>

            {!editingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isBase"
                  checked={formData.isBase}
                  onChange={(e) => setFormData(prev => ({ ...prev, isBase: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="isBase" className="cursor-pointer">设为记账本位币</Label>
              </div>
            )}

            {editingId && !formData.isBase && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="disabled"
                  checked={formData.disabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, disabled: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="disabled" className="cursor-pointer">禁用此币别</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDialog(false); resetFormData(); setEditingId(null); }}>
                取消
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => setConfirmDialog(prev => prev ? { ...prev, open } : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title || '确认操作'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 text-center">{confirmDialog?.description || '确定要执行此操作吗？'}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} className="shadow-sm">
              取消
            </Button>
            <Button variant="destructive" onClick={() => {
              confirmDialog?.onConfirm();
              setConfirmDialog(null);
            }} className="shadow-sm">
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
