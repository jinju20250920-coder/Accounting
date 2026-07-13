'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sqliteService } from '@/lib/database/sqlite-service';
import { hashPassword, verifyPassword } from '@/lib/auth-utils';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string;
  lastLoginTime: string | null;
}

export interface TenantSummary {
  id: string;
  code: string;
  name: string;
  type: string;
  role: string;
}

interface AuthStore {
  currentUser: User | null;
  isAuthenticated: boolean;
  permissions: string[];
  currentRoleId: string | null;
  currentTenantId: string | null;
  availableTenants: TenantSummary[];
  login: (username: string, password: string, rememberMe?: boolean) => Promise<string | null>;
  logout: () => void;
  getCurrentUser: () => User | null;
  hasPermission: (permissionId: string) => boolean;
  getPermissions: () => string[];
  loadUserPermissions: (userId: string, tenantId?: string, accountSetId?: string) => Promise<void>;
  loadAvailableTenants: (userId: string) => Promise<TenantSummary[]>;
  setCurrentTenant: (tenantId: string) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      permissions: [],
      currentRoleId: null,
      currentTenantId: null,
      availableTenants: [],

      login: async (username: string, password: string, rememberMe?: boolean): Promise<string | null> => {
        try {
          const db = await sqliteService.getDatabase();

          const stmt = db.prepare(`SELECT id, username, displayName, email, phone, status, passwordHash, lastLoginTime FROM users WHERE username = ?`);
          stmt.bind([username]);
          const hasRow = stmt.step();

          if (!hasRow) {
            stmt.free();
            return '用户名或密码错误';
          }

          const row = stmt.get();
          stmt.free();

          const userId = row[0];
          const dbUsername = row[1];
          const displayName = row[2];
          const email = row[3];
          const phone = row[4];
          const status = row[5];
          const passwordHash = row[6];
          const lastLoginTime = row[7];

          if (status === 'pending') {
            return '账号待审批，请联系管理员';
          }

          if (status === 'disabled') {
            return '账号已禁用';
          }

          if (status !== 'active') {
            return '账号状态异常';
          }

          const valid = await verifyPassword(password, passwordHash);
          if (!valid) {
            return '用户名或密码错误';
          }

          const user: User = {
            id: userId,
            username: dbUsername,
            displayName,
            email,
            phone,
            status,
            lastLoginTime,
          };

          const tenants = await get().loadAvailableTenants(userId);

          if (tenants.length === 0) {
            return '尚未加入任何租户，请联系管理员邀请';
          }

          let chosenTenantId: string | null = null;
          if (tenants.length === 1) {
            chosenTenantId = tenants[0].id;
            sqliteService.setTenantId(chosenTenantId);
          }

          // 加载权限（仅在已选定租户时）
          if (chosenTenantId) {
            await get().loadUserPermissions(userId, chosenTenantId);
          }

          // 更新最后登录时间
          const now = new Date().toISOString();
          const updateStmt = db.prepare(`UPDATE users SET lastLoginTime = ? WHERE id = ?`);
          updateStmt.run([now, userId]);
          updateStmt.free();

          // 记住密码
          if (rememberMe) {
            localStorage.setItem('saved_credentials', JSON.stringify({ username }));
          } else {
            localStorage.removeItem('saved_credentials');
          }

          set({
            currentUser: user,
            isAuthenticated: true,
            availableTenants: tenants,
            currentTenantId: chosenTenantId,
          });

          return null;
        } catch (error) {
          console.error('Login failed:', error);
          return '登录失败';
        }
      },

      logout: () => {
        set({
          currentUser: null,
          isAuthenticated: false,
          permissions: [],
          currentRoleId: null,
          currentTenantId: null,
          availableTenants: [],
        });
      },

      getCurrentUser: () => get().currentUser,

      hasPermission: (permissionId: string): boolean => {
        const { permissions, currentRoleId } = get();
        // 管理员拥有全部权限
        if (currentRoleId === 'role_admin') return true;
        return permissions.includes(permissionId);
      },

      getPermissions: () => get().permissions,

      loadAvailableTenants: async (userId: string): Promise<TenantSummary[]> => {
        try {
          const db = await sqliteService.getDatabase();
          const stmt = db.prepare(
            `SELECT t.id, t.code, t.name, t.type, tu.role
             FROM tenant_users tu
             JOIN tenants t ON t.id = tu.tenantId
             WHERE tu.userId = ? AND t.status = 'active'
             ORDER BY tu.joinedAt ASC`
          );
          stmt.bind([userId]);
          const tenants: TenantSummary[] = [];
          while (stmt.step()) {
            const r = stmt.get();
            tenants.push({
              id: String(r[0] ?? ''),
              code: String(r[1] ?? ''),
              name: String(r[2] ?? ''),
              type: String(r[3] ?? ''),
              role: String(r[4] ?? ''),
            });
          }
          stmt.free();
          return tenants;
        } catch (error) {
          console.error('Failed to load available tenants:', error);
          return [];
        }
      },

      setCurrentTenant: async (tenantId: string): Promise<void> => {
        sqliteService.setTenantId(tenantId);
        const { currentUser } = get();
        if (currentUser) {
          await get().loadUserPermissions(currentUser.id, tenantId);
        }
        set({ currentTenantId: tenantId });
      },

      loadUserPermissions: async (userId: string, tenantId?: string, accountSetId?: string) => {
        try {
          const db = await sqliteService.getDatabase();
          const asId = accountSetId || sqliteService.accountSetId;
          const tId = tenantId || sqliteService.tenantId;

          // 优先从 account_set_users 获取该账套的角色
          let roleId: string | null = null;

          if (asId && tId) {
            const asuStmt = db.prepare(`SELECT roleId FROM account_set_users WHERE userId = ? AND tenantId = ? AND accountSetId = ?`);
            asuStmt.bind([userId, tId, asId]);
            if (asuStmt.step()) {
              roleId = asuStmt.get()[0];
            }
            asuStmt.free();
          }

          // 回退到租户级 user_roles
          if (!roleId && tId) {
            const urStmt = db.prepare(`SELECT roleId FROM user_roles WHERE userId = ? AND tenantId = ?`);
            urStmt.bind([userId, tId]);
            if (urStmt.step()) {
              roleId = urStmt.get()[0];
            }
            urStmt.free();
          }

          // 加载角色权限
          let perms: string[] = [];
          if (roleId === 'role_admin') {
            // 管理员拥有全部权限
            const permResult = db.exec(`SELECT id FROM permissions`);
            if (permResult[0]?.values) {
              perms = permResult[0].values.map((r: Array<string | number | Uint8Array | null>) => String(r[0]));
            }
          } else if (roleId) {
            const rpStmt = db.prepare(`SELECT permissionId FROM role_permissions WHERE roleId = ?`);
            rpStmt.bind([roleId]);
            const loadedPerms: string[] = [];
            while (rpStmt.step()) {
              loadedPerms.push(rpStmt.get()[0]);
            }
            rpStmt.free();
            perms = loadedPerms;
          }

          set({ permissions: perms, currentRoleId: roleId });
        } catch (error) {
          console.error('Failed to load user permissions:', error);
          set({ permissions: [], currentRoleId: null });
          throw error;
        }
      },
    }),
    {
      name: 'finance-auth',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions,
        currentRoleId: state.currentRoleId,
        currentTenantId: state.currentTenantId,
      }),
    }
  )
);
