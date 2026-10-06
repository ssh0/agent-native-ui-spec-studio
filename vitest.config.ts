import path from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

// V8 bytecode caching can reduce coverage precision, so keep coverage runs uncached.
const collectingCoverage = process.argv.some((arg) => /^--coverage(?:[.=]|$)/.test(arg));

// Keep tests independent from vite.config.ts: the production config starts
// Nitro/Vite watchers and evaluates browser-targeted CommonJS SSR modules.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    pool: "threads",
    // Bound CPU/memory use; backend startup is resource-heavy and stays serial.
    maxWorkers: 2,
    projects: [
      { extends: true, test: { name: "unit", exclude: ["server/**"] } },
      {
        extends: true,
        test: {
          name: "backend",
          include: configDefaults.include.map((glob) => `server/${glob}`),
          maxWorkers: 1,
        },
      },
    ],
    execArgv: collectingCoverage
      ? []
      : ["--import", path.resolve(__dirname, "./scripts/test-module-cache.mjs")],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/.react-router/**",
    ],
  },
});
