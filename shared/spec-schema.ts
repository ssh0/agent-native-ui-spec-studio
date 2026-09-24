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
  "relations",
  "terms",
  "actors",
  "externalSystems",
] as const;
export type DomainSection = (typeof domainSections)[number];
export const domainSectionLabels: Record<DomainSection, string> = {
  entities: "エンティティ",
  relations: "エンティティ間の関連",
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
export const ActorRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("actor"), id }),
  z.strictObject({ kind: z.literal("term"), id }),
]);
export type ActorRef = z.infer<typeof ActorRefSchema>;
export const EntityRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("entity"), id }),
  z.strictObject({ kind: z.literal("term"), id }),
]);
export type EntityRef = z.infer<typeof EntityRefSchema>;
function setExpression<T extends z.ZodType>(reference: T) {
  type Expr =
    | z.infer<T>
    | { op: "union" | "intersection" | "difference"; operands: Expr[] };
  const expression: z.ZodType<Expr> = z.lazy(() =>
    z.union([
      reference,
      z.strictObject({
        op: z.enum(["union", "intersection", "difference"]),
        operands: z.array(expression).min(2),
      }),
    ]),
  );
  return expression;
}
export const ActorSetSchema = setExpression(ActorRefSchema);
export const EntitySetSchema = setExpression(EntityRefSchema);
export const PerformerSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("actors"),
    refs: z.array(ActorRefSchema).min(1),
  }),
  z.strictObject({ kind: z.literal("externalSystem"), id }),
]);
const RelationEndSchema = z.strictObject({
  entity: z.strictObject({ kind: z.literal("entity"), id }),
  role: id,
  min: z.number().int().nonnegative(),
  max: z.number().int().positive().nullable(),
});
export const DomainSchema = z.strictObject({
  notes,
  actors: z.array(ParticipantSchema),
  externalSystems: z.array(ParticipantSchema),
  relations: z.array(
    Named.extend({ from: RelationEndSchema, to: RelationEndSchema }),
  ),
  entities: z.array(
    Named.extend({
      description: z.string().optional(),
      extends: refs,
      fields: z.array(
        z.strictObject({
          id,
          title: id,
          type: id,
          required: z.boolean().optional(),
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
      actorSet: ActorSetSchema.optional(),
      entitySet: EntitySetSchema.optional(),
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
  actors: z.array(ActorRefSchema),
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
        id: id.optional(),
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
  id: id.optional(),
  from: id,
  to: id,
  trigger: id,
  notes,
});
export const SpecSchema = z.strictObject({
  version: z.enum(["2.0", "2.1"]),
  title: id,
  notes,
  domain: DomainSchema,
  flows: z.array(FlowSchema),
  useCases: z.array(UseCaseSchema),
  screens: z.array(ScreenSchema),
  transitions: z.array(TransitionSchema),
}).superRefine((spec, context) => {
  const check = (items: { id?: string }[], path: (string | number)[]) =>
    items.forEach((item, index) => {
      if (spec.version === "2.1" && !item.id)
        context.addIssue({ code: "custom", path: [...path, index, "id"], message: "2.1 の遷移には ID が必要です。" });
      if (spec.version === "2.0" && item.id !== undefined)
        context.addIssue({ code: "custom", path: [...path, index, "id"], message: "2.0 の遷移に ID は指定できません。明示的に移行してください。" });
    });
  check(spec.transitions, ["transitions"]);
  spec.screens.forEach((screen, index) => check(screen.stateFlow.transitions, ["screens", index, "stateFlow", "transitions"]));
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
  versionId?: string;
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
  const terms = unique(spec.domain.terms, "domain.terms");
  unique(spec.domain.relations, "domain.relations");
  unique(spec.flows, "flows");
  const actorRef = (value: ActorRef, path: string) => {
    ref(value.id, value.kind === "actor" ? actors : terms, `${path}.id`);
    if (
      value.kind === "term" &&
      terms.has(value.id) &&
      !spec.domain.terms.find((t) => t.id === value.id)?.actorSet
    )
      issues.push({
        path,
        message: "参照先の用語にアクター集合がありません。",
      });
  };
  const actorRefs = (values: ActorRef[], path: string) => {
    const seen = new Set<string>();
    values.forEach((value, i) => {
      actorRef(value, `${path}[${i}]`);
      const key = `${value.kind}:${value.id}`;
      if (seen.has(key))
        issues.push({
          path: `${path}[${i}]`,
          message: "同じアクター参照が重複しています。",
        });
      seen.add(key);
    });
  };
  const checkSet = (
    value: z.infer<typeof ActorSetSchema> | z.infer<typeof EntitySetSchema>,
    path: string,
    kind: "actor" | "entity",
    dependencies: Set<string>,
  ): void => {
    if ("op" in value) {
      if (value.op === "difference" && value.operands.length !== 2)
        issues.push({
          path: `${path}.operands`,
          message: "差集合は左集合と除外集合の2項を指定してください。",
        });
      value.operands.forEach((operand, i) =>
        checkSet(operand, `${path}.operands[${i}]`, kind, dependencies),
      );
    } else if (kind === "actor") {
      if (value.kind === "actor") ref(value.id, actors, `${path}.id`);
      else if (value.kind === "term") {
        ref(value.id, terms, `${path}.id`);
        if (
          terms.has(value.id) &&
          !spec.domain.terms.find((t) => t.id === value.id)?.actorSet
        )
          issues.push({
            path,
            message: "参照先の用語にアクター集合がありません。",
          });
        dependencies.add(value.id);
      } else
        issues.push({
          path,
          message: "アクター集合にはアクターまたは用語を指定してください。",
        });
    } else if (value.kind === "entity") ref(value.id, entities, `${path}.id`);
    else if (value.kind === "term") {
      ref(value.id, terms, `${path}.id`);
      if (
        terms.has(value.id) &&
        !spec.domain.terms.find((t) => t.id === value.id)?.entitySet
      )
        issues.push({
          path,
          message: "参照先の用語にエンティティ集合がありません。",
        });
      dependencies.add(value.id);
    } else
      issues.push({
        path,
        message:
          "エンティティ集合にはエンティティまたは用語を指定してください。",
      });
  };
  const termGraph = new Map<string, Set<string>>();
  spec.domain.terms.forEach((term, i) => {
    if (term.actorSet && term.entitySet)
      issues.push({
        path: `domain.terms[${i}]`,
        message: "アクター集合とエンティティ集合は同じ用語に定義できません。",
      });
    const dependencies = new Set<string>();
    if (term.actorSet)
      checkSet(
        term.actorSet,
        `domain.terms[${i}].actorSet`,
        "actor",
        dependencies,
      );
    if (term.entitySet)
      checkSet(
        term.entitySet,
        `domain.terms[${i}].entitySet`,
        "entity",
        dependencies,
      );
    termGraph.set(term.id, dependencies);
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitTerm = (termId: string) => {
    if (visiting.has(termId)) return true;
    if (visited.has(termId)) return false;
    visiting.add(termId);
    for (const next of termGraph.get(termId) ?? []) {
      if (visitTerm(next)) {
        issues.push({
          path: `domain.terms.${termId}.actorSet`,
          message: "用語の集合定義が循環しています。",
        });
        break;
      }
    }
    visiting.delete(termId);
    visited.add(termId);
    return false;
  };
  spec.domain.terms.forEach((term) => visitTerm(term.id));
  const entityGraph = new Map(
    spec.domain.entities.map((entity) => [entity.id, entity.extends]),
  );
  const entityVisiting = new Set<string>();
  const entityVisited = new Set<string>();
  const visitEntity = (entityId: string) => {
    if (entityVisiting.has(entityId)) return true;
    if (entityVisited.has(entityId)) return false;
    entityVisiting.add(entityId);
    for (const parent of entityGraph.get(entityId) ?? []) {
      if (visitEntity(parent)) {
        issues.push({
          path: `domain.entities.${entityId}.extends`,
          message: "エンティティの継承関係が循環しています。",
        });
        break;
      }
    }
    entityVisiting.delete(entityId);
    entityVisited.add(entityId);
    return false;
  };
  spec.domain.entities.forEach((entity, i) => {
    unique(entity.fields, `domain.entities[${i}].fields`);
    many(entity.extends, entities, `domain.entities[${i}].extends`);
    if (new Set(entity.extends).size !== entity.extends.length)
      issues.push({
        path: `domain.entities[${i}].extends`,
        message: "上位エンティティの参照が重複しています。",
      });
    visitEntity(entity.id);
  });
  spec.domain.relations.forEach((relation, i) => {
    for (const end of ["from", "to"] as const) {
      const endpoint = relation[end];
      ref(
        endpoint.entity.id,
        entities,
        `domain.relations[${i}].${end}.entity.id`,
      );
      if (endpoint.max !== null && endpoint.max < endpoint.min)
        issues.push({
          path: `domain.relations[${i}].${end}.max`,
          message: "最大多重度は最小多重度以上にしてください。",
        });
    }
  });
  spec.domain.terms.forEach((term, i) =>
    ref(term.entity, entities, `domain.terms[${i}].entity`),
  );
  spec.flows.forEach((flow, i) => {
    unique(flow.steps, `flows[${i}].steps`);
    flow.steps.forEach((step, j) => {
      ref(step.useCase, cases, `flows[${i}].steps[${j}].useCase`);
      if (step.performer.kind === "actors")
        actorRefs(
          step.performer.refs,
          `flows[${i}].steps[${j}].performer.refs`,
        );
      else
        ref(
          step.performer.id,
          externalSystems,
          `flows[${i}].steps[${j}].performer.id`,
        );
    });
  });
  spec.useCases.forEach((useCase, i) => {
    const path = `useCases[${i}]`;
    actorRefs(useCase.actors, `${path}.actors`);
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
      if (spec.version === "2.1") unique(screen.stateFlow.transitions as { id: string }[], `${path}.stateFlow.transitions`);
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
  if (spec.version === "2.1") unique(spec.transitions as { id: string }[], "transitions");
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
    } else if (issue.code === "custom") {
      message = issue.message;
    }
    return { path: issue.path.length ? issue.path.join(".") : "spec", message };
  });
}
