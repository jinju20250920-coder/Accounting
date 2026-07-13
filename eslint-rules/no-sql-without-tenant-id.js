/**
 * ESLint custom rule: 业务表 SQL 必须带 tenantId (多租户隔离)
 *
 * 检测字符串/模板字面量中的 SQL：SELECT/INSERT/UPDATE/DELETE 涉及业务表时，
 * 必须在 WHERE 子句或列清单中体现 tenantId。
 *
 * 白名单表（系统/全局表）：sqlite_master、tenants、tenant_users、users、roles、permissions、role_permissions、accountSets
 *
 * 用法（eslint.config.js）：
 *   import noSqlWithoutTenant from './eslint-rules/no-sql-without-tenant-id.js';
 *   plugins: [{ rules: { 'no-sql-without-tenant-id': noSqlWithoutTenant } }],
 *   rules: { 'no-sql-without-tenant-id': 'warn' }
 */

const BUSINESS_TABLES = [
  'vouchers', 'entries', 'subjects', 'partners',
  'departments', 'projects', 'currencies', 'voucherTemplates',
  'auditLogs', 'userPreferences', 'commonSummaries', 'recRelations',
  'fixedAssets', 'assetCategories', 'assetChangeRecords',
  'assetSplitRecords', 'assetMergeRecords',
  'depreciationRecords', 'amortizationRecords',
  'intangibleAssets', 'intangibleChangeRecords',
  'prepaidExpenses', 'prepaidChangeRecords',
  'invoices', 'invoiceReconciliations',
  'bankTransactions', 'bankTransactionRules',
  'bank_account_bindings', 'bank_opening_balances', 'custom_bank_configs',
  'fxRates', 'fxRevaluationRuns', 'fxRevaluationRunLines',
  'payroll_batches', 'payroll_items', 'payroll_calculation_configs',
  'codeRules', 'expense_reimbursement', 'expense_keyword_categories',
  'invoice_smart_rules', 'supplier_subject_mapping',
  'purchase_invoice_rule_config', 'asset_category_mapping',
  'auxiliary_strategy_config', 'monthly_closing_checks',
  'account_set_users',
];

const EXEMPT_TABLES = new Set([
  'sqlite_master',
  'tenants',
  'tenant_users',
  'users',
  'roles',
  'permissions',
  'role_permissions',
]);

const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE)\b/i;

function extractSqlFromString(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.quasis.length === 1) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

function findReferencedTables(sql) {
  const upper = sql.toUpperCase();
  const found = new Set();
  for (const table of BUSINESS_TABLES) {
    const re = new RegExp(`\\b${table}\\b`, 'i');
    if (re.test(sql)) found.add(table);
  }
  for (const table of EXEMPT_TABLES) {
    const re = new RegExp(`\\b${table}\\b`, 'i');
    if (re.test(sql)) found.add(table);
  }
  return { found, upper };
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '业务表 SQL 必须带 tenantId 维度（多租户隔离）',
    },
    schema: [],
    messages: {
      missingTenantId:
        'SQL 操作业务表 {{table}} 但 WHERE 子句中没有 tenantId。多租户隔离要求所有业务表查询都带 `tenantId = ?`（白名单：sqlite_master / tenants / tenant_users / users / roles / permissions）。',
    },
  },

  create(context) {
    function check(node) {
      const sql = extractSqlFromString(node);
      if (!sql) return;
      if (!SQL_KEYWORDS.test(sql)) return;

      const { found } = findReferencedTables(sql);

      // 排除：所有引用的表都是白名单
      const businessTables = [...found].filter((t) => !EXEMPT_TABLES.has(t));
      if (businessTables.length === 0) return;

      // 检测 SQL 中是否包含 tenantId 引用
      const hasTenantId = /\btenantId\b/i.test(sql);

      if (!hasTenantId) {
        for (const table of businessTables) {
          context.report({
            node,
            messageId: 'missingTenantId',
            data: { table },
          });
        }
      }
    }

    return {
      Literal: check,
      TemplateLiteral: check,
    };
  },
};
