'use client';

import { useEffect, useState } from 'react';
import { useTaxStore } from '@/stores/useTaxStore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TaxItemsTab } from './_components/tax-items-tab';
import { TaxFilingsTab } from './_components/tax-filings-tab';
import { TaxCalendarTab } from './_components/tax-calendar-tab';

export default function TaxPage() {
  const initialize = useTaxStore(s => s.initialize);
  const ensureCurrentPeriodFilings = useTaxStore(s => s.ensureCurrentPeriodFilings);
  const [tab, setTab] = useState('filings');
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        await initialize();
        await ensureCurrentPeriodFilings();
      } catch (err) {
        toast({ type: 'error', title: '税务数据加载失败' });
      }
    })();
  }, [initialize, ensureCurrentPeriodFilings, toast]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">税务管理</h1>
        <p className="text-sm text-slate-500">税种配置 · 申报台账 · 申报日历</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="filings">申报台账</TabsTrigger>
          <TabsTrigger value="items">税种配置</TabsTrigger>
          <TabsTrigger value="calendar">申报日历</TabsTrigger>
        </TabsList>
        <TabsContent value="filings"><TaxFilingsTab /></TabsContent>
        <TabsContent value="items"><TaxItemsTab /></TabsContent>
        <TabsContent value="calendar">
          <TaxCalendarTab onJumpToFiling={(taxItemId, taxPeriod) => {
            setTab('filings');
            // Note: TaxFilingsTab would need to accept filter props to auto-filter by these values
            // For now, just switching to the filings tab is sufficient
          }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
