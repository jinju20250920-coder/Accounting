'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MonthlyCheckManualStatus, MonthlyCheckRuleConfig } from './monthly-closing-checks';

export interface MonthlyClosingCheckOverride {
  manualStatus: MonthlyCheckManualStatus;
  owner?: string;
  note?: string;
  checkedAt?: string;
}

export type MonthlyClosingCheckOverrides = Record<string, MonthlyClosingCheckOverride>;
export type MonthlyClosingPeriodOverrides = Record<string, MonthlyClosingCheckOverrides>;
export type MonthlyClosingAccountOverrides = Record<string, MonthlyClosingPeriodOverrides>;
export type MonthlyClosingRuleConfigs = Record<string, MonthlyCheckRuleConfig>;
export type MonthlyClosingAccountRuleConfigs = Record<string, MonthlyClosingRuleConfigs>;

interface MonthlyClosingCheckStore {
  overridesByAccountSet: MonthlyClosingAccountOverrides;
  ruleConfigsByAccountSet: MonthlyClosingAccountRuleConfigs;
  setCheckOverride: (
    accountSetId: string,
    period: string,
    checkCode: string,
    override: MonthlyClosingCheckOverride,
  ) => void;
  clearCheckOverride: (accountSetId: string, period: string, checkCode: string) => void;
  getPeriodOverrides: (accountSetId: string, period: string) => MonthlyClosingCheckOverrides;
  setRuleConfig: (accountSetId: string, checkCode: string, config: MonthlyCheckRuleConfig) => void;
  getRuleConfigs: (accountSetId: string) => MonthlyClosingRuleConfigs;
}

function cloneOverrides(state: MonthlyClosingAccountOverrides): MonthlyClosingAccountOverrides {
  return Object.fromEntries(
    Object.entries(state).map(([accountSetId, periods]) => [
      accountSetId,
      Object.fromEntries(
        Object.entries(periods).map(([period, checks]) => [
          period,
          { ...checks },
        ]),
      ),
    ]),
  );
}

export const useMonthlyClosingCheckStore = create<MonthlyClosingCheckStore>()(
  persist(
    (set, get) => ({
      overridesByAccountSet: {},
      ruleConfigsByAccountSet: {},
      setCheckOverride: (accountSetId, period, checkCode, override) => {
        set((state) => {
          const overridesByAccountSet = cloneOverrides(state.overridesByAccountSet);
          const accountOverrides = { ...(overridesByAccountSet[accountSetId] || {}) };
          const periodOverrides = { ...(accountOverrides[period] || {}) };

          periodOverrides[checkCode] = {
            ...override,
            checkedAt: override.checkedAt || new Date().toISOString(),
          };
          accountOverrides[period] = periodOverrides;
          overridesByAccountSet[accountSetId] = accountOverrides;

          return { overridesByAccountSet };
        });
      },
      clearCheckOverride: (accountSetId, period, checkCode) => {
        set((state) => {
          const overridesByAccountSet = cloneOverrides(state.overridesByAccountSet);
          const accountOverrides = overridesByAccountSet[accountSetId];
          if (!accountOverrides?.[period]?.[checkCode]) return state;

          const periodOverrides = { ...accountOverrides[period] };
          delete periodOverrides[checkCode];

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
      getPeriodOverrides: (accountSetId, period) => {
        return get().overridesByAccountSet[accountSetId]?.[period] || {};
      },
      setRuleConfig: (accountSetId, checkCode, config) => {
        set((state) => ({
          ruleConfigsByAccountSet: {
            ...state.ruleConfigsByAccountSet,
            [accountSetId]: {
              ...(state.ruleConfigsByAccountSet[accountSetId] || {}),
              [checkCode]: {
                ...(state.ruleConfigsByAccountSet[accountSetId]?.[checkCode] || {}),
                ...config,
              },
            },
          },
        }));
      },
      getRuleConfigs: (accountSetId) => {
        return get().ruleConfigsByAccountSet[accountSetId] || {};
      },
    }),
    {
      name: 'monthly-closing-check-overrides',
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
      partialize: (state) => ({
        overridesByAccountSet: state.overridesByAccountSet,
        ruleConfigsByAccountSet: state.ruleConfigsByAccountSet,
      }),
    },
  ),
);
