'use client';

import { create } from 'zustand';
import { sqliteService } from '@/lib/database/sqlite-service';
import { hashPassword, verifyPassword } from '@/lib/auth-utils';
import { generateId } from '@/lib/utils';

type SqlValue = string | number | Uint8Array | null;

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string;
  lastLoginTime: string | null;
  createTime: string;
  updateTime: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isSystem: number;
  createTime: string;
  updateTime: string;
}

export interface PermissionRecord {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface AccountSetUserRecord {
  accountSetId: string;
  userId: string;
  roleId: string;
  username?: string;
  displayName?: string;
  roleName?: string;
}

interface UserStore {
  users: UserRecord[];
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  rolePermissions: Record<string, string[]>;
  accountSetUsers: AccountSetUserRecord[];
  isLoading: boolean;

  loadUsers: () => Promise<void>;
  createUser: (username: string, displayName: string, password: string, email?: string, phone?: string) => Promise<UserRecord | null>;
  updateUser: (id: string, updates: Partial<UserRecord>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetPassword: (userId: string, newPassword: string) => Promise<void>;
  toggleUserStatus: (userId: string, status: string) => Promise<void>;

  registerUser: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  approveUser: (userId: string, roleIds: string[]) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  changePassword: (userId: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;

  loadRoles: () => Promise<void>;
  createRole: (name: string, displayName: string, description?: string) => Promise<RoleRecord | null>;
  updateRole: (id: string, updates: Partial<RoleRecord>) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;

  loadPermissions: () => Promise<void>;
  loadRolePermissions: () => Promise<void>;
  updateRolePermissions: (roleId: string, permissionIds: string[]) => Promise<void>;

  loadAccountSetUsers: (accountSetId: string) => Promise<void>;
  assignUserToAccountSet: (accountSetId: string, userId: string, roleId: string) => Promise<void>;
  removeUserFromAccountSet: (accountSetId: string, userId: string) => Promise<void>;
}

export const useUserStore = create<UserStore>()((set, get) => ({
  users: [],
  roles: [],
  permissions: [],
  rolePermissions: {},
  accountSetUsers: [],
  isLoading: false,

  loadUsers: async () => {
    try {
      const db = await sqliteService.getDatabase();
      const result = db.exec(`SELECT id, username, displayName, email, phone, status, lastLoginTime, createTime, updateTime FROM users ORDER BY createTime`);
      if (!result[0]?.values) { set({ users: [] }); return; }

      const users: UserRecord[] = result[0].values.map((row: SqlValue[]) => ({
        id: row[0], username: row[1], displayName: row[2], email: row[3],
        phone: row[4], status: row[5], lastLoginTime: row[6], createTime: row[7], updateTime: row[8],
      }));
      set({ users });
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  },

  createUser: async (username, displayName, password, email?, phone?) => {
    try {
      const db = await sqliteService.getDatabase();
      const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const passwordHash = await hashPassword(password);

      const stmt = db.prepare(
        `INSERT INTO users (id, username, passwordHash, displayName, email, phone, status, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([id, username, passwordHash, displayName, email || null, phone || null, 'active', now, now]);
      stmt.free();

      // 新用户默认分配出纳角色
      const urStmt = db.prepare(`INSERT OR IGNORE INTO user_roles (tenantId, userId, roleId) VALUES (?, ?, ?)`);
      urStmt.run([sqliteService.tenantId, id, 'role_cashier']);
      urStmt.free();

      await get().loadUsers();
      return { id, username, displayName, email: email || null, phone: phone || null, status: 'active', lastLoginTime: null, createTime: now, updateTime: now };
    } catch (error) {
      console.error('Failed to create user:', error);
      return null;
    }
  },

  updateUser: async (id, updates) => {
    try {
      const db = await sqliteService.getDatabase();
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: SqlValue[] = [];

      if (updates.displayName !== undefined) { fields.push('displayName = ?'); values.push(updates.displayName); }
      if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
      if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }

      if (fields.length === 0) return;
      fields.push('updateTime = ?');
      values.push(now);
      values.push(id);

      const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(values);
      stmt.free();

      await get().loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  },

  deleteUser: async (id) => {
    try {
      const db = await sqliteService.getDatabase();

      // 删除关联数据
      const tables = ['user_roles', 'account_set_users'];
      for (const table of tables) {
        const stmt = db.prepare(`DELETE FROM ${table} WHERE userId = ?`);
        stmt.run([id]);
        stmt.free();
      }

      const stmt = db.prepare(`DELETE FROM users WHERE id = ?`);
      stmt.run([id]);
      stmt.free();

      await get().loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  },

  resetPassword: async (userId, newPassword) => {
    try {
      const db = await sqliteService.getDatabase();
      const passwordHash = await hashPassword(newPassword);
      const now = new Date().toISOString();
      const stmt = db.prepare(`UPDATE users SET passwordHash = ?, updateTime = ? WHERE id = ?`);
      stmt.run([passwordHash, now, userId]);
      stmt.free();
    } catch (error) {
      console.error('Failed to reset password:', error);
    }
  },

  toggleUserStatus: async (userId, status) => {
    try {
      const db = await sqliteService.getDatabase();
      const now = new Date().toISOString();
      const stmt = db.prepare(`UPDATE users SET status = ?, updateTime = ? WHERE id = ?`);
      stmt.run([status, now, userId]);
      stmt.free();
      await get().loadUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  },

  registerUser: async (username, password) => {
    try {
      const db = await sqliteService.getDatabase();

      const checkStmt = db.prepare(`SELECT id FROM users WHERE username = ?`);
      checkStmt.bind([username]);
      if (checkStmt.step()) {
        checkStmt.free();
        return { success: false, error: '用户名已存在' };
      }
      checkStmt.free();

      const id = `user_${generateId()}`;
      const now = new Date().toISOString();
      const passwordHash = await hashPassword(password);

      const stmt = db.prepare(
        `INSERT INTO users (id, username, passwordHash, displayName, email, phone, status, createTime, updateTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([id, username, passwordHash, username, null, null, 'pending', now, now]);
      stmt.free();

      await get().loadUsers();
      return { success: true };
    } catch (error) {
      console.error('Failed to register user:', error);
      return { success: false, error: '注册失败' };
    }
  },

  approveUser: async (userId, roleIds) => {
    try {
      const db = await sqliteService.getDatabase();
      const now = new Date().toISOString();

      const stmt = db.prepare(`UPDATE users SET status = 'active', updateTime = ? WHERE id = ?`);
      stmt.run([now, userId]);
      stmt.free();

      const delStmt = db.prepare(`DELETE FROM user_roles WHERE tenantId = ? AND userId = ?`);
      delStmt.run([sqliteService.tenantId, userId]);
      delStmt.free();

      for (const roleId of roleIds) {
        const urStmt = db.prepare(`INSERT OR IGNORE INTO user_roles (tenantId, userId, roleId) VALUES (?, ?, ?)`);
        urStmt.run([sqliteService.tenantId, userId, roleId]);
        urStmt.free();
      }

      await get().loadUsers();
    } catch (error) {
      console.error('Failed to approve user:', error);
    }
  },

  rejectUser: async (userId) => {
    await get().deleteUser(userId);
  },

  changePassword: async (userId, oldPassword, newPassword) => {
    try {
      const db = await sqliteService.getDatabase();

      const stmt = db.prepare(`SELECT passwordHash FROM users WHERE id = ?`);
      stmt.bind([userId]);
      if (!stmt.step()) {
        stmt.free();
        return { success: false, error: '用户不存在' };
      }
      const passwordHash = stmt.get()[0];
      stmt.free();

      const valid = await verifyPassword(oldPassword, passwordHash);
      if (!valid) {
        return { success: false, error: '旧密码不正确' };
      }

      const newHash = await hashPassword(newPassword);
      const now = new Date().toISOString();
      const updateStmt = db.prepare(`UPDATE users SET passwordHash = ?, updateTime = ? WHERE id = ?`);
      updateStmt.run([newHash, now, userId]);
      updateStmt.free();

      return { success: true };
    } catch (error) {
      console.error('Failed to change password:', error);
      return { success: false, error: '修改密码失败' };
    }
  },

  loadRoles: async () => {
    try {
      const db = await sqliteService.getDatabase();
      const result = db.exec(`SELECT id, name, displayName, description, isSystem, createTime, updateTime FROM roles ORDER BY isSystem DESC, createTime`);
      if (!result[0]?.values) { set({ roles: [] }); return; }

      const roles: RoleRecord[] = result[0].values.map((row: SqlValue[]) => ({
        id: row[0], name: row[1], displayName: row[2], description: row[3],
        isSystem: row[4], createTime: row[5], updateTime: row[6],
      }));
      set({ roles });
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  },

  createRole: async (name, displayName, description?) => {
    try {
      const db = await sqliteService.getDatabase();
      const id = `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(
        `INSERT INTO roles (id, name, displayName, description, isSystem, createTime, updateTime) VALUES (?, ?, ?, ?, 0, ?, ?)`
      );
      stmt.run([id, name, displayName, description || '', now, now]);
      stmt.free();

      await get().loadRoles();
      return { id, name, displayName, description: description || '', isSystem: 0, createTime: now, updateTime: now };
    } catch (error) {
      console.error('Failed to create role:', error);
      return null;
    }
  },

  updateRole: async (id, updates) => {
    try {
      const db = await sqliteService.getDatabase();
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: SqlValue[] = [];

      if (updates.displayName !== undefined) { fields.push('displayName = ?'); values.push(updates.displayName); }
      if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }

      if (fields.length === 0) return;
      fields.push('updateTime = ?');
      values.push(now);
      values.push(id);

      const stmt = db.prepare(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(values);
      stmt.free();

      await get().loadRoles();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  },

  deleteRole: async (id) => {
    try {
      const db = await sqliteService.getDatabase();

      // 删除关联数据
      const rpStmt = db.prepare(`DELETE FROM role_permissions WHERE roleId = ?`);
      rpStmt.run([id]);
      rpStmt.free();

      const asuStmt = db.prepare(`DELETE FROM account_set_users WHERE tenantId = ? AND roleId = ?`);
      asuStmt.run([sqliteService.tenantId, id]);
      asuStmt.free();

      const stmt = db.prepare(`DELETE FROM roles WHERE id = ?`);
      stmt.run([id]);
      stmt.free();

      await get().loadRoles();
      await get().loadRolePermissions();
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  },

  loadPermissions: async () => {
    try {
      const db = await sqliteService.getDatabase();
      const result = db.exec(`SELECT id, name, category, description FROM permissions ORDER BY category, id`);
      if (!result[0]?.values) { set({ permissions: [] }); return; }

      const permissions: PermissionRecord[] = result[0].values.map((row: SqlValue[]) => ({
        id: row[0], name: row[1], category: row[2], description: row[3],
      }));
      set({ permissions });
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  },

  loadRolePermissions: async () => {
    try {
      const db = await sqliteService.getDatabase();
      const result = db.exec(`SELECT roleId, permissionId FROM role_permissions`);
      if (!result[0]?.values) { set({ rolePermissions: {} }); return; }

      const rpMap: Record<string, string[]> = {};
      for (const row of result[0].values as SqlValue[][]) {
        const roleId = String(row[0]);
        const permId = String(row[1]);
        if (!rpMap[roleId]) rpMap[roleId] = [];
        rpMap[roleId].push(permId);
      }
      set({ rolePermissions: rpMap });
    } catch (error) {
      console.error('Failed to load role permissions:', error);
    }
  },

  updateRolePermissions: async (roleId, permissionIds) => {
    try {
      const db = await sqliteService.getDatabase();

      // 删除旧权限
      const delStmt = db.prepare(`DELETE FROM role_permissions WHERE roleId = ?`);
      delStmt.run([roleId]);
      delStmt.free();

      // 插入新权限
      for (const permId of permissionIds) {
        const stmt = db.prepare(`INSERT OR IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`);
        stmt.run([roleId, permId]);
        stmt.free();
      }

      await get().loadRolePermissions();
    } catch (error) {
      console.error('Failed to update role permissions:', error);
    }
  },

  loadAccountSetUsers: async (accountSetId) => {
    try {
      const db = await sqliteService.getDatabase();
      const stmt = db.prepare(`
        SELECT asu.accountSetId, asu.userId, asu.roleId, u.username, u.displayName, r.displayName as roleName
        FROM account_set_users asu
        LEFT JOIN users u ON asu.userId = u.id
        LEFT JOIN roles r ON asu.roleId = r.id
        WHERE asu.tenantId = ? AND asu.accountSetId = ?
      `);
      stmt.bind([sqliteService.tenantId, accountSetId]);
      const accountSetUsers: AccountSetUserRecord[] = [];
      while (stmt.step()) {
        const row = stmt.get() as SqlValue[];
        accountSetUsers.push({
          accountSetId: String(row[0] ?? ''), userId: String(row[1] ?? ''), roleId: String(row[2] ?? ''),
          username: String(row[3] ?? ''), displayName: String(row[4] ?? ''), roleName: String(row[5] ?? ''),
        });
      }
      stmt.free();
      set({ accountSetUsers });
    } catch (error) {
      console.error('Failed to load account set users:', error);
    }
  },

  assignUserToAccountSet: async (accountSetId, userId, roleId) => {
    try {
      const db = await sqliteService.getDatabase();
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO account_set_users (tenantId, accountSetId, userId, roleId) VALUES (?, ?, ?, ?)`
      );
      stmt.run([sqliteService.tenantId, accountSetId, userId, roleId]);
      stmt.free();

      await get().loadAccountSetUsers(accountSetId);
    } catch (error) {
      console.error('Failed to assign user to account set:', error);
    }
  },

  removeUserFromAccountSet: async (accountSetId, userId) => {
    try {
      const db = await sqliteService.getDatabase();
      const stmt = db.prepare(`DELETE FROM account_set_users WHERE tenantId = ? AND accountSetId = ? AND userId = ?`);
      stmt.run([sqliteService.tenantId, accountSetId, userId]);
      stmt.free();

      await get().loadAccountSetUsers(accountSetId);
    } catch (error) {
      console.error('Failed to remove user from account set:', error);
    }
  },
}));
