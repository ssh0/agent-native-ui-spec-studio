// File isolation must cover module state, JS globals, mocks, and process env.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
const initialCI = JSON.stringify(process.env.CI) ?? "undefined";
const files = [".auto/isolation-a.test.ts", ".auto/isolation-b.test.ts", ".auto/isolation-shared.ts", ".auto/isolation-service.ts"];
if (files.some(existsSync)) throw new Error("Isolation probe filenames occupied; refusing overwrite");
try {
  writeFileSync(files[2], "export const state = { touched: false };\n");
  writeFileSync(files[3], 'export const label = "real";\n');
  for (let i = 0; i < 2; i++) {
    const label = i === 0 ? "a" : "b";
    writeFileSync(files[i], `import { it, expect, vi } from "vitest";
import { state } from "./isolation-shared";
vi.mock("./isolation-service", () => ({ label: "mock-${label}" }));
import { label } from "./isolation-service";
it("file isolation ${label}", () => {
  expect((globalThis as any).__uiSpecIsolation).toBeUndefined();
  expect((Array.prototype as any).__uiSpecIsolation).toBeUndefined();
  expect(state.touched).toBe(false);
  expect(label).toBe("mock-${label}");
  expect(process.env.CI, "process env must be isolated between files").toBe(${initialCI});
  (globalThis as any).__uiSpecIsolation = "${label}";
  (Array.prototype as any).__uiSpecIsolation = "${label}";
  state.touched = true;
  process.env.CI = "isolation-test-${label}";
});
`);
  }
  const report = ".auto/isolation-report.json";
  const run = spawnSync("pnpm", ["--config.verify-deps-before-run=false", "test", files[0], files[1], "--maxWorkers=1", "--reporter=json", "--outputFile=" + report], {encoding:"utf8",timeout:60000});
  if (run.error || run.signal) throw run.error ?? new Error("Isolation probe process signaled");
  const data = JSON.parse(readFileSync(report,"utf8"));
  if (run.status !== 0 || !data.success || data.numTotalTests !== 2 || data.numPassedTests !== 2) {
    const failures = data.testResults.flatMap(file => file.assertionResults.filter(t=>t.status!=="passed").map(t=>({test:t.fullName,errors:t.failureMessages})));
    throw new Error("File isolation regression: " + JSON.stringify(failures));
  }
  console.log("Both files independently start with clean JS globals, prototypes, module state, mocks, and process environment");
} finally {
  for (const file of files) if (existsSync(file)) unlinkSync(file);
}
