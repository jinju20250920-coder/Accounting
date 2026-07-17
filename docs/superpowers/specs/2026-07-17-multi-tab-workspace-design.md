# 多 Tab 工作台（Keep-Alive）— Phase 1 设计

- 日期：2026-07-17
- 状态：已确认，待出实现计划
- 关联：Phase 2（草稿恢复）为独立后续工程，不在本 spec 范围

## 1. 背景

当前系统基于 Next.js App Router。`AppLayout`（`src/components/layout/app-layout.tsx`）把 `{children}` 渲染在一个滚动容器里；侧边栏点击触发客户端路由切换，Next 会**卸载旧页面、挂载新页面**。因此打开页面 B 时，页面 A 的组件被卸载——其内存状态（未保存录入、滚动位置、已加载数据、打开的弹窗）全部丢失。用户视角即"开新页，旧页消失"。

用户诉求：每个打开的页面保留成 **tab**，可在多个 tab 间随时切换、互不影响；每个 tab 由用户**主动关闭**（不自动消失）。

## 2. 分期

本需求拆为两个相对独立的子系统，**本 spec 只覆盖 Phase 1**：

| | 子系统 | 是否本 spec |
|---|---|---|
| **Phase 1** | 多 tab 工作台（keep-alive）：tab 栏、页面保活、tab store、导航联动、关闭 + 最近关闭、刷新恢复最后一个 tab | ✅ |
| Phase 2 | 草稿恢复：通用草稿自动保存设施 + "恢复/重新新增"弹窗，接入所有编辑类页面（凭证录入、发票、资产、期初等） | ❌ 后续单独 brainstorm |

理由：两者技术解耦。Phase 1 单独即交付核心价值；Phase 2 是逐页面工程，体量大，单独立项。

## 3. 需求（已与用户确认）

1. **完全保活**：切换 tab 再切回，页面内存状态原样保留（未保存录入、滚动、已加载数据、打开的弹窗均不丢）。
2. **仅本次会话**：tab 状态不持久化（但见第 5 条的 URL 兜底）。
3. **所有侧边栏页面都生成 tab**（保证系统一致性）。
4. **关闭**：直接关 + 「最近关闭」列表可恢复；恢复 = 重新打开路由 + 已存数据库数据，**未保存草稿仍丢**（草稿跨刷新存活属 Phase 2）。
5. **刷新后只自动恢复最后一个激活 tab**：因为 URL 始终同步到激活 tab，刷新时浏览器停在最后路由，Next 渲染它即自动重新注册成（唯一的）tab。**Phase 1 无需持久化代码**。页面为全新挂载，未保存草稿丢。

## 4. 非目标（Phase 1 明确不做）

- 未保存内容的跨刷新恢复（→ Phase 2）。
- 持久化完整 tab 列表跨刷新（只恢复最后一个，且通过 URL）。
- 关闭前未保存改动确认弹窗（直接关）。
- 把详情路由（`/[id]`）按父级合并成一个 tab（每个完整 pathname = 独立 tab）。

## 5. 架构总览

```
AppLayout（跨路由常驻，'use client'）
├── Sidebar                       （不变；点击仍是 <Link> 客户端导航）
├── CurrentPeriodWrapper          （全局，不变）
├── <TabBar />                    ← 新增：tab 栏（开/关/最近关闭）
└── <PageKeeper pathname={pn}>    ← 新增：接管原 {children}，保活已打开页面
     └─ 每个已打开路由：{缓存的页面节点}（display:block | none）
```

`PageKeeper` 替换原 `{children}` 位置。它缓存的是 React 节点本身；节点只要一直留在 React 树里就保活。

`AppLayout` 是 `'use client'`，所有页面也是客户端组件（数据从 `sqliteService` 取，不依赖服务端组件），因此缓存并持续渲染其节点是安全的。

## 6. 保活机制：PageKeeper（方案 A 核心）

文件：`src/components/layout/page-keeper.tsx`。

用 `useRef<Map<string, ReactNode>>` 持有缓存，跨渲染持久：

```tsx
function PageKeeper({ pathname, children }: { pathname: string; children: ReactNode }) {
  const pagesRef = useRef<Map<string, ReactNode>>(new Map());
  const tabs = useTabStore(s => s.tabs);
  const activeRoute = useTabStore(s => s.activeRoute);

  const pages = pagesRef.current;

  // 只在「该路由首次出现」时种入；之后绝不覆盖 → 保留旧节点状态
  if (!pages.has(pathname)) pages.set(pathname, children);

  // 清理已被关闭的路由（不在 tab store 里的）→ 触发卸载
  const openRoutes = new Set(tabs.map(t => t.route));
  for (const route of pages.keys()) {
    if (!openRoutes.has(route)) pages.delete(route);
  }

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

要点：
- **种入规则**：导航回旧路由时，Next 会传入该路由**全新**的 `children`，但 `pages.has(pathname)` 为真 → **忽略新 children、继续渲染缓存的旧节点**。旧节点从未离开过树，其内部 state/草稿/滚动全在。
- **关闭**：`closeTab(route)` 把路由从 store 移除 → 本组件订阅了 `tabs` → 重渲染 → `pages.delete(route)` → React 卸载对应子树。
- **Next 管不到 PageKeeper 内部子树**：Next 只控制传给 `AppLayout` 的 `children` prop；PageKeeper 持有的缓存节点是它自己的子树，Next 无法卸载它们。
- **render 期写 ref**：`if (!pages.has) pages.set(...)` 是 keep-alive 类库的常见模式（缓存元素引用，幂等）。StrictMode 双调用下幂等安全。
- **`aria-hidden` + `display:none`**：隐藏页对辅助技术不可见，且不占布局。

## 7. Tab 状态：useTabStore

文件：`src/stores/useTabStore.ts`。Zustand store，**不挂 persist**（仅会话内；刷新恢复走 URL）。

```ts
interface Tab { route: string; title: string; icon?: string; openedAt: number }

interface TabState {
  tabs: Tab[];                       // 有序，打开先后
  activeRoute: string | null;
  recentlyClosed: Tab[];             // 上限 10，最新在前
  // actions
  registerRoute: (route: string, meta: { title: string; icon?: string }) => void;
  setActive: (route: string) => void;
  closeTab: (route: string) => void;           // 关闭；若关的是激活项，自动激活邻居（优先前一个，其次后一个）
  closeOthers: (route: string) => void;        // 仅保留该 route
  closeAll: () => void;                        // tabs=[]、activeRoute=null、全部进 recentlyClosed
  reopenRecent: (route: string) => void;       // 从 recentlyClosed 移回 tabs 并激活（调用方负责 router.push）
  clearRecent: () => void;
}
```

行为约定：
- `registerRoute`：路由不在 `tabs` 则追加；始终置 `activeRoute = route`。
- `closeTab`：移除该 tab 并 `unshift` 进 `recentlyClosed`（超 10 截断）；若被关的是 `activeRoute`，激活邻居（前一个优先，无则后一个，都没有则 `null`——由调用方兜底导航，见第 10 条）。
- `reopenRecent`：从 `recentlyClosed` 取出该路由（按 route 匹配最近一条）移回 `tabs` 末尾并置激活。

**不变式：始终至少存在 1 个 tab——即当前路由（pathname）。** 任何导航（含兜底的 `/`）都会经 pathname effect 自动注册；`PageKeeper` 的 `active ?? pathname` 也保证有可显示页。故 `activeRoute === null` 在正常流程中是瞬态，关闭到"零 tab"总会落到首页 dashboard。本系统**不存在真正的空状态 UI**。

## 8. 路由元数据：nav-menu.ts

新文件 `src/lib/nav-menu.ts`：把现有 `src/components/layout/sidebar.tsx` 里的 `menuItems` 数组抽到这里，作为 `path → { title, icon }` 的单一事实源。sidebar 与 useTabStore 都从此引入。

提供：
- `menuItems`（原样，供 sidebar）。
- `routeMeta: Record<string, { title: string; icon?: string }>`：flatten 后包含所有叶子路径（含 children 路径）。
- 查找 helper `getRouteMeta(pathname)`：精确命中 → 前缀命中父级 → 兜底（默认图标 + 取末段或 `'未命名'` 当 title）。

sidebar.tsx 改为 `import { menuItems } from '@/lib/nav-menu'`，逻辑不变。

## 9. 导航联动（侧边栏零改动）

`AppLayout` 内加一个 effect 监听 `usePathname()`：

```tsx
const pathname = usePathname();
useEffect(() => {
  if (!pathname) return;
  const meta = getRouteMeta(pathname);
  useTabStore.getState().registerRoute(pathname, meta);
}, [pathname]);
```

这样 `<Link>` 点击、`router.push`、浏览器前进/后退**全部自动**开 tab / 激活。侧边栏无需逐项改造。激活高亮 = `activeRoute === pathname`。

## 10. TabBar UI

文件：`src/components/layout/tab-bar.tsx`。置于 `CurrentPeriodWrapper` 与内容区之间。

- 水平可滚动条；每 tab：图标 + 标题 + `×`（关闭）。
- 激活 tab 高亮（`bg-white` + 底边强调），点击该 tab → `setActive(route)` + `router.push(route)` 同步 URL。
- 右键或 `⋯` 菜单：**关闭其他** / **关闭全部**。
- 右侧「最近关闭」下拉（时钟图标）：列 `recentlyClosed`，点条目 → `reopenRecent(route)` + `router.push(route)`。
- 关闭激活 tab 后切换邻居时，由调用方（TabBar 的 close handler）读取 store 新的 `activeRoute` 并 `router.push`；若新 `activeRoute` 为 `null`（关掉了唯一 tab），`router.push('/')` → dashboard 经 effect 自动注册为唯一 tab。关闭非激活 tab 不触发导航。
- 「关闭全部」同上：清空后 `router.push('/')`，落到 dashboard（仍为 1 个 tab）。无空状态 UI。

## 11. 刷新恢复最后一个 tab（几乎免费）

URL 始终同步激活 tab（见第 9、10 条）。刷新时浏览器**本就停在最后路由** → Next 渲染该页 → AppLayout 的 pathname effect 触发 `registerRoute` → 该路由自动成为会话里**唯一的** tab。其余 tab（内存态）随刷新丢失，符合第 3 条第 5 点。**Phase 1 不写任何持久化代码。**

## 12. 边界情况

- **关闭最后一个 tab**：`closeTab` 后 `activeRoute=null` → close handler `router.push('/')` → dashboard 自动注册为唯一 tab。不存在"零 tab 空状态"。
- **详情页 `/[id]`**（如 `/partner-dashboard/123`）：按**完整 pathname** 当独立 tab；可能堆积，用户可手动关。Phase 1 不按父级分组（非目标）。
- **非 AppLayout 路由**（`/login`、`/select-tenant`、`/setup`）：不走 PageKeeper，不产生 tab。
- **hidden 页副作用**：隐藏页的 `useEffect`/监听仍在后台运行（基本无害，多数页面只初次取数）。列为已知项；若后续发现某页面有问题，可给 PageKeeper 加 `active` 信号让页面自判暂停。
- **React StrictMode（dev）**：首次挂载双调用，keep-alive 在 dev 下首次访问某页可能有**一次性** state 重置；production（无 StrictMode 双挂载）干净。已知 dev 现象，非缺陷。
- **Portal/弹窗**：弹窗由激活页用户操作触发，隐藏页通常无打开弹窗。若隐藏页有挂载态弹窗，会渲染到 `document.body`——可接受。

## 13. 改动文件

新增：
- `src/stores/useTabStore.ts`
- `src/components/layout/page-keeper.tsx`
- `src/components/layout/tab-bar.tsx`
- `src/lib/nav-menu.ts`

修改：
- `src/components/layout/app-layout.tsx`（接入 `TabBar` + `PageKeeper` + pathname effect，替换原 `{children}`）
- `src/components/layout/sidebar.tsx`（`menuItems` 改从 `@/lib/nav-menu` 引入）

不动：业务页面、其他 store、路由结构。

## 14. 验收 / 测试

手动验收（关键场景）：
1. **保活**：打开凭证录入 → 录入未保存分录 → 打开资金管理 → 点「凭证录入」tab 切回 → 分录仍在、滚动位置不变。
2. **多页并存（用户原始复现）**：打开「往来单位管理」→ 打开「资金管理」→ 往来单位管理**不自动关闭**，二者同为 tab，可来回切换。
3. **关闭**：点 tab 的 × → 该 tab 关闭并进「最近关闭」；点关闭激活项 → 自动切到邻居。
4. **最近关闭**：从下拉恢复 → 重新打开（全新加载，草稿丢——可接受）。
5. **关闭其他 / 关闭全部**：菜单生效；全部关闭后自动回到首页 dashboard（仍为 1 个 tab），无空状态。
6. **刷新恢复最后 tab**：在某页刷新 → 该页作为唯一 tab 自动回来（全新挂载，草稿丢——Phase 2 解决）。
7. **侧边栏激活高亮**：与当前激活 tab 一致。

自动化：可补 `useTabStore` 的 reducer 单测（开/关/最近关闭/激活邻居逻辑）。
