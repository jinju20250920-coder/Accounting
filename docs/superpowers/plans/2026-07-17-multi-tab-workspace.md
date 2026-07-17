# 多 Tab 工作台（Keep-Alive）Implementation Plan — Phase 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `AppLayout` 内打开的每个页面保留成 tab，切换不丢内存状态，用户主动关闭才消失。

**Architecture:** 自研 `PageKeeper`：按路由把 Next 传入的页面节点缓存进 `Map<route, ReactNode>`，所有已打开页面常驻 DOM（激活 `display:block`，其余 `display:none`）；只在路由首次出现时种入节点（之后忽略 Next 的新 children → 状态保留），关闭则从缓存删除（卸载）。`useTabStore` 管 tab 列表/激活/最近关闭；`AppLayout` 用 `usePathname()` effect 自动注册 tab。

**Tech Stack:** Next.js 16.1.6（App Router）, React 19, Zustand 5, TypeScript 5（strict）, Tailwind 4, lucide-react, vitest 2.1.8（node 环境，无 jsdom）。

**参考 spec：** `docs/superpowers/specs/2026-07-17-multi-tab-workspace-design.md`

## Global Constraints

- 所有新组件加 `'use client'`（布局/组件都在客户端运行，数据来自 `sqliteService`）。
- 测试：纯逻辑走 vitest（`npx vitest run <file>`）；vitest `include` 当前只覆盖 `src/lib/**`（Task 2 会扩到 `src/stores/**`），`environment: 'node'`——**没有 jsdom，不能写 React 组件测试**，组件用手动验收。
- 每个任务结束 `npx tsc --noEmit` 过类型；按仓库约定提交（`feat:`/`refactor:`/`test:`/`chore:`），末尾带 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- UI 规范：Tailwind（slate-50 底/white 卡片/blue-600 主色），图标用 lucide-react；禁止原生 `alert/confirm`（本功能不需要）。
- store **不挂 persist**（仅会话内；刷新恢复走 URL，见 spec 第 11 条）。

## File Structure

| 文件 | 职责 | 任务 |
|---|---|---|
| `src/lib/nav-menu.ts` | menuItems（从 sidebar 抽出）+ `routeMeta` + `getRouteMeta(pathname)`：路由→{title,icon} 单一事实源 | T1 |
| `src/lib/nav-menu.test.ts` | getRouteMeta 单测 | T1 |
| `src/stores/useTabStore.ts` | tab 状态 + 开/关/最近关闭/激活 邻居 逻辑 | T2 |
| `src/stores/useTabStore.test.ts` | store reducer 单测 | T2 |
| `src/lib/page-cache.ts` | 纯函数 `reconcilePageCache(cache, pathname, node, openRoutes)`：种入+裁剪 | T3 |
| `src/lib/page-cache.test.ts` | reconcile 单测 | T3 |
| `src/components/layout/page-keeper.tsx` | 薄组件：用 reconcile 维护缓存并渲染（active 显示、其余隐藏） | T3 |
| `src/components/layout/tab-bar.tsx` | tab 栏 UI（切换/关闭/最近关闭/关闭其他/关闭全部） | T4 |
| `src/components/layout/app-layout.tsx` | 接入 PageKeeper（T3）+ TabBar（T4）+ pathname 注册 effect | T3/T4 |
| `src/components/layout/sidebar.tsx` | menuItems 改从 `@/lib/nav-menu` 引入 | T1 |
| `vitest.config.ts` | include 追加 `src/stores/**/*.test.ts` | T2 |

---

## Task 1: 抽出 nav-menu 模块 + 路由元数据（TDD）

**Files:**
- Create: `src/lib/nav-menu.ts`
- Create: `src/lib/nav-menu.test.ts`
- Modify: `src/components/layout/sidebar.tsx`（menuItems 移出 + 改 import）
- Modify: `vitest.config.ts`（无需改，nav-menu.test.ts 在 src/lib 下，已被 include）

**Interfaces:**
- Produces: `menuItems: MenuItem[]`、`MenuItem`、`RouteMeta`、`getRouteMeta(pathname: string): RouteMeta`（`RouteMeta = { title: string; icon?: LucideIcon }`）。

- [ ] **Step 1: 写失败测试** `src/lib/nav-menu.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { getRouteMeta } from './nav-menu';
import { Home, FolderKanban, Users, FileSpreadsheet } from 'lucide-react';

describe('getRouteMeta', () => {
  it('精确命中叶子路径（含从父级继承的 icon）', () => {
    expect(getRouteMeta('/')).toEqual({ title: '智能做账', icon: Home });
    expect(getRouteMeta('/voucher-list')).toEqual({ title: '查看凭证', icon: FolderKanban });
  });

  it('子项 title 覆盖父级、icon 继承父级', () => {
    // /voucher-entry-page 既是父级 path 也是子项 path → 子项 title '新增凭证' + 父级 icon
    expect(getRouteMeta('/voucher-entry-page').title).toBe('新增凭证');
    expect(getRouteMeta('/voucher-entry-page').icon).toBe(FolderKanban);
  });

  it('按父级前缀匹配详情路由', () => {
    // /partner-dashboard 是 往来管理 子项（label 往来单位管理, icon Users）
    expect(getRouteMeta('/partner-dashboard/123')).toEqual({ title: '往来单位管理', icon: Users });
    expect(getRouteMeta('/reports/unknown')).toEqual({ title: '报表查询', icon: FileSpreadsheet });
  });

  it('未命中时兜底：取末段当 title，无 icon', () => {
    expect(getRouteMeta('/no/such/route')).toEqual({ title: 'route' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/nav-menu.test.ts`
Expected: FAIL（`Cannot find module './nav-menu'`）

- [ ] **Step 3: 实现** `src/lib/nav-menu.ts`

```ts
import {
  Home, FolderKanban, Calculator, FileSpreadsheet, Users, Upload,
  FileText, WalletCards, Package, Building2, RefreshCw, Settings,
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/nav-menu.test.ts`
Expected: PASS（4 用例）

- [ ] **Step 5: sidebar.tsx 改为从 nav-menu 引入**

Modify `src/components/layout/sidebar.tsx`：
- 删除文件里的 `const menuItems = [...]` 整块（原 57-106 行）。
- 在 import 区加：`import { menuItems } from '@/lib/nav-menu';`
- 删除因此变得 unused 的 lucide 图标 import（`Home, FolderKanban, Calculator, FileSpreadsheet, Users, Upload, FileText, WalletCards, Package, Building2, RefreshCw, Settings` 中只被 menuItems 用到的那些）。**保留** sidebar 其它地方仍用到的（如 `Settings, ChevronDown, Key, LogOut` 等）。

- [ ] **Step 6: 类型 + lint 检查**

Run: `npx tsc --noEmit 2>&1 | grep -E "nav-menu|sidebar\.tsx" `
Expected: 无新增错误（仓库有既存错误，只要不涉及本次文件即可）。
Run: `npm run lint 2>&1 | grep -E "nav-menu|sidebar" | head`
Expected: 无 unused import 报错。

- [ ] **Step 7: 提交**

```bash
git add src/lib/nav-menu.ts src/lib/nav-menu.test.ts src/components/layout/sidebar.tsx
git commit -m "$(cat <<'EOF'
refactor: extract menuItems into nav-menu module with route metadata

Move the sidebar menuItems into src/lib/nav-menu.ts as the single source
of truth, and add getRouteMeta(pathname) -> {title, icon} (exact leaf,
parent-prefix fallback, last-segment fallback) for the upcoming tab bar.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: useTabStore（TDD）

**Files:**
- Modify: `vitest.config.ts`（include 追加 stores）
- Create: `src/stores/useTabStore.ts`
- Create: `src/stores/useTabStore.test.ts`

**Interfaces:**
- Consumes: `RouteMeta`（icon 可选，来自 T1，但 store 不直接依赖 nav-menu；调用方传 meta 进来）。
- Produces: `useTabStore`（zustand）、`Tab`（`{ route: string; title: string; icon?: LucideIcon; openedAt: number }`）、actions `registerRoute(route, meta)`、`setActive(route)`、`closeTab(route)`、`closeOthers(route)`、`closeAll()`、`reopenRecent(route)`、`clearRecent()`。

- [ ] **Step 1: 扩 vitest include**

Modify `vitest.config.ts`，把 `test.include` 改为：

```ts
    include: ['src/lib/**/*.test.ts', 'src/lib/**/*.test.tsx', 'src/stores/**/*.test.ts'],
```

- [ ] **Step 2: 写失败测试** `src/stores/useTabStore.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from './useTabStore';

const reset = () => useTabStore.setState({ tabs: [], activeRoute: null, recentlyClosed: [] });
const reg = (route: string, title: string) => useTabStore.getState().registerRoute(route, { title });

describe('useTabStore', () => {
  beforeEach(reset);

  it('registerRoute 新增并置激活；重复不新增只置激活', () => {
    reg('/a', 'A');
    reg('/b', 'B');
    expect(useTabStore.getState().tabs.map((t) => t.route)).toEqual(['/a', '/b']);
    expect(useTabStore.getState().activeRoute).toBe('/b');
    reg('/a', 'A');
    expect(useTabStore.getState().tabs).toHaveLength(2);
    expect(useTabStore.getState().activeRoute).toBe('/a');
  });

  it('closeTab 非激活项：移除并进最近关闭，激活不变', () => {
    reg('/a', 'A'); reg('/b', 'B'); reg('/c', 'C');
    useTabStore.getState().setActive('/b');
    useTabStore.getState().closeTab('/a');
    expect(useTabStore.getState().tabs.map((t) => t.route)).toEqual(['/b', '/c']);
    expect(useTabStore.getState().activeRoute).toBe('/b');
    expect(useTabStore.getState().recentlyClosed[0].route).toBe('/a');
  });

  it('closeTab 激活项在中间：激活前一个邻居', () => {
    reg('/a', 'A'); reg('/b', 'B'); reg('/c', 'C');
    useTabStore.getState().setActive('/b');
    useTabStore.getState().closeTab('/b');
    expect(useTabStore.getState().activeRoute).toBe('/a');
  });

  it('closeTab 激活首项：激活后一个邻居', () => {
    reg('/a', 'A'); reg('/b', 'B');
    useTabStore.getState().setActive('/a');
    useTabStore.getState().closeTab('/a');
    expect(useTabStore.getState().activeRoute).toBe('/b');
  });

  it('closeTab 唯一 tab：activeRoute 为 null（调用方负责跳首页）', () => {
    reg('/a', 'A');
    useTabStore.getState().closeTab('/a');
    expect(useTabStore.getState().tabs).toHaveLength(0);
    expect(useTabStore.getState().activeRoute).toBeNull();
  });

  it('最近关闭上限 10', () => {
    for (let i = 0; i < 12; i++) reg(`/r${i}`, `R${i}`);
    for (let i = 0; i < 12; i++) useTabStore.getState().closeTab(`/r${i}`);
    expect(useTabStore.getState().recentlyClosed).toHaveLength(10);
    expect(useTabStore.getState().recentlyClosed[0].route).toBe('/r11');
  });

  it('closeOthers 只保留指定项并置激活，其余进最近关闭', () => {
    reg('/a', 'A'); reg('/b', 'B'); reg('/c', 'C');
    useTabStore.getState().closeOthers('/b');
    expect(useTabStore.getState().tabs.map((t) => t.route)).toEqual(['/b']);
    expect(useTabStore.getState().activeRoute).toBe('/b');
    expect(useTabStore.getState().recentlyClosed.map((t) => t.route).sort()).toEqual(['/a', '/c']);
  });

  it('closeAll 清空 tabs、activeRoute=null、全部进最近关闭', () => {
    reg('/a', 'A'); reg('/b', 'B');
    useTabStore.getState().closeAll();
    expect(useTabStore.getState().tabs).toHaveLength(0);
    expect(useTabStore.getState().activeRoute).toBeNull();
    expect(useTabStore.getState().recentlyClosed).toHaveLength(2);
  });

  it('reopenRecent 从最近关闭移回 tabs 末尾并激活', () => {
    reg('/a', 'A'); reg('/b', 'B');
    useTabStore.getState().closeTab('/a');
    useTabStore.getState().reopenRecent('/a');
    expect(useTabStore.getState().tabs.map((t) => t.route)).toEqual(['/b', '/a']);
    expect(useTabStore.getState().activeRoute).toBe('/a');
    expect(useTabStore.getState().recentlyClosed.find((t) => t.route === '/a')).toBeUndefined();
  });

  it('clearRecent 清空最近关闭', () => {
    reg('/a', 'A'); useTabStore.getState().closeTab('/a');
    useTabStore.getState().clearRecent();
    expect(useTabStore.getState().recentlyClosed).toHaveLength(0);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/stores/useTabStore.test.ts`
Expected: FAIL（`Cannot find module './useTabStore'`）

- [ ] **Step 4: 实现** `src/stores/useTabStore.ts`

```ts
import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';

export interface Tab {
  route: string;
  title: string;
  icon?: LucideIcon;
  openedAt: number;
}

const RECENT_CAP = 10;

interface TabState {
  tabs: Tab[];
  activeRoute: string | null;
  recentlyClosed: Tab[];
  registerRoute: (route: string, meta: { title: string; icon?: LucideIcon }) => void;
  setActive: (route: string) => void;
  closeTab: (route: string) => void;
  closeOthers: (route: string) => void;
  closeAll: () => void;
  reopenRecent: (route: string) => void;
  clearRecent: () => void;
}

export const useTabStore = create<TabState>((set) => ({
  tabs: [],
  activeRoute: null,
  recentlyClosed: [],

  registerRoute: (route, meta) =>
    set((s) => {
      const exists = s.tabs.some((t) => t.route === route);
      const tabs = exists
        ? s.tabs
        : [...s.tabs, { route, title: meta.title, icon: meta.icon, openedAt: Date.now() }];
      return { tabs, activeRoute: route };
    }),

  setActive: (route) => set({ activeRoute: route }),

  closeTab: (route) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.route === route);
      if (idx < 0) return {};
      const closed = s.tabs[idx];
      const tabs = s.tabs.filter((t) => t.route !== route);
      const recentlyClosed = [closed, ...s.recentlyClosed.filter((t) => t.route !== route)].slice(0, RECENT_CAP);
      // 关激活项：优先前一个邻居（filter 后 tabs[idx-1]），否则后一个（tabs[idx]），否则 null
      const activeRoute =
        s.activeRoute === route ? (tabs[idx - 1]?.route ?? tabs[idx]?.route ?? null) : s.activeRoute;
      return { tabs, recentlyClosed, activeRoute };
    }),

  closeOthers: (route) =>
    set((s) => {
      const keep = s.tabs.find((t) => t.route === route);
      if (!keep) return {};
      const closed = s.tabs.filter((t) => t.route !== route).reverse();
      return { tabs: [keep], activeRoute: route, recentlyClosed: [...closed, ...s.recentlyClosed].slice(0, RECENT_CAP) };
    }),

  closeAll: () =>
    set((s) => ({
      tabs: [],
      activeRoute: null,
      recentlyClosed: [...s.tabs.slice().reverse(), ...s.recentlyClosed].slice(0, RECENT_CAP),
    })),

  reopenRecent: (route) =>
    set((s) => {
      const idx = s.recentlyClosed.findIndex((t) => t.route === route);
      if (idx < 0) return {};
      const tab = s.recentlyClosed[idx];
      const recentlyClosed = s.recentlyClosed.filter((t) => t.route !== route);
      const exists = s.tabs.some((t) => t.route === route);
      const tabs = exists ? s.tabs : [...s.tabs, { ...tab, openedAt: Date.now() }];
      return { tabs, recentlyClosed, activeRoute: route };
    }),

  clearRecent: () => set({ recentlyClosed: [] }),
}));
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/stores/useTabStore.test.ts`
Expected: PASS（10 用例）

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit 2>&1 | grep -E "useTabStore|vitest.config"`
Expected: 无新增错误。

- [ ] **Step 7: 提交**

```bash
git add vitest.config.ts src/stores/useTabStore.ts src/stores/useTabStore.test.ts
git commit -m "$(cat <<'EOF'
feat: add useTabStore for multi-tab workspace state

Zustand store (unpersisted, in-session) tracking open tabs, active route,
and a capped recently-closed list. Close-on-active activates the previous
neighbor (then next, then null). Unit-tested; vitest include extended to
src/stores/**.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: PageKeeper 保活 + AppLayout 核心接入

**Files:**
- Create: `src/lib/page-cache.ts`
- Create: `src/lib/page-cache.test.ts`
- Create: `src/components/layout/page-keeper.tsx`
- Modify: `src/components/layout/app-layout.tsx`

**Interfaces:**
- Consumes: `useTabStore`（T2：读 `tabs`、`activeRoute`）。
- Produces: `reconcilePageCache(cache, pathname, node, openRoutes)`（纯函数）、`PageKeeper`（`{ pathname: string; children: ReactNode }`）。

- [ ] **Step 1: 写失败测试** `src/lib/page-cache.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { reconcilePageCache } from './page-cache';

describe('reconcilePageCache', () => {
  it('首次出现种入节点', () => {
    const cache = new Map<string, unknown>();
    reconcilePageCache(cache as never, '/a', 'nodeA' as never, new Set(['/a']));
    expect(cache.get('/a')).toBe('nodeA');
  });

  it('已存在不覆盖（首写优先，保留状态）', () => {
    const cache = new Map<string, unknown>([['/a', 'old']]);
    reconcilePageCache(cache as never, '/a', 'new' as never, new Set(['/a']));
    expect(cache.get('/a')).toBe('old');
  });

  it('裁剪不在 openRoutes 里的已关闭路由', () => {
    const cache = new Map<string, unknown>([['/a', 'A'], ['/b', 'B']]);
    reconcilePageCache(cache as never, '/a', 'A' as never, new Set(['/a']));
    expect(cache.has('/b')).toBe(false);
    expect(cache.has('/a')).toBe(true);
  });

  it('当前 pathname 即使不在 openRoutes 也不被裁剪', () => {
    const cache = new Map<string, unknown>([['/a', 'A']]);
    reconcilePageCache(cache as never, '/a', 'A' as never, new Set());
    expect(cache.has('/a')).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/page-cache.test.ts`
Expected: FAIL（`Cannot find module './page-cache'`）

- [ ] **Step 3: 实现纯函数** `src/lib/page-cache.ts`

```ts
import type { ReactNode } from 'react';

/**
 * 每次渲染调和保活缓存：
 * - 种入：pathname 未缓存时写入 node（首写优先 → 切回旧路由保留旧节点状态）。
 * - 裁剪：缓存里但不在 openRoutes（已关闭）的路由删除 → React 卸载。
 * 就地修改 cache；调用方重渲染以反映变化。当前 pathname 永不裁剪。
 */
export function reconcilePageCache(
  cache: Map<string, ReactNode>,
  pathname: string,
  node: ReactNode,
  openRoutes: Set<string>,
): void {
  if (pathname && !cache.has(pathname)) cache.set(pathname, node);
  for (const route of Array.from(cache.keys())) {
    if (route !== pathname && !openRoutes.has(route)) cache.delete(route);
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/page-cache.test.ts`
Expected: PASS（4 用例）

- [ ] **Step 5: 实现 PageKeeper 组件** `src/components/layout/page-keeper.tsx`

```tsx
'use client';

import { useRef, type ReactNode } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { reconcilePageCache } from '@/lib/page-cache';

export function PageKeeper({ pathname, children }: { pathname: string; children: ReactNode }) {
  const pagesRef = useRef<Map<string, ReactNode>>(new Map());
  const tabs = useTabStore((s) => s.tabs);
  const activeRoute = useTabStore((s) => s.activeRoute);

  const pages = pagesRef.current;
  const openRoutes = new Set(tabs.map((t) => t.route));
  reconcilePageCache(pages, pathname, children, openRoutes);

  const active = activeRoute ?? pathname;

  return (
    <>
      {[...pages.entries()].map(([route, node]) => (
        <div
          key={route}
          style={{ display: route === active ? 'block' : 'none' }}
          aria-hidden={route !== active}
        >
          {node}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 6: AppLayout 接入（pathname 注册 + PageKeeper，暂不加 TabBar）**

把 `src/components/layout/app-layout.tsx` 整体替换为：

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { CurrentPeriodWrapper } from '@/components/layout/current-period-wrapper';
import { PageKeeper } from '@/components/layout/page-keeper';
import { GlobalErrorProvider } from '@/components/error-boundary';
import { DatabaseSyncWrapper } from '@/components/DatabaseSyncWrapper';
import { FirstTimeWrapper } from '@/components/database/first-time-wrapper';
import { TaxReminderOnLogin } from '@/components/layout/tax-reminder-on-login';
import { useTabStore } from '@/stores/useTabStore';
import { getRouteMeta } from '@/lib/nav-menu';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    useTabStore.getState().registerRoute(pathname, getRouteMeta(pathname));
  }, [pathname]);

  return (
    <GlobalErrorProvider>
      <FirstTimeWrapper>
        <DatabaseSyncWrapper />
        <TaxReminderOnLogin />
        <div className="flex h-screen bg-slate-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <CurrentPeriodWrapper />
            <div className="flex-1 overflow-auto">
              <PageKeeper pathname={pathname}>{children}</PageKeeper>
            </div>
          </div>
        </div>
      </FirstTimeWrapper>
    </GlobalErrorProvider>
  );
}
```

- [ ] **Step 7: 类型检查**

Run: `npx tsc --noEmit 2>&1 | grep -E "page-cache|page-keeper|app-layout"`
Expected: 无新增错误。

- [ ] **Step 8: 手动验收保活（核心）**

Run: `npm run dev`，登录后：
1. 侧边栏点「凭证」（/voucher-entry-page），在录入网格录入几行未保存分录。
2. 侧边栏点「资金管理」（/import）。
3. 侧边栏再点「凭证」切回。
4. **预期**：刚才录入的分录原样还在（无 TabBar，但 keep-alive 已生效——状态未丢）。
5. 复现用户场景：点「往来单位管理」→ 点「资金管理」→ 点「往来单位管理」切回，往来单位管理列表状态保留。
6. Ctrl/Cmd+R 刷新：URL 停在最后路由，该页作为唯一 tab 自动回来（全新加载、草稿丢——符合 spec）。

- [ ] **Step 9: 提交**

```bash
git add src/lib/page-cache.ts src/lib/page-cache.test.ts src/components/layout/page-keeper.tsx src/components/layout/app-layout.tsx
git commit -m "$(cat <<'EOF'
feat: keep-alive open pages via PageKeeper in AppLayout

PageKeeper caches each route's page node in a Map (seeded first-write-wins,
pruned on close) and renders all open pages, showing only the active one.
Navigating A->B->A restores A from cache instead of remounting, preserving
its in-memory state. AppLayout registers the current pathname as a tab via
usePathname effect. No tab UI yet (Task 4). reconcilePageCache logic is
unit-tested.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: TabBar UI + 完整集成

**Files:**
- Create: `src/components/layout/tab-bar.tsx`
- Modify: `src/components/layout/app-layout.tsx`（渲染 `<TabBar />`）

**Interfaces:**
- Consumes: `useTabStore`（T2：tabs/activeRoute/recentlyClosed + 全部 actions）、`next/navigation` `useRouter`。

- [ ] **Step 1: 实现 TabBar** `src/components/layout/tab-bar.tsx`

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTabStore } from '@/stores/useTabStore';
import { X, Clock } from 'lucide-react';

export function TabBar() {
  const router = useRouter();
  const tabs = useTabStore((s) => s.tabs);
  const activeRoute = useTabStore((s) => s.activeRoute);
  const recentlyClosed = useTabStore((s) => s.recentlyClosed);
  const setActive = useTabStore((s) => s.setActive);
  const closeTab = useTabStore((s) => s.closeTab);
  const closeOthers = useTabStore((s) => s.closeOthers);
  const closeAll = useTabStore((s) => s.closeAll);
  const reopenRecent = useTabStore((s) => s.reopenRecent);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 点外部关闭菜单
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuFor(null);
        setShowRecent(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (tabs.length === 0) return null;

  const activate = (route: string) => {
    setActive(route);
    router.push(route);
  };

  const handleClose = (route: string) => {
    const wasActive = route === activeRoute;
    closeTab(route);
    if (wasActive) router.push(useTabStore.getState().activeRoute || '/');
  };

  const handleReopen = (route: string) => {
    reopenRecent(route);
    router.push(route);
    setShowRecent(false);
  };

  return (
    <div
      ref={wrapRef}
      className="flex items-stretch gap-0.5 border-b border-slate-200 bg-slate-100 px-2 overflow-x-auto"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.route === activeRoute;
        return (
          <div
            key={tab.route}
            onClick={() => activate(tab.route)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuFor(menuFor === tab.route ? null : tab.route);
            }}
            className={`group relative flex items-center gap-1 rounded-t-md px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap ${
              active
                ? 'bg-white text-blue-700 border-x border-t border-slate-200 -mb-px'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{tab.title}</span>
            <button
              aria-label="关闭标签"
              onClick={(e) => {
                e.stopPropagation();
                handleClose(tab.route);
              }}
              className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-300/60 hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>

            {menuFor === tab.route && (
              <div className="absolute right-0 top-full z-50 mt-0.5 w-28 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg">
                <div
                  className="px-3 py-1.5 hover:bg-slate-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeOthers(tab.route);
                    setMenuFor(null);
                    router.push(tab.route);
                  }}
                >
                  关闭其他
                </div>
                <div
                  className="px-3 py-1.5 hover:bg-slate-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeAll();
                    setMenuFor(null);
                    router.push('/');
                  }}
                >
                  关闭全部
                </div>
              </div>
            )}
          </div>
        );
      })}

      {recentlyClosed.length > 0 && (
        <div className="relative ml-auto flex items-center pr-1">
          <button
            title="最近关闭"
            onClick={() => setShowRecent((v) => !v)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200/60"
          >
            <Clock className="h-3.5 w-3.5" /> 最近关闭
          </button>
          {showRecent && (
            <div className="absolute right-0 top-full z-50 mt-0.5 w-44 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg">
              {recentlyClosed.map((t) => {
                const Icon = t.icon;
                return (
                  <div
                    key={t.route + t.openedAt}
                    onClick={() => handleReopen(t.route)}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-50"
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <span className="truncate">{t.title}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: AppLayout 渲染 TabBar（期间栏与内容区之间）**

Modify `src/components/layout/app-layout.tsx`：
- import 加：`import { TabBar } from '@/components/layout/tab-bar';`
- 在 `<CurrentPeriodWrapper />` 与 `<div className="flex-1 overflow-auto">` 之间插入 `<TabBar />`：

```tsx
          <div className="flex-1 flex flex-col overflow-hidden">
            <CurrentPeriodWrapper />
            <TabBar />
            <div className="flex-1 overflow-auto">
              <PageKeeper pathname={pathname}>{children}</PageKeeper>
            </div>
          </div>
```

- [ ] **Step 3: 类型 + lint 检查**

Run: `npx tsc --noEmit 2>&1 | grep -E "tab-bar|app-layout"`
Expected: 无新增错误。
Run: `npm run lint 2>&1 | grep -E "tab-bar" | head`
Expected: 无报错。

- [ ] **Step 4: 手动验收（spec 第 14 条全部场景）**

Run: `npm run dev`，登录后逐项验证：
1. **保活**：开「凭证」录入未保存分录 → 开「资金管理」→ 点「凭证」tab → 分录仍在、滚动位置不变。
2. **多页并存**：开「往来单位管理」→ 开「资金管理」→ 往来单位管理**不自动关闭**，二者同为 tab，可点 tab 来回切。
3. **关闭**：点 tab × → 关闭并进「最近关闭」；点关闭激活项 → 自动切到邻居 tab。
4. **最近关闭**：点「最近关闭」下拉里的条目 → 重新打开（全新加载，草稿丢）。
5. **关闭其他/关闭全部**：tab 上右键 → 菜单生效；全部关闭后自动回首页 dashboard（仍 1 个 tab），无空状态。
6. **刷新恢复最后 tab**：在某页刷新 → 该页作为唯一 tab 自动回来（全新挂载，草稿丢）。
7. **侧边栏激活高亮**：与当前激活 tab 一致（侧边栏自身逻辑，不应受影响）。

- [ ] **Step 5: 跑全部单测确认无回归**

Run: `npx vitest run`
Expected: 全绿（nav-menu / useTabStore / page-cache + 仓库既有用例）。

- [ ] **Step 6: 提交**

```bash
git add src/components/layout/tab-bar.tsx src/components/layout/app-layout.tsx
git commit -m "$(cat <<'EOF'
feat: add TabBar UI to switch/close/restore workspace tabs

Horizontal tab strip above the content area: click to switch (syncs URL),
x to close (auto-activates neighbor, falls back to dashboard on last
close), right-click menu for close-others/close-all, and a recently-closed
dropdown to reopen. Renders above the keep-alive PageKeeper in AppLayout.
Completes Phase 1 of the multi-tab workspace.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review（plan 作者自查记录）

- **Spec 覆盖**：spec 第 5 节架构→T3/T4；第 6 节 PageKeeper→T3；第 7 节 store→T2；第 8 节 nav-menu→T1；第 9 节导航联动→T3（pathname effect）；第 10 节 TabBar→T4；第 11 节刷新恢复→T3 Step 8 验收 6（URL 兜底，无代码）；第 12 节边界→T2 测试覆盖邻居激活/唯一 tab，T4 验收 5 覆盖关闭全部；第 14 节验收→T4 Step 4 全量。无遗漏。
- **占位符**：无 TBD/TODO；所有代码块完整。
- **类型一致性**：`registerRoute(route, meta)`、`closeTab/closeOthers(route)`、`reopenRecent(route)`、`reconcilePageCache(cache,pathname,node,openRoutes)` 在 T2/T3 定义且 T3/T4 调用签名一致；`getRouteMeta` T1 定义、T3 调用一致；`Tab.openedAt` 在 store/recent/TabBar key 中使用一致。
- **已知 dev 现象**：React StrictMode 首次挂载双调用（spec 第 12 节），验收若见首次访问一次性状态重置属 dev 现象，非缺陷。
