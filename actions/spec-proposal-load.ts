import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { loadSpecProposal } from "../server/lib/spec-proposals.js";

export default defineAction({
  description: "Load a proposal, cited sources, questions, base YAML, candidate YAML, and stable-ID-aware diff. This is distinct from document or element review.",
  mcpTool: true, http: { method: "GET" }, readOnly: true,
  schema: z.object({ projectId: z.string(), proposalId: z.string().uuid() }),
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId, proposalId }) => {
    const project = await resolveSpecProject(projectId);
    return loadSpecProposal(project.id, project.ownerEmail, proposalId);
  },
});
