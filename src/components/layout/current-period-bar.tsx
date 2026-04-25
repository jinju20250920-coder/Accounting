'use client';

import React from 'react';
import { CurrentPeriodIndicator } from '@/components/account-set/current-period-indicator';

export function CurrentPeriodBar() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <CurrentPeriodIndicator compact={true} />
      </div>
    </div>
  );
}
