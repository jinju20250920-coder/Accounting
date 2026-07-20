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
