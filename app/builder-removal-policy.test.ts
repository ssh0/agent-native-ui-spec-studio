import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const forbiddenPatterns = [/\bbuilder\.io\b/i, /\bconnect\s+builder\b/i];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name)
      ? [path]
      : [];
  });
}

describe("Builder removal policy", () => {
  it("keeps Builder.io connection copy out of app-owned source", () => {
    const matches = sourceFiles(appRoot).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return forbiddenPatterns.some((pattern) => pattern.test(source))
        ? [relative(appRoot, path)]
        : [];
    });
    expect(matches).toEqual([]);
  });
});
