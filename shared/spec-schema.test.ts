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
import { migrateSpecTo21 } from "./spec-migration";
import {
  isFlowStep,
  SpecSchema,
  validateSpecRelations,
  type FlowStep,
  type UiSpec,
} from "./spec-schema";
import {
  groupFlowStepsByPerformer,
  parseSpecYaml,
  renderFlow,
  renderWireframe,
} from "./spec-utils";
const example = () => parseSpecYaml(DEFAULT_SPEC_YAML).spec!;
const flowStep = (spec: UiSpec, index = 0): FlowStep => {
  const node = spec.flows[0].steps[index];
  if (!node || !isFlowStep(node))
    throw new Error(`Expected flow step ${index}`);
  return node;
};

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
        flowStep(s).useCase = "missing";
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
    const migrated = migrateSpecTo21(example()).spec!;
    const spec = editSpec(migrated, {
      kind: "add_transition",
      transition: {
        id: "refresh",
        from: "dashboard",
        to: "dashboard",
        trigger: "refresh",
      },
    });
    expect(spec.transitions).toHaveLength(3);
    const moved = editSpec(spec, {
      kind: "update_transition",
      transitionId: "refresh",
      transition: { to: "create-task" },
    });
    expect(
      moved.transitions.find((transition) => transition.id === "refresh")?.to,
    ).toBe("create-task");
    expect(
      editSpec(
        { ...moved, transitions: [...moved.transitions].reverse() },
        { kind: "delete_transition", transitionId: "refresh" },
      ).transitions,
    ).toHaveLength(2);
    expect(() =>
      editSpec(example(), {
        kind: "add_transition",
        transition: {
          id: "new",
          from: "dashboard",
          to: "dashboard",
          trigger: "refresh",
        },
      }),
    ).toThrow("2.1");
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
    const encode = (s: string) =>
      Array.from(s, (c) => `#${c.codePointAt(0)};`).join("");
    expect(renderFlow(example())).toContain(encode("タスク一覧 (dashboar…)"));
    expect(renderFlow(example(), "useCases")).toContain("u0b1");
    expect(renderFlow(example(), "useCases")).toContain(
      encode("タスクを登録する (create-t…)"),
    );
    expect(renderFlow(example(), "useCases")).toContain("u0o1 --> u0s2");
    expect(renderFlow(example(), "states", "create-task")).toContain("start");
    expect(renderWireframe(spec)).not.toContain("<script>");
    const wireframe = renderWireframe(example());
    expect(wireframe.indexOf("<h2>タスク一覧</h2>")).toBeLessThan(
      wireframe.indexOf('class="wireframe-screen__id"'),
    );
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
  const graphSpec = () => {
    const spec = example();
    const performer = {
      kind: "actors" as const,
      refs: [{ kind: "actor" as const, id: "member" }],
    };
    spec.flows[0].steps = [
      { id: "start", kind: "start" },
      { id: "submit", kind: "step", title: "申請を提出する", performer },
      { id: "decision", kind: "branch", title: "承認するか" },
      { id: "revise", kind: "step", title: "申請を修正する", performer },
      { id: "approve", kind: "step", title: "承認を登録する", performer },
      {
        id: "reject",
        kind: "step",
        title: "却下を通知する",
        performer: { kind: "externalSystem", id: "notification" },
      },
      {
        id: "notify",
        kind: "step",
        title: "結果を通知する",
        performer: { kind: "externalSystem", id: "notification" },
      },
      { id: "end", kind: "end" },
    ];
    spec.flows[0].edges = [
      { from: "start", to: "submit" },
      { from: "submit", to: "decision" },
      { from: "decision", to: "revise", label: "差し戻し" },
      { from: "decision", to: "approve", label: "承認" },
      { from: "decision", to: "reject", label: "却下" },
      { from: "revise", to: "submit" },
      { from: "approve", to: "notify" },
      { from: "reject", to: "notify" },
      { from: "notify", to: "end" },
    ];
    return spec;
  };

  it.each(["example", "todo-app", "ec-commerce"])(
    "validates the %s sample",
    (name) => {
      const parsed = parseSpecYaml(
        readFileSync(new URL(`../specs/${name}.yaml`, import.meta.url), "utf8"),
      );
      expect(parsed.issues).toEqual([]);
      expect(
        parsed.spec?.flows[0].steps.some(
          (node) => isFlowStep(node) && !node.useCase,
        ),
      ).toBe(true);
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
      const step = flowStep(spec);
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
    flowStep(spec, 4).performer = { kind: "externalSystem", id: "member" };
    const next = renameParticipant(spec, "actor", "member", "staff");
    expect(validateSpecRelations(next)).toEqual([]);
    expect(flowStep(next, 1).performer).toEqual({
      kind: "actors",
      refs: [{ kind: "actor", id: "staff" }],
    });
    expect(flowStep(next, 4).performer).toEqual({
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
  it("keeps performer identities distinct when IDs contain separators", () => {
    const spec = example();
    spec.flows[0].steps = [
      {
        id: "single",
        title: "単独担当",
        performer: {
          kind: "actors",
          refs: [{ kind: "actor", id: "a|actor:b" }],
        },
      },
      {
        id: "multiple",
        title: "複数担当",
        performer: {
          kind: "actors",
          refs: [
            { kind: "actor", id: "a" },
            { kind: "actor", id: "b" },
          ],
        },
      },
    ];

    const diagram = renderFlow(spec, "flows", "task-intake");
    const encode = (value: string) =>
      Array.from(value, (char) => `#${char.codePointAt(0)};`).join("");
    expect(diagram.match(/subgraph f0lane/g)).toHaveLength(2);
    expect(diagram).toContain(encode("アクター: 未解決 (a|actor:…)"));
    expect(diagram).toContain(
      encode("アクター: 未解決 (a)、アクター: 未解決 (b)"),
    );
  });
  it("places each performer in one vertical lane and keeps step order", () => {
    const spec = example();
    const sample = flowStep(spec);
    const requester = {
      kind: "actors" as const,
      refs: [{ kind: "actor" as const, id: "requester" }],
    };
    const member = {
      kind: "actors" as const,
      refs: [{ kind: "actor" as const, id: "member" }],
    };
    spec.flows[0].steps = [
      { ...sample, id: "request", performer: requester },
      { ...sample, id: "review", performer: member },
      { ...sample, id: "confirm", performer: requester },
      {
        ...sample,
        id: "notify",
        performer: { kind: "externalSystem", id: "notification" },
      },
      { ...sample, id: "complete", performer: member },
    ];

    const lanes = groupFlowStepsByPerformer(spec.flows[0].steps);
    expect(lanes.map((lane) => lane.steps.map(({ index }) => index))).toEqual([
      [0, 2],
      [1, 4],
      [3],
    ]);
    expect(lanes.map((lane) => lane.performer)).toEqual([
      requester,
      member,
      { kind: "externalSystem", id: "notification" },
    ]);
  });
  it("validates branches, merges, and loops, then renders their explicit connections", () => {
    const spec = graphSpec();
    expect(validateSpecRelations(spec)).toEqual([]);
    expect(SpecSchema.safeParse(spec).success).toBe(true);
    expect(parseSpecYaml(stringify(spec)).issues).toEqual([]);

    const diagram = renderFlow(spec, "flows", spec.flows[0].id);
    const encode = (value: string) =>
      Array.from(value, (char) => `#${char.codePointAt(0)};`).join("");
    expect(diagram).toMatch(/^flowchart LR/);
    expect(diagram).toContain(`f0n0(("${encode("開始")}"))`);
    expect(diagram).toContain(`f0n2{"${encode("承認するか")}"}`);
    expect(diagram).toContain(`f0n2 -->|"${encode("差し戻し")}"| f0n3`);
    expect(diagram).toContain("f0n3 --> f0n1");
    expect(diagram).toContain("f0n4 --> f0n6");
    expect(diagram).toContain("f0n5 --> f0n6");
    expect(diagram).toContain(`f0n7(("${encode("終了")}"))`);
  });
  it("keeps legacy branches in the control lane and accepts actor decisions in 2.0 and 2.1", () => {
    const legacy = graphSpec();
    const branch = legacy.flows[0].steps[2];
    expect(isFlowStep(branch)).toBe(false);
    expect(parseSpecYaml(stringify(legacy)).issues).toEqual([]);
    expect(branch).not.toHaveProperty("performer");

    const actorDecision = graphSpec();
    actorDecision.flows[0].steps[2] = {
      id: "decision",
      kind: "branch",
      title: "承認するか",
      performer: {
        kind: "actors",
        refs: [{ kind: "actor", id: "member" }],
      },
    };
    expect(isFlowStep(actorDecision.flows[0].steps[2])).toBe(false);
    expect(parseSpecYaml(stringify(actorDecision)).issues).toEqual([]);
    const diagram = renderFlow(
      actorDecision,
      "flows",
      actorDecision.flows[0].id,
    );
    const decision = Array.from(
      "承認するか",
      (c) => `#${c.codePointAt(0)};`,
    ).join("");
    const memberLane = diagram
      .split(/  subgraph f0lane\d+\[/)
      .find((part) => part.includes(`f0n2{"${decision}"}`));
    expect(memberLane).toContain("f0n1[");
    expect(memberLane).toContain("f0n3[");
    expect(diagram).toContain("f0n2 -->");
    const migrated = migrateSpecTo21(actorDecision).spec!;
    expect(parseSpecYaml(stringify(migrated)).issues).toEqual([]);
    expect(migrated.flows[0].steps[2]).toEqual(actorDecision.flows[0].steps[2]);
  });
  it("validates decision actor references and rejects non-actor performers", () => {
    const spec = graphSpec();
    spec.flows[0].steps[2] = {
      id: "decision",
      kind: "branch",
      title: "承認するか",
      performer: { kind: "actors", refs: [{ kind: "actor", id: "missing" }] },
    };
    expect(validateSpecRelations(spec)).toContainEqual(
      expect.objectContaining({
        path: "flows[0].steps[2].performer.refs[0].id",
      }),
    );
    expect(parseSpecYaml(stringify(spec)).issues).toContainEqual(
      expect.objectContaining({
        path: "flows[0].steps[2].performer.refs[0].id",
      }),
    );
    (spec.flows[0].steps[2] as any).performer = {
      kind: "externalSystem",
      id: "notification",
    };
    expect(SpecSchema.safeParse(spec).success).toBe(false);
    (spec.flows[0].steps[2] as any).performer = { kind: "actors", refs: [] };
    expect(SpecSchema.safeParse(spec).success).toBe(false);
    (spec.flows[0].steps[0] as any).performer = {
      kind: "actors",
      refs: [{ kind: "actor", id: "member" }],
    };
    expect(SpecSchema.safeParse(spec).success).toBe(false);
  });
  it("renames branch actor/term references and blocks deletion while referenced", () => {
    const spec = graphSpec();
    spec.domain.actors.push({
      id: "decision-maker",
      title: "判定者",
      description: "判定する",
    });
    spec.domain.terms.push({
      id: "decision-team",
      title: "判定チーム",
      definition: "判定担当",
      actorSet: { kind: "actor", id: "decision-maker" },
    });
    spec.flows[0].steps[2] = {
      id: "decision",
      kind: "branch",
      title: "承認するか",
      performer: {
        kind: "actors",
        refs: [
          { kind: "actor", id: "decision-maker" },
          { kind: "term", id: "decision-team" },
        ],
      },
    };
    expect(() =>
      editSpec(spec, {
        kind: "set_section",
        section: "domain",
        value: {
          ...spec.domain,
          actors: spec.domain.actors.filter((a) => a.id !== "decision-maker"),
        },
      }),
    ).toThrow();
    const renamed = renameTerm(
      renameParticipant(spec, "actor", "decision-maker", "approver"),
      "decision-team",
      "reviewers",
    );
    expect(validateSpecRelations(renamed)).toEqual([]);
    expect(renamed.flows[0].steps[2]).toMatchObject({
      performer: {
        refs: [
          { kind: "actor", id: "approver" },
          { kind: "term", id: "reviewers" },
        ],
      },
    });
    expect(spec.flows[0].steps[2]).toMatchObject({
      performer: {
        refs: [
          { kind: "actor", id: "decision-maker" },
          { kind: "term", id: "decision-team" },
        ],
      },
    });
  });
  it("allows unfinished graph connectivity while validating defined edges", () => {
    const unfinished = graphSpec();
    unfinished.flows[0].edges = [];
    expect(validateSpecRelations(unfinished)).toEqual([]);

    unfinished.flows[0].edges = [{ from: "submit", to: "decision" }];
    expect(validateSpecRelations(unfinished)).toEqual([]);
  });
  it("requires explicit edges for control nodes and enforces versioned edge IDs", () => {
    const missingEdges = graphSpec();
    delete missingEdges.flows[0].edges;
    expect(validateSpecRelations(missingEdges)).toContainEqual(
      expect.objectContaining({
        path: "flows[0].edges",
        message: "制御ノードを含むフローには edges 配列が必要です。",
      }),
    );

    const withEdges = graphSpec();
    const migrated = migrateSpecTo21(withEdges).spec!;
    expect(migrated.flows[0].edges?.every((edge) => edge.id)).toBe(true);
    expect(SpecSchema.safeParse(migrated).success).toBe(true);
    delete migrated.flows[0].edges![0].id;
    expect(SpecSchema.safeParse(migrated).success).toBe(false);

    const legacyWithEdgeIds = graphSpec();
    legacyWithEdgeIds.flows[0].edges![0].id = "not-allowed-in-2.0";
    expect(SpecSchema.safeParse(legacyWithEdgeIds).success).toBe(false);
  });
  it("rejects malformed branch exits and invalid edge endpoints", () => {
    const oneExit = graphSpec();
    oneExit.flows[0].edges = oneExit.flows[0].edges!.filter(
      (edge) => edge.from !== "decision" || edge.label === "承認",
    );
    expect(validateSpecRelations(oneExit)).toContainEqual(
      expect.objectContaining({
        path: "flows[0].steps[2]",
        message: "分岐には2つ以上の経路を指定してください。",
      }),
    );

    const unlabeled = graphSpec();
    delete unlabeled.flows[0].edges![2].label;
    expect(validateSpecRelations(unlabeled)).toContainEqual(
      expect.objectContaining({
        message: "分岐「承認するか」の経路ラベルを指定してください。",
      }),
    );

    const duplicateLabel = graphSpec();
    duplicateLabel.flows[0].edges![3].label = "差し戻し";
    expect(validateSpecRelations(duplicateLabel)).toContainEqual(
      expect.objectContaining({
        message: "分岐「承認するか」の経路ラベル「差し戻し」が重複しています。",
      }),
    );

    const missingTarget = graphSpec();
    missingTarget.flows[0].edges![0].to = "missing";
    expect(validateSpecRelations(missingTarget)).toContainEqual(
      expect.objectContaining({ path: "flows[0].edges[0].to" }),
    );

    const exitsEnd = graphSpec();
    exitsEnd.flows[0].edges!.push({ from: "end", to: "submit" });
    expect(validateSpecRelations(exitsEnd)).toContainEqual(
      expect.objectContaining({
        path: "flows[0].steps[7]",
        message: "終了ノードから出る接続は指定できません。",
      }),
    );

    const actionFanOut = graphSpec();
    actionFanOut.flows[0].edges!.push({ from: "submit", to: "end" });
    expect(validateSpecRelations(actionFanOut)).toContainEqual(
      expect.objectContaining({
        path: "flows[0].steps[1]",
        message: "複数の経路を出す場合は分岐ノードを使用してください。",
      }),
    );

    const startWithIncoming = graphSpec();
    startWithIncoming.flows[0].edges!.push({ from: "revise", to: "start" });
    expect(validateSpecRelations(startWithIncoming)).toContainEqual(
      expect.objectContaining({
        path: "flows[0].steps[0]",
        message: "開始ノードに入る接続は指定できません。",
      }),
    );

    const duplicateStart = graphSpec();
    duplicateStart.flows[0].steps.push({ id: "another-start", kind: "start" });
    expect(validateSpecRelations(duplicateStart)).toContainEqual(
      expect.objectContaining({
        path: "flows[0].steps",
        message: "開始ノードは1つだけ指定できます。",
      }),
    );
  });
  it("renders lanes, ordered handoffs, use case links and safe labels", () => {
    const spec = example();
    const diagram = renderFlow(spec, "flows", "task-intake");
    expect(diagram).toMatch(/^flowchart LR/);
    expect(renderFlow(spec, "screens")).toMatch(/^flowchart TD/);
    expect(diagram.match(/subgraph f0lane/g)).toHaveLength(4);
    for (let i = 1; i < 6; i++)
      expect(diagram).toContain(`f0s${i - 1} --> f0s${i}`);
    const encode = (s: string) =>
      Array.from(s, (c) => `#${c.codePointAt(0)};`).join("");
    expect(diagram).toContain(encode("作業の受付と登録 (task-int…)"));
    expect(diagram).toContain(encode("UC: タスクを登録する"));
    const malicious = 'end"]\nclick f0s0 "javascript:alert(1)"';
    spec.domain.actors[0].title = malicious;
    spec.flows[0].title = malicious;
    flowStep(spec).title = malicious;
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
    flowStep(spec).performer = {
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
    flowStep(spec).performer = { kind: "actors", refs: [] };
    expect(SpecSchema.safeParse(spec).success).toBe(false);
    flowStep(spec).performer = {
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
    flowStep(spec).performer = {
      kind: "actors",
      refs: [
        { kind: "actor", id: "customer" },
        { kind: "term", id: "storefront-users" },
      ],
    };
    const diagram = renderFlow(spec, "flows", "purchase");
    const encode = (s: string) =>
      Array.from(s, (c) => `#${c.codePointAt(0)};`).join("");
    expect(diagram).toContain(
      encode(
        "アクター: エンドユーザー (customer)、用語: ストア利用者 (storefro…)",
      ),
    );
    expect(diagram).toContain("f0s0 --> f0s1");
    flowStep(spec, 1).performer = {
      kind: "actors",
      refs: [
        { kind: "term", id: "storefront-users" },
        { kind: "actor", id: "customer" },
      ],
    };
    expect(
      renderFlow(spec, "flows", "purchase").match(/subgraph f0lane/g),
    ).toHaveLength(6);
  });
});
