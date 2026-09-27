import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { migrateSpecTo21 } from "./spec-migration.js";
import { parseSpecYaml } from "./spec-utils.js";
import { diffSpecVersions, specTargets } from "./spec-versions.js";

const example = parseSpecYaml(
  readFileSync(new URL("../specs/example.yaml", import.meta.url), "utf8"),
).spec!;

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
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          change: "changed",
          target: expect.objectContaining({ kind: "screen", id: screen.id }),
        }),
        expect.objectContaining({
          change: "removed",
          target: expect.objectContaining({
            kind: "state",
            id: removed.id,
            parentId: screen.id,
          }),
        }),
        expect.objectContaining({
          change: "added",
          target: expect.objectContaining({
            kind: "state",
            id: "new-state",
            parentId: screen.id,
          }),
        }),
      ]),
    );
  });

  it("tracks control-flow nodes and stable edge IDs", () => {
    const before = migrateSpecTo21(example).spec!;
    before.flows[0].steps = [
      { id: "start", kind: "start" },
      {
        id: "submit",
        title: "申請を提出する",
        performer: {
          kind: "actors",
          refs: [{ kind: "actor", id: "member" }],
        },
      },
      { id: "decision", kind: "branch", title: "承認するか" },
      { id: "end", kind: "end" },
    ];
    before.flows[0].edges = [
      { id: "to-submit", from: "start", to: "submit" },
      { id: "to-decision", from: "submit", to: "decision" },
      { id: "approve", from: "decision", to: "end", label: "承認" },
      { id: "revise", from: "decision", to: "submit", label: "差し戻し" },
    ];
    const after = structuredClone(before);
    after.flows[0].steps[2] = {
      id: "decision",
      kind: "branch",
      title: "承認が必要か",
    };
    after.flows[0].edges![2].label = "承認済み";

    const changes = diffSpecVersions(before, after);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          change: "changed",
          target: expect.objectContaining({
            kind: "flowControlNode",
            id: "decision",
          }),
        }),
        expect.objectContaining({
          change: "changed",
          target: expect.objectContaining({ kind: "flowEdge", id: "approve" }),
        }),
      ]),
    );
    expect(new Set(specTargets(before).map((target) => target.key)).size).toBe(
      specTargets(before).length,
    );
  });

  it("keeps 2.0 graph-edge changes on their parent flow target", () => {
    const before = structuredClone(example);
    before.flows[0].steps = [
      { id: "start", kind: "start" },
      {
        id: "submit",
        title: "申請を提出する",
        performer: {
          kind: "actors",
          refs: [{ kind: "actor", id: "member" }],
        },
      },
      { id: "decision", kind: "branch", title: "承認するか" },
      { id: "end", kind: "end" },
    ];
    before.flows[0].edges = [
      { from: "start", to: "submit" },
      { from: "submit", to: "decision" },
      { from: "decision", to: "end", label: "承認" },
      { from: "decision", to: "submit", label: "差し戻し" },
    ];
    const after = structuredClone(before);
    after.flows[0].edges![2].label = "承認済み";

    const changes = diffSpecVersions(before, after);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          change: "changed",
          target: expect.objectContaining({
            kind: "flow",
            id: before.flows[0].id,
          }),
        }),
      ]),
    );
    expect(changes.some(({ target }) => target.kind === "flowEdge")).toBe(
      false,
    );
    expect(
      specTargets(after).find((target) => target.kind === "flow")?.value,
    ).toHaveProperty("unversionedEdges");
  });

  it("has no changes for equal saved content", () => {
    expect(diffSpecVersions(example, structuredClone(example))).toEqual([]);
  });
});
