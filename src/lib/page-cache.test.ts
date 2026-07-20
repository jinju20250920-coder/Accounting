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
