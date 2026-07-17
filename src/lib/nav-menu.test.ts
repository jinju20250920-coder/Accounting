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
