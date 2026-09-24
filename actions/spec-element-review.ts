import { randomUUID } from "node:crypto";
import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { specTargets } from "../shared/spec-versions.js";
import { parseSpecYaml } from "../shared/spec-utils.js";
import { getDb } from "../server/db/index.js";
import { specElementReviews, specVersions } from "../server/db/schema.js";
import { resolveSpecProject, currentUserEmail } from "../server/lib/spec-project.js";
import { ensureCurrentVersion } from "../server/lib/spec-version-store.js";

export default defineAction({
  description: "Record an element-level decision or comment for an exact saved version and stable target. This never approves the whole specification.",
  mcpTool: true,
  schema: z.object({ projectId: z.string().optional().describe("Selected project ID; defaults to current navigation"), versionId: z.string().describe("Saved version being reviewed"), targetKey: z.string().describe("Exact target key from spec-version-load"), decision: z.enum(["approved", "changes_requested", "comment"]), comment: z.string().max(2000).default("") }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async ({ projectId, versionId, targetKey, decision, comment }) => {
    const project = await resolveSpecProject(projectId);
    await ensureCurrentVersion(project.id);
    const [version] = await getDb().select().from(specVersions).where(and(eq(specVersions.projectId, project.id), eq(specVersions.ownerEmail, project.ownerEmail), eq(specVersions.id, versionId)));
    if (!version) fail("指定された版は見つかりません。", { statusCode: 404 });
    const parsed = parseSpecYaml(version.yaml);
    if (!parsed.spec || parsed.issues.length) fail("保存版をレビューできません。", { statusCode: 500 });
    const target = specTargets(parsed.spec).find((item) => item.key === targetKey);
    if (!target) fail("この版に対象要素がありません。", { statusCode: 404 });
    if (decision === "comment" && !comment.trim()) fail("コメントを入力してください。");
    const entry = { id: randomUUID(), projectId: project.id, ownerEmail: project.ownerEmail, versionId, targetKey, targetKind: target.kind, targetTitle: target.title, reviewerEmail: currentUserEmail(), decision, comment, createdAt: new Date().toISOString() };
    const [saved] = await getDb().insert(specElementReviews).values(entry).returning();
    return saved;
  },
});
