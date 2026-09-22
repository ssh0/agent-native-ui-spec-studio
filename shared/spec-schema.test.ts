import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { stringify } from "yaml";

import { DEFAULT_SPEC_YAML } from "./default-spec";
import { editSpec } from "./spec-edit";
import { SpecSchema, validateSpecRelations, type UiSpec } from "./spec-schema";
import { parseSpecYaml, renderFlow, renderWireframe } from "./spec-utils";
const example = () => parseSpecYaml(DEFAULT_SPEC_YAML).spec!;

describe("specification compatibility and relations", () => {
  it("loads legacy documents without inserting new sections", () => {
    const result = parseSpecYaml(
      "title: Legacy\nscreens:\n  - id: home\n    title: Home\n",
    );
    expect(result.issues).toEqual([]);
    expect(result.spec).toEqual({
      version: "1.0",
      title: "Legacy",
      screens: [{ id: "home", title: "Home", components: [] }],
      transitions: [],
    });
  });
  it("keeps the documented example and starter identical, valid and lossless", () => {
    expect(DEFAULT_SPEC_YAML).toBe(
      readFileSync(new URL("../specs/example.yaml", import.meta.url), "utf8"),
    );
    expect(parseSpecYaml(DEFAULT_SPEC_YAML).issues).toEqual([]);
    expect(parseSpecYaml(stringify(example())).spec).toEqual(example());
  });
  it("rejects unsupported versions and malformed branches", () => {
    expect(SpecSchema.safeParse({ ...example(), version: "2.0" }).success).toBe(
      false,
    );
    const spec = example();
    (spec.useCases![0].branches[0] as any).kind = "happy";
    expect(SpecSchema.safeParse(spec).success).toBe(false);
  });
  it.each([
    [
      "entity relationship",
      (s: UiSpec) => {
        s.domain!.entities[0].fields[0].entity = "missing";
      },
    ],
    [
      "term",
      (s: UiSpec) => {
        s.domain!.terms[0].entity = "missing";
      },
    ],
    [
      "flow use case",
      (s: UiSpec) => {
        s.flows![0].steps[0].useCase = "missing";
      },
    ],
    [
      "use case entity",
      (s: UiSpec) => {
        s.useCases![0].entities = ["missing"];
      },
    ],
    [
      "use case screen",
      (s: UiSpec) => {
        s.useCases![0].screens = ["missing"];
      },
    ],
    [
      "step screen",
      (s: UiSpec) => {
        s.useCases![0].steps[0].screen = "missing";
      },
    ],
    [
      "component action",
      (s: UiSpec) => {
        s.useCases![0].steps[0].action!.component = "heading";
      },
    ],
    [
      "branch origin",
      (s: UiSpec) => {
        s.useCases![0].branches[0].from = "missing";
      },
    ],
    [
      "branch rejoin",
      (s: UiSpec) => {
        s.useCases![0].branches[0].resumeAt = "missing";
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
        s.screens[1].stateFlow!.initial = "missing";
      },
    ],
    [
      "state endpoint",
      (s: UiSpec) => {
        s.screens[1].stateFlow!.transitions[0].to = "missing";
      },
    ],
    [
      "state control",
      (s: UiSpec) => {
        s.screens[1].stateFlow!.transitions[0].component = "missing";
      },
    ],
    [
      "duplicate entity",
      (s: UiSpec) => {
        s.domain!.entities.push(s.domain!.entities[0]);
      },
    ],
    [
      "duplicate step",
      (s: UiSpec) => {
        s.useCases![0].steps.push(s.useCases![0].steps[0]);
      },
    ],
    [
      "duplicate state",
      (s: UiSpec) => {
        s.screens[1].stateFlow!.states.push(s.screens[1].stateFlow!.states[0]);
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
    expect(spec.useCases![0].steps[0].action?.screen).toBe("list");
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
        value: { entities: [] },
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
});
