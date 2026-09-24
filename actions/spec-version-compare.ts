import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { diffSpecVersions } from "../shared/spec-versions.js";
import { parseSpecYaml } from "../shared/spec-utils.js";
import { getDb } from "../server/db/index.js";
import { specVersions } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { ensureCurrentVersion } from "../server/lib/spec-version-store.js";

export default defineAction({
  description: "Compare two saved specification versions by stable element IDs and return added, removed, and changed targets.",
  mcpTool: true,
  schema: z.object({ projectId: z.string().optional().describe("Selected project ID; defaults to current navigation"), fromVersionId: z.string(), toVersionId: z.string() }),
  http: { method: "GET" }, readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId, fromVersionId, toVersionId }) => {
    const project = await resolveSpecProject(projectId);
    await ensureCurrentVersion(project.id);
    const versions = await getDb().select().from(specVersions).where(and(eq(specVersions.projectId, project.id), eq(specVersions.ownerEmail, project.ownerEmail), inArray(specVersions.id, [fromVersionId, toVersionId])));
    const before = versions.find((v) => v.id === fromVersionId);
    const after = versions.find((v) => v.id === toVersionId);
    if (!before || !after) fail("比較する版が見つかりません。", { statusCode: 404 });
    const left = parseSpecYaml(before.yaml).spec;
    const right = parseSpecYaml(after.yaml).spec;
    if (!left || !right) fail("保存版を比較できません。", { statusCode: 500 });
    return { fromVersionId, toVersionId, changes: diffSpecVersions(left, right).map(({ target, change }) => { const { value, ...navigation } = target; return { change, ...navigation }; }) };
  },
});
