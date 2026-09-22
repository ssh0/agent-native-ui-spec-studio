import YAML from "yaml";

import {
  formatZodIssues,
  SpecSchema,
  validateSpecRelations,
  type UiSpec,
  type ValidationIssue,
} from "./spec-schema.js";

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
            error instanceof Error ? error.message : "Invalid YAML syntax.",
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
export type FlowKind = "screens" | "useCases" | "states";
export function renderFlow(
  spec: UiSpec,
  kind: FlowKind = "screens",
  selectedId?: string,
): string {
  const lines = ["flowchart TD"];
  const label = mermaidLabel;
  if (kind === "screens") {
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
    const screen =
      spec.screens.find((s) => s.id === selectedId) ?? spec.screens[0];
    if (screen?.stateFlow) {
      const flow = screen.stateFlow;
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
      ? spec.useCases?.filter((u) => u.id === selectedId)
      : spec.useCases;
    useCases?.forEach((u, i) => {
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
