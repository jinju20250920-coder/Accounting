'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sqliteService } from '@/lib/database';
import { useAuthStore } from '@/stores/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NewTenantPage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useAuthStore((s) => s.currentUser);
  const setCurrentTenant = useAuthStore((s) => s.setCurrentTenant);
  const loadAvailableTenants = useAuthStore((s) => s.loadAvailableTenants);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'saas' | 'personal'>('saas');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!code.trim() || !name.trim()) {
      toast({ title: '请填写完整', description: '租户代码和名称不能为空', type: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      const db = await sqliteService.getDatabase();
      const id = `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      // 检查 code 唯一
      const checkStmt = db.prepare(`SELECT id FROM tenants WHERE code = ?`);
      checkStmt.bind([code.trim()]);
      if (checkStmt.step()) {
        checkStmt.free();
        toast({ title: '代码已存在', description: '请使用其他代码', type: 'error' });
        setSubmitting(false);
        return;
      }
      checkStmt.free();

      const insStmt = db.prepare(
        `INSERT INTO tenants (id, code, name, type, status, createTime, updateTime) VALUES (?, ?, ?, ?, 'active', ?, ?)`
      );
      insStmt.run([id, code.trim(), name.trim(), type, now, now]);
      insStmt.free();

      // 创建者自动成为 owner
      const tuStmt = db.prepare(
        `INSERT INTO tenant_users (tenantId, userId, role, joinedAt) VALUES (?, ?, 'owner', ?)`
      );
      tuStmt.run([id, currentUser.id, now]);
      tuStmt.free();

      await sqliteService.persist();
      await loadAvailableTenants(currentUser.id);
      await setCurrentTenant(id);

      toast({ title: '租户创建成功', description: `已切换到 ${name}`, type: 'success' });
      router.replace('/');
    } catch (err) {
      console.error('Create tenant failed:', err);
      toast({ title: '创建失败', description: String(err), type: 'error' });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/tenants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> 返回
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">创建新租户</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">租户信息</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label required>租户代码</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="如：acme-corp"
                  autoComplete="off"
                />
                <p className="text-xs text-slate-500">用于唯一标识，创建后不可修改</p>
              </div>
              <div className="space-y-2">
                <Label required>租户名称</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：ACME 公司"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={type === 'saas' ? 'default' : 'outline'}
                    onClick={() => setType('saas')}
                  >
                    SaaS 多组织
                  </Button>
                  <Button
                    type="button"
                    variant={type === 'personal' ? 'default' : 'outline'}
                    onClick={() => setType('personal')}
                  >
                    个人
                  </Button>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <Link href="/tenants">
                  <Button type="button" variant="ghost">取消</Button>
                </Link>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '创建中...' : '创建并进入'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
