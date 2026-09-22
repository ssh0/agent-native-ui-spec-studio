import { defineAction } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";

const SPEC_ID = "default";

export default defineAction({
  description:
    "Save the shared UI specification YAML. Saving resets the review status to draft.",
  schema: z.object({
    expectedUpdatedAt: z
      .string()
      .optional()
      .describe("Last loaded timestamp; reject concurrent edits when provided"),
    yaml: z.string().min(1).describe("Complete UI specification YAML document"),
  }),
  run: async ({ yaml, expectedUpdatedAt }) => {
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
      throw new Error("別の編集が保存されました。仕様を読み直してください。");
    return {
      id: row.id,
      yaml: row.yaml,
      reviewStatus: row.reviewStatus,
      updatedAt: row.updatedAt,
    };
  },
});
