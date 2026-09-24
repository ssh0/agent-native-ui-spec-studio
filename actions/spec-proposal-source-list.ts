import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { listProposalSources } from "../server/lib/proposal-sources.js";

export default defineAction({
  description: "List actual user message and uploaded attachment IDs in this project's thread so a proposed spec can cite precise sources. Attachment contents are not returned.",
  mcpTool: true, http: { method: "GET" }, readOnly: true,
  schema: z.object({ projectId: z.string(), threadId: z.string() }),
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId, threadId }) => {
    const project = await resolveSpecProject(projectId);
    return listProposalSources(project.id, project.ownerEmail, threadId);
  },
});
