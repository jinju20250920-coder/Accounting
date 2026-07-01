'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
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
  ArrowRightLeft,
  X
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
  const [fxPeriodStart, setFxPeriodStart] = useState('');
  const [fxPeriodEnd, setFxPeriodEnd] = useState('');
  const [currencyFormData, setCurrencyFormData] = useState<CurrencyFormState>(createDefaultCurrencyFormState());
  const [fxFormData, setFxFormData] = useState<FxFormState>(createDefaultFxFormState(baseCurrency?.code || 'CNY'));
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);
  const [bocLoading, setBocLoading] = useState(false);
  const [bocDateDialogOpen, setBocDateDialogOpen] = useState(false);
  const [bocTargetDate, setBocTargetDate] = useState(today());
  const [bocPreviewOpen, setBocPreviewOpen] = useState(false);
  const [bocPreviewRates, setBocPreviewRates] = useState<Array<{ currencyCode: string; currencyName: string; middleRate: number; rateDate: string }>>([]);
  const [bocFetchDate, setBocFetchDate] = useState('');
  const [bocCaptchaImage, setBocCaptchaImage] = useState('');
  const [bocCaptchaText, setBocCaptchaText] = useState('');
  const [bocSessionId, setBocSessionId] = useState('');
  const [autoFetchEnabled, setAutoFetchEnabled] = useState(false);
  const [autoFetchFrequency, setAutoFetchFrequency] = useState<'daily' | 'weekly' | 'monthly_first' | 'monthly_last'>('daily');
  const [autoFetchTime, setAutoFetchTime] = useState('09:00');
  const [lastAutoFetchTime, setLastAutoFetchTime] = useState('');
  const [fxSelectedIds, setFxSelectedIds] = useState<Set<string>>(new Set());
  const [fxCurrencyFilter, setFxCurrencyFilter] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load auto-fetch settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('boc_auto_fetch_settings');
      if (saved) {
        const s = JSON.parse(saved);
        setAutoFetchEnabled(s.enabled ?? false);
        setAutoFetchFrequency(s.frequency ?? 'daily');
        setAutoFetchTime(s.time ?? '09:00');
        setLastAutoFetchTime(s.lastFetch ?? '');
      }
    } catch {}
  }, []);

  // Save auto-fetch settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('boc_auto_fetch_settings', JSON.stringify({
        enabled: autoFetchEnabled,
        frequency: autoFetchFrequency,
        time: autoFetchTime,
        lastFetch: lastAutoFetchTime,
      }));
    } catch {}
  }, [autoFetchEnabled, autoFetchFrequency, autoFetchTime, lastAutoFetchTime]);

  // Auto-fetch check on page load
  useEffect(() => {
    if (!autoFetchEnabled || !currencies.length) return;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const lastDate = lastAutoFetchTime?.slice(0, 10) || '';
    if (lastDate === todayStr) return; // already fetched today

    const [h, m] = autoFetchTime.split(':').map(Number);
    const targetMinutes = (h || 0) * 60 + (m || 0);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < targetMinutes) return; // not yet time

    // Check frequency condition
    const shouldFetch = (() => {
      switch (autoFetchFrequency) {
        case 'daily': return true;
        case 'weekly': return now.getDay() === 1; // Monday
        case 'monthly_first': return now.getDate() === 1;
        case 'monthly_last': {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow.getDate() === 1;
        }
        default: return true;
      }
    })();

    if (!shouldFetch) return;

    const systemCurrencyCodes = currencies.filter(c => !c.disabled && !c.isBase).map(c => c.code).filter(Boolean);
    if (!systemCurrencyCodes.length) return;

    const doAutoFetch = async () => {
      try {
        const params = new URLSearchParams({ currencies: systemCurrencyCodes.join(',') });
        const response = await fetch(`/api/boc-rates?${params}`);
        const data = await response.json();
        if (!response.ok || !data.rates?.length) return;

        const accountSetId = currentAccountSet?.id || 'default';
        for (const rate of data.rates) {
          await upsertFxRate({
            accountSetId,
            rateDate: todayStr,
            currencyCode: rate.currencyCode,
            baseCurrency: baseCurrencyCode,
            middleRate: rate.middleRate,
            source: 'api_boc',
          });
        }
        setLastAutoFetchTime(new Date().toISOString());
        showToast('success', `已自动获取 ${data.rates.length} 条中行汇率`);
      } catch {}
    };
    void doAutoFetch();
  }, [autoFetchEnabled, autoFetchFrequency, autoFetchTime, lastAutoFetchTime, currencies]);

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
    let rows = fxRates;

    if (fxCurrencyFilter) {
      rows = rows.filter(rate => rate.currencyCode === fxCurrencyFilter);
    }

    if (fxPeriodStart || fxPeriodEnd) {
      rows = rows.filter(rate => {
        const period = rate.rateDate.slice(0, 7);
        if (fxPeriodStart && period < fxPeriodStart) return false;
        if (fxPeriodEnd && period > fxPeriodEnd) return false;
        return true;
      });
    }

    return [...rows].sort((left, right) => {
      if (left.rateDate !== right.rateDate) {
        return right.rateDate.localeCompare(left.rateDate);
      }
      return left.currencyCode.localeCompare(right.currencyCode);
    });
  }, [fxPeriodStart, fxPeriodEnd, fxCurrencyFilter, fxRates]);

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
      { key: '币别代码', label: '币别代码', placeholder: '例如：USD、EUR' },
      { key: '币别名称', label: '币别名称', placeholder: '例如：美元、欧元' },
      { key: '货币符号', label: '货币符号', placeholder: '例如：$、€' },
      { key: '精度', label: '精度', placeholder: '0/1/2/4' },
      { key: '汇率', label: '汇率', placeholder: '7.25' },
      { key: '汇率开始日期', label: '汇率开始日期', placeholder: 'YYYY-MM-DD' },
      { key: '损益科目代码', label: '损益科目代码', placeholder: '例如：6603' },
      { key: '损益科目名称', label: '损益科目名称', placeholder: '例如：财务费用' },
      { key: '记账本位币', label: '记账本位币', placeholder: '是/否' },
      { key: '状态', label: '状态', placeholder: '正常/已禁用' }
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
        { key: 'code', label: '币别代码', required: true },
        { key: 'name', label: '币别名称', required: true },
        { key: 'symbol', label: '货币符号', required: false },
        { key: 'precision', label: '精度', required: false },
        { key: 'exchangeRate', label: '汇率', required: false },
        { key: 'rateStartDate', label: '汇率开始日期', required: false },
        { key: 'gainLossSubjectCode', label: '损益科目代码', required: false },
        { key: 'gainLossSubjectName', label: '损益科目名称', required: false },
        { key: 'isBase', label: '记账本位币', required: false },
        { key: 'disabled', label: '状态', required: false }
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

  const sourceLabels: Record<string, string> = {
    manual: '手动录入',
    import: 'Excel导入',
    api_boc: '中国银行',
    api_china: '外汇交易中心',
  };

  const getSourceLabel = (source?: string) => sourceLabels[source || 'manual'] || source || '手动录入';

  const handleOpenBocDateDialog = () => {
    setBocTargetDate(today());
    setBocCaptchaText('');
    setBocCaptchaImage('');
    setBocSessionId('');
    setBocDateDialogOpen(true);
  };

  const loadCaptcha = async () => {
    try {
      const response = await fetch('/api/boc-rates/captcha');
      const data = await response.json();
      if (!response.ok) {
        showToast('error', data.error || '获取验证码失败');
        return;
      }
      setBocCaptchaImage(data.image);
      setBocSessionId(data.sessionId);
    } catch {
      showToast('error', '获取验证码失败');
    }
  };

  const handleBocDateChange = (date: string) => {
    setBocTargetDate(date);
    setBocCaptchaText('');
    setBocCaptchaImage('');
    setBocSessionId('');
  };

  const handleFetchBocRates = async () => {
    if (!bocTargetDate) {
      showToast('error', '请输入汇率日期');
      return;
    }
    const systemCurrencyCodes = currencies
      .filter(c => !c.disabled && !c.isBase)
      .map(c => c.code)
      .filter(Boolean);
    if (systemCurrencyCodes.length === 0) {
      showToast('warning', '系统中没有配置外币币种，请先在币种页添加');
      return;
    }

    const isToday = bocTargetDate === today();
    setBocLoading(true);

    try {
      let data: {
        error?: string;
        rates?: Array<{ currencyCode: string; currencyName: string; middleRate: number; rateDate: string }>;
        warnings?: string[];
        fetchDate?: string;
      };
      if (isToday) {
        // Today: direct fetch from main page (no captcha needed)
        const params = new URLSearchParams({ currencies: systemCurrencyCodes.join(',') });
        const response = await fetch(`/api/boc-rates?${params}`);
        data = await response.json();
        if (!response.ok) {
          showToast('error', data?.error || '获取汇率失败');
          return;
        }
      } else {
        // Historical: use captcha-based search
        if (!bocCaptchaText || !bocSessionId) {
          showToast('error', '请输入验证码');
          setBocLoading(false);
          return;
        }
        const response = await fetch('/api/boc-rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: bocTargetDate,
            currencies: systemCurrencyCodes,
            captcha: bocCaptchaText,
            sessionId: bocSessionId,
          }),
        });
        data = await response.json();
        if (!response.ok) {
          // If captcha expired/wrong, reload captcha
          if (response.status === 410 || response.status === 422) {
            setBocCaptchaText('');
            setBocCaptchaImage('');
            setBocSessionId('');
          }
          showToast('error', data.error || '获取历史汇率失败');
          return;
        }
      }

      const rawRates: Array<{ currencyCode: string; currencyName: string; middleRate: number; rateDate: string }> = data.rates || [];
      // Deduplicate: keep only the first entry per currencyCode
      const seen = new Set<string>();
      const rates = rawRates.filter(r => {
        if (seen.has(r.currencyCode)) return false;
        seen.add(r.currencyCode);
        return true;
      });
      if (rates.length === 0) {
        showToast('warning', '未找到匹配的汇率数据');
        return;
      }
      if (data.warnings?.length) {
        showToast('info', data.warnings.join('；'));
      }
      setBocPreviewRates(rates);
      setBocFetchDate(data.fetchDate || bocTargetDate);
      setBocDateDialogOpen(false);
      setBocPreviewOpen(true);
    } catch {
      showToast('error', '获取汇率失败，请检查网络连接');
    } finally {
      setBocLoading(false);
    }
  };

  const handleConfirmBocImport = async () => {
    const accountSetId = currentAccountSet?.id || 'default';
    let imported = 0;
    for (const rate of bocPreviewRates) {
      await upsertFxRate({
        accountSetId,
        rateDate: bocTargetDate,
        currencyCode: rate.currencyCode,
        baseCurrency: baseCurrencyCode,
        middleRate: rate.middleRate,
        source: 'api_boc',
      });
      imported++;
    }
    showToast('success', `成功导入 ${imported} 条汇率（日期：${bocTargetDate}）`);
    setBocPreviewOpen(false);
    setBocPreviewRates([]);
  };

  const toggleFxRow = (id: string) => {
    setFxSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllFxRows = () => {
    setFxSelectedIds(prev => {
      if (prev.size === fxRows.length) return new Set();
      return new Set(fxRows.map(r => r.id));
    });
  };

  const handleBatchDeleteFxRates = () => {
    if (fxSelectedIds.size === 0) return;
    setConfirmDialog({
      open: true,
      title: '批量删除汇率',
      description: `确认删除选中的 ${fxSelectedIds.size} 条汇率记录吗？`,
      onConfirm: async () => {
        for (const id of fxSelectedIds) {
          await deleteFxRate(id);
        }
        showToast('success', `已删除 ${fxSelectedIds.size} 条汇率记录`);
        setFxSelectedIds(new Set());
      }
    });
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
                  autoComplete="off"
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
            <div className="min-w-[160px]">
              <Label className="mb-2 block">起始期间</Label>
              <ChineseMonthPicker
                value={fxPeriodStart}
                onChange={setFxPeriodStart}
                placeholder="选择起始月份"
              />
            </div>
            <span className="text-slate-400 pb-2">—</span>
            <div className="min-w-[160px]">
              <Label className="mb-2 block">结束期间</Label>
              <ChineseMonthPicker
                value={fxPeriodEnd}
                onChange={setFxPeriodEnd}
                placeholder="选择结束月份"
              />
            </div>
            <div className="min-w-[140px]">
              <Label className="mb-2 block">币种筛选</Label>
              <select
                value={fxCurrencyFilter}
                onChange={(e) => setFxCurrencyFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="">全部币种</option>
                {currencyOptions.map(c => (
                  <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px]">
              <Label className="mb-2 block">当前本位币</Label>
              <Input value={baseCurrencyLabel} readOnly disabled />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFxPeriodStart(''); setFxPeriodEnd(''); setFxCurrencyFilter(''); }}>
              重置筛选
            </Button>
            <Button variant="outline" size="sm" onClick={() => openFxDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              新增汇率
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenBocDateDialog}>
              <RefreshCw className={`h-4 w-4 mr-2 ${bocLoading ? 'animate-spin' : ''}`} />
              {bocLoading ? '获取中...' : '从中行获取'}
            </Button>
            {fxSelectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBatchDeleteFxRates}>
                <Trash2 className="h-4 w-4 mr-2" />
                删除选中 ({fxSelectedIds.size})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="h-4 w-4" />
            定时自动获取设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-4 flex-wrap">
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" checked={autoFetchEnabled} onChange={(e) => setAutoFetchEnabled(e.target.checked)} className="rounded" />
              <span className="text-sm">启用定时获取</span>
            </label>
            {autoFetchEnabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">频率</Label>
                  <select value={autoFetchFrequency} onChange={(e) => setAutoFetchFrequency(e.target.value as 'daily' | 'weekly' | 'monthly_first' | 'monthly_last')} className="px-3 py-1.5 border rounded-md text-sm">
                    <option value="daily">每天</option>
                    <option value="weekly">每周一</option>
                    <option value="monthly_first">每月第一天</option>
                    <option value="monthly_last">每月最后一天</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">时间</Label>
                  <input type="time" value={autoFetchTime} onChange={(e) => setAutoFetchTime(e.target.value)} className="px-3 py-1.5 border rounded-md text-sm" />
                </div>
                {lastAutoFetchTime && (
                  <span className="text-xs text-slate-400 pb-2">上次获取: {lastAutoFetchTime.replace('T', ' ').slice(0, 16)}</span>
                )}
              </>
            )}
          </div>
          {autoFetchEnabled && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-700 space-y-2">
              <p className="font-medium">自动获取规则说明</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>每次打开汇率页面时检查是否满足获取条件</li>
                <li>当天已获取过则自动跳过</li>
                <li>仅在设定时间之后才会触发（如设09:00，早上8点打开不会触发）</li>
                <li>仅获取当天中行折算价（历史汇率需手动获取）</li>
              </ul>
              <div className="pt-2 border-t border-blue-200 mt-2">
                <p className="text-blue-700 font-medium mb-1">方式2：通过 Windows 任务计划程序定时调用（应用需运行中）</p>
                <p className="text-blue-500 mb-1">步骤：Win+S 搜索"任务计划程序" → 创建基本任务 → 设置触发器 → 操作选"启动程序" → 粘贴下方命令</p>
                <code className="block bg-white px-2 py-1.5 rounded border border-blue-200 text-slate-700 select-all text-[11px] leading-relaxed">
                  {`curl -X POST http://localhost:3000/api/boc-rates/auto-fetch -H "Content-Type: application/json" -d '{"currencies":["USD","EUR"]}'`}
                </code>
                <p className="text-blue-400 mt-1">提示：将 EUR,USD 替换为系统中实际使用的币种代码</p>
              </div>
            </div>
          )}
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
                    <th className="w-10 py-3 px-2 text-center">
                      <input type="checkbox" checked={fxRows.length > 0 && fxSelectedIds.size === fxRows.length} onChange={toggleAllFxRows} className="rounded" />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">日期</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">币种</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">本位币</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">中间价</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">来源</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">录入人</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fxRows.map(rate => {
                    const currency = currencyMap.get(rate.currencyCode);
                    const checked = fxSelectedIds.has(rate.id);
                    return (
                      <tr key={rate.id} className={`${checked ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="py-3 px-2 text-center">
                          <input type="checkbox" checked={checked} onChange={() => toggleFxRow(rate.id)} className="rounded" />
                        </td>
                        <td className="py-3 px-4">{rate.rateDate.replace(/(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => `${y}年${parseInt(m)}月${parseInt(d)}日`)}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{rate.currencyCode}</span>
                            <span className="text-xs text-slate-500">{currency?.name || '未知币种'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{rate.baseCurrency}</Badge>
                        </td>
                        <td className="py-3 px-4 font-medium">{rate.middleRate.toFixed(4)}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className={rate.source === 'api_boc' ? 'bg-red-50 text-red-700 border-red-200' : ''}>
                            {getSourceLabel(rate.source)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">{rate.createdBy || '-'}</td>
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
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label required>币别名称</Label>
                <Input
                  placeholder="例如：美元、欧元"
                  value={currencyFormData.name}
                  onChange={(event) => setCurrencyFormData(prev => ({ ...prev, name: event.target.value }))}
                  autoComplete="off"
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
                  autoComplete="off"
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

            <div className="space-y-2">
              <Label required>币别损益科目</Label>
              <Popover
                open={subjectSearchOpen}
                onOpenChange={setSubjectSearchOpen}
                content={
                  <div className="w-[400px] bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
                    <SubjectSearch value={currencyFormData.gainLossSubjectCode} onSelect={handleSubjectSelect} />
                  </div>
                }
              >
                <div
                  className="w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  onClick={() => setSubjectSearchOpen(true)}
                >
                  {currencyFormData.gainLossSubjectCode ? (
                    <>
                      <span className="text-blue-700">{currencyFormData.gainLossSubjectCode} - {currencyFormData.gainLossSubjectName}</span>
                      <span
                        className="inline-flex items-center justify-center p-1 rounded hover:bg-red-50 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrencyFormData(prev => ({ ...prev, gainLossSubjectCode: '', gainLossSubjectName: '' }));
                        }}
                      >
                        <X className="h-3.5 w-3.5 text-slate-400 hover:text-red-500 pointer-events-none" />
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">请选择科目</span>
                  )}
                </div>
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
                <ChineseDatePicker
                  value={fxFormData.rateDate}
                  onChange={(value) => setFxFormData(prev => ({ ...prev, rateDate: value }))}
                  className="w-full"
                  placeholder="选择日期"
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
                autoComplete="off"
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

      <Dialog open={bocDateDialogOpen} onOpenChange={setBocDateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>从中国银行获取汇率</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label required>汇率日期</Label>
              <ChineseDatePicker
                value={bocTargetDate}
                onChange={handleBocDateChange}
                className="w-full"
                placeholder="选择汇率日期"
              />
            </div>

            {bocTargetDate && bocTargetDate !== today() && (
              <div className="space-y-2">
                <Label required>验证码</Label>
                <div className="flex items-center gap-3">
                  {bocCaptchaImage ? (
                    <img src={bocCaptchaImage} alt="验证码" className="h-10 border rounded cursor-pointer" onClick={loadCaptcha} title="点击刷新" />
                  ) : (
                    <Button variant="outline" size="sm" onClick={loadCaptcha}>获取验证码</Button>
                  )}
                  <Input
                    value={bocCaptchaText}
                    onChange={(e) => setBocCaptchaText(e.target.value)}
                    placeholder="输入验证码"
                    className="w-32"
                    autoComplete="off"
                  />
                </div>
                <p className="text-xs text-slate-400">历史汇率需通过中行验证码查询，点击图片可刷新</p>
              </div>
            )}

            <p className="text-sm text-slate-500">
              系统将自动获取已配置币种（{currencies.filter(c => !c.disabled && !c.isBase).map(c => c.code).join('、') || '无'}）的汇率
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBocDateDialogOpen(false)}>取消</Button>
            <Button onClick={() => void handleFetchBocRates()} disabled={!bocTargetDate || bocLoading || (bocTargetDate !== today() && !bocCaptchaText)}>
              {bocLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />获取中...</> : <><RefreshCw className="h-4 w-4 mr-2" />确认获取</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bocPreviewOpen} onOpenChange={(open) => { setBocPreviewOpen(open); if (!open) setBocPreviewRates([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>确认导入汇率</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span>导入日期：<span className="font-medium text-slate-900">{bocTargetDate}</span></span>
              <span>中行发布：<span className="font-medium text-slate-900">{bocFetchDate}</span></span>
              <span>共 <span className="font-medium text-slate-900">{bocPreviewRates.length}</span> 条</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">币种</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">币种名称</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">中间价（1外币=?本币）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bocPreviewRates.map((r, i) => (
                    <tr key={`${r.currencyCode}-${i}`} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium">{r.currencyCode}</td>
                      <td className="py-2 px-3 text-slate-600">{r.currencyName}</td>
                      <td className="py-2 px-3 text-right font-mono">{r.middleRate.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBocPreviewOpen(false)}>取消</Button>
            <Button onClick={() => void handleConfirmBocImport()}>
              <Save className="h-4 w-4 mr-2" />
              确认导入 ({bocPreviewRates.length})
            </Button>
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
