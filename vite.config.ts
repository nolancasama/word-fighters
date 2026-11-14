/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Relative base: the build works from any GitHub Pages sub-path or a plain folder.
export default defineConfig({
  base: "./",
  build: { target: "es2020" },
  test: { environment: "node", include: ["src/**/*.test.ts"] }
});
