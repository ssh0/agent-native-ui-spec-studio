import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "Load the selected project's UI specification YAML and review metadata.",
  mcpTool: true,
  schema: z.object({
    projectId: z
      .string()
      .optional()
      .describe("Selected project ID; defaults to current navigation"),
  }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async ({ projectId }) => {
    const project = await resolveSpecProject(projectId);
    const db = getDb();
    let [row] = await db
      .select()
      .from(schema.uiSpecs)
      .where(eq(schema.uiSpecs.id, project.id));
    if (!row) {
      return {
        id: project.id,
        yaml: "",
        reviewStatus: "draft",
        reviewHistory: [],
        reviewComment: null,
        updatedAt: "",
      };
    }
    return {
      id: row.id,
      yaml: row.yaml,
      reviewStatus: row.reviewStatus,
      reviewHistory: row.reviewHistory,
      reviewComment: row.reviewComment,
      updatedAt: row.updatedAt,
    };
  },
});
