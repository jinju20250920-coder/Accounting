'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { useUserStore } from '@/stores/useUserStore';
import { Trash2, UserPlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AccountSetMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountSetId: string;
  accountSetName: string;
}

export function AccountSetMembersDialog({
  open,
  onOpenChange,
  accountSetId,
  accountSetName,
}: AccountSetMembersDialogProps) {
  const { showToast } = useToast();
  const {
    users, roles, accountSetUsers,
    loadUsers, loadRoles, loadAccountSetUsers,
    assignUserToAccountSet, removeUserFromAccountSet,
  } = useUserStore();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');

  useEffect(() => {
    if (open) {
      loadUsers();
      loadRoles();
      loadAccountSetUsers(accountSetId);
    }
  }, [open, accountSetId, loadUsers, loadRoles, loadAccountSetUsers]);

  const availableUsers = users.filter(
    u => u.status === 'active' && !accountSetUsers.some(asu => asu.userId === u.id)
  );

  const handleAdd = async () => {
    if (!selectedUserId || !selectedRoleId) {
      showToast('error', '请选择用户和角色');
      return;
    }
    await assignUserToAccountSet(accountSetId, selectedUserId, selectedRoleId);
    showToast('success', '成员已添加');
    setSelectedUserId('');
    setSelectedRoleId('');
  };

  const handleRemove = async (userId: string) => {
    await removeUserFromAccountSet(accountSetId, userId);
    showToast('success', '成员已移除');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>成员管理 - {accountSetName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 添加成员 */}
          <div className="flex items-center gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择用户" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.displayName} ({u.username})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={!selectedUserId || !selectedRoleId}>
              <UserPlus className="h-4 w-4 mr-1" />
              添加
            </Button>
          </div>

          {/* 成员列表 */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountSetUsers.map((asu) => (
                <TableRow key={asu.userId}>
                  <TableCell>
                    {asu.displayName || asu.username}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{asu.roleName || asu.roleId}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRemove(asu.userId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {accountSetUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 py-4">
                    暂无成员，所有用户默认可访问此账套
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}