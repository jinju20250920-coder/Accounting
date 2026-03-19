import { Suspense } from 'react';
import { PartnerDashboard } from '@/components/partner/partner-dashboard';

export default function PartnerDashboardPage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <PartnerDashboard />
    </Suspense>
  );
}
