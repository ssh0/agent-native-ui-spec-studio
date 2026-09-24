import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { createSpecProposal } from "../server/lib/spec-proposals.js";

export default defineAction({
  description: "Propose the first rough, valid version 2.0 UI specification skeleton after discussing a new project in chat. The canonical spec stays empty until the user approves this proposal.",
  mcpTool: true,
  schema: z.object({
    projectId: z.string(), yaml: z.string().min(1).max(500_000),
    summary: z.string().trim().min(1).max(2000), impactSummary: z.string().trim().min(1).max(4000),
    sources: z.array(z.object({ kind: z.enum(["chat", "attachment"]), threadId: z.string().min(1), messageId: z.string().min(1), attachmentId: z.string().optional(), locator: z.string().trim().min(1).max(500), evidence: z.string().trim().min(1).max(3000), targetKeys: z.array(z.string().min(1)).min(1).max(100) })).min(1).max(30),
    assumptions: z.array(z.string().trim().min(1).max(1000)).max(30), questions: z.array(z.string().trim().min(1).max(1000)).max(30),
  }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const project = await resolveSpecProject(args.projectId);
    const { proposal, changes } = await createSpecProposal({ ...args, projectId: project.id, ownerEmail: project.ownerEmail, baseVersionId: null });
    return { id: proposal.id, status: proposal.status, baseVersionId: null, changes: changes.map(({ change, target }) => ({ change, key: target.key, kind: target.kind, id: target.id, parentId: target.parentId, title: target.title, stage: target.stage })) };
  },
});
