import type { UiSpec, SpecStage } from "./spec-schema.js";

export type SpecTarget = { key: string; kind: string; id: string; parentId?: string; title: string; stage: SpecStage; value: unknown };
const key = (...parts: string[]) => JSON.stringify(parts);

/** Stable, scoped IDs from the saved model. 2.0 transitions have no stable IDs. */
export function specTargets(spec: UiSpec): SpecTarget[] {
  const result: SpecTarget[] = [{ key: key("document"), kind: "document", id: "document", title: spec.title, stage: "domain", value: { version: spec.version, title: spec.title, notes: spec.notes, domainNotes: spec.domain.notes, order: {
    actors: spec.domain.actors.map((item) => item.id), externalSystems: spec.domain.externalSystems.map((item) => item.id), entities: spec.domain.entities.map((item) => item.id), relations: spec.domain.relations.map((item) => item.id), terms: spec.domain.terms.map((item) => item.id), flows: spec.flows.map((item) => item.id), useCases: spec.useCases.map((item) => item.id), screens: spec.screens.map((item) => item.id), transitions: spec.transitions.map((item) => item.id ?? null),
  } } }];
  const add = (kind: string, id: string, title: string, stage: SpecStage, value: unknown, parentId?: string) =>
    result.push({ key: key(kind, ...(parentId ? [parentId] : []), id), kind, id, parentId, title, stage, value });
  for (const kind of ["actors", "externalSystems", "entities", "relations", "terms"] as const) {
    for (const item of spec.domain[kind]) {
      const { fields, ...parent } = item as typeof item & { fields?: unknown };
      add(kind, item.id, item.title, "domain", kind === "entities" ? { ...parent, fieldOrder: (item as UiSpec["domain"]["entities"][number]).fields.map((field) => field.id) } : parent);
      if (kind === "entities") for (const field of (item as UiSpec["domain"]["entities"][number]).fields)
        add("field", field.id, field.title, "domain", field, item.id);
    }
  }
  for (const flow of spec.flows) {
    const { steps, ...parent } = flow;
    add("flow", flow.id, flow.title, "flows", { ...parent, stepOrder: steps.map((item) => item.id) });
    for (const step of steps) add("flowStep", step.id, step.title, "flows", step, flow.id);
  }
  for (const useCase of spec.useCases) {
    const { steps, branches, ...parent } = useCase;
    add("useCase", useCase.id, useCase.title, "useCases", { ...parent, stepOrder: steps.map((item) => item.id), branchOrder: branches.map((item) => item.id) });
    for (const step of steps) add("useCaseStep", step.id, step.title, "useCases", step, useCase.id);
    for (const branch of branches) add("branch", branch.id, branch.condition, "useCases", branch, useCase.id);
  }
  for (const screen of spec.screens) {
    const { components, stateFlow, ...parent } = screen;
    add("screen", screen.id, screen.title, "screens", { ...parent, initial: stateFlow.initial, notes: stateFlow.notes, componentOrder: components.map((item) => item.id), stateOrder: stateFlow.states.map((item) => item.id), stateTransitionOrder: stateFlow.transitions.map((item) => item.id ?? null) });
    for (const component of components) add("component", component.id, component.label || component.action || component.id, "actions", component, screen.id);
    for (const state of stateFlow.states) add("state", state.id, state.title, "screens", state, screen.id);
    for (const transition of stateFlow.transitions) if (transition.id)
      add("stateTransition", transition.id, transition.trigger, "screens", transition, screen.id);
  }
  for (const transition of spec.transitions) if (transition.id)
    add("transition", transition.id, transition.trigger, "screens", transition);
  return result;
}

export function diffSpecVersions(before: UiSpec, after: UiSpec) {
  const left = new Map(specTargets(before).map((target) => [target.key, target]));
  const right = new Map(specTargets(after).map((target) => [target.key, target]));
  const changes: { change: "added" | "removed" | "changed"; target: SpecTarget }[] = [];
  for (const [id, target] of left) {
    const next = right.get(id);
    if (!next) changes.push({ change: "removed", target });
    else if (JSON.stringify(target.value) !== JSON.stringify(next.value)) changes.push({ change: "changed", target: next });
  }
  for (const [id, target] of right) if (!left.has(id)) changes.push({ change: "added", target });
  return changes;
}
