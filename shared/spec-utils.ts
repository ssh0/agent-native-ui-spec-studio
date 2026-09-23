import YAML from "yaml";

import {
  formatZodIssues,
  SpecSchema,
  validateSpecRelations,
  type UiSpec,
  type ActorRef,
  type ValidationIssue,
} from "./spec-schema.js";

export function actorRefTitle(spec: UiSpec, ref: ActorRef): string {
  return (
    (ref.kind === "actor" ? spec.domain.actors : spec.domain.terms).find(
      (item) => item.id === ref.id,
    )?.title ?? ref.id
  );
}
export function performerTitle(
  spec: UiSpec,
  performer: UiSpec["flows"][number]["steps"][number]["performer"],
): string {
  return performer.kind === "externalSystem"
    ? `外部システム: ${spec.domain.externalSystems.find((item) => item.id === performer.id)?.title ?? performer.id}`
    : `アクター: ${performer.refs.map((ref) => actorRefTitle(spec, ref)).join("、")}`;
}
function performerKey(
  performer: UiSpec["flows"][number]["steps"][number]["performer"],
): string {
  return performer.kind === "externalSystem"
    ? `externalSystem:${performer.id}`
    : `actors:${performer.refs
        .map((ref) => `${ref.kind}:${ref.id}`)
        .sort()
        .join("|")}`;
}

export type ParsedSpec = {
  spec?: UiSpec;
  issues: ValidationIssue[];
};

export function parseSpecYaml(yaml: string): ParsedSpec {
  let value: unknown;
  try {
    value = YAML.parse(yaml);
  } catch (error) {
    return {
      issues: [
        {
          path: "yaml",
          message:
            error instanceof Error
              ? `YAMLの構文を確認してください。\n${error.message}`
              : "YAMLの構文を確認してください。",
        },
      ],
    };
  }

  const result = SpecSchema.safeParse(value);
  if (!result.success) {
    return { issues: formatZodIssues(result.error) };
  }

  return {
    spec: result.data,
    issues: validateSpecRelations(result.data),
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

function componentText(
  component: UiSpec["screens"][number]["components"][number],
): string {
  return (
    component.label ??
    component.content ??
    component.placeholder ??
    component.type
  );
}

export function renderWireframe(spec: UiSpec): string {
  const screens = spec.screens
    .map(
      (screen) => `
<section class="wireframe-screen" data-screen-id="${escapeHtml(screen.id)}">
  <header class="wireframe-screen__header">
    <span class="wireframe-screen__id">${escapeHtml(screen.id)}</span>
    <h2>${escapeHtml(screen.title)}</h2>
    ${screen.description ? `<p>${escapeHtml(screen.description)}</p>` : ""}
  </header>
  <div class="wireframe-screen__body">
    ${screen.components
      .map((component) => {
        const text = escapeHtml(componentText(component));
        const id = escapeHtml(component.id);
        switch (component.type) {
          case "button":
          case "link":
            return `<div class="wireframe-control wireframe-${component.type}" data-component-id="${id}">↳ ${text}</div>`;
          case "input":
            return `<div class="wireframe-field" data-component-id="${id}"><label>${text}</label><div class="wireframe-input">${escapeHtml(component.placeholder ?? "値を入力")}</div></div>`;
          case "image":
            return `<div class="wireframe-image" data-component-id="${id}">▧ ${text}</div>`;
          case "toggle":
            return `<div class="wireframe-toggle" data-component-id="${id}"><span class="wireframe-toggle__track"></span>${text}</div>`;
          case "divider":
            return `<hr data-component-id="${id}" />`;
          default:
            return `<div class="wireframe-block wireframe-${component.type}" data-component-id="${id}">${text}</div>`;
        }
      })
      .join("\n    ")}
  </div>
</section>`,
    )
    .join("\n");

  return `<div class="wireframe" data-spec-title="${escapeHtml(spec.title)}">
  <div class="wireframe__title"><span>ワイヤーフレーム</span><strong>${escapeHtml(spec.title)}</strong></div>
  <div class="wireframe__screens">${screens}</div>
</div>`;
}

// Generate node identifiers separately from user IDs; encode every label as Mermaid entities.
function mermaidLabel(value: string): string {
  return Array.from(value, (char) => `#${char.codePointAt(0)};`).join("");
}
export type FlowKind = "flows" | "screens" | "useCases" | "states";
export function renderFlow(
  spec: UiSpec,
  kind: FlowKind = "screens",
  selectedId?: string,
): string {
  const lines = ["flowchart TD"];
  const label = mermaidLabel;
  if (kind === "flows") {
    const flows = selectedId
      ? spec.flows.filter((f) => f.id === selectedId)
      : spec.flows;
    flows.forEach((flow, i) => {
      if (!flow.steps.length) return;
      lines.push(`  subgraph f${i}["${label(flow.title)}"]`);
      const participants = Array.from(
        new Map(
          flow.steps.map((step) => [
            performerKey(step.performer),
            step.performer,
          ]),
        ).values(),
      );
      participants.forEach((p, lane) => {
        const steps = flow.steps
          .map((step, index) => ({ step, index }))
          .filter(
            ({ step }) => performerKey(step.performer) === performerKey(p),
          );
        if (!steps.length) return;
        lines.push(
          `  subgraph f${i}lane${lane}["${label(performerTitle(spec, p))}"]`,
        );
        steps.forEach(({ step, index }) => {
          const useCase = spec.useCases.find((u) => u.id === step.useCase);
          const title = `${index + 1}. ${step.title}${useCase ? ` / UC: ${useCase.title}` : ""}`;
          lines.push(`  f${i}s${index}["${label(title)}"]`);
        });
        lines.push("  end");
      });
      flow.steps.forEach((_, j) => {
        if (j) lines.push(`  f${i}s${j - 1} --> f${i}s${j}`);
      });
      lines.push("  end");
    });
  } else if (kind === "screens") {
    const ids = new Map(spec.screens.map((s, i) => [s.id, `s${i}`]));
    spec.screens.forEach((s) =>
      lines.push(`  ${ids.get(s.id)}["${label(s.title)}"]`),
    );
    spec.transitions.forEach((t) =>
      lines.push(
        `  ${ids.get(t.from)} -->|"${label(t.trigger)}"| ${ids.get(t.to)}`,
      ),
    );
  } else if (kind === "states") {
    const screen = selectedId
      ? spec.screens.find((s) => s.id === selectedId)
      : spec.screens[0];
    const flow = screen?.stateFlow;
    if (flow && flow.states.length && flow.initial !== null) {
      const ids = new Map(flow.states.map((s, i) => [s.id, `s${i}`]));
      lines.push(`  start(("${label("開始")}")) --> ${ids.get(flow.initial)}`);
      flow.states.forEach((s) =>
        lines.push(`  ${ids.get(s.id)}["${label(s.title)}"]`),
      );
      flow.transitions.forEach((t) =>
        lines.push(
          `  ${ids.get(t.from)} -->|"${label(t.trigger)}"| ${ids.get(t.to)}`,
        ),
      );
    }
  } else {
    const useCases = selectedId
      ? spec.useCases.filter((u) => u.id === selectedId)
      : spec.useCases;
    useCases.forEach((u, i) => {
      if (!u.steps.length) return;
      lines.push(`  subgraph uc${i}["${label(u.title)}"]`);
      const ids = new Map(u.steps.map((s, j) => [s.id, `u${i}s${j}`]));
      u.steps.forEach((s, j) => {
        lines.push(`  ${ids.get(s.id)}["${label(s.title)}"]`);
        if (j) lines.push(`  u${i}s${j - 1} --> u${i}s${j}`);
      });
      u.branches.forEach((b, j) => {
        lines.push(
          `  u${i}b${j}{"${label((b.kind === "exception" ? "例外: " : "分岐: ") + b.condition)}"}`,
        );
        lines.push(
          `  ${ids.get(b.from)} -.-> u${i}b${j} --> u${i}o${j}["${label(b.outcome)}"]`,
        );
        if (b.resumeAt) lines.push(`  u${i}o${j} --> ${ids.get(b.resumeAt)}`);
      });
      lines.push("  end");
    });
  }
  return lines.length === 1 ? "" : lines.join("\n");
}
