import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "generated/**",
    "next-env.d.ts",
  ]),
]);
