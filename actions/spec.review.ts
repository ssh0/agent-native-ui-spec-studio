import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";

export default defineAction({
  description:
    "Approve or return the shared UI specification with a review comment.",
  schema: z.object({
    status: z.enum(["approved", "changes_requested"]),
    comment: z.string().max(2000).optional().describe("Review note"),
  }),
  run: async ({ status, comment }) => {
    const [row] = await getDb()
      .update(schema.uiSpecs)
      .set({
        reviewStatus: status,
        reviewComment: comment ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.uiSpecs.id, "default"))
      .returning();
    if (!row) throw new Error("No UI specification has been saved yet.");
    return {
      status: row.reviewStatus,
      comment: row.reviewComment,
      updatedAt: row.updatedAt,
    };
  },
});
