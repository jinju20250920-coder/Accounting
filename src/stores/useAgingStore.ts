'use client';

import { create } from 'zustand';
import type { AgingResult, AgingDetail, AgingMode, AgingConfig } from '@/lib/accounting';

interface AgingStore {
  // 状态
  mode: AgingMode;
  asOfDate: string;
  selectedBucket: string | null;
  selectedPartner: string | null;
  agingData: AgingResult[];
  agingDetails: AgingDetail[];
  isLoading: boolean;

  // Actions
  setMode: (mode: AgingMode) => void;
  setAsOfDate: (date: string) => void;
  setSelectedBucket: (bucket: string | null) => void;
  setSelectedPartner: (partner: string | null) => void;
  setAgingData: (data: AgingResult[]) => void;
  setAgingDetails: (details: AgingDetail[]) => void;
  setLoading: (loading: boolean) => void;
  clearFilters: () => void;
}

export const useAgingStore = create<AgingStore>((set) => ({
  mode: 'month',
  asOfDate: new Date().toISOString().split('T')[0],
  selectedBucket: null,
  selectedPartner: null,
  agingData: [],
  agingDetails: [],
  isLoading: false,

  setMode: (mode) => set({ mode }),
  setAsOfDate: (asOfDate) => set({ asOfDate }),
  setSelectedBucket: (selectedBucket) => set({ selectedBucket }),
  setSelectedPartner: (selectedPartner) => set({ selectedPartner }),
  setAgingData: (agingData) => set({ agingData }),
  setAgingDetails: (agingDetails) => set({ agingDetails }),
  setLoading: (isLoading) => set({ isLoading }),
  clearFilters: () => set({ selectedBucket: null, selectedPartner: null }),
}));
