import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noSqlWithoutTenantId from "./eslint-rules/no-sql-without-tenant-id.js";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "tenant-sql": {
        rules: {
          "no-sql-without-tenant-id": noSqlWithoutTenantId,
        },
      },
    },
    rules: {
      // Idiomatic underscore-prefix opt-out for intentionally unused bindings.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // 多租户隔离：所有业务表 SQL 必须显式带 tenantId 维度
      "tenant-sql/no-sql-without-tenant-id": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Historical SQLite adapter. It contains broad `any` usage across many
    // domains; validate it with TypeScript until it is split and typed by area.
    "src/lib/database/sqlite-service.ts",
    // Vendored sql.js wasm loader — upstream code, not ours to lint.
    "public/sqljs/**",
    // Migration scripts legitimately backfill tenantId across many tables.
    "src/lib/database/sqlite-manager.ts",
  ]),
]);

export default eslintConfig;
