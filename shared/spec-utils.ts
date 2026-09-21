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
            return `<div class="wireframe-field" data-component-id="${id}"><label>${text}</label><div class="wireframe-input">${escapeHtml(component.placeholder ?? "Enter value")}</div></div>`;
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
  <div class="wireframe__title"><span>WIREFRAME</span><strong>${escapeHtml(spec.title)}</strong></div>
  <div class="wireframe__screens">${screens}</div>
</div>`;
}

export function renderFlow(spec: UiSpec): string {
  const lines = ["flowchart TD"];
  for (const screen of spec.screens) {
    lines.push(`  ${screen.id}["${screen.title.replace(/"/g, "'")}"]`);
  }
  for (const transition of spec.transitions) {
    lines.push(
      `  ${transition.from} -->|"${transition.trigger.replace(/"/g, "'")}"| ${transition.to}`,
    );
  }
  return lines.join("\n");
}
