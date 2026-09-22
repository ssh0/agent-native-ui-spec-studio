import { z } from "zod";

export const stages = [
  "domain",
  "flows",
  "useCases",
  "screens",
  "actions",
] as const;
export type SpecStage = (typeof stages)[number];
export const stageLabels: Record<SpecStage, string> = {
  domain: "データ・用語",
  flows: "業務フロー",
  useCases: "ユースケース",
  screens: "画面・状態",
  actions: "画面内アクション",
};
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
const id = z.string().min(1);
const notes = z.string().optional();
const refs = z.array(id).optional();
const Named = z.object({ id, title: id, notes });
export const DomainSchema = z.object({
  notes,
  entities: z
    .array(
      Named.extend({
        description: z.string().optional(),
        fields: z
          .array(
            z.object({
              id,
              title: id,
              type: id,
              required: z.boolean().optional(),
              entity: id.optional(),
              notes,
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  terms: z
    .array(
      z.object({ id, title: id, definition: id, entity: id.optional(), notes }),
    )
    .default([]),
});
export const FlowSchema = Named.extend({
  actor: z.string().optional(),
  goal: z.string().optional(),
  steps: z
    .array(z.object({ id, title: id, useCase: id.optional(), notes }))
    .default([]),
});
const ActionRef = z.object({ screen: id, component: id });
export const UseCaseSchema = Named.extend({
  actor: z.string().optional(),
  entities: refs,
  screens: refs,
  preconditions: z.array(z.string()).optional(),
  postconditions: z.array(z.string()).optional(),
  steps: z
    .array(
      z.object({
        id,
        title: id,
        screen: id.optional(),
        action: ActionRef.optional(),
        notes,
      }),
    )
    .default([]),
  branches: z
    .array(
      z.object({
        id,
        kind: z.enum(["alternate", "exception"]),
        from: id,
        condition: id,
        outcome: id,
        resumeAt: id.optional(),
        screen: id.optional(),
        notes,
      }),
    )
    .default([]),
});
export const ComponentSchema = z
  .object({
    type: z.enum(componentTypes),
    id,
    label: z.string().optional(),
    content: z.string().optional(),
    action: z.string().optional(),
    placeholder: z.string().optional(),
    src: z.string().optional(),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    useCases: refs,
    precondition: z.string().optional(),
    outcome: z.string().optional(),
    notes,
  })
  .passthrough();
export const ScreenSchema = Named.extend({
  description: z.string().optional(),
  entities: refs,
  useCases: refs,
  components: z.array(ComponentSchema).default([]),
  stateFlow: z
    .object({
      notes,
      initial: id,
      states: z.array(Named).min(1),
      transitions: z
        .array(
          z.object({
            from: id,
            to: id,
            trigger: id,
            component: id.optional(),
            notes,
          }),
        )
        .default([]),
    })
    .optional(),
});
export const TransitionSchema = z.object({
  from: id,
  to: id,
  trigger: id,
  notes,
});
export const SpecSchema = z.object({
  version: z.enum(["1.0", "1.1"]).default("1.0"),
  title: id,
  notes,
  domain: DomainSchema.optional(),
  flows: z.array(FlowSchema).optional(),
  useCases: z.array(UseCaseSchema).optional(),
  screens: z.array(ScreenSchema).min(1),
  transitions: z.array(TransitionSchema).default([]),
});
export type UiSpec = z.infer<typeof SpecSchema>;
export type UiComponent = z.infer<typeof ComponentSchema>;
export type ValidationIssue = { path: string; message: string };
export type ReviewEntry = {
  id: string;
  status: "approved" | "changes_requested";
  comment: string;
  stage: SpecStage;
  createdAt: string;
  documentHash: string;
};

export function validateSpecRelations(spec: UiSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const unique = (items: { id: string }[], path: string) => {
    const seen = new Set<string>();
    items.forEach((item, i) => {
      if (seen.has(item.id))
        issues.push({
          path: `${path}[${i}].id`,
          message: `ID「${item.id}」が重複しています。`,
        });
      seen.add(item.id);
    });
    return seen;
  };
  const ref = (value: string | undefined, ids: Set<string>, path: string) => {
    if (value !== undefined && !ids.has(value))
      issues.push({ path, message: `参照先「${value}」が存在しません。` });
  };
  const many = (values: string[] | undefined, ids: Set<string>, path: string) =>
    values?.forEach((v, i) => ref(v, ids, `${path}[${i}]`));
  const screenIds = unique(spec.screens, "screens");
  const entities = unique(spec.domain?.entities ?? [], "domain.entities");
  const cases = unique(spec.useCases ?? [], "useCases");
  unique(spec.domain?.terms ?? [], "domain.terms");
  unique(spec.flows ?? [], "flows");
  spec.domain?.entities.forEach((entity, i) => {
    unique(entity.fields, `domain.entities[${i}].fields`);
    entity.fields.forEach((field, j) =>
      ref(field.entity, entities, `domain.entities[${i}].fields[${j}].entity`),
    );
  });
  spec.domain?.terms.forEach((term, i) =>
    ref(term.entity, entities, `domain.terms[${i}].entity`),
  );
  spec.flows?.forEach((flow, i) => {
    unique(flow.steps, `flows[${i}].steps`);
    flow.steps.forEach((step, j) =>
      ref(step.useCase, cases, `flows[${i}].steps[${j}].useCase`),
    );
  });
  spec.useCases?.forEach((useCase, i) => {
    const path = `useCases[${i}]`;
    many(useCase.entities, entities, `${path}.entities`);
    many(useCase.screens, screenIds, `${path}.screens`);
    const stepIds = unique(useCase.steps, `${path}.steps`);
    unique(useCase.branches, `${path}.branches`);
    useCase.steps.forEach((step, j) => {
      ref(step.screen, screenIds, `${path}.steps[${j}].screen`);
      if (step.action) {
        ref(step.action.screen, screenIds, `${path}.steps[${j}].action.screen`);
        const component = spec.screens
          .find((s) => s.id === step.action?.screen)
          ?.components.find((c) => c.id === step.action?.component);
        if (!component?.action)
          issues.push({
            path: `${path}.steps[${j}].action.component`,
            message: `アクション付き部品「${step.action.component}」が参照先画面に存在しません。`,
          });
      }
    });
    useCase.branches.forEach((branch, j) => {
      ref(branch.from, stepIds, `${path}.branches[${j}].from`);
      ref(branch.resumeAt, stepIds, `${path}.branches[${j}].resumeAt`);
      ref(branch.screen, screenIds, `${path}.branches[${j}].screen`);
    });
  });
  spec.screens.forEach((screen, i) => {
    const path = `screens[${i}]`;
    const components = unique(screen.components, `${path}.components`);
    many(screen.entities, entities, `${path}.entities`);
    many(screen.useCases, cases, `${path}.useCases`);
    screen.components.forEach((c, j) =>
      many(c.useCases, cases, `${path}.components[${j}].useCases`),
    );
    if (screen.stateFlow) {
      const states = unique(
        screen.stateFlow.states,
        `${path}.stateFlow.states`,
      );
      ref(screen.stateFlow.initial, states, `${path}.stateFlow.initial`);
      screen.stateFlow.transitions.forEach((t, j) => {
        ref(t.from, states, `${path}.stateFlow.transitions[${j}].from`);
        ref(t.to, states, `${path}.stateFlow.transitions[${j}].to`);
        ref(
          t.component,
          components,
          `${path}.stateFlow.transitions[${j}].component`,
        );
      });
    }
  });
  spec.transitions.forEach((t, i) => {
    ref(t.from, screenIds, `transitions[${i}].from`);
    ref(t.to, screenIds, `transitions[${i}].to`);
  });
  return issues;
}
export function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "spec",
    message: `形式を確認してください: ${issue.message}`,
  }));
}
