'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, type TenantSummary } from '@/stores/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ROLE_LABELS: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  accountant: '会计',
  viewer: '只读',
};

const TYPE_LABELS: Record<string, string> = {
  group: '集团',
  saas: 'SaaS',
  personal: '个人',
};

export default function SelectTenantPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const availableTenants = useAuthStore((s) => s.availableTenants);
  const currentTenantId = useAuthStore((s) => s.currentTenantId);
  const currentUser = useAuthStore((s) => s.currentUser);
  const setCurrentTenant = useAuthStore((s) => s.setCurrentTenant);
  const logout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (currentTenantId) {
      router.replace('/');
    }
  }, [isAuthenticated, currentTenantId, router]);

  const handlePick = async (tenant: TenantSummary) => {
    setError(null);
    setLoading(tenant.id);
    try {
      await setCurrentTenant(tenant.id);
      router.replace('/');
    } catch (err) {
      console.error('Switch tenant failed:', err);
      setError('切换租户失败，请重试');
      setLoading(null);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-xl shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">
            选择租户 workspace
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            欢迎，{currentUser?.displayName || currentUser?.username}。请选择要进入的租户。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableTenants.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 mb-4">尚未加入任何租户</p>
              <p className="text-sm text-slate-500 mb-4">请联系管理员邀请你加入租户。</p>
              <Button variant="outline" onClick={() => { logout(); router.replace('/login'); }}>
                退出登录
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                  {error}
                </div>
              )}
              {availableTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handlePick(tenant)}
                  disabled={loading !== null}
                  className="w-full text-left p-4 rounded-md border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      {tenant.name}
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {TYPE_LABELS[tenant.type] || tenant.type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      代码：{tenant.code} · 角色：{ROLE_LABELS[tenant.role] || tenant.role}
                    </div>
                  </div>
                  {loading === tenant.id && (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  )}
                </button>
              ))}
              <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => { logout(); router.replace('/login'); }}>
                  退出登录
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
