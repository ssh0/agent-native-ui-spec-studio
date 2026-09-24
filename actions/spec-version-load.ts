import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { specTargets } from "../shared/spec-versions.js";
import { parseSpecYaml } from "../shared/spec-utils.js";
import { getDb } from "../server/db/index.js";
import { specElementReviews, specVersions } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { ensureCurrentVersion } from "../server/lib/spec-version-store.js";

export default defineAction({
  description: "Read an immutable saved specification version and its version-bound element feedback.",
  mcpTool: true,
  schema: z.object({ projectId: z.string().optional().describe("Selected project ID; defaults to current navigation"), versionId: z.string().describe("Saved version ID") }),
  http: { method: "GET" }, readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId, versionId }) => {
    const project = await resolveSpecProject(projectId);
    const current = await ensureCurrentVersion(project.id);
    const [version] = await getDb().select().from(specVersions).where(and(eq(specVersions.projectId, project.id), eq(specVersions.ownerEmail, project.ownerEmail), eq(specVersions.id, versionId)));
    if (!version) fail("指定された版は見つかりません。", { statusCode: 404 });
    const parsed = parseSpecYaml(version.yaml);
    if (!parsed.spec || parsed.issues.length) fail("保存版を読み取れません。", { statusCode: 500 });
    const feedback = await getDb().select().from(specElementReviews).where(and(eq(specElementReviews.projectId, project.id), eq(specElementReviews.ownerEmail, project.ownerEmail), eq(specElementReviews.versionId, versionId)));
    return { ...version, current: current?.currentVersionId === versionId, targets: specTargets(parsed.spec).map(({ value, ...target }) => target), feedback };
  },
});
