'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserStore } from '@/stores/useUserStore';
import { Database, LogIn, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const login = useAuthStore((s) => s.login);
  const registerUser = useUserStore((s) => s.registerUser);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 读取记住的凭据
  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved_credentials');
      if (saved) {
        const { username: savedUser } = JSON.parse(saved);
        setUsername(savedUser || '');
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      showToast('error', '请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const error = await login(username, password, rememberMe);
      if (!error) {
        showToast('success', '登录成功');
        router.push('/');
      } else {
        showToast('error', error);
      }
    } catch {
      showToast('error', '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      showToast('error', '请输入用户名和密码');
      return;
    }

    if (password.length < 6) {
      showToast('error', '密码长度不能少于6位');
      return;
    }

    if (password !== confirmPassword) {
      showToast('error', '两次密码输入不一致');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerUser(username, password);
      if (result.success) {
        showToast('success', '注册成功，请等待管理员审批');
        setMode('login');
        setConfirmPassword('');
      } else {
        showToast('error', result.error || '注册失败');
      }
    } catch {
      showToast('error', '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Database className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">金桔财务系统</CardTitle>
          <CardDescription>{mode === 'login' ? '请登录您的账号' : '注册新账号'}</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer">记住密码</Label>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    登录中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    登录
                  </span>
                )}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  没有账号？注册新账号
                </button>
              </div>
              <div className="text-center text-xs text-slate-400">
                默认管理员账号: admin / admin123
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-username">用户名</Label>
                <Input
                  id="reg-username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">密码</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="请输入密码（至少6位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-confirm">确认密码</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="请再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    注册中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    注册
                  </span>
                )}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  已有账号？返回登录
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
