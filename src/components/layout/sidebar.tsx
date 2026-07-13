'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DatabaseSwitcher } from '@/components/database/database-switcher';
import {
  Home,
  FileText,
  Calculator,
  FileSpreadsheet,
  Users,
  Building2,
  RefreshCw,
  Upload,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FolderKanban,
  Check,
  Key,
  Package,
  LogOut,
  KeyRound,
  User,
  WalletCards,
  Sparkles,
  ShieldCheck,
  Gift,
  CheckCircle2,
  Crown,
  Star,
  Tag,
} from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useToast } from '@/components/ui/toast';
import { ChangePasswordDialog } from '@/components/shared/change-password-dialog';
import { sqliteService } from '@/lib/database/sqlite-service';

const menuItems = [
  { icon: Home, label: '智能做账', path: '/', permission: '' },
  { icon: FolderKanban, label: '凭证', path: '/voucher-entry-page', permission: 'voucher:view', children: [
    { label: '新增凭证', path: '/voucher-entry-page', permission: 'voucher:create' },
    { label: '查看凭证', path: '/voucher-list', permission: 'voucher:view' },
  ]},
  { icon: Calculator, label: '科目余额', path: '/balance', permission: 'report:view' },
  { icon: FileSpreadsheet, label: '报表查询', path: '/reports', permission: 'report:view', children: [
    { label: '资产负债表', path: '/reports/assets', permission: 'report:view' },
    { label: '损益表', path: '/reports/profit', permission: 'report:view' },
    { label: '现金流量表', path: '/reports/cashflow', permission: 'report:view' },
  ]},
  { icon: Users, label: '往来管理', path: '/aging', permission: 'partner:view', children: [
    { label: '往来单位管理', path: '/partner-dashboard', permission: 'partner:view' },
    { label: '应收明细', path: '/aging/ar', permission: 'partner:view' },
    { label: '应付明细', path: '/aging/ap', permission: 'partner:view' },
  ]},
  { icon: Upload, label: '资金管理', path: '/import', permission: 'fund:view', children: [
    { label: '银行流水导入', path: '/import', permission: 'fund:view' },
    { label: '资金结算中心', path: '/fund-hub', permission: 'fund:view' },
  ]},
  { icon: FileText, label: '发票管理', path: '/invoices', permission: 'invoice:view', children: [
    { label: '进项发票', path: '/invoices/input', permission: 'invoice:view' },
    { label: '销项发票', path: '/invoices/output', permission: 'invoice:view' },
    { label: '发票资金一览表', path: '/invoices/summary', permission: 'invoice:view' },
  ]},
  { icon: WalletCards, label: '薪酬管理', path: '/payroll', permission: 'voucher:view', children: [
    { label: '工资管理', path: '/payroll', permission: 'voucher:view' },
    { label: '工资报表', path: '/payroll/report', permission: 'voucher:view' },
  ]},
  { icon: Package, label: '资产管理', path: '/assets', permission: 'asset:view', children: [
    { label: '固定资产', path: '/assets/fixed', permission: 'asset:view' },
    { label: '固定资产汇总表', path: '/assets/summary', permission: 'asset:view' },
    { label: '待摊费用', path: '/assets/prepaid', permission: 'asset:view' },
  ]},
  { icon: Building2, label: '账套管理', path: '/sets', permission: 'accountset:view' },
  { icon: RefreshCw, label: '汇兑损益', path: '/exchange', permission: 'voucher:view' },
  { icon: Settings, label: '基础档案', path: '/settings', permission: 'settings:view', children: [
    { label: '科目管理', path: '/settings/subjects', permission: 'settings:view' },
    { label: '部门管理', path: '/settings/departments', permission: 'settings:view' },
    { label: '项目管理', path: '/settings/projects', permission: 'settings:view' },
    { label: '往来单位管理', path: '/settings/auxiliary', permission: 'settings:view' },
    { label: '币别管理', path: '/settings/currencies', permission: 'settings:view' },
    { label: '常用摘要库', path: '/settings/summaries', permission: 'settings:view' },
    { label: '凭证模版', path: '/settings/templates', permission: 'settings:view' },
    { label: '银行账户', path: '/settings/bank-accounts', permission: 'settings:view' },
    { label: '用户管理', path: '/settings/users', permission: 'user:view' },
    { label: '角色权限', path: '/settings/roles', permission: 'user:view' },
  ]},
];

// 授权激活对话框
function LicenseActivationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { showToast } = useToast();
  const {
    pricingPlans,
    getCurrentLicense,
    activateLicense,
    applyDiscountCode,
  } = useAccountSetStore();

  const [licenseKey, setLicenseKey] = useState('');
  const [activationToken, setActivationToken] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState<{ valid: boolean; discount: number; description: string } | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activeTab, setActiveTab] = useState('activate');

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      showToast('warning', '请输入折扣码');
      return;
    }

    try {
      const result = await applyDiscountCode(discountCode);
      setDiscountApplied(result);
      if (result.valid) {
        showToast('success', result.description);
      } else {
        showToast('error', result.description);
      }
    } catch (error) {
      showToast('error', '折扣码应用失败');
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      showToast('error', '请输入授权码');
      return;
    }

    setIsActivating(true);
    try {
      const success = await activateLicense(licenseKey, activationToken || undefined);
      if (success) {
        showToast('success', '授权激活成功！');
        onOpenChange(false);
        setLicenseKey('');
        setActivationToken('');
        setDiscountCode('');
        setDiscountApplied(null);
      }
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '授权激活失败');
    } finally {
      setIsActivating(false);
    }
  };

  const getPlanPrice = (price: number) => {
    if (discountApplied?.valid) {
      return (price * (1 - discountApplied.discount)).toFixed(2);
    }
    return price.toFixed(2);
  };

  const currentLicense = getCurrentLicense();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </div>
            授权管理
            {currentLicense && (
              <Badge className={
                currentLicense.status === 'active'
                  ? 'bg-green-50 text-green-700 hover:bg-green-50'
                  : currentLicense.status === 'expired'
                  ? 'bg-red-50 text-red-700 hover:bg-red-50'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-50'
              }>
                {currentLicense.status === 'active' ? '已授权' : currentLicense.status === 'expired' ? '已过期' : '已暂停'}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>激活您的授权码以解锁更多功能</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activate">
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              激活授权
            </TabsTrigger>
            <TabsTrigger value="plans">
              <Crown className="h-3.5 w-3.5 mr-1.5" />
              套餐选择
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activate" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label required className="text-sm font-semibold flex items-center gap-1.5 text-slate-900">
                <Key className="h-3.5 w-3.5 text-slate-900" />
                授权码
              </Label>
              <Input
                placeholder="请输入授权码，如 LIVE-299-SET1"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                className="font-mono tracking-wide h-11 text-base text-slate-900 border-slate-300"
                autoComplete="off"
              />
              <p className="text-xs text-slate-900">
                格式：<code className="px-1 py-0.5 bg-slate-100 rounded text-slate-900">LIVE-价格-账套数量</code>（如 LIVE-299-SET1 / LIVE-599-SET5）
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5 text-slate-900">
                <Gift className="h-3.5 w-3.5 text-slate-900" />
                激活令牌
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 text-slate-600 border-slate-300 font-normal">可选</Badge>
              </Label>
              <Input
                placeholder="如有激活令牌，请输入"
                value={activationToken}
                onChange={(e) => setActivationToken(e.target.value)}
                className="font-mono h-11 text-slate-900 border-slate-300"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5 text-slate-900">
                <Tag className="h-3.5 w-3.5 text-slate-900" />
                折扣码
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 text-slate-600 border-slate-300 font-normal">可选</Badge>
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入折扣码"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  className="flex-1 h-11 text-slate-900 border-slate-300"
                  autoComplete="off"
                />
                <Button variant="outline" onClick={handleApplyDiscount} className="h-11 px-5">应用</Button>
              </div>
              {discountApplied && discountApplied.valid && (
                <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{discountApplied.description}</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="plans" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {pricingPlans.map((plan) => {
                const discounted = discountApplied?.valid;
                const finalPrice = parseFloat(getPlanPrice(plan.price));
                const hasDiscount = discounted && finalPrice < plan.price;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'relative rounded-xl border-2 p-4 transition-all',
                      plan.isPopular
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <Badge className="bg-blue-600 text-white shadow-sm gap-0.5 px-2 py-0.5">
                          <Star className="h-3 w-3 fill-current" />
                          推荐
                        </Badge>
                      </div>
                    )}
                    <div className="text-center pt-1">
                      <h3 className="font-bold text-base flex items-center justify-center gap-1.5">
                        {plan.id === 'plan_enterprise' && <Crown className="h-4 w-4 text-amber-500" />}
                        {plan.id === 'plan_pro' && <Sparkles className="h-4 w-4 text-blue-500" />}
                        {plan.id === 'plan_basic' && <Package className="h-4 w-4 text-slate-500" />}
                        {plan.name}
                      </h3>
                      <div className="my-2 flex items-baseline justify-center gap-1">
                        <span className="text-xs text-slate-900">¥</span>
                        <span className="text-2xl font-bold text-slate-900">{getPlanPrice(plan.price)}</span>
                        <span className="text-xs text-slate-900 font-medium">
                          {plan.duration === 'lifetime' ? '/ 永久' : plan.duration === 'yearly' ? '/ 年' : '/ 月'}
                        </span>
                      </div>
                      {hasDiscount && (
                        <span className="text-xs text-slate-400 line-through">¥{plan.price.toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-900 text-center mb-3 min-h-[2.5rem]">{plan.description}</p>
                    <div className="space-y-1.5 mb-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span className="text-slate-900">账套数量：{plan.accountSetLimit === -1 ? '不限' : plan.accountSetLimit}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span className="text-slate-900">全部功能（含高级报表、多币种、审计追踪等）</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span className="text-slate-900">使用期限：永久</span>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      size="sm"
                      variant={plan.isPopular ? 'default' : 'outline'}
                      onClick={() => {
                        setActiveTab('activate');
                        showToast('info', `请输入 ${plan.name} 对应的授权码`);
                      }}
                    >
                      选择套餐
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleActivate}
            disabled={isActivating || !licenseKey.trim()}
            className="gap-1.5 min-w-[120px]"
          >
            {isActivating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                激活中...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                激活授权
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const {
    accountSets,
    currentAccountSetId,
    getCurrentAccountSet,
    setCurrentAccountSet,
    getCurrentLicense,
    pricingPlans,
    currentPricingPlanId,
  } = useAccountSetStore();
  const { currentUser, currentTenantId, logout, hasPermission, loadUserPermissions } = useAuthStore();
  const { settings, updateSettings } = useSettingsStore();
  const collapsed = !!settings.ui.sidebarCollapsed;

  const toggleCollapsed = () => {
    updateSettings({ ui: { ...settings.ui, sidebarCollapsed: !collapsed } });
    if (!collapsed) {
      setExpandedItems(new Set());
    }
  };

  const visibleMenuItems = menuItems.filter(item => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  }).map(item => ({
    ...item,
    children: item.children?.filter(child => {
      if (!child.permission) return true;
      return hasPermission(child.permission);
    }),
  }));

  const currentAccountSet = getCurrentAccountSet();
  const currentLicense = getCurrentLicense();
  const currentPlan = pricingPlans.find(p => p.id === currentPricingPlanId);

  // 防止 Hydration 错误：只有在客户端挂载后才显示动态内容
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true);
  }, []);

  // 监听账套变化
  useEffect(() => {
    // 初始化当前账套数据
  }, [currentAccountSetId]);

  const toggleExpand = (label: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = useCallback((path: string) => pathname === path || pathname?.startsWith(path + '/'), [pathname]);

  const autoExpandedItems = useMemo(() => new Set(
    visibleMenuItems
      .filter((item) => item.children?.some((child) => isActive(child.path)) || (item.children && isActive(item.path)))
      .map((item) => item.label),
  ), [isActive, visibleMenuItems]);

  const handleSwitchAccount = async (accountSetId: string) => {
    // 保存当前账套ID到 sessionStorage，用于在 hook 中检测账套切换
    sessionStorage.setItem('lastAccountSetId', currentAccountSetId || '');
    setCurrentAccountSet(accountSetId);
    sqliteService.setAccountSetId(accountSetId);
    if (currentUser && currentTenantId) {
      try {
        await loadUserPermissions(currentUser.id, currentTenantId, accountSetId);
      } catch {
        showToast('error', '账套权限加载失败，请重新登录后重试');
      }
    }
    setShowAccountSwitcher(false);
    showToast('success', '已切换到 ' + (accountSets.find(s => s.id === accountSetId)?.name || '账套'));
  };

  const getLicenseStatusBadge = () => {
    if (!currentLicense) {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">未授权</Badge>;
    }
    switch (currentLicense.status) {
      case 'active':
        return <Badge variant="outline" className="bg-green-100 text-green-800">已授权</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-red-100 text-red-800">已过期</Badge>;
      case 'suspended':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800">已暂停</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  return (
    <div className={cn(
      'bg-slate-900 h-screen flex flex-col text-white transition-all duration-300 ease-in-out',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className={cn(
        'border-b border-slate-700 flex items-center',
        collapsed ? 'p-2 justify-center' : 'p-4 justify-between'
      )}>
        {collapsed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className="text-slate-400 hover:text-white hover:bg-slate-800 h-10 w-10 p-0"
            title="展开菜单"
            aria-label="展开菜单"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : (
          <>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-blue-400 flex-shrink-0" />
              <span>金桔财务系统</span>
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-7 w-7 p-0"
              title="收起菜单"
              aria-label="收起菜单"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* 账套选择 */}
      <div className={cn('border-b border-slate-700', collapsed ? 'p-2' : 'py-2 pr-5')}>
        {/* 账套下拉选择 */}
        <div className="relative">
          {collapsed ? (
            <Button
              variant="ghost"
              className="w-full justify-center text-slate-300 hover:text-white hover:bg-slate-800 h-10 px-0"
              onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
              title={hasMounted ? (currentAccountSet?.name || '请选择账套') : '请选择账套'}
            >
              <Building2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="h-11 w-full justify-between rounded-none px-4 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1" suppressHydrationWarning>
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{hasMounted ? (currentAccountSet?.name || '请选择账套') : '请选择账套'}</span>
              </div>
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            </Button>
          )}

          {/* 下拉菜单 */}
          {showAccountSwitcher && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAccountSwitcher(false)}
              />
              <div className={cn(
                'absolute mt-1 bg-slate-800 rounded-lg shadow-lg z-20 overflow-hidden',
                collapsed ? 'top-full left-full ml-2 w-48' : 'top-full left-0 right-0'
              )}>
                <div className="max-h-60 overflow-y-auto">
                  {accountSets.map((accountSet) => (
                    <button
                      key={accountSet.id}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm flex items-center justify-between',
                        currentAccountSetId === accountSet.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700'
                      )}
                      onClick={() => handleSwitchAccount(accountSet.id)}
                    >
                      <span className="truncate">{accountSet.name}</span>
                      {currentAccountSetId === accountSet.id && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 授权状态 */}
        {!collapsed && (
          <div className="mt-1 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              {hasMounted ? getLicenseStatusBadge() : <Badge variant="outline">加载中...</Badge>}
              {hasMounted && currentPlan && (
                <span className="text-xs text-slate-400">{currentPlan.name}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-400 hover:text-white"
              onClick={() => setShowLicenseDialog(true)}
            >
              <Key className="h-4 w-4" />
            </Button>
          </div>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-slate-400 hover:text-white hover:bg-slate-800 h-10 px-0 mt-2"
            onClick={() => setShowLicenseDialog(true)}
            title="授权管理"
          >
            <Key className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 菜单 */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {visibleMenuItems.map((item) => (
            <li key={item.label} className="relative">
              {item.children ? (
                <div
                  onMouseEnter={() => collapsed && setHoveredItem(item.label)}
                  onMouseLeave={() => collapsed && setHoveredItem(null)}
                >
                  {collapsed ? (
                    <button
                      onClick={() => toggleExpand(item.label)}
                      className={cn(
                        'w-full flex items-center justify-center px-2 py-2.5 text-sm',
                        'text-slate-300 hover:text-white hover:bg-slate-800 transition-colors'
                      )}
                      title={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleExpand(item.label)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-2.5 text-sm',
                        'text-slate-300 hover:text-white hover:bg-slate-800 transition-colors'
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      {(expandedItems.has(item.label) || autoExpandedItems.has(item.label)) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  {collapsed ? (
                    hoveredItem === item.label && (
                      <div className="absolute top-0 left-full ml-2 z-30 min-w-[160px] bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1">
                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-700 mb-1">
                          {item.label}
                        </div>
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            href={child.path}
                            className={cn(
                              'block px-3 py-1.5 text-sm',
                              isActive(child.path)
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                            )}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )
                  ) : (
                    (expandedItems.has(item.label) || autoExpandedItems.has(item.label)) && (
                      <ul className="mt-1 space-y-1 bg-slate-800/50">
                        {item.children.map((child) => (
                          <li key={child.path}>
                            <Link
                              href={child.path}
                              className={cn(
                                'flex items-center px-4 py-2 text-sm pl-12',
                                isActive(child.path)
                                  ? 'bg-slate-700 text-white'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              ) : (
                <Link
                  href={item.path}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    collapsed
                      ? 'flex items-center justify-center px-2 py-2.5 text-sm'
                      : 'flex items-center gap-3 px-4 py-2.5 text-sm',
                    isActive(item.path)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 数据库切换和底部信息 */}
      <div className={cn(
        'border-t border-slate-700 text-xs text-slate-400',
        collapsed ? 'p-2' : 'py-2.5 pl-4 pr-5'
      )}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <div className="w-full flex justify-center mb-1">
              <DatabaseSwitcher />
            </div>
            {currentUser && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-slate-400 hover:text-white hover:bg-slate-800 h-9 px-0"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={currentUser.displayName}
              >
                <User className="h-3.5 w-3.5" />
              </Button>
            )}
            {showUserMenu && currentUser && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute bottom-full left-full ml-2 mb-0 w-40 bg-slate-800 rounded-lg shadow-lg z-20 overflow-hidden">
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    onClick={() => { setShowUserMenu(false); setShowChangePassword(true); }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    修改密码
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                    onClick={() => { setShowUserMenu(false); logout(); window.location.href = '/login'; }}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="border-b border-slate-800 pb-1">
              <DatabaseSwitcher />
            </div>
            {currentUser && (
              <div className="relative mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start rounded-none px-0 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-expanded={showUserMenu}
                  aria-label="打开用户菜单"
                >
                  <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800">
                    <User className="h-3 w-3" />
                  </span>
                  <span className="truncate text-xs font-medium">{currentUser.displayName}</span>
                  <ChevronDown className="h-3 w-3 ml-auto" />
                </Button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 rounded-lg shadow-lg z-20 overflow-hidden">
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => { setShowUserMenu(false); setShowChangePassword(true); }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        修改密码
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => { setShowUserMenu(false); logout(); window.location.href = '/login'; }}
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {hasMounted && currentLicense && (
              <div className="flex items-center gap-1.5 px-1.5 pt-0.5 text-[10px] text-slate-500">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                <span>授权至</span>
                <span className="tabular-nums text-slate-400">{currentLicense.validTo}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 授权激活对话框 */}
      <LicenseActivationDialog
        open={showLicenseDialog}
        onOpenChange={setShowLicenseDialog}
      />

      {/* 修改密码对话框 */}
      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
    </div>
  );
}
