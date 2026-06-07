import assert from 'node:assert/strict';
import {
  canNavigateSetupStep,
  canProceedFromSetupStep,
  computeSetupStepIds,
} from './src/lib/setup-step-rules';

const defaultAccounting = {
  partnerTrackingMethod: 'card' as const,
  bankTrackingMethod: 'card' as const,
  assetTrackingMethod: 'card' as const,
  hasForeignCurrency: false,
};

assert.deepEqual(
  computeSetupStepIds({
    mode: 'edit',
    accounting: defaultAccounting,
    enableProject: false,
  }),
  ['company', 'rules', 'bank', 'partners', 'fixed-assets', 'opening', 'complete'],
);

assert.deepEqual(
  computeSetupStepIds({
    mode: 'create',
    accounting: defaultAccounting,
    enableProject: true,
  }),
  ['company', 'template', 'rules', 'bank', 'partners', 'fixed-assets', 'projects', 'opening', 'complete'],
);

assert.deepEqual(
  computeSetupStepIds({
    mode: 'edit',
    accounting: { ...defaultAccounting, assetTrackingMethod: 'subject' },
    enableProject: false,
  }),
  ['company', 'rules', 'bank', 'partners', 'opening', 'complete'],
);

assert.equal(
  canNavigateSetupStep({
    mode: 'edit',
    stepId: 'opening',
    stepIndex: 5,
    currentStep: 0,
    visitedStepIds: new Set(['company']),
    completedStepIds: new Set(),
  }),
  true,
);

assert.equal(
  canNavigateSetupStep({
    mode: 'create',
    stepId: 'opening',
    stepIndex: 5,
    currentStep: 0,
    visitedStepIds: new Set(['company']),
    completedStepIds: new Set(),
  }),
  false,
);

assert.equal(canProceedFromSetupStep({ stepId: 'complete', openingBalanced: false }), false);
assert.equal(canProceedFromSetupStep({ stepId: 'complete', openingBalanced: true }), true);
assert.equal(canProceedFromSetupStep({ stepId: 'opening', openingBalanced: false }), true);

console.log('setup step rules ok');
