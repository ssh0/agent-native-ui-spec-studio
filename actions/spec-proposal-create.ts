import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { resolveSpecProject } from "../server/lib/spec-project.js";
import { createSpecProposal } from "../server/lib/spec-proposals.js";

export default defineAction({
  description: "Draft a source-backed UI specification proposal against the current saved version. Does not change the canonical specification. Cite actual user message IDs and uploaded attachment IDs from this project's chat, with precise locators and evidence. State assumptions and open questions.",
  mcpTool: true,
  schema: z.object({
    projectId: z.string().describe("Selected project ID"),
    baseVersionId: z.string().uuid().describe("Current saved spec version ID"),
    yaml: z.string().min(1).max(500_000).describe("Complete proposed valid specification YAML"),
    summary: z.string().trim().min(1).max(2000),
    impactSummary: z.string().trim().min(1).max(4000),
    sources: z.array(z.object({
      kind: z.enum(["chat", "attachment"]), threadId: z.string().min(1), messageId: z.string().min(1),
      attachmentId: z.string().optional(), locator: z.string().trim().min(1).max(500),
      evidence: z.string().trim().min(1).max(3000),
      targetKeys: z.array(z.string().min(1)).min(1).max(100).describe("Stable target keys from the proposal diff supported by this source"),
    })).min(1).max(30),
    assumptions: z.array(z.string().trim().min(1).max(1000)).max(30),
    questions: z.array(z.string().trim().min(1).max(1000)).max(30),
  }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const project = await resolveSpecProject(args.projectId);
    const { proposal, changes } = await createSpecProposal({ ...args, projectId: project.id, ownerEmail: project.ownerEmail });
    return { id: proposal.id, status: proposal.status, baseVersionId: proposal.baseVersionId, changes: changes.map(({ change, target }) => ({ change, key: target.key, kind: target.kind, id: target.id, parentId: target.parentId, title: target.title, stage: target.stage })) };
  },
});
