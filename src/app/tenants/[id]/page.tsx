'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sqliteService } from '@/lib/database';
import { useAuthStore } from '@/stores/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, UserPlus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MemberRow {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  joinedAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  accountant: '会计',
  viewer: '只读',
};

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useAuthStore((s) => s.currentUser);
  const loadAvailableTenants = useAuthStore((s) => s.loadAvailableTenants);

  const [tenant, setTenant] = useState<{ name: string; code: string; type: string } | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('accountant');
  const [loading, setLoading] = useState(true);

  const loadMembers = async () => {
    const db = await sqliteService.getDatabase();
    const stmt = db.prepare(
      `SELECT tu.userId, u.username, u.displayName, tu.role, tu.joinedAt
       FROM tenant_users tu
       JOIN users u ON u.id = tu.userId
       WHERE tu.tenantId = ?
       ORDER BY tu.joinedAt ASC`
    );
    stmt.bind([tenantId]);
    const rows: MemberRow[] = [];
    while (stmt.step()) {
      const r = stmt.get();
      rows.push({
        userId: String(r[0] ?? ''),
        username: String(r[1] ?? ''),
        displayName: String(r[2] ?? ''),
        role: String(r[3] ?? ''),
        joinedAt: String(r[4] ?? ''),
      });
    }
    stmt.free();
    setMembers(rows);
  };

  useEffect(() => {
    (async () => {
      try {
        const db = await sqliteService.getDatabase();
        const tStmt = db.prepare(`SELECT name, code, type FROM tenants WHERE id = ?`);
        tStmt.bind([tenantId]);
        if (tStmt.step()) {
          const r = tStmt.get();
          setTenant({
            name: String(r[0] ?? ''),
            code: String(r[1] ?? ''),
            type: String(r[2] ?? ''),
          });
        }
        tStmt.free();
        await loadMembers();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!inviteUsername.trim()) {
      toast({ title: '请输入用户名', type: 'warning' });
      return;
    }
    try {
      const db = await sqliteService.getDatabase();
      const uStmt = db.prepare(`SELECT id FROM users WHERE username = ?`);
      uStmt.bind([inviteUsername.trim()]);
      if (!uStmt.step()) {
        uStmt.free();
        toast({ title: '用户不存在', description: `未找到用户 "${inviteUsername}"`, type: 'error' });
        return;
      }
      const targetUserId = uStmt.get()[0];
      uStmt.free();

      const insStmt = db.prepare(
        `INSERT OR IGNORE INTO tenant_users (tenantId, userId, role, joinedAt) VALUES (?, ?, ?, ?)`
      );
      insStmt.run([tenantId, targetUserId, inviteRole, new Date().toISOString()]);
      insStmt.free();
      await sqliteService.persist();

      await loadMembers();
      setInviteUsername('');
      toast({ title: '已加入', description: '用户已添加到租户', type: 'success' });
    } catch (err) {
      console.error('Invite failed:', err);
      toast({ title: '加入失败', description: String(err), type: 'error' });
    }
  };

  const handleRemoveMember = async (userId: string, role: string) => {
    if (!currentUser) return;
    if (role === 'owner') {
      toast({ title: '无法移除所有者', type: 'warning' });
      return;
    }
    if (!confirm('确定要将此成员移出租户吗？')) return;
    try {
      const db = await sqliteService.getDatabase();
      const stmt = db.prepare(`DELETE FROM tenant_users WHERE tenantId = ? AND userId = ?`);
      stmt.run([tenantId, userId]);
      stmt.free();
      await sqliteService.persist();
      await loadMembers();
      if (currentUser.id === userId) {
        await loadAvailableTenants(currentUser.id);
        router.replace('/tenants');
      }
      toast({ title: '已移除', type: 'success' });
    } catch (err) {
      console.error('Remove failed:', err);
      toast({ title: '移除失败', description: String(err), type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        加载中...
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-3">租户不存在或无权访问</p>
          <Link href="/tenants">
            <Button variant="outline">返回租户列表</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/tenants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> 返回
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {tenant.code}
          </span>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              邀请新成员
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label>用户名</Label>
                <Input
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="输入已注册的用户名"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label>角色</Label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm"
                >
                  <option value="admin">管理员</option>
                  <option value="accountant">会计</option>
                  <option value="viewer">只读</option>
                </select>
              </div>
              <Button type="submit">
                添加成员
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">成员列表（{members.length}）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between p-3 rounded-md border border-slate-200"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {m.displayName || m.username}
                      </span>
                      <span className="text-xs text-slate-500">@{m.username}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      加入时间：{new Date(m.joinedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                    {m.userId !== currentUser?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(m.userId, m.role)}
                        title="移出租户"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
