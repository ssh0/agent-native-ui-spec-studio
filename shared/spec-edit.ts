import { z } from "zod";

import {
  type ActorRef,
  SpecSchema,
  validateSpecRelations,
  type UiSpec,
} from "./spec-schema.js";

export const EditOperationSchema = z.object({
  kind: z.enum([
    "set_section",
    "add_screen",
    "update_screen",
    "delete_screen",
    "add_component",
    "update_component",
    "delete_component",
    "add_transition",
    "update_transition",
    "delete_transition",
  ]),
  section: z
    .enum(["domain", "flows", "useCases"])
    .optional()
    .describe("Section replaced by set_section"),
  value: z
    .unknown()
    .optional()
    .describe(
      "Complete section value; validated with the specification schema",
    ),
  screenId: z.string().optional(),
  nextScreenId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  screen: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Screen patch including entities, useCases, stateFlow or notes"),
  componentId: z.string().optional(),
  component: z.record(z.string(), z.unknown()).optional(),
  transitionId: z.string().optional().describe("Stable transition ID in specification 2.1"),
  transition: z.record(z.string(), z.unknown()).optional(),
});
export function renameScreen(spec: UiSpec, from: string, to: string): UiSpec {
  return {
    ...spec,
    screens: spec.screens.map((s) => (s.id === from ? { ...s, id: to } : s)),
    transitions: spec.transitions.map((t) => ({
      ...t,
      from: t.from === from ? to : t.from,
      to: t.to === from ? to : t.to,
    })),
    useCases: spec.useCases.map((u) => ({
      ...u,
      screens: u.screens.map((s) => (s === from ? to : s)),
      steps: u.steps.map((s) => ({
        ...s,
        screen: s.screen === from ? to : s.screen,
        action: s.action
          ? {
              ...s.action,
              screen: s.action.screen === from ? to : s.action.screen,
            }
          : undefined,
      })),
      branches: u.branches.map((b) => ({
        ...b,
        screen: b.screen === from ? to : b.screen,
      })),
    })),
  };
}
export function editSpec(
  original: UiSpec,
  input: z.infer<typeof EditOperationSchema>,
): UiSpec {
  let spec = structuredClone(original);
  const screen = spec.screens.find((s) => s.id === input.screenId);
  if (input.kind === "set_section") {
    if (!input.section || input.value === undefined)
      throw new Error("section と value が必要です。");
    spec = SpecSchema.parse({ ...spec, [input.section]: input.value });
  } else if (input.kind === "add_screen") {
    if (!input.screenId || !input.title)
      throw new Error("screenId と title が必要です。");
    spec.screens.push({
      id: input.screenId,
      title: input.title,
      description: input.description,
      entities: [],
      useCases: [],
      stateFlow: { initial: null, states: [], transitions: [] },
      components: [],
    });
  } else if (input.kind.includes("transition")) {
    if (spec.version !== "2.1") throw new Error("遷移を編集する前に仕様を 2.1 に移行してください。");
    const i = spec.transitions.findIndex((transition) => transition.id === input.transitionId);
    if (input.kind === "add_transition") {
      if (!input.transition) throw new Error("transition が必要です。");
      if (typeof input.transition.id !== "string" || !input.transition.id)
        throw new Error("遷移の id が必要です。");
      spec.transitions.push(input.transition as UiSpec["transitions"][number]);
    } else {
      if (!spec.transitions[i]) throw new Error("遷移が見つかりません。");
      if (input.kind === "delete_transition") spec.transitions.splice(i, 1);
      else Object.assign(spec.transitions[i], input.transition ?? {});
    }
  } else {
    if (!screen) throw new Error(`画面が見つかりません: ${input.screenId}`);
    if (input.kind === "update_screen") {
      const nextId =
        input.nextScreenId ??
        (typeof input.screen?.id === "string" ? input.screen.id : screen.id);
      Object.assign(screen, input.screen ?? {}, { id: screen.id });
      if (input.title !== undefined) screen.title = input.title;
      if (input.description !== undefined)
        screen.description = input.description;
      spec = renameScreen(spec, screen.id, nextId);
    } else if (input.kind === "delete_screen") {
      spec.screens = spec.screens.filter((s) => s.id !== screen.id);
      spec.transitions = spec.transitions.filter(
        (t) => t.from !== screen.id && t.to !== screen.id,
      );
    } else {
      const i = screen.components.findIndex((c) => c.id === input.componentId);
      if (input.kind === "add_component") {
        if (!input.component) throw new Error("component が必要です。");
        screen.components.push(
          input.component as (typeof screen.components)[number],
        );
      } else {
        if (i < 0) throw new Error("部品が見つかりません。");
        if (input.kind === "delete_component") screen.components.splice(i, 1);
        else Object.assign(screen.components[i], input.component ?? {});
      }
    }
  }
  spec = SpecSchema.parse(spec);
  const issues = validateSpecRelations(spec);
  if (issues.length)
    throw new Error(issues.map((i) => `${i.path}: ${i.message}`).join("\n"));
  return spec;
}

/** Rename a typed participant and every business-step reference to it. */
export function renameParticipant(
  spec: UiSpec,
  kind: "actor" | "externalSystem",
  from: string,
  to: string,
): UiSpec {
  const section = kind === "actor" ? "actors" : "externalSystems";
  const renameRef = (ref: ActorRef): ActorRef =>
    kind === "actor" && ref.kind === "actor" && ref.id === from
      ? { ...ref, id: to }
      : ref;
  const renameSet = (
    set: NonNullable<UiSpec["domain"]["terms"][number]["actorSet"]>,
  ): typeof set =>
    "op" in set
      ? { ...set, operands: set.operands.map(renameSet) }
      : renameRef(set);
  return {
    ...spec,
    domain: {
      ...spec.domain,
      [section]: spec.domain[section].map((p) =>
        p.id === from ? { ...p, id: to } : p,
      ),
      terms: spec.domain.terms.map((term) => ({
        ...term,
        actorSet: term.actorSet ? renameSet(term.actorSet) : undefined,
      })),
    },
    flows: spec.flows.map((flow) => ({
      ...flow,
      steps: flow.steps.map((step) => ({
        ...step,
        performer:
          step.performer.kind === "actors"
            ? { ...step.performer, refs: step.performer.refs.map(renameRef) }
            : kind === "externalSystem" && step.performer.id === from
              ? { ...step.performer, id: to }
              : step.performer,
      })),
    })),
    useCases: spec.useCases.map((useCase) => ({
      ...useCase,
      actors: useCase.actors.map(renameRef),
    })),
  };
}

export function renameTerm(spec: UiSpec, from: string, to: string): UiSpec {
  const renameRef = (ref: ActorRef): ActorRef =>
    ref.kind === "term" && ref.id === from ? { ...ref, id: to } : ref;
  const renameSet = (
    set: NonNullable<UiSpec["domain"]["terms"][number]["actorSet"]>,
  ): typeof set =>
    "op" in set
      ? { ...set, operands: set.operands.map(renameSet) }
      : renameRef(set);
  const renameEntitySet = (
    set: NonNullable<UiSpec["domain"]["terms"][number]["entitySet"]>,
  ): typeof set =>
    "op" in set
      ? { ...set, operands: set.operands.map(renameEntitySet) }
      : set.kind === "term" && set.id === from
        ? { ...set, id: to }
        : set;
  return {
    ...spec,
    domain: {
      ...spec.domain,
      terms: spec.domain.terms.map((t) => ({
        ...t,
        id: t.id === from ? to : t.id,
        actorSet: t.actorSet ? renameSet(t.actorSet) : undefined,
        entitySet: t.entitySet ? renameEntitySet(t.entitySet) : undefined,
      })),
    },
    flows: spec.flows.map((f) => ({
      ...f,
      steps: f.steps.map((s) => ({
        ...s,
        performer:
          s.performer.kind === "actors"
            ? { ...s.performer, refs: s.performer.refs.map(renameRef) }
            : s.performer,
      })),
    })),
    useCases: spec.useCases.map((u) => ({
      ...u,
      actors: u.actors.map(renameRef),
    })),
  };
}

export function renameEntity(spec: UiSpec, from: string, to: string): UiSpec {
  const replace = (id: string) => (id === from ? to : id);
  const renameSet = (
    set: NonNullable<UiSpec["domain"]["terms"][number]["entitySet"]>,
  ): typeof set =>
    "op" in set
      ? { ...set, operands: set.operands.map(renameSet) }
      : set.kind === "entity"
        ? { ...set, id: replace(set.id) }
        : set;
  return {
    ...spec,
    domain: {
      ...spec.domain,
      entities: spec.domain.entities.map((e) => ({
        ...e,
        id: replace(e.id),
        extends: e.extends.map(replace),
      })),
      relations: spec.domain.relations.map((r) => ({
        ...r,
        from: {
          ...r.from,
          entity: { ...r.from.entity, id: replace(r.from.entity.id) },
        },
        to: {
          ...r.to,
          entity: { ...r.to.entity, id: replace(r.to.entity.id) },
        },
      })),
      terms: spec.domain.terms.map((t) => ({
        ...t,
        entity: t.entity ? replace(t.entity) : undefined,
        entitySet: t.entitySet ? renameSet(t.entitySet) : undefined,
      })),
    },
    useCases: spec.useCases.map((u) => ({
      ...u,
      entities: u.entities.map(replace),
    })),
    screens: spec.screens.map((s) => ({
      ...s,
      entities: s.entities.map(replace),
    })),
  };
}
