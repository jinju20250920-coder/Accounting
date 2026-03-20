import React from 'react';
import { useClearingStore } from '@/stores/useClearingStore';
import { ClearingCell } from './clearing-cell';
import type { OutstandingItem } from '@/types';

interface ClearingManagerProps {
  entryId: string;
  recRefNo: string;
  partnerName: string;
  amount: number;
}

export function ClearingManager({
  entryId,
  recRefNo,
  partnerName,
  amount
}: ClearingManagerProps) {
  const { updateRecRefNo, processClearing } = useClearingStore();

  const handleRecRefNoChange = (id: string, value: string) => {
    updateRecRefNo(id, value);
  };

  const handleClearing = (id: string, items: OutstandingItem[]) => {
    processClearing(id, items);
  };

  return (
    <ClearingCell
      entryId={entryId}
      recRefNo={recRefNo}
      partnerName={partnerName}
      amount={amount}
      onRecRefNoChange={handleRecRefNoChange}
      onClearing={handleClearing}
    />
  );
}