'use client';

import { getErrorMessage } from '@/lib/utils';
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { useToast } from '@/components/ui/toast';

interface SetupStepCurrencyProps {
  accountSetId: string;
}

const COMMON_CURRENCIES = [
  { code: 'USD', name: '美元', symbol: '$', rate: 7.25 },
  { code: 'EUR', name: '欧元', symbol: '€', rate: 7.85 },
  { code: 'HKD', name: '港币', symbol: 'HK$', rate: 0.93 },
  { code: 'JPY', name: '日元', symbol: '¥', rate: 0.048 },
  { code: 'GBP', name: '英镑', symbol: '£', rate: 9.20 },
  { code: 'SGD', name: '新加坡元', symbol: 'S$', rate: 5.45 },
  { code: 'AUD', name: '澳大利亚元', symbol: 'A$', rate: 4.72 },
  { code: 'CAD', name: '加拿大元', symbol: 'C$', rate: 5.30 },
];

export function SetupStepCurrency({ accountSetId }: SetupStepCurrencyProps) {
  const { showToast } = useToast();
  const {
    currencies,
    initializeCurrencies,
    addCurrency,
    deleteCurrency,
    upsertFxRate,
    getBaseCurrency,
  } = useCurrencyStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [customRate, setCustomRate] = useState<number>(0);

  useEffect(() => {
    initializeCurrencies();
  }, [initializeCurrencies]);

  const baseCurrency = getBaseCurrency();
  const foreignCurrencies = currencies.filter(c => !c.isBase);

  const handleAddPreset = async (preset: typeof COMMON_CURRENCIES[number]) => {
    const existing = currencies.find(c => c.code === preset.code);
    if (existing) {
      showToast('warning', `${preset.name}(${preset.code}) 已存在`);
      return;
    }

    setSaving(true);
    try {
      await addCurrency({
        code: preset.code,
        name: preset.name,
        symbol: preset.symbol,
        precision: 2,
        exchangeRate: preset.rate,
        rateStartDate: new Date().toISOString().substring(0, 10),
        gainLossSubjectCode: '6603',
        gainLossSubjectName: '财务费用-汇兑损益',
        isBase: false,
        disabled: false,
      });

      // Also create an FxRate record
      await upsertFxRate({
        accountSetId,
        rateDate: new Date().toISOString().substring(0, 10),
        currencyCode: preset.code,
        baseCurrency: baseCurrency?.code || 'CNY',
        middleRate: preset.rate,
        source: 'manual',
        createdBy: 'system',
      });

      showToast('success', `已添加 ${preset.name}(${preset.code})`);
    } catch (error: unknown) {
      showToast('error', `添加失败：${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustom = async () => {
    if (!customCode || !customName) {
      showToast('warning', '请填写币种代码和名称');
      return;
    }

    setSaving(true);
    try {
      await addCurrency({
        code: customCode.toUpperCase(),
        name: customName,
        symbol: customCode.toUpperCase(),
        precision: 2,
        exchangeRate: customRate || 1,
        rateStartDate: new Date().toISOString().substring(0, 10),
        gainLossSubjectCode: '6603',
        gainLossSubjectName: '财务费用-汇兑损益',
        isBase: false,
        disabled: false,
      });

      setCustomCode('');
      setCustomName('');
      setCustomRate(0);
      showToast('success', `已添加 ${customName}`);
    } catch (error: unknown) {
      showToast('error', `添加失败：${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRate = async (currencyId: string, newRate: number) => {
    const currency = currencies.find(c => c.id === currencyId);
    if (!currency) return;

    try {
      await upsertFxRate({
        accountSetId,
        rateDate: new Date().toISOString().substring(0, 10),
        currencyCode: currency.code,
        baseCurrency: baseCurrency?.code || 'CNY',
        middleRate: newRate,
        source: 'manual',
        createdBy: 'system',
      });
      showToast('success', `已更新 ${currency.name} 汇率`);
    } catch (error: unknown) {
      showToast('error', `更新汇率失败：${getErrorMessage(error)}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCurrency(id);
      showToast('success', '已删除');
    } catch (error: unknown) {
      showToast('error', `删除失败：${getErrorMessage(error)}`);
    }
  };

  const availablePresets = COMMON_CURRENCIES.filter(
    p => !currencies.some(c => c.code === p.code)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">外币与汇率设置</h2>
        <p className="text-sm text-slate-500 mt-1">
          添加外币币种并设置汇率。本位币为人民币(CNY)
        </p>
      </div>

      {/* Base currency info */}
      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <CheckCircle2 className="h-5 w-5 text-blue-600" />
        <div>
          <p className="text-sm font-medium text-blue-900">
            本位币：{baseCurrency?.name || '人民币'}({baseCurrency?.code || 'CNY'})
          </p>
          <p className="text-xs text-blue-700">所有外币金额将按汇率折算为本位币</p>
        </div>
      </div>

      {/* Quick add preset currencies */}
      {availablePresets.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">快速添加常用币种</Label>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map(preset => (
              <Button
                key={preset.code}
                variant="outline"
                size="sm"
                onClick={() => handleAddPreset(preset)}
                disabled={saving}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                {preset.name}({preset.code}) ≈ {preset.rate}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Custom currency add */}
      <div className="border rounded-lg p-4">
        <Label className="text-sm font-medium mb-3 block">自定义币种</Label>
        <div className="flex items-end gap-3">
          <div className="w-24">
            <Label className="text-xs text-slate-500">代码</Label>
            <Input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="THB"
              className="h-8 text-sm"
              maxLength={3}
              autoComplete="off"
            />
          </div>
          <div className="w-28">
            <Label className="text-xs text-slate-500">名称</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="泰铢"
              className="h-8 text-sm"
              autoComplete="off"
            />
          </div>
          <div className="w-28">
            <Label className="text-xs text-slate-500">汇率</Label>
            <Input
              type="number"
              value={customRate || ''}
              onChange={(e) => setCustomRate(parseFloat(e.target.value) || 0)}
              placeholder="0.20"
              className="h-8 text-sm"
              autoComplete="off"
            />
          </div>
          <Button size="sm" onClick={handleAddCustom} disabled={saving || !customCode || !customName}>
            <Plus className="h-4 w-4 mr-1" /> 添加
          </Button>
        </div>
      </div>

      {/* Currency list with rates */}
      {foreignCurrencies.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">币种</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">代码</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-32">汇率</th>
                <th className="px-3 py-2 text-center font-medium text-slate-600 w-28">状态</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {foreignCurrencies.map(currency => (
                <tr key={currency.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{currency.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-mono">{currency.code}</Badge>
                  </td>
                  <td className="px-3 py-1">
                    <Input
                      type="number"
                      value={currency.exchangeRate || ''}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        // Update local state immediately for responsiveness
                        useCurrencyStore.setState(s => ({
                          currencies: s.currencies.map(c =>
                            c.id === currency.id ? { ...c, exchangeRate: rate } : c
                          ),
                        }));
                      }}
                      onBlur={() => handleUpdateRate(currency.id, currency.exchangeRate)}
                      className="h-8 text-sm text-right"
                      step={0.0001}
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge className={currency.disabled ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}>
                      {currency.disabled ? '已禁用' : '启用'}
                    </Badge>
                  </td>
                  <td className="px-3 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(currency.id)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {foreignCurrencies.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无外币</p>
          <p className="text-sm">点击上方按钮添加常用外币</p>
        </div>
      )}
    </div>
  );
}
