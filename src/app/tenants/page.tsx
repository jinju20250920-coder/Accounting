'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore, type TenantSummary } from '@/stores/useAuthStore';
import { sqliteService } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users as UsersIcon } from 'lucide-react';

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

interface TenantDetail extends TenantSummary {
  status: string;
  memberCount: number;
  createTime: string;
}

export default function TenantsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useAuthStore((s) => s.currentUser);
  const availableTenants = useAuthStore((s) => s.availableTenants);
  const currentTenantId = useAuthStore((s) => s.currentTenantId);
  const setCurrentTenant = useAuthStore((s) => s.setCurrentTenant);
  const [details, setDetails] = useState<TenantDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      try {
        const db = await sqliteService.getDatabase();
        const result: TenantDetail[] = [];
        for (const t of availableTenants) {
          const stmt = db.prepare(
            `SELECT t.status, t.createTime,
               (SELECT COUNT(*) FROM tenant_users WHERE tenantId = t.id) AS memberCount
             FROM tenants t WHERE t.id = ?`
          );
          stmt.bind([t.id]);
          if (stmt.step()) {
            const r = stmt.get();
            result.push({
              ...t,
              status: String(r[0] ?? 'active'),
              memberCount: Number(r[1] ?? 0),
              createTime: String(r[2] ?? ''),
            });
          }
          stmt.free();
        }
        setDetails(result);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser, availableTenants]);

  const handleSwitch = async (tenant: TenantSummary) => {
    if (tenant.id === currentTenantId) return;
    await setCurrentTenant(tenant.id);
    toast({ title: '已切换租户', description: tenant.name, type: 'success' });
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> 返回
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">租户管理</h1>
          </div>
          <Link href="/tenants/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建新租户
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">我加入的租户</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">加载中...</div>
            ) : details.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                尚未加入任何租户
              </div>
            ) : (
              <div className="space-y-2">
                {details.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-md border border-slate-200 hover:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{t.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {TYPE_LABELS[t.type] || t.type}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                          {ROLE_LABELS[t.role] || t.role}
                        </span>
                        {t.id === currentTenantId && (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-600">
                            当前
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <span>代码：{t.code}</span>
                        <span className="flex items-center gap-1">
                          <UsersIcon className="h-3 w-3" />
                          {t.memberCount} 成员
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(t.role === 'owner' || t.role === 'admin') && (
                        <Link href={`/tenants/${t.id}`}>
                          <Button variant="outline" size="sm">管理成员</Button>
                        </Link>
                      )}
                      {t.id !== currentTenantId && (
                        <Button size="sm" onClick={() => handleSwitch(t)}>
                          切换到此租户
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
