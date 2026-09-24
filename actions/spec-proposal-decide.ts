import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { decideSpecProposal } from "../server/lib/spec-proposals.js";

export default defineAction({
  description: "User-only decision on an AI specification proposal. Approval applies it as a new canonical version; rejection leaves the specification untouched.",
  agentTool: false, toolCallable: false,
  schema: z.object({ projectId: z.string(), proposalId: z.string().uuid(), decision: z.enum(["approved", "rejected"]) }),
  run: async ({ projectId, proposalId, decision }) => {
    const project = await resolveSpecProject(projectId);
    const proposal = await decideSpecProposal(project.id, project.ownerEmail, proposalId, decision);
    return { id: proposal.id, status: proposal.status, appliedVersionId: proposal.appliedVersionId };
  },
});
