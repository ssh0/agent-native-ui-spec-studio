import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { stringify } from "yaml";

import { DEFAULT_SPEC_YAML } from "./default-spec";
import { editSpec } from "./spec-edit";
import { SpecSchema, validateSpecRelations, type UiSpec } from "./spec-schema";
import { parseSpecYaml, renderFlow, renderWireframe } from "./spec-utils";
const example = () => parseSpecYaml(DEFAULT_SPEC_YAML).spec!;

describe("canonical specification structure and relations", () => {
  it("starts with every stage explicit and no invented screens", () => {
    const minimal = {
      version: "2.0",
      title: "検討開始",
      domain: { entities: [], terms: [] },
      flows: [],
      useCases: [],
      screens: [],
      transitions: [],
    };
    expect(parseSpecYaml(stringify(minimal))).toEqual({
      spec: minimal,
      issues: [],
    });
    const added = editSpec(minimal as UiSpec, {
      kind: "add_screen",
      screenId: "home",
      title: "ホーム",
    });
    expect(added.screens[0].stateFlow).toEqual({
      initial: null,
      states: [],
      transitions: [],
    });
    expect(
      editSpec(added, { kind: "delete_screen", screenId: "home" }).screens,
    ).toEqual([]);
  });
  it.each(["version", "domain", "flows", "useCases", "screens", "transitions"])(
    "requires the %s structure without implicit defaults",
    (key) => {
      const value = { ...example() } as Record<string, unknown>;
      delete value[key];
      expect(SpecSchema.safeParse(value).success).toBe(false);
    },
  );
  it.each(["1.0", "1.1", "3.0"])(
    "rejects unsupported version %s",
    (version) => {
      expect(SpecSchema.safeParse({ ...example(), version }).success).toBe(
        false,
      );
    },
  );
  it("rejects unknown fields instead of silently losing them", () => {
    expect(SpecSchema.safeParse({ ...example(), usecases: [] }).success).toBe(
      false,
    );
    const spec = example();
    (spec.screens[0].components[0] as Record<string, unknown>).unknownProperty =
      "data";
    expect(SpecSchema.safeParse(spec).success).toBe(false);
  });
  it("requires explicit nested stage structures", () => {
    for (const path of [
      ["domain", "entities"],
      ["domain", "terms"],
      ["domain", "entities", 0, "fields"],
      ["flows", 0, "steps"],
      ["useCases", 0, "steps"],
      ["useCases", 0, "branches"],
      ["useCases", 0, "preconditions"],
      ["useCases", 0, "postconditions"],
      ["screens", 0, "components"],
      ["screens", 0, "stateFlow"],
      ["screens", 0, "stateFlow", "states"],
      ["screens", 0, "stateFlow", "transitions"],
    ]) {
      const spec = example();
      let parent: any = spec;
      for (const part of path.slice(0, -1)) parent = parent[part];
      delete parent[path[path.length - 1]];
      expect(SpecSchema.safeParse(spec).success, path.join(".")).toBe(false);
    }
  });
  it("requires an initial state once screen states are defined", () => {
    const spec = example();
    spec.screens[0].stateFlow.initial = null;
    expect(validateSpecRelations(spec)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "screens[0].stateFlow.initial" }),
      ]),
    );
  });
  it("keeps the documented example and starter identical, valid and lossless", () => {
    expect(DEFAULT_SPEC_YAML).toBe(
      readFileSync(new URL("../specs/example.yaml", import.meta.url), "utf8"),
    );
    expect(parseSpecYaml(DEFAULT_SPEC_YAML).issues).toEqual([]);
    expect(parseSpecYaml(stringify(example())).spec).toEqual(example());
  });
  it("rejects malformed branches", () => {
    const spec = example();
    (spec.useCases[0].branches[0] as any).kind = "happy";
    expect(SpecSchema.safeParse(spec).success).toBe(false);
  });
  it.each([
    [
      "entity relationship",
      (s: UiSpec) => {
        s.domain.entities[0].fields[0].entity = "missing";
      },
    ],
    [
      "term",
      (s: UiSpec) => {
        s.domain.terms[0].entity = "missing";
      },
    ],
    [
      "flow use case",
      (s: UiSpec) => {
        s.flows[0].steps[0].useCase = "missing";
      },
    ],
    [
      "use case entity",
      (s: UiSpec) => {
        s.useCases[0].entities = ["missing"];
      },
    ],
    [
      "use case screen",
      (s: UiSpec) => {
        s.useCases[0].screens = ["missing"];
      },
    ],
    [
      "step screen",
      (s: UiSpec) => {
        s.useCases[0].steps[0].screen = "missing";
      },
    ],
    [
      "component action",
      (s: UiSpec) => {
        s.useCases[0].steps[0].action!.component = "heading";
      },
    ],
    [
      "branch origin",
      (s: UiSpec) => {
        s.useCases[0].branches[0].from = "missing";
      },
    ],
    [
      "branch rejoin",
      (s: UiSpec) => {
        s.useCases[0].branches[0].resumeAt = "missing";
      },
    ],
    [
      "screen entity",
      (s: UiSpec) => {
        s.screens[0].entities = ["missing"];
      },
    ],
    [
      "component use case",
      (s: UiSpec) => {
        s.screens[0].components[0].useCases = ["missing"];
      },
    ],
    [
      "initial state",
      (s: UiSpec) => {
        s.screens[1].stateFlow.initial = "missing";
      },
    ],
    [
      "state endpoint",
      (s: UiSpec) => {
        s.screens[1].stateFlow.transitions[0].to = "missing";
      },
    ],
    [
      "state control",
      (s: UiSpec) => {
        s.screens[1].stateFlow.transitions[0].component = "missing";
      },
    ],
    [
      "duplicate entity",
      (s: UiSpec) => {
        s.domain.entities.push(s.domain.entities[0]);
      },
    ],
    [
      "duplicate step",
      (s: UiSpec) => {
        s.useCases[0].steps.push(s.useCases[0].steps[0]);
      },
    ],
    [
      "duplicate state",
      (s: UiSpec) => {
        s.screens[1].stateFlow.states.push(s.screens[1].stateFlow.states[0]);
      },
    ],
  ])("reports a broken %s", (_label, mutate) => {
    const spec = example();
    mutate(spec);
    expect(validateSpecRelations(spec).length).toBeGreaterThan(0);
  });
  it("preserves all stages and notes during focused edits; renames references", () => {
    const spec = editSpec(example(), {
      kind: "update_screen",
      screenId: "dashboard",
      nextScreenId: "list",
    });
    expect(validateSpecRelations(spec)).toEqual([]);
    expect(spec.useCases[0].steps[0].action?.screen).toBe("list");
    expect(spec.domain).toEqual(example().domain);
    expect(() =>
      editSpec(spec, {
        kind: "delete_component",
        screenId: "list",
        componentId: "new-task",
      }),
    ).toThrow();
  });
  it("edits transitions without requiring an unrelated screenId", () => {
    const spec = editSpec(example(), {
      kind: "add_transition",
      transition: { from: "dashboard", to: "dashboard", trigger: "refresh" },
    });
    expect(spec.transitions).toHaveLength(3);
  });
  it("validates section replacement before accepting it", () => {
    expect(() =>
      editSpec(example(), {
        kind: "set_section",
        section: "domain",
        value: { entities: [], terms: [] },
      }),
    ).toThrow();
    expect(
      editSpec(example(), { kind: "set_section", section: "flows", value: [] })
        .flows,
    ).toEqual([]);
  });
  it("renders branches, exceptions and state diagrams without injecting Mermaid syntax", () => {
    const spec = example();
    spec.screens[0].id = 'end"]\nmalicious';
    spec.screens[0].title = '<script>alert("x")</script>';
    const diagram = renderFlow(spec);
    expect(diagram).not.toContain("<script>");
    expect(diagram).not.toContain("malicious");
    expect(renderFlow(example(), "useCases")).toContain("u0b1");
    expect(renderFlow(example(), "useCases")).toContain("u0o1 --> u0s2");
    expect(renderFlow(example(), "states", "create-task")).toContain("start");
    expect(renderWireframe(spec)).not.toContain("<script>");
  });
  it("leaves undefined or missing flow selections empty", () => {
    const spec = example();
    spec.screens[0].stateFlow = spec.screens[1].stateFlow;
    expect(renderFlow(spec, "states", "missing")).toBe("");
    expect(renderFlow(spec, "useCases", "missing")).toBe("");
    spec.useCases = [
      {
        id: "planned",
        title: "検討中",
        entities: [],
        screens: [],
        preconditions: [],
        postconditions: [],
        steps: [],
        branches: [],
      },
    ];
    expect(renderFlow(spec, "useCases", "planned")).toBe("");
  });
  it("reports schema issues in Japanese with the affected path", () => {
    const result = parseSpecYaml(
      stringify({ ...example(), title: "", flows: {} }),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { path: "title", message: "1文字以上を指定してください。" },
        { path: "flows", message: "配列を指定してください。" },
      ]),
    );
  });
});
