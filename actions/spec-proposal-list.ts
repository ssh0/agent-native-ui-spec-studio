import { defineAction } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../server/db/index.js";
import { specProposals } from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description: "List this project's AI specification proposals and their proposed, approved, or rejected statuses.",
  mcpTool: true, http: { method: "GET" }, readOnly: true,
  schema: z.object({ projectId: z.string() }),
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId }) => {
    const project = await resolveSpecProject(projectId);
    return getDb().select({ id: specProposals.id, baseVersionId: specProposals.baseVersionId, status: specProposals.status, summary: specProposals.summary, createdAt: specProposals.createdAt, decidedAt: specProposals.decidedAt, appliedVersionId: specProposals.appliedVersionId })
      .from(specProposals).where(and(eq(specProposals.projectId, project.id), eq(specProposals.ownerEmail, project.ownerEmail))).orderBy(desc(specProposals.createdAt));
  },
});
