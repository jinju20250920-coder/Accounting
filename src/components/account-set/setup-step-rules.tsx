'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useAccountSetStore, type SocialFundRates } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';
import {
  PAYROLL_REGION_PRESETS,
  getPayrollRegionPreset,
  inferRegionFromAddress,
  type PayrollRegionId,
} from '@/lib/payroll-defaults';
import { useFixedAssetStore } from '@/stores/useFixedAssetStore';
import { usePayrollStore } from '@/stores/usePayrollStore';
import { createBlankPayrollCalculationConfig, type PayrollCalculationConfig } from '@/lib/payroll';
import { getIndustryTemplate } from '@/lib/data/industry-templates';
import type { DepreciationMethod, PurchaseInvoiceRuleConfig } from '@/types';

// Map PayrollCalculationConfig (canonical, in usePayrollStore) → flat SocialFundRates
// used by the setup wizard form.
function payrollConfigToSocialFundRates(config: PayrollCalculationConfig): SocialFundRates {
  const si = config.socialInsurance;
  const hf = config.housingFund;
  return {
    pensionCompany: si.pension.employerRate,
    pensionPersonal: si.pension.employeeRate,
    medicalCompany: si.medical.employerRate,
    medicalPersonal: si.medical.employeeRate,
    unemploymentCompany: si.unemployment.employerRate,
    unemploymentPersonal: si.unemployment.employeeRate,
    injuryCompany: si.injury.employerRate,
    maternityCompany: si.maternity.employerRate,
    housingFundCompany: hf.employerRate,
    housingFundPersonal: hf.employeeRate,
  };
}

// Apply setup-form SocialFundRates onto an existing PayrollCalculationConfig,
// preserving individualTax / taxRules / contribution bases.
function applySocialFundRatesToConfig(
  existing: PayrollCalculationConfig,
  rates: SocialFundRates,
): PayrollCalculationConfig {
  const si = existing.socialInsurance;
  return {
    ...existing,
    socialInsurance: {
      ...si,
      pension: { ...si.pension, employerRate: rates.pensionCompany, employeeRate: rates.pensionPersonal },
      medical: { ...si.medical, employerRate: rates.medicalCompany, employeeRate: rates.medicalPersonal },
      unemployment: { ...si.unemployment, employerRate: rates.unemploymentCompany, employeeRate: rates.unemploymentPersonal },
      injury: { ...si.injury, employerRate: rates.injuryCompany },
      maternity: { ...si.maternity, employerRate: rates.maternityCompany },
    },
    housingFund: {
      ...existing.housingFund,
      employerRate: rates.housingFundCompany,
      employeeRate: rates.housingFundPersonal,
      enabled: rates.housingFundCompany > 0 || rates.housingFundPersonal > 0,
    },
  };
}

type SectionKey = 'tax' | 'tracking' | 'payroll' | 'asset' | 'invoice';

function makeSavedStorageKey(accountSetId: string): string {
  return `setup-rules-saved-${accountSetId}`;
}

function loadSavedSections(accountSetId: string): Set<SectionKey> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(makeSavedStorageKey(accountSetId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is SectionKey => typeof v === 'string'));
    return new Set();
  } catch {
    return new Set();
  }
}

function persistSavedSections(accountSetId: string, sections: Set<SectionKey>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(makeSavedStorageKey(accountSetId), JSON.stringify(Array.from(sections)));
  } catch {
    // quota / serialization errors are non-fatal
  }
}

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
  const [payrollRegion, setPayrollRegion] = useState<PayrollRegionId>('generic');
  const [socialFundRates, setSocialFundRates] = useState<SocialFundRates>({
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

  // Asset settings — categories come from useFixedAssetStore (already seeded with
  // 6 defaults: 电子设备/运输工具/办公家具/机器设备/房屋建筑物/无形资产).
  // Local overrides hold pending edits that haven't been saved yet.
  const assetCategoriesFromStore = useFixedAssetStore(s => s.categories);
  const updateCategoryInStore = useFixedAssetStore(s => s.updateCategory);
  const initializeDefaultCategories = useFixedAssetStore(s => s.initializeDefaultCategories);
  const [assetOverrides, setAssetOverrides] = useState<Record<string, { usefulLifeYears: number; depreciationMethod: DepreciationMethod }>>({});

  // Invoice settings
  const [defaultInputGroups, setDefaultInputGroups] = useState(true);
  const [defaultOutputGroups, setDefaultOutputGroups] = useState(true);

  // Tracking method settings
  const [partnerTrackingMethod, setPartnerTrackingMethod] = useState<'card' | 'subject'>('card');
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
  const [savedSections, setSavedSections] = useState<Set<SectionKey>>(() => loadSavedSections(accountSetId));
  const [dirtySections, setDirtySections] = useState<Set<SectionKey>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tax', 'payroll', 'tracking']));

  // Persist saved sections whenever they change
  useEffect(() => {
    persistSavedSections(accountSetId, savedSections);
  }, [accountSetId, savedSections]);

  // During the initial hydration tick, ignore state changes triggered by
  // the auto-recommend and load-existing use effects. Without this guard,
  // those effects would mark every section dirty on mount.
  const isHydratingRef = useRef(true);
  useEffect(() => {
    const t = window.setTimeout(() => { isHydratingRef.current = false; }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const markDirty = useCallback((section: SectionKey) => {
    if (isHydratingRef.current) return;
    setDirtySections(prev => {
      if (prev.has(section)) return prev;
      const next = new Set(prev);
      next.add(section);
      return next;
    });
  }, []);

  const clearDirty = useCallback((section: SectionKey) => {
    setDirtySections(prev => {
      if (!prev.has(section)) return prev;
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
  }, []);

  // Per-section dirty watchers — fire markDirty when relevant fields change
  // after hydration completes.
  useEffect(() => { markDirty('tax'); }, [taxpayerType, enabledTaxRates, markDirty]);
  useEffect(() => {
    markDirty('tracking');
  }, [partnerTrackingMethod, assetTrackingMethod, hasForeignCurrency, enableDepartment, enableProject, departmentList, markDirty]);
  useEffect(() => { markDirty('payroll'); }, [payrollRegion, socialFundRates, salaryPayDay, markDirty]);
  useEffect(() => { markDirty('asset'); }, [assetOverrides, markDirty]);
  useEffect(() => { markDirty('invoice'); }, [defaultInputGroups, defaultOutputGroups, markDirty]);

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
    // Load existing tracking methods + business-rule fields from account set
    if (accountSet?.accounting) {
      const a = accountSet.accounting;
      if (a.partnerTrackingMethod) setPartnerTrackingMethod(a.partnerTrackingMethod);
      if (a.assetTrackingMethod) setAssetTrackingMethod(a.assetTrackingMethod);
      if (a.hasForeignCurrency !== undefined) setHasForeignCurrency(a.hasForeignCurrency);
      if (a.enableDepartment !== undefined) setEnableDepartment(a.enableDepartment);
      if (a.enableProject !== undefined) setEnableProject(a.enableProject);
      if (a.taxpayerType) setTaxpayerType(a.taxpayerType);
      if (Array.isArray(a.enabledTaxRates) && a.enabledTaxRates.length > 0) setEnabledTaxRates(a.enabledTaxRates);
      if (a.socialFundRates) setSocialFundRates(a.socialFundRates);
      if (typeof a.salaryPayDay === 'number') setSalaryPayDay(a.salaryPayDay);
      if (typeof a.defaultInputGroups === 'boolean') setDefaultInputGroups(a.defaultInputGroups);
      if (typeof a.defaultOutputGroups === 'boolean') setDefaultOutputGroups(a.defaultOutputGroups);
    }
    // Restore payroll region (prefer explicit setting, then infer from address, then generic)
    if (accountSet?.payrollRegionId) {
      setPayrollRegion(accountSet.payrollRegionId as PayrollRegionId);
    } else if (accountSet?.address) {
      setPayrollRegion(inferRegionFromAddress(accountSet.address));
    }
    // Load existing classified words config
    if (accountSet?.voucherNumbering) {
      if (accountSet.voucherNumbering.useClassified !== undefined) setUseClassifiedWords(accountSet.voucherNumbering.useClassified);
      if (accountSet.voucherNumbering.classifiedWords) setClassifiedWords(accountSet.voucherNumbering.classifiedWords);
    }
    // Ensure asset categories are seeded (defensive — store usually seeds on init)
    if (useFixedAssetStore.getState().categories.length === 0) {
      initializeDefaultCategories().catch(() => { /* ignore */ });
    }
    // Load canonical payroll config from usePayrollStore (single source of truth for rates).
    // Overrides accounting.socialFundRates when available.
    if (accountSet?.currentPeriod && sqliteService.accountSetId !== accountSetId) {
      sqliteService.setAccountSetId(accountSetId);
    }
    const period = accountSet?.currentPeriod?.substring(0, 7);
    if (period) {
      usePayrollStore.getState().loadPeriod(period)
        .then(() => {
          const canonical = usePayrollStore.getState().config?.config;
          if (canonical) {
            setSocialFundRates(payrollConfigToSocialFundRates(canonical));
          }
        })
        .catch(() => { /* fall back to AccountSet-provided rates */ });
    }
  }, [accountSetId, initializeDefaultCategories]);

  // Auto-save tracking methods only on real unmount (user navigates away).
  // Using a ref because a cleanup-with-deps pattern fires on every dep change,
  // which races with the load effect: stale closure values from the previous
  // render get written back to the store and clobber freshly-loaded saved data.
  const trackingValuesRef = useRef({
    partnerTrackingMethod,
    assetTrackingMethod,
    hasForeignCurrency,
    enableDepartment,
    enableProject,
  });
  useEffect(() => {
    trackingValuesRef.current = {
      partnerTrackingMethod,
      assetTrackingMethod,
      hasForeignCurrency,
      enableDepartment,
      enableProject,
    };
  }, [partnerTrackingMethod, assetTrackingMethod, hasForeignCurrency, enableDepartment, enableProject]);

  useEffect(() => {
    return () => {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      if (!accountSet) return;
      const current = accountSet.accounting || {};
      const updated = trackingValuesRef.current;
      if (current.partnerTrackingMethod !== updated.partnerTrackingMethod ||
          current.assetTrackingMethod !== updated.assetTrackingMethod ||
          current.hasForeignCurrency !== updated.hasForeignCurrency ||
          current.enableDepartment !== updated.enableDepartment ||
          current.enableProject !== updated.enableProject) {
        useAccountSetStore.getState().updateAccountSet(accountSet.id, {
          accounting: { ...current, ...updated },
        });
      }
    };
  }, []);

  const handleSaveTax = async () => {
    setSaving('tax');
    try {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      if (accountSet) {
        useAccountSetStore.getState().updateAccountSet(accountSet.id, {
          accounting: {
            ...accountSet.accounting,
            taxpayerType,
            enabledTaxRates,
          },
        });
      }

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
      }).catch(() => { /* audit log is best-effort */ });

      setSavedSections(prev => {
        const next = new Set(prev) as Set<SectionKey>;
        next.add('tax');
        return next;
      });
      clearDirty('tax');
      onProgressChange({ taxConfigured: true });
      showToast('success', '税务配置已保存');
    } catch (error) {
      console.error('Save tax config failed:', error);
      showToast('error', '保存税务配置失败');
    } finally {
      setSaving(null);
    }
  };

  const handleRegionChange = (regionId: PayrollRegionId) => {
    setPayrollRegion(regionId);
    const preset = getPayrollRegionPreset(regionId);
    const si = preset.socialInsurance;
    const hf = preset.housingFund;
    setSocialFundRates({
      pensionCompany: si.pension.employerRate,
      pensionPersonal: si.pension.employeeRate,
      medicalCompany: si.medical.employerRate,
      medicalPersonal: si.medical.employeeRate,
      unemploymentCompany: si.unemployment.employerRate,
      unemploymentPersonal: si.unemployment.employeeRate,
      injuryCompany: si.injury.employerRate,
      maternityCompany: si.maternity.employerRate,
      housingFundCompany: hf.enabled ? hf.employerRate : 0,
      housingFundPersonal: hf.enabled ? hf.employeeRate : 0,
    });
  };

  const handleSavePayroll = async () => {
    setSaving('payroll');
    try {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      if (accountSet) {
        if (sqliteService.accountSetId !== accountSetId) {
          sqliteService.setAccountSetId(accountSetId);
        }

        // Write to canonical store (usePayrollStore) so /payroll page sees the same rates
        const period = accountSet.currentPeriod?.substring(0, 7);
        if (period) {
          try {
            await usePayrollStore.getState().loadPeriod(period);
          } catch { /* ignore — will create fresh */ }
          const existing = usePayrollStore.getState().config?.config ?? createBlankPayrollCalculationConfig();
          const nextConfig = applySocialFundRatesToConfig(existing, socialFundRates);
          await usePayrollStore.getState().saveConfig(period, nextConfig);
        }

        // Update AccountSet (region + salaryPayDay for quick read; socialFundRates kept as fallback cache)
        useAccountSetStore.getState().updateAccountSet(accountSet.id, {
          payrollRegionId: payrollRegion,
          accounting: {
            ...accountSet.accounting,
            socialFundRates,
            salaryPayDay,
          },
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
        await sqliteService.saveDepartments(depts);
      }

      setSavedSections(prev => {
        const next = new Set(prev) as Set<SectionKey>;
        next.add('payroll');
        return next;
      });
      clearDirty('payroll');
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
      // Push each pending override to the fixed-asset store
      for (const [categoryId, override] of Object.entries(assetOverrides)) {
        await updateCategoryInStore(categoryId, {
          defaultUsefulLifeYears: override.usefulLifeYears,
          defaultDepreciationMethod: override.depreciationMethod,
        });
      }
      setAssetOverrides({});
      setSavedSections(prev => {
        const next = new Set(prev) as Set<SectionKey>;
        next.add('asset');
        return next;
      });
      clearDirty('asset');
      onProgressChange({ assetConfigured: true });
      showToast('success', '固定资产配置已保存');
    } catch (error) {
      console.error('Save asset config failed:', error);
      showToast('error', '保存固定资产配置失败');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveInvoiceRules = async () => {
    setSaving('invoice');
    try {
      const accountSet = useAccountSetStore.getState().getCurrentAccountSet();
      if (accountSet) {
        useAccountSetStore.getState().updateAccountSet(accountSet.id, {
          accounting: {
            ...accountSet.accounting,
            defaultInputGroups,
            defaultOutputGroups,
          },
        });
      }

      // Seed purchase invoice business groups from industry template on first enable.
      // Sales-side has no rule config table yet — only the flag is persisted above.
      if (defaultInputGroups && industryTemplate) {
        const template = getIndustryTemplate(industryTemplate);
        if (template && template.businessGroups.length > 0) {
          const existing = await sqliteService.getPurchaseInvoiceRuleConfig();
          const existingNames = new Set((existing.businessGroups ?? []).map(g => g.name));
          const newGroups: PurchaseInvoiceRuleConfig['businessGroups'] = template.businessGroups
            .filter(g => g.partnerType !== 'customer')
            .filter(g => !existingNames.has(g.name))
            .map((g, idx) => ({
              id: `tpl_${industryTemplate}_${Date.now()}_${idx}_${g.name}`,
              name: g.name,
              debitSubject: g.debitSubject,
              debitSubjectName: g.debitSubjectName,
              taxSubject: g.taxSubject,
              taxSubjectName: g.taxSubjectName,
              creditSubject: g.creditSubject,
              creditSubjectName: g.creditSubjectName,
              partnerType: g.partnerType,
              priority: g.priority,
              isPreset: true,
              autoTax: !!g.taxSubject,
              keywords: g.keywords,
              requirePartnerCard: g.partnerType !== 'employee',
            }));
          if (newGroups.length > 0) {
            const nextConfig: PurchaseInvoiceRuleConfig = {
              ...existing,
              businessGroups: [...(existing.businessGroups ?? []), ...newGroups],
              updateTime: new Date().toISOString(),
            };
            await sqliteService.savePurchaseInvoiceRuleConfig(nextConfig);
          }
        }
      }

      setSavedSections(prev => {
        const next = new Set(prev) as Set<SectionKey>;
        next.add('invoice');
        return next;
      });
      clearDirty('invoice');
      onProgressChange({ invoiceRulesConfigured: true });
      showToast('success', '发票业务组配置已保存');
    } catch (error) {
      console.error('Save invoice config failed:', error);
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
      setSavedSections(prev => {
        const next = new Set(prev) as Set<SectionKey>;
        next.add('tracking');
        return next;
      });
      clearDirty('tracking');
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
                {savedSections.has('tax') && !dirtySections.has('tax') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
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
                  <Button size="sm" onClick={handleSaveTax} disabled={saving === 'tax' || !dirtySections.has('tax')} className="bg-blue-600 hover:bg-blue-700">
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
                {savedSections.has('tracking') && !dirtySections.has('tracking') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
              </div>
              <p className="text-xs text-slate-500">往来、固定资产使用卡片管理或明细科目管理</p>
            </div>
            {expandedSections.has('tracking') ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>

          {expandedSections.has('tracking') && (
            <div className="px-4 pb-4 border-t">
              <div className="space-y-4 pt-3">
                {[
                  { key: 'partner' as const, label: '往来核算', desc: '客户/供应商使用往来卡片（推荐）或按明细科目管理', value: partnerTrackingMethod, set: setPartnerTrackingMethod, cardLabel: '往来卡片', subjectLabel: '明细科目' },
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

                {/* 外币业务开关 — 控制下一步「币种汇率」是否显示 */}
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">外币业务</p>
                      <p className="text-xs text-slate-500">启用后下一步将显示「币种汇率」维护页，支持外币核算与期末调汇</p>
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
                  <Button size="sm" onClick={handleSaveTrackingMethod} disabled={saving === 'tracking' || !dirtySections.has('tracking')} className="bg-blue-600 hover:bg-blue-700">
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
                {savedSections.has('payroll') && !dirtySections.has('payroll') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
              </div>
              <p className="text-xs text-slate-500">社保公积金费率、工资发放日</p>
            </div>
            {expandedSections.has('payroll') ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>

          {expandedSections.has('payroll') && (
            <div className="px-4 pb-4 border-t">
              <div className="space-y-4 pt-2">
                {/* 社保公积金地区 */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <Label className="text-sm font-medium shrink-0">社保公积金地区</Label>
                  <select
                    value={payrollRegion}
                    onChange={(e) => handleRegionChange(e.target.value as PayrollRegionId)}
                    className="px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {PAYROLL_REGION_PRESETS.map(preset => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">
                    {getPayrollRegionPreset(payrollRegion).description}
                  </span>
                </div>

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
                  <Button size="sm" onClick={handleSavePayroll} disabled={saving === 'payroll' || !dirtySections.has('payroll')} className="bg-blue-600 hover:bg-blue-700">
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
                {savedSections.has('asset') && !dirtySections.has('asset') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
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
                        <th className="px-3 py-2 text-left font-medium text-slate-600">资产类型</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">折旧方法</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">折旧年限(年)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetCategoriesFromStore.length === 0 && (
                        <tr className="border-t">
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                            暂无资产分类，将在固定资产模块中初始化
                          </td>
                        </tr>
                      )}
                      {assetCategoriesFromStore.map((cat) => {
                        const override = assetOverrides[cat.id];
                        const method = override?.depreciationMethod ?? cat.defaultDepreciationMethod;
                        const usefulLife = override?.usefulLifeYears ?? cat.defaultUsefulLifeYears;
                        return (
                          <tr key={cat.id} className="border-t">
                            <td className="px-3 py-2 text-slate-900">{cat.name}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${cat.assetType === 'intangible' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                                {cat.assetType === 'intangible' ? '无形资产' : '固定资产'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={method}
                                onChange={(e) => {
                                  setAssetOverrides(prev => ({
                                    ...prev,
                                    [cat.id]: { usefulLifeYears: usefulLife, depreciationMethod: e.target.value as DepreciationMethod },
                                  }));
                                }}
                                className="w-full px-2 py-1 border rounded text-sm"
                              >
                                <option value="straight_line">直线法</option>
                                <option value="double_declining">双倍余额递减法</option>
                                <option value="sum_of_years">年数总和法</option>
                                <option value="units_of_production">工作量法</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={usefulLife}
                                onChange={(e) => {
                                  const years = parseInt(e.target.value) || 1;
                                  setAssetOverrides(prev => ({
                                    ...prev,
                                    [cat.id]: { usefulLifeYears: years, depreciationMethod: method },
                                  }));
                                }}
                                className="h-8 text-sm text-right"
                                min={1}
                                autoComplete="off"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <Info className="h-3.5 w-3.5 inline mr-1" />
                  以上为各类资产的默认折旧参数，实际使用时可在固定资产模块中单独调整每项资产的折旧设置
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveAsset} disabled={saving === 'asset' || !dirtySections.has('asset')} className="bg-blue-600 hover:bg-blue-700">
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
                {savedSections.has('invoice') && !dirtySections.has('invoice') && <Badge className="bg-green-50 text-green-600 text-xs">已保存</Badge>}
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
                  <Button size="sm" onClick={handleSaveInvoiceRules} disabled={saving === 'invoice' || !dirtySections.has('invoice')} className="bg-blue-600 hover:bg-blue-700">
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
