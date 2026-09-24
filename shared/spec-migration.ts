import { SpecSchema, validateSpecRelations, type UiSpec, type ValidationIssue } from "./spec-schema.js";

type Transition = UiSpec["transitions"][number];

// The fields are ordered explicitly so YAML key order and array order do not affect IDs.
function transitionKey(scope: string, transition: Transition): string {
  return JSON.stringify([
    scope,
    transition.from,
    transition.to,
    transition.trigger,
    "component" in transition ? transition.component ?? null : null,
    transition.notes ?? null,
  ]);
}

function stableId(key: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (const byte of new TextEncoder().encode(key)) {
    a = Math.imul(a ^ byte, 0x01000193);
    b = Math.imul(b ^ byte, 0x85ebca6b);
  }
  return `transition-${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

export function migrateSpecTo21(spec: UiSpec): { spec?: UiSpec; issues: ValidationIssue[] } {
  if (spec.version !== "2.0")
    return { issues: [{ path: "version", message: "移行元は 2.0 である必要があります。" }] };
  const issues = validateSpecRelations(spec);
  if (issues.length) return { issues };
  const migrate = <T extends Transition>(items: T[], scope: string, path: string): (T & { id: string })[] => {
    const seen = new Map<string, number>();
    const ids = new Map<string, string>();
    return items.map((item, index) => {
      const key = transitionKey(scope, item);
      const id = stableId(key);
      const earlier = seen.get(key);
      if (earlier !== undefined)
        issues.push({ path: `${path}[${index}]`, message: `${path}[${earlier}] と同じ遷移です。一意な ID を割り当てられないため、違いを明記してください。` });
      const collision = ids.get(id);
      if (collision && collision !== key)
        issues.push({ path: `${path}[${index}]`, message: `生成 ID「${id}」が衝突しました。遷移の内容を変更してください。` });
      seen.set(key, index);
      ids.set(id, key);
      return { ...item, id };
    });
  };
  const migrated = {
    ...spec,
    version: "2.1" as const,
    transitions: migrate(spec.transitions, "screens", "transitions"),
    screens: spec.screens.map((screen, index) => ({
      ...screen,
      stateFlow: {
        ...screen.stateFlow,
        transitions: migrate(screen.stateFlow.transitions, `states:${screen.id}`, `screens[${index}].stateFlow.transitions`),
      },
    })),
  };
  if (issues.length) return { issues };
  const result = SpecSchema.safeParse(migrated);
  if (!result.success) return { issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) };
  return { spec: result.data, issues: validateSpecRelations(result.data) };
}
