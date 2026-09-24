import { describe, expect, it } from "vitest";
import { parseSpecYaml } from "./spec-utils.js";
import { diffSpecVersions, specTargets } from "./spec-versions.js";
import { readFileSync } from "node:fs";

const example = parseSpecYaml(readFileSync(new URL("../specs/example.yaml", import.meta.url), "utf8")).spec!;

describe("saved version targets and diffs", () => {
  it("keys nested states and components by their parent screen", () => {
    const targets = specTargets(example);
    const state = targets.find((item) => item.kind === "state")!;
    expect(state.key).toBe(JSON.stringify(["state", state.parentId, state.id]));
    expect(new Set(targets.map((item) => item.key)).size).toBe(targets.length);
  });

  it("reports additions, removals, and edits by stable IDs", () => {
    const before = structuredClone(example);
    const after = structuredClone(before);
    const screen = after.screens[0];
    screen.title += " 更新";
    const removed = screen.stateFlow.states.pop()!;
    screen.stateFlow.states.push({ id: "new-state", title: "新状態" });
    const changes = diffSpecVersions(before, after);
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ change: "changed", target: expect.objectContaining({ kind: "screen", id: screen.id }) }),
      expect.objectContaining({ change: "removed", target: expect.objectContaining({ kind: "state", id: removed.id, parentId: screen.id }) }),
      expect.objectContaining({ change: "added", target: expect.objectContaining({ kind: "state", id: "new-state", parentId: screen.id }) }),
    ]));
  });

  it("has no changes for equal saved content", () => {
    expect(diffSpecVersions(example, structuredClone(example))).toEqual([]);
  });
});
