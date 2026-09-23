import { defineAction, fail } from "@agent-native/core/action";
import { parseSpecYaml } from "@shared/spec-utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";

const SPEC_ID = "default";

export default defineAction({
  description:
    "Save the shared UI specification YAML. Saving resets the review status to draft.",
  mcpTool: true,
  schema: z.object({
    expectedUpdatedAt: z
      .string()
      .optional()
      .describe("Last loaded timestamp; reject concurrent edits when provided"),
    yaml: z.string().min(1).describe("Complete UI specification YAML document"),
  }),
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async ({ yaml, expectedUpdatedAt }) => {
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
              eq(schema.uiSpecs.id, SPEC_ID),
              eq(schema.uiSpecs.updatedAt, expectedUpdatedAt),
            ),
          )
          .returning()
      : await db
          .insert(schema.uiSpecs)
          .values({ id: SPEC_ID, ...values })
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
