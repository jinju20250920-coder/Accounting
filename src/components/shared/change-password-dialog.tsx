'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { showToast } = useToast();
  const changePassword = useUserStore((s) => s.changePassword);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      showToast('error', '请填写所有密码字段');
      return;
    }

    if (newPassword.length < 6) {
      showToast('error', '新密码长度不能少于6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('error', '两次新密码输入不一致');
      return;
    }

    if (!currentUser) return;

    setIsLoading(true);
    try {
      const result = await changePassword(currentUser.id, oldPassword, newPassword);
      if (result.success) {
        showToast('success', '密码修改成功');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onOpenChange(false);
      } else {
        showToast('error', result.error || '修改失败');
      }
    } catch {
      showToast('error', '修改密码失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label required>旧密码</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="off"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label required>新密码</Label>
            <Input
              type="password"
              placeholder="至少6位"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="off"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label required>确认新密码</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="off"
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>取消</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? '修改中...' : '确认修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
