'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import { useUserStore } from '@/stores/useUserStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Shield, Plus, Pencil, Trash2, Settings } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  voucher: '凭证管理',
  fund: '资金管理',
  invoice: '发票管理',
  report: '报表查询',
  asset: '资产管理',
  partner: '往来管理',
  settings: '基础档案',
  accountset: '账套管理',
  user: '用户管理',
};

export default function RolesPage() {
  const { showToast } = useToast();
  const {
    roles, permissions, rolePermissions,
    loadRoles, loadPermissions, loadRolePermissions,
    createRole, updateRole, deleteRole, updateRolePermissions,
  } = useUserStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPermDialog, setShowPermDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [permRoleId, setPermRoleId] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  // 新增角色表单
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // 编辑角色表单
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    loadRoles();
    loadPermissions();
    loadRolePermissions();
  }, [loadRoles, loadPermissions, loadRolePermissions]);

  const handleCreate = async () => {
    if (!newName.trim() || !newDisplayName.trim()) {
      showToast('error', '角色标识和显示名不能为空');
      return;
    }
    const result = await createRole(newName, newDisplayName, newDescription);
    if (result) {
      showToast('success', '角色创建成功');
      setShowCreateDialog(false);
      setNewName('');
      setNewDisplayName('');
      setNewDescription('');
    } else {
      showToast('error', '创建失败，角色标识可能已存在');
    }
  };

  const handleEdit = async () => {
    if (!editingRole) return;
    await updateRole(editingRole.id, {
      displayName: editDisplayName,
      description: editDescription,
    });
    showToast('success', '角色信息已更新');
    setShowEditDialog(false);
  };

  const handleDelete = async (roleId: string, isSystem: number) => {
    if (isSystem) {
      showToast('error', '系统预设角色不可删除');
      return;
    }
    await deleteRole(roleId);
    showToast('success', '角色已删除');
  };

  const openEditDialog = (role: any) => {
    setEditingRole(role);
    setEditDisplayName(role.displayName);
    setEditDescription(role.description);
    setShowEditDialog(true);
  };

  const openPermDialog = (roleId: string) => {
    setPermRoleId(roleId);
    setSelectedPerms(rolePermissions[roleId] || []);
    setShowPermDialog(true);
  };

  const togglePerm = (permId: string) => {
    setSelectedPerms(prev =>
      prev.includes(permId)
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const toggleCategory = (category: string) => {
    const categoryPerms = permissions.filter(p => p.category === category).map(p => p.id);
    const allSelected = categoryPerms.every(p => selectedPerms.includes(p));
    if (allSelected) {
      setSelectedPerms(prev => prev.filter(p => !categoryPerms.includes(p)));
    } else {
      setSelectedPerms(prev => [...new Set([...prev, ...categoryPerms])]);
    }
  };

  const handleSavePermissions = async () => {
    await updateRolePermissions(permRoleId, selectedPerms);
    showToast('success', '权限已更新');
    setShowPermDialog(false);
  };

  // 按 category 分组权限
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof permissions>);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">角色权限</h1>
        <p className="text-slate-600 mt-1">管理角色和权限分配</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">角色列表</h2>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新增角色
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色名称</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>权限数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.displayName}</TableCell>
                  <TableCell className="text-slate-500">{role.name}</TableCell>
                  <TableCell className="text-sm text-slate-600">{role.description || '-'}</TableCell>
                  <TableCell>
                    {role.isSystem ? (
                      <Badge className="bg-purple-50 text-purple-600">系统预设</Badge>
                    ) : (
                      <Badge className="bg-blue-50 text-blue-600">自定义</Badge>
                    )}
                  </TableCell>
                  <TableCell>{rolePermissions[role.id]?.length || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openPermDialog(role.id)} title="配置权限">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={role.isSystem ? 'text-slate-300' : 'text-red-500'}
                        onClick={() => handleDelete(role.id, role.isSystem)}
                        disabled={!!role.isSystem}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 新增角色对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增角色</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>角色标识</Label>
              <Input placeholder="如: auditor" value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label required>显示名</Label>
              <Input placeholder="如: 审计员" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑角色对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑角色</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>显示名</Label>
              <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 权限配置对话框 */}
      <Dialog open={showPermDialog} onOpenChange={setShowPermDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置权限</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([category, perms]) => {
              const categoryPerms = perms.map(p => p.id);
              const allSelected = categoryPerms.every(p => selectedPerms.includes(p));
              const someSelected = categoryPerms.some(p => selectedPerms.includes(p));

              return (
                <div key={category} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <span className="font-medium text-sm">{CATEGORY_LABELS[category] || category}</span>
                    {!allSelected && someSelected && (
                      <span className="text-xs text-slate-400">(部分)</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 ml-6">
                    {perms.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedPerms.includes(perm.id)}
                          onCheckedChange={() => togglePerm(perm.id)}
                        />
                        <span className="text-sm text-slate-700">{perm.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermDialog(false)}>取消</Button>
            <Button onClick={handleSavePermissions}>保存权限</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}