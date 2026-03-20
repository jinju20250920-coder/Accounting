import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Check } from 'lucide-react';
import { OutstandingSelector } from './outstanding-selector';
import type { OutstandingItem } from '@/types';

interface ClearingCellProps {
  entryId: string;
  recRefNo: string;
  partnerName: string;
  amount: number;
  onRecRefNoChange: (entryId: string, recRefNo: string) => void;
  onClearing: (entryId: string, items: OutstandingItem[]) => void;
}

export function ClearingCell({
  entryId,
  recRefNo,
  partnerName,
  amount,
  onRecRefNoChange,
  onClearing
}: ClearingCellProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const handleSelect = (items: OutstandingItem[]) => {
    if (items.length > 0) {
      // 生成核销单号
      const clearingNo = `REC-${Date.now().toString(36).toUpperCase()}`;
      onRecRefNoChange(entryId, clearingNo);
      onClearing(entryId, items);
    }
  };

  const handleManualInput = (value: string) => {
    onRecRefNoChange(entryId, value);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <Input
          value={recRefNo}
          onChange={(e) => handleManualInput(e.target.value)}
          placeholder="输入单据编号或点击选择"
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSelectorOpen(true)}
          disabled={!partnerName}
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      <OutstandingSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        partnerName={partnerName}
        onSelect={handleSelect}
      />
    </div>
  );
}