import { defineAction, fail } from "@agent-native/core/action";
import { parseSpecYaml } from "@shared/spec-utils";
import { z } from "zod";

import { saveSpecVersion } from "../server/lib/spec-version-store.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "Save the selected project's UI specification YAML. Saving resets the review status to draft.",
  agentTool: false,
  toolCallable: false,
  schema: z.object({
    projectId: z
      .string()
      .optional()
      .describe("Selected project ID; defaults to current navigation"),
    expectedUpdatedAt: z
      .string()
      .optional()
      .describe("Last loaded timestamp; reject concurrent edits when provided"),
    yaml: z.string().min(1).describe("Complete UI specification YAML document"),
  }),
  run: async ({ yaml, expectedUpdatedAt, projectId }) => {
    const project = await resolveSpecProject(projectId);
    const parsed = parseSpecYaml(yaml);
    if (parsed.spec && parsed.issues.length)
      fail(
        parsed.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("\n"),
        { statusCode: 400 },
      );
    const row = await saveSpecVersion(project.id, project.ownerEmail, yaml, expectedUpdatedAt);
    return {
      id: row.id,
      yaml: row.yaml,
      reviewStatus: row.reviewStatus,
      updatedAt: row.updatedAt,
    };
  },
});
