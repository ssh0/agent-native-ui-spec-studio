import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { stringify } from "yaml";

import { DEFAULT_SPEC_YAML } from "./default-spec";
import {
  editSpec,
  renameEntity,
  renameParticipant,
  renameTerm,
} from "./spec-edit";
import { SpecSchema, validateSpecRelations, type UiSpec } from "./spec-schema";
import { parseSpecYaml, renderFlow, renderWireframe } from "./spec-utils";
const example = () => parseSpecYaml(DEFAULT_SPEC_YAML).spec!;

describe("canonical specification structure and relations", () => {
  it("starts with every stage explicit and no invented screens", () => {
    const minimal = {
      version: "2.0",
      title: "検討開始",
      domain: {
        actors: [],
        externalSystems: [],
        entities: [],
        relations: [],
        terms: [],
      },
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
      ["domain", "relations"],
      ["domain", "terms"],
      ["domain", "actors"],
      ["domain", "externalSystems"],
      ["flows", 0, "steps", 0, "performer"],
      ["domain", "entities", 0, "fields"],
      ["domain", "entities", 0, "extends"],
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
        s.domain.relations.push({
          id: "missing",
          title: "missing",
          from: {
            entity: { kind: "entity", id: "missing" },
            role: "元",
            min: 0,
            max: 1,
          },
          to: {
            entity: { kind: "entity", id: "task" },
            role: "先",
            min: 0,
            max: 1,
          },
        });
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
        actors: [],
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

describe("business flow participants and lanes", () => {
  it.each(["example", "todo-app", "ec-commerce"])(
    "validates the %s sample",
    (name) => {
      const parsed = parseSpecYaml(
        readFileSync(new URL(`../specs/${name}.yaml`, import.meta.url), "utf8"),
      );
      expect(parsed.issues).toEqual([]);
      expect(parsed.spec?.flows[0].steps.some((s) => !s.useCase)).toBe(true);
    },
  );
  it.each(["actors", "externalSystems"] as const)(
    "requires %s descriptions and unique IDs",
    (section) => {
      const spec = example();
      spec.domain[section][0].description = "";
      expect(SpecSchema.safeParse(spec).success).toBe(false);
      spec.domain[section][0].description = "Role";
      spec.domain[section].push({ ...spec.domain[section][0] });
      expect(validateSpecRelations(spec)).toContainEqual(
        expect.objectContaining({
          path: `domain.${section}[${spec.domain[section].length - 1}].id`,
        }),
      );
    },
  );
  it.each(["actors", "externalSystem"] as const)(
    "checks the %s reference namespace",
    (kind) => {
      const spec = example();
      const step = spec.flows[0].steps[0];
      step.performer =
        kind === "actors"
          ? { kind, refs: [{ kind: "actor", id: "notification" }] }
          : { kind, id: "member" };
      expect(validateSpecRelations(spec)).toContainEqual(
        expect.objectContaining({
          path:
            kind === "actors"
              ? "flows[0].steps[0].performer.refs[0].id"
              : "flows[0].steps[0].performer.id",
        }),
      );
      if (step.performer.kind === "actors")
        step.performer.refs[0].id = "missing";
      else step.performer.id = "missing";
      expect(validateSpecRelations(spec)).toHaveLength(1);
    },
  );
  it.each([
    undefined,
    "member",
    { kind: "system", id: "notification" },
    { kind: "actors", refs: [] },
    { kind: "actors", refs: [{ kind: "actor", id: "" }] },
    { kind: "actors", id: "member" },
  ])("rejects malformed performer %j", (performer) => {
    const spec = example();
    (spec.flows[0].steps[0] as any).performer = performer;
    expect(SpecSchema.safeParse(spec).success).toBe(false);
  });
  it("rejects legacy flow-level actors and duplicate business steps", () => {
    const spec = example();
    expect(
      SpecSchema.safeParse({
        ...spec,
        flows: [{ ...spec.flows[0], actor: "member" }],
      }).success,
    ).toBe(false);
    spec.flows[0].steps.push(spec.flows[0].steps[0]);
    expect(validateSpecRelations(spec)).toContainEqual(
      expect.objectContaining({ path: "flows[0].steps[6].id" }),
    );
  });
  it("preserves notes and typed references on participant rename", () => {
    const spec = example();
    spec.domain.externalSystems[0].id = "member";
    spec.flows[0].steps[4].performer = { kind: "externalSystem", id: "member" };
    const next = renameParticipant(spec, "actor", "member", "staff");
    expect(validateSpecRelations(next)).toEqual([]);
    expect(next.flows[0].steps[1].performer).toEqual({
      kind: "actors",
      refs: [{ kind: "actor", id: "staff" }],
    });
    expect(next.flows[0].steps[4].performer).toEqual({
      kind: "externalSystem",
      id: "member",
    });
    expect(next.flows[0].notes).toBe(spec.flows[0].notes);
    expect(next.useCases[0].actors).toEqual([{ kind: "actor", id: "staff" }]);
    expect(spec.domain.actors[0].id).toBe("member");
    expect(() =>
      editSpec(next, {
        kind: "set_section",
        section: "domain",
        value: { ...next.domain, actors: [] },
      }),
    ).toThrow();
  });
  it("renders lanes, ordered handoffs, use case links and safe labels", () => {
    const spec = example();
    const diagram = renderFlow(spec, "flows", "task-intake");
    expect(diagram.match(/subgraph f0lane/g)).toHaveLength(3);
    for (let i = 1; i < 6; i++)
      expect(diagram).toContain(`f0s${i - 1} --> f0s${i}`);
    const encode = (s: string) =>
      Array.from(s, (c) => `#${c.codePointAt(0)};`).join("");
    expect(diagram).toContain(encode("UC: タスクを登録する"));
    const malicious = 'end"]\nclick f0s0 "javascript:alert(1)"';
    spec.domain.actors[0].title = malicious;
    spec.flows[0].title = malicious;
    spec.flows[0].steps[0].title = malicious;
    expect(renderFlow(spec, "flows")).not.toContain("javascript:");
    expect(renderFlow(spec, "flows")).toContain(encode(malicious));
  });
  it("handles multiple flows and unfinished or missing selections", () => {
    const spec = example();
    spec.flows.push({ ...spec.flows[0], id: "second" });
    expect(renderFlow(spec, "flows")).toContain("f1s0 --> f1s1");
    expect(
      renderFlow(spec, "flows", "second").match(/subgraph f\d\[/g),
    ).toHaveLength(1);
    expect(renderFlow(spec, "flows", "missing")).toBe("");
    spec.flows[0].steps = [];
    expect(renderFlow(spec, "flows", "task-intake")).toBe("");
    spec.flows = [];
    expect(renderFlow(spec, "flows")).toBe("");
  });
});

describe("typed domain sets, hierarchy and associations", () => {
  const ec = () =>
    parseSpecYaml(
      readFileSync(
        new URL("../specs/ec-commerce.yaml", import.meta.url),
        "utf8",
      ),
    ).spec!;
  it("uses a named actor union and a grounded entity difference in the EC sample", () => {
    const spec = ec();
    expect(
      spec.domain.terms.find((t) => t.id === "storefront-users")?.actorSet,
    ).toEqual({
      op: "union",
      operands: [
        { kind: "actor", id: "customer" },
        { kind: "actor", id: "operator" },
      ],
    });
    expect(
      spec.useCases.find((u) => u.id === "browse-products")?.actors,
    ).toEqual([{ kind: "term", id: "storefront-users" }]);
    expect(
      spec.domain.terms.find((t) => t.id === "shippable-product")?.entitySet,
    ).toMatchObject({ op: "difference" });
    expect(
      spec.domain.terms.find((t) => t.id === "digital-subscription")?.entitySet,
    ).toMatchObject({ op: "intersection" });
    expect(
      spec.domain.entities.find((e) => e.id === "digital-product")?.extends,
    ).toEqual(["product"]);
    expect(
      spec.domain.relations.find((r) => r.id === "product-category")?.to.max,
    ).toBeNull();
    expect(
      spec.domain.relations.find((r) => r.id === "inventory-product")?.from.max,
    ).toBe(1);
    expect(
      spec.domain.relations.find((r) => r.id === "order-items")?.from.max,
    ).toBe(1);
    expect(
      spec.domain.relations.find((r) => r.id === "order-items")?.to.max,
    ).toBeNull();
  });
  it("rejects unknown and wrong-kind actor references in use cases and flows", () => {
    const spec = ec();
    spec.useCases[0].actors = [{ kind: "actor", id: "missing" }];
    expect(validateSpecRelations(spec)).toContainEqual(
      expect.objectContaining({ path: "useCases[0].actors[0].id" }),
    );
    spec.useCases[0].actors = [{ kind: "term", id: "shippable-product" }];
    expect(validateSpecRelations(spec)).toContainEqual(
      expect.objectContaining({ path: "useCases[0].actors[0]" }),
    );
    spec.flows[0].steps[0].performer = {
      kind: "actors",
      refs: [{ kind: "actor", id: "member-service" }],
    };
    expect(validateSpecRelations(spec)).toContainEqual(
      expect.objectContaining({
        path: "flows[0].steps[0].performer.refs[0].id",
      }),
    );
  });
  it("requires a nonempty performer set and a bounded difference", () => {
    const spec = ec();
    spec.flows[0].steps[0].performer = { kind: "actors", refs: [] };
    expect(SpecSchema.safeParse(spec).success).toBe(false);
    spec.flows[0].steps[0].performer = {
      kind: "actors",
      refs: [{ kind: "actor", id: "customer" }],
    };
    spec.domain.terms.find((t) => t.id === "shippable-product")!.entitySet = {
      op: "difference",
      operands: [
        { kind: "entity", id: "product" },
        { kind: "entity", id: "digital-product" },
        { kind: "entity", id: "category" },
      ],
    };
    expect(validateSpecRelations(spec)).toContainEqual(
      expect.objectContaining({ path: expect.stringContaining("entitySet") }),
    );
    spec.domain.terms.find((t) => t.id === "shippable-product")!.entitySet = {
      op: "union",
      operands: [],
    };
    expect(SpecSchema.safeParse(spec).success).toBe(false);
  });
  it("detects set cycles, including through composed entity terms", () => {
    const spec = ec();
    spec.domain.terms.push(
      {
        id: "a",
        title: "A",
        definition: "A",
        actorSet: { kind: "term", id: "b" },
      },
      {
        id: "b",
        title: "B",
        definition: "B",
        actorSet: { kind: "term", id: "a" },
      },
    );
    expect(
      validateSpecRelations(spec).some((i) => i.message.includes("循環")),
    ).toBe(true);
    spec.domain.terms.splice(-2);
    spec.domain.terms.push(
      {
        id: "x",
        title: "X",
        definition: "X",
        entitySet: { kind: "term", id: "y" },
      },
      {
        id: "y",
        title: "Y",
        definition: "Y",
        entitySet: { kind: "term", id: "x" },
      },
    );
    expect(
      validateSpecRelations(spec).some((i) => i.message.includes("循環")),
    ).toBe(true);
  });
  it("detects inheritance cycles, endpoint errors and invalid multiplicities", () => {
    const spec = ec();
    spec.domain.entities.find((e) => e.id === "product")!.extends = [
      "physical-product",
    ];
    expect(
      validateSpecRelations(spec).some((i) =>
        i.message.includes("継承関係が循環"),
      ),
    ).toBe(true);
    spec.domain.entities.find((e) => e.id === "product")!.extends = [];
    spec.domain.relations[0].to.entity.id = "missing";
    spec.domain.relations[0].from.min = 2;
    spec.domain.relations[0].from.max = 1;
    expect(validateSpecRelations(spec)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "domain.relations[0].to.entity.id" }),
        expect.objectContaining({ path: "domain.relations[0].from.max" }),
      ]),
    );
  });
  it("renames actor, term and entity references without changing other namespaces", () => {
    const original = ec();
    const actor = renameParticipant(original, "actor", "customer", "buyer");
    expect(validateSpecRelations(actor)).toEqual([]);
    expect(
      actor.domain.terms.find((t) => t.id === "storefront-users")?.actorSet,
    ).toMatchObject({
      op: "union",
      operands: [
        { kind: "actor", id: "buyer" },
        { kind: "actor", id: "operator" },
      ],
    });
    const term = renameTerm(actor, "storefront-users", "stakeholders");
    expect(validateSpecRelations(term)).toEqual([]);
    expect(
      term.useCases.find((u) => u.id === "browse-products")?.actors,
    ).toEqual([{ kind: "term", id: "stakeholders" }]);
    term.domain.terms.push({
      id: "delivery-class",
      title: "配送分類",
      definition: "配送対象商品の別名",
      entitySet: { kind: "term", id: "shippable-product" },
    });
    const renamedEntityTerm = renameTerm(
      term,
      "shippable-product",
      "delivery-product",
    );
    expect(
      renamedEntityTerm.domain.terms.find((t) => t.id === "delivery-class")
        ?.entitySet,
    ).toEqual({ kind: "term", id: "delivery-product" });
    const entity = renameEntity(renamedEntityTerm, "product", "item");
    expect(validateSpecRelations(entity)).toEqual([]);
    expect(
      entity.domain.entities.find((e) => e.id === "physical-product")?.extends,
    ).toEqual(["item"]);
    expect(
      entity.domain.relations.find((r) => r.id === "product-category")?.from
        .entity,
    ).toEqual({ kind: "entity", id: "item" });
    expect(original.domain.actors[0].id).toBe("customer");
  });
  it("guards referenced deletion through the agent section edit path", () => {
    const spec = ec();
    expect(() =>
      editSpec(spec, {
        kind: "set_section",
        section: "domain",
        value: {
          ...spec.domain,
          actors: spec.domain.actors.filter((a) => a.id !== "customer"),
        },
      }),
    ).toThrow();
    expect(() =>
      editSpec(spec, {
        kind: "set_section",
        section: "domain",
        value: {
          ...spec.domain,
          terms: spec.domain.terms.filter((t) => t.id !== "storefront-users"),
        },
      }),
    ).toThrow();
    expect(() =>
      editSpec(spec, {
        kind: "set_section",
        section: "domain",
        value: {
          ...spec.domain,
          entities: spec.domain.entities.filter((e) => e.id !== "product"),
        },
      }),
    ).toThrow();
  });
  it("renders named and multi-actor business lanes", () => {
    const spec = ec();
    spec.flows[0].steps[0].performer = {
      kind: "actors",
      refs: [
        { kind: "actor", id: "customer" },
        { kind: "term", id: "storefront-users" },
      ],
    };
    const diagram = renderFlow(spec, "flows", "purchase");
    const encode = (s: string) =>
      Array.from(s, (c) => `#${c.codePointAt(0)};`).join("");
    expect(diagram).toContain(encode("アクター: エンドユーザー、ストア利用者"));
    expect(diagram).toContain("f0s0 --> f0s1");
    spec.flows[0].steps[1].performer = {
      kind: "actors",
      refs: [
        { kind: "term", id: "storefront-users" },
        { kind: "actor", id: "customer" },
      ],
    };
    expect(
      renderFlow(spec, "flows", "purchase").match(/subgraph f0lane/g),
    ).toHaveLength(5);
  });
});
