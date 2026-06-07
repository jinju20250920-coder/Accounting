export type SetupMode = 'create' | 'edit';

export interface SetupStepDefinition {
  id: string;
  conditional?: 'hasForeignCurrency' | 'bankCard' | 'partnerCard' | 'assetCard' | 'enableProject';
}

export interface SetupAccountingConfig {
  hasForeignCurrency?: boolean;
  bankTrackingMethod?: 'card' | 'subject';
  partnerTrackingMethod?: 'card' | 'subject';
  assetTrackingMethod?: 'card' | 'subject';
}

export function computeSetupSteps<T extends SetupStepDefinition>(input: {
  baseSteps: T[];
  mode: SetupMode;
  accounting?: SetupAccountingConfig;
  enableProject: boolean;
}): T[] {
  return input.baseSteps.filter((step) => {
    if (input.mode === 'edit' && step.id === 'template') return false;
    if (step.conditional === 'hasForeignCurrency') return !!input.accounting?.hasForeignCurrency;
    if (step.conditional === 'bankCard') return (input.accounting?.bankTrackingMethod ?? 'card') === 'card';
    if (step.conditional === 'partnerCard') return (input.accounting?.partnerTrackingMethod ?? 'card') === 'card';
    if (step.conditional === 'assetCard') return (input.accounting?.assetTrackingMethod ?? 'card') === 'card';
    if (step.conditional === 'enableProject') return input.enableProject;
    return true;
  });
}

export function computeSetupStepIds(input: {
  mode: SetupMode;
  accounting?: SetupAccountingConfig;
  enableProject: boolean;
}): string[] {
  return computeSetupSteps({
    baseSteps: [
      { id: 'company' },
      { id: 'template' },
      { id: 'rules' },
      { id: 'currency', conditional: 'hasForeignCurrency' },
      { id: 'bank', conditional: 'bankCard' },
      { id: 'partners', conditional: 'partnerCard' },
      { id: 'fixed-assets', conditional: 'assetCard' },
      { id: 'projects', conditional: 'enableProject' },
      { id: 'opening' },
      { id: 'complete' },
    ],
    mode: input.mode,
    accounting: input.accounting,
    enableProject: input.enableProject,
  }).map(step => step.id);
}

export function canNavigateSetupStep(input: {
  mode: SetupMode;
  stepId: string;
  stepIndex: number;
  currentStep: number;
  visitedStepIds: Set<string>;
  completedStepIds: Set<string>;
}): boolean {
  if (input.mode === 'edit') return true;
  if (input.visitedStepIds.has(input.stepId) || input.completedStepIds.has(input.stepId)) return true;
  return input.stepIndex <= input.currentStep;
}

export function canProceedFromSetupStep(input: {
  stepId: string;
  openingBalanced: boolean;
}): boolean {
  if (input.stepId === 'complete') return input.openingBalanced;
  return true;
}
