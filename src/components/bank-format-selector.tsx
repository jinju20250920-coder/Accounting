'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { getBankList } from '@/lib/bank-parsers/bank-registry';
import type { DetectionResult } from '@/lib/bank-parsers/types';

interface BankFormatSelectorProps {
  value: string;
  onChange: (bankId: string) => void;
  detectionResult?: DetectionResult | null;
}

const bankList = getBankList();

export function BankFormatSelector({ value, onChange, detectionResult }: BankFormatSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="选择银行格式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">自动检测</SelectItem>
          <SelectItem value="custom">自定义格式</SelectItem>
          {bankList.map(bank => (
            <SelectItem key={bank.id} value={bank.id}>
              {bank.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {detectionResult && (
        <Badge variant="secondary" className="text-xs">
          <Zap className="h-3 w-3 mr-1" />
          已识别: {detectionResult.config.name}
        </Badge>
      )}
    </div>
  );
}
