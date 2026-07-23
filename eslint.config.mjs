import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Pinned, third-party OCR worker and WASM loader scripts; checksums are
    // verified in docs/ocr-assets.md instead of applying app-source lint rules.
    "public/ocr/v7/**",
  ]),
]);

export default eslintConfig;
