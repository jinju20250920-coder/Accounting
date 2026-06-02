'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
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
  Lock,
  Unlock,
  Star,
  RefreshCw,
  DollarSign,
  CalendarDays,
  ArrowRightLeft
} from 'lucide-react';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { useSubjectStore, useAccountSetStore } from '@/stores';
import type { Currency, FxRate } from '@/types';
import { useToast } from '@/components/ui/toast';
import { exportToExcel, importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { SubjectSearch } from '@/components/voucher/subject-search';
import { Popover } from '@/components/ui/popover';

type CurrencyFormState = {
  code: string;
  name: string;
  symbol: string;
  precision: number;
  exchangeRate: number;
  rateStartDate: string;
  gainLossSubjectCode: string;
  gainLossSubjectName: string;
  isBase: boolean;
  disabled: boolean;
};

type FxFormState = {
  rateDate: string;
  currencyCode: string;
  baseCurrency: string;
  middleRate: string;
  source: string;
};

type ConfirmDialogState = {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
} | null;

const today = () => new Date().toISOString().slice(0, 10);

const createDefaultCurrencyFormState = (): CurrencyFormState => ({
  code: '',
  name: '',
  symbol: '',
  precision: 2,
  exchangeRate: 1,
  rateStartDate: today(),
  gainLossSubjectCode: '',
  gainLossSubjectName: '',
  isBase: false,
  disabled: false
});

const createDefaultFxFormState = (baseCurrency = 'CNY', currencyCode = ''): FxFormState => ({
  rateDate: today(),
  currencyCode,
  baseCurrency,
  middleRate: '1',
  source: 'manual'
});

export default function CurrenciesPage() {
  const { showToast } = useToast();
  const {
    currencies,
    fxRates,
    fxLoading,
    error,
    fxError,
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
    clearFxError,
    initializeCurrencies,
    initializeFxRates,
    importCurrencies,
    exportCurrencies,
    resetToDefault,
    upsertFxRate,
    deleteFxRate,
    getBaseCurrency
  } = useCurrencyStore();

  const { initializeSubjects } = useSubjectStore();
  const { getCurrentAccountSet } = useAccountSetStore();
  const currentAccountSet = getCurrentAccountSet();
  const baseCurrency = getBaseCurrency();

  const [activeTab, setActiveTab] = useState<'currencies' | 'fx'>('currencies');
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [currencyEditingId, setCurrencyEditingId] = useState<string | null>(null);
  const [fxDialogOpen, setFxDialogOpen] = useState(false);
  const [fxEditingId, setFxEditingId] = useState<string | null>(null);
  const [fxDateFilter, setFxDateFilter] = useState(today());
  const [currencyFormData, setCurrencyFormData] = useState<CurrencyFormState>(createDefaultCurrencyFormState());
  const [fxFormData, setFxFormData] = useState<FxFormState>(createDefaultFxFormState(baseCurrency?.code || 'CNY'));
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void initializeCurrencies();
    void initializeSubjects();
    void initializeFxRates();
  }, [initializeCurrencies, initializeFxRates, initializeSubjects]);

  useEffect(() => {
    if (!fxDialogOpen) return;
    setFxFormData(prev => ({
      ...prev,
      baseCurrency: baseCurrency?.code || 'CNY'
    }));
  }, [baseCurrency?.code, fxDialogOpen]);

  const baseCurrencyCode = baseCurrency?.code || 'CNY';
  const baseCurrencyLabel = baseCurrency ? `${baseCurrency.code} - ${baseCurrency.name}` : baseCurrencyCode;

  const filteredCurrencies = useMemo(() => {
    if (!searchQuery.trim()) return currencies;
    const query = searchQuery.toLowerCase();
    return currencies.filter(currency =>
      currency.code.toLowerCase().includes(query) ||
      currency.name.toLowerCase().includes(query) ||
      currency.symbol.includes(query)
    );
  }, [currencies, searchQuery]);

  const currencyOptions = useMemo(() => {
    return currencies
      .filter(currency => currency.code !== baseCurrencyCode)
      .sort((left, right) => left.code.localeCompare(right.code));
  }, [currencies, baseCurrencyCode]);

  const fxRows = useMemo(() => {
    const rows = fxDateFilter
      ? fxRates.filter(rate => rate.rateDate === fxDateFilter)
      : fxRates;

    return [...rows].sort((left, right) => {
      if (left.rateDate !== right.rateDate) {
        return right.rateDate.localeCompare(left.rateDate);
      }
      return left.currencyCode.localeCompare(right.currencyCode);
    });
  }, [fxDateFilter, fxRates]);

  const currencyMap = useMemo(() => {
    return new Map(currencies.map(currency => [currency.code, currency]));
  }, [currencies]);

  const resetCurrencyFormData = () => {
    setCurrencyFormData(createDefaultCurrencyFormState());
  };

  const resetFxFormData = () => {
    const firstCurrencyCode = currencyOptions[0]?.code || currencies[0]?.code || baseCurrencyCode;
    setFxFormData(createDefaultFxFormState(baseCurrencyCode, firstCurrencyCode));
  };

  const openCurrencyDialog = (currency?: Currency) => {
    if (currency) {
      setCurrencyEditingId(currency.id);
      setCurrencyFormData({
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
    } else {
      resetCurrencyFormData();
      setCurrencyEditingId(null);
    }
    setCurrencyDialogOpen(true);
  };

  const openFxDialog = (rate?: FxRate) => {
    if (rate) {
      setFxEditingId(rate.id);
      setFxFormData({
        rateDate: rate.rateDate,
        currencyCode: rate.currencyCode,
        baseCurrency: rate.baseCurrency,
        middleRate: String(rate.middleRate),
        source: rate.source || 'manual'
      });
    } else {
      resetFxFormData();
      setFxEditingId(null);
    }
    clearFxError();
    setFxDialogOpen(true);
  };

  const handleSaveCurrency = async () => {
    if (!currencyFormData.code || !currencyFormData.name) {
      showToast('error', '请填写币别代码和币别名称');
      return;
    }

    if (!currencyFormData.gainLossSubjectCode) {
      showToast('error', '请选择币别损益科目');
      return;
    }

    clearError();

    const payload = {
      code: currencyFormData.code,
      name: currencyFormData.name,
      symbol: currencyFormData.symbol,
      precision: currencyFormData.precision,
      exchangeRate: currencyFormData.exchangeRate,
      rateStartDate: currencyFormData.rateStartDate,
      gainLossSubjectCode: currencyFormData.gainLossSubjectCode,
      gainLossSubjectName: currencyFormData.gainLossSubjectName,
      isBase: currencyFormData.isBase,
      disabled: currencyFormData.disabled
    };

    if (currencyEditingId) {
      await updateCurrency(currencyEditingId, payload);
      showToast('success', '币别更新成功');
    } else {
      await addCurrency(payload);
      showToast('success', '币别添加成功');
    }

    setCurrencyDialogOpen(false);
    resetCurrencyFormData();
    setCurrencyEditingId(null);
  };

  const handleSaveFxRate = async () => {
    const middleRate = Number.parseFloat(fxFormData.middleRate);

    if (!fxFormData.rateDate) {
      showToast('error', '请选择汇率日期');
      return;
    }

    if (!fxFormData.currencyCode) {
      showToast('error', '请选择币种');
      return;
    }

    if (!Number.isFinite(middleRate) || middleRate <= 0) {
      showToast('error', '请输入有效的中间价');
      return;
    }

    clearFxError();

    await upsertFxRate({
      id: fxEditingId || undefined,
      accountSetId: currentAccountSet?.id || 'default',
      rateDate: fxFormData.rateDate,
      currencyCode: fxFormData.currencyCode,
      baseCurrency: baseCurrencyCode,
      middleRate,
      source: fxFormData.source || 'manual'
    });

    const nextError = useCurrencyStore.getState().fxError;
    if (nextError) {
      showToast('error', nextError);
      return;
    }

    showToast('success', fxEditingId ? '汇率更新成功' : '汇率添加成功');
    setFxDialogOpen(false);
    resetFxFormData();
    setFxEditingId(null);
  };

  const handleDeleteCurrency = (id: string) => {
    const currency = currencies.find(item => item.id === id);
    if (!currency) return;

    setConfirmDialog({
      open: true,
      title: '确认删除',
      description: `确认删除币别 ${currency.code} - ${currency.name} 吗？`,
      onConfirm: async () => {
        await deleteCurrency(id);
        showToast('success', '币别删除成功');
        if (selectedCurrencyId === id) {
          setSelectedCurrencyId(null);
        }
      }
    });
  };

  const handleDeleteFxRate = (id: string) => {
    const rate = fxRates.find(item => item.id === id);
    if (!rate) return;

    setConfirmDialog({
      open: true,
      title: '确认删除汇率',
      description: `确认删除 ${rate.rateDate} / ${rate.currencyCode} 的汇率记录吗？`,
      onConfirm: async () => {
        await deleteFxRate(id);
        showToast('success', '汇率删除成功');
      }
    });
  };

  const handleSetBase = (id: string) => {
    const currency = currencies.find(item => item.id === id);
    if (!currency) return;

    setConfirmDialog({
      open: true,
      title: '确认设置本位币',
      description: `确认将 ${currency.code} - ${currency.name} 设为账套本位币吗？`,
      onConfirm: async () => {
        await setBaseCurrency(id);
        showToast('success', `已将 ${currency.code} 设为账套本位币`);
      }
    });
  };

  const handleResetDefault = () => {
    setConfirmDialog({
      open: true,
      title: '确认重置',
      description: '确认重置为默认币别数据吗？所有自定义币别将被删除。',
      onConfirm: async () => {
        await resetToDefault();
        showToast('success', '已重置为默认币别数据');
      }
    });
  };

  const handleExport = () => {
    if (currencies.length === 0) {
      showToast('warning', '没有可导出的币别数据');
      return;
    }

    const exportData = currencies.map(currency => ({
      币别代码: currency.code,
      币别名称: currency.name,
      货币符号: currency.symbol,
      精度: currency.precision,
      汇率: currency.exchangeRate,
      汇率开始日期: currency.rateStartDate,
      损益科目代码: currency.gainLossSubjectCode,
      损益科目名称: currency.gainLossSubjectName,
      记账本位币: currency.isBase ? '是' : '否',
      状态: currency.disabled ? '已禁用' : '正常'
    }));

    exportToExcel(exportData, '币别数据');
    showToast('success', '导出成功');
  };

  const handleExportTemplate = () => {
    const sampleData = {
      币别代码: 'USD',
      币别名称: '美元',
      货币符号: '$',
      精度: 2,
      汇率: 7.25,
      汇率开始日期: '2026-01-01',
      损益科目代码: '6603',
      损益科目名称: '财务费用',
      记账本位币: '否',
      状态: '正常'
    };

    const headers = [
      { key: '币别代码' as any, label: '币别代码', placeholder: '例如：USD、EUR' },
      { key: '币别名称' as any, label: '币别名称', placeholder: '例如：美元、欧元' },
      { key: '货币符号' as any, label: '货币符号', placeholder: '例如：$、€' },
      { key: '精度' as any, label: '精度', placeholder: '0/1/2/4' },
      { key: '汇率' as any, label: '汇率', placeholder: '7.25' },
      { key: '汇率开始日期' as any, label: '汇率开始日期', placeholder: 'YYYY-MM-DD' },
      { key: '损益科目代码' as any, label: '损益科目代码', placeholder: '例如：6603' },
      { key: '损益科目名称' as any, label: '损益科目名称', placeholder: '例如：财务费用' },
      { key: '记账本位币' as any, label: '记账本位币', placeholder: '是/否' },
      { key: '状态' as any, label: '状态', placeholder: '正常/已禁用' }
    ];

    exportTemplate('币别数据', sampleData, headers);
    showToast('success', '模板导出成功');
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      showToast('info', '正在导入数据...');

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

      const validData = importedData.map(item => ({
        code: item.code!,
        name: item.name!,
        symbol: item.symbol || '',
        precision: typeof item.precision === 'number' ? item.precision : 2,
        exchangeRate: typeof item.exchangeRate === 'number' ? item.exchangeRate : 1,
        rateStartDate: item.rateStartDate || today(),
        gainLossSubjectCode: item.gainLossSubjectCode || '6603',
        gainLossSubjectName: item.gainLossSubjectName || '财务费用',
        isBase: String(item.isBase).toLowerCase() === '是' || !!item.isBase,
        disabled: String(item.disabled).toLowerCase() === '已禁用' || !!item.disabled
      }));

      await importCurrencies(validData);
      showToast('success', `成功导入 ${validData.length} 个币别`);
    } catch (importError) {
      showToast('error', `导入失败：${importError instanceof Error ? importError.message : '未知错误'}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubjectSelect = (subjectCode: string, subjectName: string) => {
    setCurrencyFormData(prev => ({
      ...prev,
      gainLossSubjectCode: subjectCode,
      gainLossSubjectName: subjectName
    }));
    setSubjectSearchOpen(false);
  };

  const renderCurrencyTab = () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索币别代码、名称或符号..."
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    clearError();
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openCurrencyDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              新增币别
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetDefault}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重置默认
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportTemplate}>
              <Download className="h-4 w-4 mr-2" />
              导出模板
            </Button>
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" />
              导入Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
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

      <Card>
        <CardHeader>
          <CardTitle>币别列表</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCurrencies.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无币别数据</p>
              <Button variant="outline" className="mt-4" onClick={() => openCurrencyDialog()}>
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
                  {filteredCurrencies.map(currency => (
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
                            onClick={() => openCurrencyDialog(currency)}
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
                              onClick={() => handleDeleteCurrency(currency.id)}
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
    </div>
  );

  const renderFxTab = () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="min-w-[220px]">
              <Label className="mb-2 block">日期筛选</Label>
              <Input
                type="date"
                value={fxDateFilter}
                onChange={(event) => setFxDateFilter(event.target.value)}
              />
            </div>
            <div className="min-w-[220px]">
              <Label className="mb-2 block">当前本位币</Label>
              <Input value={baseCurrencyLabel} readOnly disabled />
            </div>
            <Button variant="outline" size="sm" onClick={() => setFxDateFilter('')}>
              全部日期
            </Button>
            <Button variant="outline" size="sm" onClick={() => openFxDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              新增汇率
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            每日汇率
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fxLoading ? (
            <div className="py-10 text-center text-slate-500">正在加载汇率数据...</div>
          ) : fxRows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无汇率数据</p>
              <Button variant="outline" className="mt-4" onClick={() => openFxDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                添加第一条汇率
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">日期</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">币种</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">本位币</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">中间价</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">来源</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">更新时间</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fxRows.map(rate => {
                    const currency = currencyMap.get(rate.currencyCode);
                    return (
                      <tr key={rate.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">{rate.rateDate}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{rate.currencyCode}</span>
                            <span className="text-xs text-slate-500">{currency?.name || '未知币种'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{rate.baseCurrency}</Badge>
                        </td>
                        <td className="py-3 px-4 font-medium">{rate.middleRate.toFixed(6)}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary">{rate.source || 'manual'}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{rate.updateTime}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openFxDialog(rate)}
                              title="编辑"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => handleDeleteFxRate(rate.id)}
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {fxError && (
            <div className="mt-4">
              <Badge variant="destructive">{fxError}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">币别管理</h1>
          <p className="text-slate-600 mt-1">维护币别信息和每日汇率</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {error && (
            <Badge variant="destructive" className="text-sm">
              {error}
            </Badge>
          )}
          <Badge variant="outline">币别总数: {currencies.length}</Badge>
          <Badge variant="outline">汇率记录: {fxRates.length}</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'currencies' | 'fx')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="currencies">币种</TabsTrigger>
          <TabsTrigger value="fx">汇率</TabsTrigger>
        </TabsList>

        <TabsContent value="currencies" className="mt-6 space-y-6">
          {renderCurrencyTab()}
        </TabsContent>

        <TabsContent value="fx" className="mt-6 space-y-6">
          {renderFxTab()}
        </TabsContent>
      </Tabs>

      <Dialog
        open={currencyDialogOpen}
        onOpenChange={(open) => {
          setCurrencyDialogOpen(open);
          if (!open) {
            resetCurrencyFormData();
            setCurrencyEditingId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{currencyEditingId ? '编辑币别' : '新增币别'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>币别代码</Label>
                <Input
                  placeholder="例如：USD、EUR"
                  value={currencyFormData.code}
                  onChange={(event) => setCurrencyFormData(prev => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  disabled={currencyEditingId !== null}
                />
              </div>
              <div className="space-y-2">
                <Label required>币别名称</Label>
                <Input
                  placeholder="例如：美元、欧元"
                  value={currencyFormData.name}
                  onChange={(event) => setCurrencyFormData(prev => ({ ...prev, name: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>货币符号</Label>
                <Input
                  placeholder="例如：$、€"
                  value={currencyFormData.symbol}
                  onChange={(event) => setCurrencyFormData(prev => ({ ...prev, symbol: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>小数精度</Label>
                <select
                  value={currencyFormData.precision}
                  onChange={(event) => setCurrencyFormData(prev => ({ ...prev, precision: Number.parseInt(event.target.value, 10) }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value={0}>0 位</option>
                  <option value={1}>1 位</option>
                  <option value={2}>2 位</option>
                  <option value={4}>4 位</option>
                </select>
              </div>
            </div>

            {!currencyFormData.isBase && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>汇率（对本位币）</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="7.25"
                    value={currencyFormData.exchangeRate}
                    onChange={(event) => setCurrencyFormData(prev => ({ ...prev, exchangeRate: Number.parseFloat(event.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>汇率开始日期</Label>
                  <ChineseDatePicker
                    value={currencyFormData.rateStartDate}
                    onChange={(value) => setCurrencyFormData(prev => ({ ...prev, rateStartDate: value }))}
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
                    <SubjectSearch value={currencyFormData.gainLossSubjectCode} onSelect={handleSubjectSelect} />
                  </div>
                }
              >
                <Button variant="outline" className="w-full justify-between font-normal" onClick={() => setSubjectSearchOpen(true)}>
                  {currencyFormData.gainLossSubjectCode ? (
                    <span>
                      {currencyFormData.gainLossSubjectCode} - {currencyFormData.gainLossSubjectName}
                    </span>
                  ) : (
                    <span className="text-slate-400">请选择科目</span>
                  )}
                </Button>
              </Popover>
            </div>

            {!currencyEditingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isBase"
                  checked={currencyFormData.isBase}
                  onChange={(event) => setCurrencyFormData(prev => ({ ...prev, isBase: event.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="isBase" className="cursor-pointer">
                  设为记账本位币
                </Label>
              </div>
            )}

            {currencyEditingId && !currencyFormData.isBase && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="disabled"
                  checked={currencyFormData.disabled}
                  onChange={(event) => setCurrencyFormData(prev => ({ ...prev, disabled: event.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="disabled" className="cursor-pointer">
                  禁用此币别
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrencyDialogOpen(false);
                  resetCurrencyFormData();
                  setCurrencyEditingId(null);
                }}
              >
                取消
              </Button>
              <Button onClick={() => void handleSaveCurrency()}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fxDialogOpen}
        onOpenChange={(open) => {
          setFxDialogOpen(open);
          if (!open) {
            resetFxFormData();
            setFxEditingId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{fxEditingId ? '编辑汇率' : '新增汇率'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>日期</Label>
                <Input
                  type="date"
                  value={fxFormData.rateDate}
                  onChange={(event) => setFxFormData(prev => ({ ...prev, rateDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label required>币种</Label>
                <select
                  value={fxFormData.currencyCode}
                  onChange={(event) => setFxFormData(prev => ({ ...prev, currencyCode: event.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {currencyOptions.length > 0 ? (
                    currencyOptions.map(currency => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))
                  ) : (
                    currencies.map(currency => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>本位币</Label>
              <Input value={baseCurrencyLabel} readOnly disabled />
            </div>

            <div className="space-y-2">
              <Label required>中间价</Label>
              <Input
                type="number"
                step="0.000001"
                placeholder="请输入中间价"
                value={fxFormData.middleRate}
                onChange={(event) => setFxFormData(prev => ({ ...prev, middleRate: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFxDialogOpen(false);
                  resetFxFormData();
                  setFxEditingId(null);
                }}
              >
                取消
              </Button>
              <Button onClick={() => void handleSaveFxRate()}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDialog?.open || false}
        onOpenChange={(open) => setConfirmDialog(prev => (prev ? { ...prev, open } : null))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title || '确认操作'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 text-center">{confirmDialog?.description || '确认执行此操作吗？'}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} className="shadow-sm">
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void confirmDialog?.onConfirm();
                setConfirmDialog(null);
              }}
              className="shadow-sm"
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
