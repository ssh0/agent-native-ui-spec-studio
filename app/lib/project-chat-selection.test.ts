import { describe, expect, it, vi } from "vitest";

import { selectProjectThread } from "./project-chat-selection";

const threads = [
  { id: "latest-a", updatedAt: 3, scope: { type: "ui-spec-project", id: "a" } },
  { id: "older-a", updatedAt: 1, scope: { type: "ui-spec-project", id: "a" } },
  { id: "latest-b", updatedAt: 4, scope: { type: "ui-spec-project", id: "b" } },
];

describe("project chat selection", () => {
  it("restores the verified active thread before a newer history entry", async () => {
    const exists = vi.fn(
      async (id: string, project: string) =>
        id === "older-a" && project === "a",
    );
    expect(await selectProjectThread("a", "older-a", threads, exists)).toBe(
      "older-a",
    );
    expect(exists).toHaveBeenCalledWith("older-a", "a");
  });
  it("rejects another project's remembered thread and falls back within scope", async () => {
    const exists = vi.fn(async () => false);
    expect(await selectProjectThread("a", "latest-b", threads, exists)).toBe(
      "latest-a",
    );
    expect(await selectProjectThread("b", null, threads, exists)).toBe(
      "latest-b",
    );
  });
});
