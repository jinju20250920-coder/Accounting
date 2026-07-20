import {
  Home, FolderKanban, Calculator, FileSpreadsheet, Users, Upload,
  FileText, WalletCards, Package, Building2, RefreshCw, Settings, CalendarClock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  permission: string;
  children?: { label: string; path: string; permission: string }[];
}

// 从 sidebar.tsx 原样移入（原 sidebar.tsx:57-106），内容不变。
export const menuItems: MenuItem[] = [
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
  { icon: CalendarClock, label: '税务管理', path: '/tax', permission: 'voucher:view' },
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

export interface RouteMeta {
  title: string;
  icon?: LucideIcon;
}

// flatten：父级先入，子项覆盖 title 并继承父级 icon。
const routeMeta: Record<string, RouteMeta> = (() => {
  const map: Record<string, RouteMeta> = {};
  for (const item of menuItems) {
    map[item.path] = { title: item.label, icon: item.icon };
    for (const child of item.children || []) {
      map[child.path] = { title: child.label, icon: item.icon };
    }
  }
  return map;
})();

export function getRouteMeta(pathname: string): RouteMeta {
  if (routeMeta[pathname]) return routeMeta[pathname];
  // 最长父级前缀匹配（排除 '/'，否则恒匹配）
  let bestKey = '';
  let bestMeta: RouteMeta | undefined;
  for (const [key, meta] of Object.entries(routeMeta)) {
    if (key !== '/' && pathname.startsWith(key + '/') && key.length > bestKey.length) {
      bestKey = key;
      bestMeta = meta;
    }
  }
  if (bestMeta) return bestMeta;
  const seg = pathname.split('/').filter(Boolean).pop();
  return { title: seg || '未命名' };
}
