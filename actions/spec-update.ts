import { defineAction, fail } from "@agent-native/core/action";
import { parseSpecYaml } from "@shared/spec-utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";
import { resolveSpecProject } from "../server/lib/spec-project.js";

export default defineAction({
  description:
    "Save the selected project's UI specification YAML. Saving resets the review status to draft.",
  mcpTool: true,
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
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
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
    const db = getDb();
    const values = {
      ownerEmail: project.ownerEmail,
      yaml,
      reviewStatus: "draft",
      reviewComment: null,
      updatedAt: new Date().toISOString(),
    };
    const [row] = expectedUpdatedAt
      ? await db
          .update(schema.uiSpecs)
          .set(values)
          .where(
            and(
              eq(schema.uiSpecs.id, project.id),
              eq(schema.uiSpecs.updatedAt, expectedUpdatedAt),
            ),
          )
          .returning()
      : await db
          .insert(schema.uiSpecs)
          .values({ id: project.id, ...values })
          .onConflictDoUpdate({ target: schema.uiSpecs.id, set: values })
          .returning();
    if (!row)
      fail("別の編集が保存されました。仕様を読み直してください。", {
        statusCode: 409,
      });
    return {
      id: row.id,
      yaml: row.yaml,
      reviewStatus: row.reviewStatus,
      updatedAt: row.updatedAt,
    };
  },
});
