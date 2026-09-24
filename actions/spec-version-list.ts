import { defineAction } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../server/db/index.js";
import { specVersions } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { ensureCurrentVersion } from "../server/lib/spec-version-store.js";

export default defineAction({
  description: "List saved valid specification versions for the selected project, including the current editable version ID.",
  mcpTool: true,
  schema: z.object({ projectId: z.string().optional().describe("Selected project ID; defaults to current navigation") }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId }) => {
    const project = await resolveSpecProject(projectId);
    const current = await ensureCurrentVersion(project.id);
    const versions = await getDb().select({ id: specVersions.id, documentHash: specVersions.documentHash, createdAt: specVersions.createdAt })
      .from(specVersions).where(and(eq(specVersions.projectId, project.id), eq(specVersions.ownerEmail, project.ownerEmail))).orderBy(desc(specVersions.createdAt));
    return { currentVersionId: current?.currentVersionId ?? null, versions };
  },
});
