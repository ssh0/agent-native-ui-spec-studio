import type { UiSpec } from "./spec-schema.js";

/** Read-only projections. Every value comes directly from the saved specification. */
export function generateSpecLists(spec: UiSpec) {
  return {
    version: spec.version,
    screens: spec.screens.map((screen) => ({
      id: screen.id,
      title: screen.title,
      ...(screen.description !== undefined && { description: screen.description }),
      ...(screen.notes !== undefined && { notes: screen.notes }),
      entities: [...screen.entities],
      useCases: [...screen.useCases],
    })),
    items: spec.screens.flatMap((screen) => screen.components.map((component) => ({
      screenId: screen.id,
      id: component.id,
      type: component.type,
      ...(component.label !== undefined && { label: component.label }),
      ...(component.content !== undefined && { content: component.content }),
      ...(component.placeholder !== undefined && { placeholder: component.placeholder }),
      ...(component.src !== undefined && { src: component.src }),
      ...(component.options !== undefined && { options: [...component.options] }),
      ...(component.required !== undefined && { required: component.required }),
      ...(component.action !== undefined && { action: component.action }),
      ...(component.precondition !== undefined && { precondition: component.precondition }),
      ...(component.outcome !== undefined && { outcome: component.outcome }),
      ...(component.useCases !== undefined && { useCases: [...component.useCases] }),
      ...(component.notes !== undefined && { notes: component.notes }),
      ...(component.props !== undefined && { props: structuredClone(component.props) }),
    }))),
  };
}
