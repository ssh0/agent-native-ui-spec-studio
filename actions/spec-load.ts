import { defineAction } from "@agent-native/core/action";
import { DEFAULT_SPEC_YAML } from "@shared/default-spec";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import * as schema from "../server/db/schema.js";

const SPEC_ID = "default";

export default defineAction({
  description: "Load the shared UI specification YAML and review metadata.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async () => {
    const db = getDb();
    let [row] = await db
      .select()
      .from(schema.uiSpecs)
      .where(eq(schema.uiSpecs.id, SPEC_ID));
    if (!row) {
      [row] = await db
        .insert(schema.uiSpecs)
        .values({ id: SPEC_ID, yaml: DEFAULT_SPEC_YAML })
        .returning();
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
