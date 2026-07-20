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
