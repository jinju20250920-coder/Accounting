'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SetupWizard } from '@/components/account-set/setup-wizard';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';

export default function SetupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  const accountSetId = searchParams.get('id') || '';
  const mode = searchParams.get('mode') === 'edit' ? 'edit' as const : 'create' as const;
  const accountSetName = searchParams.get('name') || '';
  const accountSetCode = searchParams.get('code') || '';
  const accountSetStartDate = searchParams.get('startDate') || '';
  const accountSetEnableDate = searchParams.get('enableDate') || '';

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleComplete = () => {
    const store = useAccountSetStore.getState();
    if (accountSetId) {
      store.updateAccountSet(accountSetId, { isInitialized: true });
    }
    router.push('/');
  };

  if (!mounted) return null;

  if (!accountSetId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">无效的账套ID</p>
      </div>
    );
  }

  // In edit mode, load full data from store
  let initialData: Parameters<typeof SetupWizard>[0]['initialData'];

  if (mode === 'edit') {
    const accountSet = useAccountSetStore.getState().accountSets.find(a => a.id === accountSetId);
    initialData = {
      name: accountSet?.name || accountSetName,
      code: accountSet?.code || accountSetCode,
      unifiedSocialCreditCode: accountSet?.unifiedSocialCreditCode || '',
      taxNo: accountSet?.taxNo || accountSet?.unifiedSocialCreditCode || '',
      address: accountSet?.address || '',
      baseCurrency: accountSet?.baseCurrency || '人民币',
      accountingStandard: accountSet?.accountingStandard || 'small-enterprise',
      taxpayerType: 'small' as const,
      voucherWord: accountSet?.voucherNumbering?.word || '记',
      voucherNoPeriod: accountSet?.voucherNumbering?.period || 'monthly' as const,
      voucherNoDigits: accountSet?.voucherNumbering?.digits || 3 as const,
      useClassifiedWords: accountSet?.voucherNumbering?.useClassified || false,
      classifiedWords: accountSet?.voucherNumbering?.classifiedWords || { receipt: '收', payment: '付', general: '记' },
      enableDate: accountSet?.enableDate || accountSetEnableDate,
      startDate: accountSet?.startDate || accountSetStartDate,
    };
  } else {
    initialData = {
      name: accountSetName,
      code: accountSetCode,
      unifiedSocialCreditCode: '',
      taxNo: '',
      address: '',
      baseCurrency: '人民币',
      accountingStandard: 'small-enterprise',
      taxpayerType: 'small' as const,
      voucherWord: '记',
      voucherNoPeriod: 'monthly' as const,
      voucherNoDigits: 3 as const,
      useClassifiedWords: false,
      classifiedWords: { receipt: '收', payment: '付', general: '记' },
      enableDate: accountSetEnableDate,
      startDate: accountSetStartDate,
    };
  }

  return (
    <SetupWizard
      accountSetId={accountSetId}
      mode={mode}
      onComplete={handleComplete}
      initialData={initialData}
    />
  );
}
