'use client';

import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { getBankList } from '@/lib/bank-parsers/bank-registry';
import type { DetectionResult, CustomBankConfig } from '@/lib/bank-parsers/types';
import { getCurrentService } from '@/lib/database';
import { sqliteService } from '@/lib/database/sqlite-service';
import { waitForDbInit } from '@/hooks/useDatabaseSync';

type SqliteServiceType = typeof sqliteService;

interface BankFormatSelectorProps {
  value: string;
  onChange: (bankId: string) => void;
  detectionResult?: DetectionResult | null;
}

const bankList = getBankList();

export function BankFormatSelector({ value, onChange, detectionResult }: BankFormatSelectorProps) {
  const [customConfigs, setCustomConfigs] = useState<CustomBankConfig[]>([]);

  useEffect(() => {
    loadCustomConfigs();
  }, []);

  const loadCustomConfigs = async () => {
    try {
      await waitForDbInit();
      const service = getCurrentService() as SqliteServiceType;
      const configs = await service.getCustomBankConfigs();
      setCustomConfigs(configs);
    } catch {
      // Ignore errors, custom configs will be empty
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="选择银行格式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">自动检测</SelectItem>
          {customConfigs.length > 0 && (
            <>
              {customConfigs.map(cfg => (
                <SelectItem key={cfg.id} value={`custom_${cfg.id}`}>
                  {cfg.name}
                </SelectItem>
              ))}
            </>
          )}
          <SelectItem value="custom_new">+ 新建自定义格式</SelectItem>
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
