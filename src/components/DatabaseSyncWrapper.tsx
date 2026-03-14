'use client';

import { useDatabaseSync } from '@/hooks/useDatabaseSync';

export function DatabaseSyncWrapper() {
  useDatabaseSync();
  return null;
}