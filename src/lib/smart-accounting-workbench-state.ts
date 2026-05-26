'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  SmartAccountingRisk,
  SmartAccountingSummary,
  SmartAccountingTask,
  SmartTaskStatus,
} from './smart-accounting-workbench';

export type SmartWorkbenchEditableStatus = SmartTaskStatus | 'confirmed_not_needed';

export interface SmartWorkbenchTaskOverride {
  status: SmartWorkbenchEditableStatus;
  note?: string;
  updatedAt: string;
}

export type SmartWorkbenchTaskOverrides = Record<string, SmartWorkbenchTaskOverride>;
export type SmartWorkbenchPeriodOverrides = Record<string, SmartWorkbenchTaskOverrides>;
export type SmartWorkbenchAccountOverrides = Record<string, SmartWorkbenchPeriodOverrides>;

export interface SmartAccountingTaskView extends Omit<SmartAccountingTask, 'status'> {
  systemStatus: SmartTaskStatus;
  isUserEdited: boolean;
  status: SmartWorkbenchEditableStatus;
  overrideStatus?: SmartWorkbenchEditableStatus;
  note?: string;
  updatedAt?: string;
}

export interface SmartAccountingSummaryView extends Omit<
  SmartAccountingSummary,
  'tasks' | 'risks' | 'nextActions' | 'completedCount' | 'pendingCount' | 'warningCount' | 'blockerCount' | 'progress' | 'canClose'
> {
  tasks: SmartAccountingTaskView[];
  risks: SmartAccountingRisk[];
  nextActions: SmartAccountingRisk[];
  completedCount: number;
  pendingCount: number;
  warningCount: number;
  blockerCount: number;
  progress: number;
  canClose: boolean;
}

export interface ApplySmartAccountingOverridesOptions {
  suppressCompletedTaskRisks?: boolean;
}

const TASK_RISK_CODE_MAP: Record<string, string[]> = {
  bank_import_check: ['bank_import_missing', 'bank_voucher_missing'],
  invoice_voucher_check: ['invoice_voucher_missing'],
  fixed_asset_depreciation_check: ['fixed_asset_depreciation_review'],
  prepaid_amortization_check: ['prepaid_amortization_review'],
  key_subject_no_activity_check: ['key_subject_no_activity_review'],
  voucher_balance_check: ['voucher_unbalanced'],
  voucher_posting_check: ['voucher_unposted'],
};

function normalizeStatus(status: SmartWorkbenchEditableStatus): SmartTaskStatus {
  return status === 'confirmed_not_needed' ? 'completed' : status;
}

function severityScore(severity: SmartAccountingRisk['severity']): number {
  if (severity === 'blocker') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function routePriority(code: string): number {
  if (code === 'bank_import_missing') return -1;
  return 0;
}

function buildSuppressedRiskCodes(tasks: SmartAccountingTaskView[]): Set<string> {
  const suppressed = new Set<string>();

  tasks.forEach((task) => {
    if (normalizeStatus(task.status) !== 'completed') return;

    const mappedCodes = TASK_RISK_CODE_MAP[task.code];
    if (!mappedCodes) return;

    mappedCodes.forEach((code) => suppressed.add(code));
  });

  return suppressed;
}

export function applySmartAccountingOverrides(
  summary: SmartAccountingSummary,
  overrides: SmartWorkbenchTaskOverrides = {},
  options: ApplySmartAccountingOverridesOptions = {},
): SmartAccountingSummaryView {
  const suppressCompletedTaskRisks = options.suppressCompletedTaskRisks ?? true;
  const tasks: SmartAccountingTaskView[] = summary.tasks.map((task) => {
    const override = overrides[task.code];
    const status = override?.status || task.status;

    return {
      ...task,
      systemStatus: task.status,
      status,
      isUserEdited: Boolean(override),
      overrideStatus: override?.status,
      note: override?.note,
      updatedAt: override?.updatedAt,
    };
  });

  const suppressedRiskCodes = suppressCompletedTaskRisks ? buildSuppressedRiskCodes(tasks) : new Set<string>();
  const risks = summary.risks.filter((risk) => !suppressedRiskCodes.has(risk.code));
  const nextActions = [...risks].sort((a, b) => {
    return severityScore(a.severity) - severityScore(b.severity) || routePriority(a.code) - routePriority(b.code);
  });

  const completedCount = tasks.filter((task) => normalizeStatus(task.status) === 'completed').length;
  const warningCount = risks.filter((risk) => risk.severity === 'warning').length;
  const blockerCount = risks.filter((risk) => risk.severity === 'blocker').length;
  const pendingCount = tasks.length - completedCount;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  return {
    ...summary,
    tasks,
    risks,
    nextActions,
    completedCount,
    pendingCount,
    warningCount,
    blockerCount,
    progress,
    canClose: blockerCount === 0,
  };
}

interface SmartWorkbenchStore {
  overridesByAccountSet: SmartWorkbenchAccountOverrides;
  setTaskOverride: (
    accountSetId: string,
    period: string,
    taskCode: string,
    status: SmartWorkbenchEditableStatus,
    note?: string,
  ) => void;
  clearTaskOverride: (accountSetId: string, period: string, taskCode: string) => void;
  resetPeriodOverrides: (accountSetId: string, period: string) => void;
  getPeriodOverrides: (accountSetId: string, period: string) => SmartWorkbenchTaskOverrides;
}

function cloneAccountOverrides(state: SmartWorkbenchAccountOverrides): SmartWorkbenchAccountOverrides {
  return Object.fromEntries(
    Object.entries(state).map(([accountSetId, periodOverrides]) => [
      accountSetId,
      Object.fromEntries(
        Object.entries(periodOverrides).map(([period, taskOverrides]) => [
          period,
          { ...taskOverrides },
        ]),
      ),
    ]),
  );
}

export const useSmartAccountingWorkbenchStore = create<SmartWorkbenchStore>()(
  persist(
    (set, get) => ({
      overridesByAccountSet: {},
      setTaskOverride: (accountSetId, period, taskCode, status, note) => {
        set((state) => {
          const overridesByAccountSet = cloneAccountOverrides(state.overridesByAccountSet);
          const accountOverrides = overridesByAccountSet[accountSetId] || {};
          const periodOverrides = { ...(accountOverrides[period] || {}) };

          if (!note && taskCode in periodOverrides && periodOverrides[taskCode].status === status) {
            return state;
          }

          periodOverrides[taskCode] = {
            status,
            note,
            updatedAt: new Date().toISOString(),
          };

          accountOverrides[period] = periodOverrides;
          overridesByAccountSet[accountSetId] = accountOverrides;

          return { overridesByAccountSet };
        });
      },
      clearTaskOverride: (accountSetId, period, taskCode) => {
        set((state) => {
          const overridesByAccountSet = cloneAccountOverrides(state.overridesByAccountSet);
          const accountOverrides = overridesByAccountSet[accountSetId];
          if (!accountOverrides?.[period]?.[taskCode]) {
            return state;
          }

          const periodOverrides = { ...accountOverrides[period] };
          delete periodOverrides[taskCode];

          if (Object.keys(periodOverrides).length === 0) {
            delete accountOverrides[period];
          } else {
            accountOverrides[period] = periodOverrides;
          }

          if (Object.keys(accountOverrides).length === 0) {
            delete overridesByAccountSet[accountSetId];
          } else {
            overridesByAccountSet[accountSetId] = accountOverrides;
          }

          return { overridesByAccountSet };
        });
      },
      resetPeriodOverrides: (accountSetId, period) => {
        set((state) => {
          const overridesByAccountSet = cloneAccountOverrides(state.overridesByAccountSet);
          const accountOverrides = overridesByAccountSet[accountSetId];
          if (!accountOverrides?.[period]) {
            return state;
          }

          delete accountOverrides[period];
          if (Object.keys(accountOverrides).length === 0) {
            delete overridesByAccountSet[accountSetId];
          } else {
            overridesByAccountSet[accountSetId] = accountOverrides;
          }

          return { overridesByAccountSet };
        });
      },
      getPeriodOverrides: (accountSetId, period) => {
        return get().overridesByAccountSet[accountSetId]?.[period] || {};
      },
    }),
    {
      name: 'smart-accounting-workbench-overrides',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }

        return localStorage;
      }),
      partialize: (state) => ({ overridesByAccountSet: state.overridesByAccountSet }),
    },
  ),
);
