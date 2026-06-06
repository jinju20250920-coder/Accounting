'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { SetupStepCompany } from './setup-step-company';
import { SetupStepTemplate } from './setup-step-template';
import { SetupStepOpening } from './setup-step-opening';
import { SetupStepBank } from './setup-step-bank';
import { SetupStepRules, type BusinessRulesProgress } from './setup-step-rules';
import { SetupStepCurrency } from './setup-step-currency';
import { SetupStepPartners } from './setup-step-partners';
import { SetupStepFixedAssets } from './setup-step-fixed-assets';
import { SetupStepComplete } from './setup-step-complete';

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
    unifiedSocialCreditCode: string;
    taxNo: string;
    address: string;
    baseCurrency: string;
    accountingStandard: 'small-enterprise' | 'enterprise' | 'other';
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
  { id: 'opening', label: '期初余额', icon: Scale, required: false },
  { id: 'complete', label: '完成', icon: CheckCircle2, required: true },
];

export function SetupWizard({ accountSetId, onComplete, mode = 'create', initialData }: SetupWizardProps) {
  const { showToast } = useToast();
  const accounting = useAccountSetStore(s => s.getCurrentAccountSet()?.accounting);

  // Compute steps based on mode and config
  const STEPS = useMemo(() => {
    let steps = BASE_STEPS;
    // Remove template step in edit mode
    if (mode === 'edit') {
      steps = steps.filter(s => s.id !== 'template');
    }
    // Remove currency step if no foreign currency
    if (!accounting?.hasForeignCurrency) {
      steps = steps.filter(s => s.conditional !== 'hasForeignCurrency');
    }
    // Remove bank step if not using card tracking
    if ((accounting?.bankTrackingMethod ?? 'card') !== 'card') {
      steps = steps.filter(s => s.conditional !== 'bankCard');
    }
    // Remove partner step if not using card tracking
    if ((accounting?.partnerTrackingMethod ?? 'card') !== 'card') {
      steps = steps.filter(s => s.conditional !== 'partnerCard');
    }
    // Remove fixed asset step if not using card tracking
    if ((accounting?.assetTrackingMethod ?? 'card') !== 'card') {
      steps = steps.filter(s => s.conditional !== 'assetCard');
    }
    return steps;
  }, [mode, accounting?.hasForeignCurrency, accounting?.bankTrackingMethod, accounting?.partnerTrackingMethod, accounting?.assetTrackingMethod]);

  const [currentStep, setCurrentStep] = useState(0);
  // Track visited steps to allow free navigation
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [progress, setProgress] = useState<SetupProgress>({
    completed: [],
    current: STEPS[0]?.id || 'company',
    skippedOptional: [],
    openingBalanced: false,
    taxConfigured: false,
    payrollConfigured: false,
    assetConfigured: false,
    invoiceRulesConfigured: false,
  });

  // Shared state across steps
  const [companyData, setCompanyData] = useState(initialData || {
    name: '',
    code: '',
    unifiedSocialCreditCode: '',
    taxNo: '',
    address: '',
    baseCurrency: '人民币',
    accountingStandard: 'small-enterprise' as const,
    enableDate: '',
    startDate: '',
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const markCompleted = useCallback((stepId: string) => {
    setProgress(prev => ({
      ...prev,
      completed: prev.completed.includes(stepId) ? prev.completed : [...prev.completed, stepId],
    }));
  }, []);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) {
      setCurrentStep(index);
      setVisitedSteps(prev => new Set(prev).add(index));
      setProgress(prev => ({ ...prev, current: STEPS[index].id }));
    }
  }, [STEPS]);

  const handleNext = useCallback(() => {
    const step = STEPS[currentStep];
    markCompleted(step.id);
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, markCompleted, goToStep, STEPS]);

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

  const handleFinish = useCallback(() => {
    showToast('success', '账套设置完成，欢迎使用金桔财务系统！');
    onComplete();
  }, [onComplete, showToast]);

  const canGoNext = (): boolean => {
    const step = STEPS[currentStep];
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
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const isCompleted = progress.completed.includes(s.id);
              const isCurrent = i === currentStep;
              const isVisited = visitedSteps.has(i);
              const canNavigate = isVisited || isCompleted || i <= Math.max(currentStep, ...Array.from(visitedSteps));
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
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card>
            <CardContent className="p-6">
              {step.id === 'company' && (
                <SetupStepCompany
                  data={companyData}
                  onChange={setCompanyData}
                  accountSetId={accountSetId}
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
                  onProgressChange={(p) =>
                    setProgress(prev => ({ ...prev, ...p }))
                  }
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
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
              <Button onClick={handleFinish} className="bg-blue-600 hover:bg-blue-700">
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
