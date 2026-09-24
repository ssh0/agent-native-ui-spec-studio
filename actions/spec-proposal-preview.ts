import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../server/db/index.js";
import { specVersions } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { ensureCurrentVersion } from "../server/lib/spec-version-store.js";
import { parseSpecYaml } from "../shared/spec-utils.js";
import { diffSpecVersions, specTargets } from "../shared/spec-versions.js";

export default defineAction({
  description: "Preview a candidate YAML's stable-ID diff against the current saved version. Use the returned target keys to map proposal sources before creating the proposal. Does not save anything.",
  mcpTool: true, readOnly: true,
  schema: z.object({ projectId: z.string(), baseVersionId: z.string().uuid().nullable(), yaml: z.string().min(1).max(500_000) }),
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId, baseVersionId, yaml }) => {
    const project = await resolveSpecProject(projectId);
    const current = await ensureCurrentVersion(project.id);
    if ((current?.currentVersionId ?? null) !== baseVersionId || (baseVersionId === null && current)) fail("基準版が現在の仕様と一致しません。", { statusCode: 409 });
    const [base] = baseVersionId ? await getDb().select().from(specVersions).where(and(eq(specVersions.id, baseVersionId), eq(specVersions.projectId, project.id), eq(specVersions.ownerEmail, project.ownerEmail))) : [];
    if (baseVersionId && !base) fail("基準版が見つかりません。", { statusCode: 404 });
    const before = base ? parseSpecYaml(base.yaml) : null;
    const after = parseSpecYaml(yaml);
    if ((before && (!before.spec || before.issues.length)) || !after.spec || after.issues.length)
      fail(`仕様案の YAML が無効です: ${after.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`, { statusCode: 400 });
    if (!base && after.spec.version !== "2.0") fail("最初の仕様案は 2.0 YAML にしてください。", { statusCode: 400 });
    return { baseVersionId, changes: (before?.spec ? diffSpecVersions(before.spec, after.spec) : specTargets(after.spec).map((target) => ({ change: "added" as const, target }))).map(({ change, target }) => ({ change, key: target.key, kind: target.kind, id: target.id, parentId: target.parentId, title: target.title, stage: target.stage })) };
  },
});
