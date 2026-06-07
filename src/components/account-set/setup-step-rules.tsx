'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Receipt,
  Users,
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  Loader2,
  Info,
  Settings2,
  Globe,
  FolderOpen,
} from 'lucide-react';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';

interface SetupStepRulesProps {
  accountSetId: string;
  taxpayerType: 'small' | 'general';
  industryTemplate: string | null;
  onProgressChange: (progress: Partial<BusinessRulesProgress>) => void;
  onConfigChange?: (config: { enableDepartment: boolean; enableProject: boolean }) => void;
  onProjectSetupRequested?: () => void;
}

export interface BusinessRulesProgress {
  taxConfigured: boolean;
  payrollConfigured: boolean;
  assetConfigured: boolean;
  invoiceRulesConfigured: boolean;
}

const TAX_RATES = [
  { rate: 0.13, label: '13%（货物销售、加工修理修配等）' },
  { rate: 0.09, label: '9%（交通运输、建筑、房地产、农产品等）' },
  { rate: 0.06, label: '6%（现代服务、金融服务、生活服务等）' },
  { rate: 0.03, label: '3%（小规模纳税人）' },
  { rate: 0.01, label: '1%（小规模纳税人减按征收）' },
];

const INDUSTRY_TAX_RATES: Record<string, number[]> = {
  technology: [0.06, 0.13],
  service: [0.06],
  restaurant: [0.06],
  commercial: [0.13, 0.09],
  manufacturing: [0.13, 0.09],
  construction: [0.09],
};

const INDUSTRY_TAX_LABELS: Record<string, string> = {
  technology: '科技/信息技术',
  service: '现代服务',
  restaurant: '餐饮服务',
  commercial: '商贸/零售',
  manufacturing: '制造业',
  construction: '建筑业',
};

export function SetupStepRules({ accountSetId, taxpayerType: propTaxpayerType, industryTemplate, onProgressChange, onConfigChange, onProjectSetupRequested }: SetupStepRulesProps) {
  const { showToast } = useToast();

  // Tax settings
  const [taxpayerType, setTaxpayerType] = useState<'general' | 'small'>(propTaxpayerType);
  const [enabledTaxRates, setEnabledTaxRates] = useState<number[]>([]);
  const [taxBaseSubject] = useState('2221');

  // Payroll settings
  const [socialFundRates, setSocialFundRates] = useState({
    pensionCompany: 0.16,
    pensionPersonal: 0.08,
    medicalCompany: 0.095,
    medicalPersonal: 0.02,
    unemploymentCompany: 0.005,
    unemploymentPersonal: 0.005,
    injuryCompany: 0.002,
    maternityCompany: 0.008,
    housingFundCompany: 0.07,
    housingFundPersonal: 0.07,
  });
  const [salaryPayDay, setSalaryPayDay] = useState(15);

  // Asset settings
  const [assetCategories, setAssetCategories] = useState([
    { name: '电子设备', code: '160101', usefulLife: 36, depreciationMethod: 'straight-line' },
    { name: '运输设备', code: '160102', usefulLife: 48, depreciationMethod: 'straight-line' },
    { name: '办公设备', code: '160103', usefulLife: 60, depreciationMethod: 'straight-line' },
    { name: '机械设备', code: '160104', usefulLife: 120, depreciationMethod: 'straight-line' },
    { name: '房屋建筑', code: '160105', usefulLife: 240, depreciationMethod: 'straight-line' },
  ]);

  // Invoice settings
  const [defaultInputGroups, setDefaultInputGroups] = useState(true);
  const [defaultOutputGroups, setDefaultOutputGroups] = useState(true);

  // Tracking method settings
  const [partnerTrackingMethod, setPartnerTrackingMethod] = useState<'card' | 'subject'>('card');
  const [bankTrackingMethod, setBankTrackingMethod] = useState<'card' | 'subject'>('card');
  const [assetTrackingMethod, setAssetTrackingMethod] = useState<'card' | 'subject'>('card');
  const [hasForeignCurrency, setHasForeignCurrency] = useState(false);

  // Department & Project settings
  const [enableDepartment, setEnableDepartment] = useState(true);
  const [enableProject, setEnableProject] = useState(false);
  const [departmentList, setDepartmentList] = useState('管理部,财务部,销售部,技术部');

  // Classified voucher words
  const [useClassifiedWords, setUseClassifiedWords] = useState(false);
  const [classifiedWords, setClassifiedWords] = useState({ receipt: '收', payment: '付', general: '记' });

  // Auto-recommend tax rates when taxpayer type or industry changes
  useEffect(() => {
    if (propTaxpayerType === 'small') {
      setTaxpayerType('small');
      setEnabledTaxRates([0.03, 0.01]);
    } else {
      setTaxpayerType('general');
      const recommended = INDUSTRY_TAX_RATES[industryTemplate || ''] || [0.13, 0.09, 0.06];
      setEnabledTaxRates(recommended);
    }
  }, [propTaxpayerType, industryTemplate]);

  // Notify parent when department/project config changes
  useEffect(() => {
    onConfigChange?.({ enableDepartment, enableProject });
  }, [enableDepartment, enableProject, onConfigChange]);

  // Saving state
  const [saving, setSaving] = useState<string | null>(null);
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tax', 'payroll', 'tracking']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  useEffect(() => {
    const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
    if (accountSet?.payrollTaxRules) {
      // Use defaults if not set
    }
    // Load existing tracking methods from account set
    if (accountSet?.accounting) {
      if (accountSet.accounting.partnerTrackingMethod) setPartnerTrackingMethod(accountSet.accounting.partnerTrackingMethod);
      if (accountSet.accounting.bankTrackingMethod) setBankTrackingMethod(accountSet.accounting.bankTrackingMethod);
      if (accountSet.accounting.assetTrackingMethod) setAssetTrackingMethod(accountSet.accounting.assetTrackingMethod);
      if (accountSet.accounting.hasForeignCurrency !== undefined) setHasForeignCurrency(accountSet.accounting.hasForeignCurrency);
      if (accountSet.accounting.enableDepartment !== undefined) setEnableDepartment(accountSet.accounting.enableDepartment);
      if (accountSet.accounting.enableProject !== undefined) setEnableProject(accountSet.accounting.enableProject);
    }
    // Load existing classified words config
    if (accountSet?.voucherNumbering) {
      if (accountSet.voucherNumbering.useClassified !== undefined) setUseClassifiedWords(accountSet.voucherNumbering.useClassified);
      if (accountSet.voucherNumbering.classifiedWords) setClassifiedWords(accountSet.voucherNumbering.classifiedWords);
    }
  }, [accountSetId]);

  // Auto-save tracking methods when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      if (accountSet) {
        const current = accountSet.accounting || {};
        const updated = { partnerTrackingMethod, bankTrackingMethod, assetTrackingMethod, hasForeignCurrency, enableDepartment, enableProject };
        if (current.partnerTrackingMethod !== updated.partnerTrackingMethod ||
            current.bankTrackingMethod !== updated.bankTrackingMethod ||
            current.assetTrackingMethod !== updated.assetTrackingMethod ||
            current.hasForeignCurrency !== updated.hasForeignCurrency ||
            current.enableDepartment !== updated.enableDepartment ||
            current.enableProject !== updated.enableProject) {
          useAccountSetStore.getState().updateAccountSet(accountSet.id, {
            accounting: { ...current, ...updated },
          });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerTrackingMethod, bankTrackingMethod, assetTrackingMethod, hasForeignCurrency]);

  const handleSaveTax = async () => {
    setSaving('tax');
    try {
      if (sqliteService.accountSetId !== accountSetId) {
        sqliteService.setAccountSetId(accountSetId);
      }

      await sqliteService.addAuditLog({
        id: `config_tax_rates_${Date.now()}`,
        type: 'create',
        entityType: 'template',
        entityId: accountSetId,
        details: JSON.stringify({ taxpayerType, enabledTaxRates, taxBaseSubject }),
        userId: 'system',
        timestamp: new Date().toISOString(),
        accountSetId,
      });

      setSavedSections(prev => new Set(prev).add('tax'));
      onProgressChange({ taxConfigured: true });
      showToast('success', '税务配置已保存');
    } catch (error) {
      console.error('Save tax config failed:', error);
      showToast('error', '保存税务配置失败');
    } finally {
      setSaving(null);
    }
  };

  const handleSavePayroll = async () => {
    setSaving('payroll');
    try {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      if (accountSet) {
        await sqliteService.addAuditLog({
          id: `config_social_fund_${Date.now()}`,
          type: 'create',
          entityType: 'template',
          entityId: accountSet.id,
          details: JSON.stringify(socialFundRates),
          userId: 'system',
          timestamp: new Date().toISOString(),
          accountSetId,
        });

        const depts = departmentList.split(',').map((d, i) => ({
          id: `dept_preset_${i}`,
          code: `D${String(i + 1).padStart(2, '0')}`,
          name: d.trim(),
          parentId: null as string | null,
          level: 1,
          frozen: false,
          accountSetId,
        }));
        if (sqliteService.accountSetId !== accountSetId) {
          sqliteService.setAccountSetId(accountSetId);
        }
        await sqliteService.saveDepartments(depts);
      }

      setSavedSections(prev => new Set(prev).add('payroll'));
      onProgressChange({ payrollConfigured: true });
      showToast('success', '工资社保配置已保存');
    } catch (error) {
      console.error('Save payroll config failed:', error);
      showToast('error', '保存工资社保配置失败');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAsset = async () => {
    setSaving('asset');
    try {
      setSavedSections(prev => new Set(prev).add('asset'));
      onProgressChange({ assetConfigured: true });
      showToast('success', '固定资产配置已保存');
    } catch {
      showToast('error', '保存固定资产配置失败');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveInvoiceRules = async () => {
    setSaving('invoice');
    try {
      setSavedSections(prev => new Set(prev).add('invoice'));
      onProgressChange({ invoiceRulesConfigured: true });
      showToast('success', '发票业务组配置已保存');
    } catch {
      showToast('error', '保存发票配置失败');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveTrackingMethod = async () => {
    setSaving('tracking');
    try {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      if (accountSet) {
        useAccountSetStore.getState().updateAccountSet(accountSet.id, {
          accounting: {
            ...accountSet.accounting,
            partnerTrackingMethod,
            bankTrackingMethod,
            assetTrackingMethod,
            hasForeignCurrency,
            enableDepartment,
            enableProject,
          },
          voucherNumbering: {
            ...accountSet.voucherNumbering,
            word: accountSet.voucherNumbering?.word || '记',
            period: accountSet.voucherNumbering?.period || 'monthly',
            digits: accountSet.voucherNumbering?.digits || 3,
            useClassified: useClassifiedWords,
            classifiedWords: useClassifiedWords ? classifiedWords : undefined,
          },
        });
      }
      setSavedSections(prev => new Set(prev).add('tracking'));
      showToast('success', '核算方式已保存');
      if (enableProject) {
        onProjectSetupRequested?.();
      }
    } catch {
      showToast('error', '保存核算方式失败');
    } finally {
      setSaving(null);
    }
  };

  const handleTaxpayerTypeChange = (type: 'general' | 'small') => {
    setTaxpayerType(type);
    if (type === 'small') {
      setEnabledTaxRates([0.03, 0.01]);
    } else {
      const recommended = INDUSTRY_TAX_RATES[industryTemplate || ''] || [0.13, 0.09, 0.06];
      setEnabledTaxRates(recommended);
    }
  };

  const RateInput = ({ label, value, onChange }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div className="flex items-center gap-2">
      <Label className="w-28 text-sm shrink-0">{label}</Label>
      <div className="relative w-28">
        <Input
          type="number"
          value={(value * 100).toFixed(1)}
          onChange={(e) => onChange(parseFloat(e.target.value) / 100 || 0)}
          className="h-8 text-sm text-right pr-8"
          step={0.1}
          min={0}
          max={100}
          autoComplete="off"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">业务规则配置</h2>
        <p className="text-sm text-slate-500 mt-1">
          配置发票税务、工资社保、固定资产等业务规则。均可跳过，后续在设置页面中配置
        </p>
      </div>

      <div className="space-y-3">
        {/* ===== 1. 发票与税务 ===== */}
        <div className="border rounded-lg">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('tax')}
          >
            <Receipt className="h-5 w-5 text-purple-600" />
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">发票与税务</span>
                {savedSections.has('tax') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
              </div>
              <p className="text-xs text-slate-500">纳税人类型、适用税率、税金科目配置</p>
            </div>
            {expandedSections.has('tax') ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>

          {expandedSections.has('tax') && (
            <div className="px-4 pb-4 border-t">
              <div className="space-y-4 pt-2">
                {/* 纳税人类型 */}
                <div className="space-y-2">
                  <Label>纳税人类型</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleTaxpayerTypeChange('general')}
                      className={`p-3 border rounded-lg text-left text-sm transition-all ${
                        taxpayerType === 'general' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-medium">一般纳税人</p>
                      <p className="text-xs text-slate-500 mt-1">适用13%/9%/6%税率，可抵扣进项</p>
                    </button>
                    <button
                      onClick={() => handleTaxpayerTypeChange('small')}
                      className={`p-3 border rounded-lg text-left text-sm transition-all ${
                        taxpayerType === 'small' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-medium">小规模纳税人</p>
                      <p className="text-xs text-slate-500 mt-1">适用3%/1%征收率，不可抵扣</p>
                    </button>
                  </div>
                </div>

                {/* 适用税率（带行业推荐标记） */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>适用税率</Label>
                    {taxpayerType === 'general' && industryTemplate && INDUSTRY_TAX_RATES[industryTemplate] && (
                      <span className="text-xs text-blue-600">
                        根据行业「{INDUSTRY_TAX_LABELS[industryTemplate]}」推荐
                      </span>
                    )}
                    {taxpayerType === 'small' && (
                      <span className="text-xs text-blue-600">小规模纳税人推荐税率</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {TAX_RATES.map(tr => {
                      const isRecommended = enabledTaxRates.includes(tr.rate);
                      const isHiddenForSmall = taxpayerType === 'small' && (tr.rate === 0.13 || tr.rate === 0.09 || tr.rate === 0.06);
                      const isHiddenForGeneral = taxpayerType === 'general' && (tr.rate === 0.01);
                      if (isHiddenForSmall || isHiddenForGeneral) return null;
                      return (
                        <label key={tr.rate} className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg transition-colors ${
                          isRecommended ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isRecommended}
                            onChange={(e) => {
                              if (e.target.checked) setEnabledTaxRates(prev => [...prev, tr.rate]);
                              else setEnabledTaxRates(prev => prev.filter(r => r !== tr.rate));
                            }}
                            className="rounded"
                          />
                          <span>{tr.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveTax} disabled={saving === 'tax'} className="bg-blue-600 hover:bg-blue-700">
                    {saving === 'tax' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    保存税务配置
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 1.5 核算方式 ===== */}
        <div className="border rounded-lg">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('tracking')}
          >
            <Settings2 className="h-5 w-5 text-indigo-600" />
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">核算方式</span>
                {savedSections.has('tracking') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
              </div>
              <p className="text-xs text-slate-500">往来、银行、固定资产使用卡片管理或明细科目管理</p>
            </div>
            {expandedSections.has('tracking') ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>

          {expandedSections.has('tracking') && (
            <div className="px-4 pb-4 border-t">
              <div className="space-y-4 pt-3">
                {[
                  { key: 'partner' as const, label: '往来核算', desc: '客户/供应商使用往来卡片（推荐）或按明细科目管理', value: partnerTrackingMethod, set: setPartnerTrackingMethod, cardLabel: '往来卡片', subjectLabel: '明细科目' },
                  { key: 'bank' as const, label: '银行核算', desc: '银行账户使用银行卡片或按明细科目管理', value: bankTrackingMethod, set: setBankTrackingMethod, cardLabel: '银行卡片', subjectLabel: '明细科目' },
                  { key: 'asset' as const, label: '固定资产核算', desc: '固定资产使用资产卡片或按明细科目管理', value: assetTrackingMethod, set: setAssetTrackingMethod, cardLabel: '资产卡片', subjectLabel: '明细科目' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5">
                      <button
                        onClick={() => item.set('card')}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all ${item.value === 'card' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {item.cardLabel}
                      </button>
                      <button
                        onClick={() => item.set('subject')}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all ${item.value === 'subject' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {item.subjectLabel}
                      </button>
                    </div>
                  </div>
                ))}

                {/* 外币业务开关 */}
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">外币业务</p>
                      <p className="text-xs text-slate-500">启用后可设置币种和汇率，支持外币核算</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5">
                    <button
                      onClick={() => setHasForeignCurrency(false)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all ${!hasForeignCurrency ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      无外币
                    </button>
                    <button
                      onClick={() => setHasForeignCurrency(true)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all ${hasForeignCurrency ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      有外币
                    </button>
                  </div>
                </div>

                {/* 部门核算开关 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">部门核算</p>
                        <p className="text-xs text-slate-500">按部门归集费用，支持部门损益分析</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5">
                      <button
                        onClick={() => setEnableDepartment(false)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all ${!enableDepartment ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        不启用
                      </button>
                      <button
                        onClick={() => setEnableDepartment(true)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all ${enableDepartment ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        启用
                      </button>
                    </div>
                  </div>
                  {enableDepartment && (
                    <div className="pl-4 space-y-2">
                      <Label className="text-sm">部门列表</Label>
                      <Input
                        value={departmentList}
                        onChange={(e) => setDepartmentList(e.target.value)}
                        placeholder="逗号分隔，如：管理部,财务部,销售部"
                        autoComplete="off"
                      />
                      <p className="text-xs text-slate-400">多个部门用逗号分隔，保存时自动创建</p>
                    </div>
                  )}
                </div>

                {/* 项目核算开关 */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-violet-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">项目核算</p>
                      <p className="text-xs text-slate-500">按项目归集收入费用，支持项目盈亏分析</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5">
                    <button
                      onClick={() => setEnableProject(false)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all ${!enableProject ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      不启用
                    </button>
                    <button
                      onClick={() => setEnableProject(true)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all ${enableProject ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      启用
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveTrackingMethod} disabled={saving === 'tracking'} className="bg-blue-600 hover:bg-blue-700">
                    {saving === 'tracking' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    保存核算方式
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 2. 工资与社保 ===== */}
        <div className="border rounded-lg">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('payroll')}
          >
            <Users className="h-5 w-5 text-green-600" />
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">工资与社保</span>
                {savedSections.has('payroll') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
              </div>
              <p className="text-xs text-slate-500">社保公积金费率、工资发放日</p>
            </div>
            {expandedSections.has('payroll') ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>

          {expandedSections.has('payroll') && (
            <div className="px-4 pb-4 border-t">
              <div className="space-y-4 pt-2">
                {/* 社保费率 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Label className="text-sm font-medium">社保费率</Label>
                    <span className="text-xs text-slate-400">（单位%/个人%）</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <RateInput label="养老保险（单位）" value={socialFundRates.pensionCompany} onChange={v => setSocialFundRates(p => ({ ...p, pensionCompany: v }))} />
                    <RateInput label="养老保险（个人）" value={socialFundRates.pensionPersonal} onChange={v => setSocialFundRates(p => ({ ...p, pensionPersonal: v }))} />
                    <RateInput label="医疗保险（单位）" value={socialFundRates.medicalCompany} onChange={v => setSocialFundRates(p => ({ ...p, medicalCompany: v }))} />
                    <RateInput label="医疗保险（个人）" value={socialFundRates.medicalPersonal} onChange={v => setSocialFundRates(p => ({ ...p, medicalPersonal: v }))} />
                    <RateInput label="失业保险（单位）" value={socialFundRates.unemploymentCompany} onChange={v => setSocialFundRates(p => ({ ...p, unemploymentCompany: v }))} />
                    <RateInput label="失业保险（个人）" value={socialFundRates.unemploymentPersonal} onChange={v => setSocialFundRates(p => ({ ...p, unemploymentPersonal: v }))} />
                    <RateInput label="工伤保险（单位）" value={socialFundRates.injuryCompany} onChange={v => setSocialFundRates(p => ({ ...p, injuryCompany: v }))} />
                    <RateInput label="生育保险（单位）" value={socialFundRates.maternityCompany} onChange={v => setSocialFundRates(p => ({ ...p, maternityCompany: v }))} />
                  </div>
                </div>

                {/* 公积金 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Label className="text-sm font-medium">公积金费率</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <RateInput label="公积金（单位）" value={socialFundRates.housingFundCompany} onChange={v => setSocialFundRates(p => ({ ...p, housingFundCompany: v }))} />
                    <RateInput label="公积金（个人）" value={socialFundRates.housingFundPersonal} onChange={v => setSocialFundRates(p => ({ ...p, housingFundPersonal: v }))} />
                  </div>
                </div>

                {/* 工资发放日 */}
                <div className="flex items-center gap-3">
                  <Label className="text-sm w-28 shrink-0">工资发放日</Label>
                  <div className="relative w-28">
                    <Input
                      type="number"
                      value={salaryPayDay}
                      onChange={(e) => setSalaryPayDay(parseInt(e.target.value) || 15)}
                      className="h-8 text-sm text-right pr-8"
                      min={1}
                      max={28}
                      autoComplete="off"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">号</span>
                  </div>
                  <span className="text-xs text-slate-400">每月几号发放工资</span>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSavePayroll} disabled={saving === 'payroll'} className="bg-blue-600 hover:bg-blue-700">
                    {saving === 'payroll' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    保存工资社保配置
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 3. 固定资产（仅卡片模式显示） ===== */}
        {assetTrackingMethod === 'card' && (
        <div className="border rounded-lg">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('asset')}
          >
            <Building2 className="h-5 w-5 text-amber-600" />
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">固定资产</span>
                {savedSections.has('asset') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
              </div>
              <p className="text-xs text-slate-500">资产类别、折旧方法、折旧年限</p>
            </div>
            {expandedSections.has('asset') ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>

          {expandedSections.has('asset') && (
            <div className="px-4 pb-4 border-t">
              <div className="space-y-4 pt-2">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">资产类别</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">折旧方法</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">折旧年限(月)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetCategories.map((cat, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <Input
                              value={cat.name}
                              onChange={(e) => {
                                const next = [...assetCategories];
                                next[i] = { ...next[i], name: e.target.value };
                                setAssetCategories(next);
                              }}
                              className="h-8 text-sm"
                              autoComplete="off"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={cat.depreciationMethod}
                              onChange={(e) => {
                                const next = [...assetCategories];
                                next[i] = { ...next[i], depreciationMethod: e.target.value };
                                setAssetCategories(next);
                              }}
                              className="w-full px-2 py-1 border rounded text-sm"
                            >
                              <option value="straight-line">直线法</option>
                              <option value="double-declining">双倍余额递减法</option>
                              <option value="sum-of-years">年数总和法</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={cat.usefulLife}
                              onChange={(e) => {
                                const next = [...assetCategories];
                                next[i] = { ...next[i], usefulLife: parseInt(e.target.value) || 36 };
                                setAssetCategories(next);
                              }}
                              className="h-8 text-sm text-right"
                              autoComplete="off"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <Info className="h-3.5 w-3.5 inline mr-1" />
                  以上为默认配置，实际使用时可在固定资产模块中单独调整每项资产的折旧参数
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveAsset} disabled={saving === 'asset'} className="bg-blue-600 hover:bg-blue-700">
                    {saving === 'asset' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    保存固定资产配置
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ===== 4. 发票业务组 ===== */}
        <div className="border rounded-lg">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('invoice')}
          >
            <Calculator className="h-5 w-5 text-red-600" />
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">发票业务组</span>
                {savedSections.has('invoice') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
              </div>
              <p className="text-xs text-slate-500">进项/销项发票默认业务组，根据行业模板预设</p>
            </div>
            {expandedSections.has('invoice') ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>

          {expandedSections.has('invoice') && (
            <div className="px-4 pb-4 border-t">
              <div className="space-y-4 pt-2">
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={defaultInputGroups}
                      onChange={(e) => setDefaultInputGroups(e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">启用默认进项发票业务组</p>
                      <p className="text-xs text-slate-500">根据行业模板预设3-5组进项发票业务规则（如：材料采购、办公用品、差旅报销）</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={defaultOutputGroups}
                      onChange={(e) => setDefaultOutputGroups(e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">启用默认销项发票业务组</p>
                      <p className="text-xs text-slate-500">预设销项发票业务规则（如：商品销售、服务收入）</p>
                    </div>
                  </label>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <Info className="h-3.5 w-3.5 inline mr-1" />
                  勾选后将根据行业模板自动创建业务组。后续可在「设置 → 发票规则」中修改或新增
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveInvoiceRules} disabled={saving === 'invoice'} className="bg-blue-600 hover:bg-blue-700">
                    {saving === 'invoice' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    保存发票配置
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
