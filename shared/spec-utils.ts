import YAML from "yaml";

import {
  formatZodIssues,
  SpecSchema,
  validateSpecRelations,
  type UiSpec,
  type ActorRef,
  type ValidationIssue,
} from "./spec-schema.js";

export type NamedReference = {
  id: string;
  title?: string;
};

export function resolveNamedReference(
  items: readonly { id: string; title: string }[],
  id: string,
): NamedReference {
  const item = items.find((candidate) => candidate.id === id);
  return { id, title: item?.title };
}

export function shortReferenceId(
  id: string,
  candidateIds: readonly string[] = [],
): string {
  const otherIds = Array.from(new Set(candidateIds)).filter(
    (candidate) => candidate !== id,
  );
  let length = Math.min(id.length, 8);
  while (
    length < id.length &&
    otherIds.some((candidate) => candidate.startsWith(id.slice(0, length)))
  ) {
    length += 1;
  }
  return length < id.length ? `${id.slice(0, length)}…` : id;
}

export function formatReferenceLabel(
  reference: NamedReference,
  candidateIds: readonly string[] = [],
): string {
  return `${reference.title ?? "未解決"} (${shortReferenceId(reference.id, candidateIds)})`;
}

export function actorRefTitle(spec: UiSpec, ref: ActorRef): string {
  const items = ref.kind === "actor" ? spec.domain.actors : spec.domain.terms;
  return formatReferenceLabel(
    resolveNamedReference(items, ref.id),
    items.map((item) => item.id),
  );
}
export function performerTitle(
  spec: UiSpec,
  performer: UiSpec["flows"][number]["steps"][number]["performer"],
): string {
  if (performer.kind === "externalSystem") {
    const systems = spec.domain.externalSystems;
    return `外部システム: ${formatReferenceLabel(
      resolveNamedReference(systems, performer.id),
      systems.map((system) => system.id),
    )}`;
  }
  return performer.refs
    .map(
      (ref) =>
        `${ref.kind === "term" ? "用語" : "アクター"}: ${actorRefTitle(spec, ref)}`,
    )
    .join("、");
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

export function renderWireframe(
  spec: UiSpec,
  candidateScreenIds: readonly string[] = spec.screens.map(
    (screen) => screen.id,
  ),
): string {
  const screens = spec.screens
    .map(
      (screen) => `
<section class="wireframe-screen" data-screen-id="${escapeHtml(screen.id)}">
  <header class="wireframe-screen__header">
    <h2>${escapeHtml(screen.title)}</h2>
    <span class="wireframe-screen__id" title="ID: ${escapeHtml(screen.id)}" aria-label="ID: ${escapeHtml(screen.id)}">${escapeHtml(shortReferenceId(screen.id, candidateScreenIds))}</span>
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
      lines.push(
        `  subgraph f${i}["${label(
          formatReferenceLabel(
            resolveNamedReference(spec.flows, flow.id),
            spec.flows.map((item) => item.id),
          ),
        )}"]`,
      );
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
          const useCaseLabel = step.useCase
            ? ` / UC: ${formatReferenceLabel(
                resolveNamedReference(spec.useCases, step.useCase),
                spec.useCases.map((item) => item.id),
              )}`
            : "";
          const title = `${index + 1}. ${step.title}${useCaseLabel}`;
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
      lines.push(
        `  ${ids.get(s.id)}["${label(
          formatReferenceLabel(
            resolveNamedReference(spec.screens, s.id),
            spec.screens.map((item) => item.id),
          ),
        )}"]`,
      ),
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
      lines.push(
        `  subgraph uc${i}["${label(
          formatReferenceLabel(
            resolveNamedReference(spec.useCases, u.id),
            spec.useCases.map((item) => item.id),
          ),
        )}"]`,
      );
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
