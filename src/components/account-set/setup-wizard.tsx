'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Building2,
  LayoutTemplate,
  Scale,
  Landmark,
  Settings,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Sliders,
  Globe,
  Users,
  FolderOpen,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { SetupStepCompany } from './setup-step-company';
import { SetupStepTemplate } from './setup-step-template';
import { SetupStepOpening } from './setup-step-opening';
import { SetupStepBank } from './setup-step-bank';
import { SetupStepRules } from './setup-step-rules';
import { SetupStepCurrency } from './setup-step-currency';
import { SetupStepPartners } from './setup-step-partners';
import { SetupStepFixedAssets } from './setup-step-fixed-assets';
import { SetupStepProjects } from './setup-step-projects';
import { SetupStepComplete } from './setup-step-complete';
import { canNavigateSetupStep, canProceedFromSetupStep, computeSetupSteps } from '@/lib/setup-step-rules';

interface PersistedWizardState {
  currentStepId: string;
  visitedSteps: string[];
  progress: SetupProgress;
  selectedTemplate: string | null;
}

function makeStorageKey(accountSetId: string): string {
  return `setup-wizard-progress-${accountSetId}`;
}

function loadPersistedState(accountSetId: string): PersistedWizardState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(makeStorageKey(accountSetId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWizardState;
    if (!parsed || typeof parsed !== 'object' || !parsed.currentStepId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedState(accountSetId: string, state: PersistedWizardState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(makeStorageKey(accountSetId), JSON.stringify(state));
  } catch {
    // quota errors are non-fatal — wizard still works without persistence
  }
}

function clearPersistedState(accountSetId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(makeStorageKey(accountSetId));
  } catch {
    // ignore
  }
}

export interface SetupProgress {
  completed: string[];
  current: string;
  skippedOptional: string[];
  openingBalanced: boolean;
  taxConfigured: boolean;
  payrollConfigured: boolean;
  assetConfigured: boolean;
  invoiceRulesConfigured: boolean;
}

interface SetupWizardProps {
  accountSetId: string;
  onComplete: () => void;
  mode?: 'create' | 'edit';
  initialData?: {
    name: string;
    code: string;
    taxNo: string;
    address: string;
    baseCurrency: string;
    accountingStandard: 'small-enterprise' | 'enterprise' | 'other';
    taxpayerType: 'small' | 'general';
    voucherWord: string;
    voucherNoPeriod: 'monthly' | 'yearly' | 'continuous';
    voucherNoDigits: 3 | 4 | 5;
    useClassifiedWords: boolean;
    classifiedWords: { receipt: string; payment: string; general: string };
    enableDate: string;
    startDate: string;
  };
}

const BASE_STEPS = [
  { id: 'company', label: '公司信息', icon: Building2, required: true },
  { id: 'template', label: '行业模板', icon: LayoutTemplate, required: true },
  { id: 'rules', label: '业务规则', icon: Sliders, required: false },
  { id: 'currency', label: '币种汇率', icon: Globe, required: false, conditional: 'hasForeignCurrency' as const },
  { id: 'bank', label: '银行账户', icon: Landmark, required: false, conditional: 'bankCard' as const },
  { id: 'partners', label: '往来单位', icon: Users, required: false, conditional: 'partnerCard' as const },
  { id: 'fixed-assets', label: '固定资产', icon: Building2, required: false, conditional: 'assetCard' as const },
  { id: 'projects', label: '项目核算', icon: FolderOpen, required: false, conditional: 'enableProject' as const },
  { id: 'opening', label: '期初余额', icon: Scale, required: false },
  { id: 'complete', label: '完成', icon: CheckCircle2, required: true },
];

export function SetupWizard({ accountSetId, onComplete, mode = 'create', initialData }: SetupWizardProps) {
  const { showToast } = useToast();
  const accounting = useAccountSetStore(s => s.getCurrentAccountSet()?.accounting);
  const lastVoucherFullNo = useAccountSetStore(s => s.getCurrentAccountSet()?.lastVoucherFullNo);
  const [enableProjectOverride, setEnableProjectOverride] = useState<boolean | null>(null);
  const enableProject = enableProjectOverride ?? accounting?.enableProject ?? false;

  // Compute steps based on mode and config
  const STEPS = useMemo(() => computeSetupSteps({
    baseSteps: BASE_STEPS,
    mode,
    accounting,
    enableProject,
  }), [mode, accounting, enableProject]);

  const persisted = useMemo(() => loadPersistedState(accountSetId), [accountSetId]);

  const [currentStep, setCurrentStep] = useState(0);
  // Track visited steps by ID (not index) to survive STEPS array recomputation
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set([STEPS[0]?.id || 'company']));
  const [progress, setProgress] = useState<SetupProgress>(() => {
    return persisted?.progress ?? {
      completed: [],
      current: STEPS[0]?.id || 'company',
      skippedOptional: [],
      openingBalanced: false,
      taxConfigured: false,
      payrollConfigured: false,
      assetConfigured: false,
      invoiceRulesConfigured: false,
    };
  });
  const [selectedTemplate, setSelectedTemplateState] = useState<string | null>(() => {
    return persisted?.selectedTemplate ?? null;
  });

  // Restore current step + visited from persisted state on mount (or when accountSetId changes).
  // Runs after STEPS is computed so we can map persisted stepId → index.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (restored) return;
    if (!persisted) {
      setRestored(true);
      return;
    }
    const idx = STEPS.findIndex(s => s.id === persisted.currentStepId);
    if (idx >= 0) {
      setCurrentStep(idx);
    }
    const visited = new Set(persisted.visitedSteps);
    visited.add(STEPS[idx >= 0 ? idx : 0]?.id || 'company');
    setVisitedSteps(visited);
    if (persisted.selectedTemplate) {
      setSelectedTemplateState(persisted.selectedTemplate);
    }
    setRestored(true);
  }, [persisted, STEPS, restored]);

  // Persist on changes (after initial restore is complete)
  useEffect(() => {
    if (!restored) return;
    const stepId = STEPS[currentStep]?.id;
    if (!stepId) return;
    savePersistedState(accountSetId, {
      currentStepId: stepId,
      visitedSteps: Array.from(visitedSteps),
      progress,
      selectedTemplate,
    });
  }, [restored, accountSetId, currentStep, visitedSteps, progress, selectedTemplate, STEPS]);

  // Shared state across steps
  const [companyData, setCompanyData] = useState(initialData || {
    name: '',
    code: '',
    taxNo: '',
    address: '',
    baseCurrency: '人民币',
    accountingStandard: 'small-enterprise' as const,
    taxpayerType: 'small' as const,
    voucherWord: '记',
    voucherNoPeriod: 'monthly' as const,
    voucherNoDigits: 3 as const,
    useClassifiedWords: false,
    classifiedWords: { receipt: '收', payment: '付', general: '记' },
    enableDate: '',
    startDate: '',
  });
  const setSelectedTemplate = setSelectedTemplateState;

  const markCompleted = useCallback((stepId: string) => {
    setProgress(prev => ({
      ...prev,
      completed: prev.completed.includes(stepId) ? prev.completed : [...prev.completed, stepId],
    }));
  }, []);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) {
      setCurrentStep(index);
      setVisitedSteps(prev => new Set(prev).add(STEPS[index].id));
      setProgress(prev => ({ ...prev, current: STEPS[index].id }));
    }
  }, [STEPS]);

  const handleNext = useCallback(() => {
    const step = STEPS[currentStep];
    markCompleted(step.id);

    // Save company data to account set when leaving company step
    if (step.id === 'company') {
      const store = useAccountSetStore.getState();
      store.updateAccountSet(accountSetId, {
        name: companyData.name,
        code: companyData.code,
        taxNo: companyData.taxNo,
        address: companyData.address,
        baseCurrency: companyData.baseCurrency,
        accountingStandard: companyData.accountingStandard,
        enableDate: companyData.enableDate,
        startDate: companyData.startDate,
        voucherNumbering: {
          word: companyData.voucherWord,
          period: companyData.voucherNoPeriod,
          digits: companyData.voucherNoDigits,
          useClassified: companyData.useClassifiedWords,
          classifiedWords: companyData.useClassifiedWords ? companyData.classifiedWords : undefined,
        },
      });
    }

    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, markCompleted, goToStep, STEPS, accountSetId, companyData]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  const handleSkip = useCallback(() => {
    const step = STEPS[currentStep];
    setProgress(prev => ({
      ...prev,
      skippedOptional: prev.skippedOptional.includes(step.id)
        ? prev.skippedOptional
        : [...prev.skippedOptional, step.id],
    }));
    handleNext();
  }, [currentStep, handleNext, STEPS]);

  const openProjectsStep = useCallback(() => {
    const nextSteps = computeSetupSteps({
      baseSteps: BASE_STEPS,
      mode,
      accounting,
      enableProject: true,
    });
    const projectIndex = nextSteps.findIndex(item => item.id === 'projects');
    if (projectIndex < 0) return;

    setEnableProjectOverride(true);
    setCurrentStep(projectIndex);
    setVisitedSteps(prev => new Set(prev).add('projects'));
    setProgress(prev => ({ ...prev, current: 'projects' }));
  }, [accounting, mode]);

  const handleFinish = useCallback(() => {
    setVisitedSteps(new Set(STEPS.map(s => s.id)));
    setProgress(prev => ({
      ...prev,
      completed: STEPS.map(s => s.id),
    }));
    clearPersistedState(accountSetId);
    showToast('success', '账套设置完成，欢迎使用金桔财务系统！');
    onComplete();
  }, [onComplete, showToast, STEPS, accountSetId]);

  const canGoNext = (): boolean => {
    const step = STEPS[currentStep];
    if (!canProceedFromSetupStep({ stepId: step.id, openingBalanced: progress.openingBalanced })) {
      return false;
    }
    switch (step.id) {
      case 'company':
        return !!(companyData.name && companyData.code && companyData.enableDate);
      case 'template':
        return !!selectedTemplate;
      default:
        return true;
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{mode === 'edit' ? '账套设置' : '新账套设置向导'}</h1>
              <p className="text-sm text-slate-500">{companyData.name || '新账套'}</p>
            </div>
          </div>
          <span className="text-sm text-slate-400">
            步骤 {currentStep + 1} / {STEPS.length}
          </span>
        </div>
      </div>

      {/* Stepper — free navigation via click */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const isCompleted = progress.completed.includes(s.id);
              const isCurrent = i === currentStep;
              const canNavigate = canNavigateSetupStep({
                mode,
                stepId: s.id,
                stepIndex: i,
                currentStep,
                visitedStepIds: visitedSteps,
                completedStepIds: new Set(progress.completed),
              });
              const Icon = s.icon;
              return (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => {
                      if (canNavigate) goToStep(i);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                      isCurrent
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : isCompleted
                        ? 'text-green-700 hover:bg-green-50 cursor-pointer'
                        : canNavigate
                        ? 'text-slate-600 hover:bg-slate-100 cursor-pointer'
                        : 'text-slate-300 cursor-default'
                    }`}
                    disabled={!canNavigate}
                  >
                    {isCompleted && !isCurrent ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                    {!s.required && (
                      <span className="text-xs text-slate-400 hidden sm:inline">(可选)</span>
                    )}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${i < currentStep ? 'bg-blue-400' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Card>
            <CardContent className="p-6">
              {step.id === 'company' && (
                <SetupStepCompany
                  data={companyData}
                  onChange={setCompanyData}
                  accountSetId={accountSetId}
                  lastVoucherFullNo={lastVoucherFullNo}
                />
              )}
              {step.id === 'template' && (
                <SetupStepTemplate
                  selectedTemplate={selectedTemplate}
                  onSelect={setSelectedTemplate}
                  accountingStandard={companyData.accountingStandard}
                  accountSetId={accountSetId}
                />
              )}
              {step.id === 'rules' && (
                <SetupStepRules
                  accountSetId={accountSetId}
                  taxpayerType={companyData.taxpayerType}
                  industryTemplate={selectedTemplate}
                  onProgressChange={(p) =>
                    setProgress(prev => ({ ...prev, ...p }))
                  }
                  onConfigChange={(config) => {
                    setEnableProjectOverride(config.enableProject);
                    if (config.enableProject) {
                      setVisitedSteps(prev => new Set(prev).add('projects'));
                    }
                  }}
                  onProjectSetupRequested={openProjectsStep}
                />
              )}
              {step.id === 'currency' && (
                <SetupStepCurrency accountSetId={accountSetId} />
              )}
              {step.id === 'bank' && (
                <SetupStepBank accountSetId={accountSetId} />
              )}
              {step.id === 'partners' && (
                <SetupStepPartners accountSetId={accountSetId} />
              )}
              {step.id === 'fixed-assets' && (
                <SetupStepFixedAssets accountSetId={accountSetId} />
              )}
              {step.id === 'projects' && (
                <SetupStepProjects accountSetId={accountSetId} />
              )}
              {step.id === 'opening' && (
                <SetupStepOpening
                  accountSetId={accountSetId}
                  onBalancedChange={(balanced) =>
                    setProgress(prev => ({ ...prev, openingBalanced: balanced }))
                  }
                  accounting={accounting}
                />
              )}
              {step.id === 'complete' && (
                <SetupStepComplete
                  progress={progress}
                  companyData={companyData}
                  selectedTemplate={selectedTemplate}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t px-6 py-4">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            上一步
          </Button>

          <div className="flex items-center gap-2">
            {!step.required && !isLastStep && (
              <Button variant="ghost" onClick={handleSkip} className="text-slate-500">
                <SkipForward className="h-4 w-4 mr-1" />
                跳过
              </Button>
            )}

            {isLastStep ? (
              <Button onClick={handleFinish} disabled={!canGoNext()} className="bg-blue-600 hover:bg-blue-700">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                完成设置
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canGoNext()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                下一步
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
