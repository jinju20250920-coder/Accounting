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
  TrendingUp,
  Users,
  Building2,
  RefreshCw,
  Upload,
  Settings,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  List,
  Check,
  Key,
  CreditCard,
  Package,
  Lightbulb,
  Clock,
  ArrowDownCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
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
import { useToast } from '@/components/ui/toast';

const menuItems = [
  { icon: Home, label: '首页', path: '/' },
  { icon: FolderKanban, label: '凭证', path: '/voucher-entry-page', children: [
    { label: '新增凭证', path: '/voucher-entry-page' },
    { label: '查看凭证', path: '/voucher-list' },
  ]},
  { icon: Calculator, label: '科目余额', path: '/balance' },
  { icon: FileSpreadsheet, label: '报表查询', path: '/reports', children: [
    { label: '资产负债表', path: '/reports/assets' },
    { label: '损益表', path: '/reports/profit' },
    { label: '现金流量表', path: '/reports/cashflow' },
  ]},
  { icon: Users, label: '往来管理', path: '/aging', children: [
    { label: '往来单位管理', path: '/partner-dashboard' },
    { label: '应收明细', path: '/aging/ar' },
    { label: '应付明细', path: '/aging/ap' },
  ]},
  { icon: Upload, label: '资金管理', path: '/import' },
  { icon: FileText, label: '发票管理', path: '/invoices', children: [
    { label: '进项发票', path: '/invoices/input' },
    { label: '销项发票', path: '/invoices/output' },
    { label: '发票资金一览表', path: '/invoices/summary' },
  ]},
  { icon: Package, label: '资产管理', path: '/assets', children: [
    { label: '固定资产', path: '/assets/fixed' },
    { label: '无形资产', path: '/assets/intangible' },
    { label: '待摊费用', path: '/assets/prepaid' },
    { label: '批量折旧', path: '/assets/depreciation' },
    { label: '批量摊销', path: '/assets/amortization' },
  ]},
  { icon: Building2, label: '账套管理', path: '/sets' },
  { icon: RefreshCw, label: '汇兑损益', path: '/exchange' },
  { icon: Settings, label: '基础档案', path: '/settings', children: [
    { label: '科目管理', path: '/settings/subjects' },
    { label: '部门管理', path: '/settings/departments' },
    { label: '项目管理', path: '/settings/projects' },
    { label: '往来单位管理', path: '/settings/auxiliary' },
    { label: '币别管理', path: '/settings/currencies' },
    { label: '常用摘要库', path: '/settings/summaries' },
    { label: '凭证模版', path: '/settings/templates' },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>授权管理</DialogTitle>
          <DialogDescription>
            激活您的授权码以解锁更多功能
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activate">激活授权</TabsTrigger>
            <TabsTrigger value="plans">套餐选择</TabsTrigger>
          </TabsList>

          <TabsContent value="activate" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label required>授权码</Label>
                <Input
                  placeholder="请输入授权码，如 LIVE-299-SET1"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  授权码格式：LIVE-价格-账套数量（例如：LIVE-299-SET1 或 LIVE-599-SET5）
                </p>
              </div>

              <div className="space-y-2">
                <Label>激活令牌（可选）</Label>
                <Input
                  placeholder="如果有激活令牌，请输入"
                  value={activationToken}
                  onChange={(e) => setActivationToken(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>折扣码（可选）</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入折扣码"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                  />
                  <Button variant="outline" onClick={handleApplyDiscount}>
                    应用
                  </Button>
                </div>
                {discountApplied && discountApplied.valid && (
                  <p className="text-sm text-green-600">
                    ✓ {discountApplied.description}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="plans" className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    'border rounded-lg p-4 relative',
                    plan.isPopular ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                  )}
                >
                  {plan.isPopular && (
                    <Badge className="absolute -top-2 -right-2 bg-blue-500">
                      推荐
                    </Badge>
                  )}
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <p className="text-2xl font-bold my-2">
                    ¥{getPlanPrice(plan.price)}
                    <span className="text-sm text-slate-500 font-normal">/月</span>
                  </p>
                  <p className="text-sm text-slate-600 mb-4">{plan.description}</p>
                  <div className="text-sm space-y-1">
                    <p>• 账套数量：{plan.accountSetLimit === -1 ? '无限' : plan.accountSetLimit}</p>
                    <p>• 功能数量：{plan.featureIds.length}</p>
                  </div>
                  <Button
                    className="w-full mt-4"
                    variant={plan.isPopular ? 'default' : 'outline'}
                    onClick={() => {
                      setActiveTab('activate');
                      showToast('info', '请输入对应套餐的授权码');
                    }}
                  >
                    选择套餐
                  </Button>
                </div>
              ))}
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
          >
            {isActivating ? '激活中...' : '激活授权'}
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
  const [hasMounted, setHasMounted] = useState(false);
  const {
    accountSets,
    currentAccountSetId,
    getCurrentAccountSet,
    setCurrentAccountSet,
    getCurrentLicense,
    pricingPlans,
    currentPricingPlanId,
  } = useAccountSetStore();

  const currentAccountSet = getCurrentAccountSet();
  const currentLicense = getCurrentLicense();
  const currentPlan = pricingPlans.find(p => p.id === currentPricingPlanId);

  // 防止 Hydration 错误：只有在客户端挂载后才显示动态内容
  useEffect(() => {
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

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  const handleSwitchAccount = (accountSetId: string) => {
    // 保存当前账套ID到 sessionStorage，用于在 hook 中检测账套切换
    sessionStorage.setItem('lastAccountSetId', currentAccountSetId || '');
    setCurrentAccountSet(accountSetId);
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
    <div className="w-64 bg-slate-900 h-screen flex flex-col text-white">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-blue-400" />
          金桔财务系统
        </h1>
      </div>

      {/* 账套选择 */}
      <div className="p-4 border-b border-slate-700">
        {/* 账套下拉选择 */}
        <div className="relative">
          <Button
            variant="ghost"
            className="w-full justify-between text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1" suppressHydrationWarning>
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{hasMounted ? (currentAccountSet?.name || '请选择账套') : '请选择账套'}</span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </Button>

          {/* 下拉菜单 */}
          {showAccountSwitcher && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAccountSwitcher(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg shadow-lg z-20 overflow-hidden">
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
                <div className="border-t border-slate-700 p-2">
                  <Link href="/sets" onClick={() => setShowAccountSwitcher(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-center text-sm text-slate-400 hover:text-white"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      管理账套
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 授权状态 */}
        <div className="mt-2 flex items-center justify-between">
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
      </div>

      {/* 菜单 */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.label}>
              {item.children ? (
                <div>
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
                    {expandedItems.has(item.label) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedItems.has(item.label) && (
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
                  )}
                </div>
              ) : (
                <Link
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm',
                    isActive(item.path)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 数据库切换和底部信息 */}
      <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
        <div className="mb-3">
          <DatabaseSwitcher />
        </div>
        <div className="flex items-center justify-between mb-2">
          <span>期间: {hasMounted ? (currentAccountSet?.currentPeriod || '2026-03') : '2026-03'}</span>
          <span>记-001</span>
        </div>
        <div>操作员: 管理员</div>
        {hasMounted && currentLicense && (
          <div className="mt-2 pt-2 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <span>有效期至:</span>
              <span>{currentLicense.validTo}</span>
            </div>
          </div>
        )}
      </div>

      {/* 授权激活对话框 */}
      <LicenseActivationDialog
        open={showLicenseDialog}
        onOpenChange={setShowLicenseDialog}
      />
    </div>
  );
}
