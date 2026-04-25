'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const CurrentPeriodBar = dynamic(
  () => import('./current-period-bar').then((mod) => mod.CurrentPeriodBar),
  { ssr: false }
);

export function CurrentPeriodWrapper() {
  return <CurrentPeriodBar />;
}
