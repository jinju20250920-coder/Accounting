import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
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

  console.log('ClearingCell rendered:', { entryId, partnerName, recRefNo });

  const handleSelect = (items: OutstandingItem[]) => {
    console.log('ClearingCell handleSelect:', items);
    if (items.length > 0) {
      // 生成核销单号
      const clearingNo = `REC-${Date.now().toString(36).toUpperCase()}`;
      onRecRefNoChange(entryId, clearingNo);
      onClearing(entryId, items);
    }
    setIsSelectorOpen(false);
  };

  const handleManualInput = (value: string) => {
    onRecRefNoChange(entryId, value);
  };

  const handleButtonClick = () => {
    console.log('Search button clicked!', { partnerName });
    setIsSelectorOpen(true);
  };

  return (
    <div className="relative" style={{ height: '100%' }}>
      <div className="flex items-center gap-1 h-full">
        <Input
          value={recRefNo}
          onChange={(e) => handleManualInput(e.target.value)}
          placeholder="输入单据编号"
          className="flex-1 h-full"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          name={`clearing-${entryId || Math.random().toString(36).substr(2, 9)}`}
          style={{ height: '56px', borderRadius: 0 }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          className="h-full"
          style={{ height: '56px', borderRadius: 0 }}
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