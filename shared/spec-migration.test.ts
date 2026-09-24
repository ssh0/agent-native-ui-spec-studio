import { describe, expect, it } from "vitest";
import { stringify } from "yaml";

import { DEFAULT_SPEC_YAML } from "./default-spec";
import { migrateSpecTo21 } from "./spec-migration";
import { generateSpecLists } from "./spec-lists";
import { parseSpecYaml } from "./spec-utils";

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
    expect(new Map(first.transitions.map((t) => [t.trigger, t.id]))).toEqual(new Map(second.transitions.map((t) => [t.trigger, t.id])));
    expect(new Map(first.screens[1].stateFlow.transitions.map((t) => [t.trigger, t.id]))).toEqual(new Map(second.screens.find((s) => s.id === first.screens[1].id)!.stateFlow.transitions.map((t) => [t.trigger, t.id])));
    expect(migrateSpecTo21(first).issues[0].path).toBe("version");
  });

  it("reports ambiguous duplicates, duplicate IDs and broken references", () => {
    const duplicate = legacy();
    duplicate.transitions.push({ ...duplicate.transitions[0] });
    expect(migrateSpecTo21(duplicate).issues[0].path).toBe("transitions[2]");
    const migrated = migrateSpecTo21(legacy()).spec!;
    migrated.transitions[1].id = migrated.transitions[0].id;
    expect(parseSpecYaml(stringify(migrated)).issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: "transitions[1].id" })]));
    migrated.transitions[1].id = "other";
    migrated.screens[1].stateFlow.transitions[0].to = "missing";
    expect(parseSpecYaml(stringify(migrated)).issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: "screens[1].stateFlow.transitions[0].to" })]));
  });
});

describe("generated lists", () => {
  it("tracks saved screen and component changes without inventing fields", () => {
    const spec = migrateSpecTo21(legacy()).spec!;
    const before = generateSpecLists(spec);
    expect(before.screens[0].title).toBe("タスク一覧");
    expect(before.items.find((item) => item.id === "new-task")?.action).toBe("open-create-task");
    expect(before.items.find((item) => item.id === "heading")).not.toHaveProperty("action");
    spec.screens[0].title = "作業一覧";
    spec.screens[0].components[1].action = "open-task-form";
    const reloaded = parseSpecYaml(stringify(spec)).spec!;
    const after = generateSpecLists(reloaded);
    expect(after.screens[0].title).toBe("作業一覧");
    expect(after.items.find((item) => item.id === "new-task")?.action).toBe("open-task-form");
    expect(before.screens[0].title).toBe("タスク一覧");
  });
});
