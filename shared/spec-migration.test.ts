import { describe, expect, it } from "vitest";
import { stringify } from "yaml";

import { DEFAULT_SPEC_YAML } from "./default-spec";
import { generateSpecLists } from "./spec-lists";
import { migrateSpecTo21 } from "./spec-migration";
import { parseSpecYaml, transitionRowKey } from "./spec-utils";

const legacy = () => structuredClone(parseSpecYaml(DEFAULT_SPEC_YAML).spec!);

describe("explicit 2.0 to 2.1 migration", () => {
  it("reads 2.0 unchanged and assigns deterministic, order-independent transition IDs", () => {
    const original = legacy();
    expect(original.version).toBe("2.0");
    expect(original.transitions[0].id).toBeUndefined();
    const first = migrateSpecTo21(original).spec!;
    expect(original.version).toBe("2.0");
    expect(parseSpecYaml(stringify(first)).issues).toEqual([]);
    const reordered = legacy();
    reordered.transitions.reverse();
    reordered.screens.reverse();
    reordered.screens[0].stateFlow.transitions.reverse();
    const second = migrateSpecTo21(reordered).spec!;
    expect(new Map(first.transitions.map((t) => [t.trigger, t.id]))).toEqual(
      new Map(second.transitions.map((t) => [t.trigger, t.id])),
    );
    expect(
      new Map(
        first.screens[1].stateFlow.transitions.map((t) => [t.trigger, t.id]),
      ),
    ).toEqual(
      new Map(
        second.screens
          .find((s) => s.id === first.screens[1].id)!
          .stateFlow.transitions.map((t) => [t.trigger, t.id]),
      ),
    );
    expect(migrateSpecTo21(first).issues[0].path).toBe("version");
  });

  it("assigns order-independent IDs to business-flow graph edges", () => {
    const original = legacy();
    const performer = {
      kind: "actors" as const,
      refs: [{ kind: "actor" as const, id: "member" }],
    };
    original.flows[0].steps = [
      { id: "start", kind: "start" },
      { id: "submit", title: "申請を提出する", performer },
      { id: "decision", kind: "branch", title: "承認するか" },
      { id: "revise", title: "申請を修正する", performer },
      { id: "end", kind: "end" },
    ];
    const edges = [
      { from: "start", to: "submit" },
      { from: "submit", to: "decision" },
      { from: "decision", to: "revise", label: "差し戻し" },
      { from: "decision", to: "end", label: "承認" },
      { from: "revise", to: "submit" },
    ];
    original.flows[0].edges = edges;

    const firstMigration = migrateSpecTo21(original);
    expect(firstMigration.issues).toEqual([]);
    const first = firstMigration.spec!;
    expect(first.flows[0].edges?.every((edge) => edge.id)).toBe(true);
    expect(parseSpecYaml(stringify(first)).issues).toEqual([]);

    const reordered = legacy();
    reordered.flows[0].steps = structuredClone(original.flows[0].steps);
    reordered.flows[0].edges = structuredClone(edges).reverse();
    const secondMigration = migrateSpecTo21(reordered);
    expect(secondMigration.issues).toEqual([]);
    const second = secondMigration.spec!;
    const idsByEdge = (items: (typeof first.flows)[number]["edges"]) =>
      new Map(
        (items ?? []).map((edge) => [
          `${edge.from}:${edge.to}:${edge.label ?? ""}`,
          edge.id,
        ]),
      );
    expect(idsByEdge(first.flows[0].edges)).toEqual(
      idsByEdge(second.flows[0].edges),
    );
  });

  it("reports ambiguous duplicates, duplicate IDs and broken references", () => {
    const duplicate = legacy();
    duplicate.transitions.push({ ...duplicate.transitions[0] });
    expect(new Set(duplicate.transitions.map(transitionRowKey)).size).toBe(
      duplicate.transitions.length,
    );
    expect(migrateSpecTo21(duplicate).issues[0].path).toBe("transitions[2]");
    const migrated = migrateSpecTo21(legacy()).spec!;
    const stableKeys = migrated.transitions.map(transitionRowKey);
    expect([...migrated.transitions].reverse().map(transitionRowKey)).toEqual(
      [...stableKeys].reverse(),
    );
    migrated.transitions[1].id = migrated.transitions[0].id;
    expect(parseSpecYaml(stringify(migrated)).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "transitions[1].id" }),
      ]),
    );
    migrated.transitions[1].id = "other";
    migrated.screens[1].stateFlow.transitions[0].to = "missing";
    expect(parseSpecYaml(stringify(migrated)).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "screens[1].stateFlow.transitions[0].to",
        }),
      ]),
    );
  });
});

describe("generated lists", () => {
  it("tracks saved screen and component changes without inventing fields", () => {
    const spec = migrateSpecTo21(legacy()).spec!;
    const before = generateSpecLists(spec);
    expect(before.screens[0].title).toBe("タスク一覧");
    expect(before.items.find((item) => item.id === "new-task")?.action).toBe(
      "open-create-task",
    );
    expect(
      before.items.find((item) => item.id === "heading"),
    ).not.toHaveProperty("action");
    spec.screens[0].title = "作業一覧";
    spec.screens[0].components[1].action = "open-task-form";
    const reloaded = parseSpecYaml(stringify(spec)).spec!;
    const after = generateSpecLists(reloaded);
    expect(after.screens[0].title).toBe("作業一覧");
    expect(after.items.find((item) => item.id === "new-task")?.action).toBe(
      "open-task-form",
    );
    expect(before.screens[0].title).toBe("タスク一覧");
  });
});
