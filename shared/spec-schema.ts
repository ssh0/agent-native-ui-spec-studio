import { z } from "zod";

export const componentTypes = [
  "button",
  "text",
  "input",
  "image",
  "toggle",
  "select",
  "link",
  "card",
  "list",
  "divider",
  "navigation",
] as const;

const ComponentSchema = z
  .object({
    type: z.enum(componentTypes),
    id: z.string().min(1),
    label: z.string().optional(),
    content: z.string().optional(),
    action: z.string().optional(),
    placeholder: z.string().optional(),
    src: z.string().optional(),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ScreenSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  components: z.array(ComponentSchema).default([]),
});

export const SpecSchema = z.object({
  version: z.string().default("1.0"),
  title: z.string().min(1),
  screens: z.array(ScreenSchema).min(1),
  transitions: z
    .array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        trigger: z.string().min(1),
      }),
    )
    .default([]),
});

export type UiSpec = z.infer<typeof SpecSchema>;
export type UiComponent = UiSpec["screens"][number]["components"][number];

export type ValidationIssue = {
  path: string;
  message: string;
};

export function validateSpecRelations(spec: UiSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  spec.screens.forEach((screen, screenIndex) => {
    if (seen.has(screen.id)) {
      issues.push({
        path: `screens[${screenIndex}].id`,
        message: `Screen id "${screen.id}" is duplicated.`,
      });
    }
    seen.add(screen.id);

    const componentIds = new Set<string>();
    screen.components.forEach((component, componentIndex) => {
      const path = `screens[${screenIndex}].components[${componentIndex}].id`;
      if (componentIds.has(component.id)) {
        issues.push({
          path,
          message: `Component id "${component.id}" is duplicated on this screen.`,
        });
      }
      componentIds.add(component.id);
    });
  });

  const screenIds = new Set(spec.screens.map((screen) => screen.id));
  spec.transitions.forEach((transition, index) => {
    if (!screenIds.has(transition.from)) {
      issues.push({
        path: `transitions[${index}].from`,
        message: `Transition source "${transition.from}" does not exist.`,
      });
    }
    if (!screenIds.has(transition.to)) {
      issues.push({
        path: `transitions[${index}].to`,
        message: `Transition destination "${transition.to}" does not exist.`,
      });
    }
  });

  return issues;
}

export function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "spec",
    message: issue.message,
  }));
}
