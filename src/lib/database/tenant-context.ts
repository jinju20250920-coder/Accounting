/**
 * 多租户 SQL helper：统一构建业务表 WHERE 子句，避免每个 SQL 手写两列。
 *
 * 用法：
 *   const where = buildTenantWhere();                    // "WHERE tenantId = ? AND accountSetId = ?"
 *   const params = tenantParams(tenantId, accountSetId); // [tenantId, accountSetId]
 *
 *   const where = buildTenantWhere('v', 'status = ?');   // "WHERE v.tenantId = ? AND v.accountSetId = ? AND status = ?"
 *   const params = tenantParams(tenantId, accountSetId, ['posted']); // [tenantId, accountSetId, 'posted']
 *
 * 白名单（不需要 tenantId）：
 *   - sqlite_master / sqlite_* 系统表
 *   - tenants / tenant_users（自身即租户表）
 *   - users / roles / permissions / role_permissions / user_roles（全局账号 + 系统权限）
 */

export type SqlBindable = string | number | Uint8Array | null;

/**
 * 构建 tenant + accountSet 的 WHERE 子句。
 *
 * @param alias 表别名（如 'v' for vouchers），可选。无别名时直接列名。
 * @param extra 附加条件（如 'status = ?'），会用 AND 拼接。可选。
 * @returns 完整 WHERE 子句字符串
 */
export function buildTenantWhere(alias?: string, extra?: string): string {
  const prefix = alias ? `${alias}.` : '';
  const tenantCol = `${prefix}tenantId`;
  const setCol = `${prefix}accountSetId`;
  const base = `WHERE ${tenantCol} = ? AND ${setCol} = ?`;
  if (!extra) return base;
  return `${base} AND ${extra}`;
}

/**
 * 构建 tenant + accountSet 的参数数组，与 buildTenantWhere 配对使用。
 *
 * @param tenantId 租户 ID
 * @param accountSetId 账套 ID
 * @param extra 附加参数（与 buildTenantWhere 的 extra 占位符对应）
 * @returns 完整参数数组
 */
export function tenantParams(
  tenantId: string,
  accountSetId: string,
  extra: SqlBindable[] = []
): SqlBindable[] {
  return [tenantId, accountSetId, ...extra];
}

/**
 * 构建 INSERT 列名 + 占位符（包含 tenantId 和 accountSetId）。
 *
 * @param columns 业务列名（不含 tenantId / accountSetId）
 * @returns { columns: string, placeholders: string } 用于拼接 SQL
 *
 * @example
 *   const { columns, placeholders } = buildTenantInsert(['id', 'name']);
 *   // columns: 'id, name, tenantId, accountSetId'
 *   // placeholders: '?, ?, ?, ?'
 */
export function buildTenantInsert(columns: string[]): {
  columns: string;
  placeholders: string;
} {
  const all = [...columns, 'tenantId', 'accountSetId'];
  return {
    columns: all.join(', '),
    placeholders: all.map(() => '?').join(', '),
  };
}

/**
 * 检查表名是否在「不需要 tenantId」白名单内。
 * ESLint 自定义规则（PR 8）会引用此函数判定。
 */
export function isTenantExemptTable(table: string): boolean {
  const exempt = [
    'sqlite_master',
    'sqlite_sequence',
    'sqlite_stat',
    'tenants',
    'tenant_users',
    'users',
    'roles',
    'permissions',
    'role_permissions',
    'user_roles',
  ];
  const lower = table.toLowerCase();
  return exempt.some(t => lower === t || lower.startsWith(`${t}_`));
}
