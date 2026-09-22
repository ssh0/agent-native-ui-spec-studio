import { sql } from "drizzle-orm";
import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

import type { ReviewEntry } from "../../shared/spec-schema.js";

export const uiSpecs = pgTable("ui_specs", {
  id: text("id").primaryKey(),
  yaml: text("yaml").notNull(),
  reviewStatus: text("review_status").notNull().default("draft"),
  reviewHistory: jsonb("review_history")
    .$type<ReviewEntry[]>()
    .notNull()
    .default([]),
  reviewComment: text("review_comment"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
