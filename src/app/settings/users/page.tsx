'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useUserStore } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
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
import { Users, UserPlus, Search, Pencil, Trash2, KeyRound, ToggleLeft, ToggleRight } from 'lucide-react';

export default function UsersPage() {
  const { showToast } = useToast();
  const { users, loadUsers, createUser, updateUser, deleteUser, resetPassword, toggleUserStatus } = useUserStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetUserId, setResetUserId] = useState('');

  // 新增用户表单
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // 编辑用户表单
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // 重置密码表单
  const [newPasswordReset, setNewPasswordReset] = useState('');

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newUsername.trim() || !newDisplayName.trim() || !newPassword.trim()) {
      showToast('error', '用户名、显示名和密码不能为空');
      return;
    }
    const result = await createUser(newUsername, newDisplayName, newPassword, newEmail, newPhone);
    if (result) {
      showToast('success', '用户创建成功');
      setShowCreateDialog(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewEmail('');
      setNewPhone('');
    } else {
      showToast('error', '创建失败，用户名可能已存在');
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    await updateUser(editingUser.id, {
      displayName: editDisplayName,
      email: editEmail || null,
      phone: editPhone || null,
    });
    showToast('success', '用户信息已更新');
    setShowEditDialog(false);
  };

  const handleDelete = async (userId: string) => {
    if (userId === currentUser?.id) {
      showToast('error', '不能删除当前登录用户');
      return;
    }
    await deleteUser(userId);
    showToast('success', '用户已删除');
  };

  const handleResetPassword = async () => {
    if (!newPasswordReset.trim()) {
      showToast('error', '请输入新密码');
      return;
    }
    await resetPassword(resetUserId, newPasswordReset);
    showToast('success', '密码已重置');
    setShowResetDialog(false);
    setNewPasswordReset('');
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    if (userId === currentUser?.id && newStatus === 'disabled') {
      showToast('error', '不能禁用当前登录用户');
      return;
    }
    await toggleUserStatus(userId, newStatus);
    showToast('success', newStatus === 'active' ? '用户已启用' : '用户已禁用');
  };

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditEmail(user.email || '');
    setEditPhone(user.phone || '');
    setShowEditDialog(true);
  };

  const openResetDialog = (userId: string) => {
    setResetUserId(userId);
    setNewPasswordReset('');
    setShowResetDialog(true);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">用户管理</h1>
        <p className="text-slate-600 mt-1">管理系统用户账号和权限</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索用户..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              新增用户
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>显示名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>手机</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最后登录</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                      {user.status === 'active' ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {user.lastLoginTime ? new Date(user.lastLoginTime).toLocaleString('zh-CN') : '从未登录'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openResetDialog(user.id)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(user.id, user.status)}>
                        {user.status === 'active' ? (
                          <ToggleLeft className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleRight className="h-4 w-4 text-slate-400" />
                        )}
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(user.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              <p>暂无用户数据</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增用户对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>用户名</Label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label required>显示名</Label>
              <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label required>初始密码</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>手机</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>显示名</Label>
              <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>手机</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>新密码</Label>
              <Input type="password" value={newPasswordReset} onChange={(e) => setNewPasswordReset(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>取消</Button>
            <Button onClick={handleResetPassword}>重置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}