'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore, type TenantSummary } from '@/stores/useAuthStore';

interface TenantSwitcherProps {
  collapsed?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  accountant: '会计',
  viewer: '只读',
};

export function TenantSwitcher({ collapsed = false }: TenantSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const availableTenants = useAuthStore((s) => s.availableTenants);
  const currentTenantId = useAuthStore((s) => s.currentTenantId);
  const setCurrentTenant = useAuthStore((s) => s.setCurrentTenant);

  const currentTenant: TenantSummary | undefined = availableTenants.find(
    (t) => t.id === currentTenantId
  );

  const handlePick = async (tenant: TenantSummary) => {
    setOpen(false);
    if (tenant.id === currentTenantId) return;
    await setCurrentTenant(tenant.id);
    // 切换租户后回到首页（账套列表会刷新）
    router.replace('/');
  };

  return (
    <div className="relative">
      {collapsed ? (
        <Button
          variant="ghost"
          className="w-full justify-center text-slate-300 hover:text-white hover:bg-slate-800 h-10 px-0"
          onClick={() => setOpen(!open)}
          title={currentTenant?.name || '选择租户'}
        >
          <Building className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="w-full justify-between text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Building className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{currentTenant?.name || '选择租户'}</span>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className={cn(
            'absolute mt-1 bg-slate-800 rounded-lg shadow-lg z-20 overflow-hidden',
            collapsed ? 'top-full left-full ml-2 w-48' : 'top-full left-0 right-0'
          )}>
            <div className="max-h-60 overflow-y-auto">
              {availableTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm flex items-center justify-between',
                    currentTenantId === tenant.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  )}
                  onClick={() => handlePick(tenant)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{tenant.name}</div>
                    <div className={cn(
                      'text-[10px] mt-0.5',
                      currentTenantId === tenant.id ? 'text-blue-100' : 'text-slate-500'
                    )}>
                      {ROLE_LABELS[tenant.role] || tenant.role}
                    </div>
                  </div>
                  {currentTenantId === tenant.id && (
                    <Check className="h-4 w-4 flex-shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
