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
