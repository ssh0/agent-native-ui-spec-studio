import { z } from "zod";

export const stages = [
  "domain",
  "flows",
  "useCases",
  "screens",
  "actions",
] as const;
export type SpecStage = (typeof stages)[number];
export const domainSections = [
  "entities",
  "terms",
  "actors",
  "externalSystems",
] as const;
export type DomainSection = (typeof domainSections)[number];
export const domainSectionLabels: Record<DomainSection, string> = {
  entities: "エンティティ",
  terms: "用語",
  actors: "アクター",
  externalSystems: "外部システム",
};
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
const refs = z.array(id);
const Named = z.strictObject({ id, title: id, notes });
export const ParticipantSchema = Named.extend({ description: id });
export const PerformerSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("actor"), id }),
  z.strictObject({ kind: z.literal("externalSystem"), id }),
]);
export const DomainSchema = z.strictObject({
  notes,
  actors: z.array(ParticipantSchema),
  externalSystems: z.array(ParticipantSchema),
  entities: z.array(
    Named.extend({
      description: z.string().optional(),
      fields: z.array(
        z.strictObject({
          id,
          title: id,
          type: id,
          required: z.boolean().optional(),
          entity: id.optional(),
          notes,
        }),
      ),
    }),
  ),
  terms: z.array(
    z.strictObject({
      id,
      title: id,
      definition: id,
      entity: id.optional(),
      notes,
    }),
  ),
});
export const FlowSchema = Named.extend({
  goal: z.string().optional(),
  steps: z.array(
    z.strictObject({
      id,
      title: id,
      performer: PerformerSchema,
      useCase: id.optional(),
      notes,
    }),
  ),
});
const ActionRef = z.strictObject({ screen: id, component: id });
export const UseCaseSchema = Named.extend({
  actor: z.string().optional(),
  entities: refs,
  screens: refs,
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  steps: z.array(
    z.strictObject({
      id,
      title: id,
      screen: id.optional(),
      action: ActionRef.optional(),
      notes,
    }),
  ),
  branches: z.array(
    z.strictObject({
      id,
      kind: z.enum(["alternate", "exception"]),
      from: id,
      condition: id,
      outcome: id,
      resumeAt: id.optional(),
      screen: id.optional(),
      notes,
    }),
  ),
});
export const ComponentSchema = z.strictObject({
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
  useCases: refs.optional(),
  precondition: z.string().optional(),
  outcome: z.string().optional(),
  notes,
});
export const ScreenSchema = Named.extend({
  description: z.string().optional(),
  entities: refs,
  useCases: refs,
  components: z.array(ComponentSchema),
  stateFlow: z.strictObject({
    notes,
    initial: id.nullable(),
    states: z.array(Named),
    transitions: z.array(
      z.strictObject({
        from: id,
        to: id,
        trigger: id,
        component: id.optional(),
        notes,
      }),
    ),
  }),
});
export const TransitionSchema = z.strictObject({
  from: id,
  to: id,
  trigger: id,
  notes,
});
export const SpecSchema = z.strictObject({
  version: z.literal("2.0"),
  title: id,
  notes,
  domain: DomainSchema,
  flows: z.array(FlowSchema),
  useCases: z.array(UseCaseSchema),
  screens: z.array(ScreenSchema),
  transitions: z.array(TransitionSchema),
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
  const entities = unique(spec.domain.entities, "domain.entities");
  const actors = unique(spec.domain.actors, "domain.actors");
  const externalSystems = unique(
    spec.domain.externalSystems,
    "domain.externalSystems",
  );
  const cases = unique(spec.useCases, "useCases");
  unique(spec.domain.terms, "domain.terms");
  unique(spec.flows, "flows");
  spec.domain.entities.forEach((entity, i) => {
    unique(entity.fields, `domain.entities[${i}].fields`);
    entity.fields.forEach((field, j) =>
      ref(field.entity, entities, `domain.entities[${i}].fields[${j}].entity`),
    );
  });
  spec.domain.terms.forEach((term, i) =>
    ref(term.entity, entities, `domain.terms[${i}].entity`),
  );
  spec.flows.forEach((flow, i) => {
    unique(flow.steps, `flows[${i}].steps`);
    flow.steps.forEach((step, j) => {
      ref(step.useCase, cases, `flows[${i}].steps[${j}].useCase`);
      ref(
        step.performer.id,
        step.performer.kind === "actor" ? actors : externalSystems,
        `flows[${i}].steps[${j}].performer.id`,
      );
    });
  });
  spec.useCases.forEach((useCase, i) => {
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
      if (screen.stateFlow.initial === null && states.size) {
        issues.push({
          path: `${path}.stateFlow.initial`,
          message: "状態を定義した場合は初期状態を指定してください。",
        });
      } else {
        ref(
          screen.stateFlow.initial ?? undefined,
          states,
          `${path}.stateFlow.initial`,
        );
      }
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
  return error.issues.map((issue) => {
    let message = "値の形式を確認してください。";
    if (issue.code === "invalid_type") {
      const types: Record<string, string> = {
        string: "文字列",
        array: "配列",
        object: "オブジェクト",
        boolean: "真偽値",
        number: "数値",
      };
      message = `${types[issue.expected] ?? issue.expected}を指定してください。`;
    } else if (issue.code === "invalid_value") {
      message = `${issue.values.join("、")}のいずれかを指定してください。`;
    } else if (issue.code === "unrecognized_keys") {
      message = `未定義の項目です: ${issue.keys.join("、")}`;
    } else if (issue.code === "too_small") {
      message = `${issue.minimum}${issue.origin === "array" ? "件" : "文字"}以上を指定してください。`;
    }
    return { path: issue.path.length ? issue.path.join(".") : "spec", message };
  });
}
