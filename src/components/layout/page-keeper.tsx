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
