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
