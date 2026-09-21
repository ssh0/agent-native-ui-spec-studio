import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";

const SPEC_ID = "default";

export default defineAction({
  description:
    "Save the shared UI specification YAML. Saving resets the review status to draft.",
  schema: z.object({
    yaml: z.string().min(1).describe("Complete UI specification YAML document"),
  }),
  run: async ({ yaml }) => {
    const db = getDb();
    const [row] = await db
      .insert(schema.uiSpecs)
      .values({ id: SPEC_ID, yaml, reviewStatus: "draft" })
      .onConflictDoUpdate({
        target: schema.uiSpecs.id,
        set: {
          yaml,
          reviewStatus: "draft",
          reviewComment: null,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    return {
      id: row.id,
      yaml: row.yaml,
      reviewStatus: row.reviewStatus,
      updatedAt: row.updatedAt,
    };
  },
});
