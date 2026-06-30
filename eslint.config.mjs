import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
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
  ]),
]);

export default eslintConfig;
